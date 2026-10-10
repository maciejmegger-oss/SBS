// Sprawdza PODSUMOWANIE OBSERWACJI do schowka — czyli to, co scout wysyła dalej po meczu.
//
// Zgloszenie: "mozesz z tego zrobic analize zawodnikow, ktorych wyroznilem, wraz z policzonymi
// statystykami zgodnymi z panelem tagowania". Panel liczyl zdarzenia od dawna, ale wszystko
// zostawalo w telefonie: zeby cokolwiek z tym zrobic, trzeba bylo przepisywac z ekranu albo
// robic serie zrzutow.
//
// NAJWAZNIEJSZE: liczby w tekscie musza byc DOKLADNIE te, ktore pokazuje panel. Podsumowanie,
// ktore liczy po swojemu, jest gorsze niz jego brak — wyglada na dane, a nie zgadza sie z tym,
// co scout widzial na ekranie.
//
// Uruchomienie:  node scripts/test-podsumowanie-obserwacji.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const panel = fs.readFileSync("src/mobile/main.ts", "utf8");

let bledy = 0;
const spr = (opis, w, dod = "") => {
  console.log(`${w ? "  OK  " : " BŁĄD "} ${opis}${w ? "" : "   " + dod}`);
  if (!w) bledy++;
};

const kod = panel.match(/function podsumowanieObserwacji\([\s\S]*?\n\}/)[0];

// Zdarzenia jak z prawdziwego meczu: czesc przy nazwisku, czesc przy samej druzynie,
// jedno stare z biegunem (sprzed usuniecia przelacznika "udane/nieudane").
const zdarzenia = [
  { minute: 3, label: "Podanie", type: "podanie", quality: 1, zawodnik: "80 Filip Mosek", druzyna: "gospodarze" },
  { minute: 5, label: "Dośrodkowanie", type: "dosrodkowanie", quality: 1, zawodnik: "80 Filip Mosek", druzyna: "gospodarze" },
  { minute: 9, label: "Dośrodkowanie", type: "dosrodkowanie", quality: 1, zawodnik: "80 Filip Mosek", druzyna: "gospodarze" },
  { minute: 12, label: "Strzał", type: "strzal", quality: -1, zawodnik: "80 Filip Mosek", druzyna: "gospodarze", note: "z 18 metrów" },
  { minute: 21, label: "Rzut rożny — atak", type: "rzut_rozny_atak", quality: 1, druzyna: "gospodarze" },
  { minute: 30, label: "Aut", type: "out", quality: 1, druzyna: "goscie" },
  { minute: 44, label: "Gol", type: "gol", quality: 1, zawodnik: "7 Łukasz Seweryn", druzyna: "goscie" },
];

const obs = {
  id: "obs1",
  match: "Chojniczanka Chojnice - Podhale Nowy Targ",
  date: "2026-10-09",
  matchTime: "17:00",
  scout: "Maciej",
  rozgrywki: "Betclic 2 Liga",
  poziomMeczu: 7,
  warunki: ["deszcz"],
  notatkaMeczu: "Mecz na jedną bramkę.",
  skladMeczu: {
    gospodarze: {
      nazwa: "Chojniczanka Chojnice",
      formacja: "1-4-3-3",
      zawodnicy: [
        { nazwa: "Filip Mosek", numer: "80", wyrozniony: true, pozycja: 11, noga: "lewa",
          ocena: { technika: 7, glowaAtak: 5 }, fazy: { pomPodania: 4 }, sfg: { rzutRoznyAtak: 3 },
          notatka: "Szybki, słaby powrót.", status: "obserwować" },
        { nazwa: "Hubert Sobol", numer: "9" },   // nic nieoznaczone — nie ma po co być w tekście
      ],
    },
    goscie: {
      nazwa: "Podhale Nowy Targ",
      zawodnicy: [{ nazwa: "Łukasz Seweryn", numer: "7", wyrozniony: true }],
    },
  },
};

const tekst = new Function(
  "zdarzeniaObserwacji", "druzynyZMeczu", "STRONY", "kluczZawodnika", "POZYCJE_PELNE",
  "OCENA_MAPY", "OCENA_GLOWA", "RATING_LABELS", "fazyDla", "grupaZawodnika",
  "REPORT_SET_PIECES", "dataZDniem", "obs", `
  ${transformSync(kod, { loader: "ts" }).code}
  return podsumowanieObserwacji(obs);
`)(
  () => zdarzenia,
  (m) => String(m || "").split(" - "),
  ["gospodarze", "goscie"],
  (z) => (z.numer ? z.numer + " " : "") + z.nazwa,
  { 11: "Lewe skrzydło" },
  ["technika", "taktyka", "motoryka"],
  [{ key: "glowaAtak", label: "Gra głową — atak" }],
  { technika: "Technika", taktyka: "Taktyka", motoryka: "Motoryka" },
  () => [{ key: "pomPodania", label: "Podania" }],
  () => "pomocnik",
  [{ key: "rzutRoznyAtak", label: "Rzut rożny — atak" }],
  (d) => d,
  obs,
);

