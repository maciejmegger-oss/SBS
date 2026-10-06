// Test logiki zakładki SBS AI (src/data/sbs-ai.ts): node scripts/test-sbs-ai.mjs
import assert from "node:assert/strict";
import { czyPropozycja, mapujPropozycje, notatkaPoDecyzji, podsumowanieRaportu, zadaniaOtwarte, ustawStatusZadania,
  pokazCzas, raportNieswiezy, ZNACZNIK_PROPOZYCJI } from "../src/data/sbs-ai.ts";

const prop = { id: "o1", player_id: "A", date: "2026-10-05", match: "X - Y", scout: "SBS AI", stats_filled_in: false,
  ratings: { technika: 5, potencjal: 6 }, notes: `${ZNACZNIK_PROPOZYCJI} Statystyki z 12 meczów` };
assert.ok(czyPropozycja(prop));
assert.ok(!czyPropozycja({ ...prop, stats_filled_in: true }), "potwierdzona nie jest już propozycją");
assert.ok(!czyPropozycja({ ...prop, scout: "Jan Skaut" }), "obserwacja skauta nie jest propozycją");
assert.ok(!czyPropozycja({ ...prop, notes: "[SBS AI – propozycja ODRZUCONA przez X, 2026-10-06] a" }), "odrzucona znika");

const [m] = mapujPropozycje([prop, { ...prop, id: "o2", scout: "ktoś" }]);
assert.equal(m.id, "o1"); assert.equal(m.srednia, 5.5); assert.equal(m.uzasadnienie, "Statystyki z 12 meczów");
assert.deepEqual(m.oceny, { technika: 5, potencjal: 6 });

const po = notatkaPoDecyzji(prop.notes, "potwierdzona", "Maciej", "2026-10-06");
assert.equal(po, "[SBS AI – ocena potwierdzona przez Maciej, 2026-10-06] Statystyki z 12 meczów");
assert.ok(!czyPropozycja({ ...prop, notes: po }) && !czyPropozycja({ ...prop, notes: notatkaPoDecyzji(prop.notes, "odrzucona", "", "2026-10-06") }));
assert.match(notatkaPoDecyzji("zwykła notatka", "odrzucona", "M", "d"), /ODRZUCONA przez M, d\] zwykła notatka/);

const rap = { nowi: [{ spelniaProfil: true }, { wymagaObserwacji: true }, { wymagaObserwacji: true, potencjalTransferowy: true }, { brakDanych: true }], zBazyDoObserwacji: 4 };
assert.deepEqual(podsumowanieRaportu(rap), { nowi: 4, spelnia: 1, doObserwacji: 2, potencjal: 1, brakDanych: 1, zBazy: 4 });
assert.equal(podsumowanieRaportu(null).nowi, 0, "brak raportu nie wywraca karty");

const zad = [
  { id: "1", opis: "a", status: "otwarte", priorytet: "normalny", termin: "2026-10-12" },
  { id: "2", opis: "b", status: "otwarte", priorytet: "wysoki", termin: "2026-10-20" },
  { id: "3", opis: "c", status: "zrobione" },
  { id: "4", opis: "d", status: "w_toku", priorytet: "normalny", termin: "2026-10-08" },
];
assert.deepEqual(zadaniaOtwarte(zad).map((z) => z.id), ["2", "4", "1"], "priorytet, potem termin; zrobione pominięte");
assert.equal(ustawStatusZadania(zad, "1", "zrobione", "t").find((z) => z.id === "1").status, "zrobione");
assert.equal(ustawStatusZadania(zad, "1", "dziwny", "t"), null);
assert.equal(ustawStatusZadania(zad, "99", "zrobione", "t"), null);
assert.equal(zad[0].status, "otwarte", "oryginał nietknięty");

assert.equal(pokazCzas("nie-data"), "—");
assert.match(pokazCzas("2026-10-06T06:00:00Z"), /^\d{2}\.\d{2}\.2026 \d{2}:\d{2}$/);
assert.ok(raportNieswiezy({ data: "2026-10-01" }, new Date("2026-10-06")));
assert.ok(!raportNieswiezy({ data: "2026-10-06" }, new Date("2026-10-06T20:00:00Z")));
console.log("OK — SBS AI (logika zakładki): wszystkie sprawdzenia przeszły");
