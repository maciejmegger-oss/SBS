// Sprawdza przypisanie tabel z 90minut do grup w SBS — na PRAWDZIWYCH funkcjach z src/main.ts
// i PRAWDZIWYCH składach CLJ U-17 (zachodnia, wschodnia) oraz CLJ U-19 z 90minut (12.09.2026).
//
// Uruchomienie:  node scripts/test-tabele-clj.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
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
  wytnij('importNorm', /const importNorm = [\s\S]*?\.replace\(\/\[\^a-z0-9\]\/g,''\);/),
  wytnij('SZUM_NAZWY_KLUBU', /const SZUM_NAZWY_KLUBU = \/\^\([\s\S]*?\)\$\/;/),
  wytnij('NUMER_ZESPOLU', /const NUMER_ZESPOLU = \{[\s\S]*?\};/),
  wytnij('SKROTY_NAZWY', /const SKROTY_NAZWY = \{[\s\S]*?\};/),
  wytnij('rozwinSkroty', /const rozwinSkroty = .*;/),
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/),
  wytnij('tenSamCzlon', /const tenSamCzlon = \(x, y\)=>\{[\s\S]*?\n\};/),
  wytnij('klubyToSamo', /function klubyToSamo\(a, b\)\{[\s\S]*?\n\}/),
  wytnij('poziomGrupy', /function poziomGrupy\(nazwaGrupy\)\{[\s\S]*?\n\}/),
  wytnij('przypiszTabeleDoGrup', /function przypiszTabeleDoGrup\(tabele, kluby\)\{[\s\S]*?\n\}/),
].join('\n');
const { przypiszTabeleDoGrup, importNorm } = new Function(`${kod}\n return { przypiszTabeleDoGrup, importNorm };`)();

// Składy dokładnie tak, jak podaje je 90minut.
const ZACHODNIA = ["Raków Częstochowa","FASE Szczecin","Rekord Bielsko-Biała","Zagłębie Lubin","Śląsk Wrocław","Górnik Zabrze","GKS Katowice","Pogoń Szczecin","Lech Poznań","Lechia Gdańsk","AP Olimpia Grudziądz","KS Stilon Gorzów Wielkopolski","Odra Opole","Miedź Legnica","Gedania Gdańsk","Arka Gdynia"];
const WSCHODNIA = ["Legia Warszawa","Wisła Kraków","Cracovia","Escola Varsovia Warszawa","ŁKS Łódź","Stal Rzeszów","Widzew Łódź","Górnik Łęczna","Talent Warszawa","Stomil Olsztyn","Polonia Warszawa","UKS SMS Łódź","Varsovia Warszawa","Jagiellonia Białystok","AKS SMS Łódź","Korona Kielce"];
const U19 = ["Legia Warszawa","Wisła Kraków","Raków Częstochowa","Zagłębie Lubin","Miedź Legnica","Jagiellonia Białystok","Śląsk Wrocław","Arkonia Szczecin","Talent Warszawa","Arka Gdynia","Lech Poznań","Stal Rzeszów","Korona Kielce","Górnik Zabrze","Polonia Warszawa","Escola Varsovia Warszawa"];

// Te same kluby w kartotece SBS — z nazwami w stylu ŁNP, czyli z przedrostkami i spółkami.
const LNP_ZACHODNIA = ["RKS Raków Częstochowa","FASE Szczecin","TS Rekord Bielsko-Biała","KGHM Zagłębie Lubin","WKS Śląsk Wrocław","KS Górnik Zabrze","GKS Katowice","MKS Pogoń Szczecin","KKS Lech Poznań","BKS Lechia Gdańsk","AP Olimpia Grudziądz","KS Stilon Gorzów Wielkopolski","OKS Odra Opole","MZKS Miedź Legnica","KS Gedania Gdańsk","MZKS Arka Gdynia"];
const LNP_WSCHODNIA = ["CWKS Legia Warszawa","TS Wisła Kraków","KS Cracovia","Escola Varsovia Warszawa","ŁKS Łódź","Stal Rzeszów","RTS Widzew Łódź","GKS Górnik Łęczna","Talent Warszawa","OKS Stomil Olsztyn","KS Polonia Warszawa","UKS SMS Łódź","Varsovia Warszawa","Jagiellonia Białystok","AKS SMS Łódź","KS Korona Kielce"];
const LNP_U19 = ["CWKS Legia Warszawa","TS Wisła Kraków","RKS Raków Częstochowa","KGHM Zagłębie Lubin","MZKS Miedź Legnica","Jagiellonia Białystok","WKS Śląsk Wrocław","MKS Arkonia Szczecin","Talent Warszawa","MZKS Arka Gdynia","KKS Lech Poznań","Stal Rzeszów","KS Korona Kielce","KS Górnik Zabrze","KS Polonia Warszawa","Escola Varsovia Warszawa"];

