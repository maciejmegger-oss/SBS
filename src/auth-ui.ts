// Bramka logowania: strona publiczna, formularz logowania, ustawianie hasła.
//
// Panel z danymi jest ukryty (klasa `sbs-locked` na <body>) do chwili, w której
// mamy potwierdzoną sesję i wczytany profil. To zabezpieczenie interfejsu, nie
// bezpieczeństwa — właściwą barierą są reguły dostępu w bazie
// (supabase/rls_authenticated.sql). Ukrycie panelu bez nich chroni tylko przed
// zajrzeniem, nie przed pobraniem danych.

import "./auth.css";
import {
  signIn, signOut, sendPasswordReset, updatePassword,
  loadProfile, getSession, logEvent,
  linkEntryType, linkEntryError, clearAuthHash,
} from "./data/auth";
import type { Profile } from "./data/session";

type Mode = "login" | "reset-request" | "set-password";

const root = () => document.getElementById("auth-root") as HTMLElement;
const landing = () => document.getElementById("landing") as HTMLElement;

let resolveLogin: ((p: Profile) => void) | null = null;

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function showLanding(show: boolean) {
  landing().classList.toggle("show", show);
}

function closeAuth() {
  root().classList.remove("show");
  root().innerHTML = "";
}

/** Wpuszcza do panelu: chowa stronę publiczną i ekran logowania. */
function unlockApp(profile: Profile) {
  closeAuth();
  showLanding(false);
  document.body.classList.remove("sbs-locked");
  resolveLogin?.(profile);
  resolveLogin = null;
}

// ---------------------------------------------------------------------------
// Ekrany
// ---------------------------------------------------------------------------

function renderAuth(mode: Mode, message?: { text: string; kind: "error" | "ok" | "info" }) {
  const el = root();
  el.classList.add("show");

  const msg = message
    ? `<div class="auth-msg auth-msg-${message.kind}">${esc(message.text)}</div>`
    : "";

  if (mode === "login") {
    el.innerHTML = `
      <div class="auth-card">
        <h3>Logowanie</h3>
        <p class="auth-sub">Dostęp do systemu mają wyłącznie osoby zaproszone przez administratora.</p>
        ${msg}
        <form id="auth-form" novalidate>
          <div class="auth-field">
            <label for="auth-email">Adres e-mail</label>
            <input id="auth-email" type="email" autocomplete="username" required>
          </div>
          <div class="auth-field">
            <label for="auth-password">Hasło</label>
            <input id="auth-password" type="password" autocomplete="current-password" required>
          </div>
          <button type="submit" class="sbs-btn sbs-btn-primary sbs-btn-block" id="auth-submit">
            Zaloguj się
          </button>
        </form>
        <div class="auth-links">
          <button class="auth-link" data-go="reset-request">Nie pamiętam hasła</button>
          <button class="auth-link" data-close>Wróć na stronę główną</button>
        </div>
      </div>`;
  } else if (mode === "reset-request") {
    el.innerHTML = `
      <div class="auth-card">
        <h3>Reset hasła</h3>
        <p class="auth-sub">Wyślemy link do ustawienia nowego hasła. Jeśli konto o tym adresie
          nie istnieje, wiadomość nie dotrze — to celowe.</p>
        ${msg}
        <form id="auth-form" novalidate>
          <div class="auth-field">
            <label for="auth-email">Adres e-mail</label>
            <input id="auth-email" type="email" autocomplete="username" required>
          </div>
          <button type="submit" class="sbs-btn sbs-btn-primary sbs-btn-block" id="auth-submit">
            Wyślij link
          </button>
        </form>
        <div class="auth-links">
          <button class="auth-link" data-go="login">Wróć do logowania</button>
        </div>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="auth-card">
        <h3>Ustaw hasło</h3>
        <p class="auth-sub">To pierwsze logowanie na tym koncie. Ustal hasło, którym będziesz
          się posługiwać — minimum 8 znaków.</p>
        ${msg}
        <form id="auth-form" novalidate>
          <div class="auth-field">
            <label for="auth-password">Nowe hasło</label>
            <input id="auth-password" type="password" autocomplete="new-password" required>
          </div>
          <div class="auth-field">
            <label for="auth-password2">Powtórz hasło</label>
            <input id="auth-password2" type="password" autocomplete="new-password" required>
          </div>
          <button type="submit" class="sbs-btn sbs-btn-primary sbs-btn-block" id="auth-submit">
            Zapisz i wejdź do systemu
          </button>
        </form>
        <p class="auth-hint">Hasła nie widzi ani administrator, ani nikt inny — system
          przechowuje wyłącznie jego zaszyfrowany skrót.</p>
      </div>`;
  }

  el.querySelectorAll<HTMLElement>("[data-go]").forEach((b) => {
    b.onclick = () => renderAuth(b.dataset.go as Mode);
  });
  const closeBtn = el.querySelector<HTMLElement>("[data-close]");
  if (closeBtn) closeBtn.onclick = () => { closeAuth(); showLanding(true); };

  const form = el.querySelector("#auth-form") as HTMLFormElement;
  form.onsubmit = (e) => { e.preventDefault(); handleSubmit(mode); };

  (el.querySelector("input") as HTMLInputElement)?.focus();
}

