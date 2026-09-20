// Sprawdza pobieranie skladu od licencjonowanego dostawcy — api/sklady-api-football.js.
//
// PO CO TA DROGA. Czytanie skladow ze stron okazalo sie zamkniete i wiemy to z pomiaru: LNP
// wysyla serwerowi sam szkielet strony (25 560 znakow, zero sladow danych, zero adresow) i robi
// to identycznie dla robota i dla przegladarki. Serwisy wynikowe maja sklady, ale zabraniaja
// pobierania, a imie skrocone do inicjalu ("Nowak B.") nie wiaze sie z kartoteka.
//
// Dostawce podstawiamy — jego API jest z tego srodowiska nieosiagalne tak samo jak wszystko inne.
// Sprawdzamy PRAWDZIWY kod punktu dostepowego, nie jego odpis.
//
// Uruchomienie:  node scripts/test-sklady-dostawca.mjs
import fs from "node:fs";

process.env.FOOTBALL_API_KEY = "klucz-testowy";
const handler = (await import("../api/sklady-api-football.js")).default;

let bledy = 0;
const spr = (opis, w, dod="") => { console.log(`${w?"  OK  ":" BŁĄD "} ${opis}${w?"":"   "+dod}`); if(!w) bledy++; };

const zawodnik = (nazwa, numer, pos) => ({ player: { id: numer, name: nazwa, number: numer, pos } });
const DRUZYNY = { response: [{ team: { id: 333, name: "Rakow Czestochowa" } }] };
const MECZE = { response: [{
  fixture: { id: 9911, date: "2026-09-15T17:00:00+00:00" },
  teams: { home: { name: "Rakow Czestochowa" }, away: { name: "Zaglebie Lubin" } },
}] };
const SKLADY = { response: [
  { team: { id: 333, name: "Rakow Czestochowa" },
    startXI: [zawodnik("Kacper Trelowski", 1, "G"), zawodnik("Zoran Arsenic", 5, "D")],
    substitutes: [zawodnik("Oskar Repka", 30, "M")] },
  { team: { id: 444, name: "Zaglebie Lubin" },
    startXI: [zawodnik("Konrad Forenc", 12, "G"), zawodnik("Filip Stojilkovic", 9, "F")],
    substitutes: [] },
] };

let pytania = [];
let odpowiedzi = {};
globalThis.fetch = async (u, opcje) => {
  const adr = String(u);
  pytania.push(adr.replace("https://v3.football.api-sports.io", ""));
  // Klucz MUSI isc naglowkiem, nigdy w adresie — inaczej wyciekalby do dziennikow po drodze.
  if (adr.includes("key=")) return new Response(JSON.stringify({ errors: ["klucz w adresie"] }), { status: 200 });
  for (const [fragment, dane] of Object.entries(odpowiedzi)) {
    if (adr.includes(fragment)) {
      return new Response(JSON.stringify(dane), { status: 200, headers: { "content-type": "application/json" } });
    }
  }
  return new Response(JSON.stringify({ response: [] }), { status: 200 });
};

const odp = () => { const o = { kod: 0, tresc: null };
  return { status(c){ o.kod=c; return this; }, json(t){ o.tresc=t; return o; }, setHeader(){ return this; }, _o:o }; };
async function wywolaj(query) {
  pytania = [];
  const r = odp();
  await handler({ query }, r);
  return r._o;
}

const mecz = { home: "Raków Częstochowa", away: "Zagłębie Lubin", date: "2026-09-15" };

console.log("Sklad od dostawcy");
{
  odpowiedzi = { "/teams?search=": DRUZYNY, "/fixtures?team=": MECZE, "/fixtures/lineups": SKLADY };
  const { kod, tresc } = await wywolaj(mecz);
  spr("odpowiedź 200", kod === 200, "kod " + kod);
  spr("gospodarze wczytani", tresc.gospodarze?.zawodnicy?.length === 3, JSON.stringify(tresc).slice(0, 200));
  spr("goście wczytani", tresc.goscie?.zawodnicy?.length === 2);
  // Nazwa bez ogonkow po stronie dostawcy, z ogonkami w kartotece — dopasowanie idzie po slowach.
  spr("nazwa bez ogonków dopasowana do nazwy z obserwacji",
    /Rakow/.test(tresc.gospodarze?.nazwa || ""), tresc.gospodarze?.nazwa);
  const gk = tresc.gospodarze.zawodnicy.find((z) => /Trelowski/.test(z.nazwa));
  spr("bramkarz rozpoznany po pozycji", gk?.bramkarz === true, JSON.stringify(gk));
  spr("numer koszulki zachowany", gk?.numer === "1", JSON.stringify(gk));
  const rez = tresc.gospodarze.zawodnicy.find((z) => /Repka/.test(z.nazwa));
  spr("rezerwowi oznaczeni", rez?.rezerwa === true, JSON.stringify(rez));
  spr("pierwszy skład nie jest rezerwą", gk?.rezerwa === false);
  spr("klucz idzie nagłówkiem, nie w adresie", !pytania.some((p) => /key=/i.test(p)), JSON.stringify(pytania));
}

