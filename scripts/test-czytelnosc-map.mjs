// CZYTELNOŚĆ MAP POZYCJI — pełne nazwisko i pełna lista.
//
// Zgłoszenie (21.10.2026): „czy możesz poprawić, żeby na tych mapach było widoczne całe
// nazwisko, minimalnie poszerzyć okienka, i chcę całe listy, żeby się pojawiały bez tych
// przesuwaków — jak na jedną pozycję przesunę np. 8 zawodników, to żeby oni byli widoczni".
//
// Trzy osobne rzeczy stały temu na przeszkodzie i każda wymaga własnej asercji:
//   1. nazwisko było ucinane wielokropkiem („Kalinow…”, „W…”),
//   2. plakietka miała sztywną wysokość i pasek przewijania,
//   3. na jedno pole wchodziło najwyżej sześciu — ósmy nie miał prawa wejść.
//
// Uruchomienie:  node scripts/test-czytelnosc-map.mjs
import fs from "node:fs";

const css = fs.readFileSync("src/style.css", "utf8");
const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const plaski = css.replace(/\s+/g, " ");

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Całe nazwisko, bez wielokropka");
sprawdz("nazwisko na mapach nie jest ucinane",
  /\.mapa-rankingowa\) \.pmr-name\{[^}]*overflow:visible;text-overflow:clip/.test(plaski));
sprawdz("zdjęty limit szerokości nazwiska",
  /\.mapa-rankingowa\) \.pmr-name\{[^}]*max-width:none/.test(plaski));
sprawdz("w mapie rankingowej nazwisko też bez limitu",
  /\.mapa-rankingowa \.pmr-name\{font-size:11\.5px;max-width:none;\}/.test(plaski));
sprawdz("nigdzie nie został stary clamp 116 px na nazwisko",
  !/\.pmr-name\{[^}]*max-width:116px/.test(plaski));

console.log("\n2. Plakietka szersza, ale nie bez końca");
sprawdz("plakietka dopasowuje się do treści",
  /\.mapa-rankingowa\) \.pos-marker-tag\{[^}]*width:max-content/.test(plaski));
sprawdz("górna granica szerokości podniesiona, ale nadal jest",
  /\.mapa-rankingowa\) \.pos-marker-tag\{[^}]*max-width:240px/.test(plaski)
  && /\.mapa-rankingowa \.pos-marker-tag\{min-width:124px;max-width:250px;\}/.test(plaski));

console.log("\n3. Cała lista, bez przewijania");
sprawdz("zdjęta sztywna wysokość plakietki", /\.pos-marker-tag\{[^}]*max-height:none/.test(plaski));
sprawdz("zdjęty pasek przewijania", /\.pos-marker-tag\{[^}]*overflow:visible/.test(plaski));
sprawdz("nigdzie nie został stary max-height 104 px", !/max-height:104px/.test(plaski));
// Bez przewijania plakietki potrafią na siebie zachodzić — pole pod kursorem musi wyjść
// na wierzch, inaczej dłuższej listy nie da się przeczytać.
sprawdz("pole pod kursorem wychodzi na wierzch", /\.pos-marker:hover[^{]*\{[^}]*z-index/.test(plaski));

console.log("\n4. Ośmiu na jednej pozycji naprawdę wchodzi");
sprawdz("limit stoi w jednym miejscu, a nie przepisany w kodzie",
  /const LIMIT_NA_POZYCJI = \d+;/.test(zrodlo));
sprawdz("limit mieści osiem nazwisk ze zgłoszenia",
  Number(/const LIMIT_NA_POZYCJI = (\d+);/.exec(zrodlo)[1]) >= 8,
  /const LIMIT_NA_POZYCJI = (\d+);/.exec(zrodlo)[1]);
sprawdz("przeciąganie sprawdza tę samą stałą",
  /if\(cel\.length >= LIMIT_NA_POZYCJI\) return \{ ok:false, powod:'komplet' \};/.test(zrodlo));
sprawdz("autouzupełnianie sprawdza tę samą stałą",
  /if\(cur\.includes\(id\) \|\| cur\.length >= LIMIT_NA_POZYCJI\) return;/.test(zrodlo));
sprawdz("nigdzie nie została zaszyta szóstka",
  !/do 6 zawodników/.test(zrodlo) && !/do 6 na pozycję/.test(zrodlo));
sprawdz("podpowiedź i legenda podają liczbę ze stałej, więc nie rozjadą się przy zmianie",
  /do \$\{LIMIT_NA_POZYCJI\} zawodników/.test(zrodlo)
  && /do \$\{LIMIT_NA_POZYCJI\} na pozycję/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
