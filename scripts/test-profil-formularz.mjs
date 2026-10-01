// Sprawdza formularz i widok profilu kompetencji — na PRAWDZIWYM kodzie z src/main.ts.
//
// Zgłoszenie (01.10.2026): „czy możemy stworzyć taką ocenę profilu w systemie?" → wybrany
// formularz wypełniany w SBS, dostęp jak do raportów. Liczy się to, że: średnia liczy się
// z WYPEŁNIONYCH pól (niedokończona ocena nie zjeżdża do zera), średnia „na pozycji" bierze tylko
// elementy kluczowe dla wskazanego profilu, deficyty dają się policzyć, a profil zapisuje się bez
// żadnej migracji bazy — bo zlecenia analiz stały przez nieuruchomioną migrację.
//
// Uruchomienie:  node scripts/test-profil-formularz.mjs
import fs from "node:fs";
import { buildSync } from "esbuild";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const style = fs.readFileSync("src/style.css", "utf8");
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

// Dane modelu bierzemy z prawdziwych plików, nie z atrapy — inaczej test przeszedłby także wtedy,
// gdy taksonomia i kod liczący rozjadą się nazwami elementów.
const { outputFiles } = buildSync({
  stdin: {
    contents: `export { OBSZARY_PROFILU, LEGENDA_OCENY, DRABINA_NOTOWANIA } from './src/data/profil-kompetencji.ts';
               export { PROFILE_POZYCJI, profilDlaNumeru, profilPoKodzie } from './src/data/profil-pozycje.ts';`,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "esm", write: false,
});
const D = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));

const kod = [
  wytnij("ZNAK_OPIS", /const ZNAK_OPIS = \{[^\n]*\};/),
  wytnij("ZNAK_KOLEJNOSC", /const ZNAK_KOLEJNOSC = \[[^\n]*\];/),
  wytnij("sezonIRunda", /function sezonIRunda\(dzis\)\{[\s\S]*?\n\}/),
  wytnij("profileZawodnika", /function profileZawodnika\(playerId\)\{[\s\S]*?\n\}/),
  wytnij("elementyOceniane", /function elementyOceniane\(\)\{[\s\S]*?\n\}/),
  wytnij("pustyProfilKompetencji", /function pustyProfilKompetencji\(p, autor, dzis\)\{[\s\S]*?\n\}/),
  wytnij("podsumowanieObszaruProfilu", /function podsumowanieObszaruProfilu\(profil, nazwaObszaru\)\{[\s\S]*?\n\}/),
  wytnij("sredniaNaPozycjiProfilu", /function sredniaNaPozycjiProfilu\(profil\)\{[\s\S]*?\n\}/),
  wytnij("deficytyProfilu", /function deficytyProfilu\(profil\)\{[\s\S]*?\n\}/),
].join("\n");

let profileKompetencji = [];
const api = new Function("OBSZARY_PROFILU", "LEGENDA_OCENY", "DRABINA_NOTOWANIA", "profilDlaNumeru", "profilPoKodzie",
  "profileKompetencji", "uid",
  `${kod}\n return { sezonIRunda, profileZawodnika, elementyOceniane, pustyProfilKompetencji,
     podsumowanieObszaruProfilu, sredniaNaPozycjiProfilu, deficytyProfilu };`)(
  D.OBSZARY_PROFILU, D.LEGENDA_OCENY, D.DRABINA_NOTOWANIA, D.profilDlaNumeru, D.profilPoKodzie,
  profileKompetencji, (pre) => pre + "-1");

console.log("\n1. Sezon i runda same się ustawiają");
sprawdz("październik 2026 to jesień 2026/2027",
  JSON.stringify(api.sezonIRunda("2026-10-01")) === '{"sezon":"2026/2027","runda":"JESIENNA"}', JSON.stringify(api.sezonIRunda("2026-10-01")));
