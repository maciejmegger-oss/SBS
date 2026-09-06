// Sprawdza czytanie rocznika i pozycji z profilu ŁNP — na PRAWDZIWYCH funkcjach z zakładki
// (public/zakladka-lnp-v2.js) i z aplikacji (src/main.ts).
//
// Uruchomienie:  node scripts/test-roczniki-pozycje.mjs
import fs from "node:fs";

const wytnij = (plik, nazwa, wzor) => {
  const m = fs.readFileSync(plik, "utf8").match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w ${plik} — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

const zakladka = "public/zakladka-lnp-v2.js";
const pozycjaZTekstu = new Function(wytnij(zakladka, 'pozycjaZTekstu', /function pozycjaZTekstu\(t\)\{[\s\S]*?\n\}/) + '; return pozycjaZTekstu;')();
const rocznikZTekstu = new Function(wytnij(zakladka, 'rocznikZTekstu', /function rocznikZTekstu\(t\)\{[\s\S]*?\n\}/) + '; return rocznikZTekstu;')();

const zrodloTs = wytnij("src/main.ts", 'pozycjaZLnp', /const POZYCJE_NIEROZPOZNANE[\s\S]*?\nfunction pozycjaZLnp\(surowa\)\{[\s\S]*?\n\}/);
const pozycjaZLnp = new Function(
  zrodloTs.replace('const POZYCJE_NIEROZPOZNANE = new Set<string>();', 'const POZYCJE_NIEROZPOZNANE = new Set();')
    .replace(/String\(surowa\)/g, 'String(surowa)')
  + '; return { pozycjaZLnp, POZYCJE_NIEROZPOZNANE };')();

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

// 1. Odczyt z tekstu profilu — kilka układów, bo nie wiemy, w którym ŁNP to poda.
console.log('1. Czytanie profilu zawodnika');
[
  ['Jan Kowalski\nPozycja: Pomocnik\nData urodzenia: 14.03.2007', '2007', 'Pomocnik'],
  ['Jan Kowalski\nPozycja Bramkarz\nUrodzony 2008-11-02', '2008', 'Bramkarz'],
  ['POZYCJA: Obrońca środkowy\nData urodzenia 5 maja 2006', '2006', 'Obrońca środkowy'],
  ['Adam Nowak\nNapastnik\nData urodzenia: 01.01.2010', '2010', 'Napastnik'],
].forEach(([txt, rok, poz], i)=>{
  sprawdz(`układ ${i+1}: rocznik ${rok}`, rocznikZTekstu(txt) === rok, `odczytano: ${rocznikZTekstu(txt)}`);
  sprawdz(`układ ${i+1}: pozycja „${poz}"`, pozycjaZTekstu(txt).indexOf(poz) === 0, `odczytano: ${pozycjaZTekstu(txt)}`);
});
sprawdz('pusty tekst nie daje nic', rocznikZTekstu('') === '' && pozycjaZTekstu('') === '');

// 2. Tłumaczenie na słownik SBS.
console.log('\n2. Nazwy z ŁNP na słownik SBS');
[
  ['Bramkarz', 'Bramkarz'],
  ['bramkarz', 'Bramkarz'],
  ['Obrońca środkowy', 'Obrońca środkowy'],
  ['Obronca srodkowy', 'Obrońca środkowy'],
  ['Stoper', 'Obrońca środkowy'],
  ['Obrońca prawy', 'Obrońca boczny'],
  ['Obrońca boczny', 'Obrońca boczny'],
  ['Pomocnik', 'Pomocnik środkowy'],
  ['Pomocnik defensywny', 'Pomocnik defensywny'],
  ['Pomocnik ofensywny', 'Pomocnik ofensywny'],
  ['Skrzydłowy', 'Skrzydłowy'],
  ['Napastnik', 'Napastnik'],
].forEach(([z, na])=>{
  sprawdz(`„${z}" → „${na}"`, pozycjaZLnp.pozycjaZLnp(z) === na, `wyszło: ${pozycjaZLnp.pozycjaZLnp(z)}`);
});

// 3. Czego NIE wolno zgadywać.
console.log('\n3. Niejednoznaczne zostają puste');
sprawdz('samo „Obrońca" nie daje pozycji', pozycjaZLnp.pozycjaZLnp('Obrońca') === '',
  `wyszło: ${pozycjaZLnp.pozycjaZLnp('Obrońca')}`);
sprawdz('trafia na listę do dopisania', pozycjaZLnp.POZYCJE_NIEROZPOZNANE.has('Obrońca'));
sprawdz('pusta wartość niczego nie zgłasza', pozycjaZLnp.pozycjaZLnp('') === '');
sprawdz('nieznane słowo nie daje pozycji', pozycjaZLnp.pozycjaZLnp('Libero') === '');

// 4. Rozbiór bloku ### ROCZNIKI — stary i nowy układ obok siebie.
console.log('\n4. Blok ### ROCZNIKI');
const rozbierz = (linie)=>{
  const wynik = {};
  linie.forEach(l=>{
    const [kto, rok, pozycja] = l.split('|');
    if(!kto) return;
    const wpis = {};
    if(/^(19|20)\d{2}$/.test(String(rok||'').trim())) wpis.rok = rok.trim();
    const poz = pozycjaZLnp.pozycjaZLnp(pozycja);
    if(poz) wpis.pozycja = poz;
    if(wpis.rok || wpis.pozycja) wynik[kto] = wpis;
  });
  return wynik;
};
const r = rozbierz(['jan kowalski|2007|Bramkarz', 'adam nowak|2008', 'piotr zyla||Napastnik', 'ktos||Obrońca']);
console.log('   ' + JSON.stringify(r));
sprawdz('nowy układ: rocznik i pozycja', r['jan kowalski'].rok === '2007' && r['jan kowalski'].pozycja === 'Bramkarz');
sprawdz('stary układ (sam rocznik) dalej działa', r['adam nowak'].rok === '2008' && !r['adam nowak'].pozycja);
sprawdz('sama pozycja bez rocznika też wchodzi', !r['piotr zyla'].rok && r['piotr zyla'].pozycja === 'Napastnik');
sprawdz('niejednoznaczna pozycja bez rocznika — wpisu nie ma', !r['ktos']);

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
