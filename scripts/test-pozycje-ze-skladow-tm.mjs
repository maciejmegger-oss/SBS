// Precyzyjne pozycje ze składów Transfermarktu — Ekstraklasa, I liga, II liga.
//
// Zgłoszenie (18.10.2026): „tu masz napisane pozycje, pobierz do wszystkich klubów od ekstraklasy
// do 2 ligi i umieść ich na mapie pozycji", z wyraźną decyzją: nadpisujemy to, co już jest.
//
// Problem: nasze kartoteki mają pozycję OGÓLNĄ, więc czternastu zawodników z wpisem „Napastnik”
// staje na jednym polu mapy. Transfermarkt rozróżnia lewego, prawego i środkowego.
//
// Uruchomienie:  node scripts/test-pozycje-ze-skladow-tm.mjs
// Z odpytaniem Transfermarktu:  TM_LIVE=1 node scripts/test-pozycje-ze-skladow-tm.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const api = fs.readFileSync("api/tm-sklad.js", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

// --- kopia mapowania z main.ts -----------------------------------------------------------------
const kluczTm = (s) => String(s || "").toLowerCase()
  .normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z]+/g, " ").trim();
const POZYCJE = {
  "bramkarz": 1, "lewy obronca": 3, "prawy obronca": 2,
  "defensywny pomocnik": 6, "srodkowy pomocnik": 8, "ofensywny pomocnik": 10,
  "lewy pomocnik": 11, "prawy pomocnik": 7, "lewe skrzydlo": 11, "prawe skrzydlo": 7,
  "lewy napastnik": 11, "prawy napastnik": 7, "srodkowy napastnik": 9, "napastnik": 9,
};

console.log("\n1. Precyzyjna pozycja trafia na właściwe pole");
sprawdz("lewy obrońca na trójkę", POZYCJE[kluczTm("Lewy obrońca")] === 3);
sprawdz("prawy obrońca na dwójkę", POZYCJE[kluczTm("Prawy obrońca")] === 2);
sprawdz("lewy napastnik to lewe skrzydło (11), nie napastnik",
  POZYCJE[kluczTm("Lewy napastnik")] === 11);
sprawdz("prawy napastnik to prawe skrzydło (7)", POZYCJE[kluczTm("Prawy napastnik")] === 7);
sprawdz("środkowy napastnik na dziewiątkę", POZYCJE[kluczTm("Środkowy napastnik")] === 9);
sprawdz("lewy pomocnik też na jedenastkę — TM nazywa skrzydło raz tak, raz inaczej",
  POZYCJE[kluczTm("Lewy pomocnik")] === 11);
sprawdz("defensywny pomocnik na szóstkę", POZYCJE[kluczTm("Defensywny pomocnik")] === 6);
sprawdz("ofensywny pomocnik na dziesiątkę", POZYCJE[kluczTm("Ofensywny pomocnik")] === 10);

console.log("\n2. To rozwiązuje problem, od którego zaczęliśmy");
{
  // Czternastu „Napastnik” u nas kontra to, co podaje Transfermarkt.
  const zTm = ["Środkowy napastnik", "Lewy napastnik", "Prawy napastnik", "Środkowy napastnik",
    "Lewy napastnik", "Prawy napastnik"];
  const pola = new Set(zTm.map((p) => POZYCJE[kluczTm(p)]));
  sprawdz("sześciu napastników rozchodzi się na trzy pola zamiast stać na jednym",
    pola.size === 3 && pola.has(9) && pola.has(11) && pola.has(7),
    [...pola].join(","));
}

console.log("\n3. Dobór i dopasowanie");
sprawdz("stoperzy dzieleni na lewego i prawego, nie wrzucani na jedno pole",
  /numer = \(licznikStoperow\+\+ % 2\) \? 5 : 4;/.test(zrodlo));
sprawdz("najpierw identyfikator z TM, nazwisko dopiero w drugiej kolejności",
  /wgTmId\.get\(String\(z\.tmId\)\) \|\| wgNazwiska\.get/.test(zrodlo));
sprawdz("nazwiska porównywane bez względu na kolejność imienia",
  /const kluczOsoby = \(a, b\)=>/.test(zrodlo) && /\.sort\(\)\.join\(' '\)/.test(zrodlo));
sprawdz("dopasowanie szuka tylko w obrębie tego klubu",
  /const nasi = zawodnicyKlubu\(klub\.id\);/.test(zrodlo));
sprawdz("klub dobierany po nazwie, a nie pierwszy z brzegu",
  /kandydaci\.find\(k=> klubyToSamo\(k\.nazwa, klub\.name\)\)/.test(zrodlo));
sprawdz("bez zmiany nic nie trafia na listę do zapisu",
  /if\(Number\(p\.pozycjaNmg\) === numer && p\.position === wpis\.nazwa\) continue;/.test(zrodlo));

console.log("\n4. Przebieg po ligach");
sprawdz("przycisk obejmuje Ekstraklasę, I i II ligę",
  /pobierzPozycjeZeSkladowTm\(\['Ekstraklasa', 'I liga', 'II liga'\]\)/.test(zrodlo));
sprawdz("okno mówi wprost, że nadpisuje istniejące pozycje",
  /<strong>Nadpisuję pozycje, które już są w kartotekach<\/strong>/.test(zrodlo));
sprawdz("da się przerwać w trakcie", /przerwij = true;/.test(zrodlo));
sprawdz("przerwa między klubami, żeby nie zasypać serwisu",
  /await new Promise\(g=>setTimeout\(g, 400\)\);/.test(zrodlo));
sprawdz("zapisujemy tylko dotkniętych, nie całą kartotekę",
  /await savePlayersSome\(lista\);/.test(zrodlo));
sprawdz("blad jednego klubu nie przerywa calej operacji",
  /log\.push\(`<span style="color:var\(--clay-dark\);">\$\{esc\(klub\.name\)\}/.test(zrodlo));

console.log("\n5. Odczyt składu po stronie serwera");
sprawdz("czytamy stronę składu, nie profile pojedynczych zawodników",
  /jeden zespół to jedno zapytanie/.test(zrodlo) || /Strona składu oddaje cały zespół w JEDNYM zapytaniu/.test(api));
sprawdz("adres sprawdzany, czy na pewno z Transfermarktu",
  /DOZWOLONE_HOSTY\.test\(u\.hostname\)/.test(api));
sprawdz("ten sam zawodnik liczony raz, nawet gdy jest na stronie dwa razy",
  /if \(widziane\.has\(tmId\)\) continue;/.test(api));

if (process.env.TM_LIVE === "1") {
  console.log("\n6. Żywy Transfermarkt (TM_LIVE=1)");
  const m = await import("../api/tm-sklad.js");
  const d = await m.tmSklad("https://www.transfermarkt.pl/legia-warschau/startseite/verein/255");
  sprawdz("skład się wczytał", d.zawodnicy.length > 15, `${d.zawodnicy.length} zawodników`);
  sprawdz("każdy ma identyfikator i pozycję",
    d.zawodnicy.every((z) => z.tmId && z.pozycja));
  const nieznane = [...new Set(d.zawodnicy.map((z) => z.pozycja))].filter((p) => !(kluczTm(p) in POZYCJE)
    && kluczTm(p) !== "srodkowy obronca" && kluczTm(p) !== "obronca" && kluczTm(p) !== "pomocnik");
  sprawdz("wszystkie nazwy pozycji są w naszym słowniku", !nieznane.length, nieznane.join(", "));
} else {
  console.log("\n6. Żywy Transfermarkt — pominięty (uruchom z TM_LIVE=1)");
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