sprawdz("marzec 2024 to wiosna 2023/2024",
  JSON.stringify(api.sezonIRunda("2024-03-15")) === '{"sezon":"2023/2024","runda":"WIOSENNA"}', JSON.stringify(api.sezonIRunda("2024-03-15")));
sprawdz("czerwiec to jeszcze wiosna, lipiec już jesień",
  api.sezonIRunda("2026-06-30").runda === "WIOSENNA" && api.sezonIRunda("2026-07-01").runda === "JESIENNA");

console.log("\n2. Nowa ocena bierze, co już wiemy z kartoteki");
{
  const p = { id: "Z1", firstName: "Bartosz", lastName: "Szczepankiewicz", pozycjaNmg: 6, height: 187, weight: 86, foot: "prawa" };
  const nowy = api.pustyProfilKompetencji(p, "MACIEJ MEGGER", "2026-10-01");
  sprawdz("profil pozycyjny z numeru NMG (6 → DCM)", nowy.profil === "DCM (6)", nowy.profil);
  sprawdz("wzrost, masa i noga przepisane z kartoteki", nowy.wzrost === 187 && nowy.masa === 86 && nowy.noga === "prawa");
  sprawdz("trener wypełniony kontem skauta", nowy.trener === "MACIEJ MEGGER" && nowy.autor === "MACIEJ MEGGER");
  sprawdz("oceny i znaki startują puste, nie wyzerowane", JSON.stringify(nowy.oceny) === "{}" && JSON.stringify(nowy.znaki) === "{}");
  sprawdz("notowanie nie jest zgadywane", nowy.notowanieStan === null && nowy.notowaniePotencjal === null);
  const bezNumeru = api.pustyProfilKompetencji({ id: "Z2" }, "", "2026-10-01");
  sprawdz("zawodnik bez numeru pozycji nie dostaje wymyślonego profilu", bezNumeru.profil === "");
}

console.log("\n3. Średnia liczona z WYPEŁNIONYCH pól");
{
  const profil = { oceny: { "POWSTRZYMANIE": 5, "ANTYCYPACJA": 5, "ASEKURACJA DEFENSYWNA": 6 }, znaki: {} };
  const w = api.podsumowanieObszaruProfilu(profil, "Koncepty — defensywa");
  sprawdz("trzy z sześciu elementów, średnia 5,33 (a nie 2,67 z wyzerowanych)",
    w.ocenionych === 3 && w.wszystkich === 6 && Math.abs(w.srednia - 16 / 3) < 0.001, JSON.stringify(w));
  const pusty = api.podsumowanieObszaruProfilu({ oceny: {}, znaki: {} }, "Koncepty — defensywa");
  sprawdz("obszar bez ani jednej oceny nie ma średniej, nie ma zera", pusty.srednia === null && pusty.ocenionych === 0);
  sprawdz("ocena poza skalą 1–6 nie wchodzi do średniej",
    api.podsumowanieObszaruProfilu({ oceny: { "POWSTRZYMANIE": 9 }, znaki: {} }, "Koncepty — defensywa").ocenionych === 0);
  sprawdz("testy motoryczne nie są liczone jako nieocenione elementy",
    api.podsumowanieObszaruProfilu({ oceny: {}, znaki: {} }, "Atrybuty fizyczne").wszystkich === 7,
    String(api.podsumowanieObszaruProfilu({ oceny: {}, znaki: {} }, "Atrybuty fizyczne").wszystkich));
  sprawdz("42 oceniane elementy w całym profilu", api.elementyOceniane().length === 42, String(api.elementyOceniane().length));
}

