// Sprawdza listę „Zapisane raporty": raporty zawodników, a raport meczu tylko wtedy, gdy z tego meczu
// jest choć jeden raport zawodnika — na PRAWDZIWYM kodzie z src/main.ts.
// Zgłoszenie (13.09.2026): „MECZ Chojniczanka Chojnice - Olimpia Grudziądz" stał na liście, choć z tego
// meczu nie sporządzono żadnego raportu indywidualnego.
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

const kod = [
  wytnij('importNorm', /const importNorm = [\s\S]*?\.replace\(\/\[\^a-z0-9\]\/g,''\);/),
  wytnij('czyRaportZawodnika', /function czyRaportZawodnika\(r\)\{.*\}/),
  wytnij('raportMeczuMaRaportyZawodnikow', /function raportMeczuMaRaportyZawodnikow\(m, raportyZawodnikow\)\{[\s\S]*?\n\}/),
].join('\n');
const { czyRaportZawodnika, raportMeczuMaRaportyZawodnikow } =
  new Function(`${kod}\n return { czyRaportZawodnika, raportMeczuMaRaportyZawodnikow };`)();

console.log('\n1. Raporty zawodników');
sprawdz('raport zawodnika — tak', czyRaportZawodnika({ id: 'R1', playerId: 'Z1' }) === true);
sprawdz('raport meczu (nawet z przypiętym zawodnikiem) to nie raport zawodnika', czyRaportZawodnika({ kind: 'mecz' }) === false && czyRaportZawodnika({ kind: 'mecz', playerId: 'Z1' }) === false);
sprawdz('raport zawodnika usuniętego z kartoteki — zostaje, żeby dało się go skasować', czyRaportZawodnika({ id: 'R4', playerId: 'SKASOWANY' }) === true);
sprawdz('pusty wpis — nie', czyRaportZawodnika(null) === false && czyRaportZawodnika({}) === false);

console.log('\n2. Raport meczu — tylko z raportem zawodnika z tego meczu');
const MECZ = { id: 'rep:O1:mecz', kind: 'mecz', match: 'Chojniczanka Chojnice - Olimpia Grudziądz', date: '2026-09-19', fromObservationId: 'O1' };
sprawdz('bez żadnego raportu zawodnika — NIE (zgłoszenie ze zrzutu)', raportMeczuMaRaportyZawodnikow(MECZ, []) === false);
sprawdz('raport zawodnika z tej samej obserwacji (telefon) — tak',
  raportMeczuMaRaportyZawodnikow(MECZ, [{ id: 'rep:O1:Z7', playerId: 'Z7', fromObservationId: 'O1', date: '2026-09-19' }]) === true);
sprawdz('raport zawodnika z INNEJ obserwacji — nie, choć ta sama data',
  raportMeczuMaRaportyZawodnikow(MECZ, [{ playerId: 'Z7', fromObservationId: 'O2', date: '2026-09-19', match: 'Chojniczanka Chojnice - Olimpia Grudziądz' }]) === false);
sprawdz('bez obserwacji: ta sama data i mecz — tak',
  raportMeczuMaRaportyZawodnikow({ ...MECZ, fromObservationId: '' }, [{ playerId: 'Z7', date: '2026-09-19', match: 'chojniczanka chojnice – olimpia grudziądz' }]) === true);
sprawdz('raport z komputera: ta sama data i rywal z nazwy meczu — tak',
  raportMeczuMaRaportyZawodnikow({ ...MECZ, fromObservationId: '' }, [{ playerId: 'Z7', date: '2026-09-19', rywal: 'Olimpia Grudziądz (u siebie)' }]) === true);
sprawdz('ten sam rywal innego dnia — nie',
  raportMeczuMaRaportyZawodnikow({ ...MECZ, fromObservationId: '' }, [{ playerId: 'Z7', date: '2026-09-26', rywal: 'Olimpia Grudziądz' }]) === false);
sprawdz('raport zawodnika to nie raport meczu', raportMeczuMaRaportyZawodnikow({ playerId: 'Z1' }, [{ playerId: 'Z1' }]) === false);

console.log('\n3. Lista, licznik i numery');
const widok = wytnij('viewReports', /function viewReports\(\)\{[\s\S]*?\n\}/);
sprawdz('lista i licznik liczone z pokazanych raportów',
  /const widoczneRaporty = DB\.reports\.filter\(r=> czyRaportZawodnika\(r\) \|\| raportMeczuMaRaportyZawodnikow\(r, raportyZawodnikow\)\);/.test(widok)
  && /const allReports = widoczneRaporty\.slice\(\)/.test(widok) && widok.includes('<span class="reports-count">${allReports.length}</span>'));
sprawdz('numer porządkowy wśród pokazanych — bez dziur', /widoczneRaporty\.forEach\(\(r,i\)=> ordinalOf\[r\.id\] = i\+1\);/.test(widok) && !/DB\.reports\.forEach\(\(r,i\)=> ordinalOf/.test(widok));
{
  const reports = [
    { id: 'A', playerId: 'Z1', date: '2026-09-12' },
    MECZ,                                                     // bez raportu zawodnika — schowany
    { id: 'rep:O3:mecz', kind: 'mecz', match: 'Legia - Górnik', date: '2026-09-12', fromObservationId: 'O3' },
    { id: 'rep:O3:Z5', playerId: 'Z5', fromObservationId: 'O3', date: '2026-09-12' },
  ];
  const zawodnikow = reports.filter(czyRaportZawodnika);
  const widoczne = reports.filter(r => czyRaportZawodnika(r) || raportMeczuMaRaportyZawodnikow(r, zawodnikow));
  sprawdz('na liście: A, mecz Legia - Górnik (ma raport zawodnika), raport Z5; bez Chojniczanki',
    JSON.stringify(widoczne.map(r => r.id)) === JSON.stringify(['A', 'rep:O3:mecz', 'rep:O3:Z5']), JSON.stringify(widoczne.map(r => r.id)));
}

console.log('\n4. Klub przy zawodniku');
sprawdz('wiersz raportu zawodnika pokazuje herb i nazwę klubu',
  widok.includes("pl && pl.clubId ? `<span class=\"report-klub\">${crestImg(clubCrest(pl.clubId), 'xs', clubName(pl.clubId))}<span>${esc(clubName(pl.clubId))}</span></span>` : ''"));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
