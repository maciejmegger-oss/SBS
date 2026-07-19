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
  instagramLink?: string;
  facebookLink?: string;
  kadraWojewodzka?: boolean;
  reprezentacja?: boolean;
  powolania?: number;
  opisKoncowy?: string;
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

export interface Settings {
  scouts: string[];
  sponsors?: Sponsor[];
  startLocation?: string;
  [key: string]: unknown;
}

export interface Database {
  players: Player[];
  clubs: Club[];
  observations: Observation[];
  reports: Report[];
  talents: Talent[];
  contacts: Contact[];
  clubCrests: ClubCrestMap;
  settings: Settings | null;
}
