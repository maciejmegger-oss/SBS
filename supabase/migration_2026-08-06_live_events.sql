-- Zdarzenia rejestrowane na żywo z panelu mobilnego (/m).
--
-- URUCHOMIENIE JEST NIEOBOWIĄZKOWE. Panel działa bez tej tabeli: gdy jej nie znajdzie, zapisuje
-- oś zdarzeń do sbs_kv pod kluczem "scouting:liveEvents:<id obserwacji>" — tak samo, jak
-- aplikacja na komputerze trzyma tam terminarz i ustawienia. Ten skrypt warto uruchomić, gdy
-- zdarzenia mają być przeszukiwalne zapytaniem SQL (np. „wszystkie strzały zawodnika w sezonie")
-- albo pokazywane w aplikacji na komputerze.
--
-- Uruchomienie: Supabase → SQL Editor → New query → Run. Skrypt jest bezpieczny do powtórzenia.

create table if not exists sbs_live_events (
  id             text primary key,
  observation_id text references sbs_observations(id) on delete cascade,
  player_id      text references sbs_players(id) on delete set null,
  half           smallint,      -- część meczu: 1-2 połowy regulaminowe, 3-4 dogrywka
  minute         integer,       -- minuta MECZU (2. połowa od 45, dogrywka od 90), nie godzina zegarowa
  type           text,          -- klucz zdarzenia: 'strzal', 'podanie_kluczowe', 'pojedynek'…
  quality        smallint,      -- 1 = udane, -1 = nieudane
  zawodnik       text,          -- kogo dotyczy, tak jak widnieje w składzie („10 Mosek"); puste = zespół
  note           text,
  created_at     timestamptz not null default now()
);

-- Kolumna dołożona po pierwszym wdrożeniu — dla baz, w których tabela już istnieje.
alter table sbs_live_events add column if not exists zawodnik text;

create index if not exists sbs_live_events_obs_idx on sbs_live_events(observation_id);
create index if not exists sbs_live_events_player_idx on sbs_live_events(player_id);

-- DOSTĘP DOKŁADNIE TAKI SAM, JAK DO RESZTY BAZY.
--
-- Wcześniej stało tu „wyłącznie dla zalogowanych" — i to była jedyna tabela z takim ustawieniem,
-- bo pozostałe (supabase/schema_rls.sql) pozwalają czytać i zapisywać bez logowania. Skutki były
-- dwa, oba ciche: telefon, który wchodzi bez logowania, dostawał odmowę przy KAŻDYM zapisie
-- zdarzeń, a aplikacja na komputerze widziała zero zdarzeń — bo Postgres przy odmowie nie zgłasza
-- błędu, tylko oddaje pusty wynik. Wyglądało to jak „telefon nic nie zapisał".
--
-- Zamykanie dostępu robi się dla CAŁEJ bazy naraz: supabase/rls_only_logged_in.sql obejmuje też
-- tę tabelę. Zamknięcie jej osobno chroniło wyłącznie przed własnym scoutem.
alter table sbs_live_events enable row level security;

drop policy if exists "Dostep dla zalogowanych" on sbs_live_events;
drop policy if exists "Tymczasowy pełny dostęp" on sbs_live_events;
create policy "Tymczasowy pełny dostęp" on sbs_live_events
  for all to anon, authenticated using (true) with check (true);
