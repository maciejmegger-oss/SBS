// Statystyki z Transfermarktu — sumy sezonów i rozgrywek z serwisu danych (api/_tm-wystepy.js).
//
// Zgłoszenie (13.10.2026): „jak są na Transfermarkt, to niech system już wprowadza ich dane
// statystyczne — mecze, minuty, gole, asysty, jak najwięcej danych". Najważniejsze w tym teście:
// MECZE DRUŻYNY. Bez nich nie ma udziału w minutach, a bez udziału nie ma tempa rozwoju.
// „Grał w innej drużynie" nie może się wliczyć — to mecz rezerw, nie jego opuszczony mecz.
//
// Dane: wycinek prawdziwej odpowiedzi z 13.10.2026 (scripts/fixtures/tm-performance-husar.json).
// Uruchomienie:  node scripts/test-tm-wystepy.mjs
import fs from "node:fs";
import { buildSync } from "esbuild";
import { zsumujWystepy, profilZTmapi, czyLiga } from "../api/_tm-wystepy.js";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

const { performance } = JSON.parse(fs.readFileSync("scripts/fixtures/tm-performance-husar.json", "utf8"));
const rozgrywki = { SK2: { nazwa: "MONACObet Liga", typ: 2 }, SK19: { nazwa: "I. Liga starsieho dorastu", typ: 7 }, SLO1: { nazwa: "Niké Liga", typ: 1 } };
const sezony = zsumujWystepy(performance, rozgrywki, { "46955": "Dynamo Malzenice" });
const wiersz = (sez, komp) => sezony.find((s) => s.sezonId === sez)?.rozgrywki.find((r) => r.rozgrywkiId === komp);

console.log("\n1. Sezony i kolejność");
sprawdz("trzy sezony, od najnowszego", sezony.map((s) => s.sezonId).join(",") === "2026,2025,2024", sezony.map((s) => s.sezonId).join(","));
sprawdz("nazwa sezonu jak na Transfermarkcie („26/27”)", sezony[0].sezon === "26/27");
sprawdz("liga przed reprezentacją w obrębie sezonu", !sezony[0].rozgrywki[0].reprezentacja);

console.log("\n2. Liga (MONACObet Liga 26/27)");
const sk2 = wiersz(2026, "SK2");
sprawdz("mecze drużyny = zagrane + poza kadrą (2)", sk2.meczeDruzyny === 2, String(sk2.meczeDruzyny));
sprawdz("występy 1, od 1. minuty 1, minuty 90", sk2.wystepy === 1 && sk2.odPierwszej === 1 && sk2.minuty === 90);
sprawdz("minuty możliwe = 2 × 90", sk2.minutyMozliwe === 180);
sprawdz("nazwa rozgrywek i klubu podstawione", sk2.rozgrywki === "MONACObet Liga" && sk2.klub === "Dynamo Malzenice");
sprawdz("liga liczy się do udziału", czyLiga(sk2));

console.log("\n3. Stany udziału");
const sk19 = wiersz(2025, "SK19");
sprawdz("„grał w innej drużynie” NIE jest meczem drużyny (2, nie 3)", sk19.meczeDruzyny === 2, String(sk19.meczeDruzyny));
sprawdz("wejście z ławki liczone osobno", sk19.zLawki === 1 && sk19.odPierwszej === 0 && sk19.minuty === 45);
sprawdz("liga młodzieżowa nie liczy się do udziału", !czyLiga(sk19));
const slar = wiersz(2025, "SLAR");
sprawdz("„w kadrze” bez wejścia: w kadrze 1, występów 0", slar.wKadrze === 1 && slar.wystepy === 0);
sprawdz("mecz z dogrywką ma 120 minut możliwych", wiersz(2026, "ECLQ").minutyMozliwe === 120);
const u19 = wiersz(2026, "U19Q");
sprawdz("reprezentacja oznaczona i liczona osobno (1 gol z FS nie miesza się z ligą)",
  u19.reprezentacja && wiersz(2026, "FS").gole === 1 && sk2.gole === 0);

console.log("\n4. Kartki i puste dane");
const zKartka = JSON.parse(JSON.stringify(performance[0]));
zKartka.gameInformation.gameId = "x"; zKartka.statistics.cardStatistics = { yellowCardNet: 1, yellowCard: { minute: 54 } };
const zCzerwona = JSON.parse(JSON.stringify(performance[0]));
zCzerwona.gameInformation.gameId = "y"; zCzerwona.statistics.cardStatistics = { yellowCardNet: 0, redCard: { minute: 80 } };
const k = zsumujWystepy([zKartka, zCzerwona])[0].rozgrywki[0];
sprawdz("żółta i czerwona kartka zliczone", k.zolte === 1 && k.czerwone === 1, JSON.stringify(k));
sprawdz("pusta odpowiedź → pusta lista, bez wyjątku", zsumujWystepy(null).length === 0 && zsumujWystepy([]).length === 0);

