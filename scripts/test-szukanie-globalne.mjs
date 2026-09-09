// Sprawdza szukanie przez całą bazę — na PRAWDZIWYCH funkcjach z src/main.ts.
//
// Uruchomienie:  node scripts/test-szukanie-globalne.mjs
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
  wytnij('szukajNorm', /const szukajNorm = \(s\)=>[\s\S]*?\.replace\(\/\\p\{M\}\/gu,''\);/),
  wytnij('indeksSzukania', /let indeksSzukania = null;/),
  wytnij('zbudujIndeksSzukania', /function zbudujIndeksSzukania\(\)\{[\s\S]*?\n\}/),
  wytnij('wynikiSzukania', /function wynikiSzukania\(fraza\)\{[\s\S]*?\n\}/),
].join('\n');

const DB = {
  players: [
    { id: 'P1', lastName: 'Kowalski', firstName: 'Jakub', birthYear: '2007', position: 'Napastnik', clubId: 'K1' },
    { id: 'P2', lastName: 'Leśniak Paduch', firstName: 'Norbert', birthYear: '2006', position: 'Obrońca środkowy', clubId: 'K2' },
    { id: 'P3', lastName: 'Wrąbel', firstName: 'Jakub', birthYear: '2005', position: 'Bramkarz', clubId: 'K1' },
    { id: 'P4', lastName: 'Nowak', firstName: 'Adam', birthYear: '2008', position: 'Skrzydłowy', clubId: 'K3' },
  ],
  clubs: [
    { id: 'K1', name: 'Ruch Chorzów', league: 'I liga', region: 'Śląski ZPN', city: 'Chorzów' },
    { id: 'K2', name: 'Korona Kożuchów', league: 'IV liga (lubuska)', region: 'Lubuski ZPN', city: 'Kożuchów' },
    { id: 'K3', name: 'Kowary KS', league: 'Klasa okręgowa', region: 'Dolnośląski ZPN', city: 'Kowary' },
  ],
  agencies: [{ id: 'A1', name: 'Kowalczyk Sport Management', city: 'Warszawa', country: 'Polska' }],
};
const clubName = (id) => (DB.clubs.find(c => c.id === id) || {}).name || '';

const f = new Function('DB', 'clubName', `${kod}\n return { wynikiSzukania, zbudujIndeksSzukania };`);
const { wynikiSzukania } = f(DB, clubName);

const etykiety = (q) => wynikiSzukania(q).map(w => w.rodzaj + ':' + w.etykieta);

console.log('\n1. Próg dwóch znaków');
sprawdz('jeden znak nic nie zwraca', wynikiSzukania('k').length === 0);
sprawdz('pusta fraza nic nie zwraca', wynikiSzukania('').length === 0);
sprawdz('dwa znaki już szukają', wynikiSzukania('ko').length > 0);

console.log('\n2. Kolejność — trafienie od początku nazwiska przed trafieniem w środku');
const kow = etykiety('kow');
console.log('   ' + kow.join(' | '));
sprawdz('Kowalski przed Nowakiem', kow.indexOf('zawodnik:Kowalski Jakub') < kow.indexOf('zawodnik:Nowak Adam'),
  kow.join(','));
sprawdz('są wszystkie trzy rodzaje wyników',
  kow.some(x => x.startsWith('zawodnik:')) && kow.some(x => x.startsWith('klub:')) && kow.some(x => x.startsWith('menedzer:')),
  kow.join(','));
sprawdz('zawodnicy idą przed klubami',
  kow.findIndex(x => x.startsWith('klub:')) > kow.findLastIndex(x => x.startsWith('zawodnik:')), kow.join(','));

console.log('\n3. Polskie znaki i nazwiska dwuczłonowe');
sprawdz('„lesniak" znajduje „Leśniak Paduch"', etykiety('lesniak').includes('zawodnik:Leśniak Paduch Norbert'));
sprawdz('„wrabel" znajduje „Wrąbel"', etykiety('wrabel').includes('zawodnik:Wrąbel Jakub'));
sprawdz('drugi człon nazwiska też trafia', etykiety('paduch').includes('zawodnik:Leśniak Paduch Norbert'));

console.log('\n4. Szukanie po klubie zawodnika');
const ruch = etykiety('chorzow');
console.log('   ' + ruch.join(' | '));
sprawdz('nazwa klubu znajduje jego zawodników', ruch.includes('zawodnik:Kowalski Jakub') && ruch.includes('zawodnik:Wrąbel Jakub'));
sprawdz('i sam klub', ruch.includes('klub:Ruch Chorzów'));

console.log('\n5. Opis pod nazwiskiem niesie to, co rozstrzyga o tożsamości');
const w = wynikiSzukania('kowalski')[0];
console.log('   ' + w.etykieta + ' — ' + w.opis);
sprawdz('rocznik, pozycja i klub w opisie',
  /2007/.test(w.opis) && /Napastnik/.test(w.opis) && /Ruch Chorzów/.test(w.opis), w.opis);

console.log('\n6. Nic nie znaleziono — pusta lista, nie wyjątek');
sprawdz('fraza bez trafień zwraca pustą listę', wynikiSzukania('zzzzz').length === 0);

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
