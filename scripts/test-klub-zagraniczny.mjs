// Rozpoznanie klubu zagranicznego i sprawdzenie roczników w kadrze.
//
// ZGŁOSZENIE (12.11.2026): „zawodnik gra w zagranicznym klubie, a po zaznaczeniu selekcji
// zagraniczne on zostaje w klubach polskich”. Zakładka Europa pokazywała wyłącznie wpisy
// z ręcznie postawionym znacznikiem `europa`. Powołany z Chelsea czy Espanyolu wchodził
// z komunikatu PZPN bez tego znacznika i do końca wyglądał na zawodnika polskiego klubu.
//
// Reguła: mamy w bazie polskie kluby, więc klub, którego w niej nie ma, jest zagraniczny.
// Ten test pilnuje KOLEJNOŚCI pytań — bo cała wartość reguły siedzi w tym, czego NIE zgaduje.
//
// Uruchomienie:  node scripts/test-klub-zagraniczny.mjs
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

// Baza klubów: tylko polskie. Dokładnie tak, jak w systemie.
const POLSKIE = ["Legia Warszawa", "Lech Poznań", "Stal Rzeszów", "Śląsk Wrocław", "Widzew Łódź"];
const kod = [
  wytnij("klubTalentu", /const pamiecKlubowTalentu = new Map\(\);[\s\S]*?\nfunction klubTalentu\(t\)\{[\s\S]*?\n\}/),
  wytnij("krajKlubuTalentu", /const krajKlubuTalentu = \(t\)=>[^\n]*\n/),
  wytnij("talentWKlubieZagranicznym", /const talentWKlubieZagranicznym = \(t\)=>\{[\s\S]*?\n\};/),
  wytnij("wKadrzeTalentu", /function wKadrzeTalentu\(t, k\)\{[\s\S]*?\n\}/),
  wytnij("sezonReprezentacyjny", /function sezonReprezentacyjny\(dzis = new Date\(\)\)\{[\s\S]*?\n\}/),
  wytnij("gornyRocznikKadry", /function gornyRocznikKadry\(kadra, rok = sezonReprezentacyjny\(\)\)\{[\s\S]*?\n\}/),
  wytnij("rocznikPozaKadra", /function rocznikPozaKadra\(t, kadra, rok = sezonReprezentacyjny\(\)\)\{[\s\S]*?\n\}/),
].join("\n");

const { talentWKlubieZagranicznym: talentZaGranica, wKadrzeTalentu, gornyRocznikKadry,
        sezonReprezentacyjny, rocznikPozaKadra } =
  new Function("DB", "dopasujKlubDoNazwy",
    `${kod}\n return { talentWKlubieZagranicznym, wKadrzeTalentu, gornyRocznikKadry,
       sezonReprezentacyjny, rocznikPozaKadra };`)(
      { clubs: POLSKIE.map((name, i) => ({ id: "K" + i, name })) },
      (nazwa) => POLSKIE.find((k) => k.toLowerCase() === String(nazwa).trim().toLowerCase()) || null,
    );

console.log("\n1. Klub spoza bazy to klub zagraniczny");
{
  // Sedno zgłoszenia: ci czterej przychodzą z komunikatu PZPN bez żadnego znacznika.
  ["Chelsea FC", "RCD Espanyol", "FC Porto", "Manchester United"].forEach((klub) =>
    sprawdz(`„${klub}” rozpoznany jako zagraniczny`, talentZaGranica({ club: klub }) === true));
  ["Legia Warszawa", "Lech Poznań", "Stal Rzeszów"].forEach((klub) =>
    sprawdz(`„${klub}” zostaje polski`, talentZaGranica({ club: klub }) === false));
}

console.log("\n2. Czego reguła NIE zgaduje");
{
  // Brak klubu to „nie wiem”, a nie „zagranica”. Zrównanie ich wsadziłoby do Europy każdy wpis
  // z samym nazwiskiem — a takich na liście talentów są setki.
  sprawdz("bez klubu nie jest zagraniczny", talentZaGranica({ club: "" }) === false);
  sprawdz("pusty wpis nie wywraca sprawdzenia", talentZaGranica(null) === false);
  sprawdz("same spacje to też brak klubu", talentZaGranica({ club: "   " }) === false);
}

console.log("\n3. Kolejność źródeł: znacznik → kraj → baza klubów");
{
  // Ręczny znacznik bije wszystko: ktoś tak postanowił, choćby klub był w bazie.
  sprawdz("znacznik Europa wygrywa z polskim klubem",
    talentZaGranica({ club: "Legia Warszawa", europa: true }) === true);
  // Kraj z komunikatu jest faktem i bije dopasowanie nazwy.
  sprawdz("kraj ze źródła przesądza", talentZaGranica({ club: "Nieznany FC", krajKlubu: "Anglia" }) === true);
  sprawdz("kraj „Polska” zostawia w Polsce",
    talentZaGranica({ club: "Akademia spoza bazy", krajKlubu: "Polska" }) === false);
  // Zapis z zakładki Europa bywa złożony: „Chorwacja · CIES: 12” albo „Szwecja U-19”.
  sprawdz("kraj z dopiskiem czyta się poprawnie",
    talentZaGranica({ club: "HNK Hajduk", krajKlubu: "Chorwacja · CIES: 12" }) === true);
}

