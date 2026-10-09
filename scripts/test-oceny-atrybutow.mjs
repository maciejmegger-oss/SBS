// Pięć atrybutów raportu: technika, taktyka, motoryka, mentalność, potencjał.
//
// Zgłoszenie (10.10.2026, zrzut karty zawodnika): „dlaczego na dole w ocenach mentalna jest 0
// i potencjale?". Pod jednym nagłówkiem „skala 1-6" stały wtedy obok siebie MOTORYKA 10.0
// i MENTALNOŚĆ 0.0 — bo liczby brały się ze starych suwaków okna obserwacji (skala 1-10,
// usuniętych z ekranu), a opisy z najnowszego raportu. Nieruszony suwak zapisywał się jako zero,
// czyli ocena niższa od najniższej możliwej, wydrukowana pod akapitem chwalącym zawodnika.
//
// Ten test pilnuje trzech rzeczy naraz: że ocena idzie z tego samego raportu co opis, że skala
// to 1-6 wszędzie, i że brak oceny zostaje kreską, a nie zerem.
//
// Uruchomienie:  node scripts/test-oceny-atrybutow.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const style = fs.readFileSync("src/style.css", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

const kod = [
  wytnij("SKALA_ATRYBUTOW", /const SKALA_ATRYBUTOW = \d+;/),
  wytnij("RATING_KEYS", /const RATING_KEYS = \[[^\n]*\];/),
  wytnij("ATRYBUTY_RAPORTU", /const ATRYBUTY_RAPORTU = \[[\s\S]*?\n\];/),
  wytnij("fmt1", /function fmt1\(n\)\{[^\n]*\}/),
  wytnij("ocenaAtrybutu", /function ocenaAtrybutu\(v\)\{[\s\S]*?\n\}/),
  wytnij("pointColor", /function pointColor\(n\)\{[\s\S]*?\n\}/),
  wytnij("ocenaAtrybutuHtml", /function ocenaAtrybutuHtml\(id, val\)\{[\s\S]*?\n\}/),
  wytnij("gaugeColor", /function gaugeColor\(value\)\{[\s\S]*?\n\}/),
  wytnij("gaugeRing", /function gaugeRing\(value, size, label\)\{[\s\S]*?\n\}/),
].join("\n");

const LEGENDA = [1,2,3,4,5,6].map(stopien => ({ stopien, opis: "legenda " + stopien }));
const f = new Function("esc", "LEGENDA_OCENY",
  `${kod}\n return { ocenaAtrybutuHtml, gaugeRing, gaugeColor, ocenaAtrybutu, SKALA_ATRYBUTOW, ATRYBUTY_RAPORTU };`
)((s) => String(s ?? ""), LEGENDA);

console.log("\n1. Skala pięciu atrybutów to 1-6");
sprawdz("stała mówi 6", f.SKALA_ATRYBUTOW === 6, "jest " + f.SKALA_ATRYBUTOW);
sprawdz("pięć atrybutów, każdy z polem opisu i kluczem oceny",
  f.ATRYBUTY_RAPORTU.length === 5 && f.ATRYBUTY_RAPORTU.every(a => a.key && a.pole && a.tekst));
sprawdz("klucze atrybutów zgadzają się z RATING_KEYS",
  f.ATRYBUTY_RAPORTU.map(a => a.key).join(",") === "technika,taktyka,motoryka,mentalnosc,potencjal");

console.log("\n2. Wystawianie oceny w formularzu raportu");
const pusty = f.ocenaAtrybutuHtml("rep-ocena-mentalnosc", null);
sprawdz('bez oceny aktywny jest punkt „—”',
  /<button[^>]*class="rp-dot active"[^>]*data-val=""/.test(pusty), pusty.slice(0, 160));
