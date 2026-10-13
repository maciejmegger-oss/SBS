// Radar młodych — skan kadr ligi i sygnały (src/data/rynki.ts, api/_tm-wystepy.js).
//
// Zgłoszenie (13.10.2026): „gdyby w 2 lidze szwedzkiej w jakimś zespole pojawił się zawodnik np.
// 2007, od razu trafia do systemu SBS, przycisk »monitoruj«, od razu ściąga jego wszystkie dane".
// Test pilnuje trzech rzeczy: kiedy zawodnik pojawia się na radarze, kiedy dostaje sygnał i że
// odrzucony NIE wraca bez nowego, mocniejszego sygnału.
//
// Uruchomienie:  node scripts/test-radar.mjs
import fs from "node:fs";
import { buildSync } from "esbuild";
import { debiutyLigowe, profilZTmapi } from "../api/_tm-wystepy.js";

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

console.log("\n1. Debiut w lidze (prawdziwe dane Husára)");
const { performance } = JSON.parse(fs.readFileSync("scripts/fixtures/tm-performance-husar.json", "utf8"));
const d = debiutyLigowe(performance);
sprawdz("debiut = pierwszy ZAGRANY mecz ligowy (11.10.2026), nie mecz poza kadrą", d.debiutLigowy === "2026-10-11", d.debiutLigowy);
sprawdz("reprezentacja i liga młodzieżowa nie są debiutem w seniorach",
  debiutyLigowe(performance.filter((w) => w.gameInformation.competitionId !== "SK2")).debiutLigowy === "");
sprawdz("pierwszy start", d.pierwszyStartLigowy === "2026-10-11");
const prof = profilZTmapi({ name: "Lion Beqiri", lifeDates: { dateOfBirth: "2006-05-27" }, attributes: { positionId: 11, positionGroup: "FORWARD" },
  nationalityDetails: { nationalities: { nationalityId: 147, secondNationalityId: 0 } }, ribbon: { ribbonType: "NEW_SIGNING" }, relativeUrl: "/lion-beqiri/profil/spieler/1185169" });
sprawdz("pozycja, obywatelstwo, nowy nabytek i adres z profilu",
  prof.pozycja === "Lewy napastnik" && prof.obywatelstwo.join() === "Szwecja" && prof.nowyNabytek && /1185169$/.test(prof.adres), JSON.stringify(prof));
sprawdz("nieznany numer kraju zostaje pusty, nie zmyślony", profilZTmapi({ nationalityDetails: { nationalities: { nationalityId: 999 } } }).obywatelstwo.length === 0);

console.log("\n2. Pierwszy skan");
const sezon = (wyst, min, mecze) => [{ sezonId: 2026, sezon: "2026", rozgrywki: [{ sezonId: 2026, sezon: "2026", rozgrywkiId: "SE2", rozgrywki: "Superettan",
  typRozgrywek: 2, reprezentacja: false, klubId: "5196", klub: "", meczeDruzyny: mecze, wKadrze: wyst, wystepy: wyst, odPierwszej: 0, zLawki: wyst,
  minuty: min, minutyMozliwe: mecze * 90, gole: 0, asysty: 0, samoboje: 0, zolte: 0, czerwone: 0, ostatniMecz: "" }] }];
const zaw = (id, rok, sez, debiut = "", start = "") => ({ tmId: id, profil: { nazwa: "Zawodnik " + id, dataUr: rok + "-05-01", pozycja: "Pomocnik",
  wzrost: null, noga: "", kontraktDo: "", menedzer: "", wartosc: "", wypozyczony: false }, sezony: sez, debiutLigowy: debiut, pierwszyStartLigowy: start });
let stan = { wpisy: {}, skany: {}, odRocznika: 2006 };
stan = R.aktualizujRadar(stan, "SE2", [{ klubId: "5196", klub: "Falkenbergs FF", zawodnicy: [
  zaw("1", 2007, sezon(2, 30, 20), "2026-09-20"),
  zaw("2", 2008, []),
] }], "2026-10-13");
sprawdz("obaj na radarze, z sygnałem NOWY", stan.wpisy["1"].sygnaly[0].rodzaj === "NOWY" && stan.wpisy["2"].sygnaly[0].rodzaj === "NOWY");
sprawdz("świeży debiut (23 dni) daje też sygnał DEBIUT", stan.wpisy["1"].sygnaly.some((s) => s.rodzaj === "DEBIUT"));
sprawdz("bez minut: brak udziału, nie zero", stan.wpisy["2"].udzial === null && /bez minut/.test(stan.wpisy["2"].sygnaly[0].opis));
sprawdz("zapisany czas skanu ligi", !!stan.skany.SE2);

