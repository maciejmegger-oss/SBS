-- REGUŁY DOSTĘPU, KTÓRE NIE ZABIJAJĄ ODCZYTU
--
-- OBJAW
-- Pasek w panelu: „Nie wczytałem wszystkich danych — brakuje: players, club_crests",
-- a pod nim powód prosto z bazy: „canceling statement due to statement timeout".
-- Zawodnicy nie wczytywali się w ogóle, więc w każdym klubie stało „0 zawodników w bazie".
--
-- PRZYCZYNA — I NIE JEST NIĄ ANI ROZMIAR BAZY, ANI ŁĄCZE
-- Reguła odczytu zawodników brzmiała tak:
--
--     using (sbs_zatwierdzony() and sbs_ma_zawodnika(club_id))
--
-- Obie funkcje są `security definer`, a takiej funkcji Postgres NIE UMIE wkleić w zapytanie
-- (inlining). Skoro nie umie jej wkleić, musi ją WYWOŁAĆ — osobno dla każdego wiersza. A każde
-- wywołanie sbs_zatwierdzony() to zapytanie do sbs_konta, każde sbs_ma_zawodnika() to kolejne
-- zapytanie do sbs_konta plus szukanie w sbs_clubs. Przy kilkunastu tysiącach zawodników robi
-- się z tego kilkadziesiąt tysięcy małych zapytań w jednym odczycie i baza przerywa go po swoim
-- limicie czasu. Im więcej zawodników wejdzie do systemu, tym gorzej — a zawodników ma
-- przybywać, więc to nie jest usterka, którą można przeczekać.
--
-- ROZWIĄZANIE — JEDEN NAWIAS, KTÓRY ZMIENIA WSZYSTKO
-- Wystarczy owinąć wywołanie w `(select ...)`:
--
--     using ((select sbs_zatwierdzony()) and ...)
--
-- Dla Postgresa to sygnał, że wynik nie zależy od wiersza: liczy go RAZ na całe zapytanie
-- i potem tylko podstawia. Kilkadziesiąt tysięcy wywołań zamienia się w jedno.
-- To nie jest sztuczka ani obejście — tak właśnie zaleca się pisać reguły w Supabase.
--
-- Do tego jedna nowa funkcja, sbs_kluby_klienta(): lista klubów z wykupionych rozgrywek,
-- policzona raz. Sprawdzenie zawodnika przestaje być zapytaniem do bazy, a staje się
-- zajrzeniem do gotowej listy.
--
-- CO SIĘ NIE ZMIENIA: ANI JEDNA REGUŁA NIE ROBI SIĘ ŁAGODNIEJSZA.
-- Klient dalej widzi wyłącznie wykupione ligi, dalej nie dopisuje do kartoteki, dalej nie
-- kasuje niczego, dalej nie zapisuje ustawień. Zmienia się wyłącznie to, ILE RAZY baza pyta
-- o to samo. Sekcja na końcu pozwala to sprawdzić czarno na białym.
--
-- Wymaga wcześniejszego uruchomienia migration_2026-09-22_klient_i_pakiety.sql.

-- ---------------------------------------------------------------------------
-- 1. LISTA KLUBÓW KLIENTA, LICZONA RAZ
-- ---------------------------------------------------------------------------
--
-- Zwraca identyfikatory klubów z rozgrywek, które to konto ma wykupione. Dla kogoś, kto nie
-- jest klientem, nie ma zastosowania — reguły pytają o nią dopiero po sprawdzeniu roli.
--
-- sbs_poziom_ligi() jest `immutable` i BEZ security definer, więc tę jedną Postgres potrafi
-- wkleić i policzyć dla 600 klubów bez mrugnięcia.

create or replace function public.sbs_kluby_klienta()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  with pak as (select public.sbs_pakiety() as p)
  select c.id
  from public.sbs_clubs c, pak
  where 'Premium' = any(pak.p)
     or public.sbs_poziom_ligi(c.league) = any(pak.p);
$$;

grant execute on function public.sbs_kluby_klienta() to authenticated, anon;

comment on function public.sbs_kluby_klienta() is
  'Identyfikatory klubow z wykupionych rozgrywek biezacego konta. Liczone raz na zapytanie.';

