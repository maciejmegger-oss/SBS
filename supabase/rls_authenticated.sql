-- ============================================================================
-- ZAMKNIĘCIE DOSTĘPU DO DANYCH — uruchom DOPIERO gdy logowanie działa
-- ----------------------------------------------------------------------------
-- Zastępuje tymczasowe reguły „pełny dostęp dla anon" (supabase/schema_rls.sql)
-- regułami dla zalogowanych, ograniczonymi do własnej organizacji.
--
-- CO TO NAPRAWIA
-- Dziś każda tabela ma regułę `for all to anon using (true)`. `anon` to rola
-- niezalogowanego gościa, a klucz VITE_SUPABASE_ANON_KEY jest wkompilowany w
-- plik JS wysyłany do przeglądarki — da się go odczytać w zakładce „Sources".
-- W praktyce: kto zna adres strony, może odczytać i skasować całą bazę.
-- Po uruchomieniu tego pliku surowy klucz anon nie daje dostępu do niczego.
--
-- KIEDY URUCHOMIĆ
-- Dopiero gdy WSZYSCY, którzy mają korzystać z systemu, potrafią się zalogować.
-- Wcześniej — nie. Ten plik odcina dostęp niezalogowanym natychmiast.
--
-- JAK SIĘ WYCOFAĆ, GDYBY COŚ POSZŁO NIE TAK
-- Uruchom ponownie supabase/schema_rls.sql — przywróci stary, otwarty dostęp
-- i aplikacja zacznie działać jak dawniej. Warto mieć ten plik otwarty w
-- drugiej zakładce, zanim uruchomisz ten.
--
-- WYMAGANIA WSTĘPNE (bez nich zablokujesz sobie dostęp):
--   1. wykonana migracja supabase/migration_2026-07-28_auth.sql,
--   2. Twoje konto istnieje i ma rolę `admin`:
--        select email, role, active from sbs_users;
-- ============================================================================

do $$
declare
  t text;
  tables text[] := array[
    'sbs_clubs','sbs_club_crests','sbs_players','sbs_observations',
    'sbs_reports','sbs_talents','sbs_contacts','sbs_kv'
  ];
begin
  -- Zabezpieczenie przed zamknięciem się na zewnątrz: bez konta administratora
  -- nikt nie mógłby już nic zrobić przez aplikację.
  if not exists (select 1 from sbs_users where role = 'admin' and active) then
    raise exception 'Brak aktywnego konta z rolą admin. Najpierw załóż konto i nadaj mu rolę admin (patrz koniec migration_2026-07-28_auth.sql), potem uruchom ten plik.';
  end if;

  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'Pomijam % — tabela nie istnieje w tej bazie.', t;
      continue;
    end if;

    execute format('alter table %I enable row level security', t);

    -- Stara, otwarta reguła — usuwana pod oboma nazwami, jakie mogły powstać.
    execute format('drop policy if exists "Tymczasowy pełny dostęp" on %I', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format('drop policy if exists %I on %I', t || '_delete', t);

    -- Odczyt: każdy zalogowany, ale tylko dane własnej organizacji.
    -- sbs_current_org() zwraca NULL dla niezalogowanego, a porównanie z NULL
    -- nigdy nie jest prawdziwe — więc gość nie zobaczy ani jednego wiersza.
    execute format(
      'create policy %I on %I for select to authenticated
         using (org_id = sbs_current_org())', t || '_select', t);

    -- Zapis: rola admin lub scout. Viewer ma wyłącznie podgląd.
    -- `with check` pilnuje, żeby nie dało się dopisać wiersza do CUDZEJ organizacji.
    execute format(
      'create policy %I on %I for insert to authenticated
         with check (org_id = sbs_current_org() and sbs_can_write())', t || '_insert', t);

    execute format(
      'create policy %I on %I for update to authenticated
         using (org_id = sbs_current_org() and sbs_can_write())
         with check (org_id = sbs_current_org() and sbs_can_write())', t || '_update', t);

    -- Usuwanie: wyłącznie administrator. To celowo węższe niż zapis —
    -- skasowanie zawodnika kasuje kaskadowo jego obserwacje i raporty.
    execute format(
      'create policy %I on %I for delete to authenticated
         using (org_id = sbs_current_org() and sbs_is_admin())', t || '_delete', t);
  end loop;
end $$;

-- Sprawdzenie po uruchomieniu — powinno pokazać po 4 reguły na tabelę
-- i ani jednej z rolą `anon`:
--
--   select tablename, policyname, roles, cmd
--   from pg_policies where schemaname = 'public' order by tablename, cmd;
