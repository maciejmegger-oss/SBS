// Sprawdza dobór zespołu klubu do składu i dostępność wklejania składów.
//
// Uruchomienie:  node scripts/test-sklady-meczu.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const panel = fs.readFileSync("src/mobile/main.ts", "utf8");
// normKlub i slowaKlubu mieszkaja od teraz we wspolnym module — panel i system na komputerze
// czytaja sklad TYM SAMYM kodem, zeby nie rozjechaly sie jak kiedys dwie kopie zbieracza LNP.
const wspolne = fs.readFileSync("src/domain/sklad.ts", "utf8");
const wytnij = (nazwa, wzor) => {
  const m = panel.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

let bledy = 0;
const sprawdz = (opis, jest, ma) => {
  const ok = jest === ma;
  console.log(`${ok ? "  OK  " : " BŁĄD "} ${opis}${ok ? "" : `\n         jest: ${JSON.stringify(jest)}\n          ma:  ${JSON.stringify(ma)}`}`);
  if (!ok) bledy++;
};
const sprawdzWarunek = (opis, w, dodatek = "") => {
  console.log(`${w ? "  OK  " : " BŁĄD "} ${opis}${w ? "" : "   " + dodatek}`);
  if (!w) bledy++;
};

// Prawdziwy kod: znaczniki zespołu, normalizacja nazwy klubu, dobór zespołu z rozgrywek i klubu.
const kod = [
  wytnij("ZNACZNIKI_ZESPOLU + znacznikZespolu", /const ZNACZNIKI_ZESPOLU[\s\S]*?\nexport function znacznikZespolu[\s\S]*?\n}\n/)
    + "\n" + (wspolne.match(/export const normKlub[\s\S]*?\n  \.trim\(\);/) || [""])[0].replace("export ", "")
  + "\n" + (wspolne.match(/export const TOKEN_ZESPOLU[\s\S]*?TOKEN_ZESPOLU\.test\(w\)\);/) || [""])[0].replace(/export /g, ""),
  wytnij("znacznikZRozgrywek + klubZNazwy", /\/\/ ZNACZNIK ZESPOŁU Z NAZWY ROZGRYWEK[\s\S]*?\nfunction klubZNazwy[\s\S]*?\n}\n/),
].join("\n");
const js = transformSync(kod.replace(/export /g, ""), { loader: "ts", format: "esm" }).code;

const zbuduj = (kluby) => new Function("kluby", `
  const cache = { clubs: kluby };
  ${js}
  return { klubZNazwy, znacznikZRozgrywek, znacznikZespolu };
`)(kluby);

// ---------------------------------------------------------------------------
// 1. TO, CO REALNIE SIĘ ZEPSUŁO.
// Mecz CLJ U19 nazywa się "Legia Warszawa - Górnik Zabrze" — dokładnie jak mecz Ekstraklasy.
// Panel podstawiał kadrę pierwszej drużyny i scout zaznaczał nazwiska, których nie było na boisku.
// ---------------------------------------------------------------------------
console.log("1. Mecz CLJ U19 o nazwie bez rocznika");
{
  const baza = [
    { id: "s", name: "Legia Warszawa S.A." },
    { id: "u19", name: "Legia Warszawa U19" },
    { id: "u17", name: "Legia Warszawa U17" },
    { id: "g", name: "Górnik Zabrze" },
  ];
  const { klubZNazwy, znacznikZRozgrywek } = zbuduj(baza);

  sprawdz("rozgrywki CLJ U19 dają znacznik u19", znacznikZRozgrywek("CLJ U19"), "u19");
  sprawdz("z podpowiedzią u19 wchodzi drużyna U19",
    klubZNazwy("Legia Warszawa", znacznikZRozgrywek("CLJ U19")).id, "u19");
  sprawdz("z podpowiedzią u17 wchodzi drużyna U17",
    klubZNazwy("Legia Warszawa", znacznikZRozgrywek("CLJ U17")).id, "u17");
  sprawdz("bez podpowiedzi zostaje pierwszy zespół",
    klubZNazwy("Legia Warszawa", "").id, "s");
  sprawdz("Ekstraklasa nie zmienia zespołu",
    klubZNazwy("Legia Warszawa", znacznikZRozgrywek("Betclic Ekstraklasa 2026/2027")).id, "s");
}

