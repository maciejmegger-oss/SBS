// PUSTA ODPOWIEDŹ SERWERA NIE MOŻE KASOWAĆ KARTOTEKI.
//
// Zgłoszenie (09.11.2026): „co się stało, nie ładuje się strona po logowaniu?". Strona ładowała
// się poprawnie — tylko każdy licznik pokazywał zero: kluby, zawodnicy, obserwacje, raporty,
// a nawet lista scoutów z ustawień.
//
// Przyczyna: czyszczenie rekordów usuniętych opiera się na liście identyfikatorów z serwera —
// czego na niej nie ma, wypada z pamięci przeglądarki. PostgREST przy odmowie dostępu (RLS,
// wygasła albo niedołączona sesja) NIE zwraca błędu, tylko status 200 i pustą tablicę. Dla kodu
// wyglądało to identycznie jak „na serwerze nie ma ani jednego wiersza", więc kasował całą
// kartotekę i zapisywał tę pustkę w IndexedDB — od tej pory pustka wracała przy każdym wejściu.
//
// Test pilnuje trzech rzeczy: że pustka nie kasuje, że zwykłe usuwanie dalej działa, i że
// użytkownik dostaje wyjaśnienie zamiast milczących zer.
//
// Uruchomienie:  node scripts/test-pusta-odpowiedz-bazy.mjs
import fs from "node:fs";

const magazyn = fs.readFileSync("src/data/storage.ts", "utf8");
const zrodlo = fs.readFileSync("src/main.ts", "utf8");

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Zachowanie przy pustej odpowiedzi — na kopii logiki");
// Odwzorowanie decyzji z getCollection: kiedy wolno czyścić pamięć, a kiedy nie.
function scal(wPamieci, naSerwerze, zmienione = []) {
  const wgId = new Map(wPamieci.map((id) => [id, { id }]));
  zmienione.forEach((id) => wgId.set(id, { id }));
  const serwer = new Set(naSerwerze);
  let usunietych = 0;
  const podejrzanaPustka = serwer.size === 0 && wgId.size > 0;
  if (!podejrzanaPustka) {
    for (const id of [...wgId.keys()]) if (!serwer.has(id)) { wgId.delete(id); usunietych++; }
  }
  return { zostalo: [...wgId.keys()], usunietych, podejrzanaPustka };
}

{
  const w = scal(["a", "b", "c"], []);
  sprawdz("serwer oddaje pustkę przy niepustej pamięci — nic nie znika",
    w.zostalo.length === 3 && w.usunietych === 0, JSON.stringify(w));
  sprawdz("sytuacja jest oznaczona jako podejrzana, a nie przemilczana", w.podejrzanaPustka === true);
}
{
  // To jest druga strona medalu: prawdziwe usunięcie nadal musi działać, inaczej skasowany
  // zawodnik zostawałby w przeglądarce na zawsze.
  const w = scal(["a", "b", "c"], ["a", "c"]);
  sprawdz("prawdziwe usunięcie rekordu dalej czyści pamięć",
    w.zostalo.join() === "a,c" && w.usunietych === 1, JSON.stringify(w));
  sprawdz("zwykłe usunięcie nie jest zgłaszane jako awaria", w.podejrzanaPustka === false);
}
{
  const w = scal([], []);
  sprawdz("pusta pamięć i pusty serwer to nie jest awaria — tak wygląda czysta instalacja",
    w.podejrzanaPustka === false && w.zostalo.length === 0);
}
{
  const w = scal(["a"], ["a", "b"], ["b"]);
  sprawdz("nowy rekord z serwera dochodzi normalnie", w.zostalo.join() === "a,b" && w.usunietych === 0);
}

console.log("\n2. Zabezpieczenie w kodzie");
sprawdz("warunek podejrzanej pustki istnieje w getCollection",
  /const podejrzanaPustka = naSerwerze\.size === 0 && wgId\.size > 0;/.test(magazyn));
sprawdz("czyszczenie wykonuje się wyłącznie poza tym przypadkiem",
  /if \(podejrzanaPustka\) \{[\s\S]{0,400}?\} else \{[\s\S]{0,200}?wgId\.delete\(id\); usunietych\+\+;/.test(magazyn));
sprawdz("powód trafia do ostrzeżenia w konsoli, a nie ginie",
  /console\.warn\(`\$\{table\}: serwer nie zwrócił ani jednego rekordu/.test(magazyn));
// Gdyby pamięć została mimo wszystko nadpisana, pustka zostałaby utrwalona na dysku i wracała
// przy każdym wejściu — czyli dokładnie to, z czego nie dało się wyjść bez narzędzi deweloperskich.
sprawdz("pamięć przepisujemy tylko wtedy, gdy naprawdę coś się zmieniło",
  /if \(zmienione\.length \|\| usunietych\) \{/.test(magazyn));

console.log("\n3. Użytkownik dowiaduje się, co się stało");
sprawdz("stan jest wystawiony na zewnątrz modułu",
  /export function podejrzaniePustaOdpowiedz\(\): string/.test(magazyn));
sprawdz("aplikacja go czyta", /import \{ storage, podejrzaniePustaOdpowiedz, wyczyscPamiecKolekcji \}/.test(zrodlo));
sprawdz("jest baner tłumaczący puste liczniki",
  /Baza nie zwróciła żadnych rekordów/.test(zrodlo));
sprawdz("baner mówi, że to najpewniej sprawa sesji lub uprawnień, a nie utrata danych",
  /sesja wygasła albo konto nie ma uprawnień/.test(zrodlo) && /nic nie przepadło/.test(zrodlo));
sprawdz("baner daje wyjście: pobranie od nowa i wylogowanie",
  /data-action="odswiez-od-zera"/.test(zrodlo) && /data-action="wyloguj-i-zaloguj"/.test(zrodlo));
sprawdz("baner nie znika przez przełącznik klasy na body",
  /!!lastSaveFailure \|\| nieudaneOdczyty\.length > 0 \|\| !!podejrzaniePustaOdpowiedz\(\)/.test(zrodlo));

console.log("\n4. Da się to naprawić bez narzędzi deweloperskich");
// Dotąd jedynym wyjściem było skasowanie bazy IndexedDB z konsoli przeglądarki.
sprawdz("w Ustawieniach jest przycisk pobrania danych od nowa",
  /data-action="odswiez-dane-od-zera"/.test(zrodlo)
  && /Dane nie zgadzają się z bazą\?/.test(zrodlo));
sprawdz("przycisk jest podpięty i czyści pamięć kolekcji",
  /\[data-action="odswiez-dane-od-zera"\]'\)\.forEach\(b=>b\.onclick=async \(\)=>\{[\s\S]{0,400}?wyczyscPamiecKolekcji\(\)/.test(zrodlo));
sprawdz("przycisk pyta o potwierdzenie i mówi, że baza zostaje nietknięta",
  /Dane w bazie zostają nietknięte/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
