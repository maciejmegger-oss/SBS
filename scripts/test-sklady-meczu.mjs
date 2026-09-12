// Sprawdza dobór zespołu klubu do składu i dostępność wklejania składów.
//
// Uruchomienie:  node scripts/test-sklady-meczu.mjs
import fs from "node:fs";
import { transformSync } from "esbuild";

const panel = fs.readFileSync("src/mobile/main.ts", "utf8");
const wytnij = (nazwa, wzor) => {
  const m = panel.match(wzor);
  if (!m) { console.error(`Nie znalazłem ${nazwa} — test i kod się rozjechały.`); process.exit(1); }
  return m[0];
};

let bledy = 0;
const sprawdz = (opis, jest, ma) => {
  const ok = jest === ma;
  console.log(`${ok ? "  OK  " : " BŁĄD "} ${opis}${ok ? "" : `\n         jest: ${JSON.stringify(jest)}\n          ma:  ${JSON.stringify(ma)}`}`);
  if (!ok) bledy++;
};
const sprawdzWarunek = (opis, w, dodatek = "") => {
  console.log(`${w ? "  OK  " : " BŁĄD "} ${opis}${w ? "" : "   " + dodatek}`);
  if (!w) bledy++;
};

// Prawdziwy kod: znaczniki zespołu, normalizacja nazwy klubu, dobór zespołu z rozgrywek i klubu.
const kod = [
  wytnij("ZNACZNIKI_ZESPOLU + normKlub", /const ZNACZNIKI_ZESPOLU[\s\S]*?\nconst normKlub[\s\S]*?\n  \.trim\(\);/),
  wytnij("znacznikZRozgrywek + klubZNazwy", /\/\/ ZNACZNIK ZESPOŁU Z NAZWY ROZGRYWEK[\s\S]*?\nfunction klubZNazwy[\s\S]*?\n}\n/),
].join("\n");
const js = transformSync(kod.replace(/export /g, ""), { loader: "ts", format: "esm" }).code;

const zbuduj = (kluby) => new Function("kluby", `
  const cache = { clubs: kluby };
  ${js}
  return { klubZNazwy, znacznikZRozgrywek, znacznikZespolu };
`)(kluby);

// ---------------------------------------------------------------------------
// 1. TO, CO REALNIE SIĘ ZEPSUŁO.
// Mecz CLJ U19 nazywa się "Legia Warszawa - Górnik Zabrze" — dokładnie jak mecz Ekstraklasy.
// Panel podstawiał kadrę pierwszej drużyny i scout zaznaczał nazwiska, których nie było na boisku.
// ---------------------------------------------------------------------------
console.log("1. Mecz CLJ U19 o nazwie bez rocznika");
{
  const baza = [
    { id: "s", name: "Legia Warszawa S.A." },
    { id: "u19", name: "Legia Warszawa U19" },
    { id: "u17", name: "Legia Warszawa U17" },
    { id: "g", name: "Górnik Zabrze" },
  ];
  const { klubZNazwy, znacznikZRozgrywek } = zbuduj(baza);

  sprawdz("rozgrywki CLJ U19 dają znacznik u19", znacznikZRozgrywek("CLJ U19"), "u19");
  sprawdz("z podpowiedzią u19 wchodzi drużyna U19",
    klubZNazwy("Legia Warszawa", znacznikZRozgrywek("CLJ U19")).id, "u19");
  sprawdz("z podpowiedzią u17 wchodzi drużyna U17",
    klubZNazwy("Legia Warszawa", znacznikZRozgrywek("CLJ U17")).id, "u17");
  sprawdz("bez podpowiedzi zostaje pierwszy zespół",
    klubZNazwy("Legia Warszawa", "").id, "s");
  sprawdz("Ekstraklasa nie zmienia zespołu",
    klubZNazwy("Legia Warszawa", znacznikZRozgrywek("Betclic Ekstraklasa 2026/2027")).id, "s");
}

// ---------------------------------------------------------------------------
// 2. PUŁAPKA, KTÓRA MOGŁA ZROBIĆ GORSZY BŁĄD NIŻ NAPRAWIANY.
// W nazwie ROZGRYWEK cyfry II i III znaczą poziom ligi, nie numer zespołu. Gdyby znacznik brać
// istniejącą funkcją znacznikZespolu, mecz "Betclic III liga, grupa: II" zaczałby szukać rezerw.
// ---------------------------------------------------------------------------
console.log("\n2. Numer ligi to nie numer zespołu");
{
  const { znacznikZRozgrywek, znacznikZespolu } = zbuduj([]);
  [
    "Betclic III liga 2026/2027, grupa: II",
    "Betclic I liga 2026/2027",
    "IV liga", "Klasa okręgowa", "A1", "C2", "Puchar Polski",
  ].forEach((r) => {
    sprawdz(`${r} — bez znacznika zespołu`, znacznikZRozgrywek(r), "");
  });
  // Dowód, że pułapka jest prawdziwa, a nie wyobrażona.
  sprawdzWarunek("stara funkcja faktycznie by się tu potknęła",
    znacznikZespolu("Betclic III liga 2026/2027, grupa: II") !== "",
    "gdyby zwracała pusty, ten test nie miałby sensu");
}