// ---------------------------------------------------------------------------
// 2. PUŁAPKA, KTÓRA MOGŁA ZROBIĆ GORSZY BŁĄD NIŻ NAPRAWIANY.
// W nazwie ROZGRYWEK cyfry II i III znaczą poziom ligi, nie numer zespołu. Gdyby znacznik brać
// istniejącą funkcją znacznikZespolu, mecz "Betclic III liga, grupa: II" zaczałby szukać rezerw.
// ---------------------------------------------------------------------------
console.log("\n2. Numer ligi to nie numer zespołu");
{
  const { znacznikZRozgrywek, znacznikZespolu } = zbuduj([]);
  [
    "Betclic III liga 2026/2027, grupa: II",
    "Betclic I liga 2026/2027",
    "IV liga", "Klasa okręgowa", "A1", "C2", "Puchar Polski",
  ].forEach((r) => {
    sprawdz(`${r} — bez znacznika zespołu`, znacznikZRozgrywek(r), "");
  });
  // Dowód, że pułapka jest prawdziwa, a nie wyobrażona.
  sprawdzWarunek("stara funkcja faktycznie by się tu potknęła",
    znacznikZespolu("Betclic III liga 2026/2027, grupa: II") !== "",
    "gdyby zwracała pusty, ten test nie miałby sensu");
}

// ---------------------------------------------------------------------------
// 3. Nazwa drużyny ma pierwszeństwo nad rozgrywkami.
// ---------------------------------------------------------------------------
console.log("\n3. Nazwa drużyny bije rozgrywki");
{
  const baza = [
    { id: "s", name: "Arka Gdynia" },
    { id: "ii", name: "Arka Gdynia II" },
    { id: "u17", name: "Arka Gdynia U17" },
  ];
  const { klubZNazwy } = zbuduj(baza);
  sprawdz("nazwa z rocznikiem U17 trafia w U17 nawet bez podpowiedzi",
    klubZNazwy("Arka Gdynia U17", "").id, "u17");
  sprawdz("nazwa z II trafia w rezerwy", klubZNazwy("Arka II Gdynia", "").id, "ii");
  sprawdz("nazwa U17 wygrywa z podpowiedzią u19",
    klubZNazwy("Arka Gdynia U17", "u19").id, "u17");
}

// ---------------------------------------------------------------------------
// 4. Gdy właściwego zespołu nie ma w bazie — podstawiamy co jest, ale panel MUSI to powiedzieć.
// ---------------------------------------------------------------------------
console.log("\n4. Brak właściwej drużyny w bazie");
{
  const { klubZNazwy } = zbuduj([{ id: "s", name: "Legia Warszawa S.A." }]);
  sprawdz("wchodzi pierwszy zespół, bo innego nie ma",
    klubZNazwy("Legia Warszawa", "u19").id, "s");
  sprawdzWarunek("panel ostrzega, że to kadra innego zespołu",
    /nieTenZespol/.test(panel) && /To kadra innego zespołu tego klubu/.test(panel));
}

