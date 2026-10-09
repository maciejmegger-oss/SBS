// Sprawdza wklejanie SKLADU ZE ZRZUTU EKRANU na telefonie.
//
// Zgloszenie ze stadionu: "nie moge wkleic skladow ze screena".
//
// Skladow czesto nie ma na stronie — sa tylko w aplikacji LNP, wiec nie da sie ich zaznaczyc
// mysza ani skopiowac ze strony. Zostaje zrzut ekranu i tekst wyjety z obrazka przez iPhone'a,
// a wklejenie go palcem w pole tekstowe bywa loteria: menu "Wklej" nad polem nie zawsze sie
// pokazuje, zwlaszcza w aplikacji dodanej do ekranu glownego. Przy wgrywaniu meczu ten sam
// problem rozwiazywal przycisk czytajacy schowek — przy skladach go nie bylo.
//
// Uruchomienie:  node scripts/test-sklad-ze-schowka.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const panel = fs.readFileSync("src/mobile/main.ts", "utf8");
const wspolne = fs.readFileSync("src/domain/sklad.ts", "utf8");

let bledy = 0;
const spr = (opis, w, dod = "") => {
  console.log(`${w ? "  OK  " : " BŁĄD "} ${opis}${w ? "" : "   " + dod}`);
  if (!w) bledy++;
};

// PRAWDZIWY modul podzialu, nie jego odpis.
const js = transformSync(wspolne.replace(/export /g, ""), { loader: "ts", format: "esm" }).code;
const { podzielTekst, podzielNaDruzyny, parsujSklad } =
  new Function(`${js}\nreturn { podzielTekst, podzielNaDruzyny, parsujSklad };`)();

// Tak wyglada tekst wyjety ze zrzutu strony meczu: oba sklady jeden pod drugim,
// rozdzielone nazwa klubu.
const zeZrzutu = [
  "Chojniczanka Chojnice",
  "Skład wyjściowy",
  "1", "Marcin Kowalski",
  "11", "Oliwier Mosek",
  "Skład rezerwowych",
  "12", "Jakub Zieliński",
  "Podhale Nowy Targ",
  "Skład wyjściowy",
  "1", "Piotr Nowicki",
  "7", "Adam Marcinio",
].join("\n");

console.log("Jedna wklejka z oboma skladami");
{
  const czesci = podzielTekst(zeZrzutu, "Chojniczanka Chojnice", "Podhale Nowy Targ");
  spr("tekst daje się rozdzielić na dwie drużyny", !!czesci);
  spr("gospodarze kończą się przed nazwą gościa",
    !!czesci && /Mosek/.test(czesci.gospodarze) && !/Nowicki/.test(czesci.gospodarze));
  spr("goście zaczynają się od swojej nazwy",
    !!czesci && /Podhale/.test(czesci.goscie) && /Marcinio/.test(czesci.goscie));

  // Podzial na TEKST i podzial na ZAWODNIKOW musza ciac w tym samym miejscu — inaczej panel
  // pokazalby w polu co innego, niz potem wczyta.
  const nazwy = ["Chojniczanka Chojnice", "Podhale Nowy Targ"];
  const wg = podzielNaDruzyny(zeZrzutu, "Chojniczanka Chojnice", "Podhale Nowy Targ");
  // Nazwa klubu w srodku wklejki wyglada jak nazwisko — odsiewa ja dopiero podana nazwa druzyny.
  spr("nazwa klubu nie wchodzi do składu jako zawodnik",
    !wg.goscie.some((z) => /Podhale/.test(z.nazwa)), JSON.stringify(wg.goscie));
  spr("ten sam podział co przy wczytywaniu",
    wg.gospodarze.map((z) => z.nazwa).join() === parsujSklad(czesci.gospodarze, nazwy).map((z) => z.nazwa).join()
    && wg.goscie.map((z) => z.nazwa).join() === parsujSklad(czesci.goscie, nazwy).map((z) => z.nazwa).join(),
    JSON.stringify(wg));
  spr("numery ze zrzutu nie przepadają",
    wg.gospodarze.find((z) => z.nazwa === "Oliwier Mosek")?.numer === "11",
    JSON.stringify(wg.gospodarze));
}

console.log("\nWklejka z jedna druzyna");
{
  const sama = ["1", "Marcin Kowalski", "11", "Oliwier Mosek"].join("\n");
  spr("nie ma gdzie ciąć — i nie tniemy na siłę",
    podzielTekst(sama, "Chojniczanka Chojnice", "Podhale Nowy Targ") === null);
  spr("zawodnicy i tak się rozpoznają", parsujSklad(sama, []).length === 2);
}

