// Sprawdza dopasowanie klubów ZAGRANICZNYCH do wyników Transfermarktu — na PRAWDZIWYM kodzie
// z src/main.ts (klubyToSamo + wybierzKlubTransfermarktu).
//
// Zgłoszenie (26.09.2026): w liście talentów przy „Werder Brema" i „RS Strasbourg" stała zastępka
// z inicjałami zamiast herbu. Serwis oddawał właściwy klub na pierwszym miejscu — odrzucał go nasz
// warunek zgodności nazwy: „brema" to nie „bremen", a „RS" to nie „RC".
//
// Uruchomienie:  node scripts/test-herby-zagraniczne.mjs
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
  wytnij('importNorm', /const importNorm = \(s\)=>[\s\S]*?;\r?\n/),
  wytnij('SZUM_NAZWY_KLUBU', /const SZUM_NAZWY_KLUBU = [^\n]*\n/),
  wytnij('NUMER_ZESPOLU', /const NUMER_ZESPOLU = \{[^\n]*\};/),
  wytnij('SKROTY_NAZWY', /const SKROTY_NAZWY = \{[\s\S]*?\n\};/),
  wytnij('rozwinSkroty', /const rozwinSkroty = [^\n]*\n/),
  wytnij('tenSamCzlon', /const tenSamCzlon = \(x, y\)=>\{[\s\S]*?\n\};/),
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/),
  wytnij('klubyToSamo', /function klubyToSamo\(a, b\)\{[\s\S]*?\n\}/),
  wytnij('wybierzKlubTransfermarktu', /function wybierzKlubTransfermarktu\(nazwa, kandydaci\)\{[\s\S]*?\n\}/),
].join('\n');
const { klubyToSamo, wybierzKlubTransfermarktu } = new Function(`${kod}
  return { klubyToSamo, wybierzKlubTransfermarktu };`)();

// Odpowiedzi serwisu spisane z /api/tm-kluby (26.09.2026), w tej samej kolejności.
const K = (nazwa, id) => ({ id, nazwa, herb: `https://tmssl.akamaized.net/images/wappen/head/${id}.png` });
const WERDER = [K('SV Werder Bremen', '86'), K('SV Werder Bremen II', '87'), K('SV Werder Bremen III', '8997'),
  K('SV Werder Bremen U19', '2491'), K('SV Werder Bremen U17', '21079')];
const STRASBOURG = [K('RC Strasbourg Alsace', '667'), K('Racing Strasbourg B', '7968'),
  K('FCO Strasbourg Koenigshoffen 06', '58264'), K('Racing Strasbourg U19', '11199'), K('Vauban Strasbourg', '5313')];

console.log('\n1. Polska nazwa miasta zagranicznego');
sprawdz('„Werder Brema" to ten sam klub co „SV Werder Bremen"', klubyToSamo('Werder Brema', 'SV Werder Bremen'));
sprawdz('herb trafia do pierwszej drużyny, nie do rezerw ani U19',
  wybierzKlubTransfermarktu('Werder Brema', WERDER)?.id === '86', JSON.stringify(wybierzKlubTransfermarktu('Werder Brema', WERDER)));
sprawdz('„Bayern Monachium" → „FC Bayern München"', klubyToSamo('Bayern Monachium', 'FC Bayern München'));
{
  // Numer zespołu rozstrzyga wybór herbu, nie samo porównanie nazw (klubyToSamo celowo go pomija —
  // „Lech" i „Lech II" to dla niego ta sama rodzina klubu, a herb mają wspólny).
  const BAYERN = [K('FC Bayern München II', '28'), K('FC Bayern München', '27'), K('FC Bayern München U19', '1445')];
  sprawdz('herb idzie do pierwszej drużyny, choć rezerwy stoją wyżej na liście',
    wybierzKlubTransfermarktu('Bayern Monachium', BAYERN)?.id === '27',
    JSON.stringify(wybierzKlubTransfermarktu('Bayern Monachium', BAYERN)));
}
sprawdz('„Benfica Lizbona" → „SL Benfica Lisboa"', klubyToSamo('Benfica Lizbona', 'SL Benfica Lisboa'));
sprawdz('„Sparta Praga" → „AC Sparta Praha"', klubyToSamo('Sparta Praga', 'AC Sparta Praha'));

console.log('\n2. Inny skrót przed tą samą nazwą');
sprawdz('„RS Strasbourg" to „RC Strasbourg Alsace"', klubyToSamo('RS Strasbourg', 'RC Strasbourg Alsace'));
sprawdz('wybiera pierwszą drużynę, nie U19 ani B',
  wybierzKlubTransfermarktu('RS Strasbourg', STRASBOURG)?.id === '667', JSON.stringify(wybierzKlubTransfermarktu('RS Strasbourg', STRASBOURG)));
sprawdz('pytanie o U19 dostaje U19',
  wybierzKlubTransfermarktu('RS Strasbourg U19', STRASBOURG)?.id === '11199');

console.log('\n3. Nadal nie zgadujemy tam, gdzie nie wolno');
sprawdz('dwa różne kluby z tego samego miasta zostają różne', !klubyToSamo('Legia Warszawa', 'Polonia Warszawa'));
sprawdz('„Widzew Łódź" to nie „Polonia Łódź"', !klubyToSamo('Widzew Łódź', 'Polonia Łódź'));
sprawdz('„Bayern Monachium" to nie „TSV 1860 Monachium"', !klubyToSamo('Bayern Monachium', 'TSV 1860 München'));
sprawdz('„Werder Brema" to nie „Werder Havel" (samo miasto musi się zgadzać)',
  !klubyToSamo('Werder Brema', 'FSV Werder Havel'));
// PSV, AIK, Ajax i im podobne nie są skrótami formy prawnej — zostają w rdzeniu nazwy.
sprawdz('PSV zostaje nazwą własną', klubyToSamo('PSV Eindhoven', 'PSV Eindhoven'));
sprawdz('AIK nie gubi nazwy', !klubyToSamo('AIK', 'IF Brommapojkarna'));
sprawdz('bez wspólnego członu nie ma dopasowania', !klubyToSamo('Werder Brema', 'Hamburger SV'));
sprawdz('polskie kluby dalej łączą się jak wcześniej',
  klubyToSamo('KS Cracovia', 'Cracovia Kraków') && klubyToSamo('MKS Limanovia w Limanowej', 'Limanovia Limanowa'));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