// ---------------------------------------------------------------------------
// 5. WKLEJANIE SKŁADU DOSTĘPNE ZAWSZE.
// Formularz pokazywał się wyłącznie przy OBU składach pustych, więc po wgraniu jednej drużyny
// nie było jak wkleić drugiej ani poprawić pierwszej.
// ---------------------------------------------------------------------------
console.log("\n5. Wklejanie składu po wgraniu pierwszej drużyny");
{
  const widok = wytnij("viewSklady", /function viewSklady[\s\S]*?\n}\n/);
  sprawdzWarunek("formularz otwiera się też przy niepustym składzie",
    /if \(wklejanie \|\| pusto\)/.test(widok),
    "warunek nadal wpuszcza tylko pusty skład");
  sprawdzWarunek("jest przycisk otwierający wklejanie z listy składu",
    /data-act="otworz-wklejanie"/.test(widok));
  sprawdzWarunek("z formularza da się wrócić", /data-act="zamknij-wklejanie"/.test(widok));
  sprawdzWarunek("panel mówi, że wypełnione pole PODMIENIA drużynę",
    /podmienia całą tę drużynę/.test(widok));
  sprawdzWarunek("widać, ilu zawodników już jest po każdej stronie", /w składzie \$\{ilu\(/.test(widok));

  sprawdzWarunek("kasowanie pojedynczego zawodnika nadal jest",
    /data-act="usun-zawodnika"/.test(widok));
  sprawdzWarunek("czyszczenie całej drużyny nadal jest",
    /data-act="wyczysc-sklad"/.test(widok));
  sprawdzWarunek("dopisanie z kadry klubu nadal jest", /data-act="otworz-kadre"/.test(widok));

  // Wklejenie JEDNEJ strony nie może ruszyć drugiej — składy przychodzą na raty.
  const handler = wytnij("obsluga wczytaj-sklady", /case "wczytaj-sklady": \{[\s\S]*?\n    \}/);
  sprawdzWarunek("puste pole zostawia tę drużynę bez zmian",
    /gospodarze\.length \? \{[^}]*\} : obs\.skladMeczu\?\.gospodarze/.test(handler));
  sprawdzWarunek("po wczytaniu formularz się zamyka", /wklejanie = false;/.test(handler));

  sprawdzWarunek("otwarty formularz to osobny ekran dla przewijania",
    /wklejanie \? "wklej" : ""/.test(panel),
    "bez tego panel traktowałby go jak ten sam ekran");
}


// ---------------------------------------------------------------------------
// 6. WKLEJKA SKŁADU PROSTO Z ŁNP.
// ŁNP pokazuje składy PRZED meczem — potwierdzone zrzutem na 10 minut przed gwizdkiem.
// Numer stoi we własnym wierszu nad nazwiskiem, a między zawodnikami trafiają się litery
// B (bramkarz) i K (kapitan). Do tego nagłówek klubu w środku i menu na dole ekranu.
// ---------------------------------------------------------------------------
console.log("\n6. Wklejka składu z ŁNP");
{
  // Caly wspolny modul — odczyt skladu mieszka tam w jednym kawalku, wiec nie ma sensu
  // wycinac go po kawalku i pilnowac, czy wyciecia nadazaja za kodem.
  const kodP = wspolne;
  const jsP = transformSync(kodP.replace(/export /g, ""), { loader: "ts", format: "esm" }).code;
  const parsujSklad = new Function(`${jsP}\nreturn parsujSklad;`)();

  const zLnp = [
    "Składy", "Szczegóły", "Relacja", "Statystyki",
    "KORONA SA Kielce", "Skład wyjściowy",
    "19", "Michael Ameyaw", "71", "Wiktor Długosz",
    "1", "Xavier Dziekoński", "B",
    "18", "Patrik Hellebrand", "35", "Kamil Jakubczyk", "32", "Ondrej Lingr",
    "2", "Ariel Mosór", "6", "Marcel Pięczek", "8", "Martin Remacle",
    "23", "Slobodan Rubežić", "14", "Mariusz Stępiński", "K",
    "Mecze", "Rozgrywki", "Dziś grają", "Ulubione",
  ].join("\n");

  const wynik = parsujSklad(zLnp, ["Korona Kielce", "Górnik Zabrze"]);
  sprawdz("jedenastu zawodników, nic ponadto", wynik.length, 11);
  sprawdz("numer z osobnego wiersza trafia do zawodnika", wynik[0].numer, "19");
  sprawdz("imię i nazwisko razem", wynik[0].nazwa, "Michael Ameyaw");
  sprawdzWarunek("nagłówek klubu nie wszedł jako zawodnik",
    !wynik.some((z) => /KORONA/i.test(z.nazwa)));
  sprawdzWarunek("menu z dołu ekranu nie weszło",
    !wynik.some((z) => ["Mecze", "Rozgrywki", "Dziś grają", "Ulubione"].includes(z.nazwa)));
  sprawdzWarunek("litery B i K nie stały się zawodnikami",
    !wynik.some((z) => z.nazwa.length < 3));
  sprawdzWarunek("bramkarz zachował numer 1",
    wynik.some((z) => z.nazwa === "Xavier Dziekoński" && z.numer === "1"));

  // Nazwiska czteroczłonowe — u obcokrajowców to norma, a odsiew ucinał zdania po czterech słowach.
  const dlugie = parsujSklad(["8", "Paulo Guilherme Goncalves Bernardo"].join("\n"), []);
  sprawdz("czteroczłonowe nazwisko przechodzi w całości",
    dlugie[0] && dlugie[0].nazwa, "Paulo Guilherme Goncalves Bernardo");
}


