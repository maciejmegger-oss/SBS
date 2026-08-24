// Protokoły meczów z „Łączy nas piłka" (laczynaspilka.pl).
//
// PO CO TO JEST: w IV lidze 90minut nie prowadzi własnych protokołów — odnośnik przy wyniku
// przenosi na stronę PZPN. Dlatego wszystkie drogi przez 90minut kończyły się tam samo:
// mecz znaleziony, protokół otwarty, a w środku ani jednego zawodnika. Składy IV ligi są na ŁNP
// i to stamtąd trzeba je czytać.
//
// CZEGO STĄD NIE BIERZEMY: bramek i kartek. Rodzaj zdarzenia jest na tej stronie IKONĄ bez tekstu,
// więc po odczytaniu samego tekstu zostają gołe liczby — nie da się odróżnić gola od kartki.
// Minuty gry policzyć się da i to jest tu wartość: kto wyszedł w pierwszym składzie, kto wszedł
// z ławki i w której minucie.

import { protokolZeSkryptow, protokolZJsonow, adresyDanychZeStrony, opiszZawartosc } from "./_lnp-dane.js";

const DOZWOLONE_HOSTY = new Set(["laczynaspilka.pl", "www.laczynaspilka.pl"]);
const DLUGOSC_MECZU = 90;
const CZAS_ZYCIA_CACHE = 10 * 60 * 1000;
const cacheStron = new Map();

export { opiszZawartosc };

// ---------- GDY DANYCH NIE MA W SAMEJ STRONIE ----------
//
// Strona buduje się w przeglądarce i po składy sięga osobnym zapytaniem. Nie zgadujemy, dokąd —
// bierzemy adresy, KTÓRE STRONA SAMA PODAJE w swoim kodzie, i zaglądamy pod nie tym samym
// czytnikiem. Ograniczamy się przy tym do serwisu ŁNP: adres znaleziony w cudzej stronie nie może
// wysłać nas w dowolne miejsce internetu.
const HOSTY_DANYCH = /(^|\.)laczynaspilka\.pl$/i;

function uporzadkujAdresy(adresy, adresStrony) {
  const baza = new URL(adresStrony);
  const idMeczu = (baza.pathname.match(/(\d{3,})/) || [])[1] || "";
  const pelne = [];
  for (const a of adresy) {
    let u;
    try { u = new URL(a, baza.origin); } catch { continue; }
    if (!HOSTY_DANYCH.test(u.hostname)) continue;
    if (/\.(js|css|png|jpe?g|svg|woff2?)$/i.test(u.pathname)) continue;
    pelne.push(u.toString());
  }
  // Najpierw te, które mówią o tym meczu i o składach — reszta tylko gdyby ich zabrakło.
  const waga = (u) => (idMeczu && u.includes(idMeczu) ? 0 : 2)
    + (/(lineup|squad|sklad|skład|player|zawodnik|protok|match|mecz)/i.test(u) ? 0 : 1);
  return [...new Set(pelne)].sort((a, b) => waga(a) - waga(b)).slice(0, 4);
}

// ---------- ADRES DANYCH UKRYTY W KODZIE STRONY ----------
//
// Strona ŁNP jest zbudowana w Angularze: w samym kodzie strony nie ma ani danych, ani nawet adresu,
// spod którego je bierze. Adres siedzi w plikach z kodem (tych z <script src=…>). Czytamy je więc
// tak samo, jak przeglądarka, i wyjmujemy z nich adresy — nie zgadując ani jednego znaku.
//
// Raz znaleziony adres zapamiętujemy na godzinę: pliki kodu ważą megabajty i nie ma powodu
// pobierać ich przy każdym klubie.
const CZAS_ZYCIA_ADRESOW = 60 * 60 * 1000;
const MAKS_ZNAKOW_SKRYPTU = 4 * 1024 * 1024;
const znaleziona = new Map();   // origin -> { kiedy, adresy, sciezki }

