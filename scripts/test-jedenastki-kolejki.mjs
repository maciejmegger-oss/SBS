// JEDENASTKI KOLEJEK NA MAPACH POZYCJI — Ekstraklasa, I liga, II liga.
//
// Zgłoszenia:
//   20.10.2026 — „sprawdź jedenastki kolejek na poziomie 2 ligi i wprowadź tych zawodników
//                 na mapę pozycji; wyróżnij na złoto, jeśli zawodnik był 3 x w jedenastce".
//   21.10.2026 — „nie widzę nikogo z gwiazdką, są sami młodzieżowcy" (gwiazdka wisiała tylko
//                 na mapie zespołu klubu, a mapa rankingowa to inny widok),
//   21.10.2026 — „możesz takie rankingi zrobić dla ekstraklasy i 1 ligi z gwiazdką".
//
// Uruchomienie:  node scripts/test-jedenastki-kolejki.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const css = fs.readFileSync("src/style.css", "utf8");
const dane = fs.readFileSync("src/data/jedenastki-kolejki.ts", "utf8");
// Kotwiczymy na „= [" / „= {", a nie na samym nawiasie: w deklaracji typu stoi już
// `WyborKolejki[]`, więc pierwszy napotkany nawias należałby do adnotacji, nie do danych.
const wytnij = (nazwa, otw, zam) => {
  const i = dane.indexOf("= " + otw, dane.indexOf(nazwa)) + 2;
  return JSON.parse(dane.slice(i, dane.indexOf(zam + ";", i) + 1));
};
const WPISY = wytnij("JEDENASTKI_KOLEJEK", "[", "]");
const KOLEJKI = wytnij("KOLEJKI_W_ZESTAWIENIU", "{", "}");
const ZRODLA = wytnij("ZRODLA_JEDENASTEK", "{", "}");
const LIGI = Object.keys(KOLEJKI);

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Trzy ligi w danych");
sprawdz("są wszystkie trzy poziomy, o które prosił",
  ["Ekstraklasa", "I liga", "II liga"].every((l) => LIGI.includes(l)), LIGI.join(", "));
sprawdz("każda liga ma podane źródło", LIGI.every((l) => (ZRODLA[l] || "").length > 5));
sprawdz("nazwy lig są dokładnie takie, jak w ustawieniach SBS (inaczej panel ich nie dopasuje)",
  LIGI.every((l) => /^(Ekstraklasa|I liga|II liga)$/.test(l)), LIGI.join(" | "));
LIGI.forEach((l) => {
  const moje = WPISY.filter((w) => w.liga === l);
  const kolejki = [...new Set(moje.map((w) => w.kolejka))].sort((a, b) => a - b);
  sprawdz(`${l}: liczba kolejek zgadza się ze spisem`,
    kolejki.join() === KOLEJKI[l].join(), `${kolejki.join()} vs ${KOLEJKI[l].join()}`);
  // Redakcja czasem publikuje dziesięciu zamiast jedenastu — to jest w danych wiernie,
  // ale dwunastu w jednej kolejce oznaczałoby błąd odczytu.
  const wg = {};
  moje.forEach((w) => { wg[w.kolejka] = (wg[w.kolejka] || 0) + 1; });
  sprawdz(`${l}: w żadnej kolejce nie ma więcej niż jedenastu`,
    Object.values(wg).every((n) => n <= 11 && n >= 9), JSON.stringify(wg));
});

console.log("\n2. Jakość wpisów");
sprawdz("przy każdym wpisie jest odnośnik do artykułu",
  WPISY.every((w) => /^https:\/\/(pilkanozna|ekstraklasa)\./.test(w.zrodlo)));
sprawdz("każdy wpis ma ligę, klub i nazwisko",
  WPISY.every((w) => w.liga && w.klub && w.nazwisko && w.nazwisko.length > 1));
