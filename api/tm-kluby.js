// HERB KLUBU Z TRANSFERMARKTU — dla klubów, których nie ma w kartotece SBS.
//
// PO CO: na liście talentów stoją kluby zagraniczne i akademie (PSV Eindhoven, Chelsea, Bayern),
// których nie ma i nie będzie w naszych tabelach, więc nie mają herbu — zostawała zaślepka
// z inicjałami. Transfermarkt ma herb prawie każdego klubu, a adres obrazka wynika wprost
// z identyfikatora klubu.
//
// CO ODDAJEMY: listę kandydatów (nazwa, identyfikator, adres herbu). Który kandydat jest właściwy,
// rozstrzyga aplikacja, porównując nazwę z tą z listy (klubyToSamo) — tak jak przy szukaniu
// zawodników w api/tm-szukaj.js. Serwer nie zgaduje: „Warszawa" pasuje do pięciu klubów.

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

// Herb w dużym formacie — ten sam obrazek, którego Transfermarkt używa w nagłówku strony klubu.
export const adresHerbu = (id) => `https://tmssl.akamaized.net/images/wappen/head/${id}.png`;

export function klubyZWynikow(html) {
  const kandydaci = new Map();
  const WZOR = /<a[^>]+href="(\/[^"]*\/startseite\/verein\/(\d+))"[^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m;
  while ((m = WZOR.exec(html)) !== null) {
    const id = m[2];
    const nazwa = odsloniec(m[3]);
    const byl = kandydaci.get(id);
    if (!byl) kandydaci.set(id, { id, nazwa, url: "https://www.transfermarkt.pl" + m[1], herb: adresHerbu(id) });
    else if (!byl.nazwa && nazwa) byl.nazwa = nazwa;
  }
  return [...kandydaci.values()].filter((k) => k.nazwa).slice(0, 10);
}

export default async function handler(req, res) {
  const fraza = String((req.query && req.query.klub) || "").trim();
  if (fraza.length < 3) {
    return res.status(400).json({ error: "Podaj przynajmniej trzy znaki nazwy klubu." });
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
  const lista = klubyZWynikow(html);
  res.setHeader("cache-control", "public, s-maxage=604800, stale-while-revalidate=2592000");
  return res.status(200).json({ pytanie: fraza, ilu: lista.length, kandydaci: lista });
}
