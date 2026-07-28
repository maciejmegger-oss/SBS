-- ============================================================================
-- ETAP 1 — LOGOWANIE, ROLE I FUNDAMENT WIELODOSTĘPOWY (org_id)
-- ----------------------------------------------------------------------------
-- Uruchom to RAZ w Supabase → SQL Editor → New query → Run.
-- Plik jest idempotentny: ponowne uruchomienie niczego nie zepsuje.
--
-- Co robi:
--   1. zakłada tabelę organizacji (jeden klient = jedna organizacja),
--   2. zakłada tabelę profili użytkowników z rolami (admin / scout / viewer),
--   3. dokłada kolumnę org_id do WSZYSTKICH tabel z danymi,
--   4. zakłada funkcje pomocnicze, na których oprą się reguły dostępu,
--   5. włącza reguły dostępu na tabelach kont (dane merytoryczne zostają
--      otwarte do czasu uruchomienia rls_authenticated.sql — patrz instrukcja).
--
-- NIE usuwa żadnych danych.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. ORGANIZACJE
-- ---------------------------------------------------------------------------
-- Organizacja to pojedynczy klient systemu (klub, akademia, agencja). Dziś jest
-- jedna — Twoja. Kolumna `plan` jest przygotowana pod przyszłe pakiety, ale na
-- razie nic jej nie odczytuje; nie trzeba jej teraz uzupełniać.
create table if not exists sbs_orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  plan       text not null default 'enterprise',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Organizacja domyślna — do niej trafiają wszystkie dotychczasowe dane.
-- Stałe UUID, bo odwołują się do niego wartości domyślne kolumn poniżej.
insert into sbs_orgs (id, name, plan)
values ('00000000-0000-0000-0000-000000000001', 'Scout Base System', 'enterprise')
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- 2. PROFILE UŻYTKOWNIKÓW
-- ---------------------------------------------------------------------------
-- Supabase trzyma konta (e-mail, hasło) w swojej wewnętrznej tabeli auth.users,
-- do której aplikacja nie ma i nie powinna mieć bezpośredniego dostępu. Tutaj
-- trzymamy to, co jest nasze: przynależność do organizacji, rolę i status.
-- Klucz główny jest ten sam co w auth.users — usunięcie konta usuwa profil.
--
-- Role:
--   admin  — pełna władza: zarządza kontami, usuwa dane, zmienia ustawienia
--   scout  — normalna praca: dodaje i edytuje zawodników, obserwacje, raporty
--   viewer — tylko podgląd, bez prawa zapisu (np. prezes, trener)
create table if not exists sbs_users (
  id           uuid primary key references auth.users(id) on delete cascade,
  org_id       uuid not null default '00000000-0000-0000-0000-000000000001'
                 references sbs_orgs(id) on delete cascade,
  email        text not null,
  full_name    text,
  role         text not null default 'scout' check (role in ('admin','scout','viewer')),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);
create index if not exists sbs_users_org_id_idx on sbs_users(org_id);

-- Rejestr logowań — wymóg RODO (trzeba umieć wykazać, kto i kiedy miał dostęp
-- do danych osobowych), a przy okazji podstawa do rozliczania pakietów.
create table if not exists sbs_login_log (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete set null,
  org_id     uuid,
  email      text,
  event      text not null,
  created_at timestamptz not null default now()
);
create index if not exists sbs_login_log_created_at_idx on sbs_login_log(created_at desc);


-- ---------------------------------------------------------------------------
-- 3. KOLUMNA org_id W TABELACH Z DANYMI
-- ---------------------------------------------------------------------------
-- To najważniejsza część tej migracji i powód, dla którego robimy ją TERAZ,
-- a nie przy okazji pakietów. Dziś wszystkie dane należą do jednej organizacji,
-- więc kolumna ma wartość domyślną i nic się nie zmienia. Gdy pojawi się drugi
-- klient, jego dane dostaną inne org_id i reguły dostępu w bazie rozdzielą
-- jedno od drugiego. Dołożenie tej kolumny do pustej-ish bazy jest darmowe;
-- dokładanie jej do bazy z kilkunastoma klientami to migracja produkcyjna.
do $$
declare
  t text;
  tables text[] := array[
    'sbs_clubs','sbs_club_crests','sbs_players','sbs_observations',
    'sbs_reports','sbs_talents','sbs_contacts','sbs_kv'
  ];
