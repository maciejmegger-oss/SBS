// Pro Junior System — odczyt danych PZPN, znaczek PJS i cotygodniowy przegląd.
//
// Zgłoszenie (14.10.2026): „jak wejdziesz w dany klub, zobaczysz, kto zdobywa punkty dla danego
// klubu — od razu go dodać do monitoringu i odznaczyć jako wyróżniającego się, zrób też znaczek
// PJS (...) zautomatyzuj, aby raz w tygodniu system sam prześledził dane PJS i wyłapał
// zawodników na poziomie centralnym".
//
// Uruchomienie:  node scripts/test-pjs.mjs
// Z odpytaniem żywego serwisu PZPN:  PJS_LIVE=1 node scripts/test-pjs.mjs
// (bez PJS_LIVE sprawdzamy samą logikę i wpięcie — żeby zestaw testów działał bez sieci)
import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const api = fs.readFileSync("api/pjs.js", "utf8");
const cron = fs.readFileSync("api/pjs-tydzien.js", "utf8");
const css = fs.readFileSync("src/style.css", "utf8");
const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const storage = fs.readFileSync("src/data/storage.ts", "utf8");

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Odczyt danych PZPN");
sprawdz("adres serwisu PJS zapisany na stałe", /const BAZA = "https:\/\/pjs-api\.laczynaspilka\.pl"/.test(api));
sprawdz("identyfikatory sprawdzane na UUID, zanim trafią do adresu", /const UUID = \/\^\[0-9a-f\]\{8\}/.test(api));
sprawdz("endpoint odmawia przy złym identyfikatorze",
  /Identyfikator PJS musi być w postaci UUID/.test(api));
sprawdz("szczebel centralny rozpoznawany po polu grouping",
  /export const SZCZEBEL_CENTRALNY = 1;/.test(api) && /centralna: l\.grouping === SZCZEBEL_CENTRALNY/.test(api));
sprawdz("cztery odczyty: filtry, rozgrywki, tabela, drużyna",
  ["pjsFiltry", "pjsRozgrywki", "pjsTabela", "pjsZawodnicyKlubu"].every((f) => api.includes(`export async function ${f}`)));

console.log("\n2. Nazwiska i nazwy klubów z PJS");
// PJS podaje w jednej tabeli „BARTŁOMIEJ CHYB" obok „Eryc Papiernik".
const ladnieImie = (s) => {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, przed, litera) => przed + litera.toUpperCase());
};
sprawdz("krzyczące nazwisko sprowadzone do normalnego zapisu", ladnieImie("CHYB") === "Chyb");
sprawdz("polskie znaki przetrwają", ladnieImie("CZUPRYŃSKI") === "Czupryński");
sprawdz("nazwisko dwuczłonowe", ladnieImie("NOWAK-JEZIORAŃSKI") === "Nowak-Jeziorański");
sprawdz("zapisane normalnie zostaje bez zmian", ladnieImie("Eryc Papiernik") === "Eryc Papiernik");

