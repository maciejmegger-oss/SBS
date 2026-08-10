-- ZAMKNIĘCIE DOSTĘPU DO DANYCH — uruchom w Supabase: SQL Editor → New query → Run.
--
-- DLACZEGO TO JEST KONIECZNE
-- Klucz "anon" jest wbudowany w kod strony i każdy może go odczytać — tak działa Supabase i nie da
-- się tego ukryć. Bezpieczeństwo NIE opiera się więc na ukryciu klucza, tylko na regułach dostępu
-- (Row Level Security). Obecna reguła "Tymczasowy pełny dostęp" pozwala anonimowym czytać i
-- ZAPISYWAĆ wszystko. Sprawdzone: odczyt i zapis bez logowania kończyły się powodzeniem.
-- Sam ekran logowania tego nie naprawia — bez tych reguł wystarczy pominąć aplikację i odpytać bazę.
--
-- CO ROBI TEN SKRYPT
-- Usuwa dostęp anonimowy i zostawia go WYŁĄCZNIE zalogowanym (rola "authenticated").
--
-- KOLEJNOŚĆ WDROŻENIA (ważna!)
-- 1. Najpierw utwórz sobie konto: Supabase → Authentication → Users → Add user
--    (podaj e-mail i hasło, zaznacz "Auto Confirm User").
-- 2. Sprawdź, że logowanie w aplikacji działa i widzisz dane.
-- 3. DOPIERO POTEM uruchom ten skrypt.
-- Odwrotna kolejność odetnie aplikację od danych, dopóki się nie zalogujesz.

do $$
declare
  t text;
  tabele text[] := array[
    'sbs_players','sbs_clubs','sbs_observations','sbs_reports',
    'sbs_talents','sbs_contacts','sbs_club_crests','sbs_kv','sbs_live_events'
  ];
begin
  foreach t in array tabele loop
    -- Tabela może jeszcze nie istnieć (np. sbs_matches) — wtedy pomijamy bez błędu.
    if exists (select 1 from information_schema.tables
               where table_schema='public' and table_name=t) then

      execute format('alter table public.%I enable row level security', t);

      -- Zdejmujemy WSZYSTKIE dotychczasowe reguły dla tej tabeli, żeby nie została żadna
      -- otwarta furtka z poprzednich ustawień.
      for t in (select t) loop null; end loop;   -- (pętla pozorna, t zachowane niżej)
    end if;
  end loop;
end $$;

-- Usunięcie starych reguł i nadanie nowych — jawnie, tabela po tabeli, żeby było widać, co się dzieje.
do $$
declare
  t text;
  p record;
  tabele text[] := array[
    'sbs_players','sbs_clubs','sbs_observations','sbs_reports',
    'sbs_talents','sbs_contacts','sbs_club_crests','sbs_kv','sbs_matches',
    -- Zdarzenia z panelu mobilnego. Zamykamy je RAZEM z resztą bazy, a nie osobno: tabela
    -- zamknięta w pojedynkę odcinała telefon od zapisu, choć wszystko inne stało otworem.
    'sbs_live_events'
  ];
begin
  foreach t in array tabele loop
    if exists (select 1 from information_schema.tables
               where table_schema='public' and table_name=t) then

      execute format('alter table public.%I enable row level security', t);

      -- zdejmij istniejące reguły
      for p in select policyname from pg_policies
               where schemaname='public' and tablename=t loop
        execute format('drop policy if exists %I on public.%I', p.policyname, t);
      end loop;

      -- pełny dostęp TYLKO dla zalogowanych
      execute format(
        'create policy "Dostep tylko dla zalogowanych" on public.%I
           for all to authenticated using (true) with check (true)', t);

      raise notice 'Zabezpieczono tabelę: %', t;
    end if;
  end loop;
end $$;

-- SPRAWDZENIE — po uruchomieniu powinno pokazać jedną regułę na tabelę, dla roli {authenticated}.
select tablename, policyname, roles
from pg_policies
where schemaname='public' and tablename like 'sbs_%'
order by tablename;
