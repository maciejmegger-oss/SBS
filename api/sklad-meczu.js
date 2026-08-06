// Składy z protokołu konkretnego meczu na 90minut — na potrzeby obserwacji online i wideo.
//
// UWAGA CO DO CZASU: protokół powstaje dopiero po meczu. Przed pierwszym gwizdkiem nie ma go
// nigdzie publicznie (kluby ogłaszają wyjściową jedenastkę mniej więcej godzinę przed meczem
// i nie trafia to do żadnego serwisu, który dałoby się odczytać). Dlatego aplikacja przed
// meczem posiłkuje się kadrą klubu z własnej bazy, a stąd bierze skład, gdy mecz się odbył —
// wtedy wiadomo, kto FAKTYCZNIE zagrał i ile minut.
import {
  ZRODLA_LIG, poziomRozgrywek, pobierzZ90minut, parseLinkiMeczow, parseSkladyMeczu, normalizujNazwe,
} from "./_90minut.js";

export default async function handler(req, res) {
  const pierwszy = (v) => String((Array.isArray(v) ? v[0] : v) || "").trim();
  const gospodarz = pierwszy(req.query.home);
  const gosc = pierwszy(req.query.away);
  const liga = pierwszy(req.query.league);

  if (!gospodarz || !gosc) {
    return res.status(400).json({ error: "Podaj obie drużyny (home i away)." });
  }

  // Gdy znamy rozgrywki, szukamy tylko w nich. Bez tego przeszukujemy wszystkie poziomy —
  // wolniej, ale wciąż działa, a obserwacja nie zawsze ma przypisany klub z ligą.
  const poziom = poziomRozgrywek(liga);
  const adresy = poziom ? (ZRODLA_LIG[poziom] || []) : Object.values(ZRODLA_LIG).flat();

  const a = normalizujNazwe(gospodarz), b = normalizujNazwe(gosc);
  if (!a || !b) return res.status(400).json({ error: "Nazwy drużyn są puste po uproszczeniu." });

  for (const adres of adresy) {
    let html;
    try { html = await pobierzZ90minut(adres); } catch { continue; }
    // Podpowiedź odnośnika ma postać „Gospodarz 2-1 Gość". Nie rozcinamy jej na drużyny —
    // nazwy klubów bywają z liczbami — tylko sprawdzamy, czy zawiera obie nazwy.
    const trafiony = parseLinkiMeczow(html).find((m) => {
      const t = normalizujNazwe(m.tytul);
      return t.includes(a) && t.includes(b);
    });
    if (!trafiony) continue;

    let sklady;
    try {
      sklady = parseSkladyMeczu(await pobierzZ90minut(`http://www.90minut.pl/mecz.php?id_mecz=${trafiony.id}`));
    } catch (e) {
      return res.status(502).json({ error: "Nie udało się pobrać protokołu: " + e.message });
    }
    if (!sklady.gospodarze.length && !sklady.goscie.length) {
      return res.status(404).json({
        error: "Mecz jest w terminarzu, ale protokół nie ma jeszcze składów.",
        podpowiedz: "90minut uzupełnia składy po spotkaniu. Do obserwacji na żywo użyj kadry klubu z bazy SBS.",
      });
    }

    return res.status(200).json({
      ok: true,
      rozgrywki: sklady.rozgrywki,
      wynik: trafiony.tytul,
      zrodlo: `http://www.90minut.pl/mecz.php?id_mecz=${trafiony.id}`,
      gospodarzeNazwa: sklady.gospodarzeNazwa,
      goscieNazwa: sklady.goscieNazwa,
      gospodarze: sklady.gospodarze,
      goscie: sklady.goscie,
    });
  }

  return res.status(404).json({
    error: `Nie znalazłem rozegranego meczu ${gospodarz} — ${gosc}.`,
    podpowiedz: "Protokół pojawia się dopiero po spotkaniu. Jeśli mecz już się odbył, sprawdź, czy nazwy drużyn zgadzają się z tymi na 90minut.",
    przeszukanePoziomy: poziom || "wszystkie",
  });
}
