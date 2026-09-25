// Sprawdza, czy pigułki rozgrywek juniorskich pokazują logo Centralnej Ligi Juniorów
// zamiast samego numerka — na PRAWDZIWYM kodzie z src/main.ts.
//
// Zgłoszenie (25.09.2026): „wgraj herby miniaturki do CLJ" — ligi seniorskie mają w przyciskach
// swoje znaki, a CLJ U19 / U17 / U15 stały z samymi kolorowymi kółkami, choć logo jest wgrane
// na Dashboardzie.
//
// Uruchomienie:  node scripts/test-logo-clj-w-pigulkach.mjs
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
  wytnij('BARWY_RODZIN', /const BARWY_RODZIN = \[[\s\S]*?\n\];/),
  wytnij('LOGO_JUNIORSKIE', /const LOGO_JUNIORSKIE = \[[^\]]*\];/),
  wytnij('LOGO_WBUDOWANE', /const LOGO_WBUDOWANE = \{[^}]*\};/),
  wytnij('LOGO_ZPN', /const LOGO_ZPN = \{[\s\S]*?\n?\};/),
  wytnij('IV_LIGA_WG_ZPN', /const IV_LIGA_WG_ZPN = \{[\s\S]*?\n\};/),
  wytnij('zpnGrupy', /const zpnGrupy = \(nazwaGrupy\)=>\{[\s\S]*?\n\};/),
  wytnij('leagueLogoImg', /function leagueLogoImg\(topLevel, size, naCiemnym, proporcja = 0\.62\)\{[\s\S]*?\n\}/),
  wytnij('rodzinaCLJ', /function rodzinaCLJ\(nazwaGrupy\)\{[\s\S]*?\n\}/),
  wytnij('znaczekGrupy', /function znaczekGrupy\(nazwaGrupy, nr, aktywny\)\{[\s\S]*?\n\}/),
].join('\n');

const zbuduj = (logos) => new Function('DB', 'esc',
  `${kod}\n return { znaczekGrupy, rodzinaCLJ, leagueLogoImg, zpnGrupy };`)({ settings: { leagueLogos: logos } }, (s) => String(s));

const LOGO = { 'CLJ U19': 'data:image/png;base64,U19', 'CLJ U17': 'data:image/png;base64,U17', 'CLJ U15': 'data:image/png;base64,U15' };
const zLogo = zbuduj(LOGO);
const bezLogo = zbuduj({});

console.log('\n1. Rodzina rozgrywek — jedno logo dla wszystkich grup kategorii');
sprawdz('CLJ U19 → CLJ U19', zLogo.rodzinaCLJ('CLJ U19') === 'CLJ U19');
sprawdz('CLJ U17 gr. II → CLJ U17', zLogo.rodzinaCLJ('CLJ U17 gr. II') === 'CLJ U17');
sprawdz('CLJ U15 gr. C → CLJ U15', zLogo.rodzinaCLJ('CLJ U15 gr. C') === 'CLJ U15');
sprawdz('zapis z myślnikiem („CLJ U-17") też rozpoznany', zLogo.rodzinaCLJ('CLJ U-17 gr. I') === 'CLJ U17');
sprawdz('Liga makroregionalna U16 to nie CLJ', zLogo.rodzinaCLJ('Liga makroregionalna U16') === '');
sprawdz('rocznik to nie CLJ', zLogo.rodzinaCLJ('Rocznik 2013') === '');

console.log('\n2. Pigułka z logo');
{
  const u17 = zLogo.znaczekGrupy('CLJ U17 gr. II', 2, false);
  sprawdz('U17 dostaje swoje logo', u17.includes('base64,U17'), u17.slice(0, 80));
  sprawdz('U15 gr. D dostaje logo U15', zLogo.znaczekGrupy('CLJ U15 gr. D', 7, false).includes('base64,U15'));
  sprawdz('to obrazek, nie kółko z numerem', u17.startsWith('<img') && !u17.includes('border-radius:50%'));
  sprawdz('logo mieści się w pigułce (22 px)', /max-width:22px/.test(u17), u17.slice(0, 120));
  sprawdz('wybrana pigułka daje logu jasną podkładkę (ciemne znaki na ciemnym tle znikają)',
    zLogo.znaczekGrupy('CLJ U19', 1, true).includes('background:#fff'));
}

console.log('\n3. Bez wgranego logo zostaje numerek — nic nie znika z ekranu');
{
  const u17 = bezLogo.znaczekGrupy('CLJ U17 gr. II', 2, false);
  sprawdz('kółko z liczbą porządkową', u17.includes('border-radius:50%') && u17.includes('>2</span>'), u17.slice(0, 90));
  sprawdz('barwa rodziny zachowana', /background:var\(--good\)/.test(u17), u17.slice(0, 160));
  sprawdz('makroregionalna U16 zawsze numerkiem', zLogo.znaczekGrupy('Liga makroregionalna U16', 8, false).includes('border-radius:50%'));
}

console.log('\n4. Pigułka „Kategorie juniorskie" — własnego kafla nie ma, bierze znak CLJ');
{
  const pig = zLogo.leagueLogoImg('Kategorie juniorskie', 30, false, 0.9);
  sprawdz('zamiast zastępki „MŁ" jest logo', pig.startsWith('<img'), pig.slice(0, 70));
  sprawdz('to znak CLJ (czerwony, spod U15)', pig.includes('base64,U15'), pig.slice(0, 70));
  sprawdz('gdy U15 nie ma, wchodzi U17',
    zbuduj({ 'CLJ U17': 'x17', 'CLJ U19': 'x19' }).leagueLogoImg('Kategorie juniorskie', 30, false, 0.9).includes('x17'));
  sprawdz('bez żadnego logo CLJ zostaje zastępka „MŁ"',
    bezLogo.leagueLogoImg('Kategorie juniorskie', 30, false, 0.9).includes('MŁ'));
  sprawdz('ligi seniorskie nie podbierają logo juniorom',
    !zLogo.leagueLogoImg('IV liga', 30, false, 0.9).includes('base64,U15'));
}

