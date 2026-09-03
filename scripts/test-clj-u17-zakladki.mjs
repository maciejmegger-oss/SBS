// Sprawdza porządkowanie listy lig CLJ U17 — na PRAWDZIWYM kodzie z src/main.ts.
//
// PO CO TAK: gdyby test miał własną kopię tej logiki, przeszedłby nawet wtedy, gdy aplikacja
// robi co innego. Wycinamy więc blok wprost z main.ts i uruchamiamy go na atrapach DB i zapisu.
//
// Uruchomienie:  node scripts/test-clj-u17-zakladki.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const blok = zrodlo.match(/\/\/ CLJ U17 dzieli się na dwie grupy[\s\S]*?\n(?=\s*\/\/ Usuń "Liga wojewódzka U15")/);
if (!blok) { console.error("Nie znalazłem bloku CLJ U17 w src/main.ts — test i kod się rozjechały."); process.exit(1); }

// Z TypeScriptu na czysty JS: same adnotacje typów, nic więcej.
const kod = blok[0]
  .replace(/const CLJ_U17_STARE: Record<string,string> =/, 'const CLJ_U17_STARE =')
  .replace(/\(c:any\)/g, '(c)').replace(/\(l:any\)/g, '(l)')
  .replace(/\(l:any,i:number\)/g, '(l,i)');

async function uruchom(ligi, kluby) {
  const L = ligi.slice();
  const DB = { clubs: kluby.map(c => ({ ...c })) };
  let zapisKlubow = 0, zapisUstawien = 0;
  const saveClubs = async () => { zapisKlubow++; };
  const saveSettings = async () => { zapisUstawien++; };
  const f = new Function('L', 'DB', 'saveClubs', 'saveSettings', `return (async()=>{ ${kod} })()`);
  await f(L, DB, saveClubs, saveSettings);
  return { L, kluby: DB.clubs, zapisKlubow, zapisUstawien };
}

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

// 1. Stan Maćka: dwie stare zakładki w ustawieniach, kluby już pod nazwami z ŁNP.
{
  const r = await uruchom(
    ['Ekstraklasa', 'IV liga (łódzka)', 'CLJ U19', 'CLJ U17 (zachodnia)', 'CLJ U17 (wschodnia)', 'Rocznik 2011'],
    [{ name: 'Widzew U17', league: 'CLJ U17 gr. I' }],
  );
  console.log('\n1. Stare zakładki znikają, nowe wchodzą na ich miejsce');
  console.log('   ' + r.L.join('  |  '));
  sprawdz('nie ma już „(zachodnia)" ani „(wschodnia)"', !r.L.some(l => /\(zachodnia\)|\(wschodnia\)/.test(l)), r.L.join(', '));
  sprawdz('są obie grupy z ŁNP', r.L.includes('CLJ U17 gr. I') && r.L.includes('CLJ U17 gr. II'));
  sprawdz('stoją tam, gdzie stały stare (po CLJ U19)', r.L.indexOf('CLJ U17 gr. I') === r.L.indexOf('CLJ U19') + 1);
  sprawdz('„Rocznik 2011" zostaje na końcu', r.L[r.L.length - 1] === 'Rocznik 2011');
  sprawdz('lista zapisana', r.zapisUstawien === 1);
  sprawdz('klubów nie ruszaliśmy', r.zapisKlubow === 0);
}

// 2. Klub, który został pod starą nazwą — musi przejechać razem z zakładką, nie zniknąć.
{
  const r = await uruchom(
    ['CLJ U19', 'CLJ U17 (wschodnia)', 'CLJ U17 (zachodnia)'],
    [{ name: 'Lech U17', league: 'CLJ U17 (wschodnia)' }, { name: 'Śląsk U17', league: 'CLJ U17 (zachodnia)' }],
  );
  console.log('\n2. Kluby spod starych nazw trafiają do grup z ŁNP');
  r.kluby.forEach(c => console.log(`   ${c.name.padEnd(12)} → ${c.league}`));
  sprawdz('wschodnia → gr. I', r.kluby[0].league === 'CLJ U17 gr. I', r.kluby[0].league);
  sprawdz('zachodnia → gr. II', r.kluby[1].league === 'CLJ U17 gr. II', r.kluby[1].league);
  sprawdz('kluby zapisane', r.zapisKlubow === 1);
  sprawdz('żaden klub nie został bez zakładki', r.kluby.every(c => r.L.includes(c.league)));
}

// 3. Drugie uruchomienie nie może niczego ruszyć — inaczej zapisujemy przy każdym wejściu.
{
  const r = await uruchom(['Ekstraklasa', 'CLJ U19', 'CLJ U17 gr. I', 'CLJ U17 gr. II'], []);
  console.log('\n3. Powtórne wejście do aplikacji');
  sprawdz('lista bez zmian', r.L.join('|') === 'Ekstraklasa|CLJ U19|CLJ U17 gr. I|CLJ U17 gr. II', r.L.join('|'));
  sprawdz('nic nie zapisano', r.zapisUstawien === 0 && r.zapisKlubow === 0);
}

// 4. Stara instalacja z jednym „CLJ U17" bez podziału.
{
  const r = await uruchom(['CLJ U19', 'CLJ U17', 'Rocznik 2011'], []);
  console.log('\n4. Instalacja sprzed podziału na grupy');
  console.log('   ' + r.L.join('  |  '));
  sprawdz('„CLJ U17" rozbite na dwie grupy', r.L.includes('CLJ U17 gr. I') && r.L.includes('CLJ U17 gr. II') && !r.L.includes('CLJ U17'));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
