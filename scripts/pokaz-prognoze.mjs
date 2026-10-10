// POKAZ NA ŻYWYCH DANYCH: co prognoza mówi o konkretnym zawodniku i dlaczego.
//
// Bierze historię sezonów prosto z 90minut (tym samym /api/kariera, z którego korzysta aplikacja),
// dokłada przebieg bieżącego sezonu i puszcza przez ten sam kod, który liczy prognozę w systemie.
// Nic nie zapisuje — służy do obejrzenia mechanizmu i do strojenia progów.
//
// Uruchomienie:  node scripts/pokaz-prognoze.mjs "http://www.90minut.pl/kariera.php?id=43416"
import { buildSync } from "esbuild";

const { outputFiles } = buildSync({
  stdin: { contents: `export * from './src/prognoza.ts';`, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "esm", write: false,
});
const M = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));

const adres = process.argv[2] || "http://www.90minut.pl/kariera.php?id=43416";
const API = process.env.SBS_API || "https://www.scoutbasesystem.com";

const odp = await fetch(`${API}/api/kariera?url=${encodeURIComponent(adres)}`);
const d = await odp.json();
if (!odp.ok) { console.error("Nie udało się pobrać kariery:", d.error); process.exit(1); }

const wiek = d.rocznik ? new Date().getFullYear() - d.rocznik : null;
const biezacy = d.sezony[0] || {};

console.log(`\n=== ${d.nazwa}${d.rocznik ? `, rocznik ${d.rocznik} (${wiek} lat)` : ""} ===\n`);
console.log('Historia z 90minut — to na niej stoi „czy przechodzi kolejne szczeble”:');
for (const s of d.sezony) {
  const odPierwszej = s.wystepy ? Math.round((s.wPodstawowym / s.wystepy) * 100) : 0;
  console.log(`  ${s.sezon}  ${String(s.rozgrywki || "—").padEnd(16)} ${String(s.klub || "").padEnd(22)}` +
    ` ${String(s.minuty).padStart(5)} min   ${s.wPodstawowym}/${s.wystepy} od 1. minuty (${odPierwszej}%)   ${s.gole} g`);
}

// Przebieg bieżącego sezonu odtwarzamy z sum sezonowych — w aplikacji idzie wprost z protokołów ŁNP.
const przebieg = Array.from({ length: biezacy.wystepy || 0 }, (_, i) => ({
  minuty: Math.round((biezacy.minuty || 0) / (biezacy.wystepy || 1)),
  podstawowy: i < (biezacy.wPodstawowym || 0),
  gole: i < (biezacy.gole || 0) ? 1 : 0,
}));

const baza = {
  wiek,
  pozycja: process.env.SBS_POZYCJA || "Pomocnik",
  poziomTeraz: biezacy.rozgrywki || "",
  przebieg,
  sezony: d.sezony,
};

const pokaz = (tytul, dane) => {
  const w = M.prognozaZawodnika(dane);
  console.log(`\n--- ${tytul} ---`);
  if (!w.mozliwa) {
    console.log("  PROGNOZA: niedostępna");
    w.braki.forEach((b) => console.log("   ✗ " + b));
    return;
  }
  const zakres = w.pulapOd === w.pulapDo ? String(w.pulapDo) : `${w.pulapOd}-${w.pulapDo}`;
  console.log(`  DZIŚ: stopień ${w.stopienTeraz} (rola: ${w.rolaTeraz})`);
  console.log(`  PUŁAP: ${zakres}   horyzont ${w.horyzont}   pewność ${w.pewnosc}`);
  w.skladniki.forEach((s) => {
    const pkt = s.punkty === 0 ? "  —  " : (s.punkty > 0 ? "+" : "") + String(Math.round(s.punkty * 100) / 100);
    console.log(`     ${pkt.padStart(6)}  ${s.nazwa}: ${s.opis}`);
  });
};

pokaz("Tak wygląda to DZIŚ: raportu z oceną potencjału jeszcze nie ma", { ...baza, ocenyAtrybutow: null, perspektywa: "" });
pokaz("Skaut wystawia potencjał 4/6 i perspektywę WYSOKA",
  { ...baza, ocenyAtrybutow: { potencjal: 4 }, perspektywa: "WYSOKA" });
pokaz("Ten sam zawodnik przy ocenie potencjału 5/6",
  { ...baza, ocenyAtrybutow: { potencjal: 5 }, perspektywa: "WYSOKA" });
pokaz("Gdyby skaut dał 3/6 i perspektywę NISKA",
  { ...baza, ocenyAtrybutow: { potencjal: 3 }, perspektywa: "NISKA" });

console.log("\nStopnie według drabiny notowania z arkusza kompetencji — pełna lista");
console.log("w src/data/profil-kompetencji.ts (DRABINA_NOTOWANIA).\n");
