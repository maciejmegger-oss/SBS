// Sprawdza rozdzielanie sklejonych wpisów talentów i odczyt pozycji z numeru — na PRAWDZIWYCH
// funkcjach z src/main.ts i na PRAWDZIWYCH wpisach z listy talentów (zrzuty z 12.09.2026).
//
// Uruchomienie:  node scripts/test-porzadkowanie-talentow.mjs
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
  wytnij('RE_ROK_TALENTU', /const RE_ROK_TALENTU = .*;/),
  wytnij('czyscLinieTalentu', /function czyscLinieTalentu\(l\)\{[\s\S]*?\n\}/),
  wytnij('ladnaNazwaOsoby', /function ladnaNazwaOsoby\(s\)\{[\s\S]*?\n\}/),
  wytnij('rozdzielImieNazwisko', /function rozdzielImieNazwisko\(pelne\)\{[\s\S]*?\n\}/),
  wytnij('wygladaNaKlubTalentu', /function wygladaNaKlubTalentu\(s\)\{[\s\S]*?\n\}/),
  wytnij('POSITION_NUMBERS', /const POSITION_NUMBERS = \[[\s\S]*?\n\];/),
  wytnij('KODY_POZYCJI_TALENTU', /const KODY_POZYCJI_TALENTU = \{[\s\S]*?\n\};/),
  wytnij('RE_ZNACZNIK_POZYCJI', /const RE_ZNACZNIK_POZYCJI = .*;/),
  wytnij('pozycjeZeZnacznika', /function pozycjeZeZnacznika\(znacznik\)\{[\s\S]*?\n\}/),
  wytnij('porzadkujKlubTalentu', /function porzadkujKlubTalentu\(tekst\)\{[\s\S]*?\n\}/),
  wytnij('wyjmijRocznikTalentu', /function wyjmijRocznikTalentu\(tekst\)\{[\s\S]*?\n\}/),
  wytnij('nazwaIOgonTalentu', /function nazwaIOgonTalentu\(przed\)\{[\s\S]*?\n\}/),
  wytnij('rozbierzWpisTalentu', /function rozbierzWpisTalentu\(tekst\)\{[\s\S]*?\n\}/),
  wytnij('wpisTalentuDoPorzadku', /function wpisTalentuDoPorzadku\(t\)\{[\s\S]*?\n\}/),
  wytnij('rozdzielWpisyTalentow', /function rozdzielWpisyTalentow\(talenty, doRozdzielenia, noweId\)\{[\s\S]*?\n\}/),
  wytnij('kadraDoPolaZrodla', /function kadraDoPolaZrodla\(t\)\{[\s\S]*?\n\}/),
  wytnij('talentyDoZapisu', /function talentyDoZapisu\(talenty\)\{[\s\S]*?\n\}/),
  wytnij('pozycjaDoPolaTalentu', /function pozycjaDoPolaTalentu\(t\)\{[\s\S]*?\n\}/),
  wytnij('pozycjaZPolaTalentu', /function pozycjaZPolaTalentu\(pole\)\{[\s\S]*?\n\}/),
  wytnij('nalozPozycjeZPolaTalentu', /function nalozPozycjeZPolaTalentu\(talenty\)\{[\s\S]*?\n\}/),
].join('\n');

const DB = { clubs: [] };
const api = new Function('DB', `${kod}\n return { rozbierzWpisTalentu, wpisTalentuDoPorzadku, rozdzielWpisyTalentow, talentyDoZapisu, nalozPozycjeZPolaTalentu, pozycjaZPolaTalentu, porzadkujKlubTalentu };`)(DB);

const opis = (o) => `${o.firstName} ${o.lastName} | ${o.birthYear || '—'} | ${o.pozycjeNmg.join('/') || o.pozycja || '—'} | ${o.club || '—'}`;
const przypadek = (wpis, oczekiwane) => {
  const w = api.rozbierzWpisTalentu(wpis);
  const dostal = w.map(opis);
  const ok = dostal.length === oczekiwane.length && dostal.every((d, i) => d === oczekiwane[i]);
  sprawdz(`„${wpis}"`, ok, '\n        dostał:    ' + dostal.join('  ||  ') + '\n        oczekiwał: ' + oczekiwane.join('  ||  '));
};

