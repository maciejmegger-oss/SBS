// Sprawdza, czy poziom rozgrywek czytany z protokołu jest rozpoznawany poprawnie.
//
// SKĄD TEN TEST: wzorzec na CLJ U17 był na tyle luźny, że łapał zwykłą minutę zejścia zapisaną
// jako „…u 17'". Protokół Ekstraklasy dostawał wtedy poziom CLJ U17, co odcinało WSZYSTKIE kluby
// i dawało komunikat bez sensu: „Zagłębie Lubin gra w Ekstraklasie, a zbierasz do Ekstraklasy".
// Poziom rozstrzyga o tym, do którego klubu trafi dorobek, więc każda zmiana tych wzorców musi
// przejść przez ten test.
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const blok = zrodlo.match(/const POZIOMY = \[[\s\S]*?\n  \];/);
if (!blok) { console.error("Nie znalazłem tabeli POZIOMY w src/main.ts."); process.exit(1); }

const POZIOMY = eval(blok[0].replace(/^\s*const POZIOMY = /, "") .replace(/;$/, ""));
const poziom = (txt) => {
  for (const [wzor, nazwa] of POZIOMY) if (wzor.test(txt)) return nazwa;
  return "";
};

// Fragmenty protokołów tak, jak przychodzą z ŁNP — z nagłówkiem rozgrywek i składem.
const PRZYPADKI = [
  ["Ekstraklasa, zejście w 17. minucie", "6 kolejka, Ekstraklasa\nSkłady\nZagłębie Lubin\nSkład wyjściowy\n7\nBartu\n17'", "Ekstraklasa"],
  ["I liga, zmiana w 19. minucie",       "3 kolejka, Pierwsza liga\nSkłady\nStomil Olsztyn\n9\nKowalski\n19'", "I liga"],
  ["II liga",                            "8 kolejka, Druga liga\nSkłady", "II liga"],
  ["III liga",                           "2 kolejka, Trzecia liga\nSkłady", "III liga"],
  ["IV liga",                            "5 kolejka, Czwarta liga\nSkłady", "IV liga"],
  ["CLJ U17 pełną nazwą",                "4 kolejka, Centralna Liga Juniorów U-17\nSkłady", "CLJ U17"],
  ["CLJ U17 skrótem",                    "2 kolejka, CLJ U-17 grupa zachodnia", "CLJ U17"],
  ["CLJ U19 (bez oznaczenia wieku)",     "4 kolejka, Centralna Liga Juniorów\nSkłady", "CLJ U19"],
  ["klasa okręgowa",                     "1 kolejka, Klasa okręgowa\nSkłady", "Klasa okręgowa"],
  // Nazwisko z „clj" w środku nie ma prawa zmienić rozgrywek.
  ["Ekstraklasa, nazwisko z clj",        "6 kolejka, Ekstraklasa\nSkłady\nMarcljanik\n90'", "Ekstraklasa"],
];

let bledy = 0;
for (const [opis, tekst, oczekiwany] of PRZYPADKI) {
  const wynik = poziom(tekst);
  const ok = wynik === oczekiwany;
  if (!ok) bledy++;
  console.log(`  ${ok ? "OK  " : "ŹLE "} ${opis.padEnd(34)} -> ${wynik || "(brak)"}${ok ? "" : `   OCZEKIWANO: ${oczekiwany}`}`);
}
console.log(bledy ? `\nBŁĘDY: ${bledy}` : "\nPoziom rozgrywek czytany z protokołu jest poprawny.");
process.exit(bledy ? 1 : 0);
