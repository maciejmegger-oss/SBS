// Sprawdza ręczne wpisywanie rocznika talentu — na PRAWDZIWYCH funkcjach z src/main.ts.
//
// Uruchomienie:  node scripts/test-rocznik-talentu.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const style = fs.readFileSync("src/style.css", "utf8");
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
  wytnij('NAJSTARSZY_ROCZNIK_TALENTU', /const NAJSTARSZY_ROCZNIK_TALENTU = \d+;/),
  wytnij('rocznikTalentuZPola', /function rocznikTalentuZPola\(tekst, rokBiezacy\)\{[\s\S]*?\n\}/),
].join('\n');
const { rocznikTalentuZPola } = new Function(`${kod}\n return { rocznikTalentuZPola };`)();
const ROK = 2026;

console.log('\n1. Poprawne roczniki');
[['2010', 2010], [' 2008 ', 2008], ['1990', 1990], ['2026', 2026]].forEach(([wpis, oczekiwany]) => {
  const w = rocznikTalentuZPola(wpis, ROK);
  sprawdz(`„${wpis}" → ${oczekiwany}`, w.ok && w.wartosc === oczekiwany, JSON.stringify(w));
});

console.log('\n2. Puste pole usuwa rocznik — nie zapisuje zera');
['', '   ', null, undefined].forEach(wpis => {
  const w = rocznikTalentuZPola(wpis, ROK);
  sprawdz(`„${wpis}" → brak rocznika`, w.ok && w.wartosc === null, JSON.stringify(w));
});

console.log('\n3. Literówki są odrzucane z powodem, a nie zapisywane');
['201', '20100', '2O10', '10', 'abcd', '2010.5', '-2010'].forEach(wpis => {
  const w = rocznikTalentuZPola(wpis, ROK);
  sprawdz(`„${wpis}" odrzucone`, !w.ok && /cztery cyfry/.test(w.powod), JSON.stringify(w));
});
['1989', '2027', '1900'].forEach(wpis => {
  const w = rocznikTalentuZPola(wpis, ROK);
  sprawdz(`„${wpis}" poza zakresem`, !w.ok && /poza zakresem 1990–2026/.test(w.powod), JSON.stringify(w));
});

console.log('\n4. Wiersz talentu');
const wiersz = wytnij('wierszTalentu', /const wierszTalentu = \(t\)=>`[\s\S]*?\n    <\/div>`;/);
const kolejnosc = ['talent-row-name', 'talent-rocznik-wrap', 'talent-row-meta', 'talent-row-actions'].map(k => wiersz.indexOf(k));
sprawdz('kolejność kolumn: nazwisko → rocznik → klub → przyciski',
  kolejnosc.every(i => i >= 0) && kolejnosc.every((v, i, a) => i === 0 || v > a[i - 1]), JSON.stringify(kolejnosc));
sprawdz('pole rocznika ma identyfikator talentu', /class="talent-rocznik[^"]*" data-id="\$\{t\.id\}"/.test(wiersz));
sprawdz('puste pole oznaczone klasą „brak"', /talent-rocznik\$\{t\.birthYear \? '' : ' brak'\}/.test(wiersz));
sprawdz('pole zaznaczenia bez stylu rozciągającego', !/talent-check"[^>]*style=/.test(wiersz));
sprawdz('siatka wiersza ma cztery kolumny', /\.talent-row\{display:grid;grid-template-columns:minmax\(0,1fr\) 104px minmax\(130px,240px\) max-content;/.test(style));
sprawdz('pole zaznaczenia nie dziedziczy width:100%', /\.talent-row \.talent-check\{width:auto;/.test(style));

console.log('\n5. Zapis i nawigacja');
sprawdz('zapis przy zmianie pola', zrodlo.includes("pole.addEventListener('change', zapiszRocznik);"));
sprawdz('Enter zapisuje i przechodzi do następnego wiersza', /e\.key !== 'Enter'[\s\S]{0,120}zapiszRocznik\(\);[\s\S]{0,80}polaRocznika\[i \+ 1\]/.test(zrodlo));
sprawdz('ten sam rocznik nie wysyła drugiego zapisu', /if\(poprzedni === wynik\.wartosc\)\{/.test(zrodlo));
sprawdz('pojedynczy rocznik zapisuje się bez przerysowania listy',
  !/const zapiszRocznik = \(\)=>\{[\s\S]*?\n    \};/.exec(zrodlo)[0].includes('render()'));
sprawdz('zapis przez saveTalents — kadra jedzie razem z rocznikiem', /zapisRocznikowTimer = setTimeout\(async \(\)=>\{\s*const ok = await saveTalents\(\);/.test(zrodlo));
sprawdz('zbiorczy rocznik dla zaznaczonych jest podpięty', zrodlo.includes(`querySelectorAll('[data-action="talent-rocznik-zbiorczo"]')`) && zrodlo.includes('id="talent-rocznik-zbiorczo"'));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
