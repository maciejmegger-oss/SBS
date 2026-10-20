// JEDENASTKI KOLEJEK BETCLIC 2 LIGI → src/data/jedenastki-kolejki.ts
//
// Zgłoszenie (20.10.2026): „sprawdź jedenastki kolejek na poziomie 2 ligi i wprowadź tych
// zawodników na mapę pozycji; wyróżnij na złoto, jeśli zawodnik był 3 x w jedenastce kolejki".
//
// Źródło: pilkanozna.pl, cykl „jedenastka N. kolejki Betclic 2 Ligi". Wydawca podaje nazwisko
// i skrót klubu („Hebel (Stal)"), więc skróty rozwijamy tu, na podstawie składu ligi z 90minut —
// w bazie SBS kluby są pod pełnymi nazwami i inaczej nic by się nie dopasowało.
//
// Uruchomienie:  node scripts/zbuduj-jedenastki-kolejki.mjs <plik.json>
import fs from "node:fs";

// Osiemnaście drużyn Betclic 2 Ligi 2026/27 (90minut.pl, tabela po 12. kolejce). Każdy skrót
// używany przez wydawcę wskazuje dokładnie jeden z nich — gdyby doszedł drugi „Górnik" albo
// drugi „Stal", to mapowanie trzeba będzie rozstrzygać inaczej niż po samym skrócie.
const KLUBY = {
  "GKS": "GKS Tychy",
  "Znicz": "Znicz Pruszków",
  "Górnik": "Górnik Łęczna",
  "Sandecja": "Sandecja Nowy Sącz",
  "Podhale": "Podhale Nowy Targ",
  "Olimpia": "Olimpia Grudziądz",
  "Hutnik": "Hutnik Kraków",
  "Chojniczanka": "Chojniczanka Chojnice",
  "Rekord": "Rekord Bielsko-Biała",
  "Avia": "Avia Świdnik",
  "Lechia": "Lechia Zielona Góra",
  "Zawisza": "Zawisza Bydgoszcz",
  "Stal": "Stal Stalowa Wola",
  "Legia II": "Legia II Warszawa",
  "Śląsk II": "Śląsk II Wrocław",
  "Sokół": "Sokół Kleczew",
  "Świt": "Świt Szczecin",
  "Resovia": "Resovia",
};

const dane = JSON.parse(fs.readFileSync(process.argv[2] || "jedenastki.json", "utf8"));
const kolejki = Object.keys(dane).map(Number).sort((a, b) => a - b);

const wpisy = [];
const nieznane = new Set();
for (const nr of kolejki) {
  const k = dane[String(nr)];
  for (const [nazwa, skrot] of k.g) {
    const klub = KLUBY[skrot];
    if (!klub) { nieznane.add(skrot); continue; }
    const czesci = nazwa.trim().split(/\s+/);
    wpisy.push({
      kolejka: nr,
      data: k.data,
      // Jednoczłonowe pseudonimy (np. „Marcinho") zostają w nazwisku, imię puste.
      imie: czesci.length > 1 ? czesci.slice(0, -1).join(" ") : "",
      nazwisko: czesci[czesci.length - 1],
      klub,
      zrodlo: k.link,
    });
  }
}
if (nieznane.size) { console.error("Nierozpoznane skróty klubów: " + [...nieznane].join(", ")); process.exit(1); }

const naglowek = `// JEDENASTKI KOLEJEK BETCLIC 2 LIGI — wygenerowane, NIE POPRAWIAJ RĘCZNIE.
//
// Źródło: pilkanozna.pl, cykl „jedenastka N. kolejki Betclic 2 Ligi" (odnośnik przy każdym wpisie).
// Po dołożeniu kolejnej kolejki uruchom: node scripts/zbuduj-jedenastki-kolejki.mjs <plik.json>
//
// CZEGO TU NIE MA: kolejek 3, 8 i 9 sezonu 2026/27 — wydawca ich nie opublikował. Liczba
// wyróżnień jest więc z ${kolejki.length} kolejek, nie z ${Math.max(...kolejki)}, i tak jest opisana w aplikacji.
// Zestawienie obejmuje rundę jesienną: kolejki ${kolejki.join(", ")}.

export type WyborKolejki = {
  kolejka: number;
  data: string;      // data publikacji jedenastki
  imie: string;      // puste przy jednoczłonowym pseudonimie
  nazwisko: string;
  klub: string;      // pełna nazwa klubu, tak jak w bazie SBS
  zrodlo: string;
};

// Kolejki, z których liczone są wyróżnienia — potrzebne, żeby w aplikacji napisać „3 z 9",
// a nie „3 z 12", bo to byłaby nieprawda.
export const KOLEJKI_W_ZESTAWIENIU: number[] = ${JSON.stringify(kolejki)};
`;

fs.writeFileSync("src/data/jedenastki-kolejki.ts",
  `${naglowek}\nexport const JEDENASTKI_KOLEJEK: WyborKolejki[] = ${JSON.stringify(wpisy, null, 2)};\n`);

const licz = {};
wpisy.forEach((w) => { const k = w.nazwisko + "|" + w.klub; licz[k] = (licz[k] || 0) + 1; });
const trzy = Object.entries(licz).filter(([, n]) => n >= 3);
console.log(`Zapisano src/data/jedenastki-kolejki.ts: ${wpisy.length} wyborów z ${kolejki.length} kolejek.`);
console.log(`Zawodników z co najmniej trzema wyróżnieniami: ${trzy.length} — ${trzy.map(([k, n]) => k.split("|")[0] + " (" + n + ")").join(", ")}`);
