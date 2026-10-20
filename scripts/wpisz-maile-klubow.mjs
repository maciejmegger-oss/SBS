// WPISANIE ZEBRANYCH E-MAILI KLUBÓW DO ARKUSZA „Kluby_Polska_Adresy.xlsx".
//
// Zgłoszenie (20.10.2026): „uzupełnisz jeszcze e-maile do klubów, są na stronach oficjalnych,
// przejrzyj sieć i uzupełnij". Arkusz miał 111 klubów bez adresu — część dlatego, że klub chowa
// adres przed botami (Cloudflare), część dlatego, że wcześniejsze podejście czytało tylko wyniki
// wyszukiwarki, a nie same strony.
//
// Skąd dane: wyłącznie ze stron, które klub prowadzi albo z baz klubowych wojewódzkich związków
// (ZZPN, WMZPN). Każdy wpis ma w arkuszu odnośnik do strony, z której pochodzi — zgodnie z zasadą
// przyjętą w Kontaktach: „adresów z komercyjnych baz ani zgadywanych z domeny tu nie ma".
// Prywatnych adresów działaczy nie wpisujemy; gdy klub podaje wyłącznie adres osoby pełniącej
// funkcję (dyrektor, kierownik), zapisujemy go i mówimy w uwagach, czyj to adres.
//
// Uruchomienie:  node scripts/wpisz-maile-klubow.mjs <plik-z-adresami.json>
// Potem:         node scripts/wczytaj-adresy-klubow.mjs Kluby_Polska_Adresy.xlsx
import fs from "node:fs";
import * as XLSX from "xlsx";

const PLIK = "Kluby_Polska_Adresy.xlsx";
const zrodlo = process.argv[2];
if (!zrodlo) { console.error("Podaj plik JSON ze znalezionymi adresami."); process.exit(1); }
const znalezione = JSON.parse(fs.readFileSync(zrodlo, "utf8"));

const skoroszyt = XLSX.read(fs.readFileSync(PLIK), { type: "buffer" });
const arkusz = skoroszyt.Sheets["Adresy"];
if (!arkusz) { console.error("Brak arkusza „Adresy”."); process.exit(1); }
const wiersze = XLSX.utils.sheet_to_json(arkusz, { defval: "" });

// Stare uwagi mówiły najczęściej „e-maila nie znalazłem" albo „skopiuj ze strony". Po wpisaniu
// adresu to już nieprawda, więc takie fragmenty usuwamy, a resztę (telefony, ostrzeżenia o innych
// podmiotach) zostawiamy — to dalej jest wiedza, której nie ma skąd odtworzyć.
// Fragment z "@" też odpada: stare uwagi opisywały albo adres, którego brakowało, albo cudzy
// adres wzięty omyłkowo za klubowy. Oba wątki rozstrzyga teraz notka pisana przy znalezieniu
// adresu, a zostawienie starej wersji obok dawałoby w jednym wierszu dwie sprzeczne instrukcje.
const NIEAKTUALNE = /e-?mail|maila|do uzupełnienia|skopiuj ze strony|nie znalazłem|ukryt|nie jest publiczny|prywatn|@/i;
const oczysc = (uwagi) => String(uwagi || "").split(";")
  .map((s) => s.trim()).filter((s) => s && !NIEAKTUALNE.test(s)).join("; ");

let wpisanych = 0, pominietych = 0;
const nieznalezioneKlucze = new Set(Object.keys(znalezione));

for (const w of wiersze) {
  const klub = String(w["Klub"] || "").trim();
  const dane = znalezione[klub];
  if (!dane) continue;
  nieznalezioneKlucze.delete(klub);
  if (String(w["E-mail klubu"] || "").trim()) { pominietych++; continue; }  // już coś jest — nie ruszamy

  const stareZrodlo = String(w["Źródło"] || "").trim();
  const maAdres = !!String(w["Adres obiektu"] || "").trim();
  const czesci = [dane.uwagi, oczysc(w["Uwagi"])].filter(Boolean);
  // Źródło w arkuszu jest jedno, a teraz wskazuje stronę z e-mailem. Skąd wziął się adres
  // obiektu, zapisujemy w uwagach — inaczej ta informacja by przepadła.
  if (stareZrodlo && maAdres && stareZrodlo !== dane.zrodlo) czesci.push(`adres obiektu wg: ${stareZrodlo}`);

  w["E-mail klubu"] = dane.email;
  w["Źródło"] = dane.zrodlo;
  w["Status"] = maAdres ? "Zweryfikowany" : "Częściowo";
  w["Uwagi"] = czesci.join("; ");
  wpisanych++;
}

const kolejnosc = ["Liga / grupa", "Klub", "Miasto", "Adres obiektu", "E-mail klubu", "Źródło", "Status", "Uwagi"];
skoroszyt.Sheets["Adresy"] = XLSX.utils.json_to_sheet(wiersze, { header: kolejnosc });
XLSX.writeFile(skoroszyt, PLIK);

console.log(`Wpisanych adresów: ${wpisanych}`);
if (pominietych) console.log(`Pominiętych (klub miał już e-mail): ${pominietych}`);
if (nieznalezioneKlucze.size) {
  console.log(`\nNIE DOPASOWANO do żadnego wiersza (sprawdź pisownię nazwy):`);
  [...nieznalezioneKlucze].forEach((k) => console.log("  - " + k));
}
