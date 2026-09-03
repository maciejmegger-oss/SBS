// Sprawdza przenoszenie zawodnika między polami mapy — na PRAWDZIWEJ funkcji z src/main.ts.
//
// Uruchomienie:  node scripts/test-przeciaganie-pozycji.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const ciało = zrodlo.match(/async function przeniesNaInnaPozycje\([\s\S]*?\n\}/);
const kluczFn = zrodlo.match(/function positionMapKey\([^\n]*\n?/);
if (!ciało || !kluczFn) { console.error("Nie znalazłem funkcji w src/main.ts — test i kod się rozjechały."); process.exit(1); }

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

async function scena(mapa) {
  let positionMapAssignments = JSON.parse(JSON.stringify(mapa));
  let zapisow = 0;
  const f = new Function('positionMapAssignments', 'savePositionMapAssignments', 'licznik', `
    ${kluczFn[0]}
    ${ciało[0]}
    return przeniesNaInnaPozycje;
  `);
  const przenies = f(positionMapAssignments, async () => { zapisow++; }, null);
  return { przenies, mapa: positionMapAssignments, zapisy: () => zapisow };
}

// 1. Zwykłe przeciągnięcie z pola 4 na 5.
{
  const s = await scena({ 'II liga|||wszystkie|||4': ['madej', 'inny'], 'II liga|||wszystkie|||5': ['rogoz'] });
  const w = await s.przenies('II liga', '', 4, 5, 'madej');
  console.log('\n1. Przeciągnięcie z pola 4 na 5');
  console.log('   pole 4: ' + s.mapa['II liga|||wszystkie|||4'].join(', '));
  console.log('   pole 5: ' + s.mapa['II liga|||wszystkie|||5'].join(', '));
  sprawdz('przeniesienie się udało', w.ok);
  sprawdz('zniknął z pola 4', !s.mapa['II liga|||wszystkie|||4'].includes('madej'));
  sprawdz('jest w polu 5', s.mapa['II liga|||wszystkie|||5'].includes('madej'));
  sprawdz('pozostali w polu 4 nietknięci', s.mapa['II liga|||wszystkie|||4'].join() === 'inny');
  sprawdz('nie wpisano go na listę wykluczonych (przeciąganie musi być odwracalne)',
    !s.mapa['II liga|||wszystkie|||4|||wykluczeni']);
}

// 2. Pole docelowe pełne — sześciu to komplet.
{
  const pelne = ['a', 'b', 'c', 'd', 'e', 'f'];
  const s = await scena({ 'II liga|||wszystkie|||4': ['madej'], 'II liga|||wszystkie|||5': pelne });
  const w = await s.przenies('II liga', '', 4, 5, 'madej');
  console.log('\n2. Pole docelowe pełne');
  sprawdz('przeniesienie odrzucone', !w.ok && w.powod === 'komplet', JSON.stringify(w));
  sprawdz('został w polu 4', s.mapa['II liga|||wszystkie|||4'].includes('madej'));
  sprawdz('pole 5 bez zmian', s.mapa['II liga|||wszystkie|||5'].join() === pelne.join());
}

// 3. Upuszczenie na to samo pole i na pole, gdzie już stoi.
{
  const s = await scena({ 'II liga|||wszystkie|||4': ['madej'], 'II liga|||wszystkie|||5': ['madej'] });
  console.log('\n3. Ruchy bez sensu');
  sprawdz('to samo pole — nic się nie dzieje', !(await s.przenies('II liga', '', 4, 4, 'madej')).ok);
  sprawdz('już tam stoi — nic się nie dzieje', !(await s.przenies('II liga', '', 4, 5, 'madej')).ok);
  sprawdz('bez zawodnika — nic się nie dzieje', !(await s.przenies('II liga', '', 4, 5, '')).ok);
}

// 4. Konkretny system gry ma własne klucze — przeciąganie w 1-4-3-3 nie rusza „wszystkich systemów".
{
  const s = await scena({
    'II liga|||1-4-3-3|||4': ['madej'], 'II liga|||1-4-3-3|||5': [],
    'II liga|||wszystkie|||4': ['madej'],
  });
  await s.przenies('II liga', '1-4-3-3', 4, 5, 'madej');
  console.log('\n4. Osobne mapy dla systemów');
  sprawdz('przeniesiony w 1-4-3-3', s.mapa['II liga|||1-4-3-3|||5'].includes('madej'));
  sprawdz('mapa „wszystkie systemy" nietknięta', s.mapa['II liga|||wszystkie|||4'].includes('madej'));
}

// 5. Puste pole docelowe — klucz jeszcze nie istnieje.
{
  const s = await scena({ 'II liga|||wszystkie|||4': ['madej'] });
  const w = await s.przenies('II liga', '', 4, 9, 'madej');
  console.log('\n5. Pole, które nigdy nie było wypełnione');
  sprawdz('przeniesienie się udało', w.ok);
  sprawdz('pole 9 zawiera zawodnika', (s.mapa['II liga|||wszystkie|||9'] || []).includes('madej'));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
