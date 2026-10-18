// Mapa zespołu na karcie klubu — kto staje na boisku i gdzie.
//
// Zgłoszenie (18.10.2026): „dlaczego nie ma na mapie wszystkich zawodników z listy? zawodnicy są
// na złych pozycjach". Dopasowanie szło przez dokładną równość napisów (p.position === posName),
// więc wystarczyła inna kolejność słów, żeby zawodnik wypadł z boiska BEZ SŁOWA — a licznik
// u góry i tak liczył go jako stojącego na murawie. W kartotekach Lechii stoją obok siebie
// „Pomocnik defensywny” i „Defensywny pomocnik”, „Obrońca boczny” i „Lewy obrońca”.
//
// Uruchomienie:  node scripts/test-mapa-zespolu.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("src/main.ts", "utf8");
const css = fs.readFileSync("src/style.css", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

// --- kopia logiki dopasowania nazw z main.ts --------------------------------------------------
const normPoz = (s) => String(s || "").toLowerCase()
  .normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z]+/g, " ").trim();
const kluczPoz = (s) => normPoz(s).split(" ").filter(Boolean).sort().join(" ");

// Słownik jak w aplikacji (POSITION_NUMBERS).
const POLA = [
  { number: 1, label: "Bramkarz", posName: "Bramkarz" },
  { number: 3, label: "Lewy obrońca", posName: "Obrońca boczny" },
  { number: 2, label: "Prawy obrońca", posName: "Obrońca boczny" },
  { number: 4, label: "Stoper (lewy)", posName: "Obrońca środkowy" },
  { number: 5, label: "Stoper (prawy)", posName: "Obrońca środkowy" },
  { number: 6, label: "Defensywny pomocnik", posName: "Pomocnik defensywny" },
  { number: 8, label: "Środkowy pomocnik", posName: "Pomocnik środkowy" },
  { number: 10, label: "Ofensywny pomocnik", posName: "Pomocnik ofensywny" },
  { number: 11, label: "Lewe skrzydło", posName: "Skrzydłowy" },
  { number: 7, label: "Prawe skrzydło", posName: "Skrzydłowy" },
  { number: 9, label: "Napastnik", posName: "Napastnik" },
];

function rozstaw(squad) {
  const wPolu = new Map(POLA.map((pn) => [pn.number, []]));
  const wziete = new Set();
  squad.forEach((p) => {
    const n = Number(p.pozycjaNmg) || 0;
    if (n && wPolu.has(n)) { wPolu.get(n).push(p); wziete.add(p.id); }
  });
  POLA.forEach((pn) => squad.forEach((p) => {
    if (wziete.has(p.id) || kluczPoz(p.position) !== kluczPoz(pn.label)) return;
    wPolu.get(pn.number).push(p); wziete.add(p.id);
  }));
  POLA.forEach((pn) => {
    const pasujacy = squad.filter((p) => !wziete.has(p.id) && kluczPoz(p.position) === kluczPoz(pn.posName));
    if (!pasujacy.length) return;
    const pary = POLA.filter((x) => x.posName === pn.posName);
    const ilePar = Math.max(1, pary.length);
    const idx = pary.findIndex((x) => x.number === pn.number);
    pasujacy.forEach((p, i) => { if (i % ilePar === idx) { wPolu.get(pn.number).push(p); wziete.add(p.id); } });
  });
  return { wPolu, nierozpoznani: squad.filter((p) => !wziete.has(p.id)) };
}

console.log("\n1. Nazwa pozycji w innej kolejności słów to ta sama pozycja");
sprawdz("„Pomocnik defensywny” = „Defensywny pomocnik”",
  kluczPoz("Pomocnik defensywny") === kluczPoz("Defensywny pomocnik"));
sprawdz("„Pomocnik ofensywny” = „Ofensywny pomocnik”",
  kluczPoz("Pomocnik ofensywny") === kluczPoz("Ofensywny pomocnik"));
sprawdz("wielkość liter i ogonki bez znaczenia",
  kluczPoz("OBROŃCA ŚRODKOWY") === kluczPoz("obronca srodkowy"));
sprawdz("„Stoper (prawy)” rozpoznane mimo nawiasów",
  kluczPoz("Stoper (prawy)") === kluczPoz("Stoper prawy"));
sprawdz("różne pozycje nadal różne",
  kluczPoz("Pomocnik defensywny") !== kluczPoz("Pomocnik ofensywny"));

