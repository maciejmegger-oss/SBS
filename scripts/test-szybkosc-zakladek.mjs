// POMIAR CZASU OTWIERANIA ZAKŁADEK — na PRAWDZIWYCH funkcjach z src/main.ts.
//
// Zgłoszenie (28.09.2026): „po kliknięciu w zakładkę jest długi czas ładowania".
// Najdroższa jest lista klubów: dla KAŻDEGO z 600 klubów liczy się dorobek (meczeKlubu), a ten
// przeglądał wszystkich 16 650 zawodników i rozbierał nazwy rywali na człony — przy każdym wierszu
// od nowa. Test mierzy to na danych wielkości prawdziwej bazy i pilnuje, żeby nie wróciło.
//
// Uruchomienie:  node scripts/test-szybkosc-zakladek.mjs
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
  wytnij('zawodnicyKlubu', /function zawodnicyKlubu\(clubId\)\{[\s\S]*?\n\}/),
  // Indeksy obserwacji i raportów kasuje to samo odswiezIndeksy, więc muszą tu być — inaczej
  // test mówiłby o kodzie, którego w aplikacji nie ma.
  wytnij('indeksWgZawodnika', /function indeksWgZawodnika\(lista, pole\)\{[\s\S]*?\n\}/),
  wytnij('playerObs', /function playerObs\(playerId\)\{[\s\S]*?\n\}/),
  wytnij('raportyGracza', /function raportyGracza\(playerId\)\{[\s\S]*?\n\}/),
  wytnij('odswiezIndeksy', /function odswiezIndeksy\(\)\{[\s\S]*?\n\}/),
  wytnij('meczeKlubu', /function meczeKlubu\(clubId\)\{[\s\S]*?\n\}/),
  wytnij('policzMeczeKlubu', /function policzMeczeKlubu\(clubId, zawodnicy\)\{[\s\S]*?\n\}/),
].join('\n');

// Baza wielkości prawdziwej: 600 klubów, 16 650 zawodników, po kilka meczów w przebiegu.
const KLUBY = Array.from({ length: 600 }, (_, i) => ({
  id: 'C' + i, name: `Klub numer ${i} Miasto${i % 90}`, league: 'IV liga (śląska)', season: '2026/2027',
}));
const RYWALE = ['Zawisza Bydgoszcz', 'KS Chemik Police', 'Wisła Dobrzyń n/Wisłą', 'GKS Piast Gliwice II', 'Unia Turza Śląska'];
const ZAWODNICY = Array.from({ length: 16650 }, (_, i) => ({
  id: 'Z' + i, clubId: 'C' + (i % 600), matches: i % 12,
  przebieg: Array.from({ length: i % 7 }, (_, j) => ({
    rywal: RYWALE[(i + j) % RYWALE.length], dom: j % 2 === 0, wynik: `${j % 4}:${(j + 1) % 3}`,
  })),
}));

const api = new Function('DB', 'tabeleLig', 'osiagalneKolejki', 'wierszZTabeli', 'playerAvg', `${kod}
  return { meczeKlubu, odswiezIndeksy, zawodnicyKlubu, playerObs, raportyGracza };`)(
  { clubs: KLUBY, players: ZAWODNICY, observations: [], reports: [],
    klubyWgId: new Map(KLUBY.map(c=>[c.id, c])) }, {}, () => null, () => null, () => null);

console.log('\n1. Lista klubów — 600 wierszy na bazie 16 650 zawodników');
api.odswiezIndeksy();
const start = Date.now();
let suma = 0;
KLUBY.forEach(c => { suma += api.meczeKlubu(c.id).rozegrane; });
const czas = Date.now() - start;
console.log(`      policzone w ${czas} ms (suma kolejek: ${suma})`);
sprawdz(`cały widok Kluby liczy się poniżej sekundy (${czas} ms)`, czas < 1000, `${czas} ms`);
sprawdz('drugie przeliczenie tego samego widoku jest natychmiastowe (pamięć na czas rysowania)', (() => {
  const t = Date.now();
  KLUBY.forEach(c => api.meczeKlubu(c.id));
  const drugi = Date.now() - t;
  console.log(`      drugi przebieg: ${drugi} ms`);
  return drugi <= Math.max(5, czas / 4);
})());

console.log('\n2. Indeks zawodników wg klubu');
sprawdz('zawodnicy klubu wyjmowani z indeksu, nie przeszukiwaniem całej bazy',
  api.zawodnicyKlubu('C7').length === ZAWODNICY.filter(z => z.clubId === 'C7').length);
sprawdz('klub bez zawodników oddaje pustą listę', api.zawodnicyKlubu('C-nie-ma').length === 0);
sprawdz('indeks budowany raz na przerysowanie (render go odświeża)',
  /odswiezIndeksy\(\);/.test(zrodlo) && /function render\(\)/.test(zrodlo));

