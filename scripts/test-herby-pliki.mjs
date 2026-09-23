// Przenoszenie herbów z bazy do plików — na PRAWDZIWYCH funkcjach z src/data/herby.ts.
//
// Dlaczego to w ogóle powstało: Supabase odciął projekt od limitu TRANSFERU (Egress Exceeded),
// a herby to 14 MB przy każdym otwarciu panelu — 315 obrazków zapisanych w bazie jako tekst,
// pobieranych od nowa za każdym razem, bo przeglądarka nie ma czego zapamiętać.
//
// Test pilnuje trzech rzeczy, na których stoi całe przejście:
//   1. rozpoznanie, co jest już plikiem, a co jeszcze treścią w bazie,
//   2. poprawne rozłożenie „data:image/png;base64,..." na plik do wysłania,
//   3. że potknięcie na jednym klubie NIE przerywa przenoszenia reszty.
//
// Uruchomienie:  node scripts/test-herby-pliki.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const zrodlo = fs.readFileSync("src/data/herby.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/data/herby.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

// Wycinamy same funkcje, bez importu klienta bazy — ten wymagałby kluczy dostępu,
// a sprawdzamy logikę, nie połączenie z Supabase.
const kod = [
  wytnij('herbJestPlikiem', /export function herbJestPlikiem[\s\S]*?\n\}/),
  wytnij('plikZTresci', /function plikZTresci[\s\S]*?\n\}/),
  wytnij('przeniesHerby', /export async function przeniesHerby\([\s\S]*?\n\}/),
].join('\n').replace(/export /g, '');

// herby.ts jest w TypeScripcie, a new Function() rozumie tylko czysty JavaScript. Zdejmujemy
// zapisy typów tym samym narzędziem, którym robi to budowanie aplikacji — dzięki temu test
// pracuje dokładnie na tym kodzie, który trafia do przeglądarki.
const kodJs = transformSync(kod, { loader: 'ts' }).code;

// wyslijHerb podstawiamy własne: test ma sprawdzić PRZEBIEG przenoszenia, a nie wysyłkę do
// Supabase. Klub o identyfikatorze zaczynającym się od 'ZLY' celowo wybucha.
const sandbox = `
  ${kodJs}
  const wyslane = [];
  async function wyslijHerb(idKlubu, tresc){
    if (herbJestPlikiem(tresc)) return tresc;
    const plik = plikZTresci(tresc);            // ta sama droga co naprawdę
    if (idKlubu.startsWith('ZLY')) throw new Error('kosz nie istnieje');
    wyslane.push({ idKlubu, bajtow: plik.size, typ: plik.type });
    return 'https://przyklad.supabase.co/storage/v1/object/public/herby/' + idKlubu + '.png?v=abc';
  }
  return { herbJestPlikiem, plikZTresci, przeniesHerby, wyslane };
`;
const { herbJestPlikiem, plikZTresci, przeniesHerby, wyslane } = new Function(sandbox)();

// Prawdziwy, najmniejszy możliwy PNG (1×1 piksel) — żeby test nie pracował na wymyślonych bajtach.
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

console.log('\n1. Co jest plikiem, a co jeszcze siedzi w bazie');
{
  sprawdz('adres https to plik', herbJestPlikiem('https://x.supabase.co/herby/K1.png') === true);
  sprawdz('adres http też', herbJestPlikiem('http://x/K1.png') === true);
  sprawdz('treść obrazka to nie plik', herbJestPlikiem(PNG_1PX) === false);
  sprawdz('pusta wartość to nie plik', herbJestPlikiem('') === false);
  sprawdz('brak wartości to nie plik', herbJestPlikiem(null) === false);
  // Bez tego przeniesiony herb poszedłby do wysyłki drugi raz przy każdym uruchomieniu narzędzia.
  sprawdz('adres ze znacznikiem wersji nadal jest plikiem',
    herbJestPlikiem('https://x/herby/K1.png?v=m1k2') === true);
}