console.log("\n5. Profil");
const prof = profilZTmapi({ name: "Tadeas Husar", lifeDates: { dateOfBirth: "2008-08-03" },
  attributes: { height: 1.82, preferredFootId: 1, contractUntil: "2027-06-30", consultantAgency: { name: "SBE Management AG" } },
  marketValueDetails: { current: { value: 25000 } }, ribbon: { ribbonType: "ON_LOAN" } });
sprawdz("wzrost w metrach → centymetry", prof.wzrost === 182, String(prof.wzrost));
sprawdz("kontrakt, menedżer, wycena, wypożyczenie", prof.kontraktDo === "2027-06-30" && prof.menedzer === "SBE Management AG"
  && prof.wartosc === "25 tys. €" && prof.wypozyczony === true, JSON.stringify(prof));
sprawdz("brak wzrostu zostaje pusty, nie zerem", profilZTmapi({ attributes: { height: null } }).wzrost === null);

console.log("\n6. Rynki: sezon ligowy, udział i tempo z Transfermarktu");
const { outputFiles } = buildSync({
  stdin: { contents: "export * from './src/data/rynki.ts';", resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "esm", write: false,
});
const R = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
const stat = { pobrano: "2026-10-13T20:00:00Z", profil: null, sezony: [
  { sezonId: 2026, sezon: "2026", rozgrywki: [{ ...sk2, rozgrywki: "Superettan", minuty: 900, minutyMozliwe: 1800, wystepy: 12, meczeDruzyny: 20 }] },
  { sezonId: 2025, sezon: "2025", rozgrywki: [{ ...sk2, rozgrywki: "Superettan", minuty: 270, minutyMozliwe: 2700, wystepy: 5, meczeDruzyny: 30 }] },
] };
const [biez, poprz] = R.sezonyLigowe(stat);
sprawdz("udział bieżący 50%, poprzedni 10%", Math.abs(biez.udzial - 0.5) < 1e-9 && Math.abs(poprz.udzial - 0.1) < 1e-9);
R.zapiszStatystykiTM("1172430", stat); // Axel Brönner, kadra U-19, IFK Norrköping (Superettan)
const axel = R.zawodnicyRynkow(new Date(2026, 9, 13)).find((z) => z.tmId === "1172430");
sprawdz("zawodnik z kadr dostaje udział i tempo „Skok” z Transfermarktu", axel && axel.udzial === 0.5 && axel.tempo === "Skok", JSON.stringify(axel && [axel.udzial, axel.tempo]));
sprawdz("źródło liczb oznaczone jako Transfermarkt", axel && axel.zrodloLiczb === "transfermarkt");
sprawdz("statystyki starsze niż doba trzeba odświeżyć", R.staryStanTM("1172430", new Date("2026-10-15T00:00:00Z")) && !R.staryStanTM("1172430", new Date("2026-10-13T21:00:00Z")));
sprawdz("numer z adresu profilu", R.tmIdZLinku("https://www.transfermarkt.pl/tadeas-husar/profil/spieler/1260327") === "1260327");

console.log("\n7. Podpięcie");
const zrodlo = fs.readFileSync("src/main.ts", "utf8");
sprawdz("statystyki wczytywane przy starcie i zapisywane", /czytaj\('scouting:rynki_tm'\)/.test(zrodlo) && /robustStorageSet\('scouting:rynki_tm'/.test(zrodlo));
sprawdz("karta pobiera sama, gdy dane są starsze niż doba", /staryStanTM\(zw\.tmId, new Date\(\)\)/.test(zrodlo));
sprawdz("przy kilku kandydatach decyduje skaut (nie zgadujemy)", /kand\.length > 1\)\{ rynkiTM = \{ wTrakcie: '', blad: '', kandydaci: kand/.test(zrodlo));
sprawdz("cała liga jednym przyciskiem", /data-action="rynki-tm-liga"/.test(zrodlo));
sprawdz("profil może mieć adres Transfermarktu w edycji", /id="\$\{id\}"/.test(zrodlo) && /pole\('rz-tm'/.test(zrodlo));

console.log(bledy ? `\n${bledy} błąd(ów).` : "\nWszystko w porządku.");
process.exit(bledy ? 1 : 0);
