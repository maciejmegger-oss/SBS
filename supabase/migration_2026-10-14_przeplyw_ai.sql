-- PRZEPŁYW „AI → SKAUT → TRENER → DYREKTOR" I DZIENNIK ZMIAN
--
-- PO CO TO JEST
-- Cel systemu: AI wyszukuje i analizuje, skaut weryfikuje, trener ocenia dopasowanie sportowe,
-- dyrektor sportowy podejmuje decyzję. Dotąd w bazie nie było miejsca, które by tę kolejność
-- WYMUSZAŁO: wynik AI lądował w polu zawodnika (`opiniaAI`), a decyzję komitetu mógł wpisać
-- każdy zatwierdzony użytkownik. Ta migracja dodaje:
--   1. role `trener` i `dyrektor` (jako wartości kolumny sbs_konta.rola — kolumna jest tekstem,
--      więc nie trzeba niczego przebudowywać),
--   2. tabelę sbs_ai_propozycje — jedna propozycja AI przechodzi przez cztery etapy, a baza
--      pilnuje, KTO może ją przesunąć dalej,
--   3. tabelę sbs_audit — dziennik zmian tylko do dopisywania, czytany wyłącznie przez administratora.
--
-- CZEGO TA MIGRACJA NIE ROBI
--   * Nie zmienia żadnej istniejącej reguły ani tabeli. Aplikacja działa po niej tak samo jak przed.
--   * Nie nadaje nikomu nowych ról. Role `trener` i `dyrektor` nadaje administrator ręcznie:
--         update sbs_konta set rola = 'trener'   where lower(email) = 'adres@klubu.pl';
--         update sbs_konta set rola = 'dyrektor' where lower(email) = 'adres@klubu.pl';
--     Aplikacja do czasu aktualizacji interfejsu traktuje nieznaną rolę jak `scout`
--     (src/data/auth.ts), więc takie konto nie traci dostępu do pracy.
--   * Nie podłącza AI do tabeli. Endpointy AI zapisują dziś wynik w kartotece; podpięcie ich do
--     sbs_ai_propozycje to osobny, następny krok.
--
-- ETAPY (kolumna `stan`)
--   ai_propozycja       — AI coś znalazło lub opisało; nikt jeszcze tego nie sprawdził
--   zweryfikowane_skaut — skaut potwierdził fakty (może je poprawić w `skaut_uwagi`)
--   ocena_trenera       — trener ocenił dopasowanie sportowe (`trener_ocena`)
--   decyzja_dyrektora   — dyrektor podjął decyzję (`dyrektor_decyzja`) — etap końcowy
--   odrzucone           — ktokolwiek z uprawnionych ról może zatrzymać propozycję — etap końcowy
--
-- KTO CO MOŻE
--   skaut     → ai_propozycja → zweryfikowane_skaut, edytuje `skaut_*`
--   trener    → zweryfikowane_skaut → ocena_trenera, edytuje `trener_*`
--   dyrektor  → ocena_trenera → decyzja_dyrektora, edytuje `dyrektor_*`
--   admin     → wszystko powyższe, plus kasowanie
--   klient    → nie widzi tej tabeli w ogóle
--   Treści wygenerowanej przez AI (tresc, zrodla, pewnosc, model) nie zmienia nikt: jeśli AI
--   ma napisać coś nowego, powstaje NOWA propozycja. Dzięki temu widać, co było w oryginale.
--
-- URUCHOMIENIE: Supabase → SQL Editor → New query → wklej całość → Run. Bezpieczne do powtórzenia.
-- COFNIĘCIE:    drop table if exists public.sbs_ai_propozycje, public.sbs_audit cascade;
--               (funkcje sbs_rola, sbs_ma_role mogą zostać)
-- Wymaga wcześniejszego uruchomienia migration_2026-08-11_konta_i_zgoda.sql.

-- ---------------------------------------------------------------------------
-- 1. FUNKCJE POMOCNICZE: rola bieżącego konta
-- ---------------------------------------------------------------------------
--
-- Jak sbs_zatwierdzony(): security definer, bo czytają sbs_konta z pominięciem jej reguł, ale
-- odpowiadają wyłącznie o BIEŻĄCEGO użytkownika.

