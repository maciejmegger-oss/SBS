// Kształt danych na poziomie aplikacji (camelCase) — odpowiada tabelom w supabase/schema.sql,
// z konwersją snake_case <-> camelCase wykonywaną w src/data/storage.ts.

export interface Club {
  id: string;
  name: string;
  region?: string;
  league?: string;
  season?: string;
  city?: string;
  crestUrl?: string;
  juniorCategories?: string;
  profileLnp?: string;
  profileTm?: string;
}

// sbs_club_crests: mapa club_id -> data_url (base64), nie tablica rekordów.
export type ClubCrestMap = Record<string, string>;

export interface Player {
  id: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthYear?: string;
  position?: string;
  foot?: string;
  height?: number;
  status?: string;
  clubId?: string;
  scout?: string;
  videoLink?: string;
  lnpLink?: string;
  tmLink?: string;
  hasAgent?: boolean;
  agencyName?: string;
  formation?: string;
  matches?: number;
  minutes?: number;
  goals?: number;
  assists?: number;
  statsUpdatedAt?: string;
  statsSource?: string;
  statsSeason?: string;
  instagramLink?: string;
  facebookLink?: string;
  kadraWojewodzka?: boolean;
  reprezentacja?: boolean;
  powolania?: number;
  opisKoncowy?: string;
  monitored?: boolean;
  nationality?: string;
  yellowCards?: number | null;
  redCards?: number | null;
  watchlistRemoved?: boolean;
  hasContract?: boolean;
  contractUntil?: string;
  transferHistory?: TransferHistoryEntry[];
  notes?: string;
  dateAdded?: string;
  source?: string;
  photoUrl?: string;
  committeeOpinion?: string;
  committeeDecision?: string;
  committeeNotes?: string;
  customFields?: Record<string, unknown>;
  attachments?: unknown[];
  committeeReports?: unknown[];
}

export interface Observation {
  id: string;
  playerId?: string;
  date?: string;
  matchTime?: string;
  match?: string;
  location?: string;
  scout?: string;
  ratings?: Record<string, number>;
  recommendation?: string;
  notes?: string;
  statsFilledIn?: boolean;
  distanceKm?: number | null;
  startLocation?: string;
  obsType?: string;
}

export interface Report {
  id: string;
  playerId?: string;
  date?: string;
  scout?: string;
  description?: string;
  technika?: string;
  taktyka?: string;
  motoryka?: string;
  mentalnoscOpis?: string;
  potencjalOpis?: string;
  perspektywa?: string;
  phases?: Record<string, unknown>;
  setPieces?: Record<string, unknown>;
  setPieceComment?: string;
  obsType?: string;
}

export interface Talent {
  id: string;
  firstName?: string;
  lastName?: string;
  birthYear?: string;
  club?: string;
  confidence?: string;
  sourceImage?: string;
  dateAdded?: string;
}

export interface Contact {
  id: string;
  club?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  note?: string;
  dateAdded?: string;
}

export interface Sponsor {
  name?: string;
  dataUrl: string;
}

export interface TransferHistoryEntry {
  id: string;
  club: string;
  from?: string;
  to?: string;
  type?: string;
  fee?: string;
  note?: string;
}

export interface Settings {
  scouts: string[];
  sponsors?: Sponsor[];
  startLocation?: string;
  leagueLogos?: Record<string, string>;
  [key: string]: unknown;
}

export interface Match {
  id: string;
  league?: string;
  date?: string;
  time?: string;
  homeTeam?: string;
  awayTeam?: string;
  stadium?: string;
  city?: string;
}

// Agencja menedżerska — firma. Zawodnik jest reprezentowany przez AGENCJĘ, a w jej ramach
// zwykle przez konkretną osobę; dlatego są to dwa osobne byty, a nie jedno pole tekstowe.
export interface Agency {
  id: string;
  name: string;
  tmLink?: string;        // strona agencji na Transfermarkcie (stamtąd wchodzi automat)
  website?: string;
  country?: string;
  city?: string;
  email?: string;
  phone?: string;
  notes?: string;
  dateAdded?: string;
}

// Menedżer — konkretna osoba pracująca w agencji. To z nią się rozmawia, więc trzyma dane
// kontaktowe i numer licencji FIFA, którego agencja jako firma nie ma.
export interface Agent {
  id: string;
  agencyId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  licence?: string;       // numer licencji FIFA Football Agent
  tmLink?: string;
  notes?: string;
  dateAdded?: string;
}

export interface Database {
  players: Player[];
  clubs: Club[];
  observations: Observation[];
  reports: Report[];
  talents: Talent[];
  contacts: Contact[];
  matches: Match[];
  agencies: Agency[];
  agents: Agent[];
  clubCrests: ClubCrestMap;
  settings: Settings | null;
}