console.log("\nPrzycisk w panelu");
{
  spr("przy każdej drużynie stoi „Wklej ze schowka”",
    (panel.match(/data-act="wklej-sklad-ze-schowka" data-strona="(gospodarze|goscie)"/g) || []).length === 2);
  spr("przycisk jest obsłużony", /case "wklej-sklad-ze-schowka":/.test(panel));
  // Schowek czytamy TYLKO na dotkniecie — iPhone pyta wtedy o zgode raz i wprost.
  spr("schowek czytany tylko z przycisku", /navigator\.clipboard\.readText\(\)/.test(panel));
  spr("jedna wklejka z oboma składami wypełnia oba pola",
    /const czesci = podzielTekst\(t, ng, ns\);[\s\S]{0,300}poleS\.value = czesci\.goscie;/.test(panel));
  // Scout musi od razu wiedziec, czy cos w ogole sie rozpoznalo — inaczej dowie sie przy
  // "Wczytaj sklady", gdy bedzie juz po skladach.
  spr("po wklejeniu panel mówi, ile nazwisk widzi", /Rozpoznaję \$\{ile\} nazwisk/.test(panel));
  spr("i mówi wprost, gdy nie widzi żadnego", /nie widzę tu nazwisk/.test(panel));
  spr("gdy przeglądarka nie odda schowka, zostaje droga ręczna",
    /wklej palcem w pole niżej/.test(panel));
  spr("instrukcja ze zrzutu stoi nad polami", /Skład ze zrzutu ekranu/.test(panel));
  // Palec ladu je w pierwszym polu, wiec cala wklejka trafia do gospodarzy. Bez rozdzielenia
  // dwudziestu zawodnikow rywala wchodzi do gospodarzy i obserwacja jest nie do odczytania.
  spr("cała wklejka w jednym polu też się rozdziela przy wczytywaniu",
    /const obaWJednym = !tekstS\.trim\(\) \? podzielTekst\(tekstG, ngWst, nsWst\) : null;/.test(panel));
  spr("gdy drugie pole jest wypełnione, nic nie ruszamy",
    /parsujSklad\(obaWJednym \? obaWJednym\.goscie : tekstS, \[ngWst, nsWst\]\)/.test(panel));
  spr("i mówi o rozdzieleniu obu składów", /Jeśli w jednej wklejce są oba składy, rozdzielę je sam/.test(panel));
}

console.log("\nSklad przyslany linkiem");
{
  // Gdy telefon nie chce wkleic (menu "Wklej" nie wychodzi, schowek pusty po przelaczeniu
  // aplikacji), zostaje droga, ktora schowka nie potrzebuje w ogole: gotowy link.
  const kod = (panel.match(/function skladZAdresu\(\): string \{[\s\S]*?\n\}/) || [])[0];
  spr("panel czyta skład z adresu", !!kod);
  if (kod) {
    const tekst = "27\nHubert Adamczyk\nNKP Podhale Nowy Targ\n7\nŁukasz Seweryn\n";
    const b64 = Buffer.from(tekst, "utf8").toString("base64url");
    const czytaj = new Function("location",
      `${transformSync(kod, { loader: "ts" }).code}\nreturn skladZAdresu;`)({ hash: "#sklad=" + b64 });
    spr("tekst wraca z linku bez zmian", czytaj() === tekst, JSON.stringify(czytaj()));
    // Polskie znaki musza przejsc przez base64 i wrocic polskie — inaczej "Łukasz" wraca jako krzaki.
    spr("polskie znaki przeżywają drogę", /Łukasz/.test(czytaj()));
    const psuty = new Function("location",
      `${transformSync(kod, { loader: "ts" }).code}\nreturn skladZAdresu;`)({ hash: "#sklad=to-nie-jest-base64!!" });
    spr("popsuty link nie wywraca panelu", psuty() === "");
  }
  spr("treść z linku ląduje w polach, a nie w składzie",
    /const zLinku = wklejkaZAdresu \? podzielTekst\(wklejkaZAdresu, gosp, gosc\) : null;/.test(panel));
  // Wczytanie podmienia druzyne razem z wyroznieniami i ocenami, a link da sie otworzyc przypadkiem.
  spr("zatwierdza scout, nie link", /NIE WCZYTUJEMY SAMI/.test(panel));
  spr("zużyta wklejka nie wraca przy następnym otwarciu", /wklejkaZAdresu = "";/.test(panel));
  spr("bez otwartej obserwacji panel mówi, co zrobić",
    /Skład z linku czeka — otwórz obserwację/.test(panel));
}

console.log("\nZadnego slepego zaulka przy pustej kadrze");
{
  // Przy klubie spoza bazy zostawal na ekranie sam przycisk "Gotowe": scout stal przed pusta
  // strona piec minut przed gwizdkiem i nie mial stad dokad pojsc.
  spr("z pustej kadry prowadzi przycisk do wklejania",
    /data-act="wklej-sklad-stad"/.test(panel) && /case "wklej-sklad-stad":/.test(panel));
  spr("przycisk pokazuje się tylko przy pustej kadrze", /\$\{!kadra\.length \? `/.test(panel));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy ? 1 : 0);
