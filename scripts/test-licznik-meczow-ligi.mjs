// Sprawdza licznik rozliczonych meczów i punktów klubu — na PRAWDZIWEJ funkcji z src/main.ts.
//
// Uruchomienie:  node scripts/test-licznik-meczow-ligi.mjs
import fs from "node:fs";

const ciało = fs.readFileSync("src/main.ts", "utf8").match(/function meczeKlubu\(clubId\)\{[\s\S]*?\n\}/);
if (!ciało) { console.error("Nie znalazłem meczeKlubu w src/main.ts."); process.exit(1); }

const importNorm = (s) => String(s || '').toLowerCase()
  .replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

const licz = (players, clubId) =>
  new Function('DB', 'importNorm', `${ciało[0]}; return meczeKlubu(${JSON.stringify(clubId)});`)({ players }, importNorm);

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
  sprawdz('policzone dwa spotkania, nie pięć wpisów', w.meczow === 2, String(w.meczow));
  // „3:0" na wyjeździe czyta się z perspektywy meczu: gospodarz 3, my 0 — czyli przegrana.
  sprawdz('punkty: 3 za wygraną u siebie + 0 za przegraną na wyjeździe', w.punkty === 3, String(w.punkty));
  sprawdz('zawodnicy innego klubu nie liczą się', licz(gracze, 'K2').meczow === 1);
}

// 2. Ten sam rywal u siebie i na wyjeździe to DWA różne mecze.
{
  const w = licz([{ clubId: 'K1', przebieg: [
    { rywal: 'Wisła', dom: true, wynik: '1:0' },
    { rywal: 'Wisła', dom: false, wynik: '0:0' },
  ] }], 'K1');
  console.log('\n2. Mecz u siebie i rewanż');
  sprawdz('dwa mecze', w.meczow === 2, String(w.meczow));
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
  sprawdz('mecze policzone', w.meczow === 2);
  sprawdz('punkty to null, nie 0', w.punkty === null, String(w.punkty));
}

// 5. Część meczów z wynikiem, część bez — liczymy z tych, które mamy.
{
  const w = licz([{ clubId: 'K1', przebieg: [
    { rywal: 'A', dom: true, wynik: '3:0' },
    { rywal: 'B', dom: true, wynik: '' },
  ] }], 'K1');
  console.log('\n5. Wynik tylko przy części meczów');
  sprawdz('dwa mecze, 3 punkty', w.meczow === 2 && w.punkty === 3, JSON.stringify(w));
}

// 6. Pusty rywal nie może udawać meczu.
{
  const w = licz([{ clubId: 'K1', przebieg: [{ rywal: '', dom: true }, { rywal: 'A', dom: true }] }], 'K1');
  console.log('\n6. Wpis bez rywala');
  sprawdz('liczy się tylko mecz z rywalem', w.meczow === 1, String(w.meczow));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
