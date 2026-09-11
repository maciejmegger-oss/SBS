// Sprawdza wczytywanie meczu z tekstu skopiowanego z cudzej aplikacji (ŁNP i podobne).
//
// Testuje PRAWDZIWĄ funkcję czytajZeZrzutu z src/mobile/main.ts — wyciętą wraz ze wszystkim,
// czego potrzebuje, i skompilowaną esbuildem. Nie jej odpis, bo odpis rozjeżdża się z kodem.
//
// Uruchomienie:  node scripts/test-wklejka-meczu.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const zrodlo = fs.readFileSync("src/mobile/main.ts", "utf8");
const wytnijZe = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/mobile/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};
// czytajZeZrzutu porównuje kluby tak samo jak reszta panelu — przez znacznikZespolu i normKlub,
// które leżą w pliku niżej. Bierzemy je razem z nią, żeby test sprawdzał prawdziwe dopasowanie.
const blok =
  wytnijZe("ZNACZNIKI_ZESPOLU + normKlub", /const ZNACZNIKI_ZESPOLU[\s\S]*?\nconst normKlub[\s\S]*?\n  \.trim\(\);/)
  + "\n"
  + wytnijZe("czytajZeZrzutu", /const MIESIACE_PL[\s\S]*?\nexport function czytajZeZrzutu[\s\S]*?\n}\n/);
const js = transformSync(blok.replace(/export /g, ""), { loader: "ts", format: "esm" }).code;
const { czytajZeZrzutu } = await import(
  "data:text/javascript;base64," + Buffer.from(js + "\nexport { czytajZeZrzutu };").toString("base64"));

let bledy = 0;
const sprawdz = (opis, jest, ma) => {
  const ok = jest === ma;
  console.log(`${ok ? "  OK  " : " BŁĄD "} ${opis}${ok ? "" : `\n         jest: ${JSON.stringify(jest)}\n          ma:  ${JSON.stringify(ma)}`}`);
  if (!ok) bledy++;
};

// ---------------------------------------------------------------------------
// 1. EKRAN MECZU Z ŁNP — nazwa stadionu ŁAMIE SIĘ NA TRZY WIERSZE.
//
// To jest wklejka, która realnie zepsuła planowanie: drugi wiersz stadionu brzmi
// „ZAWISZA - boisko sztuczne  (Bydgoszcz," i wygląda dokładnie jak zapis „Gospodarz - Gość".
// Panel brał go za drużyny i zakładał obserwację meczu o nazwie stadionu.
// ---------------------------------------------------------------------------
console.log("1. Ekran meczu z ŁNP (stadion w trzech wierszach)");
{
  const wklejka = [
    "13:38", "5G", "82",
    "Zawisza Bydgoszcz",
    "16.09, Śr.",
    "19:00",
    "AP Młode Talenty Toruń",
    "Szczegóły", "Relacja", "Statystyki",
    "Szczegóły meczu",
    "Terminarz: 16 września 2026 Środa 19:00",
    "Stadion: Bydgoskie Centrum Sportu, Kompleks Sportowy",
    "ZAWISZA - boisko sztuczne  (Bydgoszcz,",
    "Gdańska 163)",
    "Runda: Kolejka 3, Runda jesienna",
    "Rozgrywka: C2",
    "Mecze", "Rozgrywki", "Dziś grają", "Ulubione",
  ].join("\n");

  const d = czytajZeZrzutu(wklejka, ["Zawisza Bydgoszcz", "Chojniczanka Chojnice"]);
  sprawdz("gospodarze", d.gospodarze, "Zawisza Bydgoszcz");
  sprawdz("goście", d.goscie, "AP Młode Talenty Toruń");
  sprawdz("data", d.data, "2026-09-16");
  sprawdz("godzina z terminarza, a nie zegarek telefonu", d.godzina, "19:00");
  sprawdz("rozgrywki", d.rozgrywki, "C2");
  sprawdz("miejsce — całe, ze wszystkich trzech wierszy", d.miejsce,
    "Bydgoskie Centrum Sportu, Kompleks Sportowy ZAWISZA - boisko sztuczne (Bydgoszcz, Gdańska 163)");
  sprawdz("nic nie zgłoszone jako brakujące", d.braki.join(","), "");
}

