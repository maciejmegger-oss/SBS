// Raport jednostronicowy — dokument, który wychodzi poza system.
//
// Zgłoszenie (29.10.2026): „zobacz ten profil, świetnie czytelny — musimy też mój dopracować".
// Wzorem był jednostronicowy raport skautingowy: dane, wykres, mocne strony, werdykt na jednej
// kartce. Ten test pilnuje rzeczy, które przy takim dokumencie kosztują najwięcej, gdy zawiodą:
//
//   1. RAPORT NIE WYMYŚLA LICZB. Zawodnik bez raportów nie dostaje oceny — dostaje zdanie,
//      że oceny nie ma. Dokument z wymyśloną liczbą trafia do klubu i ktoś podejmuje na niej
//      decyzję transferową.
//   2. MOCNE STRONY LICZONE PRZEZ PORÓWNANIE, nie przez próg. Ocena 4,2 jest mocną stroną
//      stopera IV ligi i słabą stroną stopera Ekstraklasy. Próg wpisany na sztywno kłamie
//      w jedną albo w drugą stronę.
//   3. STOPKA METODOLOGICZNA ZOSTAJE. To jedyne, co odróżnia raport skautingowy od ulotki:
//      ile raportów, czyich, i czego w dokumencie NIE MA.
//   4. DRUK DAJE JEDNĄ KARTKĘ W DWÓCH KOLUMNACH. Oba te warunki już raz pękły: raz wyszła
//      pusta strona, raz dokument rozlał się na dwie w jednej kolumnie — bo kartka A4 jest
//      w pikselach węższa niż próg układu telefonowego.
//
// Uruchomienie:  node scripts/test-raport-jednostronicowy.mjs
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
  wytnij('fmt1', /function fmt1\(n\)\{[^\n]*\}/),
  wytnij('fmt1Pl', /function fmt1Pl\(n\)\{[^\n]*\}/),
  wytnij('SKROTY_POZYCJI', /const SKROTY_POZYCJI: \[RegExp, string\]\[\] = \[[\s\S]*?\n\];/),
  wytnij('skrotPozycji', /function skrotPozycji\(pozycja\)\{[\s\S]*?\n\}/),
  wytnij('radarRaportow', /function radarRaportow\(metryki, opcje\)\{[\s\S]*?\n\}/),
  wytnij('RJS_RAPORTOW_NA_WNIOSKI', /const RJS_RAPORTOW_NA_WNIOSKI = \d+;/),
  wytnij('RJS_ODSTEP', /const RJS_ODSTEP = [\d.]+;[^\n]*/),
  wytnij('rjsStronyZawodnika', /function rjsStronyZawodnika\(metryki, odniesienie\)\{[\s\S]*?\n\}/),
  wytnij('rjsSlupek', /function rjsSlupek\(wartosc, srednia\)\{[\s\S]*?\n\}/),
  wytnij('raportJednostronicowyHtml', /function raportJednostronicowyHtml\(p\)\{[\s\S]*?\n\}/),
].join('\n').replace(/: \[RegExp, string\]\[\]/, '');

// Zaślepki za bazę. Każda wartość wstrzykiwana osobno, żeby dało się zbudować sytuację
// „zawodnik bez raportów" bez dotykania reszty.
function zbuduj(nadpisz = {}) {
  const d = {
    reps: [{ date: '2026-09-14' }, { date: '2026-10-05' }, { date: '2026-10-22' }],
    srednia: { overall: 4.3, ratedReports: 3 },
    metryki: [
      { key: 'atak', label: 'Faza ataku', wartosc: 4.8, zIlu: 3 },
      { key: 'obrona', label: 'Faza obrony', wartosc: 3.4, zIlu: 3 },
      { key: 'tech', label: 'Technika', wartosc: 5.1, zIlu: 3 },
    ],
    odn: { pozycja: 'Pomocnik ofensywny', etykieta: 'Ekstraklasa', rywali: 11, osie: {
      atak: { srednia: 4.1, ilu: 11 }, obrona: { srednia: 3.9, ilu: 11 }, tech: { srednia: 4.3, ilu: 11 } } },
    por: { pozycja: 'Pomocnik ofensywny', liga: 'Ekstraklasa', poziom: 'Ekstraklasa', ocena: 4.3, raportow: 3,
      wPoziomie: { miejsce: 3, ilu: 11, wystarczy: true, lepsi: [] }, wGrupie: null },
    ...nadpisz,
  };
  return new Function(
    'esc', 'clubCrest', 'clubName', 'ligaZawodnika', 'nationalityFlag', 'rocznikZawodnika',
    'raportyGracza', 'sredniaZRaportow', 'metrykiZRaportow', 'sredniaPozycjiNaOsiach',
    'porownanieNaPozycji', 'ocenyZRaportow', 'autorzyRaportu', 'opisPozycjiNmg', 'minutyWazone',
    `${kod}\n return { raportJednostronicowyHtml, rjsStronyZawodnika, rjsSlupek, fmt1Pl };`)(
    (s) => String(s ?? ''), () => '', () => 'Lech Poznań', () => 'Ekstraklasa',
    () => '🇪🇸', (p) => p.birthYear || '',
    () => d.reps, () => d.srednia, () => d.metryki, () => d.odn,
    () => d.por, () => new Map(), () => 'M. Megger', () => '', () => null);
}

