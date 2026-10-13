// RADAR MŁODYCH — SKAN KADRY JEDNEGO KLUBU.
//
// Zgłoszenie (13.10.2026): „gdyby w 2 lidze szwedzkiej w jakimś zespole pojawił się zawodnik np.
// 2007, od razu trafia do systemu SBS, przycisk przy nim »monitoruj«, od razu ściąga jego wszystkie
// dane statystyczne, przeszłość i perspektywę". Test na jednej lidze: Superettan.
//
// Wywołanie:  /api/rynki-skaner?klub=5196&od=2006
// Oddaje kadrę klubu ograniczoną do zawodników urodzonych w roku `od` i później — z profilem,
// statystykami wszystkich sezonów (te same sumy co /api/tm-wystepy) i datą debiutu w lidze.
//
// JEDEN KLUB NA ZAPYTANIE: kadra + profile to dwa zapytania, a każdy młody zawodnik trzecie
// (jego mecze). Cała liga naraz nie zmieściłaby się w limicie czasu funkcji na Vercelu, więc
// aplikacja woła ten punkt klub po klubie i pokazuje postęp. Sygnały (nowy, debiut, skok minut)
// liczy aplikacja, porównując wynik z poprzednim skanem — serwer nie wie, co już widzieliśmy.

import { pobierz, lista, uspij } from "./_tmapi.js";
import { zsumujWystepy, profilZTmapi, debiutyLigowe } from "./_tm-wystepy.js";

export default async function handler(req, res) {
  const q = req.query || {};
  const klub = String(q.klub || "");
  if (!/^\d+$/.test(klub)) return res.status(400).json({ error: "Podaj numer klubu z Transfermarktu (?klub=…)." });
  const od = Math.max(1990, Math.min(2015, Number(q.od) || 2006));

  let kadra;
  try {
    kadra = await pobierz(`/club/${klub}/squad`);
  } catch (e) {
    return res.status(502).json({ error: "Nie udało się pobrać kadry z Transfermarktu: " + String((e && e.message) || e) });
  }
  const ids = [...new Set(((kadra && kadra.squad) || []).map((x) => String(x.playerId)).filter(Boolean))];
  if (!ids.length) return res.status(200).json({ klub, od, kadra: 0, zawodnicy: [] });

  let gracze = [];
  try {
    for (let i = 0; i < ids.length; i += 40) {
      gracze = gracze.concat((await pobierz(`/players?${lista("ids", ids.slice(i, i + 40))}`)) || []);
    }
  } catch (e) {
    return res.status(502).json({ error: "Nie udało się pobrać profili zawodników: " + String((e && e.message) || e) });
  }
  const mlodzi = gracze.filter((p) => {
    const rok = Number(String(((p || {}).lifeDates || {}).dateOfBirth || "").slice(0, 4));
    return rok >= od;
  });

  const zawodnicy = [];
  const rozgrywki = {};
  for (const p of mlodzi) {
    const profil = profilZTmapi(p);
    let sezony = [], debiut = { debiutLigowy: "", pierwszyStartLigowy: "" }, blad = "";
    try {
      const d = await pobierz(`/player/${p.id}/performance-game`);
      const wystepy = (d && d.performance) || [];
      const nowe = [...new Set(wystepy.map((w) => w.gameInformation && w.gameInformation.competitionId))]
        .filter((c) => c && !rozgrywki[c]);
      if (nowe.length) {
        try {
          for (const r of (await pobierz(`/competitions?${lista("ids", nowe)}`)) || []) rozgrywki[r.id] = { nazwa: r.name, typ: r.typeId };
        } catch (e) { /* bez nazw rozgrywek liczby i tak są poprawne */ }
      }
      sezony = zsumujWystepy(wystepy, rozgrywki, {});
      debiut = debiutyLigowe(wystepy);
    } catch (e) {
      blad = String((e && e.message) || e);
    }
    zawodnicy.push({ tmId: String(p.id), profil, sezony, ...debiut, blad });
    await uspij(150);
  }

  res.setHeader("cache-control", "public, s-maxage=3600, stale-while-revalidate=21600");
  return res.status(200).json({ klub, od, kadra: ids.length, pobrano: new Date().toISOString(), zawodnicy });
}
