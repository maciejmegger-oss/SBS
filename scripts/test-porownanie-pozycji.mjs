// Sprawdza porównanie zawodnika z resztą jego pozycji — na PRAWDZIWYCH funkcjach z src/main.ts.
//
// Uruchomienie:  node scripts/test-porownanie-pozycji.mjs
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
  wytnij('topLevelOf', /function topLevelOf\(league\)\{[\s\S]*?\n\}/),
  wytnij('POSITION_NUMBERS', /const POSITION_NUMBERS = \[[\s\S]*?\n\];/),
  wytnij('sredniaZRaportow', /function sredniaZRaportow\(reps\)\{[\s\S]*?\n\}/),
  wytnij('ocenyZRaportow', /function ocenyZRaportow\(\)\{[\s\S]*?\n\}/),
  wytnij('pozycjaDoPorownan', /function pozycjaDoPorownan\(p\)\{[\s\S]*?\n\}/),
  wytnij('MIN_GRUPA_POROWNANIA', /const MIN_GRUPA_POROWNANIA = \d+;/),
  wytnij('porownanieNaPozycji', /function porownanieNaPozycji\(p, oceny\)\{[\s\S]*?\n\}/),
].join('\n');

function scena(players, clubs, reports) {
  const DB = { players, clubs, reports };
  const clubLeague = (id) => (clubs.find(c => c.id === id) || {}).league || '';
  return new Function('DB', 'clubLeague',
    `${kod}\n return { sredniaZRaportow, ocenyZRaportow, porownanieNaPozycji, pozycjaDoPorownan };`)(DB, clubLeague);
}
// Raport z jedną wartością we wszystkich rubrykach — średnia raportu = ta wartość.
const rap = (playerId, v) => ({ playerId, phases: { a: v, b: v }, setPieces: { c: v } });

const KLUBY = [
  { id: 'K1', league: 'IV liga (lubuska)' }, { id: 'K2', league: 'IV liga (pomorska)' },
  { id: 'K3', league: 'CLJ U15 gr. A' }, { id: 'K4', league: 'CLJ U19' },
];

console.log('\n1. Jeden wzór średniej — pusta rubryka nie zaniża wyniku');
{
  const api = scena([], KLUBY, []);
  const s = api.sredniaZRaportow([{ phases: { a: 5, b: 0, c: '' }, setPieces: { d: 3 } }]);
  sprawdz('średnia liczona tylko z wypełnionych rubryk (5 i 3 → 4)', Math.abs(s.overall - 4) < 1e-9, JSON.stringify(s));
  sprawdz('raport bez żadnej oceny nie liczy się jako oceniony',
    api.sredniaZRaportow([{ phases: {}, setPieces: {} }]).overall === null);
}

console.log('\n2. Miejsce w poziomie i w grupie');
{
  const zaw = [
    { id: 'A', lastName: 'Alfa',  clubId: 'K1', position: 'Obrońca środkowy' },
    { id: 'B', lastName: 'Beta',  clubId: 'K1', position: 'Obrońca środkowy' },
    { id: 'C', lastName: 'Gamma', clubId: 'K2', position: 'Obrońca środkowy' },
    { id: 'D', lastName: 'Delta', clubId: 'K1', position: 'Obrońca środkowy' },
    { id: 'N', lastName: 'Napad', clubId: 'K1', position: 'Napastnik' },  // inna pozycja — poza grupą
  ];
  const api = scena(zaw, KLUBY, [rap('A', 4), rap('B', 5), rap('C', 5.5), rap('D', 3), rap('N', 6)]);
  const w = api.porownanieNaPozycji(zaw[0], api.ocenyZRaportow());
  console.log('   IV liga: ' + w.wPoziomie.miejsce + '. z ' + w.wPoziomie.ilu + '   |   lubuska: ' + w.wGrupie.miejsce + '. z ' + w.wGrupie.ilu);
  sprawdz('w całej IV lidze Alfa jest 3. z 4 (wyżej Gamma i Beta)', w.wPoziomie.miejsce === 3 && w.wPoziomie.ilu === 4, JSON.stringify(w.wPoziomie));
  sprawdz('w lubuskiej 2. z 3 (Gamma gra w pomorskiej)', w.wGrupie.miejsce === 2 && w.wGrupie.ilu === 3, JSON.stringify(w.wGrupie));
  sprawdz('napastnik z oceną 6 NIE psuje porównania obrońców', w.wPoziomie.lepsi.every(o => o.p.id !== 'N'));
  sprawdz('lista wyżej ułożona od najlepszego', w.wPoziomie.lepsi.map(o => o.p.id).join() === 'C,B', w.wPoziomie.lepsi.map(o => o.p.id).join());
}

