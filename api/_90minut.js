// Wspólny odczyt terminarzy z 90minut — używany przez /api/schedule (na żądanie z przeglądarki)
// oraz /api/refresh-schedule (cotygodniowe odświeżenie uruchamiane przez harmonogram Vercela).
// Trzymamy to w jednym pliku, żeby obie drogi rozumiały stronę tak samo; wcześniej parser żył
// tylko w endpointcie i nie dało się go użyć nigdzie indziej.

const ALLOWED_HOSTS = new Set(["90minut.pl", "www.90minut.pl"]);

// Adresy rozgrywek na 90minut, sezon 2026/2027. Trzymamy je w jednym miejscu, bo zmieniają się
// co sezon, a korzystają z nich zarówno cotygodniowe odświeżanie terminarzy, jak i pobieranie
// statystyk zawodników — rozjazd między dwiema kopiami byłby błędem nie do zauważenia.
export const ZRODLA_LIG = {
  "Ekstraklasa": ["http://www.90minut.pl/liga/1/liga14675.html"],
  "I liga": ["http://www.90minut.pl/liga/1/liga14676.html"],
  "II liga": ["http://www.90minut.pl/liga/1/liga14677.html"],
  "III liga": [
    "http://www.90minut.pl/liga/1/liga14742.html",
    "http://www.90minut.pl/liga/1/liga14743.html",
    "http://www.90minut.pl/liga/1/liga14744.html",
    "http://www.90minut.pl/liga/1/liga14745.html",
  ],
  // Wszystkie 16 grup wojewódzkich — odczytane ze stron wojewódzkich ZPN na 90minut. Wcześniej
  // było ich tu sześć, więc kluby z pozostałych dziesięciu województw nie miały ani terminarza,
  // ani skąd wziąć statystyk.
  "IV liga": [
    "http://www.90minut.pl/liga/1/liga14768.html",  // dolnośląska
    "http://www.90minut.pl/liga/1/liga14836.html",  // kujawsko-pomorska
    "http://www.90minut.pl/liga/1/liga15026.html",  // lubelska
    "http://www.90minut.pl/liga/1/liga14837.html",  // lubuska
    "http://www.90minut.pl/liga/1/liga14968.html",  // łódzka
    "http://www.90minut.pl/liga/1/liga14839.html",  // małopolska
    "http://www.90minut.pl/liga/1/liga14764.html",  // mazowiecka
    "http://www.90minut.pl/liga/1/liga14808.html",  // opolska
    "http://www.90minut.pl/liga/1/liga14818.html",  // podkarpacka
    "http://www.90minut.pl/liga/1/liga14905.html",  // podlaska
    "http://www.90minut.pl/liga/1/liga14749.html",  // pomorska
    "http://www.90minut.pl/liga/1/liga14747.html",  // śląska
    "http://www.90minut.pl/liga/1/liga14780.html",  // świętokrzyska
    "http://www.90minut.pl/liga/1/liga14771.html",  // warmińsko-mazurska
    "http://www.90minut.pl/liga/1/liga14779.html",  // wielkopolska
    "http://www.90minut.pl/liga/1/liga14748.html",  // zachodniopomorska
  ],
  // Centralna Liga Juniorów. Rozgrywki 2026/27 jeszcze nie wystartowały, więc formatu protokołów
  // nie dało się na nich sprawdzić — strona jest jednak ta sama co w ligach seniorskich.
  "CLJ U19": ["http://www.90minut.pl/liga/1/liga15142.html"],
  "CLJ U17": [
    "http://www.90minut.pl/liga/1/liga15144.html",  // zachodnia
    "http://www.90minut.pl/liga/1/liga15145.html",  // wschodnia
  ],
};

// Nazwa rozgrywek w kartotece klubu niesie także grupę („III liga, gr. I", „IV liga (mazowiecka)"),
// a klucze wyżej są poziomami. Bez tego sprowadzenia żaden klub nie trafiłby w swój adres, bo
// dosłowne porównanie napisów zawodzi dla każdego wpisu poza Ekstraklasą.
//
// Kolejność sprawdzania jest istotna: „IV" przed „III" przed „II" przed „I", inaczej „III liga"
// zostałaby rozpoznana jako pierwsza liga.
export function poziomRozgrywek(nazwa) {
  const t = String(nazwa || "").trim();
  if (/ekstraklasa/i.test(t)) return "Ekstraklasa";
  if (/\bclj\b/i.test(t)) return /u\s*-?\s*17/i.test(t) ? "CLJ U17" : "CLJ U19";
  for (const rzymska of ["IV", "III", "II", "I"]) {
    if (new RegExp(`(^|[^IVX])${rzymska}\\s*liga`, "i").test(t)) return `${rzymska} liga`;
  }
  return "";
}

