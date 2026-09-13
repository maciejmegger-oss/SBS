// Sprawdza, że „Dodaj do bazy" NIE zdejmuje zawodnika z listy Talent, i przycisk „⭐ Dodaj do listy Talent"
// w profilu — na PRAWDZIWYM kodzie z src/main.ts.
// Zgłoszenie (13.09.2026): Bartosz Gaj po uzupełnieniu profilu zniknął z listy Talent.
//
// Uruchomienie:  node scripts/test-talent-zostaje-po-dodaniu.mjs
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
  wytnij('szukajNorm', /const szukajNorm = [\s\S]*?\.replace\(\/\\p\{M\}\/gu,''\);/),
  wytnij('nazwiskoNorm', /const nazwiskoNorm = .*;/),
  wytnij('talentPowiazanyZZawodnikiem', /function talentPowiazanyZZawodnikiem\(t, p\)\{[\s\S]*?\n\}/).replace('const zmiany: any = {};', 'const zmiany = {};'),
  wytnij('nowyTalentZZawodnika', /function nowyTalentZZawodnika\(p, noweId, dzis\)\{[\s\S]*?\n\}/),
  wytnij('talentZawodnika', /function talentZawodnika\(p\)\{[\s\S]*?\n\}/),
].join('\n');
const DB = { talents: [], clubs: [{ id: 'K1', name: 'KS Wda Świecie', league: 'IV liga (kujawsko-pomorska)' }] };
const api = new Function('DB', `${kod}\n return { talentPowiazanyZZawodnikiem, nowyTalentZZawodnika, talentZawodnika };`)(DB);

console.log('\n1. „Dodaj do bazy" — wpis Talentu zostaje i łączy się z profilem');
{
  const obsluga = wytnij('zapis profilu z talentu', /if\(promotingTalentId\)\{[\s\S]*?promotingTalentId = null;\s*\}/);
  sprawdz('zapis profilu NIE kasuje wpisu Talentu', !/deleteTalentRecord/.test(obsluga) && !/DB\.talents = DB\.talents\.filter/.test(obsluga), obsluga);
  sprawdz('wpis dostaje dane z zapisanego profilu i zapisuje się', /Object\.assign\(talent, talentPowiazanyZZawodnikiem\(talent, zapisany\)\);\s*const okTalent = await saveTalents\(\);/.test(obsluga));
  sprawdz('i przy nowym zawodniku, i przy edycji', obsluga.includes('const zapisany = edytowanyZawodnik || data;'));

  const gaj = { id: 'T1', firstName: 'Bartosz', lastName: 'Gaj', birthYear: null, club: 'Wda Świecie', pozycjeNmg: [7], confidence: 'import', dateAdded: '2026-05-01' };
  const profil = { id: 'Z9', firstName: 'Bartosz', lastName: 'Gaj', birthDate: '2007-05-01', clubId: 'K1', pozycjaNmg: 8, position: 'Pomocnik' };
  const zmiany = api.talentPowiazanyZZawodnikiem(gaj, profil);
  sprawdz('Gaj: rocznik z daty urodzenia i klub z profilu', zmiany.birthYear === 2007 && zmiany.club === 'KS Wda Świecie', JSON.stringify(zmiany));
  sprawdz('pozycja z listy talentów nie jest nadpisywana', !('pozycjeNmg' in zmiany) && !('pozycja' in zmiany), JSON.stringify(zmiany));
  sprawdz('kadra, źródło i data dodania zostają', !('reprezentacja' in zmiany) && !('confidence' in zmiany) && !('dateAdded' in zmiany) && !('id' in zmiany));
  const bezPozycji = api.talentPowiazanyZZawodnikiem({ firstName: 'Jan', lastName: 'Nowak' }, { firstName: 'Jan', lastName: 'Nowak', pozycjaNmg: 9 });
  sprawdz('wpis bez pozycji dostaje numer z profilu', JSON.stringify(bezPozycji.pozycjeNmg) === '[9]', JSON.stringify(bezPozycji));
}

console.log('\n2. „⭐ Dodaj do listy Talent" w profilu — tak wraca Gaj');
{
  const profil = { id: 'Z9', firstName: 'Bartosz', lastName: 'Gaj', birthYear: '2007', clubId: 'K1', pozycjaNmg: 8 };
  const t = api.nowyTalentZZawodnika(profil, 'T-NOWY', '2026-09-13');
  sprawdz('nowy wpis z kartoteki: imię, nazwisko, rocznik, klub, pozycja', t.id === 'T-NOWY' && t.firstName === 'Bartosz' && t.lastName === 'Gaj'
    && t.birthYear === 2007 && t.club === 'KS Wda Świecie' && JSON.stringify(t.pozycjeNmg) === '[8]' && t.dateAdded === '2026-09-13', JSON.stringify(t));
  sprawdz('źródło wpisu opisane', t.confidence === 'z kartoteki');
  DB.talents.push({ id: 'T2', firstName: 'Gaj', lastName: 'Bartosz' });
  sprawdz('zawodnik już na liście (także z imieniem i nazwiskiem odwrotnie) — rozpoznany', (api.talentZawodnika(profil) || {}).id === 'T2');
  sprawdz('zawodnika spoza listy nie ma', api.talentZawodnika({ firstName: 'Adam', lastName: 'Kowal' }) === null);
}

console.log('\n3. Podpięcie');
sprawdz('przycisk w profilu tylko, gdy zawodnika nie ma na liście', /\$\{talentZawodnika\(p\) \? '' : `<button class="secondary" data-action="dodaj-do-talentow"/.test(zrodlo));
sprawdz('kliknięcie dopisuje, a nieudany zapis cofa wpis',
  /querySelectorAll\('\[data-action="dodaj-do-talentow"\]'\)[\s\S]{0,500}DB\.talents\.push\(t\);\s*const ok = await saveTalents\(\);\s*if\(ok === false\)\{\s*DB\.talents = DB\.talents\.filter\(x=> x\.id !== t\.id\);/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
