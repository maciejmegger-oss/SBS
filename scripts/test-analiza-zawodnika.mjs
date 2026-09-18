// Sprawdza pełną analizę zawodnika: decyzję końcową z trzech głosów (raporty, opinia AI, wskaźnik)
// i szacunek poziomu — na PRAWDZIWYCH funkcjach z src/main.ts.
// Zgłoszenie (18.09.2026): „dwa raporty z meczów i opinia AI, czyli 3 raporty" → decyzja i poziom.
//
// Uruchomienie:  node scripts/test-analiza-zawodnika.mjs
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
const bezTypow = (s) => s.replace(/ as number/g, '').replace(/ as string/g, '');

const kod = [
  wytnij('topLevelOf', /function topLevelOf\(league\)\{[\s\S]*?\n\}/),
  wytnij('sredniaZRaportow', /function sredniaZRaportow\(reps\)\{[\s\S]*?\n\}/),
  wytnij('DRABINA_POZIOMOW', /const DRABINA_POZIOMOW = \[.*\];/),
  wytnij('WERDYKTY', /const WERDYKTY = \[.*\];/),
  wytnij('GLOS_SYSTEMU', /const GLOS_SYSTEMU = \{.*\};/),
  wytnij('werdyktZWyniku', /function werdyktZWyniku\(w\)\{[\s\S]*?\n\}/),
  bezTypow(wytnij('werdyktZOpiniiAI', /function werdyktZOpiniiAI\(tekst\)\{[\s\S]*?\n\}/)),
  wytnij('glosRaportu', /function glosRaportu\(r\)\{[\s\S]*?\n\}/),
  wytnij('decyzjaKoncowa', /function decyzjaKoncowa\(an, raporty, opiniaAI\)\{[\s\S]*?\n\}/),
  wytnij('szacunekPoziomu', /function szacunekPoziomu\(p, an\)\{[\s\S]*?\n\}/),
].join('\n');
const api = new Function('ligaZawodnika', `${kod}\n return { werdyktZOpiniiAI, glosRaportu, decyzjaKoncowa, szacunekPoziomu, werdyktZWyniku };`)((p) => p.liga || '');

const raport = (perspektywa, ocena, extra = {}) => ({ perspektywa, phases: { a: ocena, b: ocena }, setPieces: {}, ...extra });
const OPINIA = `CO MÓWIĄ DANE
...
WERDYKT
DALSZA OBSERWACJA — dwa raporty to za mało, a oceny się rozchodzą.
REKOMENDOWANY POZIOM
III liga pewnie, II liga z ryzykiem`;

console.log('\n1. Werdykt i poziom z opinii AI');
{
  const w = api.werdyktZOpiniiAI(OPINIA);
  sprawdz('werdykt DALSZA OBSERWACJA', w.werdykt === 'DALSZA OBSERWACJA', JSON.stringify(w));
  sprawdz('poziom z sekcji REKOMENDOWANY POZIOM', w.poziom === 'III liga pewnie, II liga z ryzykiem', JSON.stringify(w));
  sprawdz('„NIE TRANSFEROWAŁBYM" to nie „TRANSFEROWAŁBYM"', api.werdyktZOpiniiAI('WERDYKT\nNIE TRANSFEROWAŁBYM — za słaby.\nREKOMENDOWANY POZIOM\nIV liga').werdykt === 'NIE TRANSFEROWAŁBYM');
  sprawdz('pogrubienia i dwukropek modelu nie przeszkadzają', api.werdyktZOpiniiAI('**WERDYKT:** TESTY — sprawdzić na treningu.\n**REKOMENDOWANY POZIOM:** II liga').werdykt === 'TESTY');
  sprawdz('TRANSFEROWAŁBYM rozpoznany', api.werdyktZOpiniiAI('WERDYKT\nTRANSFEROWAŁBYM, bo...').werdykt === 'TRANSFEROWAŁBYM');
  sprawdz('bez sekcji WERDYKT — brak werdyktu (nie zgadujemy)', api.werdyktZOpiniiAI('Brak danych o zawodniku.').werdykt === null);
}

