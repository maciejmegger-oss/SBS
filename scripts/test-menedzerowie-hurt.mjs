// Sprawdza zbiorcze uzupełnianie menedżerów z Transfermarktu — na PRAWDZIWYM kodzie z src/main.ts.
//
// Zgłoszenie (01.10.2026): „zweryfikuj przy wszystkich zawodnikach od ekstraklasy do 3 ligi
// menadżerów i agencje, prawie nikt w ekstraklasie nie ma menadżera, a w Transfermarkcie mają".
//
// Najważniejsze nie jest to, że funkcja dopisuje menedżera, tylko czego NIE robi:
// nie zgaduje przy kilku profilach o tym samym nazwisku i nie zamienia „TM nic nie podaje"
// w „zawodnik nie ma menedżera". Wpisanie cudzego menedżera albo fałszywe „bez agencji" jest
// dla agencji gorsze niż puste pole.
//
// Uruchomienie:  node scripts/test-menedzerowie-hurt.mjs
import fs from "node:fs";

// Końce wierszy normalizujemy raz — plik jest zapisywany w CRLF, a wzorce w teście piszemy
// zwyczajnie, z samym \n.
const zrodlo = fs.readFileSync("src/main.ts", "utf8").replace(/\r\n/g, "\n");
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
  wytnij("LIGI_DO_MENEDZEROW", /const LIGI_DO_MENEDZEROW = [^\n]*;/),
  wytnij("NAZWA_TO_BRAK_AGENTA", /const NAZWA_TO_BRAK_AGENTA = [^\n]*;/),
  wytnij("naprawBlednieWpisanychAgentow", /function naprawBlednieWpisanychAgentow\(\)\{[\s\S]*?\n\}/),
  wytnij("zawodnicyDoUzupelnieniaMenedzera", /function zawodnicyDoUzupelnieniaMenedzera\(\)\{[\s\S]*?\n\}/),
].join("\n");

const DB = { players: [
  { id: "A", lastName: "Ekstraklasowy", clubId: "K1", hasAgent: false },
  { id: "B", lastName: "Z agentem", clubId: "K1", hasAgent: true },
  { id: "C", lastName: "Pierwszoligowiec", clubId: "K2", hasAgent: false },
  { id: "D", lastName: "Trzecioligowiec", clubId: "K3", hasAgent: false },
  { id: "E", lastName: "Czwartoligowiec", clubId: "K4", hasAgent: false },
  { id: "F", lastName: "Junior bez ligi", clubId: "K1", hasAgent: false, klubBezLigi: true },
  { id: "G", lastName: "Bez klubu", clubId: "", hasAgent: false },
] };
const LIGI = { K1: "Ekstraklasa", K2: "I liga", K3: "III liga, gr. II", K4: "IV liga (śląska)", "": "" };
const api = new Function("DB", "ligaZawodnika",
  `${kod}\n return { zawodnicyDoUzupelnieniaMenedzera, LIGI_DO_MENEDZEROW, naprawBlednieWpisanychAgentow, NAZWA_TO_BRAK_AGENTA };`)(
  DB, (p) => (p && p.klubBezLigi ? "" : (LIGI[p && p.clubId] || "")));

console.log("\n1. Kogo bierzemy pod uwagę");
{
  const wybrani = api.zawodnicyDoUzupelnieniaMenedzera().map((p) => p.id).join(",");
  sprawdz("Ekstraklasa, I liga i III liga — tak", wybrani.includes("A") && wybrani.includes("C") && wybrani.includes("D"), wybrani);
  sprawdz("zawodnik, który MA już menedżera — pomijany (wpis skauta ma pierwszeństwo)", !wybrani.includes("B"), wybrani);
  sprawdz("IV liga poza zakresem zgłoszenia", !wybrani.includes("E"), wybrani);
  sprawdz('junior „sam klub, bez ligi" nie wchodzi', !wybrani.includes("F"), wybrani);
  sprawdz("zawodnik bez klubu nie wchodzi", !wybrani.includes("G"), wybrani);
  sprawdz("II liga też objęta", api.LIGI_DO_MENEDZEROW.test("II liga"));
  sprawdz("IV liga nie myli się z I ligą", !api.LIGI_DO_MENEDZEROW.test("IV liga (śląska)"));
  sprawdz("grupa przy III lidze nie przeszkadza", api.LIGI_DO_MENEDZEROW.test("III liga, gr. II"));
}