// ---------------------------------------------------------------------------
// 2. Ten sam ekran, ale ŻADNA z drużyn nie jest w bazie.
// Młodzieżowych zespołów zwykle w kartotece nie ma — nazwy muszą się wtedy wziąć z układu.
// ---------------------------------------------------------------------------
console.log("\n2. Obie drużyny spoza bazy");
{
  const wklejka = [
    "Zawisza Bydgoszcz",
    "16.09, Śr.", "19:00",
    "AP Młode Talenty Toruń",
    "Szczegóły meczu",
    "Terminarz: 16 września 2026 Środa 19:00",
    "Stadion: Bydgoskie Centrum Sportu, Kompleks Sportowy",
    "ZAWISZA - boisko sztuczne  (Bydgoszcz,",
    "Gdańska 163)",
    "Rozgrywka: C2",
  ].join("\n");
  const d = czytajZeZrzutu(wklejka, []);
  sprawdz("gospodarze", d.gospodarze, "Zawisza Bydgoszcz");
  sprawdz("goście", d.goscie, "AP Młode Talenty Toruń");
}

// ---------------------------------------------------------------------------
// 3. Zwykły zapis „A - B" w jednym wierszu MUSI dalej działać — tak wygląda terminarz
//    w wielu źródłach i to była pierwotna droga rozpoznania.
// ---------------------------------------------------------------------------
console.log("\n3. Zapis „Gospodarz - Gość\" w jednym wierszu");
{
  const d = czytajZeZrzutu([
    "Kolejka 5",
    "Chojniczanka Chojnice - Znicz Pruszków",
    "12.10.2026 17:00",
    "Stadion: Chojnice, Plac Piastowski 3",
  ].join("\n"), []);
  sprawdz("gospodarze", d.gospodarze, "Chojniczanka Chojnice");
  sprawdz("goście", d.goscie, "Znicz Pruszków");
  sprawdz("data", d.data, "2026-10-12");
  sprawdz("godzina", d.godzina, "17:00");
}

// ---------------------------------------------------------------------------
// 4. Stadion z myślnikiem w JEDNYM wierszu — nie wolno go wziąć za drużyny.
// ---------------------------------------------------------------------------
console.log("\n4. Stadion z myślnikiem w jednym wierszu");
{
  const d = czytajZeZrzutu([
    "Zawisza Bydgoszcz",
    "AP Młode Talenty Toruń",
    "Stadion: ZAWISZA - boisko sztuczne",
    "Rozgrywka: C2",
  ].join("\n"), []);
  sprawdz("gospodarze", d.gospodarze, "Zawisza Bydgoszcz");
  sprawdz("goście", d.goscie, "AP Młode Talenty Toruń");
  sprawdz("miejsce", d.miejsce, "ZAWISZA - boisko sztuczne");
}

// ---------------------------------------------------------------------------
// 5. Przykład z podpowiedzi w polu wklejania — musi działać, bo scout go zobaczy pierwszy.
// ---------------------------------------------------------------------------
console.log("\n5. Przykład z podpowiedzi w panelu");
{
  const d = czytajZeZrzutu([
    "Zawisza Bydgoszcz",
    "02.09, Śr.",
    "18:00",
    "ZKS Elana Toruń",
    "Terminarz: 2 września 2026 Środa 18:00",
    "Stadion: Gdańska 163, 85-915 Bydgoszcz",
  ].join("\n"), ["Zawisza Bydgoszcz"]);
  sprawdz("gospodarze", d.gospodarze, "Zawisza Bydgoszcz");
  sprawdz("goście", d.goscie, "ZKS Elana Toruń");
  sprawdz("data", d.data, "2026-09-02");
  sprawdz("godzina", d.godzina, "18:00");
  sprawdz("miejsce", d.miejsce, "Gdańska 163, 85-915 Bydgoszcz");
}

// ---------------------------------------------------------------------------
// 6. Ten sam klub nie może wyjść na obie strony.
// ---------------------------------------------------------------------------
console.log("\n6. Gospodarz i gość to nie ten sam zespół");
{
  const d = czytajZeZrzutu([
    "Zawisza Bydgoszcz",
    "AP Młode Talenty Toruń",
    "Stadion: Kompleks Sportowy ZAWISZA",
  ].join("\n"), ["Zawisza Bydgoszcz"]);
  sprawdz("gospodarze", d.gospodarze, "Zawisza Bydgoszcz");
  sprawdz("goście to NIE gospodarze", d.goscie === d.gospodarze, false);
}