console.log("\n4. Znaki składowych — wiodąca, neutralnie, deficyt");
{
  const profil = { oceny: {}, znaki: {
    "POWSTRZYMANIE|WYGRANIE POZYCJI": "W", "POWSTRZYMANIE|SKUTECZNY ODBIÓR": "N",
    "POWSTRZYMANIE|WŚLIZG": "D", "ANTYCYPACJA|W PRZESTRZENI": "D",
  } };
  const w = api.podsumowanieObszaruProfilu(profil, "Koncepty — defensywa");
  sprawdz("rozkład znaków policzony", w.wiodacych === 1 && w.neutralnych === 1 && w.deficytow === 2, JSON.stringify(w));
  const def = api.deficytyProfilu(profil);
  sprawdz("deficyty wypisane z nazwą elementu i składowej", def.length === 2
    && def[0].element === "POWSTRZYMANIE" && def[0].skladowa === "WŚLIZG", JSON.stringify(def));
  sprawdz("znak na składowej, której w modelu nie ma, nie liczy się nigdzie",
    api.deficytyProfilu({ znaki: { "NIE MA TAKIEGO|ANI TAKIEJ": "D" } }).length === 0);
}

console.log("\n5. Średnia NA POZYCJI — po to jest cały podział");
{
  // Prawdziwe oceny Szczepankiewicza z arkusza: słabe są finalizacja (3) i zwinność (3), ale
  // „szóstki" nie oceniamy po finalizacji.
  const oceny = { "POSTĘP": 6, "WSPARCIE": 6, "ASEKURACJA DEFENSYWNA": 6, "WYTRZYMAŁOŚĆ": 6,
    "PERCEPCJA": 5, "KONTROLA TEMPA I KIERUNKU": 5, "REAKCJA NA ODBIÓR": 5, "POWSTRZYMANIE": 5,
    "ANTYCYPACJA": 5, "REAKCJA PO STRACIE": 5, "KRÓTKIE PODANIE": 5, "KOMUNIKACJA": 5,
    "DŁUGIE PODANIE": 4, "PRZYJĘCIE PIŁKI / 1ST TOUCH": 4,
    "FINALIZACJA": 3, "ZWINNOŚĆ": 3 };
  const poz = api.sredniaNaPozycjiProfilu({ profil: "DCM (6)", oceny, znaki: {} });
  sprawdz("na DCM liczy tylko elementy kluczowe (14 z 42)", poz.ile === 14 && poz.wszystkich === 14, JSON.stringify({ ile: poz.ile, w: poz.wszystkich }));
  sprawdz("średnia na pozycji 5,1 — finalizacja 3 jej nie zaniża", Math.abs(poz.srednia - 72 / 14) < 0.001, String(poz.srednia));
  sprawdz("najsłabsze z kluczowych wskazane (dwie czwórki, nie trójki spoza profilu)",
    poz.najslabsze.length === 3 && poz.najslabsze.slice(0, 2).every(x => x.v === 4)
    && !poz.najslabsze.some(x => x.el === "FINALIZACJA"), JSON.stringify(poz.najslabsze));
  const napastnik = api.sredniaNaPozycjiProfilu({ profil: "CF (9)", oceny, znaki: {} });
  sprawdz("ten sam zestaw ocen na CF wypada niżej — i o to chodzi",
    napastnik.srednia < poz.srednia, `CF ${napastnik.srednia} vs DCM ${poz.srednia}`);
  sprawdz("bez wskazanego profilu nie udajemy średniej na pozycji",
    api.sredniaNaPozycjiProfilu({ profil: "", oceny }) === null);
  sprawdz("bramkarz nosi ostrzeżenie o niepełnym arkuszu",
    /gra na linii/.test(api.sredniaNaPozycjiProfilu({ profil: "GK (1)", oceny: {} }).brakWArkuszu));
}

console.log("\n6. Kolejność ocen i wiele rund");
{
  profileKompetencji.length = 0;
  profileKompetencji.push(
    { id: "A", playerId: "Z1", sezon: "2023/2024", runda: "JESIENNA" },
    { id: "B", playerId: "Z1", sezon: "2023/2024", runda: "WIOSENNA" },
    { id: "C", playerId: "Z1", sezon: "2026/2027", runda: "JESIENNA" },
    { id: "D", playerId: "Z9", sezon: "2026/2027", runda: "JESIENNA" },
  );
  const lista = api.profileZawodnika("Z1");
  sprawdz("tylko oceny tego zawodnika", lista.length === 3);
  sprawdz("najnowsza runda pierwsza", lista.map(z => z.id).join("") === "CBA", lista.map(z => z.id).join(""));
  sprawdz("wiosna jest późniejsza niż jesień tego samego sezonu", lista[1].id === "B");
  profileKompetencji.length = 0;
}

