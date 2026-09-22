-- KONTO KLIENTA I PAKIETY LIGOWE
--
-- PO CO TO JEST
-- Do tej pory system znał dwie role: administratora i skauta. Obie widziały CAŁĄ bazę. To jest
-- profil pracowni — Twój i Twoich skautów. Klient jest kimś innym: płaci za konkretne rozgrywki
-- i ma widzieć wyłącznie je. Ma też pracować, a nie tylko oglądać: prowadzi własne obserwacje,
-- pisze raporty, ocenia zawodników. Ale kartoteki nie rusza — nie dopisuje i nie kasuje
-- zawodników, nie odświeża statystyk, nie wchodzi w ustawienia. Dane aktualizujesz Ty, jedne
-- dla wszystkich.
--
-- CO USTALA TEN SKRYPT
--   1. TRZECIA ROLA „klient" obok „admin" i „scout".
--   2. PAKIETY — kolumna `pakiety` na koncie. Jeden pakiet to jedna liga. Konto z dwoma pakietami
--      widzi dwie ligi; konto z pakietem 'Premium' widzi wszystkie. Sumowanie wychodzi samo:
--      to zwykła lista, a reguła pyta, czy liga danego wiersza na niej stoi.
--   3. WŁAŚCICIEL WPISU — kolumna `konto` przy obserwacjach, raportach i talentach. Bez niej reguła
--      „tylko swoje" nie ma czego pilnować: kolumna `scout` trzyma IMIĘ I NAZWISKO wybrane z listy,
--      a nie konto, więc klient mógłby podpisać się kimkolwiek i poprawiać cudze wpisy.
--   4. REGUŁY DOSTĘPU dla klienta — czytanie tylko w swoich ligach, pisanie tylko tam, gdzie ma
--      pracować, kasowanie nigdzie.
--
-- CZEGO TEN SKRYPT NIE ZMIENIA
--   Niczego dla Ciebie i dla skautów. Konta „admin" i „scout" działają dokładnie tak jak dotąd —
--      każdy warunek niżej zaczyna się od „jeśli to nie jest klient, przepuść".
--
-- KOLEJNOŚĆ WDROŻENIA
--   1. Najpierw uruchom migration_2026-09-12_role_i_kasowanie.sql, jeśli jeszcze go nie było.
--   2. Uruchom całość: Supabase → SQL Editor → New query → Run. Skrypt jest bezpieczny do powtórzenia.
--   3. Sprawdź na końcu sekcję SPRAWDZENIE.
--
-- COFNIĘCIE
--   Ustaw koncie rolę z powrotem na 'scout' (sekcja 7 pokazuje jak) — klient od razu przestaje być
--   klientem i widzi tyle, co skaut. Kolumny i funkcje mogą zostać, nikomu nie przeszkadzają.

-- ---------------------------------------------------------------------------
-- 1. KOLUMNY: PAKIETY NA KONCIE, WŁAŚCICIEL PRZY WPISIE
-- ---------------------------------------------------------------------------

alter table public.sbs_konta
  add column if not exists pakiety text[] not null default '{}';

comment on column public.sbs_konta.pakiety is
  'Lista wykupionych rozgrywek, np. {"Ekstraklasa","I liga"}. Wpis ''Premium'' oznacza wszystkie ligi. Dotyczy wyłącznie roli ''klient''.';

-- Właściciel wpisu. Domyślnie konto, które go tworzy — dzięki temu stare zapisy w aplikacji
-- nie wymagają żadnej zmiany, a kolumna wypełnia się sama.
alter table public.sbs_observations add column if not exists konto uuid default auth.uid();
alter table public.sbs_reports      add column if not exists konto uuid default auth.uid();
alter table public.sbs_talents      add column if not exists konto uuid default auth.uid();

create index if not exists sbs_observations_konto_idx on public.sbs_observations(konto);
create index if not exists sbs_reports_konto_idx      on public.sbs_reports(konto);
create index if not exists sbs_talents_konto_idx      on public.sbs_talents(konto);

