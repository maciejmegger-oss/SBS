// JEDENASTKI KOLEJEK → src/data/jedenastki-kolejki.ts
//
// Zgłoszenie (20.10.2026): „sprawdź jedenastki kolejek na poziomie 2 ligi i wprowadź tych
// zawodników na mapę pozycji; wyróżnij na złoto, jeśli zawodnik był 3 x w jedenastce kolejki".
// Rozszerzenie (21.10.2026): „możesz takie rankingi zrobić dla ekstraklasy i 1 ligi z gwiazdką".
//
// ŹRÓDŁA — jedno na ligę, świadomie:
//   Ekstraklasa — ekstraklasa.org, oficjalny serwis ligi (podaje też pozycję zawodnika),
//   I i II liga — pilkanozna.pl, cykl „jedenastka N. kolejki Betclic 1/2 Ligi".
// Mieszanie wydawców w obrębie jednej ligi byłoby błędem: każdy ma własne jury, więc liczba
// wyróżnień przestałaby cokolwiek znaczyć.
//
// Skróty klubów („Stal M.", „Pogoń G. M.") rozwijamy wg składu ligi z 90minut — w bazie SBS
// kluby są pod pełnymi nazwami i inaczej nic by się nie dopasowało.
//
// Uruchomienie:  node scripts/zbuduj-jedenastki-kolejki.mjs <plik.json>
import fs from "node:fs";

const dane = JSON.parse(fs.readFileSync(process.argv[2] || "jedenastki.json", "utf8"));

const wpisy = [];
const kolejkiLigi = {};
const zrodlaLigi = {};
const nieznane = [];

for (const [liga, blok] of Object.entries(dane)) {
  const skroty = blok.skroty || {};
  const numery = Object.keys(blok.kolejki).map(Number).sort((a, b) => a - b);
  kolejkiLigi[liga] = numery;
  zrodlaLigi[liga] = blok.zrodlo;
  for (const nr of numery) {
    const k = blok.kolejki[String(nr)];
    const link = /^https?:/.test(k.slug) ? k.slug : blok.baza + k.slug + "/";
    for (const [pozycja, nazwa, klubSkrot] of k.g) {
      const klub = skroty[klubSkrot] || klubSkrot;
      // Pusty skrót znaczy, że wydawca nie podał klubu — takiego wpisu nie da się do niczego
      // dopasować, więc lepiej, żeby generator się zatrzymał, niż żeby wszedł cicho do danych.
      if (!klub || !nazwa) { nieznane.push(`${liga} k.${nr}: ${nazwa} / ${klubSkrot}`); continue; }
      const czesci = String(nazwa).trim().split(/\s+/);
      wpisy.push({
        liga,
        kolejka: nr,
        data: k.data || "",
        // Jednoczłonowe pseudonimy (np. „Marcinho") zostają w nazwisku, imię puste.
        imie: czesci.length > 1 ? czesci.slice(0, -1).join(" ") : "",
        nazwisko: czesci[czesci.length - 1],
        klub,
        pozycja: pozycja || "",
        zrodlo: link,
      });
    }
  }
}
if (nieznane.length) { console.error("Wpisy bez nazwiska albo klubu:\n  " + nieznane.join("\n  ")); process.exit(1); }

const opisBrakow = Object.entries(kolejkiLigi).map(([liga, k]) => {
  const brak = [];
  for (let i = 1; i <= Math.max(...k); i++) if (!k.includes(i)) brak.push(i);
  return `//   ${liga}: kolejki ${k.join(", ")}${brak.length ? ` — brak ${brak.join(", ")} (wydawca ich nie opublikował)` : " — komplet"}`;
}).join("\n");

const naglowek = `// JEDENASTKI KOLEJEK — wygenerowane, NIE POPRAWIAJ RĘCZNIE.
//
// Po dołożeniu kolejki uruchom: node scripts/zbuduj-jedenastki-kolejki.mjs <plik.json>
//
// Źródła (jedno na ligę — mieszanie wydawców zafałszowałoby liczbę wyróżnień):
${Object.entries(zrodlaLigi).map(([l, z]) => `//   ${l} — ${z}`).join("\n")}
//
// Co jest, a czego nie ma — aplikacja pisze to wprost przy liczbie wyróżnień:
${opisBrakow}

export type WyborKolejki = {
  liga: string;      // nazwa rozgrywek dokładnie jak w ustawieniach SBS
  kolejka: number;
  data: string;      // data publikacji jedenastki
  imie: string;      // puste przy jednoczłonowym pseudonimie
  nazwisko: string;
  klub: string;      // pełna nazwa klubu, tak jak w bazie SBS
  pozycja: string;   // tylko Ekstraklasa — oficjalny serwis ją podaje
  zrodlo: string;
};

// Kolejki, z których liczone są wyróżnienia w danej lidze — potrzebne, żeby napisać „3 z 9",
// a nie „3 z 12", bo to byłaby nieprawda.
export const KOLEJKI_W_ZESTAWIENIU: Record<string, number[]> = ${JSON.stringify(kolejkiLigi, null, 2)};

export const ZRODLA_JEDENASTEK: Record<string, string> = ${JSON.stringify(zrodlaLigi, null, 2)};
`;

fs.writeFileSync("src/data/jedenastki-kolejki.ts",
  `${naglowek}\nexport const JEDENASTKI_KOLEJEK: WyborKolejki[] = ${JSON.stringify(wpisy, null, 2)};\n`);

console.log(`Zapisano src/data/jedenastki-kolejki.ts: ${wpisy.length} wyborów.`);
for (const [liga, numery] of Object.entries(kolejkiLigi)) {
  const moje = wpisy.filter((w) => w.liga === liga);
  const licz = {};
  moje.forEach((w) => { const k = w.nazwisko + "|" + w.klub; licz[k] = (licz[k] || 0) + 1; });
  const trzy = Object.entries(licz).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  console.log(`\n${liga}: ${moje.length} wyborów z ${numery.length} kolejek, ${Object.keys(licz).length} zawodników`);
  console.log(`  złota gwiazdka (3+): ${trzy.length ? trzy.map(([k, n]) => k.split("|")[0] + " " + n + "x").join(", ") : "nikt"}`);
}
