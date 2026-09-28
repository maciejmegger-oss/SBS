// POMIAR CZASU OTWIERANIA ZAKŁADEK — na PRAWDZIWYCH funkcjach z src/main.ts.
//
// Zgłoszenie (28.09.2026): „po kliknięciu w zakładkę jest długi czas ładowania".
// Najdroższa jest lista klubów: dla KAŻDEGO z 600 klubów liczy się dorobek (meczeKlubu), a ten
// przeglądał wszystkich 16 650 zawodników i rozbierał nazwy rywali na człony — przy każdym wierszu
// od nowa. Test mierzy to na danych wielkości prawdziwej bazy i pilnuje, żeby nie wróciło.
//
// Uruchomienie:  node scripts/test-szybkosc-zakladek.mjs
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
  wytnij('importNorm', /const importNorm = \(s\)=>[\s\S]*?;\r?\n/),
  wytnij('SZUM_NAZWY_KLUBU', /const SZUM_NAZWY_KLUBU = [^\n]*\n/),
  wytnij('NUMER_ZESPOLU', /const NUMER_ZESPOLU = \{[^\n]*\};/),
  wytnij('SKROTY_NAZWY', /const SKROTY_NAZWY = \{[\s\S]*?\n\};/),
  wytnij('rozwinSkroty', /const rozwinSkroty = [^\n]*\n/),
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/),
  wytnij('odciskKlubu', /const odciskKlubu = \(nazwa\)=>\{[\s\S]*?\};/),
  wytnij('zawodnicyKlubu', /function zawodnicyKlubu\(clubId\)\{[\s\S]*?\n\}/),
  wytnij('odswiezIndeksy', /function odswiezIndeksy\(\)\{[\s\S]*?\n\}/),
  wytnij('meczeKlubu', /function meczeKlubu\(clubId\)\{[\s\S]*?\n\}/),
  wytnij('policzMeczeKlubu', /function policzMeczeKlubu\(clubId, zawodnicy\)\{[\s\S]*?\n\}/),
].join('\n');

// Baza wielkości prawdziwej: 600 klubów, 16 650 zawodników, po kilka meczów w przebiegu.
const KLUBY = Array.from({ length: 600 }, (_, i) => ({
  id: 'C' + i, name: `Klub numer ${i} Miasto${i % 90}`, league: 'IV liga (śląska)', season: '2026/2027',
}));
const RYWALE = ['Zawisza Bydgoszcz', 'KS Chemik Police', 'Wisła Dobrzyń n/Wisłą', 'GKS Piast Gliwice II', 'Unia Turza Śląska'];
const ZAWODNICY = Array.from({ length: 16650 }, (_, i) => ({
  id: 'Z' + i, clubId: 'C' + (i % 600), matches: i % 12,
  przebieg: Array.from({ length: i % 7 }, (_, j) => ({
    rywal: RYWALE[(i + j) % RYWALE.length], dom: j % 2 === 0, wynik: `${j % 4}:${(j + 1) % 3}`,
  })),
}));

const api = new Function('DB', 'tabeleLig', 'osiagalneKolejki', 'wierszZTabeli', `${kod}
  return { meczeKlubu, odswiezIndeksy, zawodnicyKlubu };`)(
  { clubs: KLUBY, players: ZAWODNICY, klubyWgId: new Map(KLUBY.map(c=>[c.id, c])) }, {}, () => null, () => null);

console.log('\n1. Lista klubów — 600 wierszy na bazie 16 650 zawodników');
api.odswiezIndeksy();
const start = Date.now();
let suma = 0;
KLUBY.forEach(c => { suma += api.meczeKlubu(c.id).rozegrane; });
const czas = Date.now() - start;
console.log(`      policzone w ${czas} ms (suma kolejek: ${suma})`);
sprawdz(`cały widok Kluby liczy się poniżej sekundy (${czas} ms)`, czas < 1000, `${czas} ms`);
sprawdz('drugie przeliczenie tego samego widoku jest natychmiastowe (pamięć na czas rysowania)', (() => {
  const t = Date.now();
  KLUBY.forEach(c => api.meczeKlubu(c.id));
  const drugi = Date.now() - t;
  console.log(`      drugi przebieg: ${drugi} ms`);
  return drugi <= Math.max(5, czas / 4);
})());