console.log("\n4. Jedna reguła w zakładce, w liczniku, w wierszu i w arkuszu");
{
  // Przełącznik „kluby polskie / zagraniczne”, zakładka Europa, liczby przy krajach i pobieranie
  // do Excela muszą pytać o to samo. Dwie kopie tego warunku to gotowy rozjazd ekranu z plikiem.
  sprawdz("zakładka Europa pyta o klub, nie o znacznik",
    /if\(k === 'europa'\) return talentWKlubieZagranicznym\(t\);/.test(zrodlo));
  sprawdz("„Talent klubowy” to dopełnienie Europy",
    /if\(k === 'inni'\) return !t\.reprezentacja && !talentWKlubieZagranicznym\(t\);/.test(zrodlo));
  sprawdz("widok i arkusz zawężają tą samą funkcją",
    /DB\.talents\.filter\(t=>wKadrzeTalentu\(t, talentKadra\)\)/.test(zrodlo));
  sprawdz("widok nie trzyma własnej kopii warunku", /const wKadrze = wKadrzeTalentu;/.test(zrodlo));
  sprawdz("licznik krajów liczy tak samo",
    /const eu = DB\.talents\.filter\(t=> talentWKlubieZagranicznym\(t\)\)/.test(zrodlo));
  sprawdz("pigułki roczników też", /const klubowi = DB\.talents\.filter\(t=> wKadrze\(t, 'inni'\)\)/.test(zrodlo));
  sprawdz("wiersz nazywa rzecz po imieniu",
    /talentWKlubieZagranicznym\(t\) \? 'klub zagraniczny' : 'klubu nie ma w bazie'/.test(zrodlo));
  // Brak kraju to brak danej, nie „kraj spoza listy”.
  sprawdz("brak kraju nazywa się brakiem", /\|\| 'Kraj nieznany'/.test(zrodlo));
}

console.log("\n4b. Zakładki po scaleniu reguły");
{
  const chelsea = { club: "Chelsea FC", reprezentacja: "U-16" };
  sprawdz("powołany z Chelsea jest w swojej kadrze", wKadrzeTalentu(chelsea, "U-16") === true);
  sprawdz("…i jednocześnie w Europie", wKadrzeTalentu(chelsea, "europa") === true);
  sprawdz("…ale nie w Talencie klubowym", wKadrzeTalentu(chelsea, "inni") === false);
  const legia = { club: "Legia Warszawa" };
  sprawdz("zawodnik Legii bez powołania to Talent klubowy", wKadrzeTalentu(legia, "inni") === true);
  sprawdz("…i nie ma go w Europie", wKadrzeTalentu(legia, "europa") === false);
}

console.log("\n5. Górny rocznik kadry");
{
  // Rachunek sprawdzony z komunikatami PZPN z sezonu 2026/27: U-17 „górny rocznik 2010”,
  // U-18 „górny rocznik 2009”, U-19 „rocznik 2008”, U-15 „górny rocznik 2012”.
  sprawdz("U-17 w sezonie 2026 to rocznik 2010", gornyRocznikKadry("U-17", 2026) === 2010);
  sprawdz("U-18 to 2009", gornyRocznikKadry("U-18", 2026) === 2009);
  sprawdz("U-19 to 2008", gornyRocznikKadry("U-19", 2026) === 2008);
  sprawdz("U-15 to 2012", gornyRocznikKadry("U-15", 2026) === 2012);
  sprawdz("U-21 to 2006", gornyRocznikKadry("U-21", 2026) === 2006);
  sprawdz("poza kadrą młodzieżową nie ma rocznika granicznego", gornyRocznikKadry("", 2026) === null);
  sprawdz("„kadra Polski” nie ma granicy wieku", gornyRocznikKadry("kadra Polski", 2026) === null);
  // Sezon reprezentacyjny zaczyna się latem — w styczniu obowiązuje jeszcze poprzedni rocznik.
  sprawdz("listopad należy do sezonu bieżącego", sezonReprezentacyjny(new Date(2026, 10, 12)) === 2026);
  sprawdz("styczeń jeszcze do poprzedniego", sezonReprezentacyjny(new Date(2027, 0, 15)) === 2026);
  sprawdz("lipiec otwiera nowy sezon", sezonReprezentacyjny(new Date(2027, 6, 1)) === 2027);
}

console.log("\n6. Zgłaszamy tylko za starych");
{
  // Młodszy rocznik w starszej kadrze to wyróżnienie, nie błąd — 2011 w U-17 zostawiamy w spokoju.
  sprawdz("młodszy w starszej kadrze przechodzi", rocznikPozaKadra({ birthYear: 2011 }, "U-17", 2026) === false);
  sprawdz("w swoim roczniku przechodzi", rocznikPozaKadra({ birthYear: 2010 }, "U-17", 2026) === false);
  sprawdz("starszy jest zgłaszany", rocznikPozaKadra({ birthYear: 2008 }, "U-17", 2026) === true);
  sprawdz("bez rocznika nie zgadujemy", rocznikPozaKadra({ birthYear: "" }, "U-17", 2026) === false);
  sprawdz("rocznik jako tekst też się liczy", rocznikPozaKadra({ birthYear: "2008" }, "U-17", 2026) === true);
  sprawdz("bez kadry nie ma czego sprawdzać", rocznikPozaKadra({ birthYear: 2000 }, "", 2026) === false);
}

console.log(bledy ? `\nBŁĘDÓW: ${bledy}\n` : "\nWszystko w porządku.\n");
process.exit(bledy ? 1 : 0);