console.log("\n2. Kto staje na którym polu");
{
  const squad = [
    { id: "a", lastName: "Holewiński", position: "Bramkarz" },
    { id: "b", lastName: "Kapić", position: "Defensywny pomocnik" },      // etykieta NMG
    { id: "c", lastName: "Adkonis", position: "Pomocnik defensywny" },    // nazwa ogólna
    { id: "d", lastName: "Blanuta", position: "Ofensywny pomocnik" },
    { id: "e", lastName: "Malov", position: "Lewy obrońca" },
    { id: "f", lastName: "Madej", position: "Stoper (prawy)" },
    { id: "g", lastName: "Shakh", position: "Napastnik" },
    { id: "h", lastName: "Neugebauer", position: "Środkowy pomocnik", pozycjaNmg: 8 },
  ];
  const { wPolu, nierozpoznani } = rozstaw(squad);
  const na = (n) => (wPolu.get(n) || []).map((p) => p.lastName).join(",");
  sprawdz("bramkarz na jedynce", na(1) === "Holewiński", na(1));
  sprawdz("„Defensywny pomocnik” trafia na szóstkę", na(6).includes("Kapić"), na(6));
  sprawdz("„Pomocnik defensywny” trafia tam samo", na(6).includes("Adkonis"), na(6));
  sprawdz("„Lewy obrońca” na trójkę, nie na dwójkę", na(3) === "Malov" && na(2) === "", `3:${na(3)} 2:${na(2)}`);
  sprawdz("„Stoper (prawy)” na piątkę, nie na czwórkę", na(5) === "Madej" && na(4) === "", `5:${na(5)} 4:${na(4)}`);
  sprawdz("„Ofensywny pomocnik” na dziesiątkę", na(10) === "Blanuta", na(10));
  sprawdz("numer wg NMG ma pierwszeństwo", na(8) === "Neugebauer", na(8));
  sprawdz("nikt nie wypadł poza boisko", nierozpoznani.length === 0,
    nierozpoznani.map((p) => p.lastName).join(","));
}

console.log("\n3. Nierozpoznana pozycja nie znika po cichu");
{
  const squad = [
    { id: "a", lastName: "Kowalski", position: "Bramkarz" },
    { id: "b", lastName: "Dziwny", position: "Libero" },
    { id: "c", lastName: "Inny", position: "Wahadłowy" },
  ];
  const { nierozpoznani } = rozstaw(squad);
  sprawdz("nieznane nazwy trafiają na listę do poprawienia", nierozpoznani.length === 2,
    nierozpoznani.map((p) => p.position).join(","));
}

console.log("\n4. Wpięcie w aplikację");
sprawdz("aplikacja porównuje pozycje po znaczeniu", /const kluczPoz = \(s\)=> normPoz\(s\)/.test(zrodlo));
sprawdz("etykieta NMG wskazująca stronę ma pierwszeństwo przed nazwą ogólną",
  /kluczPoz\(p\.position\) !== kluczPoz\(pn\.label\)/.test(zrodlo));
sprawdz("reszta dobierana po nazwie ogólnej",
  /kluczPoz\(p\.position\) === kluczPoz\(pn\.posName\)/.test(zrodlo));
sprawdz("licznik mówi, ilu POSTAWIONO, nie ilu ma wpisaną pozycję",
  /const naBoisku = zPozycja\.length - nierozpoznani\.length;/.test(zrodlo)
  && /\$\{naBoisku\} z \$\{squad\.length\}/.test(zrodlo));
sprawdz("nierozpoznani wypisani z nazwiska i z tym, co mają wpisane",
  /Nie rozpoznałem pozycji:/.test(zrodlo));
sprawdz("postawieni przez nazwę ogólną są odnotowani jako wzięci",
  /wPolu\.get\(pn\.number\)\.push\(\{ p, pewny: false \}\);\s*\n\s*wziete\.add\(p\.id\);/.test(zrodlo));


console.log("\n5. Lawka — wszyscy sa na mapie");
sprawdz("kto nie stanal na boisku, siedzi na lawce",
  /const naLawce = squad\.filter\(p=>!wziete\.has\(p\.id\)\);/.test(zrodlo));
sprawdz("lawka jest przeciagalna tak samo jak murawa",
  /class="pos-marker-row lawka-chip" draggable="true"/.test(zrodlo));
sprawdz("lawka niesie identyfikator, ktorego szuka obsluga upuszczenia",
  /lawka-chip[\s\S]{0,120}data-zawodnik="\$\{esc\(p\.id\)\}"/.test(zrodlo));
sprawdz("mapa nie znika juz przy malej liczbie wpisanych pozycji",
  /if\(!squad\.length\)\{/.test(zrodlo) && !/if\(zPozycja\.length < 5\)\{/.test(zrodlo));
sprawdz("lawka wpieta pod boisko", /\$\{lawkaHtml\}/.test(zrodlo));
sprawdz("styl lawki jest w arkuszu", /\.mapa-lawka\{/.test(css) && /\.lawka-chip\{/.test(css));

console.log("\n6. Ranking — pierwszy wybor i zmiennik");
sprawdz("dwa pierwsze miejsca dostaja osobne klasy",
  /const miejsce = i === 0 \? ' pmr-podstawowy' : i === 1 \? ' pmr-rezerwowy' : '';/.test(zrodlo));
sprawdz("podpowiedz mowi, ktore to miejsce",
  /const rola = i === 0 \? 'pierwszy wybór' : i === 1 \? 'zmiennik'/.test(zrodlo));
sprawdz("pod mapa jest legenda kolorow", /pmr-legenda pmr-podstawowy/.test(zrodlo)
  && /pmr-legenda pmr-rezerwowy/.test(zrodlo));
sprawdz("roznica nie opiera sie na samym kolorze — grubosc paska i tlo",
  /\.pmr-podstawowy\{box-shadow:inset 4px[\s\S]{0,120}background:var\(--card-warm\);font-weight:700;\}/.test(css)
  && /\.pmr-rezerwowy\{box-shadow:inset 2px/.test(css));
sprawdz("powod zapisany w arkuszu — zlota i zielen dziela 1,92:1 jasnosci",
  /sam kolor nie wystarczyłby, żeby je rozróżnić/.test(css));
console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
