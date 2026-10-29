// Daty urodzenia ze składu klubu na Transfermarkcie.
//
// PO CO NAM DOKŁADNA DATA, SKORO MAMY ROCZNIK
// Efekt wieku względnego mierzy się kwartałem urodzenia. Zawodnik z 3 stycznia i z 28 grudnia mają
// ten sam rocznik, a dzieli ich prawie rok rozwoju — i to wystarcza, żeby przez całą młodzież
// pierwszy wyglądał na lepszego. Bez dnia i miesiąca tej różnicy nie widać wcale.
//
// DLACZEGO STRONA SKŁADU, A NIE PROFILE
// Profil po profilu to kilka tysięcy żądań do cudzego serwisu. Strona składu oddaje cały zespół
// w jednym — około stu trzydziestu zapytań na wszystko do III ligi włącznie.
//
// CZEGO TEN TEST NIE SPRAWDZA
// Czy nasz wzorzec pasuje do PRAWDZIWEJ strony Transfermarktu. Tego nie da się sprawdzić bez
// pobrania jej, a tego z testu nie robimy. Test pilnuje reguł czytania daty — reszta wyjdzie
// przy pierwszym prawdziwym pobraniu i dlatego endpoint podaje licznik odczytanych dat.
//
// Uruchomienie:  node scripts/test-tm-daty-urodzenia.mjs
import fs from "node:fs";

const zrodlo = fs.readFileSync("api/tm-sklad.js", "utf8");
let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + JSON.stringify(dodatek)}`);
  if (!warunek) bledy++;
};

// Moduł robi fetch dopiero w tmSklad(), więc da się go zaimportować bez sieci.
const { tmSklad } = await import("../api/tm-sklad.js");

// Wiersz składu w kształcie, który czyta istniejący wzorzec: zagnieżdżona tabelka z odnośnikiem
// do profilu i pozycją, a zaraz za nią komórka z datą urodzenia i wiekiem.
const wiersz = (tmId, nazwa, pozycja, data) => `
<tr class="odd">
  <td class="zentriert">7</td>
  <td class="posrela"><table class="inline-table">
    <tr><td rowspan="2"><img src="x.jpg"></td>
        <td class="hauptlink"><a href="/kto/profil/spieler/${tmId}"> ${nazwa} </a></td></tr>
    <tr><td> ${pozycja} </td></tr>
  </table></td>
  ${data ? `<td class="zentriert">${data}</td>` : `<td class="zentriert">-</td>`}
  <td class="zentriert"><img class="flaggenrahmen" src="pl.png"></td>
