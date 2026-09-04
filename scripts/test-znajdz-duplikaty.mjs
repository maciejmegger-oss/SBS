// Sprawdza wyszukiwanie duplikatów — na PRAWDZIWEJ funkcji z src/main.ts.
//
// Uruchomienie:  node scripts/test-znajdz-duplikaty.mjs
import fs from "node:fs";

const ciało = fs.readFileSync("src/main.ts", "utf8").match(/function znajdzDuplikaty\(\)\{[\s\S]*?\n\}/);
if (!ciało) { console.error("Nie znalazłem znajdzDuplikaty w src/main.ts."); process.exit(1); }

const importNorm = (s) => String(s || '').toLowerCase()
  .replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

function szukaj(players, reports = [], observations = []) {
  const DB = { players, reports, observations };
  return new Function('DB', 'importNorm', `${ciało[0]}; return znajdzDuplikaty();`)(DB, importNorm);
}

// 1. Przypadek Marcinho: trzy karty, ten sam klub, to samo nazwisko.
{
  const gracze = [
    { id: 'A', firstName: 'Marcinho', lastName: 'Marcinho', clubId: 'K1', birthYear: '1996',
      position: 'Pomocnik ofensywny', height: 176, foot: 'Prawa', nationality: 'Brazylia',
      przebieg: [{}, {}, {}, {}, {}, {}, {}] },
    { id: 'B', firstName: 'Marcinho', lastName: 'Marcinho', clubId: 'K1', birthYear: '1997', przebieg: [] },
    { id: 'C', firstName: 'Manoel Oliveira da Silva', lastName: 'Marcinho', clubId: 'K1', przebieg: [] },
  ];
  const pary = szukaj(gracze, [{ id: 'R1', playerId: 'A' }]);
  console.log('\n1. Trzy kartoteki tego samego zawodnika');
  pary.forEach(p => console.log(`   zostaje ${p.glowna.id} (${p.glowna.firstName}), wchłonięty ${p.duplikat.id}`));
  sprawdz('znaleziono dwie pary', pary.length === 2, String(pary.length));
  sprawdz('w obu zostaje karta z raportem i danymi (A)', pary.every(p => p.glowna.id === 'A'));
  sprawdz('do wchłonięcia B i C', pary.map(p => p.duplikat.id).sort().join() === 'B,C');
}

// 2. Ten sam zawodnik w RÓŻNYCH klubach to nie duplikat — to transfer.
{
  const pary = szukaj([
    { id: 'A', firstName: 'Jan', lastName: 'Kowalski', clubId: 'K1' },
    { id: 'B', firstName: 'Jan', lastName: 'Kowalski', clubId: 'K2' },
  ]);
  console.log('\n2. To samo nazwisko, inny klub');
  sprawdz('nie zgłaszamy jako duplikat', pary.length === 0, String(pary.length));
}

// 3. Różne nazwiska w jednym klubie zostają w spokoju.
{
  const pary = szukaj([
    { id: 'A', firstName: 'Jan', lastName: 'Kowalski', clubId: 'K1' },
    { id: 'B', firstName: 'Jan', lastName: 'Nowak', clubId: 'K1' },
  ]);
  console.log('\n3. Różne nazwiska, ten sam klub');
  sprawdz('nie zgłaszamy', pary.length === 0);
}

// 4. Polskie znaki nie mogą rozdzielać tej samej osoby.
{
  const pary = szukaj([
    { id: 'A', firstName: 'Michał', lastName: 'Głogowski', clubId: 'K1' },
    { id: 'B', firstName: 'Michal', lastName: 'Glogowski', clubId: 'K1' },
  ]);
  console.log('\n4. Zapis z polskimi znakami i bez');
  sprawdz('rozpoznane jako jedna osoba', pary.length === 1, String(pary.length));
}

// 5. Zawodnik bez klubu albo bez nazwiska — pomijamy, bo dopasowanie byłoby na oślep.
{
  const pary = szukaj([
    { id: 'A', firstName: 'Jan', lastName: '', clubId: 'K1' },
    { id: 'B', firstName: 'Jan', lastName: '', clubId: 'K1' },
    { id: 'C', firstName: 'Piotr', lastName: 'Zych', clubId: '' },
    { id: 'D', firstName: 'Piotr', lastName: 'Zych', clubId: '' },
  ]);
  console.log('\n5. Braki w danych');
  sprawdz('bez nazwiska i bez klubu — nie zgadujemy', pary.length === 0, String(pary.length));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
