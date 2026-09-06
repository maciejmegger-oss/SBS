// Wstawia na mapę pozycji młodzieżowców z rozegranymi minutami — od Ekstraklasy do III ligi.
//
// PO CO: mapa uzupełnia się sama, ale dopiero po otwarciu widoku Ranking dla każdej ligi z osobna
// i tylko z kandydatów, którzy „kwalifikują się" (Monitoring albo status decyzyjny). Młodzieżowcy
// z realnym stażem ligowym są dokładnie tą pulą, którą chcemy mieć pod ręką od razu — bez
// przeklikiwania kilkunastu grup.
//
// PRÓG 270 MINUT to trzy pełne mecze. Poniżej tego trudno mówić o ogranym zawodniku, a mapa
// zapełniłaby się nazwiskami z jednego wejścia z ławki.
//
// CZEGO NIE RUSZAMY: przypisań już istniejących. Kto stoi na mapie, zostaje na swoim miejscu —
// dokładamy wyłącznie do wolnych miejsc, bo mapa jest miejscem pracy skauta, a nie wydrukiem
// z bazy. Limit sześciu na pozycję i zasada „jeden zawodnik w jednym polu" obowiązują tak samo
// jak w aplikacji.
//
// Uruchomienie:  SBS_KLUCZ=<klucz> node scripts/mapa-mlodziezowcy.mjs [--zapisz]
import fs from "node:fs";

const B = 'https://hzindymcagvmjyamlxwn.supabase.co';
const K = process.env.SBS_KLUCZ;
const NAPRAWDE = process.argv.includes('--zapisz');
const PROG_MINUT = 270;
if(!K){ console.error('Brak SBS_KLUCZ w środowisku.'); process.exit(1); }

