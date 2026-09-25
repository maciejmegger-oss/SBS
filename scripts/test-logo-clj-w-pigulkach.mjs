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
  wytnij('leagueLogoImg', /function leagueLogoImg\(topLevel, size, naCiemnym, proporcja = 0\.62\)\{[\s\S]*?\n\}/),
  wytnij('rodzinaCLJ', /function rodzinaCLJ\(nazwaGrupy\)\{[\s\S]*?\n\}/),
  wytnij('znaczekGrupy', /function znaczekGrupy\(nazwaGrupy, nr, aktywny\)\{[\s\S]*?\n\}/),
].join('\n');

const zbuduj = (logos) => new Function('DB', 'esc',
  `${kod}\n return { znaczekGrupy, rodzinaCLJ };`)({ settings: { leagueLogos: logos } }, (s) => String(s));

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

console.log('\n4. Podpięcie');
sprawdz('pigułki grup nadal biorą znaczek z znaczekGrupy',
  /nr \? znaczekGrupy\(g, nr, clubBrowse\.group===val\) : ''/.test(zrodlo));
sprawdz('logo bierzemy z tych samych ustawień, co kafle Dashboardu',
  /DB\.settings\.leagueLogos\[rodzina\]/.test(zrodlo) && zrodlo.includes("'CLJ U19','CLJ U17','CLJ U15'"));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
