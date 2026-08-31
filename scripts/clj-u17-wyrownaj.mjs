// Ustawia CLJ U17 dokładnie tak, jak stoi na ŁNP — nazwy grup, nazwy klubów i pełny skład.
//
// SKĄD TO SIĘ WZIĘŁO: w SBS grupy nazywały się „(zachodnia)" i „(wschodnia)", a na ŁNP noszą
// numery — „gr. I" i „gr. II". Sprawdzone na tabelach 90minut i ŁNP:
//     SBS „wschodnia"  ==  ŁNP „gr. I”
//     SBS „zachodnia”  ==  ŁNP „gr. II”
// Różne nazewnictwo tego samego zmusza do zgadywania przy każdym zbieraniu, a pomyłka wsypuje
// dorobek do niewłaściwej grupy.
//
// KOŃCÓWKA „U17" ZOSTAJE i to jest świadome. Na ŁNP kluby juniorskie noszą nazwę pierwszej
// drużyny („Widzew Łódź"), więc bez tego znacznika kartoteka juniorów byłaby nieodróżnialna od
// seniorskiej na liście klubów. Dopasowanie protokołów tego nie potrzebuje — od tego jest filtr
// poziomu rozgrywek — ale człowiek patrzący na listę owszem.
//
// Uruchomienie:  SBS_KLUCZ=<klucz> node scripts/clj-u17-wyrownaj.mjs [--zapisz]
const B = 'https://hzindymcagvmjyamlxwn.supabase.co';
const K = process.env.SBS_KLUCZ;
const NAPRAWDE = process.argv.includes('--zapisz');
if(!K){ console.error('Brak SBS_KLUCZ w środowisku.'); process.exit(1); }

const h = { apikey: K, Authorization: 'Bearer ' + K };
const hZapis = { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

const GRUPY = {
  'CLJ U17 (wschodnia)': 'CLJ U17 gr. I',
  'CLJ U17 (zachodnia)': 'CLJ U17 gr. II',
};

// Nazwy przepisane z tabel ŁNP, doprowadzone do czytelnego zapisu (wersaliki zostają tylko tam,
// gdzie są skrótem). Po lewej to, co dziś stoi w kartotece.
const NAZWY = {
  // gr. I (dotąd „wschodnia")
  'Cracovia U17':                  'KS Cracovia SA Kraków U17',
  'Escola Varsovia Warszawa U17':  'Escola Varsovia U17',
  'Górnik Łęczna U17':             'Górnik Łęczna S.A. U17',
  'Jagiellonia Białystok U17':     'Jagiellonia Białystok SSA U17',
  'Korona Kielce U17':             'Korona S.A. Kielce U17',
  'Legia Warszawa U17':            'Legia Warszawa S.A. U17',
  'ŁKS Łódź U17':                  'ŁKS Łódź S.A. U17',
  'Polonia Warszawa U17':          'Polonia Warszawa S.A. U17',
  'Stal Rzeszów U17':              'Stal Rzeszów S.A. U17',
  'Stomil Olsztyn U17':            'Stomil Olsztyn SA U17',
  'Talent Warszawa U17':           'UKS Talent Warszawa U17',
  'Varsovia Warszawa U17':         'UKS Varsovia U17',
  'Widzew Łódź U17':               'Widzew Łódź SA U17',
  // gr. II (dotąd „zachodnia")
  'Arka Gdynia U17':               'Arka Gdynia SA U17',
  'GKS Katowice U17':              'GKS Gieksa Katowice S.A. U17',
  'Górnik Zabrze U17':             'Górnik Zabrze S.A. U17',
  'KS Stilon Gorzów Wielkopolski U17': 'Stilon Gorzów Wlkp. U17',
  'Lech Poznań U17':               'KKS Lech Poznań U17',
  'Odra Opole U17':                'OKS Odra Opole U17',
  'Raków Częstochowa U17':         'RKS Raków Częstochowa S.A. U17',
  'Rekord Bielsko-Biała U17':      'BTS Rekord Bielsko-Biała U17',
};

// Klubu brakowało w kartotece, choć gra w tej grupie od początku sezonu.
const DOPISZ = [
  { name: 'AKS SMS Grot Łódź U17', league: 'CLJ U17 gr. I', region: 'Łódzki ZPN', city: 'Łódź' },
];

const kluby = [];
for(let od = 0; ; od += 1000){
  const r = await (await fetch(`${B}/rest/v1/sbs_clubs?select=id,name,league,region,city&order=id&offset=${od}&limit=1000`, { headers: h })).json();
  if(!Array.isArray(r) || !r.length) break;
  kluby.push(...r); if(r.length < 1000) break;
}

const wCLJ = kluby.filter(c=>GRUPY[c.league]);
console.log(`Klubów w obu grupach CLJ U17: ${wCLJ.length}\n`);

let grup = 0, nazw = 0, dodanych = 0;
for(const c of wCLJ){
  const nowaGrupa = GRUPY[c.league];
  const nowaNazwa = NAZWY[c.name] || c.name;
  const zmiany = {};
  if(nowaGrupa !== c.league) zmiany.league = nowaGrupa;
  if(nowaNazwa !== c.name) zmiany.name = nowaNazwa;
  if(!Object.keys(zmiany).length) continue;
  console.log(`  ${c.name}${zmiany.name ? ' → ' + zmiany.name : ''}   [${c.league}${zmiany.league ? ' → ' + zmiany.league : ''}]`);
  if(zmiany.league) grup++;
  if(zmiany.name) nazw++;
  if(NAPRAWDE){
    const r = await fetch(`${B}/rest/v1/sbs_clubs?id=eq.${encodeURIComponent(c.id)}`,
      { method:'PATCH', headers: hZapis, body: JSON.stringify(zmiany) });
    if(!r.ok) console.error('    BŁĄD: ' + await r.text());
  }
}

for(const nowy of DOPISZ){
  const juz = kluby.find(c=>c.name === nowy.name || (c.name.replace(/\s+U17$/,'') === nowy.name.replace(/\s+U17$/,'') && GRUPY[c.league]));
  if(juz){ console.log(`\n  „${nowy.name}" już jest (jako „${juz.name}") — nie dopisuję.`); continue; }
  console.log(`\n  DOPISUJĘ: ${nowy.name}  [${nowy.league}]`);
  dodanych++;
  if(NAPRAWDE){
    const id = 'K' + Math.random().toString(36).slice(2, 12);
    const r = await fetch(`${B}/rest/v1/sbs_clubs`, { method:'POST', headers: hZapis,
      body: JSON.stringify({ id, name: nowy.name, league: nowy.league, region: nowy.region, city: nowy.city, season: '2026/2027' }) });
    if(!r.ok) console.error('    BŁĄD: ' + await r.text());
  }
}

console.log(`\nGrup do przemianowania: ${grup}, nazw klubów: ${nazw}, klubów do dopisania: ${dodanych}`);
console.log(NAPRAWDE ? 'ZAPISANE w bazie.' : 'To była PRÓBA — nic nie zmieniłem. Dopisz --zapisz, żeby wykonać.');
