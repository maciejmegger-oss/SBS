-- DZIENNIK ZDARZEŃ NA KONTACH
--
-- PO CO TO JEST
-- Do tej pory nie zostawało ŻADNEGO śladu po tym, co się działo z kontami. Ktoś zmienił hasło —
-- nie wiadomo kiedy ani czy to był on. Ktoś dostał albo stracił dostęp — nie wiadomo kto to zrobił.
-- Komuś doszedł pakiet — nie wiadomo, kiedy i jaki był poprzedni. Przy jednym administratorze
-- i dwóch kontach dało się to trzymać w głowie. Przy płacących klientach nie da się i nie wolno:
-- gdy klient mówi „ktoś mi zmienił dostęp", trzeba umieć odpowiedzieć, a nie zgadywać.
--
-- CO TU TRAFIA
--   * zmiana hasła (zapisuje sam użytkownik, w chwili gdy ją kończy),
--   * przyznanie i cofnięcie dostępu,
--   * zmiana roli (skaut / klient / administrator),
--   * zmiana pakietów ligowych.
--
-- CZEGO TU NIE MA I DLACZEGO
--   * PROŚBY o link do zmiany hasła. Wysyła się ją PRZED zalogowaniem, więc zapis musiałby być
--     otwarty dla każdego z ulicy — a to gotowy sposób na zaśmiecenie dziennika tysiącem wierszy.
--     Te próby i tak rejestruje sam Supabase: Dashboard → Logs → Auth Logs.
--   * HASEŁ, ani starych, ani nowych, ani ich fragmentów. Dziennik odnotowuje, ŻE hasło zmieniono.
--     Czego nie zapisujemy, tego nie da się z systemu wykraść.

-- ---------------------------------------------------------------------------
-- 1. TABELA
-- ---------------------------------------------------------------------------

create table if not exists public.sbs_zdarzenia_konta (
  id          bigint generated always as identity primary key,
  -- Kogo zdarzenie DOTYCZY. Przy zmianie hasła to ta sama osoba, która je wykonała;
  -- przy nadaniu pakietu — klient, a nie administrator.
  konto       uuid references auth.users(id) on delete cascade,
  email       text,                      -- przepisany na sztywno: konto można skasować, ślad ma zostać
  -- Kto zdarzenie WYKONAŁ. Przy zmianie hasła równy `konto`, przy decyzjach administratora — on.
  kto         uuid default auth.uid(),
  kto_email   text,
  rodzaj      text not null,             -- 'haslo' | 'dostep' | 'rola' | 'pakiety'
  opis        text,                      -- zdanie po polsku, gotowe do pokazania w panelu
  utworzone_at timestamptz not null default now()
);

create index if not exists sbs_zdarzenia_konta_czas_idx on public.sbs_zdarzenia_konta(utworzone_at desc);
create index if not exists sbs_zdarzenia_konta_konto_idx on public.sbs_zdarzenia_konta(konto);

comment on table public.sbs_zdarzenia_konta is
  'Slad po zmianach na kontach: hasla, dostep, role, pakiety. Nie zawiera hasel.';

-- ---------------------------------------------------------------------------
-- 2. REGUŁY DOSTĘPU
-- ---------------------------------------------------------------------------
--
-- CZYTA WYŁĄCZNIE ADMINISTRATOR. To dziennik nadzorczy — klient nie ma wiedzieć, kiedy inni
-- klienci zmieniali hasła ani jakie mają pakiety.
--
-- DOPISUJE każde zalogowane konto, ale TYLKO POD SWOIM PODPISEM (`kto = auth.uid()`). Dzięki temu
-- zmianę hasła zapisuje sam zainteresowany, a nikt nie podszyje się pod cudzy wpis.
--
-- NIE POPRAWIA I NIE KASUJE NIKT — nawet administrator. Dziennik, który da się wyczyścić, nie jest
-- dziennikiem. Brak reguł na update i delete oznacza, że te operacje są zamknięte dla wszystkich;
-- gdyby kiedyś trzeba było posprzątać stare wpisy, robi się to z konsoli bazy, świadomie.

alter table public.sbs_zdarzenia_konta enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'sbs_zdarzenia_konta' loop
    execute format('drop policy if exists %I on public.sbs_zdarzenia_konta', p.policyname);
  end loop;
end $$;

create policy "dziennik: czyta administrator"
  on public.sbs_zdarzenia_konta for select to authenticated
  using (public.sbs_admin());

create policy "dziennik: dopisuje kazdy, ale tylko pod swoim podpisem"
  on public.sbs_zdarzenia_konta for insert to authenticated
  with check (public.sbs_zatwierdzony() and kto = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. ZMIANA HASŁA ZAPISUJE SIĘ SAMA
-- ---------------------------------------------------------------------------
--
-- Wpis mógłby dokładać przeglądarka po udanej zmianie — ale wtedy wystarczy zamknąć kartę w złym
-- momencie i zdarzenia nie ma. Wyzwalacz siedzi przy tabeli haseł: jeśli hasło naprawdę się
-- zmieniło, ślad powstaje razem z nim i nie ma jak go pominąć.
--
-- Warunek porównuje ZASZYFROWANE hasła, nie jawne — funkcja nigdy ich nie widzi.

create or replace function public.sbs_zapisz_zmiane_hasla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    insert into public.sbs_zdarzenia_konta (konto, email, kto, kto_email, rodzaj, opis)
    values (new.id, new.email, new.id, new.email, 'haslo', 'Zmiana hasła do konta.');
  end if;
  return new;
end $$;

drop trigger if exists sbs_trigger_zmiana_hasla on auth.users;
create trigger sbs_trigger_zmiana_hasla
  after update on auth.users
  for each row
  execute function public.sbs_zapisz_zmiane_hasla();

-- ---------------------------------------------------------------------------
-- SPRAWDZENIE
-- ---------------------------------------------------------------------------
-- 1. Tabela i jej reguły — mają być dokładnie dwie: odczyt dla administratora, zapis pod podpisem.
select cmd, policyname from pg_policies
where schemaname = 'public' and tablename = 'sbs_zdarzenia_konta'
order by cmd;

-- 2. Wyzwalacz przy tabeli haseł.
select tgname from pg_trigger where tgname = 'sbs_trigger_zmiana_hasla';

-- 3. Co już jest w dzienniku (po świeżym wdrożeniu będzie pusty — to poprawny wynik).
select utworzone_at, rodzaj, email, opis
from public.sbs_zdarzenia_konta
order by utworzone_at desc
limit 20;