sprawdz("kluby zapisane pełną nazwą, nie skrótem z artykułu",
  WPISY.every((w) => /\s/.test(w.klub) || w.klub === "Resovia" || w.klub === "Cracovia"),
  [...new Set(WPISY.filter((w) => !/\s/.test(w.klub)).map((w) => w.klub))].join(", "));
sprawdz("ten sam zawodnik nie figuruje dwa razy w jednej kolejce", (() => {
  const w = new Set();
  return WPISY.every((x) => { const k = x.liga + x.kolejka + x.nazwisko + x.klub;
    if (w.has(k)) return false; w.add(k); return true; });
})());
sprawdz("Ekstraklasa ma z oficjalnego serwisu także pozycje",
  WPISY.filter((w) => w.liga === "Ekstraklasa").every((w) => w.pozycja));

console.log("\n3. Liczenie wyróżnień");
LIGI.forEach((l) => {
  const licz = {};
  WPISY.filter((w) => w.liga === l).forEach((w) => { const k = w.nazwisko + "|" + w.klub; (licz[k] = licz[k] || []).push(w.kolejka); });
  const zloci = Object.entries(licz).filter(([, k]) => k.length >= 3);
  sprawdz(`${l}: nikt nie ma więcej wyróżnień niż było kolejek`,
    Object.values(licz).every((k) => k.length <= KOLEJKI[l].length));
  console.log(`       ${l}: ${Object.keys(licz).length} zawodników, złota gwiazdka → ${
    zloci.length ? zloci.map(([k, n]) => k.split("|")[0] + " " + n.length + "x").join(", ") : "nikt"}`);
});

console.log("\n4. Dopasowanie do kartoteki");
// Imiennicy i rezerwy to dwa realne sposoby na przypisanie komuś cudzych wyróżnień.
const kamienscy = WPISY.filter((w) => w.nazwisko === "Kamiński");
sprawdz("w danych są różni zawodnicy o tym samym nazwisku",
  new Set(kamienscy.map((w) => w.klub)).size >= 2, [...new Set(kamienscy.map((w) => w.klub))].join(" / "));
sprawdz("w danych są i pierwsze zespoły, i rezerwy tych samych klubów",
  WPISY.some((w) => /Śląsk II/.test(w.klub)) && WPISY.some((w) => w.klub === "Śląsk Wrocław"));
sprawdz("luźne dopasowanie nazwy nie myli rezerw z pierwszym zespołem",
  /const rezerwyWNazwie = /.test(zrodlo)
  && /if\(rezerwyWNazwie\(lista\[0\]\.klub\) !== rezerwyWNazwie\(nazwaKlubu\)\) continue;/.test(zrodlo)
  && /rezerwyWNazwie\(klub\) === rezerwyWNazwie\(w\.klub\) && klubyToSamo/.test(zrodlo));
sprawdz("dopasowanie bierze pod uwagę klub, nie samo nazwisko",
  /const nazwaKlubu = clubName\(p\.clubId\);/.test(zrodlo));
sprawdz("imię porównywane tylko wtedy, gdy obie strony je mają (pseudonimy jednoczłonowe)",
  /\(!imie \|\| !w\.imie \|\| kluczNazwiska\(w\.imie\) === imie\)/.test(zrodlo));
sprawdz("indeks klubów liczony raz, nie przy każdym nazwisku na mapie",
  /if\(indeksJedenastek\) return indeksJedenastek;/.test(zrodlo));
