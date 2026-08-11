// Cotygodniowe odświeżenie terminarzy — uruchamiane przez harmonogram Vercela w piątek wieczorem,
// bo do piątku do północy kluby muszą zgłosić termin spotkania. Wtedy 90minut zamienia datę
// przybliżoną (z nagłówka kolejki) na dokładną, razem z godziną.
//
// Robi dwie rzeczy, których pobieranie z przeglądarki nie robiło:
//  1. AKTUALIZUJE istniejący mecz zamiast dokładać nowy (patrz kluczMeczu w _90minut.js),
//  2. przepisuje nowo poznaną datę i godzinę do ZAPLANOWANYCH OBSERWACJI — jeśli wybrałeś mecz,
//     gdy nie miał jeszcze terminu, obserwacja sama dostaje właściwy dzień i godzinę.
//
// Zmieniamy tylko obserwacje z przyszłości. Przesuwanie tych, które już się odbyły, byłoby
// fałszowaniem historii pracy.
import { fetchLeagueSchedule, kluczMeczu, normalizujNazwe, ZRODLA_LIG as ZRODLA } from "./_90minut.js";

import { BAZA, KLUCZ_BAZY as KLUCZ, naglowkiBazy as naglowki, PODPOWIEDZ_BRAK_KLUCZA } from "./_baza.js";

async function czytajKv(klucz) {
  const r = await fetch(`${BAZA}/rest/v1/sbs_kv?select=value&key=eq.${encodeURIComponent(klucz)}`, {
    headers: naglowki(),
  });
  if (!r.ok) throw new Error(`odczyt ${klucz}: ${r.status}`);
  const rows = await r.json();
  if (!rows[0]) return null;
  try { return JSON.parse(rows[0].value); } catch { return null; }
}

async function zapiszKv(klucz, dane) {
  const r = await fetch(`${BAZA}/rest/v1/sbs_kv`, {
    method: "POST",
    headers: { ...naglowki(), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key: klucz, value: JSON.stringify(dane) }),
  });
  if (!r.ok) throw new Error(`zapis ${klucz}: ${r.status} ${await r.text()}`);
}

const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Z pola „Mecz" w obserwacji („Rekord Bielsko-Biała - Zawisza Bydgoszcz", czasem z tabulatorami
// i doklejoną datą) wyciągamy samą parę drużyn.
function paraZObserwacji(tekst) {
  const czysty = String(tekst || "").replace(/\s+/g, " ").trim();
  const czesci = czysty.split(/\s+[-–—]\s+/);
  if (czesci.length < 2) return null;
  const gospodarz = czesci[0];
  // Za nazwą gościa 90minut czasem dokleja datę i godzinę — ucinamy po pierwszym przecinku.
  const gosc = czesci[1].split(",")[0];
  if (!gospodarz || !gosc) return null;
  return { gospodarz: normalizujNazwe(gospodarz), gosc: normalizujNazwe(gosc) };
}