console.log('\n3. Klub po identyfikatorze — z indeksu');
{
  const kodKlubu = (zrodlo.match(/function clubName\(id\)\{[^\n]*\n/) || [''])[0];
  const zbudujNazwe = (zIndeksem) => new Function('DB', `${kodKlubu}\n return clubName;`)(
    zIndeksem ? { clubs: KLUBY, klubyWgId: new Map(KLUBY.map(c => [c.id, c])) } : { clubs: KLUBY });

  const zmierz = (clubName) => { const t = Date.now(); let n = 0;
    for (let i = 0; i < 16650; i++) n += clubName('C' + (i % 600)).length; return Date.now() - t; };
  const bezIndeksu = zmierz(zbudujNazwe(false));
  const zIndeksem = zmierz(zbudujNazwe(true));
  console.log(`      16 650 odczytów nazwy klubu: bez indeksu ${bezIndeksu} ms, z indeksem ${zIndeksem} ms`);
  sprawdz(`nazwa klubu dla całej kartoteki poniżej 50 ms (${zIndeksem} ms)`, zIndeksem < 50, `${zIndeksem} ms`);
  sprawdz('indeks jest wyraźnie szybszy od przeszukiwania', zIndeksem * 5 < bezIndeksu || bezIndeksu < 20,
    `${bezIndeksu} ms vs ${zIndeksem} ms`);
  sprawdz('bez indeksu wynik jest ten sam (testy i pierwsze wywołanie)',
    zbudujNazwe(false)('C7') === zbudujNazwe(true)('C7'));
  sprawdz('nieznany klub nie wywraca odczytu', zbudujNazwe(true)('C-nie-ma') === '—');
  sprawdz('indeks budowany raz na przerysowanie', /DB\.klubyWgId = new Map\(\(DB\.clubs \|\| \[\]\)\.map/.test(zrodlo));
  sprawdz('nazwa, region, liga i herb czytają z indeksu, gdy jest',
    ['clubName','clubRegion','clubLeague'].every(f => new RegExp(`function ${f}\\(id\\)\\{ const c = \\(DB\\.klubyWgId`).test(zrodlo))
    && /function clubCrest\(id\)\{[^\n]*DB\.klubyWgId/.test(zrodlo));
}

console.log('\n3a. Oceny i obserwacje zawodnika — bez przeszukiwania całej bazy na każdy wiersz');
// Zgłoszenie (01.10.2026): „bardzo długo ładuje wszystkie strony po kliknięciu w zakładkę".
// Lista zawodników liczyła średnią dla każdego wiersza, a ta przeszukiwała WSZYSTKIE obserwacje
// i WSZYSTKIE raporty — przy 5 000 zawodników to dziesiątki milionów porównań na jedno kliknięcie.
{
  const OBS = Array.from({ length: 10000 }, (_, i) => ({ id: 'O' + i, playerId: 'Z' + (i % 5000), date: '2026-0' + (1 + i % 9) + '-01' }));
  const RAP = Array.from({ length: 5000 }, (_, i) => ({ id: 'R' + i, playerId: 'Z' + (i % 5000) }));
  const baza = { clubs: KLUBY, players: ZAWODNICY.slice(0, 5000), observations: OBS, reports: RAP,
    klubyWgId: new Map(KLUBY.map(c => [c.id, c])) };
  const a2 = new Function('DB', 'tabeleLig', 'osiagalneKolejki', 'wierszZTabeli', 'playerAvg', `${kod}
    return { odswiezIndeksy, playerObs, raportyGracza };`)(baza, {}, () => null, () => null, () => null);

  a2.odswiezIndeksy();
  const start2 = Date.now();
  let suma2 = 0;
  for (const p of baza.players) suma2 += a2.playerObs(p.id).length + a2.raportyGracza(p.id).length;
  const czas2 = Date.now() - start2;
  console.log(`      5 000 wierszy policzone w ${czas2} ms (odczytów: ${suma2})`);
  sprawdz(`lista zawodników liczy się poniżej ćwierć sekundy (${czas2} ms)`, czas2 < 250, `${czas2} ms`);
  sprawdz('wynik taki sam jak przy przeszukiwaniu',
    a2.playerObs('Z7').length === OBS.filter(o => o.playerId === 'Z7').length
    && a2.raportyGracza('Z7').length === RAP.filter(r => r.playerId === 'Z7').length);
  sprawdz('obserwacje posortowane po dacie, tak jak dawniej',
    a2.playerObs('Z7').every((o, i, l) => i === 0 || String(l[i - 1].date) <= String(o.date)));
  sprawdz('zmiana danych nie zostaje w pamięci — indeks ginie przy przerysowaniu', (() => {
    baza.observations.push({ id: 'NOWA', playerId: 'Z7', date: '2026-12-01' });
    const przed = a2.playerObs('Z7').length;
    a2.odswiezIndeksy();
    return a2.playerObs('Z7').length === przed + 1;
  })());
  sprawdz('średnia zawodnika pamiętana w obrębie jednego przerysowania',
    /if\(playerAvg\.pamiec\)\{[\s\S]{0,160}return gotowe;/.test(fs.readFileSync('src/main.ts', 'utf8')));
  sprawdz('pomiar czasu rysowania zgłasza wolne zakładki w konsoli',
    /Rysowanie „\$\{currentView\}": \$\{czasWidoku\} ms treść/.test(fs.readFileSync('src/main.ts', 'utf8')));
}

console.log('\n4. Gorące miejsca nie wracają do przeszukiwania całej bazy');
{
  // Każde DB.players.filter(p=>p.clubId===…) w rysowaniu listy to przejście po 16 650 kartotekach.
  const wKodzie = (zrodlo.match(/DB\.players\.filter\(\s*(?:p|x)\s*=>\s*(?:p|x)\.clubId\s*===?\s*/g) || []).length;
  console.log(`      pozostałe przeszukiwania po clubId: ${wKodzie}`);
  sprawdz('widoki list nie przeszukują bazy raz na wiersz (zostały tylko pojedyncze miejsca)',
    wKodzie <= 6, `${wKodzie} miejsc`);
  sprawdz('rozbiór nazwy klubu pamięta wynik (te same nazwy wracają tysiące razy)',
    /if\(!rozbijNazweKlubu\.pamiec\) rozbijNazweKlubu\.pamiec = new Map\(\);/.test(zrodlo));
}

console.log('\n5. Pisanie i wielkość listy — to, co użytkownik czuje jako „system wisi"');
// Zgłoszenie (01.10.2026): „jeśli w wyszukiwarce wpisujemy nazwisko, system wisi, nie wyszukuje,
// dopiero po chwili się odwiesza" oraz „jeśli próbujemy wybrać dany klub albo ligę, bardzo długo
// trzeba czekać". Dwie przyczyny: pełne przerysowanie na każdą literę i kilka tysięcy wierszy
// składanych naraz.
{
  sprawdz('pisanie nie przerysowuje widoku na każdą literę',
    /function pisanieZOdroczeniem\(pole, zapamietaj, opoznienie\)\{/.test(zrodlo));
  sprawdz('wpisana wartość zapamiętuje się OD RAZU — nic nie ginie',
    /pole\.oninput = \(\)=>\{\s*\n\s*zapamietaj\(pole\.value\);/.test(zrodlo));
  sprawdz('poprzednie czekające przerysowanie jest odwoływane',
    /if\(czekajacy\) clearTimeout\(czekajacy\);/.test(zrodlo));
  sprawdz('kursor zostaje w polu po przerysowaniu',
    /zachowajKursorPoPrzerysowaniu\(document, sel, render\)/.test(zrodlo));
  const szukajki = ['f-search', 'f-club', 'f-birthyear'];
  const nieodroczone = szukajki.filter(id => new RegExp("getElementById\\('" + id + "'\\)[^\\n]*oninput=").test(zrodlo));
  sprawdz('wyszukiwarka zawodników, pole klubu i rocznik — wszystkie odroczone', !nieodroczone.length, nieodroczone.join(', '));
  sprawdz('to samo w Monitoringu, Kontaktach, Menedżerach i Klubach',
    (zrodlo.match(/pisanieZOdroczeniem\(/g) || []).length >= 7,
    String((zrodlo.match(/pisanieZOdroczeniem\(/g) || []).length));

  sprawdz('lista rysuje najpierw porcję, nie kilka tysięcy wierszy naraz',
    /const PORCJA_WIERSZY = 300;/.test(zrodlo) && /if\(uciete\) list = list\.slice\(0, PORCJA_WIERSZY\);/.test(zrodlo));
  sprawdz('widać, ile z ilu pokazujemy, i da się zobaczyć wszystkich',
    /Pokazuję <b>\$\{PORCJA_WIERSZY\}<\/b> z <b>\$\{wszystkich\}<\/b>/.test(zrodlo)
    && /data-action="pokaz-wszystkich-zawodnikow"/.test(zrodlo));
  sprawdz('zmiana filtra wraca do porcji — jedno kliknięcie nie spowalnia całej pracy',
    (zrodlo.match(/pokazWszystkichZawodnikow = false/g) || []).length >= 4,
    String((zrodlo.match(/pokazWszystkichZawodnikow = false/g) || []).length));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
