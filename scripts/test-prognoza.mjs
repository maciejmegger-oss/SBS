// Prognoza zawodnika — na jaki poziom go stać.
//
// Zgłoszenie (10.10.2026): „prognoza na podstawie: rozegranych minut min 180 (...) dwa ostatnie
// poziomy rozgrywek (...) ważne żeby przechodził kolejne szczeble i progresował. Ocena statystyk,
// jeśli obrońca ma gole to duży plus. (...) Wiek — trzy przedziały 15-21, 21-25, 26-30, najlepszy
// 2 i 3. Progresja — czy gra od początku meczu".
//
// Najważniejsze w tym teście nie są liczby, tylko ODMOWY: prognoza bez minut, bez historii sezonów
// albo bez oceny potencjału nie ma prawa się pojawić. To jedyna rzecz, która chroni produkt przed
// podaniem menedżerowi klubowemu liczby wziętej z powietrza.
//
// Uruchomienie:  node scripts/test-prognoza.mjs
import { buildSync } from "esbuild";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

const { outputFiles } = buildSync({
  stdin: {
    contents: `export * from './src/prognoza.ts';`,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "esm", write: false,
});
const M = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));

// ---- pomoce: budowanie przykładowego zawodnika --------------------------------------------------
const mecze = (ile, { minuty = 90, podstawowy = true, gole = 0 } = {}) =>
  Array.from({ length: ile }, () => ({ minuty, podstawowy, odMinuty: podstawowy ? 0 : 60, gole: 0 }))
    .map((m, i) => (i < gole ? { ...m, gole: 1 } : m));

const zawodnik = (nadpisz = {}) => ({
  wiek: 23,
  pozycja: "Pomocnik",
  poziomTeraz: "III liga, gr. II",
  przebieg: mecze(10),
  sezony: [
    { sezon: "2026/2027", rozgrywki: "III liga", wystepy: 10, wPodstawowym: 10, minuty: 900, gole: 1 },
    { sezon: "2025/2026", rozgrywki: "IV liga", wystepy: 24, wPodstawowym: 14, minuty: 1800, gole: 3 },
  ],
  ocenyAtrybutow: { technika: 4, taktyka: 4, motoryka: 4, mentalnosc: 4, potencjal: 4 },
  perspektywa: "WYSOKA",
  ...nadpisz,
});

console.log("\n1. Trzy twarde bramki — bez nich nie ma prognozy");
const malo = M.prognozaZawodnika(zawodnik({
  przebieg: mecze(1, { minuty: 60 }),
  sezony: [{ sezon: "2026/2027", rozgrywki: "III liga", wystepy: 1, wPodstawowym: 0, minuty: 60, gole: 0 }],
}));
sprawdz("poniżej 180 minut — prognozy nie ma", malo.mozliwa === false);
sprawdz("odmowa mówi wprost o minutach", malo.braki.some((b) => /180/.test(b)), malo.braki.join(" | "));

const bezHistorii = M.prognozaZawodnika(zawodnik({
  sezony: [{ sezon: "2026/2027", rozgrywki: "III liga", wystepy: 10, wPodstawowym: 10, minuty: 900, gole: 1 }],
}));
sprawdz("jeden sezon to za mało na ścieżkę — prognozy nie ma", bezHistorii.mozliwa === false);
sprawdz("odmowa podpowiada, skąd wziąć historię",
  bezHistorii.braki.some((b) => /90minut/.test(b)), bezHistorii.braki.join(" | "));

const bezOceny = M.prognozaZawodnika(zawodnik({ ocenyAtrybutow: { technika: 5 } }));
sprawdz("bez oceny potencjału w raporcie — prognozy nie ma", bezOceny.mozliwa === false);
sprawdz("odmowa wskazuje brakującą ocenę", bezOceny.braki.some((b) => /potencja/i.test(b)));

const nicNieMa = M.prognozaZawodnika({ wiek: 20, pozycja: "Obrońca", poziomTeraz: "IV liga",
  przebieg: [], sezony: [], ocenyAtrybutow: null, perspektywa: "" });
sprawdz("brakujące rzeczy wypisane NARAZ, nie po jednej", nicNieMa.braki.length === 3, JSON.stringify(nicNieMa.braki));

