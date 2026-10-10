// Sprawdza, ze przy PLANOWANIU obserwacji lista zawodnikow pokazuje tylko ludzi z tego meczu —
// oraz ze notatke przy zawodniku da sie podyktowac.
//
// Zgloszenie ze stadionu: „jak wchodzi sie i planuje mecz, tak jak teraz Chojniczanka Podhale,
// i chcesz wybrac zawodnika, ktorego jedziesz obserwowac, to wyswietlaja ci sie wszyscy zawodnicy,
// ktorzy sa wgrani. Musza sie wyswietlic tylko zawodnicy Chojniczanki w tym przypadku i Podhala".
//
// Bez tego pomylka nie daje sie zauwazyc: przy kilkuset nazwiskach obserwacja zapisuje sie na
// imiennika z innej ligi i wychodzi to dopiero przy raporcie, czyli za pozno.
//
// Uruchomienie:  node scripts/test-wybor-zawodnikow-meczu.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const panel = fs.readFileSync("src/mobile/main.ts", "utf8").split(String.fromCharCode(13)).join("");
const wspolne = fs.readFileSync("src/domain/sklad.ts", "utf8").split(String.fromCharCode(13)).join("");

let bledy = 0;
const spr = (opis, w, dod = "") => {
  console.log(`${w ? "  OK  " : " BŁĄD "} ${opis}${w ? "" : "   " + dod}`);
  if (!w) bledy++;
};

const wytnij = (nazwa, wzor) => {
  const m = panel.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

// PRAWDZIWY kod zawężania z viewNowa, prawdziwe dopasowanie klubów i prawdziwy moduł składu.
const kod = [
  wspolne.replace(/export /g, ""),
  wytnij("ZNACZNIKI_ZESPOLU", /const ZNACZNIKI_ZESPOLU[\s\S]*?\n\];/),
  wytnij("znacznikZespolu", /export function znacznikZespolu[\s\S]*?\n\}/),
  wytnij("znacznikZRozgrywek", /export function znacznikZRozgrywek[\s\S]*?\n\}/),
  wytnij("klubZNazwy", /function klubZNazwy[\s\S]*?\n    \|\| null;\n\}/),
  wytnij("druzynyZMeczu", /function druzynyZMeczu[\s\S]*?\n\}/),
  wytnij("zawodnicyDoWyboru", /function zawodnicyDoWyboru\(\)[\s\S]*?\n\}/),
  wytnij("opcjeZawodnikow", /const opcjeZawodnikow = [\s\S]*?\.join\(""\);/),
].join("\n").replace(/export /g, "");

// Podstawiamy dwie najprostsze funkcje panelu, zeby zobaczyc nie tylko pule, ale i to,
// co naprawde wchodzi do listy na ekranie.
const uruchom = (cache, planMecz, planRozgrywki = "") =>
  new Function("cache", "planMecz", "planRozgrywki", "esc", "clubName", `
    ${transformSync(kod, { loader: "ts" }).code}
    const { lista, zawezone } = zawodnicyDoWyboru();
    return { doWyboru: lista, zawezone, players: opcjeZawodnikow(lista) };
  `)(cache, planMecz, planRozgrywki, String,
     (id) => (cache.clubs.find((c) => c.id === id) || {}).name || "");

// Kartoteka jak w bazie: dwa kluby z meczu i trzeci, ktorego dzis na boisku nie ma.
const cache = {
  clubs: [
    { id: "c1", name: "Chojniczanka Chojnice" },
    { id: "c2", name: "Podhale Nowy Targ" },
    { id: "c3", name: "Wda Świecie" },
    { id: "c4", name: "Chojniczanka Chojnice U17" },
  ],
  players: [
    { id: "p1", firstName: "Jan", lastName: "Marcinio", clubId: "c1" },
    { id: "p2", firstName: "Oliwier", lastName: "Mosek", clubId: "c2" },
    { id: "p3", firstName: "Adam", lastName: "Kowal", clubId: "c3" },
    { id: "p4", firstName: "Piotr", lastName: "Nowak", clubId: null },
    { id: "p5", firstName: "Kamil", lastName: "Junior", clubId: "c4" },
  ],
};

