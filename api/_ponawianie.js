// PONAWIANIE ZAPISU DO BAZY PRZY CHWILOWYM BRAKU ODPOWIEDZI.
//
// Przy fali równoległych zapisów (osiem naraz) baza potrafi nie odpowiedzieć na czas: 504
// „Gateway Timeout", 503, 502. To nie jest odmowa — ten sam zapis chwilę później przechodzi.
// Bez powtórki jeden taki zawodnik oznaczał cały klub jako nieudany („zapisano 22 z 23"), a okno
// pisało „baza odrzuciła zapis", choć baza niczego nie odrzuciła.
//
// Ponawiamy WYŁĄCZNIE zapisy, które da się bezpiecznie powtórzyć (PATCH konkretnego wiersza
// nadpisuje te same pola), i WYŁĄCZNIE błędy chwilowe. Odmowa z powodu danych (400), uprawnień
// (401/403) czy brakującej kolumny zostaje błędem od razu — powtarzanie niczego by nie zmieniło.

export const CHWILOWE_STATUSY = new Set([408, 425, 429, 500, 502, 503, 504]);
export const czyChwilowyStatus = (status) => CHWILOWE_STATUSY.has(Number(status));

const PRZERWY_DOMYSLNE = [600, 1800];
const LIMIT_PROBY_MS = 25000;

export async function patchZPonowieniem(url, opcje = {}, { fetch: pobierz = globalThis.fetch, przerwy = PRZERWY_DOMYSLNE, czekaj } = {}) {
  const uspij = czekaj || ((ms) => new Promise((gotowe) => setTimeout(gotowe, ms)));
  let ostatni = null;
  for (let proba = 0; proba <= przerwy.length; proba++) {
    if (proba > 0) await uspij(przerwy[proba - 1]);
    try {
      // Każda próba z własnym limitem — zawieszone połączenie nie może zjeść czasu całej funkcji.
      const r = await pobierz(url, { ...opcje, method: "PATCH", signal: opcje.signal || AbortSignal.timeout(LIMIT_PROBY_MS) });
      if (r.ok) return { ok: true, status: r.status, proby: proba + 1 };
      const tresc = String(await r.text().catch(() => "")).slice(0, 200);
      ostatni = { ok: false, status: r.status, tresc, proby: proba + 1, chwilowy: czyChwilowyStatus(r.status) };
      if (!ostatni.chwilowy) return ostatni;
    } catch (e) {
      // Zerwane połączenie albo przekroczony czas próby — też chwilowe.
      ostatni = { ok: false, status: 0, tresc: String((e && e.message) || e).slice(0, 200), proby: proba + 1, chwilowy: true };
    }
  }
  return ostatni;
}