const ZAWODNIK = { id: 'Z1', firstName: 'Pablo', lastName: 'Rodríguez', birthYear: 2001,
  position: 'Pomocnik ofensywny', clubId: 'K1', nationality: 'Hiszpania', foot: 'prawa', height: 178,
  matches: 14, minutes: 1026, goals: 3, assists: 5 };

const R = zbuduj();

console.log('\n1. Polski zapis liczb — dokument idzie do polskiego klubu');
{
  sprawdz('4,3 a nie 4.3', R.fmt1Pl(4.3) === '4,3', R.fmt1Pl(4.3));
  const html = R.raportJednostronicowyHtml(ZAWODNIK);
  sprawdz('w raporcie nie ma kropki dziesiętnej', !/>\s*\d+\.\d\s*</.test(html.replace(/<svg[\s\S]*?<\/svg>/g, '')),
    (html.match(/>\s*\d+\.\d\s*</) || [])[0]);
  // Wykres i słupki muszą mówić jednym językiem — wcześniej radar pisał „4.8" obok słupka „4,8".
  sprawdz('wykres też z przecinkiem', /4,8/.test(html));
}

console.log('\n2. Mocne strony przez porównanie, nie przez próg');
{
  const metryki = [{ key: 'a', label: 'A', wartosc: 4.2 }, { key: 'b', label: 'B', wartosc: 4.2 }];
  // Ta sama ocena 4,2 wobec dwóch różnych poziomów pozycji: raz mocna strona, raz słaba.
  const niska = R.rjsStronyZawodnika(metryki, { osie: { a: { srednia: 3.5 }, b: { srednia: 3.5 } } });
  sprawdz('4,2 przy średniej 3,5 to mocna strona', niska.mocne.length === 2 && !niska.slabe.length,
    JSON.stringify([niska.mocne.length, niska.slabe.length]));
  const wysoka = R.rjsStronyZawodnika(metryki, { osie: { a: { srednia: 4.9 }, b: { srednia: 4.9 } } });
  sprawdz('4,2 przy średniej 4,9 to obszar do rozwoju', wysoka.slabe.length === 2 && !wysoka.mocne.length,
    JSON.stringify([wysoka.mocne.length, wysoka.slabe.length]));
  // Drobna różnica nie jest różnicą — inaczej każda oś lądowałaby po którejś stronie.
  const rowno = R.rjsStronyZawodnika(metryki, { osie: { a: { srednia: 4.1 }, b: { srednia: 4.3 } } });
  sprawdz('różnica poniżej progu nie trafia nigdzie', !rowno.mocne.length && !rowno.slabe.length,
    JSON.stringify([rowno.mocne.length, rowno.slabe.length]));
  // Bez odniesienia wracamy do progów bezwzględnych — ale nadal coś pokazujemy.
  const bezOdn = R.rjsStronyZawodnika([{ key: 'a', label: 'A', wartosc: 5.2 }, { key: 'b', label: 'B', wartosc: 2.4 }], null);
  sprawdz('bez średniej pozycji działają progi', bezOdn.mocne.length === 1 && bezOdn.slabe.length === 1);
  sprawdz('najwyżej cztery pozycje na liście',
    R.rjsStronyZawodnika(Array.from({length:9},(_,i)=>({key:'k'+i,label:'K'+i,wartosc:5.5})), null).mocne.length === 4);
}

console.log('\n3. Skala słupka zaczyna się od 1, nie od zera');
{
  // Ocena 1 to najniższa możliwa, a nie brak zawodnika — pusty słupek sugerowałby to drugie.
  sprawdz('1 daje 0%', /width:0\.0%/.test(R.rjsSlupek(1, null)), R.rjsSlupek(1, null));
  sprawdz('6 daje 100%', /width:100\.0%/.test(R.rjsSlupek(6, null)));
  sprawdz('3,5 daje 50%', /width:50\.0%/.test(R.rjsSlupek(3.5, null)));
  sprawdz('znacznik średniej tylko gdy średnia jest',
    R.rjsSlupek(4, 3.5).includes('rjs-slupek-srednia') && !R.rjsSlupek(4, null).includes('rjs-slupek-srednia'));
  sprawdz('wartość poza skalą nie wyjeżdża poza słupek', /width:100\.0%/.test(R.rjsSlupek(9, null)));
}

