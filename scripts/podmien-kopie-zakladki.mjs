// Jednorazowa podmiana: wbudowana kopia zbieracza znika, w jej miejsce wchodzi import pliku,
// który i tak leży w public/. Skrypt zostaje w repozytorium jako ślad, co dokładnie zrobiono.
import fs from "node:fs";

const p = "src/main.ts";
const linie = fs.readFileSync(p, "utf8").split(/\r?\n/);

const od = linie.findIndex((l) => l.startsWith("const LNP_ZBIERACZ = `"));
if (od < 0) { console.error("Nie znalazłem początku LNP_ZBIERACZ."); process.exit(1); }
let doIdx = -1;
for (let i = od + 1; i < linie.length; i++) if (linie[i] === "`;") { doIdx = i; break; }
if (doIdx < 0) { console.error("Nie znalazłem końca LNP_ZBIERACZ."); process.exit(1); }

const zastapienie = [
  "// KOPIA AWARYJNA JEST TYM SAMYM PLIKIEM, CO SERWOWANY — NIE JEGO ODPOWIEDNIKIEM.",
  "//",
  "// Dotąd była to osobna, ręcznie utrzymywana kopia — i rozjechała się: plik na serwerze miał",
  "// 743 linie ze wszystkimi dzisiejszymi poprawkami, kopia awaryjna 368 i żadnej z nich. Gorzej:",
  "// numer wersji brała z osobnej stałej, więc meldowała się jako aktualna, choć była sprzed",
  "// poprawek. Kto trafił na tę drogę — a ŁNP potrafi zablokować uruchomienie pobranego kodu —",
  "// widział stary błąd i nowy numer wersji naraz, czyli najgorszy możliwy zestaw.",
  "//",
  "// Teraz Vite wkleja tu ten sam plik, który leży w public/. Rozjechać się nie mogą.",
  'import LNP_ZBIERACZ from "../public/zakladka-lnp-v2.js?raw";',
];

const wynik = linie.slice(0, od).concat(zastapienie, linie.slice(doIdx + 1));
fs.writeFileSync(p, wynik.join("\n"));
console.log(`Usunięto ${doIdx - od + 1} linii wbudowanej kopii, wstawiono ${zastapienie.length}.`);
