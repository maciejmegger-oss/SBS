// Sprawdza licznik rozliczonych meczów i punktów klubu — na PRAWDZIWEJ funkcji z src/main.ts.
//
// Uruchomienie:  node scripts/test-licznik-meczow-ligi.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const ciało = zrodlo.match(/function meczeKlubu\(clubId\)\{[\s\S]*?\n\}/);
if (!ciało) { console.error("Nie znalazłem meczeKlubu w src/main.ts."); process.exit(1); }
const mTabeli = zrodlo.match(/function wierszZTabeli\(klub\)\{[\s\S]*?\n\}/);
if (!mTabeli) { console.error("Nie znalazłem wierszZTabeli w src/main.ts."); process.exit(1); }
const zrodloTabeli = mTabeli[0];

const importNorm = (s) => String(s || '').toLowerCase()
  .replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

// meczeZTabeli sięga po tabele ligowe; w większości prób ich nie ma i wtedy zwraca null —
// dokładnie tak, jak w aplikacji przed pierwszym pobraniem tabel.
const licz = (players, clubId, clubs = [{ id: clubId, season: '2026/2027' }], tabele = {}) =>
  new Function('DB', 'importNorm', 'tabeleLig', 'rozbijNazweKlubu', 'tenSamCzlon',
    `${zrodloTabeli}\n${ciało[0]}; return meczeKlubu(${JSON.stringify(clubId)});`)(
    { players, clubs }, importNorm, tabele,
    (n)=>({ rdzen: String(n||'').toLowerCase().split(/\s+/).filter(Boolean) }),
    (a,b)=>a===b);

// 1. Jeden mecz zostawia kilkanaście wpisów — liczymy SPOTKANIA, nie wpisy.
{
  const gracze = [
    { clubId: 'K1', przebieg: [{ rywal: 'Sandecja', dom: true, wynik: '2:1' }, { rywal: 'Wisła', dom: false, wynik: '3:0' }] },
    { clubId: 'K1', przebieg: [{ rywal: 'Sandecja', dom: true, wynik: '2:1' }, { rywal: 'Wisła', dom: false, wynik: '3:0' }] },
    { clubId: 'K1', przebieg: [{ rywal: 'Sandecja', dom: true, wynik: '2:1' }] },
    { clubId: 'K2', przebieg: [{ rywal: 'Cracovia', dom: true, wynik: '1:1' }] },
  ];
  const w = licz(gracze, 'K1');
  console.log('\n1. Trzech zawodników, dwa mecze');
  console.log('   ' + JSON.stringify(w));
  sprawdz('policzone dwa spotkania, nie pięć wpisów', w.wgrane === 2, String(w.wgrane));
  // „3:0" na wyjeździe czyta się z perspektywy meczu: gospodarz 3, my 0 — czyli przegrana.
  sprawdz('punkty: 3 za wygraną u siebie + 0 za przegraną na wyjeździe', w.punkty === 3, String(w.punkty));
  sprawdz('zawodnicy innego klubu nie liczą się', licz(gracze, 'K2').wgrane === 1);
}

// 2. Ten sam rywal u siebie i na wyjeździe to DWA różne mecze.
{
  const w = licz([{ clubId: 'K1', przebieg: [
    { rywal: 'Wisła', dom: true, wynik: '1:0' },
    { rywal: 'Wisła', dom: false, wynik: '0:0' },
  ] }], 'K1');
  console.log('\n2. Mecz u siebie i rewanż');
  sprawdz('dwa mecze', w.wgrane === 2, String(w.wgrane));
  sprawdz('3 + 1 = 4 punkty', w.punkty === 4, String(w.punkty));
}

// 3. Wynik czytany z perspektywy meczu — u gościa trzeba go odwrócić.
{
  const wyjazd = licz([{ clubId: 'K1', przebieg: [{ rywal: 'Lech', dom: false, wynik: '0:2' }] }], 'K1');
  console.log('\n3. Wyjazd — wynik zapisany jako gospodarz:goście');
  sprawdz('wygrana na wyjeździe 0:2 daje 3 pkt', wyjazd.punkty === 3, String(wyjazd.punkty));
  const dom = licz([{ clubId: 'K1', przebieg: [{ rywal: 'Lech', dom: true, wynik: '0:2' }] }], 'K1');
  sprawdz('ta sama cyfra u siebie to przegrana, 0 pkt', dom.punkty === 0, String(dom.punkty));
}

