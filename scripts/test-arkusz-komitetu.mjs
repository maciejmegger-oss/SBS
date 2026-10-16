// Arkusz „do obserwacji i transferu” — lista do pobrania z Komitetu Transferowego.
//
// Zgłoszenie (16.10.2026): „zrób pobieranie w formie listy excel zawodników do obserwacji
// i transferu, chronologicznie od najstarszego rocznika, a potem w roczniku według alfabetu".
//
// Uruchomienie:  node scripts/test-arkusz-komitetu.mjs
import fs from "node:fs";
import * as XLSX from "xlsx";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

// --- kopia logiki doboru i kolejności z main.ts ---------------------------------------------
const DAWNE = { "Zatwierdzony": "Do transferu", "Do dalszej analizy": "Do Obserwacji", "Odrzucony przez komitet": "Odrzucony" };
const decyzjaKomitetu = (p) => DAWNE[String(p.committeeDecision || "")] || String(p.committeeDecision || "");
const STATUSY = ["Do transferu", "Do Obserwacji"];
const norm = (s) => String(s || "").trim().toLowerCase();
const pasuje = (s) => STATUSY.some((x) => norm(x) === norm(s));
const ZAMKNIETE = ["Odrzucony", "Podpisany"];
const doArkusza = (p) => !ZAMKNIETE.some((x) => norm(x) === norm(p.status))
  && (pasuje(p.status) || pasuje(decyzjaKomitetu(p)));
const rocznik = (p) => p.birthYear || null;

const posortuj = (lista) => lista.slice().sort((a, b) => {
  const ra = Number(rocznik(a)) || null;
  const rb = Number(rocznik(b)) || null;
  if (ra !== rb) {
    if (ra == null) return 1;
    if (rb == null) return -1;
    return ra - rb;
  }
  return String(a.lastName || "").localeCompare(String(b.lastName || ""), "pl")
    || String(a.firstName || "").localeCompare(String(b.firstName || ""), "pl");
});

console.log("\n1. Kto wchodzi na listę");
sprawdz("status „Do transferu” wchodzi", doArkusza({ status: "Do transferu" }));
sprawdz("status „Do Obserwacji” wchodzi", doArkusza({ status: "Do Obserwacji" }));
// „W obserwacji” to trzeci, osobny stan: zawodnik, którego JUŻ się ogląda. Na liście roboczej
// nie ma przy nim nic do zdecydowania, a przy 35 takich osobach zasłaniałby tych, przy których jest.
sprawdz("„W obserwacji” NIE wchodzi — to kto inny niż „Do Obserwacji”",
  !doArkusza({ status: "W obserwacji" }));
sprawdz("sama decyzja komitetu wystarczy — to osobne pole od statusu",
  doArkusza({ status: "Nowy typ", committeeDecision: "Do transferu" }));
sprawdz("dawna nazwa decyzji rozpoznana", doArkusza({ status: "", committeeDecision: "Zatwierdzony" }));
sprawdz("odrzucony nie wchodzi, nawet ze stara decyzja komitetu „Do transferu”",
  !doArkusza({ status: "Odrzucony", committeeDecision: "Do transferu" }));
sprawdz("podpisany nie wchodzi, nawet z decyzja „Do Obserwacji”",
  !doArkusza({ status: "Podpisany", committeeDecision: "Do Obserwacji" }));
sprawdz("rekomendowany z decyzja „Do Obserwacji” wchodzi — sprawa jest otwarta",
  doArkusza({ status: "Rekomendowany", committeeDecision: "Do Obserwacji" }));
sprawdz("podpisany nie wchodzi", !doArkusza({ status: "Podpisany" }));
sprawdz("bez statusu nie wchodzi", !doArkusza({}));

console.log("\n2. Kolejność: rocznikami od najstarszego, w roczniku alfabetycznie");
const probka = [
  { lastName: "Zalewski", firstName: "Jan", birthYear: 2008 },
  { lastName: "Abacki", firstName: "Piotr", birthYear: 2008 },
  { lastName: "Nowak", firstName: "Adam", birthYear: 2001 },
  { lastName: "Kowalski", firstName: "Bartek", birthYear: 2005 },
  { lastName: "Bezrocznika", firstName: "Ktoś", birthYear: null },
  { lastName: "Nowak", firstName: "Zbigniew", birthYear: 2001 },
  { lastName: "Łąkowski", firstName: "Ewa", birthYear: 2005 },
];
const wynik = posortuj(probka).map((p) => `${p.birthYear || "—"} ${p.lastName} ${p.firstName}`);
const oczekiwane = [
  "2001 Nowak Adam",
  "2001 Nowak Zbigniew",
  "2005 Kowalski Bartek",
  "2005 Łąkowski Ewa",
  "2008 Abacki Piotr",
  "2008 Zalewski Jan",
  "— Bezrocznika Ktoś",
];
sprawdz("najstarszy rocznik na górze", wynik[0] === "2001 Nowak Adam", wynik[0]);
sprawdz("w roczniku alfabetycznie po nazwisku", wynik[2] === "2005 Kowalski Bartek", wynik[2]);
sprawdz("polskie znaki sortowane po polsku (Ł po K, nie na końcu)", wynik[3] === "2005 Łąkowski Ewa", wynik[3]);
sprawdz("przy tym samym nazwisku rozstrzyga imię", wynik[1] === "2001 Nowak Zbigniew", wynik[1]);
sprawdz("bez rocznika na samym końcu", wynik[wynik.length - 1] === "— Bezrocznika Ktoś", wynik[wynik.length - 1]);
sprawdz("cała kolejność zgodna", JSON.stringify(wynik) === JSON.stringify(oczekiwane), JSON.stringify(wynik));

