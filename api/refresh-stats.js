// Automatyczne odświeżanie statystyk zawodników z API-Football.
//
// ZAKRES: wyłącznie Ekstraklasa. Sprawdzone kluczem konta (patrz /api/football-check): to jedyne
// polskie rozgrywki, dla których dostawca ma dane na poziomie zawodnika. I liga, II liga i III liga
// są w jego katalogu, ale bez statystyk zawodników — i nie odblokuje tego droższy plan, bo pokrycie
// opisuje dostępność danych, a nie próg cenowy. Pozostałe poziomy idą przez protokoły PZPN.
//
// KOSZT: 1 zapytanie o drużyny + po ~2 strony na drużynę = ok. 40 zapytań na przebieg.
// Przy limicie 7500 dziennie zmieściłoby się to prawie 200 razy.

const KLUCZ = process.env.FOOTBALL_API_KEY;
const BAZA = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KLUCZ_BAZY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const LIGA_EKSTRAKLASA = 106;

const naglowkiBazy = () => ({
  apikey: KLUCZ_BAZY,
  Authorization: "Bearer " + KLUCZ_BAZY,
  "Content-Type": "application/json",
});

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[łøđ]/g, (c) => ({ ł: "l", ø: "o", đ: "d" }[c]))
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");

// Nazwisko z API bywa zapisane inaczej niż u nas („M. Ishak" kontra „Mikael Ishak"), dlatego
// porównujemy ZBIÓR słów — kolejność imienia i nazwiska też bywa odwrotna.
const kluczNazwiska = (s) =>
  String(s || "")
    .split(/\s+/)
    .map(norm)
    .filter(Boolean)
    .sort()
    .join(" ");