console.log("Mecz, na ktory scout dzisiaj jedzie");
{
  const w = uruchom(cache, "Chojniczanka Chojnice - Podhale Nowy Targ", "Betclic 2 Liga");
  const kto = w.doWyboru.map((p) => p.lastName).sort();
  spr("lista zawężona", w.zawezone === true);
  spr("są obaj obserwowani", kto.includes("Marcinio") && kto.includes("Mosek"), kto.join(", "));
  spr("nie ma zawodnika z innego klubu", !kto.includes("Kowal"), kto.join(", "));
  spr("nie ma zawodnika bez klubu", !kto.includes("Nowak"), kto.join(", "));
  // Zespoly tego samego klubu to rozne druzyny — mecz 2 ligi nie jest meczem U17.
  spr("nie ma juniorów tego samego klubu", !kto.includes("Junior"), kto.join(", "));
  spr("dokładnie dwóch do wyboru", w.doWyboru.length === 2, String(w.doWyboru.length));
  // Liczy się to, co naprawdę wchodzi do listy na ekranie, nie sama pula.
  // Pierwsza pozycja to zawsze "— obserwacja meczu —", wiec nazwisk jest o jedno mniej.
  spr("na rozwijanej liście są tylko ci dwaj",
    (w.players.match(/<option/g) || []).length === 3
    && /Marcinio/.test(w.players) && /Mosek/.test(w.players) && !/Kowal/.test(w.players),
    w.players);
  spr("i jest wyjście na obserwację całego meczu",
    /<option value="">— obserwacja meczu —<\/option>/.test(w.players));
}

console.log("\nNazwa skrocona, tak jak ja pisze scout");
{
  const w = uruchom(cache, "Chojniczanka - Podhale", "Betclic 2 Liga");
  const kto = w.doWyboru.map((p) => p.lastName).sort();
  spr("skrót dopasowuje oba kluby", kto.join() === "Marcinio,Mosek", kto.join(", "));
  spr("i dalej są tylko ci dwaj", w.doWyboru.length === 2 && w.zawezone === true);
}

console.log("\nMecz mlodziezowy — rozgrywki mowia, o ktory zespol chodzi");
{
  const w = uruchom(cache, "Chojniczanka Chojnice - Podhale Nowy Targ", "CLJ U17");
  const kto = w.doWyboru.map((p) => p.lastName);
  spr("wchodzi kadra U17, nie seniorzy", kto.includes("Junior") && !kto.includes("Marcinio"), kto.join(", "));
}

console.log("\nGdy klubow nie da sie rozpoznac");
{
  // Lista pusta byłaby gorsza niż za długa: zabierałaby jedyną drogę do wskazania zawodnika.
  const w = uruchom(cache, "Jakiś Klub - Inny Klub", "");
  spr("pokazujemy całą kartotekę", w.doWyboru.length === cache.players.length);
  spr("i mówimy, że nie jest zawężona", w.zawezone === false);
}
{
  const w = uruchom(cache, "", "");
  spr("puste pole „Mecz” nie zostawia pustej listy", w.doWyboru.length === cache.players.length);
}