const kluby = [
  ...LNP_WSCHODNIA.map(name => ({ name, league: 'CLJ U17 gr. I' })),
  ...LNP_ZACHODNIA.map(name => ({ name, league: 'CLJ U17 gr. II' })),
  ...LNP_U19.map(name => ({ name, league: 'CLJ U19' })),
  ...['Lechia Zielona Góra', 'Korona Kożuchów'].map(name => ({ name, league: 'IV liga (lubuska)' })),
];
const tabela = (nazwaZrodla, poziom, nazwy) => ({ nazwaZrodla, poziom, wiersze: nazwy.map((nazwa, i) => ({ miejsce: i + 1, nazwa })) });
const TABELE = [
  tabela('Centralna Liga Juniorów U-17 2026/2027, grupa: zachodnia', 'CLJ U17', ZACHODNIA),
  tabela('Centralna Liga Juniorów U-17 2026/2027, grupa: wschodnia', 'CLJ U17', WSCHODNIA),
  tabela('Centralna Liga Juniorów 2026/2027', 'CLJ U19', U19),
];

console.log('\n0. Tak wyglądał błąd: dosłowne porównanie nazw');
{
  const zbior = new Set(LNP_ZACHODNIA.map(importNorm));
  const dokladnie = ZACHODNIA.filter(n => zbior.has(importNorm(n))).length;
  console.log(`   zachodnia: dokładnie zgodnych nazw ${dokladnie} z 16 (próg: 8)`);
  sprawdz('przy dosłownym porównaniu tabela nie przechodziła progu połowy składu', dokladnie < 8, String(dokladnie));
}

console.log('\n1. Każda tabela trafia do właściwej grupy');
const { przypisane, nieprzypisane } = przypiszTabeleDoGrup(TABELE, kluby);
const gdzie = (fragment) => (przypisane.find(p => p.tabela.nazwaZrodla.includes(fragment)) || {});
console.log('   ' + przypisane.map(p => `${p.tabela.nazwaZrodla.replace(/Centralna Liga Juniorów/, 'CLJ')} → ${p.grupa} (${p.ile}/16)`).join('\n   '));
if (nieprzypisane.length) console.log('   nieprzypisane: ' + nieprzypisane.join(' | '));
sprawdz('U-17 zachodnia → CLJ U17 gr. II', gdzie('zachodnia').grupa === 'CLJ U17 gr. II', JSON.stringify(gdzie('zachodnia').grupa));
sprawdz('U-17 wschodnia → CLJ U17 gr. I', gdzie('wschodnia').grupa === 'CLJ U17 gr. I', JSON.stringify(gdzie('wschodnia').grupa));
sprawdz('CLJ U-19 → CLJ U19', (przypisane.find(p => p.tabela.poziom === 'CLJ U19') || {}).grupa === 'CLJ U19');
sprawdz('żadna tabela nie została bez grupy', nieprzypisane.length === 0, nieprzypisane.join(' | '));
sprawdz('zachodnia rozpoznana w komplecie, mimo nazw z ŁNP', gdzie('zachodnia').ile === 16, String(gdzie('zachodnia').ile));

console.log('\n2. Poziom odcina rozgrywki z tymi samymi klubami');
{
  // Sama tabela U-19 i kartoteka, w której jest tylko grupa U-17 z połową tych samych klubów.
  const tylkoU17 = kluby.filter(c => c.league.startsWith('CLJ U17'));
  const w = przypiszTabeleDoGrup([TABELE[2]], tylkoU17);
  sprawdz('tabela U-19 NIE ląduje w grupie U-17, choć pokrywa się składem', w.przypisane.length === 0, JSON.stringify(w.przypisane.map(p => p.grupa)));
}

console.log('\n3. Remis i słabe dopasowanie to odmowa, nie zgadywanie');
{
  const bliznieta = [
    ...ZACHODNIA.map(name => ({ name, league: 'CLJ U17 gr. II' })),
    ...ZACHODNIA.map(name => ({ name, league: 'CLJ U17 gr. III' })),
  ];
  const w = przypiszTabeleDoGrup([TABELE[0]], bliznieta);
  sprawdz('tabela pasująca tak samo do dwóch grup nie jest przypisana', w.przypisane.length === 0 && /kilku grup/.test(w.nieprzypisane[0] || ''), JSON.stringify(w));
  const malo = przypiszTabeleDoGrup([TABELE[0]], ZACHODNIA.slice(0, 5).map(name => ({ name, league: 'CLJ U17 gr. II' })));
  sprawdz('5 z 16 klubów to za mało — tabela bez grupy', malo.przypisane.length === 0, JSON.stringify(malo));
}

console.log('\n4. Seniorzy dalej działają');
{
  const w = przypiszTabeleDoGrup([tabela('IV liga lubuska', 'IV liga', ['Lechia Zielona Góra', 'Korona Kożuchów'])], kluby);
  sprawdz('IV liga lubuska → IV liga (lubuska)', (w.przypisane[0] || {}).grupa === 'IV liga (lubuska)', JSON.stringify(w));
}

console.log('\n5. Podpięcie w aplikacji');
sprawdz('pobieranie tabel korzysta z nowego przypisania', /const \{ przypisane, nieprzypisane \} = przypiszTabeleDoGrup\(dane\.tabele, DB\.clubs\);/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
