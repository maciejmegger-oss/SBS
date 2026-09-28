// Sprawdza AUTOMATYCZNE wgrywanie skladu do wybranej obserwacji — i jego granice.
//
// Licencjonowani dostawcy sprzedaja rozgrywki, na ktorych da sie zarobic: w Polsce Ekstraklase
// i I lige, czasem II. CLJ, III ligi, klas okregowych i rocznikow nie sprzedaje NIKT. To nie jest
// brak w systemie, tylko stan rynku — i dlatego automat MUSI wiedziec, gdzie pytac, a gdzie nie.
//
// Dwa powody, dla ktorych sprawdzamy to PRZED zapytaniem:
//   • darmowy prog u dostawcy to sto zapytan dziennie, a mecz mlodziezowy zuzylby je na pewne
//     "nie znam tej druzyny";
//   • odpowiedz "dostawca nie zna druzyny" przy meczu CLJ brzmi jak usterka, choc jest
//     oczekiwana — i wysyla skauta na szukanie bledu tam, gdzie bledu nie ma.
//
// Uruchomienie:  node scripts/test-sklad-automat.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const app = fs.readFileSync("src/main.ts", "utf8");
let bledy = 0;
const spr = (opis, w, dod="") => { console.log(`${w?"  OK  ":" BŁĄD "} ${opis}${w?"":"   "+dod}`); if(!w) bledy++; };

// Prawdziwy kod decyzyjny, nie jego odpis.
const kod = [
  app.match(/const OBJETE_PRZEZ_DOSTAWCE = [^\n]+/)[0],
  app.match(/const POZA_DOSTAWCA = [^\n]+/)[0],
  app.match(/function objeteDostawca\(rozgrywki\)\{[\s\S]*?\n\}/)[0],
].join("\n");
const objeteDostawca = new Function(`${transformSync(kod, { loader: "ts" }).code}\nreturn objeteDostawca;`)();

console.log("Ktore rozgrywki dostawca sprzedaje");
{
  spr("Ekstraklasa — tak", objeteDostawca("Ekstraklasa") === true);
  spr("pełna nazwa sponsorska też", objeteDostawca("PKO Bank Polski Ekstraklasa 2026/2027") === true);
  spr("I liga — tak", objeteDostawca("I liga") === true);
  spr("Betclic I liga — tak", objeteDostawca("Betclic I liga 2026/2027") === true);
  spr("II liga — tak", objeteDostawca("Betclic II liga 2026/2027") === true);
}

console.log("\nCzego nie sprzedaje nikt");
{
  spr("CLJ U19 — nie", objeteDostawca("CLJ U19") === false);
  spr("CLJ U17 — nie", objeteDostawca("CLJ U17 gr. I") === false);
  // NAJWAZNIEJSZY PRZYPADEK: "III liga" zawiera w sobie napis "I liga". Dopasowanie po samym
  // wzorcu wpuscilo by trzecia lige do lig objetych, a to caly trzon pracy skauta.
  spr("III liga — nie, mimo że zawiera „I liga”",
    objeteDostawca("III liga, grupa 2") === false, "III liga");
  spr("Betclic III liga — nie", objeteDostawca("Betclic III liga 2026/2027") === false);
  spr("IV liga — nie", objeteDostawca("IV liga (kujawsko-pomorska)") === false);
  spr("klasa okręgowa — nie", objeteDostawca("Klasa okręgowa") === false);
  spr("A1 — nie", objeteDostawca("A1") === false);
  spr("rocznik — nie", objeteDostawca("Rocznik 2013") === false);
  spr("liga makroregionalna U16 — nie", objeteDostawca("Liga makroregionalna U16") === false);
}

console.log("\nGdy nie wiadomo — nie zgadujemy");
{
  spr("puste rozgrywki — nie pytamy", objeteDostawca("") === false);
  spr("brak pola — nie pytamy", objeteDostawca(undefined) === false);
  spr("nieznana nazwa — nie pytamy", objeteDostawca("Sparing") === false);
}

console.log("\nWpiecie automatu w okno");
{
  spr("automat rusza przy otwarciu okna", /void wczytajOdDostawcy\(true\);/.test(app));
  spr("tylko dla objętych rozgrywek", /if\(objeteDostawca\(obs\.rozgrywki\) && obs\.date && para/.test(app));
  // Nie podmieniamy tego, co skaut wpisal albo wkleil — automat ma dokladac, nie kasowac.
  spr("tylko przy pustym składzie",
    /!\(\(\(obs\.skladMeczu\|\|\{\}\)\.gospodarze\|\|\{\}\)\.zawodnicy\|\|\[\]\)\.length/.test(app)
    && /!\(\(\(obs\.skladMeczu\|\|\{\}\)\.goscie\|\|\{\}\)\.zawodnicy\|\|\[\]\)\.length/.test(app));
  spr("bez daty nie pytamy", /if\(!obs\.date\)\{ if\(!samoczynnie\)/.test(app));

  // Proba samoczynna nie ma krzyczec: skaut o nic nie prosil, wiec "skladu jeszcze nie ogloszono"
  // to informacja, a nie blad na czerwono.
  spr("niepowodzenie automatu to informacja, nie błąd",
    /if\(samoczynnie\) komunikat = powod; else bladPobrania = powod;/.test(app));

  // onclick podaje zdarzenie myszy jako pierwszy argument — bez opakowania przycisk uchodzilby
  // za probe samoczynna i milczalby przy niepowodzeniu.
  spr("przycisk NIE jest podpięty wprost", !/onclick = wczytajOdDostawcy;/.test(app));
  spr("przycisk mówi, że to wybór człowieka", /onclick = \(\)=>wczytajOdDostawcy\(false\)/.test(app));

  spr("przycisk dostawcy tylko przy objętych rozgrywkach",
    /\$\{objeteDostawca\(obs\.rozgrywki\)\s*\n?\s*\? `<button class="secondary" data-x="dostawca"/.test(app));
  spr("a przy nieobjętych okno mówi dlaczego",
    /składów stąd nie sprzedaje/.test(app) && /stan rynku, nie brak w systemie/.test(app));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
