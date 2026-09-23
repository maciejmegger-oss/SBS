// Sprawdza wiersz konta w zakładce „Dostęp" — na PRAWDZIWEJ funkcji z src/main.ts.
//
// Zgłoszenie (23.09.2026): „klient widzi wszystko wszystkie ligi a wybrał tylko 2 ligę".
// Przyczyna: wybór pakietu na stronie głównej to PROŚBA. Administrator klikał „Przyznaj dostęp"
// i na tym kończył, a konto zatwierdzone bez roli klienta jest kontem skauta — czyli widzi całą
// bazę. Nic tego nie sygnalizowało.
//
// Ten test pilnuje trzech rzeczy, na których polega poprawka:
//   1. zgłoszenie z pakietem dostaje przycisk otwierający dostęp OD RAZU jako klient,
//   2. konto zatwierdzone bez roli klienta, które prosiło o pakiet, jest oznaczone ostrzeżeniem,
//   3. konto klienta z pakietem nie dostaje ani jednego, ani drugiego — u niego wszystko gra.
//
// Uruchomienie:  node scripts/test-dostep-klienta.mjs
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
  wytnij('TOP_LEVELS', /const TOP_LEVELS = \[[^\]]*\];/),
  wytnij('STATUS_ETYKIETY', /const STATUS_ETYKIETY = \{[\s\S]*?\};/),
  wytnij('kontoWiersz', /function kontoWiersz\(k\)\{[\s\S]*?\n\}/),
  wytnij('opisPakietow', /function opisPakietow\(pakiety\)\{[\s\S]*?\n\}/),
].join('\n');

// Otoczenie, którego kontoWiersz potrzebuje, a które w aplikacji dostarcza reszta pliku.
const otoczenie = `
  const esc = (s)=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const PAKIET_PREMIUM = 'Premium';
  const PAKIETY_DOSTEPNE = TOP_LEVELS;
  const kontoUzytkownika = { userId: 'admin-1', rola: 'admin' };
`;
const { kontoWiersz } = new Function(`${kod.split('\n')[0]}\n${otoczenie}\n${kod.split('\n').slice(1).join('\n')}\n return { kontoWiersz };`)();

const konto = (nadpisz) => Object.assign({
  userId: 'k-1', email: 'klient@example.com', imieNazwisko: 'Jan Kowalski',
  klub: '', rolaWKlubie: '', telefon: '', rola: 'scout', pakiety: [], pakietZadany: '',
  status: 'oczekuje', utworzoneAt: '2026-09-23T06:00:00Z', zdecydowaneAt: '',
}, nadpisz);

console.log('\n1. Zgłoszenie z wybranym pakietem, jeszcze bez dostępu');
{
  const h = kontoWiersz(konto({ pakietZadany: 'II liga' }));
  sprawdz('jest przycisk otwierający dostęp od razu jako klient', h.includes('konto-jako-klient'), h);
  sprawdz('przycisk nazywa pakiet, o który proszono', /Przyznaj dostęp jako klient — II liga/.test(h), h);
  sprawdz('pakiet jedzie w przycisku, więc nie trzeba go wpisywać', h.includes('data-pakiet="II liga"'), h);
  sprawdz('zwykłe przyznanie zostaje, ale jako wybór drugi', /Przyznaj jako skaut/.test(h), h);
  sprawdz('to ono jest teraz przyciskiem pobocznym', h.indexOf('konto-jako-klient') < h.indexOf('Przyznaj jako skaut'), h);
}

console.log('\n2. Stan, który wywołał zgłoszenie: dostęp przyznany, rola skauta');
{
  const h = kontoWiersz(konto({ pakietZadany: 'II liga', status: 'zatwierdzone' }));
  sprawdz('wiersz OSTRZEGA, że konto widzi całą bazę', /widzi CAŁĄ bazę/.test(h), h);
  sprawdz('ostrzeżenie jest w kolorze błędu, nie w złotym', /clay-dark[\s\S]*widzi CAŁĄ bazę/.test(h), h);
  sprawdz('jest jednym kliknięciem do naprawienia', /konto-jako-klient[\s\S]*Zrób klientem — II liga/.test(h), h);
  sprawdz('nie ma już drugiego, mylącego „Prosi o pakiet"', (h.match(/Prosi o pakiet/g) || []).length === 0, h);
}

console.log('\n3. Konto klienta z nadanym pakietem — wszystko na swoim miejscu');
{
  const h = kontoWiersz(konto({ rola: 'klient', status: 'zatwierdzone', pakiety: ['II liga'], pakietZadany: 'II liga' }));
  sprawdz('bez ostrzeżenia', !/widzi CAŁĄ bazę/.test(h), h);
  sprawdz('bez przycisku naprawczego', !h.includes('konto-jako-klient'), h);
  sprawdz('widać, co ma wykupione', /Pakiety: <strong>II liga/.test(h), h);
  sprawdz('jest wejście do zmiany pakietów', h.includes('konto-pakiety'), h);
}

