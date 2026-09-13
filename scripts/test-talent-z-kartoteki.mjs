// Sprawdza uzupełnianie talentów z kartoteki zawodników i herby klubów spoza kartoteki — na
// PRAWDZIWYCH funkcjach z src/main.ts i PRAWDZIWYM api/tm-kluby.js.
// Zgłoszenie (13.09.2026): talenty bez rocznika i klubu, choć w Zawodnikach mają komplet danych
// (Antczak, Kotras z Lecha); kluby spoza bazy (PSV Eindhoven) bez herbu.
//
// Uruchomienie:  node scripts/test-talent-z-kartoteki.mjs
import fs from "node:fs";
import { pathToFileURL } from "node:url";

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
  wytnij('SZUM_NAZWY_KLUBU', /const SZUM_NAZWY_KLUBU = \/\^\([\s\S]*?\)\$\/;/),
  wytnij('NUMER_ZESPOLU', /const NUMER_ZESPOLU = \{[\s\S]*?\};/),
  wytnij('SKROTY_NAZWY', /const SKROTY_NAZWY = \{[\s\S]*?\};/),
  wytnij('rozwinSkroty', /const rozwinSkroty = .*;/),
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/),
  wytnij('tenSamCzlon', /const tenSamCzlon = \(x, y\)=>\{[\s\S]*?\n\};/),
  wytnij('klubyToSamo', /function klubyToSamo\(a, b\)\{[\s\S]*?\n\}/),
  wytnij('szukajNorm', /const szukajNorm = [\s\S]*?\.replace\(\/\\p\{M\}\/gu,''\);/),
  wytnij('nazwiskoNorm', /const nazwiskoNorm = .*;/),
  wytnij('clubName', /function clubName\(id\)\{.*\}/),
  wytnij('indeksZawodnikowPoNazwisku', /function indeksZawodnikowPoNazwisku\(\)\{[\s\S]*?\n\}/),
  wytnij('kartotekaDlaTalentu', /function kartotekaDlaTalentu\(t, klub, poNazwisku\)\{[\s\S]*?\n\}/),
  wytnij('uzupelnienieTalentuZKartoteki', /function uzupelnienieTalentuZKartoteki\(t, p\)\{[\s\S]*?\n\}/)
    .replace('const zmiany: any = {};', 'const zmiany = {};'),
  wytnij('kluczHerbuZewn', /const kluczHerbuZewn = .*;/),
  wytnij('wybierzKlubTransfermarktu', /function wybierzKlubTransfermarktu\(nazwa, kandydaci\)\{[\s\S]*?\n\}/),
].join('\n');
const DB = { players: [], clubs: [] };
const api = new Function('DB', `${kod}\n return { indeksZawodnikowPoNazwisku, kartotekaDlaTalentu, uzupelnienieTalentuZKartoteki, wybierzKlubTransfermarktu, kluczHerbuZewn };`)(DB);

DB.clubs.push(
  { id: 'K1', name: 'KKS Lech Poznań', league: 'Ekstraklasa' },
  { id: 'K2', name: 'KKS Lech II Poznań', league: 'III liga, gr. II' },
  { id: 'K3', name: 'Warta Poznań', league: 'I liga' },
  { id: 'K4', name: 'Zawisza Bydgoszcz', league: 'II liga' },
);
DB.players.push(
  { id: 'P1', firstName: 'Jakub', lastName: 'Antczak', clubId: 'K1', birthYear: '2008', pozycjaNmg: 11 },
  { id: 'P2', firstName: 'Bartosz', lastName: 'Kotras', clubId: 'K1', birthYear: '2008', pozycjaNmg: 5, position: 'Obrońca' },
  { id: 'P3', firstName: 'Franciszek', lastName: 'Szmyt', clubId: 'K4', birthDate: '2010-03-14', position: 'Skrzydłowy' },
  { id: 'P4', firstName: 'Jan', lastName: 'Kowalski', clubId: 'K3', birthYear: '2011' },
  { id: 'P5', firstName: 'Jan', lastName: 'Kowalski', clubId: 'K4', birthYear: '2012' },
);
const indeks = api.indeksZawodnikowPoNazwisku();
const klubK = (id) => DB.clubs.find(c => c.id === id);