// ---------------------------------------------------------------------------
// 3. Nazwa drużyny ma pierwszeństwo nad rozgrywkami.
// ---------------------------------------------------------------------------
console.log("\n3. Nazwa drużyny bije rozgrywki");
{
  const baza = [
    { id: "s", name: "Arka Gdynia" },
    { id: "ii", name: "Arka Gdynia II" },
    { id: "u17", name: "Arka Gdynia U17" },
  ];
  const { klubZNazwy } = zbuduj(baza);
  sprawdz("nazwa z rocznikiem U17 trafia w U17 nawet bez podpowiedzi",
    klubZNazwy("Arka Gdynia U17", "").id, "u17");
  sprawdz("nazwa z II trafia w rezerwy", klubZNazwy("Arka II Gdynia", "").id, "ii");
  sprawdz("nazwa U17 wygrywa z podpowiedzią u19",
    klubZNazwy("Arka Gdynia U17", "u19").id, "u17");
}

// ---------------------------------------------------------------------------
// 4. Gdy właściwego zespołu nie ma w bazie — podstawiamy co jest, ale panel MUSI to powiedzieć.
// ---------------------------------------------------------------------------
console.log("\n4. Brak właściwej drużyny w bazie");
{
  const { klubZNazwy } = zbuduj([{ id: "s", name: "Legia Warszawa S.A." }]);
  sprawdz("wchodzi pierwszy zespół, bo innego nie ma",
    klubZNazwy("Legia Warszawa", "u19").id, "s");
  sprawdzWarunek("panel ostrzega, że to kadra innego zespołu",
    /nieTenZespol/.test(panel) && /To kadra innego zespołu tego klubu/.test(panel));
}

// ---------------------------------------------------------------------------
// 5. WKLEJANIE SKŁADU DOSTĘPNE ZAWSZE.
// Formularz pokazywał się wyłącznie przy OBU składach pustych, więc po wgraniu jednej drużyny
// nie było jak wkleić drugiej ani poprawić pierwszej.
// ---------------------------------------------------------------------------
console.log("\n5. Wklejanie składu po wgraniu pierwszej drużyny");
{
  const widok = wytnij("viewSklady", /function viewSklady[\s\S]*?\n}\n/);
  sprawdzWarunek("formularz otwiera się też przy niepustym składzie",
    /if \(wklejanie \|\| pusto\)/.test(widok),
    "warunek nadal wpuszcza tylko pusty skład");
  sprawdzWarunek("jest przycisk otwierający wklejanie z listy składu",
    /data-act="otworz-wklejanie"/.test(widok));
  sprawdzWarunek("z formularza da się wrócić", /data-act="zamknij-wklejanie"/.test(widok));
  sprawdzWarunek("panel mówi, że wypełnione pole PODMIENIA drużynę",
    /podmienia całą tę drużynę/.test(widok));
  sprawdzWarunek("widać, ilu zawodników już jest po każdej stronie", /w składzie \$\{ilu\(/.test(widok));

  sprawdzWarunek("kasowanie pojedynczego zawodnika nadal jest",
    /data-act="usun-zawodnika"/.test(widok));
  sprawdzWarunek("czyszczenie całej drużyny nadal jest",
    /data-act="wyczysc-sklad"/.test(widok));
  sprawdzWarunek("dopisanie z kadry klubu nadal jest", /data-act="otworz-kadre"/.test(widok));

  // Wklejenie JEDNEJ strony nie może ruszyć drugiej — składy przychodzą na raty.
  const handler = wytnij("obsluga wczytaj-sklady", /case "wczytaj-sklady": \{[\s\S]*?\n    \}/);
  sprawdzWarunek("puste pole zostawia tę drużynę bez zmian",
    /gospodarze\.length \? \{[^}]*\} : obs\.skladMeczu\?\.gospodarze/.test(handler));
  sprawdzWarunek("po wczytaniu formularz się zamyka", /wklejanie = false;/.test(handler));

  sprawdzWarunek("otwarty formularz to osobny ekran dla przewijania",
    /wklejanie \? "wklej" : ""/.test(panel),
    "bez tego panel traktowałby go jak ten sam ekran");
}

console.log(bledy ? `\n${bledy} błędów.` : "\nWszystko się zgadza.");
process.exit(bledy ? 1 : 0);
