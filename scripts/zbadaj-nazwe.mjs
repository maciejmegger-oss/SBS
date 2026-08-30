// Pokazuje, dlaczego konkretna nazwa z ŁNP trafia (albo nie trafia) w klub z kartoteki.
// Uruchomienie:  SBS_KLUCZ=<klucz> node scripts/zbadaj-nazwe.mjs "KS Legionovia"
import fs from "node:fs";

const B = 'https://hzindymcagvmjyamlxwn.supabase.co';
const K = process.env.SBS_KLUCZ;
const NAZWA = process.argv[2];
if(!K || !NAZWA){ console.error('Uzycie: SBS_KLUCZ=<klucz> node scripts/zbadaj-nazwe.mjs "<nazwa z LNP>"'); process.exit(1); }

const zrodlo = fs.readFileSync('src/main.ts', 'utf8');
const wytnij = (etykieta, wzor)=>{
  const m = zrodlo.match(wzor);
  if(!m){ console.error('Nie znalazlem w src/main.ts: ' + etykieta); process.exit(1); }
  return m[0];
};
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

const modul = `
const DB = { clubs: ${JSON.stringify(kluby)}, players: [], settings: {} };
const wielkoscKartoteki = ()=> 0;
` + czesci.join('\n') + '\nexport { dopasujKlubDoNazwy, rozbijNazweKlubu, tenSamCzlon, importNorm };\n';
const plik = 'node_modules/.sbs-zbadaj.mjs';
fs.writeFileSync(plik, modul, 'utf8');
const M = await import('../' + plik + '?v=' + modul.length);

const a = M.rozbijNazweKlubu(NAZWA);
console.log(`Nazwa z ŁNP: „${NAZWA}"`);
console.log(`Rdzeń po odsianiu szumu: ${JSON.stringify(a.rdzen)}${a.numer ? ' (zespół ' + a.numer + ')' : ''}\n`);

const kandydaci = kluby.filter(c=>{
  const b = M.rozbijNazweKlubu(c.name);
  if(a.numer !== b.numer) return false;
  if(!a.rdzen.length || !b.rdzen.length) return false;
  const wspolne = a.rdzen.filter(x=>b.rdzen.some(y=>M.tenSamCzlon(x,y)));
  if(!wspolne.length) return false;
  return wspolne.length === Math.min(a.rdzen.length, b.rdzen.length) && wspolne.some(x=>x.length>=4);
});
console.log(`Kandydaci po samej nazwie (${kandydaci.length}):`);
kandydaci.forEach(c=>console.log('   ' + c.name.padEnd(34) + '[' + c.league + ']  ' + JSON.stringify(M.rozbijNazweKlubu(c.name).rdzen)));

const wIV = kandydaci.filter(c=>String(c.league||'').toLowerCase().startsWith('iv liga'));
console.log(`\nPo odcięciu innych poziomów rozgrywek (${wIV.length}): ${wIV.map(c=>c.name).join(' | ') || '(brak)'}`);

const trafiony = M.dopasujKlubDoNazwy(NAZWA, '', 'IV liga');
console.log(`\nWYNIK: ${trafiony ? trafiony.name + ' [' + trafiony.league + ']' : 'brak — do wskazania ręką'}`);
