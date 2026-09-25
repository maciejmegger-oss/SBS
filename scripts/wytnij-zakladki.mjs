// JEDNORAZOWE WYJĘCIE ZAKŁADEK Z src/main.ts DO public/zakladki/.
//
// Po co: zakładka wciągnięta na pasek przeglądarki zostaje tam na zawsze w takiej postaci, w jakiej
// została przeciągnięta. Zakładka do ŁNP od dawna pobiera swój kod z serwera przy każdym kliknięciu
// i dlatego poprawki do niej docierają same; pozostałe siedziały w pasku w wersji sprzed miesięcy.
// Żeby mogły robić to samo, ich kod musi leżeć jako PLIK na serwerze — i to ten sam plik, który
// wchodzi do zakładki jako kopia awaryjna. Ten skrypt przenosi je raz; potem źródłem są już pliki.
//
// Uruchomienie:  node scripts/wytnij-zakladki.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const ZDARZENIA = (zrodlo.match(/const LNP_ZDARZENIA = `([\s\S]*?)`;/) || [])[1];
if (ZDARZENIA === undefined) { console.error("Nie znalazłem LNP_ZDARZENIA."); process.exit(1); }

const PLIKI = {
  LNP_BOOKMARKLET: "lnp-protokol.js",
  TM_PROFIL_BOOKMARKLET: "tm-profil.js",
  TM_BOOKMARKLET: "tm-kluby.js",
  TM_AGENT_BOOKMARKLET: "tm-agent.js",
  TM_AGENCIES_BOOKMARKLET: "tm-agencje.js",
  TM_AGENCY_STAFF_BOOKMARKLET: "tm-agencja-ludzie.js",
  TM_AGENCY_SQUAD_BOOKMARKLET: "tm-agencja-zawodnicy.js",
};

fs.mkdirSync("public/zakladki", { recursive: true });
for (const [nazwa, plik] of Object.entries(PLIKI)) {
  const m = zrodlo.match(new RegExp(`const ${nazwa} = \`([\\s\\S]*?)\`;\\r?\\n`));
  if (!m) { console.error(`Nie znalazłem ${nazwa}.`); process.exit(1); }
  // Szablon zamieniamy na gotowy tekst dokładnie tak, jak robi to przeglądarka przy budowaniu
  // adresu zakładki — z jedynym podstawieniem, jakie w tych zakładkach występuje.
  const kod = new Function("LNP_ZDARZENIA", "return `" + m[1] + "`;")(ZDARZENIA)
    .replace(/^javascript:/, "");
  try { new Function(kod); } catch (e) { console.error(`${plik}: kod się nie kompiluje — ${e.message}`); process.exit(1); }
  fs.writeFileSync(`public/zakladki/${plik}`, kod + "\n", "utf8");
  console.log(`  ${plik.padEnd(26)} ${kod.length} znaków`);
}
console.log("Gotowe.");
