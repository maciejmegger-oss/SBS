// POMIAR: ile trwa policzenie tego, co zakładka „Zawodnicy" liczy dla każdego wiersza.
//
// Zgłoszenie (01.10.2026): „bardzo długo ładuje wszystkie strony po kliknięciu w zakładkę".
// Lista zawodników dla KAŻDEGO wiersza pytała o średnią ocen, a ta przeszukiwała całą tabelę
// obserwacji i całą tabelę raportów. Ten skrypt pokazuje różnicę na bazie wielkości produkcyjnej:
// liczy to samo dwiema drogami — przez przeszukiwanie (jak było) i przez indeks (jak jest).
//
// Uruchomienie:  node scripts/pomiar-szybkosci-list.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts.`); process.exit(1); }
  return m[0];
};

// Baza w skali, w jakiej system działa u klienta.
const KLUBOW = 600, ZAWODNIKOW = 5000, OBSERWACJI = 10000, RAPORTOW = 5000;
const DB = { clubs: [], players: [], observations: [], reports: [] };
for (let i = 0; i < KLUBOW; i++) DB.clubs.push({ id: "K" + i, name: "Klub " + i, league: "III liga", season: "" });
for (let i = 0; i < ZAWODNIKOW; i++) DB.players.push({ id: "Z" + i, clubId: "K" + (i % KLUBOW), birthYear: 2006 + (i % 5) });
for (let i = 0; i < OBSERWACJI; i++) DB.observations.push({ id: "O" + i, playerId: "Z" + (i % ZAWODNIKOW), date: "2026-0" + (1 + (i % 9)) + "-01" });
for (let i = 0; i < RAPORTOW; i++) DB.reports.push({ id: "R" + i, playerId: "Z" + (i % ZAWODNIKOW), date: "2026-05-01" });

const kod = [
  wytnij("indeksWgZawodnika", /function indeksWgZawodnika\(lista, pole\)\{[\s\S]*?\n\}/),
  wytnij("playerObs", /function playerObs\(playerId\)\{[\s\S]*?\n\}/),
  wytnij("raportyGracza", /function raportyGracza\(playerId\)\{[\s\S]*?\n\}/),
].join("\n");
const api = new Function("DB", `${kod}\n return { playerObs, raportyGracza };`)(DB);

const zegar = (opis, ile, f) => {
  const start = process.hrtime.bigint();
  f();
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(`${opis.padEnd(46)} ${ms.toFixed(0).padStart(6)} ms   (${ile} wierszy)`);
  return ms;
};

console.log(`\nBaza: ${KLUBOW} klubów, ${ZAWODNIKOW} zawodników, ${OBSERWACJI} obserwacji, ${RAPORTOW} raportów.\n`);

// JAK BYŁO: każdy wiersz przeszukuje obie tabele od początku.
const przed = zegar("przeszukiwanie przy każdym wierszu (jak było)", ZAWODNIKOW, () => {
  let suma = 0;
  for (const p of DB.players) {
    const obs = DB.observations.filter((o) => o.playerId === p.id).sort((a, b) => a.date.localeCompare(b.date));
    const reps = DB.reports.filter((r) => r.playerId === p.id);
    suma += obs.length + reps.length;
  }
  return suma;
});

// JAK JEST: indeks budowany raz, potem odczyt po kluczu.
api.playerObs.indeks = null; api.raportyGracza.indeks = null;
const po = zegar("odczyt z indeksu (jak jest)", ZAWODNIKOW, () => {
  let suma = 0;
  for (const p of DB.players) suma += api.playerObs(p.id).length + api.raportyGracza(p.id).length;
  return suma;
});

// Wynik musi być TEN SAM — szybciej nie znaczy inaczej.
api.playerObs.indeks = null; api.raportyGracza.indeks = null;
const kontrola = DB.players.every((p) => {
  const stareObs = DB.observations.filter((o) => o.playerId === p.id).length;
  const stareRap = DB.reports.filter((r) => r.playerId === p.id).length;
  return api.playerObs(p.id).length === stareObs && api.raportyGracza(p.id).length === stareRap;
});

console.log(`\n${kontrola ? "Wyniki identyczne" : "UWAGA: WYNIKI SIĘ RÓŻNIĄ"} — ${(przed / Math.max(po, 0.001)).toFixed(0)}× szybciej.\n`);
process.exit(kontrola ? 0 : 1);
