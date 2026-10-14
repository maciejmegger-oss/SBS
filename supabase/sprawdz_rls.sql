-- DIAGNOSTYKA REGUŁ DOSTĘPU — tylko odczyt, niczego nie zmienia.
-- Uruchom: Supabase → SQL Editor → New query → wklej → Run. Wyniki czytaj sekcjami.

-- 1. Tabele sbs_* BEZ włączonego RLS (powinno być pusto).
select c.relname as tabela
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'sbs\_%'
  and not c.relrowsecurity
order by 1;

-- 2. Polityki dostępne dla roli anon (klucz publiczny z kodu strony).
--    Oczekiwane: tylko świadome wyjątki (zlecenia analiz, skrzynka raportów). Pełny dostęp (true/true) = problem.
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename like 'sbs\_%' and 'anon' = any(roles)
order by tablename, cmd;

-- 3. Polityka "Tymczasowy pełny dostęp" z dawnego schema_rls.sql (powinno być pusto).
select tablename, policyname from pg_policies
where schemaname = 'public' and policyname ilike '%Tymczasowy%';

-- 4. Uprawnienia tabel dla anon (grant) — kolumny insert/update/delete/select.
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as uprawnienia
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon' and table_name like 'sbs\_%'
group by table_name order by 1;

-- 5. Konta i role (kto ma dostęp).
select email, rola, status, utworzone_at from sbs_konta order by utworzone_at;
