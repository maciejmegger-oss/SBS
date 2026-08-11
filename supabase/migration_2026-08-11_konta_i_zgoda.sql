-- ZAMKNIĘCIE SYSTEMU NA KLUCZ: konta użytkowników i zgoda administratora.
--
-- PO CO TO JEST
-- Dotąd o wejściu do danych decydował ekran logowania w przeglądarce, a przez chwilę nawet on nie
-- decydował o niczym (WYMAGAJ_LOGOWANIA było ustawione na false). Klucz „anon" jest wpisany w kod
-- każdej strony i każdy może go stamtąd odczytać — kto zna adres bazy, ten pomija aplikację i pyta
-- bazę wprost. Jedynym miejscem, w którym da się to naprawdę zamknąć, są reguły dostępu (RLS).
--
-- CO USTALA TEN SKRYPT
--   1. Tabela sbs_konta — jeden wiersz na użytkownika: kim jest, z jakiego klubu, jaką ma rolę
--      i czy administrator zgodził się na jego wejście.
--   2. Wyzwalacz — każde nowo założone konto (zgłoszenie ze strony www) trafia tu automatycznie
--      ze stanem „oczekuje". Nikt nie wchodzi do danych samym faktem rejestracji.
--   3. Reguły dostępu do WSZYSTKICH tabel sbs_* — czytać i zapisywać może wyłącznie konto
--      zalogowane ORAZ zatwierdzone. Anonim nie dostaje niczego.
--
-- KOLEJNOŚĆ WDROŻENIA (ważna!)
--   1. Podmień niżej adres administratora (sekcja ADMINISTRATOR SYSTEMU) na swój.
--   2. Uruchom całość: Supabase → SQL Editor → New query → Run. Skrypt jest bezpieczny do powtórzenia.
--   3. Sprawdź, że logujesz się w aplikacji i widzisz dane. Konta istniejące przed uruchomieniem
--      skryptu zostają zatwierdzone (patrz sekcja PRZENIESIENIE ISTNIEJĄCYCH KONT) — nikt nie
--      traci dostępu przy wdrożeniu.
--
-- Ten skrypt zastępuje supabase/rls_only_logged_in.sql. Tamten wpuszczał każdego zalogowanego;
-- ten wymaga dodatkowo zgody administratora.

-- ---------------------------------------------------------------------------
-- 1. TABELA KONT
-- ---------------------------------------------------------------------------

create table if not exists sbs_konta (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  email          text,
  imie_nazwisko  text,
  klub           text,
  rola_w_klubie  text,          -- np. „trener", „skaut", „dyrektor sportowy"
  telefon        text,
  rola           text not null default 'scout',      -- 'scout' albo 'admin'
  status         text not null default 'oczekuje',   -- 'oczekuje' | 'zatwierdzone' | 'odrzucone'
  uwagi          text,
  utworzone_at   timestamptz not null default now(),
  zdecydowane_at timestamptz
);

create index if not exists sbs_konta_status_idx on sbs_konta(status);

-- ---------------------------------------------------------------------------
-- 2. NOWE ZGŁOSZENIE ZAKŁADA WIERSZ ZE STANEM „OCZEKUJE"
-- ---------------------------------------------------------------------------
--
-- Formularz na stronie www woła Supabase Auth (signUp) i przekazuje dane zgłaszającego w
-- metadanych konta. Wyzwalacz przepisuje je tutaj. Robimy to w bazie, a nie w przeglądarce,
-- bo zgłaszający NIE MA jeszcze prawa zapisu do żadnej tabeli — i mieć go nie powinien.

create or replace function public.sbs_nowe_konto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sbs_konta (user_id, email, imie_nazwisko, klub, rola_w_klubie, telefon)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'imie_nazwisko', ''),
    nullif(new.raw_user_meta_data->>'klub', ''),
    nullif(new.raw_user_meta_data->>'rola_w_klubie', ''),
    nullif(new.raw_user_meta_data->>'telefon', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists sbs_trigger_nowe_konto on auth.users;
create trigger sbs_trigger_nowe_konto
  after insert on auth.users
  for each row execute function public.sbs_nowe_konto();

-- ---------------------------------------------------------------------------
-- 3. FUNKCJE POMOCNICZE: „czy zatwierdzony", „czy administrator"
-- ---------------------------------------------------------------------------
--
-- security definer jest tu konieczny: reguła dostępu do sbs_konta nie może pytać o sbs_konta
-- przez tę samą regułę, bo powstałaby pętla. Funkcja czyta tabelę z pominięciem RLS, ale
-- odpowiada wyłącznie na pytanie o BIEŻĄCEGO użytkownika — nie da się nią odczytać cudzych danych.

create or replace function public.sbs_zatwierdzony()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sbs_konta k
    where k.user_id = auth.uid() and k.status = 'zatwierdzone'
  );
