// Pasek „jest nowsza wersja" w systemie na komputerze.
//
// Zgłoszenie (13.10.2026): użytkownik testował świeżo wdrożoną poprawkę w karcie otwartej
// poprzedniego wieczora i zgłosił „nie działa". Serwer miał wersję 18:42, jego karta — 23:07
// z dnia poprzedniego. System jest jednostronicowy: klikanie po zakładkach nie pobiera nowego
// kodu. Panel mobilny miał taki pasek od dawna, wersja na komputerze nie miała.
//
// Uruchomienie:  node scripts/test-pasek-wersji.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const html = fs.readFileSync("app.html", "utf8");
const css = fs.readFileSync("src/style.css", "utf8");
const vite = fs.readFileSync("vite.config.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Skąd system wie, co stoi na serwerze");
sprawdz("plik wersja.json powstaje przy budowaniu", /fileName: "wersja\.json"/.test(vite));
sprawdz("karta zna swoją wersję", /const WERSJA_TEJ_KARTY = typeof __WERSJA__/.test(zrodlo));
sprawdz("pytanie idzie z obejściem pamięci podręcznej",
  /fetch\('\/wersja\.json\?t=' \+ Date\.now\(\), \{ cache: 'no-store' \}\)/.test(zrodlo));
sprawdz("mechanizm offline nie podaje tego pliku z kopii",
  /url\.pathname === "\/wersja\.json"\) return;/.test(fs.readFileSync("public/sw.js", "utf8")));

console.log("\n2. Kiedy pyta");
sprawdz("przy starcie", /void sprawdzWersjeSystemu\(\);/.test(zrodlo));
sprawdz("cyklicznie co pół godziny", /setInterval\(\(\)=>void sprawdzWersjeSystemu\(\), 30 \* 60 \* 1000\)/.test(zrodlo));
sprawdz("i przy każdym powrocie do karty — to jest ten przypadek ze zgłoszenia",
  /visibilitychange[\s\S]{0,140}visibilityState === 'visible'[\s\S]{0,40}sprawdzWersjeSystemu/.test(zrodlo));
sprawdz("pilnowanie faktycznie wystartowane", /^uruchomPilnowanieWersji\(\);$/m.test(zrodlo));

console.log("\n3. Co pokazuje");
sprawdz("miejsce na pasek jest w app.html", /<div id="nowa-wersja-banner"><\/div>/.test(html));
sprawdz("pasek pokazuje obie wersje — serwera i tej karty",
  /Jest nowsza wersja systemu/.test(zrodlo) && /Ta karta pracuje na wersji/.test(zrodlo));
sprawdz("jest przycisk odświeżenia", /data-action="odswiez-wersje"/.test(zrodlo));
sprawdz("odświeżenie przeładowuje stronę", /odswiez\.onclick = \(\)=>window\.location\.reload\(\)/.test(zrodlo));
sprawdz("da się odłożyć na później", /data-action="odloz-wersje"/.test(zrodlo));
sprawdz("odłożenie dotyczy TEJ wersji, nie wycisza paska na zawsze",
  /odrzuconaWersja = wersjaNaSerwerze/.test(zrodlo)
  && /odrzuconaWersja === wersjaNaSerwerze\)\{ miejsce\.innerHTML = ''; return; \}/.test(zrodlo));

console.log("\n4. Czego NIE robi");
sprawdz("nie przeładowuje strony sam z siebie — skaut może mieć otwarty raport",
  /NIE PRZEŁADOWUJEMY SAMI/.test(zrodlo));
sprawdz("przy braku sieci milczy", /if\(!navigator\.onLine \|\| !WERSJA_TEJ_KARTY\) return;/.test(zrodlo));
sprawdz("awaria zapytania nie wywraca aplikacji", /\}catch\(e\)\{ \/\* brak sieci/.test(zrodlo));

console.log("\n5. Kontrast w obu motywach");
const lum = (h) => {
  const c = h.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const kontrast = (a, b) => { const x = lum(a), y = lum(b); const [j, n] = x > y ? [x, y] : [y, x];
  return (j + 0.05) / (n + 0.05); };
// Wartości z :root (jasny) i :root[data-theme="dark"] w src/style.css.
for (const [opis, fg, bg] of [
  ["jasny — tekst paska", "#F6F3EA", "#16302A"],
  ["jasny — numer wersji", "#C69B3C", "#16302A"],
  ["jasny — przycisk", "#16302A", "#C69B3C"],
  ["ciemny — tekst paska", "#F6F3EA", "#0C1512"],
  ["ciemny — numer wersji", "#D9B45E", "#0C1512"],
  ["ciemny — przycisk", "#0C1512", "#D9B45E"],
]) sprawdz(`${opis}: ${kontrast(fg, bg).toFixed(1)}:1`, kontrast(fg, bg) >= 4.5);

sprawdz("tekst paska bierze --on-pitch, nie --chalk (w ciemnym motywie --chalk to TŁO strony)",
  /\.nowa-wersja-bar\{background:var\(--pitch\);color:var\(--on-pitch\)/.test(css));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
