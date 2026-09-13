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
//
// HERB MUSI ISTNIEĆ. Drużyny młodzieżowe często nie mają na Transfermarkcie żadnego herbu
// („Cracovia Kraków U17" → 404), a szukanie pełnej nazwy z miastem potrafi zwrócić TYLKO taką
// drużynę. Dlatego sprawdzamy obrazek, zanim go oddamy, a gdy żaden kandydat herbu nie ma —
// szukamy jeszcze raz bez ostatniego słowa (zwykle miasta): „Cracovia Kraków" → „Cracovia".

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

export const frazaZapasowa = (fraza) => {
  const slowa = String(fraza || "").trim().split(/\s+/).filter(Boolean);
  return slowa.length >= 2 ? slowa.slice(0, -1).join(" ") : "";
};

async function szukaj(fraza, pobierz) {
  const adres = "https://www.transfermarkt.pl/schnellsuche/ergebnis/schnellsuche?query=" + encodeURIComponent(fraza);
  try {
    const odp = await pobierz(adres, { headers: NAGLOWKI });
    if (!odp.ok) {
      return { blad: {
        error: `Transfermarkt odpowiedział kodem ${odp.status}.`,
        podpowiedz: odp.status === 403 || odp.status === 429
          ? "Serwis chwilowo odrzuca zapytania — spróbuj za kilka minut."
          : "Spróbuj ponownie za chwilę.",
      } };
    }
    return { html: await odp.text() };
  } catch (e) {
    return { blad: { error: "Nie udało się połączyć z Transfermarktem: " + String((e && e.message) || e) } };
  }
}

// Kandydat bez działającego obrazka traci adres herbu (zostaje na liście — nazwa się przydaje).
async function sprawdzHerby(lista, pobierz) {
  await Promise.all(lista.map(async (k) => {
    try {
      const r = await pobierz(k.herb, { method: "HEAD", headers: { "User-Agent": NAGLOWKI["User-Agent"] } });
      if (!r.ok) k.herb = "";
    } catch (e) {
      k.herb = "";
    }
  }));
}

export async function kandydaciZHerbami(fraza, pobierz = globalThis.fetch) {
  const pierwsze = await szukaj(fraza, pobierz);
  if (pierwsze.blad) return pierwsze;
  let lista = klubyZWynikow(pierwsze.html);
  await sprawdzHerby(lista, pobierz);
  if (!lista.some((k) => k.herb)) {
    const zapas = frazaZapasowa(fraza);
    if (zapas.length >= 3) {
      const drugie = await szukaj(zapas, pobierz);
      if (!drugie.blad) {
        const dodatkowe = klubyZWynikow(drugie.html).filter((k) => !lista.some((x) => x.id === k.id));
        await sprawdzHerby(dodatkowe, pobierz);
        lista = [...lista, ...dodatkowe].slice(0, 12);
      }
    }
  }
  return { lista };
}

export default async function handler(req, res) {
  const fraza = String((req.query && req.query.klub) || "").trim();
  if (fraza.length < 3) {
    return res.status(400).json({ error: "Podaj przynajmniej trzy znaki nazwy klubu." });
  }
  const wynik = await kandydaciZHerbami(fraza);
  if (wynik.blad) return res.status(502).json(wynik.blad);
  res.setHeader("cache-control", "public, s-maxage=604800, stale-while-revalidate=2592000");
  return res.status(200).json({ pytanie: fraza, ilu: wynik.lista.length, kandydaci: wynik.lista });
}