-- ---------------------------------------------------------------------------
-- 2. POZIOM ROZGRYWEK — TA SAMA REGUŁA CO W APLIKACJI
-- ---------------------------------------------------------------------------
--
-- Klub ma w kartotece pełną nazwę grupy („IV liga (dolnośląska)", „III liga, gr. III",
-- „CLJ U15 gr. B"), a pakiet sprzedaje się na POZIOM („IV liga"). Ta funkcja sprowadza jedno
-- do drugiego dokładnie tak samo jak topLevelOf() w src/main.ts. Gdy zmienisz tam — zmień i tu,
-- inaczej klient zapłaci za ligę, której nie zobaczy.

create or replace function public.sbs_poziom_ligi(liga text)
returns text
language sql
immutable
as $$
  select case
    when liga is null or liga = ''      then 'Nieprzypisane'
    when liga like 'III liga%'          then 'III liga'
    when liga like 'IV liga%'           then 'IV liga'
    when liga = 'II liga'               then 'II liga'
    when liga = 'I liga'                then 'I liga'
    when liga = 'Ekstraklasa'           then 'Ekstraklasa'
    when liga = 'Klasa okręgowa'        then 'Klasa okręgowa'
    else 'Kategorie juniorskie'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. FUNKCJE POMOCNICZE: KTO TO JEST I CO KUPIŁ
-- ---------------------------------------------------------------------------
--
-- security definer z tego samego powodu co w migracji z 11.08: reguła dostępu do danych musi
-- zapytać o sbs_konta, a sbs_konta ma własne reguły. Funkcja odpowiada wyłącznie na pytanie
-- o BIEŻĄCEGO użytkownika — cudzych danych nie da się nią odczytać.

create or replace function public.sbs_klient()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sbs_konta k
    where k.user_id = auth.uid() and k.status = 'zatwierdzone' and k.rola = 'klient'
  );
$$;

create or replace function public.sbs_pakiety()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select k.pakiety from public.sbs_konta k
      where k.user_id = auth.uid() and k.status = 'zatwierdzone'),
    '{}'::text[]);
$$;

