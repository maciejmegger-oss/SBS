// Sprawdza, czy zbieracz z ŁNP (public/zakladka-lnp-v2.js) pilnuje KOMPLETU kolejki:
// czeka na oba składy, ponawia mecze niepełne i mówi w panelu „mam X z Y meczów".
//
// Zgłoszenie (23.09.2026): IV liga zachodniopomorska, kolejka 6. Na 90minut rozegrano osiem meczów,
// w SBS osiem klubów stało na „6/5" — weszły trzy protokoły, a panel zameldował sukces, bo pisał
// tylko „zebrano 3", bez liczby meczów, które na stronie były.
//
// Uruchomienie:  node scripts/test-komplet-kolejki.mjs
import fs from "node:fs";

const zbieracz = fs.readFileSync("public/zakladka-lnp-v2.js", "utf8");
const glowny = fs.readFileSync("src/main.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

console.log('\n1. Liczenie meczów, które na stronie były');
{
  const kod = (zbieracz.match(/var widzianeMecze=\[\];[\s\S]*?\n\}/) || [])[0]
    + '\n' + (zbieracz.match(/function maProtokol\(url\)\{[\s\S]*?\n\}/) || [])[0];
  if (!kod.includes('widzianeMecze')) { console.error('Nie znalazłem licznika meczów w zbieraczu.'); process.exit(1); }
  const api = new Function(`var zebrane=[];${kod}
    return { zanotujMecze, maProtokol, widziane:function(){return widzianeMecze;}, dodaj:function(w){zebrane.push(w);} };`)();
  const A = 'https://www.laczynaspilka.pl/rozgrywki/mecz/aaa';
  const B = 'https://www.laczynaspilka.pl/rozgrywki/mecz/bbb';
  api.zanotujMecze([A, B]);
  api.zanotujMecze([A]);                                  // druga tura tego samego meczu
  sprawdz('każdy mecz liczony raz', api.widziane().length === 2, String(api.widziane().length));
  api.dodaj('### PROTOKOL: ' + A + '\nSkłady...');
  sprawdz('mecz z protokołem rozpoznany', api.maProtokol(A) === true);
  sprawdz('mecz bez protokołu rozpoznany', api.maProtokol(B) === false);
  sprawdz('pusta lista nie psuje licznika', (api.zanotujMecze(null), api.widziane().length) === 2);
}

console.log('\n2. Oba składy, nie pierwszy — inaczej mecz wchodzi tylko jednej drużynie');
{
  const m = zbieracz.match(/var ileSkladow=\(txt\.match\(\/Sk\\u0142ad wyj\\u015bciowy\/g\)\|\|\[\]\)\.length;\s*\n\s*var ok = ([^\n]+)/);
  sprawdz('warunek czeka na dwa składy', !!m && /ileSkladow>=2/.test(m[1]), m ? m[1] : 'nie znalazłem warunku');
  sprawdz('po kilkunastu próbach bierze i jeden skład (pół protokołu lepsze niż nic)',
    !!m && /ileSkladow>=1 && prob>16/.test(m[1]), m ? m[1] : '');
  const ocen = (ileSkladow, prob) => ileSkladow >= 2 || (ileSkladow >= 1 && prob > 16);
  sprawdz('jeden skład w 3. próbie — jeszcze czekamy', ocen(1, 3) === false);
  sprawdz('dwa składy w 3. próbie — bierzemy', ocen(2, 3) === true);
  sprawdz('jeden skład po 17 próbach — bierzemy, co jest', ocen(1, 17) === true);
  sprawdz('zero składów — nigdy', ocen(0, 40) === false);
}

