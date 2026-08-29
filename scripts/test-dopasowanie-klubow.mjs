// Sprawdza, czy tolerancja odmiany w nazwach klubów nie zaczęła mylić klubów ze sobą.
//
// Poprawka pozwala uznać „Limanowej" i „Limanowa" za ten sam człon. Zysk jest oczywisty, ale
// ryzyko też: gdyby próg wspólnego początku był za niski, „Kleczew" zlałby się z „Kleczkowem",
// a dorobek całej drużyny trafiłby nie tam. Dlatego test bierze WSZYSTKIE kluby z bazy i pyta,
// czy któraś nazwa pasuje teraz do dwóch różnych klubów w tych samych rozgrywkach.
const B = 'https://hzindymcagvmjyamlxwn.supabase.co';
const K = process.env.SBS_KLUCZ;
if(!K){ console.error('Brak SBS_KLUCZ w środowisku.'); process.exit(1); }

const importNorm = (s)=> String(s||'').toLowerCase()
  .replace(/[łøđ]/g, c=>({'ł':'l','ø':'o','đ':'d'}[c]))
  .normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]/g,'');

const SZUM = /^(ks|mks|gks|lks|mlks|uks|kp|ts|rks|wks|zks|mkp|oks|sks|cks|mzks|klub|sportowy|gminny|miejski|ludowy|akademia|ap|as|fc|kkp|of|w)$/;
const NUMER = { ii:'2', iii:'3', iv:'4', '2':'2', '3':'3', '4':'4' };

function rozbij(nazwa){
  const slowa = String(nazwa||'').replace(/[.,()]/g,' ').replace(/[-–—]/g,' ')
    .replace(/\bn\s*\/\s*/gi, 'nad ').split(/\s+/).filter(Boolean);
  let numer = ''; const rdzen = [];
  for(const w of slowa){
    const c = importNorm(w);
    if(!c) continue;
    if(NUMER[c]){ numer = NUMER[c]; continue; }
    if(/^\d{4}$/.test(c)) continue;
    if(SZUM.test(c)) continue;
    rdzen.push(c);
  }
  return { numer, rdzen };
}

const tenSamCzlon = (x, y)=>{
  if(x === y) return true;
  if(x.length < 6 || y.length < 6) return false;
  let i = 0;
  while(i < x.length && i < y.length && x[i] === y[i]) i++;
  return i >= 6;
};

const odcisk = (nazwa)=>{ const b = rozbij(nazwa); return b.numer + '|' + b.rdzen.slice().sort().join('-'); };

function kandydaci(nazwa, kluby, luzno){
  const n = importNorm(nazwa);
  const dokladne = kluby.filter(c=>importNorm(c.name)===n);
  if(dokladne.length) return dokladne;
  const a = rozbij(nazwa);
  return kluby.filter(c=>{
    const b = rozbij(c.name);
    if(a.numer !== b.numer) return false;
    if(!a.rdzen.length || !b.rdzen.length) return false;
    const wspolne = a.rdzen.filter(x=>b.rdzen.some(y=> luzno ? tenSamCzlon(x,y) : x===y));
    if(!wspolne.length) return false;
    const krotszy = Math.min(a.rdzen.length, b.rdzen.length);
    return wspolne.length === krotszy && wspolne.some(x=>x.length>=4);
  });
}

const h = { apikey: K, Authorization: 'Bearer ' + K };

const wszystkie = [];
for(let od = 0; ; od += 1000){
  const r = await (await fetch(`${B}/rest/v1/sbs_clubs?select=id,name,league&order=id&offset=${od}&limit=1000`, { headers: h })).json();
  if(!Array.isArray(r) || !r.length) break;
  wszystkie.push(...r);
  if(r.length < 1000) break;
}
console.log(`Klubów w bazie: ${wszystkie.length}`);

// 1. Przypadek, dla którego powstała poprawka.
const czwarta = wszystkie.filter(c=>/^IV liga/.test(String(c.league||'')));
const proby = [
  ['MKS Limanovia w Limanowej', 'Limanovia Limanowa', true],
  ['BKS Hal-Mont Bochnia',      null,                 false],
  ['Sokół Kleczew',             null,                 false],
  // W bazie klub figuruje ze skrótem, dokładnie tak jak na ŁNP.
  ['Wisła Dobrzyń nad Wisłą',   'Wisła Dobrzyń n/Wisłą', true],
];
let bledy = 0;
for(const [lnp, oczekiwany] of proby){
  const k = kandydaci(lnp, czwarta, true);
  const jedno = new Set(k.map(c=>odcisk(c.name))).size === 1 ? k[0].name : (k.length ? `NIEJEDNOZNACZNE (${k.length})` : null);
  const ok = oczekiwany ? jedno === oczekiwany : (jedno === null || !k.length);
  if(!ok) bledy++;
  console.log(`  ${ok ? 'OK  ' : 'ŹLE '} „${lnp}" -> ${jedno ?? 'brak (do wskazania ręką)'}`);
}

// 2. Czy tolerancja skleiła ze sobą kluby, które wcześniej były rozróżniane?
let nowychZlaczen = 0;
for(const c of wszystkie){
  const przed = new Set(kandydaci(c.name, wszystkie, false).map(x=>odcisk(x.name)));
  const po    = new Set(kandydaci(c.name, wszystkie, true ).map(x=>odcisk(x.name)));
  if(po.size > przed.size){
    nowychZlaczen++;
    if(nowychZlaczen <= 12){
      const kto = kandydaci(c.name, wszystkie, true).map(x=>x.name + ' [' + x.league + ']');
      console.log(`  NOWA NIEJEDNOZNACZNOŚĆ: „${c.name}" -> ${[...new Set(kto)].join(' | ')}`);
    }
  }
}
console.log(`\nNazw, które przez tolerancję stały się niejednoznaczne: ${nowychZlaczen}`);
console.log(bledy ? `\nBŁĘDY: ${bledy}` : '\nWszystkie przypadki zgodne z oczekiwaniem.');
process.exit(bledy ? 1 : 0);