-- CZY TEN WIERSZ WOLNO KLIENTOWI ZOBACZYĆ.
--
-- Kto nie jest klientem, przechodzi bez pytania — to załatwia pierwszy warunek i dzięki niemu
-- Twoje konto oraz konta skautów działają jak przedtem. Klientowi sprawdzamy poziom rozgrywek.
create or replace function public.sbs_ma_lige(liga text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.sbs_klient()
    or 'Premium' = any(public.sbs_pakiety())
    or public.sbs_poziom_ligi(liga) = any(public.sbs_pakiety());
$$;

-- Czy zawodnik należy do klubu z wykupionej ligi. Zawodnik bez klubu jest dla klienta niewidoczny:
-- nie da się rozstrzygnąć, za którą ligę miałby być zapłacony, a zgadywanie na korzyść klienta
-- oznaczałoby wyciek całej reszty bazy.
create or replace function public.sbs_ma_zawodnika(klub_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.sbs_klient()
    or exists (
      select 1 from public.sbs_clubs c
      where c.id = klub_id and public.sbs_ma_lige(c.league)
    );
$$;

grant execute on function public.sbs_klient()            to authenticated, anon;
grant execute on function public.sbs_pakiety()           to authenticated, anon;
grant execute on function public.sbs_poziom_ligi(text)   to authenticated, anon;
grant execute on function public.sbs_ma_lige(text)       to authenticated, anon;
grant execute on function public.sbs_ma_zawodnika(text)  to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. KLUBY I ZAWODNICY — KLIENT TYLKO PATRZY, I TYLKO NA SWOJE LIGI
-- ---------------------------------------------------------------------------

alter table public.sbs_clubs enable row level security;
alter table public.sbs_players enable row level security;

do $$
declare p record; t text;
begin
  foreach t in array array['sbs_clubs','sbs_players'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

create policy "kluby: odczyt w wykupionych ligach"
  on public.sbs_clubs for select to authenticated
  using (public.sbs_zatwierdzony() and public.sbs_ma_lige(league));

-- Dopisywanie i poprawianie klubów: pracownia, nie klient.
create policy "kluby: dopisywanie bez klienta"
  on public.sbs_clubs for insert to authenticated
  with check (public.sbs_zatwierdzony() and not public.sbs_klient());

create policy "kluby: poprawianie bez klienta"
  on public.sbs_clubs for update to authenticated
  using (public.sbs_zatwierdzony() and not public.sbs_klient())
  with check (public.sbs_zatwierdzony() and not public.sbs_klient());

create policy "kluby: usuwanie tylko administrator"
  on public.sbs_clubs for delete to authenticated
  using (public.sbs_admin());

create policy "zawodnicy: odczyt w wykupionych ligach"
  on public.sbs_players for select to authenticated
  using (public.sbs_zatwierdzony() and public.sbs_ma_zawodnika(club_id));

-- TU JEST NAJWAŻNIEJSZE ZDANIE CAŁEJ MIGRACJI.
-- Klient nie dopisuje zawodników do kartoteki i nie zmienia w niej niczego. Jedyne miejsce, gdzie
-- wolno mu coś dołożyć, to Talent (sekcja 6) — tam pisze do własnej tabeli, nie do kartoteki.
create policy "zawodnicy: dopisywanie bez klienta"
  on public.sbs_players for insert to authenticated
  with check (public.sbs_zatwierdzony() and not public.sbs_klient());

create policy "zawodnicy: poprawianie bez klienta"
  on public.sbs_players for update to authenticated
  using (public.sbs_zatwierdzony() and not public.sbs_klient())
  with check (public.sbs_zatwierdzony() and not public.sbs_klient());

create policy "zawodnicy: usuwanie tylko administrator"
  on public.sbs_players for delete to authenticated
  using (public.sbs_admin());

-- ---------------------------------------------------------------------------
-- 5. OBSERWACJE I RAPORTY — TU KLIENT PRACUJE
-- ---------------------------------------------------------------------------
--
-- Czyta wszystko, co dotyczy jego lig (także obserwacje Twoich skautów — za to płaci).
-- Dopisuje i poprawia WYŁĄCZNIE swoje: warunek pilnuje, żeby w kolumnie `konto` stało jego konto.
-- Nie kasuje nic — również własnych wpisów. Pomyłkę zgłasza Tobie; to świadoma decyzja, bo
-- skasowana obserwacja nie zostawia po sobie śladu.

do $$
declare p record; t text;
begin
  foreach t in array array['sbs_observations','sbs_reports'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format(
      'create policy "odczyt dla zatwierdzonych" on public.%I
         for select to authenticated using (public.sbs_zatwierdzony())', t);
    execute format(
      'create policy "dopisywanie: klient tylko swoje" on public.%I
         for insert to authenticated with check (
           public.sbs_zatwierdzony() and (not public.sbs_klient() or konto = auth.uid()))', t);
    execute format(
      'create policy "poprawianie: klient tylko swoje" on public.%I
         for update to authenticated
         using (public.sbs_zatwierdzony() and (not public.sbs_klient() or konto = auth.uid()))
         with check (public.sbs_zatwierdzony() and (not public.sbs_klient() or konto = auth.uid()))', t);
    execute format(
      'create policy "usuwanie tylko administrator" on public.%I
         for delete to authenticated using (public.sbs_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. TALENT — JEDYNE MIEJSCE, GDZIE KLIENT DOPISUJE
-- ---------------------------------------------------------------------------

alter table public.sbs_talents enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='sbs_talents' loop
    execute format('drop policy if exists %I on public.sbs_talents', p.policyname);
  end loop;
end $$;

create policy "talent: odczyt dla zatwierdzonych"
  on public.sbs_talents for select to authenticated
  using (public.sbs_zatwierdzony());

create policy "talent: dopisywanie, klient tylko swoje"
  on public.sbs_talents for insert to authenticated
  with check (public.sbs_zatwierdzony() and (not public.sbs_klient() or konto = auth.uid()));

create policy "talent: poprawianie, klient tylko swoje"
  on public.sbs_talents for update to authenticated
  using (public.sbs_zatwierdzony() and (not public.sbs_klient() or konto = auth.uid()))
  with check (public.sbs_zatwierdzony() and (not public.sbs_klient() or konto = auth.uid()));

create policy "talent: usuwanie tylko administrator"
  on public.sbs_talents for delete to authenticated
  using (public.sbs_admin());

-- ---------------------------------------------------------------------------
-- 7. USTAWIENIA, STATYSTYKI, TERMINARZ — U KLIENTA TYLKO PODGLĄD
-- ---------------------------------------------------------------------------
--
-- sbs_kv trzyma ustawienia, pobrane tabele lig, zapamiętane adresy grup ŁNP i znaczniki. To
-- wszystko aktualizujesz Ty, raz dla wszystkich. Klient ma to czytać i nic więcej — dlatego
-- w jego panelu nie ma ani jednego przycisku odświeżania statystyk. Gdyby jakiś się przedostał,
-- baza i tak odmówi zapisu.

alter table public.sbs_kv enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='sbs_kv' loop
    execute format('drop policy if exists %I on public.sbs_kv', p.policyname);
  end loop;
end $$;

create policy "kv: odczyt dla zatwierdzonych"
  on public.sbs_kv for select to authenticated
  using (public.sbs_zatwierdzony());

create policy "kv: dopisywanie poza kluczami zastrzezonymi, bez klienta"
  on public.sbs_kv for insert to authenticated
  with check (
    public.sbs_zatwierdzony()
    and not public.sbs_klient()
    and (not public.sbs_klucz_zastrzezony(key) or public.sbs_admin())
  );

create policy "kv: poprawianie poza kluczami zastrzezonymi, bez klienta"
  on public.sbs_kv for update to authenticated
  using (
    public.sbs_zatwierdzony()
    and not public.sbs_klient()
    and (not public.sbs_klucz_zastrzezony(key) or public.sbs_admin())
  )
  with check (
    public.sbs_zatwierdzony()
    and not public.sbs_klient()
    and (not public.sbs_klucz_zastrzezony(key) or public.sbs_admin())
  );

create policy "kv: usuwanie tylko administrator"
  on public.sbs_kv for delete to authenticated
  using (public.sbs_admin());

-- Pozostałe tabele sbs_* (kontakty, terminarz, herby) — jak dotąd dla pracowni,
-- a klientowi zostaje sam odczyt.
do $$
declare t text; p record;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public'
      and table_name like 'sbs\_%'
      and table_name not in ('sbs_konta','sbs_kv','sbs_clubs','sbs_players',
                             'sbs_observations','sbs_reports','sbs_talents')
  loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    execute format(
      'create policy "odczyt dla zatwierdzonych" on public.%I
         for select to authenticated using (public.sbs_zatwierdzony())', t);
    execute format(
      'create policy "dopisywanie bez klienta" on public.%I
         for insert to authenticated with check (public.sbs_zatwierdzony() and not public.sbs_klient())', t);
    execute format(
      'create policy "poprawianie bez klienta" on public.%I
         for update to authenticated
         using (public.sbs_zatwierdzony() and not public.sbs_klient())
         with check (public.sbs_zatwierdzony() and not public.sbs_klient())', t);
    execute format(
      'create policy "usuwanie tylko administrator" on public.%I
         for delete to authenticated using (public.sbs_admin())', t);
    raise notice 'Reguly ustawione dla tabeli: %', t;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 8. JAK ZAŁOŻYĆ PIERWSZEGO KLIENTA RĘCZNIE
-- ---------------------------------------------------------------------------
--
-- Normalnie robi się to w aplikacji, w zakładce „Dostęp". Poniżej wzór na wypadek, gdybyś
-- potrzebował zrobić to wprost w bazie. Zmień adres i listę lig, a potem odkomentuj.
--
-- update public.sbs_konta
--    set rola = 'klient',
--        status = 'zatwierdzone',
--        pakiety = array['Ekstraklasa','I liga'],   -- albo array['Premium'] na wszystkie
--        zdecydowane_at = now()
--  where email = 'klient@example.com';

-- ---------------------------------------------------------------------------
-- SPRAWDZENIE
-- ---------------------------------------------------------------------------
-- 1. Kto jest kim i co ma wykupione:
select email, rola, status, pakiety from public.sbs_konta order by rola, email;

-- 2. Każda tabela z danymi ma mieć cztery reguły, a przy „delete" ma stać sbs_admin():
select tablename, cmd, policyname
from pg_policies
where schemaname = 'public' and tablename like 'sbs\_%'
order by tablename, cmd, policyname;

-- 3. Poziomy rozgrywek wyliczone z kartoteki klubów — to są nazwy, które wolno wpisać do pakietów:
select distinct public.sbs_poziom_ligi(league) as pakiet, count(*) as klubow
from public.sbs_clubs group by 1 order by 1;