async function handleSubmit(mode: Mode) {
  const el = root();
  const submit = el.querySelector("#auth-submit") as HTMLButtonElement;
  const label = submit.textContent;
  submit.disabled = true;
  submit.textContent = "Chwileczkę…";

  const email = (el.querySelector("#auth-email") as HTMLInputElement)?.value ?? "";
  const pass = (el.querySelector("#auth-password") as HTMLInputElement)?.value ?? "";
  const pass2 = (el.querySelector("#auth-password2") as HTMLInputElement)?.value ?? "";

  try {
    if (mode === "login") {
      if (!email || !pass) throw new Error("Podaj adres e-mail i hasło.");
      await signIn(email, pass);
      const profile = await loadProfile();
      if (!profile) throw new Error("Nie udało się wczytać profilu.");
      logEvent("login", profile);
      unlockApp(profile);
      return;
    }

    if (mode === "reset-request") {
      if (!email) throw new Error("Podaj adres e-mail.");
      await sendPasswordReset(email);
      renderAuth("login", {
        kind: "ok",
        text: "Jeśli konto o tym adresie istnieje, link do ustawienia hasła jest już w drodze. Sprawdź też folder ze spamem.",
      });
      return;
    }

    // set-password
    if (pass.length < 8) throw new Error("Hasło musi mieć co najmniej 8 znaków.");
    if (pass !== pass2) throw new Error("Podane hasła nie są identyczne.");
    await updatePassword(pass);
    const profile = await loadProfile();
    if (!profile) throw new Error("Nie udało się wczytać profilu.");
    logEvent("password-set", profile);
    unlockApp(profile);
  } catch (e) {
    submit.disabled = false;
    submit.textContent = label;
    renderAuth(mode, { kind: "error", text: (e as Error).message });
  }
}

// ---------------------------------------------------------------------------
// Start aplikacji
// ---------------------------------------------------------------------------

/**
 * Wstrzymuje uruchomienie aplikacji do chwili zalogowania.
 * Zwraca profil zalogowanego użytkownika — main.ts dopiero wtedy wczytuje dane.
 */
export function requireLogin(): Promise<Profile> {
  return new Promise((resolve) => {
    resolveLogin = resolve;
    void start();
  });
}

async function start() {
  document.body.classList.add("sbs-locked");

  // Przycisk „Zaloguj się" na stronie publicznej.
  document.querySelectorAll<HTMLElement>("[data-auth-open]").forEach((b) => {
    b.onclick = () => { showLanding(false); renderAuth("login"); };
  });

  // Link z e-maila był nieprawidłowy albo wygasł.
  const linkErr = linkEntryError();
  if (linkErr) {
    clearAuthHash();
    renderAuth("login", {
      kind: "error",
      text: "Link z wiadomości jest nieaktualny lub został już użyty (" + linkErr +
            "). Poproś administratora o ponowne zaproszenie albo zresetuj hasło.",
    });
    return;
  }

  let session;
  try {
    session = await getSession();
  } catch (e) {
    renderAuth("login", { kind: "error", text: (e as Error).message });
    return;
  }

  // Powrót z zaproszenia lub resetu hasła — sesja już jest, ale hasła jeszcze nie ma.
  const entry = linkEntryType();
  if (session && (entry === "invite" || entry === "recovery")) {
    clearAuthHash();
    renderAuth("set-password");
    return;
  }
  clearAuthHash();

  // Sesja z poprzedniej wizyty — wchodzimy bez pytania o hasło.
  if (session) {
    try {
      const profile = await loadProfile();
      if (profile) { unlockApp(profile); return; }
    } catch (e) {
      // Konto zablokowane albo brak profilu — pokazujemy powód i formularz.
      renderAuth("login", { kind: "error", text: (e as Error).message });
      return;
    }
  }

  // Nikt nie jest zalogowany — strona publiczna.
  showLanding(true);
}

/** Wylogowanie: czyści sesję i wraca na stronę publiczną. */
export async function performLogout(): Promise<void> {
  try {
    await signOut();
  } finally {
    // Przeładowanie strony jest tu celowe: czyści z pamięci przeglądarki
    // wszystkie wczytane dane (DB.players i resztę). Bez tego zawartość bazy
    // zostałaby w pamięci karty po wylogowaniu.
    window.location.reload();
  }
}
