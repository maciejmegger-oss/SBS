// Sprawdza skalę oceny według pozycji — kafle do tagowania i protokół 1–6 dla bramkarza,
// obrońcy, pomocnika i napastnika.
//
// Testuje PRAWDZIWY moduł src/domain/pozycje.ts (kompilowany esbuildem w locie) oraz prawdziwy
// kod rozpoznania pozycji z panelu — nie ich odpisy, bo odpis rozjeżdża się z kodem.
//
// Uruchomienie:  node scripts/test-skala-pozycji.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const zrodloDomeny = fs.readFileSync("src/domain/pozycje.ts", "utf8").split(String.fromCharCode(13)).join("");
const js = transformSync(zrodloDomeny, { loader: "ts", format: "esm" }).code;
const modul = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const {
  PROFILE, KAFLE_ROLI, kafleRoli, WSZYSTKIE_KAFLE, WSZYSTKIE_FAZY,
  grupaZNumeru, grupaZOpisu, grupaZFaz, rolaZNumeru, rolaZOpisu, grupaZRoli,
} = modul;

const zrodloPc = fs.readFileSync("src/main.ts", "utf8").split(String.fromCharCode(13)).join("");
const zrodloPanel = fs.readFileSync("src/mobile/main.ts", "utf8").split(String.fromCharCode(13)).join("");

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

// Cztery grupy OCENY (tyle, ile skal protokołu) i pięć zestawów KAFLI — skrzydłowy liczy inne
// zdarzenia niż środek pola, ale ocenia się jak pomocnik, bo radar ma cztery wierzchołki.
const GRUPY = ["bramkarz", "obronca", "pomocnik", "napastnik"];
const ROLE = ["bramkarz", "obronca", "pomocnik", "skrzydlowy", "napastnik"];

// ---------------------------------------------------------------------------
console.log("1. Każda pozycja ma komplet");
ROLE.forEach((r) => {
  const kafle = KAFLE_ROLI[r];
  // Dwanaście to dokładnie cztery pełne rzędy po trzy — tyle samo wysokości co dawne dziesięć
  // (ostatni rząd stał w dwóch trzecich pusty), więc nic nie trzeba przewijać.
  sprawdz(`${r}: dwanaście kafli, cztery pełne rzędy`, kafle.length === 12, `jest ${kafle.length}`);
  sprawdz(`${r}: klucze kafli bez powtórzeń`, new Set(kafle.map((k) => k.key)).size === 12);
  sprawdz(`${r}: kafle wychodzą też przez kafleRoli`, kafleRoli(r) === kafle);
});
sprawdz("bez rozpoznanej pozycji nie ma kafli pozycyjnych", kafleRoli(null) === null);

GRUPY.forEach((g) => {
  const pr = PROFILE[g];
  // Cztery, bo tyle wierzchołków rysuje radar w systemie. Inna liczba zmieniłaby kształt
  // wykresu i raport przestałby dać się porównać między zawodnikami.
  sprawdz(`${g}: cztery rubryki protokołu, tyle co faz gry`,
    pr.fazy.length === FAZY_POLA.length, `jest ${pr.fazy.length}`);
  sprawdz(`${g}: każda rubryka ma skrót na radar`, pr.fazy.every((f) => !!f.krotko));
  sprawdz(`${g}: ma własny podpis protokołu`, !!pr.etykietaFaz && pr.etykietaFaz !== "Fazy gry");
});

