// Wspólne, cienkie funkcje dostępu do bazy (PostgREST) dla zadań serwerowych asystenta AI.
// Klucz i adres bierze _baza.js; tu są tylko kształty zapytań, żeby raport dzienny i narzędzia
// agenta (api/agent.js) nie miały własnych, rozjeżdżających się kopii.

import { BAZA, naglowkiBazy } from "./_baza.js";

const LIMIT_CZASU = 20000;

export async function pobierzWszystko(tabela, kolumny, filtr = "") {
  let wiersze = [], od = 0;
  for (;;) {
    const r = await fetch(`${BAZA}/rest/v1/${tabela}?select=${kolumny}${filtr ? "&" + filtr : ""}&limit=1000&offset=${od}`, {
      headers: naglowkiBazy(), signal: AbortSignal.timeout(LIMIT_CZASU),
    });
    if (!r.ok) throw new Error(`${tabela}: ${r.status}`);
    const czesc = await r.json();
    wiersze = wiersze.concat(czesc);
    if (czesc.length < 1000) return wiersze;
    od += 1000;
  }
}

/** Jedno zapytanie GET z gotowym ciągiem zapytania (bez paginacji). */
export async function wybierz(tabela, zapytanie) {
  const r = await fetch(`${BAZA}/rest/v1/${tabela}?${zapytanie}`, { headers: naglowkiBazy(), signal: AbortSignal.timeout(LIMIT_CZASU) });
  if (!r.ok) throw new Error(`${tabela}: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function wstaw(tabela, wiersz) {
  const r = await fetch(`${BAZA}/rest/v1/${tabela}`, {
    method: "POST", headers: { ...naglowkiBazy(), Prefer: "return=representation" },
    body: JSON.stringify(wiersz), signal: AbortSignal.timeout(LIMIT_CZASU),
  });
  if (!r.ok) throw new Error(`zapis ${tabela}: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function zmien(tabela, filtr, zmiany) {
  const r = await fetch(`${BAZA}/rest/v1/${tabela}?${filtr}`, {
    method: "PATCH", headers: { ...naglowkiBazy(), Prefer: "return=representation" },
    body: JSON.stringify(zmiany), signal: AbortSignal.timeout(LIMIT_CZASU),
  });
  if (!r.ok) throw new Error(`zmiana ${tabela}: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function czytajKv(klucz) {
  const w = await wybierz("sbs_kv", `select=value&key=eq.${encodeURIComponent(klucz)}`);
  if (!w.length) return null;
  try { return JSON.parse(w[0].value); } catch { return null; }
}

export async function zapiszKv(klucz, wartosc) {
  const r = await fetch(`${BAZA}/rest/v1/sbs_kv?on_conflict=key`, {
    method: "POST",
    headers: { ...naglowkiBazy(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: klucz, value: JSON.stringify(wartosc), updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(LIMIT_CZASU),
  });
  if (!r.ok) throw new Error(`zapis sbs_kv ${klucz}: ${r.status} ${await r.text()}`);
}
