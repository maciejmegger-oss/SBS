// Uzupełnia herby drużyn juniorskich godłem klubu, do którego należą.
//
// PO CO: drużyna U17 czy U19 nosi ten sam herb co pierwsza drużyna — to jeden klub, nie dwa.
// Zbieranie herbów zakładką z ŁNP dla CLJ nie działało (zakładka na pasku ładowała starą wersję),
// a kartoteki juniorskie stały z pustym miejscem na godło. Skoro herb tego samego klubu już mamy
// przy zespole seniorskim, nie ma powodu szukać go drugi raz.
//
// CZEGO NIE ROBIMY: nie ruszamy klubów, które już mają godło, i nie kopiujemy zaślepki ŁNP —
// szara tarcza wyglądałaby jak wgrany herb i ukryła fakt, że godła nadal brakuje.
//
// Uruchomienie:  SBS_KLUCZ=<klucz> node scripts/herby-clj-z-pierwszych-druzyn.mjs [--zapisz]
const B = 'https://hzindymcagvmjyamlxwn.supabase.co';
const K = process.env.SBS_KLUCZ;
const NAPRAWDE = process.argv.includes('--zapisz');
if(!K){ console.error('Brak SBS_KLUCZ w środowisku.'); process.exit(1); }

const h = { apikey: K, Authorization: 'Bearer ' + K };
const hZapis = { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

// Nazwa sprowadzona do samego rdzenia: bez oznaczenia wieku, formy prawnej i skrótu klubowego.
// „KKS Lech Poznań U17" i „Lech Poznań" mają dać to samo.
const rdzen = (s)=> String(s || '').toLowerCase()
  .replace(/[łøđ]/g, c=>({'ł':'l','ø':'o','đ':'d'}[c]))
  .normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/\bu1[6789]\b/g, ' ')
  .replace(/\bs\.?\s?a\.?\b|\bssa\b|\bsp\.?\s*z\s*o\.?\s*o\.?\b/g, ' ')
  .replace(/\b(ks|mks|gks|lks|mlks|uks|kks|rks|bts|oks|aks|kp|ts|ap|wks|zks|mkp|sks|cks|mzks|muks|mgks|pks)\b/g, ' ')
  .replace(/[^a-z0-9]/g, '');

const maHerb = (c)=> String(c.crest_url || '').trim() && !/crest_default|crest-default|placeholder/i.test(c.crest_url);

const kluby = [];
for(let od = 0; ; od += 1000){
  const r = await (await fetch(`${B}/rest/v1/sbs_clubs?select=id,name,league,crest_url&order=id&offset=${od}&limit=1000`, { headers: h })).json();
  if(!Array.isArray(r) || !r.length) break;
  kluby.push(...r); if(r.length < 1000) break;
}

// Źródła: kluby SENIORSKIE z prawdziwym godłem. Juniorów pomijamy, żeby nie przepisywać pustki
// z jednej drużyny młodzieżowej do drugiej.
const zrodla = new Map();
kluby
  .filter(c=>maHerb(c) && !/^CLJ|Rocznik|makroregion/i.test(String(c.league || '')))
  .forEach(c=>{ const k = rdzen(c.name); if(k && !zrodla.has(k)) zrodla.set(k, c); });

const doUzupelnienia = kluby.filter(c=>/^CLJ/i.test(String(c.league || '')) && !maHerb(c));
let ustawionych = 0;
const bezZrodla = [];

for(const c of doUzupelnienia){
  const z = zrodla.get(rdzen(c.name));
  if(!z){ bezZrodla.push(c.name); continue; }
  console.log(`  ${c.name.padEnd(34)} ← ${z.name} [${z.league}]`);
  ustawionych++;
  if(NAPRAWDE){
    const r = await fetch(`${B}/rest/v1/sbs_clubs?id=eq.${encodeURIComponent(c.id)}`,
      { method:'PATCH', headers: hZapis, body: JSON.stringify({ crest_url: z.crest_url }) });
    if(!r.ok) console.error('    BŁĄD: ' + await r.text());
  }
}

console.log(`\nDo uzupełnienia: ${doUzupelnienia.length}, dobranych z pierwszej drużyny: ${ustawionych}`);
if(bezZrodla.length) console.log(`Bez źródła (${bezZrodla.length}): ${bezZrodla.join(', ')}`);
console.log(NAPRAWDE ? 'ZAPISANE w bazie.' : 'To była PRÓBA — nic nie zmieniłem. Dopisz --zapisz, żeby wykonać.');
