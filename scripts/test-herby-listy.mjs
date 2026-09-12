// Sprawdza herby klubów na liście meczów: skąd panel je bierze, kiedy je pobiera i gdzie trzyma.
//
// Uruchomienie:  node scripts/test-herby-listy.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const panel = fs.readFileSync("src/mobile/main.ts", "utf8");
const baza = fs.readFileSync("src/mobile/db.ts", "utf8");

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

// ---------------------------------------------------------------------------
// 1. CO SIĘ RYSUJE — na prawdziwym kodzie herbyMeczu, ze zmyślonymi klubami.
// ---------------------------------------------------------------------------
console.log("1. Rysowanie tarcz przy nazwie meczu");
{
  const wytnij = (wzor, nazwa) => {
    const m = panel.match(wzor);
    if (!m) { console.error(`Nie znalazłem ${nazwa} — test i kod się rozjechały.`); process.exit(1); }
    return m[0];
  };
  const kod = wytnij(/function herbyMeczu[\s\S]*?\n}\n/, "herbyMeczu");
  const js = transformSync(kod, { loader: "ts", format: "esm" }).code;

  const zbuduj = (herby, kluby) => new Function("herby", "kluby", `
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const druzynyZMeczu = (m) => { const c = String(m||"").split(/\\s[-–—]\\s/); return [c[0]?.trim()||"Gospodarze", c[1]?.trim()||"Goście"]; };
    const herbDruzyny = (nazwa) => {
      const k = kluby.find(x => x.name === nazwa);
      return k ? (herby[k.id] || k.crestUrl || "") : "";
    };
    ${js}
    return herbyMeczu;
  `)(herby, kluby);

  const kluby = [
    { id: "k1", name: "Zawisza Bydgoszcz", crestUrl: "" },
    { id: "k2", name: "Polonia Bydgoszcz", crestUrl: "https://przyklad/polonia.png" },
    { id: "k3", name: "Klub Bez Herbu", crestUrl: "" },
  ];
  const herbyMeczu = zbuduj({ k1: "data:image/png;base64,AAA" }, kluby);

  const obie = herbyMeczu("Zawisza Bydgoszcz - Polonia Bydgoszcz");
  sprawdz("dwie tarcze, gdy znamy oba kluby", (obie.match(/<img/g) || []).length === 2);
  sprawdz("obrazek z bazy idzie wprost (działa bez zasięgu)", obie.includes("data:image/png;base64,AAA"));
  sprawdz("gdy obrazka brak, wchodzi adres z kartoteki", obie.includes("https://przyklad/polonia.png"));

  const jedna = herbyMeczu("Zawisza Bydgoszcz - Klub Bez Herbu");
  sprawdz("jedna tarcza, gdy drugiego herbu nie mamy", (jedna.match(/<img/g) || []).length === 1);
  sprawdz("BEZ pustej ramki po nieznanym herbie — czytałoby się jak niewczytany obrazek",
    !/pusty/.test(jedna));

  sprawdz("nic, gdy nie znamy żadnego", herbyMeczu("Nieznany A - Nieznany B") === "");
  sprawdz("nic przy pustej nazwie meczu", herbyMeczu("") === "");
  sprawdz("nazwa klubu trafia w alt (czytniki ekranu, podpowiedź przy braku obrazka)",
    obie.includes('alt="Zawisza Bydgoszcz"'));
}

// ---------------------------------------------------------------------------
// 2. KIEDY POBIERAMY.
//
// Tu był błąd: pobranie wisiało wyłącznie przy odświeżaniu kopii, a przy zwykłym uruchomieniu
// kopia przychodzi już ze sprawdzania dostępu i start() kończył się wcześniej — więc herby nie
// pobierały się nigdy, dopóki scout sam nie dotknął logo.
// ---------------------------------------------------------------------------
console.log("\n2. Kiedy panel dobiera herby");
{
  const start = panel.match(/async function start\([\s\S]*?\n}\n/);
  sprawdz("start() istnieje", !!start);
  if (start) {
    const tresc = start[0];
    const gdzieHerby = tresc.indexOf("dobierzHerby");
    const gdzieWyjscie = tresc.indexOf("if (pobranaKopia) return");
    sprawdz("start() w ogóle dobiera herby", gdzieHerby >= 0);
    sprawdz("dobiera je PRZED wyjściem dla gotowej kopii — inaczej przy zwykłym starcie nie pobiera nigdy",
      gdzieHerby >= 0 && gdzieWyjscie >= 0 && gdzieHerby < gdzieWyjscie,
      `herby na ${gdzieHerby}, wyjście na ${gdzieWyjscie}`);
  }
  sprawdz("ręczne odświeżenie też je dobiera",
    /refreshSyncPill\(\);[\s\S]{0,200}dobierzHerby/.test(panel));
}

// ---------------------------------------------------------------------------
// 3. GDZIE TRZYMAMY. To pilnuje zdarzeń z meczu, nie wyglądu.
// ---------------------------------------------------------------------------
console.log("\n3. Gdzie leżą herby");
{
  sprawdz("herby mają WŁASNY klucz w pamięci telefonu",
    /herby:\s*"sbs-m:herby"/.test(baza));
  sprawdz("zapisują się pod swój klucz, nie do kopii bazy",
    /writeLS\(LS\.herby/.test(baza) && !/writeLS\(LS\.cache,\s*\{[\s\S]*herby/.test(baza));
  sprawdz("jest twardy limit liczby herbów", /MAKS_HERBOW/.test(baza));
  sprawdz("pobieramy tylko WSKAZANE kluby, nie całą tabelę",
    /\.in\("club_id"/.test(baza));
  sprawdz("puste odpowiedzi są zapamiętywane — inaczej pytalibyśmy w kółko",
    /for \(const id of brakuje\) mam\[id\] = "";/.test(baza));
  sprawdz("czyszczenie kopii bazy kasuje też herby",
    /removeItem\(LS\.herby\)/.test(baza));
}

// ---------------------------------------------------------------------------
// 4. CZEMU ICH NIE WIDAĆ — panel musi umieć to powiedzieć.
// ---------------------------------------------------------------------------
console.log("\n4. Powód braku herbów jest widoczny");
{
  sprawdz("panel trzyma powód", /let stanHerbow/.test(panel));
  sprawdz("odmowa dostępu do tabeli ma własny komunikat", /odmówiła dostępu do herbów/.test(panel));
  sprawdz("nierozpoznane kluby mają własny komunikat", /nie rozpoznano klubów z nazw meczów/.test(panel));
  sprawdz("brak wgranych herbów ma własny komunikat", /nie ma wgranego herbu/.test(panel));
  sprawdz("powód jest pokazany w Ustawieniach", /\$\{stanHerbow \?/.test(panel));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy ? 1 : 0);
