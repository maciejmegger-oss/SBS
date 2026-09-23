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
// ADRES WPISANY NA TELEFONIE.
//
// iOS dokleja kropkę na końcu (podwójna spacja zamienia się w kropkę, autokorekta robi to samo),
// a klawiatura potrafi zostawić wielką literę na początku. Adres „maciejmegger@gmail.com." to
// z punktu widzenia bazy inny adres niż ten zapisany — logowanie kończyło się komunikatem
// „Nieprawidłowy e-mail lub hasło", choć hasło było dobre i wpisujący nie miał jak tego zobaczyć.
//
// Obcinamy więc kropki i spacje z obu końców oraz sprowadzamy do małych liter. Nie jest to
// zgadywanie: adres e-mail nie może kończyć się kropką, a wielkość liter w nim nie ma znaczenia.
export function normalizujEmail(email: string): string {
  return String(email || "").trim().replace(/^[.\s]+|[.\s]+$/g, "").toLowerCase();
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.auth.signInWithPassword({ email: normalizujEmail(email), password });
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
  const { error } = await sb.auth.resetPasswordForEmail(normalizujEmail(email), {
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

// TRZY ROLE, NIE DWIE.
//   admin  — właściciel systemu: wszystko, łącznie z kasowaniem i ustawieniami.
//   scout  — pracownia: dopisuje i poprawia, nie kasuje, nie rusza kartoteki menedżerów.
//   klient — kupuje dostęp do wybranych rozgrywek. Widzi tylko je, kartoteki nie zmienia,
//            ale prowadzi własne obserwacje, raporty i oceny. Patrz `pakiety` niżej.
export type RolaKonta = "admin" | "scout" | "klient";

export interface Konto {
  userId: string;
  email: string;
  imieNazwisko: string;
  klub: string;
  rolaWKlubie: string;
  telefon: string;
  rola: RolaKonta;
  // O który pakiet zgłaszający poprosił na stronie. Nie mylić z `pakiety` — tam stoją pakiety
  // NADANE przez administratora, czyli to, za co klient faktycznie zapłacił.
  pakietZadany: string;
  // Wykupione rozgrywki, np. ["Ekstraklasa", "I liga"]. Wpis "Premium" oznacza wszystkie ligi.
  // Znaczenie ma wyłącznie przy roli "klient" — admin i skaut widzą całość niezależnie od tego pola.
  pakiety: string[];
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
    rola: r.rola === "admin" ? "admin" : r.rola === "klient" ? "klient" : "scout",
    // Baza sprzed migracji z 22.09 nie ma tej kolumny — pusta lista znaczy „żadnych pakietów",
    // co dla admina i skauta jest bez znaczenia, a nowego klienta i tak trzeba dopiero wyposażyć.
    pakiety: Array.isArray(r.pakiety) ? r.pakiety.filter(Boolean).map(String) : [],
    pakietZadany: r.pakiet_zadany || "",
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
  // Który pakiet zgłaszający kliknął na stronie. Bez tego zgłoszenia przychodzą bez informacji,
  // które rozgrywki kogo interesują — a to jedyne pytanie, na które sekcja pakietów odpowiada.
  // Puste, gdy ktoś wszedł wprost do formularza, z pominięciem pakietów.
  pakiet?: string;
}

// Zgłoszenie po dostęp ze strony publicznej. Zakłada konto w Supabase Auth i przekazuje dane
// zgłaszającego w metadanych — wyzwalacz w bazie przepisuje je do tabeli sbs_konta ze stanem
// „oczekuje". Hasło ustala sam zgłaszający i nie przechodzi przez żadną naszą tabelę.
export async function zglosDostep(w: WniosekODostep): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.auth.signUp({
    email: normalizujEmail(w.email),
    password: w.haslo,
    options: {
      data: {
        imie_nazwisko: w.imieNazwisko.trim(),
        klub: w.klub.trim(),
        rola_w_klubie: w.rolaWKlubie.trim(),
        telefon: w.telefon.trim(),
        pakiet: (w.pakiet || "").trim(),
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
  // WYCZERPANY LIMIT WYSYŁKI MAILI.
  //
  // Zgłoszenie odbija się od bazy, zanim cokolwiek zapisze — konto NIE powstaje. Surowy komunikat
  // brzmiał „email rate limit exceeded": po angielsku, bez wskazania winnego i bez podpowiedzi,
  // co robić. Zgłaszający czytał to jako „ten formularz nie działa" i odchodził.
  //
  // Przyczyna nie leży po stronie zgłaszającego i nie zniknie przez ponowne kliknięcie, dlatego
  // komunikat podaje drogę obejścia: zwykłą pocztę na adres, który odbiera człowiek.
  if (m.includes("rate limit") || m.includes("too many requests") || m.includes("over_email_send_rate")) {
    return {
      ok: false,
      error:
        "Chwilowo nie możemy wysłać wiadomości potwierdzającej — system pocztowy przyjął dziś " +
        "komplet zgłoszeń. To usterka po naszej stronie, nie po Twojej. Spróbuj za godzinę albo " +
        "napisz na kontakt@scoutbasesystem.com, a założymy konto ręcznie.",
    };
  }
  // Brak połączenia wygląda w przeglądarce jak „Failed to fetch" — komunikat bez treści dla nikogo,
  // kto nie pisze programów.
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) {
    return {
      ok: false,
      error:
        "Nie udało się połączyć z systemem. Sprawdź internet i spróbuj ponownie, a jeśli to nie " +
        "pomoże — napisz na kontakt@scoutbasesystem.com.",
    };
  }
  return {
    ok: false,
    error: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie, a jeśli błąd wraca — napisz na " +
      "kontakt@scoutbasesystem.com. (Szczegóły: " + error.message + ")",
  };
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

export async function ustawRoleKonta(userId: string, rola: RolaKonta): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.from("sbs_konta").update({ rola }).eq("user_id", userId);
  if (error) return { ok: false, error: "Nie udało się zmienić roli: " + error.message };
  return { ok: true };
}

// Pakiety, czyli wykupione rozgrywki. Zapisuje wyłącznie administrator — reguła dostępu w bazie
// (migration_2026-09-22_klient_i_pakiety.sql) odrzuci ten zapis każdemu innemu, więc gdyby ktoś
// wywołał tę funkcję z konsoli przeglądarki, nie zmieni sobie niczego.
export async function ustawPakietyKonta(userId: string, pakiety: string[]): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.from("sbs_konta").update({ pakiety }).eq("user_id", userId);
  if (error) {
    // Najczęstsza przyczyna przy pierwszym uruchomieniu: migracja nie została jeszcze puszczona.
    if ((error.message || "").includes("pakiety")) {
      return { ok: false, error: "Baza nie ma jeszcze kolumny „pakiety”. Uruchom w Supabase skrypt supabase/migration_2026-09-22_klient_i_pakiety.sql." };
    }
    return { ok: false, error: "Nie udało się zapisać pakietów: " + error.message };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// DZIENNIK ZDARZEŃ NA KONTACH
// ---------------------------------------------------------------------------
//
// Ślad po tym, co działo się z kontami: kto komu przyznał dostęp, kto zmienił rolę, komu doszedł
// pakiet. Zmianę hasła zapisuje sama baza (wyzwalacz z migration_2026-09-23), więc tutaj jej nie ma.
//
// CELOWO NIE PRZERYWAMY PRACY, gdy zapis do dziennika się nie uda. Dziennik jest ważny, ale nie
// ważniejszy od operacji, którą opisuje: gdyby nieudany wpis cofał przyznanie dostępu, awaria
// jednej tabeli blokowałaby cały panel administratora. Błąd ląduje w konsoli przeglądarki.

export interface ZdarzenieKonta {
  id: number;
  konto: string;
  email: string;
  ktoEmail: string;
  rodzaj: "haslo" | "dostep" | "rola" | "pakiety" | string;
  opis: string;
  utworzoneAt: string;
}

export async function zapiszZdarzenie(
  konto: { userId: string; email: string },
  rodzaj: string,
  opis: string,
): Promise<void> {
  try {
    const { data: sesja } = await sb.auth.getSession();
    const ja = sesja.session?.user;
    if (!ja) return;
    await sb.from("sbs_zdarzenia_konta").insert({
      konto: konto.userId,
      email: konto.email,
      kto: ja.id,
      kto_email: ja.email,
      rodzaj,
      opis,
    });
  } catch (e) {
    console.warn("Nie udało się zapisać zdarzenia w dzienniku:", e);
  }
}

// Ostatnie zdarzenia do panelu administratora. Reguły dostępu w bazie i tak nie oddadzą tej tabeli
// nikomu poza administratorem — brak tabeli (migracja nieuruchomiona) traktujemy jak pustą listę,
// żeby zakładka „Dostęp" działała także przed wdrożeniem.
export async function listaZdarzen(limit = 60): Promise<ZdarzenieKonta[]> {
  const { data, error } = await sb
    .from("sbs_zdarzenia_konta")
    .select("*")
    .order("utworzone_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []).map((r: any) => ({
    id: r.id,
    konto: r.konto || "",
    email: r.email || "",
    ktoEmail: r.kto_email || "",
    rodzaj: r.rodzaj || "",
    opis: r.opis || "",
    utworzoneAt: r.utworzone_at || "",
  }));
}
