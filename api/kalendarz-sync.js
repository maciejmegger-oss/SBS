// Dwustronna synchronizacja obserwacji z Kalendarzem Google.
//
// W STRONĘ GOOGLE: każda przyszła obserwacja dostaje wydarzenie — w telefonie widać plan bez
// otwierania laptopa.
//
// W STRONĘ SBS: przesunięcie wydarzenia w telefonie wraca do obserwacji jako nowa data i godzina.
//
// KTO WYGRYWA PRZY SPRZECZNOŚCI: przy DACIE I GODZINIE wygrywa Google, bo to jedyne, co zmieniasz
// w telefonie, i to jest sens tej funkcji. Wszystko pozostałe — zawodnik, mecz, adres, scout —
// prowadzi SBS i jest przy każdym przebiegu nadpisywane w kalendarzu. Dzięki temu nie trzeba
// rozstrzygać sprzecznych zmian tego samego pola z dwóch stron.
//
// CZEGO NIE ROBIMY: nie tworzymy obserwacji z wydarzeń, których sami nie założyliśmy. Wydarzenie
// bez naszego znacznika sbsObsId jest ignorowane, więc reszta kalendarza pozostaje nietknięta,
// a przypadkowy wpis nie zamienia się w obserwację.
import {
  konfiguracjaGoogle, tokenDostepowy, kalendarzGoogle, wydarzenieZObserwacji, naCzasWarszawski,
} from "./_google.js";

import { BAZA, KLUCZ_BAZY, naglowkiBazy } from "./_baza.js";

const KLUCZ_ZNACZNIKA = "sbs:google:ostatniaSynchronizacja";

async function czytajKv(klucz) {
  const r = await fetch(`${BAZA}/rest/v1/sbs_kv?select=value&key=eq.${encodeURIComponent(klucz)}`, { headers: naglowkiBazy() });
  if (!r.ok) return null;
  const rows = await r.json();
  if (!rows[0]) return null;
  try { return JSON.parse(rows[0].value); } catch { return null; }
}

async function zapiszKv(klucz, dane) {
  await fetch(`${BAZA}/rest/v1/sbs_kv`, {
    method: "POST",
    headers: { ...naglowkiBazy(), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key: klucz, value: JSON.stringify(dane) }),
  });
}

const ext = (o) => ((o.ratings || {}).__ext) || {};

