// Test uzupełniania braków z Transfermarktu (api/_uzupelnianie.js) na atrapie serwisu — bez sieci:
//   node scripts/test-uzupelnianie.mjs
import assert from "node:assert/strict";
import { uzupelnijZawodnikow, znajdzProfil, czyTenSam, zbudujPoprawke, czyMoznaPytac } from "../api/_uzupelnianie.js";

const profilHtml = ({ wzrost, noga, pozycja, urodz, klub, umowa, agent }) => `<html><body>
<span>Data urodzenia:</span><span>${urodz}</span>
<span>Wzrost:</span><span>${wzrost}</span>
<span>Noga:</span><span>${noga}</span>
<span>Pozycja:</span><span>${pozycja}</span>
<span>Narodowość:</span><span>Polska</span>
<span>Obecny klub:</span><span>${klub}</span>
<span>Umowa do:</span><span>${umowa}</span>
${agent ? `<a href="/hcm/beraterfirma/berater/2252"><span title="${agent}">${agent.slice(0, 5)}...</span></a>` : ""}
</body></html>`;

const szukanieHtml = (...k) => "<html><body>" + k.map(([id, n]) =>
  `<a href="/${n.toLowerCase().replace(/ /g, "-")}/profil/spieler/${id}">${n}</a>`).join("") + "</body></html>";

const STRONY = {
  "https://www.transfermarkt.pl/jan-kowalski/profil/spieler/1": profilHtml({ wzrost: "1,87 m", noga: "lewa", pozycja: "Obrońca - Stoper", urodz: "15 sty 2008 (18)", klub: "Lechia Gdańsk", umowa: "30 cze 2027", agent: "HCM Sports Management" }),
  "https://www.transfermarkt.pl/jan-kowalski/profil/spieler/2": profilHtml({ wzrost: "1,75 m", noga: "prawa", pozycja: "Napastnik", urodz: "2 lut 1990 (36)", klub: "Inny Klub", umowa: "-", agent: "" }),
  // dwóch Nowaków z tym samym rocznikiem — nie wolno wybierać
  "https://www.transfermarkt.pl/adam-nowak/profil/spieler/3": profilHtml({ wzrost: "1,80 m", noga: "prawa", pozycja: "Pomocnik", urodz: "1 mar 2008 (18)", klub: "A", umowa: "-", agent: "" }),
  "https://www.transfermarkt.pl/adam-nowak/profil/spieler/4": profilHtml({ wzrost: "1,90 m", noga: "lewa", pozycja: "Pomocnik", urodz: "9 wrz 2008 (18)", klub: "B", umowa: "-", agent: "" }),
};
const SZUKANIE = {
  "Jan Kowalski": szukanieHtml([1, "Jan Kowalski"], [2, "Jan Kowalski"], [9, "Jan Kowalczyk"]),
  "Adam Nowak": szukanieHtml([3, "Adam Nowak"], [4, "Adam Nowak"]),
  "Piotr Zieliński": szukanieHtml([8, "Piotr Zielinski"]),
};
const wywolania = [];
const pobierz = async (url) => {
  wywolania.push(url);
  const q = decodeURIComponent((url.split("query=")[1] || ""));
  if (q) return SZUKANIE[q] || szukanieHtml();
  if (STRONY[url]) return STRONY[url];
  throw new Error("Transfermarkt odpowiedział kodem 404");
};

const dzis = new Date("2026-10-06T06:00:00Z");
const zaw = (id, imie, nazwisko, o) => ({ id, first_name: imie, last_name: nazwisko, status: "Do Obserwacji", has_agent: false, custom_fields: {}, ...o });

// --- czyTenSam
assert.ok(czyTenSam({ birth_year: "2008" }, { dataUrodzenia: "2008-01-15" }, ""));
assert.ok(!czyTenSam({ birth_year: "2008" }, { dataUrodzenia: "1990-02-02" }, "Lechia"), "inny rocznik = inna osoba, nawet gdy klub by pasował");
assert.ok(czyTenSam({}, { klub: "Lechia Gdańsk", dataUrodzenia: "" }, "Lechia Gdańsk"), "bez rocznika ratuje klub");
assert.ok(!czyTenSam({}, { klub: "X", dataUrodzenia: "2008-01-01" }, ""), "bez rocznika i klubu — nie wiadomo");