console.log('\n4. Premium i pakiet spoza listy');
{
  const h = kontoWiersz(konto({ pakietZadany: 'Premium' }));
  sprawdz('Premium też otwiera się jednym kliknięciem', /konto-jako-klient[\s\S]*Premium/.test(h), h);

  // Gdyby ktoś wpisał do bazy cokolwiek, przycisk nadający ten „pakiet" byłby pułapką:
  // konto zostałoby klientem bez żadnych realnych rozgrywek, czyli z pustym panelem.
  const obcy = kontoWiersz(konto({ pakietZadany: 'Liga Mistrzów' }));
  sprawdz('nieznany pakiet NIE dostaje przycisku jednym kliknięciem', !obcy.includes('konto-jako-klient'), obcy);
  sprawdz('ale nadal widać, o co prosił', /Prosi o pakiet/.test(obcy), obcy);
}

console.log('\n5. Współpracownik bez pakietu — ścieżka skauta bez zmian');
{
  const h = kontoWiersz(konto({}));
  sprawdz('zwykłe „Przyznaj dostęp" jak dotąd', /class="gold"[^>]*data-status="zatwierdzone">Przyznaj dostęp</.test(h), h);
  sprawdz('bez przycisku klienta', !h.includes('konto-jako-klient'), h);
}

// ---------------------------------------------------------------------------
// BRAMA PAKIETU
// ---------------------------------------------------------------------------
// Zgłoszenie (23.09.2026): „dopóki ja w panelu administratora nie odznaczę pakietu, to klient
// jeszcze nie może mieć dostępu do konta i możliwości logowania się do systemu".
//
// Zgoda administratora i wykupione rozgrywki to DWIE osobne decyzje. Dotąd obowiązywała tylko
// pierwsza: konto klienta bez żadnego pakietu wchodziło do środka i zastawało wszystko puste.

console.log('\n6. Kto ma wykupione rozgrywki, a kto tylko tak wygląda');
{
  const kodBramy = [
    wytnij('TOP_LEVELS', /const TOP_LEVELS = \[[^\]]*\];/),
    wytnij('pakietyKonta', /function pakietyKonta\(\)\{[\s\S]*?\n\}/),
    wytnij('maWykupioneRozgrywki', /function maWykupioneRozgrywki\(\)\{[\s\S]*?\n\}/),
  ].join('\n');
  const { ustaw, maWykupioneRozgrywki } = new Function(`
    ${kodBramy.split('\n')[0]}
    const PAKIET_PREMIUM = 'Premium';
    const PAKIETY_DOSTEPNE = TOP_LEVELS;
    let kontoUzytkownika = null;
    ${kodBramy.split('\n').slice(1).join('\n')}
    return { ustaw: (k)=>{ kontoUzytkownika = k; }, maWykupioneRozgrywki };
  `)();

  const z = (pakiety) => { ustaw({ rola: 'klient', pakiety }); return maWykupioneRozgrywki(); };
  sprawdz('jedna liga wystarczy', z(['II liga']) === true);
  sprawdz('Premium wystarczy', z(['Premium']) === true);
  sprawdz('dwie ligi też', z(['II liga','III liga']) === true);
  sprawdz('pusta lista to brak dostępu', z([]) === false);
  // Literówka w bazie nie może wpuszczać konta, które i tak zobaczy pustą stronę.
  sprawdz('sama nieznana nazwa to nadal brak dostępu', z(['Liga Mistrzów']) === false);
  sprawdz('nieznana obok prawdziwej nie przeszkadza', z(['Liga Mistrzów','IV liga']) === true);
  sprawdz('brak pola pakiety to brak dostępu', z(undefined) === false);
  ustaw(null);
  sprawdz('bez konta nie ma czego otwierać', maWykupioneRozgrywki() === false);
}

console.log('\n7. Brama jest naprawdę podpięta przy wejściu do systemu');
{
  const wejscie = wytnij('wpuscZalogowanego', /async function wpuscZalogowanego\(\)\{[\s\S]*?\n\}/);
  sprawdz('wpuscZalogowanego pyta o wykupione rozgrywki',
    /rola === 'klient' && !maWykupioneRozgrywki\(\)/.test(wejscie), wejscie);
  sprawdz('i zatrzymuje na ekranie konta, zamiast ładować dane',
    /!maWykupioneRozgrywki\(\)\)\{[\s\S]{0,120}renderKontoScreen/.test(wejscie), wejscie);
  // Kolejność ma znaczenie: najpierw status, potem pakiety. Konto odrzucone ma zobaczyć
  // „dostęp nie został przyznany", a nie „czekasz na pakiet".
  sprawdz('status sprawdzany PRZED pakietami',
    wejscie.indexOf("status !== 'zatwierdzone'") < wejscie.indexOf('maWykupioneRozgrywki'), wejscie);

  const ekran = wytnij('renderKontoScreen', /function renderKontoScreen\(konto\)\{[\s\S]*?\n\}/);
  sprawdz('ekran ma osobne zdanie dla konta bez pakietu', /Dostęp jeszcze nie został otwarty/.test(ekran), ekran);
  sprawdz('„Sprawdź ponownie" też pyta o pakiety', /maWykupioneRozgrywki\(\)/.test(ekran), ekran);
}

console.log(bledy ? `\nBŁĘDÓW: ${bledy}` : '\nWSZYSTKO PRZESZŁO');
process.exit(bledy ? 1 : 0);
