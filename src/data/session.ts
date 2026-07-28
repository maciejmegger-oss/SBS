// Mały pojemnik na dane zalogowanego użytkownika, wspólny dla warstwy danych
// (storage.ts) i logowania (auth.ts).
//
// Istnieje po to, żeby storage.ts nie musiał importować auth.ts, a auth.ts —
// storage.ts. Bez tego powstałby cykl importów: storage potrzebuje org_id do
// stemplowania zapisywanych wierszy, a auth potrzebuje storage do wczytania
// danych po zalogowaniu. Ten plik nie importuje niczego, więc cyklu nie ma.

export type Role = "admin" | "scout" | "viewer";

export interface Profile {
  id: string;
  orgId: string;
  email: string;
  fullName: string | null;
  role: Role;
  active: boolean;
}

let profile: Profile | null = null;

export const getProfile = (): Profile | null => profile;
export const setProfile = (p: Profile | null): void => { profile = p; };

/** org_id zalogowanego użytkownika — używany do stemplowania zapisów. */
export const getOrgId = (): string | null => profile?.orgId ?? null;

/** Czy użytkownik może zapisywać. Viewer ma wyłącznie podgląd. */
export const canWrite = (): boolean => profile?.role === "admin" || profile?.role === "scout";

/** Czy użytkownik jest administratorem (zarządzanie kontami, usuwanie danych). */
export const isAdmin = (): boolean => profile?.role === "admin";
