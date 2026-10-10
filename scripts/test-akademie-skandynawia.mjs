// Sprawdza kontakty do akademii w Szwecji i Norwegii (2.–3. poziom) w Kontakty → Europa.
//
// Zgłoszenie (30.09.2026): „zbierz adresy kontaktów w drugich i trzecich ligach szwedzkich, gdzie mają
// akademię, żeby aplikować na dyrektora albo koordynatora akademii — i to samo w Norwegii", potem
// „dodaj do Kontakty → Europa".
//
// Uruchomienie:  node scripts/test-akademie-skandynawia.mjs
import fs from "node:fs";
import { buildSync } from "esbuild";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

const { outputFiles } = buildSync({
  stdin: { contents: "export { KONTAKTY_AKADEMIE } from './src/data/akademie-skandynawia.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: "esm", write: false,
});
const { KONTAKTY_AKADEMIE: A } = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
const zrodlo = fs.readFileSync("src/main.ts", "utf8");

console.log('\n1. Baza z arkusza');
const ligi = [...new Set(A.map(k => k.liga))];
sprawdz(`${A.length} klubów`, A.length >= 80, String(A.length));
sprawdz(`ligi: ${ligi.join(', ')}`, ['Superettan', 'Ettan Norra', 'Ettan Södra', 'OBOS-ligaen'].every(l => ligi.includes(l))
  && ligi.some(l => /PostNord/.test(l)));
sprawdz('tylko Szwecja i Norwegia', A.every(k => k.kraj === 'Szwecja' || k.kraj === 'Norwegia'));
sprawdz('każdy wiersz ma klub, źródło i status', A.every(k => k.klub && k.zrodlo && k.status));
sprawdz('adres bez nazwiska trafia do kolumny klubu', A.every(k => k.osoba || !/@/.test(k.email)));
sprawdz('w kolumnie maila tylko adres albo adnotacja o ukryciu',
  A.every(k => !k.email || /@/.test(k.email) || /ukryt|skopiuj/i.test(k.email)));
const oferty = A.filter(k => k.priorytet === 1).map(k => k.klub);
sprawdz(`otwarte rekrutacje oznaczone (${oferty.join(', ')})`, oferty.includes('AFC Malmö') && oferty.includes('FK Haugesund'));

console.log('\n2. Widok');
sprawdz('Europa łączy obie bazy', /const KONTAKTY_EUROPA: any\[\] = \[\.\.\.KONTAKTY_EUROPA_SCOUTING, \.\.\.KONTAKTY_AKADEMIE\];/.test(zrodlo));
sprawdz('pigułka „Akademie" zawęża listę', /if\(europaTylkoAkademie && !k\.liga\) return false;/.test(zrodlo)
  && /data-action="europa-rodzaj"/.test(zrodlo));
sprawdz('szukanie obejmuje ligę i telefon', /k\.kraj, k\.liga, k\.klub/.test(zrodlo) && /k\.telefon, k\.uwagi/.test(zrodlo));

console.log(bledy ? `\n${bledy} błędów` : '\nWszystko OK');
process.exit(bledy ? 1 : 0);
