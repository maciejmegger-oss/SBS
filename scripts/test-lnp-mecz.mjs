// Sprawdza odnajdywanie meczu na liscie meczow LNP — api/lnp-mecz.js.
//
// Strona podstawiona, bo LNP jest z tego srodowiska nieosiagalne. Ksztalt listy wziety
// z prawdziwego zrzutu ekranu: kolumny Data / Mecz / Rozgrywki / Status, nazwy klubow
// w postaci urzedowej (RKS RAKOW CZESTOCHOWA S.A.), caly wiersz klikalny.
//
// Uruchomienie:  node scripts/test-lnp-mecz.mjs
import fs from "node:fs";
import handler from "../api/lnp-mecz.js";

const ID = {
  wisla:   "11111111-1111-4111-8111-111111111111",
  slask:   "22222222-2222-4222-8222-222222222222",
  cracovia:"33333333-3333-4333-8333-333333333333",
  jagiel:  "44444444-4444-4444-8444-444444444444",
  gornik:  "55555555-5555-4555-8555-555555555555",
  lech:    "66666666-6666-4666-8666-666666666666",
  motor:   "77777777-7777-4777-8777-777777777777",
  zaglebie:"f0cf66a2-633b-4df7-a602-4cdfe2d564d9",
  rewanz:  "99999999-9999-4999-8999-999999999999",
};

const RAKOW = "RKS RAKÓW CZĘSTOCHOWA S.A.";
const wiersze = [
  ["26.07.2026", RAKOW, "1:2", "Wisła Płock S.A.", ID.wisla],
  ["02.08.2026", "ŚLĄSK WROCŁAW", "2:1", RAKOW, ID.slask],
  ["16.08.2026", "KS Cracovia SA", "2:1", RAKOW, ID.cracovia],
  ["30.08.2026", RAKOW, "2:5", "Jagiellonia Białystok SSA", ID.jagiel],
  ["03.09.2026", RAKOW, "1:2", "GÓRNIK ZABRZE S.A.", ID.gornik],
  ["06.09.2026", "KKS LECH Poznań", "1:0", RAKOW, ID.lech],
  ["11.09.2026", RAKOW, "2:1", "Motor Lublin S.A.", ID.motor],
  ["15.09.2026", RAKOW, "2:3", "ZAGŁĘBIE LUBIN", ID.zaglebie],
  // Rewanz tej samej pary, pol roku pozniej. To on pilnuje, ze data jest warunkiem, a nie
  // podpowiedzia: bez niej ten wiersz jest dla wyszukiwania nie do odroznienia od wrzesniowego.
  ["28.02.2027", "ZAGŁĘBIE LUBIN", "0:0", RAKOW, ID.rewanz],
];

// Wariant A: caly wiersz jest odnosnikiem, data w srodku — tak sklada sie takie listy.
const stronaKlubu = `<!doctype html><html><body><table><thead><tr>
<th>Data</th><th>Mecz</th><th>Rozgrywki</th><th>Status</th></tr></thead><tbody>
${wiersze.map(([d, g, w, s, id]) => `<tr><td colspan="4">
  <a href="/rozgrywki/mecz/${id}">
    <span class="data">${d}</span>
    <span class="druzyna">${g}</span><img src="/herby/${id}.png" alt="herb">
    <span class="wynik">${w}</span>
    <img src="/herby/b-${id}.png" alt="herb"><span class="druzyna">${s}</span>
    <span class="rozgrywki">Ekstraklasa</span><span class="status">Rozegrany</span>
  </a></td></tr>`).join("\n")}
</tbody></table></body></html>`;

// Wariant B: data stoi w osobnej kolumnie PRZED odnosnikiem. Wtedy tresc wiersza nie zaczyna
// sie od odnosnika i odczyt musi zajrzec wstecz — ale nie dalej niz do poprzedniego meczu.
const stronaZDataPrzed = `<!doctype html><html><body><table><tbody>
${wiersze.map(([d, g, w, s, id]) => `<tr><td>${d}</td><td>
  <a href="https://www.laczynaspilka.pl/rozgrywki/mecz/${id}">${g} ${w} ${s}</a>
  </td><td>Ekstraklasa</td><td>Rozegrany</td></tr>`).join("\n")}
</tbody></table></body></html>`;