console.log("\nLista przelicza sie w trakcie pisania");
{
  // TU BYL BLAD, zgloszony ze stadionu: "sa wszyscy zawodnicy, a nie tylko zawodnicy
  // Chojniczanki czy Podhala". Lista powstawala RAZ, przy rysowaniu formularza — czyli gdy pole
  // "Mecz" bylo jeszcze puste. Scout wpisywal mecz, otwieral liste i widzial cala kartoteke,
  // bo nic jej od tamtej pory nie przeliczylo.
  spr("wpisanie meczu przelicza listę w miejscu",
    /if \(t\.id === "n-match"\) \{[\s\S]{0,120}odswiezListeZawodnikow\(\);/.test(panel));
  spr("rozgrywki też ją przeliczają — to inna kadra tego samego klubu",
    /if \(t\.id === "n-liga"\) \{[\s\S]{0,200}odswiezListeZawodnikow\(\);/.test(panel));
  const cialo = (panel.match(/function odswiezListeZawodnikow\(\): void \{([\s\S]*?)\n\}/) || [])[1];
  spr("przeliczenie nie przerysowuje ekranu (kursor zostaje w polu)",
    !!cialo && !/render\(\)/.test(cialo), String(cialo).slice(0, 80));
  spr("wskazany zawodnik zostaje, o ile dalej jest na liście",
    /sel\.value = lista\.some\(\(p\) => p\.id === byl\) \? byl : "";/.test(panel));
  spr("podpis pod listą też się odświeża", /n-player-hint/.test(panel));
  // Formularz i przeliczenie musza liczyc TO SAMO — dwie kopie rozjada sie przy pierwszej zmianie.
  spr("jedno źródło listy dla formularza i dla przeliczenia",
    (panel.match(/zawodnicyDoWyboru\(\)/g) || []).length >= 2);
}

console.log("\nCo widzi scout");
{
  spr("lista zawodników bierze się z zawężonej puli",
    /const \{ lista: doWyboru, zawezone \} = zawodnicyDoWyboru\(\);/.test(panel)
    && /<select id="n-player">\$\{opcjeZawodnikow\(doWyboru\)\}<\/select>/.test(panel));
  spr("podpis mówi, że to zawodnicy z tego meczu", /Tylko zawodnicy drużyn z tego meczu/.test(panel));
  spr("i mówi, co zrobić, gdy klubów nie rozpoznano",
    /sprawdź, czy nazwy drużyn zgadzają się z tymi w SBS/.test(panel));
}

// ---------------------------------------------------------------------------
// DYKTOWANIE NOTATKI. „Jest jeszcze rubryka wolna, notatka, gdzie chcialbym, zeby bylo nagrywanie
// glosowe, czyli dyktowanie glosowe, zeby mi bylo latwiej, bo jak pisze, to trace czas i nie widze
// czesto, co jest na boisku."
console.log("\nNotatka przy zawodniku dyktowana glosem");
{
  spr("przy notatce stoi przycisk Dyktuj",
    /data-act="dyktuj-notatke" id="dyktuj-btn"/.test(panel));
  spr("przycisk jest obsłużony i celuje w pole notatki",
    /case "dyktuj-notatke": dictate\("notatka-zawodnika", "dyktuj-btn"\); break;/.test(panel));
  spr("dyktujemy po polsku", /rec\.lang = "pl-PL";/.test(panel));
  // Scout mowi zdaniami z przerwami — jedno rozpoznanie na zdanie zamykaloby mikrofon po kazdym.
  spr("mikrofon nie zamyka się po pierwszym zdaniu", /rec\.continuous = true;/.test(panel));
  // Dopisujemy, nie nadpisujemy: notatka powstaje przez caly mecz, w kilku podejsciach.
  spr("tekst dopisuje się do tego, co już jest",
    /ta\.value = \(ta\.value \? ta\.value\.trim\(\) \+ " " : ""\) \+ tekst\.trim\(\);/.test(panel));
  // Dyktowanie konczy sie czesto razem z odlozeniem telefonu — wtedy nikt juz niczego nie kliknie.
  spr("podyktowana notatka od razu idzie do zapisu",
    /if \(poleId === "notatka-zawodnika"\) \{[\s\S]{0,200}saveObservation\(dane\.obs\);/.test(panel));
  // Rozpoznawanie mowy w przegladarce wysyla dzwiek na serwer producenta.
  spr("bez sieci mówi wprost, że trzeba pisać", /Dyktowanie wymaga sieci/.test(panel));
  spr("przeglądarka bez rozpoznawania mowy nie zostaje bez odpowiedzi",
    /nie obsługuje dyktowania/.test(panel));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy ? 1 : 0);