sprawdz("wyszukiwanie w kartotece idzie po indeksie nazwisk",
  /function indeksPoNazwisku\(\)\{/.test(zrodlo)
  && /const kandydaci = idx\.get\(kluczNazwiska\(w\.nazwisko\)\);/.test(zrodlo));

{
  const klucz = (s) => String(s || "").toLowerCase()
    .replace(/[łøđ]/g, (c) => ({ "ł": "l", "ø": "o", "đ": "d" }[c]))
    .normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z]/g, "");
  sprawdz("Kądzior = Kadzior", klucz("Kądzior") === klucz("Kadzior"));
  sprawdz("Samiec-Talar = SamiecTalar", klucz("Samiec-Talar") === klucz("SamiecTalar"));
  sprawdz("Żewłakow = Zewlakow", klucz("Żewłakow") === klucz("Zewlakow"));
  sprawdz("różne nazwiska nadal różne", klucz("Deja") !== klucz("Dejna"));
  const rez = (s) => /(^|\s)(ii|iii|2)(\s|$)/i.test(String(s || ""));
  sprawdz("rezerwy rozpoznane po nazwie", rez("Śląsk II Wrocław") && rez("Legia II Warszawa"));
  sprawdz("pierwszy zespół nie jest brany za rezerwy", !rez("Śląsk Wrocław") && !rez("Lech Poznań"));
}

console.log("\n5. Obie mapy i panel");
sprawdz("gwiazdka jest na mapie rankingowej", /jedenastkaBadge\(pl\)/.test(zrodlo));
sprawdz("gwiazdka jest na mapie zespołu klubu", /jedenastkaBadge\(p\)/.test(zrodlo));
sprawdz("panel pokazuje ligę wybraną w rankingu, a nie zawsze drugą",
  /function panelJedenastekHtml\(liga\)\{/.test(zrodlo) && /panelJedenastekHtml\(rankingLeague\)/.test(zrodlo));
sprawdz("panel liczy osobno tych w bazie i brakujących",
  /const brak = zBaza\.filter\(x=>!x\.p\);/.test(zrodlo) && /brak w kartotece/.test(zrodlo));
sprawdz("panel tłumaczy, dlaczego mapa może nie pokazywać gwiazdek",
  /Gwiazdka na mapie staje tylko przy tych pierwszych/.test(zrodlo));
sprawdz("liczba zestawień czytana per liga, nie globalnie",
  /KOLEJKI_W_ZESTAWIENIU\[w\.liga\]/.test(zrodlo) && /KOLEJKI_W_ZESTAWIENIU\[liga\]/.test(zrodlo));
sprawdz("podpowiedź przy gwiazdce nazywa ligę", /w jedenastce kolejki — \$\{esc\(w\.liga\)\}/.test(zrodlo));
sprawdz("źródło brane ze spisu, nie wpisane na sztywno",
  /ZRODLA_JEDENASTEK\[liga\]/.test(zrodlo) && !/źródło: pilkanozna\.pl\./.test(zrodlo));

console.log("\n6. Czytelność odznaki");
sprawdz("odznaka ma własne tło — plakietka na mapie jest biała w obu motywach",
  /\.jk-badge\{[^}]*background:#FBF3DF/.test(css.replace(/\s+/g, " ")));
sprawdz("złota wersja ma ciemny tekst na złotym tle",
  /\.jk-badge\.jk-mocny\{[^}]*background:#C69B3C[^}]*color:#2A1F05/.test(css.replace(/\s+/g, " ")));
sprawdz("wiersz z trzema wyróżnieniami ma obwódkę, a nie drugi pasek z lewej",
  /pos-marker-row:has\(\.jk-mocny\)/.test(css));

console.log("\n7. Skąd się wzięły dane");
sprawdz("plik jest generowany skryptem, nie pisany ręcznie",
  /wygenerowane, NIE POPRAWIAJ RĘCZNIE/.test(dane) && fs.existsSync("scripts/zbuduj-jedenastki-kolejki.mjs"));
sprawdz("nagłówek wypisuje, których kolejek brakuje i dlaczego",
  /wydawca ich nie opublikował/.test(dane) && /komplet/.test(dane));
sprawdz("na ligę przypada jedno źródło — mieszanie wydawców fałszowałoby liczbę wyróżnień",
  LIGI.every((l) => new Set(WPISY.filter((w) => w.liga === l)
    .map((w) => new URL(w.zrodlo).hostname)).size === 1));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