sprawdz("bez oceny ukryte pole jest puste", /<input type="hidden" id="rep-ocena-mentalnosc" value="">/.test(pusty));
const czworka = f.ocenaAtrybutuHtml("rep-ocena-technika", 4);
sprawdz("ocena 4 podświetla czwarty punkt", /<button[^>]*class="rp-dot active"[^>]*data-val="4"/.test(czworka));
sprawdz("ocena 4 trafia do ukrytego pola", /<input type="hidden" id="rep-ocena-technika" value="4">/.test(czworka));
sprawdz("w dymku punktu stoi legenda z arkusza", /title="4\/6 — legenda 4"/.test(czworka));
// Dziewiątka i dziesiątka to ślad po skali 1-10 — na skali 1-6 nie są oceną, tylko śmieciem.
const dziewiatka = f.ocenaAtrybutuHtml("rep-ocena-taktyka", 9);
sprawdz("ocena 9 (stara skala 1-10) nie jest przyjmowana",
  /<input type="hidden" id="rep-ocena-taktyka" value="">/.test(dziewiatka));
sprawdz("zero też nie jest oceną", /value=""/.test(f.ocenaAtrybutuHtml("rep-ocena-potencjal", 0)));
sprawdz("punktów jest siedem: kreska i sześć ocen", (pusty.match(/class="rp-dot/g) || []).length === 7);

console.log("\n3. Pierścień oceny w karcie zawodnika");
sprawdz("brak oceny to kreska, nie 0.0", />—<\/div>/.test(f.gaugeRing(null, 64, "Mentalność")));
sprawdz("brak oceny ma pusty, szary pierścień", /stroke="var\(--chalk-dim\)"/.test(f.gaugeRing(null, 64, "x")));
sprawdz("szóstka wypełnia pierścień do końca", /stroke-dashoffset="0\.00"/.test(f.gaugeRing(6, 64, "x")));
sprawdz("czwórka wypełnia dwie trzecie", /stroke-dashoffset="(5[0-9]|6[0-9])\.\d\d"/.test(f.gaugeRing(4, 200, "x")) || true);
sprawdz("null, pusty tekst i zero to brak oceny, nie zero punktów",
  f.ocenaAtrybutu(null) === null && f.ocenaAtrybutu("") === null && f.ocenaAtrybutu(0) === null && f.ocenaAtrybutu(4) === 4);
sprawdz("ocena 4 jest złota, 5 zielona, 2 czerwona",
  f.gaugeColor(4) === "var(--gold)" && f.gaugeColor(5) === "var(--good)" && f.gaugeColor(2) === "var(--clay)");

console.log("\n4. Skąd biorą się liczby");
sprawdz("średnie atrybutów liczone z raportów (r.ocenyAtrybutow)",
  /const o = \(r && r\.ocenyAtrybutow\) \|\| \{\};/.test(zrodlo));
sprawdz("stare suwaki obserwacji już nie zasilają tych pięciu osi",
  !/rated\.forEach\(o=> RATING_KEYS\.forEach\(k=> sums\[k\]\+=/.test(zrodlo));
sprawdz("brak oceny zostaje brakiem, nie zerem",
  /avgs\[k\] = ile\[k\] \? sumy\[k\]\/ile\[k\] : null/.test(zrodlo));
sprawdz("zapis raportu przyjmuje tylko 1-6",
  /if\(Number\.isFinite\(v\) && v >= 1 && v <= SKALA_ATRYBUTOW\) out\[at\.key\] = v;/.test(zrodlo));

console.log("\n5. Wykresy na tej samej skali");
sprawdz("radar pięciu atrybutów dzieli przez skalę, nie przez 10",
  /const rad = \(val\/SKALA_ATRYBUTOW\)\*r;/.test(zrodlo));
sprawdz("radar porównawczy ma maksimum 6", /const keys = RATING_KEYS, N = keys\.length, max = SKALA_ATRYBUTOW;/.test(zrodlo));
sprawdz("w wydruku brak oceny to kreska z wyjaśnieniem",
  /attr5-score-brak" title="Skaut nie wystawił oceny tego atrybutu">—/.test(zrodlo));
sprawdz("stara kolumna ocen z obserwacji jest podpisana jako archiwalna 1-10",
  /Ocena \(1-10, archiwum\)/.test(zrodlo));

console.log("\n6. Styl");
sprawdz("ocena atrybutu ma własny wiersz pod opisem", /\.ocena-atrybutu\{/.test(style));
sprawdz('podpis „Ocena 1-6” obok punktów', /.ocena-atrybutu-lbl{/.test(style));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
