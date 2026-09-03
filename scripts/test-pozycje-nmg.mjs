// Sprawdza numerację wg Narodowego Modelu Gry i to, że wskazany numer stawia zawodnika
// w JEDNYM polu mapy — na PRAWDZIWYCH tablicach i funkcji wyciętych z src/main.ts.
//
// Uruchomienie:  node scripts/test-pozycje-nmg.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

const POSITION_NUMBERS = eval(wytnij('POSITION_NUMBERS', /\[\s*\{number:1,[\s\S]*?\n\];/).replace(/;$/, ''));
const FORMATION_COORDS = eval('(' + wytnij('FORMATION_COORDS', /\{\s*'':\s*\{11:[\s\S]*?\n\};/).replace(/;$/, '') + ')');

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

// 1. Numeracja NMG.
console.log('1. Numery pozycji');
const wgNumeru = Object.fromEntries(POSITION_NUMBERS.map(p => [p.number, p.label]));
[[1, 'Bramkarz'], [2, 'Prawy obrońca'], [3, 'Lewy obrońca'], [4, 'Stoper (lewy)'], [5, 'Stoper (prawy)'],
 [6, 'Defensywny pomocnik'], [7, 'Prawe skrzydło'], [8, 'Środkowy pomocnik'], [9, 'Napastnik'],
 [10, 'Ofensywny pomocnik'], [11, 'Lewe skrzydło']].forEach(([n, etykieta]) => {
  sprawdz(`${n} = ${etykieta}`, wgNumeru[n] === etykieta, `jest: ${wgNumeru[n]}`);
});
sprawdz('jedenaście pozycji, numery bez powtórzeń', new Set(POSITION_NUMBERS.map(p => p.number)).size === 11);

// 2. Numer musi leżeć po właściwej stronie boiska w KAŻDYM systemie — inaczej prawy stoper
//    dostałby numer prawego, ale stanąłby po lewej.
console.log('\n2. Strona boiska zgodna z numerem');
Object.entries(FORMATION_COORDS).forEach(([system, wsp]) => {
  const nazwa = system || '(domyślny)';
  if (wsp[4] && wsp[5]) {
    sprawdz(`${nazwa}: 4 na lewo od 5`, wsp[4].x < wsp[5].x, `4: x=${wsp[4].x}, 5: x=${wsp[5].x}`);
  }
  if (wsp[3] && wsp[2]) {
    sprawdz(`${nazwa}: 3 (lewy obrońca) na lewo od 2`, wsp[3].x < wsp[2].x, `3: x=${wsp[3].x}, 2: x=${wsp[2].x}`);
  }
  if (wsp[11] && wsp[7]) {
    sprawdz(`${nazwa}: 11 (lewe skrzydło) na lewo od 7`, wsp[11].x < wsp[7].x, `11: x=${wsp[11].x}, 7: x=${wsp[7].x}`);
  }
});

// 3. Wybór kandydatów: wskazany numer bije pozycję ogólną.
console.log('\n3. Kto trafia do pola nr 4, a kto do nr 5');
const ciało = wytnij('buildAutoPositionCandidates', /function buildAutoPositionCandidates\(league, formation, number\)\{[\s\S]*?\n\}/);

const DB = { players: [
  { id: 'madej',  position: 'Obrońca środkowy', pozycjaNmg: 5, monitored: true, clubId: 'k' },
  { id: 'lewy',   position: 'Obrońca środkowy', pozycjaNmg: 4, monitored: true, clubId: 'k' },
  { id: 'ogolny', position: 'Obrońca środkowy', pozycjaNmg: null, monitored: true, clubId: 'k' },
  { id: 'pomoc',  position: 'Pomocnik środkowy', pozycjaNmg: null, monitored: true, clubId: 'k' },
] };
const wspolne = {
  POSITION_NUMBERS, DB,
  clubLeague: () => 'II liga',
  playerAvg: () => ({ overall: 7 }),
  LIGI_Z_MLODZIEZOWCAMI: new Set(),
  isYouthPlayer: () => false,
  minutyZawodnika: () => 0,
};
const f = new Function(...Object.keys(wspolne), `${ciało}; return buildAutoPositionCandidates;`)(...Object.values(wspolne));

const wPolu = (n) => f('II liga', '', n);
console.log(`   pole 4: ${wPolu(4).join(', ') || '(puste)'}`);
console.log(`   pole 5: ${wPolu(5).join(', ') || '(puste)'}`);
sprawdz('Madej (numer 5) tylko w polu 5', wPolu(5).includes('madej') && !wPolu(4).includes('madej'));
sprawdz('zawodnik z numerem 4 tylko w polu 4', wPolu(4).includes('lewy') && !wPolu(5).includes('lewy'));
sprawdz('bez numeru dalej wchodzi z pozycji ogólnej', wPolu(4).includes('ogolny'));
sprawdz('pomocnik nie wchodzi do pola stopera', !wPolu(4).includes('pomoc') && !wPolu(5).includes('pomoc'));
sprawdz('nikt nie stoi w dwóch polach naraz', wPolu(4).every(id => !wPolu(5).includes(id)));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