console.log('\n1. Talent znajduje swoją kartotekę');
{
  const antczak = { firstName: 'Jakub', lastName: 'Antczak', club: 'KKS Lech II Poznań' };
  sprawdz('Antczak z „Lech II" to Antczak z kartoteki Lecha (ta sama rodzina klubu)', (api.kartotekaDlaTalentu(antczak, klubK('K2'), indeks) || {}).id === 'P1');
  const kotras = { firstName: 'Bartosz', lastName: 'Kotras', club: '' };
  sprawdz('Kotras bez klubu — jedyny taki w kartotece', (api.kartotekaDlaTalentu(kotras, null, indeks) || {}).id === 'P2');
  const szmyt = { firstName: 'Szmyt', lastName: 'Franciszek', club: 'Zawisza Bydgoszcz' };
  sprawdz('imię i nazwisko zapisane odwrotnie — też znaleziony', (api.kartotekaDlaTalentu(szmyt, klubK('K4'), indeks) || {}).id === 'P3');
}
{
  const kowalskiBez = { firstName: 'Jan', lastName: 'Kowalski', club: '' };
  sprawdz('dwóch Kowalskich, bez klubu i rocznika — NIE zgadujemy', api.kartotekaDlaTalentu(kowalskiBez, null, indeks) === null);
  sprawdz('dwóch Kowalskich — rocznik rozstrzyga', (api.kartotekaDlaTalentu({ ...kowalskiBez, birthYear: 2012 }, null, indeks) || {}).id === 'P5');
  const imiennik = { firstName: 'Jakub', lastName: 'Antczak', club: 'Warta Poznań' };
  sprawdz('imiennik z innego klubu (Warta ≠ Lech) — nie ten zawodnik', api.kartotekaDlaTalentu(imiennik, klubK('K3'), indeks) === null);
  sprawdz('…chyba że zgadza się rocznik', (api.kartotekaDlaTalentu({ ...imiennik, birthYear: 2008 }, klubK('K3'), indeks) || {}).id === 'P1');
  sprawdz('nieznane nazwisko — brak kartoteki', api.kartotekaDlaTalentu({ firstName: 'Zenon', lastName: 'Nieznany', club: '' }, null, indeks) === null);
}

console.log('\n2. Uzupełnianie — tylko puste pola');
{
  const z = api.uzupelnienieTalentuZKartoteki({ firstName: 'Bartosz', lastName: 'Kotras', club: '' }, DB.players[1]);
  sprawdz('Kotras dostaje rocznik, klub i pozycję z numeru', z && z.birthYear === 2008 && z.club === 'KKS Lech Poznań' && JSON.stringify(z.pozycjeNmg) === '[5]', JSON.stringify(z));
  const zAntczak = api.uzupelnienieTalentuZKartoteki({ firstName: 'Jakub', lastName: 'Antczak', club: 'KKS Lech II Poznań', pozycjeNmg: [11] }, DB.players[0]);
  sprawdz('Antczak: rocznik dochodzi, wpisany klub i pozycja zostają', zAntczak && zAntczak.birthYear === 2008 && !('club' in zAntczak) && !('pozycjeNmg' in zAntczak), JSON.stringify(zAntczak));
  const zSzmyt = api.uzupelnienieTalentuZKartoteki({ firstName: 'Szmyt', lastName: 'Franciszek', club: 'Zawisza Bydgoszcz' }, DB.players[2]);
  sprawdz('Szmyt: imię i nazwisko poprawione, rocznik z daty urodzenia, pozycja opisowa', zSzmyt && zSzmyt.firstName === 'Franciszek' && zSzmyt.lastName === 'Szmyt' && zSzmyt.birthYear === 2010 && zSzmyt.pozycja === 'Skrzydłowy', JSON.stringify(zSzmyt));
  const pelny = { firstName: 'Bartosz', lastName: 'Kotras', club: 'KS Wda Świecie', birthYear: 2007, pozycjeNmg: [6] };
  sprawdz('talent z kompletem danych — nic nie nadpisujemy', api.uzupelnienieTalentuZKartoteki(pelny, DB.players[1]) === null);
  sprawdz('bez kartoteki — nic', api.uzupelnienieTalentuZKartoteki(pelny, null) === null);
}

