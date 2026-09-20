// Sprawdza wyszukiwarkę klubu w zakładce Kluby — na PRAWDZIWYCH funkcjach z src/main.ts.
// Zgłoszenie (19.09.2026): „zrób okienko wyszukiwania klubu do wpisania" — przy 600 klubach
// w widoku „Wszystkie" nazwy nie da się znaleźć wzrokiem.
//
// Uruchomienie:  node scripts/test-szukanie-klubu.mjs
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
  wytnij('szukajNorm', /const szukajNorm = \(s\)=>[\s\S]*?;\r?\n/),
  wytnij('filtrSzukaniaKlubu', /function filtrSzukaniaKlubu\(fraza\)\{[\s\S]*?\n\}/),
].join('\n');
const { filtrSzukaniaKlubu } = new Function(`${kod}\n return { filtrSzukaniaKlubu };`)();

const KLUBY = [
  { name: 'Zawisza Bydgoszcz', city: 'Bydgoszcz', region: 'Kujawsko-Pomorski ZPN', league: 'II liga' },
  { name: 'Chemik Bydgoszcz', city: 'Bydgoszcz', region: 'Kujawsko-Pomorski ZPN', league: 'III liga, gr. II' },
  { name: 'Śląsk Wrocław', city: 'Wrocław', region: 'Dolnośląski ZPN', league: 'Ekstraklasa' },
  { name: 'Olimpia Elbląg', city: 'Elbląg', region: 'Warmińsko-Mazurski ZPN', league: 'III liga, gr. I' },
  { name: 'AP Olimpia Grudziądz', city: 'Grudziądz', region: 'Kujawsko-Pomorski ZPN', league: 'Rocznik 2013' },
  { name: 'Wisła Płock', city: 'Płock', region: 'Mazowiecki ZPN', league: 'I liga' },
  { name: 'Legia Chełmża', city: 'Chełmża', region: 'Kujawsko-Pomorski ZPN', league: 'IV liga (kujawsko-pomorska)' },
];
const znajdz = (fraza) => {
  const f = filtrSzukaniaKlubu(fraza);
  return (f ? KLUBY.filter(f) : KLUBY).map(c => c.name);
};

console.log('\n1. Wpisana nazwa');
sprawdz('„zawisza" → Zawisza Bydgoszcz', JSON.stringify(znajdz('zawisza')) === JSON.stringify(['Zawisza Bydgoszcz']), znajdz('zawisza').join(', '));
sprawdz('fragment nazwy („chem") wystarczy', znajdz('chem').join() === 'Chemik Bydgoszcz');
sprawdz('wielkość liter bez znaczenia', znajdz('ZAWISZA').join() === 'Zawisza Bydgoszcz');
sprawdz('„olimpia" pokazuje obie Olimpie', znajdz('olimpia').length === 2, znajdz('olimpia').join(', '));

console.log('\n2. Ogonki — wpisywane w biegu, więc nie mogą decydować');
sprawdz('„slask" znajduje Śląsk Wrocław', znajdz('slask').join() === 'Śląsk Wrocław', znajdz('slask').join(', '));
sprawdz('„chelmza" znajduje Legię Chełmżę', znajdz('chelmza').join() === 'Legia Chełmża', znajdz('chelmza').join(', '));
sprawdz('„płock" z ogonkami też działa', znajdz('płock').join() === 'Wisła Płock');

console.log('\n3. Kilka słów — każde musi trafić');
sprawdz('„zaw byd" → Zawisza Bydgoszcz', znajdz('zaw byd').join() === 'Zawisza Bydgoszcz', znajdz('zaw byd').join(', '));
sprawdz('„olimpia grudziadz" odsiewa Elbląg', znajdz('olimpia grudziadz').join() === 'AP Olimpia Grudziądz', znajdz('olimpia grudziadz').join(', '));
sprawdz('słowa mogą być z różnych pól (nazwa + liga)', znajdz('chemik III').join() === 'Chemik Bydgoszcz', znajdz('chemik III').join(', '));
sprawdz('niepasujące słowo zeruje wynik', znajdz('zawisza wroclaw').length === 0);

console.log('\n4. Miasto, ZPN i liga też są przeszukiwane');
sprawdz('„bydgoszcz" → oba kluby z miasta', znajdz('bydgoszcz').length === 2, znajdz('bydgoszcz').join(', '));
sprawdz('„kujawsko" → cztery kluby tego ZPN', znajdz('kujawsko').length === 4, znajdz('kujawsko').join(', '));
sprawdz('„ekstraklasa" → Śląsk', znajdz('ekstraklasa').join() === 'Śląsk Wrocław');

console.log('\n5. Pusta fraza to brak filtra (widok wraca do przeglądania wg lig)');
sprawdz('pusty tekst — filtra nie ma', filtrSzukaniaKlubu('') === null);
sprawdz('same spacje — filtra nie ma', filtrSzukaniaKlubu('   ') === null);

console.log('\n6. Podpięcie');
sprawdz('pole w widoku Kluby', /<input id="club-search"/.test(zrodlo));
sprawdz('pole odświeża listę przy pisaniu', /poleSzukaniaKlubu\.oninput = \(\)=>\{ clubBrowse\.szukaj = poleSzukaniaKlubu\.value; render\(\); \}/.test(zrodlo));
sprawdz('szukanie omija wybraną ligę i patrzy w całą bazę',
  /const szukanie = filtrSzukaniaKlubu\(clubBrowse\.szukaj\);\s*\n\s*if\(szukanie\) return list\.filter\(szukanie\);/.test(zrodlo));
sprawdz('przycisk „Wyczyść" wraca do przeglądania wg lig', /data-action="club-search-clear"/.test(zrodlo) && /clubBrowse\.szukaj=""; render\(\);/.test(zrodlo));
sprawdz('wybór ligi kończy szukanie', /clubBrowse\.top = b\.dataset\.val; clubBrowse\.group=""; clubBrowse\.szukaj=""; render\(\);/.test(zrodlo));
sprawdz('wybór grupy kończy szukanie', /clubBrowse\.group = b\.dataset\.val; clubBrowse\.szukaj = "";/.test(zrodlo));
sprawdz('nagłówek mówi, że szukamy w całej bazie', /szukam w całej bazie \(\$\{DB\.clubs\.length\}\)/.test(zrodlo));
sprawdz('brak wyników tłumaczy się frazą, a nie „brak klubów w widoku"', /Żaden klub nie pasuje do/.test(zrodlo));
sprawdz('stan szukania trzymany przy przeglądaniu klubów', /let clubBrowse = \{top:"", group:"", szukaj:""\};/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
