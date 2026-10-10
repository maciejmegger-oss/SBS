// PRZENIESIENIE ARKUSZA „Szwecja_Norwegia_Akademie_Kontakty.xlsx" DO APLIKACJI.
//
// Kontakty do szefów i koordynatorów akademii w 2. i 3. lidze szwedzkiej (Superettan, Ettan) i norweskiej
// (OBOS-ligaen, PostNord-ligaen) — do aplikowania na stanowisko dyrektora / koordynatora akademii.
// Pokazujemy je w Kontakty → Europa obok bazy scoutingowej, ale trzymamy w osobnym pliku: arkusz
// scoutingowy generuje src/data/kontakty-europa.ts od nowa i nadpisałby dopisane tam wiersze.
//
// Uruchomienie (po każdej zmianie w arkuszu):
//   node scripts/wczytaj-akademie-skandynawia.mjs [ścieżka do pliku]
import fs from "node:fs";
import * as XLSX from "xlsx";

const plik = process.argv[2] || "Szwecja_Norwegia_Akademie_Kontakty.xlsx";
if (!fs.existsSync(plik)) { console.error(`Nie ma pliku: ${plik}`); process.exit(1); }

const skoroszyt = XLSX.read(fs.readFileSync(plik), { type: "buffer" });
const tekst = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

const wpisy = ["Szwecja", "Norwegia"].flatMap((nazwa) => {
  const ark = skoroszyt.Sheets[nazwa];
  if (!ark) { console.error(`Brak arkusza „${nazwa}"`); process.exit(1); }
  return XLSX.utils.sheet_to_json(ark, { defval: "" }).map((w) => {
    const osoba = tekst(w["Osoba"]);
    const mail = tekst(w["E-mail"]);
    const uwagi = tekst(w["Uwagi"]);
    // Bez nazwiska adres jest ogólnym kontaktem klubu (kansli@, post@) — idzie do kolumny klubu,
    // żeby widok nie udawał, że to mail konkretnej osoby. Adnotacja „ukryty…" zostaje przy osobie.
    const ogolny = !osoba && /@/.test(mail);
    return {
      kraj: tekst(w["Kraj"]) || nazwa,
      liga: tekst(w["Liga"]),
      klub: tekst(w["Klub"]),
      osoba,
      stanowisko: tekst(w["Stanowisko"]),
      obszar: `Akademia · ${tekst(w["Liga"])}`,
      email: ogolny ? "" : mail,
      emailKlubu: ogolny ? mail : "",
      telefon: tekst(w["Telefon"]),
      zrodlo: tekst(w["Źródło"]),
      // Priorytet 1 = klub właśnie szuka szefa akademii (★ w arkuszu).
      priorytet: uwagi.includes("★") ? 1 : null,
      status: tekst(w["Status"]),
      uwagi,
    };
  });
}).filter((k) => k.klub);

const ligi = [...new Set(wpisy.map((k) => k.liga))];
const tresc = `// KONTAKTY DO AKADEMII — SZWECJA I NORWEGIA (2. i 3. poziom) — wygenerowane z arkusza, NIE POPRAWIAJ RĘCZNIE.
//
// Źródło: ${plik.replace(/\\/g, "/").split("/").pop()} (arkusze „Szwecja" i „Norwegia").
// Po zmianie w arkuszu uruchom: node scripts/wczytaj-akademie-skandynawia.mjs "<ścieżka do pliku>"
// Stan na dzień przeniesienia: ${new Date().toISOString().slice(0, 10)} · ${wpisy.length} klubów, ligi: ${ligi.join(", ")}.

import type { KontaktEuropa } from "./kontakty-europa";

export type KontaktAkademii = KontaktEuropa & { liga: string; telefon: string };

export const KONTAKTY_AKADEMIE: KontaktAkademii[] = ${JSON.stringify(wpisy, null, 2)};
`;
fs.writeFileSync("src/data/akademie-skandynawia.ts", tresc);
console.log(`Zapisano ${wpisy.length} wpisów (${ligi.length} lig) → src/data/akademie-skandynawia.ts`);
