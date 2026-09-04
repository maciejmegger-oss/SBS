// Sprawdza dopasowanie rozgrywek i podpowiedzi przy brakującym klubie — na PRAWDZIWYCH
// funkcjach wyciętych z src/main.ts.
//
// Uruchomienie:  node scripts/test-podpowiedzi-klubow.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

const wTychRozgrywkach = new Function(
  wytnij('wTychRozgrywkach', /function wTychRozgrywkach\(liga, wskazanie\)\{[\s\S]*?\n\}/)
    .replace(/function wTychRozgrywkach/, 'function f') + '; return f;')();

// Bierzemy PRAWDZIWY rozbiór nazwy z aplikacji — razem z całym łańcuchem, na którym stoi.
// Atrapy dawałyby inne człony nazwy niż produkcja i test przestałby cokolwiek znaczyć.
const czesci = [
  wytnij('importNorm', /const importNorm = [\s\S]*?\.replace\(\/\[\^a-z0-9\]\/g,''\);/),
  wytnij('SZUM_NAZWY_KLUBU', /const SZUM_NAZWY_KLUBU = \/\^\([\s\S]*?\)\$\/;/),
  wytnij('NUMER_ZESPOLU', /const NUMER_ZESPOLU = \{[\s\S]*?\};/),
  wytnij('SKROTY_NAZWY', /const SKROTY_NAZWY = \{[\s\S]*?\};/),
  wytnij('rozwinSkroty', /const rozwinSkroty = .*;/),
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/),
];
const rozbij = new Function(czesci.join('\n') + '\nreturn rozbijNazweKlubu;')();

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

// 1. Poziom bez wskazanej grupy musi obejmować wszystkie jej grupy.
console.log('1. Dopasowanie rozgrywek');
[
  ['IV liga (dolnośląska)', 'IV liga', true],
  ['IV liga (śląska)', 'IV liga', true],
  ['III liga, gr. III', 'III liga', true],
  ['CLJ U17 gr. II', 'CLJ U17', true],
  ['IV liga (dolnośląska)', 'IV liga (dolnośląska)', true],
  ['IV liga (śląska)', 'IV liga (dolnośląska)', false],
  ['II liga', 'IV liga', false],
  ['IV liga (śląska)', '', false],
].forEach(([liga, wskazanie, ma]) => {
  sprawdz(`„${liga}" ${ma ? 'należy' : 'nie należy'} do „${wskazanie || '(puste)'}"`,
    wTychRozgrywkach(liga, wskazanie) === ma);
});

// 2. Podpowiedzi: miasto ma ważyć więcej niż powtarzalna nazwa własna.
console.log('\n2. Podpowiedzi przy brakującym klubie');
const KLUBY = ['Polonia Chodzież', 'Polonia Nysa', 'Polonia Lidzbark Warmiński',
  'Polonia Świdnica', 'Śląsk Świdnica', 'Górnik Polkowice'];

// Ta sama logika, którą stosuje aplikacja — wycięta z bloku podpowiedzi.
function podpowiedzi(nazwa, kluby) {
  const rdzen = rozbij(nazwa).rdzen;
  const miastoZ = (czlony) => czlony.length ? czlony[czlony.length - 1] : '';
  const naszeMiasto = miastoZ(rdzen);
  return [...new Set(kluby.map(n => {
    const jego = rozbij(n).rdzen;
    const wspolne = jego.filter(x => rdzen.includes(x)).length;
    if (!wspolne) return null;
    return { nazwa: n, waga: wspolne + (naszeMiasto && jego.includes(naszeMiasto) ? 5 : 0) };
  }).filter(Boolean).sort((a, b) => b.waga - a.waga).map(x => x.nazwa))].slice(0, 3);
}

const dla = podpowiedzi('IGNERHOME MKS POLONIA ŚWIDNICA', KLUBY);
console.log('   ' + dla.join(', '));
sprawdz('klub z właściwego miasta jest PIERWSZY', dla[0] === 'Polonia Świdnica', dla.join(', '));
sprawdz('drugi klub z tego samego miasta też się łapie', dla.includes('Śląsk Świdnica'), dla.join(', '));
sprawdz('Polonia z obcego miasta nie wypycha właściwej', dla.indexOf('Polonia Świdnica') < dla.indexOf('Polonia Nysa')
  || !dla.includes('Polonia Nysa'));

// 3. Gdy klubu z tego miasta nie ma — dalej podpowiadamy po nazwie własnej, żeby nie zostawić pustki.
{
  const bezSwidnicy = KLUBY.filter(n => !/Świdnica/.test(n));
  const d = podpowiedzi('IGNERHOME MKS POLONIA ŚWIDNICA', bezSwidnicy);
  console.log('\n3. Brak klubu z tego miasta');
  console.log('   ' + d.join(', '));
  sprawdz('podpowiedź nadal jest', d.length > 0);
  sprawdz('to Polonie z innych miast', d.every(n => /Polonia/.test(n)), d.join(', '));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