// Zapis pola rozszerzonego przy obserwacji. Kolumny na to nie ma — aplikacja trzyma takie pola
// w jsonb `ratings` pod kluczem __ext (ten sam układ, co po stronie przeglądarki).
async function zapiszObserwacje(id, zmianyKolumn, zmianyExt, ratingsPrzed) {
  const ciało = { ...zmianyKolumn };
  if (zmianyExt) {
    ciało.ratings = { ...(ratingsPrzed || {}), __ext: { ...(((ratingsPrzed || {}).__ext) || {}), ...zmianyExt } };
  }
  const r = await fetch(`${BAZA}/rest/v1/sbs_observations?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH", headers: naglowkiBazy(), body: JSON.stringify(ciało),
  });
  return r.ok ? null : `${r.status} ${(await r.text()).slice(0, 160)}`;
}

export default async function handler(req, res) {
  const pierwszy = (v) => String((Array.isArray(v) ? v[0] : v) || "");
  const sekret = process.env.CRON_SECRET;
  if (sekret) {
    const podany = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || pierwszy(req.query.secret);
    if (podany !== sekret) return res.status(401).json({ error: "Brak uprawnień." });
  }
  if (!BAZA || !KLUCZ_BAZY) return res.status(500).json({ error: "Brak konfiguracji bazy." });

  const k = konfiguracjaGoogle();
  if (!k.gotowe) {
    return res.status(400).json({
      error: "Kalendarz Google nie jest jeszcze podłączony.",
      brakuje: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"]
        .filter((n) => !process.env[n]),
      podpowiedz: "Otwórz /api/google-auth?secret=… i wykonaj kroki ze strony powrotnej.",
    });
  }

  const naSucho = pierwszy(req.query.dry) === "1";
  let token;
  try { token = await tokenDostepowy(); }
  catch (e) { return res.status(502).json({ error: e.message }); }

  // --- OBSERWACJE Z BAZY ---
  // Tylko od dziś w przód. Przepisywanie odbytych obserwacji zaśmiecałoby kalendarz historią,
  // a ich przesuwanie byłoby fałszowaniem zapisu pracy.
  const dzis = new Date().toISOString().slice(0, 10);
  const rO = await fetch(
    `${BAZA}/rest/v1/sbs_observations?select=id,player_id,date,match_time,match,location,scout,ratings&date=gte.${dzis}&order=date.asc&limit=500`,
    { headers: naglowkiBazy() }
  );
  if (!rO.ok) return res.status(502).json({ error: "Odczyt obserwacji: " + rO.status });
  const obserwacje = await rO.json();

  // Nazwiska zawodników do tytułu wydarzenia — jedno zapytanie zamiast jednego na obserwację.
  const idZawodnikow = [...new Set(obserwacje.map((o) => o.player_id).filter(Boolean))];
  const nazwiska = new Map();
  if (idZawodnikow.length) {
    const rZ = await fetch(
      `${BAZA}/rest/v1/sbs_players?select=id,first_name,last_name&id=in.(${idZawodnikow.map(encodeURIComponent).join(",")})`,
      { headers: naglowkiBazy() }
    );
    if (rZ.ok) (await rZ.json()).forEach((p) => nazwiska.set(p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim()));
  }

  // ---------------------------------------------------------------------
  // KROK 1: GOOGLE -> SBS (najpierw, żeby zmiany z telefonu nie zostały w tym samym
  // przebiegu nadpisane tym, co jeszcze stoi w bazie).
  // ---------------------------------------------------------------------
  const stan = (await czytajKv(KLUCZ_ZNACZNIKA)) || {};
  const zGoogle = [];
  const bledy = [];

  if (stan.ostatnia) {
    try {
      const parametry = new URLSearchParams({
        updatedMin: stan.ostatnia,
        showDeleted: "false",
        singleEvents: "true",
        maxResults: "250",
      });
      const lista = await kalendarzGoogle(`/events?${parametry}`, {}, token);
      const wgId = new Map(obserwacje.map((o) => [String(o.id), o]));

      for (const w of (lista.items || [])) {
        const znacznik = ((w.extendedProperties || {}).private || {}).sbsObsId;
        if (!znacznik) continue;                       // nie nasze wydarzenie — nie dotykamy
        const o = wgId.get(String(znacznik));
        if (!o) continue;                              // obserwacja usunięta albo już odbyta
        if (!w.start || !w.start.dateTime) continue;   // wydarzenie całodniowe — brak godziny
        const kiedy = naCzasWarszawski(w.start.dateTime);
        if (!kiedy) continue;
        if (kiedy.date === o.date && kiedy.time === (o.match_time || "")) continue;

        zGoogle.push({ id: o.id, kto: nazwiska.get(o.player_id) || o.match || o.id,
          bylo: `${o.date} ${o.match_time || "—"}`, jest: `${kiedy.date} ${kiedy.time}` });
        if (!naSucho) {
          const b = await zapiszObserwacje(o.id, { date: kiedy.date, match_time: kiedy.time }, null, o.ratings);
          if (b) bledy.push({ etap: "zapis do SBS", kto: o.id, powod: b });
          else { o.date = kiedy.date; o.match_time = kiedy.time; }
        }
      }
    } catch (e) {
      bledy.push({ etap: "odczyt z Google", powod: e.message });
    }
  }

  // ---------------------------------------------------------------------
  // KROK 2: SBS -> GOOGLE
  // ---------------------------------------------------------------------
  let zalozone = 0, zaktualizowane = 0;
  const doGoogle = [];

  for (const o of obserwacje) {
    const e = ext(o);
    const zawodnik = nazwiska.get(o.player_id) || "";
    const tytul = zawodnik ? `⚽ ${zawodnik}` : `⚽ ${o.match || "Obserwacja"}`;
    const opis = [
      o.match ? `Mecz: ${o.match}` : "",
      o.scout ? `Scout: ${o.scout}` : "",
      e.obsType ? `Rodzaj: ${e.obsType}` : "",
      "",
      "Wpis prowadzony przez Scout Base System. Datę i godzinę możesz zmienić tutaj —",
      "zmiana wróci do SBS. Pozostałe pola nadpisuje SBS.",
    ].filter((x) => x !== null).join("\n");

    const wydarzenie = wydarzenieZObserwacji(o, { tytul, opis });
    if (naSucho) { doGoogle.push({ kto: tytul, kiedy: `${o.date} ${o.match_time || "15:00"}`, tryb: e.googleEventId ? "aktualizacja" : "założenie" }); continue; }

    try {
      if (e.googleEventId) {
        await kalendarzGoogle(`/events/${encodeURIComponent(e.googleEventId)}`, {
          method: "PATCH", body: JSON.stringify(wydarzenie),
        }, token);
        zaktualizowane++;
      } else {
        const nowe = await kalendarzGoogle("/events", { method: "POST", body: JSON.stringify(wydarzenie) }, token);
        const b = await zapiszObserwacje(o.id, {}, { googleEventId: nowe.id }, o.ratings);
        if (b) bledy.push({ etap: "zapis identyfikatora wydarzenia", kto: tytul, powod: b });
        zalozone++;
      }
    } catch (err) {
      // Wydarzenie skasowane ręcznie w telefonie: Google oddaje 404 albo 410. Czyścimy
      // identyfikator, żeby następny przebieg założył je od nowa zamiast wpadać w ten sam błąd.
      if (err.status === 404 || err.status === 410) {
        await zapiszObserwacje(o.id, {}, { googleEventId: null }, o.ratings);
        bledy.push({ etap: "wydarzenie zniknęło z kalendarza", kto: tytul, powod: "założę je ponownie przy następnym przebiegu" });
      } else {
        bledy.push({ etap: "zapis do Google", kto: tytul, powod: err.message });
      }
    }
  }

  // Znacznik czasu przesuwamy o minutę wstecz, bo Google filtruje updatedMin z dokładnością do
  // milisekundy — zmiana zrobiona w trakcie przebiegu inaczej wypadłaby poza oba okna i przepadła.
  if (!naSucho) {
    await zapiszKv(KLUCZ_ZNACZNIKA, { ostatnia: new Date(Date.now() - 60000).toISOString() });
  }

  return res.status(200).json({
    ok: true,
    trybPodgladu: naSucho,
    kalendarz: k.kalendarz,
    obserwacjiWPrzod: obserwacje.length,
    pierwszyPrzebieg: !stan.ostatnia,
    zGoogleDoSbs: zGoogle.length,
    zmianyZTelefonu: zGoogle,
    zalozoneWydarzenia: zalozone,
    zaktualizowaneWydarzenia: zaktualizowane,
    podglad: naSucho ? doGoogle.slice(0, 20) : undefined,
    bledy,
  });
}