// ---------------------------------------------------------------------------
// ZAMÓWIENIE ZE STADIONU, słowo w słowo: „jak jedziemy Moska obserwować, to ten chłopiec gra na
// pozycji 11, czyli wahadłowy, skrzydłowy. Czyli on powinien mieć również podania, dośrodkowania,
// strzały, gol, asysta, spalony, obrona 1 na 1, obrona".
console.log("\n1a. Kafle skrzydłowego — to, o co prosił scout");
{
  const k = KAFLE_ROLI.skrzydlowy.map((x) => x.key);
  for (const [klucz, opis] of [
    ["podanie", "podania"], ["dosrodkowanie", "dośrodkowania"], ["strzal", "strzały"],
    ["gol", "gol"], ["asysta", "asysta"], ["spalony", "spalony"],
    ["obrona_1v1", "obrona 1 na 1"], ["powrot_obronny", "powrót do obrony"],
  ]) sprawdz(`skrzydłowy ma ${opis}`, k.includes(klucz), klucz);
  // To właśnie różni skrzydło od środka pola: tam rozgrywanie, tu dowożenie piłki i powrót.
  const pom = KAFLE_POMOCNIK_KLUCZE();
  sprawdz("zestaw skrzydłowego różni się od pomocnika", k.join() !== pom.join());
  sprawdz("obrona 1 na 1 jest u skrzydłowego, a nie u pomocnika",
    k.includes("obrona_1v1") && !pom.includes("obrona_1v1"));
  sprawdz("pomocnik dalej ma rozgrywanie", pom.includes("podanie_kluczowe") && pom.includes("przyjecie"));
}
function KAFLE_POMOCNIK_KLUCZE() { return KAFLE_ROLI.pomocnik.map((x) => x.key); }

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
  for (const r of ROLE) {
    for (const k of KAFLE_ROLI[r]) {
      if (!wgKlucza.has(k.key)) wgKlucza.set(k.key, new Set());
      wgKlucza.get(k.key).add(k.label);
    }
  }
  const rozjechane = [...wgKlucza.entries()].filter(([, etykiety]) => etykiety.size > 1);
  sprawdz("ten sam klucz ma wszędzie tę samą etykietę", rozjechane.length === 0,
    rozjechane.map(([k, e]) => `${k}: ${[...e].join(" / ")}`).join("; "));
  sprawdz("Pojedynek i Strata sa wspolne dla wszystkich",
    ["pojedynek", "strata"].every((k) => ROLE.every((r) => KAFLE_ROLI[r].some((x) => x.key === k))));
  // Najzwyklejsze podanie pada na każdej pozycji częściej niż cokolwiek innego — i do niedawna
  // nie miało kafla przy żadnej.
  sprawdz("Podanie jest wszędzie",
    ROLE.every((r) => KAFLE_ROLI[r].some((x) => x.key === "podanie")));
  // Klucze kafli pozycyjnych muszą zgadzać się z meczowymi (EVENT_TAGS w panelu), bo oba zapisy
  // lądują w jednym polu `type`. Inaczej „Podanie" przy nazwisku i „Podanie" przy drużynie byłyby
  // dwiema różnymi statystykami.
  const meczowe = new Map([...zrodloPanel.matchAll(/\{ key: "([a-z_]+)", label: "([^"]+)", grupa:/g)]
    .map((m) => [m[1], m[2]]));
  const zderzenia = [...wgKlucza.entries()]
    .filter(([k, e]) => meczowe.has(k) && ![...e][0].startsWith(meczowe.get(k)));
  sprawdz("kafel pozycyjny nie kłóci się z meczowym o ten sam klucz", zderzenia.length === 0,
    zderzenia.map(([k, e]) => `${k}: ${[...e].join("/")} vs ${meczowe.get(k)}`).join("; "));
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
// ROLA PRZY KAFLACH osobno od grupy oceny. Dwie skale, jedno rozpoznanie: ocena skrzydłowego
// zostaje pomocnikowa (radar!), ale kafle ma własne.
console.log("\n5a. Skrzydłowy ma swoje kafle, a ocenę pomocnika");
{
  sprawdz("7 i 11 to przy kaflach skrzydła", [7, 11].every((n) => rolaZNumeru(n) === "skrzydlowy"));
  sprawdz("ale w ocenie zostają pomocnikami", [7, 11].every((n) => grupaZNumeru(n) === "pomocnik"));
  sprawdz("grupaZRoli sprowadza skrzydło do pomocnika", grupaZRoli("skrzydlowy") === "pomocnik");
  sprawdz("pozostałe numery mają rolę taką jak grupę",
    [1, 2, 3, 4, 5, 6, 8, 9, 10].every((n) => rolaZNumeru(n) === grupaZNumeru(n)));
  sprawdz("brak numeru to dalej nie wiem", rolaZNumeru(undefined) === null && rolaZNumeru(0) === null);

  sprawdz("kartoteka: Skrzydłowy prawy", rolaZOpisu("Skrzydłowy prawy") === "skrzydlowy");
  sprawdz("kartoteka: Wahadłowy lewy", rolaZOpisu("Wahadłowy lewy") === "skrzydlowy");
  // Wahadłowy bywa wpisany jako obrońca — gra jak skrzydło i tak ma tagować.
  sprawdz("kartoteka: Obrońca (wahadłowy) taguje jak skrzydło",
    rolaZOpisu("Obrońca boczny (wahadłowy)") === "skrzydlowy");
  sprawdz("kartoteka: Pomocnik defensywny zostaje pomocnikiem",
    rolaZOpisu("Pomocnik defensywny") === "pomocnik");
  sprawdz("kartoteka: Bramkarz", rolaZOpisu("Bramkarz") === "bramkarz");
  sprawdz("kartoteka: Napastnik", rolaZOpisu("Napastnik") === "napastnik");
  sprawdz("pusta pozycja to null", rolaZOpisu("") === null && rolaZOpisu(undefined) === null);
  sprawdz("rola zawsze sprowadza się do istniejącej grupy oceny",
    ROLE.every((r) => GRUPY.includes(grupaZRoli(r))));
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
  // Rysowanie przeszlo do siatkaKafli: panel druzyny ma grupy z naglowkami, panel zawodnika
  // zostaje plaski. Zrodlo kafli jest dalej to samo — zalezne od pozycji.
  sprawdz("kafle rysują się z listy zależnej od pozycji",
    /const kafle = kafleTeraz\(\)/.test(zrodloPanel) && /\$\{siatkaKafli\(counts\)\}/.test(zrodloPanel));
  sprawdz("zestaw kafli bierze się z ROLI, nie z grupy oceny",
    /const kafleTeraz = \(\) => kafleDla\(rolaTeraz\(\)\);/.test(zrodloPanel));
  // Bez podpisu scout nie wie, czy panel naprawdę zmienił się wraz z pozycją, czy to on się myli.
  sprawdz("nad kaflami stoi podpis, z jakiej pozycji są",
    /Kafle pozycyjne · \$\{esc\(NAZWA_ROLI\[rola!\]\)\}/.test(zrodloPanel));
  sprawdz("każda rola ma nazwę na ekranie",
    ROLE.every((r) => new RegExp(`${r}: "`).test(zrodloPanel)));
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
  const kod = wytnij("rolaZawodnika", /function rolaZawodnika[\s\S]*?\n}\n/, zrodloPanel)
    + wytnij("grupaZawodnika", /const grupaZawodnika = [\s\S]*?nazwaKlubu\)\);\n/, zrodloPanel)
    + wytnij("rolaZKartoteki", /let bramkarzePamiec[\s\S]*?\nfunction rolaZKartoteki[\s\S]*?\n}\n/, zrodloPanel);
  const bezTypow = transformSync(kod, { loader: "ts", format: "esm" }).code;

  const kartoteka = [
    { id: "b1", firstName: "Jan", lastName: "Nowak", position: "Bramkarz" },
    { id: "n1", firstName: "Adam", lastName: "Kowal", position: "Napastnik" },
    { id: "s1", firstName: "Oliwier", lastName: "Mosek", position: "Skrzydłowy lewy" },
  ];
  const cache = { players: kartoteka };
  const panel = new Function(
    "rolaZNumeru", "grupaZFaz", "rolaZOpisu", "grupaZRoli", "cache", `
    const znajdzZawodnika = (nazwa) => {
      const p = cache.players.find(x => (x.firstName + " " + x.lastName) === nazwa);
      return p ? p.id : null;
    };
    ${bezTypow.replace(/export\s+/g, "")}
    return { rolaZawodnika, grupaZawodnika };
  `)(rolaZNumeru, grupaZFaz, rolaZOpisu, grupaZRoli, cache);
  const { rolaZawodnika, grupaZawodnika } = panel;

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

  // MOSEK NA JEDENASTCE — przypadek z dzisiejszego wyjazdu.
  sprawdz("zawodnik z jedenastki dostaje kafle skrzydłowe",
    rolaZawodnika({ nazwa: "Oliwier Mosek", pozycja: 11 }) === "skrzydlowy");
  sprawdz("a protokół 1–6 zostaje pomocnikowy",
    grupaZawodnika({ nazwa: "Oliwier Mosek", pozycja: 11 }) === "pomocnik");
  sprawdz("skrzydłowy z kartoteki też, jeszcze przed ułożeniem planszy",
    rolaZawodnika({ nazwa: "Oliwier Mosek" }) === "skrzydlowy");
  // Protokół zna tylko cztery grupy — po wystawieniu ocen rola spada do pomocnika i tak ma być:
  // podmiana kafli w trakcie meczu zabrałaby scoutowi liczniki z oczu.
  sprawdz("wystawiony protokół pomocnika nie udaje skrzydła",
    rolaZawodnika({ nazwa: "Oliwier Mosek", fazy: { pomPodania: 4 } }) === "pomocnik");
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy ? 1 : 0);
