// Sprawdza, czy okno protokołów mówi, czego NADAL brakuje, zamiast samego „nic nowego".
//
// Zgłoszenie (06.10.2026): „zaktualizowałem dane 4 ligi, ale nie wgrało, dalej mają mniej meczów".
// Sprawdzenie u źródła: 90minut pokazywał Piastowi Żmigród jedenaście rozegranych meczów, w bazie
// było dziewięć, a brakowało spotkań z Orłem Ząbkowice i Prochowiczanką — czyli wklejka po prostu
// nie objęła dwóch ostatnich kolejek. Komunikat „wszystko już rozliczone" wyglądał wtedy jak błąd
// zapisu i wysłał nas na kilka godzin w złą stronę.
//
// Uruchomienie:  node scripts/test-braki-po-wklejce.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8").replace(/\r\n/g, "\n");
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

const kod = wytnij("brakujaceKolejkiPoWklezce", /function brakujaceKolejkiPoWklejce\(kluby\)\{[\s\S]*?\n\}/);
const dane = {
  K1: { zTabeli: true, rozegrane: 11, wgrane: 9 },
  K2: { zTabeli: true, rozegrane: 11, wgrane: 11 },
  K3: { zTabeli: false, rozegrane: 7, wgrane: 3 },   // bez tabeli nie wiemy, ile naprawdę rozegrano
  K4: { zTabeli: true, rozegrane: 11, wgrane: 7 },
};
const api = new Function("meczeKlubu", `${kod}\n return brakujaceKolejkiPoWklejce;`)((id) => dane[id]);

console.log("\n1. Kogo wymieniamy jako zaległy");
{
  const braki = api([{ id: "K1", name: "Piast Żmigród" }, { id: "K2", name: "Chrobry II Głogów" },
    { id: "K3", name: "Klub bez tabeli" }, { id: "K4", name: "Lechia Dzierżoniów" }]);
  sprawdz("klub z kompletem nie trafia na listę", !braki.some((b) => b.nazwa === "Chrobry II Głogów"));
  sprawdz("klub bez tabeli też nie — nie wiemy, ile rozegrał", !braki.some((b) => b.nazwa === "Klub bez tabeli"));
  sprawdz("zaległe wymienione z liczbami", braki.length === 2
    && braki.every((b) => b.rozegrane === 11), JSON.stringify(braki));
  sprawdz("największa zaległość pierwsza (Lechia 7/11 przed Piastem 9/11)",
    braki[0].nazwa === "Lechia Dzierżoniów", braki.map((b) => b.nazwa).join(" → "));
}

console.log("\n2. Co widzi skaut w oknie");
sprawdz("kluby z wklejki zbierane bez powtórzeń",
  /const klubyWklejki = \[\.\.\.new Set\(wynik\.flatMap\(pr=> \(pr\.strony\|\|\[\]\)\.map\(s=> s\.klub\)\.filter\(Boolean\)\)\)\];/.test(zrodlo));
sprawdz("komunikat wymienia braki w formie „wgrane/rozegrane”",
  /\$\{b\.nazwa\} \$\{b\.wgrane\}\/\$\{b\.rozegrane\}/.test(zrodlo));
sprawdz("mówi wprost, co z tym zrobić",
  /ta wklejka nie objęła tych spotkań — otwórz w ŁNP brakującą kolejkę i zbierz ją zakładką/.test(zrodlo));
sprawdz("przy wielu klubach nie wypisuje wszystkich", /braki\.length > 6 \? ` i \$\{braki\.length - 6\} innych klubów`/.test(zrodlo));
sprawdz("informacja trafia do komunikatu „nic nowego”", /\+ oBrakach\n/.test(zrodlo));
sprawdz("skąd się wzięła ta zmiana — opisane w kodzie",
  /Piast Żmigród miał w 90minut jedenaście meczów, u nas dziewięć/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
