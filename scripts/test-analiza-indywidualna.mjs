// Analiza indywidualna zawodnika — cennik usługi i sekcja na stronie.
//
// To DRUGA, osobna oferta: klub kupuje dostęp do bazy na sezon, a zawodnik albo rodzic kupuje
// jedną rzecz — ocenę konkretnego chłopaka. Test pilnuje czterech spraw, w których najłatwiej
// zrobić szkodę:
//   1. Ceny usług NIE przechodzą przez przełącznik Sezon / Półrocze / Kwartał. To usługa
//      jednorazowa; gdyby ktoś podłączył ją pod mnożniki okresu, analiza za 490 zł pokazałaby
//      się komuś za 196 zł — i trzeba by ją za tyle wykonać.
//   2. Dodatek jest widocznie dodatkiem („+ 390 zł"), a nie usługą samodzielną. Rodzic nie
//      może wyjść z przekonaniem, że za 390 zł dostanie analizę mentalną bez analizy.
//   3. Waluta idzie za językiem, dokładnie jak w pakietach klubowych.
//   4. ZASTRZEŻENIE O MAŁOLETNIM STOI NA STRONIE. To nie uprzejmość: bez zgody opiekuna
//      prawnego nie wolno nam założyć profilu dziecka. Gdyby ten akapit kiedyś wypadł
//      z sekcji przy jej przeróbce, test musi to zatrzymać.
//
// Uruchomienie:  node scripts/test-analiza-indywidualna.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const zrodlo = fs.readFileSync("src/site/cennik.ts", "utf8");
const strona = fs.readFileSync("index.html", "utf8");
const przeklady = fs.readFileSync("src/i18n/strona.ts", "utf8");
const styl = fs.readFileSync("src/site/style.css", "utf8");
const rysowanie = fs.readFileSync("src/site/ceny-na-stronie.ts", "utf8");

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + JSON.stringify(dodatek)}`);
  if (!warunek) bledy++;
};

// Odstępy w kwotach są NIEŁAMLIWE (U+00A0) i tak ma być: „490 zł" nie może się złamać na
// końcu wiersza, a „+ 390 zł" nie może zostawić plusa samego. Porównania prowadzimy więc na
// tekście znormalizowanym, a sam niełamliwy odstęp sprawdzamy osobno i wprost — inaczej test
// mierzyłby to, jaką spację przypadkiem wpisano w jego własnych oczekiwaniach.
const zwykle = (s) => String(s).replace(/\u00a0/g, ' ');

const kod = transformSync(zrodlo.replace(/export /g, ''), { loader: 'ts' }).code;
const { USLUGI_INDYWIDUALNE, cenaUslugi, CENY, MNOZNIKI } =
  new Function(`${kod}\n return { USLUGI_INDYWIDUALNE, cenaUslugi, CENY, MNOZNIKI };`)();

console.log('\n1. Kwoty usług po polsku');
{
  sprawdz('analiza podstawowa 490 zł', zwykle(cenaUslugi('analiza-podstawowa', 'pl')) === '490 zł',
    cenaUslugi('analiza-podstawowa', 'pl'));
  sprawdz('analiza pełna 890 zł', zwykle(cenaUslugi('analiza-pelna', 'pl')) === '890 zł',
    cenaUslugi('analiza-pelna', 'pl'));
  // Monitoring to jedyna pozycja rozliczana co miesiąc — i musi to być widać w kwocie.
  sprawdz('monitoring z dopiskiem miesięcznym', zwykle(cenaUslugi('monitoring', 'pl')) === '290 zł / mies.',
    cenaUslugi('monitoring', 'pl'));
  sprawdz('odstęp przed walutą jest niełamliwy', /\u00a0zł$/.test(cenaUslugi('analiza-podstawowa', 'pl')));
  sprawdz('nieznany klucz nie daje „undefined"', cenaUslugi('nie-ma-takiej', 'pl') === '',
    cenaUslugi('nie-ma-takiej', 'pl'));
}

console.log('\n2. Dodatek wygląda jak dopłata, nie jak usługa');
{
  const dodatki = USLUGI_INDYWIDUALNE.filter((u) => u.dodatek);
  sprawdz('trzy dodatki', dodatki.length === 3, dodatki.map((d) => d.klucz));
  // Plus trzyma się kwoty: „+" nie może zostać na końcu wiersza bez liczby.
  sprawdz('plus przy kwocie niełamliwy', /^\+\u00a0/.test(cenaUslugi('dod-mentalna', 'pl')),
    cenaUslugi('dod-mentalna', 'pl'));
  dodatki.forEach((d) => {
    sprawdz(`${d.klucz} z plusem`, zwykle(cenaUslugi(d.klucz, 'pl')).startsWith('+ '), cenaUslugi(d.klucz, 'pl'));
  });
  // Usługa główna plusa mieć NIE może — inaczej plus przestaje cokolwiek znaczyć.
  USLUGI_INDYWIDUALNE.filter((u) => !u.dodatek).forEach((u) => {
    sprawdz(`${u.klucz} bez plusa`, !cenaUslugi(u.klucz, 'pl').includes('+'), cenaUslugi(u.klucz, 'pl'));
  });
}

console.log('\n3. Waluta idzie za językiem');
{
  sprawdz('angielski w euro', zwykle(cenaUslugi('analiza-podstawowa', 'en')) === '149 €',
    cenaUslugi('analiza-podstawowa', 'en'));
  sprawdz('niemiecki w euro', zwykle(cenaUslugi('analiza-pelna', 'de')) === '269 €',
    cenaUslugi('analiza-pelna', 'de'));
  sprawdz('niemiecki monitoring z dopiskiem', zwykle(cenaUslugi('monitoring', 'de')) === '89 € / Mon.',
    cenaUslugi('monitoring', 'de'));
}

console.log('\n4. Usługa jednorazowa nie dotyka mnożników okresu');
{
  // Najważniejszy test w pliku. Gdyby klucz usługi trafił kiedyś do CENY, przełącznik okresu
  // zacząłby go przeliczać i kwartalna „analiza podstawowa" kosztowałaby 196 zł.
  USLUGI_INDYWIDUALNE.forEach((u) => {
    sprawdz(`${u.klucz} nie jest pakietem abonamentowym`, !(u.klucz in CENY));
  });
  // Ta sama kwota niezależnie od tego, co ktoś wcześniej wybrał w przełączniku — funkcja
  // cenaUslugi w ogóle nie bierze okresu jako argumentu, więc sprawdzamy to na sygnaturze.
  sprawdz('cenaUslugi przyjmuje tylko klucz i język', cenaUslugi.length === 2, cenaUslugi.length);
  sprawdz('mnożniki okresu istnieją (dla pakietów)', MNOZNIKI.kwartal === 0.4);
}

console.log('\n5. Sekcja na stronie');
{
  sprawdz('sekcja #analiza istnieje', /id="analiza"/.test(strona));
  sprawdz('odnośnik w pasku górnym', /href="#analiza"/.test(strona));
  // Każda usługa z cennika musi mieć swoją kartę — i odwrotnie: żadna karta nie może wołać
  // o klucz, którego w cenniku nie ma, bo wtedy kwota byłaby pusta.
  const naStronie = [...strona.matchAll(/data-usluga="([^"]+)"/g)].map((m) => m[1]);
  sprawdz('sześć kart z kwotą', naStronie.length === 6, naStronie);
  USLUGI_INDYWIDUALNE.forEach((u) => {
    sprawdz(`karta dla ${u.klucz}`, naStronie.includes(u.klucz));
  });
  naStronie.forEach((k) => {
    sprawdz(`klucz ${k} jest w cenniku`, USLUGI_INDYWIDUALNE.some((u) => u.klucz === k));
  });
  sprawdz('kwoty rysuje odświeżanie cennika', /data-usluga/.test(rysowanie) && /cenaUslugi/.test(rysowanie));
  sprawdz('styl kwoty przebija regułę akapitu w karcie', /#analiza \.pak-kwota/.test(styl));
}

console.log('\n6. Ostrzeżenie o zawodniku niepełnoletnim');
{
  // Bez zgody opiekuna prawnego nie wolno nam założyć profilu dziecka. Ten akapit jest
  // warunkiem przyjęcia zamówienia, więc nie może wypaść przy przeróbce sekcji.
  sprawdz('akapit stoi w sekcji', /data-i18n="an-maloletni"/.test(strona));
  sprawdz('mówi o opiekunie prawnym', /opiekun/i.test(strona));
  sprawdz('przekład angielski mówi o opiekunie', /guardian/.test(przeklady));
  sprawdz('przekład niemiecki', /gesetzliche Vertreter/.test(przeklady));
}

console.log('\n7. Komplet przekładów sekcji');
{
  const klucze = [...strona.matchAll(/data-i18n="(an[0-9-][^"]*)"/g)].map((m) => m[1]);
  const unikalne = [...new Set(klucze)];
  sprawdz('sekcja ma przetłumaczalne bloki', unikalne.length >= 14, unikalne.length);
  unikalne.forEach((k) => {
    sprawdz(`przekład ${k}`, new RegExp(`'${k}'\\s*:`).test(przeklady));
  });
  sprawdz('przekład nav-analiza', /'nav-analiza'\s*:/.test(przeklady));
}

console.log(bledy ? `\nBŁĘDÓW: ${bledy}\n` : '\nWszystko w porządku.\n');
process.exit(bledy ? 1 : 0);