// 4. Protokół bez wyniku — kreska, nie zero. Zero znaczyłoby „przegrali wszystko".
{
  const w = licz([{ clubId: 'K1', przebieg: [
    { rywal: 'Górnik', dom: true, wynik: '' },
    { rywal: 'Stal', dom: false },
  ] }], 'K1');
  console.log('\n4. Protokoły bez wyniku');
  console.log('   ' + JSON.stringify(w));
  sprawdz('mecze policzone', w.wgrane === 2);
  sprawdz('punkty to null, nie 0', w.punkty === null, String(w.punkty));
}

// 5. Część meczów z wynikiem, część bez — liczymy z tych, które mamy.
{
  const w = licz([{ clubId: 'K1', przebieg: [
    { rywal: 'A', dom: true, wynik: '3:0' },
    { rywal: 'B', dom: true, wynik: '' },
  ] }], 'K1');
  console.log('\n5. Wynik tylko przy części meczów');
  sprawdz('dwa mecze, 3 punkty', w.wgrane === 2 && w.punkty === 3, JSON.stringify(w));
}

// 6. Pusty rywal nie może udawać meczu.
{
  const w = licz([{ clubId: 'K1', przebieg: [{ rywal: '', dom: true }, { rywal: 'A', dom: true }] }], 'K1');
  console.log('\n6. Wpis bez rywala');
  sprawdz('liczy się tylko mecz z rywalem', w.wgrane === 1, String(w.wgrane));
}

// 7. TYLKO BIEŻĄCY SEZON. Przebieg z poprzedniego zawyżał odniesienie dla całej grupy i kazał
//    klubom z kompletem danych wyglądać na zaległe.
{
  const kluby = [{ id: 'K1', season: '2026/2027' }];
  const gracze = [
    { clubId: 'K1', przebiegSezon: '2026/2027', przebieg: [{ rywal: 'A', dom: true, wynik: '1:0' }] },
    { clubId: 'K1', przebiegSezon: '2025/2026', przebieg: [
      { rywal: 'B', dom: true, wynik: '2:0' }, { rywal: 'C', dom: false, wynik: '0:1' }] },
  ];
  const w = licz(gracze, 'K1', kluby);
  console.log('\n7. Wpisy z poprzedniego sezonu');
  console.log('   ' + JSON.stringify(w));
  sprawdz('liczy tylko bieżący sezon', w.rozpisanych === 1, String(w.rozpisanych));
  sprawdz('punkty też tylko z bieżącego', w.punkty === 3, String(w.punkty));
}

// 8. Kartoteka bez wpisanego sezonu liczy się jako bieżąca — tak powstają wpisy z protokołów ŁNP,
//    które sezonu nie niosą. Odrzucanie ich skasowałoby całą IV ligę i CLJ.
{
  const w = licz([{ clubId: 'K1', przebieg: [{ rywal: 'A', dom: true }] }], 'K1');
  console.log('\n8. Kartoteka bez wpisanego sezonu');
  sprawdz('wchodzi do bieżącego sezonu', w.rozpisanych === 1, String(w.rozpisanych));
}

// 9. SUMY SEZONOWE Z 90MINUT nie niosą przebiegu, więc rozpisanych spotkań jest mniej niż
//    rozegranych. Liczbą kolejek jest ta większa — inaczej kolumna pokazywała 4/6 tam, gdzie
//    tabela ligowa mówi 7.
{
  const gracze = [
    { clubId: 'K1', matches: 7, przebieg: [{ rywal: 'A', dom: true, wynik: '1:0' }] },
    { clubId: 'K1', matches: 5, przebieg: [] },
  ];
  const w = licz(gracze, 'K1');
  console.log('\n9. Sumy sezonowe bez przebiegu');
  console.log('   ' + JSON.stringify(w));
  sprawdz('rozegranych 7 — z najwyższego dorobku w kartotekach', w.wgrane === 7, String(w.wgrane));
  sprawdz('rozpisany jest 1 — tyle mamy mecz po meczu', w.rozpisanych === 1, String(w.rozpisanych));
  sprawdz('punkty dalej tylko z rozpisanych', w.punkty === 3, String(w.punkty));
}

