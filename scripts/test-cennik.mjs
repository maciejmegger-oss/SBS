// Cennik pakietów — na PRAWDZIWYCH funkcjach z src/site/cennik.ts.
//
// Test pilnuje trzech rzeczy, na których stoi cała konstrukcja cennika:
//   1. KRÓTSZY OKRES MUSI WYCHODZIĆ DROŻEJ w przeliczeniu na miesiąc. To nie jest szczegół,
//      tylko zabezpieczenie: okno transferowe trwa mniej więcej kwartał, więc kwartał w cenie
//      jednej czwartej rocznego byłby zaproszeniem do wykupienia dostępu na jedno okno,
//      przerobienia bazy i zniknięcia do stycznia.
//   2. Zapis kwoty jest jednolity. „4800 zł" obok „18 000 zł" w jednej tabeli wygląda na
//      pomyłkę — a polska lokalizacja domyślnie NIE rozdziela liczb czterocyfrowych.
//   3. Waluta idzie za językiem, bo to dwa osobne rynki i dwa osobne cenniki.
//
// Uruchomienie:  node scripts/test-cennik.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const zrodlo = fs.readFileSync("src/site/cennik.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + JSON.stringify(dodatek)}`);
  if (!warunek) bledy++;
};

// Cały plik da się wykonać wprost — nie importuje niczego z zewnątrz.
const kod = transformSync(zrodlo.replace(/export /g, ''), { loader: 'ts' }).code;
const { CENY, MNOZNIKI, policzCene, walutaDlaJezyka, nazwaOkresu } =
  new Function(`${kod}\n return { CENY, MNOZNIKI, policzCene, walutaDlaJezyka, nazwaOkresu };`)();

const liczba = (s) => Number(String(s).replace(/[^\d]/g, ''));

console.log('\n1. Sezon po polsku');
{
  sprawdz('Premium 18 000 zł', policzCene('Premium', 'sezon', 'pl').glowna === '18 000 zł',
    policzCene('Premium', 'sezon', 'pl'));
  // Tu siedział prawdziwy błąd: pl-PL domyślnie zapisuje 4800 bez odstępu.
  sprawdz('czterocyfrowa kwota też z odstępem', policzCene('Ekstraklasa', 'sezon', 'pl').glowna === '4 800 zł',
    policzCene('Ekstraklasa', 'sezon', 'pl'));
  sprawdz('odstęp jest niełamliwy', !/ /.test(policzCene('Ekstraklasa', 'sezon', 'pl').glowna));
  sprawdz('przelicznik miesięczny', policzCene('Premium', 'sezon', 'pl').miesiecznie === '1 500 zł / mies.',
    policzCene('Premium', 'sezon', 'pl'));
}

console.log('\n2. Krótszy okres kosztuje więcej na miesiąc — sedno całego cennika');
for (const pakiet of Object.keys(CENY)) {
  const mies = (o) => liczba(policzCene(pakiet, o, 'pl').miesiecznie);
  const rosnie = mies('sezon') < mies('polrocze') && mies('polrocze') < mies('kwartal');
  sprawdz(`${pakiet}: sezon ${mies('sezon')} < półrocze ${mies('polrocze')} < kwartał ${mies('kwartal')}`, rosnie);
}
{
  // Cztery kwartały mają kosztować wyraźnie więcej niż rok, inaczej nikt nie kupi sezonu.
  sprawdz('4 kwartały = 160% ceny rocznej', Math.abs(MNOZNIKI.kwartal * 4 - 1.6) < 1e-9, MNOZNIKI);
  sprawdz('2 półrocza = 120% ceny rocznej', Math.abs(MNOZNIKI.polrocze * 2 - 1.2) < 1e-9, MNOZNIKI);
}

console.log('\n3. Struktura cennika');
{
  const pln = (p) => CENY[p].pln;
  // Roczniki i CLJ to jedyne dane, których nie ma żaden serwis komercyjny — tam stoi przewaga,
  // więc tam ma stać najwyższa cena spośród pojedynczych pakietów.
  const pojedyncze = Object.keys(CENY).filter((p) => p !== 'Premium');
  const najdrozszy = pojedyncze.sort((a, b) => pln(b) - pln(a))[0];
  sprawdz('najdroższy pojedynczy pakiet to kategorie juniorskie', najdrozszy === 'Kategorie juniorskie', najdrozszy);
  const suma = pojedyncze.reduce((s, p) => s + pln(p), 0);
  sprawdz(`Premium tańsze niż wszystkie osobno (${pln('Premium')} < ${suma})`, pln('Premium') < suma);
  const rabat = Math.round((1 - pln('Premium') / suma) * 100);
  sprawdz(`rabat na Premium między 20% a 40% (jest ${rabat}%)`, rabat >= 20 && rabat <= 40);
}

console.log('\n4. Dwa rynki, dwie waluty');
{
  sprawdz('polski czyta złote', walutaDlaJezyka('pl') === 'pln');
  sprawdz('angielski czyta euro', walutaDlaJezyka('en') === 'eur');
  sprawdz('niemiecki czyta euro', walutaDlaJezyka('de') === 'eur');
  sprawdz('po niemiecku kwota w euro', /€/.test(policzCene('Premium', 'sezon', 'de').glowna),
    policzCene('Premium', 'sezon', 'de'));
  sprawdz('niemiecki zapis tysięcy kropką', policzCene('Premium', 'sezon', 'de').glowna === '5.900 €',
    policzCene('Premium', 'sezon', 'de'));
  // Cena zagraniczna ma być wyższa, bo tam nie ma alternatywy dla tych danych.
  const plnNaEur = CENY.Premium.pln / 4.3;
  sprawdz(`Premium w euro drożej niż przeliczone złote (${CENY.Premium.eur} > ${Math.round(plnNaEur)})`,
    CENY.Premium.eur > plnNaEur);
}

console.log('\n5. Nazwy okresów i braki w cenniku');
{
  sprawdz('po polsku', nazwaOkresu('polrocze', 'pl') === 'Półrocze');
  sprawdz('po angielsku', nazwaOkresu('polrocze', 'en') === 'Half-year');
  sprawdz('po niemiecku', nazwaOkresu('kwartal', 'de') === 'Quartal');
  // Karta pakietu, którego nie ma w cenniku, ma zostać BEZ ceny, a nie z napisem „NaN zł".
  sprawdz('nieznany pakiet nie daje ceny', policzCene('Liga Mistrzów', 'sezon', 'pl') === null);
}

console.log(bledy ? `\nBŁĘDÓW: ${bledy}` : '\nWSZYSTKO PRZESZŁO');
process.exit(bledy ? 1 : 0);
