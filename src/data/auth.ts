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

// Powiadomienie o zmianie stanu logowania (np. wygaśnięcie sesji w innej karcie).
export function onAuthChange(cb: (user: SessionUser | null) => void): void {
  sb.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ? { id: session.user.id, email: session.user.email || "" } : null);
  });
}
