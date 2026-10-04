// Sprawdza, że zapis JEDNEGO zawodnika wysyła do bazy jednego zawodnika, a nie całą kartotekę.
//
// Zgłoszenie (02.10.2026): „zapisywanie bardzo długo trwa". Okno zawodnika po kliknięciu „Zapisz"
// wołało savePlayers(), czyli wysyłkę CAŁEJ kolekcji — przy 16 671 kartotekach to kilkanaście
// megabajtów rozbitych na ponad osiemdziesiąt zapytań do bazy. Zmiana jednego pola nie może tyle
// kosztować.
//
// Pełny zapis zostaje tam, gdzie naprawdę zmienia się wiele kart naraz (import, scalanie,
// zbiorcze uzupełnianie) — i tego ten test pilnuje tak samo.
//
// Uruchomienie:  node scripts/test-zapis-jednego-zawodnika.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8").replace(/\r\n/g, "\n");
const magazyn = fs.readFileSync("src/data/storage.ts", "utf8").replace(/\r\n/g, "\n");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

console.log("\n1. Okno zawodnika — zapisuje tylko tę jedną kartę");
{
  const blok = wytnij("zapis z okna zawodnika", /const zapisanyWpis = [\s\S]{0,400}?\n    \}/);
  sprawdz("edytowany zawodnik idzie pojedynczo",
    /const zapisanyWpis = editingPlayerId \? \(edytowanyZawodnik \|\| null\) : data;/.test(blok));
  sprawdz("nowy zawodnik też pojedynczo (ten sam wiersz)",
    /await savePlayersSome\(\[zapisanyWpis\]\)/.test(blok));
  sprawdz("gdy nie wiadomo, co się zmieniło — pełny zapis jako zapas",
    /: await savePlayers\(\);/.test(blok));
  sprawdz("nieudany zapis mówi o tym wprost, zamiast udawać sukces",
    /if\(okZapis === false\)\{[\s\S]{0,200}Nie udało się zapisać zawodnika/.test(zrodlo));
}

console.log("\n2. Pozostałe czynności na jednej karcie");
sprawdz('przełącznik „ma menedżera" na liście', /p\.agentSource = 'ręcznie';\n  \/\/[^\n]*\n  await savePlayersSome\(\[p\]\);/.test(zrodlo));
sprawdz("zespoły zawodnika i opis końcowy",
  (zrodlo.match(/const ok = await savePlayersSome\(\[pl\]\);/g) || []).length === 2,
  String((zrodlo.match(/const ok = await savePlayersSome\(\[pl\]\);/g) || []).length));

console.log("\n3. Zapis pojedynczy musi zapisywać TO SAMO co pełny");
sprawdz("ta sama droga pakowania pól ukrytych w jsonb (packExt)",
  /async function upsertWsadami[\s\S]{0,200}items\.map\(\(it\) => packExt\(table, it\)\)/.test(magazyn));
sprawdz("ta sama zamiana nazw pól na kolumny (rowFromObj)",
  /async function upsertWsadami[\s\S]{0,260}prepared\.map\(rowFromObj\)/.test(magazyn));
sprawdz("saveSome działa tylko na kolekcjach z tabelą — inaczej zgłasza błąd",
  /saveSome obsługuje tylko kolekcje tabelowe/.test(magazyn));
sprawdz("pusta lista nie wywołuje zapytania", /if \(!items \|\| !items\.length\) return true;/.test(magazyn));

console.log("\n4. Pełny zapis zostaje tam, gdzie zmienia się wiele kart");
{
  const peine = (zrodlo.match(/await savePlayers\(\)/g) || []).length;
  sprawdz(`pełny zapis nadal używany w importach i scalaniu (${peine} miejsc)`, peine >= 20, String(peine));
  // Zbiorcze uzupełnianie menedżerów też przestało wysyłać całą kartotekę co 20 nazwisk — zapisuje
  // wyłącznie zawodników, których ten przebieg dotknął.
  sprawdz("zbiorcze uzupełnianie menedżerów zapisuje tylko dotkniętych",
    /const okZaw = dotknieci\.length \? await savePlayersSome\(dotknieci\) : true;/.test(zrodlo));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
