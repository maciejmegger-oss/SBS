// Wspólna obsługa Kalendarza Google.
//
// GDZIE MIESZKAJĄ SEKRETY: wyłącznie w zmiennych środowiskowych Vercela. Token odświeżania NIE
// trafia do bazy — sbs_kv i pozostałe tabele czyta z przeglądarki klucz anonimowy, więc cokolwiek
// tam zapiszemy, jest widoczne dla każdego, kto otworzy stronę. Token do kalendarza pozwalałby
// czytać i zmieniać wpisy w prywatnym kalendarzu, więc to jedyne bezpieczne miejsce.
//
// ZAKRES UPRAWNIEŃ jest najwęższy z możliwych: calendar.events pozwala czytać i zapisywać
// wydarzenia, ale nie daje dostępu do listy kalendarzy ani ustawień konta.

export const ZAKRES = "https://www.googleapis.com/auth/calendar.events";
export const STREFA = "Europe/Warsaw";

const ID_KLIENTA = process.env.GOOGLE_CLIENT_ID;
const SEKRET_KLIENTA = process.env.GOOGLE_CLIENT_SECRET;
const TOKEN_ODSWIEZANIA = process.env.GOOGLE_REFRESH_TOKEN;
const KALENDARZ = process.env.GOOGLE_CALENDAR_ID || "primary";

export const konfiguracjaGoogle = () => ({
  idKlienta: ID_KLIENTA,
  sekretKlienta: SEKRET_KLIENTA,
  tokenOdswiezania: TOKEN_ODSWIEZANIA,
  kalendarz: KALENDARZ,
  gotowe: !!(ID_KLIENTA && SEKRET_KLIENTA && TOKEN_ODSWIEZANIA),
});

export function adresPrzekierowania(req) {
  // Adres musi być identyczny jak wpisany w konsoli Google, co do znaku. Bierzemy go z nagłówka
  // żądania, żeby działał zarówno na domenie produkcyjnej, jak i na podglądzie wdrożenia.
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const schemat = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  return `${schemat}://${host}/api/google-callback`;
}

// Token dostępowy żyje godzinę, więc bierzemy świeży na każde uruchomienie. To jedno dodatkowe
// zapytanie, za to nie trzeba nigdzie trzymać stanu.
export async function tokenDostepowy() {
  const k = konfiguracjaGoogle();
  if (!k.gotowe) throw new Error("Brak konfiguracji Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN).");
  const odp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: k.idKlienta,
      client_secret: k.sekretKlienta,
      refresh_token: k.tokenOdswiezania,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const dane = await odp.json();
  if (!odp.ok || !dane.access_token) {
    // Najczęstsza przyczyna: token odświeżania został unieważniony (zmiana hasła, cofnięcie
    // dostępu, albo aplikacja stoi w trybie testowym, gdzie Google kasuje go po tygodniu).
    throw new Error(`Google odmówiło tokenu: ${dane.error || odp.status} ${dane.error_description || ""}`.trim());
  }
  return dane.access_token;
}

export async function kalendarzGoogle(sciezka, opcje = {}, token) {
  const odp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(KALENDARZ)}${sciezka}`,
    {
      ...opcje,
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...(opcje.headers || {}) },
      signal: AbortSignal.timeout(20000),
    }
  );
  const tresc = await odp.text();
  let dane = null;
  try { dane = tresc ? JSON.parse(tresc) : null; } catch { /* puste ciało przy usunięciu */ }
  if (!odp.ok) {
    const powod = (dane && dane.error && dane.error.message) || tresc.slice(0, 200);
    const e = new Error(`Kalendarz Google: ${odp.status} ${powod}`);
    e.status = odp.status;
    throw e;
  }
  return dane;
}

// Data i godzina w strefie warszawskiej.
//
// Google oddaje moment z przesunięciem strefowym ("2026-08-08T17:30:00+02:00"), a my trzymamy
// osobno dzień i godzinę lokalną. Wycinanie znaków z tego napisu działałoby tylko dopóty, dopóki
// telefon i serwer są w tej samej strefie — wystarczy edycja wpisu w podróży, żeby obserwacja
// przesunęła się o kilka godzin. Dlatego przeliczamy przez Intl, który zna też zmiany czasu.
export function naCzasWarszawski(isoZPrzesunieciem) {
  const d = new Date(isoZPrzesunieciem);
  if (Number.isNaN(d.getTime())) return null;
  const czesci = new Intl.DateTimeFormat("sv-SE", {
    timeZone: STREFA,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return {
    date: `${czesci.year}-${czesci.month}-${czesci.day}`,
    time: `${czesci.hour}:${czesci.minute}`,
  };
}

// Obserwacja trwa tyle, co mecz z rozgrzewką — dwie godziny. Gdyby kiedyś miało to być
// nastawialne, jest to jedno miejsce do zmiany.
const DLUGOSC_MINUT = 120;

export function wydarzenieZObserwacji(obs, opis) {
  const godzina = obs.match_time || "15:00";
  const start = `${obs.date}T${godzina.length === 5 ? godzina : "15:00"}:00`;
  const [g, m] = start.slice(11, 16).split(":").map(Number);
  const koniecMinut = g * 60 + m + DLUGOSC_MINUT;
  const koniec = `${obs.date}T${String(Math.floor(koniecMinut / 60) % 24).padStart(2, "0")}:${String(koniecMinut % 60).padStart(2, "0")}:00`;

  return {
    summary: opis.tytul,
    location: obs.location || "",
    description: opis.opis,
    start: { dateTime: start, timeZone: STREFA },
    // Mecz po 22:00 przeniósłby koniec na następną dobę; przy dwugodzinnym oknie i meczach
    // granych najpóźniej o 20:30 to nie występuje, ale zabezpieczamy się przed końcem przed startem.
    end: { dateTime: koniecMinut >= 24 * 60 ? `${obs.date}T23:59:00` : koniec, timeZone: STREFA },
    // Znacznik pozwala rozpoznać NASZE wydarzenia przy odczycie zwrotnym. Bez niego musielibyśmy
    // ufać samemu tytułowi, a ten użytkownik może dowolnie zmienić w telefonie.
    extendedProperties: { private: { sbsObsId: String(obs.id) } },
  };
}
