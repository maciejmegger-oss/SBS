// Sprawdza dwie rzeczy zgloszone ze stadionu:
//   1. sklad meczowy ma byc PODZIELONY na pierwsza jedenastke i lawke rezerwowych,
//   2. z zaplanowanego meczu na komputerze ma dac sie wejsc w tagowanie na zywo.
//
// Uruchomienie:  node scripts/test-sklad-podzial.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const app = fs.readFileSync("src/main.ts", "utf8");
const panel = fs.readFileSync("src/mobile/main.ts", "utf8");
const wspolne = fs.readFileSync("src/domain/sklad.ts", "utf8");

let bledy = 0;
const spr = (opis, w, dod="") => { console.log(`${w?"  OK  ":" BŁĄD "} ${opis}${w?"":"   "+dod}`); if(!w) bledy++; };

// --- 1. PIERWSZY SKLAD KONTRA LAWKA ---
//
// Sklad meczowy to dwie rozne rzeczy: jedenastu, ktorzy zaczynaja, i rezerwowi, ktorzy moga wejsc.
// Jedna wspolna lista zrownywala ich ze soba, a przy kadrze z bazy SBS (caly klub) znaczylo to
// piecdziesiat nazwisk bez zadnego podzialu.
console.log("Pierwszy sklad kontra lawka — dane");
{
  const js = transformSync(wspolne.replace(/export /g, ""), { loader: "ts", format: "esm" }).code;
  const { parsujSklad } = new Function(`${js}\nreturn { parsujSklad };`)();

  const zeStrony = ["Skład wyjściowy", "1", "Marcin Kowalski", "4", "Adam Nowak",
                    "Skład rezerwowych", "12", "Jakub Zieliński", "18", "Piotr Nowicki"].join("\n");
  const w = parsujSklad(zeStrony, []);
  spr("rezerwowi oznaczeni", w.filter((z) => z.podstawowy === false).length === 2, JSON.stringify(w));
  spr("pierwszy skład NIE jest oznaczany na siłę",
    w.filter((z) => z.podstawowy === undefined).length === 2, JSON.stringify(w));
  // To rozroznienie jest celowe: "nie wiadomo" i "na pewno w pierwszym skladzie" to dwie rozne
  // rzeczy, a widac je potem w raporcie.
  spr("nikt nie dostaje podstawowy: true", !w.some((z) => z.podstawowy === true));
}

console.log("\nPierwszy sklad kontra lawka — okno na komputerze");
{
  spr("kolumna dzieli zawodników na dwie grupy",
    /const pierwszy = wiersze\.filter\(x=>x\.z\.podstawowy !== false\)/.test(app)
    && /const lawka = wiersze\.filter\(x=>x\.z\.podstawowy === false\)/.test(app));
  spr("obie grupy mają nagłówek z liczbą",
    /sekcja\('Pierwszy skład', pierwszy, true\) \+ sekcja\('Ławka rezerwowych', lawka, false\)/.test(app));
  spr("da się przesunąć zawodnika między nimi", /class="obs-lawka"/.test(app));
  spr("przesunięcie jest obsłużone", /querySelectorAll\('\.obs-lawka'\)/.test(app));
  // Powrot do skladu KASUJE pole zamiast stawiac true — inaczej "nie wiadomo" znikneloby
  // na zawsze po jednym przypadkowym klikniecu.
  spr("powrót do składu kasuje pole, nie stawia true",
    /if\(z\.podstawowy === false\) delete z\.podstawowy; else z\.podstawowy = false;/.test(app));
  spr("klik nie przełącza przy okazji wyróżnienia",
    /obs-lawka[\s\S]{0,260}stopPropagation\(\)/.test(app));
}

