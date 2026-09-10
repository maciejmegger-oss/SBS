// SZUKANIE ZAWODNIKA NA TRANSFERMARKCIE PO NAZWISKU.
//
// PO CO: api/transfermarkt.js czyta profil, ale trzeba mu podać ADRES. Przy powołaniach do kadry
// mamy tylko imię, nazwisko i klub — a to właśnie ci zawodnicy są najcenniejsi i najtrudniejsi do
// opisania: grają w Chelsea, Bayernie i PSV, więc z polskich protokołów nie zbierzemy o nich nic.
// Ten punkt zamienia nazwisko na adres profilu.
//
// CO ODDAJEMY: samą listę kandydatów (nazwa + adres). Odczyt profilu zostaje tam, gdzie był —
// wołający bierze wybrany adres i pyta o niego api/transfermarkt. Dzięki temu jest jedno miejsce,
// w którym rozbieramy stronę profilu, a nie dwa, które mogłyby się rozjechać.
//
// CZEGO TU NIE MA: rozstrzygania, który kandydat jest właściwy. Przy samym nazwisku serwis oddaje
// dziesięciu „Kowalskich" i żaden serwer tego nie rozsądzi — decyzję podejmuje aplikacja,
// porównując klub, albo człowiek. Zgadywanie kończyłoby się cudzą datą urodzenia w kartotece.

const NAGLOWKI = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "pl-PL,pl;q=0.9",
  "Accept": "text/html,application/xhtml+xml",
};

const odsloniec = (s) =>
  String(s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export default async function handler(req, res) {
  const fraza = String((req.query && req.query.szukaj) || "").trim();
  if (fraza.length < 3) {
    return res.status(400).json({ error: "Podaj przynajmniej trzy znaki nazwiska." });
  }

  const adres = "https://www.transfermarkt.pl/schnellsuche/ergebnis/schnellsuche?query=" + encodeURIComponent(fraza);
  let html;
  try {
    const odp = await fetch(adres, { headers: NAGLOWKI });
    if (!odp.ok) {
      return res.status(502).json({
        error: `Transfermarkt odpowiedział kodem ${odp.status}.`,
        podpowiedz: odp.status === 403 || odp.status === 429
          ? "Serwis chwilowo odrzuca zapytania — spróbuj za kilka minut."
          : "Spróbuj ponownie za chwilę.",
      });
    }
    html = await odp.text();
  } catch (e) {
    return res.status(502).json({ error: "Nie udało się połączyć z Transfermarktem: " + String((e && e.message) || e) });
  }

  // Ten sam profil bywa w wierszu dwa razy — raz jako zdjęcie, raz jako nazwisko. Klucz po
  // identyfikatorze zostawia jedno wystąpienie, a nazwę bierzemy z tego, które ma tekst.
  const kandydaci = new Map();
  const WZOR = /<a[^>]+href="(\/[^"]*\/profil\/spieler\/(\d+))"[^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m;
  while ((m = WZOR.exec(html)) !== null) {
    const id = m[2];
    const nazwa = odsloniec(m[3]);
    const url = "https://www.transfermarkt.pl" + m[1];
    const byl = kandydaci.get(id);
    if (!byl) kandydaci.set(id, { id, nazwa, url });
    else if (!byl.nazwa && nazwa) byl.nazwa = nazwa;
  }

  const lista = [...kandydaci.values()].filter((k) => k.nazwa).slice(0, 10);
  res.setHeader("cache-control", "public, s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).json({ pytanie: fraza, ilu: lista.length, kandydaci: lista });
}
