// JEDEN ZBIERACZ, NIE DWA.
//
// Do dziś istniały dwie jego kopie: szablon `LNP_ZBIERACZ` w src/main.ts (z niego powstawał
// public/zakladka-lnp.js) oraz osobny plik public/zakladka-lnp-v2.js, który pobiera ładowacz
// wciągnięty na pasek. Poprawki trafiały do drugiego, a pierwszy zostawał w tyle — urósł do tego
// stopnia, że miał 368 linii wobec 743 i żadnej z dzisiejszych napraw.
//
// Najgorsze było to, że numer wersji brał się z osobnej stałej: stara kopia meldowała się jako
// aktualna. Kto trafił na nią (ładowacz sięga po nią, gdy ŁNP zablokuje uruchomienie pobranego
// kodu), widział błąd sprzed poprawek i nowy numer wersji naraz — czyli nie miał jak się
// zorientować, co właściwie uruchomił.
//
// Dlatego źródłem jest teraz WYŁĄCZNIE public/zakladka-lnp-v2.js. Ten skrypt tylko powiela go
// pod starym adresem, żeby zakładki wciągnięte kiedyś na pasek nadal działały.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const katalog = dirname(fileURLToPath(import.meta.url));
const zrodlo = resolve(katalog, "..", "public", "zakladka-lnp-v2.js");
const cel = resolve(katalog, "..", "public", "zakladka-lnp.js");

const kod = readFileSync(zrodlo, "utf8");

const wersja = (kod.match(/var SBS_ZBIERACZ\s*=\s*"([^"]+)"/) || [])[1];
if (!wersja) throw new Error("Nie znalazłem SBS_ZBIERACZ w zakladka-lnp-v2.js");

// Sprawdzamy to, co i tak sprawdzi przeglądarka — lepiej wywalić build niż wysłać zepsuty plik.
new Function(kod);

writeFileSync(cel, kod, "utf8");
console.log(`zakladka-lnp.js = kopia zakladka-lnp-v2.js — wersja ${wersja}, ${kod.length} znaków`);
