// JEDENASTKI KOLEJEK BETCLIC 2 LIGI NA MAPIE POZYCJI.
//
// Zgłoszenie (20.10.2026): „sprawdź jedenastki kolejek na poziomie 2 ligi i wprowadź tych
// zawodników na mapę pozycji; wyróżnij na złoto, jeśli zawodnik był 3 x w jedenastce kolejki".
//
// Uruchomienie:  node scripts/test-jedenastki-kolejki.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const css = fs.readFileSync("src/style.css", "utf8");
const dane = fs.readFileSync("src/data/jedenastki-kolejki.ts", "utf8");
const WPISY = JSON.parse(dane.slice(dane.indexOf("= [", dane.indexOf("JEDENASTKI_KOLEJEK")) + 2, dane.lastIndexOf("]") + 1));
const KOLEJKI = JSON.parse(/KOLEJKI_W_ZESTAWIENIU: number\[\] = (\[[^\]]*\])/.exec(dane)[1]);

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Dane z kolejek");
sprawdz("zestawienie obejmuje rundę jesienną, nie jedną kolejkę", KOLEJKI.length >= 9, `kolejek: ${KOLEJKI.length}`);
sprawdz("każda kolejka ma 10 albo 11 nazwisk", (() => {
  const wg = {}; WPISY.forEach((w) => { wg[w.kolejka] = (wg[w.kolejka] || 0) + 1; });
  return Object.values(wg).every((n) => n === 11 || n === 10);
})(), JSON.stringify((() => { const w = {}; WPISY.forEach((x) => { w[x.kolejka] = (w[x.kolejka] || 0) + 1; }); return w; })()));
sprawdz("przy każdym wpisie jest odnośnik do artykułu",
  WPISY.every((w) => /^https:\/\/pilkanozna\.pl\//.test(w.zrodlo)));
sprawdz("kluby zapisane pełną nazwą, nie skrótem z artykułu",
  WPISY.every((w) => /\s/.test(w.klub) || w.klub === "Resovia"),
  [...new Set(WPISY.filter((w) => !/\s/.test(w.klub)).map((w) => w.klub))].join(", "));
sprawdz("żaden wpis nie ma pustego nazwiska", WPISY.every((w) => w.nazwisko.trim().length > 1));
sprawdz("ten sam zawodnik nie figuruje dwa razy w jednej kolejce", (() => {
  const widziane = new Set();
  return WPISY.every((w) => { const k = w.kolejka + "|" + w.nazwisko + "|" + w.klub;
    if (widziane.has(k)) return false; widziane.add(k); return true; });
})());

console.log("\n2. Liczenie wyróżnień");
const licz = {};
WPISY.forEach((w) => { const k = w.nazwisko + "|" + w.klub; (licz[k] = licz[k] || []).push(w.kolejka); });
const zloci = Object.entries(licz).filter(([, k]) => k.length >= 3);
sprawdz("są zawodnicy z trzema wyróżnieniami — próg ze zgłoszenia działa na realnych danych",
  zloci.length > 0, `${zloci.length}`);
sprawdz("nikt nie ma więcej wyróżnień niż było kolejek",
  Object.values(licz).every((k) => k.length <= KOLEJKI.length));
console.log(`       złota gwiazdka: ${zloci.map(([k, n]) => k.split("|")[0] + " " + n.length + "x").join(", ")}`);

console.log("\n3. Dopasowanie do kartoteki");
// Imiennicy to realne ryzyko: w zestawieniu jest Dariusz Kamiński (Stal) i Wiktor Kamiński
// (Śląsk II). Samo nazwisko przyznałoby wyróżnienia obu.
const kamienscy = WPISY.filter((w) => w.nazwisko === "Kamiński");
sprawdz("w danych naprawdę są dwaj Kamińscy z różnych klubów",
  new Set(kamienscy.map((w) => w.klub)).size === 2, kamienscy.map((w) => w.imie + " " + w.klub).join(" / "));
sprawdz("dopasowanie bierze pod uwagę klub, nie samo nazwisko",
  /const nazwaKlubu = clubName\(p\.clubId\);/.test(zrodlo) && /if\(!wpisy\) return \{ ile: 0/.test(zrodlo));
sprawdz("imię porównywane tylko wtedy, gdy obie strony je mają (pseudonimy jednoczłonowe)",
  /\(!imie \|\| !w\.imie \|\| kluczNazwiska\(w\.imie\) === imie\)/.test(zrodlo));
sprawdz("klub dopasowywany też przy innej pisowni nazwy",
  /klubyToSamo\(lista\[0\]\.klub, nazwaKlubu\)/.test(zrodlo));
sprawdz("indeks liczony raz, nie przy każdym nazwisku na mapie",
  /if\(indeksJedenastek\) return indeksJedenastek;/.test(zrodlo));

// Kopia logiki klucza — sprawdzamy, że polskie znaki nie rozbijają dopasowania.
{
  const klucz = (s) => String(s || "").toLowerCase()
    .replace(/[łøđ]/g, (c) => ({ "ł": "l", "ø": "o", "đ": "d" }[c]))
    .normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z]/g, "");
  sprawdz("Kądzior = Kadzior", klucz("Kądzior") === klucz("Kadzior"));
  sprawdz("Stępień = Stepien", klucz("Stępień") === klucz("Stepien"));
  sprawdz("Łasicki = Lasicki", klucz("Łasicki") === klucz("Lasicki"));
  sprawdz("różne nazwiska nadal różne", klucz("Deja") !== klucz("Dejna"));
}

console.log("\n4. Mapa pozycji");
sprawdz("gwiazdka doklejona do nazwiska na mapie",
  /<span class="pmr-name">\$\{esc\(p\.lastName \|\| p\.firstName \|\| '—'\)\}<\/span>\$\{jedenastkaBadge\(p\)\}/.test(zrodlo));
sprawdz("legenda mówi, z ilu kolejek liczone są wyróżnienia",
  /Liczone z \$\{KOLEJKI_W_ZESTAWIENIU\.length\} zestawień rundy jesiennej/.test(zrodlo));
sprawdz("legenda podaje źródło", /źródło: pilkanozna\.pl/.test(zrodlo));
sprawdz("podpowiedź przy gwiazdce wymienia konkretne kolejki",
  /\(kolejki \$\{w\.kolejki\.join\(', '\)\}\)/.test(zrodlo));

console.log("\n5. Czytelność odznaki");
sprawdz("odznaka ma własne tło — plakietka na mapie jest biała w obu motywach",
  /\.jk-badge\{[^}]*background:#FBF3DF/.test(css.replace(/\s+/g, " ")));
sprawdz("złota wersja ma ciemny tekst na złotym tle",
  /\.jk-badge\.jk-mocny\{[^}]*background:#C69B3C[^}]*color:#2A1F05/.test(css.replace(/\s+/g, " ")));
sprawdz("wiersz z trzema wyróżnieniami ma obwódkę, a nie drugi pasek z lewej",
  /pos-marker-row:has\(\.jk-mocny\)/.test(css));

console.log("\n6. Skąd się wzięły dane");
sprawdz("plik jest generowany skryptem, nie pisany ręcznie",
  /wygenerowane, NIE POPRAWIAJ RĘCZNIE/.test(dane) && fs.existsSync("scripts/zbuduj-jedenastki-kolejki.mjs"));
sprawdz("brakujące kolejki są wypisane wprost, a nie przemilczane",
  /kolejek 3, 8 i 9 sezonu 2026\/27 — wydawca ich nie opublikował/.test(dane));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
