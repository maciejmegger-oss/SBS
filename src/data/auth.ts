// Logowanie do systemu — oparte na Supabase Auth, nie na własnej obsłudze haseł.
//
// Dlaczego nie własna implementacja: hasła muszą być składowane jako sól + skrót (bcrypt/argon2),
// tokeny resetu muszą wygasać i być jednorazowe, sesje muszą dać się unieważnić. Supabase ma to
// zrobione i przetestowane. Samodzielne pisanie tej warstwy to najczęstsze źródło wycieków haseł.
//
// UWAGA na zakres: ten plik NIE przechowuje ani nie loguje haseł. Hasło wpisane w formularzu idzie
// prosto do Supabase i nigdzie po drodze nie jest zapisywane — ani w pamięci aplikacji, ani w bazie.

import { sb } from "./storage";

export interface SessionUser {
  id: string;
  email: string;
}

// Zwraca zalogowanego użytkownika albo null. Wołane przy starcie, żeby zdecydować,
// czy pokazać ekran logowania, czy od razu aplikację.
export async function currentUser(): Promise<SessionUser | null> {
  const { data, error } = await sb.auth.getSession();
  if (error || !data.session?.user) return null;
  const u = data.session.user;
  return { id: u.id, email: u.email || "" };
}

// Logowanie adresem e-mail i hasłem. Komunikaty tłumaczymy na polski, ale świadomie NIE zdradzamy,
// czy dany adres istnieje w bazie — inaczej ekran logowania służyłby do sprawdzania, kto ma konto.
export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return { ok: true };
  const m = (error.message || "").toLowerCase();
  if (m.includes("invalid login credentials")) {
    return { ok: false, error: "Nieprawidłowy e-mail lub hasło." };
  }
  if (m.includes("email not confirmed")) {
    return { ok: false, error: "Konto nie zostało jeszcze potwierdzone — sprawdź skrzynkę e-mail." };
  }
  // BAZA NIE ODPOWIEDZIAŁA W OGÓLE.
  //
  // To coś innego niż złe hasło: przy złym haśle serwer odpowiada „invalid login credentials",
  // a tutaj przeglądarka nie dostała żadnej odpowiedzi. Najczęstsza przyczyna to uśpiony projekt
  // Supabase — darmowy plan usypia bazę po kilku dniach bez ruchu, więc wraca się do tego
  // po każdym dłuższym urlopie. Angielskie „NetworkError when attempting to fetch resource"
  // nie mówi o tym nic; komunikat musi prowadzić do rozwiązania.
  if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch") || m.includes("load failed")) {
    return {
      ok: false,
      error: "Baza danych nie odpowiada — to nie jest problem z hasłem.\n\n" +
        "Najczęstsza przyczyna: projekt Supabase został UŚPIONY po kilku dniach bez logowania " +
        "(tak działa darmowy plan). Dane są bezpieczne — trzeba tylko obudzić bazę:\n\n" +
        "1. Wejdź na supabase.com i zaloguj się.\n" +
        "2. Otwórz projekt Scout Base System — przy nazwie będzie „Paused”.\n" +
        "3. Kliknij „Restore project” i poczekaj 2-5 minut, aż status będzie „Active”.\n" +
        "4. Odśwież tę stronę i zaloguj się ponownie.\n\n" +
        "Jeśli projekt jest aktywny, sprawdź połączenie z internetem albo wyłącz blokadę reklam dla tej strony.",
    };
  }
  return { ok: false, error: "Nie udało się zalogować: " + error.message };
}

export async function signOut(): Promise<void> {
  await sb.auth.signOut();
}

// Wysyłka linku do ustawienia nowego hasła. Zawsze zgłaszamy powodzenie, nawet gdy adresu nie ma
// w bazie — po odpowiedzi nie można więc ustalić, które adresy są zarejestrowane.
export async function requestPasswordReset(email: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error && !/user not found/i.test(error.message)) {
    return { ok: false, error: "Nie udało się wysłać wiadomości: " + error.message };
  }
  return { ok: true };
}

// Ustawienie nowego hasła po wejściu z linku resetującego. Supabase tworzy wtedy tymczasową sesję,
// dzięki której ta operacja jest dozwolona.
export async function setNewPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { ok: false, error: "Nie udało się zmienić hasła: " + error.message };
  return { ok: true };
}

// Czy adres strony pochodzi z linku resetującego hasło? Supabase dokłada tam znacznik typu recovery.
export function isPasswordRecoveryLink(): boolean {
  const hash = window.location.hash || "";
  return /type=recovery/.test(hash) || /access_token=/.test(hash);
}

// Token bieżącej sesji — do wywołań własnych funkcji serwerowych (/api/...).
//
// Po zamknięciu bazy serwer nie ma jak sięgnąć po dane „od siebie": klucz publiczny nie widzi nic,
// a klucza serwisowego nie chcemy wymagać do zwykłej pracy. Rozwiązanie jest prostsze i
// bezpieczniejsze: żądanie niesie token zalogowanego, a baza traktuje je tak samo jak zapytanie
// z przeglądarki — czyli sprawdza, czy to konto ma prawo do tych danych.
export async function tokenSesji(): Promise<string> {
  const { data } = await sb.auth.getSession();
  return data.session?.access_token || "";
}

