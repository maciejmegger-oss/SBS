// Sprawdza skrzynkę na zebrane protokoły: zakładka oddaje je na serwer, aplikacja stamtąd bierze.
//
// Zgłoszenie wprost z pracy (06.10.2026): zbieranie kolejek IV ligi działa, ale przekazanie ich do
// aplikacji potrafi się nie udać — przeglądarka blokuje i schowek, i nowe okno. Kilka minut
// zbierania idzie wtedy do kosza, a skaut widzi tylko „aplikacja się nie odezwała".
//
// Uruchomienie:  node scripts/test-skrzynka-protokolow.mjs
import fs from "node:fs";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + dodatek}`);
  if (!warunek) bledy++;
};

const serwer = fs.readFileSync("api/wklejka-lnp.js", "utf8");
const zakladka = fs.readFileSync("public/zakladka-lnp-v2.js", "utf8");
const app = fs.readFileSync("src/main.ts", "utf8").replace(/\r\n/g, "\n");

console.log("\n1. Skrzynka po stronie serwera");
sprawdz("przyjmuje POST i oddaje GET", /req\.method === "POST"/.test(serwer) && /req\.method === "GET"/.test(serwer));
sprawdz("pisze kluczem serwisowym — przeglądarka na ŁNP nie ma dostępu do bazy",
  /import \{ BAZA, naglowkiBazy, MA_KLUCZ_SERWISOWY \} from "\.\/_baza\.js"/.test(serwer));
sprawdz("bez klucza serwisowego mówi wprost, czego brakuje", /SUPABASE_SERVICE_KEY/.test(serwer));
sprawdz("wpuszcza tylko ŁNP i naszą stronę",
  /DOZWOLONE = \["https:\/\/www\.laczynaspilka\.pl", "https:\/\/laczynaspilka\.pl", "https:\/\/www\.scoutbasesystem\.com"\]/.test(serwer));
sprawdz("odpowiada na zapytanie wstępne przeglądarki", /if \(req\.method === "OPTIONS"\) return res\.status\(204\)/.test(serwer));
sprawdz("pusta treść odrzucana", /Pusta treść — nie ma czego zapisać/.test(serwer));
sprawdz("ogromna paczka odrzucana z wyjaśnieniem", /tresc\.length > 2_000_000/.test(serwer) && /Za duża paczka/.test(serwer));
sprawdz("pusta skrzynka mówi, co zrobić", /najpierw zbierz kolejkę zakładką na ŁNP/.test(serwer));
sprawdz("nowa zbiórka nadpisuje poprzednią (to skrzynka, nie archiwum)",
  /Prefer: "resolution=merge-duplicates"/.test(serwer));

console.log("\n2. Zakładka wysyła też tam");
sprawdz("wysyłka na serwer obok schowka i okna", /api\/wklejka-lnp/.test(zakladka));
sprawdz("nie czeka na odpowiedź — to droga zapasowa", /\.catch\(function\(\)\{\}\)/.test(zakladka));
sprawdz("wersja zakładki podbita, żeby panel pokazał nową", /SBS_ZBIERACZ="v54 z 06\.10\.2026"/.test(zakladka));

console.log("\n3. Aplikacja odbiera jednym kliknięciem");
sprawdz("przycisk w oknie protokołów", /data-x="ze-skrzynki"/.test(app));
sprawdz("mówi, z kiedy jest zbiórka i ile waży", /Pobrałem zbiórkę z \$\{new Date\(d\.kiedy\)\.toLocaleString\('pl-PL'\)\}/.test(app));
sprawdz("błąd serwera pokazany, nie połknięty", /komunikat = d\.error \|\| 'Nie udało się pobrać zebranych protokołów\.'/.test(app));
sprawdz("wklejanie ręczne zostaje jako druga droga", /data-x="rozpoznaj"/.test(app));

// KOLEJNOŚĆ W TYM JEDNYM KLIKNIĘCIU DECYDUJE O WSZYSTKIM.
//
// rysuj() nadpisuje całe wnętrze okna. Gdy treść wkładaliśmy do pola PRZED przerysowaniem,
// ginęła razem ze starym polem i rozpoznawanie dostawało pustkę. A gdy w handlerze stała
// linijka „wklejka = d.tresc" — zmiennej, której w tym oknie nie ma — przycisk w ogóle nie
// dochodził do rozpoznawania i kończył na „Nie udało się połączyć ze skrzynką: wklejka is not
// defined" (zgłoszone na żywo 06.10.2026, przy 98 protokołach IV ligi dolnośląskiej).
const handler = (app.match(/data-x="ze-skrzynki"\]'\)\.forEach[\s\S]*?\n    \}\);/) || [""])[0];
sprawdz("handler odnaleziony w źródle", handler.length > 200, "zmieniła się nazwa przycisku?");
sprawdz("treść trafia do pola PO przerysowaniu okna",
  handler.indexOf("rysuj();") < handler.indexOf("pole.value = d.tresc"),
  "pole.value przed rysuj() — tekst przepadnie przy przerysowaniu");
sprawdz("po włożeniu treści od razu rozpoznaje",
  handler.indexOf("pole.value = d.tresc") < handler.lastIndexOf("rozpoznaj();"));
// Komentarze odcinamy: w samym źródle stoi wyjaśnienie, co tu kiedyś było, i ono też zawiera
// te słowa — inaczej test oblewałby się o własny komentarz.
const handlerKod = handler.split("\n").filter((w) => !/^\s*\/\//.test(w)).join("\n");
sprawdz("nie pisze do zmiennej, której w tym oknie nie ma",
  !/\bwklejka\s*=/.test(handlerKod), "została linijka „wklejka = …\" — rzuci wyjątkiem");

console.log(bledy ? `\n${bledy} BŁĘDÓW` : "\nWszystko przeszło.");
process.exit(bledy ? 1 : 0);
