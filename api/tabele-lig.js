// TABELE LIGOWE Z 90MINUT — jedno źródło prawdy o tym, ile kolejek rozegrano i jak wygląda układ.
//
// PO CO: SBS liczył dotąd rozegrane mecze z tego, co sam ma w kartotekach. To zawsze zaniża, bo
// odświeżanie z 90minut oddaje sumy sezonowe, a nie przebieg mecz po meczu (patrz api/_90minut.js).
// Wychodziło z tego „4/6" tam, gdzie tabela pokazuje 7 kolejek — i nie dało się odróżnić „nie
// zebraliśmy" od „jeszcze nie grali". Tabela rozstrzyga to jednym pobraniem.
//
// CO ODDAJEMY: dla każdej grupy komplet wierszy (miejsce, klub, mecze, punkty, Z/R/P, bramki).
// Rozbiór robi parseTabela z api/_90minut.js — ten sam, którego używa terminarz, więc nie ma
// dwóch implementacji, które mogłyby się rozjechać.
//
// CZEGO TU NIE MA: IV ligi i CLJ w domyślnym przebiegu. Adresy mamy, ale to 18 dodatkowych stron
// na jedno wywołanie, a te rozgrywki i tak zbieramy zakładką z ŁNP. Wchodzą po podaniu ?zakres=all.

import { ZRODLA_LIG, parseTabela, parseLeagueName } from "./_90minut.js";

const DOMYSLNE = ["Ekstraklasa", "I liga", "II liga", "III liga"];

// 90minut serwuje ISO-8859-2. Bez tego dekodera polskie nazwy klubów przychodzą zniekształcone,
// a dopasowanie do kartoteki przestaje działać dokładnie tam, gdzie jest najbardziej potrzebne.
async function pobierzStrone(url) {
  const odp = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (SBS)" } });
  if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
  const bufor = await odp.arrayBuffer();
  return new TextDecoder("iso-8859-2").decode(bufor);
}

export default async function handler(req, res) {
  const zakres = String((req.query && req.query.zakres) || "").toLowerCase();
  const poziomy = zakres === "all" ? Object.keys(ZRODLA_LIG) : DOMYSLNE;

  const tabele = [];
  const bledy = [];

  for (const poziom of poziomy) {
    const adresy = ZRODLA_LIG[poziom] || [];
    for (let i = 0; i < adresy.length; i++) {
      try {
        const html = await pobierzStrone(adresy[i]);
        const wiersze = parseTabela(html);
        if (!wiersze.length) {
          bledy.push({ poziom, adres: adresy[i], powod: "strona bez tabeli — rozgrywki mogły jeszcze nie wystartować" });
          continue;
        }
        // Nazwa prosto ze strony („Betclic III liga 2026/2027, grupa: II") jest jedynym pewnym
        // sposobem powiedzenia, KTÓRA to grupa — kolejność adresów w tablicy bywa myląca.
        tabele.push({
          poziom,
          nazwaZrodla: parseLeagueName(html) || `${poziom} (${i + 1})`,
          adres: adresy[i],
          kolejek: Math.max(0, ...wiersze.map((w) => Number(w.mecze) || 0)),
          wiersze,
        });
      } catch (e) {
        bledy.push({ poziom, adres: adresy[i], powod: String((e && e.message) || e) });
      }
    }
  }

  if (!tabele.length) {
    return res.status(502).json({
      error: "Nie udało się pobrać żadnej tabeli z 90minut.",
      bledy,
    });
  }

  // Krótki bufor po stronie brzegu: tabela zmienia się po kolejce, nie co minutę, a bez tego
  // każde wejście w Kluby wywoływałoby kilkanaście zapytań do 90minut.
  res.setHeader("cache-control", "public, s-maxage=1800, stale-while-revalidate=3600");
  return res.status(200).json({
    pobrano: new Date().toISOString(),
    tabel: tabele.length,
    tabele,
    bledy,
  });
}
