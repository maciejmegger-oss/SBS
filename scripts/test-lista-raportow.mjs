// Sprawdza listę „Zapisane raporty": WYŁĄCZNIE raporty zawodników, bez raportów meczów — na
// PRAWDZIWYM kodzie z src/main.ts.
// Zgłoszenia (13–14.09.2026): „MECZ Chojniczanka Chojnice - Olimpia Grudziądz" i „MECZ Lech II Poznań -
// Noteć Czarnków" między raportami zawodników; na liście mają być tylko zaznaczeni i otagowani zawodnicy.
//
// Uruchomienie:  node scripts/test-lista-raportow.mjs
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

const czyRaportZawodnika = new Function(`${wytnij('czyRaportZawodnika', /function czyRaportZawodnika\(r\)\{.*\}/)}\n return czyRaportZawodnika;`)();

console.log('\n1. Co trafia na listę');
sprawdz('raport zawodnika — tak', czyRaportZawodnika({ id: 'R1', playerId: 'Z1' }) === true);
sprawdz('raport meczu (Chojniczanka - Olimpia) — nie', czyRaportZawodnika({ kind: 'mecz', match: 'Chojniczanka Chojnice - Olimpia Grudziądz' }) === false);
sprawdz('raport meczu z raportami zawodników z tego meczu (Lech II - Noteć) — też nie',
  czyRaportZawodnika({ id: 'rep:O1:mecz', kind: 'mecz', match: 'Lech II Poznań - Noteć Czarnków', fromObservationId: 'O1' }) === false);
sprawdz('raport meczu z przypiętym zawodnikiem — nie', czyRaportZawodnika({ kind: 'mecz', playerId: 'Z1' }) === false);
sprawdz('raport zawodnika usuniętego z kartoteki — zostaje, żeby dało się go skasować', czyRaportZawodnika({ id: 'R4', playerId: 'SKASOWANY' }) === true);
sprawdz('pusty wpis — nie', czyRaportZawodnika(null) === false && czyRaportZawodnika({}) === false);

console.log('\n2. Lista, licznik i numery');
const widok = wytnij('viewReports', /function viewReports\(\)\{[\s\S]*?\n\}/);
sprawdz('lista i licznik tylko z raportów zawodników', /const widoczneRaporty = DB\.reports\.filter\(czyRaportZawodnika\);/.test(widok)
  && /const allReports = widoczneRaporty\.slice\(\)/.test(widok) && widok.includes('<span class="reports-count">${allReports.length}</span>'));
sprawdz('żadnego wyjątku dla raportów meczów', !/raportMeczuMaRaportyZawodnikow/.test(zrodlo));
sprawdz('numer porządkowy wśród pokazanych — bez dziur', /widoczneRaporty\.forEach\(\(r,i\)=> ordinalOf\[r\.id\] = i\+1\);/.test(widok));
{
  const reports = [
    { id: 'A', playerId: 'Z1' },
    { id: 'rep:O3:mecz', kind: 'mecz', match: 'Lech II Poznań - Noteć Czarnków', fromObservationId: 'O3' },
    { id: 'rep:O3:Z5', playerId: 'Z5', fromObservationId: 'O3' },
  ];
  const widoczne = reports.filter(czyRaportZawodnika).map(r => r.id);
  sprawdz('na liście tylko A i raport zawodnika z Lecha II', JSON.stringify(widoczne) === JSON.stringify(['A', 'rep:O3:Z5']), JSON.stringify(widoczne));
}

console.log('\n3. Klub przy zawodniku');
sprawdz('wiersz raportu zawodnika pokazuje herb i nazwę klubu',
  widok.includes("pl && pl.clubId ? `<span class=\"report-klub\">${crestImg(clubCrest(pl.clubId), 'xs', clubName(pl.clubId))}<span>${esc(clubName(pl.clubId))}</span></span>` : ''"));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
