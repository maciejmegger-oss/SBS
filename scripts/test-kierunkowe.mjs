// Sprawdzenie składania numeru telefonu z kierunkowego i tego, co wpisano.
// Uruchomienie: node scripts/test-kierunkowe.mjs
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const zrodlo = readFileSync(new URL("../src/site/kierunkowe.ts", import.meta.url), "utf8");
const js = transformSync(zrodlo, { loader: "ts", format: "esm" }).code;
const { zlozNumer, KIERUNKOWE } = await import("data:text/javascript," + encodeURIComponent(js));

const przypadki = [
  // [wpisane, kierunkowy, oczekiwane, opis]
  ["507113413",        "+48", "+48 507113413",     "numer krajowy — doklejamy kierunkowy"],
  ["507 113 413",      "+49", "+49 507 113 413",   "spacje w numerze zostają jak wpisano"],
  ["+48 507 113 413",  "+49", "+48 507 113 413",   "wpisany komplet z plusem ma pierwszeństwo"],
  ["0048507113413",    "+49", "+48507113413",      "stary zapis z zerami zamieniony na plus"],
  ["0507113413",       "+48", "+48 507113413",     "zero międzymiastowe zdjęte"],
  ["",                 "+48", "",                  "puste zostaje puste — nie zapisujemy samego kierunkowego"],
  ["   ",              "+48", "",                  "same spacje to też puste"],
  ["0",                "+48", "",                  "samo zero nie jest numerem"],
  ["170 1234567",      "+49", "+49 170 1234567",   "numer niemiecki"],
  ["7911123456",       "+44", "+44 7911123456",    "numer brytyjski"],
];

let bledow = 0;
for (const [wpisane, kier, oczekiwane, opis] of przypadki) {
  const wynik = zlozNumer(wpisane, kier);
  const ok = wynik === oczekiwane;
  if (!ok) bledow++;
  console.log(`${ok ? "✓" : "✗"} ${opis}\n    „${wpisane}" + ${kier}  →  „${wynik}"${ok ? "" : `   OCZEKIWANO „${oczekiwane}"`}`);
}

// Lista kierunkowych: bez powtórzeń i każdy wpis kompletny.
const kody = KIERUNKOWE.map((k) => k.kod);
const powtorzone = kody.filter((k, i) => kody.indexOf(k) !== i);
if (powtorzone.length) { console.log("✗ powtórzone kierunkowe:", powtorzone.join(", ")); bledow++; }
else console.log(`✓ ${KIERUNKOWE.length} kierunkowych, żaden się nie powtarza`);

const niepelne = KIERUNKOWE.filter((k) => !k.kod || !k.pl || !k.en || !k.de);
if (niepelne.length) { console.log("✗ wpisy bez kompletu nazw:", niepelne.map((k) => k.kod).join(", ")); bledow++; }
else console.log("✓ każdy kraj ma nazwę po polsku, angielsku i niemiecku");

console.log(bledow ? `\nBŁĘDÓW: ${bledow}` : "\nWszystko się zgadza.");
process.exit(bledow ? 1 : 0);
