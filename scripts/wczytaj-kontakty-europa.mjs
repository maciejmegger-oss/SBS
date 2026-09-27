// PRZENIESIENIE ARKUSZA „Kluby_Europa_Kontakty_Scouting.xlsx" DO APLIKACJI.
//
// Baza kontaktów europejskich powstaje w Excelu (tam ją uzupełniasz i weryfikujesz), a SBS ma ją
// tylko pokazywać. Ten skrypt zamienia arkusz na plik src/data/kontakty-europa.ts — dzięki temu
// dane jadą razem z aplikacją, działają bez internetu i nie zajmują miejsca w bazie.
//
// Uruchomienie (po każdej zmianie w arkuszu):
//   node scripts/wczytaj-kontakty-europa.mjs "F:\\Scouting\\Kluby_Europa_Kontakty_Scouting.xlsx"
import fs from "node:fs";
import * as XLSX from "xlsx";

const plik = process.argv[2] || "F:\\Scouting\\Kluby_Europa_Kontakty_Scouting.xlsx";
if (!fs.existsSync(plik)) { console.error(`Nie ma pliku: ${plik}`); process.exit(1); }

const skoroszyt = XLSX.read(fs.readFileSync(plik), { type: "buffer" });
const arkusz = (nazwa) => skoroszyt.Sheets[nazwa]
  ? XLSX.utils.sheet_to_json(skoroszyt.Sheets[nazwa], { defval: "" })
  : [];

const tekst = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

// Arkusz „Kontakty" — trzon bazy.
const kontakty = arkusz("Kontakty").map((w) => ({
  kraj: tekst(w["Kraj"]),
  klub: tekst(w["Klub"]),
  osoba: tekst(w["Osoba"]),
  stanowisko: tekst(w["Stanowisko"]),
  obszar: tekst(w["Obszar działania"]),
  email: tekst(w["E-mail osoby (zweryfikowany)"]),
  emailKlubu: tekst(w["Oficjalny kontakt klubu"]),
  zrodlo: tekst(w["Źródło"]),
  priorytet: Number(w["Priorytet (1–3)"]) || null,
  status: tekst(w["Status weryfikacji"]),
  uwagi: tekst(w["Uwagi"]),
}));

// Arkusze-korekty (np. „Beşiktaş – korekta") mają własny układ i brak kolumny z krajem.
// Kraj bierzemy z nazwy arkusza tam, gdzie da się go rozpoznać; inaczej zostaje pusty
// i wpis trafia do grupy „Pozostałe" — lepiej to niż przypisanie go do złego kraju.
const KRAJ_Z_ARKUSZA = [[/beşiktaş|besiktas|fenerbah|galatasaray/i, "Turcja"]];
const korekty = skoroszyt.SheetNames
  .filter((n) => /korekta/i.test(n))
  .flatMap((nazwa) => {
    const kraj = (KRAJ_Z_ARKUSZA.find(([w]) => w.test(nazwa)) || [null, ""])[1];
    return arkusz(nazwa).map((w) => ({
      kraj,
      klub: tekst(w["Klub"]),
      osoba: tekst(w["Osoba"]),
      stanowisko: tekst(w["Stanowisko"]),
      obszar: tekst(w["Obszar działania"]),
      email: tekst(w["E-mail osoby"]),
      emailKlubu: "",
      zrodlo: tekst(w["Źródło"]),
      priorytet: Number(w["Priorytet (1–3)"]) || null,
      status: tekst(w["Status weryfikacji"]),
      uwagi: tekst(w["Uwagi"]),
    }));
  });

const wszystkie = [...kontakty, ...korekty].filter((k) => k.klub && k.osoba);
const kraje = [...new Set(wszystkie.map((k) => k.kraj).filter(Boolean))];

const naglowek = `// BAZA KONTAKTÓW KLUBÓW EUROPEJSKICH — wygenerowana z arkusza, NIE POPRAWIAJ RĘCZNIE.
//
// Źródło: ${plik.replace(/\\/g, "/").split("/").pop()} (arkusz „Kontakty" + arkusze korekt).
// Po zmianie w arkuszu uruchom: node scripts/wczytaj-kontakty-europa.mjs "<ścieżka do pliku>"
// Stan na dzień przeniesienia: ${new Date().toISOString().slice(0, 10)} · ${wszystkie.length} kontaktów, ${kraje.length} krajów.

export type KontaktEuropa = {
  kraj: string;
  klub: string;
  osoba: string;
  stanowisko: string;
  obszar: string;
  email: string;        // e-mail osoby, gdy klub go publikuje
  emailKlubu: string;   // ogólny kontakt klubu — zapasowa droga
  zrodlo: string;       // strona, z której wzięto dane (do sprawdzenia przed wysyłką)
  priorytet: number | null;
  status: string;
  uwagi: string;
};

export const KONTAKTY_EUROPA: KontaktEuropa[] = `;

fs.writeFileSync("src/data/kontakty-europa.ts", naglowek + JSON.stringify(wszystkie, null, 2) + ";\n", "utf8");
console.log(`src/data/kontakty-europa.ts: ${wszystkie.length} kontaktów, kraje: ${kraje.join(", ")}`);
