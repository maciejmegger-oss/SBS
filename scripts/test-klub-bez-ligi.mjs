// Sprawdza „Sam klub, bez ligi" — zawodnik młodzieżowy przy klubie seniorskim (herb zostaje), ale bez
// wejścia na mapę i do rankingu ligi klubu. Na PRAWDZIWYM kodzie z src/main.ts.
// Zgłoszenie (13.09.2026): Sonak, rocznik 2011, w Zawiszy Bydgoszcz — nie może stać na mapie II ligi.
//
// Uruchomienie:  node scripts/test-klub-bez-ligi.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const magazyn = fs.readFileSync("src/data/storage.ts", "utf8");
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

console.log('\n1. Liga zawodnika');
{
  const kod = [
    wytnij('clubLeague', /function clubLeague\(id\)\{.*\}/),
    wytnij('ligaZawodnika', /function ligaZawodnika\(p\)\{.*\}/),
  ].join('\n');
  const DB = { clubs: [{ id: 'ZAW', name: 'Zawisza Bydgoszcz', league: 'II liga' }] };
  const { ligaZawodnika } = new Function('DB', `${kod}\n return { ligaZawodnika };`)(DB);
  sprawdz('zawodnik pierwszej drużyny — liga klubu', ligaZawodnika({ clubId: 'ZAW' }) === 'II liga');
  sprawdz('Sonak (sam klub, bez ligi) — bez ligi', ligaZawodnika({ clubId: 'ZAW', klubBezLigi: true }) === '');
  sprawdz('bez klubu — pusto, bez błędu', ligaZawodnika({}) === '' && ligaZawodnika(null) === '');
}

console.log('\n2. Mapy, rankingi i filtry liczą ligę ZAWODNIKA');
[
  ['mapa pozycji ligi', /\.filter\(p => ligaZawodnika\(p\)===league && /],
  ['ranking ligi', /DB\.players\.filter\(p => ligaZawodnika\(p\)===rankingLeague/],
  ['zaznaczeni z obserwacji na mapie ligi', /if\(ligaZawodnika\(kand\[0\]\) !== liga\) return;/],
  ['filtr ligi na liście Zawodników', /if\(playerFilters\.league\) list = list\.filter\(p=>ligaZawodnika\(p\)===playerFilters\.league\);/],
  ['porównanie na tle pozycji', /\? \(x\)=> ligaZawodnika\(x\) === liga\s*: \(x\)=> topLevelOf\(ligaZawodnika\(x\)\) === poziom;/],
  ['młodzieżowcy w lidze', /LIGI_Z_MLODZIEZOWCAMI\.has\(ligaZawodnika\(p\)\)/],
  ['minuty ważone poziomem', /wagaPoziomu\(ligaZawodnika\(p\)\)/],
].forEach(([opis, wzor]) => sprawdz(opis, wzor.test(zrodlo)));
sprawdz('żadne z tych miejsc nie bierze już ligi prosto z klubu',
  !/clubLeague\(p\.clubId\)===league|clubLeague\(p\.clubId\)===rankingLeague|clubLeague\(kand\[0\]\.clubId\) !== liga|topLevelOf\(clubLeague\(x\.clubId\)\)|wagaPoziomu\(clubLeague\(p\.clubId\)\)|LIGI_Z_MLODZIEZOWCAMI\.has\(clubLeague/.test(zrodlo));

console.log('\n3. Wybór klubu w profilu');
sprawdz('pole „Sam klub, bez ligi" w formularzu, zaznaczone dla zapisanego zawodnika', /id="pm-club-bez-ligi"[^>]*\$\{p && p\.klubBezLigi \? 'checked' : ''\}/.test(zrodlo));
sprawdz('lista klubów: herb przy nazwie i przycisk „sam klub"', /class="club-combo-herb">\$\{crestImg\(clubCrest\(c\.id\), 'xs', c\.name\)\}/.test(zrodlo) && zrodlo.includes('class="club-combo-sam"'));
sprawdz('kliknięcie „sam klub" zaznacza bez ligi, kliknięcie wiersza — z ligą',
  zrodlo.includes("const samKlub = !!(e.target as HTMLElement).closest('.club-combo-sam');")
  && zrodlo.includes('setClub(clubs.find(x=>x.id===(it as HTMLElement).dataset.id), samKlub);'));
sprawdz('wpisanie nazwy ręcznie nie przestawia zaznaczenia', /if\(bezLigiBox && bezLigi !== undefined\) bezLigiBox\.checked = !!bezLigi;/.test(zrodlo));
sprawdz('zapis: klubBezLigi tylko przy wybranym klubie', /klubBezLigi: !!document\.getElementById\('pm-club'\)\.value\s*&& !!\(\(document\.getElementById\('pm-club-bez-ligi'\)/.test(zrodlo));
sprawdz('pole zapisuje się bez migracji bazy (EXT_CONFIG zawodników)', /sbs_players:[\s\S]*?"klubBezLigi",[\s\S]*?\],/.test(magazyn));
sprawdz('styl wiersza z herbem i przyciskiem', style.includes('.club-combo-sam{') && style.includes('.club-combo-item{flex-direction:row;'));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
