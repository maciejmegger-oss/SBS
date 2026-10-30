// Dokładna data urodzenia z wklejki składu.
//
// ZGŁOSZENIE (30.10.2026): „system wyłapuje tylko rocznik, a na Transfermarkcie jest dokładna data".
// Tak było: wklejka brała cztery cyfry roku, a resztę wyrzucała — choć pełna data stała w tej samej
// linijce. Polska wersja Transfermarktu pisze „27 lut 2005", skrótem miesiąca i bez kropek, więc
// wzorzec szukający „27.02.2005" nie miał tam czego znaleźć.
//
// DLACZEGO TO W OGÓLE MA ZNACZENIE
// Zawodnik z 3 stycznia i z 28 grudnia mają ten sam rocznik, a dzieli ich prawie rok rozwoju.
// Na roczniku efektu wieku względnego policzyć się nie da.
//
// Uruchomienie:  node scripts/test-data-urodzenia-wklejka.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + JSON.stringify(dodatek)}`);
  if (!warunek) bledy++;
};
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

const kod = [
  wytnij("MIESIACE_SKROTY", /const MIESIACE_SKROTY = \{[\s\S]*?\n\};/),
  wytnij("WZORCE_DATY_URODZENIA", /const WZORCE_DATY_URODZENIA: \[RegExp, string\]\[\] = \[[\s\S]*?\n\];/),
  wytnij("zlozDate", /function zlozDate\(rok, miesiac, dzien\)\{[\s\S]*?\n\}/),
  wytnij("dataUrodzeniaZTekstu", /function dataUrodzeniaZTekstu\(tekst\)\{[\s\S]*?\n\}/),
  wytnij("wiekZDaty", /function wiekZDaty\(data\)\{[\s\S]*?\n\}/),
].join("\n").replace(/: \[RegExp, string\]\[\]/, "");

const { dataUrodzeniaZTekstu } = new Function(`${kod}\n return { dataUrodzeniaZTekstu };`)();

console.log("\n1. Zapis, którego używa polski Transfermarkt");
{
  // Wprost ze strony klubu: „27 lut 2005 (21)".
  for (const [tekst, oczekiwana] of [
    ["Bramkarz 27 lut 2005 (21) Ukraina", "2005-02-27"],
    ["Bramkarz 1 cze 1988 (38) Polska", "1988-06-01"],
    ["Bramkarz 14 mar 2008 (18) Polska", "2008-03-14"],
    ["Lewy obrońca 25 lis 2009 (16) Polska", "2009-11-25"],
    ["Ofensywny pomocnik 9 lip 2010 (16) Polska", "2010-07-09"],
    ["Środkowy napastnik 2 gru 2008 (17) Polska", "2008-12-02"],
  ]) {
    sprawdz(tekst.slice(0, 34), dataUrodzeniaZTekstu(tekst) === oczekiwana, dataUrodzeniaZTekstu(tekst));
  }
  // Październik ma w skrócie polski znak — bez niego przepadałby co dwunasty zawodnik.
  sprawdz("październik z ogonkiem", dataUrodzeniaZTekstu("1 paź 1995 (31)") === "1995-10-01",
    dataUrodzeniaZTekstu("1 paź 1995 (31)"));
  sprawdz("październik bez ogonka", dataUrodzeniaZTekstu("1 paz 1995 (31)") === "1995-10-01",
    dataUrodzeniaZTekstu("1 paz 1995 (31)"));
}

console.log("\n2. Pozostałe zapisy");
{
  sprawdz("z kropkami", dataUrodzeniaZTekstu("27.02.2005") === "2005-02-27", dataUrodzeniaZTekstu("27.02.2005"));
  sprawdz("ISO", dataUrodzeniaZTekstu("2005-02-27") === "2005-02-27", dataUrodzeniaZTekstu("2005-02-27"));
  sprawdz("angielski skrót", dataUrodzeniaZTekstu("27 Feb 2005 (21)") === "2005-02-27",
    dataUrodzeniaZTekstu("27 Feb 2005 (21)"));
}

