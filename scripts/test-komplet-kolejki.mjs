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

console.log('\n4. Panel mówi, czy to komplet');
{
  sprawdz('podaje liczbę rozegranych meczów na stronie', /Rozegranych meczow na stronie: /.test(zbieracz));
  sprawdz('ostrzega, gdy brakuje meczów', /To NIE jest komplet — brakuje /.test(zbieracz));
  sprawdz('potwierdza komplet, gdy każdy mecz ma protokół', /Komplet kolejki — kazdy rozegrany mecz ma protokol\./.test(zbieracz));
  sprawdz('mówi o protokołach z jednym składem', /Protokoly z jednym skladem: /.test(zbieracz));
  sprawdz('na stronie jednego meczu nie straszy brakiem kolejki', /if\(!widzianeMecze\.length \|\| trybJedenMecz\) return '';/.test(zbieracz));
}

console.log('\n5. Wersja zakładki zgodna z aplikacją');
{
  const wZbieraczu = (zbieracz.match(/var SBS_ZBIERACZ="([^"]+)"/) || [])[1];
  const wAplikacji = (glowny.match(/const ZAKLADKA_WERSJA = '([^']+)'/) || [])[1];
  sprawdz(`ta sama wersja po obu stronach (${wZbieraczu})`, !!wZbieraczu && wZbieraczu === wAplikacji,
    `zbieracz: ${wZbieraczu}, aplikacja: ${wAplikacji}`);
  sprawdz('zakładka pobiera świeży zbieracz z serwera (bez wymiany na pasku)',
    /fetch\(A\+'\/zakladka-lnp-v2\.js\?t='\+Date\.now\(\)/.test(glowny));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
