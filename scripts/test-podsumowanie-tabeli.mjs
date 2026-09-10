// Sprawdza, czy nagłówek tabeli grupy liczy niekompletne kluby TYM SAMYM dopasowaniem nazw,
// co wiersze pod nim. Na PRAWDZIWYM odcisku klubu z src/main.ts.
//
// Uruchomienie:  node scripts/test-podsumowanie-tabeli.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

const kod = [
  wytnij('importNorm', /const importNorm = [\s\S]*?\.replace\(\/\[\^a-z0-9\]\/g,''\);/),
  wytnij('SZUM_NAZWY_KLUBU', /const SZUM_NAZWY_KLUBU = \/\^\([\s\S]*?\)\$\/;/),
  wytnij('NUMER_ZESPOLU', /const NUMER_ZESPOLU = \{[\s\S]*?\};/),
  wytnij('SKROTY_NAZWY', /const SKROTY_NAZWY = \{[\s\S]*?\};/),
  wytnij('rozwinSkroty', /const rozwinSkroty = .*;/),
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/),
  wytnij('odciskKlubu', /const odciskKlubu = \(nazwa\)=>\{[\s\S]*?\};/),
].join('\n');

const f = new Function(`${kod}\n return { odciskKlubu, importNorm };`);
const { odciskKlubu, importNorm } = f();

// KLUCZOWA REGUŁA: kod widoku Klubów NIE MOŻE dopasowywać nazw przez importNorm.
console.log('\n1. Nagłówek i wiersze używają tego samego dopasowania');
const blok = zrodlo.match(/const nasze = new Map\(list\.map[\s\S]*?<\/details>`;/);
sprawdz('znalazłem blok tabeli grupy', !!blok);
if (blok) {
  sprawdz('mapa naszych klubów budowana odciskiem', /new Map\(list\.map\(c=>\[odciskKlubu\(c\.name\)/.test(blok[0]));
  sprawdz('wiersze czytane tym samym odciskiem', /nasze\.get\(odciskKlubu\(w\.nazwa\)\)/.test(blok[0]));
  sprawdz('nigdzie w tym bloku nie ma już importNorm', !/importNorm/.test(blok[0]),
    (blok[0].match(/.{0,40}importNorm.{0,40}/) || [''])[0]);
}

// Pary nazw, które NAPRAWDĘ się rozjeżdżają między 90minut a kartoteką SBS.
const PARY = [
  ['Wisła Dobrzyń nad Wisłą', 'Wisła Dobrzyń n/Wisłą', 'skrót „n/" zamiast „nad"'],
  ['Rawys CEO Raciąż', 'KS Rawys CEO Raciąż', 'przedrostek KS'],
  ['Start ECO-POL Pruszcz', 'Start ECO POL Pruszcz', 'myślnik w sponsorze'],
  ['Górnik Łęczna S.A.', 'Górnik Łęczna', 'dopisek S.A.'],
  ['Unia Solec Kujawski', 'MKS Unia Solec Kujawski', 'przedrostek MKS'],
];
console.log('\n2. Te same kluby zapisane inaczej muszą się łączyć');
PARY.forEach(([a, b, czemu]) => {
  const laczy = odciskKlubu(a) === odciskKlubu(b);
  sprawdz(`„${a}" = „${b}" (${czemu})`, laczy, odciskKlubu(a) + '  vs  ' + odciskKlubu(b));
  if (importNorm(a) !== importNorm(b) && laczy) {
    console.log('        (importNorm by tego NIE połączył — stąd brał się fałszywy alarm)');
  }
});

// REZERWY TO NIE PIERWSZY ZESPÓŁ — to jest granica, której odcisk nie może przekroczyć.
console.log('\n3. Rezerwy zostają odrębnym klubem');
const OSOBNE = [
  ['Avia Świdnik', 'Avia II Świdnik'],
  ['Górnik Łęczna', 'Górnik II Łęczna'],
  ['Lechia Zielona Góra', 'Lechia II Zielona Góra'],
];
OSOBNE.forEach(([pierwszy, rezerwy]) => {
  sprawdz(`„${pierwszy}" ≠ „${rezerwy}"`, odciskKlubu(pierwszy) !== odciskKlubu(rezerwy),
    odciskKlubu(pierwszy) + '  vs  ' + odciskKlubu(rezerwy));
});
console.log('\n4. Rezerwy zapisane w innej kolejności to nadal te same rezerwy');
[['Avia II Świdnik', 'Avia Świdnik II'], ['Górnik II Łęczna', 'Górnik Łęczna II']].forEach(([a, b]) => {
  sprawdz(`„${a}" = „${b}"`, odciskKlubu(a) === odciskKlubu(b), odciskKlubu(a) + '  vs  ' + odciskKlubu(b));
});

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