// Encje HTML rozkodowujemy WSZYSTKIE, nie tylko dwie najczęstsze.
//
// 90minut zapisuje znaki spoza łaciny podstawowej numerycznie, więc „Conceição" przychodzi jako
// „Conceiç&#227;o". Bez rozkodowania nazwisko nie dopasowuje się do kartoteki i zawodnik, który
// tam JEST, ląduje na liście „zagrali, ale nie ma ich w bazie" — a przy dopisaniu powstałby
// duplikat z połamanym nazwiskiem.
const encje = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const strip = (s) =>
  String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => encje[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();

// Allowlista hostów zabezpiecza przed SSRF — bez niej byłby to otwarty pośrednik, przez który
// dałoby się odpytać dowolny adres, w tym adresy wewnętrzne.
export function validateTarget(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return { error: "Niepoprawny adres URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "Dozwolone są tylko adresy http/https." };
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return { error: "Dozwolone są tylko terminarze z 90minut.pl." };
  }
  return { url };
}

export function parseLeagueName(html) {
  const t = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
  return t ? strip(t) : "";
}

const MONTHS = {
  stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
  lipca: 7, sierpnia: 8, września: 9, wrzesnia: 9, października: 10, pazdziernika: 10,
  listopada: 11, grudnia: 12,
};

// Sezon w tytule ("2026/2027") pozwala przypisać rok: runda jesienna (lipiec-grudzień) to rok
// pierwszy, wiosenna (styczeń-czerwiec) drugi. Granica idzie po LIPCU, bo polskie ligi zaczynają
// sezon jeszcze w lipcu — przy granicy na sierpniu pierwsza kolejka lądowała rok za późno.
export function seasonYears(leagueName) {
  const m = leagueName.match(/(\d{4})\/(\d{4})/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}

// "8 sierpnia" / "19-20 września" -> ISO. Przy zakresie bierzemy pierwszy dzień.
export function polishDateToIso(text, years) {
  if (!text || !years) return "";
  const m = text.match(/(\d{1,2})(?:\s*-\s*\d{1,2})?\s+([a-ząćęłńóśźż]+)/i);
  if (!m) return "";
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return "";
  const year = month >= 7 ? years[0] : years[1];
  return `${year}-${String(month).padStart(2, "0")}-${String(parseInt(m[1], 10)).padStart(2, "0")}`;
}

// Dzielimy stronę na sekcje kolejek, a w każdej czytamy wiersze meczów. Datę bierzemy w kolejności:
// 1) atrybut data-date z wiersza kursów (dokładna, ale 90minut dodaje go tylko przy najbliższych
//    meczach), 2) tekst w komórce meczu ("8 sierpnia, 17:00"), 3) zakres z nagłówka kolejki
//    ("Kolejka 9 - 19-20 września") — wtedy oznaczamy datę jako przybliżoną (dateApprox),
// żeby interfejs nie udawał precyzji, której 90minut jeszcze nie podało.
export function parseSchedule(html) {
  const leagueName = parseLeagueName(html);
  const years = seasonYears(leagueName);
  const headings = [...html.matchAll(/Kolejka\s*(\d{1,3})([^<]*)/gi)];
  if (!headings.length) return [];

  const out = [];
  for (let h = 0; h < headings.length; h++) {
    const round = parseInt(headings[h][1], 10);
    const headingDate = polishDateToIso(headings[h][2] || "", years);
    const from = headings[h].index;
    const to = h + 1 < headings.length ? headings[h + 1].index : html.length;
    const segment = html.slice(from, to);

    // Wiersz meczu + opcjonalnie następujący po nim wiersz z kursami (z datą ISO).
    //
    // WIERSZ ROZPOZNAJEMY PO TREŚCI, NIE PO ATRYBUCIE. Wcześniej wymagaliśmy `align="left"` na
    // znaczniku <tr>, a 90minut trzyma wyrównania na komórkach — wtedy terminarz był dla nas
    // pusty i klub z rozegranymi meczami wychodził jako „bez rozegranych spotkań". Bierzemy więc
    // każdy wiersz, w którym po bokach stoją dwie NAZWY (a nie liczby), a w środku wynik albo
    // odnośnik do protokołu. Tabela i krzyżówka wyników odpadają same: tam z brzegu są cyfry.
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>\s*(?:<tr[^>]*class="odds"([^>]*)>)?/gi;
    const maLitery = (t) => /\p{L}{3}/u.test(String(t || ""));
    let m;
    while ((m = rowRe.exec(segment)) !== null) {
      const cells = (m[1].match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(strip);
      if (cells.length < 3) continue;

      const homeTeam = cells[0];
      const awayTeam = cells[2];
      if (!homeTeam || !awayTeam) continue;
      if (!maLitery(homeTeam) || !maLitery(awayTeam)) continue;
      if (homeTeam.length > 60 || awayTeam.length > 60) continue;
      // Nagłówki i wiersze techniczne nie mają dwóch nazw drużyn po bokach separatora.
      if (/^kolejka/i.test(homeTeam)) continue;
      // Środkowa komórka to wynik, myślnik (mecz nierozegrany) albo godzina — plus ewentualny
      // odnośnik do protokołu. Cokolwiek innego znaczy, że to nie jest wiersz meczu.
      const srodek = String(cells[1] || "").trim();
      const wygladaNaMecz = /mecz\.php\?id_mecz=/i.test(m[1])
        || /^\d{1,2}\s*[-:]\s*\d{1,2}$/.test(srodek) || /^[-–—]$/.test(srodek);
      if (!wygladaNaMecz) continue;

      const oddsAttrs = m[2] || "";
      const cellText = cells[3] || "";
      const time = (cellText.match(/(\d{1,2}:\d{2})/) || [])[1] || "";

      // Identyfikator protokołu i wynik biorę z TEGO SAMEGO wiersza, w którym stoją nazwy drużyn.
      // To najpewniejsze powiązanie meczu z klubem, jakie ma ta strona: nazwy są tu zwykłym
      // tekstem, więc nie zależą od tego, czy odnośnik ma podpowiedź (a często jej nie ma).
      // ODNOŚNIK DO PROTOKOŁU — najpierw kanoniczna postać, potem cokolwiek, co wygląda na mecz.
      // Numer rozgrywek bywa zapisany inaczej w różnych ligach, a bez odnośnika mecz jest dla nas
      // niewidoczny, choć w wierszu stoi wynik. Zapisujemy też surowy adres, żeby dało się go użyć
      // wprost, gdy identyfikatora nie ma w spodziewanym miejscu.
      const id = (m[1].match(/mecz\.php\?(?:id_mecz|id)=(\d+)/i) || [])[1] || "";
      const hrefProtokolu = (() => {
        const wszystkie = [...m[1].matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((h) => h[1]);
        return wszystkie.find((h) => /mecz/i.test(h) && !/skarb\.php|wystepy\.php/i.test(h)) || "";
      })();
      const wynikTekst = String(cells[1] || "").trim();
      const rozegrany = /^\d{1,2}\s*[-:]\s*\d{1,2}$/.test(wynikTekst);

      const exactDate =
        (oddsAttrs.match(/data-date="(\d{4}-\d{2}-\d{2})"/) || [])[1] ||
        polishDateToIso(cellText, years);
      const date = exactDate || headingDate;

      out.push({ round, date, time, homeTeam, awayTeam, id, hrefProtokolu,
        wynik: rozegrany ? wynikTekst.replace(/\s*/g, "") : "", rozegrany,
        dateApprox: !exactDate && !!headingDate });
    }
  }
  return out;
}

// Klasyfikacja ligowa z tej samej strony co terminarz — 90minut umieszcza ją nad meczami,
// za znacznikiem „POCZĄTEK TABELI". Bierzemy pierwsze osiem kolumn (miejsce, nazwa, mecze,
// punkty, zwycięstwa, remisy, porażki, bramki); dalsze to rozbicie na dom/wyjazd i mecze
// bezpośrednie, których nie potrzebujemy.
export function parseTabela(html) {
  const start = html.indexOf("POCZĄTEK TABELI");
  const obszar = start >= 0 ? html.slice(start) : html;
  const koniec = obszar.search(/KONIEC TABELI|Kolejka\s*\d/i);
  const segment = koniec > 0 ? obszar.slice(0, koniec) : obszar;

  const out = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  // 90minut wypisuje numer miejsca TYLKO przy pierwszej drużynie danej lokaty — kolejne, mające
  // tyle samo punktów, mają tę komórkę pustą. Odrzucanie takich wierszy gubiło pół tabeli
  // (a przed startem sezonu, gdy wszyscy mają zero, zostawała jedna drużyna). Pustą lokatę
  // dziedziczymy po poprzednim wierszu.
  let ostatnieMiejsce = 0;
  while ((m = rowRe.exec(segment)) !== null) {
    const cells = (m[1].match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(strip);
    if (cells.length < 8) continue;

    const nazwa = cells[1];
    if (!nazwa || /^nazwa$/i.test(nazwa)) continue;
    const surowe = parseInt(String(cells[0]).replace(/\D/g, ""), 10);
    const miejsce = Number.isFinite(surowe) ? surowe : ostatnieMiejsce;
    if (!miejsce) continue;               // wiersz przed pierwszą lokatą to nagłówek
    ostatnieMiejsce = miejsce;

    const liczba = (i) => {
      const n = parseInt(String(cells[i]).replace(/[^\d-]/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    };
    const bramki = String(cells[7] || "").trim();
    const mecze = liczba(2), punkty = liczba(3);
    if (mecze === null || punkty === null) continue;

    out.push({
      miejsce, nazwa, mecze, punkty,
      zwyciestwa: liczba(4), remisy: liczba(5), porazki: liczba(6),
      bramki: /^\d+\s*[-:]\s*\d+$/.test(bramki) ? bramki : "",
    });
  }
  // Odsiewamy po NAZWIE, nie po lokacie — drużyny dzielące miejsce są normalne, a powtórzona
  // nazwa oznaczałaby drugą tabelę na stronie (np. osobno runda jesienna).
  const widziane = new Set();
  return out.filter((w) => {
    const klucz = normalizujNazwe(w.nazwa);
    if (widziane.has(klucz)) return false;
    widziane.add(klucz);
    return true;
  });
}

// Pobranie i rozbiór jednej strony ligi. 90minut serwuje ISO-8859-2 — bez tego dekodera polskie
// nazwy klubów przychodzą zniekształcone.
export async function fetchLeagueSchedule(rawUrl) {
  const { url, error } = validateTarget(rawUrl);
  if (error) return { error };

  const upstream = await fetch(url.toString(), {
    headers: { "User-Agent": "ScoutBaseSystem/1.0 (+https://scoutbasesystem.com)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!upstream.ok) return { error: `90minut odpowiedziało kodem ${upstream.status}.` };

  const buffer = await upstream.arrayBuffer();
  let html;
  try {
    html = new TextDecoder("iso-8859-2").decode(buffer);
  } catch {
    html = new TextDecoder("latin1").decode(buffer);
  }
  return { league: parseLeagueName(html), matches: parseSchedule(html), table: parseTabela(html) };
}

// Klucz meczu: KOLEJKA + para drużyn, świadomie BEZ daty.
//
// Wcześniej mecze rozpoznawano po „data|gospodarz|gość". Gdy 90minut zamieniało datę przybliżoną
// (z nagłówka kolejki) na dokładną, klucz się zmieniał i powstawał DRUGI wpis zamiast aktualizacji
// pierwszego — a obserwacja wskazywała nadal na ten stary, bez godziny. Para drużyn w danej
// kolejce spotyka się raz, więc to jest właściwa tożsamość spotkania.
export const normalizujNazwe = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[łøđ]/g, (c) => ({ ł: "l", ø: "o", đ: "d" }[c]))
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");

// ---------------------------------------------------------------------------
// PORÓWNYWANIE NAZW KLUBÓW
//
// Nazwa tego samego klubu po obu stronach bywa inna, a kolejność członów bywa odwrotna:
// w kartotece „Raków Częstochowa II", na 90minut „Raków II Częstochowa". Sklejanie nazwy w jeden
// ciąg znaków i sprawdzanie zawierania (tak było wcześniej) daje wtedy „nie znalazłem meczów"
// przy klubie, który gra i ma protokoły. Porównujemy więc ZBIORY SŁÓW, a nie ciągi.
//
// Numer drużyny (II, III, „rezerwy") wyłuskujemy osobno i musi się zgadzać. Bez tego zbiór słów
// pierwszej drużyny byłby podzbiorem nazwy rezerw i „Raków Częstochowa" zassałby statystyki
// Rakowa II — pomyłka gorsza niż brak danych.
const SZUM_W_NAZWIE = new Set([
  "ks", "lks", "mks", "uks", "gks", "kks", "zks", "rks", "cwks", "wks", "gkp", "kp", "ksp",
  "mkp", "mgks", "sks", "tks", "kls", "klub", "sportowy", "sportowe", "sa", "ssa", "fc", "sp",
]);
export function czlonyKlubu(nazwa) {
  const slowa = [];
  let numer = 1;
  for (const w of String(nazwa || "").toLowerCase()
    .replace(/[łøđ]/g, (c) => ({ ł: "l", ø: "o", đ: "d" }[c]))
    .normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean)) {
    if (/^(ii|2|b)$/.test(w)) { numer = Math.max(numer, 2); continue; }
    if (/^(iii|3|c)$/.test(w)) { numer = Math.max(numer, 3); continue; }
    if (/^(rezerwy|rezerw|res)$/.test(w)) { numer = Math.max(numer, 2); continue; }
    if (SZUM_W_NAZWIE.has(w)) continue;
    slowa.push(w);
  }
  return { slowa, numer };
}
export function toSamKlub(a, b, opcje) {
  const A = czlonyKlubu(a), B = czlonyKlubu(b);
  if (!A.slowa.length || !B.slowa.length) return false;
  // ignorujNumer: dla wierszy w tabeli występów zawodnika, gdzie rezerwy bywają podpisane nazwą
  // klubu bez „II". Wywołujący musi wtedy sam sprawdzić poziom rozgrywek — samo pominięcie numeru
  // pozwoliłoby wziąć dorobek pierwszej drużyny.
  if (!(opcje && opcje.ignorujNumer) && A.numer !== B.numer) return false;
  // Jedna strona bywa krótsza („Wda" kontra „KP Wda Świecie"), więc wystarczy, że KAŻDE słowo
  // krótszej nazwy stoi w dłuższej. Wspólna część musi mieć ze cztery znaki, żeby „II Łódź"
  // nie sklejało się z pierwszym lepszym klubem z Łodzi.
  const krotsza = A.slowa.length <= B.slowa.length ? A.slowa : B.slowa;
  const dluzsza = A.slowa.length <= B.slowa.length ? B.slowa : A.slowa;
  if (!krotsza.every((w) => dluzsza.includes(w))) return false;
  return krotsza.join("").length >= 4;
}
// Podpowiedź odnośnika do meczu ma postać „Gospodarz - Gość". Sprawdzamy każdą stronę osobno,
// bo szukanie nazwy w całym napisie myli się przy nazwach złożonych z tych samych słów.
export function tytulMaKlub(tytul, nazwaKlubu) {
  const strony = String(tytul || "").split(/\s+[-–—]\s+/);
  if (strony.length >= 2) return strony.some((s) => toSamKlub(s, nazwaKlubu));
  return toSamKlub(tytul, nazwaKlubu);
}

export const kluczMeczu = (m) =>
  `${m.round ?? ""}|${normalizujNazwe(m.homeTeam)}|${normalizujNazwe(m.awayTeam)}`;

// ---------------------------------------------------------------------------
// PROTOKOŁY MECZÓW I STATYSTYKI ZAWODNIKÓW
//
// 90minut to jedyne znane nam źródło, które podaje minuty gry na poziomie zawodnika dla III i
// IV ligi, i robi to w zwykłym HTML-u — bez JavaScriptu i bez bramki reCAPTCHA. Dzięki temu
// czytamy je z serwera, zamiast prosić o kopiowanie stron w przeglądarce.
//
// Podział pracy jest celowy:
//   * strona meczu (mecz.php) służy TYLKO do ustalenia, KTO gra w danym klubie,
//   * liczby bierzemy ze strony zawodnika (wystepy.php), gdzie 90minut podaje gotowe sumy
//     sezonowe. Nie sumujemy więc meczów samodzielnie, co eliminuje całą klasę błędów
//     (mecz policzony dwa razy, pominięta zmiana, doliczony czas).
//
// Czego tu NIE MA: asyst. 90minut ich nie publikuje i nie da się ich stąd wyliczyć.
// ---------------------------------------------------------------------------

const komorki = (wierszHtml) =>
  [...wierszHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => m[1]);

const wiersze = (tabelaHtml) => [...tabelaHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);

const tabele = (html) => [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);

// Krzyżówka wyników na stronie ligi: każdy rozegrany mecz to odnośnik z podpowiedzią
// title="Gospodarz 5-0 Gość". Zwracamy sam identyfikator i tę podpowiedź — nazw drużyn NIE
// rozdzielamy, bo nazwy klubów bywają z liczbami („KKS 1925 Kalisz") i każde cięcie po wyniku
// jest zgadywanką. Do wybrania meczów danego klubu wystarczy sprawdzić, czy jego nazwa
// występuje w podpowiedzi; nazwy drużyn i tak odczytamy potem z samej strony meczu.
export function parseLinkiMeczow(html) {
  const out = new Map();
  // Atrybuty w znaczniku stoją w dowolnej kolejności (href, class, dopiero potem title), więc
  // najpierw wycinamy cały znacznik, a dopiero z niego wyciągamy oba pola. Próba złapania
  // jednym wyrażeniem gubiła podpowiedź i wszystkie mecze wychodziły bez nazw drużyn.
  const re = /<a\b[^>]*mecz\.php\?id_mecz=\d+[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const znacznik = m[0];
    const id = (znacznik.match(/id_mecz=(\d+)/) || [])[1];
    if (!id) continue;
    const tytul = strip((znacznik.match(/title="([^"]*)"/i) || [])[1] || "");
    // Ten sam mecz pojawia się w krzyżówce raz, ale strona bywa łatana ręcznie — pierwsze
    // wystąpienie z niepustą podpowiedzią jest tym właściwym.
    if (!out.has(id) || (!out.get(id) && tytul)) out.set(id, tytul);
  }
  return [...out].map(([id, tytul]) => ({ id, tytul }));
}

// KLUBY Z TABELI ROZGRYWEK — nazwa i identyfikator na 90minut.
//
// Tabela ligowa jest jedynym miejscem na stronie, gdzie nazwa klubu stoi PEŁNA i w jednym kawałku,
// a obok niej jest odnośnik do strony klubu. Szukanie klubu po podpowiedziach odnośników do meczów
// („Gospodarz - Gość") okazało się zawodne: część meczów nie ma tej podpowiedzi w ogóle, więc klub
// bywał niewidoczny, choć gra i ma protokoły. Stąd droga przez tabelę: znajdź klub, weź jego numer,
// a mecze czytaj z jego własnej strony.
export function parseKlubyZTabeli(html) {
  const out = new Map();
  const re = /<a\b[^>]*skarb\.php\?id_klub=(\d+)(?:&(?:amp;)?id_sezon=(\d+))?[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const nazwa = strip(m[3]);
    if (!nazwa || nazwa.length > 60) continue;
    if (!out.has(m[1])) out.set(m[1], { id: m[1], sezon: m[2] || "", nazwa });
  }
  return [...out.values()];
}

// KADRA ZE STRONY KLUBU — druga droga do zawodników, gdy nie ma protokołów.
//
// PO CO TO JEST: w IV lidze 90minut nie prowadzi protokołów meczów (odnośnik przy wyniku przenosi
// na stronę PZPN), więc dotychczasowa droga „protokół → kto grał" urywa się na starcie. Ale strony
// ZAWODNIKÓW 90minut prowadzi także dla niższych lig, a strona klubu jest do nich spisem treści.
// Bierzemy z niej listę zawodników i dalej idziemy dokładnie tą samą drogą co w II i III lidze:
// strona zawodnika oddaje gotowe sumy sezonu — występy, minuty, bramki i kartki.
//
// CZEGO TĄ DROGĄ NIE DOSTANIEMY: przebiegu mecz po meczu (wykresu minut). Sumy sezonowe owszem,
// ale rozbicia na poszczególne spotkania nie ma się skąd wziąć bez protokołów.
export function parseKadraKlubu(html) {
  const out = new Map();
  const re = /<a\b[^>]*wystepy\.php\?id=(\d+)(?:&(?:amp;)?id_sezon=(\d+))?[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const nazwa = strip(m[3]);
    // Odsiewamy odnośniki-ozdobniki: puste, za długie i takie bez ani jednej litery.
    if (!nazwa || nazwa.length > 60 || !/\p{L}/u.test(nazwa)) continue;
    if (!out.has(m[1])) out.set(m[1], { id: m[1], sezon: m[2] || "", nazwa });
  }
  return [...out.values()];
}

// Skład z protokołu meczu. Układ jest trzykolumnowy i stały: lewa komórka to gospodarze,
// prawa to goście, środkowa jest pusta i tylko je rozdziela. Rodzaj kartki poznajemy po
// atrybucie alt obrazka ("ŻK" / "CK") — tekstu przy nim nie ma.
export function parseSkladyMeczu(html) {
  // Nagłówek rozgrywek musi zawierać numer kolejki. Samo „liga" trafiało w pozycje bocznego
  // menu („Transfery - I liga") i mecz III ligi opisywało jako pierwszoligowy.
  const naglowek = strip((html.match(/<b>([^<]*Kolejka[^<]*)<\/b>/i) || [])[1] || "");

  // Nazwy drużyn stoją nad wynikiem, w komórkach szerokości 220 px — ale tylko w podstawowym
  // szablonie protokołu. Gdy go nie ma, sięgamy po odnośniki do stron klubów (każda drużyna
  // w protokole jest do nich podlinkowana), a na końcu po tytuł strony. Bez tego zapasu protokół
  // o innym układzie kończył się komunikatem „nie rozpoznałem strony tego klubu" — i cały klub
  // zostawał bez statystyk, choć jego mecz był już otwarty.
  let nazwy = [...html.matchAll(/<td[^>]*width="220"[^>]*>\s*<b><font[^>]*>([\s\S]*?)<\/font><\/b>/gi)]
    .map((m) => strip(m[1]));
  if (nazwy.filter(Boolean).length < 2) {
    const zOdnosnikow = parseKlubyZTabeli(html).map((k) => k.nazwa);
    if (zOdnosnikow.length >= 2) nazwy = zOdnosnikow.slice(0, 2);
  }
  if (nazwy.filter(Boolean).length < 2) {
    const zTytulu = String(parseLeagueName(html) || "").split(/\s+[-–—]\s+/).map((t) => t.trim())
      .filter((t) => t && !/90minut/i.test(t));
    if (zTytulu.length >= 2) nazwy = zTytulu.slice(-2);
  }

  // W jednej komórce potrafi stać DWÓCH zawodników: schodzący, minuta zmiany i wchodzący
  // („(17) Błażej Starzycki 61 (3) Rafał Remisz"). Czytanie tylko pierwszego odnośnika gubiło
  // wszystkich rezerwowych. Dzielimy więc komórkę na odcinki wyznaczone przez odnośniki:
  // kartki i minuta stojące za nazwiskiem należą do zawodnika, po którym następują.
  const zKomorki = (cel) => {
    const trafienia = [...cel.matchAll(/<a[^>]*wystepy\.php\?id=(\d+)(?:&(?:amp;)?id_sezon=(\d+))?[^>]*>([\s\S]*?)<\/a>/gi)];
    return trafienia.map((a, i) => {
      const poczatek = a.index + a[0].length;
      const koniec = i + 1 < trafienia.length ? trafienia[i + 1].index : cel.length;
      const ogon = cel.slice(poczatek, koniec);
      const podpis = strip(a[3]);
      const nr = (podpis.match(/^\((\d+)\)/) || [])[1];
      // MINUTA ZMIANY DZIAŁA W OBIE STRONY. Liczba stoi w komórce między schodzącym a wchodzącym
      // („Starzycki 61 Remisz"), więc ta sama liczba jest końcem gry jednego i początkiem gry
      // drugiego. Czytamy ją dla KAŻDEGO wpisu, nie tylko dla wyjściowej jedenastki — bez minuty
      // wejścia rezerwowego nie da się policzyć, ile ktoś naprawdę zagrał.
      //
      // Bierzemy OSTATNIĄ liczbę przed następnym nazwiskiem i tylko wtedy, gdy to nazwisko w ogóle
      // jest. Za obrazkiem kartki też stoi minuta — gdyby liczyć pierwszą lepszą, żółta kartka
      // w 30. minucie wyglądałaby jak zejście z boiska w 30. minucie.
      const maNastepnego = i + 1 < trafienia.length;
      const liczbyWOgonie = strip(ogon).match(/\b\d{1,3}\b/g) || [];
      const minuta = maNastepnego && liczbyWOgonie.length ? liczbyWOgonie[liczbyWOgonie.length - 1] : null;
      const poprzedni = i > 0 ? trafienia[i - 1] : null;
      const ogonPoprzedniego = poprzedni
        ? cel.slice(poprzedni.index + poprzedni[0].length, a.index)
        : "";
      const liczbyPoprzedniego = poprzedni ? (strip(ogonPoprzedniego).match(/\b\d{1,3}\b/g) || []) : [];
      const minutaWejscia = liczbyPoprzedniego.length ? liczbyPoprzedniego[liczbyPoprzedniego.length - 1] : null;
      return {
        id: a[1],
        // Numer sezonu bierzemy wprost z odnośnika, zamiast go zgadywać — protokół sam wie,
        // do których rozgrywek należy, i przy meczach z poprzednich lat nadal trafimy dobrze.
        sezon: a[2] || "",
        numer: nr ? parseInt(nr, 10) : null,
        nazwa: podpis.replace(/^\(\d+\)\s*/, ""),
        // Pierwszy odnośnik w komórce to zawodnik z wyjściowej jedenastki, kolejne weszły z ławki.
        podstawowy: i === 0,
        zszedl: minuta ? parseInt(minuta, 10) : null,
        wszedl: i === 0 ? 0 : (minutaWejscia ? parseInt(minutaWejscia, 10) : null),
        zolte: (ogon.match(/alt="ŻK"/g) || []).length,
        czerwone: (ogon.match(/alt="CK"/g) || []).length,
      };
    });
  };

  const gospodarze = [], goscie = [];
  for (const w of wiersze(html)) {
    if (!/wystepy\.php/.test(w)) continue;
    const k = komorki(w);
    if (k.length < 3) continue;
    gospodarze.push(...zKomorki(k[0]));
    goscie.push(...zKomorki(k[2]));
  }

  // Data i wynik — potrzebne dopiero do wykresu minut, więc gdy protokół zapisano nietypowo,
  // po prostu ich nie ma; reszta odczytu działa jak dotąd.
  const tekst = strip(html);
  const dataDm = tekst.match(/\b(\d{1,2})[.-](\d{1,2})[.-](\d{4})\b/);
  const dataIso = tekst.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const data = dataIso
    ? dataIso[0]
    : (dataDm ? `${dataDm[3]}-${String(dataDm[2]).padStart(2,"0")}-${String(dataDm[1]).padStart(2,"0")}` : "");
  const wynikM = html.match(/<b><font[^>]*>\s*(\d{1,2})\s*[:\-]\s*(\d{1,2})\s*<\/font><\/b>/i)
    || tekst.match(/\b(\d{1,2})\s*[:\-]\s*(\d{1,2})\b/);
  const wynik = wynikM ? `${wynikM[1]}:${wynikM[2]}` : "";

  return {
    rozgrywki: naglowek,
    gospodarzeNazwa: nazwy[0] || "",
    goscieNazwa: nazwy[1] || "",
    data,
    wynik,
    gospodarze,
    goscie,
  };
}

// Ile minut zawodnik faktycznie zagrał w tym meczu — z jednego wpisu w protokole.
// Wyjściowa jedenastka bez zmiany gra pełne spotkanie; kto wszedł z ławki, gra od swojej minuty
// do końca; kto zszedł — do minuty zmiany. Doliczonego czasu 90minut nie podaje, więc pełny mecz
// to zawsze równe 90 minut.
export function minutyZWpisu(w, dlugoscMeczu = 90) {
  if (!w) return 0;
  const od = Number.isFinite(w.wszedl) && w.wszedl !== null ? w.wszedl : (w.podstawowy ? 0 : null);
  const doo = Number.isFinite(w.zszedl) && w.zszedl !== null ? w.zszedl : dlugoscMeczu;
  if (od === null) return w.podstawowy ? dlugoscMeczu : 0;
  return Math.max(0, Math.min(dlugoscMeczu, doo) - Math.min(od, dlugoscMeczu));
}

// Zbiorcza tabela występów ze strony zawodnika. Kolumny z bramkami i kartkami mają w nagłówku
// sam obrazek, więc rozpoznajemy je po nazwie pliku (goal.gif / yel.gif / red.gif), a resztę po
// tekście nagłówka. Trzymanie się sztywnych numerów kolumn zepsułoby się przy pierwszej zmianie
// układu strony.
export function parseWystepyZawodnika(html) {
  const nazwa = strip((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "");

  const rocznikTekst = strip(html).match(/Data urodzenia\s+(\d{1,2}\s+[a-ząćęłńóśźż]+\s+(\d{4}))/i);
  const rocznik = rocznikTekst ? parseInt(rocznikTekst[2], 10) : null;

  const tabelaWystepow = tabele(html).filter((t) => /czas gry/i.test(strip(t))).pop();
  if (!tabelaWystepow) return { nazwa, rocznik, sezony: [] };

  const rz = wiersze(tabelaWystepow);
  const naglowki = komorki(rz[0] || "");
  const kolumna = (test) => naglowki.findIndex(test);
  const poTekscie = (wzor) => kolumna((c) => wzor.test(strip(c)));
  const poObrazku = (plik) => kolumna((c) => new RegExp(plik.replace(".", "\\."), "i").test(c));

  const idx = {
    klub: poTekscie(/^drużyna$/i),
    rozgrywki: poTekscie(/^rozgr/i),
    wystepy: poTekscie(/^występy$/i),
    wPodstawowym: poTekscie(/^w\s*"?11/i),
    minuty: poTekscie(/^czas gry$/i),
    gole: poObrazku("goal.gif"),
    zolte: poObrazku("yel.gif"),
    czerwone: poObrazku("red.gif"),
  };
  if (idx.minuty < 0 || idx.wystepy < 0) return { nazwa, rocznik, sezony: [] };

  const liczba = (k, i) => {
    if (i < 0 || i >= k.length) return 0;
    const n = parseInt(strip(k[i]).replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const sezony = [];
  for (const w of rz.slice(1)) {
    const k = komorki(w);
    if (k.length < naglowki.length - 1) continue;
    const rozgrywki = strip(k[idx.rozgrywki] || "");
    sezony.push({
      klub: strip(k[idx.klub] || ""),
      rozgrywki,
      // Wiersz „RAZEM" podsumowuje wszystkie rozgrywki (liga + puchar) — przydaje się jako
      // zapas, gdy nie znamy dokładnej nazwy rozgrywek, ale nie wolno go mylić z ligą.
      podsumowanie: /^razem$/i.test(rozgrywki),
      wystepy: liczba(k, idx.wystepy),
      wPodstawowym: liczba(k, idx.wPodstawowym),
      minuty: liczba(k, idx.minuty),
      gole: liczba(k, idx.gole),
      zolte: liczba(k, idx.zolte),
      czerwone: liczba(k, idx.czerwone),
    });
  }
  return { nazwa, rocznik, sezony };
}

// Wspólne pobranie strony z 90minut. Kodowanie ISO-8859-2 jest tu obowiązkowe — bez niego
// polskie nazwiska przychodzą zniekształcone i nic się nie dopasuje do naszej bazy.
// PAMIĘĆ PODRĘCZNA STRON W OBRĘBIE JEDNEJ INSTANCJI FUNKCJI.
//
// Odświeżenie całej grupy to osiemnaście klubów, a każdy z nich czytał TE SAME cztery strony ligi
// od nowa — siedemdziesiąt kilka pobrań zamiast czterech. To nie tylko wolne: 90minut prowadzą
// wolontariusze i przy takim natężeniu serwis zaczyna odmawiać (429/403 albo urwane połączenie),
// a wtedy klub kończył przebieg komunikatem „nie znalazłem rozegranych meczów" — choć powodem był
// odrzucony strzał, a nie brak meczów. Strona ligi zmienia się raz na kolejkę, protokół rozegranego
// meczu nie zmienia się wcale, więc kilkuminutowa pamięć jest tu w pełni bezpieczna.
const CZAS_ZYCIA_CACHE = 10 * 60 * 1000;
const MAKS_STRON_W_CACHE = 200;
const cacheStron = new Map();

const uspij = (ms) => new Promise((r) => setTimeout(r, ms));

export async function pobierzZ90minut(rawUrl, opcje) {
  const { url, error } = validateTarget(rawUrl);
  if (error) throw new Error(error);
  const klucz = url.toString();

  if (!(opcje && opcje.bezCache)) {
    const zPamieci = cacheStron.get(klucz);
    if (zPamieci && Date.now() - zPamieci.kiedy < CZAS_ZYCIA_CACHE) return zPamieci.html;
  }

  // Jedna ponowna próba po krótkiej przerwie. Odmowy z powodu natężenia ruchu są chwilowe,
  // a bez powtórki cały klub wypadał z przebiegu przez jedno nieudane połączenie.
  let ostatniBlad;
  for (let proba = 0; proba < 2; proba++) {
    if (proba) await uspij(1200);
    try {
      const odp = await fetch(klucz, {
        headers: { "User-Agent": "ScoutBaseSystem/1.0 (+https://scoutbasesystem.com)" },
        signal: AbortSignal.timeout(20000),
      });
      if (!odp.ok) throw new Error(`90minut odpowiedziało kodem ${odp.status}.`);
      const bufor = await odp.arrayBuffer();
      let html;
      try { html = new TextDecoder("iso-8859-2").decode(bufor); }
      catch { html = new TextDecoder("latin1").decode(bufor); }
      if (cacheStron.size >= MAKS_STRON_W_CACHE) cacheStron.delete(cacheStron.keys().next().value);
      cacheStron.set(klucz, { kiedy: Date.now(), html });
      return html;
    } catch (e) {
      ostatniBlad = e;
    }
  }
  throw ostatniBlad instanceof Error ? ostatniBlad : new Error(String(ostatniBlad));
}
