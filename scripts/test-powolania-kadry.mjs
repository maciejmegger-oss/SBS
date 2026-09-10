// Sprawdza czytanie powołań do kadry narodowej — na PRAWDZIWYCH funkcjach z src/main.ts
// i na PRAWDZIWYM komunikacie PZPN (U-16, wrzesień 2026).
//
// Uruchomienie:  node scripts/test-powolania-kadry.mjs
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
  wytnij('kadraZTekstu', /function kadraZTekstu\(tekst\)\{[\s\S]*?\n\}/),
  wytnij('osobyZPowolaniaPzpn', /function osobyZPowolaniaPzpn\(tekst\)\{[\s\S]*?\n\}/),
].join('\n');
const f = new Function(`${kod}\n return { kadraZTekstu, osobyZPowolaniaPzpn };`);
const { kadraZTekstu, osobyZPowolaniaPzpn } = f();

// Komunikat przepisany 1:1 ze strony 90minut.pl — razem z terminami meczów w nawiasach.
const KOMUNIKAT = `U-16: Powołania na turniej towarzyski w Niemczech

Selekcjoner reprezentacji Polski do lat 16 Piotr Klepczarek powołał 22 zawodników na zgrupowanie, które odbędzie się w dniach 26 września - 4 października we Frankfurcie. Biało-czerwoni rozegrają podczas niego turniej towarzyski, w ramach którego zmierzą się z Niemcami (28 września, 11:00), Austrią (1 października, 15:00) i Grecją (4 października, 11:30).

Kadra:

Essam Abdelhamid (PSV Eindhoven, Holandia), Antoni Balcer (Talent Warszawa), Mateusz Borowiec (Śląsk Wrocław), Antoni Chojecki (Widzew Łódź), Julian Grzegorczyk (Lech Poznań), Mateusz Jadachowski (Zagłębie Lubin), Igor Kaczor (Górnik Zabrze), Wiktor Kożuchowski (Legia Warszawa), Michał Kucała (Legia Warszawa), Karol Kupczyk (Pogoń Szczecin), Kacper Kwiatkowski (Legia Warszawa), Cyprian Lipiński (Legia Warszawa), Natan Łukasiewicz (ŁKS Łódź), Antoni Miernik (Chelsea FC, Anglia), Ksawery Słota (Piast Gliwice), David Sulewski (FC Bayern München, Niemcy), Martin Szczerbiński (Lechia Gdańsk), Aleks Szybalski (Legia Warszawa), Piotr Tobór (Górnik Zabrze), Wiktor Waloch (Legia Warszawa), Patryk Wiśniak (Pogoń Szczecin), Marcel Zdybał (Lech Poznań).`;

const osoby = osobyZPowolaniaPzpn(KOMUNIKAT);
const nazwiska = osoby.map(o => o.lastName);

console.log('\n1. Komplet kadry — dokładnie tylu, ilu powołano');
console.log('   rozpoznano: ' + osoby.length);
sprawdz('22 zawodników, tak jak pisze komunikat', osoby.length === 22, String(osoby.length));

console.log('\n2. Terminy meczów NIE są zawodnikami');
sprawdz('nie ma „Niemcami"', !nazwiska.includes('Niemcami'), nazwiska.join(','));
sprawdz('nie ma „Austrią"', !nazwiska.includes('Austrią'));
sprawdz('nie ma „Grecją"', !nazwiska.includes('Grecją'));
sprawdz('żaden klub nie jest godziną', !osoby.some(o => /\d{1,2}:\d{2}/.test(o.club)),
  osoby.map(o => o.club).join(','));

console.log('\n3. Ogon zdania nie doklei się do imienia');
const pierwszy = osoby[0];
console.log('   pierwszy wpis: ' + JSON.stringify(pierwszy));
sprawdz('„Kadra:" nie weszło do imienia', pierwszy.firstName === 'Essam', pierwszy.firstName);
sprawdz('nazwisko poprawne', pierwszy.lastName === 'Abdelhamid', pierwszy.lastName);

console.log('\n4. Kluby zagraniczne z krajem, polskie bez');
const wg = (n) => osoby.find(o => o.lastName === n);
sprawdz('Abdelhamid → PSV Eindhoven, Holandia',
  wg('Abdelhamid').club === 'PSV Eindhoven' && wg('Abdelhamid').krajKlubu === 'Holandia',
  JSON.stringify(wg('Abdelhamid')));
sprawdz('Miernik → Chelsea FC, Anglia',
  wg('Miernik').club === 'Chelsea FC' && wg('Miernik').krajKlubu === 'Anglia', JSON.stringify(wg('Miernik')));
sprawdz('Sulewski → FC Bayern München, Niemcy',
  wg('Sulewski').club === 'FC Bayern München' && wg('Sulewski').krajKlubu === 'Niemcy', JSON.stringify(wg('Sulewski')));
sprawdz('Balcer → Talent Warszawa, BEZ dopisanego kraju',
  wg('Balcer').club === 'Talent Warszawa' && wg('Balcer').krajKlubu === '', JSON.stringify(wg('Balcer')));

console.log('\n5. Polskie znaki w nazwisku i w klubie');
sprawdz('Łukasiewicz rozpoznany', !!wg('Łukasiewicz'), nazwiska.join(','));
sprawdz('ŁKS Łódź jako klub', wg('Łukasiewicz').club === 'ŁKS Łódź', wg('Łukasiewicz').club);
sprawdz('Szczerbiński rozpoznany', !!wg('Szczerbiński'));

console.log('\n6. Kategoria wiekowa z nagłówka');
sprawdz('U-16 z „U-16:"', kadraZTekstu(KOMUNIKAT) === 'U-16', kadraZTekstu(KOMUNIKAT));
sprawdz('U-19 z „do lat 19", gdy nagłówka nie ma',
  kadraZTekstu('Selekcjoner reprezentacji Polski do lat 19 powołał') === 'U-19',
  kadraZTekstu('Selekcjoner reprezentacji Polski do lat 19 powołał'));
sprawdz('brak wskazania to pusty łańcuch, nie zgadywanie', kadraZTekstu('Powołania na mecz') === '');

console.log('\n7. Skopiowany skład ma w nawiasie NUMER — to nie są powołania');
const sklad = 'Jan Kowalski(8)-Wda Świecie, Piotr Nowak(11)-Wda Świecie, Adam Bąk(4)-Wda Świecie';
sprawdz('numer na koszulce nie robi z zawodnika powołanego', osobyZPowolaniaPzpn(sklad).length === 0,
  JSON.stringify(osobyZPowolaniaPzpn(sklad)));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
