// ODCZYT SKŁADU Z WKLEJONEGO TEKSTU — JEDEN DLA OBU APLIKACJI.
//
// PO CO OSOBNY MODUŁ. Ten sam odczyt jest potrzebny w dwóch miejscach: w panelu na telefonie
// (scout na trybunie) i w systemie na komputerze (planowanie obserwacji). Dopisanie drugiej kopii
// byłoby powtórzeniem błędu, który ten projekt już raz popełnił przy zbieraczu ŁNP — istniały
// wtedy dwie kopie tego samego kodu, poprawki szły do jednej, a druga po cichu została w tyle
// i wracała do ludzi jako błąd naprawiony miesiąc wcześniej.
//
// SKĄD BIERZE SIĘ TEN TEKST. Z dowolnej strony pokazującej skład — ŁNP, serwis wynikowy, strona
// klubu. Na komputerze wystarczy zaznaczyć skład myszą i skopiować; na telefonie z iPhone'em
// tekst da się wyjąć wprost ze zrzutu ekranu. Różne strony układają to samo inaczej, więc odczyt
// nie zakłada jednego formatu — rozpoznaje to, co się powtarza: numer, nazwisko, nagłówek sekcji.
//
// ZASADA NADRZĘDNA: LEPIEJ POMINĄĆ NIŻ ZMYŚLIĆ. Wiersz, którego nie umiemy rozpoznać jako
// nazwiska, wypada. Zawodnik, którego na boisku nie było, psuje całą obserwację — a brakującego
// scout dopisze w pięć sekund.

export interface SkladZawodnik {
  nazwa: string;
  numer?: string;
  podstawowy?: boolean;
  zszedl?: boolean;
  wyrozniony?: boolean;
  // Pola dokładane przez panel mobilny: pozycja na mapie (numer z POZYCJE), szybka ocena
  // i notatka. Żyją razem z resztą składu w ratings.__ext.skladMeczu, więc nie wymagają
  // zmian w bazie. Uwaga: ponowny import składu na komputerze przebudowuje zawodników
  // i te pola by wtedy przepadły — dlatego mapę układa się po wczytaniu składu, nie przed.
  pozycja?: number;
  ocena?: Record<string, number>;
  notatka?: string;
  playerId?: string;
}

