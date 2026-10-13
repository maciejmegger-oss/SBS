// Talent: wyszukiwarka listy i odsiewanie śmieci z wklejki.
//
// Dwa zgłoszenia z 13.10.2026:
//  1. „wstaw wyszukiwarkę przez wpisywanie" — przy 1838 wpisach same zakładki nie wystarczą.
//  2. „nie wgrywa zawodnika ze screena, tylko jakieś dziwne dane" — po wklejeniu strony profilu
//     z Transfermarktu parser rozpoznał 256 „zawodników": wiersze terminarza („Sobota 01.05.
//     - 00:00", rocznik 2027) i pozycje menu („Często Zadawane Pytania", „Drugie Żółte Kartki").
//
// Test sprawdza logikę dopasowania i odsiewania na kopiach tych samych funkcji co w aplikacji
// (main.ts to jeden plik widoku, nie moduł) oraz pilnuje, że kod w aplikacji faktycznie je woła.
//
// Uruchomienie:  node scripts/test-talent-szukanie.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

// --- kopie logiki z main.ts -------------------------------------------------------------------
const doSzukaniaTalentu = (s) => String(s || "").toLowerCase()
  .normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
function talentPasuje(t, fraza) {
  const q = doSzukaniaTalentu(fraza);
  if (!q) return true;
  const stog = doSzukaniaTalentu([t.firstName, t.lastName, t.club, t.position,
    t.birthYear, t.reprezentacja, t.liga, t.krajKlubu].filter(Boolean).join(" "));
  return q.split(" ").every((slowo) => stog.includes(slowo));
}
const SLOWNIK_NAWIGACJI = new Set(
  (zrodlo.match(/const SLOWNIK_NAWIGACJI = new Set\(\[([\s\S]*?)\]\);/) || [])[1]
    ?.match(/'([a-z]+)'/g)?.map((s) => s.slice(1, -1)) || []);
const DNI_TYGODNIA = /^(pon|wt|sr|śr|czw|pt|sob|niedz|nd)\w*/i;
function liniaToSmiecTalentu(linia) {
  const l = String(linia || "").trim();
  if (!l) return true;
  if (!/\p{L}/u.test(l)) return true;
  if (/\b\d{1,2}:\d{2}\b/.test(l)) return true;
  if (DNI_TYGODNIA.test(l) && /\d/.test(l)) return true;
  if (/\b\d{1,2}\.\d{1,2}\.(\d{2,4})?(\s|$)/.test(l)) return true;
  const slowa = l.split(/\s+/).filter(Boolean);
  if (slowa.length <= 4) {
    const bez = (s) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z]/g, "");
    if (slowa.some((w) => SLOWNIK_NAWIGACJI.has(bez(w)))) return true;
  }
  return false;
}

// --- 1. wyszukiwarka --------------------------------------------------------------------------
console.log("\n1. Wyszukiwarka listy talentów");
const zielinski = { firstName: "Bartłomiej", lastName: "Zieliński", club: "Sokół Kleczew",
  position: "Obrońca środkowy", birthYear: 2007, reprezentacja: "" };
const kowal = { firstName: "Jan", lastName: "Kowalski", club: "Lech Poznań", birthYear: 2011,
  reprezentacja: "U-15" };

sprawdz("pusta fraza nie zawęża niczego", talentPasuje(zielinski, "") && talentPasuje(kowal, ""));
sprawdz("nazwisko bez ogonków trafia w nazwisko z ogonkami", talentPasuje(zielinski, "zielinski"));
sprawdz("fragment nazwiska wystarczy", talentPasuje(zielinski, "ziel"));
sprawdz("szuka też po klubie", talentPasuje(kowal, "lech poznan"));
sprawdz("kolejność słów nie ma znaczenia", talentPasuje(kowal, "kowalski lech"));
sprawdz("szuka po roczniku", talentPasuje(kowal, "2011"));
sprawdz("szuka po kadrze", talentPasuje(kowal, "u-15"));
sprawdz("szuka po pozycji", talentPasuje(zielinski, "obronca"));
sprawdz("obce słowo nie trafia", !talentPasuje(zielinski, "legia"));
sprawdz("wszystkie słowa muszą trafić", !talentPasuje(kowal, "kowalski legia"));

