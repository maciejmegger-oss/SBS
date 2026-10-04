// Sprawdza, że „dziś" liczy się według zegara użytkownika, a nie według czasu uniwersalnego.
//
// Zgłoszenie (05.10.2026, 01:12 w nocy): „jest dziś 05, a kalendarz pokazuje 4". Cała aplikacja
// brała datę z new Date().toISOString(), czyli z UTC — w Polsce o dwie godziny wcześniejszego
// latem i godzinę zimą. Między północą a 02:00 system podawał więc datę WCZORAJSZĄ: podświetlony
// dzień w kalendarzu, domyślna data meczu w planie, data obserwacji, data raportu, data
// sprawdzenia menedżera. Skaut planuje wieczorami i po meczach, czyli dokładnie w tych godzinach.
//
// Uruchomienie:  node scripts/test-dzisiejsza-data.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8").replace(/\r\n/g, "\n");
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

const dzisiaj = new Function(`${wytnij("dzisiaj", /function dzisiaj\(\)\{[\s\S]*?\n\}/)}\n return dzisiaj;`)();

console.log("\n1. Data z zegara użytkownika");
{
  const teraz = new Date();
  const oczekiwana = `${teraz.getFullYear()}-${String(teraz.getMonth() + 1).padStart(2, "0")}-${String(teraz.getDate()).padStart(2, "0")}`;
  sprawdz(`dziś to ${oczekiwana}`, dzisiaj() === oczekiwana, dzisiaj());
  sprawdz("kształt RRRR-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(dzisiaj()), dzisiaj());
  sprawdz("dzień i miesiąc zawsze dwucyfrowe", dzisiaj().length === 10);
}

console.log("\n2. Noc — moment, w którym to się psuło");
{
  // Udajemy 5 października 2026, 01:12 czasu polskiego. W UTC to jeszcze 4 października, 23:12 —
  // i to właśnie wtedy stary sposób pokazywał wczorajszą datę.
  const PrawdziwyDate = Date;
  const udawana = new PrawdziwyDate("2026-10-04T23:12:00Z");
  // getFullYear/getMonth/getDate czytamy w strefie +02:00, żeby test nie zależał od strefy maszyny.
  const wStrefiePL = {
    getFullYear: () => 2026, getMonth: () => 9, getDate: () => 5,
  };
  const dzisiajPL = new Function("Date", `${wytnij("dzisiaj", /function dzisiaj\(\)\{[\s\S]*?\n\}/)}\n return dzisiaj;`)(
    function(){ return wStrefiePL; });
  sprawdz("o 01:12 w nocy dostajemy 5 października, nie 4", dzisiajPL() === "2026-10-05", dzisiajPL());
  sprawdz("stary sposób dawał wtedy 4 (dowód, że to był prawdziwy błąd)",
    udawana.toISOString().slice(0, 10) === "2026-10-04");
}

console.log("\n3. Nigdzie nie został stary sposób");
sprawdz("żadnego new Date().toISOString().slice(0,10) w aplikacji",
  !/new Date\(\)\.toISOString\(\)\.slice\(0,10\)/.test(zrodlo));
sprawdz(`zamiast tego wszędzie dzisiaj() (${(zrodlo.match(/dzisiaj\(\)/g) || []).length} miejsc)`,
  (zrodlo.match(/dzisiaj\(\)/g) || []).length >= 40, String((zrodlo.match(/dzisiaj\(\)/g) || []).length));
sprawdz('daty liczone z KONKRETNEJ daty (nie z „teraz") zostają nietknięte — to inny przypadek',
  /new Date\(Date\.now\(\) \+ SCHEDULE_WINDOW_DAYS/.test(zrodlo));

console.log("\n4. Kolejność raportów — od najnowiej zapisanego");
// Zgłoszenie (05.10.2026): „raporty wyświetlaj w kolejności utworzenia".
sprawdz("lista sortuje się po kolejności wpisania, nie po dacie meczu",
  /const allReports = widoczneRaporty\.slice\(\)\.sort\(\(a,b\)=> ordinalOf\[b\.id\] - ordinalOf\[a\.id\]\);/.test(zrodlo));
sprawdz("numer porządkowy nadal liczony wśród pokazanych",
  /widoczneRaporty\.forEach\(\(r,i\)=> ordinalOf\[r\.id\] = i\+1\);/.test(zrodlo));
sprawdz("podpis nad listą mówi to samo, co lista robi", /Wg kolejności utworzenia/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
