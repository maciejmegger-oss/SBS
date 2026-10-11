// SKRZYNKA NA ZEBRANE PROTOKOŁY — ZBIERACZ ODDAJE JE TUTAJ, APLIKACJA STĄD BIERZE.
//
// PO CO TO JEST
// Zakładka zbiera protokoły na stronie „Łączy nas piłka" i musi je jakoś przekazać do SBS. Dotąd
// robiła to na dwa sposoby i oba bywają zablokowane: przez schowek (przeglądarka nie zawsze
// pozwala zapisać) i przez nowe okno (blokada wyskakujących okien). Gdy oba zawiodą, kilka minut
// zbierania idzie do kosza, a skaut widzi tylko komunikat, że „aplikacja się nie odezwała".
//
// Dlatego trzecia droga, najprostsza: zbieracz wysyła treść TUTAJ, a okno protokołów w aplikacji
// pobiera ją jednym kliknięciem. Nic nie trzeba kopiować ani wklejać.
//
// CO TU SIEDZI I JAK DŁUGO
// Jeden wiersz w sbs_kv na grupę rozgrywek — ostatnia zbiórka nadpisuje poprzednią. To skrzynka
// przelotowa, nie archiwum: treść protokołów po rozliczeniu nie jest już do niczego potrzebna,
// bo dorobek siedzi przy zawodnikach.
//
// DOSTĘP
// Zapis idzie z cudzej strony (laczynaspilka.pl), więc trzeba na to pozwolić wprost w nagłówkach.
// Serwer pisze kluczem serwisowym — przeglądarka na ŁNP nie ma i nie może mieć dostępu do bazy.

import { BAZA, naglowkiBazy, MA_KLUCZ_SERWISOWY } from "./_baza.js";
import { zalogowanyZatwierdzony } from "./_auth.js";

const DOZWOLONE = ["https://www.laczynaspilka.pl", "https://laczynaspilka.pl", "https://www.scoutbasesystem.com"];
const KLUCZ = (grupa) => "scouting:wklejka_lnp" + (grupa ? ":" + String(grupa).slice(0, 60) : "");

export default async function handler(req, res) {
  const skad = String(req.headers.origin || "");
  if (DOZWOLONE.includes(skad)) {
    res.setHeader("Access-Control-Allow-Origin", skad);
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!MA_KLUCZ_SERWISOWY) {
    return res.status(503).json({ error: "Skrzynka wymaga klucza serwisowego (SUPABASE_SERVICE_KEY) w ustawieniach projektu." });
  }

  // Nazwa grupy trafia do klucza w bazie — przepuszczamy tylko znaki, które w niej występują.
  const grupa = String((req.query && req.query.grupa) || "");
  if (grupa && !/^[\w\-. ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]{1,60}$/.test(grupa)) {
    return res.status(400).json({ error: "Niepoprawna nazwa grupy." });
  }
  const klucz = KLUCZ(grupa);

  if (req.method === "POST") {
    // Zapis przyjmujemy tylko ze stron z listy DOZWOLONE (zakładka na ŁNP i nasza aplikacja).
    // To nie jest uwierzytelnienie — nagłówek Origin da się podrobić poza przeglądarką — bo zakładka
    // działa na cudzej stronie i nie ma sesji użytkownika. Ogranicza przypadkowe i masowe zapisy.
    // Treść ze skrzynki jest i tak traktowana jak dane z zewnątrz: aplikacja ją parsuje i pokazuje
    // do sprawdzenia, nic nie trafia do kartoteki bez klikania skauta.
    if (!DOZWOLONE.includes(skad)) {
      return res.status(403).json({ error: "Zapis możliwy tylko z zakładki na Łączy Nas Piłka albo z aplikacji." });
    }
    const dane = req.body && typeof req.body === "object" ? req.body : {};
    const tresc = typeof dane.tresc === "string" ? dane.tresc : "";
    if (!tresc.trim()) return res.status(400).json({ error: "Pusta treść — nie ma czego zapisać." });
    // Większe zbiórki to kilkaset kilobajtów; powyżej dwóch megabajtów to już nie jest kolejka,
    // tylko pomyłka, i nie ma powodu tego przyjmować.
    if (tresc.length > 2_000_000) return res.status(413).json({ error: "Za duża paczka — zbierz mniejszy zakres." });

    const wiersz = { key: klucz, value: JSON.stringify({ tresc, grupa, zrodlo: dane.zrodlo || "", kiedy: new Date().toISOString() }) };
    const odp = await fetch(`${BAZA}/rest/v1/sbs_kv`, {
      method: "POST",
      headers: { ...naglowkiBazy(), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([wiersz]),
    });
    if (!odp.ok) return res.status(502).json({ error: "Baza odmówiła zapisu: " + (await odp.text()).slice(0, 200) });
    return res.status(200).json({ zapisane: tresc.length, grupa });
  }

  if (req.method === "GET") {
    // Odczyt tylko dla zalogowanych i zatwierdzonych — skrzynka zawiera zebrane dane rozgrywkowe.
    if (!(await zalogowanyZatwierdzony(req))) {
      return res.status(401).json({ error: "Zaloguj się w aplikacji, żeby pobrać zebrane protokoły." });
    }
    const odp = await fetch(`${BAZA}/rest/v1/sbs_kv?select=value&key=eq.${encodeURIComponent(klucz)}`, { headers: naglowkiBazy() });
    if (!odp.ok) return res.status(502).json({ error: "Baza odmówiła odczytu." });
    const wiersze = await odp.json();
    if (!wiersze.length) return res.status(404).json({ error: "Nic tu jeszcze nie ma — najpierw zbierz kolejkę zakładką na ŁNP." });
    try {
      const d = JSON.parse(wiersze[0].value);
      return res.status(200).json({ tresc: d.tresc, kiedy: d.kiedy, zrodlo: d.zrodlo, grupa: d.grupa });
    } catch (e) {
      return res.status(500).json({ error: "Zapisana treść jest uszkodzona." });
    }
  }

  return res.status(405).json({ error: "Ta ścieżka przyjmuje GET i POST." });
}
