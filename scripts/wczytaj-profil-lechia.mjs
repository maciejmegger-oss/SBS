// PROFIL KOMPETENCJI Z ARKUSZA KLUBOWEGO („Nazwisko-U19.xlsx", Lechia Gdańsk).
//
// PO CO TO JEST
// Trener prowadzi ocenę zawodnika w arkuszu: pięć obszarów, w każdym elementy z oceną 1–6, a pod
// elementem składowe oznaczone WIODĄCA / NEUTRALNIE / DEFICYT. Do tego notowanie 1–21 (stan
// faktyczny i potencjał), frekwencja, dorobek meczowy i karta oceny dla zawodnika. To gotowy,
// przemyślany model — SBS ma go czytać, a nie zmuszać do przepisywania ręcznie.
//
// CO ROBI SKRYPT
//   * --taksonomia  → zapisuje src/data/profil-kompetencji.ts (same nazwy obszarów, elementów
//                     i składowych + legendy). Szkielet jest w każdym pliku taki sam.
//   * bez przełącznika → wypisuje wypełniony profil jednego zawodnika jako JSON i zapisuje go
//                     obok, do wgrania do systemu.
//
// Uruchomienie:
//   node scripts/wczytaj-profil-lechia.mjs "F:\\…\\Bartosz Szczepankiewicz-U19.xlsx"
//   node scripts/wczytaj-profil-lechia.mjs "F:\\…\\Bartosz Szczepankiewicz-U19.xlsx" --taksonomia
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const plik = process.argv[2];
const taksonomia = process.argv.includes("--taksonomia");
if (!plik || !fs.existsSync(plik)) { console.error(`Nie ma pliku: ${plik}`); process.exit(1); }

const wb = XLSX.read(fs.readFileSync(plik), { type: "buffer", cellDates: false });
const tekst = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const kom = (ws, r, c) => { const k = ws[XLSX.utils.encode_cell({ r, c })]; return k ? k.v : ""; };
const liczba = (v) => { const n = Number(v); return Number.isFinite(n) && tekst(v) !== "" ? n : null; };
// Excel trzyma daty jako liczbę dni od 30.12.1899.
const data = (v) => {
  const n = liczba(v);
  if (n === null || n < 1000) return tekst(v);
  return new Date(Date.UTC(1899, 11, 30 + n)).toISOString().slice(0, 10);
};

// ──────────────────────────────────────────────────────────────────────────────────────────────
// OBSZARY Z OCENAMI — cztery arkusze mają identyczny układ: nazwa elementu w kolumnie A, „OCENA"
// w D, ocena w wierszu poniżej, a składowe w blokach po cztery kolumny (nazwa + znak N/W/D).
const OBSZARY = [
  { arkusz: "KONCEPTY OFENSYWA",  nazwa: "Koncepty — ofensywa" },
  { arkusz: "KONCEPTY DEFENSYWA", nazwa: "Koncepty — defensywa" },
  { arkusz: "U. TECHNICZNE",      nazwa: "Umiejętności techniczne" },
  { arkusz: "ATRYBUTY FIZYCZNE",  nazwa: "Atrybuty fizyczne" },
];

function parsujObszar(ws) {
  const zakres = XLSX.utils.decode_range(ws["!ref"]);
  const elementy = [];
  let wTestach = false;
  for (let r = 0; r <= zakres.e.r; r++) {
    if (/^TESTY MOTORYCZNE/i.test(tekst(kom(ws, r, 0)))) wTestach = true;
    if (tekst(kom(ws, r, 3)) !== "OCENA") continue;
    const nazwa = tekst(kom(ws, r, 0));
    if (!nazwa) continue;
    const skladowe = [];
    for (let c = 4; c <= zakres.e.c; c += 4) {
      if (!/SKŁADOWE/i.test(tekst(kom(ws, r, c)))) continue;
      for (const rr of [r + 1, r + 2]) {
        const n = tekst(kom(ws, rr, c));
        if (n) skladowe.push({ nazwa: n, znak: tekst(kom(ws, rr, c + 3)) });
      }
    }
    elementy.push({ nazwa, ocena: liczba(kom(ws, r + 1, 3)), testy: wTestach, skladowe });
  }
  return elementy;
}

