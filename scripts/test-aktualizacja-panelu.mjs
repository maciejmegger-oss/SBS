// Sprawdza, ze scout MOZE wziac nowa wersje panelu, kiedy chce.
//
// Ta usterka kosztowala w tym projekcie kilka dni, dwa razy. Wdrozona poprawka nie docierala na
// telefon, skaut zglaszal jako blad cos, co bylo juz naprawione, a diagnoza szla w zla strone —
// bo z ekranu nie da sie poznac, na ktorej wersji sie pracuje.
//
// Sprzatanie pamieci i przeladowanie (wymusAktualizacje) dalo sie dotad uruchomic WYLACZNIE
// paskiem "Jest nowsza wersja", ktory pokazuje sie sam i tylko wtedy, gdy pytanie o wersje sie
// powiodlo I wykrylo roznice. Gdy pytanie nie doszlo, gdy pasek mignal niezauwazony albo gdy
// wdrozenie skonczylo sie minute po sprawdzeniu — nie bylo ZADNEGO sposobu.
//
// Uruchomienie:  node scripts/test-aktualizacja-panelu.mjs
import fs from "node:fs";

const panel = fs.readFileSync(new URL("../src/mobile/main.ts", import.meta.url), "utf8");
let bledy = 0;
const spr = (opis, w, dod="") => { console.log(`${w?"  OK  ":" BŁĄD "} ${opis}${w?"":"   "+dod}`); if(!w) bledy++; };

console.log("Wziecie nowej wersji na zadanie");
spr("jest przycisk pobrania najnowszej wersji",
  /data-act="wczytaj-wersje">Pobierz najnowszą wersję panelu</.test(panel));
spr("przycisk stoi w Ustawieniach, obok sprawdzenia wersji",
  /data-act="sprawdz-wersje"[\s\S]{0,900}data-act="wczytaj-wersje">Pobierz/.test(panel));
spr("dotknięcie czyści pamięć i przeładowuje",
  /case "wczytaj-wersje":[\s\S]{0,200}wymusAktualizacje\(\)/.test(panel));

console.log("\nCzego wymusAktualizacje musi dotknac");
{
  const kod = panel.match(/async function wymusAktualizacje\(\)[\s\S]*?\n}\n/)[0];
  spr("kasuje zapisane pliki aplikacji", /caches\.delete/.test(kod));
  spr("wyrejestrowuje mechanizm offline", /unregister\(\)/.test(kod));
  spr("przeładowuje stronę", /location\.reload\(\)/.test(kod));
  // Obserwacje, stan meczu i kolejka wysylki leza w localStorage. Gdyby to sprzatanie ich
  // dotykalo, przycisk "wez nowa wersje" kasowalby prace z meczu.
  spr("NIE rusza pamięci z danymi", !/localStorage\.(clear|removeItem)/.test(kod));
}

console.log("\nNa czym pracuje ten panel — widoczne z ekranu");
spr("wersja panelu pokazana w Ustawieniach", /Wersja panelu[\s\S]{0,200}WERSJA_PANELU/.test(panel));
spr("wynik ostatniego pytania o wersję też", /Sprawdzenie wersji[\s\S]{0,400}stanWersji/.test(panel));
spr("adres panelu pokazany — roboczy wygląda jak docelowy", /Adres<\/span>[\s\S]{0,300}location\.host/.test(panel));
// Opis bledu wysylany do mnie musi niesc wersje, inaczej znow nie wiadomo, co go wyprodukowalo.
spr("opis błędu niesie wersję panelu",
  /panel: \$\{WERSJA_PANELU\}/.test(panel));
spr("kopiowany opis też", (panel.match(/panel: \$\{WERSJA_PANELU\}/g) || []).length >= 2);

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy?1:0);
