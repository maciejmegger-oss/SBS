// Pośrednik do 90minut.pl — przeglądarka nie może odpytać tej strony bezpośrednio, bo 90minut
// nie wysyła nagłówka CORS. Ta funkcja (Vercel, plan darmowy) pobiera profil po stronie serwera
// i zwraca gotowe liczby jako JSON.
//
// Dlaczego akurat 90minut, a nie Transfermarkt: TM dorysowuje statystyki JavaScriptem — w pobranym
// HTML-u liczb po prostu nie ma, więc pobieranie ich tą drogą jest niewykonalne. 90minut serwuje
// tabelę kariery w czystym HTML, w układzie: sezon | klub | mecze | bramki | trofea.
//
// UWAGA: 90minut NIE podaje minut ani asyst — te pola pozostają do ręcznego uzupełnienia.

const ALLOWED_HOSTS = new Set(["90minut.pl", "www.90minut.pl"]);

// Allowlista hostów jest tu zabezpieczeniem przed SSRF — bez niej ta funkcja byłaby otwartym
// pośrednikiem, przez który dałoby się odpytywać dowolny adres, w tym adresy wewnętrzne.
function validateTarget(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: "Niepoprawny adres URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "Dozwolone są tylko adresy http/https." };
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return { error: "Dozwolone są tylko profile z 90minut.pl." };
  }
  // 90minut nie wystawia HTTPS — na porcie 443 nic nie nasłuchuje, połączenie jest odrzucane
  // (to nie kwestia certyfikatu). Adres z https:// przechodził tę walidację i dopiero `fetch`
  // padał na timeoucie, przez co ta funkcja zwracała 504 — kod nie do odróżnienia od awarii
  // serwisu, więc przyczyna była myląca. Normalizacja tutaj naprawia także adresy, które
  // zapisano wcześniej z https://, bo dotyczy każdego żądania, a nie tylko nowo wpisywanych.
  if (url.protocol === "https:") url.protocol = "http:";
  return { url };
}

const strip = (cell) =>
  cell.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// Zwraca wiersze kariery: {season, club, matches, goals}. Bierzemy tylko wiersze, w których
// pierwsza komórka wygląda jak sezon ("2024/25"), a mecze albo bramki dają się odczytać jako
// liczba — dzięki temu nawigacja i reklamy ze strony nie trafiają do wyniku.
function parseCareerRows(html) {
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const out = [];
  for (const row of rows) {
    const cells = (row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(strip);
    if (cells.length < 4) continue;
    const season = cells[0];
    if (!/^\d{4}\/\d{2}/.test(season)) continue;
    const matches = parseInt(cells[2], 10);
    const goals = parseInt(cells[3], 10);
    if (Number.isNaN(matches) && Number.isNaN(goals)) continue;
    out.push({
      season: season.slice(0, 7),
      club: cells[1],
      matches: Number.isNaN(matches) ? 0 : matches,
      goals: Number.isNaN(goals) ? 0 : goals,
    });
  }
  return out;
}

// Jeden zawodnik może mieć w tym samym sezonie kilka wierszy (zmiana klubu, osobno rozgrywki
// młodzieżowe) — sumujemy je, żeby dostać dorobek całego sezonu.
function summariseLatestSeason(careerRows) {
  if (!careerRows.length) return null;
  const latest = careerRows.map((r) => r.season).sort().pop();
  const inSeason = careerRows.filter((r) => r.season === latest);
  return {
    season: latest,
    clubs: [...new Set(inSeason.map((r) => r.club).filter(Boolean))],
    matches: inSeason.reduce((sum, r) => sum + r.matches, 0),
    goals: inSeason.reduce((sum, r) => sum + r.goals, 0),
  };
}

export default async function handler(req, res) {
  const { url: rawUrl } = req.query;
  if (!rawUrl) {
    return res.status(400).json({ error: "Brak parametru `url`." });
  }

  const { url, error } = validateTarget(Array.isArray(rawUrl) ? rawUrl[0] : rawUrl);
  if (error) return res.status(400).json({ error });

  let html;
  try {
    const upstream = await fetch(url.toString(), {
      headers: { "User-Agent": "ScoutBaseSystem/1.0 (+https://scoutbasesystem.com)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: `90minut odpowiedziało kodem ${upstream.status}.` });
    }
    // 90minut serwuje ISO-8859-2. Dla samych liczb kodowanie nie ma znaczenia (są ASCII),
    // ale nazwy klubów odczytujemy poprawnie, gdy dekoder jest dostępny.
    const buffer = await upstream.arrayBuffer();
    try {
      html = new TextDecoder("iso-8859-2").decode(buffer);
    } catch {
      html = new TextDecoder("latin1").decode(buffer);
    }
  } catch (e) {
    return res.status(504).json({ error: "Nie udało się pobrać profilu z 90minut: " + e.message });
  }

  const careerRows = parseCareerRows(html);
  const latest = summariseLatestSeason(careerRows);
  if (!latest) {
    return res.status(404).json({ error: "Nie znaleziono tabeli kariery na tej stronie." });
  }

  // Cache na brzegu Vercela: powtórne odpytanie tego samego profilu w ciągu godziny nie
  // uderza już w 90minut.
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({
    source: "90minut.pl",
    season: latest.season,
    clubs: latest.clubs,
    matches: latest.matches,
    goals: latest.goals,
    // Pola, których 90minut nie publikuje — sygnalizujemy wprost, żeby klient ich nie nadpisywał.
    minutes: null,
    assists: null,
  });
}
