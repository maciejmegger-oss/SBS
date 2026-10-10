// HISTORIA SEZONÓW JEDNEGO ZAWODNIKA Z 90MINUT.
//
// PO CO TO JEST
// Prognoza („na jaki poziom go stać") stoi na pytaniu, czy zawodnik PRZECHODZI KOLEJNE SZCZEBLE:
// U17 → U19 → III liga, i w każdym z nich realnie grał. Bieżący sezon mamy z protokołów ŁNP, ale
// poprzednich nie mamy nigdzie — kartoteka trzyma tylko sumy z sezonu, który akurat trwa, i każde
// odświeżenie je nadpisuje. Bez tej historii prognoza nie ma prawa się pojawić i słusznie odmawia.
//
// SKĄD TO BIERZEMY
// Strona kariery na 90minut (kariera.php) wymienia sezony, ale podaje przy nich tylko klub. Poziom
// rozgrywek, minuty i — co najważniejsze — liczbę meczów w PIERWSZYM SKŁADZIE niesie dopiero strona
// występów danego sezonu (wystepy.php?id=…&id_sezon=…). Dlatego najpierw czytamy listę sezonów,
// a potem wchodzimy w każdy z osobna.
//
// DLACZEGO OSTROŻNIE
// 90minut prowadzą wolontariusze. Jeden zawodnik to kilka dodatkowych pobrań, więc bierzemy
// najwyżej osiem ostatnich sezonów (starsze i tak nie mówią nic o dzisiejszym pułapie), robimy to
// po kolei z przerwą i korzystamy ze wspólnej pamięci podręcznej. Lepiej oddać sześć sezonów
// i działać dalej niż dziesięć i dostać blokadę.

import { pobierzZ90minut, parseWystepyZawodnika } from "./_90minut.js";

const MAKS_SEZONOW = 8;
const PRZERWA_MIEDZY_STRONAMI = 350;
const uspij = (ms) => new Promise((r) => setTimeout(r, ms));

/** Odnośniki „Występy: 2023/24 2024/25 …" ze strony kariery — adres sezonu i jego etykieta. */
export function linkiSezonow(html) {
  const out = new Map();
  const re = /<a\b[^>]*href="([^"]*wystepy\.php\?id=(\d+)&(?:amp;)?id_sezon=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const etykieta = m[4].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    // Ten sam sezon bywa na stronie kilka razy — raz w pasku u góry, raz w wierszach kariery,
    // czasem z dopiskiem „(j)" (jesień) i „(w)" (wiosna). To jeden sezon, nie trzy.
    const sezon = (etykieta.match(/\d{4}\/\d{2}/) || [])[0];
    if (!sezon) continue;
    const id = m[3];
    if (!out.has(id)) {
      out.set(id, { sezon, adres: "http://www.90minut.pl/wystepy.php?id=" + m[2] + "&id_sezon=" + id });
    }
  }
  return [...out.values()].sort((a, b) => b.sezon.localeCompare(a.sezon));
}

/** Z wierszy jednego sezonu wybieramy TE ROZGRYWKI, w których zawodnik przegrał najwięcej minut. */
export function glowneRozgrywki(sezony) {
  const ligowe = (sezony || []).filter((s) => s && !s.podsumowanie && s.rozgrywki);
  if (!ligowe.length) return null;
  return ligowe.slice().sort((a, b) => (b.minuty || 0) - (a.minuty || 0))[0];
}

export default async function handler(req, res) {
  const adres = String((req.query && req.query.url) || "");
  if (!/^https?:\/\/(www\.)?90minut\.pl\/(kariera|wystepy)\.php\?id=\d+/i.test(adres)) {
    return res.status(400).json({ error: "Potrzebny adres zawodnika na 90minut (kariera.php?id=… albo wystepy.php?id=…)." });
  }

  let strona;
  try {
    strona = await pobierzZ90minut(adres);
  } catch (e) {
    return res.status(502).json({ error: "Nie udało się pobrać strony zawodnika: " + String((e && e.message) || e) });
  }

  const linki = linkiSezonow(strona).slice(0, MAKS_SEZONOW);
  if (!linki.length) {
    return res.status(404).json({
      error: "Na tej stronie nie ma odnośników do występów w poszczególnych sezonach — 90minut nie prowadzi dla tego zawodnika rozbicia na sezony.",
    });
  }

  const podstawowe = parseWystepyZawodnika(strona);
  const sezony = [];
  const pominiete = [];
  for (const l of linki) {
    try {
      const html = await pobierzZ90minut(l.adres);
      const w = parseWystepyZawodnika(html);
      const glowne = glowneRozgrywki(w.sezony);
      if (!glowne) { pominiete.push(l.sezon); continue; }
      sezony.push({
        sezon: l.sezon,
        klub: glowne.klub || "",
        rozgrywki: glowne.rozgrywki || "",
        wystepy: glowne.wystepy || 0,
        wPodstawowym: glowne.wPodstawowym || 0,
        minuty: glowne.minuty || 0,
        gole: glowne.gole || 0,
        zrodlo: "90minut.pl",
      });
    } catch (e) {
      // Jeden nieudany sezon nie przekreśla pozostałych — oddajemy, co się udało, i mówimy, czego nie.
      pominiete.push(l.sezon);
    }
    await uspij(PRZERWA_MIEDZY_STRONAMI);
  }

  if (!sezony.length) {
    return res.status(404).json({ error: "Żaden sezon nie dał się odczytać ze strony występów.", pominiete });
  }

  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).json({
    nazwa: podstawowe.nazwa || "",
    rocznik: podstawowe.rocznik || null,
    sezony,
    pominiete,
    zrodlo: adres,
  });
}
