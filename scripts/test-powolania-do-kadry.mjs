// Wklejanie powołań do konkretnej kadry.
//
// ZGŁOSZENIE (03.11.2026): „nie zapisuje zawodników do danej reprezentacji… lista widnieje
// 4 zawodników w U-17, a ja już kiedyś wgrywałem wszystkie powołania… jak się powielają, to nie
// dopisuje". Były tu dwa osobne błędy, oba ciche.
//
// PIERWSZY: kadrę czytaliśmy WYŁĄCZNIE z treści wklejki. Komunikat PZPN nazwę kadry niesie,
// ale zwykła lista nazwisk — a taką wkleja się najczęściej — nie mówi o kadrze nic. Zawodnicy
// lądowali więc bez przypisania, czyli w „Talencie klubowym", choć dodawano ich stojąc na
// zakładce U-17. Z punktu widzenia użytkownika: „dodałem dwudziestu jeden, a w U-17 dalej czterech".
//
// DRUGI: zawodnik bez nazwy kadry szedł na listę BEZ sprawdzenia duplikatu. Każde ponowne
// wklejenie tej samej listy zakładało komplet nowych wpisów.
//
// Uruchomienie:  node scripts/test-powolania-do-kadry.mjs
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
  wytnij("szukajNorm", /const szukajNorm = [\s\S]*?;\r?\n/),
  wytnij("nazwiskoNorm", /const nazwiskoNorm = [\s\S]*?;\r?\n/),
  wytnij("tenSamTalent", /function tenSamTalent\(t, n\)\{[\s\S]*?\n\}/),
  wytnij("scalPowolanych", /function scalPowolanychZIstniejacymi\(istniejace, nowe\)\{[\s\S]*?\n\}/),
].join("\n");

const { scalPowolanychZIstniejacymi } = new Function("klubyToSamo",
  `${kod}\n return { scalPowolanychZIstniejacymi };`)((a, b) => String(a) === String(b));

const os = (firstName, lastName, dodatki = {}) => ({ firstName, lastName, ...dodatki });

console.log("\n1. Nowi powołani trafiają na listę");
{
  const lista = [];
  const { doDodania, uzupelnieni } = scalPowolanychZIstniejacymi(lista, [
    os("Adam", "Garwoliński", { club: "FASE Szczecin", reprezentacja: "U-17" }),
    os("Dawid", "Świątek", { club: "Górnik Zabrze", reprezentacja: "U-17" }),
  ]);
  sprawdz("dwóch do dodania", doDodania.length === 2, doDodania.length);
  sprawdz("żaden nie jest uzupełnieniem", uzupelnieni === 0, uzupelnieni);
  sprawdz("kadra przy nich zostaje", doDodania.every(t => t.reprezentacja === "U-17"), doDodania);
}

console.log("\n2. Ten sam zawodnik nie wchodzi drugi raz");
{
  // Sedno zgłoszenia: wklejenie tej samej listy po raz drugi ma NIE zakładać nowych wpisów.
  const lista = [os("Adam", "Garwoliński", { id: "T1", club: "FASE Szczecin", reprezentacja: "U-17" })];
  const { doDodania, uzupelnieni } = scalPowolanychZIstniejacymi(lista,
    [os("Adam", "Garwoliński", { club: "FASE Szczecin", reprezentacja: "U-17" })]);
  sprawdz("nic nowego", doDodania.length === 0, doDodania);
  sprawdz("policzony jako już obecny", uzupelnieni === 1, uzupelnieni);
  sprawdz("lista nadal jednoosobowa", lista.length === 1, lista.length);
}

console.log("\n3. Duplikat BEZ nazwy kadry też jest duplikatem");
{
  // Tu siedział pierwszy błąd: brak kadry w danych omijał sprawdzenie duplikatu w całości.
  const lista = [os("Aleks", "Olsztyn", { id: "T1", club: "Lech Poznań" })];
  const { doDodania, uzupelnieni } = scalPowolanychZIstniejacymi(lista,
    [os("Aleks", "Olsztyn", { club: "Lech Poznań" })]);
  sprawdz("nie dokłada drugiego wpisu", doDodania.length === 0, doDodania);
  sprawdz("policzony jako już obecny", uzupelnieni === 1, uzupelnieni);
}