console.log("\n3. Wiek w nawiasie rozstrzyga, która data jest datą urodzenia");
{
  // W bloku zawodnika stoi kilka dat: urodzenia, wejścia do klubu, końca umowy. Wzięcie
  // „pierwszej z brzegu" wpisałoby komuś jako datę urodzenia dzień podpisania kontraktu —
  // a zła data jest gorsza niż jej brak, bo po cichu przekłamie ocenę wieku względnego.
  const wiek = new Date().getFullYear() - 2005;
  const blok = `Bramkarz 1 lip 2024 Zawisza 27 lut 2005 (${wiek}) Umowa do 30 cze 2027`;
  sprawdz("bierzemy tę z wiekiem obok", dataUrodzeniaZTekstu(blok) === "2005-02-27", dataUrodzeniaZTekstu(blok));
  // Gdy wieku nigdzie nie ma, zostaje pierwsza sensowna data — nic lepszego nie wiemy.
  sprawdz("bez wieku bierzemy pierwszą", dataUrodzeniaZTekstu("27 lut 2005 i 1 sty 2020") === "2005-02-27",
    dataUrodzeniaZTekstu("27 lut 2005 i 1 sty 2020"));
}

console.log("\n4. Śmieci nie stają się datą");
{
  for (const [opis, tekst] of [
    ["sam rocznik", "Bramkarz 2005 Polska"],
    ["wynik meczu", "Wygrana 3 2 2005"],
    ["miesiąc 13", "27.13.2005"],
    ["rok 1812", "27 lut 1812"],
    ["nic", "Bramkarz Polska"],
  ]) {
    sprawdz(opis, dataUrodzeniaZTekstu(tekst) === "" || !/^18/.test(dataUrodzeniaZTekstu(tekst)),
      [opis, dataUrodzeniaZTekstu(tekst)]);
  }
  sprawdz("sam rocznik to nie data", dataUrodzeniaZTekstu("Bramkarz 2005 Polska") === "",
    dataUrodzeniaZTekstu("Bramkarz 2005 Polska"));
  const przyszlosc = new Date().getFullYear() + 1;
  sprawdz("rok z przyszłości", dataUrodzeniaZTekstu(`27 lut ${przyszlosc}`) === "",
    dataUrodzeniaZTekstu(`27 lut ${przyszlosc}`));
}

