// Sprawdza dopasowanie klubu z kartoteki do wiersza tabeli 90minut — na PRAWDZIWYM kodzie z src/main.ts.
//
// Zgłoszenie (25.09.2026, IV liga śląska): „KS Rozwój Katowice" stał na 4. miejscu z 19 punktami
// i wołał o brakującą kolejkę („9/8"), choć w tabeli ma 15. miejsce, 7 punktów i 8 rozegranych
// meczów — pierwszą kolejkę ma przełożoną na 21 listopada. Powód: wiersz „GKS II Katowice" ma
// rdzeń „katowice" (skrót i numer zespołu odpadają), więc pasował do każdego klubu z Katowic,
// a wygrywał ten stojący wyżej w tabeli. Te same punkty brała „Lgks 38 Podlesianka Katowice".
//
// Uruchomienie:  node scripts/test-wiersz-z-tabeli.mjs
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
  wytnij('importNorm', /const importNorm = \(s\)=>[\s\S]*?;\r?\n/),
  wytnij('SZUM_NAZWY_KLUBU', /const SZUM_NAZWY_KLUBU = [^\n]*\n/),
  wytnij('NUMER_ZESPOLU', /const NUMER_ZESPOLU = \{[^\n]*\};/),
  wytnij('SKROTY_NAZWY', /const SKROTY_NAZWY = \{[\s\S]*?\n\};/),
  wytnij('rozwinSkroty', /const rozwinSkroty = [^\n]*\n/),
  wytnij('tenSamCzlon', /const tenSamCzlon = \(x, y\)=>\{[\s\S]*?\n\};/),
  wytnij('rozbijNazweKlubu', /function rozbijNazweKlubu\(nazwa\)\{[\s\S]*?\n\}/),
  wytnij('wierszZTabeli', /function wierszZTabeli\(klub\)\{[\s\S]*?\n\}/),
  wytnij('miejsceWTabeli', /function miejsceWTabeli\(klub\)\{[\s\S]*?\n\}/),
].join('\n');

// Tabela IV ligi śląskiej po 9. kolejce — spisana z 90minut (25.09.2026).
const tabeleLig = {
  'IV liga (śląska)': { kolejek: 9, wiersze: [
    { miejsce: 1,  nazwa: 'Unia Turza Śląska', mecze: 9, punkty: 22 },
    { miejsce: 2,  nazwa: 'MRKS Czechowice-Dziedzice', mecze: 9, punkty: 21 },
    { miejsce: 3,  nazwa: 'Ruch II Chorzów', mecze: 9, punkty: 20 },
    { miejsce: 4,  nazwa: 'GKS II Katowice', mecze: 9, punkty: 19 },
    { miejsce: 5,  nazwa: 'Spójnia Landek', mecze: 9, punkty: 18 },
    { miejsce: 6,  nazwa: 'Ruch Radzionków', mecze: 9, punkty: 17 },
    { miejsce: 7,  nazwa: 'Podbeskidzie II Bielsko-Biała', mecze: 8, punkty: 15 },
    { miejsce: 8,  nazwa: 'Przemsza Siewierz', mecze: 9, punkty: 15 },
    { miejsce: 9,  nazwa: 'Polonia Łaziska Górne', mecze: 9, punkty: 15 },
    { miejsce: 10, nazwa: 'Szombierki Bytom', mecze: 8, punkty: 10 },
    { miejsce: 11, nazwa: 'Drama Zbrosławice', mecze: 9, punkty: 9 },
    { miejsce: 12, nazwa: 'Kuźnia Ustroń', mecze: 9, punkty: 8 },
    { miejsce: 13, nazwa: 'Piast II Gliwice', mecze: 9, punkty: 7 },
    { miejsce: 14, nazwa: 'Podlesianka Katowice', mecze: 9, punkty: 7 },
    { miejsce: 15, nazwa: 'Rozwój Katowice', mecze: 8, punkty: 7 },
    { miejsce: 16, nazwa: 'LKS Bełk', mecze: 9, punkty: 5 },
    { miejsce: 17, nazwa: 'Gwarek Tarnowskie Góry', mecze: 8, punkty: 3 },
    { miejsce: 18, nazwa: 'Victoria Częstochowa', mecze: 9, punkty: 0 },
  ] },
  'I liga': { wiersze: [{ miejsce: 1, nazwa: 'Widzew Łódź', mecze: 9 }] },
};
const { wierszZTabeli, miejsceWTabeli } = new Function('tabeleLig',
  `${kod}\n return { wierszZTabeli, miejsceWTabeli };`)(tabeleLig);

