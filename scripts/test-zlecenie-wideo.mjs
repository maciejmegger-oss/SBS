// Sprawdza okno „Zleć analizę wideo": wskazanie pliku z dysku, wklejenie linku ze schowka
// i komunikat, gdy zapis się nie udaje.
//
// Zgłoszenie (30.09.2026): „do analizy zawodnika zrób możliwość otwarcia pliku z dysku lub wklejania
// linku do meczu", a potem „nie można wgrać meczu z dysku" — na zrzucie: „Nie udało się zapisać
// zlecenia: Could not find the table 'public.sbs_analiza_zlecenia' in the schema cache". Wybieranie
// pliku było sprawne, brakowało tabeli w bazie. Komunikat musi o tym mówić po polsku.
//
// Uruchomienie:  node scripts/test-zlecenie-wideo.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const migracja = "supabase/migration_2026-09-29_zlecenia_analiz.sql";
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
  wytnij('opisRozmiaruPliku', /function opisRozmiaruPliku\(bajty\)\{[\s\S]*?\n\}/),
  wytnij('komunikatBleduZlecenia', /function komunikatBleduZlecenia\(blad\)\{[\s\S]*?\n\}/),
].join('\n');
const api = new Function(`${kod}\n return { opisRozmiaruPliku, komunikatBleduZlecenia };`)();

console.log('\n1. Rozmiar nagrania po ludzku');
sprawdz('cały mecz w gigabajtach z przecinkiem', api.opisRozmiaruPliku(3.5 * 1024 ** 3) === '3,50 GB', api.opisRozmiaruPliku(3.5 * 1024 ** 3));
sprawdz('wycięty fragment w megabajtach', api.opisRozmiaruPliku(240 * 1024 ** 2) === '240 MB', api.opisRozmiaruPliku(240 * 1024 ** 2));
sprawdz('kilobajty, gdy ktoś wskaże nie to, co chciał', api.opisRozmiaruPliku(6000) === '6 KB', api.opisRozmiaruPliku(6000));
sprawdz('pusty plik nie pokazuje „0"', api.opisRozmiaruPliku(0) === '1 KB', api.opisRozmiaruPliku(0));

console.log('\n2. Komunikat, gdy zlecenie się nie zapisuje');
{
  const zBazy = "Could not find the table 'public.sbs_analiza_zlecenia' in the schema cache";
  const tekst = api.komunikatBleduZlecenia(zBazy);
  sprawdz('nie sugeruje, że problem jest z plikiem', /Plik i link są w porządku/.test(tekst), tekst);
  sprawdz('mówi wprost, czego brakuje w bazie', /tabeli zleceń/.test(tekst));
  sprawdz('podaje drogę: Supabase → SQL Editor', /Supabase → SQL Editor/.test(tekst));
  sprawdz('podaje nazwę pliku migracji', tekst.includes('migration_2026-09-29_zlecenia_analiz.sql'));
  sprawdz('zostawia surowy komunikat bazy na końcu', tekst.includes(zBazy));

  const rls = api.komunikatBleduZlecenia('new row violates row-level security policy for table "sbs_analiza_zlecenia"');
  sprawdz('odmowa RLS tłumaczona jako niezatwierdzone konto', /nie jest\s+jeszcze zatwierdzone/.test(rls), rls);
  const inny = api.komunikatBleduZlecenia('network error');
  sprawdz('inny błąd pokazany bez zgadywania', inny === 'Nie udało się zapisać zlecenia: network error', inny);
  sprawdz('okno zapisu korzysta z tego komunikatu', /alert\(komunikatBleduZlecenia\(blad\)\);/.test(zrodlo));
}

console.log('\n3. Plik z dysku');
sprawdz('przycisk „Wybierz plik" obok pola', /id="zl-wybierz"/.test(zrodlo));
sprawdz('okno wyboru przyjmuje formaty nagrań', /id="zl-plik-wybor" accept="video\/\*,\.mp4,\.mkv,\.mov,\.avi,\.ts,\.m4v"/.test(zrodlo));
sprawdz('wybranie pliku wpisuje jego nazwę i rozmiar',
  /const wskazPlik = \(f: File\)=>\{\s*\n\s*polePliku\.value = f\.name;[\s\S]{0,260}opisRozmiaruPliku\(f\.size\)/.test(zrodlo));
sprawdz('przeciągnięcie pliku na pole działa tak samo',
  /polePliku\.addEventListener\('drop'[\s\S]{0,320}if\(f\) wskazPlik\(f\);/.test(zrodlo));
sprawdz('napisane wprost, że nagranie zostaje na dysku skauta',
  /plik zostaje u Ciebie, do zlecenia idzie sama nazwa/.test(zrodlo));

console.log('\n4. Link do meczu');
sprawdz('przycisk „Wklej" przy polu linku', /id="zl-wklej"/.test(zrodlo));
sprawdz('czyta schowek przeglądarki', /navigator\.clipboard\.readText\(\)/.test(zrodlo));
sprawdz('gdy przeglądarka odmówi — podpowiada Ctrl + V', /wklej adres skrótem Ctrl\+V/.test(zrodlo));
sprawdz('wystarczy jedno z dwóch źródeł',
  /if\(!link && !plik\)\{ alert\('Podaj link do nagrania albo nazwę pliku\.'\); return; \}/.test(zrodlo));

console.log('\n5. Tabela w bazie');
{
  sprawdz('migracja leży w repozytorium', fs.existsSync(migracja));
  const sql = fs.readFileSync(migracja, 'utf8');
  sprawdz('tworzy tabelę bezpiecznie przy powtórzeniu', /create table if not exists public\.sbs_analiza_zlecenia/.test(sql));
  const zlecenia = fs.readFileSync('src/data/zlecenia.ts', 'utf8');
  const insert = (zlecenia.match(/insert\(\{[\s\S]*?\}\)/) || [''])[0];
  const kolumny = [...insert.matchAll(/^\s*([a-z_]+):/gm)].map(m => m[1]);
  sprawdz(`kod wysyła ${kolumny.length} kolumn`, kolumny.length >= 9, kolumny.join(', '));
  const brakujace = kolumny.filter(k => !new RegExp(`^\\s{2}${k}\\s`, 'm').test(sql));
  sprawdz('każda kolumna z kodu istnieje w migracji', !brakujace.length, brakujace.join(', '));
  sprawdz('kolejka czytana po utworzone_at — tak sortuje kod', /utworzone_at\s+timestamptz not null default now\(\)/.test(sql)
    && /\.order\("utworzone_at"/.test(zlecenia));
  sprawdz('zapis tylko dla zatwierdzonych kont', /for insert to authenticated\s*\n\s*with check \(public\.sbs_zatwierdzony\(\)\)/.test(sql));
  sprawdz('brak tabeli nie wywraca profilu zawodnika', /Zlecenia analiz niedostępne/.test(zlecenia));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : '\nWszystko przeszło.');
process.exit(bledy ? 1 : 0);