console.log('\n5. IV liga — znak wgrany do programu na stałe');
{
  const pig = bezLogo.leagueLogoImg('IV liga', 30, false, 0.9);
  sprawdz('pigułka pokazuje logo, nie cyfrę „4"', pig.startsWith('<img') && pig.includes('/logo-iv-liga.jpg'), pig.slice(0, 80));
  sprawdz('plik leży w public i pojedzie z wdrożeniem', fs.existsSync('public/logo-iv-liga.jpg'));
  sprawdz('własne logo z Ustawień ma pierwszeństwo',
    zbuduj({ 'IV liga': 'data:image/png;base64,MOJE' }).leagueLogoImg('IV liga', 30, false, 0.9).includes('base64,MOJE'));
  sprawdz('III liga dalej bierze swoje wgrane logo albo zastępkę',
    bezLogo.leagueLogoImg('III liga', 30, false, 0.9).includes('>3<'));
}

console.log('\n6. Grupy IV ligi — herb wojewódzkiego ZPN');
{
  sprawdz('„IV liga (kujawsko-pomorska)" → Kujawsko-Pomorski ZPN',
    zLogo.zpnGrupy('IV liga (kujawsko-pomorska)') === 'Kujawsko-Pomorski ZPN', String(zLogo.zpnGrupy('IV liga (kujawsko-pomorska)')));
  sprawdz('„IV liga (śląska)" → Śląski ZPN', zLogo.zpnGrupy('IV liga (śląska)') === 'Śląski ZPN');
  sprawdz('wszystkie szesnaście grup ma swój związek',
    ['dolnośląska','kujawsko-pomorska','lubelska','lubuska','łódzka','małopolska','mazowiecka','opolska','podkarpacka',
     'podlaska','pomorska','śląska','świętokrzyska','warmińsko-mazurska','wielkopolska','zachodniopomorska']
      .every(g => zLogo.zpnGrupy(`IV liga (${g})`)));
  sprawdz('CLJ to nie IV liga', zLogo.zpnGrupy('CLJ U17 gr. I') === '');

  const zHerbem = zbuduj({ 'Kujawsko-Pomorski ZPN': 'data:image/png;base64,KPZPN' });
  const pig = zHerbem.znaczekGrupy('IV liga (kujawsko-pomorska)', 6, false);
  sprawdz('pigułka pokazuje herb związku', pig.startsWith('<img') && pig.includes('base64,KPZPN'), pig.slice(0, 80));
  sprawdz('herb ma rozmiar znaczka (22 px)', /width:22px;height:22px/.test(pig), pig.slice(0, 120));
  sprawdz('na wybranej pigułce jasna podkładka', zHerbem.znaczekGrupy('IV liga (kujawsko-pomorska)', 6, true).includes('background:#fff'));
  sprawdz('grupa bez żadnego herbu zostaje z numerem',
    zHerbem.znaczekGrupy('Liga makroregionalna U16', 8, false).includes('border-radius:50%'));
  sprawdz('herb ZPN nie wchodzi do pigułek CLJ',
    zHerbem.znaczekGrupy('CLJ U15 gr. A', 4, false).includes('border-radius:50%'));
}
{
  // Herby wgrane do programu — każdy wpis musi wskazywać PLIK, KTÓRY ISTNIEJE. Zła ścieżka daje
  // w pigułce pusty kwadrat, a to gorsze niż numerek, bo wygląda na zepsutą stronę.
  const wpisy = [...zrodlo.matchAll(/'([^']*ZPN)':\s*'(\/zpn\/[^']+)'/g)].map(m => ({ zpn: m[1], plik: m[2] }));
  sprawdz(`komplet szesnastu herbów wgranych do programu (${wpisy.length})`, wpisy.length === 16, String(wpisy.length));
  const WOJEWODZTWA = ['dolnośląska','kujawsko-pomorska','lubelska','lubuska','łódzka','małopolska','mazowiecka','opolska',
    'podkarpacka','podlaska','pomorska','śląska','świętokrzyska','warmińsko-mazurska','wielkopolska','zachodniopomorska'];
  wpisy.forEach(({ zpn, plik }) => {
    sprawdz(`${zpn} → ${plik}`,
      fs.existsSync('public' + plik) && WOJEWODZTWA.some(g => zLogo.zpnGrupy(`IV liga (${g})`) === zpn),
      fs.existsSync('public' + plik) ? 'nazwa związku nie pasuje do żadnej grupy IV ligi' : 'brak pliku');
    // Pigułka tego związku ma faktycznie pokazać herb, a nie numer.
    const grupa = WOJEWODZTWA.map(g => `IV liga (${g})`).find(g => zLogo.zpnGrupy(g) === zpn);
    sprawdz(`  pigułka „${grupa}" pokazuje herb`, bezLogo.znaczekGrupy(grupa, 1, false).includes(plik));
  });
}

console.log('\n7. Podpięcie');
sprawdz('pigułki grup nadal biorą znaczek z znaczekGrupy',
  /nr \? znaczekGrupy\(g, nr, clubBrowse\.group===val\) : ''/.test(zrodlo));
sprawdz('logo bierzemy z tych samych ustawień, co kafle Dashboardu',
  /DB\.settings\.leagueLogos\[rodzina\]/.test(zrodlo) && zrodlo.includes("'CLJ U19','CLJ U17','CLJ U15'"));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
