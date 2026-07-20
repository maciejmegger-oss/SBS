-- Scout Base System — właściwy schemat relacyjny, osobna tabela dla każdego obiektu.
-- Pola rdzenia (imię, nazwisko, data itd.) jako prawdziwe kolumny — można po nich
-- filtrować/sortować wprost w Supabase. Zagnieżdżone struktury (oceny, pola własne,
-- załączniki) jako JSONB — to standardowa, bezpieczna praktyka w Postgresie dla danych
-- o zmiennym kształcie, bez mnożenia dziesiątek małych tabel pomocniczych.

create table if not exists sbs_clubs (
  id text primary key,
  name text not null,
  region text,
  league text,
  season text,
  city text,
  crest_url text,
  junior_categories text,
  profile_lnp text,
  profile_tm text,
  updated_at timestamptz not null default now()
);

create table if not exists sbs_club_crests (
  club_id text primary key references sbs_clubs(id) on delete cascade,
  data_url text not null,
  updated_at timestamptz not null default now()
);

create table if not exists sbs_players (
  id text primary key,
  first_name text,
  last_name text,
  birth_date text,
  birth_year text,
  position text,
  foot text,
  height integer,
  status text,
  club_id text references sbs_clubs(id) on delete set null,
  scout text,
  video_link text,
  lnp_link text,
  tm_link text,
  has_agent boolean default false,
  agency_name text,
  formation text,
  matches integer,
  minutes integer,
  goals integer,
  notes text,
  date_added text,
  source text,
  photo_url text,
  committee_opinion text,
  committee_decision text,
  committee_notes text,
  custom_fields jsonb default '{}'::jsonb,
  attachments jsonb default '[]'::jsonb,
  committee_reports jsonb default '[]'::jsonb,
  assists integer,
  instagram_link text,
  facebook_link text,
  kadra_wojewodzka boolean default false,
  reprezentacja boolean default false,
  powolania integer,
  opis_koncowy text,
  monitored boolean default false,
  transfer_history jsonb default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists sbs_players_club_id_idx on sbs_players(club_id);
create index if not exists sbs_players_status_idx on sbs_players(status);

create table if not exists sbs_observations (
  id text primary key,
  player_id text references sbs_players(id) on delete cascade,
  date text,
  match_time text,
  match text,
  location text,
  scout text,
  ratings jsonb default '{}'::jsonb,
  recommendation text,
  notes text,
  stats_filled_in boolean default false,
  start_location text,
  distance_km integer,
  updated_at timestamptz not null default now()
);
create index if not exists sbs_observations_player_id_idx on sbs_observations(player_id);

create table if not exists sbs_reports (
  id text primary key,
  player_id text references sbs_players(id) on delete cascade,
  date text,
  scout text,
  description text,
  technika text,
  taktyka text,
  motoryka text,
  mentalnosc_opis text,
  potencjal_opis text,
  perspektywa text,
  phases jsonb default '{}'::jsonb,
  set_pieces jsonb default '{}'::jsonb,
  set_piece_comment text,
  updated_at timestamptz not null default now()
);
create index if not exists sbs_reports_player_id_idx on sbs_reports(player_id);

create table if not exists sbs_talents (
  id text primary key,
  first_name text,
  last_name text,
  birth_year text,
  club text,
  confidence text,
  source_image text,
  date_added text,
  updated_at timestamptz not null default now()
);

create table if not exists sbs_contacts (
  id text primary key,
  club text,
  email text,
  first_name text,
  last_name text,
  phone text,
  note text,
  date_added text,
  updated_at timestamptz not null default now()
);

-- Wszystko, co NIE jest kolekcją pojedynczych obiektów (ustawienia, przypisania na mapie
-- rankingowej, wewnętrzne znaczniki "już zrobione") — zostaje jako proste klucz-wartość,
-- bo to pojedyncze, całościowe struktury, a nie zbiory wielu rekordów tego samego typu.
create table if not exists sbs_kv (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
