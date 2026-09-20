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

// --- WKLEJKA Z SERWISU WYNIKOWEGO ---
//
// Tam sklady stoja OBOK SIEBIE, w dwoch kolumnach jednego wiersza, a imiona sa skrocone do
// inicjalu ("Kobylak G."). Zaznaczenie takiej tabeli mysza daje tekst, w ktorym zawodnicy obu
// druzyn stoja NA PRZEMIAN — dlatego okno ma dwa pola, po jednym na druzyne, i nie zgaduje.
console.log("\nWklejka z serwisu wynikowego");
{
  const kolumna = ["87", "Kobylak G. (B)", "30", "Czerwiński A.", "6", "Klemenz L.",
                   "27", "Nowak B. (K)"].join("\n");
  const w = parsujSklad(kolumna, ["Wisła Płock", "Cracovia"]);
  spr("skrócone imiona czytane", w.length === 4, JSON.stringify(w));
  spr("numery z osobnych wierszy przypisane", w[0].numer === "87" && w[1].numer === "30",
    JSON.stringify(w.slice(0, 2)));
  // (B) i (K) to bramkarz i kapitan — oznaczenia, nie czesc nazwiska.
  spr("oznaczenia w nawiasach odcięte", w[0].nazwa === "Kobylak G.", JSON.stringify(w[0]));
  spr("kapitan też", w[3].nazwa === "Nowak B.", JSON.stringify(w[3]));

  // A tak wyglada zaznaczenie CALEJ tabeli: obie druzyny na przemian. Bez nazwy drugiej druzyny
  // w tekscie nie ma czego dzielic — i wtedy okno mowi o tym wprost, zamiast ciac na pol.
  const przemian = ["87", "Kobylak G. (B)", "Madejski S. (B)", "13",
                    "30", "Czerwiński A.", "Piła D.", "79"].join("\n");
  const p2 = podzielNaDruzyny(przemian, "Wisła Płock", "Cracovia");
  spr("dwie kolumny w jednym polu NIE są dzielone na ślepo", p2.podzielone === false);
}

// --- NARODOWOSC TO NIE ZAWODNIK ---
//
// Prawdziwa wklejka ze stadionu: serwis wynikowy stawia przy kazdym nazwisku flage z nazwa kraju,
// a zaznaczenie mysza kopiuje ja razem z reszta. Skaut dostal DZIEWIECDZIESIECIU PIECIU
// "zawodnikow" o nazwiskach "Polska", "2Portugalia" i "10Szwecja".
console.log("\nNarodowosc to nie zawodnik");
{
  const zSerwisu = ["Polska", "Lis M.", "2Portugalia", "Pereira J.", "72Polska", "Skrzypczak M.",
                    "27Polska", "Mońka W.", "15Polska", "Gurgul M.", "10Szwecja", "Walemark P."].join("\n");
  const w = parsujSklad(zSerwisu, ["Lech Poznań", "Radomiak Radom"]);
  spr("sześciu zawodników, nie dwunastu", w.length === 6, JSON.stringify(w));
  spr("żaden kraj nie wszedł do składu",
    !w.some((z) => /Polska|Portugalia|Szwecja/.test(z.nazwa)), JSON.stringify(w.map((z) => z.nazwa)));
  // NUMER STOI PRZY FLADZE, nie przy nazwisku — wyrzucenie kraju razem z numerem zostawiloby
  // sklad bez jedynej rzeczy rozpoznawalnej z trybuny.
  spr("numer przyklejony do flagi trafia do nazwiska",
    w.find((z) => /Skrzypczak/.test(z.nazwa))?.numer === "72", JSON.stringify(w));
  spr("i tak samo przy kolejnych", w.find((z) => /Walemark/.test(z.nazwa))?.numer === "10");
  spr("pierwszy bez numeru zostaje bez numeru",
    w[0].nazwa === "Lis M." && !w[0].numer, JSON.stringify(w[0]));

  // Kraje wielowyrazowe tez, razem z ogonkami.
  const wiele = ["Wybrzeże Kości Słoniowej", "Kone I.", "Korea Południowa", "Kim M."].join("\n");
  const w2 = parsujSklad(wiele, []);
  spr("kraj z kilku słów też odsiany", w2.length === 2, JSON.stringify(w2));

  // A prawdziwe nazwisko jednoczlonowe ma przejsc — nie wolno wyciac wszystkiego, co jedno slowo.
  const jedno = ["9", "Ronaldinho", "7", "Kowalski J."].join("\n");
  spr("jednoczłonowe nazwisko przechodzi", parsujSklad(jedno, []).length === 2,
    JSON.stringify(parsujSklad(jedno, [])));
}

