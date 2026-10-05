// LISTA ZAWODNIKÓW JEDNEJ AGENCJI Z TRANSFERMARKTU.
//
// PO CO TO JEST
// Gdy przy sprawdzaniu zawodnika trafiamy na agencję, której jeszcze nie mamy, nie ma powodu
// czekać, aż system dojdzie do jej pozostałych zawodników po kolei — strona agencji wymienia ich
// wszystkich naraz. Jedno zapytanie zamiast kilkudziesięciu, a przy okazji od razu wiadomo, ilu
// zawodników z naszej kartoteki ta agencja prowadzi.
//
// CZEGO TU NIE MA: oceniania, kto jest „ważny". Oddajemy to, co agencja ma wypisane u siebie,
// a dopasowaniem do kartoteki zajmuje się aplikacja — bo tylko ona wie, kogo mamy.

const NAGLOWKI = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "pl-PL,pl;q=0.9",
  "Accept": "text/html,application/xhtml+xml",
};

const odsloniec = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&szlig;/g, "ß")
    .replace(/\s+/g, " ")
    .trim();

export default async function handler(req, res) {
  const adres = String(req.query.url || "");
  // Przyjmujemy wyłącznie adresy agencji na Transfermarkcie — ta funkcja nie jest otwartą bramką
  // do pobierania dowolnych stron cudzym serwerem.
  if (!/^https:\/\/(www\.)?transfermarkt\.[a-z.]+\/[^"]*\/beraterfirma\/berater\/\d+/i.test(adres)) {
    return res.status(400).json({ error: "Potrzebny adres agencji na Transfermarkcie (…/beraterfirma/berater/…)." });
  }

  let html;
  try {
    const odp = await fetch(adres, { headers: NAGLOWKI });
    if (!odp.ok) return res.status(502).json({ error: "Transfermarkt odpowiedział HTTP " + odp.status + "." });
    html = await odp.text();
  } catch (e) {
    return res.status(502).json({ error: "Nie udało się połączyć z Transfermarktem: " + String((e && e.message) || e) });
  }

  // Ten sam zawodnik bywa w wierszu dwa razy (zdjęcie i nazwisko) — klucz po identyfikatorze
  // zostawia jedno wystąpienie, a nazwę bierzemy z tego, które ma tekst.
  const zawodnicy = new Map();
  const WZOR = /<a[^>]+href="(\/[^"]*\/profil\/spieler\/(\d+))"[^>]*>([\s\S]{0,160}?)<\/a>/gi;
  let m;
  while ((m = WZOR.exec(html)) !== null) {
    const nazwa = odsloniec(m[3].replace(/<[^>]+>/g, " "));
    if (!nazwa || nazwa.length < 3) continue;
    const id = m[2];
    if (!zawodnicy.has(id)) zawodnicy.set(id, { id, nazwa, url: "https://www.transfermarkt.pl" + m[1] });
  }

  const tytul = odsloniec((html.match(/<title>([^<]+)<\/title>/i) || [])[1] || "")
    .replace(/\s*[-–]\s*Agencja.*$/i, "")
    .replace(/\s*\|\s*Transfermarkt.*$/i, "")
    .trim();

  return res.status(200).json({
    zrodlo: adres,
    nazwa: tytul,
    ilu: zawodnicy.size,
    zawodnicy: [...zawodnicy.values()].slice(0, 300),
  });
}
