// Sprawdza profil zawodnika na tle pozycji i minuty ważone poziomem — na PRAWDZIWYCH funkcjach.
//
// Uruchomienie:  node scripts/test-profil-i-wagi.mjs
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
  wytnij('topLevelOf', /function topLevelOf\(league\)\{[\s\S]*?\n\}/),
  wytnij('wTychRozgrywkach', /function wTychRozgrywkach\(liga, wskazanie\)\{[\s\S]*?\n\}/),
  wytnij('POSITION_NUMBERS', /const POSITION_NUMBERS = \[[\s\S]*?\n\];/),
  wytnij('REPORT_PHASES', /const REPORT_PHASES = \[[\s\S]*?\n\];/),
  wytnij('REPORT_SET_PIECES', /const REPORT_SET_PIECES = \[[\s\S]*?\n\];/),
  wytnij('pozycjaDoPorownan', /function pozycjaDoPorownan\(p\)\{[\s\S]*?\n\}/),
  wytnij('MIN_GRUPA_POROWNANIA', /const MIN_GRUPA_POROWNANIA = \d+;/),
  wytnij('czyPoziomJuniorski', /function czyPoziomJuniorski\(poziom\)\{.*\}/),
  wytnij('metrykiZRaportow', /function metrykiZRaportow\(reps\)\{[\s\S]*?\n\}/),
  wytnij('sredniaPozycjiNaOsiach', /function sredniaPozycjiNaOsiach\(p\)\{[\s\S]*?\n\}/),
  wytnij('WAGI_POZIOMU_DOMYSLNE', /const WAGI_POZIOMU_DOMYSLNE = \{[\s\S]*?\};/),
  wytnij('WAGA_MIN', /const WAGA_MIN = [\d.]+, WAGA_MAX = [\d.]+;/),
  wytnij('wagiPoziomu', /function wagiPoziomu\(\)\{[\s\S]*?\n\}/),
  wytnij('kluczPoziomu', /function kluczPoziomu\(liga\)\{[\s\S]*?\n\}/),
  wytnij('wagaPoziomu', /function wagaPoziomu\(liga\)\{[\s\S]*?\n\}/),
  wytnij('minutyWazone', /function minutyWazone\(p\)\{[\s\S]*?\n\}/),
  wytnij('radarRaportow', /function radarRaportow\(metryki, opcje\)\{[\s\S]*?\n\}/),
].join('\n');

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt1 = (v) => Number(v).toFixed(1).replace('.', ',');

function scena({ players = [], clubs = [], reports = [], settings = {} } = {}) {
  const DB = { players, clubs, reports, settings };
  const clubLeague = (id) => (clubs.find(c => c.id === id) || {}).league || '';
  return new Function('DB', 'clubLeague', 'esc', 'fmt1', 'FAZY_BRAMKARZ',
    `${kod}\n return { metrykiZRaportow, sredniaPozycjiNaOsiach, kluczPoziomu, wagaPoziomu, minutyWazone, radarRaportow, wagiPoziomu };`
  )(DB, clubLeague, esc, fmt1, []);
}
// Raport z oceną w fazie ataku i obrony.
const rap = (playerId, atak, obrona) => ({ playerId, phases: { fazaAtaku: atak, fazaObrony: obrona }, setPieces: {} });

const KLUBY = [
  { id: 'K1', league: 'IV liga (lubuska)' }, { id: 'K2', league: 'IV liga (pomorska)' },
  { id: 'K3', league: 'III liga, gr. II' }, { id: 'K4', league: 'CLJ U15 gr. A' }, { id: 'K5', league: 'CLJ U19' },
];

console.log('\n1. Metryki osi — ten sam wzór co radar');
{
  const api = scena();
  const m = api.metrykiZRaportow([rap('A', 5, 3), rap('A', 3, 0)]);
  const atak = m.find(x => x.key === 'fazaAtaku'), obrona = m.find(x => x.key === 'fazaObrony');
  sprawdz('atak = średnia z dwóch raportów (5 i 3 → 4)', atak && Math.abs(atak.wartosc - 4) < 1e-9, JSON.stringify(atak));
  sprawdz('obrona liczona tylko z wypełnionego raportu (0 to brak oceny)', obrona && obrona.wartosc === 3 && obrona.zIlu === 1, JSON.stringify(obrona));
}

