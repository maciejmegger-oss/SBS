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

// Podmieniamy siec: strona LNP to nasz HTML, zadnych innych zapytan. Kazdy blok testu moze
// dolozyc wlasna odpowiedz pod wybranym fragmentem adresu — pierwsza pasujaca wygrywa.
const trasy = new Map();
globalThis.fetch = async (u, opcje) => {
  const adr = String(u);
  for (const [fragment, daj] of trasy) if (adr.includes(fragment)) return daj(adr, opcje);
  if (adr.includes("laczynaspilka.pl")) {
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
// Bylo tu kiedys "samoczynnie TYLKO RAZ na obserwacje" — i ten test pilnowal bledu zamiast go
// zlapac. Jedna proba na obserwacje znaczyla, ze mecz otwarty przed ogloszeniem skladu nie
// dostawal go juz nigdy. Regula wlasciwa jest odwrotna: probujemy dalej, tylko nie czesciej niz
// co poltorej minuty. Szczegoly sprawdza scripts/test-lnp-ponawianie.mjs.
spr("samoczynnie ponawiane, nie jednorazowe",
  /PRZERWA_PROB_LNP/.test(panel) && !/probowanoLnp/.test(panel));
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


// --- PRAWDZIWY KSZTAŁT ADRESU MECZU ---
//
// Caly ten plik sprawdzal dotad adres ".../mecz/123456" — ksztalt wziety z glowy. Prawdziwe
// mecze na LNP numeru nie maja: maja dlugi identyfikator z myslnikami, taki jak ponizej.
// To roznica, ktora widac dopiero na zywym odnosniku, wiec sprawdzamy go wprost — i to na
// drodze trudniejszej: strona bez danych wpisanych w HTML, gdzie identyfikator z adresu musi
// posluzyc do zlozenia adresu danych.
console.log("\nAdres meczu w postaci, jaką ŁNP naprawdę wysyła");
{
  const prawdziwy = "https://www.laczynaspilka.pl/rozgrywki/mecz/f0cf66a2-633b-4df7-a602-4cdfe2d564d9";
  const identyfikator = "f0cf66a2-633b-4df7-a602-4cdfe2d564d9";

  const { transformSync } = await import("esbuild");
  const kodA = panel.match(/function adresLnp[\s\S]*?\n}\n/)[0];
  const adresLnp = new Function(`${transformSync(kodA, { loader: "ts" }).code}\nreturn adresLnp;`)();
  spr("panel przyjmuje taki adres", adresLnp(prawdziwy).includes(identyfikator), adresLnp(prawdziwy));
  spr("przyjmuje go też ze zdania z udostępnienia",
    adresLnp("Raków Częstochowa - Zagłębie Lubin\n" + prawdziwy).includes(identyfikator));

  // Strona bez skladow w HTML — jak prawdziwa strona LNP, ktora buduje sie dopiero
  // w przegladarce. Jedyny slad to plik z kodem, a w nim poczatek adresu danych i szablon.
  const stronaPusta = `<!doctype html><html><body><div id="app"></div>`
    + `<script src="https://www.laczynaspilka.pl/assets/main-abc.js"></script></body></html>`;
  const kodStrony = `const API="https://api.laczynaspilka.pl/v1/";`
    + `const adres=API+"matches/"+idMeczu+"/lineups";`;
  let pytanoO = "";
  trasy.set("/assets/main-abc.js",
    () => new Response(kodStrony, { status: 200, headers: { "content-type": "application/javascript" } }));
  trasy.set("api.laczynaspilka.pl", (adr) => {
    pytanoO = adr;
    if (!adr.includes("/lineups")) return new Response("", { status: 404 });
    return new Response(JSON.stringify(dane), { status: 200, headers: { "content-type": "application/json" } });
  });
  trasy.set("/rozgrywki/mecz/f0cf66a2",
    () => new Response(stronaPusta, { status: 200, headers: { "content-type": "text/html" } }));

  const { kod, tresc } = await wywolaj({ url: prawdziwy, home: "Korona Kielce", away: "Górnik Zabrze" });
  spr("odpowiedź 200", kod === 200, "kod " + kod);
  spr("identyfikator z adresu trafił do zapytania o dane", pytanoO.includes(identyfikator), pytanoO || "(nie pytano)");
  spr("skład gospodarzy wczytany", tresc.gospodarze?.zawodnicy?.length === 11, JSON.stringify(tresc).slice(0, 200));
  spr("skład gości wczytany", tresc.goscie?.zawodnicy?.length === 11);
}


// --- STRONA PODANA ROBOTOWI, A TRESC PRZEGLADARCE ---
//
// Ze stadionu: strona MECZU oddala serwerowi 25 kB, cztery skrypty, zero sladow danych i zero
// adresow, pod ktore sama siega. Tak wyglada albo strona budowana dopiero w przegladarce, albo
// odpowiedz podana ROBOTOWI zamiast tresci — a przedstawialismy sie jako robot
// ("ScoutBaseSystem/1.0"). Tych dwoch rzeczy nie da sie odroznic inaczej niz zapytaniem tak,
// jak pyta przegladarka.
console.log("\nStrona podana robotowi, a tresc przegladarce");
{
  const { ostatniOdczytLnp } = await import("../api/_lnp.js");
  const skorupa = `<!doctype html><html><body><app-root></app-root>${" ".repeat(2000)}</body></html>`;
  const meczUA = "https://www.laczynaspilka.pl/rozgrywki/mecz/b61ea5cb-8f9b-4e4c-b44b-8a3b37051e0a";
  const pytania = [];
  trasy.set("/mecz/b61ea5cb", (_adr, opcje) => {
    const ua = String((opcje?.headers || {})["User-Agent"] || "");
    pytania.push(ua);
    // Robotowi sam szkielet, przegladarce pelna strone — dokladnie ta roznica, ktora badamy.
    const tresc = /ScoutBaseSystem/.test(ua) ? skorupa : html;
    return new Response(tresc, { status: 200, headers: { "content-type": "text/html" } });
  });

  const { tresc } = await wywolaj({ url: meczUA, home: "Korona Kielce", away: "Górnik Zabrze" });
  spr("zapytano dwa razy", pytania.length === 2, JSON.stringify(pytania.map((u) => u.slice(0, 30))));
  spr("najpierw pod własnym imieniem", /ScoutBaseSystem/.test(pytania[0] || ""), pytania[0]);
  spr("potem nagłówkami przeglądarki", !/ScoutBaseSystem/.test(pytania[1] || ""), pytania[1]);
  spr("skład wczytany z pełnej strony", tresc.gospodarze?.zawodnicy?.length === 11, JSON.stringify(tresc).slice(0, 160));
  spr("wynik obu prób zapamiętany", (ostatniOdczytLnp.proby || []).length === 2,
    JSON.stringify(ostatniOdczytLnp.proby));
  spr("i widać, że pierwsza dała sam szkielet",
    /sam szkielet/.test((ostatniOdczytLnp.proby || [])[0] || ""), JSON.stringify(ostatniOdczytLnp.proby));
}
{
  // Gdy pierwsza proba niesie tresc, drugiego pytania nie zadajemy — nie ma po co.
  const meczOk = "https://www.laczynaspilka.pl/rozgrywki/mecz/cccccccc-1111-4111-8111-111111111111";
  let ile = 0;
  trasy.set("/mecz/cccccccc", () => { ile++; return new Response(html, { status: 200, headers: { "content-type": "text/html" } }); });
  const { tresc } = await wywolaj({ url: meczOk, home: "Korona Kielce", away: "Górnik Zabrze" });
  spr("treść za pierwszym razem — pytamy tylko raz", ile === 1, "pytań: " + ile);
  spr("skład jest", tresc.gospodarze?.zawodnicy?.length === 11);
}
{
  // Gdy OBA pytania dadza szkielet, mowimy o tym wprost — i to jest odpowiedz "LNP nic nam nie da".
  const meczPusty = "https://www.laczynaspilka.pl/rozgrywki/mecz/dddddddd-1111-4111-8111-111111111111";
  const skorupa = `<!doctype html><html><body><app-root></app-root></body></html>`;
  trasy.set("/mecz/dddddddd", () => new Response(skorupa, { status: 200, headers: { "content-type": "text/html" } }));
  // Wczesniejszy blok podstawil adres danych, ktory oddaje sklad na KAZDE pytanie — a odczyt
  // siega tam z pamieci adresow trzymanej per domena. Bez zamkniecia tej drogi ten przypadek
  // dostawalby sklad bokiem i sprawdzalby cos zupelnie innego, niz mial.
  trasy.set("api.laczynaspilka.pl", () => new Response("", { status: 404 }));
  const { tresc } = await wywolaj({ url: meczPusty, home: "Korona Kielce", away: "Górnik Zabrze" });
  spr("mówi, że składów nie ma", /nie ma jeszcze składów/.test(tresc.powod || ""), JSON.stringify(tresc).slice(0,180));
  spr("i pokazuje wynik obu prób w komunikacie", /próby:.*\|/.test(tresc.powod || ""), tresc.powod);
  spr("obie nazwane szkieletem", (tresc.powod.match(/sam szkielet/g) || []).length === 2, tresc.powod);
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
