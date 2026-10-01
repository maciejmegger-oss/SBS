// Sprawdza graficzną kartę zawodnika, która otwiera się po kliknięciu w kartotekę.
//
// Zgłoszenie (30.09.2026): „zobacz, jak ta platforma ma graficznie utworzone profile — zrób takie
// profile graficzne dla każdego zawodnika". Karta ma pokazywać PRAWDZIWE dane: ocena ogólna
// i pięć składowych z raportów (skala 1–6 przeliczona na 1–99), pozycja, klub, rocznik.
// Zawodnik bez ocen nie dostaje wymyślonej liczby.
//
// Uruchomienie:  node scripts/test-karta-zawodnika.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const style = fs.readFileSync("src/style.css", "utf8");
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
  wytnij('SKROTY_OCEN', /const SKROTY_OCEN = \{[^\n]*\};/),
  wytnij('RATING_KEYS', /const RATING_KEYS = \[[^\n]*\];/),
  wytnij('na99', /const na99 = \(v\)=>[\s\S]*?;\r?\n/),
  wytnij('SKROTY_POZYCJI', /const SKROTY_POZYCJI: \[RegExp, string\]\[\] = \[[\s\S]*?\n\];/),
  wytnij('skrotPozycji', /function skrotPozycji\(pozycja\)\{[\s\S]*?\n\}/),
  wytnij('flagaZawodnika', /function flagaZawodnika\(p\)\{[\s\S]*?\n\}/),
  wytnij('flagaZawodnikaHtml', /function flagaZawodnikaHtml\(p, klasa\)\{[\s\S]*?\n\}/),
  wytnij('kartaZawodnikaHtml', /function kartaZawodnikaHtml\(p, a\)\{[\s\S]*?\n\}/),
].join('\n').replace(/: \[RegExp, string\]\[\]/, '');

const karta = new Function('esc', 'clubCrest', 'clubName', 'clubLeague', 'clubRegion', 'nationalityFlag', 'rocznikZawodnika',
  `${kod}\n return { kartaZawodnikaHtml, skrotPozycji, na99, flagaZawodnika, flagaZawodnikaHtml };`)(
  (s) => String(s ?? ''), () => '/herb.png', () => 'Zawisza Bydgoszcz', () => 'II liga',
  (id) => id === 'ZAGR' ? 'Bundesliga' : (id ? 'Kujawsko-Pomorski ZPN' : ''),
  (nat) => ({ polska: '🇵🇱', ukraina: '🇺🇦' })[String(nat).toLowerCase()] || '',
  (p) => p.birthYear || '');

console.log('\n1. Skala ocen — z raportów, nie z powietrza');
sprawdz('6/6 to 99', karta.na99(6) === 99, String(karta.na99(6)));
sprawdz('4,5/6 to 74', karta.na99(4.5) === 74, String(karta.na99(4.5)));
sprawdz('1/6 to 17, a nie 0 — karta nie udaje, że ktoś nie istnieje', karta.na99(1) === 17, String(karta.na99(1)));
sprawdz('brak oceny to brak liczby', karta.na99(null) === null && karta.na99(undefined) === null);

console.log('\n2. Skróty pozycji');
[['Bramkarz','BR'], ['Obrońca boczny','OB'], ['Obrońca środkowy','ŚO'], ['Pomocnik defensywny','DPŚ'],
 ['Pomocnik ofensywny','OPŚ'], ['Skrzydłowy lewy','SKR'], ['Napastnik','NAP']].forEach(([poz, skrot]) =>
  sprawdz(`${poz} → ${skrot}`, karta.skrotPozycji(poz) === skrot, karta.skrotPozycji(poz)));
sprawdz('bez pozycji — kreska, nie puste miejsce', karta.skrotPozycji('') === '—');