console.log('\n4. Raport nie wymyśla liczb');
{
  const pusty = zbuduj({ reps: [], srednia: { overall: null, ratedReports: 0 }, metryki: [], odn: null, por: null });
  const html = pusty.raportJednostronicowyHtml(ZAWODNIK);
  sprawdz('bez raportów nie ma oceny', !/rjs-ocena-liczba">\d/.test(html), (html.match(/rjs-ocena-liczba">[^<]*/) || [])[0]);
  sprawdz('i jest napisane dlaczego', /ani jednego wypełnionego raportu/.test(html));
  sprawdz('nagłówek mówi „brak raportów"', /brak raportów w systemie/.test(html));
  sprawdz('bez osi nie rysujemy wykresu', !/<svg/.test(html));
  sprawdz('statystyki sezonu mimo to są', /rjs-staty/.test(html));
}

console.log('\n5. Stopka metodologiczna');
{
  const html = R.raportJednostronicowyHtml(ZAWODNIK);
  sprawdz('stopka jest', /Na czym stoi ten raport/.test(html));
  sprawdz('mówi o skali 1–6', /skali 1–6/.test(html));
  sprawdz('mówi, czego NIE ma', /xG/.test(html) && /percentyl/.test(html));
  sprawdz('liczba raportów w nagłówku', /na podstawie 3 raportów/.test(html));
  sprawdz('okres obserwacji', /2026-09-14 – 2026-10-22/.test(html));
  sprawdz('nazwiska skautów', /M\. Megger/.test(html));
  // Przy jednym raporcie dokument musi sam siebie ostrzec — inaczej opinia jednego człowieka
  // z jednego meczu wygląda jak ustalony fakt.
  const jeden = zbuduj({ reps: [{ date: '2026-10-22' }], srednia: { overall: 4.3, ratedReports: 1 } });
  const h1 = jeden.raportJednostronicowyHtml(ZAWODNIK);
  sprawdz('jeden raport = ostrzeżenie w stopce', /za mało na wnioski rozstrzygające/.test(h1));
  sprawdz('trzy raporty = bez tego ostrzeżenia', !/za mało na wnioski rozstrzygające/.test(html));
}

console.log('\n6. Miejsce na tle pozycji');
{
  const html = R.raportJednostronicowyHtml(ZAWODNIK);
  sprawdz('miejsce w grupie', /3\.<\/strong> z 11 ocenionych/.test(html), (html.match(/rjs-miejsce[\s\S]{0,80}/) || [])[0]);
  // Przy dwóch ocenionych „pierwszy z dwóch" brzmi jak wyróżnienie, a znaczy tylko tyle,
  // że drugi raport wypadł gorzej.
  const malo = zbuduj({ por: { pozycja: 'x', liga: 'IV liga', poziom: 'IV liga', ocena: 4.3, raportow: 3,
    wPoziomie: { miejsce: 1, ilu: 2, wystarczy: false, lepsi: [] }, wGrupie: null } });
  const h = malo.raportJednostronicowyHtml(ZAWODNIK);
  sprawdz('za mała grupa — nie podajemy miejsca', !/rjs-miejsce/.test(h));
  sprawdz('i mówimy dlaczego', /Za mało ocenionych/.test(h));
}

console.log('\n7. Arkusz do druku');
{
  const druk = (style.match(/@media print\{[\s\S]*$/) || [''])[0];
  sprawdz('reguły druku istnieją', druk.length > 50);
  sprawdz('A4', /size:\s*A4/.test(druk));
  // Oba warianty: raport w oknie systemu i raport sam na stronie. Reguła wymieniająca tylko
  // okno dawała pustą kartkę przy podglądzie i eksporcie.
  sprawdz('raport poza oknem systemu też się drukuje', /:not\(\.rjs-okno\):not\(\.rjs\)/.test(druk), druk.slice(0, 400));
  // Kartka A4 ma w pikselach mniej niż próg układu telefonowego — bez tego raport drukował się
  // w jednej kolumnie i zajmował dwie strony.
  sprawdz('dwie kolumny wymuszone na druku', /\.rjs-siatka\{grid-template-columns:1fr 1fr !important/.test(druk));
  sprawdz('bloki nie łamią się w pół', /break-inside:avoid/.test(druk));
}

console.log('\n8. Wejście do raportu z profilu zawodnika');
{
  sprawdz('przycisk w pasku', /data-action="raport-jednostronicowy"/.test(zrodlo));
  sprawdz('przycisk podpięty', /\[data-action="raport-jednostronicowy"\][\s\S]{0,120}otworzRaportJednostronicowy/.test(zrodlo));
  sprawdz('okno ma przycisk druku', /data-rjs="drukuj"/.test(zrodlo));
  sprawdz('Escape zamyka okno', /e\.key === 'Escape'/.test(zrodlo.slice(zrodlo.indexOf('function otworzRaportJednostronicowy'))));
}

console.log(bledy ? `\nBŁĘDÓW: ${bledy}\n` : '\nWszystko w porządku.\n');
process.exit(bledy ? 1 : 0);