console.log('\n1a. „Bez agenta" to zdanie, nie nazwa agencji');
// Zauważone na żywo (01.10.2026) w trakcie pierwszego przebiegu: przy jednym zawodniku wpisało
// agencję „Bez agenta". Tak Transfermarkt pisze, że zawodnik agenta NIE MA — wzięte dosłownie
// oznaczało go jako reprezentowanego, czyli odwrotnie niż jest naprawdę.
{
  ['Bez agenta', 'bez agencji', 'Brak', '-', 'Ohne Berater', 'k.A.'].forEach(t =>
    sprawdz(`„${t}" nie jest agencją`, api.NAZWA_TO_BRAK_AGENTA ? api.NAZWA_TO_BRAK_AGENTA.test(t) : false, t));
  sprawdz('prawdziwa agencja przechodzi', !api.NAZWA_TO_BRAK_AGENTA.test('HCM Sports Management'));
  DB.players.push({ id: "X", lastName: "Zle wpisany", clubId: "K1", hasAgent: true, agencyName: "Bez agenta", agencyId: "AG1" });
  const poprawione = api.naprawBlednieWpisanychAgentow();
  const x = DB.players.find(p => p.id === "X");
  sprawdz('wpis z poprzedniego przebiegu jest prostowany', poprawione === 1 && x.hasAgent === false && !x.agencyName && !x.agencyId);
  sprawdz('i wraca do sprawdzenia', api.zawodnicyDoUzupelnieniaMenedzera().some(p => p.id === "X"));
  DB.players = DB.players.filter(p => p.id !== "X");
  sprawdz('po stronie serwera to samo — „Bez agenta" nie wraca jako nazwa',
    /const BRAK_AGENTA = \/\^\(bez agenta\|bez agencji/.test(fs.readFileSync("api/transfermarkt.js", "utf8")));
}

console.log("\n2. Czego funkcja NIE robi — to jest tu najważniejsze");
const f = wytnij("uzupelnijMenedzerowHurt", /async function uzupelnijMenedzerowHurt\(\)\{[\s\S]*?\n\}\n/);
sprawdz("kilka profili o tym samym nazwisku — pomija, nie zgaduje",
  /if\(kand\.length !== 1\)\{[\s\S]{0,420}continue;/.test(f));
sprawdz("powod pominiecia napisany wprost", /pomijam, żeby nie wpisać cudzego menedżera/.test(f));
sprawdz('brak wpisu na TM NIE ustawia „nie ma menedżera” — zapisuje tylko datę sprawdzenia',
  /} else \{\s*\n\s*licz\.bezWpisu\+\+;/.test(f) && !/hasAgent = false/.test(f));
sprawdz("napisane w kodzie, dlaczego tak", /To brak danych, nie potwierdzenie\s*\n\s*\/\/\s*braku/.test(zrodlo));
sprawdz("zawodników z menedżerem nie dotyka", /nie dotyka zawodników, którzy menedżera już mają/.test(zrodlo));

console.log("\n3. Przebieg");
sprawdz("adres profilu z kartoteki, a gdy go nie ma — szukanie po nazwisku",
  /let adres = String\(p\.profileTm \|\| ''\)\.trim\(\);[\s\S]{0,200}api\/tm-szukaj/.test(f));
sprawdz("znaleziony adres zapamiętany w kartotece (następnym razem bez szukania)",
  /p\.profileTm = adres;/.test(f));
sprawdz("menedżer wiązany z agencją po odnośniku z TM (pewniejszy niż nazwa)",
  /znajdzLubUtworzAgencje\(menedzer, String\(prof\.menadzerLink \|\| ''\)\)/.test(f)
  && /if\(p\.agencyId !== agencja\.id\) p\.agentId = '';/.test(f));
sprawdz("pełna nazwa agencji, nie ucięta wielokropkiem przez Transfermarkt",
  /const zTytulu =[\s\S]{0,120}title="\(\[\^"\]\+\)"/.test(fs.readFileSync("api/transfermarkt.js", "utf8")));
sprawdz("data i źródło sprawdzenia zapisane", /p\.agentCheckedAt = dzis;\s*\n\s*p\.agentSource = 'Transfermarkt \(profil\)';/.test(f));
sprawdz("zapis do bazy co 20 zawodników — przerwanie nie kasuje pracy",
  /if\(odOstatniegoZapisu >= 20\) await zapisz\(\);/.test(f));
sprawdz("przerwane w połowie też zapisuje resztę", /if\(odOstatniegoZapisu\) await zapisz\(\);/.test(f));
sprawdz("odstęp między zapytaniami, żeby TM nie odciął", /setTimeout\(r, 500\)/.test(f));
sprawdz("nieudany zapis mówi wprost, że dane są tylko na ekranie",
  /Zapis do bazy się nie udał — poprawione wpisy są na ekranie, ale nie w bazie\./.test(f));
sprawdz("postęp widać na bieżąco: sprawdzone, z menedżerem, niejednoznaczne",
  /Sprawdzone: <b>\$\{licz\.sprawdzonych\}<\/b>/.test(f) && /niejednoznaczne/.test(f));
sprawdz("można przerwać w trakcie", /przerwane = true;/.test(f));

console.log("\n4. Podpięcie");
sprawdz("przycisk w zakładce Menedżerowie", /data-action="agenci-hurt"/.test(zrodlo));
sprawdz("przycisk opisuje zakres (Ekstraklasa–III liga)", /Uzupełnij menedżerów \(Ekstraklasa–III liga\)/.test(zrodlo));
sprawdz("tylko administrator — to zmiana w całej kartotece",
  /\[data-action="agenci-hurt"\][\s\S]{0,200}tylkoAdmin/.test(zrodlo));
sprawdz("klient tej czynności nie widzi", /'agent-apply','agenci-hurt',/.test(zrodlo));

console.log('\n5. Dwa różne „Nie" na liście');
// Zgłoszenie (01.10.2026): „jeśli ktoś faktycznie nie ma, to zostaje »nie« i to ważna, istotna
// wiadomość odnośnie zawodników". Sprawdzone „Nie" to otwarte pole do kontaktu; niesprawdzone
// to tylko brak wiedzy — i nie może wyglądać tak samo.
{
  const t = wytnij("agentToggleHtml", /function agentToggleHtml\(p\)\{[\s\S]*?\n\}/);
  const toggle = new Function("esc", `${t}\n return agentToggleHtml;`)((x) => String(x ?? ""));
  const zAgentem = toggle({ id: "A", hasAgent: true, agencyName: "Pro Sport" });
  const sprawdzonyBez = toggle({ id: "B", hasAgent: false, agentCheckedAt: "2026-10-01", agentSource: "Transfermarkt (profil)" });
  const niesprawdzony = toggle({ id: "C", hasAgent: false });
  sprawdz("ma menedżera — Tak, z nazwą agencji w podpowiedzi", />Tak</.test(zAgentem) && /Pro Sport/.test(zAgentem));
  sprawdz('sprawdzony bez menedżera — zwykłe „Nie", pełnym drukiem',
    />Nie</.test(sprawdzonyBez) && !/agent-niesprawdzony/.test(sprawdzonyBez), sprawdzonyBez);
  sprawdz("i mówi, kiedy oraz skąd to wiadomo",
    /Sprawdzone 2026-10-01 — Transfermarkt \(profil\): nikt go nie reprezentuje/.test(sprawdzonyBez), sprawdzonyBez);
  sprawdz('niesprawdzony — przygaszone „Nie ?", nie udaje wiedzy',
    /agent-niesprawdzony/.test(niesprawdzony) && /Nie&#8239;\?/.test(niesprawdzony), niesprawdzony);
  sprawdz("podpowiedź mówi wprost, że nie wiemy",
    /Jeszcze nie sprawdzone — nie wiemy, czy ma menedżera/.test(niesprawdzony));
  sprawdz("przygaszenie opisane w arkuszu stylów",
    /\.agent-niesprawdzony\{opacity:\.5/.test(fs.readFileSync("src/style.css", "utf8")));
}

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
