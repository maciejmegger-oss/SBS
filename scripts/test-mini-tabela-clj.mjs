// Sprawdza, że karta klubu CLJ znajduje adresy swojej tabeli na 90minut — i że są to TE SAME
// adresy, z których pobiera serwer. Na PRAWDZIWYM kodzie z src/main.ts i api/_90minut.js.
//
// Uruchomienie:  node scripts/test-mini-tabela-clj.mjs
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const { ZRODLA_LIG } = await import(pathToFileURL(process.cwd() + "/api/_90minut.js").href);
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
  wytnij('topLevelOf', /function topLevelOf\(league\)\{[\s\S]*?\n\}/),
  wytnij('poziomGrupy', /function poziomGrupy\(nazwaGrupy\)\{[\s\S]*?\n\}/),
  wytnij('SCHEDULE_SOURCES', /const SCHEDULE_SOURCES = \{[\s\S]*?\n\};/),
  wytnij('scheduleUrlsFor', /function scheduleUrlsFor\(league\)\{[\s\S]*?\n\}/),
  // Wybór adresów w karcie klubu — dokładnie te linijki, które stoją w miniTabelaKlubuHtml.
  `function ligaDlaKarty(etykieta){\n${wytnij('wybór ligi w karcie klubu', /  const poziomTejGrupy = poziomGrupy\(etykieta\);[\s\S]*?: topLevelOf\(etykieta\);/)}\n return liga; }`,
].join('\n');
const DB = { settings: {} };
const api = new Function('DB', `${kod}\n return { SCHEDULE_SOURCES, scheduleUrlsFor, ligaDlaKarty };`)(DB);

console.log('\n1. Karta klubu CLJ znajduje adresy');
[
  ['CLJ U17 gr. I', 'CLJ U17', 2],
  ['CLJ U17 gr. II', 'CLJ U17', 2],
  ['CLJ U19', 'CLJ U19', 1],
].forEach(([grupa, oczekiwanaLiga, ileAdresow]) => {
  const liga = api.ligaDlaKarty(grupa);
  const adresy = api.scheduleUrlsFor(liga);
  sprawdz(`„${grupa}" → ${oczekiwanaLiga} (${ileAdresow} ${ileAdresow === 1 ? 'adres' : 'adresy'})`,
    liga === oczekiwanaLiga && adresy.length === ileAdresow, `${liga}: ${adresy.length}`);
});

console.log('\n2. Seniorzy bez zmian');
sprawdz('„III liga, gr. II" → III liga', api.ligaDlaKarty('III liga, gr. II') === 'III liga');
sprawdz('„Ekstraklasa" → Ekstraklasa', api.ligaDlaKarty('Ekstraklasa') === 'Ekstraklasa');
sprawdz('„IV liga (śląska)" → IV liga', api.ligaDlaKarty('IV liga (śląska)') === 'IV liga');

console.log('\n3. Adresy w karcie klubu = adresy, z których pobiera serwer');
['CLJ U19', 'CLJ U17'].forEach(k => {
  const przegladarka = JSON.stringify(api.SCHEDULE_SOURCES[k] || []);
  const serwer = JSON.stringify(ZRODLA_LIG[k] || []);
  sprawdz(`${k}: te same adresy po obu stronach`, przegladarka === serwer && przegladarka !== '[]', `karta ${przegladarka} / serwer ${serwer}`);
});

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
