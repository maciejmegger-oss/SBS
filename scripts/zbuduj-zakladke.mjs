// PLIK, KTÓRY ZAKŁADKA POBIERA Z SBS PRZY KAŻDYM KLIKNIĘCIU.
//
// Zakładka w pasku przeglądarki nie aktualizuje się sama — dotąd każda poprawka wymagała
// przeciągnięcia jej tam od nowa, a bez tego klikało się kod sprzed poprawek. Teraz w pasku
// siedzi tylko ładowacz, a właściwy zbieracz leży tutaj i jest budowany razem z aplikacją.
// Dzięki temu jedno wdrożenie wystarczy, żeby zakładka zaczęła działać po nowemu.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const katalog = dirname(fileURLToPath(import.meta.url));
const zrodlo = resolve(katalog, "..", "src", "main.ts");
const cel = resolve(katalog, "..", "public", "zakladka-lnp.js");

const z = readFileSync(zrodlo, "utf8");

// Wycinamy treść szablonu (backticki) — tak samo jak robią to testy.
function wytnij(nazwa) {
  const i = z.indexOf("const " + nazwa + " = `");
  if (i < 0) throw new Error("Nie znalazłem " + nazwa + " w src/main.ts");
  const od = z.indexOf("`", i) + 1;
  let j = od;
  while (j < z.length) {
    if (z[j] === "\\") { j += 2; continue; }
    if (z[j] === "`") break;
    j++;
  }
  return z.slice(od, j);
}

const wersja = (z.match(/const ZAKLADKA_WERSJA = '([^']+)'/) || [])[1];
if (!wersja) throw new Error("Nie znalazłem ZAKLADKA_WERSJA w src/main.ts");

const ZDARZENIA = new Function("return `" + wytnij("LNP_ZDARZENIA") + "`;")();
// Adresu SBS tu nie znamy (aplikacja stoi pod różnymi domenami), więc zostaje pusty —
// ładowacz i tak podaje go przez window.__SBS_ADRES, zanim uruchomi ten kod.
const ZBIERACZ = new Function("LNP_ZDARZENIA", "SBS_ADRES_JS", "ZAKLADKA_WERSJA",
  "return `" + wytnij("LNP_ZBIERACZ") + "`;")(ZDARZENIA, '""', wersja);

// Sprawdzamy to, co i tak sprawdzi przeglądarka — lepiej wywalić build niż wysłać zepsuty plik.
new Function(ZBIERACZ);

mkdirSync(dirname(cel), { recursive: true });
writeFileSync(cel, "(function(){\n" + ZBIERACZ + "\n})();\n", "utf8");
console.log("zakladka-lnp.js zbudowana — wersja " + wersja + ", " + ZBIERACZ.length + " znaków");
