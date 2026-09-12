// Sprawdza skalę oceny według pozycji — kafle do tagowania i protokół 1–6 dla bramkarza,
// obrońcy, pomocnika i napastnika.
//
// Testuje PRAWDZIWY moduł src/domain/pozycje.ts (kompilowany esbuildem w locie) oraz prawdziwy
// kod rozpoznania pozycji z panelu — nie ich odpisy, bo odpis rozjeżdża się z kodem.
//
// Uruchomienie:  node scripts/test-skala-pozycji.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const zrodloDomeny = fs.readFileSync("src/domain/pozycje.ts", "utf8");
const js = transformSync(zrodloDomeny, { loader: "ts", format: "esm" }).code;
const modul = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const { PROFILE, WSZYSTKIE_KAFLE, WSZYSTKIE_FAZY, grupaZNumeru, grupaZOpisu, grupaZFaz } = modul;

const zrodloPc = fs.readFileSync("src/main.ts", "utf8");
const zrodloPanel = fs.readFileSync("src/mobile/main.ts", "utf8");

const wytnij = (nazwa, wzor, zrodlo) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};
const FAZY_POLA = eval(wytnij("REPORT_PHASES", /\[\s*\{key:'fazaAtaku'[\s\S]*?\n\];/, zrodloPc).replace(/;$/, ""));
const SFG = eval(wytnij("REPORT_SET_PIECES", /\[\s*\{key:'rzutRoznyObrona'[\s\S]*?\n\];/, zrodloPc).replace(/;$/, ""));

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

const GRUPY = ["bramkarz", "obronca", "pomocnik", "napastnik"];

// ---------------------------------------------------------------------------
console.log("1. Każda pozycja ma komplet");
GRUPY.forEach((g) => {
  const pr = PROFILE[g];
  sprawdz(`${g}: dziesięć kafli`, pr.kafle.length === 10, `jest ${pr.kafle.length}`);
  sprawdz(`${g}: klucze kafli bez powtórzeń`,
    new Set(pr.kafle.map((k) => k.key)).size === 10);
  // Cztery, bo tyle wierzchołków rysuje radar w systemie. Inna liczba zmieniłaby kształt
  // wykresu i raport przestałby dać się porównać między zawodnikami.
  sprawdz(`${g}: cztery rubryki protokołu, tyle co faz gry`,
    pr.fazy.length === FAZY_POLA.length, `jest ${pr.fazy.length}`);
  sprawdz(`${g}: każda rubryka ma skrót na radar`, pr.fazy.every((f) => !!f.krotko));
  sprawdz(`${g}: ma własny podpis protokołu`, !!pr.etykietaFaz && pr.etykietaFaz !== "Fazy gry");
});

// ---------------------------------------------------------------------------
// NAJWAŻNIEJSZE. Wszystkie rubryki protokołu, niezależnie od pozycji, leżą w TYM SAMYM polu
// `phases` w bazie. Kolizja klucza nie rzuciłaby błędu — po cichu wpisałaby ocenę napastnika
// pod rubrykę obrońcy.
console.log("\n2. Klucze protokołu nie zderzają się");
{
  const wszystkie = WSZYSTKIE_FAZY.map((f) => f.key);
  sprawdz("żaden klucz nie powtarza się między pozycjami",
    new Set(wszystkie).size === wszystkie.length,
    `${wszystkie.length} kluczy, ${new Set(wszystkie).size} różnych`);
  sprawdz("żaden nie zderza się z dawnymi fazami gry",
    wszystkie.every((k) => !FAZY_POLA.some((f) => f.key === k)));
  sprawdz("żaden nie zderza się ze stałym fragmentem",
    wszystkie.every((k) => !SFG.some((f) => f.key === k)));
  sprawdz("wszystkich rubryk jest szesnaście (cztery pozycje po cztery)", wszystkie.length === 16);
}

// ---------------------------------------------------------------------------
// Kafel o tym samym kluczu musi znaczyć to samo wszędzie — inaczej „Pojedynek" u obrońcy
// i u napastnika sumowałby się w statystyce jako jedno, choć podpisany inaczej.
console.log("\n3. Wspólne kafle znaczą to samo");
{
  const wgKlucza = new Map();
  for (const g of GRUPY) {
    for (const k of PROFILE[g].kafle) {
      if (!wgKlucza.has(k.key)) wgKlucza.set(k.key, new Set());
      wgKlucza.get(k.key).add(k.label);
    }
  }
  const rozjechane = [...wgKlucza.entries()].filter(([, etykiety]) => etykiety.size > 1);
  sprawdz("ten sam klucz ma wszędzie tę samą etykietę", rozjechane.length === 0,
    rozjechane.map(([k, e]) => `${k}: ${[...e].join(" / ")}`).join("; "));
  sprawdz("Pojedynek i Strata sa wspolne dla wszystkich",
    ["pojedynek", "strata"].every((k) => GRUPY.every((g) => PROFILE[g].kafle.some((x) => x.key === k))));
}

// Kafel ma trzy w rzędzie i mieści dwie linijki po ~14 znaków.
console.log("\n4. Etykiety mieszczą się na kaflu");
{
  const zaDlugie = WSZYSTKIE_KAFLE.filter((t) =>
    Math.max(...t.label.split(" ").map((w) => w.length)) > 14);
  sprawdz("żadne słowo nie rozpycha kafla", zaDlugie.length === 0,
    zaDlugie.map((t) => t.label).join("; "));
}

// ---------------------------------------------------------------------------
console.log("\n5. Rozpoznanie pozycji");
{
  sprawdz("1 to bramkarz", grupaZNumeru(1) === "bramkarz");
  sprawdz("2, 3, 4, 5 to obrońcy", [2, 3, 4, 5].every((n) => grupaZNumeru(n) === "obronca"));
  sprawdz("6, 8, 10 to pomocnicy", [6, 8, 10].every((n) => grupaZNumeru(n) === "pomocnik"));
  // Decyzja scouta: skrzydłowi rozliczani jak środek pola, bo liczy się u nich praca w obie strony.
  sprawdz("7 i 11 (skrzydła) też pomocnicy", [7, 11].every((n) => grupaZNumeru(n) === "pomocnik"));
  sprawdz("9 to napastnik", grupaZNumeru(9) === "napastnik");
  sprawdz("wszystkie jedenaście numerów ma grupę",
    [1,2,3,4,5,6,7,8,9,10,11].every((n) => !!grupaZNumeru(n)));
  sprawdz("brak numeru to nie wiem, a nie zgadywanka",
    grupaZNumeru(undefined) === null && grupaZNumeru(0) === null);

  sprawdz("kartoteka: Bramkarz", grupaZOpisu("Bramkarz") === "bramkarz");
  sprawdz("kartoteka: Obrońca środkowy lewy", grupaZOpisu("Obrońca środkowy lewy") === "obronca");
  sprawdz("kartoteka: Pomocnik defensywny", grupaZOpisu("Pomocnik defensywny") === "pomocnik");
  sprawdz("kartoteka: Skrzydłowy prawy to pomocnik", grupaZOpisu("Skrzydłowy prawy") === "pomocnik");
  sprawdz("kartoteka: Wahadłowy to pomocnik", grupaZOpisu("Wahadłowy lewy") === "pomocnik");
  sprawdz("kartoteka: Napastnik", grupaZOpisu("Napastnik") === "napastnik");
  // Pułapka: „Pomocnik ofensywny" nie może trafić do napastników przez samo słowo „ofensywny".
  sprawdz("Pomocnik ofensywny zostaje pomocnikiem", grupaZOpisu("Pomocnik ofensywny") === "pomocnik");
  sprawdz("pusta pozycja to null", grupaZOpisu("") === null && grupaZOpisu(undefined) === null);
}

// ---------------------------------------------------------------------------
console.log("\n6. Zapisany protokół sam mówi, czyj jest");
{
  GRUPY.forEach((g) => {
    const pierwsza = PROFILE[g].fazy[0].key;
    sprawdz(`${g}: rozpoznany po własnej rubryce`, grupaZFaz({ [pierwsza]: 4 }) === g);
  });
  // Raporty sprzed podziału mają dawne fazy gry i mają takie zostać.
  sprawdz("dawny protokół faz gry zostaje bez pozycji", grupaZFaz({ fazaAtaku: 5 }) === null);
  sprawdz("pusty protokół niczego nie przesądza",
    grupaZFaz({}) === null && grupaZFaz(null) === null);
}

// ---------------------------------------------------------------------------
console.log("\n7. Obie aplikacje biorą to z jednego miejsca");
{
  sprawdz("system importuje moduł", /from ["']\.\/domain\/pozycje["']/.test(zrodloPc));
  sprawdz("panel importuje moduł", /from ["']\.\.\/domain\/pozycje["']/.test(zrodloPanel));
  sprawdz("stary moduł bramkarza już nie istnieje", !fs.existsSync("src/domain/bramkarz.ts"));
  sprawdz("kafle rysują się z listy zależnej od pozycji", /\$\{kafleTeraz\(\)\.map/.test(zrodloPanel));
  sprawdz("zapis zdarzenia szuka etykiety we WSZYSTKICH listach",
    /WSZYSTKIE_KAFLE\.find/.test(zrodloPanel));
  sprawdz("średnie zawodnika zbierają rubryki wszystkich pozycji",
    /zbierz\('phases', \[\.\.\.REPORT_PHASES, \.\.\.WSZYSTKIE_FAZY\]\)/.test(zrodloPc));
  sprawdz("zapis raportu w systemie czyta rubryki z ekranu, nie z listy na sztywno",
    /dataset\.klucze\.split/.test(zrodloPc));
}

// ---------------------------------------------------------------------------
// PIERWSZEŃSTWO ŹRÓDEŁ — na PRAWDZIWYM kodzie panelu.
console.log("\n8. Co decyduje, gdy źródła się nie zgadzają");
{
  const kod = wytnij("grupaZawodnika", /function grupaZawodnika[\s\S]*?\n}\n/, zrodloPanel)
    + wytnij("grupaZKartoteki", /let bramkarzePamiec[\s\S]*?\nfunction grupaZKartoteki[\s\S]*?\n}\n/, zrodloPanel);
  const bezTypow = transformSync(kod, { loader: "ts", format: "esm" }).code;

  const kartoteka = [
    { id: "b1", firstName: "Jan", lastName: "Nowak", position: "Bramkarz" },
    { id: "n1", firstName: "Adam", lastName: "Kowal", position: "Napastnik" },
  ];
  const cache = { players: kartoteka };
  const grupaZawodnika = new Function("grupaZNumeru", "grupaZFaz", "grupaZOpisu", "cache", `
    const znajdzZawodnika = (nazwa) => {
      const p = cache.players.find(x => (x.firstName + " " + x.lastName) === nazwa);
      return p ? p.id : null;
    };
    ${bezTypow.replace(/export\s+/g, "")}
    return grupaZawodnika;
  `)(grupaZNumeru, grupaZFaz, grupaZOpisu, cache);

  sprawdz("kartoteka działa, zanim ktokolwiek ułoży mapę",
    grupaZawodnika({ nazwa: "Jan Nowak" }) === "bramkarz");
  sprawdz("mapa bije kartotekę: bramkarz wystawiony na dziewiątce gra jak napastnik",
    grupaZawodnika({ nazwa: "Jan Nowak", pozycja: 9 }) === "napastnik");
  sprawdz("mapa bije kartotekę: napastnik na jedynce to bramkarz",
    grupaZawodnika({ nazwa: "Adam Kowal", pozycja: 1 }) === "bramkarz");
  sprawdz("wystawiony protokół przesądza — skala nie zmieni się w trakcie meczu",
    grupaZawodnika({ nazwa: "Adam Kowal", fazy: { obrObrona1v1: 5 } }) === "obronca");
  sprawdz("nazwisko spoza kartoteki zostaje bez pozycji",
    grupaZawodnika({ nazwa: "Nikt Nieznany" }) === null);
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy ? 1 : 0);
