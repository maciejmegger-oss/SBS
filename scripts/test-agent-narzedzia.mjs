// Test narzędzi asystenta AI (api/_agent-narzedzia.js) na atrapie bazy, bez sieci:
//   node scripts/test-agent-narzedzia.mjs
import assert from "node:assert/strict";
import { NARZEDZIA, definicje, wykonaj, KLUCZ_DZIENNIKA, KLUCZ_ZADAN, STATUSY } from "../api/_agent-narzedzia.js";

const NAZWY = ["pobierz_zawodnika", "pobierz_liste_zawodnikow", "dodaj_zawodnika", "zaktualizuj_ocene", "porownaj_zawodnikow",
  "wyszukaj_zawodnika", "utworz_raport", "pobierz_dane_meczu", "ustaw_zadanie_scoutingowe", "zmien_status_zawodnika"];
assert.deepEqual(NARZEDZIA.map((n) => n.name).sort(), NAZWY.slice().sort(), "dokładnie te dziesięć narzędzi");
for (const d of definicje()) {
  assert.ok(d.description.length > 30 && d.input_schema.type === "object", `${d.name}: pełna definicja`);
  assert.ok(!("wykonaj" in d) && !("zapis" in d), "definicja nie wycieka pól wewnętrznych");
}

const dzis = new Date("2026-10-06T10:00:00Z");
const gracz = (id, o = {}) => ({ id, first_name: id, last_name: "Test", status: "Do Obserwacji", birth_year: "2008", position: "Obrońca środkowy",
  foot: "Lewa", height: 187, minutes: 900, notes: null, custom_fields: {}, ...o });

const baza = { sbs_players: [gracz("A"), gracz("B", { first_name: "Jan", last_name: "Kowalski" })], sbs_observations: [], sbs_reports: [], sbs_raport_inbox: [] };
const kv = { "scouting:matches": [{ id: "m1", date: "2026-10-04", homeTeam: "Lechia Gdańsk", awayTeam: "Arka Gdynia" }] };
const zapytania = [];
const db = {
  async wybierz(t, q) {
    zapytania.push([t, q]);
    if (t === "sbs_players") {
      const id = (q.match(/[?&]id=eq\.([^&]+)/) || [])[1];
      if (id) return baza.sbs_players.filter((p) => p.id === decodeURIComponent(id));
      const lista = (q.match(/id=in\.\(([^)]*)\)/) || [])[1];
      if (lista) return baza.sbs_players.filter((p) => lista.split(",").map(decodeURIComponent).includes(p.id));
      const im = (q.match(/first_name=ilike\.([^&]+)/) || [])[1];
      if (im) return baza.sbs_players.filter((p) => p.first_name.toLowerCase() === decodeURIComponent(im).toLowerCase());
      return baza.sbs_players;
    }
    return baza[t] || [];
  },
  async wstaw(t, w) { baza[t].push(w); return [w]; },
  async zmien(t, f, z) { const id = decodeURIComponent(f.split("eq.")[1]); Object.assign(baza[t].find((p) => p.id === id), z); return []; },
  async kvGet(k) { return kv[k] ? JSON.parse(JSON.stringify(kv[k])) : null; },
  async kvSet(k, v) { kv[k] = v; },
};
const ctx = { db, dzis };
const wyw = (n, a, o) => wykonaj(n, a, ctx, o);

// walidacja
assert.equal((await wyw("nie_ma", {})).powod, "nieznane_narzedzie");
assert.equal((await wyw("pobierz_zawodnika", {})).powod, "bledne_argumenty");
assert.equal((await wyw("zaktualizuj_ocene", { zawodnik_id: "A", technika: 9, uzasadnienie: "x" })).powod, "bledne_argumenty", "ocena poza skalą 1–6");

// odczyt
const z = await wyw("pobierz_zawodnika", { id: "A" });
assert.ok(z.ok && z.zawodnik.nazwa === "A Test" && z.analiza.braki.includes("oceny z obserwacji"));
assert.equal((await wyw("pobierz_zawodnika", { id: "ZZZ" })).powod, "nie_znaleziono");