export default async function handler(req, res) {
  // Endpoint zmienia dane, więc nie może być otwarty dla świata. Vercel przy zadaniach
  // cyklicznych dokłada nagłówek z sekretem; przy ręcznym wywołaniu przyjmujemy go z zapytania.
  const sekret = process.env.CRON_SECRET;
  if (sekret) {
    const podany =
      (req.headers.authorization || "").replace(/^Bearer\s+/i, "") ||
      (Array.isArray(req.query.secret) ? req.query.secret[0] : req.query.secret) || "";
    if (podany !== sekret) return res.status(401).json({ error: "Brak uprawnień." });
  }
  if (!BAZA || !KLUCZ) {
    return res.status(500).json({ error: "Brak konfiguracji bazy (SUPABASE_URL / SUPABASE_SERVICE_KEY)." });
  }
  if (PODPOWIEDZ_BRAK_KLUCZA) {
    // Zapis terminarza kluczem publicznym i tak zostałby odrzucony przez reguły dostępu — lepiej
    // powiedzieć wprost, czego brakuje, niż zakończyć przebieg „zapisano 0 meczów".
    return res.status(500).json({ error: "Serwer nie ma dostępu do bazy.", podpowiedz: PODPOWIEDZ_BRAK_KLUCZA });
  }

  const tylkoLiga = Array.isArray(req.query.league) ? req.query.league[0] : req.query.league;
  const naSucho = String(req.query.dry || "") === "1";

  const zadania = Object.entries(ZRODLA)
    .filter(([liga]) => !tylkoLiga || liga === tylkoLiga)
    .flatMap(([liga, adresy]) => adresy.map((url) => ({ liga, url })));

  const pobrane = await Promise.all(
    zadania.map(async (z) => {
      try {
        const w = await fetchLeagueSchedule(z.url);
        if (w.error) return { ...z, error: w.error };
        return { ...z, league: w.league, matches: w.matches };
      } catch (e) {
        return { ...z, error: e.message };
      }
    })
  );

  const bledy = pobrane.filter((p) => p.error).map((p) => ({ url: p.url, error: p.error }));
  const udane = pobrane.filter((p) => !p.error);
  if (!udane.length) {
    return res.status(502).json({ error: "Żaden terminarz się nie pobrał.", bledy });
  }

  // --- MECZE ---
  const mecze = (await czytajKv("scouting:matches")) || [];
  const wgKlucza = new Map();
  mecze.forEach((m) => wgKlucza.set(kluczMeczu(m), m));

  let dodane = 0, zaktualizowane = 0, widziane = 0;
  const dokladneTerminy = new Map();   // klucz meczu -> {date, time} (tylko potwierdzone)

  for (const zrodlo of udane) {
    for (const m of zrodlo.matches) {
      widziane++;
      const klucz = kluczMeczu(m);
      if (!m.dateApprox && m.date) dokladneTerminy.set(klucz, { date: m.date, time: m.time || "" });

      const istniejacy = wgKlucza.get(klucz);
      if (!istniejacy) {
        const nowy = {
          id: uid("M"), league: zrodlo.liga, competition: zrodlo.league,
          date: m.date, time: m.time, homeTeam: m.homeTeam, awayTeam: m.awayTeam,
          round: m.round, dateApprox: !!m.dateApprox, stadium: "",
        };
        mecze.push(nowy);
        wgKlucza.set(klucz, nowy);
        dodane++;
        continue;
      }
      // Aktualizujemy tylko w stronę WIĘKSZEJ pewności: data dokładna zastępuje przybliżoną,
      // a potwierdzony termin zastępuje inny potwierdzony, gdy klub przełożył mecz.
      const bylaPrzyblizona = !!istniejacy.dateApprox;
      const jestDokladna = !m.dateApprox && !!m.date;
      const zmianaTerminu = jestDokladna && (istniejacy.date !== m.date || (istniejacy.time || "") !== (m.time || ""));
      if (jestDokladna && (bylaPrzyblizona || zmianaTerminu)) {
        istniejacy.date = m.date;
        istniejacy.time = m.time || "";
        istniejacy.dateApprox = false;
        zaktualizowane++;
      }
    }
  }

  // --- OBSERWACJE ---
  const rO = await fetch(`${BAZA}/rest/v1/sbs_observations?select=id,match,date,match_time`, { headers: naglowki() });
  if (!rO.ok) throw new Error("odczyt obserwacji: " + rO.status);
  const obserwacje = await rO.json();

  const dzisiaj = new Date().toISOString().slice(0, 10);
  const poParze = new Map();
  dokladneTerminy.forEach((termin, klucz) => {
    const [, gosp, gosc] = klucz.split("|");
    poParze.set(`${gosp}|${gosc}`, termin);
  });

  const doPoprawy = [];
  for (const o of obserwacje) {
    const para = paraZObserwacji(o.match);
    if (!para) continue;
    const termin = poParze.get(`${para.gospodarz}|${para.gosc}`);
    if (!termin) continue;
    if (o.date && o.date < dzisiaj) continue;          // odbyta — nie ruszamy historii
    if (o.date === termin.date && (o.match_time || "") === termin.time) continue;
    doPoprawy.push({
      id: o.id, date: termin.date, time: termin.time,
      bylo: `${o.date || "—"} ${o.match_time || ""}`.trim(),
      mecz: o.match,
    });
  }

  let obsZaktualizowane = 0;
  if (!naSucho) {
    await zapiszKv("scouting:matches", mecze);
    for (const p of doPoprawy) {
      const zmiana = { date: p.date };
      if (p.time) zmiana.match_time = p.time;
      const r = await fetch(`${BAZA}/rest/v1/sbs_observations?id=eq.${encodeURIComponent(p.id)}`, {
        method: "PATCH", headers: naglowki(), body: JSON.stringify(zmiana),
      });
      if (r.ok) obsZaktualizowane++;
    }
  }

  return res.status(200).json({
    ok: true,
    naSucho,
    ligi: [...new Set(udane.map((u) => u.liga))],
    meczeWidziane: widziane,
    meczeDodane: dodane,
    meczeZaktualizowane: zaktualizowane,
    obserwacjeDoPoprawy: doPoprawy.length,
    obserwacjeZaktualizowane: obsZaktualizowane,
    bledy,
  });
}