// Wariant C: strona buduje sie w przegladarce — zadnych odnosnikow, dane wpisane w skrypt.
const daneStrony = { props: { pageProps: { matches: wiersze.map(([d, g, w, s, id]) => ({
  id, matchDate: d.split(".").reverse().join("-"),
  homeTeam: { name: g }, awayTeam: { name: s }, score: w, competition: "Ekstraklasa",
})) } } };
const stronaZDanych = `<!doctype html><html><body><div id="__next"></div>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(daneStrony)}</script></body></html>`;

// KAZDY WARIANT POD WLASNYM ADRESEM. Pobrane strony sa zapamietywane pod adresem na dziesiec
// minut (cacheStron w api/_lnp.js), wiec podmiana tresci pod tym samym adresem nic by nie dala:
// kolejne warianty dostawaly ten sam HTML co pierwszy i nie sprawdzaly niczego.
const strony = new Map();
globalThis.fetch = async (u) => {
  const adr = String(u);
  for (const [klucz, tresc] of strony) if (adr.includes(klucz)) {
    return new Response(tresc, { status: 200, headers: { "content-type": "text/html" } });
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

const lista  = "https://www.laczynaspilka.pl/kluby/rakow/terminarz";
const listaB = "https://www.laczynaspilka.pl/kluby/rakow/terminarz-kolumny";
const listaC = "https://www.laczynaspilka.pl/kluby/rakow/terminarz-z-danych";
const listaD = "https://www.laczynaspilka.pl/rozgrywki/ekstraklasa/kolejka-7";
strony.set("/kluby/rakow/terminarz-kolumny", stronaZDataPrzed);
strony.set("/kluby/rakow/terminarz-z-danych", stronaZDanych);
strony.set("/kluby/rakow/terminarz", stronaKlubu);
let bledy = 0;
const spr = (opis, w, dod="") => { console.log(`${w?"  OK  ":" BŁĄD "} ${opis}${w?"":"   "+dod}`); if(!w) bledy++; };

console.log("Lista meczow klubu — caly wiersz klikalny");
{
  const { kod, tresc } = await wywolaj({
    url: lista, home: "Raków Częstochowa", away: "Zagłębie Lubin", date: "2026-09-15" });
  spr("odpowiedź 200", kod === 200, "kod " + kod);
  spr("znaleziony mecz to ten z 15 września",
    String(tresc.adres || "").includes(ID.zaglebie), JSON.stringify(tresc).slice(0, 240));
  spr("adres jest pełny, nie względny", /^https:\/\/www\.laczynaspilka\.pl\//.test(tresc.adres || ""), tresc.adres);
}
{
  // Nazwy z obserwacji sa krotsze niz urzedowe na stronie — i to jest zwykly przypadek,
  // nie wyjatek: w kartotece stoi "Gornik Zabrze", na LNP "GORNIK ZABRZE S.A.".
  const { tresc } = await wywolaj({
    url: lista, home: "Raków", away: "Górnik Zabrze", date: "2026-09-03" });
  spr("nazwa urzędowa dopasowana do nazwy z kartoteki",
    String(tresc.adres || "").includes(ID.gornik), JSON.stringify(tresc).slice(0, 200));
}
{
  const { tresc } = await wywolaj({
    url: lista, home: "Zagłębie Lubin", away: "Raków Częstochowa", date: "2027-02-28" });
  spr("rewanż tej samej pary to INNY mecz",
    String(tresc.adres || "").includes(ID.rewanz), JSON.stringify(tresc).slice(0, 200));
}
{
  const { tresc } = await wywolaj({
    url: lista, home: "Raków Częstochowa", away: "Zagłębie Lubin", date: "2026-09-14" });
  spr("nie ma meczu tego dnia — mówimy o tym wprost", /nie ma meczu z dnia/.test(tresc.powod || ""), JSON.stringify(tresc).slice(0,160));
  spr("adres pusty, nie zgadnięty", tresc.adres === null);
}
{
  const { tresc } = await wywolaj({
    url: lista, home: "Legia Warszawa", away: "Widzew Łódź", date: "2026-09-15" });
  spr("mecz tego dnia jest, ale innych drużyn", /nie jest meczem tych drużyn/.test(tresc.powod || ""), JSON.stringify(tresc).slice(0,160));
  spr("i pokazujemy, co tego dnia było", (tresc.kandydaci || []).length > 0);
}
{
  const { tresc } = await wywolaj({ url: lista, home: "Raków", away: "Zagłębie Lubin" });
  spr("bez daty nie szukamy wcale", /potrzebna jest data/.test(tresc.powod || ""), JSON.stringify(tresc).slice(0,160));
}
{
  const { kod } = await wywolaj({ url: "https://przyklad.pl/terminarz", home:"A", away:"B", date:"2026-09-15" });
  spr("obcy adres odrzucony", kod === 400, "kod " + kod);
}

console.log("\nLista z data w osobnej kolumnie przed odnosnikiem");
{
  const { tresc } = await wywolaj({
    url: listaB, home: "Raków Częstochowa", away: "Zagłębie Lubin", date: "2026-09-15" });
  spr("mecz znaleziony mimo daty przed odnośnikiem",
    String(tresc.adres || "").includes(ID.zaglebie), JSON.stringify(tresc).slice(0, 240));
  const b = await wywolaj({ url: listaB, home: "Raków", away: "Motor Lublin", date: "2026-09-11" });
  spr("data nie przecieka z sąsiedniego wiersza",
    String(b.tresc.adres || "").includes(ID.motor), JSON.stringify(b.tresc).slice(0, 200));
}

console.log("\nStrona bez odnosnikow — dane wpisane w skrypt");
{
  const { tresc } = await wywolaj({
    url: listaC, home: "Raków Częstochowa", away: "Zagłębie Lubin", date: "2026-09-15" });
  spr("mecz znaleziony w danych strony",
    String(tresc.adres || "").includes(ID.zaglebie), JSON.stringify(tresc).slice(0, 240));
  const b = await wywolaj({ url: listaC, home: "Cracovia", away: "Raków Częstochowa", date: "2026-08-16" });
  spr("i to właściwy, gdy gospodarzem jest przeciwnik",
    String(b.tresc.adres || "").includes(ID.cracovia), JSON.stringify(b.tresc).slice(0, 200));
}

// Wariant D: lista CALEJ KOLEJKI, nie jednego klubu. Kolumny Data / Godzina / Kolejka / Mecz /
// Status, a tego samego dnia gra kilka par naraz — wiec sama data nie wystarczy do wskazania
// wiersza i obie nazwy druzyn musza zrobic robote.
const KOLEJKA = {
  pogon:    "a1111111-1111-4111-8111-111111111111",
  wieczysta:"a2222222-2222-4222-8222-222222222222",
  jagiel:   "a3333333-3333-4333-8333-333333333333",
  cracovia: "a4444444-4444-4444-8444-444444444444",
  motor:    "a5555555-5555-4555-8555-555555555555",
  korona:   "a6666666-6666-4666-8666-666666666666",
  widzew:   "a7777777-7777-4777-8777-777777777777",
  piast:    "a8888888-8888-4888-8888-888888888888",
};
const kolejka = [
  ["07.09.2026", "20:30", "Pogoń Szczecin", "1:1", "Wisła Płock S.A.", KOLEJKA.pogon],
  ["07.09.2026", "18:00", "WIECZYSTA KRAKÓW SPÓŁKA AKCYJNA", "1:1", "ZAGŁĘBIE LUBIN", KOLEJKA.wieczysta],
  ["06.09.2026", "20:15", "Jagiellonia Białystok SSA", "2:1", "ŚLĄSK WROCŁAW", KOLEJKA.jagiel],
  ["06.09.2026", "14:45", "KS Cracovia SA", "0:1", "GÓRNIK ZABRZE S.A.", KOLEJKA.cracovia],
  ["05.09.2026", "20:15", "Motor Lublin S.A.", "2:3", "Legia Warszawa S.A.", KOLEJKA.motor],
  ["05.09.2026", "17:30", "KORONA SA Kielce", "1:1", "Wisła Kraków", KOLEJKA.korona],
  ["05.09.2026", "14:45", "Widzew Łódź SA", "0:0", "RADOMIAK S.A.", KOLEJKA.widzew],
  ["04.09.2026", "20:30", "GKS PIAST GLIWICE S.A.", "3:0", "GKS GIEKSA KATOWICE S.A.", KOLEJKA.piast],
];
const stronaKolejki = `<!doctype html><html><body><h2>Mecze</h2><table><thead><tr>
<th>Data</th><th>Godzina</th><th>Kolejka</th><th>Mecz</th><th>Status</th></tr></thead><tbody>
${kolejka.map(([d, g, gosp, w, gosc, id]) => `<tr><td colspan="5">
  <a href="/rozgrywki/mecz/${id}"><span>${d}</span><span>${g}</span><span>7</span>
  <span>${gosp}</span><img src="/h/${id}.png" alt="herb"><span>${w}</span>
  <img src="/h/b-${id}.png" alt="herb"><span>${gosc}</span><span>Rozegrany</span></a>
</td></tr>`).join("\n")}
</tbody></table><p>Godzina może ulec zmianie</p></body></html>`;
strony.set("/rozgrywki/ekstraklasa/kolejka-7", stronaKolejki);

console.log("\nLista calej kolejki — kilka meczow tego samego dnia");
{
  const a = await wywolaj({ url: listaD, home: "Korona Kielce", away: "Wisła Kraków", date: "2026-09-05" });
  spr("z trzech meczów tego dnia wybrany właściwy",
    String(a.tresc.adres || "").includes(KOLEJKA.korona), JSON.stringify(a.tresc).slice(0, 240));
  const b = await wywolaj({ url: listaD, home: "Widzew Łódź", away: "Radomiak", date: "2026-09-05" });
  spr("i drugi z tego samego dnia też",
    String(b.tresc.adres || "").includes(KOLEJKA.widzew), JSON.stringify(b.tresc).slice(0, 200));
  // "Wisla Plock" i "Wisla Krakow" tego samego dnia nie graja, ale samo slowo "Wisla" jest
  // w kolejce dwa razy — to pilnuje, ze dopasowanie idzie po CALEJ nazwie, nie po jednym slowie.
  const c = await wywolaj({ url: listaD, home: "Pogoń Szczecin", away: "Wisła Płock", date: "2026-09-07" });
  spr("dwie różne Wisły w kolejce nie mylą się ze sobą",
    String(c.tresc.adres || "").includes(KOLEJKA.pogon), JSON.stringify(c.tresc).slice(0, 200));
  // Godzina 20:30 stoi w wierszu obok daty — nie moze zostac wzieta za date.
  const d = await wywolaj({ url: listaD, home: "GKS Piast Gliwice", away: "GKS Katowice", date: "2026-09-04" });
  spr("godzina w wierszu nie jest brana za datę",
    String(d.tresc.adres || "").includes(KOLEJKA.piast), JSON.stringify(d.tresc).slice(0, 200));
}

// --- MECZ Z TEKSTU UDOSTEPNIENIA ---
//
// Aplikacja LNP nie ma przycisku "Udostepnij", serwisy wynikowe maja. Z ich tekstu bierzemy
// WYLACZNIE nazwy druzyn — czyli to, co skaut sam wklein. Pod podany adres nie zagladamy:
// sklad przychodzi z LNP, bo serwisy wynikowe skracaja imie do inicjalu i do kartoteki sie
// nie nadaja.
console.log("\nMecz z tekstu udostepnienia");
{
  const { transformSync } = await import("esbuild");
  const zrodlo = fs.readFileSync(new URL("../src/mobile/main.ts", import.meta.url), "utf8");
  const kod = [
    zrodlo.match(/const NAZWA_DRUZYNY = [^;]+;/)[0],
    zrodlo.match(/function czystaNazwa\(s: string\)[\s\S]*?\n}\n/)[0],
    zrodlo.match(/export function meczZUdostepnienia[\s\S]*?\n}\n/)[0],
  ].join("\n").replace(/export /g, "");
  const czytaj = new Function(`${transformSync(kod, { loader: "ts" }).code}\nreturn meczZUdostepnienia;`)();

  const pelne = "GKS Katowice - Cracovia 0:0\n\nWięcej informacji: https://www.flashscore.pl/r/?t=1&id=YyvF1Wam";
  const a = czytaj(pelne);
  spr("prawdziwa wklejka: gospodarz", a?.gospodarz === "GKS Katowice", JSON.stringify(a));
  spr("prawdziwa wklejka: gość bez wyniku", a?.gosc === "Cracovia", JSON.stringify(a));

  spr("myślnik długi też",
    czytaj("Wisła Płock S.A. – Jagiellonia Białystok 1:2")?.gosc === "Jagiellonia Białystok");
  spr("bez wyniku, sam mecz",
    czytaj("Zagłębie Lubin - Raków Częstochowa")?.gospodarz === "Zagłębie Lubin");
  spr("wynik w środku",
    czytaj("Korona Kielce 1:1 Wisła Kraków")?.gosc === "Wisła Kraków");
  spr("linia z nagłówkiem rozgrywek nie myli",
    czytaj("POLSKA: PKO BP Ekstraklasa - kolejka 9\nGKS Katowice - Cracovia 0:0")?.gospodarz === "GKS Katowice",
    JSON.stringify(czytaj("POLSKA: PKO BP Ekstraklasa - kolejka 9\nGKS Katowice - Cracovia 0:0")));
  // Naglowek BEZ dwukropka ma ten sam ksztalt co mecz i stoi wyzej — przed poprawka wygrywal.
  {
    const t = "Ekstraklasa - kolejka 9\nGKS Katowice - Cracovia 0:0";
    spr("nagłówek bez dwukropka przegrywa z wierszem meczu",
      czytaj(t)?.gospodarz === "GKS Katowice", JSON.stringify(czytaj(t)));
  }
  // A gdy wyniku nie ma nigdzie — mecz przed pierwszym gwizdkiem — dalej musi cos znalezc.
  spr("przed meczem, bez wyniku, dalej czyta",
    czytaj("Widzew Łódź - Raków Częstochowa")?.gosc === "Raków Częstochowa");
  spr("odnośnik w tej samej linii nie zjada nazw",
    czytaj("GKS Katowice - Cracovia https://www.flashscore.pl/r/?t=1&id=Yy")?.gosc === "Cracovia");
  spr("sam odnośnik to nie mecz", czytaj("https://www.flashscore.pl/r/?t=1&id=YyvF1Wam") === null);
  spr("sama liczba to nie mecz", czytaj("7 - 3") === null);
  spr("pusto", czytaj("") === null);
}

console.log("\nWpiecie w panel");
const panel = fs.readFileSync(new URL("../src/mobile/main.ts", import.meta.url), "utf8");
spr("panel woła punkt dostępowy", /\/api\/lnp-mecz\?url=/.test(panel));
spr("adres listy brany z kartoteki klubu", /profileLnp/.test(panel));
spr("znaleziony adres zapamiętywany przy obserwacji", /lnpUrl = /.test(panel));
spr("jest pole na udostępniony mecz", /id="udostepniony-mecz"/.test(panel));
spr("jest przycisk szukania z udostępnienia", /data-act="mecz-z-udostepnienia"/.test(panel));
// Najwazniejsze: pod udostepniony adres NIE zagladamy. Panel pobiera wylacznie z wlasnych
// punktow dostepowych, a te przyjmuja tylko laczynaspilka.pl (sprawdzane przez czyLnp).
{
  const cele = [...panel.matchAll(/fetch\(\s*["'`]([^"'`]+)/g)].map((m) => m[1]);
  const obce = cele.filter((c) => !c.startsWith("/api/") && !c.startsWith("/"));
  spr("panel nie pobiera niczego spoza własnych punktów dostępowych",
    obce.length === 0, JSON.stringify(obce));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