console.log('\n3. Karta zawodnika z ocenami');
{
  const p = { id: 'Z1', firstName: 'Jan', lastName: 'Kowalski', birthYear: 2007, position: 'Pomocnik ofensywny',
    clubId: 'K1', nationality: 'Polska', matches: 14, photoUrl: '' };
  const a = { overall: 4.5, reportCount: 3, avgs: { technika: 5, taktyka: 4, motoryka: 4.5, mentalnosc: 5.5, potencjal: 6 } };
  const html = karta.kartaZawodnikaHtml(p, a);
  sprawdz('ocena ogólna na karcie', /<div class="kz-ocena">74<\/div>/.test(html), html.slice(0, 200));
  sprawdz('pozycja skrótem', /<div class="kz-pozycja">OPŚ<\/div>/.test(html));
  sprawdz('nazwisko wersalikami, imię nad nim', /kz-imie">Jan</.test(html) && /kz-nazwa">KOWALSKI</.test(html));
  sprawdz('rocznik z wiekiem, klub i liga pod nazwiskiem',
    /rocznik 2007 \(\d+ l\.\) · Zawisza Bydgoszcz · II liga/.test(html), (html.match(/kz-podpis">([^<]*)/) || [])[1]);
  sprawdz('pięć składowych oceny na karcie',
    ['TEC','TAK','MOT','MEN','POT'].every(s => html.includes(`>${s}<`)), html);
  sprawdz('technika 5/6 pokazana jako 83', html.includes('>83<'));
  sprawdz('potencjał 6/6 jako 99', html.includes('>99<'));
  sprawdz('liczba meczów w szóstym polu', /kz-pole-liczba">14</.test(html));
  sprawdz('flaga narodowości', html.includes('🇵🇱'));
  sprawdz('herb klubu', html.includes('/herb.png'));
  sprawdz('bez zdjęcia — inicjały, nie pusty kwadrat', /kz-zdjecie-brak">JK</.test(html));
  sprawdz('pod kartą skąd się wzięły liczby', /Skala 1–99 przeliczona z ocen 1–6 &middot; średnia z 3 raportów/.test(html));
}

console.log('\n4. Zawodnik bez ani jednego raportu');
{
  const p = { id: 'Z2', firstName: 'Piotr', lastName: 'Nowak', position: '', clubId: 'K1', matches: null };
  const html = karta.kartaZawodnikaHtml(p, null);
  sprawdz('zamiast oceny kreska, nie zmyślona liczba', /<div class="kz-ocena">—<\/div>/.test(html));
  sprawdz('składowe też kreskami', (html.match(/kz-pole-liczba">—</g) || []).length === 6,
    String((html.match(/kz-pole-liczba">—</g) || []).length));
  sprawdz('podpis mówi, skąd wezmą się oceny',
    /Ocen jeszcze nie ma — liczby pojawią się po pierwszym raporcie/.test(html));
}

console.log('\n4a. Mała flaga narodowości przy każdym zawodniku');
// Zgłoszenie (01.10.2026): „zrób jeszcze małą flagę narodowości każdego zawodnika".
{
  const wpisana = karta.flagaZawodnika({ nationality: 'Ukraina', clubId: 'K1' });
  sprawdz('narodowość z kartoteki — flaga pewna', wpisana.flaga === '🇺🇦' && wpisana.pewna === true, JSON.stringify(wpisana));
  const bezPola = karta.flagaZawodnika({ clubId: 'K1' });
  sprawdz('bez narodowości, ale klub w polskim ZPN — biało-czerwona', bezPola.flaga === '🇵🇱' && bezPola.kraj === 'Polska');
  sprawdz('i oznaczona jako przypuszczenie, nie fakt', bezPola.pewna === false);
  sprawdz('klub spoza polskiego związku — bez zgadywania',
    karta.flagaZawodnika({ clubId: 'ZAGR' }).flaga === '', JSON.stringify(karta.flagaZawodnika({ clubId: 'ZAGR' })));
  sprawdz('zawodnik bez klubu i bez narodowości — flagi nie ma', karta.flagaZawodnika({}).flaga === '');
  const html = karta.flagaZawodnikaHtml({ clubId: 'K1' });
  sprawdz('podpowiedź mówi wprost, że to wniosek z ligi', /przypuszczalnie, po lidze klubu/.test(html), html);
  sprawdz('przypuszczalna flaga ma własną klasę (przygaszenie + kropka)', /flaga-przypuszczalna/.test(html));
  sprawdz('pewna flaga bez tej klasy', !/flaga-przypuszczalna/.test(karta.flagaZawodnikaHtml({ nationality: 'Ukraina' })));
  sprawdz('flaga w karcie zawodnika', /kz-flaga/.test(karta.kartaZawodnikaHtml({ id:'Z3', firstName:'Jan', lastName:'Nowak', clubId:'K1' }, null)));
  sprawdz('ta sama flaga na listach zawodników', (zrodlo.match(/flagaZawodnikaHtml\(p\)/g) || []).length >= 2);
  sprawdz('przygaszona flaga opisana w arkuszu stylów', /Flaga wywnioskowana z ligi klubu/.test(style));
}

console.log('\n5. Wygląd i podpięcie');
sprawdz('karta otwiera się od razu po wejściu w zawodnika', /\$\{kartaZawodnikaHtml\(p, a\)\}/.test(zrodlo));
// Zgłoszenie (01.10.2026): „są skosy i poucinane treści". Nic nie może stać na sztywnej pozycji
// w kwadracie o stałej wysokości — dziób tarczy wycinał wtedy dolne wiersze.
sprawdz('karta nie ma sztywnej wysokości — rośnie z treścią',
  !/\.karta-zawodnika\{[^}]*height:\s*\d+px/.test(style), (style.match(/\.karta-zawodnika\{[^}]*\}/) || [''])[0]);
sprawdz('bloki płyną w kolumnie, nic nie stoi na top: Xpx',
  /\.karta-zawodnika\{[^}]*display:flex;flex-direction:column/.test(style)
  && !/\.kz-(staty|nazwisko|lewa|prawa)\{position:absolute/.test(style));
sprawdz('dolny dziób to pusty margines, w który nic nie wchodzi',
  /\.karta-zawodnika\{[^}]*padding:18px 20px 88px/.test(style)
  && /clip-path:polygon\(0 0,100% 0,100% calc\(100% - 88px\),50% 100%,0 calc\(100% - 88px\)\)/.test(style));
sprawdz('karta wygląda na wypukłą (światło z góry, cień przy dziobie)',
  /\.karta-zawodnika::before\{[\s\S]*?radial-gradient\(135% 72% at 50% -12%/.test(style));
sprawdz('cieniowanie leży POD treścią, nie przyciemnia liter',
  /\.kz-gora,\.kz-nazwisko,\.kz-staty\{position:relative;z-index:1;\}/.test(style));
sprawdz('długie nazwisko łamie się zamiast wychodzić poza tarczę', /\.kz-nazwa\{[\s\S]*?overflow-wrap:anywhere/.test(style));
sprawdz('skróty ocen nie łamią się na dwie linie', /\.kz-pole-nazwa\{[^}]*white-space:nowrap/.test(style));
sprawdz('zdjęcie i inicjały w jednym rzędzie z oceną', /<div class="kz-gora">/.test(zrodlo));
sprawdz('kształt tarczy bez obrazka (skaluje się i drukuje)', /\.karta-zawodnika\{[\s\S]*?clip-path:polygon/.test(style));
sprawdz('karta ciemna w obu motywach — barwy wpisane wprost, nie ze zmiennych',
  /\.karta-zawodnika\{[\s\S]*?background:linear-gradient\(160deg,#1E4A3C/.test(style));
sprawdz('złote liczby na ciemnej zieleni (kontrast opisany w arkuszu)', /złoto #E3C15A na zieleni #16302A daje 8,9:1/.test(style));
sprawdz('karta zwęża się na telefonie', /@media \(max-width:480px\)\{\s*\n\s*\.karta-zawodnika\{width:260px/.test(style));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