console.log("\nPierwszy sklad kontra lawka — lista na telefonie");
{
  // Zgloszenie ze stadionu: "musimy podzielic to na pierwszy sklad i sklad rezerwowy, tak jak ja
  // wklejalem — zeby to bylo podzielone". Jedna lista dwudziestu nazwisk zrownywala ze soba
  // jedenastu, ktorzy zaczynaja, i lawke, ktora moze wejsc.
  spr("panel dzieli listę na dwie grupy",
    /const pierwszy = zIndeksem\.filter\(\(x\) => x\.z\.podstawowy !== false\);/.test(panel)
    && /const lawka = zIndeksem\.filter\(\(x\) => x\.z\.podstawowy === false\);/.test(panel));
  spr("obie grupy mają nagłówek z liczbą",
    /grupa\("Pierwszy skład", pierwszy\) \+ grupa\("Rezerwowi", lawka\)/.test(panel)
    && /\$\{podpis\} · \$\{poz\.length\}/.test(panel));
  // Gdy wklejka nic nie rozstrzygnela (skopiowal sie sam fragment listy), nie zgadujemy:
  // zostaje jedna lista bez naglowkow.
  spr("bez rozstrzygnięcia zostaje jedna lista",
    /lawka\.length\s*\n?\s*\? grupa\("Pierwszy skład"[\s\S]{0,120}: pierwszy\.map/.test(panel));
  // Indeks wedruje razem z zawodnikiem: po nim trafiaja do niego wyroznienie, numer i usuwanie.
  // Liczenie go od nowa w grupie wskazywaloby cudze nazwisko.
  spr("indeks zostaje z całej listy, nie z grupy",
    /const zIndeksem = lista\.map\(\(z, i\) => \(\{ z, i \}\)\);/.test(panel)
    && /poz\.map\(\(x\) => wiersz\(x\.z, x\.i\)\)/.test(panel));
  spr("da się przesunąć zawodnika strzałką", /data-act="sklad-lawka"/.test(panel)
    && /case "sklad-lawka":/.test(panel));
  spr("strzałka pokazuje kierunek", /naLawce \? "↑" : "↓"/.test(panel));
  // Ten sam zapis co na komputerze — inaczej telefon i system rozjechalyby sie przy pierwszej
  // poprawce skladu.
  spr("powrót do składu kasuje pole, nie stawia true",
    /if \(z\.podstawowy === false\) delete z\.podstawowy; else z\.podstawowy = false;/.test(panel));
  spr("przesunięcie zapisuje się od razu",
    /case "sklad-lawka":[\s\S]{0,500}saveObservation\(obs\);/.test(panel));
}

// --- 2. TAGOWANIE Z KOMPUTERA ---
//
// Otwieramy TEN SAM panel, co na telefonie, zamiast pisac druga plansze. Dwie kopie tej samej
// rzeczy rozjezdzaja sie, bo poprawki trafiaja tylko do jednej — ten projekt zaplacil juz za to
// raz, przy zbieraczu LNP.
console.log("\nTagowanie z zaplanowanego meczu");
{
  // Wejscie stoi w tym samym wierszu obserwacji, miedzy "Sklad" a "Edytuj" — zeby nie trzeba
  // bylo go szukac gdzie indziej niz reszty dzialan na meczu.
  spr("wejście w tagowanie stoi w wierszu obserwacji",
    /data-action="obs-sklad"[\s\S]{0,1400}Taguj online[\s\S]{0,200}data-action="edit-obs"/.test(app));
  spr("prowadzi do panelu, nie do drugiej planszy", /href="\/m#obs=\$\{esc\(o\.id\)\}"/.test(app));
  spr("otwiera się w nowej karcie", /href="\/m#obs=[\s\S]{0,120}target="_blank"/.test(app));

  spr("panel czyta wskazanie z adresu", /function obserwacjaZAdresu/.test(panel));
  spr("i otwiera wskazaną obserwację", /beginLive\(zAdresu\)/.test(panel));
  // Wskazanie z adresu ma pierwszenstwo przed meczem zapamietanym w telefonie: skoro ktos
  // kliknal KONKRETNY mecz, to o niego mu chodzi.
  spr("wskazanie z adresu ma pierwszeństwo przed zapamiętanym meczem",
    /live = getLive\(\);[\s\S]{0,600}const zAdresu = obserwacjaZAdresu\(\);[\s\S]{0,300}beginLive\(zAdresu\)/.test(panel));
  spr("otwiera od razu na składach", /liveTab = "sklady";/.test(panel));
  // Nie tworzymy obserwacji z adresu — obcy albo stary identyfikator ma po prostu nic nie zrobic.
  spr("nieznany identyfikator nic nie otwiera",
    /cache\.observations\.some\(\(o\) => o\.id === zAdresu\)/.test(panel));
  spr("zegar zostaje scoutowi — nie ruszamy go z adresu",
    !/beginLive\(zAdresu\)[\s\S]{0,200}running: true/.test(panel));
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
