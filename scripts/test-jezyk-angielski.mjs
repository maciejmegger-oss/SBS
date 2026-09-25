// Sprawdza przełącznik języka PL/EN: tłumacza (src/i18n/tlumacz.ts), słownik (src/i18n/en.ts) i podpięcie.
//
// Uruchomienie:  node scripts/test-jezyk-angielski.mjs
import fs from "node:fs";
import { buildSync } from "esbuild";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

const { outputFiles } = buildSync({
  stdin: { contents: "export { zbudujTlumacza } from './src/i18n/tlumacz.ts'; export { EN } from './src/i18n/en.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: "esm", write: false,
});
const { zbudujTlumacza, EN } = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
const t = zbudujTlumacza(EN);

console.log('\n1. Całe napisy');
sprawdz('„Kluby" → „Clubs"', t('Kluby') === 'Clubs', t('Kluby'));
sprawdz('„Śr. ocena" → „Avg. rating"', t('Śr. ocena') === 'Avg. rating', t('Śr. ocena'));
sprawdz('białe znaki na brzegach zostają', t('  Zapisz \n') === '  Save \n', JSON.stringify(t('  Zapisz \n')));
sprawdz('„Do transferu" → „For transfer"', t('Do transferu') === 'For transfer');

console.log('\n2. Frazy wewnątrz tekstów z liczbami i ikonami');
sprawdz('„🔄 Odśwież statystyki"', t('🔄 Odśwież statystyki') === '🔄 Refresh stats', t('🔄 Odśwież statystyki'));
sprawdz('„⏱ Odśwież statystyki — cały widok (18)"', t('⏱ Odśwież statystyki — cały widok (18)') === '⏱ Refresh stats — whole view (18)', t('⏱ Odśwież statystyki — cały widok (18)'));
sprawdz('„Nowych nazwisk: 1074"', t('Nowych nazwisk: 1074') === 'New names: 1074', t('Nowych nazwisk: 1074'));
sprawdz('„Czekają na decyzję (3)"', t('Czekają na decyzję (3)') === 'Awaiting decision (3)', t('Czekają na decyzję (3)'));
sprawdz('najdłuższa fraza wygrywa („Odśwież statystyki — cały widok" przed „Odśwież statystyki")',
  !/Refresh stats — cały/.test(t('Odśwież statystyki — cały widok (5)')));

console.log('\n3. Pojedyncze słowa tylko jako cały napis — nazwy własne zostają');
sprawdz('„Usuń (3)" → „Delete (3)"', t('Usuń (3)') === 'Delete (3)', t('Usuń (3)'));
sprawdz('„Młode Talenty Toruń" bez zmian', t('Młode Talenty Toruń') === 'Młode Talenty Toruń', t('Młode Talenty Toruń'));
sprawdz('„Talent Warszawa" bez zmian', t('Talent Warszawa') === 'Talent Warszawa', t('Talent Warszawa'));
sprawdz('„Wisła Nowe" bez zmian', t('Wisła Nowe') === 'Wisła Nowe');
sprawdz('„Klub Sportowy Legia" bez zmian (słowo „Klub" w nazwie)', t('Klub Sportowy Legia') === 'Klub Sportowy Legia', t('Klub Sportowy Legia'));
sprawdz('nazwisko zawodnika bez zmian', t('Kowalski Jan') === 'Kowalski Jan');
sprawdz('liczby i puste — bez zmian', t('2013') === '2013' && t('') === '' && t('—') === '—');

console.log('\n4. Nazwy rozgrywek nie są tłumaczone (to dane i klucze dopasowania)');
['I liga', 'III liga, gr. II', 'CLJ U17 gr. I', 'Rocznik 2013', 'Ekstraklasa'].forEach(n => sprawdz(`„${n}" bez zmian`, t(n) === n, t(n)));
sprawdz('słownik nie zawiera nazw lig ani roczników', !Object.keys(EN).some(k => /^(I|II|III|IV) liga|^CLJ |^Rocznik \d{4}$/.test(k)));

console.log('\n5. Słownik');
const klucze = Object.keys(EN);
sprawdz(`słownik ma sensowny rozmiar (${klucze.length} napisów)`, klucze.length >= 400);
sprawdz('każdy wpis ma tłumaczenie', klucze.every(k => typeof EN[k] === 'string' && EN[k].trim().length > 0), klucze.filter(k => !EN[k]).join(', '));
sprawdz('menu przetłumaczone w całości', ['Dashboard', 'Kluby', 'Zawodnicy', 'Plan Obserwacji', 'Raporty', 'Monitoring', 'Radar młodzieży', 'Ranking', 'Talent', 'Scout Transfer', 'Menedżerowie', 'Kontakty', 'Ustawienia', 'Dostęp'].every(k => k in EN));

console.log('\n6. Podpięcie');
const zrodlo = fs.readFileSync('src/main.ts', 'utf8');
const app = fs.readFileSync('app.html', 'utf8');
const dom = fs.readFileSync('src/i18n/dom.ts', 'utf8');
sprawdz('tłumaczenie uruchamiane przy starcie', /import \{ uruchomTlumaczenie, odswiezPrzelacznikJezyka \} from "\.\/i18n\/dom";\s*uruchomTlumaczenie\(\);/.test(zrodlo));
sprawdz('przycisk odświeżany razem z panelem bocznym', /odswiezPrzelacznikMotywu\(\);\s*odswiezPrzelacznikJezyka\(\);/.test(zrodlo));
// Przełącznik to już nie jeden przycisk, tylko grupa flag (PL / EN / DE) budowana w dom.ts.
sprawdz('przełącznik w app.html, sam nie jest tłumaczony', /id="lang-toggle"[^>]*data-bez-tlumaczenia/.test(app));
sprawdz('pola do pisania i kod są pomijane', /const POMIN = 'script, style, textarea, code, pre, \[data-bez-tlumaczenia\]/.test(dom));
sprawdz('nowe fragmenty strony tłumaczone obserwatorem zmian', /new MutationObserver/.test(dom) && /childList: true, subtree: true, characterData: true/.test(dom));
// Przy trzech językach każda zmiana zaczyna od przywrócenia polskich oryginałów — inaczej
// przejście z angielskiego na niemiecki tłumaczyłoby tekst już przetłumaczony, a słownik zna
// wyłącznie polskie klucze.
sprawdz('zmiana języka zaczyna od przywrócenia oryginałów',
  /przywrocPoddrzewo\(document\.body\);\s*\n\s*if \(nowy !== 'pl'\) przetlumaczPoddrzewo\(document\.body\);/.test(dom));
sprawdz('okienka alert/confirm też tłumaczone', /window\.alert = /.test(dom) && /window\.confirm = /.test(dom));
sprawdz('wybór zapamiętany w przeglądarce', /localStorage\.setItem\(KLUCZ, nowy\)/.test(dom));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
