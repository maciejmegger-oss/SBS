// Sprawdza, kiedy mecz z protokołu ŁNP liczy się jako już rozliczony.
//
// Zgłoszenie (06.10.2026): „zaktualizowałem dane 4 ligi, ale nie wgrało — dalej mają mniej meczów".
// Okno meldowało „wszystkie 98 meczów z tej wklejki jest już rozliczonych", a dorobek nie rósł.
// Przyczyna: zabezpieczenie przed podwójnym liczeniem uznawało mecz za policzony, gdy zawodnik
// miał W OGÓLE wpis z tym rywalem i tą stroną boiska — bez patrzenia na sezon. Mecz z poprzedniego
// sezonu blokował więc ten sam mecz w nowym.
//
// Uruchomienie:  node scripts/test-rozliczanie-protokolow.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

// Regułę odtwarzamy dokładnie tak, jak stoi w kodzie — zmiana po jednej stronie ma wywalić test.
const importNorm = (s) => String(s || "").toLowerCase().replace(/[^a-ząćęłńóśźż0-9]/g, "");
const odciskKlubu = (s) => importNorm(s);
const czyRozliczony = (p, klub, rywal, uSiebie, kluczZWklejki) => {
  const sezonKlubuTeraz = String((klub && klub.season) || "");
  const kluczWlasny = `${sezonKlubuTeraz}|${odciskKlubu(rywal)}|${uSiebie ? "D" : "W"}`;
  const rozliczone = p.rozliczoneMecze || [];
  return rozliczone.includes(kluczZWklejki) || rozliczone.includes(kluczWlasny)
    || (String(p.przebiegSezon || "") === sezonKlubuTeraz
        && (p.przebieg || []).some((x) => !x.mecz && importNorm(x.rywal || "") === importNorm(rywal) && !!x.dom === uSiebie));
};

const KLUB = { season: "2026/2027" };

console.log("\n1. Mecz z poprzedniego sezonu nie blokuje nowego");
{
  const zawodnik = {
    przebiegSezon: "2025/2026",
    przebieg: [{ mecz: "x1", rywal: "Star Starachowice", dom: true, minuty: 90 }],
    rozliczoneMecze: ["x1", "2025/2026|starstarachowice|D"],
  };
  sprawdz("ten sam rywal u siebie, ale rok wcześniej — liczymy jako NOWY",
    czyRozliczony(zawodnik, KLUB, "Star Starachowice", true, "nowy-klucz") === false);
}

console.log("\n2. Mecz z tego sezonu nie liczy się drugi raz");
{
  const zawodnik = {
    przebiegSezon: "2026/2027",
    przebieg: [{ mecz: "abc", rywal: "Star Starachowice", dom: true, minuty: 90 }],
    rozliczoneMecze: ["abc", "2026/2027|starstarachowice|D"],
  };
  sprawdz("ten sam klucz z wklejki — już rozliczony", czyRozliczony(zawodnik, KLUB, "Star Starachowice", true, "abc") === true);
  sprawdz("inny klucz z wklejki, ale ten sam mecz — nadal rozliczony (klucz własny)",
    czyRozliczony(zawodnik, KLUB, "Star Starachowice", true, "zupelnie-inny") === true);
  sprawdz("rewanż na wyjeździe to osobny mecz",
    czyRozliczony(zawodnik, KLUB, "Star Starachowice", false, "inny") === false);
  sprawdz("inny rywal to osobny mecz",
    czyRozliczony(zawodnik, KLUB, "Wisła Sandomierz", true, "inny") === false);
}

console.log("\n3. Stare wpisy bez klucza (importy sprzed tej zmiany)");
{
  const stary = {
    przebiegSezon: "2026/2027",
    przebieg: [{ rywal: "Star Starachowice", dom: true, minuty: 90 }],   // bez pola „mecz"
    rozliczoneMecze: [],
  };
  sprawdz("rozpoznane po rywalu i stronie — nie dubluje dorobku",
    czyRozliczony(stary, KLUB, "Star Starachowice", true, "nowy") === true);
  const staryZInnegoSezonu = { ...stary, przebiegSezon: "2025/2026" };
  sprawdz("ale tylko w obrębie tego samego sezonu",
    czyRozliczony(staryZInnegoSezonu, KLUB, "Star Starachowice", true, "nowy") === false);
}

console.log("\n4. To samo w kodzie — zapis i podgląd muszą liczyć tak samo");
sprawdz("klucz własny przy zapisie", /const kluczWlasny = `\$\{sezonKlubuTeraz\}\|\$\{odciskKlubu\(rywal\)\}\|\$\{uSiebie \? 'D' : 'W'\}`;/.test(zrodlo));
sprawdz("klucz własny w podglądzie", /const kluczWlasnyPodgladu = `\$\{sezonTegoKlubu\}\|\$\{odciskKlubu\(rywalStrony\)\}\|\$\{uSiebieStrona \? 'D' : 'W'\}`;/.test(zrodlo));
sprawdz("oba klucze zapisywane przy rozliczeniu", /p\.rozliczoneMecze = \[\.\.\.rozliczone, protokol\.klucz, kluczWlasny\];/.test(zrodlo));
sprawdz("wpisy bez klucza tylko z tego sezonu (zapis)",
  /String\(p\.przebiegSezon \|\| ''\) === sezonKlubuTeraz\s*\n\s*&& \(p\.przebieg\|\|\[\]\)\.some\(x=> !x\.mecz/.test(zrodlo));
sprawdz("wpisy bez klucza tylko z tego sezonu (podgląd)",
  /String\(zawodnik\.przebiegSezon \|\| ''\) === sezonTegoKlubu\s*\n\s*&& \(zawodnik\.przebieg\|\|\[\]\)\.some\(x=> !x\.mecz/.test(zrodlo));
sprawdz("napisane, skąd się wzięła ta poprawka", /zaktualizowałem dane 4 ligi, ale nie wgrało/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