console.log("Co stoi w podsumowaniu");
{
  spr("mecz w pierwszej linijce", tekst.split("\n")[0] === "Chojniczanka Chojnice - Podhale Nowy Targ", tekst.split("\n")[0]);
  spr("data, godzina, rozgrywki i scout", /2026-10-09 · 17:00 · Betclic 2 Liga · scout: Maciej/.test(tekst));
  spr("poziom meczu", /Poziom meczu: 7\/10/.test(tekst));
  spr("warunki", /Warunki: deszcz/.test(tekst));
  spr("charakterystyka meczu", /Charakterystyka meczu: Mecz na jedną bramkę\./.test(tekst));
  spr("obie drużyny mają nagłówek",
    /== Chojniczanka Chojnice ==/.test(tekst) && /== Podhale Nowy Targ ==/.test(tekst));
  spr("system gry, gdy wskazany", /System gry: 1-4-3-3/.test(tekst));
}

console.log("\nLiczby zgodne z panelem");
{
  // Dwa dosrodkowania to "Dośrodkowanie 2", nie dwa osobne wiersze.
  spr("zdarzenia zawodnika policzone", /Zdarzenia:.*Dośrodkowanie 2/.test(tekst), tekst);
  spr("podanie policzone raz", /Zdarzenia:.*Podanie 1/.test(tekst));
  // Stare zdarzenia z biegunem maja zostac rozpoznawalne — inaczej dawne "nieudane" wpadlyby
  // do jednego worka z udanymi.
  spr("dawne nieudane osobno", /Strzał − 1/.test(tekst), tekst);
  // Zdarzenie bez nazwiska nalezy do DRUZYNY, nie do nikogo.
  spr("zdarzenia drużyny osobno", /Zespół \(zdarzenia bez nazwiska\): Rzut rożny — atak 1/.test(tekst));
  spr("druga drużyna ma swoje", /Zespół \(zdarzenia bez nazwiska\): Aut 1/.test(tekst));
  // Gol padl przy nazwisku gosci — nie moze wejsc do worka druzyny.
  spr("gol stoi przy nazwisku", /7 Łukasz Seweryn[\s\S]{0,80}Zdarzenia: Gol 1/.test(tekst));
}

console.log("\nZawodnik: wszystko, co o nim wiadomo");
{
  spr("wyróżniony oznaczony gwiazdką", /★ 80 Filip Mosek/.test(tekst));
  spr("pozycja z planszy", /Lewe skrzydło/.test(tekst));
  spr("noga", /noga lewa/.test(tekst));
  spr("ocena 1–10", /Ocena: Technika 7\/10 · Gra głową — atak 5\/10/.test(tekst));
  spr("protokół 1–6 razem ze stałymi fragmentami",
    /Protokół: Podania 4\/6 · Rzut rożny — atak 3\/6/.test(tekst));
  spr("decyzja", /Decyzja: obserwować/.test(tekst));
  spr("notatka", /Notatka: Szybki, słaby powrót\./.test(tekst));
  // Zawodnik bez jednego znaku zapisu nie ma po co zajmowac miejsca w tekscie.
  spr("nieoznaczony zawodnik nie zaśmieca", !/Hubert Sobol/.test(tekst));
}

console.log("\nPrzebieg meczu");
{
  // Z samej sumy nie da sie powiedziec, KIEDY cos sie dzialo — a to pierwsze pytanie przy analizie.
  spr("jest oś zdarzeń z minutami", /== Przebieg · 7 zdarzeń ==/.test(tekst));
  spr("minuta, kto i co", /12' 80 Filip Mosek · Strzał − — z 18 metrów/.test(tekst), tekst);
  spr("zdarzenie bez nazwiska opisane drużyną", /21' Chojniczanka Chojnice · Rzut rożny — atak/.test(tekst));
}

console.log("\nPrzycisk w panelu");
{
  spr("podgląd ma przycisk kopiowania", /data-act="kopiuj-podsumowanie"/.test(panel));
  spr("przycisk jest obsłużony", /case "kopiuj-podsumowanie":/.test(panel));
  spr("pisze do schowka", /navigator\.clipboard\.writeText\(tekst\)/.test(panel));
  // Gdy przegladarka schowka nie odda, tekst ma byc gdzie zaznaczyc recznie.
  spr("bez schowka zostaje okno z tekstem", /window\.prompt\("Skopiuj podsumowanie:", tekst\)/.test(panel));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy ? 1 : 0);
