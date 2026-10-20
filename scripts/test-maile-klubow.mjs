// E-MAILE KLUBÓW — co musi być prawdą po uzupełnieniu arkusza.
//
// Zgłoszenie (20.10.2026): „uzupełnisz jeszcze e-maile do klubów, są na stronach oficjalnych".
// Test pilnuje nie tego, ILE adresów mamy, tylko tego, żeby każdy dało się wysłać i żeby przy
// każdym było widać, skąd pochodzi — bo to jedyna obrona przed wpisaniem adresu wziętego z
// komercyjnej bazy albo zgadniętego z domeny.
//
// Uruchomienie:  node scripts/test-maile-klubow.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/data/adresy-klubow.ts", "utf8");
const start = zrodlo.indexOf("= [", zrodlo.indexOf("ADRESY_KLUBOW")) + 2;
const kluby = JSON.parse(zrodlo.slice(start, zrodlo.lastIndexOf("]") + 1));
const zMailem = kluby.filter((k) => String(k.email || "").trim());

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Każdy adres nadaje się do wysyłki");
const ADRES = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const zle = zMailem.filter((k) => !ADRES.test(k.email));
sprawdz("żaden wpis nie ma znaków, których nie przyjmie poczta",
  !zle.length, zle.map((k) => `${k.klub} = ${k.email}`).join(" | "));
const zeSpacja = zMailem.filter((k) => /\s/.test(k.email));
sprawdz("żaden adres nie ma spacji", !zeSpacja.length, zeSpacja.map((k) => k.klub).join(", "));

console.log("\n2. Przy każdym adresie widać, skąd pochodzi");
const bezZrodla = zMailem.filter((k) => !/^https?:\/\//.test(String(k.zrodlo || "")));
sprawdz("każdy klub z adresem ma odnośnik do strony źródłowej",
  !bezZrodla.length, bezZrodla.map((k) => k.klub).join(", "));

console.log("\n3. Nie wpisujemy adresów cudzych podmiotów");
// Te trzy wychwyciliśmy po drodze: zarządca stadionu, spółka w likwidacji i klub młodzieżowy
// o podobnej nazwie. Gdyby wróciły do arkusza, poszłaby na nie korespondencja o zawodnikach.
const CUDZE = ["biuro@zos.koszalin.pl", "sekretariat@kotwicakolobrzeg.com", "mukspelikan@onet.eu"];
CUDZE.forEach((adres) => {
  const trafienie = zMailem.find((k) => k.email.toLowerCase() === adres);
  sprawdz(`${adres} nie figuruje jako adres klubu`, !trafienie, trafienie ? trafienie.klub : "");
});

console.log("\n4. Rezerwy mają kontakt pierwszego zespołu");
// Rezerwy nie prowadzą własnego biura — pisze się do klubu. Jeśli pierwszy zespół ma adres,
// a rezerwy nie, to znaczy, że po prostu o nich zapomniano.
[["Lech II Poznań", "KKS LECH Poznań"], ["Śląsk II Wrocław", "ŚLĄSK WROCŁAW"],
 ["Zagłębie Lubin II", "ZAGŁĘBIE LUBIN"], ["Korona II Kielce", "KORONA S.A. Kielce"],
 ["Pogoń II Szczecin", "Pogoń Szczecin"], ["Arka II Gdynia", "Arka Gdynia"]].forEach(([rez, pierwszy]) => {
  const r = kluby.find((k) => k.klub === rez), p = kluby.find((k) => k.klub === pierwszy);
  sprawdz(`${rez} ma ten sam adres co ${pierwszy}`,
    !!r && !!p && !!r.email && r.email === p.email, r ? `${r.email} vs ${p && p.email}` : "brak wiersza");
});

console.log("\n5. Stan zbioru");
sprawdz("klubów z adresem jest więcej niż przed uzupełnieniem (było 159)",
  zMailem.length > 159, `jest ${zMailem.length}`);
const zPustym = kluby.filter((k) => !String(k.email || "").trim());
sprawdz("każdy klub bez adresu ma w uwagach napisane, dlaczego",
  zPustym.every((k) => String(k.uwagi || "").trim().length > 3),
  zPustym.filter((k) => !String(k.uwagi || "").trim()).map((k) => k.klub).join(", "));
console.log(`       ${zMailem.length} z adresem, ${zPustym.length} bez — z ${kluby.length} klubów w arkuszu`);

console.log("\n6. Arkusz i plik aplikacji się nie rozjechały");
sprawdz("plik jest generowany, nie pisany ręcznie",
  /wygenerowane z arkusza, NIE POPRAWIAJ RĘCZNIE/.test(zrodlo));
sprawdz("jest skrypt, który wpisuje znalezione adresy do arkusza",
  fs.existsSync("scripts/wpisz-maile-klubow.mjs"));
sprawdz("skrypt nie nadpisuje adresów, które już są",
  /if \(String\(w\["E-mail klubu"\] \|\| ""\)\.trim\(\)\) \{ pominietych\+\+; continue; \}/
    .test(fs.readFileSync("scripts/wpisz-maile-klubow.mjs", "utf8")));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
