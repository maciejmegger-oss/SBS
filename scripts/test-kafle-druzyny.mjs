// Sprawdza panel do tagowania CALEJ DRUZYNY — kafle, grupy i to, ze jedno dotkniecie wystarczy.
//
// Wczesniej staly tu kafle ZAWODNIKA (drybling, gra glowa, ustawienie), przeniesione zywcem
// z panelu indywidualnego. Przy druzynie nie znaczyly nic: "drybling Lecha" to nie jest zdanie,
// ktore da sie potem policzyc. A to wlasnie ten panel widac przy obserwacji calego meczu, czyli
// przez wiekszosc pracy skauta.
//
// Potem przyszly trzy poprawki ze stadionu, w trakcie meczu:
//   • "udane, nieudane — to calkiem usunac" (drugie dotkniecie przy kazdej akcji),
//   • "nie out, tylko A jak Adam, U jak Urszula, T jak Tomasz" — po polsku AUT,
//   • "rzut rozny obrona musi byc, rzut rozny atak, rzut wolny obrona, rzut wolny atak".
//
// Uruchomienie:  node scripts/test-kafle-druzyny.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const panel = fs.readFileSync("src/mobile/main.ts", "utf8");
const style = fs.readFileSync("src/mobile/style.css", "utf8");
let bledy = 0;
const spr = (opis, w, dod="") => { console.log(`${w?"  OK  ":" BŁĄD "} ${opis}${w?"":"   "+dod}`); if(!w) bledy++; };

// Prawdziwa definicja kafli, nie jej odpis.
const kod = panel.match(/const EVENT_TAGS = \[[\s\S]*?\n\] as const;/)[0];
const { EVENT_TAGS } =
  new Function(`${transformSync(kod, { loader: "ts" }).code}\nreturn { EVENT_TAGS };`)();

const klucze = EVENT_TAGS.map((t) => t.key);
const etykieta = (k) => (EVENT_TAGS.find((t) => t.key === k) || {}).label;
const ma = (k) => klucze.includes(k);

console.log("Kafle zamowione ze stadionu");
{
  for (const [k, opis] of [
    ["podanie", "Podanie"], ["strzal", "Strzał"], ["strata", "Strata"],
    ["atak_pola_karnego", "Atak pola karnego"], ["karny", "Karny"],
    ["interwencja_bramkarza", "Interwencja bramkarza"], ["out", "Aut"], ["spalony", "Spalony"],
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

console.log("\nPo polsku to AUT");
{
  spr("kafel podpisany „Aut”", etykieta("out") === "Aut", String(etykieta("out")));
  // Klucz zostaje stary, bo pod nim leza juz zapisane zdarzenia: zmiana rozbilaby jedna
  // statystyke na dwie, podpisane tak samo.
  spr("klucz zostaje stary, żeby nie rozbić statystyki", ma("out"));
  spr("nigdzie nie został napis „Out”", !/>Out</.test(panel) && !/label: "Out"/.test(panel));
}

console.log("\nStale fragmenty rozdzielone na atak i obrone");
{
  for (const [k, opis] of [
    ["rzut_rozny_atak", "Rzut rożny — atak"],
    ["rzut_rozny_obrona", "Rzut rożny — obrona"],
    ["rzut_wolny_atak", "Rzut wolny — atak"],
    ["rzut_wolny_obrona", "Rzut wolny — obrona"],
  ]) {
    spr(opis, ma(k), k);
    spr(`${k} — podpisany po ludzku`, etykieta(k) === opis, String(etykieta(k)));
  }
  // Sama "liczba roznych" nie mowi nic: dwadziescia bronionych i dwadziescia wykonanych
  // to dwa rozne mecze.
  spr("nie ma już zbiorczego „rzut rożny”", !ma("rzut_rozny"));
  spr("nie ma już zbiorczego „rzut wolny”", !ma("rzut_wolny"));
}

console.log("\nCzego w panelu druzyny byc nie powinno");
{
  // To sa zdarzenia ZAWODNIKA. Przy druzynie nie daja sie policzyc ani porownac.
  spr("nie ma dryblingu", !ma("drybling"));
  spr("nie ma gry głową", !ma("gra_glowa"));
  spr("nie ma ustawienia", !ma("ustawienie"));
  spr("nie ma pojedynku", !ma("pojedynek"));
}

console.log("\nJedno dotkniecie = jedno zdarzenie");
{
  // Przelacznik kosztowal drugie dotkniecie przy KAZDEJ akcji, a jego stan zostawal
  // z poprzedniego zdarzenia i po cichu przyklejal sie do nastepnego.
  spr("nie ma przełącznika udane/nieudane", !/udane/.test(panel.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "")));
  spr("nie ma stanu bieguna", !/let polarity/.test(panel));
  spr("nie ma obsługi przycisku bieguna", !/case "pol":/.test(panel));
  spr("nie ma już pytania, czy kafel jest neutralny", !/kafelNeutralny/.test(panel));
  spr("każde zdarzenie zapisuje się tak samo", /quality: 1,/.test(panel));
  const stylBezKomentarzy = style.replace(/\/\*[\s\S]*?\*\//g, "");
  spr("kolory przełącznika zniknęły z arkusza", !/--pol-plus|\.pol\.plus/.test(stylBezKomentarzy));
}

console.log("\nStary zapis zostaje czytelny");
{
  // W bazie leza zdarzenia sprzed zmiany, z minusem. Maja sie dalej otwierac i czytac tak,
  // jak je zapisano — inaczej dawne "nieudane" wpadlyby do jednego worka z udanymi.
  spr("minus na osi tylko dla dawnych zdarzeń", /<span class="sign">\$\{e\.quality === -1 \? "−" : ""\}<\/span>/.test(panel));
  spr("czerwona ramka tylko dla dawnych", /class="ev \$\{e\.quality === -1 \? "minus" : ""\}"/.test(panel));
  spr("zestawienie rozdziela dawne nieudane", /e\.label \+ \(e\.quality === -1 \? " −" : ""\)/.test(panel));
  spr("pole quality zostaje w zapisie zdarzenia", /quality: e\.quality,/.test(fs.readFileSync("src/mobile/db.ts", "utf8")));
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
  // Trzy w rzedzie: zadne slowo nie moze rozpychac kafla.
  const zaDlugie = EVENT_TAGS.filter((t) => Math.max(...t.label.split(/[\s—]+/).map((w) => w.length)) > 14);
  spr("żadne słowo nie rozpycha kafla", zaDlugie.length === 0, zaDlugie.map((t) => t.label).join("; "));
}

console.log("\nWpiecie w panel");
{
  spr("siatka rysuje grupy z nagłówkami", /function siatkaKafli/.test(panel));
  // Kafle pozycyjne zostaja plaskie — dwanascie rzeczy jednej pozycji nie ma czego dzielic.
  // Nad nimi stoi jeden podpis, z jakiej pozycji sa.
  spr("kafle pozycyjne zostają płaskie",
    /if \(!grupy\.length\) return `\s*\n\s*<div class="label"[^\n]*Kafle pozycyjne[\s\S]{0,120}<div class="tags">/.test(panel));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