console.log('\n3. Niepełne protokoły wracają do ponowienia');
{
  sprawdz('protokół z jednym składem trafia na listę do dobrania',
    /if\(ileSkladow<2\)\{ if\(pi<0\) polowiczneUrl\.push\(url\); \}/.test(zbieracz));
  sprawdz('pełny protokół zdejmuje mecz z tej listy', /else if\(pi>=0\) polowiczneUrl\.splice\(pi,1\);/.test(zbieracz));
  sprawdz('tura ponowień bierze i nieudane, i połowiczne',
    /var doPonowienia = nieudaneUrl\.concat\(polowiczneUrl\.filter\(function\(u\)\{ return nieudaneUrl\.indexOf\(u\)<0; \}\)\);/.test(zbieracz));
  sprawdz('ponawiamy, dopóki jest co dobierać', /if\(!PRZERWANO_CZASEM && !koniec\.bezSensu && doPonowienia\.length\)\{/.test(zbieracz));
  // Bez tego warunku ponowienia chodziłyby w kółko, gdy ŁNP naprawdę nie ma drugiego składu.
  sprawdz('tura, która nic nie odzyskała, kończy ponawianie', /koniec\.bezSensu = true;/.test(zbieracz));
}

console.log('\n4. Lista meczów prosto z danych ŁNP');
{
  // Sprawdzone na żywej stronie CLJ U-19 (25.09.2026): w dokumencie nie ma ANI JEDNEGO odnośnika
  // do meczu, więc klikanie w wiersze było jedyną drogą — i gubiło mecze po każdym powrocie.
  // API tej samej strony oddaje komplet terminarza (120 pozycji, w tym 56 rozegranych).
  const kod = [
    (zbieracz.match(/function rozegraneZApi\(lista, origin\)\{[\s\S]*?\n\}/) || [])[0],
  ].join('\n');
  if (!kod.trim()) { console.error('Nie znalazłem rozegraneZApi w zbieraczu.'); process.exit(1); }
  const { rozegraneZApi } = new Function(`${kod}\n return { rozegraneZApi };`)();
  const ODP = [
    { matchId: 'a1', state: 'Rozegrany',    queue: 7, host: { name: 'UKS Talent Warszawa' } },
    { matchId: 'b2', state: 'Nierozegrany', queue: 8, host: { name: 'Legia Warszawa S.A.' } },
    { matchId: 'c3', state: 'rozegrany',    queue: 6 },
    { matchId: 'd4', state: 'Odwołany',     queue: 5 },
    { state: 'Rozegrany', queue: 4 },                       // bez identyfikatora — nie ma czego otworzyć
    null,
  ];
  const adresy = rozegraneZApi(ODP, 'https://www.laczynaspilka.pl');
  sprawdz('bierzemy tylko rozegrane', adresy.length === 2, adresy.join(' '));
  sprawdz('„Nierozegrany" nie przechodzi, choć zawiera słowo „rozegran"',
    !adresy.some(a => a.includes('b2')), adresy.join(' '));
  sprawdz('adres zbudowany jak w przeglądarce',
    adresy[0] === 'https://www.laczynaspilka.pl/rozgrywki/mecz/a1', adresy[0]);
  sprawdz('mecz bez identyfikatora pomijany', !adresy.some(a => a.endsWith('/mecz/undefined')));
  sprawdz('pusta odpowiedź nie wywraca zbieracza', rozegraneZApi(null, 'x').length === 0);
}

console.log('\n5. Podpięcie API do przebiegu zbierania');
{
  sprawdz('API pytamy PRZED przewijaniem i klikaniem', /if\(!probowanoApi\)\{[\s\S]{0,400}adresyZApi\(function\(adresy, opis\)\{/.test(zbieracz));
  sprawdz('gdy API oddało mecze — zbieramy je od razu', /linki=adresy; i=0;[\s\S]{0,200}nastepny\(\);/.test(zbieracz));
  sprawdz('gdy API milczy — wracamy do starej drogi', /start\(\);\s*\n\s*\}\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*if\(!rozwiniete\)\{/.test(zbieracz));
  sprawdz('token bierzemy z ukrytej ramki tej samej strony', /f\.src = location\.href;/.test(zbieracz) && /authorization/i.test(zbieracz));
  sprawdz('grupa z adresu strony (parametr „group")', /searchParams\.get\('group'\)/.test(zbieracz));
  sprawdz('lista z API trafia do pamięci na wypadek 404', /zapamietajListe\(adresy\);/.test(zbieracz));
  sprawdz('zapytanie ma własny limit czasu', /setTimeout\(function\(\)\{ gotowe\(\[\], ''\); \}, 20000\)/.test(zbieracz));
}

console.log('\n6. Przewijanie listy meczów — do końca, nie do pierwszych dwóch');
{
  // Sprawdzone na żywej stronie IV ligi warmińsko-mazurskiej (24.09.2026): pierwsze 40 wierszy to
  // spotkania NIEROZEGRANE (kolejki 15…9), a 64 rozegrane doczytują się dopiero po kilkunastu
  // przewinięciach. Reguła „mam dwa wiersze, jadę dalej" zbierała z tego dwa mecze.
  const m = zbieracz.match(/var teraz = Math\.max\(ileLinkow, ileWierszy\);\s*\n\s*if\(teraz > najwiecej\)\{ najwiecej = teraz; bezZmian = 0; \} else bezZmian\+\+;\s*\n\s*var mamy = ([^\n]+);/);
  sprawdz('kończymy dopiero, gdy lista przestanie rosnąć', !!m && /najwiecej >= 2 && bezZmian >= 4/.test(m[1]), m ? m[1] : 'nie znalazłem warunku');

  // Ta sama reguła, przeliczona krok po kroku na prawdziwym przebiegu doczytywania.
  const przebieg = (ilosci) => {
    let najwiecej = 0, bezZmian = 0;
    for (let k = 0; k < ilosci.length; k++) {
      if (ilosci[k] > najwiecej) { najwiecej = ilosci[k]; bezZmian = 0; } else bezZmian++;
      if (najwiecej >= 2 && bezZmian >= 4) return k;          // na którym kroku kończymy przewijanie
    }
    return -1;
  };
  const kroki = [0, 0, 8, 16, 24, 24, 32, 40, 48, 56, 64, 64, 64, 64, 64];
  sprawdz('lista rosnąca 0→64: nie kończymy w połowie', przebieg(kroki) === 14, 'koniec na kroku ' + przebieg(kroki));
  sprawdz('gdy doczyta się wszystko od razu, nie czekamy w nieskończoność',
    przebieg([64, 64, 64, 64, 64, 64]) === 4, 'koniec na kroku ' + przebieg([64, 64, 64, 64, 64, 64]));
  sprawdz('pusta strona nigdy nie uchodzi za gotową', przebieg([0, 0, 0, 0, 0, 0, 0, 0]) === -1);
  sprawdz('limit kroków podniesiony (dłuższe listy doczytują się wolniej)', /var krok=0, MAX=45,/.test(zbieracz));
}

console.log('\n5. Przed zakończeniem jeszcze jedno przewinięcie');
{
  sprawdz('po zebraniu widocznych meczów zbieracz sprawdza, czy niżej nie ma następnych',
    /if\(!poKolejce\.dociagnieto\)\{\s*\n\s*poKolejce\.dociagnieto=true;[\s\S]{0,260}dociagnijStrone\(function\(\)\{ poKolejce\(\); \}\);/.test(zbieracz));
  sprawdz('nowe mecze otwierają prawo do kolejnego przewinięcia', /poKolejce\.dociagnieto=false;\s+\/\/ doszly nowe mecze/.test(zbieracz));
  sprawdz('przejście do następnej kolejki też je zeruje', /clearInterval\(licz\);poKolejce\.dociagnieto=false;linki=teraz;/.test(zbieracz));
}

console.log('\n6. Panel mówi, czy to komplet');
{
  sprawdz('podaje liczbę rozegranych meczów na stronie', /Rozegranych meczow na stronie: /.test(zbieracz));
  sprawdz('ostrzega, gdy brakuje meczów', /To NIE jest komplet — brakuje /.test(zbieracz));
  sprawdz('potwierdza komplet, gdy każdy mecz ma protokół', /Komplet kolejki — kazdy rozegrany mecz ma protokol\./.test(zbieracz));
  sprawdz('mówi o protokołach z jednym składem', /Protokoly z jednym skladem: /.test(zbieracz));
  sprawdz('na stronie jednego meczu nie straszy brakiem kolejki', /if\(!widzianeMecze\.length \|\| trybJedenMecz\) return '';/.test(zbieracz));
}

console.log('\n7. Zakładka naprawdę pobiera świeży zbieracz');
{
  // Sprawdzone 25.09.2026 z poziomu strony ŁNP: fetch z „scoutbasesystem.com" pada („Failed to
  // fetch"), bo adres bez „www" odpowiada przekierowaniem 308 bez nagłówka CORS. Zakładka cicho
  // wracała wtedy do kopii wbudowanej sprzed miesięcy — i żadna poprawka nie docierała.
  const bm = (glowny.match(/const zakladkaSamoaktualizujaca = \(sciezka, kodAwaryjny\) => `[\s\S]*?`;/) || [])[0] || '';
  sprawdz('próbuje obu postaci adresu (z „www" i bez)', /ADRESY\.push\(\/\^www/.test(bm), bm ? 'jest kod, brak fallbacku' : 'nie znalazłem zakładki');
  sprawdz('nieudane pobranie przechodzi do następnego adresu, nie od razu do starej kopii',
    /\.catch\(function\(\)\{ pobierz\(n\+1\); \}\);/.test(bm));
  sprawdz('dopiero po wyczerpaniu adresów wchodzi kopia awaryjna',
    /if\(n>=ADRESY\.length\)\{ odpal\(function\(\)\{ try\{window\.__SBS_STARA=1;\}catch\(e\)\{\} awaryjnie\(\); \}\); return; \}/.test(bm));
  sprawdz('adres do odsyłania protokołów zostaje ten, z którego otwarto SBS',
    /var A=[^\n]*\n\s*try\{window\.__SBS_ADRES=A;\}catch\(e\)\{\}/.test(bm));
  sprawdz('strona błędu nie jest brana za zakładkę', /if\(t\.length<120 \|\| \/\^\\\\s\*<\/\.test\(t\)\) throw 0;/.test(bm), bm.slice(0, 40));

  // WSZYSTKIE zakładki idą tą samą drogą — Transfermarkt i pojedynczy protokół też.
  const ZAKLADKI = ['LNP_HURT_BOOKMARKLET', 'LNP_BOOKMARKLET', 'TM_PROFIL_BOOKMARKLET', 'TM_BOOKMARKLET',
    'TM_AGENT_BOOKMARKLET', 'TM_AGENCIES_BOOKMARKLET', 'TM_AGENCY_STAFF_BOOKMARKLET', 'TM_AGENCY_SQUAD_BOOKMARKLET'];
  ZAKLADKI.forEach(z => {
    const m = glowny.match(new RegExp(`const ${z} = zakladkaSamoaktualizujaca\\('([^']+)', (\\w+)\\);`));
    sprawdz(`${z} pobiera się z serwera`, !!m, 'nadal wpisana na sztywno w pasek');
    if (m) sprawdz(`  ${m[1]} — plik jest w public`, fs.existsSync('public' + m[1]));
  });
  sprawdz('pliki zakładek mają nagłówek pozwalający pobrać je z obcej strony (CORS)',
    /"source": "\/zakladki\/\(\.\*\)"/.test(fs.readFileSync('vercel.json', 'utf8'))
    && /"source": "\/zakladka-lnp-v2\.js"/.test(fs.readFileSync('vercel.json', 'utf8')));
}

console.log('\n8. Wersja zakładki zgodna z aplikacją');
{
  const wZbieraczu = (zbieracz.match(/var SBS_ZBIERACZ="([^"]+)"/) || [])[1];
  const wAplikacji = (glowny.match(/const ZAKLADKA_WERSJA = '([^']+)'/) || [])[1];
  sprawdz(`ta sama wersja po obu stronach (${wZbieraczu})`, !!wZbieraczu && wZbieraczu === wAplikacji,
    `zbieracz: ${wZbieraczu}, aplikacja: ${wAplikacji}`);
  sprawdz('zakładka pobiera świeży zbieracz z serwera (bez wymiany na pasku)',
    /const LNP_HURT_BOOKMARKLET = zakladkaSamoaktualizujaca\('\/zakladka-lnp-v2\.js', LNP_ZBIERACZ\);/.test(glowny));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
