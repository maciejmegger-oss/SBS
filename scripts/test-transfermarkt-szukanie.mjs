// Sprawdza szukanie zawodnika na Transfermarkcie — PRAWDZIWYM parserem z api/tm-szukaj.js
// i PRAWDZIWYM porównaniem klubów z src/main.ts.
//
// Wywołania do sieci robi tylko z flagą --sieć (żeby zwykły przebieg testów nie pukał do obcego
// serwisu). Bez niej sprawdza to, co da się sprawdzić bez internetu.
//
// Uruchomienie:  node scripts/test-transfermarkt-szukanie.mjs [--sieć]
import fs from "node:fs";

const zrodloApi = fs.readFileSync("api/tm-szukaj.js", "utf8");
const zrodloApp = fs.readFileSync("src/main.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};
const wytnij = (nazwa, wzor, tekst) => {
  const m = tekst.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

// PRAWDZIWY rozbiór strony wyników.
const kodApi = [
  wytnij('odsloniec', /const odsloniec = \(s\) =>[\s\S]*?\.trim\(\);/, zrodloApi),
  wytnij('parser', /  const kandydaci = new Map\(\);[\s\S]*?\.slice\(0, 10\);/, zrodloApi),
].join('\n');
const rozbierzWyniki = new Function('html', `${kodApi}\n return lista;`);

// PRAWDZIWE porównanie klubów z aplikacji.
const kodApp = [
  wytnij('importNorm', /const importNorm = [\s\S]*?\.replace\(\/\[\^a-z0-9\]\/g,''\);/, zrodloApp),
  wytnij('SZUM_NAZWY_KLUBU', /const SZUM_NAZWY_KLUBU = \/\^\([\s\S]*?\)\$\/;/, zrodloApp),
  wytnij('NUMER_ZESPOLU', /const NUMER_ZESPOLU = \{[\s\S]*?\};/, zrodloApp),
  wytnij('SKROTY_NAZWY', /const SKROTY_NAZWY = \{[\s\S]*?\};/, zrodloApp),
  wytnij('rozwinSkroty', /const rozwinSkroty = .*;/, zrodloApp),
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/, zrodloApp),
  wytnij('tenSamCzlon', /const tenSamCzlon = \(x, y\)=>\{[\s\S]*?\n\};/, zrodloApp),
  wytnij('klubyToSamo', /function klubyToSamo\(a, b\)\{[\s\S]*?\n\}/, zrodloApp),
].join('\n');
const { klubyToSamo } = new Function(`${kodApp}\n return { klubyToSamo };`)();

console.log('\n1. Porównanie klubu z powołania z klubem na Transfermarkcie');
// To NIE jest teoria: TM naprawdę pisze „ŁKS Łódź Młodzież" tam, gdzie PZPN pisze „ŁKS Łódź".
sprawdz('„ŁKS Łódź" = „ŁKS Łódź Młodzież" (dopisek drużyny)', klubyToSamo('ŁKS Łódź', 'ŁKS Łódź Młodzież'));
sprawdz('„Legia Warszawa" = „Legia Warszawa U19"', klubyToSamo('Legia Warszawa', 'Legia Warszawa U19'));
sprawdz('„Chelsea FC" = „Chelsea U18"', klubyToSamo('Chelsea FC', 'Chelsea U18'));
// A to jest granica: różne kluby muszą zostać różne, inaczej automat wpisze cudze dane.
sprawdz('„Legia Warszawa" ≠ „Lech Poznań"', !klubyToSamo('Legia Warszawa', 'Lech Poznań'));
sprawdz('„Pogoń Szczecin" ≠ „Pogoń Grodzisk Mazowiecki"', !klubyToSamo('Pogoń Szczecin', 'Pogoń Grodzisk Mazowiecki'));
sprawdz('„Górnik Zabrze" ≠ „Górnik Łęczna"', !klubyToSamo('Górnik Zabrze', 'Górnik Łęczna'));
sprawdz('pusta nazwa nie pasuje do niczego', !klubyToSamo('', 'Legia Warszawa'));

console.log('\n2. Rozbiór strony wyników — na zapisanym kształcie odpowiedzi');
const PRZYKLAD = `
 <a href="/natan-lukasiewicz/profil/spieler/1583763"><img src="x.png"></a>
 <a href="/natan-lukasiewicz/profil/spieler/1583763" title="Natan Łukasiewicz">Natan Łukasiewicz</a>
 <a href="/legia-warszawa/startseite/verein/255">Legia Warszawa</a>
 <a href="/mateusz-kowalski/profil/spieler/69234">Mateusz Kowalski</a>`;
const wynik = rozbierzWyniki(PRZYKLAD);
console.log('   ' + wynik.map(k => k.nazwa + ' → ' + k.url).join('\n   '));
sprawdz('ten sam profil w dwóch linkach liczy się RAZ', wynik.filter(k => k.id === '1583763').length === 1,
  JSON.stringify(wynik));
sprawdz('link do klubu nie jest zawodnikiem', !wynik.some(k => /verein/.test(k.url)), JSON.stringify(wynik));
sprawdz('adres jest pełny, nie względny', wynik.every(k => k.url.startsWith('https://www.transfermarkt.pl/')));
sprawdz('nazwa odczytana z linku z tekstem', wynik.some(k => k.nazwa === 'Natan Łukasiewicz'), JSON.stringify(wynik));

if (process.argv.includes('--sieć')) {
  console.log('\n3. Żywy Transfermarkt — powołani z kadry U-16');
  const NAGLOWKI = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Accept-Language": "pl-PL,pl;q=0.9", "Accept": "text/html,application/xhtml+xml",
  };
  for (const kto of ['Natan Łukasiewicz', 'Antoni Miernik', 'David Sulewski', 'Essam Abdelhamid']) {
    const odp = await fetch('https://www.transfermarkt.pl/schnellsuche/ergebnis/schnellsuche?query=' + encodeURIComponent(kto), { headers: NAGLOWKI });
    const lista = rozbierzWyniki(await odp.text());
    console.log(`   ${kto}: ${lista.length} kandydat(ów)` + (lista[0] ? ' → ' + lista[0].url : ''));
    sprawdz(`${kto} — dokładnie jeden kandydat, więc automat może uzupełnić`, lista.length === 1, String(lista.length));
  }
} else {
  console.log('\n3. Żywy Transfermarkt — pominięte (uruchom z --sieć, żeby odpytać serwis)');
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
