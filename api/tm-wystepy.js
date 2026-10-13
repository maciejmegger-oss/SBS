// STATYSTYKI ZAWODNIKA Z TRANSFERMARKTU — mecze, minuty, gole, asysty, kartki, sezon po sezonie.
//
// Zgłoszenie (13.10.2026): „jak są na Transfermarkt, to niech system już wprowadza ich dane
// statystyczne — mecze, minuty, gole, asysty, jak najwięcej". Zakładka Rynki liczy tempo rozwoju
// z udziału w minutach drużyny; do tej pory skaut przepisywał liczby ze zrzutów ekranu.
//
// Wywołanie:  /api/tm-wystepy?id=1260327   albo   /api/tm-wystepy?url=<adres profilu na TM>
// Oddaje: { id, profil, sezony: [{ sezon, rozgrywki: [{ rozgrywki, klub, meczeDruzyny, wystepy,
//           odPierwszej, minuty, minutyMozliwe, gole, asysty, zolte, czerwone, … }] }] }
//
// Liczenie sum: api/_tm-wystepy.js (bez sieci, z testem). Tu tylko pobieramy trzy odpowiedzi
// serwisu danych Transfermarktu — mecze zawodnika, jego profil i nazwy rozgrywek oraz klubów.

import { zsumujWystepy, profilZTmapi } from "./_tm-wystepy.js";

import { pobierz, lista } from "./_tmapi.js";

export default async function handler(req, res) {
  const q = req.query || {};
  const id = String(q.id || "").match(/^\d+$/) ? String(q.id)
    : (String(q.url || "").match(/\/spieler\/(\d+)/) || [])[1];
  if (!id) return res.status(400).json({ error: "Podaj numer zawodnika z Transfermarktu (?id=…) albo adres profilu (?url=…)." });

  let dane;
  try {
    dane = await pobierz(`/player/${id}/performance-game`);
  } catch (e) {
    return res.status(502).json({ error: "Nie udało się pobrać występów z Transfermarktu: " + String((e && e.message) || e) });
  }
  const wystepy = (dane && dane.performance) || [];

  // Profil, nazwy rozgrywek i klubów to dodatki — ich brak nie może zablokować samych liczb.
  const idsRozgrywek = [...new Set(wystepy.map((w) => w.gameInformation && w.gameInformation.competitionId).filter(Boolean))];
  const idsKlubow = [...new Set(wystepy.map((w) => w.clubsInformation && w.clubsInformation.club && w.clubsInformation.club.clubId).filter(Boolean))];
  const [graczR, rozgrywkiR, klubyR] = await Promise.allSettled([
    pobierz(`/players?${lista("ids", [id])}`),
    idsRozgrywek.length ? pobierz(`/competitions?${lista("ids", idsRozgrywek)}`) : Promise.resolve([]),
    idsKlubow.length ? pobierz(`/clubs?${lista("ids", idsKlubow.slice(0, 60))}`) : Promise.resolve([]),
  ]);
  const rozgrywki = {};
  for (const r of rozgrywkiR.status === "fulfilled" ? rozgrywkiR.value || [] : []) rozgrywki[r.id] = { nazwa: r.name, typ: r.typeId };
  const kluby = {};
  for (const k of klubyR.status === "fulfilled" ? klubyR.value || [] : []) kluby[String(k.id)] = k.name;
  const gracz = graczR.status === "fulfilled" && Array.isArray(graczR.value) ? graczR.value[0] : null;

  res.setHeader("cache-control", "public, s-maxage=21600, stale-while-revalidate=86400");
  return res.status(200).json({
    id,
    pobrano: new Date().toISOString(),
    profil: gracz ? profilZTmapi(gracz) : null,
    sezony: zsumujWystepy(wystepy, rozgrywki, kluby),
  });
}
