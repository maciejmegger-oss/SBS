// Sprawdza zapis składów meczowych i dopasowanie do kartoteki — na PRAWDZIWYM kodzie z src/.
//
// Uruchomienie:  node scripts/test-sklady-meczowe.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const dane = fs.readFileSync("src/data/sklady-meczowe.ts", "utf8");

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};
const wytnij = (nazwa, wzor, tekst = zrodlo) => {
  const m = tekst.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

// Dane składów bierzemy z pliku źródłowego, zdejmując z niego tylko składnię typów.
const SKLADY = (() => {
  const blok = wytnij('SKLADY_MECZOWE', /export const SKLADY_MECZOWE[\s\S]*?\n\];/, dane);
  const js = blok.replace(/^export const SKLADY_MECZOWE: SkladKlubu\[\] =/, 'return');
  return new Function(js)();
})();

// Definicje pól i pomocniki nazw klubów — PRAWDZIWE, żeby test pilnował tego samego, co aplikacja.
const kontekst = [
  wytnij('POSITION_NUMBERS', /const POSITION_NUMBERS = \[[\s\S]*?\n\];/),
  wytnij('FORMATIONS', /const FORMATIONS = \[[\s\S]*?\];/),
  wytnij('importNorm', /const importNorm = [\s\S]*?\.replace\(\/\[\^a-z0-9\]\/g,''\);/),
  wytnij('SZUM_NAZWY_KLUBU', /const SZUM_NAZWY_KLUBU = \/\^\([\s\S]*?\)\$\/;/),
  wytnij('NUMER_ZESPOLU', /const NUMER_ZESPOLU = \{[\s\S]*?\};/),
  wytnij('SKROTY_NAZWY', /const SKROTY_NAZWY = \{[\s\S]*?\};/),
  wytnij('rozwinSkroty', /const rozwinSkroty = .*;/),
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/),
  wytnij('tenSamCzlon', /const tenSamCzlon = \(x, y\)=>\{[\s\S]*?\n\};/),
  wytnij('szukajNorm', /const szukajNorm = \(s\)=>[\s\S]*?\.replace\(\/\\p\{M\}\/gu,''\);/),
  wytnij('skladDlaKlubu', /function skladDlaKlubu\(klub\)\{[\s\S]*?\n\}/),
  wytnij('nazwiskoNorm', /const nazwiskoNorm = .*;/),
  wytnij('zawodnikZeSkladu', /function zawodnikZeSkladu\(kadra, wpis\)\{[\s\S]*?\n\}/),
].join('\n');

const f = new Function('SKLADY_MECZOWE',
  `${kontekst}\n return { skladDlaKlubu, zawodnikZeSkladu, POSITION_NUMBERS, FORMATIONS };`);
const { skladDlaKlubu, zawodnikZeSkladu, POSITION_NUMBERS, FORMATIONS } = f(SKLADY);
const POLA = new Set(POSITION_NUMBERS.map(x => x.number));

console.log(`\n1. Zapis składów (${SKLADY.length} klubów)`);
sprawdz('szesnaście klubów — osiem meczów kolejki', SKLADY.length === 16, String(SKLADY.length));
SKLADY.forEach(s => {
  sprawdz(`${s.klub}: jedenastu w wyjściowym składzie`, s.pierwsi.length === 11, String(s.pierwsi.length));
  sprawdz(`${s.klub}: system „${s.system}" jest na liście układów`, FORMATIONS.includes(s.system));
  const zle = [...s.pierwsi, ...s.zmiennicy].filter(w => !POLA.has(w.nmg));
  sprawdz(`${s.klub}: wszystkie pola z NMG`, !zle.length, zle.map(w => w.nazwisko + ':' + w.nmg).join(','));
  const dokladnieJedenBramkarz = s.pierwsi.filter(w => w.nmg === 1).length === 1;
  sprawdz(`${s.klub}: dokładnie jeden bramkarz w wyjściowej jedenastce`, dokladnieJedenBramkarz);
  const nazwiska = [...s.pierwsi, ...s.zmiennicy].map(w => w.nazwisko.toLowerCase());
  sprawdz(`${s.klub}: nikt nie występuje dwa razy`, new Set(nazwiska).size === nazwiska.length,
    nazwiska.filter((n, i) => nazwiska.indexOf(n) !== i).join(','));
});

