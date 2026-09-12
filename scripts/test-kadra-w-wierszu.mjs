// Sprawdza, że kadra zapisuje się W WIERSZU TALENTU i że powołani U-16 wracają sami po starcie —
// na PRAWDZIWYCH funkcjach z src/main.ts i na PRAWDZIWYM komunikacie z src/data/powolania.ts.
//
// Uruchomienie:  node scripts/test-kadra-w-wierszu.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const plikPowolan = fs.readFileSync("src/data/powolania.ts", "utf8");
const schemat = fs.readFileSync("supabase/schema.sql", "utf8");
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
  wytnij('szukajNorm', /const szukajNorm = \(s\)=>[\s\S]*?\.replace\(\/\\p\{M\}\/gu,''\);/),
  wytnij('nazwiskoNorm', /const nazwiskoNorm = \(s\)=>.*;/),
  wytnij('importNorm', /const importNorm = [\s\S]*?\.replace\(\/\[\^a-z0-9\]\/g,''\);/),
  wytnij('SZUM_NAZWY_KLUBU', /const SZUM_NAZWY_KLUBU = \/\^\([\s\S]*?\)\$\/;/),
  wytnij('NUMER_ZESPOLU', /const NUMER_ZESPOLU = \{[\s\S]*?\};/),
  wytnij('SKROTY_NAZWY', /const SKROTY_NAZWY = \{[\s\S]*?\};/),
  wytnij('rozwinSkroty', /const rozwinSkroty = .*;/),
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/),
  wytnij('tenSamCzlon', /const tenSamCzlon = \(x, y\)=>\{[\s\S]*?\n\};/),
  wytnij('klubyToSamo', /function klubyToSamo\(a, b\)\{[\s\S]*?\n\}/),
  wytnij('tenSamTalent', /function tenSamTalent\(t, n\)\{[\s\S]*?\n\}/),
  wytnij('osobyZPowolaniaPzpn', /function osobyZPowolaniaPzpn\(tekst\)\{[\s\S]*?\n\}/),
  wytnij('kadraDoPolaZrodla', /function kadraDoPolaZrodla\(t\)\{[\s\S]*?\n\}/),
  wytnij('kadraZPolaZrodla', /function kadraZPolaZrodla\(pole\)\{[\s\S]*?\n\}/),
  wytnij('talentyDoZapisu', /function talentyDoZapisu\(talenty\)\{[\s\S]*?\n\}/),
  wytnij('pozycjaDoPolaTalentu', /function pozycjaDoPolaTalentu\(t\)\{[\s\S]*?\n\}/),
  wytnij('nalozKadreZPolaZrodla', /function nalozKadreZPolaZrodla\(talenty\)\{[\s\S]*?\n\}/),
  wytnij('przywrocKadreZKomunikatow', /function przywrocKadreZKomunikatow\(talenty, komunikaty, noweId\)\{[\s\S]*?\n\}/),
].join('\n');
const api = new Function(`${kod}\n return { kadraDoPolaZrodla, kadraZPolaZrodla, talentyDoZapisu, nalozKadreZPolaZrodla, przywrocKadreZKomunikatow, osobyZPowolaniaPzpn };`)();

const KOMUNIKATY = [{
  kadra: (plikPowolan.match(/kadra:\s*'([^']+)'/) || [])[1],
  data: (plikPowolan.match(/data:\s*'([^']+)'/) || [])[1],
  tekst: (plikPowolan.match(/tekst:\s*`([\s\S]*?)`/) || [])[1],
}];
let licznik = 0;
const noweId = () => 'NOWY' + (++licznik);

// Kolumny, które tabela NAPRAWDĘ ma — z schema.sql. Symulacja bazy odrzuca wszystko inne,
// dokładnie tak jak warstwa zapisu wycinała brakujące kolumny.
const tabela = (schemat.match(/create table if not exists sbs_talents \(([\s\S]*?)\);/) || [])[1] || '';
const snakeToCamel = (k) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const KOLUMNY = new Set([...tabela.matchAll(/^\s*([a-z_]+)\s+(?:text|timestamptz)/gm)].map(m => snakeToCamel(m[1])));
const przezBaze = (lista) => lista.map(t => Object.fromEntries(Object.entries(t).filter(([k]) => KOLUMNY.has(k))));