// wyszukiwanie: składnia PostgREST, bez wstrzykiwania znaków sterujących
await wyw("wyszukaj_zawodnika", { fraza: "kowalski, jan*)" });
const q = zapytania.at(-1)[1];
assert.match(q, /and=\(or\(first_name\.ilike\.\*kowalski\*,last_name\.ilike\.\*kowalski\*\),or\(first_name\.ilike\.\*jan\*/);
assert.ok(!/[*]\)/.test(q.replace(/\.\*[^*]*\*/g, "")), "znaki sterujące wycięte");
assert.equal((await wyw("wyszukaj_zawodnika", { fraza: "a" })).powod, "za_krotka_fraza");

// lista
assert.ok((await wyw("pobierz_liste_zawodnikow", { limit: 100, status: "Do Obserwacji" })).ok);
assert.equal((await wyw("pobierz_liste_zawodnikow", { limit: 500 })).powod, "bledne_argumenty", "limit ponad 100 odrzucony");

// dodawanie: duplikat blokuje, na_pewno przepuszcza
const dup = await wyw("dodaj_zawodnika", { imie: "Jan", nazwisko: "Kowalski", rocznik: 2008 });
assert.equal(dup.powod, "mozliwy_duplikat");
assert.equal(baza.sbs_players.length, 2, "nic nie zapisano");
const nowy = await wyw("dodaj_zawodnika", { imie: "Adam", nazwisko: "Nowy", rocznik: 2009, uwagi: "z meczu" });
assert.ok(nowy.ok);
const zapNowy = baza.sbs_players.at(-1);
assert.equal(zapNowy.status, "Do Obserwacji"); assert.equal(zapNowy.source, "SBS AI"); assert.equal(zapNowy.date_added, "2026-10-06");
assert.ok((await wyw("dodaj_zawodnika", { imie: "Jan", nazwisko: "Kowalski", na_pewno: true })).ok);

// ocena = propozycja, nie wchodzi do średnich
assert.equal((await wyw("zaktualizuj_ocene", { zawodnik_id: "A", technika: 5 })).powod, "bledne_argumenty", "uzasadnienie wymagane");
const oc = await wyw("zaktualizuj_ocene", { zawodnik_id: "A", technika: 5, potencjal: 6, uzasadnienie: "Statystyki z 12 meczów" });
assert.ok(oc.ok);
const obs = baza.sbs_observations.at(-1);
assert.equal(obs.stats_filled_in, false, "propozycja nie jest liczona do średnich");
assert.equal(obs.scout, "SBS AI");
assert.equal((await wyw("pobierz_zawodnika", { id: "A" })).analiza.ocenaSrednia, null, "ocena agenta nie wpływa na analizę");

// raport idzie do skrzynki, nie do raportów
const rap = await wyw("utworz_raport", { zawodnik_id: "A", tytul: "Szkic", opis: "x", perspektywa: "Ekstraklasa" });
assert.ok(rap.ok && baza.sbs_raport_inbox.length === 1 && baza.sbs_reports.length === 0);
assert.equal(baza.sbs_raport_inbox[0].status, "nowy"); assert.equal(baza.sbs_raport_inbox[0].dane.scout, "SBS AI");

// status: potwierdzenie
assert.equal((await wyw("zmien_status_zawodnika", { zawodnik_id: "A", status: "Odrzucony", powod: "słaby" })).powod, "wymaga_potwierdzenia_uzytkownika");
assert.equal(baza.sbs_players[0].status, "Do Obserwacji", "bez zgody nic się nie zmieniło");
assert.equal((await wyw("zmien_status_zawodnika", { zawodnik_id: "A", status: "Odrzucony", powod: "", potwierdzone_przez_uzytkownika: true })).powod, "bledne_argumenty");
assert.ok((await wyw("zmien_status_zawodnika", { zawodnik_id: "A", status: "Rekomendowany", powod: "oceny 5+" })).ok, "Rekomendowany bez flagi");
assert.match(baza.sbs_players[0].notes, /\[SBS AI 2026-10-06\] status: Do Obserwacji → Rekomendowany\. oceny 5\+/);
assert.ok((await wyw("zmien_status_zawodnika", { zawodnik_id: "A", status: "Do transferu", powod: "zgoda dyrektora", potwierdzone_przez_uzytkownika: true })).ok);
assert.equal((await wyw("zmien_status_zawodnika", { zawodnik_id: "A", status: "Wymyslony", powod: "x" })).powod, "bledne_argumenty");

// porównanie
assert.equal((await wyw("porownaj_zawodnikow", { ids: ["A", "A"] })).powod, "bledne_argumenty".replace("bledne_argumenty", "potrzeba_co_najmniej_dwoch_roznych_zawodnikow"));
const por = await wyw("porownaj_zawodnikow", { ids: ["A", "B", "NIE"] });
assert.ok(por.ok && por.zestawienie.length === 2 && por.nie_znaleziono.includes("NIE"));
assert.equal(por.najlepszy, null, "bez ocen nie wskazujemy lepszego");

// dwóch z potwierdzonymi ocenami → jest wskazanie
const ocena = (n) => ({ stats_filled_in: true, date: "2026-09-20", ratings: { technika: n, taktyka: n, motoryka: n, mentalnosc: n, potencjal: n } });
baza.sbs_observations.push({ player_id: "A", ...ocena(5) }, { player_id: "B", ...ocena(3) });
const por2 = await wyw("porownaj_zawodnikow", { ids: ["A", "B"] });
assert.equal(por2.najlepszy, "A", "lepiej oceniony wskazany");

// zadania
const zad = await wyw("ustaw_zadanie_scoutingowe", { opis: "Obejrzeć A w sobotę", zawodnik_id: "A", termin: "2026-10-10" });
assert.ok(zad.ok && zad.zadanie.status === "otwarte");
assert.equal((await wyw("ustaw_zadanie_scoutingowe", { id: zad.zadanie.id, status: "zrobione" })).zadanie.status, "zrobione");
assert.equal(kv[KLUCZ_ZADAN].length, 1, "aktualizacja nie dubluje zadania");
assert.equal((await wyw("ustaw_zadanie_scoutingowe", {})).powod, "brak_opisu");

// mecz
assert.equal((await wyw("pobierz_dane_meczu", {})).powod, "podaj_id_druzyne_lub_date");
const m = await wyw("pobierz_dane_meczu", { druzyna: "arka" });
assert.equal(m.liczba, 1); assert.equal(m.mecze[0].mecz.id, "m1");

// token tylko do odczytu
for (const n of NARZEDZIA.filter((x) => x.zapis)) {
  assert.equal((await wyw(n.name, {}, { tylkoOdczyt: true })).powod, "token_tylko_do_odczytu", `${n.name} zablokowane w trybie odczytu`);
}
assert.ok((await wyw("pobierz_zawodnika", { id: "A" }, { tylkoOdczyt: true })).ok);

// dziennik
const dz = kv[KLUCZ_DZIENNIKA].map((x) => x.narzedzie);
for (const n of ["dodaj_zawodnika", "zaktualizuj_ocene", "utworz_raport", "zmien_status_zawodnika", "ustaw_zadanie_scoutingowe"]) assert.ok(dz.includes(n), `dziennik: ${n}`);
assert.ok(STATUSY.length === 5);
console.log("OK — narzędzia agenta: wszystkie sprawdzenia przeszły");

// ── bramka HTTP ──
process.env.AGENT_TOKEN = "pelny-token-123"; process.env.AGENT_TOKEN_ODCZYT = "odczyt-token-456";
const { default: handler } = await import("../api/agent.js");
const wolaj = async (naglowki, metoda = "GET", body) => {
  const odp = { kod: 0, tresc: null, setHeader() {}, status(k) { this.kod = k; return this; }, json(t) { this.tresc = t; return this; } };
  await handler({ method: metoda, headers: naglowki, body }, odp);
  return odp;
};
assert.equal((await wolaj({})).kod, 401, "bez tokenu");
assert.equal((await wolaj({ authorization: "Bearer zly" })).kod, 401, "zły token");
const lista = await wolaj({ authorization: "Bearer odczyt-token-456" });
assert.equal(lista.kod, 200); assert.equal(lista.tresc.tryb, "odczyt"); assert.equal(lista.tresc.narzedzia.length, 10);
assert.equal((await wolaj({ authorization: "Bearer pelny-token-123" })).tresc.tryb, "pelny");
assert.equal((await wolaj({ authorization: "Bearer pelny-token-123" }, "DELETE")).kod, 405);
delete process.env.AGENT_TOKEN;
assert.equal((await wolaj({ authorization: "Bearer cokolwiek" })).kod, 503, "bez AGENT_TOKEN bramka zamknięta");
console.log("OK — bramka agenta: autoryzacja działa");