console.log('\n2. Średnia pozycji — bez samego zawodnika');
{
  const players = [
    { id: 'JA', clubId: 'K1', position: 'Napastnik' },
    { id: 'R1', clubId: 'K1', position: 'Napastnik' },
    { id: 'R2', clubId: 'K2', position: 'Napastnik' },   // inna grupa, ten sam poziom — liczy się
    { id: 'R3', clubId: 'K1', position: 'Napastnik' },
    { id: 'OB', clubId: 'K1', position: 'Obrońca środkowy' },  // inna pozycja — nie liczy się
    { id: 'III', clubId: 'K3', position: 'Napastnik' },        // inny poziom — nie liczy się
  ];
  const reports = [rap('JA', 6, 6), rap('R1', 3, 2), rap('R2', 4, 3), rap('R3', 5, 4), rap('OB', 1, 1), rap('III', 1, 1)];
  const w = scena({ players, clubs: KLUBY, reports }).sredniaPozycjiNaOsiach(players[0]);
  console.log('   ' + JSON.stringify(w));
  sprawdz('średnia ataku = (3+4+5)/3 = 4 — bez szóstki samego zawodnika', Math.abs(w.osie.fazaAtaku.srednia - 4) < 1e-9, JSON.stringify(w.osie));
  sprawdz('policzonych rywali: 3', w.rywali === 3, String(w.rywali));
  sprawdz('etykieta to poziom „IV liga", nie jedna grupa', w.etykieta === 'IV liga', w.etykieta);
}

console.log('\n3. Za mało ocenionych na osi → oś bez odniesienia');
{
  const players = [
    { id: 'JA', clubId: 'K1', position: 'Napastnik' },
    { id: 'R1', clubId: 'K1', position: 'Napastnik' },
    { id: 'R2', clubId: 'K1', position: 'Napastnik' },
    { id: 'R3', clubId: 'K1', position: 'Napastnik' },
  ];
  // Obronę ocenił tylko jeden rywal.
  const reports = [rap('JA', 5, 5), rap('R1', 3, 4), rap('R2', 4, 0), rap('R3', 5, 0)];
  const w = scena({ players, clubs: KLUBY, reports }).sredniaPozycjiNaOsiach(players[0]);
  sprawdz('atak ma odniesienie (3 ocenionych)', !!w.osie.fazaAtaku, JSON.stringify(w.osie));
  sprawdz('obrona NIE ma odniesienia (1 oceniony)', !w.osie.fazaObrony, JSON.stringify(w.osie));
}

console.log('\n4. Juniorzy tylko w swojej grupie');
{
  const players = [
    { id: 'JA', clubId: 'K4', position: 'Skrzydłowy' },
    { id: 'A', clubId: 'K4', position: 'Skrzydłowy' }, { id: 'B', clubId: 'K4', position: 'Skrzydłowy' },
    { id: 'C', clubId: 'K4', position: 'Skrzydłowy' },
    { id: 'U19', clubId: 'K5', position: 'Skrzydłowy' },
  ];
  const reports = [rap('JA', 4, 4), rap('A', 2, 2), rap('B', 3, 3), rap('C', 4, 4), rap('U19', 6, 6)];
  const w = scena({ players, clubs: KLUBY, reports }).sredniaPozycjiNaOsiach(players[0]);
  sprawdz('średnia bez dziewiętnastolatka: (2+3+4)/3 = 3', Math.abs(w.osie.fazaAtaku.srednia - 3) < 1e-9, JSON.stringify(w.osie));
  sprawdz('etykieta to grupa „CLJ U15 gr. A"', w.etykieta === 'CLJ U15 gr. A', w.etykieta);
}

console.log('\n5. Poziom rozgrywek z nazwy');
{
  const api = scena();
  const przypadki = [
    ['III liga, gr. II', 'III liga'], ['IV liga (lubuska)', 'IV liga'], ['CLJ U17 gr. II', 'CLJ U17'],
    ['CLJ U19', 'CLJ U19'], ['II liga', 'II liga'], ['I liga', 'I liga'], ['Rocznik 2012', 'Rocznik'],
    ['Klasa okręgowa', 'Klasa okręgowa'], ['Puchar Polski', null], ['', null],
  ];
  przypadki.forEach(([liga, oczekiwany]) => {
    const k = api.kluczPoziomu(liga);
    sprawdz(`„${liga}" → ${oczekiwany}`, k === oczekiwany, String(k));
  });
}