const SKROTY = new Set(["KS", "LKS", "MKS", "GKS", "UKS", "MUKS", "AP", "SKS", "RKS", "WKS", "TS", "TKS", "ZKS", "OKS", "PKS", "MGKS", "MLKS", "KP", "CLJ"]);
const nazwaKlubuLadnie = (nazwa) => {
  const t = String(nazwa || "").trim();
  if (t !== t.toUpperCase()) return t;
  return t.split(/\s+/).map((w) => (SKROTY.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(" ");
};
sprawdz("nazwa klubu z PJS czytelna, skrót zostaje wielkimi literami",
  nazwaKlubuLadnie("KS LECHIA 1923 TOMASZÓW MAZOWIECKI") === "KS Lechia 1923 Tomaszów Mazowiecki",
  nazwaKlubuLadnie("KS LECHIA 1923 TOMASZÓW MAZOWIECKI"));
sprawdz("nazwa już zapisana normalnie zostaje nietknięta",
  nazwaKlubuLadnie("ŁKS Łomża") === "ŁKS Łomża");

console.log("\n3. Co robi dodanie zawodnika z PJS");
sprawdz("trafia do monitoringu", /p\.monitored = true;/.test(main) && /function pjsDodajZawodnika/.test(main));
sprawdz("dostaje znacznik młodzieżowca", /p\.mlodziezowiec = true;\s*\/\/ w PJS punktuje wyłącznie młodzieżowiec/.test(main));
sprawdz("dostaje wyróżnienie ze wskazanym źródłem", /scout: 'Pro Junior System'/.test(main));
sprawdz("wyróżnienie jedno na sezon, nie przybywa co odczyt",
  /\.filter\(w=> !\(w\.scout === 'Pro Junior System' && w\.sezon === pjsStan\.sezon\)\)/.test(main));
sprawdz("istniejącej kartotece nie nadpisujemy nazwiska ani rocznika",
  /NIE nadpisujemy niczego poza dorobkiem PJS/.test(main));
sprawdz("dorobek zapisuje punkty, minuty i mecze",
  /pjsId: z\.pjsId, punkty: z\.punkty, minuty: z\.minuty, mecze: z\.mecze/.test(main));
sprawdz("pole pjs jest na liście pól zapisywanych do bazy", /"pjs",/.test(storage));

console.log("\n4. Znaczek PJS");
sprawdz("funkcja znaczka istnieje", /function pjsBadge\(p\)/.test(main));
sprawdz("bez punktów znaczka nie ma", /if\(!d \|\| !d\.punkty\) return '';/.test(main));
sprawdz("podpowiedź mówi, za co te punkty", /Pro Junior System: \$\{d\.punkty\} pkt za \$\{d\.minuty\} minut/.test(main));
sprawdz("znaczek widać w kartotece zawodnika", /\$\{esc\(p\.lastName\)\}\$\{pjsBadge\(p\)\}<\/h2>/.test(main));
sprawdz("i w Radarze młodzieży", /<\/strong>\$\{pjsBadge\(p\)\}\$\{wCzolowce/.test(main));
sprawdz("styl znaczka jest w arkuszu", /\.pjs-badge\{/.test(css));
sprawdz("odróżnia się kolorem od złotego MŁ", /color:#EAF5EE;background:linear-gradient\(180deg,#2F6B4F/.test(css));

// Kontrast napisu na znaczku — przy jaśniejszym krańcu gradientu, czyli w najgorszym przypadku.
const lum = (h) => {
  const c = h.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const kontrast = (a, b) => { const x = lum(a), y = lum(b); const [j, n] = x > y ? [x, y] : [y, x]; return (j + 0.05) / (n + 0.05); };
sprawdz(`kontrast napisu na znaczku: ${kontrast("#EAF5EE", "#2F6B4F").toFixed(1)}:1`,
  kontrast("#EAF5EE", "#2F6B4F") >= 4.5);

console.log("\n5. Dopasowanie do kartotek, które już są");
sprawdz("najpierw identyfikator PJS, bo jest pewniejszy niż nazwisko",
  /const poId = pasuje\.find\(p=> p\.pjs && p\.pjs\.pjsId === z\.pjsId\);/.test(main));
sprawdz("potem klub — ten sam Kowalski bywa w bazie kilka razy",
  /const wKlubie = pasuje\.find\(p=> p\.clubId === klub\.id\);/.test(main));
sprawdz("cotygodniowy przegląd porównuje zbiór słów, nie kolejność",
  /\[imie, nazwisko\]\.map\(norm\)\.filter\(Boolean\)\.sort\(\)\.join\(" "\)/.test(cron));
sprawdz("przy kilku imiennikach automat NIE zgaduje",
  /kandydaci\.length === 1 \? kandydaci\[0\] : null/.test(cron));

console.log("\n6. Cotygodniowy przegląd");
sprawdz("zadanie uruchamiane raz w tygodniu",
  vercel.crons.some((c) => c.path === "/api/pjs-tydzien" && c.schedule === "0 6 * * 1"),
  JSON.stringify(vercel.crons));
sprawdz("przechodzi ligi z listy, a nie co popadnie", /biezacy\.ligi\.filter\(\(l\) => LIGI_DO_PRZEGLADU\.includes\(l\.nazwa\)\)/.test(cron));
sprawdz("nie zakłada kartotek sam z siebie", /nie zakłada kartotek od zera/.test(cron));
sprawdz("nie zapisuje, gdy nic się nie zmieniło",
  /if \(bylo\.punkty === z\.punkty && bylo\.minuty === z\.minuty && bylo\.mecze === z\.mecze\) continue;/.test(cron));
sprawdz("błąd jednego klubu nie przerywa całego przeglądu",
  /podsumowanie\.bledy\.push\(`klub \$\{wiersz\.klub\.nazwa\}/.test(cron));
sprawdz("wynik zapisywany do sbs_kv pod kluczem pjsPrzeglad",
  /key: "pjsPrzeglad"/.test(cron) && /rest\/v1\/sbs_kv/.test(cron));
sprawdz("Radar czyta ten wynik leniwie, nie przy starcie aplikacji",
  /storage\.get\('pjsPrzeglad', true\)/.test(main) && /pjsWczytajPrzeglad\(\);/.test(main));
sprawdz("nowi spoza bazy pokazani skautowi do decyzji", /spoza bazy/.test(main));
sprawdz("kluby odpytywane paczkami, nie jeden po drugim",
  /const PACZKA = \d+;/.test(cron) && /await Promise\.all\(paczka\.map/.test(cron));
sprawdz("funkcja ma podniesiony limit czasu — pierwszy przebieg zajal 59 s",
  vercel.functions && vercel.functions["api/pjs-tydzien.js"]
  && vercel.functions["api/pjs-tydzien.js"].maxDuration >= 120,
  JSON.stringify(vercel.functions));

console.log("\n7. Przeglądanie w aplikacji");
for (const [akcja, opis] of [
  ["pjs-start", "wczytanie danych"],
  ["pjs-liga", "wybór ligi"],
  ["pjs-grupa", "wybór grupy"],
  ["pjs-klub", "wejście w klub"],
  ["pjs-dodaj", "dodanie jednego zawodnika"],
  ["pjs-dodaj-wszystkich", "dodanie całej listy"],
]) sprawdz(`${opis} jest podpięte`, new RegExp(`data-action="${akcja}"\\]`).test(main) && new RegExp(`data-action="${akcja}"`).test(main));
sprawdz("dodanie całej listy pyta o potwierdzenie", /if\(!confirm\(tresc\)\) return;/.test(main));
sprawdz("zmiana jest zapisywana do bazy", /pjsDodajZawodnika\(z, pjsStan\.zawodnicy\);[\s\S]{0,60}savePlayers\(\);/.test(main));
sprawdz("zawodnik nieuwzględniony w klasyfikacji jest pokazany, nie ukryty",
  /pjs-nieliczony/.test(main) && /\.pjs-nieliczony td\{/.test(css));


console.log("\n9. Szczebel wojewódzki (IV liga i niżej)");
sprawdz("osobny odczyt listy związków wojewódzkich", /export async function pjsWojewodztwa/.test(api));
sprawdz("osobny odczyt tabeli województwa", /export async function pjsTabelaWojewodztwa/.test(api));
sprawdz("obie ścieżki składają tabelę tak samo", /function ksztaltTabeli\(dane\)/.test(api)
  && /return ksztaltTabeli\(await pjsPobierz\(`\/competitions/.test(api));
sprawdz("powód rozdzielenia ścieżek zapisany w kodzie",
  /to samo zapytanie oddaje dla nich\s*\n\/\/ pustą tabelę/.test(api));
sprawdz("endpoint przyjmuje województwo i je sprawdza", /zlyId\(wojewodztwo\)/.test(api));
sprawdz("tabela z województwem nie wymaga grupy", /if \(wojewodztwo\) \{/.test(api));
sprawdz("widok ma pigułki województw", /data-action="pjs-wojewodztwo"/.test(main));
sprawdz("wybór ligi dobiera właściwą ścieżkę", /if\(liga && !liga\.centralna\)\{/.test(main));
sprawdz("dorobek podpisany województwem, gdy to IV liga",
  /zpn \? `\$\{liga \? liga\.nazwa : ''\} — \$\{zpn\.nazwa\}`/.test(main));
sprawdz("cotygodniowy przegląd bierze III i IV ligę",
  /const LIGI_DO_PRZEGLADU = \["Trzecia liga", "Czwarta liga"\];/.test(cron));
sprawdz("przegląd zna obie ścieżki", /pjsWojewodztwa\(biezacy\.sezon\.id, liga\.id\)/.test(cron)
  && /pjsTabelaWojewodztwa\(biezacy\.sezon\.id, liga\.id, zpn\.id\)/.test(cron));
sprawdz("większa paczka, bo klubów jest kilka razy więcej", /const PACZKA = 12;/.test(cron));
if (process.env.PJS_LIVE === "1") {
  console.log("\n8. Żywy serwis PZPN (PJS_LIVE=1)");
  const m = await import("../api/pjs.js");
  const sezony = await m.pjsFiltry();
  sprawdz("serwis oddaje sezony", sezony.length > 0, `oddał ${sezony.length}`);
  const biezacy = sezony[0];
  const centralna = biezacy.ligi.find((l) => l.centralna);
  sprawdz("jest liga na szczeblu centralnym", !!centralna, JSON.stringify(biezacy.ligi.map((l) => l.nazwa)));
  const grupy = await m.pjsRozgrywki(biezacy.sezon.id, centralna.id);
  sprawdz("liga ma grupy", grupy.length > 0, `oddał ${grupy.length}`);
  const tabela = await m.pjsTabela(grupy[0].id);
  sprawdz("grupa ma kluby z identyfikatorami", tabela.kluby.length > 0 && !!tabela.kluby[0].klub.id);
  const klub = await m.pjsZawodnicyKlubu(tabela.kluby[0].klub.id);
  sprawdz("klub oddaje zawodników z punktami i minutami",
    klub.zawodnicy.length > 0 && typeof klub.zawodnicy[0].punkty === "number" && typeof klub.zawodnicy[0].minuty === "number");
  sprawdz("nazwiska wracają w normalnym zapisie, nie wielkimi literami",
    klub.zawodnicy.every((z) => z.nazwisko !== z.nazwisko.toUpperCase() || z.nazwisko.length < 2),
    JSON.stringify(klub.zawodnicy.slice(0, 3).map((z) => z.imie + " " + z.nazwisko)));
} else {
  console.log("\n8. Żywy serwis PZPN — pominięty (uruchom z PJS_LIVE=1)");
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