create or replace function public.sbs_rola()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select k.rola from public.sbs_konta k
  where k.user_id = auth.uid() and k.status = 'zatwierdzone';
$$;

-- Czy bieżące konto ma jedną z wymienionych ról. Administrator przechodzi zawsze.
create or replace function public.sbs_ma_role(role text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select r = 'admin' or r = any(role) from (select public.sbs_rola() as r) x),
    false);
$$;

grant execute on function public.sbs_rola() to authenticated;
grant execute on function public.sbs_ma_role(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. DZIENNIK ZMIAN
-- ---------------------------------------------------------------------------
--
-- Tylko do dopisywania, i to wyłącznie przez wyzwalacze. Nikt — nawet administrator — nie poprawia
-- ani nie kasuje wpisów z aplikacji. Dziennik, który da się wyczyścić, nie jest dziennikiem.

create table if not exists public.sbs_audit (
  id           bigint generated always as identity primary key,
  tabela       text not null,
  rekord_id    text,
  akcja        text not null,                 -- 'INSERT' | 'UPDATE' | 'DELETE'
  kto          uuid default auth.uid(),
  kto_email    text,                          -- przepisany na sztywno: konto można skasować, ślad ma zostać
  rola         text,
  przed        jsonb,
  po           jsonb,
  utworzone_at timestamptz not null default now()
);

create index if not exists sbs_audit_rekord_idx on public.sbs_audit (tabela, rekord_id, utworzone_at desc);
create index if not exists sbs_audit_czas_idx   on public.sbs_audit (utworzone_at desc);

alter table public.sbs_audit enable row level security;

drop policy if exists "audit: odczyt tylko administrator" on public.sbs_audit;
create policy "audit: odczyt tylko administrator"
  on public.sbs_audit for select to authenticated
  using ((select public.sbs_admin()));
-- Brak reguł insert/update/delete: z aplikacji nie da się niczego dopisać ani zmienić.

revoke all on public.sbs_audit from anon, authenticated;
grant select on public.sbs_audit to authenticated;

create or replace function public.sbs_audit_wyzwalacz()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  stary jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  nowy  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  insert into public.sbs_audit (tabela, rekord_id, akcja, kto, kto_email, rola, przed, po)
  values (
    tg_table_name,
    coalesce(nowy ->> 'id', stary ->> 'id'),
    tg_op,
    auth.uid(),
    (select k.email from public.sbs_konta k where k.user_id = auth.uid()),
    public.sbs_rola(),
    stary,
    nowy
  );
  return null;  -- wyzwalacz AFTER: wartość zwrotna jest ignorowana
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. PROPOZYCJE AI
-- ---------------------------------------------------------------------------

create table if not exists public.sbs_ai_propozycje (
  id                   bigint generated always as identity primary key,
  player_id            text references public.sbs_players(id) on delete set null,
  -- Podpis zawodnika przepisany w chwili powstania — kartoteka może się zmienić, a propozycja
  -- ma zostać czytelna.
  zawodnik             text,
  rodzaj               text not null default 'kandydat',   -- 'kandydat' | 'opinia' | 'szkic_raportu'

  -- Część AI: po zapisaniu niezmienna.
  tresc                text,
  zrodla               jsonb not null default '[]'::jsonb, -- [{ "url": "...", "opis": "..." }]
  pewnosc              text,                               -- 'WYSOKA' | 'ŚREDNIA' | 'NISKA'
  model                text,
  koszt_usd            numeric(10, 4),

  stan                 text not null default 'ai_propozycja'
    check (stan in ('ai_propozycja', 'zweryfikowane_skaut', 'ocena_trenera', 'decyzja_dyrektora', 'odrzucone')),

  -- Etap 2: skaut.
  skaut_uwagi          text,
  skaut_kto            uuid,
  skaut_at             timestamptz,

  -- Etap 3: trener.
  trener_ocena         jsonb,                              -- np. { "dopasowanie": 4, "pozycja": "9", "komentarz": "..." }
  trener_uwagi         text,
  trener_kto           uuid,
  trener_at            timestamptz,

  -- Etap 4: dyrektor.
  dyrektor_decyzja     text
    check (dyrektor_decyzja is null or dyrektor_decyzja in ('transfer', 'testy', 'obserwacja', 'odrzucenie')),
  dyrektor_uzasadnienie text,
  dyrektor_kto         uuid,
  dyrektor_at          timestamptz,

  odrzucil_powod       text,                               -- gdy stan = 'odrzucone'

  utworzone_at         timestamptz not null default now(),
  zaktualizowane_at    timestamptz not null default now()
);

create index if not exists sbs_ai_propozycje_stan_idx   on public.sbs_ai_propozycje (stan, utworzone_at desc);
create index if not exists sbs_ai_propozycje_player_idx on public.sbs_ai_propozycje (player_id);

comment on table public.sbs_ai_propozycje is
  'Propozycje AI przechodzace etapy: skaut, trener, dyrektor. Przejscia pilnuje wyzwalacz.';

-- ---------------------------------------------------------------------------
-- 4. WYZWALACZ PILNUJĄCY KOLEJNOŚCI I UPRAWNIEŃ
-- ---------------------------------------------------------------------------
--
-- Reguły RLS decydują, czy w ogóle można zmieniać wiersz; ten wyzwalacz decyduje, CO i KTO.
-- Klucz serwisowy (auth.uid() jest wtedy puste) przechodzi RLS, ale wyzwalacz i tak go zatrzyma
-- przy próbie ruszenia etapów — serwer wstawia propozycje, nie rozstrzyga ich.

create or replace function public.sbs_propozycje_kontrola()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  r text := public.sbs_rola();
begin
  if old.stan in ('decyzja_dyrektora', 'odrzucone') then
    raise exception 'Ta propozycja jest zamknięta (stan: %), nie można jej zmieniać.', old.stan
      using errcode = '42501';
  end if;

  -- Treść AI jest niezmienna.
  if new.player_id is distinct from old.player_id
     or new.zawodnik is distinct from old.zawodnik
     or new.rodzaj   is distinct from old.rodzaj
     or new.tresc    is distinct from old.tresc
     or new.zrodla   is distinct from old.zrodla
     or new.pewnosc  is distinct from old.pewnosc
     or new.model    is distinct from old.model
     or new.koszt_usd is distinct from old.koszt_usd then
    raise exception 'Treści wygenerowanej przez AI nie wolno zmieniać — utwórz nową propozycję.'
      using errcode = '42501';
  end if;

  -- Autorów i daty ustawia wyłącznie wyzwalacz, przy przejściu etapu.
  new.skaut_kto := old.skaut_kto;       new.skaut_at := old.skaut_at;
  new.trener_kto := old.trener_kto;     new.trener_at := old.trener_at;
  new.dyrektor_kto := old.dyrektor_kto; new.dyrektor_at := old.dyrektor_at;

  -- Pola każdego etapu zmienia tylko jego rola.
  if (new.skaut_uwagi is distinct from old.skaut_uwagi) and r is distinct from 'admin' and r is distinct from 'scout' then
    raise exception 'Uwagi skauta może zmieniać tylko skaut.' using errcode = '42501';
  end if;
  if (new.trener_ocena is distinct from old.trener_ocena or new.trener_uwagi is distinct from old.trener_uwagi)
     and not public.sbs_ma_role(array['trener']) then
    raise exception 'Ocenę dopasowania sportowego wystawia trener.' using errcode = '42501';
  end if;
  if (new.dyrektor_decyzja is distinct from old.dyrektor_decyzja
      or new.dyrektor_uzasadnienie is distinct from old.dyrektor_uzasadnienie)
     and not public.sbs_ma_role(array['dyrektor']) then
    raise exception 'Decyzję biznesową podejmuje dyrektor sportowy.' using errcode = '42501';
  end if;

  -- Przejścia między etapami.
  if new.stan is distinct from old.stan then
    if new.stan = 'odrzucone' then
      if not public.sbs_ma_role(array['scout', 'trener', 'dyrektor']) then
        raise exception 'Brak uprawnień do odrzucenia propozycji.' using errcode = '42501';
      end if;
      if coalesce(btrim(new.odrzucil_powod), '') = '' then
        raise exception 'Odrzucenie wymaga podania powodu.' using errcode = '23514';
      end if;
    elsif old.stan = 'ai_propozycja' and new.stan = 'zweryfikowane_skaut' then
      if not public.sbs_ma_role(array['scout']) then
        raise exception 'Weryfikację faktów wykonuje skaut.' using errcode = '42501';
      end if;
      new.skaut_kto := auth.uid(); new.skaut_at := now();
    elsif old.stan = 'zweryfikowane_skaut' and new.stan = 'ocena_trenera' then
      if not public.sbs_ma_role(array['trener']) then
        raise exception 'Dopasowanie sportowe ocenia trener.' using errcode = '42501';
      end if;
      if new.trener_ocena is null then
        raise exception 'Brak oceny trenera — uzupełnij ją przed przejściem dalej.' using errcode = '23514';
      end if;
      new.trener_kto := auth.uid(); new.trener_at := now();
    elsif old.stan = 'ocena_trenera' and new.stan = 'decyzja_dyrektora' then
      if not public.sbs_ma_role(array['dyrektor']) then
        raise exception 'Decyzję biznesową podejmuje dyrektor sportowy.' using errcode = '42501';
      end if;
      if new.dyrektor_decyzja is null then
        raise exception 'Brak decyzji dyrektora.' using errcode = '23514';
      end if;
      new.dyrektor_kto := auth.uid(); new.dyrektor_at := now();
    else
      raise exception 'Niedozwolone przejście: % -> %. Etapy idą po kolei: AI, skaut, trener, dyrektor.',
        old.stan, new.stan using errcode = '23514';
    end if;
  end if;

  new.zaktualizowane_at := now();
  return new;
end;
$$;

drop trigger if exists sbs_propozycje_kontrola_trg on public.sbs_ai_propozycje;
create trigger sbs_propozycje_kontrola_trg
  before update on public.sbs_ai_propozycje
  for each row execute function public.sbs_propozycje_kontrola();

drop trigger if exists sbs_propozycje_audit_trg on public.sbs_ai_propozycje;
create trigger sbs_propozycje_audit_trg
  after insert or update or delete on public.sbs_ai_propozycje
  for each row execute function public.sbs_audit_wyzwalacz();

-- ---------------------------------------------------------------------------
-- 5. REGUŁY DOSTĘPU
-- ---------------------------------------------------------------------------

alter table public.sbs_ai_propozycje enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'sbs_ai_propozycje' loop
    execute format('drop policy if exists %I on public.sbs_ai_propozycje', p.policyname);
  end loop;
end $$;

-- Widzi zatwierdzone konto, które nie jest klientem (klient kupuje wybrane ligi, nie wewnętrzny obieg).
create policy "propozycje: odczyt dla zespolu"
  on public.sbs_ai_propozycje for select to authenticated
  using ((select public.sbs_zatwierdzony()) and coalesce((select public.sbs_rola()), '') <> 'klient');

-- Nowa propozycja zawsze startuje od etapu AI i bez wpisów kolejnych etapów.
create policy "propozycje: dopisywanie na starcie obiegu"
  on public.sbs_ai_propozycje for insert to authenticated
  with check (
    (select public.sbs_zatwierdzony()) and coalesce((select public.sbs_rola()), '') <> 'klient'
    and stan = 'ai_propozycja'
    and skaut_kto is null and trener_ocena is null and dyrektor_decyzja is null
  );

-- Co wolno zmienić i kto — rozstrzyga wyzwalacz z sekcji 4; tu tylko brama wejściowa.
create policy "propozycje: poprawianie przez zespol"
  on public.sbs_ai_propozycje for update to authenticated
  using ((select public.sbs_zatwierdzony()) and coalesce((select public.sbs_rola()), '') <> 'klient')
  with check ((select public.sbs_zatwierdzony()) and coalesce((select public.sbs_rola()), '') <> 'klient');

create policy "propozycje: usuwanie tylko administrator"
  on public.sbs_ai_propozycje for delete to authenticated
  using ((select public.sbs_admin()));

revoke all on public.sbs_ai_propozycje from anon;
grant select, insert, update, delete on public.sbs_ai_propozycje to authenticated;

-- ---------------------------------------------------------------------------
-- SPRAWDZENIE
-- ---------------------------------------------------------------------------
select tablename, cmd, policyname
from pg_policies
where schemaname = 'public' and tablename in ('sbs_ai_propozycje', 'sbs_audit')
order by tablename, cmd;
