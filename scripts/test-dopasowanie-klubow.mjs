// Sprawdza dopasowanie nazw klubów z ŁNP do kartoteki — na PRAWDZIWYM kodzie i PRAWDZIWEJ bazie.
//
// Test nie przepisuje logiki po swojemu, tylko wycina funkcje wprost z src/main.ts i uruchamia je
// na kompletnej liście klubów z Supabase. Wcześniejsza wersja miała własną kopię reguł i przez to
// potrafiła pokazać „wszystko gra", kiedy aplikacja gubiła klub — kopia rozjeżdżała się z kodem.
//
// Uruchomienie:  SBS_KLUCZ=<klucz serwisowy> node scripts/test-dopasowanie-klubow.mjs
import fs from "node:fs";

const B = 'https://hzindymcagvmjyamlxwn.supabase.co';
const K = process.env.SBS_KLUCZ;
if(!K){ console.error('Brak SBS_KLUCZ w środowisku.'); process.exit(1); }

const zrodlo = fs.readFileSync('src/main.ts', 'utf8');

// Wycinamy dokładnie te fragmenty, na których stoi dopasowanie. Gdy któregoś zabraknie, test ma
// paść głośno — cicha luka znaczyłaby, że sprawdzamy coś innego niż aplikacja.
function wytnij(nazwa, wzor){
  const m = zrodlo.match(wzor);
  if(!m){ console.error('Nie znalazłem w src/main.ts: ' + nazwa); process.exit(1); }
  return m[0];
}
const czesci = [
  wytnij('importNorm', /const importNorm = [\s\S]*?\.replace\(\/\[\^a-z0-9\]\/g,''\);/),
  wytnij('SZUM_NAZWY_KLUBU', /const SZUM_NAZWY_KLUBU = \/\^\([\s\S]*?\)\$\/;/),
  wytnij('NUMER_ZESPOLU', /const NUMER_ZESPOLU = \{[\s\S]*?\};/),
  wytnij('SKROTY_NAZWY', /const SKROTY_NAZWY = \{[\s\S]*?\};/),
  wytnij('rozwinSkroty', /const rozwinSkroty = .*;/),
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/),
  wytnij('tenSamCzlon', /const tenSamCzlon = \(x, y\)=>\{[\s\S]*?\n\};/),
  wytnij('odciskKlubu', /const odciskKlubu = \(nazwa\)=>\{[\s\S]*?\};/),
  wytnij('dopasujKlubDoNazwy', /function dopasujKlubDoNazwy\(nazwa, podpowiedzGrupa, poziom\)\{[\s\S]*?\n\}/),
];

const h = { apikey: K, Authorization: 'Bearer ' + K };
const kluby = [];
for(let od = 0; ; od += 1000){
  const r = await (await fetch(`${B}/rest/v1/sbs_clubs?select=id,name,league&order=id&offset=${od}&limit=1000`, { headers: h })).json();
  if(!Array.isArray(r) || !r.length) break;
  kluby.push(...r);
  if(r.length < 1000) break;
}

// Aplikacja czyta DB.clubs i DB.players; podstawiamy jedno i drugie.
const glowa = `
const DB = { clubs: __KLUBY__, players: [], settings: {} };
const wielkoscKartoteki = (klub)=> 0;
`.replace('__KLUBY__', JSON.stringify(kluby.map(c=>({ id:c.id, name:c.name, league:c.league }))));

const modul = glowa + czesci.join('\n') + '\nexport { dopasujKlubDoNazwy, rozbijNazweKlubu };\n';
const plik = 'node_modules/.sbs-dopasowanie.mjs';
fs.writeFileSync(plik, modul, 'utf8');
const { dopasujKlubDoNazwy } = await import('../' + plik + '?v=' + kluby.length + '-' + modul.length);

// Nazwy tak, jak wypisuje je ŁNP w protokołach — razem z tym, co ma z nich wyjść w kartotece.
// Puste oczekiwanie znaczy: ma NIE zgadnąć i poprosić o wskazanie ręką.
const PRZYPADKI = [
  ['MKS Limanovia w Limanowej',    'Limanovia Limanowa'],
  ['RKS Ursus W-wa',               'Ursus Warszawa'],
  ['MKS PODLASIE SOKOŁÓW PODL.',   'Podlasie Sokołów Podlaski'],
  ['SS HUTNIK W-WA SP. Z O.O.',    'Hutnik Warszawa'],
  ['Enea Energia Kozienice',       'Energia Kozienice'],
  ['UKS Talent Warszawa',          'Talent Warszawa'],
  ['MKS PIASECZNO',                'MKS Piaseczno'],
  ['LKS Mazur Karczew',            'Mazur Karczew'],
  ['BKS Hal-Mont Bochnia',         'BKS Hal-Mont Bochnia'],
  ['GKS LZS Wikielec',             'GKS Wikielec'],
  ['KKS Granica Kętrzyn',          'Granica Kętrzyn'],
  ['UKS Naki Olsztyn',             'Naki Olsztyn'],
  // Tych klubów w bazie NIE MA, a każdy dzieli mocny człon z dokładnie jednym klubem IV ligi.
  // Muszą zostać nierozpoznane — inaczej dorobek całej drużyny trafiłby nie temu klubowi.
  ['Granica Bogatynia',            null],   // w bazie jest Granica Kętrzyn
  ['Naki Gdańsk',                  null],   // w bazie jest Naki Olsztyn
  ['Pcimianka Kraków',             null],   // w bazie jest Pcimianka Pcim
  ['Limanovia Nowy Sącz',          null],   // w bazie jest Limanovia Limanowa
];

let bledy = 0;
console.log(`Klubów w bazie: ${kluby.length}\n`);
for(const [lnp, oczekiwany] of PRZYPADKI){
  const k = dopasujKlubDoNazwy(lnp, '', 'IV liga');
  const dostal = k ? k.name : null;
  const ok = dostal === oczekiwany;
  if(!ok) bledy++;
  console.log(`  ${ok ? 'OK  ' : 'ŹLE '} „${lnp}"`.padEnd(46) + '-> ' + (dostal ?? 'brak (do wskazania ręką)')
    + (ok ? '' : `   OCZEKIWANO: ${oczekiwany ?? 'brak'}`));
}

// Żaden klub z IV ligi nie może przez poluzowanie reguł trafić w inny klub niż własny.
let pomylki = 0;
for(const c of kluby.filter(x=>/^IV liga/.test(String(x.league||'')))){
  const k = dopasujKlubDoNazwy(c.name, '', 'IV liga');
  if(k && k.id !== c.id && k.name !== c.name){
    pomylki++;
    if(pomylki <= 10) console.log(`  POMYŁKA: „${c.name}" [${c.league}] -> ${k.name} [${k.league}]`);
  }
}
console.log(`\nKlubów IV ligi wskazujących na inny klub: ${pomylki}`);
console.log(bledy || pomylki ? `\nBŁĘDY: ${bledy + pomylki}` : '\nWszystko zgodne z oczekiwaniem.');
process.exit(bledy || pomylki ? 1 : 0);