// Powiadomienie o zmianie stanu logowania (np. wygaśnięcie sesji w innej karcie).
export function onAuthChange(cb: (user: SessionUser | null) => void): void {
  sb.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ? { id: session.user.id, email: session.user.email || "" } : null);
  });
}

// ---------------------------------------------------------------------------
// KONTA I ZGODA ADMINISTRATORA
// ---------------------------------------------------------------------------
//
// Samo założenie konta NIE otwiera systemu. Każde nowe konto powstaje ze stanem „oczekuje" i
// dopiero administrator przestawia je na „zatwierdzone". Rozstrzyga o tym baza, nie ekran:
// reguły dostępu (supabase/migration_2026-08-11_konta_i_zgoda.sql) wpuszczają do danych wyłącznie
// konta zatwierdzone. Ekran poniżej jest tylko uprzejmym komunikatem — gdyby ktoś go ominął,
// baza i tak nie odda ani jednego wiersza.

export type StatusKonta = "oczekuje" | "zatwierdzone" | "odrzucone";

export interface Konto {
  userId: string;
  email: string;
  imieNazwisko: string;
  klub: string;
  rolaWKlubie: string;
  telefon: string;
  rola: "admin" | "scout";
  status: StatusKonta;
  utworzoneAt: string;
  zdecydowaneAt: string;
}

function mapujKonto(r: any): Konto {
  return {
    userId: r.user_id,
    email: r.email || "",
    imieNazwisko: r.imie_nazwisko || "",
    klub: r.klub || "",
    rolaWKlubie: r.rola_w_klubie || "",
    telefon: r.telefon || "",
    rola: r.rola === "admin" ? "admin" : "scout",
    status: (r.status as StatusKonta) || "oczekuje",
    utworzoneAt: r.utworzone_at || "",
    zdecydowaneAt: r.zdecydowane_at || "",
  };
}

export interface WniosekODostep {
  imieNazwisko: string;
  klub: string;
  rolaWKlubie: string;
  telefon: string;
  email: string;
  haslo: string;
}

// Zgłoszenie po dostęp ze strony publicznej. Zakłada konto w Supabase Auth i przekazuje dane
// zgłaszającego w metadanych — wyzwalacz w bazie przepisuje je do tabeli sbs_konta ze stanem
// „oczekuje". Hasło ustala sam zgłaszający i nie przechodzi przez żadną naszą tabelę.
export async function zglosDostep(w: WniosekODostep): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.auth.signUp({
    email: w.email.trim(),
    password: w.haslo,
    options: {
      data: {
        imie_nazwisko: w.imieNazwisko.trim(),
        klub: w.klub.trim(),
        rola_w_klubie: w.rolaWKlubie.trim(),
        telefon: w.telefon.trim(),
      },
      emailRedirectTo: window.location.origin + "/app",
    },
  });
  if (!error) return { ok: true };
  const m = (error.message || "").toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
    // Świadomie neutralnie: odpowiedź nie ma służyć do sprawdzania, kto ma już konto.
    return { ok: true };
  }
  if (m.includes("password")) {
    return { ok: false, error: "Hasło jest za słabe — użyj co najmniej 8 znaków." };
  }
  if (m.includes("email") && m.includes("invalid")) {
    return { ok: false, error: "Podany adres e-mail wygląda na nieprawidłowy." };
  }
  return { ok: false, error: "Nie udało się wysłać zgłoszenia: " + error.message };
}

// Konto zalogowanego użytkownika — stan zgody i rola. Zwraca null, gdy nie ma sesji albo gdy
// wiersza jeszcze nie ma (konto założone przed wdrożeniem tabeli).
export async function mojeKonto(): Promise<Konto | null> {
  const { data: sesja } = await sb.auth.getSession();
  const uid = sesja.session?.user?.id;
  if (!uid) return null;
  const { data, error } = await sb.from("sbs_konta").select("*").eq("user_id", uid).maybeSingle();
  if (error || !data) return null;
  return mapujKonto(data);
}

// Lista kont do panelu administratora. Reguły dostępu w bazie i tak oddadzą tu wyłącznie
// własny wiersz komuś, kto administratorem nie jest — panel nie jest więc jedynym zabezpieczeniem.
export async function listaKont(): Promise<Konto[]> {
  const { data, error } = await sb.from("sbs_konta").select("*").order("utworzone_at", { ascending: false });
  // Błąd zgłaszamy dalej, zamiast oddać pustą listę: „nie udało się pobrać" i „nikt się nie zgłosił"
  // wyglądają wtedy tak samo, a to dwie zupełnie różne wiadomości dla administratora.
  if (error) throw new Error(error.message);
  return (data || []).map(mapujKonto);
}

export async function ustawStatusKonta(userId: string, status: StatusKonta): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb
    .from("sbs_konta")
    .update({ status, zdecydowane_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Nie udało się zapisać decyzji: " + error.message };
  return { ok: true };
}

export async function ustawRoleKonta(userId: string, rola: "admin" | "scout"): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.from("sbs_konta").update({ rola }).eq("user_id", userId);
  if (error) return { ok: false, error: "Nie udało się zmienić roli: " + error.message };
  return { ok: true };
}
