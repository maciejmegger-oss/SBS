// NIEISTNIEJĄCE NAZWY W KODZIE — BRAMKA PRZED CICHĄ AWARIĄ.
//
// Zgłoszenie (09.11.2026): „nie pobiera”. Przycisk pobierania listy talentów nie robił nic.
// Powód: funkcja eksportu wołała klubTalentu(), a ta była zadeklarowana WEWNĄTRZ viewTalent.
// Przy kliknięciu leciał ReferenceError do konsoli i na tym się kończyło — żadnego komunikatu,
// żadnego pliku.
//
// Dlaczego nie złapał tego build: `npm run build` to vite/esbuild, który NIE sprawdza typów.
// Odwołanie do nieistniejącej nazwy przechodzi przez niego bez słowa. Łapie je dopiero `tsc`,
// jako błąd TS2304 „Cannot find name”.
//
// Pełny typecheck daje w tym pliku ponad tysiąc błędów (kod jest w praktyce nietypowanym JS-em
// w plikach .ts), więc nie da się go postawić jako bramki w całości. Ale JEDNA jego kategoria
// jest tu rozstrzygająca i jej pilnujemy: lista nazw, których nigdzie nie ma. Cztery poniżej
// są zastane — każda nowa oznacza funkcję, która wywali się przy kliknięciu.
//
// Uruchomienie:  node scripts/test-nieznane-nazwy.mjs
import { execFileSync } from "node:child_process";

// Zastane braki (stan 09.11.2026). To są prawdziwe usterki w kodzie, tyle że nie moje i nie
// z tego zadania — siedzą w obsłudze obserwacji i wczytywania od dostawcy. Warto je kiedyś
// wyprostować; do tego czasu stoją tu, żeby bramka mogła w ogóle działać.
const ZASTANE = ["obs", "wczytajOdDostawcy", "para", "komunikat"];

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Odwołania do nieistniejących nazw");
let wyjscie = "";
try {
  execFileSync("npx", ["tsc", "--noEmit"], { encoding: "utf8", stdio: "pipe", shell: true });
} catch (e) {
  wyjscie = String((e.stdout || "") + (e.stderr || ""));
}

const nazwy = [...wyjscie.matchAll(/Cannot find name '([^']+)'/g)].map((m) => m[1]);
const rozne = [...new Set(nazwy)].sort();
const nowe = rozne.filter((n) => !ZASTANE.includes(n));
const znikniete = ZASTANE.filter((n) => !rozne.includes(n));

sprawdz("nie pojawiła się żadna nowa nieistniejąca nazwa", nowe.length === 0,
  nowe.length ? `NOWE: ${nowe.join(", ")} — ta funkcja wywali się przy użyciu` : "");
console.log(`       zastanych braków: ${rozne.filter((n) => ZASTANE.includes(n)).length}`
  + ` z ${ZASTANE.length} (${rozne.join(", ") || "brak"}), wystąpień łącznie: ${nazwy.length}`);
if (znikniete.length) {
  console.log(`       naprawione od ostatniego razu: ${znikniete.join(", ")}`
    + " — skreśl je z listy ZASTANE w tym pliku.");
}

console.log("\n2. Przypadek, od którego ta bramka powstała");
sprawdz("klubTalentu jest widoczny poza widokiem Talent", !rozne.includes("klubTalentu"),
  "znów stoi wewnątrz viewTalent — pobieranie listy przestanie działać");

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
