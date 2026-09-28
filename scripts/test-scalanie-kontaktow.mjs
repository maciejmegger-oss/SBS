// Sprawdza scalanie duplikatów w Kontakty → Polska (przycisk „🧹 Scal duplikaty").
//
// Zgłoszenie (28.09.2026): na liście ten sam klub stał po kilka razy („Avia Świdnik" i „AVIA
// ŚWIDNIK", „Cartuzia Kartuzy" ×4, „Lech Poznań Akademia"/„Biuro"). Ma zostać jeden wiersz na klub.
//
// Uruchomienie:  node scripts/test-scalanie-kontaktow.mjs
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
const lev = zrodlo.match(/function odlegloscEdycyjna\(a, b\)\{[\s\S]*?\n\}/)[0];
const fn = zrodlo.match(/const DOPISKI_KONTAKTU[\s\S]*?\nfunction planScaleniaKontaktow\(kontakty\)\{[\s\S]*?\n\}/)[0];
const importNorm = (s) => String(s || '').toLowerCase().replace(/[łøđ]/g, c => ({ 'ł': 'l', 'ø': 'o', 'đ': 'd' }[c])).normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '');
const contactClubName = (c) => String((c && (c.club || c.name)) || '').trim();
const planScaleniaKontaktow = new Function('ADRESY_KLUBOW', 'importNorm', 'contactClubName', `${lev};${fn};return planScaleniaKontaktow;`)(
  ADRESY_KLUBOW, importNorm, contactClubName);

let n = 0;
const k = (club, email, firstName = '', lastName = '', note = '') => ({ id: 'C' + (++n), club, email, firstName, lastName, phone: '', note });
const lista = [
  k('Avia Świdnik', 'biuro@aviaswidnik.pl'), k('AVIA ŚWIDNIK', 'kontakt@avia-swidnik.pl'),
  k('Cartuzia Kartuzy', 'joanna.szulc@cartusia1923.pl', 'Joanna', 'Szulc'), k('Cartuzia Kartuzy', 'biuro@cartusia1923.pl'),
  k('Cartuzia Kartuzy', 'cartusia.kartuzy@pomorski-zpn.pl'), k('CARTUZIA kARTUZY', 'biuro@cartusia1923.pl'),
  k('Lech Poznań', 'lech@lechpoznan.pl'), k('Lech Poznań Akademia', 'akademia@lechpoznan.pl'), k('Lech Poznań Biuro', 'biuro@lechpoznan.pl'),
  k('Chojniczanka', 'mikolaj.szalewski@mkschojniczanka.pl', 'Mikołaj', 'Szalewski'), k('Chojniczanka Chojnice', ''),
  k('MKS Chojniczanka', 'sekretariat@mkschojniczanka.pl'), k('Chojniczanka II Chojnice', ''),
  k('Sparta', 'info@sparta.katowice.pl'), k('SPARTA PRAGA', 'info@sparta.cz'), k('Sparta Sycewice', 'sparta.sycewice@pomorski-zpn.pl'),
  k('Akademia Piątek', 'akademia.piatek@pomorski-zpn.pl', '', '', 'Zaimportowano bez nazwy klubu — uzupełnij ręcznie.'),
  k('Widzew Łodź', 'sekretariat@widzew.com'), k('Widzew Łódź', 'sekretariat@widzew.com'),
  k('Widzew Łódź', 'wojciech.pawlowski@widzew.com', 'Wojciech', 'Pawłowski'),
  k('KSZO Ostrowiec', 'biuro@kszo1929.pl'), k('KSZO OSTROWIEC ŚWIĘTOKRZYSKI', 'kontakt@kszo1929.pl'),
  k('Korona Kielce', 'korona.sa@korona-kielce.pl'), k('Pogoń Nowe Skalerzyce', 'pogon.noweskalmierzyce@wielkopolskizpn.pl'),
];
const plan = planScaleniaKontaktow(lista);
const usuwane = new Set(plan.doUsuniecia.map(x => x.id));
const zm = new Map(plan.zmiany.map(z => [z.k.id, z.nowe]));
const wynik = lista.filter(x => !usuwane.has(x.id)).map(x => ({ ...x, ...(zm.get(x.id) || {}) }));
const wiersze = (nazwa) => wynik.filter(x => x.club === nazwa);
const wszystkieMaile = (x) => [x.email, ...[...String(x.note).matchAll(/[\w.+-]+@[\w.-]+\.\w+/g)].map(m => m[0])];