// Średnia, liczba cech wiodących i deficytów — arkusz liczy je sam, wartość stoi pod podpisem.
function podsumowanieObszaru(ws) {
  const zakres = XLSX.utils.decode_range(ws["!ref"]);
  const szukaj = (wzor) => {
    for (let r = 0; r <= zakres.e.r; r++) {
      for (let c = 0; c <= Math.min(zakres.e.c, 8); c++) {
        if (!wzor.test(tekst(kom(ws, r, c)))) continue;
        for (let d = 1; d <= 3; d++) {
          const v = liczba(kom(ws, r + d, c));
          if (v !== null) return v;
        }
      }
    }
    return null;
  };
  return {
    srednia: szukaj(/^ŚREDNIA OCEN( \(ELEMENTY TRENING MECZ\))?$/i),
    wiodacych: szukaj(/^CECH WIODĄCYCH$/i),
    deficytow: szukaj(/^DEFICYTÓW$/i),
  };
}

// UMIEJĘTNOŚCI MENTALNE — inny układ: element, ocena i OPIS definiujący, co dana cecha znaczy.
// Dwie grupy (mecz/trening i pozameczowe) oraz elementy obligatoryjne bez oceny.
function parsujMentalne(ws) {
  const zakres = XLSX.utils.decode_range(ws["!ref"]);
  const grupy = [
    { nazwa: "Trening i mecz", kolElement: 0, kolOcena: 3, elementy: [] },
    { nazwa: "Poza meczem", kolElement: 7, kolOcena: 10, elementy: [] },
  ];
  for (const g of grupy) {
    for (let r = 0; r <= zakres.e.r; r++) {
      if (tekst(kom(ws, r, g.kolOcena)) !== "OCENA") continue;
      const nazwa = tekst(kom(ws, r, g.kolElement));
      if (!nazwa) continue;
      g.elementy.push({
        nazwa,
        ocena: liczba(kom(ws, r + 1, g.kolOcena)),
        opis: tekst(kom(ws, r + 1, g.kolOcena + 1)),
      });
    }
  }
  // Elementy podstawowe / obligatoryjne — bez oceny, są warunkiem, nie skalą.
  const obligatoryjne = [];
  for (let r = 0; r <= zakres.e.r; r++) {
    for (const c of [14, 17]) {
      const v = tekst(kom(ws, r, c));
      if (v && !/^ELEMENTY/i.test(v) && !obligatoryjne.includes(v)) obligatoryjne.push(v);
    }
  }
  return { grupy, obligatoryjne, ...podsumowanieObszaru(ws) };
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// INFORMACJE PODSTAWOWE — czytamy po etykietach, bo komórki są scalone i poukładane w kilka kolumn.
function parsujPodstawowe(ws) {
  const DO_WIERSZA = 34; // dalej są listy rozwijane arkusza, nie dane zawodnika
  const zakres = XLSX.utils.decode_range(ws["!ref"]);
  const doKonca = Math.min(zakres.e.c, 25);
  const poEtykiecie = (wzor) => {
    for (let r = 0; r < DO_WIERSZA; r++) {
      for (let c = 0; c <= doKonca; c++) {
        if (!wzor.test(tekst(kom(ws, r, c)))) continue;
        for (let d = 1; d <= 4 && c + d <= doKonca; d++) {
          // Kolumny M i N to drabina notowania na prawym skraju arkusza. Etykieta z lewej strony
          // nie ma tam swojej wartości — bez tej granicy „Nieobecny nieuspr." brał stopień z drabiny.
          if (c < 12 && c + d >= 12) break;
          const v = tekst(kom(ws, r, c + d));
          if (v) return v;
        }
      }
    }
    return "";
  };
  // Notowanie 1–21: w kolumnie M stopień, w N opis, a „+" w T zaznacza stan faktyczny, w U potencjał.
  const drabina = [];
  let stan = null, potencjal = null;
  for (let r = 0; r < DO_WIERSZA; r++) {
    const stopien = liczba(kom(ws, r, 12));
    const opis = tekst(kom(ws, r, 13));
    if (stopien === null || !opis) continue;
    drabina.push({ stopien, opis });
    if (tekst(kom(ws, r, 19))) stan = { stopien, opis };
    if (tekst(kom(ws, r, 20))) potencjal = { stopien, opis };
  }
  // Dorobek meczowy — do trzech poziomów rozgrywkowych, każdy w swoim bloku.
  const mecze = [];
  for (let r = 0; r < DO_WIERSZA; r++) {
    if (!/^POZIOM ROZGRYWKOWY/i.test(tekst(kom(ws, r, 6)))) continue;
    const poziom = tekst(kom(ws, r, 9)) || tekst(kom(ws, r, 10));
    const wBloku = (wzor, kol) => {
      for (let d = 0; d <= 6; d++) for (const c of kol) {
        if (wzor.test(tekst(kom(ws, r + d, c)))) {
          const v = liczba(kom(ws, r + d, c + 1));
          if (v !== null) return v;
        }
      }
      return null;
    };
    const wpis = {
      poziom,
      lacznie: wBloku(/^Łączna ilość/i, [6, 7]),
      podstawa: wBloku(/^Podstawa$/i, [8]),
      rezerwa: wBloku(/^Rezerwa$/i, [8]),
      poza18: wBloku(/^Poza/i, [8]),
      minuty: wBloku(/^Czas gry/i, [10]),
      bramki: wBloku(/^Bramki$/i, [10]),
      asysty: wBloku(/^Asysty$/i, [10]),
    };
    // Arkusz ma trzy bloki na trzy poziomy rozgrywkowe; puste pomijamy, żeby profil nie pokazywał
    // „A1 MAKROREGION — 0 meczów" obok tego samego poziomu z prawdziwym dorobkiem.
    if (wpis.lacznie || wpis.minuty) mecze.push(wpis);
  }
  return {
    zawodnik: tekst(kom(ws, 5, 0)),
    zespol: poEtykiecie(/^Zespół$/i),
    sezon: poEtykiecie(/^Sezon$/i),
    runda: poEtykiecie(/^Runda$/i),
    dataRaportu: data(poEtykiecie(/^Data raportu$/i)),
    trener: tekst(kom(ws, 5, 2)),
    trenerWspomagajacy: tekst(kom(ws, 8, 2)),
    poziomZespolu: poEtykiecie(/^Poziom rozgrywkowy drużyny$/i),
    profil: poEtykiecie(/^PROFIL$/i),
    alternatywaProfilu: poEtykiecie(/^Alternatywa profilu$/i),
    dataUrodzenia: data(poEtykiecie(/^Data urodzenia$/i)),
    wzrost: liczba(poEtykiecie(/^Wysokośc ciała/i)),
    masa: liczba(poEtykiecie(/^Masa ciała/i)),
    noga: poEtykiecie(/^Noga dominująca$/i),
    somatotyp: poEtykiecie(/^Somatotyp/i),
    wiekBiologiczny: liczba(poEtykiecie(/^Wiek biologiczny$/i)),
    wiekMetrykalny: liczba(poEtykiecie(/^Wiek metrykalny$/i)),
    jednostkiTreningowe: liczba(poEtykiecie(/^Łączna liczna jednostek$/i)),
    frekwencja: {
      obecny: liczba(poEtykiecie(/^Obecny$/i)),
      nieobecnyUspr: liczba(poEtykiecie(/^Nieobecny uspr\./i)),
      nieobecnyNieuspr: liczba(poEtykiecie(/^Nieobecny nieuspr\./i)),
      chory: liczba(poEtykiecie(/^Chory$/i)),
    },
    notowanie: { stan, potencjal, drabina },
    mecze,
  };
}

// KARTA OCENY — to, co zawodnik dostaje do ręki: mocne strony i „co mogę robić lepiej".
function parsujKarte(ws) {
  const zakres = XLSX.utils.decode_range(ws["!ref"]);
  const doKonca = Math.min(zakres.e.c, 20);
  const TYTULY = /^(KONCEPTY OFENSYWA|KONCEPTY DEFENSYWA|UMIEJĘTNOŚCI TECHNICZNE|UMIEJĘTNOŚCI MENTALNE|ATRYBUTY FIZYCZNE)$/i;
  const wpisy = [];
  // Karta mieści się w 17 wierszach; niżej arkusz trzyma listy rozwijane (sezony, rundy).
  for (let r = 0; r < 17; r++) {
    for (let c = 0; c <= doKonca; c++) {
      const etykieta = tekst(kom(ws, r, c));
      if (!/^(MOCNE STRONY|CO MOGĘ ROBIĆ LEPIEJ)$/i.test(etykieta)) continue;
      let obszar = "";
      for (let u = r - 1; u >= 0 && !obszar; u--) if (TYTULY.test(tekst(kom(ws, u, c)))) obszar = tekst(kom(ws, u, c));
      let element = "";
      for (let d = 0; d <= 3; d++) {
        const naz = tekst(kom(ws, r + d, c));
        if (d && /^(MOCNE STRONY|CO MOGĘ ROBIĆ LEPIEJ)$/i.test(naz)) break;
        element = tekst(kom(ws, r + d, c + 1)) || element;
        const tresc = tekst(kom(ws, r + d, c + 2));
        if (tresc) wpisy.push({ obszar, rodzaj: /MOCNE/i.test(etykieta) ? "mocne" : "doPoprawy", element, tresc });
      }
    }
  }
  return wpisy;
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
const profil = { zrodlo: path.basename(plik), ...parsujPodstawowe(wb.Sheets["INFORMACJE PODSTAWOWE"]) };
profil.obszary = OBSZARY.map((o) => ({
  nazwa: o.nazwa,
  ...podsumowanieObszaru(wb.Sheets[o.arkusz]),
  elementy: parsujObszar(wb.Sheets[o.arkusz]),
}));
const mentalne = parsujMentalne(wb.Sheets["U. MENTALNE"]);
profil.obszary.splice(3, 0, {
  nazwa: "Umiejętności mentalne",
  srednia: mentalne.srednia, wiodacych: mentalne.wiodacych, deficytow: mentalne.deficytow,
  elementy: mentalne.grupy.flatMap((g) => g.elementy.map((e) => ({ ...e, grupa: g.nazwa, skladowe: [] }))),
  obligatoryjne: mentalne.obligatoryjne,
});
profil.karta = parsujKarte(wb.Sheets["KARTA OCENY"]);

if (!taksonomia) {
  const cel = path.join(process.cwd(), "profil-" + path.basename(plik).replace(/\.xlsx?$/i, "") + ".json");
  fs.writeFileSync(cel, JSON.stringify(profil, null, 2), "utf8");
  console.log(JSON.stringify(profil, null, 2));
  console.log(`\nZapisane: ${cel}`);
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────────────────────────────────────
// TAKSONOMIA — szkielet oceny bez ocen konkretnego zawodnika.
const legenda = (() => {
  const ws = wb.Sheets["KONCEPTY OFENSYWA"];
  const zakres = XLSX.utils.decode_range(ws["!ref"]);
  const poziomy = [];
  for (let r = 0; r <= zakres.e.r; r++) {
    const st = liczba(kom(ws, r, 3));
    const opis = tekst(kom(ws, r, 4));
    if (st !== null && st >= 1 && st <= 6 && /^ZAWODNIK/i.test(opis)) poziomy.push({ stopien: st, opis });
  }
  return poziomy.sort((a, b) => b.stopien - a.stopien);
})();

const wiersz = (o) => JSON.stringify(o);
const ts = `// PROFIL KOMPETENCJI — szkielet oceny zawodnika przeniesiony z arkusza klubowego.
//
// NIE POPRAWIAJ RĘCZNIE. Plik powstaje z arkusza „Nazwisko-U19.xlsx":
//   node scripts/wczytaj-profil-lechia.mjs "<plik.xlsx>" --taksonomia
//
// Model: pięć obszarów → elementy z oceną 1–6 → składowe oznaczone WIODĄCA / NEUTRALNIE / DEFICYT.
// Ocena elementu mówi o poziomie, znak składowej — co dokładnie ten poziom tworzy.

export type ZnakSkladowej = 'WIODĄCA' | 'NEUTRALNIE' | 'DEFICYT';

export interface ElementProfilu { nazwa: string; skladowe: string[]; grupa?: string; testy?: boolean; opis?: string }
export interface ObszarProfilu { nazwa: string; elementy: ElementProfilu[]; obligatoryjne?: string[] }

/** Skala 1–6 wspólna dla wszystkich obszarów — tak nazywa poziomy arkusz klubowy. */
export const LEGENDA_OCENY: { stopien: number; opis: string }[] = [
${legenda.map((l) => "  " + wiersz(l) + ",").join("\n")}
];

/** Notowanie 1–21: jedna drabina od „pierwsza jedenastka U12" do „kluczowy zawodnik na poziomie CL".
 *  Trener zaznacza na niej DWA stopnie: stan faktyczny i potencjał. */
export const DRABINA_NOTOWANIA: { stopien: number; opis: string }[] = [
${profil.notowanie.drabina.sort((a, b) => b.stopien - a.stopien).map((d) => "  " + wiersz(d) + ",").join("\n")}
];

export const OBSZARY_PROFILU: ObszarProfilu[] = [
${profil.obszary.map((o) => `  {
    nazwa: ${JSON.stringify(o.nazwa)},${o.obligatoryjne ? `\n    obligatoryjne: ${JSON.stringify(o.obligatoryjne)},` : ""}
    elementy: [
${o.elementy.map((e) => `      { nazwa: ${JSON.stringify(e.nazwa)}`
    + (e.grupa ? `, grupa: ${JSON.stringify(e.grupa)}` : "")
    + (e.testy ? ", testy: true" : "")
    + (e.opis ? `, opis: ${JSON.stringify(e.opis)}` : "")
    + `, skladowe: ${JSON.stringify(e.skladowe.map((s) => s.nazwa))} },`).join("\n")}
    ],
  },`).join("\n")}
];

/** Ile w sumie elementów i składowych — do podpisu pod profilem. */
export const ILE_ELEMENTOW = ${profil.obszary.reduce((s, o) => s + o.elementy.length, 0)};
export const ILE_SKLADOWYCH = ${profil.obszary.reduce((s, o) => s + o.elementy.reduce((t, e) => t + e.skladowe.length, 0), 0)};
`;
fs.writeFileSync("src/data/profil-kompetencji.ts", ts, "utf8");
console.log(`Zapisane: src/data/profil-kompetencji.ts`);
console.log(`Obszary: ${profil.obszary.map((o) => `${o.nazwa} (${o.elementy.length} el.)`).join(", ")}`);
console.log(`Elementów ${profil.obszary.reduce((s, o) => s + o.elementy.length, 0)}, składowych ${profil.obszary.reduce((s, o) => s + o.elementy.reduce((t, e) => t + e.skladowe.length, 0), 0)}.`);
