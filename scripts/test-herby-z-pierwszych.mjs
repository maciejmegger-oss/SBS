// Sprawdza dobieranie herbu drużyny młodzieżowej od pierwszej drużyny — na PRAWDZIWYCH
// funkcjach wyciętych z src/main.ts.
//
// Uruchomienie:  node scripts/test-herby-z-pierwszych.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

const czesci = [
  wytnij('importNorm', /const importNorm = [\s\S]*?\.replace\(\/\[\^a-z0-9\]\/g,''\);/),
  wytnij('SZUM_NAZWY_KLUBU', /const SZUM_NAZWY_KLUBU = \/\^\([\s\S]*?\)\$\/;/),
  wytnij('NUMER_ZESPOLU', /const NUMER_ZESPOLU = \{[\s\S]*?\};/),
  wytnij('SKROTY_NAZWY', /const SKROTY_NAZWY = \{[\s\S]*?\};/),
  wytnij('rozwinSkroty', /const rozwinSkroty = .*;/),
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/),
  wytnij('tenSamCzlon', /const tenSamCzlon = \(x, y\)=>\{[\s\S]*?\n\};/),
  wytnij('wTychRozgrywkach', /function wTychRozgrywkach\(liga, wskazanie\)\{[\s\S]*?\n\}/),
  wytnij('POZIOMY_SENIORSKIE', /const POZIOMY_SENIORSKIE = \[[\s\S]*?\];/),
  wytnij('seniorskiKlub', /function seniorskiKlub\(c\)\{[\s\S]*?\n\}/),
  wytnij('znajdzHerbPierwszejDruzyny', /function znajdzHerbPierwszejDruzyny\(klub\)\{[\s\S]*?\n\}/),
];

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

// `zHerbem` mówi, które kartoteki mają wgrany herb.
const zbuduj = (kluby, zHerbem) => new Function(`
  const DB = { clubs: ${JSON.stringify(kluby)} };
  const HERBY = new Set(${JSON.stringify(zHerbem)});
  const clubCrest = (id)=> HERBY.has(id) ? ('herb-' + id) : null;
  ${czesci.join('\n')}
  return znajdzHerbPierwszejDruzyny;`)();

const KLUBY = [
  { id: 's1', name: 'Chrobry Głogów', league: 'I liga' },
  { id: 's2', name: 'Śląsk Wrocław', league: 'Ekstraklasa' },
  { id: 's3', name: 'Śląsk II Wrocław', league: 'III liga, gr. III' },
  { id: 's4', name: 'Zagłębie Lubin', league: 'Ekstraklasa' },
  { id: 's5', name: 'Wisła Kraków', league: 'I liga' },
  { id: 's6', name: 'Cracovia Kraków', league: 'Ekstraklasa' },
  { id: 'm1', name: 'CHROBRY GŁOGÓW S.A.', league: 'CLJ U15 gr. C' },
  { id: 'm2', name: 'ŚLĄSK WROCŁAW', league: 'CLJ U15 gr. C' },
  { id: 'm3', name: 'KS Cracovia SA Kraków', league: 'CLJ U15 gr. D' },
  { id: 'm4', name: 'FC Wrocław Academy U.K.S.', league: 'CLJ U15 gr. C' },
  { id: 'm5', name: 'ZAGŁĘBIE LUBIN', league: 'CLJ U17 gr. I' },
];

// 1. Podstawowy przypadek: młodzież bierze herb od pierwszej drużyny.
{
  const f = zbuduj(KLUBY, ['s1', 's2', 's3', 's4', 's5', 's6']);
  console.log('\n1. Herb od pierwszej drużyny');
  const a = f(KLUBY.find(c => c.id === 'm1'));
  sprawdz('CHROBRY GŁOGÓW S.A. → Chrobry Głogów', a && a.id === 's1', a ? a.name : 'brak');
  const b = f(KLUBY.find(c => c.id === 'm3'));
  sprawdz('KS Cracovia SA Kraków → Cracovia Kraków, nie Wisła', b && b.id === 's6', b ? b.name : 'brak');
  const d = f(KLUBY.find(c => c.id === 'm5'));
  sprawdz('ZAGŁĘBIE LUBIN → Zagłębie Lubin', d && d.id === 's4', d ? d.name : 'brak');
}

// 2. Pierwsza drużyna przed rezerwami.
{
  const f = zbuduj(KLUBY, ['s2', 's3']);
  const c = f(KLUBY.find(x => x.id === 'm2'));
  console.log('\n2. Pierwsza drużyna przed rezerwami');
  sprawdz('ŚLĄSK WROCŁAW → Śląsk Wrocław, nie Śląsk II', c && c.id === 's2', c ? c.name : 'brak');
}

// 3. Samo miasto to za mało — inaczej Wisła wzięłaby herb Cracovii.
{
  const f = zbuduj(KLUBY, ['s5', 's6']);
  const c = f({ id: 'x', name: 'AKADEMIA KRAKÓW', league: 'CLJ U15 gr. D' });
  console.log('\n3. Zgodne miasto, nazwa zupełnie inna');
  sprawdz('nie podstawiamy herbu na chybił trafił', !c, c ? c.name : 'brak');
}

// 4. Nie pożyczamy od innej drużyny młodzieżowej — brak rozmnożyłby się na całą strukturę.
{
  const f = zbuduj(KLUBY, ['m5']);   // herb ma TYLKO kartoteka U17
  const c = f({ id: 'x', name: 'ZAGŁĘBIE LUBIN', league: 'CLJ U15 gr. C' });
  console.log('\n4. Źródłem może być tylko drużyna seniorska');
  sprawdz('U15 nie bierze herbu od U17', !c, c ? c.name : 'brak');
}

// 5. Kartoteka bez herbu nie jest źródłem.
{
  const f = zbuduj(KLUBY, []);
  const c = f(KLUBY.find(x => x.id === 'm1'));
  console.log('\n5. Pierwsza drużyna też nie ma herbu');
  sprawdz('nie zwracamy pustego źródła', !c, c ? c.name : 'brak');
}

// 6. Klub bez rozpoznawalnego miasta zostawiamy w spokoju.
{
  const f = zbuduj(KLUBY, ['s1']);
  const c = f({ id: 'x', name: 'AP TALENT', league: 'CLJ U15 gr. A' });
  console.log('\n6. Nazwa bez miasta');
  sprawdz('nie zgadujemy', !c, c ? c.name : 'brak');
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
