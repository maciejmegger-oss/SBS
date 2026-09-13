// Sprawdza kolejność klubów w zakładce Kluby: po wybraniu ligi — jak w aktualnej tabeli — na
// PRAWDZIWYM kodzie z src/main.ts.
// Zgłoszenie (14.09.2026): I liga stała alfabetycznie (Arka, Bruk-Bet, Chrobry…), a ma stać jak tabela.
//
// Uruchomienie:  node scripts/test-kluby-wg-tabeli.mjs
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
  wytnij('miejsceWTabeli', /function miejsceWTabeli\(klub\)\{[\s\S]*?\n\}/),
  wytnij('ulozWgTabeli', /function ulozWgTabeli\(kluby, miejsceKlubu\)\{[\s\S]*?\n\}/),
].join('\n');

// Tabela I ligi po 8. kolejce (fragment) — wiersze z miejscem, jak z 90minut.
const tabeleLig = {
  'I liga': { wiersze: [
    { miejsce: 1, nazwa: 'Pogoń Grodzisk Mazowiecki', punkty: 15 },
    { miejsce: 2, nazwa: 'ŁKS Łódź', punkty: 15 },
    { miejsce: 3, nazwa: 'Miedź Legnica', punkty: 14 },
    { miejsce: 4, nazwa: 'Chrobry Głogów', punkty: 12 },
    { miejsce: 5, nazwa: 'Arka Gdynia', punkty: 11 },
  ] },
  'III liga, gr. I': { wiersze: [{ nazwa: 'Wisła II Kraków' }, { nazwa: 'Hutnik Kraków' }] },   // bez numerów miejsc
};
const wierszZTabeli = (klub) => {
  const tab = tabeleLig[klub.league];
  return tab ? (tab.wiersze.find(w => w.nazwa === klub.nazwaWTabeli) || null) : null;
};
const { miejsceWTabeli, ulozWgTabeli } = new Function('wierszZTabeli', 'tabeleLig', `${kod}\n return { miejsceWTabeli, ulozWgTabeli };`)(wierszZTabeli, tabeleLig);

const klub = (id, name, league, nazwaWTabeli) => ({ id, name, league, nazwaWTabeli: nazwaWTabeli || name });

console.log('\n1. Miejsce w tabeli');
sprawdz('miejsce z wiersza tabeli', miejsceWTabeli(klub('A', 'Arka Gdynia', 'I liga')) === 5);
sprawdz('ŁKS zapisany w kartotece inaczej, ale dopasowany do wiersza', miejsceWTabeli(klub('L', 'ŁKS Łódź S.A.', 'I liga', 'ŁKS Łódź')) === 2);
sprawdz('wiersz bez numeru — miejsce z kolejności w tabeli', miejsceWTabeli(klub('H', 'Hutnik Kraków', 'III liga, gr. I')) === 2);
sprawdz('klub spoza tabeli — brak miejsca', miejsceWTabeli(klub('X', 'Stal Mielec', 'I liga')) === null);

console.log('\n2. Kolejność jak w tabeli');
{
  const kluby = [
    klub('A', 'Arka Gdynia', 'I liga'),
    klub('C', 'Chrobry Głogów', 'I liga'),
    klub('L', 'ŁKS Łódź S.A.', 'I liga', 'ŁKS Łódź'),
    klub('M', 'Miedź Legnica', 'I liga'),
    klub('P', 'Pogoń Grodzisk Mazowiecki', 'I liga'),
    klub('W', 'Warta Poznań', 'I liga'),          // bez wiersza w tabeli
    klub('B', 'Bruk-Bet Termalica Nieciecza', 'I liga'),   // bez wiersza w tabeli
  ];
  const ulozone = ulozWgTabeli(kluby, miejsceWTabeli).map(c => c.name);
  sprawdz('od lidera w dół, kluby bez miejsca na końcu alfabetycznie',
    JSON.stringify(ulozone) === JSON.stringify(['Pogoń Grodzisk Mazowiecki', 'ŁKS Łódź S.A.', 'Miedź Legnica', 'Chrobry Głogów', 'Arka Gdynia', 'Bruk-Bet Termalica Nieciecza', 'Warta Poznań']),
    JSON.stringify(ulozone));
  sprawdz('lista wejściowa nie zostaje przestawiona (kopia)', kluby[0].name === 'Arka Gdynia');
}
{
  const kluby = [
    klub('H', 'Hutnik Kraków', 'III liga, gr. I'),
    klub('A', 'Arka Gdynia', 'I liga'),
    klub('WK', 'Wisła II Kraków', 'III liga, gr. I'),
    klub('C', 'Chrobry Głogów', 'I liga'),
  ];
  const ulozone = ulozWgTabeli(kluby, miejsceWTabeli).map(c => c.name);
  sprawdz('kilka grup naraz — grupa po grupie, w każdej wg tabeli',
    JSON.stringify(ulozone) === JSON.stringify(['Chrobry Głogów', 'Arka Gdynia', 'Wisła II Kraków', 'Hutnik Kraków']), JSON.stringify(ulozone));
}
{
  const bezTabeli = [klub('Z', 'Zawisza', 'IV liga (x)'), klub('B', 'Błękitni', 'IV liga (x)')];
  sprawdz('liga bez pobranej tabeli — alfabetycznie', JSON.stringify(ulozWgTabeli(bezTabeli, miejsceWTabeli).map(c => c.name)) === JSON.stringify(['Błękitni', 'Zawisza']));
}

console.log('\n3. Podpięcie');
const widoczne = wytnij('widoczneKluby', /function widoczneKluby\(\)\{[\s\S]*?\n\}/);
sprawdz('po wybraniu ligi lista idzie przez ulozWgTabeli', /if\(clubBrowse\.top\) list = ulozWgTabeli\(list, miejsceWTabeli\);/.test(widoczne));
sprawdz('„Wszystkie" zostaje alfabetyczne (sortowanie wg tabeli tylko przy wybranej lidze)', /let list = DB\.clubs\.slice\(\)\.sort\(\(a,b\)=>\(a\.name\|\|''\)\.localeCompare\(b\.name\|\|'','pl'\)\);/.test(widoczne));

sprawdz('przy nazwie klubu numer miejsca — tylko po wybraniu ligi i gdy klub jest w tabeli',
  zrodlo.includes('const miejsce = clubBrowse.top ? miejsceWTabeli(c) : null;')
  && zrodlo.includes('return miejsce ? `<span class="klub-miejsce" title="Miejsce w tabeli po ostatniej kolejce"'));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