const SL = 'IV liga (śląska)';
const klub = (name, league = SL) => ({ name, league });
const wiersz = (name, league) => { const w = wierszZTabeli(klub(name, league)); return w ? w.nazwa : null; };

console.log('\n1. Trzy kluby z Katowic — każdy do swojego wiersza');
sprawdz('KS Rozwój Katowice → „Rozwój Katowice" (15. miejsce)', wiersz('KS Rozwój Katowice') === 'Rozwój Katowice', String(wiersz('KS Rozwój Katowice')));
sprawdz('Lgks 38 Podlesianka Katowice → „Podlesianka Katowice"', wiersz('Lgks 38 Podlesianka Katowice') === 'Podlesianka Katowice', String(wiersz('Lgks 38 Podlesianka Katowice')));
sprawdz('GKS Gieksa Katowice II → „GKS II Katowice" (rezerwy)', wiersz('GKS Gieksa Katowice II') === 'GKS II Katowice', String(wiersz('GKS Gieksa Katowice II')));
sprawdz('Rozwój ma 15. miejsce, nie 4.', miejsceWTabeli(klub('KS Rozwój Katowice')) === 15, String(miejsceWTabeli(klub('KS Rozwój Katowice'))));
sprawdz('Rozwój bierze swoje 8 meczów, nie cudze 9',
  (wierszZTabeli(klub('KS Rozwój Katowice')) || {}).mecze === 8);
sprawdz('Rozwój bierze swoje 7 punktów, nie cudze 19',
  (wierszZTabeli(klub('KS Rozwój Katowice')) || {}).punkty === 7);

console.log('\n2. Numer zespołu musi się zgadzać po obu stronach');
sprawdz('pierwsza drużyna nie bierze wiersza rezerw', wiersz('KS Ruch Chorzów') === null, String(wiersz('KS Ruch Chorzów')));
sprawdz('rezerwy nie biorą wiersza pierwszej drużyny (Piast II)', wiersz('GKS Piast Gliwice II') === 'Piast II Gliwice');
sprawdz('TS Podbeskidzie Bielsko-biała II → wiersz rezerw', wiersz('TS Podbeskidzie Bielsko-biała II') === 'Podbeskidzie II Bielsko-Biała');
sprawdz('Ruch Chorzów II → wiersz rezerw', wiersz('Ruch Chorzów II') === 'Ruch II Chorzów');

console.log('\n3. Reszta ligi dalej łapie swoje wiersze');
[['LKS Unia Turza Śląska','Unia Turza Śląska'], ['MRKS Czechowice-Dziedzice','MRKS Czechowice-Dziedzice'],
 ['Spójnia Landek-jasienica','Spójnia Landek'], ['KS Ruch Radzionków','Ruch Radzionków'],
 ['LKS Przemsza Siewierz','Przemsza Siewierz'], ['KS Polonia Łaziska Górne','Polonia Łaziska Górne'],
 ['GKS Szombierki Bytom','Szombierki Bytom'], ['LKS Drama Zbrosławice','Drama Zbrosławice'],
 ['KS Kuźnia Ustroń','Kuźnia Ustroń'], ['KS Decor Bełk','LKS Bełk'],
 ['TS Gwarek Tarnowskie Góry','Gwarek Tarnowskie Góry'], ['Victoria Kosmos M-bet Częstochowa','Victoria Częstochowa'],
].forEach(([nasz, ich]) => sprawdz(`${nasz} → „${ich}"`, wiersz(nasz) === ich, String(wiersz(nasz))));
sprawdz('„Widzew Łódź SA" dalej trafia w krótszy wiersz', wiersz('Widzew Łódź SA', 'I liga') === 'Widzew Łódź');
sprawdz('klub spoza tabeli — brak wiersza', wiersz('Stal Mielec') === null);
sprawdz('liga bez pobranej tabeli — brak wiersza', wiersz('Zawisza Bydgoszcz', 'IV liga (kujawsko-pomorska)') === null);

console.log('\n4. Remis między wierszami to zgadywanka — nie wybieramy żadnego');
{
  const tab = { 'X liga': { wiersze: [{ miejsce: 1, nazwa: 'Gryf Słupsk' }, { miejsce: 2, nazwa: 'Gryf Wejherowo' }] } };
  const api = new Function('tabeleLig', `${kod}\n return { wierszZTabeli };`)(tab);
  sprawdz('samo „Gryf" nie dostaje ani Słupska, ani Wejherowa',
    api.wierszZTabeli({ name: 'KS Gryf', league: 'X liga' }) === null);
  sprawdz('„Gryf Słupsk" dostaje swój wiersz',
    (api.wierszZTabeli({ name: 'KS Gryf Słupsk', league: 'X liga' }) || {}).nazwa === 'Gryf Słupsk');
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