begin
  foreach t in array tables loop
    -- sbs_matches figuruje w schema.sql, ale w bazie nie istnieje (migracji nigdy
    -- nie uruchomiono — patrz komentarz w src/data/storage.ts). Pomijamy tabele,
    -- których nie ma, zamiast wywalać całą migrację.
    if to_regclass('public.' || t) is null then
      raise notice 'Pomijam % — tabela nie istnieje w tej bazie.', t;
      continue;
    end if;

    execute format(
      'alter table %I add column if not exists org_id uuid not null
         default ''00000000-0000-0000-0000-000000000001''
         references sbs_orgs(id) on delete cascade', t);
    execute format('create index if not exists %I on %I(org_id)', t || '_org_id_idx', t);
  end loop;
end $$;

-- sbs_kv ma klucz główny na samej kolumnie `key`, więc dwie organizacje nie
-- mogłyby mieć własnych ustawień pod tą samą nazwą klucza. Rozszerzamy klucz
-- o org_id. (Jeśli tabeli nie ma — pomijamy.)
do $$
begin
  if to_regclass('public.sbs_kv') is not null
     and exists (select 1 from pg_constraint where conname = 'sbs_kv_pkey') then
    alter table sbs_kv drop constraint sbs_kv_pkey;
    alter table sbs_kv add primary key (org_id, key);
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 4. FUNKCJE POMOCNICZE DLA REGUŁ DOSTĘPU
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER jest tu konieczne: funkcja czyta sbs_users, a reguły dostępu
-- na sbs_users będą z niej korzystać. Bez tego powstałaby pętla (reguła pyta
-- funkcję, funkcja odpytuje tabelę, tabela znów odpala regułę). SECURITY DEFINER
-- wykonuje zapytanie z uprawnieniami właściciela, czyli z pominięciem reguł.
-- `set search_path` jest zabezpieczeniem wymaganym przy takich funkcjach.

-- Organizacja zalogowanego użytkownika. NULL dla niezalogowanego — a NULL
-- nigdy nie jest równy niczemu, więc niezalogowany nie zobaczy ani jednego wiersza.
create or replace function sbs_current_org() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from sbs_users where id = auth.uid() and active
$$;

-- Czy zalogowany użytkownik jest administratorem.
create or replace function sbs_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from sbs_users where id = auth.uid() and active), false)
$$;

-- Czy zalogowany użytkownik ma prawo zapisu (viewer go nie ma).
create or replace function sbs_can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','scout') from sbs_users where id = auth.uid() and active), false)
$$;


-- ---------------------------------------------------------------------------
-- 5. PROFIL ZAKŁADANY AUTOMATYCZNIE PRZY POWSTANIU KONTA
-- ---------------------------------------------------------------------------
-- Konto może powstać dwiema drogami: przez zaproszenie wysłane z panelu w
-- aplikacji albo ręcznie w panelu Supabase. Wyzwalacz obsługuje obie, więc
-- konto bez profilu (a przez to bez roli i bez organizacji — czyli zalogowane,
-- ale nie widzące niczego) nie może powstać przez przeoczenie.
create or replace function sbs_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into sbs_users (id, email, full_name, role, org_id)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'scout'),
    coalesce(
      nullif(new.raw_user_meta_data->>'org_id', '')::uuid,
      '00000000-0000-0000-0000-000000000001'
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists sbs_on_auth_user_created on auth.users;
create trigger sbs_on_auth_user_created
  after insert on auth.users
  for each row execute function sbs_handle_new_user();


-- ---------------------------------------------------------------------------
-- 6. REGUŁY DOSTĘPU DO TABEL KONT
-- ---------------------------------------------------------------------------
-- Te tabele zamykamy OD RAZU — inaczej lista użytkowników i ich role byłyby
-- publicznie widoczne. Tabele z danymi merytorycznymi (zawodnicy, obserwacje…)
-- zostają na razie otwarte; zamyka je osobny plik rls_authenticated.sql, który
-- uruchamiasz dopiero po sprawdzeniu, że logowanie działa dla wszystkich.
alter table sbs_orgs      enable row level security;
alter table sbs_users     enable row level security;
alter table sbs_login_log enable row level security;

drop policy if exists sbs_orgs_select on sbs_orgs;
create policy sbs_orgs_select on sbs_orgs
  for select to authenticated
  using (id = sbs_current_org());

-- Każdy widzi swój profil; administrator widzi wszystkie profile w swojej organizacji.
drop policy if exists sbs_users_select on sbs_users;
create policy sbs_users_select on sbs_users
  for select to authenticated
  using (id = auth.uid() or (sbs_is_admin() and org_id = sbs_current_org()));

-- Zmieniać role i blokować konta może wyłącznie administrator, i tylko we własnej
-- organizacji. Zwykły użytkownik nie awansuje się na admina — zapis jest w bazie.
drop policy if exists sbs_users_update_admin on sbs_users;
create policy sbs_users_update_admin on sbs_users
  for update to authenticated
  using (sbs_is_admin() and org_id = sbs_current_org())
  with check (sbs_is_admin() and org_id = sbs_current_org());

-- Zapis do rejestru logowań: każdy zalogowany dopisuje własny wpis.
-- Odczyt: tylko administrator i tylko swojej organizacji.
drop policy if exists sbs_login_log_insert on sbs_login_log;
create policy sbs_login_log_insert on sbs_login_log
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists sbs_login_log_select on sbs_login_log;
create policy sbs_login_log_select on sbs_login_log
  for select to authenticated
  using (sbs_is_admin() and org_id = sbs_current_org());


-- ============================================================================
-- KROK RĘCZNY — WYKONAJ PO ZAŁOŻENIU SWOJEGO KONTA
-- ----------------------------------------------------------------------------
-- Kolejność jest istotna: najpierw załóż sobie konto (Supabase → Authentication
-- → Users → Add user, z hasłem, „Auto Confirm User" włączone), a dopiero potem
-- uruchom poniższą linijkę. Wyzwalacz z punktu 5 utworzy profil z rolą `scout`;
-- ta aktualizacja podnosi Cię do administratora.
--
-- Podmień adres na swój, odkomentuj i uruchom:
--
--   update sbs_users set role = 'admin', active = true
--   where email = 'maciejmegger@gmail.com';
--
-- Sprawdzenie, że się udało:
--
--   select email, role, active from sbs_users;
--
-- Dopóki nie ma ANI JEDNEGO konta z rolą `admin`, nikt nie może zapraszać
-- kolejnych osób — to celowe zabezpieczenie, nie usterka.
-- ============================================================================
