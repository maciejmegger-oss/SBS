// Sprawdza zdjęcie zawodnika w nagłówku raportu PDF.
//
// Zgłoszenie (01.10.2026): „w raporcie, jak jest zdjęcie, to można umieścić zdjęcie zawodnika".
// Liczy się jedno: zdjęcie pojawia się tylko wtedy, gdy zawodnik je ma. Pusta ramka w raporcie
// wygląda jak brak danych, a nie jak brak zdjęcia — a raport idzie do klubu.
//
// Uruchomienie:  node scripts/test-zdjecie-w-raporcie.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Zdjęcie w pasku tytułu raportu");
sprawdz("wstawiane tylko, gdy zawodnik ma zdjęcie",
  /\$\{p\.photoUrl \? `<img class="player-photo-pdf" src="\$\{esc\(p\.photoUrl\)\}"/.test(zrodlo));
sprawdz("bez zdjęcia nie zostaje pusta ramka",
  /\$\{p\.photoUrl \? `<img[^`]*` : ''\}/.test(zrodlo));
sprawdz("stoi w pasku tytułu, obok nazwiska i pozycji",
  /<div class="title-bar">[\s\S]{0,1400}player-photo-pdf[\s\S]{0,80}<\/div>/.test(zrodlo));
sprawdz("prosi o zgodę serwera na pobranie (zdjęcia spoza systemu)", /crossorigin="anonymous"/.test(zrodlo));

console.log("\n2. Wygląd — pasek nie skacze między raportami");
sprawdz("stały rozmiar niezależnie od proporcji pliku",
  /\.player-photo-pdf\{width:74px;height:74px;object-fit:cover/.test(zrodlo));
sprawdz("kadr od góry — twarz, nie środek sylwetki", /object-position:top center/.test(zrodlo));
sprawdz("ramka w złocie raportu, nie przypadkowy kolor", /\.player-photo-pdf\{[^}]*border:2px solid var\(--gold\)/.test(zrodlo));
sprawdz("tekst tytułu zwęża się, zamiast wypychać zdjęcie", /\.title-text\{flex:1;min-width:0;\}/.test(zrodlo));

console.log("\n3. Dlaczego tak, a nie inaczej — opisane w kodzie");
sprawdz("napisane, skąd się biorą zdjęcia i co, gdy serwer odmówi",
  /zdjęcie zaciągnięte\s*\n?\s*z adresu zewnętrznego zależy od zgody tamtego serwera/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