// ---------------------------------------------------------------------------
// 7. Podpisany nagłówek NAD parą drużyn.
// Gdyby odsiew szedł „wszystko od pierwszej do ostatniej etykiety", ten mecz by przepadł —
// leży między „Kolejka:" a „Stadion:". Dlatego urwany wiersz rozpoznajemy po kształcie.
// ---------------------------------------------------------------------------
console.log("\n7. Nagłówek z etykietą nad meczem");
{
  const d = czytajZeZrzutu([
    "Kolejka: 3",
    "Chojniczanka Chojnice - Znicz Pruszków",
    "Stadion: Chojnice, Plac Piastowski 3",
  ].join("\n"), []);
  sprawdz("gospodarze", d.gospodarze, "Chojniczanka Chojnice");
  sprawdz("goście", d.goscie, "Znicz Pruszków");
}

// ---------------------------------------------------------------------------
// 8. Nazwa obiektu łamana BEZ nawiasów — dalszy ciąg od małej litery.
// ---------------------------------------------------------------------------
console.log("\n8. Obiekt łamany, ciąg dalszy od małej litery");
{
  const d = czytajZeZrzutu([
    "Zawisza Bydgoszcz",
    "AP Młode Talenty Toruń",
    "Stadion: Miejski Ośrodek Sportu",
    "i Rekreacji w Bydgoszczy",
    "Rozgrywka: C2",
  ].join("\n"), []);
  sprawdz("gospodarze", d.gospodarze, "Zawisza Bydgoszcz");
  sprawdz("goście", d.goscie, "AP Młode Talenty Toruń");
  sprawdz("miejsce sklejone", d.miejsce, "Miejski Ośrodek Sportu i Rekreacji w Bydgoszczy");
}

// ---------------------------------------------------------------------------
// 9. Ostatnie podpisane pole nie zbiera menu z dołu cudzego ekranu.
// ---------------------------------------------------------------------------
console.log("\n9. Menu pod szczegółami nie wchodzi do rozgrywek");
{
  const d = czytajZeZrzutu([
    "Zawisza Bydgoszcz",
    "AP Młode Talenty Toruń",
    "Rozgrywka: C2",
    "Mecze", "Rozgrywki", "Dziś grają", "Ulubione",
  ].join("\n"), []);
  sprawdz("rozgrywki to samo C2", d.rozgrywki, "C2");
}

// ---------------------------------------------------------------------------
// 10. NAPIS Z HERBU NIE MOŻE WYBRAĆ KLUBU.
//
// Telefon czyta tekst z CAŁEGO zrzutu, więc do wklejki wpada też napis z tarczy herbowej —
// samo „POLONIA". Taki jednowyrazowy wiersz pasował do każdego klubu w bazie, który ma to
// słowo w nazwie, i wygrywał pierwszy z brzegu: mecz Zawisza — Polonia Bydgoszcz zapisał się
// jako „Grupa Chmiel Polonia Słubice - ZAWISZA BYDGOSZCZ". Zła drużyna i odwrócone strony,
// bo napis z herbu stoi w tekście wyżej niż podpis pod herbem.
// ---------------------------------------------------------------------------
console.log("\n10. Napis z herbu nie wybiera klubu");
{
  const wklejka = [
    "13:37", "5G", "83",
    "Z",                       // napis z tarczy Zawiszy
    "13.09, Ndz.",
    "POLONIA", "BYDGOSZCZA",   // napis z tarczy Polonii — stoi WYŻEJ niż podpisy pod herbami
    "12:30",
    "Zawisza Bydgoszcz",
    "Polonia Bydgoszcz",
    "Szczegóły", "Relacja", "Statystyki",
    "Szczegóły meczu",
    "Terminarz: 13 września 2026 Niedziela 12:30",
    "Stadion: Gdańska 163 , 85-915 Bydgoszcz",
    "Runda: Kolejka 5, Runda jesienna",
    "Rozgrywka: A1",
    "Mecze", "Rozgrywki", "Dziś grają", "Ulubione",
  ].join("\n");
  const baza = ["ZAWISZA BYDGOSZCZ", "Grupa Chmiel Polonia Słubice", "Polonia Bydgoszcz"];

  const d = czytajZeZrzutu(wklejka, baza);
  sprawdz("gospodarze — gospodarz z lewej, nie z herbu", d.gospodarze, "ZAWISZA BYDGOSZCZ");
  sprawdz("goście — Bydgoszcz, nie Słubice", d.goscie, "Polonia Bydgoszcz");
  sprawdz("data", d.data, "2026-09-13");
  sprawdz("godzina", d.godzina, "12:30");
  sprawdz("rozgrywki", d.rozgrywki, "A1");
  sprawdz("miejsce", d.miejsce, "Gdańska 163, 85-915 Bydgoszcz");
}

