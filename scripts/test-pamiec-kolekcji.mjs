// Pamięć podręczna kolekcji — wczytywanie przyrostowe zamiast pełnego pobrania za każdym razem.
//
// Zgłoszenia (15–16.10.2026): najpierw Supabase odciął projekt za przekroczony limit transferu
// (6,507 GB przy limicie 5 GB, a baza waży 103 MB — czyli cała jej zawartość poszła przez sieć
// jakieś sześćdziesiąt razy), a zaraz potem: „popraw długie ładowanie się strony, trzyma wszystko
// na zielono, dopiero po minucie załaduje się".
//
// Jedna przyczyna obu rzeczy: przy każdym wejściu aplikacja ściągała komplet kolekcji od zera.
// Samych zawodników jest 16 837.
//
// Uruchomienie:  node scripts/test-pamiec-kolekcji.mjs
import fs from "node:fs";

const st = fs.readFileSync("src/data/storage.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Gdzie trzymamy zapamiętane dane");
sprawdz("IndexedDB, a nie localStorage — tam zmieściłoby się kilka megabajtów",
  /indexedDB\.open\(PAMIEC_BAZA, 1\)/.test(st) && !/localStorage\.setItem\(PAMIEC/.test(st));
sprawdz("jest klucz wersji, którym da się unieważnić całość",
  /const WERSJA_PAMIECI = \d+;/.test(st) && /w\.wersja === WERSJA_PAMIECI/.test(st));
sprawdz("jest awaryjne czyszczenie pamięci", /export async function wyczyscPamiecKolekcji/.test(st));

console.log("\n2. Awaria pamięci nie może wywrócić wczytywania");
sprawdz("brak IndexedDB (tryb prywatny) oddaje null, a nie wyjątek",
  /if \(typeof indexedDB === "undefined"\) return gotowe\(null\);/.test(st));
sprawdz("nieudany odczyt pamięci oddaje null", /z\.onerror = \(\) => gotowe\(null\);/.test(st));
sprawdz("przepełniona pamięć nie przerywa zapisu",
  /t\.onerror = \(\) => gotowe\(\);/.test(st) && /t\.onabort = \(\) => gotowe\(\);/.test(st));
sprawdz("pusta pamięć = pełne pobranie, jak dotąd",
  /if \(!zapamietane \|\| !zapamietane\.odKiedy\) \{/.test(st));

console.log("\n3. Wczytywanie przyrostowe");
sprawdz("kolejne wejścia pytają tylko o zmienione wiersze",
  /if \(odKiedy\) q = q\.gt\("updated_at", odKiedy\);/.test(st));
sprawdz("znacznik liczony z najnowszego updated_at, jaki widzieliśmy",
  /const najnowszaZmiana = \(wiersze/.test(st) && /const odKiedy = najnowszaZmiana\(zmienione\) \|\| zapamietane\.odKiedy;/.test(st));
sprawdz("usunięte wiersze znikają — po samym updated_at nie da się ich poznać",
  /for \(const id of \[\.\.\.wgId\.keys\(\)\]\) if \(!naSerwerze\.has\(id\)\) \{ wgId\.delete\(id\); usunietych\+\+; \}/.test(st));
sprawdz("zmienione nadpisują zapamiętane, a nie dublują się",
  /for \(const o of przemapuj\(table, zmienione\)\) wgId\.set\(String\(o\.id\), o\);/.test(st));

console.log("\n4. Czego ta zmiana NIE rusza");
sprawdz("nadal pobieramy pełne wiersze — zapis idzie całymi kolekcjami",
  /sb\.from\(table\)\.select\("\*"\)/.test(st));
sprawdz("powód zapisany w kodzie, żeby nikt tego nie 'zoptymalizował'",
  /zostałoby przy pierwszym zapisie SKASOWANE w bazie/.test(st));
sprawdz("loadedIds nadal pełne — na nich stoi ochrona przed wskrzeszaniem usuniętych",
  /loadedIds\[table\] = new Set\(objs\.map\(\(o\) => String\(o\.id\)\)\);/.test(st));

console.log("\n5. Strony pobierane falami, nie po kolei");
sprawdz("wiersze falami po cztery", /async function pobierzWiersze[\s\S]{0,400}const RÓWNOLEGLE = 4;/.test(st));
sprawdz("identyfikatory też — przy 17 stronach sekwencja dokładała sekundy",
  /async function fetchServerIds[\s\S]{0,300}const RÓWNOLEGLE = 4;[\s\S]{0,400}Promise\.all/.test(st));


console.log("\n6. Zapis wysyła tylko to, co się zmieniło");
sprawdz("przy wczytaniu zapamiętujemy odcisk każdego wiersza",
  /const odciski: Record<string, Map<string, string>> = \{\};/.test(st)
  && /zapamietajOdciski\(table, objs\);/.test(st));
sprawdz("odcisk liczony z długości i FNV-1a, nie z samego skrótu",
  /return s\.length\.toString\(36\) \+ ":" \+ h\.toString\(36\);/.test(st));
sprawdz("zapis odsiewa wiersze bez zmian",
  /const zmienione = wszystkie\.filter\(\(it\) => \{[\s\S]{0,160}byl !== odcisk\(it\)/.test(st));
sprawdz("gdy nic się nie zmieniło, nie wołamy bazy w ogóle",
  /if \(!zmienione\.length\) return;/.test(st));
sprawdz("po zapisie odciski są odświeżane — inaczej te same wiersze poszłyby znowu",
  /if \(m\) for \(const it of items\) m\.set\(String\(it\.id\), odcisk\(it\)\);/.test(st));
sprawdz("powód zapisany w kodzie — zapis obserwacji pociągał całą kartotekę zawodników",
  /upsert sześciu tysięcy\.\.\. a dziś 16 837 kartotek/.test(st));

console.log("\n7. Pamięć przepisywana tylko wtedy, gdy jest co przepisać");
sprawdz("brak zmian = brak zapisu do IndexedDB",
  /if \(zmienione\.length \|\| usunietych\) \{/.test(st));
sprawdz("usunięcia liczone przy przycinaniu, bez drugiego mapowania",
  /\{ wgId\.delete\(id\); usunietych\+\+; \}/.test(st));
sprawdz("powód zapisany — kopiowanie dziesiątek MB na wątku rysowania",
  /kopiowanie kilkudziesięciu megabajtów na wątku/.test(st));
console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
