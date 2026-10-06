// Test logiki dziennego raportu SBS AI (api/_raport-dzienny.js). Bez bazy i sieci:
//   node scripts/test-raport-dzienny.mjs
import assert from "node:assert/strict";
import { zbudujRaport, zlozWiadomosc } from "../api/_raport-dzienny.js";

const dzis = new Date("2026-10-06T06:00:00Z");
const profil = { kryteria: [{ nazwa: "Środkowy obrońca", pozycje: ["Obrońca środkowy"],
  rocznikOd: 2007, rocznikDo: 2009, wzrostMin: 183, noga: "lewa", minutyMin: 600, ocenaMin: 4 }] };
const ocena = (n, pot) => ({ stats_filled_in: true, date: "2026-09-20", recommendation: "",
  ratings: { technika: n, taktyka: n, motoryka: n, mentalnosc: n, potencjal: pot ?? n } });
const gracz = (id, o) => ({ id, first_name: id, last_name: "T", status: "Do Obserwacji", date_added: "2026-10-06", ...o });

const zawodnicy = [
  // spełnia profil, wysoki potencjał, umowa się kończy
  gracz("A", { birth_year: "2008", position: "Obrońca środkowy prawy", foot: "lewa", height: 187, minutes: 900,
    custom_fields: { __ext: { contractUntil: "2027-03-01" } } }),
  // pozycja się nie zgadza
  gracz("B", { birth_year: "2008", position: "Napastnik", foot: "lewa", height: 187, minutes: 900 }),
  // prawie same braki
  gracz("C", { birth_year: "2008" }),
  // pasuje, ale nikt go nie oglądał
  gracz("D", { birth_year: "2008", position: "Obrońca środkowy", foot: "lewa", height: 185, minutes: 700 }),
  // stary, odrzucony — nie liczy się
  gracz("E", { status: "Odrzucony" }),
];
const obs = new Map([
  ["A", [ocena(5, 6), ocena(5, 6)]],
  ["B", [ocena(4)]],
]);

const r = zbudujRaport({ zawodnicy, obserwacjePoZawodniku: obs, profil, stan: null, dzis });
const wg = Object.fromEntries(r.nowi.map((x) => [x.id, x]));

assert.equal(r.nowi.length, 4, "odrzucony nie jest liczony");
assert.ok(wg.A.spelniaProfil, "A spełnia profil");
assert.ok(wg.A.potencjalTransferowy, "A: potencjał + umowa do 2027");
assert.ok(!wg.B.spelniaProfil && wg.B.niezgodne.includes("pozycja"), "B: zła pozycja");
assert.ok(wg.C.brakDanych && wg.C.braki.length >= 3, "C: brak danych");
assert.ok(!wg.C.spelniaProfil, "brak danych nigdy nie spełnia profilu");
assert.ok(wg.D.wymagaObserwacji && !wg.D.spelniaProfil, "D: nieobserwowany → obserwacja, ale bez oceny nie ma 'spełnia'");
assert.equal(r.ranking[0].id, "A", "A na szczycie rankingu");
assert.ok(!r.ranking.some((x) => x.id === "C"), "ranking pomija brak danych");

const msg = r.wiadomosc;
assert.match(msg, /^SBS AI – raport dzienny\n\n4 nowych zawodników/);
assert.match(msg, /1 spełnia profil/);
assert.match(msg, /1 zawodnik – brak wystarczających danych/);

// Stan: kolejny przebieg widzi tylko tych, których nie znał.
const r2 = zbudujRaport({ zawodnicy: [...zawodnicy, gracz("F", { date_added: "2026-10-07" })],
  obserwacjePoZawodniku: obs, profil, stan: { znane: ["A", "B", "C", "D", "E"] }, dzis });
assert.deepEqual(r2.nowi.map((x) => x.id), ["F"]);

// Pierwszy przebieg bez stanu nie zalewa raportu całą bazą.
const stare = [gracz("X", { date_added: "2025-01-01" }), gracz("Y", { date_added: "2026-10-06" })];
assert.deepEqual(zbudujRaport({ zawodnicy: stare, obserwacjePoZawodniku: new Map(), profil, stan: null, dzis }).nowi.map((x) => x.id), ["Y"]);

// Bez profilu: nikt nie spełnia, raport ostrzega.
const bp = zbudujRaport({ zawodnicy, obserwacjePoZawodniku: obs, profil: null, stan: null, dzis });
assert.ok(bp.nowi.every((x) => !x.spelniaProfil));
assert.match(bp.wiadomosc, /Brak profilu/);

assert.match(zlozWiadomosc({ nowi: [], ranking: [], zBazyDoObserwacji: 0 }), /0 nowych zawodników/);
console.log("OK — raport dzienny: wszystkie sprawdzenia przeszły");
console.log("\n" + msg);
assert.ok(wg.B.wynik < 70, "niezgodny z profilem nie przekracza progu");
