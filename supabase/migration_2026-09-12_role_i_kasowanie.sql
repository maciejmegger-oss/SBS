-- ROLE: KTO MOŻE KASOWAĆ I KTO RUSZA KARTOTEKĘ MENEDŻERÓW
--
-- PO CO TO JEST
-- Po wdrożeniu migracji z 11.08.2026 każde ZATWIERDZONE konto dostawało pełny dostęp do
-- wszystkich tabel: czytaj, dopisuj, zmieniaj, usuwaj. Rola „admin" rozstrzygała wyłącznie o tym,
-- kto zatwierdza nowe zgłoszenia i komu pokazać zakładkę „Dostęp" — na same dane nie miała
-- żadnego wpływu. W praktyce znaczyło to, że dowolny skaut mógł usunąć klub, cały rocznik
-- zawodników albo czyjś raport, i nikt by się nie dowiedział, kto to zrobił.
--
-- CO USTALA TEN SKRYPT
--   1. USUWANIE czegokolwiek — wyłącznie administrator. Dopisywanie i poprawianie zostaje
--      otwarte dla każdego zatwierdzonego konta, bo na tym polega praca skauta.
--   2. KARTOTEKA MENEDŻERÓW I AGENCJI — skaut ją widzi, ale nie zmienia. To dane kontaktowe
--      i finansowe; do pracy wystarczy wiedzieć, kto kogo prowadzi.
--
-- CZEGO TEN SKRYPT NIE RUSZA (świadomie)
--   * Ustawień (ligi, lista skautów, logotypy, zapamiętane adresy grup ŁNP). Zapisuje je także
--     zwykłe zbieranie protokołów — zamknięcie ich teraz zepsułoby skautom wgrywanie statystyk.
--     Osobny klucz na adresy grup i zamknięcie reszty to następny krok.
--   * Rozdziału „swoje kontra cudze" przy obserwacjach i raportach. Kolumna `scout` trzyma dziś
--     IMIĘ I NAZWISKO wybrane z listy, a nie konto — dopóki autor nie bierze się z zalogowanego
--     użytkownika, reguła „tylko swoje" nie ma czego pilnować.
--
-- KOLEJNOŚĆ WDROŻENIA
--   1. Upewnij się, że Twoje konto ma rolę „admin":
--        select email, rola, status from sbs_konta order by utworzone_at;
--      Jeśli nie ma — uruchom najpierw sekcję 5 z migration_2026-08-11_konta_i_zgoda.sql.
--   2. Uruchom całość: Supabase → SQL Editor → New query → Run. Skrypt jest bezpieczny do powtórzenia.
--   3. Zaloguj się w aplikacji i sprawdź, że nadal usuwasz zawodnika. Potem poproś kogoś ze
--      zwykłym kontem, żeby spróbował — powinien zobaczyć komunikat, że to tylko dla administratora.
--
-- COFNIĘCIE
--   Gdyby coś poszło nie tak, przywróć poprzedni stan, uruchamiając ponownie sekcję 7
--   z migration_2026-08-11_konta_i_zgoda.sql — wróci wtedy jedna reguła „dla zatwierdzonych".

-- ---------------------------------------------------------------------------
-- 1. KLUCZE W sbs_kv, KTÓRYCH SKAUT NIE ZAPISUJE
-- ---------------------------------------------------------------------------
--
-- Agencje, menedżerowie i ich logotypy leżą w sbs_kv jako po jednym rekordzie JSON na kolekcję
-- (patrz src/data/storage.ts). Reguła musi więc patrzeć na KLUCZ wiersza, a nie na tabelę.

create or replace function public.sbs_klucz_zastrzezony(k text)
returns boolean
language sql
immutable
as $$
  select k in ('scouting:agencies', 'scouting:agents', 'scouting:agency_logos');
$$;

grant execute on function public.sbs_klucz_zastrzezony(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. REGUŁY DLA TABEL Z DANYMI
-- ---------------------------------------------------------------------------
--
-- Jedna reguła „for all" nie wystarczy: trzeba rozdzielić odczyt i dopisywanie (dla każdego
-- zatwierdzonego) od usuwania (tylko administrator). Pętla obejmuje też tabele dołożone później.
-- sbs_kv wyłączamy z pętli, bo ma własne reguły w sekcji 3.

do $$
declare
  t text;
  p record;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public'
      and table_name like 'sbs\_%'
      and table_name not in ('sbs_konta', 'sbs_kv')
  loop
    execute format('alter table public.%I enable row level security', t);

    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format(
      'create policy "Odczyt dla zatwierdzonych" on public.%I
         for select to authenticated using (public.sbs_zatwierdzony())', t);
    execute format(
      'create policy "Dopisywanie dla zatwierdzonych" on public.%I
         for insert to authenticated with check (public.sbs_zatwierdzony())', t);
    execute format(
      'create policy "Poprawianie dla zatwierdzonych" on public.%I
         for update to authenticated
         using (public.sbs_zatwierdzony()) with check (public.sbs_zatwierdzony())', t);
    execute format(
      'create policy "Usuwanie tylko administrator" on public.%I
         for delete to authenticated using (public.sbs_admin())', t);

    raise notice 'Role ustawione dla tabeli: %', t;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. REGUŁY DLA sbs_kv (ustawienia, agencje, menedżerowie, terminarz, znaczniki)
-- ---------------------------------------------------------------------------

alter table public.sbs_kv enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'sbs_kv' loop
    execute format('drop policy if exists %I on public.sbs_kv', p.policyname);
  end loop;
end $$;

-- Czytać może każdy zatwierdzony — także agencje i menedżerów. Skaut ma wiedzieć, kto kogo prowadzi.
create policy "kv: odczyt dla zatwierdzonych"
  on public.sbs_kv for select to authenticated
  using (public.sbs_zatwierdzony());

-- Zapis: wszystko poza kluczami zastrzeżonymi. Te ostatnie — tylko administrator.
create policy "kv: dopisywanie poza kluczami zastrzezonymi"
  on public.sbs_kv for insert to authenticated
  with check (
    public.sbs_zatwierdzony()
    and (not public.sbs_klucz_zastrzezony(key) or public.sbs_admin())
  );

create policy "kv: poprawianie poza kluczami zastrzezonymi"
  on public.sbs_kv for update to authenticated
  using (
    public.sbs_zatwierdzony()
    and (not public.sbs_klucz_zastrzezony(key) or public.sbs_admin())
  )
  with check (
    public.sbs_zatwierdzony()
    and (not public.sbs_klucz_zastrzezony(key) or public.sbs_admin())
  );

create policy "kv: usuwanie tylko administrator"
  on public.sbs_kv for delete to authenticated
  using (public.sbs_admin());

-- ---------------------------------------------------------------------------
-- SPRAWDZENIE
-- ---------------------------------------------------------------------------
-- Każda tabela z danymi powinna mieć cztery reguły, a przy „delete" ma stać sbs_admin().
select tablename, cmd, policyname
from pg_policies
where schemaname = 'public' and tablename like 'sbs\_%'
order by tablename, cmd, policyname;