console.log('\n2. Rozłożenie treści na plik');
{
  const plik = plikZTresci(PNG_1PX);
  sprawdz('rozpoznany typ obrazka', plik.type === 'image/png', plik.type);
  // 1×1 PNG ma 70 bajtów. Gdyby base64 był dekodowany źle, rozmiar by się nie zgadzał.
  sprawdz('rozmiar zgadza się z oryginałem', plik.size === 70, plik.size);
  sprawdz('JPG też przechodzi', plikZTresci('data:image/jpeg;base64,/9j/4AAQ').type === 'image/jpeg');

  const wybucha = (tresc)=>{ try{ plikZTresci(tresc); return false; }catch(e){ return true; } };
  sprawdz('tekst bez przecinka odrzucony', wybucha('to nie jest obrazek'));
  sprawdz('obrazek nie-base64 odrzucony', wybucha('data:image/svg+xml,<svg/>'));
}

console.log('\n3. Przenoszenie całej paczki');
{
  wyslane.length = 0;
  const wynik = await przeniesHerby({
    K1: PNG_1PX,
    K2: PNG_1PX,
    K3: 'https://x.supabase.co/herby/K3.png',   // już przeniesiony
    K4: '',                                      // pusty — do pominięcia
  });
  sprawdz('przeniesione dwa', Object.keys(wynik.przeniesione).length === 2, wynik);
  sprawdz('gotowy plik pominięty, nie wysłany drugi raz', wynik.pominiete === 1, wynik);
  sprawdz('pusta wartość nie wybucha', wynik.bledy.length === 0, wynik);
  sprawdz('nowy adres trafia pod identyfikator klubu',
    /\/herby\/K1\.png/.test(wynik.przeniesione.K1 || ''), wynik.przeniesione);
  sprawdz('adres niesie znacznik wersji', /\?v=/.test(wynik.przeniesione.K1 || ''), wynik.przeniesione);
  sprawdz('wysłano dokładnie dwa pliki', wyslane.length === 2, wyslane);
}

console.log('\n4. Potknięcie na jednym klubie nie przerywa reszty');
{
  // To jest cały sens rozdzielenia przenoszenia od zapisu. Gdyby jeden nieudany klub przerywał
  // pętlę, przy 315 herbach kończyłoby się to bazą w stanie, którego nikt nie umie opisać:
  // część przeniesiona, część nie, i nie wiadomo która.
  wyslane.length = 0;
  const wynik = await przeniesHerby({ K1: PNG_1PX, ZLY1: PNG_1PX, K2: PNG_1PX, ZLY2: PNG_1PX });
  sprawdz('dobre kluby przeszły mimo błędów', Object.keys(wynik.przeniesione).length === 2, wynik);
  sprawdz('oba potknięcia odnotowane', wynik.bledy.length === 2, wynik);
  sprawdz('błąd mówi, którego klubu dotyczy', wynik.bledy[0].idKlubu === 'ZLY1', wynik.bledy);
  sprawdz('i podaje powód', /kosz nie istnieje/.test(wynik.bledy[0].powod), wynik.bledy);
  sprawdz('zepsute kluby NIE trafiają do zapisu',
    !('ZLY1' in wynik.przeniesione) && !('ZLY2' in wynik.przeniesione), wynik.przeniesione);
}

console.log('\n5. Meldowanie postępu');
{
  const kroki = [];
  await przeniesHerby({ K1: PNG_1PX, K2: PNG_1PX, K3: PNG_1PX },
    (zrobione, wszystkich)=>kroki.push(`${zrobione}/${wszystkich}`));
  sprawdz('melduje przy każdym klubie', kroki.length === 3, kroki);
  sprawdz('liczy od jednego do końca', kroki.join(' ') === '1/3 2/3 3/3', kroki);
}

console.log(bledy ? `\nBŁĘDÓW: ${bledy}` : '\nWSZYSTKO PRZESZŁO');
process.exit(bledy ? 1 : 0);
