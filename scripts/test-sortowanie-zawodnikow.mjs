// Sprawdza sortowanie listy zawodników — na PRAWDZIWYCH funkcjach z src/main.ts.
//
// Uruchomienie:  node scripts/test-sortowanie-zawodnikow.mjs
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
  wytnij('playerSort', /let playerSort = \{[\s\S]*?\};/),
  wytnij('PORZADEK_STATUSU', /const PORZADEK_STATUSU = \[[\s\S]*?\];/),
  wytnij('kluczSortowania', /function kluczSortowania\(p, kolumna\)\{[\s\S]*?\n\}/),
  wytnij('porownajZawodnikow', /function porownajZawodnikow\(x, y\)\{[\s\S]*?\n\}/),
  wytnij('zetonSort', /function zetonSort\(kolumna, etykieta\)\{[\s\S]*?\n\}/),
].join('\n');

const KLUBY = { K1: 'Arka Gdynia', K2: 'Śląsk Wrocław', K3: 'Bruk-Bet Termalica' };
const Z = [
  { id: 'a', lastName: 'Nowak',  firstName: 'Adam',  birthYear: '2006', clubId: 'K2', status: 'Do Obserwacji', matches: 12, minutes: 900, goals: 3,    pozycjaNmg: 9,  position: 'Napastnik' },
  { id: 'b', lastName: 'Bąk',    firstName: 'Piotr', birthYear: '2009', clubId: 'K1', status: 'Do transferu',  matches: 4,  minutes: 120, goals: 0,    pozycjaNmg: 1,  position: 'Bramkarz' },
  { id: 'c', lastName: 'Adamek', firstName: 'Jan',   birthYear: '2007', clubId: 'K3', status: 'Na Testy',      matches: null, minutes: null, goals: null, pozycjaNmg: 6, position: 'Pomocnik defensywny' },
  { id: 'd', lastName: 'Żak',    firstName: 'Ewa',   birthYear: null,   clubId: 'K1', status: '',              matches: 7,  minutes: 640, goals: 1,    pozycjaNmg: null, position: 'Skrzydłowy' },
];
const OCENY = { a: { overall: 4.8 }, b: { overall: 3.2 }, c: null, d: { overall: 5.5 } };

const f = new Function('clubName', 'rocznikZawodnika', 'playerAvg', 'esc',
  `${kod}\n return { porownajZawodnikow, playerSort_get: ()=>playerSort, playerSort_set: (v)=>{playerSort=v;}, zetonSort };`);
const api = f(
  (id) => KLUBY[id] || '',
  (p) => p.birthYear,
  (id) => OCENY[id],
  (s) => String(s),
);

const posortuj = (kolumna, kierunek) => {
  api.playerSort_set({ kolumna, kierunek });
  return Z.slice().sort(api.porownajZawodnikow).map(p => p.lastName);
};

console.log('\n1. Nazwisko — po polsku (Ż na końcu, nie po Z z alfabetu maszynowego)');
const naz = posortuj('nazwisko', 'asc');
console.log('   ' + naz.join(', '));
sprawdz('rosnąco: Adamek, Bąk, Nowak, Żak', naz.join(',') === 'Adamek,Bąk,Nowak,Żak', naz.join(','));
sprawdz('malejąco odwraca', posortuj('nazwisko', 'desc').join(',') === 'Żak,Nowak,Bąk,Adamek');

console.log('\n2. BRAK DANYCH ZAWSZE NA KOŃCU — w obu kierunkach');
const goleR = posortuj('gole', 'asc'), goleM = posortuj('gole', 'desc');
console.log('   rosnąco: ' + goleR.join(', ') + '   |   malejąco: ' + goleM.join(', '));
sprawdz('rosnąco: Adamek (bez danych) NIE na czele', goleR[0] !== 'Adamek', goleR.join(','));
sprawdz('rosnąco: Adamek na końcu', goleR[goleR.length - 1] === 'Adamek', goleR.join(','));
sprawdz('malejąco: Adamek też na końcu', goleM[goleM.length - 1] === 'Adamek', goleM.join(','));
sprawdz('malejąco czoło to najwięcej goli (Nowak, 3)', goleM[0] === 'Nowak', goleM.join(','));
const rocz = posortuj('rocznik', 'asc');
sprawdz('rocznik: zawodnik bez rocznika na końcu', rocz[rocz.length - 1] === 'Żak', rocz.join(','));
sprawdz('rocznik rosnąco = od najstarszego', rocz[0] === 'Nowak', rocz.join(','));

console.log('\n3. Minuty i mecze — liczbowo, nie tekstowo');
const min = posortuj('minuty', 'desc');
console.log('   ' + min.join(', '));
sprawdz('900 przed 640 przed 120', min.slice(0, 3).join(',') === 'Nowak,Żak,Bąk', min.join(','));

console.log('\n4. Klub — po nazwie klubu, nie po identyfikatorze');
const klub = posortuj('klub', 'asc');
console.log('   ' + klub.join(', '));
sprawdz('Arka przed Bruk-Bet przed Śląskiem',
  klub.join(',') === 'Bąk,Żak,Adamek,Nowak' || klub.join(',') === 'Żak,Bąk,Adamek,Nowak', klub.join(','));
sprawdz('remis w obrębie klubu rozstrzyga nazwisko (Bąk przed Żakiem)',
  klub.indexOf('Bąk') < klub.indexOf('Żak'), klub.join(','));

console.log('\n5. Pozycja — wg numeru NMG, brak numeru na końcu');
const poz = posortuj('pozycja', 'asc');
console.log('   ' + poz.join(', '));
sprawdz('bramkarz (1) pierwszy', poz[0] === 'Bąk', poz.join(','));
sprawdz('bez numeru NMG na końcu', poz[poz.length - 1] === 'Żak', poz.join(','));

console.log('\n6. Status — wg wagi decyzji, nie alfabetycznie');
const st = posortuj('status', 'asc');
console.log('   ' + st.join(', '));
sprawdz('„Do transferu" przed „Do Obserwacji"', st.indexOf('Bąk') < st.indexOf('Nowak'), st.join(','));
sprawdz('bez statusu na końcu', st[st.length - 1] === 'Żak', st.join(','));

console.log('\n7. Ocena — liczy się średnia z raportów, brak ocen na końcu');
const oc = posortuj('ocena', 'desc');
console.log('   ' + oc.join(', '));
sprawdz('najwyższa ocena na czele (Żak 5,5)', oc[0] === 'Żak', oc.join(','));
sprawdz('bez ocen na końcu', oc[oc.length - 1] === 'Adamek', oc.join(','));

console.log('\n8. Strzałka w nagłówku');
api.playerSort_set({ kolumna: 'gole', kierunek: 'desc' });
sprawdz('kolumna czynna ma strzałkę kierunku', /↓/.test(api.zetonSort('gole', 'Gole')));
sprawdz('kolumna czynna jest oznaczona klasą', /th-sort-czynna/.test(api.zetonSort('gole', 'Gole')));
sprawdz('pozostałe kolumny mają „⇅", nie kierunek', /⇅/.test(api.zetonSort('minuty', 'Minuty')));
sprawdz('pozostałe NIE są oznaczone jako czynne', !/th-sort-czynna/.test(api.zetonSort('minuty', 'Minuty')));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