// Nazwa klubu bez form prawnych i interpunkcji — do porównywania nagłówków z nazwami drużyn.
export const normKlub = (s: string) => String(s || "").toLowerCase()
  .replace(/\bs\s*\.?\s*a\s*\.?\b/g, " ")
  .replace(/\bsp\s*\.?\s*z\s*o\s*\.?\s*o\s*\.?\b/g, " ")
  .replace(/\bs\s*\.?\s*k\s*\.?\s*a\s*\.?\b/g, " ")
  .replace(/[.,]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

// Człony oznaczające ZESPÓŁ, nie klub. Odpadają z porównania nazw, bo w terminarzach stoją
// w różnych miejscach nazwy: „Arka II Gdynia" i „Arka Gdynia II" to jedna drużyna.
export const TOKEN_ZESPOLU = /^(?:ii|iii|[123]|u-?\d{1,2}|junior\w*|jun|rezerw\w*)$/i;
export const slowaKlubu = (n: string) =>
  n.split(" ").filter((w) => w.length > 1 && !TOKEN_ZESPOLU.test(w));

// Pierwsze słowa wierszy, które nazwiskiem nie są. Lista rosła od prawdziwych wklejek — każdy
// wpis to ktoś, kto kiedyś wszedł do składu jako „zawodnik" o nazwisku „Mecze" albo „Sędzia".
const NIE_ZAWODNIK = new Set([
  "przebieg", "sklady", "skład", "składy", "szczegoly", "szczegóły", "statystyki", "sedzia",
  "sędzia", "sedziowie", "sędziowie", "widzow", "widzów", "widzowie", "trener", "trenerzy",
  "rezerwowi", "lawka", "ławka", "zmiany", "kartki", "gole", "bramki", "mecz", "tabela",
  "terminarz", "komentarze", "relacja", "wynik", "stadion", "data", "godzina", "kolejka",
  "liga", "runda", "sezon", "druzyna", "drużyna", "zawodnik", "zawodnicy", "minuta", "minuty",
  "asysta", "asysty", "obserwator", "delegat", "widownia", "podsumowanie", "poczatek", "początek",
  // Dolne menu i zakładki ŁNP — wpadały do składu jako „zawodnicy" o nazwiskach „Mecze"
  // i „Ulubione". Sprawdzane jest PIERWSZE słowo wiersza, stąd „dziś" osobno.
  "mecze", "rozgrywki", "ulubione", "dzis", "dziś", "wyjsciowy", "wyjściowy",
  "rezerwa", "rezerwowy", "ekstraklasa", "clj",
]);

const WIELKA_MALE = /[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,}/;

export function parsujSklad(tekst: string, nazwyDruzyn: string[] = []): SkladZawodnik[] {
  const wynik: SkladZawodnik[] = [];
  const juzJest = new Set<string>();
  // Nagłówek z nazwą klubu stoi w środku wklejki i wygląda jak nazwisko: „KORONA SA Kielce"
  // nie jest w całości wersalikami, więc odsiew wersalików go przepuszczał. Znamy nazwy obu
  // drużyn z pola „Mecz", więc zamiast zgadywać po kształcie — porównujemy wprost.
  const naglowki = new Set(nazwyDruzyn.map((x) => normKlub(x)).filter(Boolean));
  // Numer z POPRZEDNIEGO wiersza. W aplikacjach z wynikami numer stoi we własnej komórce tabeli,
  // więc po skopiowaniu ląduje w osobnym wierszu, nad nazwiskiem:
  //     8
  //     Tomasz Boczek
  // Sam numer nie jest zawodnikiem, ale wyrzucenie go razem ze śmieciami kosztowało najważniejszą
  // informację na liście — bez numeru nie da się rozpoznać zawodnika z trybuny.
  let numerZPoprzedniego: string | undefined;

  // GDZIE W TEKŚCIE JESTEŚMY. Strona meczu w ŁNP dzieli zawodników na „Skład wyjściowy"
  // i „Skład rezerwowy", a pod nimi ma jeszcze „Sztab" — trenerów, fizjoterapeutów i lekarza,
  // wypisanych dokładnie tak samo jak zawodników, z imieniem i nazwiskiem. Bez rozpoznania tych
  // nagłówków wklejenie całej sekcji dokładało do składu jedenaście osób z ławki trenerskiej,
  // a rezerwowi wchodzili jako pierwszy skład.
  let rezerwa = false;
  let wSztabie = false;

  for (const surowy of tekst.split("\n")) {
    let w = surowy.trim();

    if (/^sk[łl]ad\s+rezerwow/i.test(w)) { rezerwa = true; wSztabie = false; numerZPoprzedniego = undefined; continue; }
    if (/^sk[łl]ad\s+(wyj[śs]ciow|podstawow)/i.test(w)) { rezerwa = false; wSztabie = false; numerZPoprzedniego = undefined; continue; }
    // Sztab ciągnie się do końca sekcji drużyny — przerywa go dopiero następny nagłówek składu.
    if (/^sztab\b/i.test(w)) { wSztabie = true; numerZPoprzedniego = undefined; continue; }
    if (wSztabie) { numerZPoprzedniego = undefined; continue; }

    // Wiersz będący wyłącznie liczbą to numer koszulki czekający na nazwisko. Minuty zmian
    // („70 '") mają apostrof i tu nie wpadną — inaczej podmieniałyby numery kolejnym zawodnikom.
    if (/^\d{1,2}$/.test(w)) { numerZPoprzedniego = w; continue; }

    if (w.length < 3 || w.length > 60) continue;

    let numer = numerZPoprzedniego;
    const zNumerem = w.match(/^(\d{1,2})[.)\s]+(.+)$/);
    if (zNumerem) { numer = zNumerem[1]; w = zNumerem[2].trim(); }

    // Ogony po nazwisku: minuty, kartki, nawiasy ze zmianą.
    w = w.replace(/\(.*?\)/g, " ").replace(/\d{1,3}\s*['’]/g, " ").replace(/\s{2,}/g, " ").trim();
    if (w.length < 3) continue;

    if (w === w.toUpperCase()) continue;                       // wersaliki = klub albo nagłówek
    if (!WIELKA_MALE.test(w)) continue;
    if (/\d{1,2}:\d{2}/.test(w)) continue;                    // godzina
    if (/^\d+\s*[-–—]\s*\d+$/.test(w)) continue;              // wynik

    const slowa = w.split(/\s+/);
    if (slowa.length > 4) continue;                            // zdanie, nie nazwisko

    const pierwsze = slowa[0].replace(/[.:,;)\]]+$/, "").toLowerCase();
    if (NIE_ZAWODNIK.has(pierwsze)) continue;
    if (/\d{3,}/.test(w)) continue;

    // Nazwa klubu — nagłówek sekcji, nie zawodnik. Porównanie po słowach, bo w nagłówku bywa
    // forma prawna („KORONA SA Kielce"), której w polu „Mecz" nie ma.
    const slowaWiersza = slowaKlubu(normKlub(w));
    if (slowaWiersza.length && [...naglowki].some((h) => {
      const sh = slowaKlubu(h);
      return sh.length && (sh.every((x) => slowaWiersza.includes(x)) || slowaWiersza.every((x) => sh.includes(x)));
    })) { numerZPoprzedniego = undefined; continue; }

    const klucz = w.toLowerCase();
    if (juzJest.has(klucz)) { numerZPoprzedniego = undefined; continue; }
    juzJest.add(klucz);
    // `podstawowy` zapisujemy tylko wtedy, gdy tekst NAPRAWDĘ to rozstrzygnął — czyli gdy padł
    // nagłówek składu rezerwowego. Przy zwykłej liście nazwisk nie zgadujemy, kto wyszedł w
    // pierwszym składzie.
    const wpis: SkladZawodnik = numer ? { nazwa: w, numer } : { nazwa: w };
    if (rezerwa) wpis.podstawowy = false;
    wynik.push(wpis);
    numerZPoprzedniego = undefined;   // numer zużyty — nie może spłynąć na następne nazwisko
  }
  return wynik;
}

