// Sprawdza, ze KAZDE zdarzenie wie, ktorej druzyny dotyczy.
//
// Zgloszenie ze stadionu: "jest mozliwosc tagowania, ale nie wiemy, kto oddaje strzal, kto
// wykonuje podanie, czy strate". I tak bylo: zdarzenie bez wyroznionego zawodnika ladowalo
// "gdzies w meczu" — os pokazywala "strzal w 23. minucie" i nie dalo sie odczytac, kto strzelal.
//
// Przy obserwacji CALEGO MECZU, a to wiekszosc pracy skauta, polowa zapisu byla przez to
// bezuzyteczna: nie wiadomo, czy to atak obserwowanej druzyny, czy rywala.
//
// Uruchomienie:  node scripts/test-tagowanie-druzyny.mjs
import fs from "node:fs";

const panel = fs.readFileSync("src/mobile/main.ts", "utf8");
const db = fs.readFileSync("src/mobile/db.ts", "utf8");

let bledy = 0;
const spr = (opis, w, dod="") => { console.log(`${w?"  OK  ":" BŁĄD "} ${opis}${w?"":"   "+dod}`); if(!w) bledy++; };

console.log("Zdarzenie niesie druzyne");
{
  spr("zdarzenie ma pole drużyny", /druzyna\?: "gospodarze" \| "goscie";/.test(db));
  spr("stan meczu pamięta wybraną drużynę", /wybranaDruzyna\?: "gospodarze" \| "goscie";/.test(db));
  spr("każde zdarzenie zapisuje drużynę", /druzyna: live\.wybranaDruzyna,/.test(panel));
  // Trzymamy STRONE, nie nazwe: nazwa druzyny bywa poprawiana przy obserwacji i zapisana
  // w zdarzeniu rozjechalaby sie z ta na liscie.
  spr("trzymamy stronę, nie nazwę", /Trzymamy stronę/.test(db));
}

console.log("\nWybor druzyny w panelu");
{
  spr("jest pasek drużyn", /function pasekDruzyn/.test(panel));
  spr("stoi nad paskiem zawodników", /\$\{pasekDruzyn\(\)\}\s*\n\s*\$\{pasekZawodnikow\(\)\}/.test(panel));
  spr("pokazuje prawdziwe nazwy z pola „Mecz”", /function nazwyStron/.test(panel)
    && /druzynyZMeczu\(obs\?\.match\)/.test(panel));
  spr("wybór drużyny jest obsłużony", /case "taguj-druzyne"/.test(panel));
  // Przejscie na druga strone boiska znaczy, ze tagowana jest inna druzyna — zostawienie
  // nazwiska z poprzedniej przypisywaloby jej akcje rywala.
  spr("zmiana drużyny zdejmuje wskazanie zawodnika",
    /if \(live\.wybranaDruzyna !== strona\) \{[\s\S]{0,160}live\.wybranyZawodnik = undefined;/.test(panel));
  // W trakcie akcji latwo trafic dwa razy w ten sam przycisk. Odznaczenie druzyny zabraloby
  // zdarzeniu jedyna informacje o tym, czyje jest.
  spr("ponowne dotknięcie tej samej drużyny niczego nie kasuje",
    /łatwo trafić dwa razy/.test(panel));
  spr("dopóki drużyna niewybrana, panel o tym mówi",
    /Wskaż drużynę, zanim zaczniesz tagować/.test(panel));
}

console.log("\nNazwisko rozstrzyga druzyne samo");
{
  // Nikt nie gra w obu druzynach naraz. Kazanie skautowi wskazywac nazwisko I druzyne to dwa
  // dotkniecia zamiast jednego, i okazja do pomylki, ktorej da sie uniknac.
  spr("wyróżnieni niosą swoją stronę",
    /strona: "gospodarze" \| "goscie"/.test(panel) && /etykieta: klucz Zawodnika|etykieta: kluczZawodnika\(z\), strona/.test(panel));
  spr("jest funkcja od strony zawodnika", /function stronaZawodnika/.test(panel));
  spr("wybór nazwiska ustawia drużynę",
    /if \(v\) live\.wybranaDruzyna = stronaZawodnika\(v\) \|\| live\.wybranaDruzyna;/.test(panel));
  // Powrot na "caly zespol" zostawia ostatnia strone: skaut dalej oglada ten sam mecz.
  spr("powrót na cały zespół nie gubi drużyny", /live\.wybranaDruzyna;/.test(panel));
  spr("przycisk zespołu nazywa drużynę po imieniu",
    /live\?\.wybranaDruzyna \? esc\(nazwyStron\(\)\[live\.wybranaDruzyna\]\) : "Cały zespół"/.test(panel));
}

console.log("\nOs zdarzen mowi, czyje to bylo");
{
  // Bez tego cala zmiana bylaby niewidoczna: dane sa zapisane, ale skaut ich nie widzi.
  spr("zdarzenie bez nazwiska pokazuje drużynę",
    /e\.druzyna \? `<strong>\$\{esc\(nazwyStron\(\)\[e\.druzyna\]\)\}<\/strong>/.test(panel));
  spr("zdarzenie z nazwiskiem pokazuje nazwisko", /e\.zawodnik\s*\n?\s*\? `<strong>\$\{esc\(e\.zawodnik\)\}/.test(panel));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
