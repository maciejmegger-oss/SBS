// Sprawdza zakładkę „Akademie" — kontakty do scoutingu i akademii klubów europejskich.
//
// Zgłoszenie (27.09.2026): „tu masz kluby do systemu, poszukaj kontaktów i wprowadź na listę
// oraz do bazy SBS" — lista akademii (rankingi CIES, saldo transferów, pressing) ma być
// dostępna w aplikacji, nie tylko w arkuszu.
//
// Uruchomienie:  node scripts/test-akademie.mjs
import fs from "node:fs";
import { buildSync } from "esbuild";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

const { outputFiles } = buildSync({
  stdin: { contents: "export { AKADEMIE, AKADEMIE_STAN, RANKINGI_CIES } from './src/data/akademie.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: "esm", write: false,
});
const { AKADEMIE, AKADEMIE_STAN, RANKINGI_CIES } = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
const zrodlo = fs.readFileSync("src/main.ts", "utf8");

console.log('\n1. Zawartość listy');
sprawdz(`ponad 150 wpisów (${AKADEMIE.length})`, AKADEMIE.length > 150, String(AKADEMIE.length));
sprawdz('data stanu podana', /^\d{2}\.\d{2}\.\d{4}$/.test(AKADEMIE_STAN), AKADEMIE_STAN);
for (const klub of ['SL Benfica', 'AFC Ajax', 'FC Red Bull Salzburg', 'LOSC Lille', 'Sporting CP', 'FC Nordsjælland', 'KRC Genk', 'Southampton FC', 'Celtic FC']) {
  sprawdz(`jest ${klub}`, AKADEMIE.some(a => a.klub === klub));
}

console.log('\n2. Każdy wpis kompletny');
const STATUSY = ['Zweryfikowany', 'Częściowo – brak maila osoby', 'Do potwierdzenia'];
const zle = AKADEMIE.filter(a => !a.kraj || !a.klub || ![1, 2, 3].includes(a.priorytet) || !STATUSY.includes(a.status)
  || !/^https?:\/\//.test(a.zrodlo));
sprawdz('kraj, klub, priorytet 1–3, znany status i link do źródła', !zle.length, zle.slice(0, 3).map(a => a.klub).join(', '));
// Część klubów nie publikuje żadnego kontaktu do akademii — wtedy zostaje strona klubu (źródło).
const bezKontaktu = AKADEMIE.filter(a => !a.email && !a.kontakt && !a.zrodlo);
sprawdz('każdy wpis ma kontakt: mail osoby, kontakt klubu albo stronę źródłową', !bezKontaktu.length, bezKontaktu.map(a => a.klub).join(', '));
const zleMaile = AKADEMIE.filter(a => a.email && !/ukryty/.test(a.email) && !/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(a.email));
sprawdz('mail osoby to poprawny adres albo informacja „ukryty na stronie"', !zleMaile.length, zleMaile.map(a => a.email).join(', '));
sprawdz('„Zweryfikowany" ma mail — osoby albo klubu', AKADEMIE.filter(a => a.status === 'Zweryfikowany').every(a => /@/.test(a.email + a.kontakt)));

const pary = AKADEMIE.map(a => a.kraj + '|' + a.klub + '|' + a.osoba);
sprawdz('bez zdublowanych wpisów (ten sam klub i osoba)', new Set(pary).size === pary.length,
  pary.filter((p, i) => pary.indexOf(p) !== i).join(', '));

console.log('\n3. Rankingi CIES');
sprawdz('są rankingi', RANKINGI_CIES.length >= 20, String(RANKINGI_CIES.length));
sprawdz('saldo transferów 2015–2024 (zrzut od użytkownika)', RANKINGI_CIES.some(r => /Saldo transferów/.test(r.ranking) && /Benfica \+816/.test(r.klub)));
sprawdz('pressing 2023/24 (zrzut od użytkownika)', RANKINGI_CIES.some(r => /Pressing/.test(r.ranking) && /Man\. City 15,2/.test(r.klub)));

console.log('\n4. Podpięcie zakładki');
sprawdz('„Akademie" stoi zaraz za „Menedżerowie" (Federacja zostaje nad Menedżerami)',
  /\{id:"agencies", label:"Menedżerowie"\},\s*\n\s*\{id:"akademie", label:"Akademie"\},/.test(zrodlo));
sprawdz('zakładka ma swój widok', /else if\(currentView==="akademie"\) main\.innerHTML = viewAkademie\(\);/.test(zrodlo));
sprawdz('widok czyta dane z src/data/akademie.ts', /import \{ AKADEMIE, AKADEMIE_STAN, RANKINGI_CIES \} from "\.\/data\/akademie";/.test(zrodlo));
sprawdz('filtry: kraj, priorytet, szukaj', ['ak-kraj', 'ak-prio', 'ak-szukaj'].every(id => zrodlo.includes(`getElementById('${id}')`)));
sprawdz('pole szukania ma id — render() przywraca w nim kursor', /<input id="ak-szukaj"/.test(zrodlo));
sprawdz('link do źródła otwiera się w nowej karcie', /źródło ↗<\/a>/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
