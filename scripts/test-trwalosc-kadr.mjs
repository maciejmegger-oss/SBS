// Sprawdza, że przynależność do kadry PRZEŻYWA odświeżenie strony — na PRAWDZIWYCH funkcjach.
//
// Błąd, którego pilnuje: tabela sbs_talents nie ma kolumny „reprezentacja", więc zapis po cichu
// ją wycinał i po odświeżeniu kadra U-16 znikała.
//
// Uruchomienie:  node scripts/test-trwalosc-kadr.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
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
  wytnij('mapaKadrZTalentow', /function mapaKadrZTalentow\(talenty\)\{[\s\S]*?\n\}/),
  wytnij('nalozKadryNaTalenty', /function nalozKadryNaTalenty\(talenty, mapa\)\{[\s\S]*?\n\}/),
  wytnij('tenSamTalent', /function tenSamTalent\(t, n\)\{[\s\S]*?\n\}/),
  wytnij('scalPowolanychZIstniejacymi', /function scalPowolanychZIstniejacymi\(istniejace, nowe\)\{[\s\S]*?\n\}/),
].join('\n');
const api = new Function(`${kod}\n return { mapaKadrZTalentow, nalozKadryNaTalenty, scalPowolanychZIstniejacymi };`)();

console.log('\n0. Przyczyna błędu — nadal aktualna?');
const tabela = (schemat.match(/create table if not exists sbs_talents \([\s\S]*?\);/) || [''])[0];
sprawdz('sbs_talents NIE ma kolumny na kadrę — dlatego potrzebny jest osobny zapis',
  !/reprezentacja/.test(tabela), tabela);

console.log('\n1. Symulacja odświeżenia: zapis → tabela wycina pole → odczyt → nałożenie mapy');
{
  const wPamieci = [
    { id: 'T1', firstName: 'Antoni', lastName: 'Miernik', club: 'Chelsea FC', reprezentacja: 'U-16', krajKlubu: 'Anglia' },
    { id: 'T2', firstName: 'Antoni', lastName: 'Balcer', club: 'Talent Warszawa', reprezentacja: 'U-16' },
    { id: 'T3', firstName: 'Jan', lastName: 'Zwykły', club: 'Wda Świecie' },
  ];
  const mapaWKv = JSON.parse(JSON.stringify(api.mapaKadrZTalentow(wPamieci)));
  // Dokładnie to, co robiła baza: kolumn reprezentacja i kraj_klubu nie ma, więc wiersz wraca bez nich.
  const zBazy = wPamieci.map(({ reprezentacja, krajKlubu, ...reszta }) => ({ ...reszta }));
  sprawdz('bez mapy kadra przepada — tak wyglądał błąd', zBazy.every(t => !t.reprezentacja));
  api.nalozKadryNaTalenty(zBazy, mapaWKv);
  sprawdz('po nałożeniu Miernik znów jest w U-16', zBazy[0].reprezentacja === 'U-16', JSON.stringify(zBazy[0]));
  sprawdz('i ma z powrotem kraj klubu', zBazy[0].krajKlubu === 'Anglia', JSON.stringify(zBazy[0]));
  sprawdz('Balcer też wrócił do U-16', zBazy[1].reprezentacja === 'U-16');
  sprawdz('talent spoza kadry nie dostał kadry znikąd', !zBazy[2].reprezentacja, JSON.stringify(zBazy[2]));
  sprawdz('mapa nie trzyma wpisów bez kadry', !('T3' in mapaWKv), JSON.stringify(mapaWKv));
}

console.log('\n2. Usunięty talent sam wypada z mapy przy następnym zapisie');
{
  const mapa = api.mapaKadrZTalentow([{ id: 'T1', reprezentacja: 'U-16' }]);
  sprawdz('po usunięciu T2 w mapie jest tylko T1', Object.keys(mapa).join() === 'T1', JSON.stringify(mapa));
}

console.log('\n3. Istniejąca wartość ma pierwszeństwo przed kopią');
{
  const t = [{ id: 'T1', reprezentacja: 'U-17' }];
  api.nalozKadryNaTalenty(t, { T1: { reprezentacja: 'U-16', krajKlubu: 'Niemcy' } });
  sprawdz('kadra wpisana na wpisie NIE jest nadpisana', t[0].reprezentacja === 'U-17', JSON.stringify(t[0]));
  sprawdz('puste pole kraju zostaje uzupełnione', t[0].krajKlubu === 'Niemcy', JSON.stringify(t[0]));
}