console.log("\n7. Podpięcie w aplikacji");
sprawdz("panel otwiera się w karcie zawodnika", /\$\{profilKompetencjiPanelHtml\(p\)\}/.test(zrodlo));
sprawdz("przycisk zakłada nową rundę, a z data-profil edytuje istniejącą",
  /\[data-action="profil-kompetencji"\][\s\S]{0,200}openProfilKompetencjiModal\(b\.dataset\.id, b\.dataset\.profil \|\| null\)/.test(zrodlo));
sprawdz("ocena 1–6 to sześć przycisków, nie lista rozwijana", /\[1,2,3,4,5,6\]\.map\(v=>`<button type="button" class="pk-o/.test(zrodlo));
sprawdz("powtórne kliknięcie tej samej oceny czyści pole (pomyłka da się cofnąć)",
  /if\(teraz === v\) delete stan\.oceny\[el\];/.test(zrodlo));
sprawdz("składowa przeskakuje wiodąca → neutralnie → deficyt → puste",
  /ZNAK_KOLEJNOSC\[\(ZNAK_KOLEJNOSC\.indexOf\(teraz\) \+ 1\) % ZNAK_KOLEJNOSC\.length\]/.test(zrodlo));
sprawdz("opis każdego stopnia skali w podpowiedzi przycisku", /LEGENDA_OCENY\.find\(l=>l\.stopien===v\)/.test(zrodlo));
sprawdz('zmiana profilu pozycyjnego przestawia znaczniki „kluczowe"', /#pk-profil'\) as HTMLSelectElement\)\.onchange/.test(zrodlo));
sprawdz("nieudany zapis przywraca stan sprzed kliknięcia",
  /const kopia = profileKompetencji\.slice\(\);[\s\S]{0,400}if\(ok === false\)\{\s*\n\s*profileKompetencji = kopia;/.test(zrodlo));

console.log("\n8. Zapis bez migracji bazy");
sprawdz("profile wczytywane razem z resztą danych", /czytaj\('scouting:profile_kompetencji'\)/.test(zrodlo));
sprawdz("zapis idzie drogą sbs_kv, jak mapa pozycji",
  /async function saveProfileKompetencji\(\)\{ return robustStorageSet\('scouting:profile_kompetencji'/.test(zrodlo));
sprawdz("ponowienie nieudanego zapisu zna tę kolekcję",
  /'scouting:profile_kompetencji': \(\)=>saveProfileKompetencji\(\)/.test(zrodlo));
sprawdz("nieudany odczyt nie udaje pustej listy ocen", /profileKompetencji = profileRow \? JSON\.parse\(profileRow\.value\) : \[\]/.test(zrodlo));
sprawdz("napisane wprost, dlaczego bez migracji", /zlecenia analiz wideo czekały na nieuruchomioną\s+migrację/i.test(zrodlo));

console.log("\n9. Wygląd");
sprawdz("znaki składowych używają barw przełączanych motywem", /\.pk-z-W\{background:var\(--good-bg\);color:var\(--good\)/.test(style));
sprawdz("kontrast opisany w arkuszu", /jasny motyw 4,7:1, ciemny 5,1:1/.test(style));
sprawdz("podsumowanie jedzie z widokiem przy 42 elementach", /\.pk-podsumowanie\{position:sticky/.test(style));
sprawdz("na telefonie przyciski ocen większe pod palec", /@media \(max-width:640px\)\{[\s\S]*?\.pk-o\{width:36px/.test(style));
sprawdz("okno szersze niż zwykłe (42 elementy w rzędach)", /\.modal-wide\{max-width:980px;\}/.test(style));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