console.log("\n4. Dublet wewnątrz jednej wklejki");
{
  // Drugi błąd: porównywaliśmy tylko z tym, co JUŻ było na liście — nie z tym, co właśnie
  // dodaliśmy w tym samym przebiegu. Osoba wymieniona dwa razy w jednym komunikacie wchodziła dwa razy.
  const { doDodania } = scalPowolanychZIstniejacymi([], [
    os("Maciej", "Malecki", { club: "Lech Poznań", reprezentacja: "U-17" }),
    os("Maciej", "Malecki", { club: "Lech Poznań", reprezentacja: "U-17" }),
  ]);
  sprawdz("wchodzi raz, nie dwa", doDodania.length === 1, doDodania.length);
}

console.log("\n5. Powołanie dopisuje kadrę komuś, kto już był bez kadry");
{
  // Tak odzyskuje się zawodników, którzy wcześniej wpadli do „Talentu klubowego" zamiast do kadry:
  // wystarczy wkleić listę ponownie, stojąc na właściwej zakładce.
  const lista = [os("Oliwier", "Madej", { id: "T1", club: "Stal Rzeszów" })];
  const { uzupelnieni } = scalPowolanychZIstniejacymi(lista,
    [os("Oliwier", "Madej", { club: "Stal Rzeszów", reprezentacja: "U-17" })]);
  sprawdz("kadra dopisana do istniejącego", lista[0].reprezentacja === "U-17", lista[0]);
  sprawdz("bez nowego wpisu", uzupelnieni === 1, uzupelnieni);
  sprawdz("lista nadal jednoosobowa", lista.length === 1, lista.length);
}

console.log("\n6. Czego scalanie NIE nadpisuje");
{
  // Klub wpisany ręcznie zostaje — wklejka uzupełnia tylko puste pola.
  const lista = [os("Jan", "Głąb", { id: "T1", club: "Widzew Łódź" })];
  scalPowolanychZIstniejacymi(lista, [os("Jan", "Głąb", { club: "", reprezentacja: "U-17" })]);
  sprawdz("klub zostaje nietknięty", lista[0].club === "Widzew Łódź", lista[0]);
  // Ale kadra z powołania jest nadrzędna: powołanie to fakt, nie podpowiedź.
  const lista2 = [os("Jan", "Głąb", { id: "T1", club: "Widzew Łódź", reprezentacja: "U-16" })];
  scalPowolanychZIstniejacymi(lista2, [os("Jan", "Głąb", { club: "Widzew Łódź", reprezentacja: "U-17" })]);
  sprawdz("nowsze powołanie wygrywa", lista2[0].reprezentacja === "U-17", lista2[0]);
}

console.log("\n7. Zakładka kadry wyznacza kadrę przy imporcie");
{
  // Bez tego dwadzieścia jeden nazwisk wklejonych na zakładce U-17 trafiało do „Talentu klubowego".
  sprawdz("import przypisuje otwartą kadrę",
    /KADRY_MLODZIEZOWE\.includes\(talentKadra\)\)\{[\s\S]{0,160}x\.reprezentacja = talentKadra/.test(zrodlo));
  // Nazwa kadry z treści komunikatu ma pierwszeństwo — PZPN wie lepiej niż otwarta zakładka.
  sprawdz("ale nie nadpisuje kadry z treści", /if\(!x\.reprezentacja\) x\.reprezentacja = talentKadra/.test(zrodlo));
  sprawdz("potwierdzenie mówi, do której kadry", /Dodano \$\{doDodania\.length\}\$\{gdzie\}/.test(zrodlo));
}

console.log(bledy ? `\nBŁĘDÓW: ${bledy}\n` : "\nWszystko w porządku.\n");
process.exit(bledy ? 1 : 0);