console.log('\n1. Wpisy z numerem na początku (nr Imię Nazwisko Klub)');
przypadek('1 Karol Nowicki AF Brzoza AF Brzoza', ['Karol Nowicki | — | 1 | AF Brzoza']);
przypadek('11 Tomasz Guba Legia Chełmża GOL Chełmża', ['Tomasz Guba | — | 11 | Legia Chełmża / GOL Chełmża']);
przypadek('2 Adam Kachel Chemik Bydgoszcz KS Brzoza', ['Adam Kachel | — | 2 | Chemik Bydgoszcz KS Brzoza']);
przypadek('8 Igor Łukasiak Elana Toruń Elana Toruń', ['Igor Łukasiak | — | 8 | Elana Toruń']);
przypadek('9 Wiktor Kosiński JSS Toruń JSS Toruń', ['Wiktor Kosiński | — | 9 | JSS Toruń']);

console.log('\n2. Numer w nawiasie, rocznik i klub doklejone do nazwiska');
przypadek('Bartosz Kotras (5) 2008 KS Wda Świecie', ['Bartosz Kotras | 2008 | 5 | KS Wda Świecie']);
przypadek('Brian Gaj poz.(7) 2007', ['Brian Gaj | 2007 | 7 | —']);
przypadek('Franciszek Słowik poz.(8)(7) 2008', ['Franciszek Słowik | 2008 | 8/7 | —']);
przypadek('Hubert Simson -KS Wda Świecie (2014)', ['Hubert Simson | 2014 | — | KS Wda Świecie']);
przypadek('Igor Jeliński(7)-AP Młode talenty', ['Igor Jeliński | — | 7 | AP Młode talenty']);
przypadek('Julek Walczak (9) 2014-AP Oleśnica', ['Julek Walczak | 2014 | 9 | AP Oleśnica']);
przypadek('Kacper Czajkowski(10)-MUKS Bydgoszcz', ['Kacper Czajkowski | — | 10 | MUKS Bydgoszcz']);

console.log('\n3. DWÓCH ZAWODNIKÓW W JEDNYM WPISIE');
przypadek('Filip Zimoląg (11)-AP Młode Talenty Alan Kamiński(BR)-Olimpia Grudziądz',
  ['Filip Zimoląg | — | 11 | AP Młode Talenty', 'Alan Kamiński | — | 1 | Olimpia Grudziądz']);
przypadek('Michał Kulski(ŚO)-BKS Bydgoszcz Bartosz Szpyt(9)-BKS Bydgoszcz',
  ['Michał Kulski | — | Obrońca środkowy | BKS Bydgoszcz', 'Bartosz Szpyt | — | 9 | BKS Bydgoszcz']);
przypadek('Kai Leo Michalski(4)(6)-Chemik Bydgoszcz Dawid Białkowski(9)-Chemik Bydgoszcz',
  ['Kai Leo Michalski | — | 4/6 | Chemik Bydgoszcz', 'Dawid Białkowski | — | 9 | Chemik Bydgoszcz']);

console.log('\n4. Numer koszulki (ponad 11) NIE jest pozycją');
// (22) rozdziela nazwisko od klubu tak samo jak numer pozycji — ale pozycji z niego nie odczytujemy.
przypadek('Jan Nowak (22)-KS Wda Świecie', ['Jan Nowak | — | — | KS Wda Świecie']);
{
  const w = api.rozbierzWpisTalentu('17 Jan Nowak KS Wda Świecie');
  sprawdz('„17 Jan Nowak…" — bez pozycji, choć nazwisko i klub odczytane',
    w.length === 1 && w[0].pozycjeNmg.length === 0 && w[0].lastName === 'Nowak' && w[0].club === 'KS Wda Świecie', JSON.stringify(w));
}

console.log('\n5. Które wpisy trafiają do porządkowania');
sprawdz('czysty wpis „Antoni Balcer / Talent Warszawa" zostaje w spokoju',
  api.wpisTalentuDoPorzadku({ id: 'a', firstName: 'Antoni', lastName: 'Balcer', club: 'Talent Warszawa' }) === null);
sprawdz('powołanego nie ruszamy, nawet z dziwnym zapisem',
  api.wpisTalentuDoPorzadku({ id: 'b', firstName: 'Jan', lastName: 'Kowalski (5)', reprezentacja: 'U-16' }) === null);
sprawdz('nazwisko z łącznikiem („Nowak-Jeziorski") nie jest brane za sklejony wpis',
  api.wpisTalentuDoPorzadku({ id: 'c', firstName: 'Piotr', lastName: 'Nowak-Jeziorski', club: 'Lech Poznań' }) === null);
