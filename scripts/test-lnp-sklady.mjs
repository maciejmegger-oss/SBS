// Sprawdza pobieranie skladu z LNP — punkt dostepowy api/lnp-sklady.js i jego wpiecie w panel.
//
// LNP jest nieosiagalne z tego srodowiska, wiec strone podstawiamy: HTML z danymi wpisanymi
// w skrypt, o ksztalcie takim, jaki maja strony budowane w przegladarce. Sprawdzamy PRAWDZIWY
// kod punktu dostepowego, nie jego odpis.
//
// Uruchomienie:  node scripts/test-lnp-sklady.mjs
import fs from "node:fs";
import handler from "../api/lnp-sklady.js";

const dane = {
  props: { pageProps: { match: {
    homeTeam: { name: "KORONA SA Kielce",
      lineup: [
        { firstName:"Michael", lastName:"Ameyaw", shirtNumber:19, starting:true },
        { firstName:"Wiktor", lastName:"Długosz", shirtNumber:71, starting:true },
        { firstName:"Xavier", lastName:"Dziekoński", shirtNumber:1, starting:true, position:"GK" },
        { firstName:"Patrik", lastName:"Hellebrand", shirtNumber:18, starting:true },
        { firstName:"Kamil", lastName:"Jakubczyk", shirtNumber:35, starting:true },
        { firstName:"Ondrej", lastName:"Lingr", shirtNumber:32, starting:true },
        { firstName:"Ariel", lastName:"Mosór", shirtNumber:2, starting:true },
        { firstName:"Marcel", lastName:"Pięczek", shirtNumber:6, starting:true },
        { firstName:"Martin", lastName:"Remacle", shirtNumber:8, starting:true },
        { firstName:"Slobodan", lastName:"Rubežić", shirtNumber:23, starting:true },
        { firstName:"Mariusz", lastName:"Stępiński", shirtNumber:14, starting:true },
      ] },
    awayTeam: { name: "GÓRNIK ZABRZE S.A.",
      lineup: [
        { firstName:"Maksym", lastName:"Chłań", shirtNumber:33, starting:true },
        { firstName:"Paulo Guilherme", lastName:"Goncalves Bernardo", shirtNumber:8, starting:true },
        { firstName:"Peter Federico", lastName:"Gonzalez Carmona", shirtNumber:19, starting:true },
        { firstName:"Rafał", lastName:"Janicki", shirtNumber:26, starting:true },
        { firstName:"Erik", lastName:"Janža", shirtNumber:64, starting:true },
        { firstName:"Jarosław", lastName:"Kubicki", shirtNumber:14, starting:true },
        { firstName:"Erik", lastName:"Prekop", shirtNumber:11, starting:true },
        { firstName:"Michal", lastName:"Sáček", shirtNumber:61, starting:true },
        { firstName:"Josema", lastName:"Sánchez", shirtNumber:20, starting:true },
        { firstName:"Philipp", lastName:"Schulze", shirtNumber:1, starting:true, position:"GK" },
        { firstName:"Kacper", lastName:"Urbański", shirtNumber:82, starting:true },
      ] },
  } } },
};
const html = `<!doctype html><html><body><div id="__next"></div>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(dane)}</script></body></html>`;

// Podmieniamy siec: strona LNP to nasz HTML, zadnych innych zapytan.
globalThis.fetch = async (u) => {
  if (String(u).includes("laczynaspilka.pl")) {
    return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  }
  return new Response("", { status: 404 });
};

const odp = () => { const o = { kod: 0, tresc: null };
  return { status(c){ o.kod=c; return this; }, json(t){ o.tresc=t; return o; }, setHeader(){ return this; }, _o:o }; };

async function wywolaj(query) {
  const r = odp();
  await handler({ query }, r);
  return r._o;
}

const adres = "https://www.laczynaspilka.pl/rozgrywki/mecz/123456";
let bledy = 0;
const spr = (opis, w, dod="") => { console.log(`${w?"  OK  ":" BŁĄD "} ${opis}${w?"":"   "+dod}`); if(!w) bledy++; };