console.log("\n2. Sezon z garstką minut nie jest szczeblem");
const epizodWGorze = M.prognozaZawodnika(zawodnik({
  sezony: [
    { sezon: "2026/2027", rozgrywki: "II liga", wystepy: 2, wPodstawowym: 0, minuty: 40, gole: 0 },
    { sezon: "2025/2026", rozgrywki: "IV liga", wystepy: 24, wPodstawowym: 20, minuty: 1900, gole: 2 },
  ],
}));
sprawdz("dwa mecze w wyższej lidze nie liczą się jako awans", epizodWGorze.mozliwa === false,
  JSON.stringify(epizodWGorze.braki));

console.log("\n3. Stan faktyczny bierze się z minut, nie z opinii");
const r1 = M.rolaZPrzebiegu(mecze(10));
sprawdz('dziesięć pełnych meczów od pierwszej minuty to „kluczowy”', r1.rola === "kluczowy", r1.rola);
const r2 = M.rolaZPrzebiegu(mecze(10, { minuty: 30, podstawowy: false }));
sprawdz('same wejścia z ławki po pół godziny to „rotacyjny”', r2.rola === "rotacyjny", r2.rola);
const r3 = M.rolaZPrzebiegu(mecze(10, { minuty: 10, podstawowy: false }));
sprawdz('dziesięć minut na mecz to „epizod”', r3.rola === "epizod", r3.rola);
sprawdz("kluczowy w III lidze stoi wyżej niż podstawowy",
  M.stopienZaPoziom("III liga", "kluczowy") > M.stopienZaPoziom("III liga", "podstawowy"));
sprawdz("podstawowy w Ekstraklasie stoi wyżej niż kluczowy w II lidze",
  M.stopienZaPoziom("Ekstraklasa", "podstawowy") > M.stopienZaPoziom("II liga", "kluczowy"));
sprawdz("grupa w nazwie nie myli poziomu",
  M.stopienZaPoziom("IV liga (dolnośląska)", "podstawowy") === M.stopienZaPoziom("IV liga", "podstawowy"));

console.log("\n4. Wiek — przedział 2 i 3 z najwyższym mnożnikiem (wytyczna klubu)");
const m17 = M.prognozaZawodnika(zawodnik({ wiek: 17 }));
const m23 = M.prognozaZawodnika(zawodnik({ wiek: 23 }));
const m28 = M.prognozaZawodnika(zawodnik({ wiek: 28 }));
const m33 = M.prognozaZawodnika(zawodnik({ wiek: 33 }));
sprawdz("wszystkie cztery prognozy policzone", [m17, m23, m28, m33].every((x) => x.mozliwa));
sprawdz("dwudziestotrzylatek ma pułap nie niższy niż siedemnastolatek",
  m23.pulapDo >= m17.pulapDo, `17 lat: ${m17.pulapDo}, 23 lata: ${m23.pulapDo}`);
sprawdz("przedział 21-25 i 26-30 mają ten sam mnożnik",
  M.mnoznikWieku(23).mnoznik === M.mnoznikWieku(28).mnoznik);
sprawdz("po trzydziestce prognoza wzrostu niemal się zamyka",
  M.mnoznikWieku(33).mnoznik < M.mnoznikWieku(23).mnoznik && m33.pulapDo <= m23.pulapDo);
sprawdz("nieznany wiek liczony ostrożnie, nie najwyżej",
  M.mnoznikWieku(null).mnoznik < M.mnoznikWieku(23).mnoznik);

console.log("\n5. Ścieżka przez poziomy i gra od pierwszej minuty");
const wGore = M.sciezkaPoziomow(zawodnik().sezony);
sprawdz("awans z IV do III ligi rozpoznany", wGore.kierunek === "w górę", wGore.opis);
const wDol = M.sciezkaPoziomow([
  { rozgrywki: "IV liga", minuty: 900, wystepy: 12, wPodstawowym: 10 },
  { rozgrywki: "II liga", minuty: 1200, wystepy: 20, wPodstawowym: 15 },
]);
sprawdz("spadek o dwa poziomy rozpoznany", wDol.kierunek === "w dół", wDol.opis);
const start = M.progresjaStartow(zawodnik().sezony);
sprawdz("wzrost udziału gry od pierwszej minuty rozpoznany", start.kierunek === "w górę", start.opis);
const spadekStartow = M.progresjaStartow([
  { wystepy: 20, wPodstawowym: 4 }, { wystepy: 20, wPodstawowym: 18 },
]);
sprawdz("utrata miejsca w składzie rozpoznana", spadekStartow.kierunek === "w dół", spadekStartow.opis);
sprawdz("zawodnik schodzący w dół ma niższy pułap niż awansujący",
  M.prognozaZawodnika(zawodnik({
    poziomTeraz: "IV liga",
    sezony: [
      { rozgrywki: "IV liga", minuty: 900, wystepy: 12, wPodstawowym: 4, gole: 0 },
      { rozgrywki: "II liga", minuty: 1200, wystepy: 20, wPodstawowym: 18, gole: 0 },
    ],
  })).pulapDo < M.prognozaZawodnika(zawodnik()).pulapDo);

