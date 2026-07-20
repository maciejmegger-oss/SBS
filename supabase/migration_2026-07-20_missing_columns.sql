-- Migracja: dodanie kolumn, które istniały w kodzie aplikacji, ale nigdy nie zostały dodane
-- do rzeczywistej bazy Supabase — przez co powiązane zapisy (obserwacje z punktem startowym/
-- dystansem, oraz asysty/media/kadra/reprezentacja/opis końcowy/monitoring/historia transferowa
-- zawodnika) cicho się nie zapisywały (kolumna nie istnieje -> błąd -> zapis odrzucony).
--
-- Bezpieczne do uruchomienia w dowolnym momencie: każda linia to "dodaj kolumnę, jeśli jej nie ma"
-- (IF NOT EXISTS) — nic nie usuwa i nie nadpisuje istniejących danych.
--
-- Jak uruchomić: Supabase Dashboard -> Twój projekt -> SQL Editor -> New query -> wklej całość -> Run.

alter table sbs_observations add column if not exists start_location text;
alter table sbs_observations add column if not exists distance_km integer;

alter table sbs_players add column if not exists assists integer;
alter table sbs_players add column if not exists instagram_link text;
alter table sbs_players add column if not exists facebook_link text;
alter table sbs_players add column if not exists kadra_wojewodzka boolean default false;
alter table sbs_players add column if not exists reprezentacja boolean default false;
alter table sbs_players add column if not exists powolania integer;
alter table sbs_players add column if not exists opis_koncowy text;
alter table sbs_players add column if not exists monitored boolean default false;
alter table sbs_players add column if not exists transfer_history jsonb default '[]'::jsonb;

alter table sbs_reports add column if not exists obs_type text;
