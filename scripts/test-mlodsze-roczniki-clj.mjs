// Sprawdza rozpoznawanie poziomu dla MŁODSZYCH roczników CLJ — na PRAWDZIWYCH tablicach
// i funkcji z src/main.ts.
//
// PO CO OSOBNY TEST: po uruchomieniu czterech grup CLJ U15 każdy ich protokół dostawał poziom
// „CLJ U19" z reguły ogólnej. Filtr żądał wtedy ligi zaczynającej się od „CLJ U19" i odrzucał
// WSZYSTKIE kluby U15 — kolejka rozpoznawała się bez zarzutu i nie zapisywała ani jednego
// zawodnika, a na ekranie stało zdanie zaprzeczające sobie: „ZKS Olimpia Elbląg gra w CLJ U15
// gr. A, a zbierasz do CLJ U15 gr. A".
//
// Uruchomienie:  node scripts/test-mlodsze-roczniki-clj.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

// Tabela nazywa się POZIOMY_LNP, odkąd korzysta z niej także panel mobilny.
const POZIOMY = eval(wytnij('POZIOMY_LNP', /const POZIOMY_LNP: \[RegExp, string\]\[\] = \[[\s\S]*?\n\];/)
  .replace(/^\s*const POZIOMY_LNP: \[RegExp, string\]\[\] = /, '').replace(/;$/, ''));
const poziomZTekstu = (t) => { for (const [w, p] of POZIOMY) { if (w.test(t)) return p; } return ''; };
const poziomGrupy = new Function(wytnij('poziomGrupy', /function poziomGrupy\(nazwaGrupy\)\{[\s\S]*?\n\}/)
  + '; return poziomGrupy;')();

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

console.log('1. Poziom z treści protokołu');
[
  ['3 kolejka, Centralna Liga Juniorów U-15, grupa A', 'CLJ U15'],
  ['1 kolejka, CLJ U15 gr. B', 'CLJ U15'],
  ['5 kolejka, CLJ U-16', 'CLJ U16'],
  ['2 kolejka, CLJ U17 grupa I', 'CLJ U17'],
  ['4 kolejka, Centralna Liga Juniorów U-19', 'CLJ U19'],
  ['7 kolejka, Centralna Liga Juniorów', 'CLJ U19'],
  ['1 kolejka, Liga makroregionalna U16', 'Liga makroregionalna U16'],
  ['2 kolejka, Czwarta liga', 'IV liga'],
].forEach(([tekst, oczekiwane]) => {
  sprawdz(`„${tekst}" → ${oczekiwane}`, poziomZTekstu(tekst) === oczekiwane, poziomZTekstu(tekst) || '(nic)');
});

console.log('\n2. Poziom z nazwy grupy w kartotece');
[
  ['CLJ U15 gr. A', 'CLJ U15'],
  ['CLJ U15 gr. D', 'CLJ U15'],
  ['CLJ U17 gr. I', 'CLJ U17'],
  ['CLJ U17 gr. II', 'CLJ U17'],
  ['CLJ U19', 'CLJ U19'],
  ['Liga makroregionalna U16', 'Liga makroregionalna U16'],
  ['IV liga (dolnośląska)', 'IV liga'],
  ['III liga, gr. III', 'III liga'],
  ['Ekstraklasa', 'Ekstraklasa'],
].forEach(([grupa, oczekiwane]) => {
  sprawdz(`„${grupa}" → ${oczekiwane}`, poziomGrupy(grupa) === oczekiwane, poziomGrupy(grupa) || '(nic)');
});

// 3. SEDNO BŁĘDU: liga klubu z danej grupy MUSI przejść filtr poziomu wyliczonego z tej grupy.
//    Filtr działa przez startsWith, więc to jest dokładnie ten warunek, który wcześniej zawodził.
console.log('\n3. Klub ze swojej grupy przechodzi własny filtr poziomu');
['CLJ U15 gr. A', 'CLJ U15 gr. B', 'CLJ U15 gr. C', 'CLJ U15 gr. D',
 'CLJ U17 gr. I', 'CLJ U17 gr. II', 'CLJ U19', 'Liga makroregionalna U16',
 'IV liga (dolnośląska)', 'III liga, gr. III'].forEach(liga => {
  const poziom = poziomGrupy(liga);
  sprawdz(`„${liga}" przechodzi filtr „${poziom}"`,
    !!poziom && liga.toLowerCase().startsWith(poziom.toLowerCase()), `poziom: ${poziom || '(nic)'}`);
});

// 4. Rocznik z protokołu i rocznik z grupy muszą się zgadzać — inaczej wraca ten sam błąd
//    w drugą stronę: protokół U15 odrzucony przy otwartej grupie U15.
console.log('\n4. Protokół i grupa mówią o tym samym poziomie');
[
  ['1 kolejka, CLJ U15 gr. A', 'CLJ U15 gr. A'],
  ['2 kolejka, CLJ U17 gr. II', 'CLJ U17 gr. II'],
  ['3 kolejka, Centralna Liga Juniorów U-19', 'CLJ U19'],
].forEach(([tekst, grupa]) => {
  sprawdz(`„${tekst}" zgodne z grupą „${grupa}"`, poziomZTekstu(tekst) === poziomGrupy(grupa),
    `${poziomZTekstu(tekst)} vs ${poziomGrupy(grupa)}`);
});

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
