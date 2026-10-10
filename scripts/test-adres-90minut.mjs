// Skąd prognoza bierze adres zawodnika na 90minut — i dlaczego to decyduje o całej bazie.
//
// Zgłoszenie (10.10.2026): prognoza przy każdym zawodniku pisała „dodaj link do 90minut", mimo że
// identyfikator profilu leżał już w kartotece. Zapisuje go odświeżanie statystyk klubu („⏱
// Statystyki z 90minut"), które dopasowuje nasze kartoteki do stron 90minut i chowa `m90Id`
// w custom_fields. Sprawdzany był natomiast wyłącznie ręcznie wklejony `lnpLink` — a tych jest
// garstka, bo baza powstała z protokołów ŁNP, które identyfikatorów nie niosą.
//
// Uruchomienie:  node scripts/test-adres-90minut.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8").split(String.fromCharCode(13)).join("");
const magazyn = fs.readFileSync("src/data/storage.ts", "utf8").split(String.fromCharCode(13)).join("");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

const kod = wytnij("adres90minut", /function adres90minut\(p\)\{[\s\S]*?\n\}/)
  + "\n" + wytnij("has90minutLink", /function has90minutLink\(p\)\{[^\n]*\}/);
const f = new Function(`${kod}\n return { adres90minut, has90minutLink };`)();

console.log("\n1. Adres składa się z tego, co mamy");
sprawdz("ręcznie wklejony link ma pierwszeństwo",
  f.adres90minut({ lnpLink: "http://www.90minut.pl/kariera.php?id=111", m90Id: "222" })
    === "http://www.90minut.pl/kariera.php?id=111");
sprawdz("sam identyfikator wystarczy, żeby złożyć adres",
  f.adres90minut({ m90Id: "43416" }) === "http://www.90minut.pl/kariera.php?id=43416");
sprawdz("identyfikator zapisany jako liczba też działa",
  f.adres90minut({ m90Id: 43416 }) === "http://www.90minut.pl/kariera.php?id=43416");
sprawdz("link do innego serwisu nie udaje 90minut",
  f.adres90minut({ lnpLink: "https://www.transfermarkt.pl/x/profil/spieler/5" }) === "");
sprawdz("bez niczego — pusto, bez zmyślania",
  f.adres90minut({}) === "" && f.adres90minut(null) === "");
sprawdz("śmieć w identyfikatorze nie buduje adresu",
  f.adres90minut({ m90Id: "nie wiem" }) === "" && f.adres90minut({ m90Id: "12a" }) === "");

console.log("\n2. Sprawdzanie linku i prognoza patrzą w to samo miejsce");
sprawdz("has90minutLink opiera się na adres90minut",
  /function has90minutLink\(p\)\{ return !!adres90minut\(p\); \}/.test(zrodlo));
sprawdz("zawodnik z samym identyfikatorem jest uznany za mającego profil",
  f.has90minutLink({ m90Id: "43416" }) === true);
sprawdz("przycisk pobrania historii bierze adres stąd",
  /const link = adres90minut\(p\);/.test(zrodlo));

console.log("\n3. Identyfikator faktycznie jest przechowywany");
sprawdz("m90Id wraca z bazy do aplikacji (pole w EXT_CONFIG)", /"m90Id"/.test(magazyn));
sprawdz("odświeżanie statystyk klubu go zapisuje",
  /m90Id: p\.m90Id,/.test(fs.readFileSync("api/stats-90minut.js", "utf8")));

console.log("\n4. Historia sezonów dla całego składu");
sprawdz("przebieg pomija zawodników bez identyfikatora zamiast zgadywać profil",
  /const doWziecia = sklad\.filter\(p=>adres90minut\(p\)\);/.test(zrodlo));
sprawdz("mówi wprost, ilu pominięto", /bezId \? `\\n\$\{bezId\} pominiętych/.test(zrodlo));
sprawdz("zapis całej kartoteki idzie RAZ, po przebiegu, a nie po każdym zawodniku",
  /b\.textContent = '⏳ Zapisuję\.\.\.';\n\s*const ok = await savePlayers\(\);/.test(zrodlo));
sprawdz("pobranie jednego zawodnika i całego składu idą tą samą drogą",
  (zrodlo.match(/await wczytajKariere\(p\)/g) || []).length === 2);
sprawdz("przed długim przebiegiem pytamy o zgodę", /if\(!confirm\(`Pobrać historię sezonów dla/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