console.log('\n2. Decyzja końcowa z trzech głosów');
{
  // Jak u Marcinho: dwa raporty, opinia AI, wskaźnik „niższy priorytet", mała próba.
  const an = { recoTone: 'no', nData: 2, overall: 4.1, age: 30 };
  const dk = api.decyzjaKoncowa(an, [raport('WYSOKA', 5), raport('ŚREDNIA', 4)], { tekst: OPINIA });
  sprawdz('4 głosy: dwa raporty, opinia AI, wskaźnik', dk.glosy.length === 4, JSON.stringify(dk.glosy));
  sprawdz('średnia 1,375 → DALSZA OBSERWACJA', dk.werdykt === 'DALSZA OBSERWACJA' && Math.abs(dk.srednia - 1.375) < 1e-9, JSON.stringify(dk));
  sprawdz('głosy rozbieżne (od TRANSFER do NIE) — rozstrzyga komitet', dk.zgodne === false);
  sprawdz('poziom wg AI przekazany dalej', dk.ai && dk.ai.poziom === 'III liga pewnie, II liga z ryzykiem');
}
{
  const an = { recoTone: 'go', nData: 2 };
  const dk = api.decyzjaKoncowa(an, [raport('WYSOKA', 6), raport('WYSOKA', 6)], { tekst: 'WERDYKT\nTRANSFEROWAŁBYM' });
  sprawdz('wszyscy za transferem, ale mała próba → TESTY, z wyjaśnieniem', dk.werdykt === 'TESTY' && /Za mało danych/.test(dk.ograniczenie), JSON.stringify(dk));
  sprawdz('głosy zgodne', dk.zgodne === true);
  const pewny = api.decyzjaKoncowa({ recoTone: 'go', nData: 6 }, [raport('WYSOKA', 6), raport('WYSOKA', 6)], { tekst: 'WERDYKT\nTRANSFEROWAŁBYM' });
  sprawdz('przy wystarczających danych → TRANSFEROWAŁBYM', pewny.werdykt === 'TRANSFEROWAŁBYM', JSON.stringify(pewny));
}
{
  const dk = api.decyzjaKoncowa({ recoTone: 'watch', nData: 2 }, [raport('', 3.5)], null);
  sprawdz('bez opinii AI i bez perspektywy — głos z średniej raportu (3,5 → obserwacja)', dk.glosy.length === 2 && dk.glosy[0].wynik === 1 && !dk.ai, JSON.stringify(dk));
  sprawdz('brak raportów i wskaźnika — brak decyzji', api.decyzjaKoncowa({ recoTone: 'hold', nData: 0 }, [], null).werdykt === null);
}

console.log('\n3. Poziom — szacunek systemu');
{
  const s = api.szacunekPoziomu({ liga: 'III liga, gr. IV' }, { overall: 4.1, age: 30 });
  sprawdz('4,1/6 w III lidze → „III liga pewnie"', s.pewnie === 'III liga' && !s.ryzyko && /^III liga pewnie\. Obecnie: III liga\.$/.test(s.tekst), JSON.stringify(s));
  const s2 = api.szacunekPoziomu({ liga: 'III liga, gr. IV' }, { overall: 4.7, age: 24 });
  sprawdz('4,7/6 → III liga pewnie, II liga z ryzykiem', s2.tekst.startsWith('III liga pewnie, II liga z ryzykiem'), s2.tekst);
  const s3 = api.szacunekPoziomu({ liga: 'IV liga (śląska)' }, { overall: 5.4, age: 21 });
  sprawdz('5,4/6 młody w IV lidze → III pewnie, II z ryzykiem', s3.pewnie === 'III liga' && s3.ryzyko === 'II liga', JSON.stringify(s3));
  const s4 = api.szacunekPoziomu({ liga: 'IV liga (śląska)' }, { overall: 5.4, age: 31 });
  sprawdz('ten sam wynik po trzydziestce — bez skoku o dwa poziomy', s4.pewnie === 'III liga' && s4.ryzyko === 'III liga' && s4.tekst.startsWith('III liga pewnie.'), JSON.stringify(s4));
  const s5 = api.szacunekPoziomu({ liga: 'II liga' }, { overall: 3.2, age: 26 });
  sprawdz('3,2/6 w II lidze → III liga pewnie (poziom niżej)', s5.pewnie === 'III liga', JSON.stringify(s5));
  sprawdz('Ekstraklasa nie wychodzi poza drabinę', api.szacunekPoziomu({ liga: 'Ekstraklasa' }, { overall: 5.8, age: 22 }).ryzyko === 'Ekstraklasa');
  sprawdz('junior — bez szacunku seniorskiego', /juniorskie/.test(api.szacunekPoziomu({ liga: 'CLJ U19' }, { overall: 5, age: 17 }).tekst));
  sprawdz('bez ligi — komunikat', /Brak ligi/.test(api.szacunekPoziomu({ liga: '' }, { overall: 5 }).tekst));
}

console.log('\n4. Podpięcie');
sprawdz('przycisk „🔍 Analiza zawodnika" w profilu', /data-action="analiza-zawodnika" data-id="\$\{p\.id\}"[^>]*>🔍 Analiza zawodnika<\/button>/.test(zrodlo));
sprawdz('przycisk uruchamia pełną analizę z opinią AI', zrodlo.includes("openPlayerAnalysisModal((b as HTMLElement).dataset.id, { automatycznieAI: true })"));
sprawdz('okno ma raporty z meczów, poziom i decyzję końcową',
  zrodlo.includes('${raportyMeczoweHtml(an.reports)}') && zrodlo.includes('<div id="decyzja-koncowa"') && zrodlo.includes('decyzjaKoncowaHtml(decyzjaKoncowa(an, an.reports, (p as any).opiniaAI), szacunek)'));
sprawdz('decyzja przeliczana po nadejściu opinii AI', /pobierzOpinieAI\(playerId, .*, odswiezDecyzje\);/.test(zrodlo) && /if\(poZapisie\) poZapisie\(\);/.test(zrodlo));
sprawdz('świeża zapisana opinia nie jest pobierana drugi raz', /const aktualna = !!\(zapisana && zapisana\.tekst && String\(zapisana\.data \|\| ''\)\.slice\(0, 10\) >= najnowszyRaport\);/.test(zrodlo));
sprawdz('PDF zawiera decyzję końcową i poziom', /<h2>Decyzja końcowa/.test(zrodlo) && zrodlo.includes("wiersz('Poziom (szacunek systemu)', szacunek.tekst)"));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
