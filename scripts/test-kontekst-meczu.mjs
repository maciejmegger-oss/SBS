// Sprawdza kontekst spotkania w raporcie — na PRAWDZIWYCH funkcjach i konfiguracji z kodu.
//
// Uruchomienie:  node scripts/test-kontekst-meczu.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const magazyn = fs.readFileSync("src/data/storage.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = '') => {
  console.log(`${warunek ? '  OK  ' : ' BŁĄD '} ${opis}${warunek ? '' : '   ' + dodatek}`);
  if (!warunek) bledy++;
};
const wytnij = (nazwa, wzor, tekst = zrodlo) => {
  const m = tekst.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

const kod = [
  wytnij('POSITION_NUMBERS', /const POSITION_NUMBERS = \[[\s\S]*?\n\];/),
  wytnij('kontekstMeczuHtml', /function kontekstMeczuHtml\(r\)\{[\s\S]*?\n\}/),
].join('\n');
const { kontekstMeczuHtml } = new Function('esc', `${kod}\n return { kontekstMeczuHtml };`)(
  (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));

console.log('\n1. Stare raporty nie mają czego pokazać — i nic nie pokazują');
// To jest sedno: w bazie leżą setki raportów sprzed tej zmiany. Pasek „— · — · —" sugerowałby,
// że skaut czegoś nie wypełnił, a on nie miał gdzie.
sprawdz('raport bez kontekstu daje pustą linię', kontekstMeczuHtml({}) === '', kontekstMeczuHtml({}));
sprawdz('same puste łańcuchy też nic nie dają',
  kontekstMeczuHtml({ rywal: '', wynik: '', minutyObejrzane: null, pozycjaWMeczu: null }) === '');

console.log('\n2. Komplet danych');
const pelny = kontekstMeczuHtml({ rywal: 'Korona Kożuchów (u siebie)', wynik: '2:1', minutyObejrzane: 90, pozycjaWMeczu: 6 });
console.log('   ' + pelny.replace(/<[^>]+>/g, '').trim());
sprawdz('rywal widoczny', /Korona Kożuchów/.test(pelny));
sprawdz('wynik widoczny', /2:1/.test(pelny));
sprawdz('obejrzane minuty z minutnikiem', /obejrzane 90′/.test(pelny), pelny);
sprawdz('pozycja rozwinięta z numeru NMG', /6 · Defensywny pomocnik/.test(pelny), pelny);

console.log('\n3. Zero obejrzanych minut to NIE to samo, co brak wpisu');
const zero = kontekstMeczuHtml({ minutyObejrzane: 0 });
sprawdz('zero minut jest pokazane, nie połknięte', /obejrzane 0′/.test(zero), JSON.stringify(zero));

console.log('\n4. Same fragmenty — pokazujemy to, co jest');
sprawdz('sam rywal wystarczy', /Korona/.test(kontekstMeczuHtml({ rywal: 'Korona' })));
sprawdz('sama pozycja wystarczy', /1 · Bramkarz/.test(kontekstMeczuHtml({ pozycjaWMeczu: 1 })));
sprawdz('nieznany numer pozycji nie wywraca linii', kontekstMeczuHtml({ pozycjaWMeczu: 99 }) === '',
  kontekstMeczuHtml({ pozycjaWMeczu: 99 }));

console.log('\n5. Nazwa rywala jest treścią od użytkownika — musi być odkażona');
const zlosliwy = kontekstMeczuHtml({ rywal: '<img src=x onerror=alert(1)>' });
sprawdz('znaczniki HTML nie przechodzą', !/<img/.test(zlosliwy), zlosliwy);

console.log('\n6. Nowe pola idą do bazy — inaczej znikną po odświeżeniu strony');
const cfg = wytnij('konfiguracja sbs_reports', /sbs_reports: \{[\s\S]*?\n  \},/, magazyn);
['rywal', 'wynik', 'minutyObejrzane', 'pozycjaWMeczu'].forEach(pole=>{
  sprawdz(`„${pole}" jest na liście pól zapisywanych`, new RegExp(`"${pole}"`).test(cfg));
});

console.log('\n7. Formularz i zapis mówią o tych samych polach');
['rep-rywal', 'rep-wynik', 'rep-minuty', 'rep-pozycja-w-meczu'].forEach(id=>{
  sprawdz(`pole „${id}" istnieje w formularzu`, zrodlo.includes(`id="${id}"`));
  sprawdz(`pole „${id}" jest odczytywane przy zapisie`, zrodlo.includes(`getElementById('${id}')`));
});

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
