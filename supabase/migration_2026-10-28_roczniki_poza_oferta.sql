-- NAJMŁODSZE ROCZNIKI POZA OFERTĄ HANDLOWĄ
--
-- DECYZJA
-- Roczniki 2012, 2013 i 2014 zostają w bazie i są dalej zbierane, ale ŻADEN KLIENT ich nie
-- zobaczy — niezależnie od wykupionych pakietów, łącznie z Premium. To dane dwunasto-,
-- trzynasto- i czternastolatków.
--
-- Rocznik 2011 zostaje dostępny: piętnastolatkowie grają już w rozgrywkach, w których skauting
-- jest normą, a część z nich wchodzi do zespołów seniorskich.
--
-- DLACZEGO TO NIE JEST TYLKO UKRYCIE W PANELU
-- Reguła w aplikacji (maDostepDoLigi w src/main.ts) chowa te roczniki z widoków. Ale klucz
-- dostępu do bazy jest wpisany w kod strony i każdy zalogowany klient może odpytać bazę
-- z pominięciem aplikacji. Dopóki nie zabroni tego sama baza, ograniczenie jest wygodą,
-- a nie zabezpieczeniem. Ta migracja zamyka tę drogę.
--
-- CO SIĘ NIE ZMIENIA: administrator i skaut widzą wszystko jak dotąd. Zmiana dotyczy
-- wyłącznie kont z rolą „klient".
--
-- Wymaga wcześniejszego uruchomienia migration_2026-09-22_klient_i_pakiety.sql
-- oraz migration_2026-09-23_szybkie_reguly.sql.

-- ---------------------------------------------------------------------------
-- 1. KTÓRE ROZGRYWKI SĄ ZASTRZEŻONE
-- ---------------------------------------------------------------------------
--
-- `immutable`, bo odpowiedź zależy wyłącznie od przekazanej nazwy — nie od konta, nie od czasu,
-- nie od zawartości bazy. Dzięki temu Postgres może ją wkleić w zapytanie zamiast wywoływać
-- osobno dla każdego wiersza, i reguły pozostają tak szybkie, jak po poprawce z 23.09.

create or replace function public.sbs_rocznik_zastrzezony(liga text)
returns boolean
language sql
immutable
as $$
  select btrim(coalesce(liga, '')) in ('Rocznik 2012', 'Rocznik 2013', 'Rocznik 2014');
$$;

grant execute on function public.sbs_rocznik_zastrzezony(text) to authenticated, anon;

comment on function public.sbs_rocznik_zastrzezony(text) is
  'Rozgrywki wylaczone z oferty handlowej: najmlodsze roczniki. Klient ich nie widzi.';

-- Lista klubów klienta liczona od nowa — z pominięciem zastrzeżonych roczników.
-- Z niej korzystają reguły przy zawodnikach i herbach, więc poprawka rozchodzi się dalej sama.
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
  where not public.sbs_rocznik_zastrzezony(c.league)
    and ('Premium' = any(pak.p)
         or public.sbs_poziom_ligi(c.league) = any(pak.p));
$$;

-- ---------------------------------------------------------------------------
-- 2. KLUBY
-- ---------------------------------------------------------------------------
-- Warunek stoi PRZED sprawdzeniem Premium: pakiet „wszystkie rozgrywki" ma otwierać wszystko,
-- co jest w ofercie — a te roczniki w ofercie nie są.

drop policy if exists "kluby: odczyt w wykupionych ligach" on public.sbs_clubs;

create policy "kluby: odczyt w wykupionych ligach"
  on public.sbs_clubs for select to authenticated
  using (
    (select public.sbs_zatwierdzony())
    and (
      not (select public.sbs_klient())
      or (
        not public.sbs_rocznik_zastrzezony(league)
        and (
          (select public.sbs_pakiety()) @> array['Premium']
          or (select public.sbs_pakiety()) @> array[public.sbs_poziom_ligi(league)]
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- SPRAWDZENIE
-- ---------------------------------------------------------------------------

-- 1. Funkcja istnieje i działa.
select
  public.sbs_rocznik_zastrzezony('Rocznik 2012') as rocznik_2012_zastrzezony,  -- ma być t
  public.sbs_rocznik_zastrzezony('Rocznik 2011') as rocznik_2011_zastrzezony,  -- ma być f
  public.sbs_rocznik_zastrzezony('CLJ U15 gr. A') as clj_zastrzezone;          -- ma być f

-- 2. Ilu zawodników i klubów dotyczy ograniczenie.
select
  c.league as rozgrywki,
  count(distinct c.id) as klubow,
  count(p.id)          as zawodnikow
from public.sbs_clubs c
left join public.sbs_players p on p.club_id = c.id
where public.sbs_rocznik_zastrzezony(c.league)
group by c.league
order by c.league;

-- 3. Reguła przy klubach ma wywoływać sbs_rocznik_zastrzezony.
select policyname as regula,
       qual like '%sbs_rocznik_zastrzezony%' as ograniczenie_wpiete
from pg_policies
where schemaname = 'public' and tablename = 'sbs_clubs' and cmd = 'SELECT';
