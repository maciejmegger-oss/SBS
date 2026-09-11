// Sprawdza wczytywanie meczu z tekstu skopiowanego z cudzej aplikacji (ŁNP i podobne).
//
// Testuje PRAWDZIWĄ funkcję czytajZeZrzutu z src/mobile/main.ts — wyciętą wraz ze wszystkim,
// czego potrzebuje, i skompilowaną esbuildem. Nie jej odpis, bo odpis rozjeżdża się z kodem.
//
// Uruchomienie:  node scripts/test-wklejka-meczu.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const zrodlo = fs.readFileSync("src/mobile/main.ts", "utf8");
const blok = zrodlo.match(/const MIESIACE_PL[\s\S]*?\nexport function czytajZeZrzutu[\s\S]*?\n}\n/);
if (!blok) { console.error("Nie znalazłem czytajZeZrzutu — test i kod się rozjechały."); process.exit(1); }
const js = transformSync(blok[0].replace(/export /g, ""), { loader: "ts", format: "esm" }).code;
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

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy ? 1 : 0);
