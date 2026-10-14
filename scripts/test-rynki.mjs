// Rynki — mapa lig 2. i 3. poziomu (Skandynawia, Europa Środkowo-Wschodnia) i zawodnicy 16–21.
//
// Zgłoszenie (13.10.2026): „skupiłbym się na rynku skandynawskim, wschodnia Europa, zrobił wstępną
// mapę drugich i trzecich lig, zawodników młodzieżowych, ich historię i tempo rozwoju (...)
// przedziały wiekowe". Najważniejsze w tym teście są reguły, które klub z Polski bierze dosłownie:
// przedział wieku, udział w minutach, tempo i uwaga transferowa (art. 19 RSTP, limit spoza UE).
//
// Uruchomienie:  node scripts/test-rynki.mjs
import fs from "node:fs";
import { buildSync } from "esbuild";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

const { outputFiles } = buildSync({
  stdin: { contents: "export * from './src/data/rynki.ts';", resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "esm", write: false,
});
const R = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
const dzis = new Date(2026, 9, 13, 21, 0);

console.log("\n1. Mapa lig");
sprawdz("20 lig na mapie", R.LIGI_RYNKOW.length === 20, String(R.LIGI_RYNKOW.length));
sprawdz("identyfikatory lig są unikalne", new Set(R.LIGI_RYNKOW.map((l) => l.id)).size === R.LIGI_RYNKOW.length);
sprawdz("każda liga ma region z listy", R.LIGI_RYNKOW.every((l) => R.REGIONY.includes(l.region)));
sprawdz("żadna nazwa z Transfermarktu nie wskazuje dwóch lig",
  (() => { const a = R.LIGI_RYNKOW.flatMap((l) => l.aliasy.map((x) => x.toLowerCase())); return new Set(a).size === a.length; })());
sprawdz("„1.Division” z Transfermarktu → duńska 1. Division", R.ligaPoNazwieTM("1.Division")?.id === "DK2");
sprawdz("„MONACObet Liga” → słowacka 2. liga", R.ligaPoNazwieTM("MONACObet Liga")?.id === "SK2");
sprawdz("niejednoznaczne „Liga 2” (Rumunia) NIE trafia na mapę", R.ligaPoNazwieTM("Liga 2") === undefined);
sprawdz("Allsvenskan (1. poziom) poza mapą", R.ligaPoNazwieTM("Allsvenskan") === undefined);
sprawdz("priorytet Szwecji = 1", R.priorytetKraju("Szwecja") === 1);

console.log("\n2. Wiek i przedziały");
sprawdz("wiek liczony z dnia, nie z rocznika (urodzony 18.07.2005 → 21)", R.wiekNaDzien("2005-07-18", dzis) === 21);
sprawdz("dzień przed urodzinami (14.10.2008 → 17)", R.wiekNaDzien("2008-10-14", dzis) === 17);
sprawdz("16 i 17 → A", R.przedzialWieku(16) === "A" && R.przedzialWieku(17) === "A");
sprawdz("18 i 19 → B", R.przedzialWieku(18) === "B" && R.przedzialWieku(19) === "B");
sprawdz("20 i 21 → C", R.przedzialWieku(20) === "C" && R.przedzialWieku(21) === "C");
sprawdz("15 i 22 poza przedziałami", R.przedzialWieku(15) === null && R.przedzialWieku(22) === null);

console.log("\n3. Minuty i tempo");
sprawdz("udział = minuty / (mecze × 90): 486 / (9 × 90) = 60%", Math.abs(R.udzialMinut(486, 9) - 0.6) < 1e-9);
sprawdz("bez liczby meczów udziału nie ma (żadnego dzielenia przez zero)", R.udzialMinut(300, null) === null && R.udzialMinut(300, 0) === null);
sprawdz("brak poprzedniego sezonu nie udaje debiutu", R.tempoRozwoju(null, 0.6) === "Brak danych poprz. sezonu");
sprawdz("+30 pkt proc. → Skok", R.tempoRozwoju(0.2, 0.5) === "Skok");
sprawdz("+15 pkt proc. → Wzrost", R.tempoRozwoju(0.3, 0.45) === "Wzrost");
sprawdz("−5 pkt proc. → Stabilnie", R.tempoRozwoju(0.5, 0.45) === "Stabilnie");
sprawdz("−20 pkt proc. → Spadek", R.tempoRozwoju(0.6, 0.4) === "Spadek");

console.log("\n4. Uwagi transferowe");
sprawdz("17-latek spoza UE: transfer zasadniczo niemożliwy", /Za młody/.test(R.uwagaTransferowa(17, false)));
sprawdz("17-latek z UE/EOG: dozwolony, ale z ekwiwalentem", R.uwagaTransferowa(17, true) === "Ekwiwalent za wyszkolenie");
sprawdz("19-latek spoza UE: limit + ekwiwalent", R.uwagaTransferowa(19, false) === "Limit spoza UE; ekwiwalent za wyszkolenie");
sprawdz("Norwegia (EOG) liczy się jak UE", R.czyUeEog("Norwegia") === true && R.czyUeEog("Ukraina") === false);

console.log("\n5. Zawodnicy na rynkach");
const lista = R.zawodnicyRynkow(dzis);
const rupia = lista.find((z) => z.nazwisko === "Rupia-Ellis");
sprawdz("monitorowani są na liście", lista.filter((z) => z.zrodlo === "monitoring").length === R.MONITORING_RYNKI.length);
sprawdz("Rupia-Ellis: Superettan, przedział C, ~60% minut", rupia && rupia.liga.id === "SE2" && rupia.przedzial === "C" && Math.round(rupia.udzial * 100) === 60);
sprawdz("Lundgren liczony w lidze, w której gra (Ettan Södra), nie klubu macierzystego",
  lista.find((z) => z.nazwisko === "Lundgren")?.liga.id === "SE3S");
sprawdz("kadry młodzieżowe dołączają same, gdy klub gra w lidze z mapy", lista.some((z) => z.zrodlo === "kadra"));
sprawdz("żaden zawodnik z kadr nie ma zmyślonego udziału w minutach", lista.filter((z) => z.zrodlo === "kadra").every((z) => z.udzial === null));
const syg = R.sygnalyRynkow(lista, dzis);
sprawdz("sygnał: koniec wypożyczenia Lundgrena (30.11.2026)", syg.some((s) => s.rodzaj === "WYPOŻYCZENIE" && /Lundgren/.test(s.nazwisko)));
sprawdz("sygnał: wysoki udział w minutach Rupia-Ellisa", syg.some((s) => s.rodzaj === "MINUTY ↑" && /Rupia-Ellis/.test(s.nazwisko)));

console.log("\n6. Podpięcie w systemie");
const zrodlo = fs.readFileSync("src/main.ts", "utf8");
sprawdz("zakładka w panelu bocznym, zaraz po Talencie", /\{id:"talent", label:"Talent"\},\n  \{id:"rynki", label:"Rynki"\},/.test(zrodlo));
sprawdz("widok rysowany w render()", /currentView==="rynki"\) main\.innerHTML = viewRynki\(\);/.test(zrodlo));
sprawdz("przyciski podpięte", /podepnijRynki\(main\);/.test(zrodlo));
sprawdz("„wstecz” w przeglądarce pamięta poziom Rynków", /ry:rynkiStan/.test(zrodlo) && /rynkiStan = \(s && s\.rynkiStan\)/.test(zrodlo));
sprawdz("tłumaczenie nazwy zakładki (EN)", /'Rynki': 'Markets'/.test(fs.readFileSync("src/i18n/en.ts", "utf8")));

console.log(bledy ? `\n${bledy} błąd(ów).` : "\nWszystko w porządku.");
process.exit(bledy ? 1 : 0);
