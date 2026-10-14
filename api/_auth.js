// Sprawdzanie, KTO wywołuje funkcję serwerową — i ile razy dziś już ją wywołał.
//
// PO CO TO JEST
// Endpointy AI (opinia-ai, raport-ai) kosztują pieniądze przy każdym wywołaniu. Wcześniej nie
// pytały o nic: kto znał adres, mógł słać żądania i spalać budżet na Anthropic. Teraz żądanie musi
// nieść token sesji zalogowanego i ZATWIERDZONEGO konta (ten sam, którego aplikacja używa do
// bazy), a każde konto ma dzienny limit.
//
// JAK SPRAWDZAMY KONTO
// Pytamy bazę w imieniu użytkownika o jego własny wiersz w sbs_konta. Reguły dostępu pokazują
// każdemu tylko jego wiersz, więc: odpowiedź z wierszem o statusie „zatwierdzone" = konto jest
// prawdziwe, ważne i wpuszczone przez administratora. Token podrobiony albo wygasły kończy się
// pustą odpowiedzią lub błędem 401. Nie potrzeba do tego klucza serwisowego.

import { BAZA, tokenUzytkownika, MA_KLUCZ_SERWISOWY, KLUCZ_BAZY } from "./_baza.js";

const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

/** Zwraca { userId, rola } dla zatwierdzonego konta albo null. */
export async function zalogowanyZatwierdzony(req) {
  const token = tokenUzytkownika(req);
  if (!token || !BAZA || !ANON) return null;
  try {
    const odp = await fetch(`${BAZA}/rest/v1/sbs_konta?select=user_id,status,rola&limit=1`, {
      headers: { apikey: ANON, Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(8000),
    });
    if (!odp.ok) return null;
    const wiersze = await odp.json().catch(() => null);
    const w = Array.isArray(wiersze) ? wiersze[0] : null;
    if (!w || w.status !== "zatwierdzone") return null;
    return { userId: String(w.user_id), rola: w.rola || "scout" };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DZIENNY LIMIT NA KONTO
// ---------------------------------------------------------------------------
//
// Licznik trzymamy w sbs_kv (klucz ai_limit:<konto>:<dzień>), a gdy zapis się nie uda — w pamięci
// instancji. Pamięć instancji NIE jest szczelna (funkcje serverless mają wiele instancji), dlatego
// prawdziwym bezpiecznikiem budżetu pozostaje limit miesięczny ustawiony w konsoli Anthropic.
// Ten licznik ma chronić przed pomyłką i pojedynczym nadużyciem, nie przed zdeterminowanym atakiem.

const pamiec = new Map();

/**
 * Zalicza jedno wywołanie. Zwraca { ok, uzyte, limit }.
 * `rodzaj` rozdziela liczniki („opinia", „szkic"), `limit` to maksimum na dobę na konto.
 */
export async function zaliczWywolanie(req, konto, rodzaj, limit) {
  const dzien = new Date().toISOString().slice(0, 10);
  const klucz = `ai_limit:${rodzaj}:${konto.userId}:${dzien}`;
  const token = tokenUzytkownika(req);
  const naglowki = MA_KLUCZ_SERWISOWY
    ? { apikey: KLUCZ_BAZY, Authorization: "Bearer " + KLUCZ_BAZY, "Content-Type": "application/json" }
    : { apikey: ANON, Authorization: "Bearer " + token, "Content-Type": "application/json" };

  let uzyte = null;
  try {
    const odp = await fetch(`${BAZA}/rest/v1/sbs_kv?select=value&key=eq.${encodeURIComponent(klucz)}`,
      { headers: naglowki, signal: AbortSignal.timeout(6000) });
    if (odp.ok) {
      const w = await odp.json();
      uzyte = w.length ? parseInt(w[0].value, 10) || 0 : 0;
    }
  } catch { /* spadamy na pamięć instancji */ }

  const zPamieci = pamiec.get(klucz) || 0;
  const biezace = Math.max(uzyte ?? 0, zPamieci);
  if (biezace >= limit) return { ok: false, uzyte: biezace, limit };

  const nowe = biezace + 1;
  pamiec.set(klucz, nowe);
  try {
    await fetch(`${BAZA}/rest/v1/sbs_kv`, {
      method: "POST",
      headers: { ...naglowki, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([{ key: klucz, value: String(nowe) }]),
      signal: AbortSignal.timeout(6000),
    });
  } catch { /* licznik w pamięci wystarczy na ten przebieg */ }
  return { ok: true, uzyte: nowe, limit };
}

/** Limit z zmiennej środowiskowej albo wartość domyślna. */
export const limitZEnv = (nazwa, domyslny) => {
  const n = parseInt(process.env[nazwa] || "", 10);
  return Number.isFinite(n) && n > 0 ? n : domyslny;
};

/** Przycina dane wejściowe do rozsądnego rozmiaru — model nie powinien dostać megabajtów. */
export function rozmiarWBezpiecznychGranicach(dane, maxZnakow) {
  try { return JSON.stringify(dane).length <= maxZnakow; } catch { return false; }
}