console.log('\n6. Minuty ważone');
{
  const clubs = KLUBY.concat([{ id: 'KX', league: 'Puchar Polski' }]);
  const api = scena({ clubs });
  sprawdz('900 min w III lidze × 0,45 = 405', api.minutyWazone({ minutes: 900, clubId: 'K3' }) === 405);
  sprawdz('900 min w IV lidze × 0,33 = 297', api.minutyWazone({ minutes: 900, clubId: 'K1' }) === 297);
  sprawdz('III liga waży więcej niż IV — ta sama liczba minut', api.minutyWazone({ minutes: 900, clubId: 'K3' }) > api.minutyWazone({ minutes: 900, clubId: 'K1' }));
  sprawdz('brak minut → brak wartości, nie zero', api.minutyWazone({ minutes: null, clubId: 'K3' }) === null);
  sprawdz('nieznane rozgrywki → nie ważymy zmyśloną liczbą', api.minutyWazone({ minutes: 900, clubId: 'KX' }) === null);
}

console.log('\n7. Wagi z Ustawień — i odporność na literówkę');
{
  const api = scena({ clubs: KLUBY, settings: { wagiPoziomu: { 'IV liga': 0.5, 'III liga': 0, 'CLJ U19': 'abc', 'Nieistniejąca': 1 } } });
  sprawdz('własna waga IV ligi działa: 900 × 0,5 = 450', api.minutyWazone({ minutes: 900, clubId: 'K1' }) === 450);
  sprawdz('waga 0 jest odrzucona — nie wyzeruje minut ligi', api.wagaPoziomu('III liga, gr. II') === 0.45);
  sprawdz('nie-liczba jest odrzucona', api.wagaPoziomu('CLJ U19') === 0.4);
  sprawdz('nieznany klucz nie dopisuje się do wag', !('Nieistniejąca' in api.wagiPoziomu()));
}

console.log('\n8. Radar z linią odniesienia');
{
  const api = scena();
  const metryki = [
    { key: 'a', label: 'Atak', wartosc: 4.5 }, { key: 'b', label: 'Obrona', wartosc: 3 },
    { key: 'c', label: 'Przejście', wartosc: 4 },
  ];
  const bez = api.radarRaportow(metryki);
  sprawdz('bez odniesienia nie ma przerywanej linii', !/radar-odniesienie/.test(bez));
  const pelne = api.radarRaportow(metryki, { odniesienie: [4, 3.5, 4] });
  sprawdz('pełne odniesienie rysuje przerywany wielokąt', /class="radar-odniesienie"[^>]*stroke-dasharray/.test(pelne));
  sprawdz('różnica dodatnia opisana znakiem „+" (4,5 wobec 4)', /\(\+0,5\)/.test(pelne), pelne.match(/\([^)]*\)/g));
  sprawdz('różnica ujemna opisana znakiem „−" (3 wobec 3,5)', /\(−0,5\)/.test(pelne));
  sprawdz('równe wartości opisane „(=)"', /\(=\)/.test(pelne));
  const czesciowe = api.radarRaportow(metryki, { odniesienie: [4, null, 4] });
  sprawdz('częściowe odniesienie: bez zamkniętego wielokąta', !/class="radar-odniesienie"/.test(czesciowe));
  sprawdz('częściowe odniesienie: znaczniki tylko na osiach z danymi', (czesciowe.match(/radar-odniesienie-pkt/g) || []).length === 2);
  sprawdz('odniesienie złej długości jest ignorowane', !/radar-odniesienie/.test(api.radarRaportow(metryki, { odniesienie: [4, 4] })));
}

console.log('\n9. Podpięcie w aplikacji');
sprawdz('profil podaje odniesienie do radaru', /radarRaportow\(a\.metryki, maOdn \? \{ odniesienie: odnWartosci \}/.test(zrodlo));
sprawdz('lista zawodników sortuje po minutach ważonych', zrodlo.includes("case 'minutyWazone': return { liczba: minutyWazone(p) };"));
sprawdz('ustawienia mają przycisk zapisu wag', zrodlo.includes('data-action="wagi-poziomu-zapisz"') && zrodlo.includes(`querySelectorAll('[data-action="wagi-poziomu-zapisz"]')`));
sprawdz('playerAvg korzysta ze wspólnego wzoru metryk', /const metryki = reps\.length \? metrykiZRaportow\(reps\) : \[\];/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
