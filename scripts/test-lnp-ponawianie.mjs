// Sprawdza, ze panel PONAWIA probe pobrania skladu z LNP.
//
// Zgloszenie ze stadionu brzmialo: "w lnp jest juz sklad, ale nie wgralo". Przyczyna byla
// w regule, nie w odczycie: proba byla JEDNA na obserwacje. Scout otwieral mecz wczesniej, niz
// LNP oglaszalo sklad, ta jedyna proba trafiala w pustke — i nie powtarzala sie nigdy.
//
// Uruchamiamy PRAWDZIWY kod decyzyjny z panelu (wyciety ze zrodla), nie jego odpis. Zegar
// podstawiamy, zeby nie czekac w tescie poltorej minuty.
//
// Uruchomienie:  node scripts/test-lnp-ponawianie.mjs
import fs from "node:fs";
import { transformSync } from "/home/user/SBS/node_modules/esbuild/lib/main.js";

const panel = fs.readFileSync(new URL("../src/mobile/main.ts", import.meta.url), "utf8");
let bledy = 0;
const spr = (opis, w, dod="") => { console.log(`${w?"  OK  ":" BŁĄD "} ${opis}${w?"":"   "+dod}`); if(!w) bledy++; };

// --- PRAWDZIWA FUNKCJA DECYZYJNA ---
const kodFunkcji = panel.match(/function sprobujSkladZLnp\(\)[\s\S]*?\n}\n/)[0];
const kodStalych = panel.match(/const ostatniaProbaLnp[\s\S]*?const PRZERWA_PROB_LNP = [^;]+;/)[0];

// Stan, ktory funkcja widzi. Wszystko, czego dotyka, podstawiamy — liczy sie sama regula.
function zbuduj({ sklad = {}, lnpUrl = "adres-meczu", listy = ["lista"] } = {}) {
  const stan = { probyPobrania: 0, teraz: 1_000_000 };
  const obs = { id: "OBS-1", lnpUrl, skladMeczu: sklad };
  const zrodlo = `
    ${transformSync(kodStalych, { loader: "ts" }).code}
    ${transformSync(kodFunkcji, { loader: "ts" }).code}
    return sprobujSkladZLnp;`;
  const fabryka = new Function("live", "cache", "STRONY", "listyMeczow", "pobierzSkladZLnp", "Date", zrodlo);
  const wywolaj = fabryka(
    { observationId: "OBS-1" },
    { observations: [obs] },
    ["gospodarze", "goscie"],
    () => listy,
    () => { stan.probyPobrania++; },
    { now: () => stan.teraz },
  );
  return { stan, obs, wywolaj };
}

console.log("Ponawianie proby pobrania skladu");
{
  const { stan, wywolaj } = zbuduj();
  wywolaj();
  spr("pierwsze wejście pyta o skład", stan.probyPobrania === 1, "prób: " + stan.probyPobrania);

  wywolaj();
  wywolaj();
  spr("zaraz potem nie pyta znowu", stan.probyPobrania === 1, "prób: " + stan.probyPobrania);

  // Mija poltorej minuty — tyle, ile trwa przerwa miedzy probami.
  stan.teraz += 91_000;
  wywolaj();
  spr("po przerwie PYTA PONOWNIE — to jest sedno poprawki",
    stan.probyPobrania === 2, "prób: " + stan.probyPobrania);

  stan.teraz += 91_000;
  wywolaj();
  stan.teraz += 91_000;
  wywolaj();
  spr("i pyta dalej, dopóki składu nie ma", stan.probyPobrania === 4, "prób: " + stan.probyPobrania);
}
{
  // Sklad juz jest — pytanie o niego byloby transferem po nic, a przy podmianie ryzykiem.
  const { stan, wywolaj } = zbuduj({ sklad: { gospodarze: { zawodnicy: [{ nazwa: "Jan Kowalski" }] } } });
  wywolaj();
  stan.teraz += 91_000;
  wywolaj();
  spr("gdy skład już jest, nie pyta wcale", stan.probyPobrania === 0, "prób: " + stan.probyPobrania);
}
{
  // Ani adresu meczu, ani listy meczow przy klubie — nie ma gdzie szukac.
  const { stan, wywolaj } = zbuduj({ lnpUrl: "", listy: [] });
  wywolaj();
  stan.teraz += 91_000;
  wywolaj();
  spr("bez adresu meczu i bez listy w kartotece nie pyta", stan.probyPobrania === 0, "prób: " + stan.probyPobrania);
}
{
  // Sam adres listy przy klubie wystarczy — adres meczu panel sobie odnajdzie.
  const { stan, wywolaj } = zbuduj({ lnpUrl: "", listy: ["https://www.laczynaspilka.pl/kluby/x/terminarz"] });
  wywolaj();
  spr("sama lista meczów przy klubie wystarczy", stan.probyPobrania === 1, "prób: " + stan.probyPobrania);
}

console.log("\nWpiecie ponawiania w panel");
spr("nie ma już zbioru jednorazowych prób", !/probowanoLnp/.test(panel));
spr("jest zegar pilnujący składu", /function pilnujSkladuZLnp/.test(panel));
spr("zegar wisi na przerysowaniu ekranu", /\n  pilnujSkladuZLnp\(\);/.test(panel));
spr("zegar chodzi tylko na zakładce Składy",
  /const chcemy = view === "live" && liveTab === "sklady";/.test(panel));
spr("wygaszony ekran nie pyta", /if \(document\.hidden\) return;/.test(panel));
spr("wejście w mecz na zakładce Składy też próbuje",
  /render\(\);[\s\S]{0,400}if \(liveTab === "sklady"\) sprobujSkladZLnp\(\);\n}/.test(panel));
spr("próba samoczynna nie zasypuje scouta komunikatami",
  /if \(recznie\) toast\(dane\.powod/.test(panel));

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