console.log("\nWpiecie w okno na komputerze");
{
  const app = fs.readFileSync("src/main.ts", "utf8");
  spr("jest pole na wklejkę", /data-x="wklejka"/.test(app));
  spr("i osobne pole na gości", /data-x="wklejka-goscie"/.test(app));
  spr("dwa pola = nie ma czego dzielić", /Gdy scout wype\u0142ni\u0142 OBA pola, nie ma czego dzieli\u0107/.test(app));
  spr("okno tłumaczy układ obok siebie", /obok siebie<\/strong> \(tak robi\u0105 serwisy wynikowe\)/.test(app));
  spr("jest przycisk wczytania", /data-x="wklejka-wczytaj"/.test(app));
  spr("przycisk jest podpięty", /przyciskWklejki\.onclick = wczytajZWklejki/.test(app));
  spr("wklejka zapisuje się jako osobne źródło", /zrodlo: 'wklejka'/.test(app));
  spr("system na komputerze używa WSPÓLNEGO odczytu, nie własnej kopii",
    /import \{ parsujSklad, podzielNaDruzyny \} from "\.\/domain\/sklad"/.test(app));
  // Okno mowilo, ze przed meczem skladow "nie ma nigdzie publicznie" — a sa, na okolo godzine
  // przed gwizdkiem. Ta nieprawda kierowala skauta do kadry z bazy zamiast do skladu meczowego.
  spr("okno nie twierdzi już, że składów nie ma nigdzie",
    !/nie ma nigdzie publicznie/.test(app));
  spr("i mówi, kiedy się pojawiają", /godzinę przed pierwszym gwizdkiem/.test(app));
  // Strona meczu w LNP pisze przed ogloszeniem skladow "Wroc pozniej by zobaczyc sklady druzyn".
  // Skaut odczytal to jako "tu skladow nie ma wcale" i zaczal szukac innej drogi — okno ma wiec
  // to zdanie nazwac po imieniu, zeby nikt drugi raz na tym nie stracil wieczoru.
  spr("tłumaczy komunikat, który ŁNP pokazuje przed ogłoszeniem składów",
    /Wróć później by zobaczyć składy/.test(app));
  spr("i mowi wprost, ze to znaczy JESZCZE nie", /jeszcze nie<\/strong>, a nie/.test(app));
  // Przycisk dostawcy nie obejmuje CLJ ani nizszych lig — obietnica bez tego zastrzezenia
  // wysylalaby skauta po skladny mlodziezowe tam, gdzie ich nie ma.
  spr("granica dostawcy nazwana wprost", /nie CLJ i nie niższe ligi/.test(app));
}
// --- SKLAD MUSI DAC SIE POPRAWIC ---
//
// Zgloszenie: "sklad wgrany, ale nie mozna go juz edytowac". Kadra z bazy SBS to CALY klub —
// piecdziesieciu kilku ludzi, z ktorych na boisku jest jedenastu. Bez usuwania skaut musialby
// szukac swoich wsrod wszystkich przez caly mecz, a odszukanie nazwiska na liscie piecdziesieciu
// pozycji w trakcie akcji jest niewykonalne. Lista, ktorej nie da sie przyciac, jest bezuzyteczna.
console.log("\nSklad musi dac sie poprawic");
{
  const app = fs.readFileSync("src/main.ts", "utf8");
  spr("każdy zawodnik ma przycisk usunięcia", /class="obs-usun"/.test(app));
  spr("usuwanie jest obsłużone", /querySelectorAll\('\.obs-usun'\)/.test(app));
  spr("da się dopisać zawodnika", /data-dodaj-nazwa=/.test(app) && /class="secondary obs-dodaj"/.test(app));
  spr("dopisanie jest obsłużone", /querySelectorAll\('\.obs-dodaj'\)/.test(app));
  spr("da się wyczyścić całą drużynę", /class="secondary obs-wyczysc"/.test(app));
  // Kasowanie calej druzyny zabiera ze soba wyroznienia — o to pytamy, zanim zrobimy.
  spr("czyszczenie pyta o zgodę", /Usunąć cały skład drużyny[\s\S]{0,120}confirm|confirm\(`Usunąć cały skład/.test(app));
  // Przycisk stoi WEWNATRZ <label> z polem wyboru "wyrozniony" — bez zatrzymania zdarzenia
  // usuniecie zawodnika wyrozniloby po drodze kogos innego.
  spr("klik nie przełącza przy okazji wyróżnienia",
    /obs-usun[\s\S]{0,200}stopPropagation\(\)/.test(app));
  spr("każda zmiana zapisuje się od razu",
    (app.match(/zapisz\(\);\n    \}\);/g) || []).length >= 3, "zapisow: "
      + (app.match(/zapisz\(\);\n    \}\);/g) || []).length);
}

{
  const panel = fs.readFileSync("src/mobile/main.ts", "utf8");
  spr("panel też używa wspólnego odczytu",
    /import \{ parsujSklad,[^\n]*from "\.\.\/domain\/sklad"/.test(panel));
  spr("i nie ma już własnej kopii", !/function parsujSklad/.test(panel));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