console.log('\n0. Założenia');
sprawdz('tabela ma kolumnę źródła wpisu (confidence) — to w niej jedzie kadra', KOLUMNY.has('confidence'), [...KOLUMNY].join(','));
sprawdz('tabela NIE ma kolumny na kadrę', !KOLUMNY.has('reprezentacja'));
sprawdz('zapisany komunikat to U-16 z datą', KOMUNIKATY[0].kadra === 'U-16' && KOMUNIKATY[0].data === '2026-09-09', JSON.stringify(KOMUNIKATY[0].kadra));
const powolani = api.osobyZPowolaniaPzpn(KOMUNIKATY[0].tekst);
sprawdz('zapisany komunikat daje 22 powołanych', powolani.length === 22, String(powolani.length));

console.log('\n1. Odświeżenie strony: zapis → baza wycina nieznane pola → odczyt');
{
  const wPamieci = [
    { id: 'T1', firstName: 'Antoni', lastName: 'Miernik', club: 'Chelsea FC', reprezentacja: 'U-16', krajKlubu: 'Anglia', confidence: 'powołanie' },
    { id: 'T2', firstName: 'Antoni', lastName: 'Balcer', club: 'Talent Warszawa', reprezentacja: 'U-16', confidence: 'powołanie' },
    { id: 'T3', firstName: 'Jan', lastName: 'Zwykły', club: 'Wda Świecie', confidence: 'import' },
  ];
  const doBazy = api.talentyDoZapisu(wPamieci);
  sprawdz('kopia do zapisu nie niesie pola „reprezentacja" (nie odbije się od bazy)', doBazy.every(t => !('reprezentacja' in t) && !('krajKlubu' in t)));
  sprawdz('obiekty w pamięci zostały nietknięte', wPamieci[0].reprezentacja === 'U-16' && wPamieci[0].krajKlubu === 'Anglia');
  const zBazy = przezBaze(doBazy);
  console.log('   w bazie: ' + zBazy.map(t => `${t.lastName}=„${t.confidence}"`).join('  '));
  api.nalozKadreZPolaZrodla(zBazy);
  sprawdz('Miernik wrócił do U-16 z krajem klubu', zBazy[0].reprezentacja === 'U-16' && zBazy[0].krajKlubu === 'Anglia', JSON.stringify(zBazy[0]));
  sprawdz('Balcer wrócił do U-16 bez kraju', zBazy[1].reprezentacja === 'U-16' && !zBazy[1].krajKlubu, JSON.stringify(zBazy[1]));
  sprawdz('talent z importu nie dostał kadry', !zBazy[2].reprezentacja && zBazy[2].confidence === 'import', JSON.stringify(zBazy[2]));
}

console.log('\n2. Pole źródła — odczyt');
{
  const przypadki = [
    ['powołanie U-16', { reprezentacja: 'U-16', krajKlubu: '' }],
    ['powołanie U-16 · Arabia Saudyjska', { reprezentacja: 'U-16', krajKlubu: 'Arabia Saudyjska' }],
    ['powołanie kadra Polski', { reprezentacja: 'kadra Polski', krajKlubu: '' }],
    ['powołanie', null], ['import', null], ['ręcznie', null], ['', null], [undefined, null],
  ];
  przypadki.forEach(([pole, oczekiwane]) => {
    const w = api.kadraZPolaZrodla(pole);
    sprawdz(`„${pole}" → ${JSON.stringify(oczekiwane)}`, JSON.stringify(w) === JSON.stringify(oczekiwane), JSON.stringify(w));
  });
}

