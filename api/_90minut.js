// Wspólny odczyt terminarzy z 90minut — używany przez /api/schedule (na żądanie z przeglądarki)
// oraz /api/refresh-schedule (cotygodniowe odświeżenie uruchamiane przez harmonogram Vercela).
// Trzymamy to w jednym pliku, żeby obie drogi rozumiały stronę tak samo; wcześniej parser żył
// tylko w endpointcie i nie dało się go użyć nigdzie indziej.

const ALLOWED_HOSTS = new Set(["90minut.pl", "www.90minut.pl"]);

const strip = (s) =>
  String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

// Allowlista hostów zabezpiecza przed SSRF — bez niej byłby to otwarty pośrednik, przez który
// dałoby się odpytać dowolny adres, w tym adresy wewnętrzne.
export function validateTarget(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
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

export function parseLeagueName(html) {
  const t = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
  return t ? strip(t) : "";
}

const MONTHS = {
  stycznia: 1, lutego: 2, marca: 3, kwietnia: 4, maja: 5, czerwca: 6,
  lipca: 7, sierpnia: 8, września: 9, wrzesnia: 9, października: 10, pazdziernika: 10,
  listopada: 11, grudnia: 12,
};

// Sezon w tytule ("2026/2027") pozwala przypisać rok: runda jesienna (lipiec-grudzień) to rok
// pierwszy, wiosenna (styczeń-czerwiec) drugi. Granica idzie po LIPCU, bo polskie ligi zaczynają
// sezon jeszcze w lipcu — przy granicy na sierpniu pierwsza kolejka lądowała rok za późno.
export function seasonYears(leagueName) {
  const m = leagueName.match(/(\d{4})\/(\d{4})/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}

// "8 sierpnia" / "19-20 września" -> ISO. Przy zakresie bierzemy pierwszy dzień.
export function polishDateToIso(text, years) {
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
export function parseSchedule(html) {
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

// Klasyfikacja ligowa z tej samej strony co terminarz — 90minut umieszcza ją nad meczami,
// za znacznikiem „POCZĄTEK TABELI". Bierzemy pierwsze osiem kolumn (miejsce, nazwa, mecze,
// punkty, zwycięstwa, remisy, porażki, bramki); dalsze to rozbicie na dom/wyjazd i mecze
// bezpośrednie, których nie potrzebujemy.
export function parseTabela(html) {
  const start = html.indexOf("POCZĄTEK TABELI");
  const obszar = start >= 0 ? html.slice(start) : html;
  const koniec = obszar.search(/KONIEC TABELI|Kolejka\s*\d/i);
  const segment = koniec > 0 ? obszar.slice(0, koniec) : obszar;

  const out = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  // 90minut wypisuje numer miejsca TYLKO przy pierwszej drużynie danej lokaty — kolejne, mające
  // tyle samo punktów, mają tę komórkę pustą. Odrzucanie takich wierszy gubiło pół tabeli
  // (a przed startem sezonu, gdy wszyscy mają zero, zostawała jedna drużyna). Pustą lokatę
  // dziedziczymy po poprzednim wierszu.
  let ostatnieMiejsce = 0;
  while ((m = rowRe.exec(segment)) !== null) {
    const cells = (m[1].match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(strip);
    if (cells.length < 8) continue;

    const nazwa = cells[1];
    if (!nazwa || /^nazwa$/i.test(nazwa)) continue;
    const surowe = parseInt(String(cells[0]).replace(/\D/g, ""), 10);
    const miejsce = Number.isFinite(surowe) ? surowe : ostatnieMiejsce;
    if (!miejsce) continue;               // wiersz przed pierwszą lokatą to nagłówek
    ostatnieMiejsce = miejsce;

    const liczba = (i) => {
      const n = parseInt(String(cells[i]).replace(/[^\d-]/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    };
    const bramki = String(cells[7] || "").trim();
    const mecze = liczba(2), punkty = liczba(3);
    if (mecze === null || punkty === null) continue;

    out.push({
      miejsce, nazwa, mecze, punkty,
      zwyciestwa: liczba(4), remisy: liczba(5), porazki: liczba(6),
      bramki: /^\d+\s*[-:]\s*\d+$/.test(bramki) ? bramki : "",
    });
  }
  // Odsiewamy po NAZWIE, nie po lokacie — drużyny dzielące miejsce są normalne, a powtórzona
  // nazwa oznaczałaby drugą tabelę na stronie (np. osobno runda jesienna).
  const widziane = new Set();
  return out.filter((w) => {
    const klucz = normalizujNazwe(w.nazwa);
    if (widziane.has(klucz)) return false;
    widziane.add(klucz);
    return true;
  });
}

// Pobranie i rozbiór jednej strony ligi. 90minut serwuje ISO-8859-2 — bez tego dekodera polskie
// nazwy klubów przychodzą zniekształcone.
export async function fetchLeagueSchedule(rawUrl) {
  const { url, error } = validateTarget(rawUrl);
  if (error) return { error };

  const upstream = await fetch(url.toString(), {
    headers: { "User-Agent": "ScoutBaseSystem/1.0 (+https://scoutbasesystem.com)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!upstream.ok) return { error: `90minut odpowiedziało kodem ${upstream.status}.` };

  const buffer = await upstream.arrayBuffer();
  let html;
  try {
    html = new TextDecoder("iso-8859-2").decode(buffer);
  } catch {
    html = new TextDecoder("latin1").decode(buffer);
  }
  return { league: parseLeagueName(html), matches: parseSchedule(html), table: parseTabela(html) };
}

// Klucz meczu: KOLEJKA + para drużyn, świadomie BEZ daty.
//
// Wcześniej mecze rozpoznawano po „data|gospodarz|gość". Gdy 90minut zamieniało datę przybliżoną
// (z nagłówka kolejki) na dokładną, klucz się zmieniał i powstawał DRUGI wpis zamiast aktualizacji
// pierwszego — a obserwacja wskazywała nadal na ten stary, bez godziny. Para drużyn w danej
// kolejce spotyka się raz, więc to jest właściwa tożsamość spotkania.
export const normalizujNazwe = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[łøđ]/g, (c) => ({ ł: "l", ø: "o", đ: "d" }[c]))
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");

export const kluczMeczu = (m) =>
  `${m.round ?? ""}|${normalizujNazwe(m.homeTeam)}|${normalizujNazwe(m.awayTeam)}`;