// ---------------------------------------------------------------------------
// 11. Ten sam zrzut, ale gościa NIE MA w bazie — nazwa ma się wziąć z podpisu pod herbem,
//     a nie z napisu na tarczy.
// ---------------------------------------------------------------------------
console.log("\n11. Gość spoza bazy — nazwa z podpisu, nie z tarczy");
{
  const d = czytajZeZrzutu([
    "Z", "13.09, Ndz.", "POLONIA", "BYDGOSZCZA", "12:30",
    "Zawisza Bydgoszcz",
    "Polonia Bydgoszcz",
    "Rozgrywka: A1",
  ].join("\n"), ["ZAWISZA BYDGOSZCZ"]);
  sprawdz("gospodarze", d.gospodarze, "ZAWISZA BYDGOSZCZ");
  sprawdz("goście", d.goscie, "Polonia Bydgoszcz");
}

// ---------------------------------------------------------------------------
// 12. Klub z bazy o nazwie będącej fragmentem innej — nie wolno wybrać dłuższej.
// ---------------------------------------------------------------------------
console.log("\n12. Wygrywa klub najbliższy nazwie, nie pierwszy z brzegu");
{
  const d = czytajZeZrzutu([
    "Warta Poznań",
    "Arka Gdynia",
    "Rozgrywka: Betclic I liga",
  ].join("\n"), ["Warta Sieradz", "Arka Gdynia II", "Arka Gdynia", "Warta Poznań"]);
  sprawdz("gospodarze", d.gospodarze, "Warta Poznań");
  sprawdz("goście", d.goscie, "Arka Gdynia");
}

// ---------------------------------------------------------------------------
// 13. ZESPOŁY TEGO SAMEGO KLUBU TO RÓŻNE DRUŻYNY.
// Arka Gdynia gra w I lidze, Arka II Gdynia w IV, Arka U17 w CLJ. Mecz pierwszego zespołu nie
// może wylądować pod rezerwami tylko dlatego, że rezerw jest w bazie więcej niż jedne.
// ---------------------------------------------------------------------------
console.log("\n13. Pierwszy zespół, rezerwy i młodzież nie mieszają się");
{
  const baza = ["Arka Gdynia II", "Arka Gdynia U17", "Arka Gdynia", "Warta Poznań"];
  const pierwszy = czytajZeZrzutu(["Warta Poznań", "Arka Gdynia", "Rozgrywka: Betclic I liga"].join("\n"), baza);
  sprawdz("pierwszy zespół", pierwszy.goscie, "Arka Gdynia");

  const rezerwy = czytajZeZrzutu(["Warta Poznań", "Arka II Gdynia", "Rozgrywka: IV liga"].join("\n"), baza);
  sprawdz("rezerwy", rezerwy.goscie, "Arka Gdynia II");

  const mlodziez = czytajZeZrzutu(["Warta Poznań", "Arka Gdynia U17", "Rozgrywka: CLJ U17"].join("\n"), baza);
  sprawdz("młodzież", mlodziez.goscie, "Arka Gdynia U17");

  // Gdy w bazie są SAME rezerwy, mecz pierwszego zespołu nie ma się do czego przypiąć —
  // i wtedy lepiej zostawić nazwę z wklejki niż podstawić cudzą drużynę.
  const bezPierwszego = czytajZeZrzutu(["Warta Poznań", "Arka Gdynia", "Rozgrywka: Betclic I liga"].join("\n"),
    ["Arka Gdynia II", "Warta Poznań"]);
  sprawdz("brak pierwszego zespołu w bazie — nie podstawiamy rezerw", bezPierwszego.goscie, "Arka Gdynia");
}

// ---------------------------------------------------------------------------
// 14. Forma prawna w nazwie nie psuje dopasowania.
// ---------------------------------------------------------------------------
console.log("\n14. „SA\" w nazwie nie przeszkadza");
{
  const d = czytajZeZrzutu(["Warta Poznań", "Arka Gdynia", "Rozgrywka: Betclic I liga"].join("\n"),
    ["Arka Gdynia SA", "Warta Poznań"]);
  sprawdz("goście", d.goscie, "Arka Gdynia SA");
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy ? 1 : 0);