console.log("\n6. Gole liczone na tle pozycji — obrońca ze zdobyczą to plus");
const obronca = M.skutecznoscNaPozycji("Obrońca środkowy", 4, 900);
const napastnik = M.skutecznoscNaPozycji("Napastnik", 4, 900);
sprawdz("cztery gole obrońcy w 900 minut to wyraźny plus", obronca.punkty > 0, obronca.opis);
sprawdz("te same cztery gole napastnika plusem nie są", napastnik.punkty <= 0, napastnik.opis);
sprawdz("napastnik bez goli dostaje minus", M.skutecznoscNaPozycji("Napastnik", 0, 900).punkty < 0);
sprawdz("bramkarzowi skuteczności nie liczymy",
  M.skutecznoscNaPozycji("Bramkarz", 0, 900).punkty === 0 &&
  /bramkarz/i.test(M.skutecznoscNaPozycji("Bramkarz", 0, 900).opis));
sprawdz("przy zbyt małej liczbie minut skuteczności nie oceniamy",
  M.skutecznoscNaPozycji("Napastnik", 0, 90).punkty === 0);

console.log("\n7. Wynik mówi, na czym stoi");
const ok = M.prognozaZawodnika(zawodnik());
sprawdz("prognoza możliwa przy komplecie danych", ok.mozliwa === true);
sprawdz("pułap nie schodzi poniżej dzisiejszego poziomu", ok.pulapOd >= ok.stopienTeraz,
  `teraz ${ok.stopienTeraz}, pułap od ${ok.pulapOd}`);
sprawdz("pułap mieści się na drabinie 1-21", ok.pulapDo >= 1 && ok.pulapDo <= 21);
sprawdz("wynik to przedział, nie jedna liczba", ok.pulapDo >= ok.pulapOd);
sprawdz("każdy składnik ma nazwę, punkty i wyjaśnienie",
  ok.skladniki.length >= 5 && ok.skladniki.every((s) => s.nazwa && s.opis && Number.isFinite(s.punkty)));
sprawdz("wśród składników jest wiek, ścieżka i potencjał",
  ["Wiek", "Ścieżka przez poziomy", "Potencjał z raportu"].every((n) => ok.skladniki.some((s) => s.nazwa === n)),
  ok.skladniki.map((s) => s.nazwa).join(", "));
sprawdz("podana jest pewność", ["WYSOKA", "ŚREDNIA", "NISKA"].includes(ok.pewnosc));
sprawdz("podany jest horyzont czasowy", !!ok.horyzont);

console.log("\n8. Im mniej materiału, tym szerszy przedział");
const chudy = M.prognozaZawodnika(zawodnik({
  przebieg: mecze(3),
  sezony: [
    { sezon: "2026/2027", rozgrywki: "III liga", wystepy: 3, wPodstawowym: 3, minuty: 270, gole: 0 },
    { sezon: "2025/2026", rozgrywki: "IV liga", wystepy: 6, wPodstawowym: 2, minuty: 400, gole: 0 },
  ],
}));
sprawdz("mała próba daje niską pewność", chudy.pewnosc === "NISKA", chudy.pewnosc);
sprawdz("niska pewność rozszerza przedział",
  (chudy.pulapDo - chudy.pulapOd) >= (ok.pulapDo - ok.pulapOd),
  `chudy ${chudy.pulapOd}-${chudy.pulapDo}, pełny ${ok.pulapOd}-${ok.pulapDo}`);

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