// Rozstawienie musi pokrywać boisko: bez tego cała drużyna wylądowałaby np. w obronie.
console.log('\n2. Rozstawienie pokrywa boisko');
SKLADY.forEach(s => {
  const pola = new Set(s.pierwsi.map(w => w.nmg));
  const obrona = [2, 3, 4, 5].filter(n => pola.has(n)).length;
  const atak = [7, 9, 10, 11].filter(n => pola.has(n)).length;
  sprawdz(`${s.klub}: jest bramkarz, obrona i atak`, pola.has(1) && obrona >= 3 && atak >= 1,
    [...pola].sort((a, b) => a - b).join(','));
});

console.log('\n3. Dopasowanie klubu z kartoteki do składu');
const trafia = (nazwa) => { const s = skladDlaKlubu({ name: nazwa }); return s ? s.klub : null; };
sprawdz('dokładna nazwa trafia', trafia('Ruch Chorzów') === 'Ruch Chorzów');
sprawdz('krótsza nazwa w bazie trafia w dłuższą ze składu',
  trafia('Termalica Nieciecza') === 'Bruk-Bet Termalica Nieciecza', String(trafia('Termalica Nieciecza')));
sprawdz('szum w nazwie nie przeszkadza (KS/SA)', trafia('KS Lechia Gdańsk S.A.') === 'Lechia Gdańsk',
  String(trafia('KS Lechia Gdańsk S.A.')));
// To jest sedno: dwie „Polonie" i dwie „Stale" w jednej lidze.
sprawdz('Polonia Bytom NIE trafia w Polonię Warszawa', trafia('Polonia Bytom') === 'Polonia Bytom');
sprawdz('Polonia Warszawa NIE trafia w Polonię Bytom', trafia('Polonia Warszawa') === 'Polonia Warszawa');
sprawdz('Stal Mielec NIE trafia w Stal Rzeszów', trafia('Stal Mielec') === 'Stal Mielec');
sprawdz('Stal Rzeszów NIE trafia w Stal Mielec', trafia('Stal Rzeszów') === 'Stal Rzeszów');
// Rezerwy grają w innych rozgrywkach i mają własną kadrę — nie wolno im podstawić składu pierwszej.
sprawdz('rezerwy NIE dostają składu pierwszego zespołu', trafia('Warta Poznań II') === null,
  String(trafia('Warta Poznań II')));
sprawdz('klub spoza kolejki nie trafia nigdzie', trafia('Górnik Zabrze') === null, String(trafia('Górnik Zabrze')));

console.log('\n4. Dopasowanie zawodnika w kadrze klubu');
const kadra = [
  { id: 'A', lastName: 'Leśniak', firstName: 'Norbert' },
  { id: 'B', lastName: 'Kowalski', firstName: 'Jakub' },
  { id: 'C', lastName: 'Kowalski', firstName: 'Piotr' },
  { id: 'D', lastName: 'del Moral', firstName: 'Adrian' },
  { id: 'E', lastName: 'Wrąbel', firstName: 'Jakub' },
];
const traf = (nazwisko, inicjal) => zawodnikZeSkladu(kadra, { nazwisko, inicjal });
sprawdz('nazwisko dwuczłonowe w protokole, jednoczłonowe w bazie',
  traf('Leśniak Paduch', 'N').p?.id === 'A', JSON.stringify(traf('Leśniak Paduch', 'N')));
sprawdz('polskie znaki nie przeszkadzają', traf('Wrabel', 'J').p?.id === 'E');
sprawdz('nazwisko ze spacją i małą literą', traf('del Moral', 'A').p?.id === 'D');
sprawdz('dwóch o tym samym nazwisku — rozstrzyga inicjał', traf('Kowalski', 'J').p?.id === 'B');
sprawdz('dwóch o tym samym nazwisku, inicjał nie pasuje — NIE zgadujemy',
  !traf('Kowalski', 'X').p, JSON.stringify(traf('Kowalski', 'X')));
sprawdz('kogo nie ma w kadrze, tego nie wymyślamy', !traf('Lewandowski', 'R').p);
sprawdz('powód niedopasowania jest nazwany',
  /brak w kadrze/.test(traf('Lewandowski', 'R').powod || ''), traf('Lewandowski', 'R').powod);

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
