// Pobranie terminarza jednej ligi z 90minut na żądanie przeglądarki.
// Cała logika czytania strony siedzi w _90minut.js, żeby cotygodniowe odświeżanie
// (/api/refresh-schedule) rozumiało stronę dokładnie tak samo.
import { fetchLeagueSchedule, validateTarget } from "./_90minut.js";

export default async function handler(req, res) {
  const { url: rawUrl } = req.query;
  if (!rawUrl) {
    return res.status(400).json({ error: "Brak parametru `url`." });
  }

  const { error: bledny } = validateTarget(Array.isArray(rawUrl) ? rawUrl[0] : rawUrl);
  if (bledny) return res.status(400).json({ error: bledny });

  let wynik;
  try {
    wynik = await fetchLeagueSchedule(Array.isArray(rawUrl) ? rawUrl[0] : rawUrl);
  } catch (e) {
    return res.status(504).json({ error: "Nie udało się pobrać terminarza z 90minut: " + e.message });
  }
  if (wynik.error) return res.status(502).json({ error: wynik.error });

  if (!wynik.matches.length) {
    return res.status(404).json({ error: "Nie znaleziono terminarza na tej stronie." });
  }

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({
    source: "90minut.pl",
    league: wynik.league,
    matches: wynik.matches,
  });
}
