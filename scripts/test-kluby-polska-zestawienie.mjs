// Sprawdza, czy zakładka „Kluby w Polsce" pokazuje KOMPLET klubów — arkusz, Twoje kontakty
// i kluby dopisane przy obserwacjach — i czy da się każdy wiersz poprawić.
//
// Zgłoszenie (28.09.2026): „te wszystkie kluby z zakładki Polska muszą być w zakładce Kluby
// w Polsce, w jednakowej strukturze, system ma dalej uzupełniać adresy przy obserwacji
// i automatycznie dodawać klub do listy, a przy wierszu ma być przycisk do edycji".
//
// Uruchomienie:  node scripts/test-kluby-polska-zestawienie.mjs
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
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/),
  wytnij('odciskKlubu', /const odciskKlubu = \(nazwa\)=>\{[\s\S]*?\};/),
  wytnij('zestawienieKlubowPL', /function zestawienieKlubowPL\(\)\{[\s\S]*?\n\}/),
].join('\n');

const zbuduj = (DB, ADRESY_KLUBOW) => new Function('DB', 'ADRESY_KLUBOW', 'contactClubName', 'contactAddress',
  `${kod}\n return zestawienieKlubowPL;`)(DB, ADRESY_KLUBOW,
  (c) => c.club || '', (c) => c.adresObiektu || '');

const ARKUSZ = [
  { liga: 'I liga', klub: 'Arka Gdynia', miasto: 'Gdynia', adres: 'Stadion Miejski, ul. Olimpijska 5, 81-538 Gdynia',
    email: '', zrodlo: 'https://arka.gdynia.pl', status: 'Częściowo', uwagi: 'e-mail do uzupełnienia' },
  { liga: 'II liga', klub: 'Zawisza Bydgoszcz', miasto: 'Bydgoszcz', adres: 'Stadion Miejski, ul. Gdańska 163',
    email: 'sekretariat@zawisza.bydgoszcz.pl', zrodlo: 'https://zawisza.pl', status: 'Zweryfikowany', uwagi: '' },
];

console.log('\n1. Komplet z trzech źródeł');
{
  const DB = {
    contacts: [
      { id: 'C1', club: 'Akademia Piątek', email: 'akademia.piatek@pomorski-zpn.pl', note: '' },
      { id: 'C2', club: 'KS Zawisza Bydgoszcz', email: 'inny@zawisza.pl', note: 'kontakt przez akademię' },
    ],
    clubs: [
      { id: 'K1', name: 'Zawisza Bydgoszcz', league: 'II liga', city: 'Bydgoszcz' },
      { id: 'K2', name: 'Wisła Nowe', league: 'IV liga (pomorska)', city: 'Nowe' },
    ],
    settings: { stadiumAddresses: { K2: 'Stadion Miejski, ul. Sportowa 1, 86-170 Nowe' } },
  };
  const lista = zbuduj(DB, ARKUSZ)();
  const nazwy = lista.map(w => w.klub);
  sprawdz('klub tylko z arkusza jest na liście', nazwy.includes('Arka Gdynia'), nazwy.join(' | '));
  sprawdz('klub tylko z kontaktów jest na liście (nie ma go w arkuszu)', nazwy.includes('Akademia Piątek'), nazwy.join(' | '));
  sprawdz('klub z kartoteki, z adresem z obserwacji, jest na liście', nazwy.includes('Wisła Nowe'), nazwy.join(' | '));
  sprawdz('ten sam klub z arkusza i z kontaktów to JEDEN wiersz („KS Zawisza" = „Zawisza")',
    lista.filter(w => /zawisza/i.test(w.klub)).length === 1, JSON.stringify(nazwy));
}

console.log('\n2. Twoja poprawka bierze górę nad arkuszem');
{
  const DB = {
    contacts: [{ id: 'C2', club: 'Zawisza Bydgoszcz', email: 'moj@zawisza.pl', adresObiektu: 'ul. Moja 1, Bydgoszcz', note: 'moja notatka' }],
    clubs: [], settings: {},
  };
  const w = zbuduj(DB, ARKUSZ)().find(x => /zawisza/i.test(x.klub));
  sprawdz('e-mail wpisany ręcznie zastępuje ten z arkusza', w.email === 'moj@zawisza.pl', w.email);
  sprawdz('adres wpisany ręcznie zastępuje ten z arkusza', w.adres === 'ul. Moja 1, Bydgoszcz', w.adres);
  sprawdz('status i źródło z arkusza zostają — wiadomo, skąd wiersz pochodzi',
    w.status === 'Zweryfikowany' && !!w.zrodlo, JSON.stringify({ s: w.status, z: w.zrodlo }));
  sprawdz('wiersz wie, że jest i w arkuszu, i w kontaktach',
    w.skad.includes('arkusz') && w.skad.includes('kontakty'), JSON.stringify(w.skad));
}

console.log('\n3. Adres z Planu Obserwacji');
{
  const DB = { contacts: [], clubs: [{ id: 'K9', name: 'Olimpia Grudziądz', league: 'II liga', city: 'Grudziądz' }],
    settings: { stadiumAddresses: { K9: 'Stadion przy ul. Piłsudskiego 14' } } };
  const w = zbuduj(DB, [])().find(x => /olimpia/i.test(x.klub));
  sprawdz('klub wchodzi na listę sam, z adresem z obserwacji', !!w && w.adres === 'Stadion przy ul. Piłsudskiego 14', JSON.stringify(w));
  sprawdz('widać, że adres pochodzi z obserwacji', w.skad.includes('obserwacje'), JSON.stringify(w.skad));
  sprawdz('liga i miasto z kartoteki', w.liga === 'II liga' && w.miasto === 'Grudziądz');
}

console.log('\n4. Podpięcie w zakładce');
sprawdz('lista w zakładce to zestawienie, nie sam arkusz', /const WSZYSTKIE = zestawienieKlubowPL\(\);/.test(zrodlo));
sprawdz('licznik na pigułce liczy komplet', /Kluby w Polsce \(\$\{zestawienieKlubowPL\(\)\.length\}\)/.test(zrodlo));
sprawdz('każdy wiersz ma przycisk edycji', /data-action="klub-pl-edytuj" data-klub="\$\{esc\(a\.klub\)\}"/.test(zrodlo));
sprawdz('edycja otwiera okno', /data-action="klub-pl-edytuj"[\s\S]{0,120}openKlubPLEdycja/.test(zrodlo));
sprawdz('adres zapisuje się przy klubie (stamtąd bierze go Plan Obserwacji)',
  /await setClubAddressByName\(wiersz\.klub, adres\);/.test(zrodlo));
sprawdz('e-mail i notatka lądują w Twojej bazie kontaktów', /await saveContacts\(\);/.test(zrodlo));
sprawdz('klub spoza kartoteki nie ginie po cichu — okno mówi, że adres nie ma się gdzie zapisać',
  /Tego klubu nie ma w kartotece, więc adres nie ma się gdzie zapisać/.test(zrodlo));
sprawdz('obserwacja nadal dopisuje klub i kontakt', /async function rememberStadiumAddress\(matchText, address\)/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