export async function zbadajSkryptyStrony(html, adresStrony) {
  let baza;
  try { baza = new URL(adresStrony); } catch { return { adresy: [], sciezki: [], zbadane: [] }; }
  const zPamieci = znaleziona.get(baza.origin);
  if (zPamieci && Date.now() - zPamieci.kiedy < CZAS_ZYCIA_ADRESOW) return zPamieci;

  const pliki = [...String(html || "").matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => { try { return new URL(m[1], baza).toString(); } catch { return ""; } })
    .filter((u) => u && HOSTY_DANYCH.test(new URL(u).hostname) && /\.js(\?|$)/i.test(u));

  const adresy = new Set();
  const sciezki = new Set();
  const zbadane = [];
  // Najpierw „main" — w Angularze to tam siedzą ustawienia środowiska z adresem danych.
  pliki.sort((a, b) => (/main/i.test(b) ? 1 : 0) - (/main/i.test(a) ? 1 : 0));
  for (const plik of pliki.slice(0, 3)) {
    try {
      const odp = await fetch(plik, { signal: AbortSignal.timeout(20000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ScoutBaseSystem/1.0; +https://scoutbasesystem.com)" } });
      if (!odp.ok) { zbadane.push(`${plik}: kod ${odp.status}`); continue; }
      const kod = (await odp.text()).slice(0, MAKS_ZNAKOW_SKRYPTU);
      zbadane.push(`${plik}: ${kod.length} zn.`);
      // Pełne adresy w obrębie serwisu ŁNP.
      for (const m of kod.matchAll(/["'`](https?:\/\/[a-z0-9.-]*laczynaspilka\.pl[^"'`\s]{0,120})["'`]/gi)) {
        adresy.add(m[1]);
      }
      // Kawałki ścieżek, z których strona skleja swoje zapytania („/api/…", „matches/…/lineups").
      for (const m of kod.matchAll(/["'`](\/?(?:api|v\d)\/[a-z0-9/_{}.:$-]{2,90})["'`]/gi)) sciezki.add(m[1]);
      for (const m of kod.matchAll(/["'`]([a-z0-9/_-]{0,40}(?:lineup|squad|sklad|player|zawodnik|protok|match|mecz|team|druzyn)[a-z0-9/_-]{0,40})["'`]/gi)) {
        if (m[1].length > 3) sciezki.add(m[1]);
      }
    } catch (e) { zbadane.push(`${plik}: ${String((e && e.message) || e).slice(0, 80)}`); }
  }
  const wynik = { kiedy: Date.now(), adresy: [...adresy].slice(0, 25), sciezki: [...sciezki].slice(0, 40), zbadane };
  znaleziona.set(baza.origin, wynik);
  return wynik;
}

export async function protokolZDanychStrony(html, adresStrony, nazwaKlubu) {
  let adresy = uporzadkujAdresy(adresyDanychZeStrony(html), adresStrony);
  if (!adresy.length) {
    // W stronie nic nie ma — szukamy w plikach z jej kodem.
    const zKodu = await zbadajSkryptyStrony(html, adresStrony);
    adresy = uporzadkujAdresy(zKodu.adresy, adresStrony);
  }
  if (!adresy.length) return null;
  const odczytane = [];
  for (const adres of adresy) {
    try {
      const odp = await fetch(adres, {
        headers: { "Accept": "application/json", "Accept-Language": "pl-PL,pl;q=0.9",
                   "User-Agent": "Mozilla/5.0 (compatible; ScoutBaseSystem/1.0; +https://scoutbasesystem.com)" },
        signal: AbortSignal.timeout(12000),
      });
      if (!odp.ok) continue;
      const tresc = await odp.text();
      const dane = (() => { try { return JSON.parse(tresc); } catch { return null; } })();
      if (dane && typeof dane === "object") odczytane.push(dane);
    } catch { /* jeden nieudany adres nie przerywa reszty */ }
  }
  if (!odczytane.length) return null;
  const prot = protokolZJsonow(odczytane, nazwaKlubu);
  return prot ? { ...prot, zrodlo: "dane spod adresu podanego przez stronę" } : null;
}

export function czyLnp(adres) {
  try { return DOZWOLONE_HOSTY.has(new URL(String(adres)).hostname); }
  catch { return false; }
}

const uspij = (ms) => new Promise((r) => setTimeout(r, ms));

export async function pobierzLnp(rawUrl) {
  let url;
  try { url = new URL(String(rawUrl).trim()); }
  catch { throw new Error("Niepoprawny adres ŁNP."); }
  if (!DOZWOLONE_HOSTY.has(url.hostname)) throw new Error("To nie jest adres laczynaspilka.pl.");

  const klucz = url.toString();
  const zPamieci = cacheStron.get(klucz);
  if (zPamieci && Date.now() - zPamieci.kiedy < CZAS_ZYCIA_CACHE) return zPamieci.html;

  let ostatniBlad;
  for (let proba = 0; proba < 2; proba++) {
    if (proba) await uspij(1200);
    try {
      const odp = await fetch(klucz, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ScoutBaseSystem/1.0; +https://scoutbasesystem.com)",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "pl-PL,pl;q=0.9",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!odp.ok) throw new Error(`ŁNP odpowiedziało kodem ${odp.status}.`);
      const html = await odp.text();      // ŁNP serwuje UTF-8
      if (cacheStron.size >= 200) cacheStron.delete(cacheStron.keys().next().value);
      cacheStron.set(klucz, { kiedy: Date.now(), html });
      return html;
    } catch (e) { ostatniBlad = e; }
  }
  throw ostatniBlad instanceof Error ? ostatniBlad : new Error(String(ostatniBlad));
}

const encje = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", oacute: "ó" };

// Strona na tekst, linijka po linijce — dokładnie tak, jak wygląda po skopiowaniu jej w przeglądarce.
// Parsery protokołu w aplikacji czytają właśnie taki układ, więc jeden format obsługuje obie drogi:
// wklejenie ręczne i odczyt z serwera.
export function htmlNaLinie(html) {
  const tekst = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(td|th|tr|div|p|li|h1|h2|h3|h4|h5|span|a|section|article)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => encje[n.toLowerCase()] ?? m);
  return tekst.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

const norm = (s) => String(s || "").toLowerCase()
  .replace(/[łøđ]/g, (c) => ({ ł: "l", ø: "o", đ: "d" }[c]))
  .normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");

// Nazwy obu drużyn — stoją bezpośrednio nad nagłówkiem „Skład wyjściowy".
export function druzynyZProtokoluLnp(linie) {
  const out = [];
  linie.forEach((l, i) => {
    if (!/sk[łl]ad\s+wyj[śs]ciowy/i.test(linie[i + 1] || "")) return;
    if (l && !out.includes(l)) out.push(l);
  });
  return out;
}

// Skład jednej drużyny z minutami gry.
//
// Układ jest stały: numer koszulki w osobnej linijce, pod nim nazwisko (z dopiskami „(B)", „(M)",
// „(C)"), a dalej minuty zdarzeń przy tym zawodniku. Rodzaju zdarzenia nie znamy, więc zmiany
// PARUJEMY: w danej minucie tylu schodzi z pierwszego składu, ilu wchodzi z ławki. To ta sama
// zasada, którą stosuje wklejanie protokołu w aplikacji — i ona się sprawdza, bo suma minut
// jedenastu zawodników musi dać 11 × 90.
export function parseProtokolLnp(html, nazwaKlubu) {
  // NAJPIERW ZAGLĄDAMY W SKRYPTY. Strona ŁNP powstaje w przeglądarce, więc do serwera przychodzi
  // sam szkielet — w widocznym tekście nie ma nazwisk i stąd brał się wniosek „nie da się".
  // Dane jednak przyjeżdżają razem ze stroną, wpisane w skrypt, tyle że `htmlNaLinie` wycina
  // skrypty, zanim cokolwiek zobaczy. Gdy uda się je odczytać, mecz rozlicza się bez wklejania.
  if (!Array.isArray(html)) {
    const zeSkryptow = protokolZeSkryptow(html, nazwaKlubu);
    if (zeSkryptow) return zeSkryptow;
  }
  const linie = Array.isArray(html) ? html : htmlNaLinie(html);
  const druzyny = druzynyZProtokoluLnp(linie);
  const szukany = norm(nazwaKlubu);
  if (!szukany) return null;

  let od = -1;
  for (let i = 0; i < linie.length; i++) {
    if (norm(linie[i]) === szukany && /sk[łl]ad\s+wyj[śs]ciowy/i.test(linie[i + 1] || "")) { od = i; break; }
  }
  // Nazwa u nas bywa dłuższa/krótsza niż na ŁNP — wtedy dopuszczamy zawieranie.
  if (od < 0) {
    for (let i = 0; i < linie.length; i++) {
      const n = norm(linie[i]);
      if (!n || n.length < 4) continue;
      if (!/sk[łl]ad\s+wyj[śs]ciowy/i.test(linie[i + 1] || "")) continue;
      if (n.includes(szukany) || szukany.includes(n)) { od = i; break; }
    }
  }
  if (od < 0) return null;

  let doIdx = linie.findIndex((l, i) => i > od && /^Sztab$/i.test(l));
  if (doIdx < 0) doIdx = linie.length;

  const zawodnicy = [];
  let rezerwa = false;
  for (let i = od + 1; i < doIdx; i++) {
    const l = linie[i];
    if (/sk[łl]ad\s+rezerwowy/i.test(l)) { rezerwa = true; continue; }
    if (!/^\d{1,2}$/.test(l)) continue;
    const numer = parseInt(l, 10);
    let nazwa = "";
    for (let j = i + 1; j < Math.min(i + 4, doIdx); j++) {
      const kandydat = linie[j];
      if (!kandydat || /^\d{1,3}'(\s*\+\s*\d+')?$/.test(kandydat)) continue;
      nazwa = kandydat; i = j; break;
    }
    if (!nazwa) continue;
    const bramkarz = /\(B\)/.test(nazwa);
    const mlodziezowiec = /\(M\)/.test(nazwa);
    const czyste = nazwa.replace(/\((?:M|B|C)\)/g, "").replace(/\s+/g, " ").trim();
    if (!/^[\p{Lu}][\p{L}'’.-]+(\s+[\p{L}'’.-]+)+$/u.test(czyste)) continue;
    zawodnicy.push({ numer, nazwaPelna: czyste, rezerwa, bramkarz, mlodziezowiec, minuty: [] });
  }
  if (zawodnicy.length < 5) return null;

  // Minuty stojące pod nazwiskiem należą do zawodnika, po którym następują.
  const wgNazwiska = new Map(zawodnicy.map((z) => [norm(z.nazwaPelna), z]));
  let biezacy = null;
  for (let i = od + 1; i < doIdx; i++) {
    const l = linie[i];
    if (/^\d{1,2}$/.test(l)) { biezacy = null; continue; }
    const minuta = l.match(/^(\d{1,3})'(?:\s*\+\s*(\d+)')?$/);
    if (minuta && biezacy) { biezacy.minuty.push(parseInt(minuta[1], 10)); continue; }
    const trafiony = wgNazwiska.get(norm(l.replace(/\((?:M|B|C)\)/g, "")));
    if (trafiony) biezacy = trafiony;
  }

  // Parowanie zmian minuta po minucie.
  const wgMinuty = new Map();
  zawodnicy.forEach((z) => z.minuty.forEach((m) => {
    if (!wgMinuty.has(m)) wgMinuty.set(m, { z11: [], zLawki: [] });
    (z.rezerwa ? wgMinuty.get(m).zLawki : wgMinuty.get(m).z11).push(z);
  }));
  wgMinuty.forEach((grupa, m) => {
    const par = Math.min(grupa.z11.length, grupa.zLawki.length);
    for (let i = 0; i < par; i++) {
      grupa.z11[i].zszedl = m;
      if (grupa.zLawki[i].wszedl == null || m < grupa.zLawki[i].wszedl) grupa.zLawki[i].wszedl = m;
    }
  });

  const wynik = zawodnicy.map((z) => ({
    ...z,
    podstawowy: !z.rezerwa,
    wszedl: z.rezerwa ? (z.wszedl ?? null) : 0,
    zszedl: z.rezerwa ? null : (z.zszedl ?? null),
    minutyGry: z.rezerwa
      ? (z.wszedl != null ? Math.max(0, DLUGOSC_MECZU - z.wszedl) : 0)
      : (z.zszedl != null ? z.zszedl : DLUGOSC_MECZU),
  }));
  const suma = wynik.filter((z) => !z.rezerwa).reduce((n, z) => n + z.minutyGry, 0)
    + wynik.filter((z) => z.rezerwa).reduce((n, z) => n + z.minutyGry, 0);

  return {
    druzyny,
    nazwaDruzyny: linie[od],
    zawodnicy: wynik,
    suma,
    // Suma minut wszystkich, którzy byli na boisku, musi dać 11 × 90. Rozbieżność znaczy, że
    // któraś zmiana nie dała się sparować — wtedy liczby są przybliżone i lepiej to wiedzieć.
    zgodne: suma === 11 * DLUGOSC_MECZU,
  };
}