</tr>`;

const strona = (wiersze) =>
  `<html><head><meta property="og:title" content="Zawisza Bydgoszcz - Skład - Transfermarkt"></head>
   <body><table class="items"><tbody>${wiersze.join("")}</tbody></table></body></html>`;

// Zamiast sieci podstawiamy gotowy HTML — tmSklad woła globalny fetch.
function zPodstawionaStrona(html, f) {
  const oryginal = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => html });
  return f().finally(() => { globalThis.fetch = oryginal; });
}
const czytaj = (html) => zPodstawionaStrona(html, () =>
  tmSklad("https://www.transfermarkt.pl/klub/startseite/verein/1"));

console.log("\n1. Data odczytana i przepisana na zapis kartoteki");
{
  const d = await czytaj(strona([
    wiersz("111", "Jan Kowalski", "Bramkarz", "13.04.2007 (19)"),
    wiersz("222", "Piotr Nowak", "Napastnik", "28.12.2008 (17)"),
  ]));
  sprawdz("dwóch zawodników", d.zawodnicy.length === 2, d.zawodnicy);
  sprawdz("data w zapisie RRRR-MM-DD", d.zawodnicy[0].dataUrodzenia === "2007-04-13", d.zawodnicy[0]);
  sprawdz("grudniowy rocznik też", d.zawodnicy[1].dataUrodzenia === "2008-12-28", d.zawodnicy[1]);
  sprawdz("nazwa i pozycja nadal działają",
    d.zawodnicy[0].nazwa === "Jan Kowalski" && d.zawodnicy[0].pozycja === "Bramkarz", d.zawodnicy[0]);
  // Licznik istnieje po to, żeby zepsuty wzorzec było widać od razu, a nie po imporcie.
  sprawdz("licznik odczytanych dat", d.zDataUrodzenia === 2, d.zDataUrodzenia);
}

console.log("\n2. Brak daty NIE kradnie daty następnemu zawodnikowi");
{
  // To jest najważniejszy test w pliku. Gdyby szukanie daty szło „gdzieś dalej", zawodnik bez niej
  // dostałby datę kolegi z następnego wiersza — i nikt by tego nie zauważył, bo wyglądałaby
  // normalnie. Zła data urodzenia jest gorsza niż brak: braku nikt nie użyje, a błędna po cichu
  // przekłamie ocenę wieku względnego.
  const d = await czytaj(strona([
    wiersz("111", "Bez Daty", "Obrońca", ""),
    wiersz("222", "Z Datą", "Napastnik", "05.09.2006 (20)"),
  ]));
  sprawdz("pierwszy zostaje bez daty", d.zawodnicy[0].dataUrodzenia === "", d.zawodnicy[0]);
  sprawdz("drugi ma swoją własną", d.zawodnicy[1].dataUrodzenia === "2006-09-05", d.zawodnicy[1]);
  sprawdz("licznik mówi o jednej", d.zDataUrodzenia === 1, d.zDataUrodzenia);
}

console.log("\n3. Data niemożliwa jest odrzucana w całości");
{
  // „Prawie dobra" data nie istnieje. Miesiąc 13 albo rok 1812 to znak, że wzorzec trafił
  // w coś innego niż data urodzenia — wtedy lepiej nie zapisać nic.
  for (const [opis, zapis] of [
    ["miesiąc 13", "01.13.2007 (19)"],
    ["dzień 45", "45.04.2007 (19)"],
    ["rok 1812", "01.04.1812 (19)"],
  ]) {
    const d = await czytaj(strona([wiersz("111", "Ktoś", "Obrońca", zapis)]));
    sprawdz(opis + " odrzucone", d.zawodnicy[0].dataUrodzenia === "", d.zawodnicy[0]);
  }
  const przyszlosc = String(new Date().getFullYear() + 1);
  const d = await czytaj(strona([wiersz("111", "Ktoś", "Obrońca", `01.04.${przyszlosc} (0)`)]));
  sprawdz("rok z przyszłości odrzucony", d.zawodnicy[0].dataUrodzenia === "", d.zawodnicy[0]);
}

console.log("\n4. Reszta składu działa jak wcześniej");
{
  const d = await czytaj(strona([
    wiersz("111", "Jan Kowalski", "Bramkarz", "13.04.2007 (19)"),
    wiersz("111", "Jan Kowalski", "Bramkarz", "13.04.2007 (19)"),
  ]));
  // Ten sam zawodnik bywa na stronie dwa razy — w tabeli głównej i w bloku wypożyczeń.
  sprawdz("powtórzony zawodnik liczony raz", d.zawodnicy.length === 1, d.zawodnicy);
  sprawdz("nazwa klubu bez dopisku serwisu", d.klub === "Zawisza Bydgoszcz - Skład", d.klub);
}

console.log("\n5. Inne zapisy daty niż polski");
{
  // Transfermarkt podaje datę inaczej zależnie od widoku i języka serwisu. Pierwszy wzorzec,
  // napisany z pamięci o układzie strony, nie trafił w ogóle — stąd kilka kształtów zamiast
  // jednego. Pamięć o cudzym HTML-u nie jest źródłem, na którym można budować import.
  for (const [opis, zapis, oczekiwana] of [
    ["z kropkami", "13.04.2007 (19)", "2007-04-13"],
    ["z ukośnikami", "13/04/2007 (19)", "2007-04-13"],
    ["ISO", "2007-04-13 (19)", "2007-04-13"],
    ["angielski", "Apr 13, 2007 (19)", "2007-04-13"],
    ["jednocyfrowy dzień", "3.4.2007 (19)", "2007-04-03"],
  ]) {
    const d = await czytaj(strona([wiersz("111", "Ktoś", "Obrońca", zapis)]));
    sprawdz(opis, d.zawodnicy[0].dataUrodzenia === oczekiwana, d.zawodnicy[0]);
  }
}

console.log("\n6. Podgląd surowego fragmentu strony");
{
  // Bez tego każda nieudana próba wzorca kosztuje wdrożenie i pytanie do właściciela.
  // Z tym — jedno kliknięcie pokazuje, gdzie data naprawdę stoi.
  const html = strona([
    wiersz("111", "Pierwszy", "Obrońca", "13.04.2007 (19)"),
    wiersz("222", "Drugi", "Napastnik", "05.09.2006 (20)"),
    wiersz("333", "Trzeci", "Napastnik", "01.01.2005 (21)"),
  ]);
  const zPodgladem = await zPodstawionaStrona(html, () =>
    tmSklad("https://www.transfermarkt.pl/klub/startseite/verein/1", { podglad: true }));
  sprawdz("próbki są", Array.isArray(zPodgladem.probki) && zPodgladem.probki.length === 2,
    zPodgladem.probki && zPodgladem.probki.length);
  sprawdz("próbka zawiera komórkę z datą", /13\.04\.2007/.test(zPodgladem.probki[0]), zPodgladem.probki[0]);
  sprawdz("próbka przycięta", zPodgladem.probki[0].length <= 700, zPodgladem.probki[0].length);
  // Domyślnie podglądu nie ma — odpowiedź dla aplikacji ma być czysta.
  const bez = await czytaj(html);
  sprawdz("bez żądania nie ma próbek", bez.probki === undefined, bez.probki);
}

console.log(bledy ? `\nBŁĘDÓW: ${bledy}\n` : "\nWszystko w porządku.\n");
process.exit(bledy ? 1 : 0);
