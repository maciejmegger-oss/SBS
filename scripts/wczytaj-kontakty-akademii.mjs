// PRZENIESIENIE ARKUSZY Z KONTAKTAMI DO AKADEMII (i scoutingu) W LIGACH ZAGRANICZNYCH DO APLIKACJI.
//
// Szefowie / koordynatorzy akademii (do aplikowania na stanowisko) i szefowie rekrutacji w klubach
// lig niższych i średnich: Szwecja i Norwegia (2.–3. poziom), Szkocja (SPFL). Pokazujemy je w
// Kontakty → Europa obok bazy scoutingowej, ale w osobnym pliku: arkusz scoutingowy generuje
// src/data/kontakty-europa.ts od nowa i nadpisałby dopisane tam wiersze.
//
// Każdy arkusz poza „Podsumowanie" to jeden kraj; kolumny: Kraj, Liga, Klub, Osoba, Stanowisko, E-mail,
// Telefon, Źródło, Status, Uwagi oraz opcjonalnie Rodzaj (Akademia / Scouting; brak = Akademia).
//
// Uruchomienie (po każdej zmianie w arkuszach):
//   node scripts/wczytaj-kontakty-akademii.mjs [plik.xlsx ...]
import fs from "node:fs";
import * as XLSX from "xlsx";

const pliki = process.argv.length > 2 ? process.argv.slice(2)
  : ["Szwecja_Norwegia_Akademie_Kontakty.xlsx", "Szkocja_Kontakty_Akademie_Scouting.xlsx", "Anglia_Kontakty_Rekrutacja.xlsx"];
const tekst = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

const wpisy = pliki.flatMap((plik) => {
  if (!fs.existsSync(plik)) { console.error(`Nie ma pliku: ${plik}`); process.exit(1); }
  const skoroszyt = XLSX.read(fs.readFileSync(plik), { type: "buffer" });
  return skoroszyt.SheetNames.filter((n) => !/podsumowanie/i.test(n)).map((nazwa) => [nazwa, skoroszyt.Sheets[nazwa]]);
}).flatMap(([nazwa, ark]) => {
  return XLSX.utils.sheet_to_json(ark, { defval: "" }).map((w) => {
    const osoba = tekst(w["Osoba"]);
    const mail = tekst(w["E-mail"]);
    const uwagi = tekst(w["Uwagi"]);
    // Bez nazwiska adres jest ogólnym kontaktem klubu (kansli@, post@) — idzie do kolumny klubu,
    // żeby widok nie udawał, że to mail konkretnej osoby. Adnotacja „ukryty…" zostaje przy osobie.
    const ogolny = !osoba && /@/.test(mail);
    const rodzaj = tekst(w["Rodzaj"]) || "Akademia";
    return {
      kraj: tekst(w["Kraj"]) || nazwa,
      liga: tekst(w["Liga"]),
      klub: tekst(w["Klub"]),
      osoba,
      stanowisko: tekst(w["Stanowisko"]),
      obszar: `${rodzaj} · ${tekst(w["Liga"])}`,
      email: ogolny ? "" : mail,
      emailKlubu: ogolny ? mail : "",
      telefon: tekst(w["Telefon"]),
      zrodlo: tekst(w["Źródło"]),
      // Priorytet 1 = klub właśnie szuka szefa akademii (★ w uwagach).
      priorytet: uwagi.includes("★") ? 1 : null,
      status: tekst(w["Status"]),
      uwagi,
    };
  });
}).filter((k) => k.klub);

const ligi = [...new Set(wpisy.map((k) => k.liga))];
const kraje = [...new Set(wpisy.map((k) => k.kraj))];
const tresc = `// KONTAKTY DO AKADEMII I SCOUTINGU W LIGACH ZAGRANICZNYCH — wygenerowane z arkuszy, NIE POPRAWIAJ RĘCZNIE.
//
// Źródło: ${pliki.map((p) => p.replace(/\\/g, "/").split("/").pop()).join(", ")}.
// Po zmianie w arkuszu uruchom: node scripts/wczytaj-kontakty-akademii.mjs [plik.xlsx ...]
// Stan na dzień przeniesienia: ${new Date().toISOString().slice(0, 10)} · ${wpisy.length} kontaktów, kraje: ${kraje.join(", ")}.

import type { KontaktEuropa } from "./kontakty-europa";

export type KontaktAkademii = KontaktEuropa & { liga: string; telefon: string };

export const KONTAKTY_AKADEMIE: KontaktAkademii[] = ${JSON.stringify(wpisy, null, 2)};
`;
fs.writeFileSync("src/data/kontakty-akademii.ts", tresc);
console.log(`Zapisano ${wpisy.length} wpisów (${kraje.join(", ")}; ${ligi.length} lig) → src/data/kontakty-akademii.ts`);
