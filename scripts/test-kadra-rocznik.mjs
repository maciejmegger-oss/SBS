// Sprawdza ostrzezenie o roczniku kadry braniej z kartoteki.
//
// Zgloszenie ze stadionu: "Wzialem przykladowy mecz 3 ligi, a wgralo zawodnikow rocznika 2013".
// Klub ma w bazie jeden wpis, a na boisku kilka zespolow. Przy meczu mlodziezowym poznawalismy
// to po nazwie rozgrywek (CLJ U19 -> zespol "U19"), ale ta droga dziala tylko w jedna strone:
// rozgrywki mlodziezowe same sie nazywaja, seniorskie nie. Dla III ligi znacznik zespolu jest
// PUSTY, wiec kadra dwunastolatkow przechodzila bez zajaknienia.
//
// Rocznik jest sprawdzianem niezaleznym od nazewnictwa — a to wlasnie nazewnictwo tu zawiodlo.
//
// Uruchomienie:  node scripts/test-kadra-rocznik.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const panel = fs.readFileSync(new URL("../src/mobile/main.ts", import.meta.url), "utf8");
let bledy = 0;
const spr = (opis, w, dod="") => { console.log(`${w?"  OK  ":" BŁĄD "} ${opis}${w?"":"   "+dod}`); if(!w) bledy++; };

const kod = [
  panel.match(/const MLODZIEZ_WZORCE = \[[\s\S]*?\n\];/)[0],
  panel.match(/const SENIORZY_WZORCE = \[[\s\S]*?\n\];/)[0],
  panel.match(/export function kategoriaZRozgrywek[\s\S]*?\n}\n/)[0],
  panel.match(/function niezgodnyRocznik\([\s\S]*?\n}\n/)[0],
].join("\n").replace(/export /g, "");
const sprawdz = new Function(`${transformSync(kod, { loader: "ts" }).code}\nreturn niezgodnyRocznik;`)();

// Kadra z prawdziwego zrzutu: Chemik Bydgoszcz, roczniki 2012-2014.
const mlodzi = [2014, 2013, 2012, 2013, 2014, 2013, 2014, 2013, 2012, 2013, 2014]
  .map((r) => ({ birthYear: String(r) }));
const seniorzy = [1996, 1999, 2001, 2003, 1998, 2000, 2002, 1997, 2004, 1995, 2001]
  .map((r) => ({ birthYear: String(r) }));

const mecz = (rozgrywki, kategoria = "", date = "2026-09-20") =>
  ({ rozgrywki, kategoria, date, match: "Chemik Bydgoszcz - KKS 1925 Kalisz" });

console.log("Mecz seniorski, kadra z kartoteki");
{
  const w = sprawdz(mlodzi, mecz("III liga, grupa 2"));
  spr("kadra roczników 2012-2014 przy III lidze — ostrzega", /kadra młodzieżowa/.test(w), JSON.stringify(w));
  spr("ostrzeżenie podaje roczniki", /2012–2014/.test(w), w);
  spr("ostrzeżenie podaje wiek", /około 13 lat/.test(w), w);

  spr("kadra seniorska przy III lidze — cisza", sprawdz(seniorzy, mecz("III liga, grupa 2")) === "");
  spr("Ekstraklasa tak samo", sprawdz(seniorzy, mecz("Ekstraklasa")) === "");
  spr("klasa okręgowa tak samo", sprawdz(seniorzy, mecz("klasa okręgowa")) === "");
}

console.log("\nCzego ostrzezenie NIE moze robic");
{
  // To jest zawodnik, po ktorego skaut przyjechal. Jeden mlody w skladzie seniorow nie jest bledem.
  const zDebiutantem = [...seniorzy.slice(0, 10), { birthYear: "2009" }];
  spr("jeden młody wśród seniorów nie wywołuje ostrzeżenia",
    sprawdz(zDebiutantem, mecz("III liga")) === "", sprawdz(zDebiutantem, mecz("III liga")));

  // Trener albo bramkarz-weteran w kadrze mlodziezowej tez nie.
  const zWeteranem = [...mlodzi.slice(0, 10), { birthYear: "1985" }];
  spr("jeden stary wśród młodzieży nie przewraca obrazu",
    /kadra młodzieżowa/.test(sprawdz(zWeteranem, mecz("III liga"))), sprawdz(zWeteranem, mecz("III liga")));
}

console.log("\nMecz mlodziezowy");
{
  spr("kadra seniorska przy CLJ U19 — ostrzega",
    /kadra seniorska/.test(sprawdz(seniorzy, mecz("CLJ U19"))), sprawdz(seniorzy, mecz("CLJ U19")));
  spr("kadra U19 przy CLJ U19 — cisza",
    sprawdz([2008, 2007, 2008, 2009, 2007, 2008].map((r) => ({ birthYear: String(r) })), mecz("CLJ U19")) === "");
  spr("kadra roczników 2013 przy A1 — cisza, bo to też młodzież",
    sprawdz(mlodzi, mecz("A1")) === "", sprawdz(mlodzi, mecz("A1")));
}

console.log("\nKiedy milczymy, bo nie wiemy");
{
  spr("nierozpoznane rozgrywki — cisza", sprawdz(mlodzi, mecz("Sparing")) === "");
  spr("za mało zawodników — cisza", sprawdz(mlodzi.slice(0, 2), mecz("III liga")) === "");
  spr("brak roczników — cisza",
    sprawdz([{}, {}, {}, {}], mecz("III liga")) === "");
  spr("brak obserwacji — cisza", sprawdz(mlodzi, undefined) === "");
  // Reczny wybor skauta ma pierwszenstwo nad nazwa rozgrywek.
  spr("ręcznie ustawiona kategoria rozstrzyga",
    sprawdz(mlodzi, mecz("Sparing", "seniorzy")) !== "", sprawdz(mlodzi, mecz("Sparing", "seniorzy")));
}

console.log("\nWpiecie w panel");
spr("ostrzeżenie pokazywane przy kadrze", /zlyRocznik \? `<p class="hint"/.test(panel));
spr("nie dubluje ostrzeżenia o zespole", /nieTenZespol \? "" : niezgodnyRocznik/.test(panel));
spr("nikt nie jest ukrywany",
  !/kadra\.filter\(\(pl\) => .*birthYear/.test(panel));

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
