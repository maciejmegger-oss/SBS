// Sprawdza zakładki w Talentach: Reprezentanci (kadry) i „Talent klubowy" z rocznikami — na
// PRAWDZIWYM kodzie z src/main.ts.
// Zgłoszenie (13.09.2026): zamiast „Poza kadrą" przycisk „Talent klubowy", pod nim roczniki.
//
// Uruchomienie:  node scripts/test-talent-zakladki.mjs
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

console.log('\n1. Filtr rocznika');
{
  const wRocznikuTalentu = new Function(`${wytnij('wRocznikuTalentu', /function wRocznikuTalentu\(t, rocznik\)\{[\s\S]*?\n\}/)}\n return wRocznikuTalentu;`)();
  const lista = [
    { id: 'A', birthYear: 2013 }, { id: 'B', birthYear: '2013' }, { id: 'C', birthYear: 2014 }, { id: 'D', birthYear: null }, { id: 'E' },
  ];
  const ids = (r) => lista.filter(t => wRocznikuTalentu(t, r)).map(t => t.id).join('');
  sprawdz('bez wyboru — wszyscy', ids('') === 'ABCDE', ids(''));
  sprawdz('2013 — także rocznik zapisany jako tekst', ids('2013') === 'AB', ids('2013'));
  sprawdz('2014', ids('2014') === 'C', ids('2014'));
  sprawdz('„Bez rocznika" — tylko puste', ids('brak') === 'DE', ids('brak'));
}

console.log('\n2. Układ zakładek');
const zakladki = wytnij('zakladkiKadr', /const zakladkiKadr = `[\s\S]*?\n  <\/div>`;/);
sprawdz('„Poza kadrą" nie jest już przyciskiem', !/pigulkaKadry\('inni', 'Poza kadrą'/.test(zrodlo));
sprawdz('przycisk „Talent klubowy" prowadzi do zawodników bez powołania', /pigulkaKadry\('inni', 'Talent klubowy', iluWKadrze\('inni'\)\)/.test(zakladki));
const iWszyscy = zakladki.indexOf("pigulkaKadry('', 'Wszyscy'");
const iRepr = zakladki.indexOf("naglowekSekcji('Reprezentanci')");
const iKadry = zakladki.indexOf('KADRY_MLODZIEZOWE.map');
const iKlubowy = zakladki.indexOf("'Talent klubowy'");
sprawdz('kolejność: Wszyscy → Reprezentanci → kadry → Talent klubowy',
  iWszyscy >= 0 && iWszyscy < iRepr && iRepr < iKadry && iKadry < iKlubowy, JSON.stringify([iWszyscy, iRepr, iKadry, iKlubowy]));
sprawdz('roczniki pokazują się tylko po wybraniu „Talentu klubowego"', /\$\{talentKadra === 'inni' \? `<div class="filters talent-roczniki"/.test(zakladki));
sprawdz('roczniki od najmłodszego', /rocznikiKlubowe = \[\.\.\.new Set\([\s\S]*?\)\]\.sort\(\(a,b\)=> b - a\)/.test(zrodlo));
sprawdz('„Bez rocznika" tylko, gdy ktoś go nie ma', /\$\{bezRocznika \? pigulkaRocznika\('brak', 'Bez rocznika', bezRocznika\) : ''\}/.test(zakladki));

console.log('\n3. Podpięcie');
sprawdz('lista zawęża się do rocznika tylko w „Talencie klubowym"', /\.filter\(t=> talentKadra !== 'inni' \|\| wRocznikuTalentu\(t, talentRocznik\)\)/.test(zrodlo));
sprawdz('kliknięcie rocznika jest obsłużone', /querySelectorAll\('\[data-action="talent-rocznik-filtr"\]'\)[\s\S]{0,120}talentRocznik = \(b as HTMLElement\)\.dataset\.val \|\| '';/.test(zrodlo));
sprawdz('zmiana kadry czyści wybór rocznika', /talentKadra = \(b as HTMLElement\)\.dataset\.val \|\| '';\s*talentRocznik = '';/.test(zrodlo));
// Bez linii komentarzy — stary komentarz może opisywać historię zakładki, to nie jest napis na ekranie.
const bezKomentarzy = zrodlo.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
sprawdz('komunikaty nie odsyłają już do „Poza kadrą"', !/w „Poza kadrą"/.test(bezKomentarzy));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
