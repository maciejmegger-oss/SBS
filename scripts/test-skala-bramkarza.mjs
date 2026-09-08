// Sprawdza skalę oceny bramkarza — kafle do tagowania i protokół 1–6.
//
// Testuje PRAWDZIWY moduł src/domain/bramkarz.ts (kompilowany esbuildem w locie), a nie jego
// odpis — dzięki temu zmiana w kodzie od razu przechodzi przez ten test, zamiast rozjeżdżać się
// z jego własną kopią stałych.
//
// Uruchomienie:  node scripts/test-skala-bramkarza.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const zrodloDomeny = fs.readFileSync("src/domain/bramkarz.ts", "utf8");
const js = transformSync(zrodloDomeny, { loader: "ts", format: "esm" }).code;
const modul = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const {
  EVENT_TAGS_BRAMKARZ, FAZY_BRAMKARZ,
  pozycjaToBramkarz, opisToBramkarz, fazyToBramkarskie, NUMER_BRAMKARZA,
} = modul;

const zrodloPc = fs.readFileSync("src/main.ts", "utf8");
const zrodloPanel = fs.readFileSync("src/mobile/main.ts", "utf8");

const wytnij = (nazwa, wzor, zrodlo) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};
const FAZY_POLA = eval(wytnij("REPORT_PHASES", /\[\s*\{key:'fazaAtaku'[\s\S]*?\n\];/, zrodloPc).replace(/;$/, ""));
const SFG = eval(wytnij("REPORT_SET_PIECES", /\[\s*\{key:'rzutRoznyObrona'[\s\S]*?\n\];/, zrodloPc).replace(/;$/, ""));
const KAFLE_POLA = eval(wytnij("EVENT_TAGS", /\[\s*\{ key: "podanie_kluczowe"[\s\S]*?\n\];/, zrodloPanel).replace(/;$/, ""));

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

const kluczeGk = EVENT_TAGS_BRAMKARZ.map((t) => t.key);
const kluczePola = KAFLE_POLA.map((t) => t.key);

// 1. KAFLE. Zmiana miała być „troszkę": pięć kafli zostaje, pięć ustępuje bramkarskim.
console.log("1. Kafle do tagowania");
sprawdz("dziesięć kafli, tyle samo co u zawodnika z pola",
  EVENT_TAGS_BRAMKARZ.length === 10 && KAFLE_POLA.length === 10,
  `bramkarz: ${EVENT_TAGS_BRAMKARZ.length}, pole: ${KAFLE_POLA.length}`);
sprawdz("klucze bez powtórzeń", new Set(kluczeGk).size === kluczeGk.length);
["podanie_kluczowe", "pojedynek", "ustawienie", "strata", "gol"].forEach((k) =>
  sprawdz(`zostaje kafel wspólny: ${k}`, kluczeGk.includes(k)));
["drybling", "gra_glowa", "strzal", "odbior", "asysta"].forEach((k) =>
  sprawdz(`znika kafel nie dla bramkarza: ${k}`, !kluczeGk.includes(k)));
["obrona_strzalu", "wyjscie_dosrodkowanie", "sam_na_sam", "gra_nogami", "wznowienie"].forEach((k) =>
  sprawdz(`dochodzi kafel bramkarski: ${k}`, kluczeGk.includes(k)));
sprawdz("dokładnie pięć kafli wspólnych z listą zawodnika z pola",
  kluczeGk.filter((k) => kluczePola.includes(k)).length === 5);

// Kafel ma trzy w rzędzie i mieści dwie linijki po ~14 znaków. Dłuższa etykieta rozpycha
// rząd i psuje siatkę — a przewijanie kafli w trakcie akcji oznacza akcję przegapioną.
console.log("\n2. Etykiety mieszczą się na kaflu");
EVENT_TAGS_BRAMKARZ.forEach((t) => {
  const najdluzszeSlowo = Math.max(...t.label.split(" ").map((w) => w.length));
  sprawdz(`„${t.label}" — najdłuższe słowo ${najdluzszeSlowo} znaków`, najdluzszeSlowo <= 14);
});

// 3. PROTOKÓŁ 1–6. Liczba pozycji rządzi kształtem radaru w systemie.
console.log("\n3. Protokół 1–6");
sprawdz("tyle samo pozycji, co faz gry — radar zachowa kształt",
  FAZY_BRAMKARZ.length === FAZY_POLA.length,
  `bramkarz: ${FAZY_BRAMKARZ.length}, pole: ${FAZY_POLA.length}`);
sprawdz("każda pozycja ma skrót na radar", FAZY_BRAMKARZ.every((f) => !!f.krotko));

// NAJWAŻNIEJSZE: klucze bramkarskie i polowe leżą w TYM SAMYM polu `phases` w bazie.
// Kolizja nie rzuciłaby błędu — po cichu wpisałaby ocenę bramkarza pod fazę gry.
const kluczeFazGk = FAZY_BRAMKARZ.map((f) => f.key);
sprawdz("żaden klucz bramkarski nie zderza się z fazą gry",
  kluczeFazGk.every((k) => !FAZY_POLA.some((f) => f.key === k)));
sprawdz("żaden klucz bramkarski nie zderza się ze stałym fragmentem",
  kluczeFazGk.every((k) => !SFG.some((f) => f.key === k)));

// 4. ROZPOZNANIE BRAMKARZA.
console.log("\n4. Rozpoznanie bramkarza");
sprawdz("numer 1 na mapie to bramkarz", pozycjaToBramkarz(NUMER_BRAMKARZA) && pozycjaToBramkarz("1"));
sprawdz("stoper to nie bramkarz", !pozycjaToBramkarz(4) && !pozycjaToBramkarz(undefined));
sprawdz("pozycja z kartoteki Bramkarz", opisToBramkarz("Bramkarz") && opisToBramkarz("bramkarz"));
sprawdz("Obrońca to nie bramkarz", !opisToBramkarz("Obrońca środkowy") && !opisToBramkarz(undefined));
sprawdz("protokół z oceną bramkarską rozpoznany", fazyToBramkarskie({ gkObronaBramki: 4 }));
sprawdz("protokół z fazami gry NIE jest bramkarski", !fazyToBramkarskie({ fazaAtaku: 5 }));
sprawdz("pusty protokół nie przesądza niczego", !fazyToBramkarskie({}) && !fazyToBramkarskie(null));

// 5. PIERWSZEŃSTWO ŹRÓDEŁ — na PRAWDZIWYM kodzie panelu, nie na jego opisie.
//
// Tu jest cała logika, która może po cichu pokazać złą skalę: mapa pozycji, wystawiony już
// protokół i kartoteka mówią czasem co innego, a rozstrzygnięcie musi być jednoznaczne.
console.log("\n5. Co decyduje, gdy źródła się nie zgadzają");
{
  const kod = wytnij("jestBramkarzem", /function jestBramkarzem[\s\S]*?\n}\n/, zrodloPanel)
    + wytnij("bramkarzWKartotece", /let bramkarzePamiec[\s\S]*?\nfunction bramkarzWKartotece[\s\S]*?\n}\n/, zrodloPanel);
  const bezTypow = transformSync(kod, { loader: "ts", format: "esm" }).code;

  // Kartoteka: jeden bramkarz, jeden zawodnik z pola.
  const kartoteka = [
    { id: "b1", firstName: "Jan", lastName: "Nowak", position: "Bramkarz" },
    { id: "p1", firstName: "Adam", lastName: "Kowal", position: "Napastnik" },
  ];
  const zbuduj = new Function("pozycjaToBramkarz", "fazyToBramkarskie", "opisToBramkarz", "cache", `
    const znajdzZawodnika = (nazwa) => {
      const p = cache.players.find(x => (x.firstName + " " + x.lastName) === nazwa);
      return p ? p.id : null;
    };
    ${bezTypow.replace(/export\s+/g, "")}
    return jestBramkarzem;
  `);
  const cache = { players: kartoteka };
  const jestBramkarzem = zbuduj(pozycjaToBramkarz, fazyToBramkarskie, opisToBramkarz, cache);

  sprawdz("bramkarz z kartoteki, jeszcze nieustawiony na mapie",
    jestBramkarzem({ nazwa: "Jan Nowak" }) === true);
  sprawdz("napastnik z kartoteki to nie bramkarz",
    jestBramkarzem({ nazwa: "Adam Kowal" }) === false);
  sprawdz("mapa pozycji bije kartotekę: bramkarz wystawiony w polu gra jak zawodnik z pola",
    jestBramkarzem({ nazwa: "Jan Nowak", pozycja: 9 }) === false);
  sprawdz("mapa pozycji bije kartotekę: ktokolwiek na jedynce jest bramkarzem",
    jestBramkarzem({ nazwa: "Adam Kowal", pozycja: 1 }) === true);
  sprawdz("wystawiony protokół bramkarski przesądza — skala nie zmieni się w trakcie meczu",
    jestBramkarzem({ nazwa: "Adam Kowal", fazy: { gkObronaBramki: 5 } }) === true);
  sprawdz("nazwisko spoza kartoteki nie robi z nikogo bramkarza",
    jestBramkarzem({ nazwa: "Nikt Nieznany" }) === false);
}

// 6. WPIĘCIE W OBIE APLIKACJE. Skala ma jedno źródło — gdyby któraś strona odpięła się od
//    modułu i wróciła do własnej kopii, rozjechałaby się dokładnie tak, jak numeracja pozycji.
console.log("\n6. Obie aplikacje biorą to z jednego miejsca");
sprawdz("system importuje moduł", /from ["']\.\/domain\/bramkarz["']/.test(zrodloPc));
sprawdz("panel importuje moduł", /from ["']\.\.\/domain\/bramkarz["']/.test(zrodloPanel));
sprawdz("kafle rysują się z listy zależnej od zawodnika, nie z EVENT_TAGS na sztywno",
  /\$\{kafleTeraz\(\)\.map/.test(zrodloPanel));
sprawdz("zapis zdarzenia szuka etykiety w OBU listach",
  /EVENT_TAGS_BRAMKARZ\.find/.test(zrodloPanel));
sprawdz("zapis raportu w systemie czyta rubryki z ekranu, nie z listy na sztywno",
  /dataset\.klucze\.split/.test(zrodloPc));

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy ? 1 : 0);