console.log('\n2. Indeks zawodników wg klubu');
sprawdz('zawodnicy klubu wyjmowani z indeksu, nie przeszukiwaniem całej bazy',
  api.zawodnicyKlubu('C7').length === ZAWODNICY.filter(z => z.clubId === 'C7').length);
sprawdz('klub bez zawodników oddaje pustą listę', api.zawodnicyKlubu('C-nie-ma').length === 0);
sprawdz('indeks budowany raz na przerysowanie (render go odświeża)',
  /odswiezIndeksy\(\);/.test(zrodlo) && /function render\(\)/.test(zrodlo));

console.log('\n3. Klub po identyfikatorze — z indeksu');
{
  const kodKlubu = (zrodlo.match(/function clubName\(id\)\{[^\n]*\n/) || [''])[0];
  const zbudujNazwe = (zIndeksem) => new Function('DB', `${kodKlubu}\n return clubName;`)(
    zIndeksem ? { clubs: KLUBY, klubyWgId: new Map(KLUBY.map(c => [c.id, c])) } : { clubs: KLUBY });

  const zmierz = (clubName) => { const t = Date.now(); let n = 0;
    for (let i = 0; i < 16650; i++) n += clubName('C' + (i % 600)).length; return Date.now() - t; };
  const bezIndeksu = zmierz(zbudujNazwe(false));
  const zIndeksem = zmierz(zbudujNazwe(true));
  console.log(`      16 650 odczytów nazwy klubu: bez indeksu ${bezIndeksu} ms, z indeksem ${zIndeksem} ms`);
  sprawdz(`nazwa klubu dla całej kartoteki poniżej 50 ms (${zIndeksem} ms)`, zIndeksem < 50, `${zIndeksem} ms`);
  sprawdz('indeks jest wyraźnie szybszy od przeszukiwania', zIndeksem * 5 < bezIndeksu || bezIndeksu < 20,
    `${bezIndeksu} ms vs ${zIndeksem} ms`);
  sprawdz('bez indeksu wynik jest ten sam (testy i pierwsze wywołanie)',
    zbudujNazwe(false)('C7') === zbudujNazwe(true)('C7'));
  sprawdz('nieznany klub nie wywraca odczytu', zbudujNazwe(true)('C-nie-ma') === '—');
  sprawdz('indeks budowany raz na przerysowanie', /DB\.klubyWgId = new Map\(\(DB\.clubs \|\| \[\]\)\.map/.test(zrodlo));
  sprawdz('nazwa, region, liga i herb czytają z indeksu, gdy jest',
    ['clubName','clubRegion','clubLeague'].every(f => new RegExp(`function ${f}\\(id\\)\\{ const c = \\(DB\\.klubyWgId`).test(zrodlo))
    && /function clubCrest\(id\)\{[^\n]*DB\.klubyWgId/.test(zrodlo));
}

console.log('\n4. Gorące miejsca nie wracają do przeszukiwania całej bazy');
{
  // Każde DB.players.filter(p=>p.clubId===…) w rysowaniu listy to przejście po 16 650 kartotekach.
  const wKodzie = (zrodlo.match(/DB\.players\.filter\(\s*(?:p|x)\s*=>\s*(?:p|x)\.clubId\s*===?\s*/g) || []).length;
  console.log(`      pozostałe przeszukiwania po clubId: ${wKodzie}`);
  sprawdz('widoki list nie przeszukują bazy raz na wiersz (zostały tylko pojedyncze miejsca)',
    wKodzie <= 6, `${wKodzie} miejsc`);
  sprawdz('rozbiór nazwy klubu pamięta wynik (te same nazwy wracają tysiące razy)',
    /if\(!rozbijNazweKlubu\.pamiec\) rozbijNazweKlubu\.pamiec = new Map\(\);/.test(zrodlo));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
