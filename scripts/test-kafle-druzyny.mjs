// Sprawdza panel do tagowania CALEJ DRUZYNY — kafle, grupy i bieguny.
//
// Wczesniej staly tu kafle ZAWODNIKA (drybling, gra glowa, ustawienie), przeniesione zywcem
// z panelu indywidualnego. Przy druzynie nie znaczyly nic: "drybling Lecha" to nie jest zdanie,
// ktore da sie potem policzyc. A to wlasnie ten panel widac przy obserwacji calego meczu, czyli
// przez wiekszosc pracy skauta.
//
// Uruchomienie:  node scripts/test-kafle-druzyny.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const panel = fs.readFileSync("src/mobile/main.ts", "utf8");
let bledy = 0;
const spr = (opis, w, dod="") => { console.log(`${w?"  OK  ":" BŁĄD "} ${opis}${w?"":"   "+dod}`); if(!w) bledy++; };

// Prawdziwa definicja kafli, nie jej odpis.
const kod = panel.match(/const EVENT_TAGS = \[[\s\S]*?\n\] as const;/)[0]
  + "\n" + panel.match(/const KAFLE_BEZ_BIEGUNA = new Set\(\[[^\]]*\]\);/)[0]
  + "\n" + panel.match(/const kafelNeutralny = [\s\S]*?\n[^\n]*neutralny;/)[0];
const { EVENT_TAGS, kafelNeutralny } =
  new Function(`${transformSync(kod, { loader: "ts" }).code}\nreturn { EVENT_TAGS, kafelNeutralny };`)();

const klucze = EVENT_TAGS.map((t) => t.key);
const ma = (k) => klucze.includes(k);

console.log("Kafle zamowione ze stadionu");
{
  for (const [k, opis] of [
    ["podanie", "Podanie"], ["strzal", "Strzał"], ["strata", "Strata"],
    ["atak_pola_karnego", "Atak pola karnego"], ["rzut_rozny", "Rzut rożny"],
    ["rzut_wolny", "Rzut wolny"], ["karny", "Karny"],
    ["interwencja_bramkarza", "Interwencja bramkarza"], ["out", "Out"], ["spalony", "Spalony"],
  ]) spr(opis, ma(k), k);
}

console.log("\nCztery dolozone — kazdy z powodu");
{
  // Bez gola zapis meczu jest niepelny, a to jedyne zdarzenie, ktore widza wszyscy.
  spr("Gol", ma("gol"));
  // Bez odbioru liczymy same STRATY — bilans jednostronny i nic nie mowi.
  spr("Odbiór (bez niego liczylibyśmy same straty)", ma("odbior"));
  // Dosrodkowanie wrzucone do "podania" znika w liczbie, ktora i tak jest najwieksza.
  spr("Dośrodkowanie", ma("dosrodkowanie"));
  // Rzuty wolne biora sie z fauli — bez tego widac skutek, a nie przyczyne.
  spr("Faul", ma("faul"));
}

console.log("\nCzego w panelu druzyny byc nie powinno");
{
  // To sa zdarzenia ZAWODNIKA. Przy druzynie nie daja sie policzyc ani porownac.
  spr("nie ma dryblingu", !ma("drybling"));
  spr("nie ma gry głową", !ma("gra_glowa"));
  spr("nie ma ustawienia", !ma("ustawienie"));
  spr("nie ma pojedynku", !ma("pojedynek"));
}

console.log("\nBieguny: co jest udane, a co po prostu zaszlo");
{
  // Rzut rozny nie jest "udany" ani "nieudany": albo byl, albo go nie bylo. Stawianie przy nim
  // bieguna produkowaloby liczbe, ktora nic nie znaczy, a wygladalaby na statystyke.
  for (const k of ["rzut_rozny", "rzut_wolny", "karny", "spalony", "out", "faul"]) {
    spr(`${k} — bez bieguna`, kafelNeutralny(k) === true);
  }
  // A te maja sens tylko Z biegunem: z nich wychodza udzialy procentowe.
  for (const k of ["podanie", "dosrodkowanie", "strzal", "atak_pola_karnego", "odbior", "strata"]) {
    spr(`${k} — udane albo nieudane`, kafelNeutralny(k) === false);
  }
  spr("gol nie pyta o biegun", kafelNeutralny("gol") === true);
  spr("nieznany klucz nie jest neutralny", kafelNeutralny("czego_nie_ma") === false);
  // Kafle POZYCYJNE idą tym samym torem: „nieudana asysta" to nie jest zdarzenie.
  spr("asysta też bez bieguna", kafelNeutralny("asysta") === true);
  spr("obrona 1 na 1 dalej udana albo nieudana", kafelNeutralny("obrona_1v1") === false);
}

console.log("\nGrupy i ich kolejnosc");
{
  const grupy = [];
  EVENT_TAGS.forEach((t) => { if (t.grupa && !grupy.includes(t.grupa)) grupy.push(t.grupa); });
  spr("trzy grupy", grupy.length === 3, JSON.stringify(grupy));
  spr("gra idzie pierwsza", grupy[0] === "Gra", grupy[0]);
  // Rzadkie i wazne na koncu: pomylkowe dotkniecie gola przeklamuje caly zapis.
  spr("zdarzenia meczu na końcu", grupy[2] === "Zdarzenia meczu", grupy[2]);
  spr("każdy kafel ma grupę", EVENT_TAGS.every((t) => !!t.grupa));
}

console.log("\nWpiecie w panel");
{
  spr("siatka rysuje grupy z nagłówkami", /function siatkaKafli/.test(panel));
  // Kafle pozycyjne zostaja plaskie — dwanascie rzeczy jednej pozycji nie ma czego dzielic.
  // Nad nimi stoi jeden podpis, z jakiej pozycji sa.
  spr("kafle pozycyjne zostają płaskie",
    /if \(!grupy\.length\) return `\s*\n\s*<div class="label"[^\n]*Kafle pozycyjne[\s\S]{0,120}<div class="tags">/.test(panel));
  // Przelacznik "udane/nieudane" jest wspolny i stoi wyzej — bez tego zdania skaut mialby prawo
  // sadzic, ze dotyczy takze rzutow roznych.
  spr("neutralna grupa mówi o tym przy nagłówku", /bez udane\/nieudane/.test(panel));
  spr("zdarzenie neutralne zapisuje się bez bieguna",
    /quality: kafelNeutralny\(tag\.key\) \? 1 : polarity,/.test(panel));
  spr("i na osi nie ma znaku", /kafelNeutralny\(e\.type\) \? "" : \(e\.quality === 1 \? "\+" : "−"\)/.test(panel));
  spr("ani zielonej\\/czerwonej ramki", /kafelNeutralny\(e\.type\) \? "" : \(e\.quality === 1 \? "plus" : "minus"\)/.test(panel));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