// 10. Gdy przebieg jest bogatszy niż sumy (protokoły z ŁNP, gdzie „matches" nie rośnie),
//     liczbą kolejek zostaje przebieg.
{
  const w = licz([{ clubId: 'K1', matches: 1, przebieg: [
    { rywal: 'A', dom: true }, { rywal: 'B', dom: false }, { rywal: 'C', dom: true }] }], 'K1');
  console.log('\n10. Przebieg bogatszy niż sumy');
  sprawdz('bierzemy 3, nie 1', w.wgrane === 3, String(w.wgrane));
}

// 11. TABELA LIGOWA ROZSTRZYGA, ILE ROZEGRANO. Bez niej odniesieniem był najlepiej zebrany klub
//     w grupie — a przy zawyżonej kartotece Widzewa (10 przy siedmiu rozegranych kolejkach)
//     cała Ekstraklasa dostawała nieosiągalną poprzeczkę i osiemnaście ostrzeżeń.
{
  const kluby = [{ id: 'W', name: 'Widzew Łódź', league: 'Ekstraklasa', season: '2026/2027' }];
  const tabele = { 'Ekstraklasa': { wiersze: [
    { nazwa: 'Widzew Łódź', mecze: 7, punkty: 7 },
    { nazwa: 'Lech Poznań', mecze: 6, punkty: 16 },
  ] } };
  const w = licz([{ clubId: 'W', matches: 10, przebieg: [{ rywal: 'A', dom: true, wynik: '1:0' }] }],
    'W', kluby, tabele);
  console.log('\n11. Kartoteka zawyżona wobec tabeli');
  console.log('   ' + JSON.stringify(w));
  sprawdz('rozegrane bierzemy z tabeli (7, nie 10)', w.rozegrane === 7, String(w.rozegrane));
  sprawdz('wgrane przycięte do rozegranych', w.wgrane === 7, String(w.wgrane));
  sprawdz('nadmiar zgłoszony osobno', w.zawyzone === 3, String(w.zawyzone));
  sprawdz('wiemy, że liczba pochodzi z tabeli', w.zTabeli === true);
}

// 12. Klub z niekompletem: liga zagrała 7, my mamy 6 — czyli „7/6".
{
  const kluby = [{ id: 'K', name: 'Korona Kielce', league: 'Ekstraklasa', season: '2026/2027' }];
  const tabele = { 'Ekstraklasa': { wiersze: [{ nazwa: 'Korona Kielce', mecze: 7, punkty: 9 }] } };
  const w = licz([{ clubId: 'K', matches: 6, przebieg: [] }], 'K', kluby, tabele);
  console.log('\n12. Niekomplet');
  sprawdz('rozegrane 7', w.rozegrane === 7, String(w.rozegrane));
  sprawdz('wgrane 6', w.wgrane === 6, String(w.wgrane));
  sprawdz('nic nie jest zawyżone', w.zawyzone === 0, String(w.zawyzone));
}

// 13. Klubu nie ma w tabeli — nie zmyślamy, wracamy do oszacowania z kartotek.
{
  const kluby = [{ id: 'X', name: 'Klub Spoza Tabeli', league: 'Ekstraklasa', season: '2026/2027' }];
  const tabele = { 'Ekstraklasa': { wiersze: [{ nazwa: 'Lech Poznań', mecze: 6, punkty: 16 }] } };
  const w = licz([{ clubId: 'X', matches: 4, przebieg: [] }], 'X', kluby, tabele);
  console.log('\n13. Klub spoza tabeli');
  sprawdz('rozegrane z kartotek', w.rozegrane === 4, String(w.rozegrane));
  sprawdz('oznaczone jako NIE z tabeli', w.zTabeli === false);
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
