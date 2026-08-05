// Sprawdzenie, co dostawca statystyk faktycznie obejmuje w Polsce — zanim wykupisz plan.
//
// Powstało, bo pokrycia nie da się sprawdzić z zewnątrz: strona z zestawieniem lig zwraca 403,
// a konsola dostawcy jest zagrzebana w panelu. Tutaj pytamy jego API Twoim kluczem i pokazujemy
// wprost, które polskie rozgrywki są dostępne i czy mają statystyki ZAWODNIKÓW — bo to one
// decydują, czy automat w ogóle ma sens.
//
// Klucz czytamy WYŁĄCZNIE ze zmiennej środowiskowej. Nigdy nie trafia do adresu, do odpowiedzi
// ani do dziennika — wersja skrócona w wyniku służy tylko potwierdzeniu, że wczytał się właściwy.

const KLUCZ = process.env.FOOTBALL_API_KEY;

export default async function handler(req, res) {
  if (!KLUCZ) {
    return res.status(500).json({
      error: "Brak klucza.",
      cojest: "Nie ustawiono zmiennej FOOTBALL_API_KEY.",
      cozrobic: [
        "Vercel → projekt SBS → Settings → Environment Variables",
        "Name: FOOTBALL_API_KEY, Value: klucz z panelu api-football.com (zakładka Subskrypcja)",
        "Zaznacz Production, zapisz, potem Deployments → Redeploy",
      ],
    });
  }

  let dane;
  try {
    const r = await fetch("https://v3.football.api-sports.io/leagues?country=Poland", {
      headers: { "x-apisports-key": KLUCZ },
      signal: AbortSignal.timeout(20000),
    });
    dane = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: "Dostawca odpowiedział kodem " + r.status, odpowiedz: dane });
    }
  } catch (e) {
    return res.status(504).json({ error: "Nie udało się połączyć z dostawcą: " + e.message });
  }

  // Odpowiedź z błędem bywa przekazywana z kodem 200 — dlatego sprawdzamy też pole `errors`.
  const bledy = dane && dane.errors;
  if (bledy && (Array.isArray(bledy) ? bledy.length : Object.keys(bledy).length)) {
    return res.status(400).json({ error: "Dostawca zgłosił błąd (zwykle zły klucz albo wyczerpany limit).", szczegoly: bledy });
  }

  const sezonBiezacy = (l) => {
    const s = (l.seasons || []).filter((x) => x.current);
    return s[0] || (l.seasons || []).slice(-1)[0] || null;
  };

  const ligi = (dane.response || []).map((poz) => {
    const s = sezonBiezacy(poz);
    const p = (s && s.coverage && s.coverage.players) || false;
    const st = (s && s.coverage && s.coverage.fixtures && s.coverage.fixtures.statistics_players) || false;
    return {
      nazwa: poz.league && poz.league.name,
      typ: poz.league && poz.league.type,
      id: poz.league && poz.league.id,
      sezon: s ? s.year : null,
      statystykiZawodnikow: !!p,
      statystykiZMeczow: !!st,
    };
  }).sort((a, b) => Number(b.statystykiZawodnikow) - Number(a.statystykiZawodnikow));

  const zeStatystykami = ligi.filter((l) => l.statystykiZawodnikow);

  return res.status(200).json({
    klucz: "wczytany (…" + String(KLUCZ).slice(-4) + ")",
    ligPolskichWSumie: ligi.length,
    zeStatystykamiZawodnikow: zeStatystykami.length,
    // To jest właściwa odpowiedź na pytanie „czy warto kupić".
    wnioski: zeStatystykami.length
      ? zeStatystykami.map((l) => `${l.nazwa} (sezon ${l.sezon}) — statystyki zawodników: TAK`)
      : ["Żadna polska liga nie ma statystyk zawodników na tym planie — plan darmowy zwykle ich nie obejmuje."],
    ligi,
  });
}
