// POBIERANIE LISTY TALENTÓW DO EXCELA.
//
// Zgłoszenie (09.11.2026): „zrób przycisk pobierania listy w zakładkach talent, Excel”.
//
// Najważniejsza rzecz w tym teście nie dotyczy Excela, tylko ZGODNOŚCI Z EKRANEM. Przy arkuszu
// komitetu eksport miał własny warunek doboru i brał z bazy więcej, niż pokazywała lista — co
// skończyło się trzema zgłoszeniami „pobiera całość”. Tutaj widok i pobieranie muszą pytać
// o jedno i to samo: talentyWidoczne().
//
// Uruchomienie:  node scripts/test-arkusz-talentow.mjs
import fs from "node:fs";
import * as XLSX from "xlsx";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

console.log("\n1. Arkusz zawiera to, co widać na ekranie");
// Podpis przyjmuje teraz flagę pomijającą podział na kluby polskie/zagraniczne — stąd luźniejszy
// wzorzec. Liczy się to, że dobór jest W JEDNYM miejscu, a nie jak dokładnie go wywołujemy.
sprawdz("dobór talentów siedzi w jednej funkcji", /function talentyWidoczne\(/.test(zrodlo));
sprawdz("widok z niej korzysta", /const widoczne = talentyWidoczne\(\);/.test(zrodlo));
sprawdz("pobieranie korzysta z tej samej funkcji",
  /function pobierzArkuszTalentow\(\)\{[\s\S]{0,400}?const lista = talentyWidoczne\(\);/.test(zrodlo));
// Gdyby eksport odtwarzał warunki po swojemu, prędzej czy później rozjechałby się z listą.
sprawdz("eksport nie filtruje DB.talents po swojemu",
  !/function pobierzArkuszTalentow\(\)\{[\s\S]{0,1200}?DB\.talents\.filter/.test(zrodlo));
sprawdz("uwzględnia zakładkę, rocznik, kraj i wyszukiwanie",
  /wRocznikuTalentu\(t, talentRocznik\)/.test(zrodlo)
  && /krajEuropy\(t\) === talentKraj/.test(zrodlo)
  && /talentPasuje\(t, talentSzukaj\)/.test(zrodlo));

console.log("\n2. Przycisk");
sprawdz("przycisk jest w pasku zakładki Talent", /data-action="talent-arkusz"/.test(zrodlo));
sprawdz("jest podpięty", /\[data-action="talent-arkusz"\]'\)\.forEach\(b=>b\.onclick=\(\)=>pobierzArkuszTalentow\(\)\)/.test(zrodlo));
// Liczba na przycisku to najtańsze zabezpieczenie przed „pobiera co innego niż widzę”.
sprawdz("na przycisku stoi liczba wierszy, które trafią do pliku",
  /⭳ Pobierz listę \(\$\{rows\.length\}\)/.test(zrodlo));
sprawdz("przy pustej liście przycisk jest wyłączony", /\$\{rows\.length \? '' : 'disabled'\}/.test(zrodlo));
sprawdz("podpowiedź mówi, że pobiera widoczną zakładkę",
  /dokładnie tę listę, którą teraz widzisz/.test(zrodlo));
sprawdz("pusta lista kończy się komunikatem, nie pustym plikiem",
  /W tej zakładce nie ma nikogo do zapisania/.test(zrodlo));

console.log("\n3. Kolejność wierszy i nazwa pliku");
{
  // Kopia reguły sortowania: rocznik rosnąco, w roczniku alfabetycznie, bez rocznika na koniec.
  const sortuj = (lista) => lista.slice().sort((a, b) => {
    const ra = Number(a.birthYear) || null, rb = Number(b.birthYear) || null;
    if (ra !== rb) { if (ra == null) return 1; if (rb == null) return -1; return ra - rb; }
    return String(a.lastName || "").localeCompare(String(b.lastName || ""), "pl")
      || String(a.firstName || "").localeCompare(String(b.firstName || ""), "pl");
  });
  const w = sortuj([
    { lastName: "Zalewski", birthYear: 2008 }, { lastName: "Adamczyk", birthYear: 2009 },
    { lastName: "Nowak", birthYear: null }, { lastName: "Bąk", birthYear: 2008 },
  ]).map((x) => x.lastName + "/" + (x.birthYear || "-"));
  sprawdz("starszy rocznik pierwszy, w roczniku alfabetycznie, bez rocznika na końcu",
    w.join(" ") === "Bąk/2008 Zalewski/2008 Adamczyk/2009 Nowak/-", w.join(" "));
}
{
  const doNazwy = (s) => String(s).toLowerCase()
    .replace(/[łøđ]/g, (c) => ({ "ł": "l", "ø": "o", "đ": "d" }[c]))
    .normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  sprawdz("nazwa pliku bez polskich znaków i spacji",
    doNazwy("Talent klubowy — rocznik 2009") === "talent-klubowy-rocznik-2009", doNazwy("Talent klubowy — rocznik 2009"));
  sprawdz("kadra w nazwie pliku też się czyści", doNazwy("Kadra U-17") === "kadra-u-17");
}
sprawdz("nazwa zakładki liczona osobno, więc trafia i do pliku, i do nagłówka arkusza",
  /function opisZakladkiTalentow\(\)\{/.test(zrodlo));
// Excel odrzuca nazwy arkuszy dłuższe niż 31 znaków i z częścią znaków — bez przycięcia
// zapis po prostu się wywala.
sprawdz("nazwa arkusza przycięta do limitu Excela",
  /\.replace\(\/\[\\\\\/\?\*\[\\\]:\]\/g, ' '\)\.slice\(0, 31\)/.test(zrodlo));

console.log("\n4. Zawartość arkusza");
const naglowkiZKodu = /const naglowki = \[([^\]]+)\]/.exec(
  zrodlo.slice(zrodlo.indexOf("function pobierzArkuszTalentow")));
sprawdz("nagłówki obejmują rocznik, nazwisko, klub i kadrę", !!naglowkiZKodu
  && /Rocznik/.test(naglowkiZKodu[1]) && /Nazwisko/.test(naglowkiZKodu[1])
  && /Klub/.test(naglowkiZKodu[1]) && /Kadra/.test(naglowkiZKodu[1]));
// „W bazie” odróżnia talent, którego trzeba dopiero założyć, od takiego, który ma już kartotekę —
// przy liście do obdzwonienia to pierwsza rzecz, którą trzeba wiedzieć.
sprawdz("arkusz mówi, czy zawodnik ma już kartotekę", /'W bazie'/.test(zrodlo)
  && /karta \? 'tak' : 'nie'/.test(zrodlo));
sprawdz("dla Europy dochodzą minuty, mecze, gole i asysty", /const s = statTalentu\(t\);/.test(zrodlo));
sprawdz("nagłówek przymrożony i filtry — jak w arkuszu komitetu",
  /function pobierzArkuszTalentow\(\)[\s\S]{0,4000}?ws\['!freeze'\][\s\S]{0,300}?ws\['!autofilter'\]/.test(zrodlo));

console.log("\n5. Biblioteka naprawdę zapisuje taki arkusz");
{
  const naglowki = ["Rocznik", "Nazwisko", "Imię", "Pozycja", "Klub", "Liga", "Kraj",
    "Kadra", "Minuty", "Mecze", "Gole", "Asysty", "W bazie", "Transfermarkt"];
  const wiersze = [[2009, "Bąk", "Michał", "Napastnik", "Zawisza Bydgoszcz", "CLJ U17", "", "U-17", 540, 8, 4, 2, "nie", ""]];
  const ws = XLSX.utils.aoa_to_sheet([naglowki, ...wiersze]);
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 1, c: naglowki.length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Kadra U-17");
  const bufor = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  sprawdz("plik .xlsx powstaje i nie jest pusty", bufor && bufor.length > 2000, String(bufor && bufor.length));
  const odczyt = XLSX.utils.sheet_to_json(XLSX.read(bufor, { type: "buffer" }).Sheets["Kadra U-17"]);
  sprawdz("po odczycie wiersz ma polskie znaki i właściwe pola",
    odczyt.length === 1 && odczyt[0]["Nazwisko"] === "Bąk" && odczyt[0]["Minuty"] === 540,
    JSON.stringify(odczyt[0] || {}));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