console.log('\n1. Jeden wiersz na klub');
sprawdz('„Avia Świdnik" i „AVIA ŚWIDNIK" → jeden wiersz', wiersze('Avia Świdnik').length === 1, JSON.stringify(wiersze('Avia Świdnik')));
sprawdz('„Lech Poznań" + Akademia + Biuro → jeden wiersz „Lech Poznań"', wiersze('Lech Poznań').length === 1 && !wynik.some(x => /Lech Poznań (Akademia|Biuro)/.test(x.club)));
sprawdz('„Widzew Łodź" (literówka) łączy się z „Widzew Łódź"', !wynik.some(x => x.club === 'Widzew Łodź') && wiersze('Widzew Łódź').length === 2);
sprawdz('„KSZO OSTROWIEC ŚWIĘTOKRZYSKI" bez wersalików i razem z „KSZO Ostrowiec"', wiersze('KSZO Ostrowiec Świętokrzyski').length === 1);
sprawdz('„Chojniczanka", „MKS Chojniczanka" → „Chojniczanka Chojnice"', !wynik.some(x => /^(MKS )?Chojniczanka$/.test(x.club)));

console.log('\n2. Poprawione nazwy');
sprawdz('„Cartuzia" → „Cartusia Kartuzy" (z bazy klubów)', wiersze('Cartusia Kartuzy').length === 2 && !wynik.some(x => /Cartuzia/i.test(x.club)));
sprawdz('„Pogoń Nowe Skalerzyce" → „Pogoń Nowe Skalmierzyce"', wiersze('Pogoń Nowe Skalmierzyce').length === 1);
sprawdz('„Korona Kielce" zostaje (nie „KORONA S.A. Kielce")', wiersze('Korona Kielce').length === 1);

console.log('\n3. Nic nie ginie, nic obcego się nie łączy');
{
  const przed = new Set(lista.map(x => x.email).filter(Boolean));
  const po = new Set(wynik.flatMap(wszystkieMaile).filter(Boolean));
  const zgubione = [...przed].filter(m => !po.has(m));
  sprawdz('każdy e-mail jest dalej na liście (w wierszu albo w notatce)', !zgubione.length, zgubione.join(', '));
}
sprawdz('osoby z imieniem zostają osobnymi wierszami', ['Joanna', 'Mikołaj', 'Wojciech'].every(im => wynik.some(x => x.firstName === im)));
sprawdz('ogólny adres biura na pierwszym miejscu', wiersze('Lech Poznań')[0].email === 'biuro@lechpoznan.pl', wiersze('Lech Poznań')[0].email);
sprawdz('rezerwy nie łączą się z pierwszą drużyną', wiersze('Chojniczanka II Chojnice').length === 1);
sprawdz('„Sparta" nie łączy się ani z Pragą, ani z Sycewicami', ['Sparta', 'Sparta Praga', 'Sparta Sycewice'].every(nz => wiersze(nz).length === 1));
sprawdz('znika notatka „Zaimportowano bez nazwy klubu"', !wynik.some(x => /Zaimportowano bez nazwy/.test(x.note)));
{
  const drugi = planScaleniaKontaktow(wynik.map(x => ({ ...x })));
  sprawdz('drugie kliknięcie niczego już nie zmienia', !drugi.doUsuniecia.length && !drugi.zmiany.length,
    `${drugi.doUsuniecia.length} do usunięcia, ${drugi.zmiany.length} zmian`);
}

console.log('\n4. Przycisk');
sprawdz('przycisk na liście polskiej', /data-action="contacts-merge-duplicates"/.test(zrodlo));
sprawdz('przed zmianą pyta o zgodę', /contacts-merge-duplicates"\]'\)[\s\S]{0,400}confirm\(/.test(zrodlo));
sprawdz('najpierw zapis, potem usuwanie powtórzeń', /const zapisano = await saveContacts\(\);[\s\S]{0,200}deleteContactRecords/.test(zrodlo));
sprawdz('klient go nie widzi', /'contacts-merge-duplicates'/.test(zrodlo.slice(zrodlo.indexOf('const AKCJE_BEZ_KLIENTA'))));

console.log(bledy ? `\n${bledy} błąd(ów).` : '\nWszystko działa.');
process.exit(bledy ? 1 : 0);
