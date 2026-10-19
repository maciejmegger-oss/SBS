// SKŁAD KLUBU Z TRANSFERMARKTU — RAZEM Z PRECYZYJNĄ POZYCJĄ KAŻDEGO ZAWODNIKA.
//
// PO CO TO JEST: nasze kartoteki mają pozycję ogólną — „Napastnik", „Obrońca boczny". Przy jednym
// klubie potrafi to dać czternastu napastników stojących na jednym polu mapy, bo nie wiadomo,
// który gra na lewym skrzydle, który na prawym, a który w środku. Transfermarkt rozróżnia to
// dokładnie: Środkowy napastnik, Lewy napastnik, Prawy napastnik, Lewy obrońca, Prawy obrońca,
// Defensywny/Środkowy/Ofensywny pomocnik. To jest dokładnie ta informacja, której mapie brakuje.
//
// DLACZEGO STRONA SKŁADU, A NIE PROFILE: dotychczasowe uzupełnianie pozycji szło profil po
// profilu — jedno zapytanie na zawodnika, czyli przy Ekstraklasie, I i II lidze kilka tysięcy
// żądań. Strona składu oddaje cały zespół w JEDNYM zapytaniu, razem z pozycjami i rocznikami.
// Pięćdziesiąt kilka klubów zamiast kilku tysięcy profili.
//
// CZEGO TU NIE MA: dopasowania do naszych kartotek. Serwer oddaje to, co przeczytał, a decyzję
// „to ten sam zawodnik" podejmuje aplikacja — tak samo jak przy szukaniu klubów i zawodników.

const NAGLOWKI = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "pl-PL,pl;q=0.9",
  "Accept": "text/html,application/xhtml+xml",
};

const DOZWOLONE_HOSTY = /(^|\.)transfermarkt\.[a-z.]+$/i;

// Wiersz zawodnika na stronie składu to zagnieżdżona tabelka: w pierwszym wierszu zdjęcie
// i odnośnik do profilu, w drugim — sama pozycja.
const RE_ZAWODNIK =
  /<table class="inline-table">[\s\S]*?\/profil\/spieler\/(\d+)">\s*([^<]+?)\s*<\/a>[\s\S]*?<tr>\s*<td>\s*([^<]+?)\s*<\/td>/g;

// ENCJE LICZBOWE TEŻ TRZEBA ROZWINĄĆ.
//
// Zgłoszenie (18.10.2026): na ławce stały nazwiska „H&#229;kans" i „W&#229;lemark" zamiast
// „Håkans" i „Wålemark". Rozwijaliśmy tylko encje nazwane (&amp;, &quot;), a Transfermarkt
// zapisuje znaki skandynawskie i południowe liczbowo: &#229; to å, &#243; to ó. Takie nazwisko
// nie dość, że wygląda jak usterka, to jeszcze nie dopasuje się do naszej kartoteki — po
// odrzuceniu znaków spoza alfabetu zostaje z niego „w 229 lemark".
const odsloniec = (s) =>
  String(s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    // &amp; na końcu: inaczej „&amp;#229;" rozwinęłoby się w dwóch krokach do litery,
    // zamiast zostać tekstem „&#229;", którym naprawdę jest.
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** Czyta skład z podanego adresu klubu na Transfermarkcie. */
export async function tmSklad(adres) {
  const u = new URL(adres);
  if (!DOZWOLONE_HOSTY.test(u.hostname)) throw new Error("To nie jest adres Transfermarktu.");

  const odp = await fetch(u.toString(), { headers: NAGLOWKI, signal: AbortSignal.timeout(25000) });
  if (!odp.ok) throw new Error(`Transfermarkt odpowiedział ${odp.status}`);
  const html = await odp.text();

  const zawodnicy = [];
  const widziane = new Set();
  let m;
  RE_ZAWODNIK.lastIndex = 0;
  while ((m = RE_ZAWODNIK.exec(html)) !== null) {
    const tmId = m[1];
    // Ten sam zawodnik bywa na stronie dwa razy (tabela główna i blok wypożyczeń) — bierzemy raz.
    if (widziane.has(tmId)) continue;
    widziane.add(tmId);
    zawodnicy.push({ tmId, nazwa: odsloniec(m[2]), pozycja: odsloniec(m[3]) });
  }

  const nazwaKlubu = (html.match(/<meta property="og:title" content="([^"]+)"/) || [])[1] || "";
  return { klub: odsloniec(nazwaKlubu).replace(/\s*-\s*Transfermarkt.*$/i, ""), zawodnicy };
}

export default async function handler(req, res) {
  const adres = String((req.query && req.query.url) || "").trim();
  if (!adres) {
    return res.status(400).json({
      error: "Podaj adres klubu na Transfermarkcie.",
      podpowiedz: "url=https://www.transfermarkt.pl/nazwa-klubu/startseite/verein/123",
    });
  }
  try {
    const dane = await tmSklad(adres);
    if (!dane.zawodnicy.length) {
      return res.status(404).json({ error: "Na tej stronie nie znalazłem składu.", klub: dane.klub });
    }
    return res.status(200).json(dane);
  } catch (e) {
    return res.status(502).json({
      error: "Nie udało się odczytać składu z Transfermarktu.",
      szczegoly: String((e && e.message) || e),
    });
  }
}