async function apiFootball(sciezka) {
  const r = await fetch("https://v3.football.api-sports.io" + sciezka, {
    headers: { "x-apisports-key": KLUCZ },
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json();
  const bledy = j && j.errors;
  if (bledy && (Array.isArray(bledy) ? bledy.length : Object.keys(bledy).length)) {
    throw new Error("dostawca: " + JSON.stringify(bledy));
  }
  return j;
}

export default async function handler(req, res) {
  const sekret = process.env.CRON_SECRET;
  if (sekret) {
    const podany =
      (req.headers.authorization || "").replace(/^Bearer\s+/i, "") ||
      (Array.isArray(req.query.secret) ? req.query.secret[0] : req.query.secret) || "";
    if (podany !== sekret) return res.status(401).json({ error: "Brak uprawnień." });
  }
  if (!KLUCZ) return res.status(500).json({ error: "Brak FOOTBALL_API_KEY." });
  if (!BAZA || !KLUCZ_BAZY) return res.status(500).json({ error: "Brak konfiguracji bazy." });

  // Domyślnie NIE zapisujemy. Pierwszy przebieg ma być podglądem — przy 500 zawodnikach
  // dopasowanie po nazwisku trzeba zobaczyć, zanim się je utrwali.
  const zapisz = String(req.query.apply || "") === "1";
  const sezon = parseInt(req.query.season, 10) || new Date().getFullYear();

  let zuzyteZapytania = 0;
  let zawodnicyApi = [];
  try {
    const druzyny = await apiFootball(`/teams?league=${LIGA_EKSTRAKLASA}&season=${sezon}`);
    zuzyteZapytania++;
    const listaDruzyn = (druzyny.response || []).map((x) => x.team).filter(Boolean);
    if (!listaDruzyn.length) {
      return res.status(404).json({ error: `Dostawca nie zwrócił drużyn Ekstraklasy dla sezonu ${sezon}.` });
    }

    for (const d of listaDruzyn) {
      let strona = 1, stron = 1;
      do {
        const dane = await apiFootball(`/players?team=${d.id}&season=${sezon}&page=${strona}`);
        zuzyteZapytania++;
        stron = (dane.paging && dane.paging.total) || 1;
        (dane.response || []).forEach((poz) => {
          const st = (poz.statistics || []).find((s) => s.league && s.league.id === LIGA_EKSTRAKLASA)
            || (poz.statistics || [])[0];
          if (!st) return;
          zawodnicyApi.push({
            // Pole `name` bywa skrócone („D. Rallis"), przez co dopasowanie po zbiorze słów
            // nie trafiało w „Dimitris Rallis" i odpadały setki zawodników. Imię i nazwisko
            // w osobnych polach są pełne — bierzemy je, a `name` zostaje jako zapas.
            nazwa: [poz.player && poz.player.firstname, poz.player && poz.player.lastname]
              .filter(Boolean).join(" ") || (poz.player && poz.player.name),
            nazwaZapasowa: poz.player && poz.player.name,
            klub: d.name,
            mecze: (st.games && st.games.appearences) || 0,
            minuty: (st.games && st.games.minutes) || 0,
            gole: (st.goals && st.goals.total) || 0,
            asysty: (st.goals && st.goals.assists) || 0,
            zolte: (st.cards && st.cards.yellow) || 0,
            czerwone: ((st.cards && st.cards.red) || 0) + ((st.cards && st.cards.yellowred) || 0),
          });
        });
        strona++;
      } while (strona <= stron && strona <= 10);
    }
  } catch (e) {
    return res.status(502).json({ error: "Odczyt z dostawcy nie powiódł się: " + e.message, zuzyteZapytania });
  }

  // --- DOPASOWANIE DO NASZEJ BAZY ---
  let gracze = [], f = 0;
  for (;;) {
    const r = await fetch(`${BAZA}/rest/v1/sbs_players?select=id,first_name,last_name,club_id,matches,minutes,goals,custom_fields&limit=1000&offset=${f}`, { headers: naglowkiBazy() });
    if (!r.ok) return res.status(502).json({ error: "Odczyt zawodników z bazy: " + r.status });
    const cz = await r.json();
    gracze = gracze.concat(cz);
    if (cz.length < 1000) break;
    f += 1000;
  }
  const kluby = await (await fetch(`${BAZA}/rest/v1/sbs_clubs?select=id,name,league&limit=2000`, { headers: naglowkiBazy() })).json();
  const klubWgId = new Map(kluby.map((c) => [c.id, c]));

  const wgNazwiska = new Map();
  gracze.forEach((g) => {
    const k = kluczNazwiska(`${g.first_name || ""} ${g.last_name || ""}`);
    if (!k) return;
    if (!wgNazwiska.has(k)) wgNazwiska.set(k, []);
    wgNazwiska.get(k).push(g);
  });

  const doZapisu = [], niejednoznaczni = [], nieznalezieni = [];
  zawodnicyApi.forEach((z) => {
    // Próbujemy pełnego zapisu, a gdy nie trafi — skróconego. Dodatkowo samo nazwisko, bo
    // dostawca bywa niekonsekwentny w imionach (drugie imię, wersja oryginalna kontra polska).
    let kandydaci = wgNazwiska.get(kluczNazwiska(z.nazwa)) || [];
    if (!kandydaci.length && z.nazwaZapasowa) kandydaci = wgNazwiska.get(kluczNazwiska(z.nazwaZapasowa)) || [];
    if (!kandydaci.length) {
      const slowa = String(z.nazwa || "").split(/\s+/).filter(Boolean);
      const samoNazwisko = slowa.length > 1 ? norm(slowa[slowa.length - 1]) : "";
      if (samoNazwisko.length >= 4) {
        kandydaci = gracze.filter((g) => norm(g.last_name) === samoNazwisko);
      }
    }
    if (!kandydaci.length) { nieznalezieni.push(z.nazwa); return; }
    let wybor = kandydaci;
    if (wybor.length > 1) {
      // Rozstrzyga klub — nazwy z API i nasze bywają zapisane inaczej, więc dopuszczamy zawieranie.
      const wKlubie = wybor.filter((g) => {
        const c = klubWgId.get(g.club_id);
        if (!c) return false;
        const a = norm(c.name), b = norm(z.klub);
        return a === b || (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a)));
      });
      if (wKlubie.length === 1) wybor = wKlubie;
    }
    if (wybor.length !== 1) { niejednoznaczni.push(z.nazwa); return; }
    const g = wybor[0];
    // Zapisujemy tylko realne zmiany — inaczej co przebieg przepisywalibyśmy 500 rekordów bez potrzeby.
    if ((g.matches || 0) === z.mecze && (g.minutes || 0) === z.minuty && (g.goals || 0) === z.gole) return;
    doZapisu.push({ id: g.id, kto: `${g.last_name} ${g.first_name}`, z, przed: { mecze: g.matches, minuty: g.minutes, gole: g.goals }, custom_fields: g.custom_fields });
  });

  let zapisani = 0;
  if (zapisz) {
    const dzis = new Date().toISOString().slice(0, 10);
    for (const p of doZapisu) {
      const ext = { ...(((p.custom_fields || {}).__ext) || {}),
        yellowCards: p.z.zolte, redCards: p.z.czerwone, assists: p.z.asysty,
        statsUpdatedAt: dzis, statsSource: "API-Football (Ekstraklasa)", statsSeason: String(sezon) };
      const r = await fetch(`${BAZA}/rest/v1/sbs_players?id=eq.${encodeURIComponent(p.id)}`, {
        method: "PATCH", headers: naglowkiBazy(),
        body: JSON.stringify({ matches: p.z.mecze, minutes: p.z.minuty, goals: p.z.gole,
          custom_fields: { ...(p.custom_fields || {}), __ext: ext } }),
      });
      if (r.ok) zapisani++;
    }
  }

  return res.status(200).json({
    ok: true,
    trybPodgladu: !zapisz,
    sezon,
    zuzyteZapytania,
    zawodnikowZApi: zawodnicyApi.length,
    doZapisu: doZapisu.length,
    zapisani,
    niejednoznacznych: niejednoznaczni.length,
    spozaBazy: nieznalezieni.length,
    przykladyZmian: doZapisu.slice(0, 15).map((p) => ({
      kto: p.kto,
      bylo: `${p.przed.mecze ?? "—"} m / ${p.przed.minuty ?? "—"} min / ${p.przed.gole ?? "—"} g`,
      bedzie: `${p.z.mecze} m / ${p.z.minuty} min / ${p.z.gole} g`,
    })),
    spozaBazyPrzyklady: nieznalezieni.slice(0, 20),
    niejednoznaczniPrzyklady: niejednoznaczni.slice(0, 10),
  });
}