// ROZDZIELENIE WKLEJKI NA DWIE DRUŻYNY.
//
// Skopiowana strona meczu niesie oba składy jeden pod drugim, rozdzielone nagłówkiem z nazwą
// klubu. Scout nie ma czego dzielić ręcznie — a podział „na pół" byłby zgadywaniem, bo drużyny
// rzadko mają tyle samo wypisanych zawodników (ławka bywa różnej długości).
//
// Dzielimy więc tam, gdzie w tekście pada nazwa DRUGIEJ drużyny. Gdy nie pada — oddajemy wszystko
// jako jedną listę i mówimy o tym wprost, zamiast rozcinać w przypadkowym miejscu.
export function podzielNaDruzyny(
  tekst: string,
  gospodarz: string,
  gosc: string,
): { gospodarze: SkladZawodnik[]; goscie: SkladZawodnik[]; podzielone: boolean } {
  const linie = String(tekst || "").split("\n");
  const pasuje = (linia: string, nazwa: string) => {
    const sl = slowaKlubu(normKlub(linia.trim()));
    const sn = slowaKlubu(normKlub(nazwa));
    if (!sl.length || !sn.length) return false;
    return sn.every((x) => sl.includes(x));
  };

  // Szukamy nagłówka drugiej drużyny POZA pierwszym wierszem: wklejka zaczyna się zwykle od
  // nazwy gospodarza, a gdy zaczyna się od gościa — i tak rozdzieli ją nazwa tego drugiego.
  let ciecie = -1;
  for (let i = 1; i < linie.length; i++) {
    if (pasuje(linie[i], gosc) || (ciecie < 0 && pasuje(linie[i], gospodarz) && i > 3)) { ciecie = i; break; }
  }

  const nazwy = [gospodarz, gosc].filter(Boolean);
  if (ciecie < 0) {
    return { gospodarze: parsujSklad(tekst, nazwy), goscie: [], podzielone: false };
  }
  return {
    gospodarze: parsujSklad(linie.slice(0, ciecie).join("\n"), nazwy),
    goscie: parsujSklad(linie.slice(ciecie).join("\n"), nazwy),
    podzielone: true,
  };
}
