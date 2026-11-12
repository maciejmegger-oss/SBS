// PODZIAŁ TALENTÓW NA KLUBY POLSKIE I ZAGRANICZNE.
//
// Zgłoszenie (12.11.2026): „przełącznik, który jak zaznaczę kluby polskie, to wyświetlą mi się
// zawodnicy grający w polskich klubach, a jak kluby zagraniczne — to z zagranicznych klubów.
// A taki ogólny, no to wszyscy zawodnicy”.
//
// Po co: w powołanej kadrze część chłopaków gra już za granicą, a to zupełnie inna praca skauta —
// takiego meczu nie obejrzy się z trybun.
//
// Skąd wiemy, czy klub jest zagraniczny: rozstrzyga o tym talentWKlubieZagranicznym w main.ts,
// a pilnuje go scripts/test-klub-zagraniczny.mjs. Pierwotnie czytaliśmy wyłącznie dopisek kraju
// („brak dopisku znaczy klub polski"), ale komunikaty ze strony pzpn.pl kraju nie podają wcale,
// więc Espanyol i Chelsea lądowały wśród polskich klubów. Teraz, gdy kraju nie ma, pyta się bazy
// klubów. TEN test sprawdza sam PRZEŁĄCZNIK: trzy stany, liczby przy opcjach i pobieranie listy.
//
// Uruchomienie:  node scripts/test-talent-kluby-pl-zagr.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

// PRAWDZIWA reguła, wycięta z main.ts — nie jej kopia.
//
// Kopia przeszła niezauważona zmianę reguły w kodzie: test dalej świecił na zielono, choć
// sprawdzał zasadę, której aplikacja już nie stosowała. Wycinamy więc funkcję ze źródła,
// a bazę klubów podstawiamy — tak samo jak w scripts/test-klub-zagraniczny.mjs.
const wytnij = (nazwa, wzor) => {
  const m = zrodlo.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} w src/main.ts — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};
const POLSKIE = ["Legia Warszawa", "Lech Poznań", "Widzew Łódź"];
const { krajKlubuTalentu, talentWKlubieZagranicznym: zagraniczny } = new Function("DB", "dopasujKlubDoNazwy",
  `${[
    wytnij("klubTalentu", /const pamiecKlubowTalentu = new Map\(\);[\s\S]*?\nfunction klubTalentu\(t\)\{[\s\S]*?\n\}/),
    wytnij("krajKlubuTalentu", /const krajKlubuTalentu = \(t\)=>[^\n]*\n/),
    wytnij("talentWKlubieZagranicznym", /const talentWKlubieZagranicznym = \(t\)=>\{[\s\S]*?\n\};/),
  ].join("\n")}\n return { krajKlubuTalentu, talentWKlubieZagranicznym };`)(
    { clubs: POLSKIE.map((name, i) => ({ id: "K" + i, name })) },
    (nazwa) => POLSKIE.find((k) => k.toLowerCase() === String(nazwa).trim().toLowerCase()) || null,
  );

console.log("\n1. Rozpoznawanie klubu");
sprawdz("klub z bazy — polski, choć kraju nikt nie dopisał",
  zagraniczny({ club: "Lech Poznań" }) === false);
// To jest poprawka z 12.11.2026: przedtem brak dopisku kraju sam w sobie znaczył „Polska".
sprawdz("klub spoza bazy — zagraniczny, choć kraju nikt nie dopisał",
  zagraniczny({ club: "RCD Espanyol" }) === true);
sprawdz("kraj podany — klub zagraniczny", zagraniczny({ club: "Hertha", krajKlubu: "Niemcy" }) === true);
// Nazwa kraju bywa sklejona z kategorią rozgrywek — bez obcięcia „Szwecja · U-19” nie zrównałoby
// się z „Szwecja” i podział by się posypał.
sprawdz("kraj sklejony z kategorią rozgrywek też działa",
  zagraniczny({ krajKlubu: "Szwecja · U-19" }) === true && krajKlubuTalentu({ krajKlubu: "Szwecja · U-19" }) === "Szwecja");