// ---------------------------------------------------------------------------
// 7. STRONA MECZU W ŁNP NA KOMPUTERZE.
// Ma trzy sekcje pod rząd: skład wyjściowy, skład rezerwowy i SZTAB — trenerzy, fizjoterapeuci
// i lekarz, wypisani dokładnie tak samo jak zawodnicy, z imieniem i nazwiskiem. Wklejenie całości
// dokładało do składu jedenaście osób z ławki trenerskiej.
// ---------------------------------------------------------------------------
console.log("\n7. Skład wyjściowy, rezerwowy i sztab");
{
  // Caly wspolny modul — odczyt skladu mieszka tam w jednym kawalku, wiec nie ma sensu
  // wycinac go po kawalku i pilnowac, czy wyciecia nadazaja za kodem.
  const kodP = wspolne;
  const jsP = transformSync(kodP.replace(/export /g, ""), { loader: "ts", format: "esm" }).code;
  const parsujSklad = new Function(`${jsP}\nreturn parsujSklad;`)();

  const zeStrony = [
    "RKS RAKÓW CZĘSTOCHOWA S.A.",
    "Skład wyjściowy", "Zawodnik",
    "Marius Balaт", "Maho Esmeli", "Wladyslaw Kaczubin",
    "Skład rezerwowy", "Zawodnik",
    "Adam Bassa", "Arwid Bearsvan", "Izak Drozberg",
    "Sztab", "Członek sztabu", "Funkcja",
    "Tomasz Kaczmarek", "Trener",
    "Łukasz Otzmek", "Pierwszy Asystent Trenera",
    "Maciej Sikorski", "Trener Bramkarzy",
    "Wojciech Kozak", "Lekarz",
    "Konrad Czopczoка", "Inne | Psycholog",
  ].join("\n");

  const wynik = parsujSklad(zeStrony, ["RKS Raków Częstochowa", "Zagłębie Lubin"]);
  const nazwiska = wynik.map((z) => z.nazwa);
  sprawdz("sześciu zawodników, bez sztabu", wynik.length, 6);
  sprawdzWarunek("trener nie wszedł do składu", !nazwiska.some((n) => /Kaczmarek/.test(n)),
    nazwiska.join(", "));
  sprawdzWarunek("trener bramkarzy nie wszedł", !nazwiska.some((n) => /Sikorski/.test(n)));
  sprawdzWarunek("lekarz nie wszedł", !nazwiska.some((n) => /Kozak/.test(n)));
  sprawdzWarunek("psycholog nie wszedł", !nazwiska.some((n) => /Czopcz/.test(n)));

  const wyjsciowy = wynik.filter((z) => z.podstawowy !== false);
  const rezerwowi = wynik.filter((z) => z.podstawowy === false);
  sprawdz("trzech w składzie wyjściowym", wyjsciowy.length, 3);
  sprawdz("trzech rezerwowych", rezerwowi.length, 3);
  sprawdzWarunek("rezerwowi to ci spod właściwego nagłówka",
    rezerwowi.every((z) => /Bassa|Bearsvan|Drozberg/.test(z.nazwa)),
    rezerwowi.map((z) => z.nazwa).join(", "));

  // Zwykła lista nazwisk, bez nagłówków, niczego nie przesądza.
  const bezNaglowkow = parsujSklad(["1 Kowalski", "4 Nowak"].join("\n"), []);
  sprawdzWarunek("bez nagłówków nie zgadujemy, kto wyszedł w pierwszym składzie",
    bezNaglowkow.every((z) => z.podstawowy === undefined));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy ? 1 : 0);