const h = { apikey: K, Authorization: 'Bearer ' + K };
const hZapis = { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

// Tabelę pozycji bierzemy wprost z aplikacji, żeby numery i nazwy nie rozjechały się z mapą.
const zrodlo = fs.readFileSync('src/main.ts', 'utf8');
const blok = zrodlo.match(/const POSITION_NUMBERS = \[[\s\S]*?\n\];/);
if(!blok){ console.error('Nie znalazłem POSITION_NUMBERS w src/main.ts.'); process.exit(1); }
const POSITION_NUMBERS = eval(blok[0].replace(/^\s*const POSITION_NUMBERS = /, '').replace(/;$/, ''));

const POZIOMY = ['Ekstraklasa', 'I liga', 'II liga', 'III liga'];
const wZakresie = (liga)=> POZIOMY.some(p=>liga === p || liga.startsWith(p + ','));
const kluczMapy = (liga, numer)=> `${liga}|||wszystkie|||${numer}`;

const kluby = [];
for(let od = 0; ; od += 1000){
  const r = await (await fetch(`${B}/rest/v1/sbs_clubs?select=id,name,league&order=id&offset=${od}&limit=1000`, { headers: h })).json();
  if(!Array.isArray(r) || !r.length) break;
  kluby.push(...r); if(r.length < 1000) break;
}
const klubyWZakresie = kluby.filter(c=>wZakresie(String(c.league || '')));

// Kandydaci: młodzieżowiec (rocznik 2006+ albo znacznik z protokołu PZPN), próg minut, wpisana pozycja.
const kandydaci = [];
for(const c of klubyWZakresie){
  const p = await (await fetch(`${B}/rest/v1/sbs_players?select=id,first_name,last_name,birth_year,position,minutes,custom_fields&club_id=eq.${encodeURIComponent(c.id)}&limit=300`, { headers: h })).json();
  if(!Array.isArray(p)) continue;
  for(const x of p){
    const ext = ((x.custom_fields || {}).__ext) || {};
    const mlody = (x.birth_year && Number(x.birth_year) >= 2006) || ext.mlodziezowiec === true;
    if(!mlody) continue;
    if(Number(x.minutes || 0) < PROG_MINUT) continue;
    const pozycja = String(x.position || '').trim();
    if(!pozycja) continue;
    kandydaci.push({ id: x.id, nazwa: `${x.first_name || ''} ${x.lastName || x.last_name || ''}`.trim(),
      liga: String(c.league || ''), klub: c.name, pozycja, minuty: Number(x.minutes || 0) });
  }
}
console.log(`Młodzieżowców z ${PROG_MINUT}+ minutami i wpisaną pozycją: ${kandydaci.length}\n`);

const wpis = await (await fetch(`${B}/rest/v1/sbs_kv?select=value&key=eq.scouting:position_map_assignments`, { headers: h })).json();
let mapa = (wpis[0] || {}).value;
if(typeof mapa === 'string') mapa = JSON.parse(mapa);
mapa = mapa || {};

// Kto już gdzieś stoi w danej lidze — żeby nie postawić go w dwóch polach naraz.
const stoiWLidze = {};
Object.keys(mapa).forEach(k=>{
  const [liga, formacja] = k.split('|||');
  if(formacja !== 'wszystkie' || k.endsWith('wykluczeni')) return;
  (mapa[k] || []).forEach(id=>{ (stoiWLidze[liga] = stoiWLidze[liga] || new Set()).add(id); });
});

let dodanych = 0, brakMiejsca = 0, juzByli = 0;
const wgLigi = {};

// Najpierw najbardziej ograni — przy sześciu miejscach na pozycję to minuty rozstrzygają, kto wejdzie.
kandydaci.sort((a, b)=> b.minuty - a.minuty);

for(const z of kandydaci){
  const sloty = POSITION_NUMBERS.filter(pn=>pn.posName === z.pozycja);
  if(!sloty.length) continue;
  const juz = (stoiWLidze[z.liga] = stoiWLidze[z.liga] || new Set());
  if(juz.has(z.id)){ juzByli++; continue; }

  // Para pozycji (lewy/prawy) — wchodzimy tam, gdzie jest luźniej, żeby nie zapchać jednej strony.
  const wolne = sloty
    .map(pn=>({ pn, key: kluczMapy(z.liga, pn.number), ile: (mapa[kluczMapy(z.liga, pn.number)] || []).length }))
    .filter(x=>x.ile < 6)
    .sort((a, b)=> a.ile - b.ile);
  if(!wolne.length){ brakMiejsca++; continue; }

  const cel = wolne[0];
  mapa[cel.key] = [...(mapa[cel.key] || []), z.id];
  juz.add(z.id);
  dodanych++;
  wgLigi[z.liga] = (wgLigi[z.liga] || 0) + 1;
  if(dodanych <= 20) console.log(`  ${z.nazwa.padEnd(26)} ${String(z.pozycja).padEnd(20)} → ${cel.pn.number} ${cel.pn.label.padEnd(22)} ${z.liga} (${z.minuty} min)`);
}
if(dodanych > 20) console.log(`  …i ${dodanych - 20} więcej`);

console.log(`\nDodanych na mapę: ${dodanych}`);
console.log(`Już tam byli: ${juzByli}   |   bez wolnego miejsca (komplet 6 na pozycji): ${brakMiejsca}`);
console.log('\nwg ligi:');
Object.entries(wgLigi).sort((a, b)=>b[1] - a[1]).forEach(([l, n])=>console.log(`   ${l.padEnd(20)}${n}`));

if(NAPRAWDE){
  const r = await fetch(`${B}/rest/v1/sbs_kv?key=eq.scouting:position_map_assignments`,
    { method:'PATCH', headers: hZapis, body: JSON.stringify({ value: JSON.stringify(mapa) }) });
  console.log('\nZapis mapy: ' + (r.ok ? 'OK' : 'BŁĄD ' + await r.text()));
} else {
  console.log('\nTo była PRÓBA — nic nie zmieniłem. Dopisz --zapisz, żeby wykonać.');
}