sprawdz("kraj z dopisanym rocznikiem też działa", krajKlubuTalentu({ krajKlubu: "Anglia U-18" }) === "Anglia");
// Gdyby źródło kiedyś dopisało „Polska” wprost, zawodnik nie może wylądować wśród zagranicznych.
sprawdz("jawnie podana Polska to nie zagranica", zagraniczny({ krajKlubu: "Polska" }) === false);
sprawdz("zapis angielski też rozpoznany", zagraniczny({ krajKlubu: "Poland" }) === false);
sprawdz("puste i śmieciowe wartości nie wyrzucają zawodnika za granicę",
  zagraniczny({}) === false && zagraniczny({ krajKlubu: "   " }) === false);

console.log("\n2. Trzy stany przełącznika");
{
  const lista = [
    { lastName: "Bartczak", krajKlubu: "" },
    { lastName: "Nowak", krajKlubu: "Niemcy" },
    { lastName: "Kowalski", krajKlubu: "" },
    { lastName: "Lis", krajKlubu: "Szwecja · U-19" },
  ];
  const wybierz = (tryb) => tryb ? lista.filter((t) => (tryb === "zagr") === zagraniczny(t)) : lista;
  sprawdz("ogólny — wszyscy", wybierz("").length === 4);
  sprawdz("kluby polskie — tylko oni", wybierz("pl").map((t) => t.lastName).join() === "Bartczak,Kowalski");
  sprawdz("kluby zagraniczne — tylko oni", wybierz("zagr").map((t) => t.lastName).join() === "Nowak,Lis");
  sprawdz("obie grupy sumują się do całości", wybierz("pl").length + wybierz("zagr").length === lista.length);
}

console.log("\n3. Wpięcie w aplikację");
sprawdz("jest osobny stan przełącznika", /let talentKluby = '';/.test(zrodlo));
sprawdz("reguła rozpoznawania klubu jest w kodzie",
  /const talentWKlubieZagranicznym = \(t\)=>\{/.test(zrodlo)
  && /const krajKlubuTalentu = \(t\)=> String\(\(t && t\.krajKlubu\) \|\| ''\)\.split\(\/ · \| U-\\d\/\)\[0\]\.trim\(\);/.test(zrodlo));
sprawdz("dobór listy uwzględnia przełącznik",
  /return baza\.filter\(t=> \(talentKluby === 'zagr'\) === talentWKlubieZagranicznym\(t\)\);/.test(zrodlo));
sprawdz("przełącznik jest rozwijaną listą w pasku Talentu", /<select id="talent-kluby"/.test(zrodlo));
sprawdz("ma trzy opcje: wszystkie, polskie, zagraniczne",
  /opcja\('', 'Wszystkie kluby'/.test(zrodlo) && /opcja\('pl', 'Kluby polskie'/.test(zrodlo)
  && /opcja\('zagr', 'Kluby zagraniczne'/.test(zrodlo));
sprawdz("jest podpięty i przerysowuje listę",
  /wyborKlubow\.onchange = \(\)=>\{ talentKluby = wyborKlubow\.value; render\(\); \}/.test(zrodlo));

console.log("\n4. Liczby widać przed wybraniem");
// Bez tego trzeba by przełączać tam i z powrotem, żeby się dowiedzieć, ilu wyjechało.
sprawdz("liczby liczone z pominięciem samego przełącznika",
  /function talentyWidoczne\(bezPodzialuKlubow\?: boolean\)\{/.test(zrodlo)
  && /const bez = talentyWidoczne\(true\);/.test(zrodlo));
sprawdz("każda opcja pokazuje swoją liczbę", /\$\{etykieta\} \(\$\{ile\}\)/.test(zrodlo));
sprawdz("polskie liczone jako reszta po zagranicznych, więc sumy się zgadzają",
  /opcja\('pl', 'Kluby polskie', bez\.length - zagr\)/.test(zrodlo));

console.log("\n5. Pobieranie listy idzie za przełącznikiem");
sprawdz("eksport korzysta z tego samego doboru", /const lista = talentyWidoczne\(\);/.test(zrodlo));
// Plik „kadra U-18" i „kadra U-18, kluby zagraniczne" to dwie różne listy — nie mogą sie nazywać tak samo.
sprawdz("nazwa pliku i arkusza mówi, który to podział",
  /' — kluby polskie'/.test(zrodlo) && /' — kluby zagraniczne'/.test(zrodlo));

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