console.log('\n3. Herby spoza kartoteki — wybór klubu z Transfermarktu');
{
  const { klubyZWynikow, adresHerbu } = await import(pathToFileURL(process.cwd() + "/api/tm-kluby.js").href);
  const html = `
    <a title="PSV Eindhoven" href="/psv-eindhoven/startseite/verein/383"><img src="https://img.a.transfermarkt.technology/wappen/small/383.png"></a>
    <a title="PSV Eindhoven" href="/psv-eindhoven/startseite/verein/383">PSV Eindhoven</a>
    <a href="/psv-eindhoven-ii/startseite/verein/9715">PSV Eindhoven U21</a>
    <a href="/psv-eindhoven-u19/startseite/verein/4575">PSV Eindhoven U19</a>
    <a href="/legia-warschau/startseite/verein/255">Legia Warszawa</a>`;
  const kandydaci = klubyZWynikow(html);
  sprawdz('serwer czyta kluby z wyników (bez powtórek, z nazwą)', kandydaci.length === 4 && kandydaci[0].id === '383' && kandydaci[0].nazwa === 'PSV Eindhoven', JSON.stringify(kandydaci));
  sprawdz('adres herbu z identyfikatora', adresHerbu('383') === 'https://tmssl.akamaized.net/images/wappen/head/383.png');
  sprawdz('„PSV Eindhoven" → pierwsza drużyna, nie U19', (api.wybierzKlubTransfermarktu('PSV Eindhoven', kandydaci) || {}).id === '383');
  sprawdz('„PSV Eindhoven U19" → drużyna U19', (api.wybierzKlubTransfermarktu('PSV Eindhoven U19', kandydaci) || {}).id === '4575');
  sprawdz('„Talent Warszawa" nie dostaje herbu Legii', api.wybierzKlubTransfermarktu('Talent Warszawa', kandydaci) === null);
  sprawdz('pusta lista — brak herbu', api.wybierzKlubTransfermarktu('PSV Eindhoven', []) === null);
  sprawdz('klucz herbu bez drugiej nazwy po „ / "', api.kluczHerbuZewn('Legia Chełmża / GOL Chełmża') === api.kluczHerbuZewn('Legia Chełmża'));
  // Serwer z podstawionym Transfermarktem.
  const { default: handler } = await import(pathToFileURL(process.cwd() + "/api/tm-kluby.js").href);
  const oryginalny = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => html });
  let status = 0, cialo = null;
  const res = { setHeader() {}, status(k) { status = k; return this; }, json(d) { cialo = d; return this; } };
  await handler({ query: { klub: 'PSV Eindhoven' } }, res);
  sprawdz('punkt /api/tm-kluby oddaje kandydatów z herbami', status === 200 && cialo.ilu === 4 && cialo.kandydaci[0].herb.endsWith('/383.png'), JSON.stringify(cialo));
  await handler({ query: { klub: 'PS' } }, res);
  sprawdz('za krótka nazwa — 400', status === 400);
  globalThis.fetch = oryginalny;
}

console.log('\n4. Podpięcie');
sprawdz('widok Talentów korzysta z kartotekaDlaTalentu', zrodlo.includes('const kartotekaTalentu = (t, klub)=> kartotekaDlaTalentu(t, klub, zawodnicyPoNazwisku);'));
sprawdz('przy starcie: uzupełnianie z kartoteki tylko przy pełnym wczytaniu, jeden zapis',
  /if\(wolnoUzupelniac\)\{\s*const poNazwisku = indeksZawodnikowPoNazwisku\(\);[\s\S]{0,700}if\(uzupelnionych\)\{\s*const ok = await saveTalents\(\);/.test(zrodlo));
sprawdz('uzupełnianie PO porządkowaniu wpisów', zrodlo.indexOf('const doRozdzielenia = wpisyDoAutoPorzadku(DB.talents);') < zrodlo.indexOf('const poNazwisku = indeksZawodnikowPoNazwisku();'));
sprawdz('wiersz talentu: herb z kartoteki albo z Transfermarktu', /crestImg\(herbKartoteki \|\| herbZewnetrzny\(nazwaKlubu\), null, nazwaKlubu\)/.test(zrodlo) && zrodlo.includes('data-herb-klub='));
sprawdz('herby dociągane po narysowaniu, bez przerysowania strony', zrodlo.includes('if(potrzebneHerby.length) setTimeout(()=> void dociagnijHerbyZewnetrzne(potrzebneHerby), 0);') && !/async function dociagnijHerbyZewnetrzne[\s\S]*?\n\}/.exec(zrodlo)[0].includes('render()'));
sprawdz('błąd serwisu nie zapisuje „brak herbu" na stałe', /if\(!odp\.ok\)\{ herbyZewnNieudane\.add\(k\); return; \}/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