// --- 2. odsiewanie śmieci z wklejki -------------------------------------------------------------
console.log("\n2. Co odpada z wklejonej strony serwisu");
sprawdz("słownik nawigacji wczytany z main.ts", SLOWNIK_NAWIGACJI.size > 30,
  `wczytano ${SLOWNIK_NAWIGACJI.size}`);
for (const smiec of [
  "Sobota 01.05. - 00:00", "Środa 05.05. - 00:00", "Sobota 10.04. - 00:00",
  "Często Zadawane Pytania", "Wolni Zawodnicy", "Dane Zawodnika", "Porównaj Zawodników",
  "Drugie Żółte Kartki", "Na Żywo", "Login", "Transfermarkt", "33", "  ",
]) sprawdz(`odpada: „${smiec.trim()}"`, liniaToSmiecTalentu(smiec));

console.log("\n3. Prawdziwi zawodnicy przechodzą");
for (const dobry of [
  "Bartosz Szywała", "Jan Kowalski - Legia Warszawa", "1. Piotr Nowak — Lech Poznań",
  "Kowalski Jan\t2011\tLech Poznań", "Max Bieraugel  Śląsk Wrocław",
  "Wojciech Błaszczyk 2012 Chemik Bydgoszcz",
]) sprawdz(`przechodzi: „${dobry.split("\t")[0]}"`, !liniaToSmiecTalentu(dobry));

// --- 3. wpięcie w aplikację ----------------------------------------------------------------------
console.log("\n4. Czy aplikacja tego używa");
sprawdz("pole wyszukiwania jest w widoku", /id="talent-szukaj"/.test(zrodlo));
sprawdz("filtr wpięty w listę", /\.filter\(t=> talentPasuje\(t, talentSzukaj\)\)/.test(zrodlo));
sprawdz("kursor nie ucieka po każdej literze",
  /zachowajKursorPoPrzerysowaniu\(main, '#talent-szukaj', render\)/.test(zrodlo));
sprawdz("jest przycisk czyszczenia", /talent-szukaj-wyczysc/.test(zrodlo));
sprawdz("pusta zakładka podpowiada szukanie we wszystkich",
  /talent-szukaj-wszedzie/.test(zrodlo) && /trafieniaWszedzie/.test(zrodlo));
sprawdz("parser woła filtr śmieci", /if\(liniaToSmiecTalentu\(c\)\)\{ odsiane\+\+; return; \}/.test(zrodlo));
sprawdz("licznik odsianych wraca z parsera", /odsianeSmieci: odsiane/.test(zrodlo));

console.log("\n5. Link do Transfermarktu zamiast treści strony");
sprawdz("jest wzorzec adresu profilu", /const RE_LINK_TM_ZAWODNIK = /.test(zrodlo));
sprawdz("wzorzec łapie adres z zgłoszenia", (() => {
  const re = /https?:\/\/[^\s]*transfermarkt\.[a-z.]+\/[^\s]*\/spieler\/(\d+)/i;
  return re.test("https://www.transfermarkt.pl/bartosz-szywala/profil/spieler/1209569");
})());
sprawdz("imię i nazwisko dają się wyjąć z adresu", (() => {
  const slug = "https://www.transfermarkt.pl/bartosz-szywala/profil/spieler/1209569"
    .split("/profil/")[0].split("/").filter(Boolean).pop();
  const s = slug.split("-").map((x) => x.charAt(0).toUpperCase() + x.slice(1));
  return s[0] === "Bartosz" && s.slice(1).join(" ") === "Szywala";
})());
sprawdz("profil czytany po adresie, nie z tekstu strony",
  /await talentZLinkuTransfermarkt\(link\)/.test(zrodlo));
sprawdz("rocznik z profilu sprawdzany na zakres",
  /rocznik >= NAJSTARSZY_ROCZNIK_TALENTU && rocznik <= new Date\(\)\.getFullYear\(\)/.test(zrodlo));
sprawdz("wklejona strona serwisu jest nazwana po imieniu",
  /To wygląda na skopiowaną stronę serwisu/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
