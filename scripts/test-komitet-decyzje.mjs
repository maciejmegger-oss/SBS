// Sprawdza decyzję komitetu transferowego: te same decyzje co w protokole obserwacji — na PRAWDZIWYM
// kodzie z src/main.ts.
// Zgłoszenie (13.09.2026): w Komitecie „Zatwierdzony / Do dalszej analizy / Odrzucony przez komitet"
// zamiast „Do transferu / Do obserwacji / Testy / Odrzucony" jak w protokole.
//
// Uruchomienie:  node scripts/test-komitet-decyzje.mjs
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
  wytnij('REPORT_STATUS_OPTIONS', /const REPORT_STATUS_OPTIONS = \[[\s\S]*?\];/),
  wytnij('DAWNE_DECYZJE_KOMITETU', /const DAWNE_DECYZJE_KOMITETU = \{[\s\S]*?\};/),
  wytnij('decyzjaKomitetu', /function decyzjaKomitetu\(p\)\{[\s\S]*?\n\}/),
].join('\n');
const { REPORT_STATUS_OPTIONS, decyzjaKomitetu } = new Function(`${kod}\n return { REPORT_STATUS_OPTIONS, decyzjaKomitetu };`)();

console.log('\n1. Dawne decyzje pod nowymi nazwami');
[
  ['Zatwierdzony', 'Do transferu'],
  ['Do dalszej analizy', 'Do Obserwacji'],
  ['Odrzucony przez komitet', 'Odrzucony'],
  ['Do transferu', 'Do transferu'],
  ['Na Testy', 'Na Testy'],
  ['', ''],
].forEach(([dawna, nowa]) => sprawdz(`„${dawna || '(brak)'}" → „${nowa || '(Do rozpatrzenia)'}"`, decyzjaKomitetu({ committeeDecision: dawna }) === nowa, decyzjaKomitetu({ committeeDecision: dawna })));
sprawdz('zawodnik bez decyzji — bez błędu', decyzjaKomitetu({}) === '' && decyzjaKomitetu(null) === '');
sprawdz('każda dawna decyzja trafia w opcję z protokołu',
  ['Zatwierdzony', 'Do dalszej analizy', 'Odrzucony przez komitet'].every(d => REPORT_STATUS_OPTIONS.some(o => o.value === decyzjaKomitetu({ committeeDecision: d }))));

console.log('\n2. Lista w komitecie = decyzje z protokołu');
const lista = wytnij('lista decyzji komitetu', /<select class="committee-decision-select"[\s\S]*?<\/select>/);
sprawdz('opcje brane wprost z REPORT_STATUS_OPTIONS', /REPORT_STATUS_OPTIONS\.map\(o=>`<option value="\$\{esc\(o\.value\)\}" \$\{decyzjaKomitetu\(p\)===o\.value\?'selected':''\}>\$\{esc\(o\.label\)\}<\/option>`\)/.test(lista));
sprawdz('„Do rozpatrzenia" zostaje jako brak decyzji', /<option value="" \$\{!decyzjaKomitetu\(p\)\?'selected':''\}>Do rozpatrzenia<\/option>/.test(lista));
sprawdz('dawnych nazw nie ma już do wyboru', !/Zatwierdzony|Do dalszej analizy|Odrzucony przez komitet/.test(lista));
sprawdz('kolejność jak w protokole: Do transferu, Do obserwacji, Testy, Odrzucony',
  JSON.stringify(REPORT_STATUS_OPTIONS.map(o => o.label)) === JSON.stringify(['Do transferu', 'Do obserwacji', 'Testy', 'Odrzucony']), JSON.stringify(REPORT_STATUS_OPTIONS.map(o => o.label)));
sprawdz('pole zna swoją decyzję (kolor jak w protokole) i aktualizuje ją przy zmianie',
  lista.includes('data-decyzja="${esc(decyzjaKomitetu(p))}"') && /sel\.dataset\.decyzja = sel\.value;\s*\/\/[^\n]*\n\s*updateCommitteeField\(sel\.dataset\.id, 'committeeDecision', sel\.value\);/.test(zrodlo));

console.log('\n3. Zapis decyzji');
{
  const zapis = wytnij('updateCommitteeField', /async function updateCommitteeField\(playerId, field, value\)\{[\s\S]*?\n\}/);
  sprawdz('zmiana decyzji/notatki zapisuje tylko tego zawodnika', /const ok = await savePlayerOne\(p\);/.test(zapis) && !/savePlayers\(\)/.test(zapis.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')), zapis);
  sprawdz('nieudany zapis jest widoczny', /if\(ok === false\) pokazPotwierdzenie\('Nie udało się zapisać decyzji komitetu\./.test(zapis));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