console.log("\n3. Czy SheetJS przyjmuje taki arkusz");
{
  const naglowki = ["Rocznik", "Nazwisko", "Imię", "Pozycja", "Klub", "Liga", "Status",
    "Decyzja komitetu", "Śr. ocena", "Raportów", "Kontrakt do", "Notatka komitetu"];
  const wiersze = posortuj(probka).map((p) => [p.birthYear || "", p.lastName, p.firstName,
    "Napastnik", "Miedź Legnica", "I liga", "Do transferu", "Do rozpatrzenia", 4.25, 3, "2027-06-30", "—"]);
  const ws = XLSX.utils.aoa_to_sheet([naglowki, ...wiersze]);
  ws["!cols"] = naglowki.map(() => ({ wch: 16 }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: wiersze.length, c: naglowki.length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Do obserwacji i transferu");
  const bufor = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  sprawdz("plik powstaje i ma sensowny rozmiar", bufor.length > 2000, `${bufor.length} B`);

  // Odczyt z powrotem — czy Excel dostanie to, co chcieliśmy.
  const odczyt = XLSX.read(bufor, { type: "buffer" });
  const arkusz = odczyt.Sheets[odczyt.SheetNames[0]];
  const znowu = XLSX.utils.sheet_to_json(arkusz, { header: 1 });
  sprawdz("nazwa arkusza po polsku", odczyt.SheetNames[0] === "Do obserwacji i transferu", odczyt.SheetNames[0]);
  sprawdz("nagłówki na miejscu", JSON.stringify(znowu[0]) === JSON.stringify(naglowki));
  sprawdz("pierwszy wiersz to najstarszy rocznik", znowu[1][0] === 2001 && znowu[1][1] === "Nowak", JSON.stringify(znowu[1].slice(0, 3)));
  sprawdz("rocznik zapisany jako LICZBA, nie tekst — inaczej Excel nie posortuje",
    typeof znowu[1][0] === "number", typeof znowu[1][0]);
  sprawdz("średnia ocena też liczbą", typeof znowu[1][8] === "number", typeof znowu[1][8]);
  sprawdz("polskie znaki przetrwały zapis", znowu.some((r) => r[1] === "Łąkowski"));
}

console.log("\n4. Wpięcie w aplikację");
sprawdz("funkcja eksportu istnieje", /function pobierzArkuszKomitetu\(\)/.test(zrodlo));
sprawdz("przycisk jest w widoku Komitetu", /data-action="komitet-arkusz"/.test(zrodlo));
sprawdz("przycisk podpięty", /\[data-action="komitet-arkusz"\]'\)\.forEach\(b=>b\.onclick=\(\)=>pobierzArkuszKomitetu\(\)\)/.test(zrodlo));
sprawdz("obok przycisku widać rozbicie, nie samą sumę",
  /do transferu: \$\{doT\}, do obserwacji: \$\{doO\}/.test(zrodlo));
sprawdz("do arkusza wchodzą dokładnie dwa statusy, bez „W obserwacji”",
  /const STATUSY_DO_ARKUSZA = \['Do transferu', 'Do Obserwacji'\];/.test(zrodlo)
  && !/'W obserwacji'/.test(zrodlo.slice(zrodlo.indexOf("STATUSY_DO_ARKUSZA"), zrodlo.indexOf("STATUSY_DO_ARKUSZA") + 200)));
sprawdz("eksport melduje w konsoli, ilu zawodników zapisał",
  /Arkusz komitetu: \$\{posortowani\.length\} z \$\{DB\.players\.length\}/.test(zrodlo));
sprawdz("pusta lista mówi, co zrobić, zamiast zapisywać pusty plik",
  /Nikt nie ma statusu/.test(zrodlo));
sprawdz("nazwa pliku z datą", /do-obserwacji-i-transferu_\$\{dzisiaj\(\)\}\.xlsx/.test(zrodlo));
sprawdz("powód kolejności zapisany w kodzie",
  /zawodnik po dwudziestce piątce nie zyska na wartości/.test(zrodlo));
sprawdz("arkusz mowi, skad zawodnik wzial sie na liscie",
  /'Na liście przez'/.test(zrodlo) && /const powodNaLiscie = \(p\)=>/.test(zrodlo));
sprawdz("rozroznia status od decyzji komitetu",
  /'status \+ decyzja komitetu' : zeStatusu \? 'status' : 'decyzja komitetu'/.test(zrodlo));
sprawdz("sprawy zamkniete odpadaja z doboru",
  /const STATUSY_ZAMKNIETE = \['Odrzucony', 'Podpisany'\];/.test(zrodlo)
  && /if\(wStatusach\(STATUSY_ZAMKNIETE, p\.status\)\) return false;/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