console.log('\n4. Ponowne wklejenie komunikatu NIE robi duplikatów — i odzyskuje utraconą kadrę');
{
  // Stan po błędzie: wpisy są, ale kadrę wyciął zapis.
  const lista = [
    { id: 'T1', firstName: 'Natan', lastName: 'Łukasiewicz', club: 'ŁKS Łódź' },
    { id: 'T2', firstName: 'David', lastName: 'Sulewski', club: 'FC Bayern München' },
  ];
  const komunikat = [
    { firstName: 'Natan', lastName: 'Łukasiewicz', club: 'ŁKS Łódź', reprezentacja: 'U-16' },
    { firstName: 'David', lastName: 'Sulewski', club: 'FC Bayern München', krajKlubu: 'Niemcy', reprezentacja: 'U-16' },
    { firstName: 'Marcel', lastName: 'Zdybał', club: 'Lech Poznań', reprezentacja: 'U-16' },
  ];
  const w = api.scalPowolanychZIstniejacymi(lista, komunikat);
  console.log(`   do dodania: ${w.doDodania.length}, uzupełnionych: ${w.uzupelnieni}`);
  sprawdz('dwóch już było — dostają kadrę, nie drugi wpis', w.uzupelnieni === 2, JSON.stringify(w));
  sprawdz('tylko nowy (Zdybał) idzie do dodania', w.doDodania.length === 1 && w.doDodania[0].lastName === 'Zdybał');
  sprawdz('Łukasiewicz ma z powrotem U-16', lista[0].reprezentacja === 'U-16');
  sprawdz('Sulewski ma z powrotem kraj klubu', lista[1].krajKlubu === 'Niemcy');
}

console.log('\n5. Polskie znaki różnie zapisane to ta sama osoba');
{
  const lista = [{ id: 'T1', firstName: 'Natan', lastName: 'Lukasiewicz', club: 'LKS Lodz' }];
  const w = api.scalPowolanychZIstniejacymi(lista, [{ firstName: 'Natan', lastName: 'Łukasiewicz', club: 'ŁKS Łódź', reprezentacja: 'U-16' }]);
  sprawdz('„Lukasiewicz / LKS Lodz" = „Łukasiewicz / ŁKS Łódź"', w.uzupelnieni === 1 && w.doDodania.length === 0, JSON.stringify(w));
}

console.log('\n6. Dwóch imienników z RÓŻNYCH klubów to dwie osoby');
{
  const lista = [{ id: 'T1', firstName: 'Jakub', lastName: 'Kowalski', club: 'Wda Świecie' }];
  const w = api.scalPowolanychZIstniejacymi(lista, [{ firstName: 'Jakub', lastName: 'Kowalski', club: 'Legia Warszawa', reprezentacja: 'U-16' }]);
  sprawdz('powołany z Legii NIE dostaje wpisu chłopaka z Wdy', w.uzupelnieni === 0 && w.doDodania.length === 1, JSON.stringify(w));
  sprawdz('wpis z Wdy został bez kadry', !lista[0].reprezentacja);
}

console.log('\n7. Import z arkusza (bez kadry) działa jak dotąd');
{
  const lista = [{ id: 'T1', firstName: 'Jan', lastName: 'Nowak', club: 'Wda' }];
  const w = api.scalPowolanychZIstniejacymi(lista, [{ firstName: 'Jan', lastName: 'Nowak', club: 'Wda' }]);
  sprawdz('wpis bez kadry idzie do dodania, nic nie jest scalane', w.doDodania.length === 1 && w.uzupelnieni === 0);
}

console.log('\n8. Zapis i odczyt są podpięte w aplikacji');
sprawdz('odczyt „scouting:talenty_kadry" przy starcie', zrodlo.includes("czytaj('scouting:talenty_kadry')"));
sprawdz('nałożenie mapy po wczytaniu talentów', /nalozKadryNaTalenty\(DB\.talents, talentyKadry\)/.test(zrodlo));
sprawdz('saveTalents zapisuje też kadry', /async function saveTalents\(\)\{[\s\S]*?saveTalentyKadry\(\)[\s\S]*?\n\}/.test(zrodlo));
sprawdz('zapis talentów przenosi kadrę do wiersza talentu',
  /robustStorageSet\('scouting:talents', JSON\.stringify\(talentyDoZapisu\(DB\.talents\)\)\)/.test(zrodlo));
// Kolejność zmiennych musi odpowiadać kolejności odczytów w Promise.all — przesunięcie o jeden
// podstawiłoby ustawienia pod kadry i odwrotnie.
const zmienne = (zrodlo.match(/const \[p, c, o, rp, tl[^\]]*\]/) || [''])[0];
const pozKadr = zmienne.split(',').map(s => s.trim().replace(/^const \[/, '')).indexOf('kadryRow');
// Blok kończy się linią „  ]);" na początku wiersza — zwykłe „]);" łapało się wcześniej, w komentarzu.
const odczyty = (zrodlo.match(/await Promise\.all\(\[\r?\n\s*czytaj\('scouting:players'\)[\s\S]*?\r?\n\s{2}\]\);/) || [''])[0]
  .split(/\r?\n/).filter(l => /^\s*czytaj\(/.test(l)).map(l => l.trim());
sprawdz('kadryRow stoi na tej samej pozycji co odczyt talenty_kadry',
  pozKadr >= 0 && (odczyty[pozKadr] || '').includes('talenty_kadry'),
  `zmienna #${pozKadr}, odczyt tam: ${odczyty[pozKadr]}`);

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
