// Sprawdza zapis raportu ze statusem i przyciski decyzji — na PRAWDZIWYM kodzie z src/main.ts
// i src/mobile/main.ts.
// Zgłoszenie (13.09.2026): edytowany raport Wojciecha Madeja ze statusem „Do transferu" nie dawał
// się zapisać — zapis statusu wysyłał całą kartotekę (ponad 14 tys. zawodników).
//
// Uruchomienie:  node scripts/test-zapis-raportu-status.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const mobilna = fs.readFileSync("src/mobile/main.ts", "latin1");   // plik ma bajt NUL — czytamy bajtowo
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};
const wytnij = (nazwa, wzor, tekst = zrodlo) => {
  const m = tekst.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

console.log('\n1. Zapis raportu nie wysyła całej kartoteki');
{
  // Bez linii komentarzy — komentarz przy poprawce opisuje dawne savePlayers() i nie jest wywołaniem.
  const obsluga = wytnij('obsługa „Zapisz raport"', /main\.querySelectorAll\('\[data-action="save-report"\]'\)[\s\S]*?\n  \}\);/)
    .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  sprawdz('status zapisuje tylko tego zawodnika (savePlayerOne)', /await savePlayerOne\(pl\)/.test(obsluga));
  sprawdz('żadnego savePlayers() w zapisie raportu', !/savePlayers\(\)/.test(obsluga));
  sprawdz('nieudany zapis statusu jest widoczny, a raport zostaje zapisany', /Raport zapisany, ale statusu zawodnika nie udało się zapisać/.test(obsluga));
  sprawdz('raport zapisuje się PRZED statusem', obsluga.indexOf('await saveReports()') < obsluga.indexOf('savePlayerOne(pl)'));
}
{
  const plan = wytnij('saveNewObservation', /async function saveNewObservation\(\)\{[\s\S]*?\n\}/);
  sprawdz('plan obserwacji: monitoring zawodnika bez zapisu całej kartoteki', /if\(playerChanged\) await savePlayerOne\(obsPlayer\);/.test(plan) && !/savePlayers\(\)/.test(plan));
}

console.log('\n2. Przyciski decyzji: Do transferu, Do obserwacji, Testy, Odrzucony');
const OCZEKIWANE = ['Do transferu', 'Do Obserwacji', 'Na Testy', 'Odrzucony'];
{
  const blok = wytnij('REPORT_STATUS_OPTIONS', /const REPORT_STATUS_OPTIONS = \[[\s\S]*?\];/);
  const wartosci = [...blok.matchAll(/value:'([^']+)'/g)].map(m => m[1]);
  sprawdz('komputer: kolejność i brak „Z polecenia"', JSON.stringify(wartosci) === JSON.stringify(OCZEKIWANE), JSON.stringify(wartosci));
}
{
  const blok = wytnij('STATUS_OPTIONS (telefon)', /const STATUS_OPTIONS = \[[\s\S]*?\];/, mobilna);
  const wartosci = [...Buffer.from(blok, 'latin1').toString('utf8').matchAll(/value: "([^"]+)"/g)].map(m => m[1]);
  sprawdz('telefon: ta sama kolejność i brak „Z polecenia"', JSON.stringify(wartosci) === JSON.stringify(OCZEKIWANE), JSON.stringify(wartosci));
}

console.log('\n3. „Z polecenia" nie wraca do wyboru, ale zawodnicy go nie tracą');
{
  const filtr = wytnij('filtr statusów przy starcie', /if\(Array\.isArray\(DB\.settings\.statuses\)\)\{\s*DB\.settings\.statuses = DB\.settings\.statuses\.filter\(s=> s !== 'Z polecenia'\);\s*\}/);
  const DB = { settings: { statuses: ['Do Obserwacji', 'Na Testy', 'Do transferu', 'Z polecenia', 'Rekomendowany', 'Odrzucony'] } };
  new Function('DB', filtr)(DB);
  sprawdz('lista statusów po starcie bez „Z polecenia"', !DB.settings.statuses.includes('Z polecenia') && DB.settings.statuses.length === 5, JSON.stringify(DB.settings.statuses));
  sprawdz('nie ma już dopisywania „Z polecenia" przy starcie', !/statuses\.splice\(idx, 0, 'Z polecenia'\)/.test(zrodlo));
  sprawdz('domyślne ustawienia bez „Z polecenia"', /statuses: \["Do Obserwacji","Na Testy","Do transferu","Rekomendowany","Odrzucony"\]/.test(zrodlo));
  sprawdz('zawodnik z dawnym „Z polecenia" dalej ma kolor statusu', /"Z polecenia":"reco"/.test(zrodlo));
  sprawdz('i dalej jest w Monitoringu', /const MONITORING_STATUSES = \[[^\]]*'Z polecenia'/.test(zrodlo));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
