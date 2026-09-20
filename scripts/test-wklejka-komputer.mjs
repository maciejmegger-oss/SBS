// Sprawdza wgrywanie skladu przez WKLEJENIE — droga dodana w systemie na komputerze.
//
// PO CO TA DROGA. Dwie dotychczasowe maja swoje granice: kadra z bazy SBS to WSZYSCY zawodnicy
// klubu (a przy klubie prowadzonym mlodziezowo bywa to kadra zupelnie innego zespolu), protokol
// z 90minut pojawia sie dopiero PO spotkaniu. Obserwacja dzieje sie w trakcie meczu i potrzebuje
// skladu przed pierwszym gwizdkiem.
//
// Sprawdzilismy, ze z SERWERA tych stron przeczytac sie nie da: LNP wysyla serwerowi sam szkielet,
// co do bajta taki sam dla nas i dla przegladarki. Ale system na komputerze dziala W PRZEGLADARCE,
// w ktorej te strony buduja sie normalnie — wystarczy zaznaczyc sklad mysza i wkleic.
//
// Uruchomienie:  node scripts/test-wklejka-komputer.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const wspolne = fs.readFileSync("src/domain/sklad.ts", "utf8");
const js = transformSync(wspolne.replace(/export /g, ""), { loader: "ts", format: "esm" }).code;
const { parsujSklad, podzielNaDruzyny } =
  new Function(`${js}\nreturn { parsujSklad, podzielNaDruzyny };`)();

let bledy = 0;
const spr = (opis, w, dod="") => { console.log(`${w?"  OK  ":" BŁĄD "} ${opis}${w?"":"   "+dod}`); if(!w) bledy++; };

// Wklejka o ksztalcie, jaki daje zaznaczenie strony meczu w przegladarce.
const zeStrony = [
  "Lechia Gdańsk",
  "Skład wyjściowy",
  "1", "Marcin Kowalski",
  "4", "Adam Nowak",
  "7", "Paweł Wiśniewski",
  "Skład rezerwowych",
  "12", "Jakub Zieliński",
  "Sztab",
  "Trener Główny",
  "Marek Trenerski",
  "Stal Mielec",
  "Skład wyjściowy",
  "1", "Tomasz Lewandowski",
  "5", "Michał Dąbrowski",
  "Skład rezerwowych",
  "18", "Piotr Kamiński",
].join("\n");

console.log("Podzial wklejki na dwie druzyny");
{
  const w = podzielNaDruzyny(zeStrony, "Lechia Gdańsk", "Stal Mielec");
  spr("rozdzielone na dwie drużyny", w.podzielone === true);
  spr("gospodarze: czterej", w.gospodarze.length === 4, JSON.stringify(w.gospodarze));
  spr("goście: trzej", w.goscie.length === 3, JSON.stringify(w.goscie));
  spr("nikt z gości nie wpadł do gospodarzy",
    !w.gospodarze.some((z) => /Lewandowski|Dąbrowski|Kamiński/.test(z.nazwa)), JSON.stringify(w.gospodarze));
  spr("numery zachowane", w.gospodarze[0].numer === "1" && w.gospodarze[1].numer === "4",
    JSON.stringify(w.gospodarze.slice(0, 2)));
  // Sztab to nie zawodnicy — jedenastu ludzi z lawki trenerskiej potrafilo wejsc do skladu.
  spr("trener nie wszedł do składu",
    !w.gospodarze.some((z) => /Trenerski/.test(z.nazwa)), JSON.stringify(w.gospodarze));
  spr("rezerwowi oznaczeni jako niepodstawowi",
    w.gospodarze.find((z) => /Zieliński/.test(z.nazwa))?.podstawowy === false);
  spr("pierwszy skład bez tego oznaczenia",
    w.gospodarze[0].podstawowy === undefined, JSON.stringify(w.gospodarze[0]));
  spr("nazwa klubu nie jest zawodnikiem",
    !w.gospodarze.some((z) => /Lechia|Stal/.test(z.nazwa)));
}

console.log("\nCzego nie wolno zgadywac");
{
  // Podzial "na pol" bylby zgadywaniem: lawki bywaja roznej dlugosci i polowa gosci wyladowalaby
  // u gospodarzy. Lepiej oddac jedna liste i powiedziec o tym wprost.
  const jedna = ["Skład wyjściowy", "1", "Marcin Kowalski", "4", "Adam Nowak"].join("\n");
  const w = podzielNaDruzyny(jedna, "Lechia Gdańsk", "Stal Mielec");
  spr("bez nazwy drugiej drużyny NIE tniemy", w.podzielone === false);
  spr("wszyscy trafiają do jednej listy", w.gospodarze.length === 2 && w.goscie.length === 0);
}
{
  const smieci = ["Mecze", "Rozgrywki", "Dziś grają", "Ulubione", "Tabela", "12:30"].join("\n");
  spr("menu strony to nie skład", parsujSklad(smieci, []).length === 0, JSON.stringify(parsujSklad(smieci, [])));
}

console.log("\nWpiecie w okno na komputerze");
{
  const app = fs.readFileSync("src/main.ts", "utf8");
  spr("jest pole na wklejkę", /data-x="wklejka"/.test(app));
  spr("jest przycisk wczytania", /data-x="wklejka-wczytaj"/.test(app));
  spr("przycisk jest podpięty", /przyciskWklejki\.onclick = wczytajZWklejki/.test(app));
  spr("wklejka zapisuje się jako osobne źródło", /zrodlo: 'wklejka'/.test(app));
  spr("system na komputerze używa WSPÓLNEGO odczytu, nie własnej kopii",
    /import \{ parsujSklad, podzielNaDruzyny \} from "\.\/domain\/sklad"/.test(app));
  // Okno mowilo, ze przed meczem skladow "nie ma nigdzie publicznie" — a sa, na okolo godzine
  // przed gwizdkiem. Ta nieprawda kierowala skauta do kadry z bazy zamiast do skladu meczowego.
  spr("okno nie twierdzi już, że składów nie ma nigdzie",
    !/nie ma nigdzie publicznie/.test(app));
  spr("i mówi, gdzie ich szukać", /są już ogłoszone/.test(app));
}
{
  const panel = fs.readFileSync("src/mobile/main.ts", "utf8");
  spr("panel też używa wspólnego odczytu",
    /import \{ parsujSklad,[^\n]*from "\.\.\/domain\/sklad"/.test(panel));
  spr("i nie ma już własnej kopii", !/function parsujSklad/.test(panel));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
