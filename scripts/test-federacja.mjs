// Sprawdza zakładkę „Federacja" — spis PZPN i szesnastu związków wojewódzkich z danymi kontaktowymi.
//
// Zgłoszenie (25.09.2026): „utworzymy jeszcze jedną zakładkę, nad menedżerami — Federacja.
// Po kliknięciu pojawią się ikonki, a przy nich adresy, telefony, maile i strony związków.
// Jako pierwszy PZPN."
//
// Uruchomienie:  node scripts/test-federacja.mjs
import fs from "node:fs";
import { buildSync } from "esbuild";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

const { outputFiles } = buildSync({
  stdin: { contents: "export { PZPN, ZWIAZKI_WOJEWODZKIE, adresPocztowy } from './src/data/federacja.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: "esm", write: false,
});
const { PZPN, ZWIAZKI_WOJEWODZKIE, adresPocztowy } = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
const zrodlo = fs.readFileSync("src/main.ts", "utf8");

console.log('\n1. Komplet związków');
sprawdz(`szesnaście związków wojewódzkich (${ZWIAZKI_WOJEWODZKIE.length})`, ZWIAZKI_WOJEWODZKIE.length === 16, String(ZWIAZKI_WOJEWODZKIE.length));
sprawdz('PZPN jako pierwszy, osobno', PZPN.nazwa === 'Polski Związek Piłki Nożnej' && PZPN.herb === '/logo-pzpn.png');
sprawdz('ułożone alfabetycznie', JSON.stringify(ZWIAZKI_WOJEWODZKIE.map(z => z.nazwa))
  === JSON.stringify(ZWIAZKI_WOJEWODZKIE.map(z => z.nazwa).slice().sort((a, b) => a.localeCompare(b, 'pl'))));

console.log('\n2. Każdy wpis kompletny i sprawdzalny');
[PZPN, ...ZWIAZKI_WOJEWODZKIE].forEach(z => {
  const braki = ['nazwa', 'herb', 'adres', 'miasto', 'telefon', 'email', 'www'].filter(k => !String(z[k] || '').trim());
  sprawdz(`${z.nazwa}`, !braki.length && fs.existsSync('public' + z.herb)
    && /@/.test(z.email) && /^www\./.test(z.www) && /\d{3}/.test(z.telefon),
    braki.length ? 'brakuje: ' + braki.join(', ') : (fs.existsSync('public' + z.herb) ? 'e-mail/www/telefon nie wygląda poprawnie' : 'brak pliku herbu ' + z.herb));
});

console.log('\n3. Nazwy związków wiążą się z kartoteką klubów');
{
  // Ta sama nazwa musi stać w kartotece klubu („ZPN / Region"), w grupie IV ligi i przy herbie —
  // inaczej kafel nie policzy klubów, a herb rozjedzie się z pigułką ligi.
  const zMainTs = [...zrodlo.matchAll(/'([^']*ZPN)':\s*'(\/zpn\/[^']+)'/g)].map(m => ({ zpn: m[1], plik: m[2] }));
  sprawdz('wszystkie szesnaście ma herb także w pigułkach IV ligi', zMainTs.length === 16, String(zMainTs.length));
  ZWIAZKI_WOJEWODZKIE.forEach(z => {
    const wPigulce = zMainTs.find(x => x.zpn === z.zpn);
    sprawdz(`  ${z.zpn}: ten sam herb w obu miejscach`, !!wPigulce && wPigulce.plik === z.herb,
      wPigulce ? `${wPigulce.plik} vs ${z.herb}` : 'nie ma takiej nazwy w LOGO_ZPN');
  });
}

console.log('\n4. Adres pocztowy — gotowy do koperty');
{
  const lubuski = ZWIAZKI_WOJEWODZKIE.find(z => z.zpn === 'Lubuski ZPN');
  const opolski = ZWIAZKI_WOJEWODZKIE.find(z => z.zpn === 'Opolski ZPN');
  sprawdz('Lubuski ma skrytkę pocztową (PZPN ją podaje)', lubuski.skrytka === 'skr. poczt. 7', String(lubuski.skrytka));
  sprawdz('Opolski ma skrytkę pocztową', opolski.skrytka === 'skr. poczt. 223', String(opolski.skrytka));
  sprawdz('adres do koperty: nazwa, ulica, skrytka, kod i miasto — każde w swojej linii',
    adresPocztowy(lubuski) === 'Lubuski Związek Piłki Nożnej\nul. Ptasia 2a\nskr. poczt. 7\n65-514 Zielona Góra',
    JSON.stringify(adresPocztowy(lubuski)));
  sprawdz('związek bez skrytki nie dostaje pustej linii',
    adresPocztowy(PZPN).split('\n').length === 3, JSON.stringify(adresPocztowy(PZPN)));
  sprawdz('każdy adres ma kod pocztowy',
    [PZPN, ...ZWIAZKI_WOJEWODZKIE].every(z => /^\d{2}-\d{3} /.test(z.miasto)));
  sprawdz('adres w kafelku rozpisany liniami, nie kropką',
    /adres\.map\(l=>`<div>\$\{esc\(l\)\}<\/div>`\)\.join\(''\)/.test(zrodlo));
  sprawdz('przycisk kopiuje cały adres razem z nazwą', /data-action="kopiuj-adres" data-adres="\$\{esc\(adresPocztowy\(z\)\)\}"/.test(zrodlo));
  sprawdz('kopiowanie obsłużone, z zapasem gdy schowek zablokowany',
    /\[data-action="kopiuj-adres"\]/.test(zrodlo) && /document\.execCommand\('copy'\)/.test(zrodlo));
}

console.log('\n5. Podpięcie zakładki');
sprawdz('„Federacja" stoi nad „Menedżerowie"',
  /\{id:"federacja", label:"Federacja"\},\s*\n\s*\{id:"agencies", label:"Menedżerowie"\},/.test(zrodlo));
sprawdz('zakładka ma swój widok', /else if\(currentView==="federacja"\) main\.innerHTML = viewFederacja\(\);/.test(zrodlo));
sprawdz('widok czyta dane z src/data/federacja.ts', /import \{ PZPN, ZWIAZKI_WOJEWODZKIE, adresPocztowy \} from "\.\/data\/federacja";/.test(zrodlo));
sprawdz('telefon i e-mail są odnośnikami (jedno stuknięcie na telefonie)',
  /href="tel:\$\{esc\(telefonCzysty\)\}"/.test(zrodlo) && /href="mailto:\$\{esc\(z\.email\)\}"/.test(zrodlo));
sprawdz('strona związku otwiera się w nowej karcie', /target="_blank" rel="noopener"/.test(zrodlo));
sprawdz('przy związku liczba klubów z bazy', /const ileKlubow = \(zpn\)=> DB\.clubs\.filter/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