const sklejony = { id: 'T1', firstName: 'Filip', lastName: 'Zimoląg (11)-AP Młode Talenty Alan Kamiński(BR)-Olimpia Grudziądz', club: '', dateAdded: '2026-05-01', confidence: 'import' };
const osoby = api.wpisTalentuDoPorzadku(sklejony);
sprawdz('sklejony wpis daje dwie osoby', osoby && osoby.length === 2, JSON.stringify(osoby));

console.log('\n6. Rozdzielenie: pierwsza osoba dziedziczy wpis, druga dostaje nowy');
{
  const przed = [sklejony, { id: 'T2', firstName: 'Antoni', lastName: 'Balcer', club: 'Talent Warszawa' }];
  const w = api.rozdzielWpisyTalentow(przed, new Map([['T1', osoby]]), () => 'NOWY');
  sprawdz('lista ma o jeden wpis więcej', w.talenty.length === 3, String(w.talenty.length));
  sprawdz('Zimoląg zachował identyfikator i datę dodania', w.talenty[0].id === 'T1' && w.talenty[0].dateAdded === '2026-05-01' && w.talenty[0].lastName === 'Zimoląg');
  sprawdz('Kamiński ma nowy wpis z datą i źródłem rodzica', w.talenty[1].id === 'NOWY' && w.talenty[1].dateAdded === '2026-05-01' && w.talenty[1].confidence === 'import');
  sprawdz('wpis spoza rozdzielenia nietknięty (ten sam obiekt)', w.talenty[2] === przed[1]);
  sprawdz('stara lista nie została zmieniona — da się do niej wrócić', przed[0].lastName.includes('Kamiński') && przed.length === 2);
  sprawdz('liczniki: 1 uporządkowany, 1 dodany', w.zmienionych === 1 && w.dodanych === 1, JSON.stringify(w));
}

console.log('\n7. Pozycja przeżywa odświeżenie strony (jedzie w wierszu talentu)');
{
  const wPamieci = [
    { id: 'A', firstName: 'Franciszek', lastName: 'Słowik', pozycjeNmg: [8, 7], pozycja: '' },
    { id: 'B', firstName: 'Michał', lastName: 'Kulski', pozycjeNmg: [], pozycja: 'Obrońca środkowy' },
    { id: 'C', firstName: 'Jan', lastName: 'Bez', confidence: 'import' },
  ];
  const doBazy = api.talentyDoZapisu(wPamieci);
  sprawdz('kopia do zapisu nie niesie pól bez kolumny', doBazy.every(t => !('pozycjeNmg' in t) && !('pozycja' in t)));
  console.log('   w bazie: ' + doBazy.map(t => `${t.lastName}=„${t.sourceImage}"`).join('  '));
  const zBazy = doBazy.map(t => ({ ...t }));
  api.nalozPozycjeZPolaTalentu(zBazy);
  sprawdz('Słowik wrócił z pozycjami 8/7', JSON.stringify(zBazy[0].pozycjeNmg) === '[8,7]', JSON.stringify(zBazy[0]));
  sprawdz('Kulski wrócił ze środkowym obrońcą', zBazy[1].pozycja === 'Obrońca środkowy', JSON.stringify(zBazy[1]));
  sprawdz('wpis bez pozycji nie dostał pozycji', !zBazy[2].pozycja && !(zBazy[2].pozycjeNmg || []).length);
  sprawdz('nieznany zapis w polu nie udaje pozycji', api.pozycjaZPolaTalentu('jakis-obrazek.png') === null);
}

console.log('\n8. Podpięcie w aplikacji');
sprawdz('pozycje nakładane przy wczytaniu', /nalozKadryNaTalenty\(DB\.talents, talentyKadry\);\s*nalozPozycjeZPolaTalentu\(DB\.talents\);/.test(zrodlo));
sprawdz('pozycja przechodzi do profilu przy dodaniu do bazy', /pozycjaNmg: \(t\.pozycjeNmg \|\| \[\]\)\[0\] \|\| null,/.test(zrodlo));
sprawdz('przycisk porządkowania podpięty', zrodlo.includes(`querySelectorAll('[data-action="talent-porzadkuj"]')`));
sprawdz('po nieudanym zapisie lista wraca do stanu sprzed rozdzielenia', /if\(ok === false\) DB\.talents = przed;/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