console.log('\n3. REMIS — wspólne miejsce, a nie rozstrzyganie nazwiskiem');
{
  const zaw = [
    { id: 'A', lastName: 'Adamski', clubId: 'K1', position: 'Napastnik' },
    { id: 'Z', lastName: 'Zieliński', clubId: 'K1', position: 'Napastnik' },
    { id: 'M', lastName: 'Mazur', clubId: 'K1', position: 'Napastnik' },
  ];
  const api = scena(zaw, KLUBY, [rap('A', 4.5), rap('Z', 4.5), rap('M', 3)]);
  const o = api.ocenyZRaportow();
  const a = api.porownanieNaPozycji(zaw[0], o).wPoziomie.miejsce;
  const z = api.porownanieNaPozycji(zaw[1], o).wPoziomie.miejsce;
  console.log(`   Adamski: ${a}.   Zieliński: ${z}.`);
  sprawdz('dwaj z tą samą średnią dzielą 1. miejsce', a === 1 && z === 1, `${a}, ${z}`);
  sprawdz('trzeci jest 3., nie 2. — dwóch jest wyżej', api.porownanieNaPozycji(zaw[2], o).wPoziomie.miejsce === 3);
}

console.log('\n4. ZA MAŁA GRUPA nie udaje rankingu');
{
  const zaw = [
    { id: 'A', lastName: 'Alfa', clubId: 'K1', position: 'Bramkarz' },
    { id: 'B', lastName: 'Beta', clubId: 'K1', position: 'Bramkarz' },
  ];
  const api = scena(zaw, KLUBY, [rap('A', 5), rap('B', 3)]);
  const w = api.porownanieNaPozycji(zaw[0], api.ocenyZRaportow());
  sprawdz('„1. z 2" jest oznaczone jako niewystarczające', w.wPoziomie.wystarczy === false, JSON.stringify(w.wPoziomie));
}

console.log('\n5. Juniorzy: piętnastolatek nie mierzy się z dziewiętnastolatkami');
{
  const zaw = [
    { id: 'U15a', lastName: 'Młody', clubId: 'K3', position: 'Skrzydłowy' },
    { id: 'U15b', lastName: 'Młodszy', clubId: 'K3', position: 'Skrzydłowy' },
    { id: 'U15c', lastName: 'Najmłodszy', clubId: 'K3', position: 'Skrzydłowy' },
    { id: 'U19', lastName: 'Starszy', clubId: 'K4', position: 'Skrzydłowy' },
  ];
  const api = scena(zaw, KLUBY, [rap('U15a', 4), rap('U15b', 3), rap('U15c', 3.5), rap('U19', 6)]);
  const w = api.porownanieNaPozycji(zaw[0], api.ocenyZRaportow());
  sprawdz('brak porównania „w całych kategoriach juniorskich"', w.wPoziomie === null, JSON.stringify(w.wPoziomie));
  sprawdz('porównanie w obrębie CLJ U15 gr. A: 1. z 3', w.wGrupie && w.wGrupie.miejsce === 1 && w.wGrupie.ilu === 3, JSON.stringify(w.wGrupie));
}

console.log('\n6. Numer NMG ustala pozycję — lewy i prawy stoper konkurują ze sobą');
{
  const api = scena([], KLUBY, []);
  sprawdz('stoper lewy (4) → Obrońca środkowy', api.pozycjaDoPorownan({ pozycjaNmg: 4 }) === 'Obrońca środkowy');
  sprawdz('stoper prawy (5) → ta sama grupa', api.pozycjaDoPorownan({ pozycjaNmg: 5 }) === 'Obrońca środkowy');
  sprawdz('numer wygrywa z inną wpisaną nazwą', api.pozycjaDoPorownan({ pozycjaNmg: 9, position: 'Skrzydłowy' }) === 'Napastnik');
  sprawdz('bez numeru bierzemy nazwę', api.pozycjaDoPorownan({ position: 'Bramkarz' }) === 'Bramkarz');
}

console.log('\n7. Bez ocen nie ma porównania');
{
  const zaw = [{ id: 'A', lastName: 'Alfa', clubId: 'K1', position: 'Napastnik' }];
  const api = scena(zaw, KLUBY, []);
  sprawdz('zawodnik bez raportu dostaje null, nie „ostatnie miejsce"', api.porownanieNaPozycji(zaw[0], api.ocenyZRaportow()) === null);
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