$$;

create or replace function public.sbs_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sbs_konta k
    where k.user_id = auth.uid() and k.status = 'zatwierdzone' and k.rola = 'admin'
  );
$$;

grant execute on function public.sbs_zatwierdzony() to authenticated, anon;
grant execute on function public.sbs_admin() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. PRZENIESIENIE ISTNIEJĄCYCH KONT
-- ---------------------------------------------------------------------------
--
-- Konta, które istniały przed wdrożeniem, wchodzą jako zatwierdzone — inaczej wdrożenie odcięłoby
-- od danych także właściciela systemu. Nowe zgłoszenia idą już zwykłą drogą, przez „oczekuje".

insert into sbs_konta (user_id, email, status, rola, zdecydowane_at)
select u.id, u.email, 'zatwierdzone', 'scout', now()
from auth.users u
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. ADMINISTRATOR SYSTEMU  ← TU PODMIEŃ ADRES NA SWÓJ
-- ---------------------------------------------------------------------------
--
-- Administrator widzi w aplikacji zakładkę „Dostęp" i tylko on może zatwierdzać zgłoszenia.
-- Wpisz adres e-mail konta, którym się logujesz. Można wskazać kilka adresów — rozdziel przecinkami.

update sbs_konta
   set rola = 'admin', status = 'zatwierdzone', zdecydowane_at = now()
 where lower(email) in (
   'maciejmegger@gmail.com'
 );

-- ---------------------------------------------------------------------------
-- 6. REGUŁY DOSTĘPU DO KONT
-- ---------------------------------------------------------------------------
--
-- Zwykły użytkownik widzi WYŁĄCZNIE swój wiersz (aplikacja pyta o niego, żeby wiedzieć, czy
-- pokazać system, czy ekran „czekasz na akceptację"). Zmieniać cokolwiek może tylko administrator.
-- Zakładanie wierszy nie jest dostępne dla nikogo z przeglądarki — robi to wyzwalacz z punktu 2.

alter table sbs_konta enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'sbs_konta' loop
    execute format('drop policy if exists %I on public.sbs_konta', p.policyname);
  end loop;
end $$;

create policy "Konto: podglad wlasnego wiersza"
  on sbs_konta for select to authenticated
  using (user_id = auth.uid() or public.sbs_admin());

create policy "Konto: decyzje tylko administrator"
  on sbs_konta for update to authenticated
  using (public.sbs_admin())
  with check (public.sbs_admin());

create policy "Konto: usuwanie tylko administrator"
  on sbs_konta for delete to authenticated
  using (public.sbs_admin());

-- ---------------------------------------------------------------------------
-- 7. REGUŁY DOSTĘPU DO DANYCH SYSTEMU
-- ---------------------------------------------------------------------------
--
-- Wszystkie tabele sbs_* poza sbs_konta: pełny dostęp wyłącznie dla kont zalogowanych
-- I zatwierdzonych. Anonim (klucz ze strony) nie dostaje ani jednego wiersza.
-- Pętla obejmuje też tabele dołożone później — nie trzeba pamiętać o dopisywaniu ich do listy.

do $$
declare
  t text;
  p record;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name like 'sbs\_%' and table_name <> 'sbs_konta'
  loop
    execute format('alter table public.%I enable row level security', t);

    -- Zdejmujemy wszystkie dotychczasowe reguły, żeby nie została otwarta furtka z poprzednich ustawień
    -- (np. „Tymczasowy pełny dostęp" albo reguła dla samego 'authenticated' z rls_only_logged_in.sql).
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format(
      'create policy "Dostep dla zatwierdzonych" on public.%I
         for all to authenticated
         using (public.sbs_zatwierdzony())
         with check (public.sbs_zatwierdzony())', t);

    raise notice 'Zabezpieczono tabelę: %', t;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- SPRAWDZENIE
-- ---------------------------------------------------------------------------
-- Powinno pokazać jedną regułę na tabelę, dla roli {authenticated}, oraz trzy reguły na sbs_konta.
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename like 'sbs\_%'
order by tablename, policyname;

-- A tu widać, kto czeka na decyzję:
-- select email, imie_nazwisko, klub, status, utworzone_at from sbs_konta order by utworzone_at desc;
