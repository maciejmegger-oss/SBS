// Sprawdza uzupełnianie adresów obiektów i e-maili polskich klubów z arkusza Kluby_Polska_Adresy.xlsx.
//
// Zgłoszenie (28.09.2026): „uzupełnij w polskiej liście kontaktów klubów wszystkie adresy klubów".
//
// Uruchomienie:  node scripts/test-adresy-klubow.mjs
import fs from "node:fs";
import { buildSync } from "esbuild";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};

const { outputFiles } = buildSync({
  stdin: { contents: "export { ADRESY_KLUBOW } from './src/data/adresy-klubow.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: "esm", write: false,
});
const { ADRESY_KLUBOW } = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
const zrodlo = fs.readFileSync("src/main.ts", "utf8");

console.log('\n1. Dane z arkusza');
sprawdz(`klubów z adresem lub e-mailem: ${ADRESY_KLUBOW.length}`, ADRESY_KLUBOW.length >= 200, String(ADRESY_KLUBOW.length));
sprawdz('każdy wpis ma status i źródło albo status „Do potwierdzenia"',
  ADRESY_KLUBOW.every(a => a.status && (a.zrodlo || a.status === 'Do potwierdzenia' || a.status === 'Częściowo')),
  ADRESY_KLUBOW.filter(a => !a.status).map(a => a.klub).join(', '));
sprawdz('każdy e-mail wygląda jak adres',
  ADRESY_KLUBOW.every(a => !a.email || /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(a.email)),
  ADRESY_KLUBOW.filter(a => a.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(a.email)).map(a => a.email).join(', '));
sprawdz('każdy klub raz', new Set(ADRESY_KLUBOW.map(a => a.klub)).size === ADRESY_KLUBOW.length);
{
  // Nazwy muszą się pokrywać z bazą klubów SBS, inaczej przycisk niczego nie znajdzie.
  const seed = [...zrodlo.matchAll(/const SEED_CLUBS_[A-Z0-9_]+ = \[([\s\S]*?)\]\.map/g)]
    .flatMap(m => [...m[1].matchAll(/name:"([^"]+)"/g)].map(x => x[1]));
  const pokryte = seed.filter(n => ADRESY_KLUBOW.some(a => a.klub === n));
  sprawdz(`kluby z bazy SBS pokryte arkuszem: ${pokryte.length}/${seed.length}`, pokryte.length / seed.length > 0.85);
}

console.log('\n2. Przycisk w Kontakty → Polska');
sprawdz('przycisk jest na liście polskiej', /data-action="contacts-fill-addresses"/.test(zrodlo));
sprawdz('przycisk ma obsługę', /\[data-action="contacts-fill-addresses"\]/.test(zrodlo));
sprawdz('klient go nie widzi (akcja pracowni)', /'contacts-fill-addresses'/.test(zrodlo.slice(zrodlo.indexOf('const AKCJE_BEZ_KLIENTA'))));

console.log('\n3. Uzupełnia tylko puste pola');
{
  const fn = zrodlo.match(/function planUzupelnieniaAdresow\(\)\{[\s\S]*?\n\}/)[0];
  const importNorm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/[^a-z0-9]/g, '');
  const DB = {
    clubs: [{ id: 'K1', name: 'GKS Tychy' }, { id: 'K2', name: 'Stal Stalowa Wola' }, { id: 'K3', name: 'Klub spoza arkusza' }, { id: 'K4', name: 'Sandecja Nowy Sącz' }],
    contacts: [
      { id: 'C1', club: 'GKS Tychy', email: '' },
      { id: 'C2', club: 'Stal Stalowa Wola', email: 'moj@adres.pl' },
      { id: 'C3', club: 'Klub spoza arkusza', email: '' },
    ],
    settings: { stadiumAddresses: { K2: 'adres wpisany w planie obserwacji' } },
  };
  const contactClubName = (c) => String((c && (c.club || c.name)) || '').trim();
  const clubIdByName = (n) => (DB.clubs.find(c => importNorm(c.name) === importNorm(n)) || {}).id || null;
  const plan = new Function('ADRESY_KLUBOW', 'DB', 'importNorm', 'contactClubName', 'clubIdByName', `${fn}; return planUzupelnieniaAdresow();`)(
    ADRESY_KLUBOW, DB, importNorm, contactClubName, clubIdByName);
  sprawdz('pusty adres dostaje adres z arkusza', plan.adresy.some(x => x.c.id === 'K1' && /Edukacji 7/.test(x.a.adres)));
  sprawdz('adres wpisany ręcznie zostaje', !plan.adresy.some(x => x.c.id === 'K2'));
  sprawdz('pusty e-mail dostaje oficjalny', plan.emaile.some(x => x.k.id === 'C1' && x.a.email === 'biuro@kp-gkstychy.pl'));
  sprawdz('e-mail wpisany ręcznie zostaje', !plan.emaile.some(x => x.k.id === 'C2'));
  sprawdz('klub spoza arkusza nietknięty', !plan.adresy.some(x => x.c.id === 'K3') && !plan.emaile.some(x => x.k.id === 'C3'));
  sprawdz('klub z bazy bez wiersza na liście czeka na dopisanie', plan.brakujace.map(x => x.c.id).join() === 'K4', plan.brakujace.map(x => x.c.id).join());
}

console.log(bledy ? `\n${bledy} błąd(ów).` : '\nWszystko działa.');
process.exit(bledy ? 1 : 0);
