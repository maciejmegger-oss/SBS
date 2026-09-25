// Sprawdza kolejność na liście „Radar młodzieży" — na PRAWDZIWYM kodzie sortowania z src/main.ts.
//
// Zgłoszenie (25.09.2026): na pierwszym ekranie stały same zera („w kadrze, bez minut"), a dalej
// rezerwowy z II ligi z dwiema minutami wyprzedzał bramkarza z III ligi z 450 minutami. Ma być
// odwrotnie: najpierw ci, którzy zagrali, od największej liczby minut, a wyższa liga rozstrzyga
// remisy.
//
// Uruchomienie:  node scripts/test-radar-kolejnosc.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

const wiersz = (zrodlo.match(/const RADAR_POZIOMY = \[[^\]]*\];/) || [])[0];
const sortowanie = (zrodlo.match(/nowi\.sort\(\(a,b\)=> \(b\.minuty > 0[\s\S]*?\);/) || [])[0];
if (!wiersz || !sortowanie) { console.error('Nie znalazłem sortowania radaru w src/main.ts.'); process.exit(1); }
const ulozNowych = new Function('nowi', `${wiersz}
  const kolejnosc = (poziom)=> RADAR_POZIOMY.indexOf(poziom);
  ${sortowanie}
  return nowi;`);

const z = (nazwisko, poziom, minuty, wystapien = 1) => ({
  p: { id: nazwisko, firstName: 'Jan', lastName: nazwisko }, poziom, minuty, wystapien,
  tylkoKadra: minuty === 0 && wystapien > 0,
});

console.log('\n1. Przypadek ze zgłoszenia');
{
  const lista = ulozNowych([
    z('Mostowski', 'III liga', 0),              // w kadrze, bez minut
    z('Broniewski', 'II liga', 2),
    z('Gumółka', 'II liga', 4),
    z('Kwiatkowski', 'III liga', 450, 5),
    z('Gaj', 'III liga', 367, 7),
    z('Wróbel', 'IV liga', 0),
    z('Perduta', 'I liga', 9),
  ]).map(x => x.p.lastName);
  sprawdz('pierwszy jest ten z największą liczbą minut', lista[0] === 'Kwiatkowski', lista.join(' → '));
  sprawdz('450 minut z III ligi przed 2 minutami z II ligi',
    lista.indexOf('Kwiatkowski') < lista.indexOf('Broniewski'), lista.join(' → '));
  sprawdz('zera schodzą na koniec, nie na górę',
    lista.indexOf('Mostowski') > lista.indexOf('Perduta') && lista.indexOf('Wróbel') > lista.indexOf('Perduta'),
    lista.join(' → '));
  sprawdz('cała kolejność wg minut',
    JSON.stringify(lista.slice(0, 5)) === JSON.stringify(['Kwiatkowski', 'Gaj', 'Perduta', 'Gumółka', 'Broniewski']),
    lista.join(' → '));
}

console.log('\n2. Remisy rozstrzyga poziom rozgrywek');
{
  const lista = ulozNowych([
    z('Czwartoligowiec', 'IV liga', 200),
    z('Ekstraklasowicz', 'Ekstraklasa', 200),
    z('Trzecioligowiec', 'III liga', 200),
    z('Clj', 'CLJ U19', 200),
  ]).map(x => x.p.lastName);
  sprawdz('przy równych minutach najwyższa liga pierwsza',
    JSON.stringify(lista) === JSON.stringify(['Ekstraklasowicz', 'Trzecioligowiec', 'Czwartoligowiec', 'Clj']), lista.join(' → '));
}

console.log('\n3. Sami „w kadrze, bez minut"');
{
  const lista = ulozNowych([
    z('Czwarta', 'IV liga', 0, 3),
    z('Ekstra', 'Ekstraklasa', 0, 1),
    z('Ekstra2', 'Ekstraklasa', 0, 4),
  ]).map(x => x.p.lastName);
  sprawdz('wyżej ten z wyższej ligi, a przy tej samej — częściej powoływany',
    JSON.stringify(lista) === JSON.stringify(['Ekstra2', 'Ekstra', 'Czwarta']), lista.join(' → '));
}

console.log('\n4. Kolejność jest jednoznaczna — dwa przerysowania dają to samo');
{
  const dane = () => [z('Kowalski', 'III liga', 90), z('Nowak', 'III liga', 90), z('Abacki', 'III liga', 90)];
  const raz = ulozNowych(dane()).map(x => x.p.lastName);
  const dwa = ulozNowych(dane().reverse()).map(x => x.p.lastName);
  sprawdz('przy wszystkim równym decyduje nazwisko, więc lista nie skacze',
    JSON.stringify(raz) === JSON.stringify(dwa) && raz[0] === 'Abacki', raz.join(' → ') + ' / ' + dwa.join(' → '));
}

console.log('\n5. Podpięcie');
sprawdz('podświetlenie ogranych zostaje przy 270 minutach', /const PROG_OGRANEGO = 270;/.test(zrodlo));
sprawdz('strzałka nadal wskazuje trzy najlepsze wyniki',
  /sort\(\(a,b\)=> b\.minuty - a\.minuty\)\.slice\(0, 3\)/.test(zrodlo));
sprawdz('„w kadrze, bez minut" dalej widoczne w kolumnie statusu', /⏳ w kadrze, bez minut/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