{
  const { kod, tresc } = await wywolaj({ url: adres, home: "Korona Kielce", away: "Górnik Zabrze" });
  spr("odpowiedź 200", kod === 200, "kod " + kod);
  spr("gospodarze: jedenastu", tresc.gospodarze?.zawodnicy?.length === 11, JSON.stringify(tresc).slice(0,200));
  spr("goście: jedenastu", tresc.goscie?.zawodnicy?.length === 11);
  const d = tresc.gospodarze?.zawodnicy?.[0];
  spr("imię i nazwisko razem", d && /Ameyaw/.test(d.nazwa), JSON.stringify(d));
  spr("numer koszulki", d && String(d.numer) === "19", JSON.stringify(d));
  const gk = tresc.gospodarze?.zawodnicy?.find(z=>/Dziekoński/.test(z.nazwa));
  spr("bramkarz rozpoznany", !!gk && gk.bramkarz === true, JSON.stringify(gk));
  spr("nazwa z formą prawną dopasowana do nazwy z obserwacji",
    /Górnik/i.test(tresc.goscie?.nazwa || ""), tresc.goscie?.nazwa);
}
{
  const { kod, tresc } = await wywolaj({ url: "https://przyklad.pl/mecz/1", home:"A", away:"B" });
  spr("obcy adres odrzucony", kod === 400, "kod " + kod);
}
{
  const { tresc } = await wywolaj({ url: adres, home: "Nieznany Klub", away: "Inny Klub" });
  spr("nazwy nie pasują — mówimy o tym wprost", /nie zgadzają/.test(tresc.powod || ""), JSON.stringify(tresc).slice(0,160));
  spr("i pokazujemy, co strona miała", (tresc.znalezione||[]).length > 0);
}

// --- WPIĘCIE W PANEL ---
const panel = fs.readFileSync(new URL("../src/mobile/main.ts", import.meta.url), "utf8");
console.log("\nWpięcie w panel");
spr("panel woła punkt dostępowy", /\/api\/lnp-sklady\?url=/.test(panel));
spr("adres przyjmowany TYLKO z ŁNP", /laczynaspilka\\.pl\$\/i\.test\(u\.hostname\)/.test(panel));
spr("adres zapisuje się przy obserwacji", /lnpUrl: adresLnp/.test(panel));
spr("jest przycisk pobrania", /data-act="sklad-z-lnp"/.test(panel));
spr("próba samoczynna po wejściu w składy", /if \(liveTab === "sklady"\) sprobujSkladZLnp\(\);/.test(panel));
spr("samoczynnie tylko raz na obserwację", /probowanoLnp\.has\(obs\.id\)/.test(panel));
spr("samoczynnie tylko przy pustym składzie",
  /if \(STRONY\.some\(\(k\) => \(obs\.skladMeczu\?\.\[k\]\?\.zawodnicy \|\| \[\]\)\.length\)\) return;/.test(panel));
spr("podmiana wpisanego składu pyta o zgodę", /Skład z ŁNP podmieni to, co już jest wpisane/.test(panel));
spr("bez sieci nie próbujemy", /navigator\.onLine/.test(panel));

const storage = fs.readFileSync(new URL("../src/data/storage.ts", import.meta.url), "utf8");
spr("adres meczu zapisuje się w bazie (ext)", /"lnpUrl"/.test(storage));


// --- ADRES WYŁUSKANY Z TEKSTU ---
// Aplikacja ŁNP nie ma paska adresu. Jedyna droga do odnośnika to przycisk „Udostępnij", a ten
// wkleja całe zdanie, nie sam adres.
console.log("\nAdres z tekstu udostępnienia");
{
  const { transformSync } = await import("esbuild");
  const kodA = panel.match(/function adresLnp[\s\S]*?\n}\n/)[0];
  const adresLnp = new Function(`${transformSync(kodA, { loader: "ts" }).code}\nreturn adresLnp;`)();

  const adr = "https://www.laczynaspilka.pl/rozgrywki/mecz/123456";
  spr("sam adres", adresLnp(adr) === adr + "/" || adresLnp(adr) === adr, adresLnp(adr));
  spr("adres w zdaniu z udostępnienia",
    adresLnp("Korona Kielce - Górnik Zabrze, 20:30\n" + adr).includes("laczynaspilka.pl"));
  spr("adres z kropką na końcu zdania",
    adresLnp("Zobacz mecz: " + adr + ".").includes("laczynaspilka.pl"));
  spr("obcy adres odrzucony", adresLnp("https://przyklad.pl/mecz/1") === "");
  spr("tekst bez adresu", adresLnp("Korona - Górnik 20:30") === "");
  spr("pusto", adresLnp("") === "");
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