// --- zbudujPoprawke: tylko puste pola
const p0 = zaw("P0", "Jan", "Kowalski", { birth_year: "2008", height: 190, foot: "", position: "" });
const prof = (await znajdzProfil(p0, "Lechia Gdańsk", pobierz)).profil;
const popr = zbudujPoprawke(p0, prof, "u", dzis);
assert.equal(popr.kolumny.height, undefined, "wzrost był wpisany — nie nadpisujemy");
assert.equal(popr.kolumny.foot, "Lewa");
assert.equal(popr.kolumny.position, "Obrońca środkowy");
assert.equal(popr.kolumny.has_agent, true);
assert.equal(popr.ext.contractUntil, "2027-06-30");
assert.equal(popr.ext.uzupelnienieAI.zrodlo, "Transfermarkt");

// --- pętla
const zapisane = [];
const lista = [
  zaw("A", "Jan", "Kowalski", { birth_year: "2008", club_id: "c1" }),               // jednoznaczny
  zaw("B", "Adam", "Nowak", { birth_year: "2008", club_id: "c2" }),                 // dwóch pasujących
  zaw("C", "Piotr", "Zieliński", { birth_year: "2007" }),                           // kandydat znaleziony (po normalizacji liter), ale strony profilu atrapa nie ma → błąd 404 nie zatrzymuje pętli
  zaw("D", "Ola", "Bez", {}),                                                       // brak rocznika i klubu
  zaw("E", "Jan", "Kowalski", { birth_year: "2008", position: "Napastnik", height: 180, foot: "Prawa", nationality: "Polska",
    custom_fields: { __ext: { contractUntil: "2028-01-01", agentCheckedAt: "2026-01-01", uzupelnienieAI: { proba: "2026-10-01T00:00:00Z" } } } }), // niedawno próbowany
];
const w = await uzupelnijZawodnikow({
  zawodnicy: lista, idNowych: new Set(["A"]), nazwaKlubuPo: (p) => ({ c1: "Lechia Gdańsk", c2: "C" }[p.club_id] || ""),
  pobierz, zapisz: async (p, k, e) => zapisane.push({ id: p.id, k, e }), przerwaMs: 0, dzis,
});
assert.equal(w.uzupelnieni, 1);
assert.deepEqual(w.doRecznegoWskazania, ["Adam Nowak"], "niejednoznaczny trafia do ręcznego wskazania");
assert.ok(!zapisane.some((z) => z.id === "B" && Object.keys(z.k).length), "B: żadnych danych do kartoteki");
assert.ok(!zapisane.some((z) => z.id === "E"), "E: niedawno próbowany — pomijamy");
assert.ok(zapisane.find((z) => z.id === "A").k.tm_link, "A dostaje adres profilu");
assert.ok(zapisane.find((z) => z.id === "B").e.uzupelnienieAI.proba, "nieudana próba też zostawia ślad");
assert.ok(!czyMoznaPytac(lista[4], dzis) && czyMoznaPytac(lista[4], new Date("2026-11-01")));
assert.ok(!wywolania.some((u) => u.includes("Ola")), "D: bez rocznika i klubu nie pytamy serwisu");

// --- limit i błąd 429 przerywa
const w2 = await uzupelnijZawodnikow({
  zawodnicy: [zaw("X", "Jan", "Kowalski", { birth_year: "2008" }), zaw("Y", "Jan", "Kowalski", { birth_year: "2008" })],
  pobierz: async () => { throw new Error("Transfermarkt odpowiedział kodem 429"); },
  zapisz: async () => {}, przerwaMs: 0, dzis,
});
assert.equal(w2.sprawdzeni, 1, "po 429 przestajemy pytać");
assert.equal(w2.bledy.length, 1);

console.log("OK — uzupełnianie: wszystkie sprawdzenia przeszły", JSON.stringify(w));
