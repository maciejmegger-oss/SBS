// Logowanie, profil zalogowanego użytkownika i operacje administratora.
//
// Konta i hasła obsługuje Supabase Auth — aplikacja nigdy nie widzi hasła ani
// nie przechowuje go u siebie. My zajmujemy się tylko tym, co jest nasze:
// przynależnością do organizacji, rolą i statusem konta (tabela sbs_users).

import { sb, siteUrl } from "./supabase";
import { setProfile, type Profile, type Role } from "./session";

// ---------------------------------------------------------------------------
// Powrót z linku w e-mailu
// ---------------------------------------------------------------------------
// Kliknięcie „ustaw hasło" w zaproszeniu albo w mailu resetującym wraca na
// stronę z tokenem w adresie (#access_token=...&type=invite). Supabase odczyta
// ten token i od razu wyczyści adres, więc typ zdarzenia musimy zapamiętać
// TERAZ, przy pierwszym wykonaniu tego pliku — inaczej nie odróżnimy „ktoś
// właśnie przyjął zaproszenie i musi ustawić hasło" od zwykłego wejścia.
const initialHash = window.location.hash || "";
const hashParams = new URLSearchParams(initialHash.replace(/^#/, ""));
const entryType = hashParams.get("type"); // 'invite' | 'recovery' | null
const entryError = hashParams.get("error_description");

/** 'invite' / 'recovery' jeśli użytkownik wszedł z linku w e-mailu. */
export const linkEntryType = (): string | null => entryType;

/** Komunikat błędu z linku (np. link wygasł). */
export const linkEntryError = (): string | null => entryError;

/** Czyści token z paska adresu, żeby nie został w historii przeglądarki. */
export function clearAuthHash(): void {
  if (window.location.hash.includes("access_token") || window.location.hash.includes("error")) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

// ---------------------------------------------------------------------------
// Sesja i logowanie
// ---------------------------------------------------------------------------

export async function getSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    // Supabase zwraca komunikaty po angielsku — tłumaczymy te, które użytkownik
    // realnie zobaczy. Reszta idzie w oryginale, żeby dało się ją wyszukać.
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid login credentials")) {
      throw new Error("Nieprawidłowy e-mail lub hasło.");
    }
    if (msg.includes("email not confirmed")) {
      throw new Error("Konto nie zostało jeszcze potwierdzone — sprawdź skrzynkę e-mail.");
    }
    throw new Error(error.message);
  }
}

export async function signOut(): Promise<void> {
  await sb.auth.signOut();
  setProfile(null);
}

/** Wysyła link do ustawienia nowego hasła (użytkownik zapomniał hasła). */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: siteUrl(),
  });
  if (error) throw new Error(error.message);
}

/** Ustawia hasło zalogowanego użytkownika (po zaproszeniu lub resecie). */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await sb.auth.updateUser({ password });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("should be at least") || msg.includes("password")) {
      throw new Error("Hasło jest za słabe — użyj co najmniej 8 znaków.");
    }
    throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------

/**
 * Wczytuje profil zalogowanego użytkownika (organizacja, rola, status).
 * Zwraca null, gdy nikt nie jest zalogowany albo konto zostało zablokowane.
 */
export async function loadProfile(): Promise<Profile | null> {
  const session = await getSession();
  if (!session) {
    setProfile(null);
    return null;
  }

  const { data, error } = await sb
    .from("sbs_users")
    .select("id, org_id, email, full_name, role, active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) throw new Error("Nie udało się wczytać profilu użytkownika: " + error.message);

  if (!data) {
    // Konto istnieje w Supabase, ale nie ma profilu — zdarza się tylko wtedy, gdy
    // migracja z wyzwalaczem nie została uruchomiona. Lepiej powiedzieć to wprost,
    // niż wpuścić kogoś do systemu bez organizacji i roli.
    throw new Error(
      "Twoje konto nie ma przypisanego profilu. Skontaktuj się z administratorem " +
        "(wymagane uruchomienie migracji supabase/migration_2026-07-28_auth.sql).",
    );
  }

  const profile: Profile = {
    id: data.id,
    orgId: data.org_id,
    email: data.email,
    fullName: data.full_name,
    role: data.role as Role,
    active: data.active,
  };

  if (!profile.active) {
    await signOut();
    throw new Error("To konto zostało zablokowane. Skontaktuj się z administratorem.");
  }

  setProfile(profile);
  return profile;
}

/** Odnotowuje zdarzenie w rejestrze logowań (wymóg RODO). Nie blokuje pracy. */
export async function logEvent(event: string, profile: Profile): Promise<void> {
  try {
    await sb.from("sbs_login_log").insert({
      user_id: profile.id,
      org_id: profile.orgId,
      email: profile.email,
      event,
    });
    await sb.from("sbs_users").update({ last_seen_at: new Date().toISOString() }).eq("id", profile.id);
  } catch (e) {
    // Rejestr to funkcja poboczna — jego awaria nie może uniemożliwić pracy.
    console.warn("Nie udało się zapisać wpisu w rejestrze logowań:", e);
  }
}

// ---------------------------------------------------------------------------
// Operacje administratora
// ---------------------------------------------------------------------------
// Zakładanie i usuwanie kont wymaga klucza `service_role`, który daje pełny,
// nieograniczony dostęp do bazy. Taki klucz NIE MOŻE trafić do przeglądarki —
// byłby czytelny dla każdego odwiedzającego. Dlatego te operacje wykonuje
// funkcja serwerowa api/admin-users.js, a stąd tylko ją wywołujemy, dołączając
// token zalogowanego użytkownika. To funkcja sprawdza, czy wywołujący jest
// administratorem — przeglądarce nie wolno tu ufać.

async function callAdminApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const session = await getSession();
  if (!session) throw new Error("Sesja wygasła — zaloguj się ponownie.");

  const res = await fetch("/api/admin-users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + session.access_token,
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text);
  } catch {
    // Gdy funkcja serwerowa nie działa, Vercel/Vite oddaje HTML strony zamiast
    // JSON-a. Bez tej gałęzi użytkownik zobaczyłby surowy błąd parsera.
    throw new Error(
      "Funkcja /api/admin-users nie odpowiedziała poprawnie (kod " + res.status + "). " +
        "Najczęstsza przyczyna: brak zmiennej SUPABASE_SERVICE_ROLE_KEY w konfiguracji wdrożenia.",
    );
  }

  if (!res.ok) throw new Error((body.error as string) || "Operacja nie powiodła się.");
  return body as T;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  active: boolean;
  created_at: string;
  last_seen_at: string | null;
  invited: boolean;
}

export const adminListUsers = () =>
  callAdminApi<{ users: AdminUser[] }>("list").then((r) => r.users);

export const adminInviteUser = (email: string, fullName: string, role: Role) =>
  callAdminApi<{ ok: true }>("invite", { email, fullName, role });

export const adminSetRole = (userId: string, role: Role) =>
  callAdminApi<{ ok: true }>("set-role", { userId, role });

export const adminSetActive = (userId: string, active: boolean) =>
  callAdminApi<{ ok: true }>("set-active", { userId, active });

export const adminDeleteUser = (userId: string) =>
  callAdminApi<{ ok: true }>("delete", { userId });

export const adminResendInvite = (email: string) =>
  callAdminApi<{ ok: true }>("resend-invite", { email });
