// Sprawdzenie, czy serwer naprawdę dogaduje się z bazą — i co dokładnie mówi, gdy nie.
//
// PO CO TO JEST: „brak dostępu do bazy" ma trzy zupełnie różne przyczyny, a z samej odpowiedzi
// aplikacji nie da się ich rozróżnić:
//   1. zmiennej w ogóle nie ma,
//   2. zmienna jest, ale trzyma nie to co trzeba (adres, cudzysłów, klucz publiczny zamiast
//      serwisowego) — Postgres odsyła wtedy 401,
//   3. zmienna jest poprawna, ale reguły dostępu i tak nic nie wpuszczają — wtedy 200 i pusta
//      lista, co wygląda jak „nie ma takich danych".
// Każda wymaga innego ruchu, więc endpoint pokazuje surową odpowiedź bazy zamiast ją tłumaczyć.
//
// KLUCZA NIGDY NIE ODDAJEMY. Wychodzą stąd wyłącznie długość i cztery ostatnie znaki — tyle, ile
// trzeba, żeby stwierdzić „to nie ten klucz", i za mało, żeby cokolwiek nim zrobić.
import { BAZA, KLUCZ_BAZY, MA_KLUCZ_SERWISOWY } from "./_baza.js";

const opisz = (v) =>
  !v ? "(nie ustawiona)" : `długość ${v.length}, kończy się …${String(v).slice(-4)}`;

// Po samym początku wartości widać, czy ktoś nie wkleił adresu albo nie zostawił cudzysłowu.
function ksztalt(v) {
  const s = String(v || "");
  if (!s) return "pusta";
  if (/^["']/.test(s) || /["']$/.test(s)) return "UWAGA: zaczyna się lub kończy cudzysłowem";
  if (/^https?:\/\//i.test(s)) return "UWAGA: to wygląda na adres strony, nie na klucz";
  if (/\s/.test(s)) return "UWAGA: zawiera spację lub znak nowej linii";
  if (s.startsWith("eyJ")) return "klucz w formacie JWT (starszy styl Supabase)";
  if (s.startsWith("sb_secret_")) return "klucz serwisowy w nowym formacie Supabase";
  if (s.startsWith("sb_publishable_")) return "UWAGA: to klucz PUBLICZNY, nie serwisowy";
  return "nierozpoznany kształt";
}

export default async function handler(req, res) {
  const wynik = {
    adresBazy: BAZA ? BAZA.replace(/^https?:\/\//, "").slice(0, 30) + "…" : "(brak)",
    maKluczSerwisowy: MA_KLUCZ_SERWISOWY,
    uzywanyKlucz: opisz(KLUCZ_BAZY),
    ksztaltKlucza: ksztalt(KLUCZ_BAZY),
  };

  if (!BAZA || !KLUCZ_BAZY) {
    wynik.wniosek = "Brak adresu bazy albo klucza — bez tego nie ma czego sprawdzać.";
    return res.status(500).json(wynik);
  }

  // Jeden lekki odczyt: liczba zawodników. Nie pobiera danych, więc nadaje się do wołania
  // z zewnątrz, a mimo to przechodzi dokładnie tę samą drogę co prawdziwe zapytania.
  try {
    const r = await fetch(`${BAZA}/rest/v1/sbs_players?select=id&limit=1`, {
      headers: {
        apikey: KLUCZ_BAZY,
        Authorization: "Bearer " + KLUCZ_BAZY,
        Prefer: "count=exact",
      },
      signal: AbortSignal.timeout(15000),
    });
    wynik.kodOdpowiedzi = r.status;
    wynik.ile = r.headers.get("content-range") || "(brak nagłówka z liczbą)";
    const tresc = await r.text();
    if (!r.ok) {
      wynik.odpowiedzBazy = tresc.slice(0, 400);
      wynik.wniosek =
        r.status === 401
          ? "Baza odrzuca klucz. W Vercelu leży niewłaściwa wartość — potrzebny jest service_role z Supabase (Project Settings → API Keys), nie anon i nie adres strony."
          : "Baza odpowiedziała błędem — treść wyżej.";
      return res.status(502).json(wynik);
    }
    const wiersze = JSON.parse(tresc || "[]");
    wynik.wniosek = wiersze.length
      ? "Dostęp działa — serwer czyta kartotekę."
      : "Klucz przyjęty, ale zapytanie nie zwróciło ani jednego wiersza (reguły dostępu albo pusta tabela).";
    return res.status(200).json(wynik);
  } catch (e) {
    wynik.wniosek = "Nie udało się połączyć z bazą: " + e.message;
    return res.status(504).json(wynik);
  }
}
