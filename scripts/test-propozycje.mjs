// Skrzynka propozycji AI: obieg AI → skaut → trener → dyrektor (logika po stronie aplikacji).
//
// Sprawdza dwie rzeczy, na których stoi cały pomysł: (1) każda rola dostaje przycisk wyłącznie
// swojego etapu, (2) kandydaci wybierani regułami opisują same liczby z kartoteki i niczego nie
// dopowiadają. Zamek właściwy siedzi w bazie (test-przeplyw-ai-sql.mjs).
//
// Uruchomienie:  node scripts/test-propozycje.mjs
import { buildSync } from "esbuild";
import fs from "node:fs";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

const { outputFiles } = buildSync({
  stdin: { contents: `export * from './src/domain/propozycje.ts';`, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "esm", write: false,
});
const M = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));

console.log("\n1. Kto co może na którym etapie");
const co = M.coMozeRola;
sprawdz("skaut weryfikuje na etapie 1", co("scout", "ai_propozycja") === "weryfikuj");
sprawdz("skaut NIE ocenia i NIE decyduje", co("scout", "zweryfikowane_skaut") === null && co("scout", "ocena_trenera") === null);
sprawdz("trener ocenia dopiero po skautu", co("trener", "zweryfikowane_skaut") === "oceniaj" && co("trener", "ai_propozycja") === null);
sprawdz("dyrektor decyduje dopiero po trenerze", co("dyrektor", "ocena_trenera") === "decyduj" && co("dyrektor", "zweryfikowane_skaut") === null);
sprawdz("dyrektor nie weryfikuje faktów", co("dyrektor", "ai_propozycja") === null);
sprawdz("administrator może każdy etap",
  co("admin", "ai_propozycja") === "weryfikuj" && co("admin", "zweryfikowane_skaut") === "oceniaj" && co("admin", "ocena_trenera") === "decyduj");
sprawdz("klient nie ma nic", ["ai_propozycja", "zweryfikowane_skaut", "ocena_trenera"].every((s) => co("klient", s) === null));
sprawdz("zamknięte propozycje są tylko do odczytu",
  ["decyzja_dyrektora", "odrzucone"].every((s) => ["admin", "scout", "trener", "dyrektor"].every((r) => co(r, s) === null)));
sprawdz("odrzucić może zespół, dopóki propozycja otwarta",
  M.mozeOdrzucic("scout", "ai_propozycja") && M.mozeOdrzucic("trener", "zweryfikowane_skaut") && M.mozeOdrzucic("dyrektor", "ocena_trenera"));
sprawdz("nie odrzuca się zamkniętej ani jako klient",
  !M.mozeOdrzucic("admin", "decyzja_dyrektora") && !M.mozeOdrzucic("admin", "odrzucone") && !M.mozeOdrzucic("klient", "ai_propozycja"));

console.log("\n2. Kandydaci wybierani regułami");
const gracze = [
  { id: "a", firstName: "Jan", lastName: "Kowalski", birthYear: "2008", position: "Napastnik", minutes: 1800, matches: 22, goals: 11, assists: 3, clubId: "k1", lnpLink: "https://example.org/a" },
  { id: "b", firstName: "Piotr", lastName: "Nowak", birthYear: "2008", position: "Obrońca", minutes: 900, matches: 12, clubId: "k1" },
  { id: "c", firstName: "Adam", lastName: "Mały", birthYear: "2011", position: "Napastnik", minutes: 2500, clubId: "k2" },
  { id: "d", firstName: "Ola", lastName: "Zajęta", birthYear: "2009", position: "Napastnik", minutes: 700, clubId: "k1" },
  { id: "e", firstName: "Ewa", lastName: "Odrzucona", birthYear: "2009", position: "Napastnik", minutes: 700, status: "Odrzucony", clubId: "k1" },
  { id: "f", firstName: "Tomek", lastName: "Mało", birthYear: "2009", position: "Napastnik", minutes: 200, clubId: "k1" },
];
const klub = () => "Klub Testowy", liga = () => "III liga";
const wybierz = (kr, zajete = new Set()) => M.wybierzKandydatow(gracze, kr, zajete, klub, liga);

let w = wybierz({ rocznikOd: 2008, rocznikDo: 2010, minMinut: 500, pozycja: "napast" }, new Set(["d"]));
sprawdz("filtruje po roczniku, minutach i pozycji; pomija zajętych i odrzuconych", w.length === 1 && w[0].playerId === "a", JSON.stringify(w.map((x) => x.playerId)));
sprawdz("sortuje po minutach malejąco", wybierz({ minMinut: 0 }).map((x) => x.playerId).slice(0, 2).join() === "c,a");
sprawdz("limit jest przestrzegany i ograniczony do 50", wybierz({ limit: 2 }).length === 2 && wybierz({ limit: 9999 }).length <= 50);
const a = w[0];
sprawdz("model to „reguly”, nie AI", a.model === "reguly" && a.rodzaj === "kandydat");
sprawdz("opis zawiera liczby z kartoteki", /minuty: 1800/.test(a.tresc) && /gole: 11/.test(a.tresc) && /Rocznik 2008/.test(a.tresc));
sprawdz("brakujące liczby nazwane wprost, nie zgadnięte", /asysty: 3/.test(a.tresc) && /asysty: brak danych/.test(wybierz({ pozycja: "obroń" })[0].tresc));
sprawdz("opis mówi, że to nie ocena", /nie ocena/.test(a.tresc));
sprawdz("źródła tylko z linków w kartotece", a.zrodla.length === 1 && a.zrodla[0].url === "https://example.org/a");
sprawdz("pewność NISKA poniżej 500 minut, ŚREDNIA powyżej",
  wybierz({ rocznikOd: 2009, rocznikDo: 2009, minMinut: 100 }).find((x) => x.playerId === "f").pewnosc === "NISKA" && a.pewnosc === "ŚREDNIA");

console.log("\n3. Podpięcie w aplikacji");
const app = fs.readFileSync("src/main.ts", "utf8").replace(/\r\n/g, "\n");
sprawdz("zakładka w menu", /\{id:"propozycje", label:"Skrzynka AI"\}/.test(app));
sprawdz("klient nie dostaje zakładki w menu", /it\.id !== 'propozycje'/.test(app));
sprawdz("widok podpięty w render()", /currentView==="propozycje"\) main\.innerHTML = viewPropozycje\(\)/.test(app));
sprawdz("przyciski podpinane po przerysowaniu", /if\(currentView==='propozycje'\) podepnijPropozycje\(main\)/.test(app));
sprawdz("odrzucenie wymaga powodu po stronie ekranu", /Powód odrzucenia \(wymagany\)/.test(app));
const dane = fs.readFileSync("src/data/propozycje.ts", "utf8");
sprawdz("brak tabeli daje komunikat z nazwą migracji", /migration_2026-10-14_przeplyw_ai\.sql/.test(dane));
sprawdz("zapis bez skutku (RLS) nie udaje sukcesu", /Zmiana nie została zapisana/.test(dane));

console.log(bledy ? `\nBŁĘDÓW: ${bledy}` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
