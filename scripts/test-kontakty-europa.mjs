// Sprawdza podział zakładki Kontakty na Polskę i Europę oraz bazę kontaktów europejskich.
//
// Zgłoszenie (27.09.2026): „w zakładce kontakty podział Polska / Europa — po kliknięciu Polska
// lista kontaktów klubów, którą już mamy, po kliknięciu Europa baza z arkusza. Zrób rozpoznawalne
// ikonki do kliknięcia."
//
// Uruchomienie:  node scripts/test-kontakty-europa.mjs
import fs from "node:fs";
import { buildSync } from "esbuild";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

const { outputFiles } = buildSync({
  stdin: { contents: "export { KONTAKTY_EUROPA } from './src/data/kontakty-europa.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: "esm", write: false,
});
const { KONTAKTY_EUROPA } = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
const zrodlo = fs.readFileSync("src/main.ts", "utf8");

console.log('\n1. Baza z arkusza');
sprawdz(`kontakty przeniesione (${KONTAKTY_EUROPA.length})`, KONTAKTY_EUROPA.length >= 40, String(KONTAKTY_EUROPA.length));
{
  const kraje = [...new Set(KONTAKTY_EUROPA.map(k => k.kraj))].filter(Boolean);
  sprawdz(`kraje: ${kraje.join(', ')}`, kraje.length >= 7, String(kraje.length));
  sprawdz('Szwecja pierwsza — to kraj priorytetowy w arkuszu', KONTAKTY_EUROPA[0].kraj === 'Szwecja', KONTAKTY_EUROPA[0].kraj);
  sprawdz('każdy wpis ma klub i osobę', KONTAKTY_EUROPA.every(k => k.klub && k.osoba));
  sprawdz('każdy wpis ma status weryfikacji', KONTAKTY_EUROPA.every(k => k.status));
  sprawdz('każdy wpis ma źródło albo jawnie go nie ma', KONTAKTY_EUROPA.every(k => typeof k.zrodlo === 'string'));
  const zAdresem = KONTAKTY_EUROPA.filter(k => /@/.test(k.email));
  // W kolumnie maila arkusz trzyma czasem powód braku adresu („ukryty na stronie…") — to również
  // informacja, ale nie adres, więc nie może trafić do odnośnika mailto.
  const zPowodem = KONTAKTY_EUROPA.filter(k => k.email && !/@/.test(k.email));
  sprawdz(`${zAdresem.length} osób z adresem, ${zPowodem.length} z adnotacją zamiast adresu`,
    zAdresem.length > 0 && zPowodem.every(k => /ukryt|brak|skopiuj/i.test(k.email)),
    zPowodem.map(k => k.email).slice(0, 2).join(' | '));
  sprawdz('adnotacja nie zamienia się w odnośnik mailto',
    /const maAdres = \/@\/\.test\(k\.email\);/.test(zrodlo));
  sprawdz('nie ma maili zgadywanych „imię.nazwisko@" bez źródła',
    zAdresem.every(k => k.zrodlo), zAdresem.filter(k => !k.zrodlo).map(k => k.osoba).join(', '));
}

console.log('\n2. Przełącznik Polska / Europa');
sprawdz('dwie pigułki z ikonami — flaga i glob',
  /pill\(`Polska \(\$\{zestawienieKlubowPL\(\)\.length\}\)`, kontaktyZakladka !== 'europa', 'kontakty-zakladka', \{val:'polska'\}, '🇵🇱'\)/.test(zrodlo)
  && /pill\(`Europa \(\$\{KONTAKTY_EUROPA\.length\}\)`, kontaktyZakladka === 'europa', 'kontakty-zakladka', \{val:'europa'\}, '🌍'\)/.test(zrodlo));
sprawdz('domyślnie otwiera się Polska', /let kontaktyZakladka: 'polska' \| 'europa' = 'polska';/.test(zrodlo));
sprawdz('kliknięcie przełącza zakładkę', /\[data-action="kontakty-zakladka"\]/.test(zrodlo));
sprawdz('przełączenie zeruje wyszukiwanie', /kontaktyZakladka = wybrana === 'europa' \? 'europa' : 'polska';\s*\n\s*contactSearchQuery = '';/.test(zrodlo));
sprawdz('pigułki widać w obu zakładkach', (zrodlo.match(/\$\{zakladki\}/g) || []).length >= 2);
sprawdz('polska lista została nietknięta (import z arkusza, kolumny jak były)',
  /<thead><tr><th>#<\/th><th>Klub<\/th><th>Adres obiektu<\/th><th>Email<\/th>/.test(zrodlo));

console.log('\n3. Widok europejski');
sprawdz('grupowanie po krajach z flagą', /flagaKraju\(kraj\)\} \$\{esc\(kraj \|\| 'Pozostałe'\)\}/.test(zrodlo));
sprawdz('flagi rozpoznają kraje z arkusza',
  ['Szwecja','Dania','Włochy','Francja','Belgia','Austria','Szwajcaria','Turcja'].every(k => new RegExp(`'${k}':'`).test(zrodlo)));
sprawdz('e-mail osoby klikalny, a gdy go nie ma — kontakt klubu',
  /osoby brak &middot; /.test(zrodlo) && /href="mailto:\$\{esc\(k\.email\)\}"/.test(zrodlo));
sprawdz('źródło otwiera się w nowej karcie', /źródło ↗/.test(zrodlo));
sprawdz('status weryfikacji ma barwę wg legendy z arkusza', /function barwaStatusuKontaktu\(status\)\{[\s\S]*?var\(--good\)/.test(zrodlo));
sprawdz('priorytet 1 oznaczony przy nazwisku', /Priorytet 1 — kontaktować w pierwszej kolejności/.test(zrodlo));
sprawdz('szukanie działa po kraju, klubie i stanowisku', /const stog = szukajNorm\(\[k\.kraj, k\.klub, k\.osoba, k\.stanowisko/.test(zrodlo));

console.log('\n4. Skąd się biorą dane');
sprawdz('plik danych wygenerowany, nie pisany ręcznie', /NIE POPRAWIAJ RĘCZNIE/.test(fs.readFileSync('src/data/kontakty-europa.ts', 'utf8')));
sprawdz('skrypt przenoszący arkusz jest w repozytorium', fs.existsSync('scripts/wczytaj-kontakty-europa.mjs'));
sprawdz('widok czyta dane z pliku', /import \{ KONTAKTY_EUROPA, RANKINGI_CIES \} from "\.\/data\/kontakty-europa";/.test(zrodlo));

console.log('\n5. Rankingi CIES pod listą');
{
  const { outputFiles: r } = buildSync({
    stdin: { contents: "export { RANKINGI_CIES } from './src/data/kontakty-europa.ts';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: "esm", write: false,
  });
  const { RANKINGI_CIES } = await import("data:text/javascript;base64," + Buffer.from(r[0].text).toString("base64"));
  sprawdz(`rankingi przeniesione z arkusza (${RANKINGI_CIES.length})`, RANKINGI_CIES.length >= 20, String(RANKINGI_CIES.length));
  sprawdz('saldo transferów 2015–2024 (Benfica +816)', RANKINGI_CIES.some(x => /Saldo transferów/.test(x.ranking) && /Benfica \+816/.test(x.klub)));
  sprawdz('pressing 2023/24 (Man. City 15,2)', RANKINGI_CIES.some(x => /Pressing/.test(x.ranking) && /Man\. City 15,2/.test(x.klub)));
  sprawdz('widok pokazuje rankingi w zwijanej sekcji', /Rankingi akademii CIES Football Observatory/.test(zrodlo));
  const kraje = [...new Set(KONTAKTY_EUROPA.map(k => k.kraj))].filter(Boolean);
  const bezFlagi = kraje.filter(k => !new RegExp(`'${k}':'`).test(zrodlo));
  sprawdz('każdy kraj z arkusza ma flagę', !bezFlagi.length, bezFlagi.join(', '));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
