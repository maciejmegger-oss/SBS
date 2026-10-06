// Sprawdza, że karta rezerw nie pokazuje dorobku pierwszej drużyny.
//
// Zgłoszenie (06.10.2026): „Korona 2 Kielce ma 20 meczów, chyba zsumowało z Ekstraklasą".
// Tak było: gdy w tabeli III ligi nie znajdzie się wiersz rezerw, liczba rozegranych kolejek
// brana była z kartotek zawodników — a ci mają w nich dorobek PIERWSZEJ drużyny, bo statystyki
// z 90minut niosą nazwę rozgrywek („90minut (Ekstraklasa)").
//
// Uruchomienie:  node scripts/test-rezerwy-nie-sumuja.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

const kod = [
  wytnij("wTychRozgrywkach", /function wTychRozgrywkach\(liga, wskazanie\)\{[\s\S]*?\n\}/),
  wytnij("policzMeczeKlubu", /function policzMeczeKlubu\(clubId, zawodnicy\)\{[\s\S]*?\n\}/),
].join("\n");

const KLUBY = [
  { id: "K1", name: "KORONA S.A. Kielce", league: "III liga, gr. IV", season: "2026/2027" },
  { id: "K2", name: "Korona Kielce", league: "Ekstraklasa", season: "2026/2027" },
];
const DB = { clubs: KLUBY, klubyWgId: new Map(KLUBY.map((c) => [c.id, c])), players: [] };

const api = (gracze) => {
  DB.players = gracze;
  return new Function("DB", "rozbijNazweKlubu", "odciskKlubu", "tenSamCzlon", "wierszZTabeli", "osiagalneKolejki",
    `${kod}\n return policzMeczeKlubu;`)(
    DB,
    (n) => ({ rdzen: String(n || "").toLowerCase().split(/\s+/).filter(Boolean), numer: /\bII\b|\b2\b/.test(String(n || "")) ? 2 : 0 }),
    (n) => String(n || "").toLowerCase().replace(/[^a-ząćęłńóśźż]/g, ""),
    (a, b) => a === b,
    () => null,      // tabeli III ligi nie mamy — to właśnie wtedy sięgano po kartoteki
    () => null,
  )("K1", DB.players);
};

console.log("\n1. Rezerwy bez tabeli ligowej");
{
  // Trzech zawodników rezerw: dwóch z dorobkiem Ekstraklasy (pierwsza drużyna), jeden z III ligi.
  const wynik = api([
    { id: "A", clubId: "K1", matches: 20, statsSource: "90minut (Ekstraklasa)", przebieg: [
      { rywal: "Lech Poznań", dom: true, wynik: "1:2" }, { rywal: "Legia Warszawa", dom: false, wynik: "0:3" }] },
    { id: "B", clubId: "K1", matches: 18, statsSource: "90minut (Ekstraklasa)", przebieg: [] },
    { id: "C", clubId: "K1", matches: 6, statsSource: "90minut (III liga, gr. IV)", przebieg: [
      { rywal: "Star Starachowice", dom: true, wynik: "2:0" }] },
  ]);
  sprawdz("rozegrane liczone bez Ekstraklasy (6, nie 20)", wynik.rozegrane === 6, String(wynik.rozegrane));
  sprawdz("mecze pierwszej drużyny nie wchodzą do rozpisanych", wynik.rozpisanych === 1,
    `${wynik.rozpisanych}: ${wynik.rywale.join(" | ")}`);
  sprawdz("na liście rywali tylko przeciwnik z III ligi",
    wynik.rywale.length === 1 && /Star Starachowice/.test(wynik.rywale[0]), wynik.rywale.join(" | "));
}

console.log("\n2. Czego ta zasada NIE psuje");
{
  const bezZrodla = api([
    { id: "A", clubId: "K1", matches: 7, statsSource: "protokół ŁNP", przebieg: [{ rywal: "Star Starachowice", dom: true, wynik: "1:1" }] },
    { id: "B", clubId: "K1", matches: 5, statsSource: "", przebieg: [{ rywal: "Wisła Sandomierz", dom: false, wynik: "0:0" }] },
  ]);
  sprawdz("źródło bez nazwy rozgrywek liczy się normalnie", bezZrodla.rozegrane === 7, String(bezZrodla.rozegrane));
  sprawdz("oba spotkania rozpisane", bezZrodla.rozpisanych === 2, String(bezZrodla.rozpisanych));

  const wklejone = api([{ id: "A", clubId: "K1", matches: 9, statsSource: "Transfermarkt (wklejone)", przebieg: [] }]);
  sprawdz('wklejka z Transfermarktu to nie nazwa ligi — nie wycinamy', wklejone.rozegrane === 9, String(wklejone.rozegrane));

  const taSamaLiga = api([{ id: "A", clubId: "K1", matches: 11, statsSource: "90minut (III liga, gr. IV)", przebieg: [] }]);
  sprawdz("dorobek z TEJ ligi liczy się normalnie", taSamaLiga.rozegrane === 11, String(taSamaLiga.rozegrane));
}

console.log("\n3. Opisane w kodzie");
sprawdz("napisane, skąd się wzięła ta zasada", /Korona 2 Kielce ma 20 meczów, chyba zsumowało z Ekstraklasą/.test(zrodlo));
sprawdz("i że brak informacji o rozgrywkach nie wycina danych",
  /Brak takiej informacji\s*\n\s*\/\/ \(protokoły ŁNP, wpisy ręczne\) zostawiamy jak dotąd/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