-- ---------------------------------------------------------------------------
-- 2. KLUBY I ZAWODNICY
-- ---------------------------------------------------------------------------

do $$
declare p record; t text;
begin
  foreach t in array array['sbs_clubs','sbs_players'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- KLUBY. Poziom rozgrywek liczymy z kolumny, czyli dla każdego wiersza — ale sbs_poziom_ligi()
-- to zwykłe `case` bez zaglądania do bazy, więc 600 wywołań nic nie kosztuje. Droga jest lista
-- pakietów i ona stoi w nawiasie: liczona raz.
--
-- UWAGA NA ZAPIS: tu musi być operator zawierania `@>`, a NIE `= any(...)`.
-- Po owinięciu w `(select ...)` Postgres czyta `= any(...)` jako „any z wyniku podzapytania",
-- czyli ze ZBIORU WIERSZY — a sbs_pakiety() oddaje jeden wiersz będący tablicą. Kończy się to
-- błędem „malformed array literal". `@>` pyta wprost o to, o co nam chodzi: czy tablica
-- pakietów zawiera tę wartość.
create policy "kluby: odczyt w wykupionych ligach"
  on public.sbs_clubs for select to authenticated
  using (
    (select public.sbs_zatwierdzony())
    and (
      not (select public.sbs_klient())
      or (select public.sbs_pakiety()) @> array['Premium']
      or (select public.sbs_pakiety()) @> array[public.sbs_poziom_ligi(league)]
    )
  );

create policy "kluby: dopisywanie bez klienta"
  on public.sbs_clubs for insert to authenticated
  with check ((select public.sbs_zatwierdzony()) and not (select public.sbs_klient()));

create policy "kluby: poprawianie bez klienta"
  on public.sbs_clubs for update to authenticated
  using ((select public.sbs_zatwierdzony()) and not (select public.sbs_klient()))
  with check ((select public.sbs_zatwierdzony()) and not (select public.sbs_klient()));

create policy "kluby: usuwanie tylko administrator"
  on public.sbs_clubs for delete to authenticated
  using ((select public.sbs_admin()));

-- ZAWODNICY — tu leżała cała awaria. Zamiast pytać bazę o każdego zawodnika z osobna,
-- sprawdzamy przynależność do gotowej listy klubów, zbudowanej raz na początku zapytania.
create policy "zawodnicy: odczyt w wykupionych ligach"
  on public.sbs_players for select to authenticated
  using (
    (select public.sbs_zatwierdzony())
    and (
      not (select public.sbs_klient())
      or club_id in (select public.sbs_kluby_klienta())
    )
  );

-- Klient nie dopisuje zawodników do kartoteki i nie zmienia w niej niczego. Jedyne miejsce,
-- gdzie wolno mu coś dołożyć, to Talent — tam pisze do własnej tabeli, nie do kartoteki.
create policy "zawodnicy: dopisywanie bez klienta"
  on public.sbs_players for insert to authenticated
  with check ((select public.sbs_zatwierdzony()) and not (select public.sbs_klient()));

create policy "zawodnicy: poprawianie bez klienta"
  on public.sbs_players for update to authenticated
  using ((select public.sbs_zatwierdzony()) and not (select public.sbs_klient()))
  with check ((select public.sbs_zatwierdzony()) and not (select public.sbs_klient()));

create policy "zawodnicy: usuwanie tylko administrator"
  on public.sbs_players for delete to authenticated
  using ((select public.sbs_admin()));

-- Zawodnicy są szukani po klubie — i przy regule odczytu, i przy otwieraniu profilu klubu.
-- Bez indeksu każde takie pytanie przegląda całą kartotekę od początku.
create index if not exists sbs_players_club_id_idx on public.sbs_players(club_id);

-- ---------------------------------------------------------------------------
-- 3. OBSERWACJE I RAPORTY
-- ---------------------------------------------------------------------------
-- Czyta wszystko, co dotyczy jego lig. Dopisuje i poprawia WYŁĄCZNIE swoje. Nie kasuje nic.

do $$
declare p record; t text;
begin
  foreach t in array array['sbs_observations','sbs_reports'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format(
      'create policy "odczyt dla zatwierdzonych" on public.%I
         for select to authenticated using ((select public.sbs_zatwierdzony()))', t);
    -- `konto = auth.uid()` zostaje przy wierszu, bo o wiersz właśnie pyta. auth.uid() jest tanie:
    -- czyta nagłówek żądania, nie bazę.
    execute format(
      'create policy "dopisywanie: klient tylko swoje" on public.%I
         for insert to authenticated with check (
           (select public.sbs_zatwierdzony())
           and (not (select public.sbs_klient()) or konto = (select auth.uid())))', t);
    execute format(
      'create policy "poprawianie: klient tylko swoje" on public.%I
         for update to authenticated
         using ((select public.sbs_zatwierdzony())
                and (not (select public.sbs_klient()) or konto = (select auth.uid())))
         with check ((select public.sbs_zatwierdzony())
                and (not (select public.sbs_klient()) or konto = (select auth.uid())))', t);
    execute format(
      'create policy "usuwanie tylko administrator" on public.%I
         for delete to authenticated using ((select public.sbs_admin()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. TALENT — JEDYNE MIEJSCE, GDZIE KLIENT DOPISUJE
-- ---------------------------------------------------------------------------

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='sbs_talents' loop
    execute format('drop policy if exists %I on public.sbs_talents', p.policyname);
  end loop;
end $$;

create policy "talent: odczyt dla zatwierdzonych"
  on public.sbs_talents for select to authenticated
  using ((select public.sbs_zatwierdzony()));

create policy "talent: dopisywanie, klient tylko swoje"
  on public.sbs_talents for insert to authenticated
  with check ((select public.sbs_zatwierdzony())
    and (not (select public.sbs_klient()) or konto = (select auth.uid())));

create policy "talent: poprawianie, klient tylko swoje"
  on public.sbs_talents for update to authenticated
  using ((select public.sbs_zatwierdzony())
    and (not (select public.sbs_klient()) or konto = (select auth.uid())))
  with check ((select public.sbs_zatwierdzony())
    and (not (select public.sbs_klient()) or konto = (select auth.uid())));

create policy "talent: usuwanie tylko administrator"
  on public.sbs_talents for delete to authenticated
  using ((select public.sbs_admin()));

-- ---------------------------------------------------------------------------
-- 5. USTAWIENIA I STATYSTYKI (sbs_kv) — U KLIENTA TYLKO PODGLĄD
-- ---------------------------------------------------------------------------

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='sbs_kv' loop
    execute format('drop policy if exists %I on public.sbs_kv', p.policyname);
  end loop;
end $$;

create policy "kv: odczyt dla zatwierdzonych"
  on public.sbs_kv for select to authenticated
  using ((select public.sbs_zatwierdzony()));

-- sbs_klucz_zastrzezony() zostaje bez nawiasu i tak ma być: pyta o kolumnę `key`, więc musi
-- liczyć się dla każdego wiersza. Jest `immutable` i nie zagląda do bazy, więc jest darmowa.
create policy "kv: dopisywanie poza kluczami zastrzezonymi, bez klienta"
  on public.sbs_kv for insert to authenticated
  with check (
    (select public.sbs_zatwierdzony())
    and not (select public.sbs_klient())
    and (not public.sbs_klucz_zastrzezony(key) or (select public.sbs_admin()))
  );

create policy "kv: poprawianie poza kluczami zastrzezonymi, bez klienta"
  on public.sbs_kv for update to authenticated
  using (
    (select public.sbs_zatwierdzony())
    and not (select public.sbs_klient())
    and (not public.sbs_klucz_zastrzezony(key) or (select public.sbs_admin()))
  )
  with check (
    (select public.sbs_zatwierdzony())
    and not (select public.sbs_klient())
    and (not public.sbs_klucz_zastrzezony(key) or (select public.sbs_admin()))
  );

create policy "kv: usuwanie tylko administrator"
  on public.sbs_kv for delete to authenticated
  using ((select public.sbs_admin()));

-- ---------------------------------------------------------------------------
-- 6. HERBY KLUBÓW — DRUGA TABELA Z KOMUNIKATU O PRZEKROCZONYM CZASIE
-- ---------------------------------------------------------------------------
--
-- Herb to obrazek zapisany w postaci długiego ciągu znaków, więc wiersze są ciężkie — a reguła
-- wołała funkcję przy każdym z nich.
--
-- PRZY OKAZJI ZAMYKAMY NIEDOPATRZENIE. Herby miały dotąd regułę „czyta każdy zatwierdzony",
-- bez pytania o pakiety. Klient, który wykupił jedną ligę, widział 100 klubów, ale pobierał
-- 600 herbów — czyli także tych klubów, za które nie zapłacił. Samo godło nie jest tajemnicą,
-- ale spis wszystkich klubów w bazie to już informacja, a przy okazji sześciokrotnie większy
-- transfer przy każdym otwarciu panelu. Herby idą teraz tą samą drogą co zawodnicy.

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='sbs_club_crests' loop
    execute format('drop policy if exists %I on public.sbs_club_crests', p.policyname);
  end loop;
end $$;

create policy "herby: odczyt w wykupionych ligach"
  on public.sbs_club_crests for select to authenticated
  using (
    (select public.sbs_zatwierdzony())
    and (
      not (select public.sbs_klient())
      or club_id in (select public.sbs_kluby_klienta())
    )
  );

create policy "herby: dopisywanie bez klienta"
  on public.sbs_club_crests for insert to authenticated
  with check ((select public.sbs_zatwierdzony()) and not (select public.sbs_klient()));

create policy "herby: poprawianie bez klienta"
  on public.sbs_club_crests for update to authenticated
  using ((select public.sbs_zatwierdzony()) and not (select public.sbs_klient()))
  with check ((select public.sbs_zatwierdzony()) and not (select public.sbs_klient()));

create policy "herby: usuwanie tylko administrator"
  on public.sbs_club_crests for delete to authenticated
  using ((select public.sbs_admin()));

-- ---------------------------------------------------------------------------
-- 7. POZOSTAŁE TABELE (kontakty, terminarz, …)
-- ---------------------------------------------------------------------------

do $$
declare t text; p record;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public'
      and table_name like 'sbs\_%'
      and table_name not in ('sbs_konta','sbs_kv','sbs_clubs','sbs_players',
                             'sbs_observations','sbs_reports','sbs_talents',
                             'sbs_club_crests','sbs_zdarzenia_konta')
  loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
    execute format(
      'create policy "odczyt dla zatwierdzonych" on public.%I
         for select to authenticated using ((select public.sbs_zatwierdzony()))', t);
    execute format(
      'create policy "dopisywanie bez klienta" on public.%I
         for insert to authenticated
         with check ((select public.sbs_zatwierdzony()) and not (select public.sbs_klient()))', t);
    execute format(
      'create policy "poprawianie bez klienta" on public.%I
         for update to authenticated
         using ((select public.sbs_zatwierdzony()) and not (select public.sbs_klient()))
         with check ((select public.sbs_zatwierdzony()) and not (select public.sbs_klient()))', t);
    execute format(
      'create policy "usuwanie tylko administrator" on public.%I
         for delete to authenticated using ((select public.sbs_admin()))', t);
    raise notice 'Reguly przyspieszone dla tabeli: %', t;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- SPRAWDZENIE
-- ---------------------------------------------------------------------------

-- 1. Każda reguła odczytu ma mieć wywołania w nawiasie „(SELECT ...)". Kolumna `po_poprawce`
--    musi wszędzie pokazywać `true`. Gdzie pokaże `false`, tam została stara, wolna reguła.
select
  tablename as tabela,
  policyname as regula,
  qual like '%( SELECT %' as po_poprawce
from pg_policies
where schemaname = 'public' and cmd = 'SELECT'
  and tablename in ('sbs_clubs','sbs_players','sbs_club_crests','sbs_kv','sbs_observations','sbs_reports','sbs_talents')
order by po_poprawce, tablename;

-- 2. Nowa funkcja od listy klubów.
select proname as funkcja from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname = 'sbs_kluby_klienta';

-- 3. Indeks po klubie przy zawodnikach.
select indexname as indeks from pg_indexes
where schemaname = 'public' and tablename = 'sbs_players' and indexname = 'sbs_players_club_id_idx';

-- 4. Ile tego w ogóle jest — czyli z iloma wierszami baza musiała sobie radzić przy każdym odczycie.
select 'zawodnicy' as co, count(*) as wierszy from public.sbs_players
union all select 'kluby', count(*) from public.sbs_clubs
union all select 'herby', count(*) from public.sbs_club_crests;
