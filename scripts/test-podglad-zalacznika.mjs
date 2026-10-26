// PODGLĄD ZAŁĄCZNIKA NA PEŁNYM EKRANIE.
//
// Zgłoszenie (26.10.2026): „przy kliknięciu w załącznik, czyli tu screen, niech powiększa
// zdjęcie i przycisk pobrania lub zamknięcia, ale żeby powiększało do czytelnego obrazka".
//
// Dotąd klik w kafelek otwierał okno „Zarządzaj załącznikami", więc jedyną drogą do obejrzenia
// zrzutu było pobranie go na dysk. Test pilnuje trzech rzeczy: że klik otwiera PODGLĄD, że są
// w nim pobieranie i zamykanie, i że da się dojść do rozmiaru, w którym tekst jest czytelny.
//
// Uruchomienie:  node scripts/test-podglad-zalacznika.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const css = fs.readFileSync("src/style.css", "utf8");
const plaski = css.replace(/\s+/g, " ");

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Klik w kafelek otwiera podgląd");
sprawdz("kafelek załącznika prowadzi do podglądu, a nie do okna zarządzania",
  /class="attach-card" data-action="podglad-zalacznika"/.test(zrodlo));
sprawdz("kafelek niesie numer załącznika, więc wiadomo który otworzyć",
  /data-i="\$\{i\}"/.test(zrodlo));
sprawdz("akcja jest podpięta", /\[data-action="podglad-zalacznika"\]/.test(zrodlo)
  && /otworzPodgladZalacznika\(b\.dataset\.id, b\.dataset\.i\)/.test(zrodlo));
sprawdz("przycisk „Zarządzaj załącznikami” dalej otwiera zarządzanie",
  /data-action="manage-attachments"[^>]*>Zarządzaj załącznikami</.test(zrodlo));
sprawdz("podpowiedź kafelka mówi, co się stanie po kliknięciu",
  /kliknij, aby otworzyć w powiększeniu/.test(zrodlo));

console.log("\n2. Pobranie i zamknięcie");
sprawdz("jest przycisk pobrania z nazwą pliku",
  /class="gold lb-pobierz" href="\$\{a\.dataUrl\}" download="\$\{esc\(a\.name\)\}"/.test(zrodlo));
sprawdz("jest przycisk zamknięcia", /class="secondary lb-zamknij"/.test(zrodlo)
  && /ov\.querySelector\('\.lb-zamknij'\)\.onclick = zamknij;/.test(zrodlo));
sprawdz("Escape też zamyka", /if\(e\.key === 'Escape'\) zamknij\(\)/.test(zrodlo));
sprawdz("nasłuch klawiatury jest zdejmowany przy zamknięciu — inaczej zostaje po każdym otwarciu",
  /document\.removeEventListener\('keydown', naKlawisz\); ov\.remove\(\);/.test(zrodlo));
// Przewijanie powiększonego zrzutu nie może kończyć się zamknięciem podglądu.
sprawdz("klik w tło zamyka, klik w sam obraz nie",
  /if\(e\.target === ov \|\| e\.target\.classList\.contains\('lightbox-tresc'\)\) zamknij\(\)/.test(zrodlo));

console.log("\n3. Czytelny obrazek — o to chodziło");
sprawdz("domyślnie obraz mieści się w ekranie",
  /\.lightbox-tresc \.lb-obraz\{[^}]*max-width:100%;max-height:100%;object-fit:contain/.test(plaski));
// Zrzut gęstej tabeli bywa szerszy niż okno — samo „zmieść w ekranie" nadal daje za mały tekst.
sprawdz("jest tryb pełnej rozdzielczości dla gęstych zrzutów",
  /\.lightbox\.lb-pelna-skala \.lb-obraz\{[^}]*max-width:none;max-height:none/.test(plaski));
sprawdz("w pełnej skali podgląd się przewija", /\.lightbox-tresc\{[^}]*overflow:auto/.test(plaski));
sprawdz("przełącznik skali zmienia napis, żeby było wiadomo, w którym trybie jesteś",
  /pelna \? '🔍 Zmieść w ekranie' : '🔍 Skala 1:1'/.test(zrodlo));
sprawdz("przełącznik pokazuje się tylko przy obrazkach, nie przy PDF",
  /\$\{obraz \? `<button class="secondary lb-skala"/.test(zrodlo));
sprawdz("podgląd stoi nad oknami modalnymi", /\.lightbox\{[^}]*z-index:1200/.test(plaski));

console.log("\n4. Czytelność paska w obu motywach");
// Pasek ma stałe ciemne tło, więc klasy .secondary/.gold liczone pod jasne karty dawały tu
// ciemny tekst na ciemnym i „Pobierz" w kolorze zwykłego odnośnika. Sprawdzone w przeglądarce.
sprawdz("przyciski mają własne barwy, nie dziedziczone z jasnych kart",
  /\.lightbox-pasek button\{[^}]*color:#EDEFE9/.test(plaski));
sprawdz("pobieranie wygląda jak przycisk, a nie jak odnośnik",
  /\.lightbox-pasek \.lb-pobierz\{[^}]*background:#C69B3C[^}]*color:#2A1F05/.test(plaski));
sprawdz("tekst na pasku jest jasny na stałe", /\.lightbox-nazwa\{color:#F4F1E6/.test(plaski));
sprawdz("jest widoczny znacznik zaznaczenia klawiaturą", /\.lightbox-pasek button:focus-visible/.test(plaski));

console.log("\n5. Pliki, których przeglądarka nie pokaże");
sprawdz("PDF ma własny podgląd", /class="lb-pdf" src="\$\{a\.dataUrl\}#view=FitH"/.test(zrodlo));
sprawdz("inny typ pliku kończy się wyjaśnieniem, a nie pustym oknem",
  /Tego rodzaju pliku przeglądarka nie pokaże w podglądzie/.test(zrodlo));
sprawdz("brak załącznika nie wywraca podglądu", /if\(!a\) return;/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
