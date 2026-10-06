// DZIENNY RAPORT „SBS AI" — asystent, który co rano przegląda nowych zawodników, porównuje ich
// z profilem poszukiwanym przez klub i wysyła podsumowanie na telefon.
//
// CO ROBI (kolejność jak w raporcie):
//   1. bierze zawodników dodanych od poprzedniego przebiegu,
//   2. liczy ich parametry (oceny z obserwacji, minuty, rocznik, pozycja, wzrost, noga),
//   3. porównuje z profilem z `scouting:profil_poszukiwany`,
//   4. wypisuje, czego brakuje w kartotece (to jest lista dla skauta — niczego nie zgaduje),
//   5. układa ranking,
//   6. wskazuje zawodników do ponownej obserwacji (także z całej bazy, nie tylko nowych),
//   7. zapisuje pełny raport w sbs_kv (`scouting:raport_dzienny` i kopia z datą),
//   8. wysyła skrót na telefon.
//
// CZEGO NIE ROBI: nie zmienia kartoteki zawodników, nie wpisuje ocen ani statusów i nie ściąga
// brakujących danych z internetu — minuty i statystyki uzupełniają osobne zadania
// (/api/refresh-stats, /api/stats-90minut), a ten raport ma się uruchamiać PO nich.
//
// TELEFON — ustaw w Vercelu (Project → Settings → Environment Variables) jedno z dwóch:
//   * NTFY_TOPIC            — temat w aplikacji ntfy (bezpłatna, bez konta). Wybierz długi, trudny do
//                             odgadnięcia ciąg, np. sbs-ai-k3x9q2m7p1 — każdy, kto zna temat, czyta wiadomości.
//                             Opcjonalnie NTFY_SERVER (domyślnie https://ntfy.sh) i APP_URL (link po kliknięciu).
//   * TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID — wiadomość na Telegram.
// Bez żadnego z nich raport i tak się zapisze w bazie, a odpowiedź endpointu pokaże treść.
//
// PODGLĄD: ?dry=1 — liczy i zwraca raport, niczego nie zapisuje i nie wysyła (jak w refresh-stats).

import { BAZA, KLUCZ_BAZY, naglowkiBazy, PODPOWIEDZ_BRAK_KLUCZA } from "./_baza.js";
import { zbudujRaport, KLUCZ_PROFILU, KLUCZ_STANU } from "./_raport-dzienny.js";

const KLUCZ_RAPORTU = "scouting:raport_dzienny";