console.log("\n5. Data dochodzi aż do kartoteki");
{
  // Sam odczyt nic nie daje, jeśli zapis dalej wstawia pustą datę — a tak było przez cały czas.
  sprawdz("nowy zawodnik dostaje datę", /birthDate: p\.birthDate \|\| ''/.test(zrodlo));
  sprawdz("istniejącemu uzupełniamy brakującą",
    /if\(p\.birthDate && !istniejacy\.birthDate\)/.test(zrodlo));
  // Nic wpisanego wcześniej nie może zostać nadpisane importem.
  sprawdz("ale nie nadpisujemy wpisanej", !/istniejacy\.birthDate = p\.birthDate;\s*\n\s*\}\s*\n\s*istniejacy\.birthDate/.test(zrodlo));
  sprawdz("podgląd pokazuje datę, nie sam rok", /p\.birthDate\s*\n?\s*\?\s*`<strong>\$\{esc\(p\.birthDate/.test(zrodlo));
  // Rocznik liczony z pełnej daty jest pewniejszy niż cztery cyfry wyłuskane z linii.
  sprawdz("rocznik z daty, gdy data jest", /birthYear = birthDate \? birthDate\.slice\(0, 4\)/.test(zrodlo));
}

console.log("\n6. Datę widać w profilu — i widać kwartał");
{
  // Zgłoszenie (30.10.2026): „wgrałem, ale nie ma dat urodzenia". Import zapisywał datę, ale
  // w tabeli „Informacje" nie było wiersza, który by ją pokazywał — więc nie dało się sprawdzić,
  // czy cokolwiek weszło. Dane niewidoczne to z punktu widzenia użytkownika dane, których nie ma.
  const kod2 = [
    wytnij("kwartalUrodzenia", /function kwartalUrodzenia\(p\)\{[\s\S]*?\n\}/),
    wytnij("dataUrodzeniaHtml", /function dataUrodzeniaHtml\(p\)\{[\s\S]*?\n\}/),
  ].join("\n");
  const { kwartalUrodzenia, dataUrodzeniaHtml } =
    new Function("esc", `${kod2}\n return { kwartalUrodzenia, dataUrodzeniaHtml };`)((s) => String(s ?? ""));

  sprawdz("styczeń to I kwartał", kwartalUrodzenia({ birthDate: "2007-01-03" }) === 1);
  sprawdz("marzec to I kwartał", kwartalUrodzenia({ birthDate: "2007-03-31" }) === 1);
  sprawdz("kwiecień to II kwartał", kwartalUrodzenia({ birthDate: "2007-04-01" }) === 2);
  sprawdz("lipiec to III kwartał", kwartalUrodzenia({ birthDate: "2009-07-19" }) === 3);
  sprawdz("grudzień to IV kwartał", kwartalUrodzenia({ birthDate: "2007-12-28" }) === 4);
  // Z samego rocznika kwartału nie da się policzyć i nie udajemy, że się da.
  sprawdz("sam rocznik nie daje kwartału", kwartalUrodzenia({ birthYear: "2007" }) === null);
  sprawdz("bez daty kreska", dataUrodzeniaHtml({ birthYear: "2007" }) === "—",
    dataUrodzeniaHtml({ birthYear: "2007" }));

  const html = dataUrodzeniaHtml({ birthDate: "2005-02-27" });
  sprawdz("data po polsku", /27\.02\.2005/.test(html), html);
  sprawdz("kwartał obok daty", /I kwartał/.test(html), html);
  sprawdz("wiersz jest w tabeli Informacje", /Data urodzenia<\/td><td>\$\{dataUrodzeniaHtml\(p\)\}/.test(zrodlo));
}

console.log("\n7. Na listach widać datę, nie sam rocznik");
{
  // Zgłoszenie (30.10.2026): „nadal nie ma daty, a wgrałem". Data była zapisana, ale listy
  // pokazywały dalej sam rok — więc po imporcie nie dało się jednym spojrzeniem sprawdzić,
  // komu metryczka weszła. Przy 68 zawodnikach w klubie to różnica między widzeniem pokrycia
  // a otwieraniem profilu po profilu.
  const kod3 = [
    wytnij("kwartalUrodzenia", /function kwartalUrodzenia\(p\)\{[\s\S]*?\n\}/),
    wytnij("rocznikHtml", /function rocznikHtml\(p\)\{[\s\S]*?\n\}/),
  ].join("\n");
  const { rocznikHtml } = new Function(
    "esc", "rocznikZawodnika", "odznakaMlodszego", "isYouthPlayer", "youthBadge", "limitRocznikaKategorii",
    `${kod3}\n return { rocznikHtml };`)(
    (s) => String(s ?? ""), (p) => String(p.birthYear || ""), () => "", () => false, () => "", () => null);

  const zData = rocznikHtml({ birthDate: "2005-02-27", birthYear: "2005" });
  sprawdz("data zamiast rocznika", /27\.02\.2005/.test(zData), zData);
  sprawdz("kwartał w podpowiedzi", /I kwartał/.test(zData), zData);
  // Bez daty nic się nie zmienia — rocznik działa jak dotąd.
  sprawdz("sam rocznik zostaje rocznikiem", rocznikHtml({ birthYear: "2005" }) === "2005",
    rocznikHtml({ birthYear: "2005" }));
  // Połowiczna data to nie data. Lepiej pokazać rocznik niż „2005-02-".
  sprawdz("ucięta data nie przechodzi", rocznikHtml({ birthDate: "2005-02", birthYear: "2005" }) === "2005",
    rocznikHtml({ birthDate: "2005-02", birthYear: "2005" }));
}

console.log("\n8. Widok klubu mówi, ilu zawodników ma datę");
{
  // Po imporcie pierwsze pytanie brzmi „weszło czy nie weszło", a przy kilkudziesięciu
  // zawodnikach odpowiedź wymagała otwierania profilu po profilu.
  sprawdz("licznik dat w podsumowaniu klubu", /z datą urodzenia <strong>\$\{zData\}/.test(zrodlo));
  sprawdz("liczy tylko pełne daty", /zData = gracze\.filter\(p=>\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//.test(zrodlo));
}

console.log(bledy ? `\nBŁĘDÓW: ${bledy}\n` : "\nWszystko w porządku.\n");
process.exit(bledy ? 1 : 0);
