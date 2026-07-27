// Pośrednik do terminarzy lig na 90minut.pl — przeglądarka nie odpyta tej strony wprost, bo
// 90minut nie wysyła nagłówka CORS. Ta funkcja pobiera stronę ligi po stronie serwera i zwraca
// gotowy terminarz jako JSON (kolejka, data, godzina, gospodarz, gość).
//
// Dlaczego 90minut, a nie „Łączy nas piłka": ŁNP to aplikacja Angulara — w pobranym HTML-u nie ma
// ani jednego wiersza tabeli, a jej API zwraca 401 i wymaga tokenu wydawanego po reCAPTCHA.
// 90minut serwuje terminarz w czystym HTML i przy każdym meczu podaje datę w formacie ISO
// (atrybut data-date w wierszu z kursami), więc nie musimy zgadywać polskich nazw miesięcy.
//
// Układ, na którym się opieramy:
//   <b><u>Kolejka 2 - 8-9 sierpnia</u></b>
//   <tr align="left"><td>Gospodarz</td><td>-</td><td>Gość</td><td>8 sierpnia, 17:00</td></tr>
//   <tr class="odds" data-home="3459" data-away="1132" data-date="2026-08-08"></tr>

const ALLOWED_HOSTS = new Set(["90minut.pl", "www.90minut.pl"]);

// Allowlista hostów zabezpiecza przed SSRF — bez niej byłby to otwarty pośrednik, przez który
// dałoby się odpytać dowolny adres, w tym adresy wewnętrzne.
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
    return { error: "Dozwolone są tylko terminarze z 90minut.pl." };
  }
  return { url };
}

const strip = (cell) =>
  cell
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// Tytuł strony jest zarazem nazwą rozgrywek ("Betclic III liga 2026/2027, grupa: I").
function parseLeagueName(html) {
  const t = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
  return t ? strip(t) : "";
}

const MONTHS = {
  stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
  lipca: 7, sierpnia: 8, września: 9, wrzesnia: 9, października: 10, pazdziernika: 10,
  listopada: 11, grudnia: 12,
};

// Sezon w tytule ("2026/2027") pozwala przypisać rok: runda jesienna (lipiec-grudzień) to rok
// pierwszy, wiosenna (styczeń-czerwiec) drugi. Bez tego "19 września" byłoby niejednoznaczne.
// Granica idzie po LIPCU, bo polskie ligi zaczynają sezon jeszcze w lipcu — przy granicy na
// sierpniu pierwsza kolejka lądowała rok za późno.
function seasonYears(leagueName) {
  const m = leagueName.match(/(\d{4})\/(\d{4})/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}

// "8 sierpnia" / "19-20 września" -> ISO. Przy zakresie bierzemy pierwszy dzień.
function polishDateToIso(text, years) {
  if (!text || !years) return "";
  const m = text.match(/(\d{1,2})(?:\s*-\s*\d{1,2})?\s+([a-ząćęłńóśźż]+)/i);
  if (!m) return "";
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return "";
  const year = month >= 7 ? years[0] : years[1];
  return `${year}-${String(month).padStart(2, "0")}-${String(parseInt(m[1], 10)).padStart(2, "0")}`;
}

// Dzielimy stronę na sekcje kolejek, a w każdej czytamy wiersze meczów. Datę bierzemy w kolejności:
// 1) atrybut data-date z wiersza kursów (dokładna, ale 90minut dodaje go tylko przy najbliższych
//    meczach), 2) tekst w komórce meczu ("8 sierpnia, 17:00"), 3) zakres z nagłówka kolejki
//    ("Kolejka 9 - 19-20 września") — wtedy oznaczamy datę jako przybliżoną (dateApprox),
// żeby interfejs nie udawał precyzji, której 90minut jeszcze nie podało.
function parseSchedule(html) {
  const leagueName = parseLeagueName(html);
  const years = seasonYears(leagueName);
  const headings = [...html.matchAll(/Kolejka\s*(\d{1,3})([^<]*)/gi)];
  if (!headings.length) return [];

  const out = [];
  for (let h = 0; h < headings.length; h++) {
    const round = parseInt(headings[h][1], 10);
    const headingDate = polishDateToIso(headings[h][2] || "", years);
    const from = headings[h].index;
    const to = h + 1 < headings.length ? headings[h + 1].index : html.length;
    const segment = html.slice(from, to);

    // Wiersz meczu + opcjonalnie następujący po nim wiersz z kursami (z datą ISO).
    const rowRe = /<tr[^>]*align="left"[^>]*>([\s\S]*?)<\/tr>\s*(?:<tr[^>]*class="odds"([^>]*)>)?/gi;
    let m;
    while ((m = rowRe.exec(segment)) !== null) {
      const cells = (m[1].match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(strip);
      if (cells.length < 3) continue;

      const homeTeam = cells[0];
      const awayTeam = cells[2];
      if (!homeTeam || !awayTeam) continue;
      // Nagłówki i wiersze techniczne nie mają dwóch nazw drużyn po bokach separatora.
      if (/^kolejka/i.test(homeTeam)) continue;

      const oddsAttrs = m[2] || "";
      const cellText = cells[3] || "";
      const time = (cellText.match(/(\d{1,2}:\d{2})/) || [])[1] || "";

      const exactDate =
        (oddsAttrs.match(/data-date="(\d{4}-\d{2}-\d{2})"/) || [])[1] ||
        polishDateToIso(cellText, years);
      const date = exactDate || headingDate;

      out.push({ round, date, time, homeTeam, awayTeam, dateApprox: !exactDate && !!headingDate });
    }
  }
  return out;
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
      signal: AbortSignal.timeout(20000),
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: `90minut odpowiedziało kodem ${upstream.status}.` });
    }
    // 90minut serwuje ISO-8859-2 — bez tego dekodera polskie nazwy klubów przyjdą zniekształcone.
    const buffer = await upstream.arrayBuffer();
    try {
      html = new TextDecoder("iso-8859-2").decode(buffer);
    } catch {
      html = new TextDecoder("latin1").decode(buffer);
    }
  } catch (e) {
    return res.status(504).json({ error: "Nie udało się pobrać terminarza z 90minut: " + e.message });
  }

  const matches = parseSchedule(html);
  if (!matches.length) {
    return res.status(404).json({ error: "Nie znaleziono terminarza na tej stronie." });
  }

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({
    source: "90minut.pl",
    league: parseLeagueName(html),
    matches,
  });
}
