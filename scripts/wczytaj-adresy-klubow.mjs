// PRZENIESIENIE ARKUSZA „Kluby_Polska_Adresy.xlsx" DO APLIKACJI.
//
// Adresy obiektów i oficjalne e-maile polskich klubów z bazy SBS zbieramy w Excelu (tam je
// poprawiasz i weryfikujesz), a aplikacja ma z nich tylko uzupełniać puste pola w Kontaktach.
// Ten skrypt zamienia arkusz na plik src/data/adresy-klubow.ts.
//
// Uruchomienie (po każdej zmianie w arkuszu):
//   node scripts/wczytaj-adresy-klubow.mjs Kluby_Polska_Adresy.xlsx
import fs from "node:fs";
import * as XLSX from "xlsx";

const plik = process.argv[2] || "Kluby_Polska_Adresy.xlsx";
if (!fs.existsSync(plik)) { console.error(`Nie ma pliku: ${plik}`); process.exit(1); }

const skoroszyt = XLSX.read(fs.readFileSync(plik), { type: "buffer" });
const arkusz = skoroszyt.Sheets["Adresy"];
if (!arkusz) { console.error("W pliku nie ma arkusza „Adresy”."); process.exit(1); }

const tekst = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

// Ten sam klub bywa w dwóch rozgrywkach (np. seniorzy w IV lidze i juniorzy w CLJ) — do
// aplikacji trafia raz, bo adres i e-mail należą do klubu, nie do ligi.
const widziane = new Set();
const adresy = XLSX.utils.sheet_to_json(arkusz, { defval: "" })
  .map((w) => ({
    liga: tekst(w["Liga / grupa"]),
    klub: tekst(w["Klub"]),
    miasto: tekst(w["Miasto"]),
    adres: tekst(w["Adres obiektu"]),
    email: tekst(w["E-mail klubu"]),
    zrodlo: tekst(w["Źródło"]),
    status: tekst(w["Status"]),
    uwagi: tekst(w["Uwagi"]),
  }))
  // Kluby bez adresu i e-maila też zostają — lista ma pokazywać, czego jeszcze brakuje.
  .filter((a) => a.klub)
  .filter((a) => !widziane.has(a.klub) && widziane.add(a.klub));

const naglowek = `// ADRESY OBIEKTÓW I E-MAILE POLSKICH KLUBÓW — wygenerowane z arkusza, NIE POPRAWIAJ RĘCZNIE.
//
// Źródło: ${plik.replace(/\\/g, "/").split("/").pop()} (arkusz „Adresy").
// Po zmianie w arkuszu uruchom: node scripts/wczytaj-adresy-klubow.mjs "<ścieżka do pliku>"
// Stan na dzień przeniesienia: ${new Date().toISOString().slice(0, 10)} · ${adresy.length} klubów.

export type AdresKlubu = {
  liga: string;    // rozgrywki, w których klub jest w bazie SBS (pierwsze, jeśli jest w dwóch)
  klub: string;    // nazwa dokładnie jak w bazie klubów SBS
  miasto: string;
  adres: string;   // adres obiektu, na którym klub gra mecze
  email: string;   // oficjalny kontakt klubu — pusty, gdy klub go nie publikuje
  zrodlo: string;  // strona, z której wzięto dane
  status: string;  // Zweryfikowany / Częściowo / Do potwierdzenia / Do uzupełnienia
  uwagi: string;
};
`;

fs.writeFileSync(
  "src/data/adresy-klubow.ts",
  `${naglowek}\nexport const ADRESY_KLUBOW: AdresKlubu[] = ${JSON.stringify(adresy, null, 2)};\n`,
);
console.log(`Zapisano src/data/adresy-klubow.ts: ${adresy.length} klubów `
  + `(${adresy.filter((a) => a.adres).length} z adresem, ${adresy.filter((a) => a.email).length} z e-mailem).`);