async function pobierzWszystko(tabela, kolumny) {
  let wiersze = [], od = 0;
  for (;;) {
    const r = await fetch(`${BAZA}/rest/v1/${tabela}?select=${kolumny}&limit=1000&offset=${od}`, {
      headers: naglowkiBazy(), signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`${tabela}: ${r.status}`);
    const czesc = await r.json();
    wiersze = wiersze.concat(czesc);
    if (czesc.length < 1000) return wiersze;
    od += 1000;
  }
}

async function czytajKv(klucz) {
  const r = await fetch(`${BAZA}/rest/v1/sbs_kv?select=value&key=eq.${encodeURIComponent(klucz)}`, {
    headers: naglowkiBazy(), signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`sbs_kv ${klucz}: ${r.status}`);
  const w = await r.json();
  if (!w.length) return null;
  try { return JSON.parse(w[0].value); } catch { return null; }
}

async function zapiszKv(klucz, wartosc) {
  const r = await fetch(`${BAZA}/rest/v1/sbs_kv?on_conflict=key`, {
    method: "POST",
    headers: { ...naglowkiBazy(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: klucz, value: JSON.stringify(wartosc), updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`zapis sbs_kv ${klucz}: ${r.status} ${await r.text()}`);
}

// Zwraca nazwę kanału, którym poszło, albo null, gdy żaden nie jest ustawiony. Błąd wysyłki rzuca.
async function wyslijNaTelefon(tytul, tekst) {
  const temat = process.env.NTFY_TOPIC;
  if (temat) {
    // Format JSON, a nie nagłówki: nagłówek HTTP nie przenosi polskich liter.
    const r = await fetch(process.env.NTFY_SERVER || "https://ntfy.sh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: temat, title: tytul, message: tekst.replace(/^[^\n]*\n\n/, ""), tags: ["soccer"],
        ...(process.env.APP_URL ? { click: process.env.APP_URL } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`ntfy: ${r.status}`);
    return "ntfy";
  }
  const token = process.env.TELEGRAM_BOT_TOKEN, czat = process.env.TELEGRAM_CHAT_ID;
  if (token && czat) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: czat, text: tekst }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`telegram: ${r.status}`);
    return "telegram";
  }
  return null;
}

export default async function handler(req, res) {
  const sekret = process.env.CRON_SECRET;
  if (sekret) {
    const podany =
      (req.headers.authorization || "").replace(/^Bearer\s+/i, "") ||
      (Array.isArray(req.query.secret) ? req.query.secret[0] : req.query.secret) || "";
    if (podany !== sekret) return res.status(401).json({ error: "Brak uprawnień." });
  }
  if (!BAZA || !KLUCZ_BAZY) return res.status(500).json({ error: "Brak konfiguracji bazy." });
  if (PODPOWIEDZ_BRAK_KLUCZA) return res.status(500).json({ error: "Serwer nie ma dostępu do bazy.", podpowiedz: PODPOWIEDZ_BRAK_KLUCZA });

  const zapisz = String(req.query.dry || "") !== "1";

  let raport, wszyscy;
  try {
    const [zawodnicy, obserwacje, profil, stan] = await Promise.all([
      pobierzWszystko("sbs_players",
        "id,first_name,last_name,birth_year,birth_date,position,foot,height,minutes,matches,goals,status,club_id,has_contract,has_agent,date_added,custom_fields"),
      pobierzWszystko("sbs_observations", "player_id,date,ratings,recommendation,stats_filled_in"),
      czytajKv(KLUCZ_PROFILU),
      czytajKv(KLUCZ_STANU),
    ]);
    const poZawodniku = new Map();
    obserwacje.forEach((o) => {
      if (!o.player_id) return;
      if (!poZawodniku.has(o.player_id)) poZawodniku.set(o.player_id, []);
      poZawodniku.get(o.player_id).push(o);
    });
    wszyscy = zawodnicy;
    raport = zbudujRaport({ zawodnicy, obserwacjePoZawodniku: poZawodniku, profil, stan });
  } catch (e) {
    return res.status(502).json({ error: "Odczyt z bazy nie powiódł się: " + e.message });
  }

  if (!zapisz) return res.status(200).json({ ok: true, trybPodgladu: true, raport });

  let kanal = null;
  try {
    kanal = await wyslijNaTelefon("SBS AI – raport dzienny", raport.wiadomosc);
  } catch (e) {
    // Stanu NIE przesuwamy: jutro ci sami zawodnicy znów będą „nowi", zamiast zniknąć bez śladu.
    return res.status(502).json({ error: "Wysyłka na telefon nie powiodła się: " + e.message, raport });
  }

  try {
    await zapiszKv(KLUCZ_RAPORTU, raport);
    await zapiszKv(`${KLUCZ_RAPORTU}:${raport.data}`, raport);
    await zapiszKv(KLUCZ_STANU, { ostatniPrzebieg: new Date().toISOString(), znane: wszyscy.map((p) => p.id) });
  } catch (e) {
    return res.status(502).json({ error: "Zapis raportu nie powiódł się: " + e.message, wyslanoNa: kanal, raport });
  }

  return res.status(200).json({
    ok: true,
    wyslanoNa: kanal,
    ostrzezenie: kanal ? undefined : "Nie ustawiono NTFY_TOPIC ani TELEGRAM_* — raport zapisany w bazie, ale nie wysłany.",
    raport,
  });
}
