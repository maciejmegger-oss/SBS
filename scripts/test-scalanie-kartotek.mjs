// Sprawdza scalanie dwóch kartotek tego samego zawodnika — na PRAWDZIWEJ funkcji z src/main.ts.
//
// Uruchomienie:  node scripts/test-scalanie-kartotek.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const ciało = zrodlo.match(/function scalKartoteki\(glowna, duplikat\)\{[\s\S]*?\n\}/);
if (!ciało) { console.error("Nie znalazłem scalKartoteki w src/main.ts — test i kod się rozjechały."); process.exit(1); }

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

// Atrapy zależności — takie same, jak w aplikacji.
const importNorm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

function scena({ glowna, duplikat, reports = [], observations = [], mapa = {}, radar = {} }) {
  const DB = { players: [glowna, duplikat], reports, observations };
  const positionMapAssignments = JSON.parse(JSON.stringify(mapa));
  const radarPrzejrzane = { ...radar };
  const f = new Function('DB', 'positionMapAssignments', 'radarPrzejrzane', 'importNorm',
    `${ciało[0]}; return scalKartoteki;`);
  const wynik = f(DB, positionMapAssignments, radarPrzejrzane, importNorm)(glowna, duplikat);
  return { wynik, glowna, DB, positionMapAssignments, radarPrzejrzane };
}

// 1. Przypadek Marcinho: karta z protokołu ŁNP i karta z profilu agencji.
{
  const glowna = { id: 'A', firstName: 'Marcinho', lastName: 'Marcinho', clubId: 'K1',
    matches: 7, minutes: 324, goals: 5, position: 'Pomocnik ofensywny', birthYear: '1996',
    przebieg: [{ rywal: 'Sandecja', dom: true, minuty: 90 }] };
  const duplikat = { id: 'B', firstName: 'Manoel Oliveira da Silva', lastName: 'Marcinho', clubId: 'K1',
    matches: 3, minutes: 120, goals: 1, height: 176, foot: 'Prawa', nationality: 'Brazylia',
    tmLink: 'https://transfermarkt.pl/x', monitored: true,
    przebieg: [{ rywal: 'Sandecja', dom: true, minuty: 90 }, { rywal: 'Wisła', dom: false, minuty: 45 }] };
  const s = scena({ glowna, duplikat,
    reports: [{ id: 'R1', playerId: 'B' }, { id: 'R2', playerId: 'A' }],
    observations: [{ id: 'O1', playerId: 'B' }] });

  console.log('\n1. Dwie kartoteki tego samego zawodnika');
  sprawdz('raport z duplikatu przeszedł', s.DB.reports.find(r => r.id === 'R1').playerId === 'A');
  sprawdz('raport głównej nietknięty', s.DB.reports.find(r => r.id === 'R2').playerId === 'A');
  sprawdz('obserwacja przeszła', s.DB.observations[0].playerId === 'A');
  sprawdz('policzono 1 raport i 1 obserwację', s.wynik.raportow === 1 && s.wynik.obserwacji === 1,
    JSON.stringify(s.wynik));

  console.log('   przebieg po scaleniu: ' + s.glowna.przebieg.map(x => x.rywal).join(', '));
  sprawdz('ten sam mecz NIE dubluje się', s.glowna.przebieg.length === 2, JSON.stringify(s.glowna.przebieg));
  sprawdz('nowy mecz doszedł', s.glowna.przebieg.some(x => x.rywal === 'Wisła'));

  sprawdz('mecze: wyższa wartość, nie suma (7, nie 10)', s.glowna.matches === 7, String(s.glowna.matches));
  sprawdz('minuty: wyższa wartość (324, nie 444)', s.glowna.minutes === 324, String(s.glowna.minutes));
  sprawdz('gole: wyższa wartość (5, nie 6)', s.glowna.goals === 5, String(s.glowna.goals));

  sprawdz('wzrost uzupełniony z duplikatu', s.glowna.height === 176);
  sprawdz('noga uzupełniona', s.glowna.foot === 'Prawa');
  sprawdz('narodowość uzupełniona', s.glowna.nationality === 'Brazylia');
  sprawdz('link do Transfermarktu uzupełniony', !!s.glowna.tmLink);
  sprawdz('Monitoring przenosi się', s.glowna.monitored === true);
  sprawdz('imię z głównej NIE zostało nadpisane', s.glowna.firstName === 'Marcinho', s.glowna.firstName);
  sprawdz('rocznik z głównej NIE został nadpisany', s.glowna.birthYear === '1996');
}

// 2. Mapa pozycji: identyfikator musi się podmienić, inaczej zawodnik znika z boiska.
{
  const s = scena({
    glowna: { id: 'A', firstName: 'Jan', lastName: 'Kowalski' },
    duplikat: { id: 'B', firstName: 'Jan', lastName: 'Kowalski' },
    mapa: { 'II liga|||wszystkie|||5': ['X', 'B'], 'II liga|||wszystkie|||4': ['A', 'B'], 'inne': ['Z'] },
  });
  console.log('\n2. Mapa pozycji');
  console.log('   pole 5: ' + s.positionMapAssignments['II liga|||wszystkie|||5'].join(', '));
  console.log('   pole 4: ' + s.positionMapAssignments['II liga|||wszystkie|||4'].join(', '));
  sprawdz('duplikat podmieniony na główną', s.positionMapAssignments['II liga|||wszystkie|||5'].includes('A'));
  sprawdz('nie ma już starego identyfikatora',
    !JSON.stringify(s.positionMapAssignments).includes('"B"'));
  sprawdz('gdy obaj stali w jednym polu — zostaje jeden wpis',
    s.positionMapAssignments['II liga|||wszystkie|||4'].filter(x => x === 'A').length === 1,
    s.positionMapAssignments['II liga|||wszystkie|||4'].join(','));
  sprawdz('pola bez duplikatu nietknięte', s.positionMapAssignments['inne'].join() === 'Z');
}

// 3. Radar: przejrzany duplikat nie może wrócić na listę jako „nowy".
{
  const s = scena({
    glowna: { id: 'A' }, duplikat: { id: 'B' },
    radar: { B: '2026-09-01' },
  });
  console.log('\n3. Radar młodzieży');
  sprawdz('znacznik przejrzenia przeszedł na główną', s.radarPrzejrzane.A === '2026-09-01');
  sprawdz('po duplikacie nie ma śladu', !s.radarPrzejrzane.B);
}

// 4. Listy (wyróżnienia, załączniki) łączą się, a nie nadpisują.
{
  const s = scena({
    glowna: { id: 'A', wyroznienia: [{ m: 1 }], committeeReports: [] },
    duplikat: { id: 'B', wyroznienia: [{ m: 2 }], committeeReports: [{ name: 'pdf' }] },
  });
  console.log('\n4. Listy');
  sprawdz('wyróżnienia z obu kart', s.glowna.wyroznienia.length === 2);
  sprawdz('załącznik z duplikatu doszedł', s.glowna.committeeReports.length === 1);
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