console.log("\nKiedy dostawca nic nie da — i jak to nazywamy");
{
  // BRAK POKRYCIA to nie to samo co BRAK MECZU. Dostawca nie sprzedaje CLJ ani nizszych lig,
  // a scout musi wiedziec, czy ma czekac, czy wkleic recznie.
  odpowiedzi = { "/teams?search=": { response: [] } };
  const { tresc } = await wywolaj({ home: "Chemik Bydgoszcz", away: "KKS 1925 Kalisz", date: "2026-09-20" });
  spr("nieznana drużyna nazwana wprost", /nie zna drużyny/.test(tresc.powod || ""), tresc.powod);
  spr("i podpowiada, że to może być niższa liga", /niższa liga|młodzieżowe/.test(tresc.powod || ""), tresc.powod);
  spr("nie udaje, że coś znalazł", tresc.gospodarze === null);
}
{
  odpowiedzi = { "/teams?search=": DRUZYNY, "/fixtures?team=": { response: [] } };
  const { tresc } = await wywolaj(mecz);
  spr("zna drużynę, ale nie ma meczu — mówi o planie", /nie ma w twoim planie/.test(tresc.powod || ""), tresc.powod);
}
{
  // "Jeszcze nie ogloszono" to zupelnie co innego niz "nigdy nie bedzie" — tu czekanie POMAGA.
  odpowiedzi = { "/teams?search=": DRUZYNY, "/fixtures?team=": MECZE, "/fixtures/lineups": { response: [] } };
  const { tresc } = await wywolaj(mecz);
  spr("skład jeszcze nieogłoszony — mówi, żeby spróbować później",
    /jeszcze nie ogłoszono/.test(tresc.powod || ""), tresc.powod);
  spr("i podaje, kiedy się pojawia", /godzinę przed/.test(tresc.powod || ""), tresc.powod);
}
{
  odpowiedzi = { "/teams?search=": { errors: { token: "zly klucz" } } };
  const { tresc } = await wywolaj(mecz);
  spr("błąd dostawcy przekazany, nie połknięty", /zgłosił błąd/.test(tresc.powod || ""), tresc.powod);
}
{
  const { kod, tresc } = await wywolaj({ home: "A", away: "B", date: "wczoraj" });
  spr("zła data odrzucona", kod === 400 && /RRRR-MM-DD/.test(tresc.error || ""), JSON.stringify(tresc));
}

console.log("\nWpiecie w obie aplikacje");
{
  // Panel mobilny dostawcy NIE wola — automat pobierania zostal w nim cofniety na zyczenie
  // skauta. Zostaje wklejanie recznie, a pobieranie dzieje sie w systemie na komputerze.
  const panel = fs.readFileSync("src/mobile/main.ts", "utf8");
  spr("panel nie pobiera składu sam", !/sklady-api-football|lnp-sklady/.test(panel));

  const app = fs.readFileSync("src/main.ts", "utf8");
  spr("okno na komputerze ma przycisk", /data-x="dostawca"/.test(app));
  spr("przycisk jest podpięty", /przyciskDostawcy\.onclick = wczytajOdDostawcy/.test(app));
  spr("skład od dostawcy ma własne źródło", /zrodlo: 'dostawca'/.test(app));
  spr("bez daty nie pytamy", /bez niej dostawca nie rozpozna meczu/.test(app));
}
{
  const kod = fs.readFileSync("api/sklady-api-football.js", "utf8");
  spr("klucz czytany tylko ze zmiennej środowiskowej",
    /process\.env\.FOOTBALL_API_KEY/.test(kod) && !/key=\$\{|key=" \+/.test(kod));
  spr("brak klucza powiedziany wprost", /brakKlucza: true/.test(kod));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