console.log('\n3. Przywracanie U-16 — stan jak u Maćka: powołani są na liście, ale bez kadry, jeden zdublowany');
{
  const talenty = powolani.map((o, i) => ({ id: 'T' + i, firstName: o.firstName, lastName: o.lastName, club: o.club, confidence: 'powołanie' }));
  talenty.push({ id: 'DUP', firstName: 'Antoni', lastName: 'Miernik', club: 'Chelsea FC', confidence: 'powołanie' });
  talenty.push({ id: 'X', firstName: 'Karol', lastName: 'Nowicki', club: '', confidence: 'import' });
  const w = api.przywrocKadreZKomunikatow(talenty, KOMUNIKATY, noweId);
  console.log(`   przywróconych: ${w.zmienione}, dodanych: ${w.nowe.length}, duplikatów: ${w.duplikaty}`);
  sprawdz('kadrę dostało dokładnie 22 powołanych', w.zmienione === 22, String(w.zmienione));
  sprawdz('nikt nie został dodany drugi raz', w.nowe.length === 0, JSON.stringify(w.nowe.map(n => n.lastName)));
  sprawdz('duplikat Miernika wskazany, ale nie ruszony', w.duplikaty === 1 && !talenty.find(t => t.id === 'DUP').reprezentacja);
  sprawdz('niezwiązany talent bez kadry', !talenty.find(t => t.id === 'X').reprezentacja);
  sprawdz('Sulewski ma kraj klubu', talenty.find(t => t.lastName === 'Sulewski').krajKlubu === 'Niemcy');
  const drugi = api.przywrocKadreZKomunikatow(talenty, KOMUNIKATY, noweId);
  sprawdz('drugie uruchomienie nic nie zmienia — nie będzie zapisu przy każdym starcie',
    drugi.zmienione === 0 && drugi.nowe.length === 0, JSON.stringify({ z: drugi.zmienione, n: drugi.nowe.length }));
}

console.log('\n4. Przywracanie nie przestawia świadomie zmienionej kadry');
{
  const talenty = [{ id: 'A', firstName: 'Marcel', lastName: 'Zdybał', club: 'Lech Poznań', reprezentacja: 'U-17' }];
  const w = api.przywrocKadreZKomunikatow(talenty, KOMUNIKATY, noweId);
  sprawdz('Zdybał przeniesiony do U-17 zostaje w U-17', talenty[0].reprezentacja === 'U-17');
  sprawdz('i nie dostaje drugiego wpisu', !w.nowe.some(n => n.lastName === 'Zdybał'));
}

console.log('\n5. Brakujący powołany jest dodawany — z kadrą, klubem i datą komunikatu');
{
  const w = api.przywrocKadreZKomunikatow([], KOMUNIKATY, noweId);
  const essam = w.nowe.find(n => n.lastName === 'Abdelhamid');
  sprawdz('pusta lista → 22 nowe wpisy', w.nowe.length === 22, String(w.nowe.length));
  sprawdz('nowy wpis ma kadrę, klub, kraj i datę', essam && essam.reprezentacja === 'U-16' && essam.club === 'PSV Eindhoven'
    && essam.krajKlubu === 'Holandia' && essam.dateAdded === '2026-09-09' && /^NOWY/.test(essam.id), JSON.stringify(essam));
}

console.log('\n6. Podpięcie w aplikacji');
sprawdz('zapis talentów idzie przez talentyDoZapisu', /robustStorageSet\('scouting:talents', JSON\.stringify\(talentyDoZapisu\(DB\.talents\)\)\)/.test(zrodlo));
sprawdz('kadra z pola źródła nakładana PRZED zapasową mapą',
  /nalozKadreZPolaZrodla\(DB\.talents\);\s*nalozKadryNaTalenty\(DB\.talents, talentyKadry\);/.test(zrodlo));
sprawdz('przywracanie tylko przy pełnym wczytaniu', /if\(wolnoUzupelniac\)\{\s*const naprawa = przywrocKadreZKomunikatow\(DB\.talents, POWOLANIA_DO_PRZYWROCENIA/.test(zrodlo));
sprawdz('zapis tylko gdy coś się zmieniło', /if\(naprawa\.zmienione \|\| naprawa\.nowe\.length\)\{/.test(zrodlo));
sprawdz('komunikaty importowane do aplikacji', zrodlo.includes('import { POWOLANIA_DO_PRZYWROCENIA } from "./data/powolania";'));
sprawdz('niepowodzenie zapasowej mapy nie blokuje zapisu talentów', /await saveTalentyKadry\(\);\s*return okWpisy !== false;/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