console.log("\n3. Drugi skan — sygnały ze zmian");
stan.wpisy["2"] = { ...stan.wpisy["2"], decyzja: "odrzucony", nowe: false };
stan.wpisy["1"] = { ...stan.wpisy["1"], nowe: false };
const bez = R.aktualizujRadar(stan, "SE2", [{ klubId: "5196", klub: "Falkenbergs FF", zawodnicy: [zaw("1", 2007, sezon(2, 30, 21), "2026-09-20"), zaw("2", 2008, [])] }], "2026-10-20");
sprawdz("bez zmian — bez nowych sygnałów", bez.wpisy["1"].sygnaly.length === 2 && !bez.wpisy["1"].nowe);
sprawdz("odrzucony bez nowego sygnału zostaje odrzucony", bez.wpisy["2"].decyzja === "odrzucony");
const zmiany = R.aktualizujRadar(stan, "SE2", [
  { klubId: "5196", klub: "Falkenbergs FF", zawodnicy: [zaw("1", 2007, sezon(8, 600, 24), "2026-09-20", "2026-10-18")] },
  { klubId: "2844", klub: "IFK Norrköping", zawodnicy: [zaw("2", 2008, sezon(1, 20, 1), "2026-10-18")] },
], "2026-10-20");
sprawdz("pierwszy start → PIERWSZY START", zmiany.wpisy["1"].sygnaly.some((s) => s.rodzaj === "PIERWSZY START"));
sprawdz("udział 2% → 28% → MINUTY ↑", zmiany.wpisy["1"].sygnaly.some((s) => s.rodzaj === "MINUTY ↑"), JSON.stringify(zmiany.wpisy["1"].sygnaly));
sprawdz("odrzucony wraca na radar po debiucie i zmianie klubu",
  zmiany.wpisy["2"].decyzja === "" && zmiany.wpisy["2"].sygnaly.some((s) => s.rodzaj === "DEBIUT") && zmiany.wpisy["2"].sygnaly.some((s) => s.rodzaj === "ZMIANA KLUBU"));
sprawdz("pierwsze pojawienie się na radarze zapamiętane", zmiany.wpisy["1"].pierwszyRaz === "2026-10-13");

console.log("\n4. Lista i Monitoruj");
R.ustawRadar({ ...zmiany, odRocznika: 2008 });
sprawdz("filtr rocznika: od 2008 zostaje tylko zawodnik 2008", R.listaRadaru("SE2").map((w) => w.tmId).join() === "2");
R.ustawRadar({ ...zmiany, odRocznika: 2006 });
sprawdz("bez decyzji i z nowym sygnałem na górze", R.listaRadaru("SE2")[0].nowe);
const m = R.profilZRadaru(zmiany.wpisy["1"]);
sprawdz("Monitoruj zakłada profil z numerem TM, statusem Obserwacja i pierwszą obserwacją",
  m.tmId === "1" && m.status === "Obserwacja" && m.obserwacje[0].minuty === 600 && m.obserwacje[0].meczeMozliwe === 24, JSON.stringify(m.obserwacje));
R.zapiszProfilRynku(m);
sprawdz("profil z radaru jest na liście monitorowanych", R.monitorowani().some((x) => x.tmId === "1"));
R.decyzjaRadaru("1", "monitorowany");
sprawdz("decyzja zapisana, znacznik „nowe” zdjęty", R.radar().wpisy["1"].decyzja === "monitorowany" && !R.radar().wpisy["1"].nowe);

console.log("\n5. Superettan i podpięcie");
const se2 = R.ligaRynku("SE2");
sprawdz("16 klubów Superettan z numerami Transfermarktu", se2.klubyTM.length === 16 && se2.klubyTM.every((k) => /^\d+$/.test(k.id)));
sprawdz("monitorowani z Falkenbergu mają numery TM", R.MONITORING_RYNKI.every((x) => /^\d+$/.test(x.tmId || "")));
const zrodlo = fs.readFileSync("src/main.ts", "utf8");
sprawdz("radar wczytywany i zapisywany", /czytaj\('scouting:rynki_radar'\)/.test(zrodlo) && /robustStorageSet\('scouting:rynki_radar'/.test(zrodlo));
sprawdz("skan klub po klubie przez api/rynki-skaner", /\/api\/rynki-skaner\?klub=/.test(zrodlo) && fs.existsSync("api/rynki-skaner.js"));
sprawdz("skan sam co 7 dni przy wejściu w ligę", /7 \* 86400000/.test(zrodlo));

console.log(bledy ? `\n${bledy} błąd(ów).` : "\nWszystko w porządku.");
process.exit(bledy ? 1 : 0);
