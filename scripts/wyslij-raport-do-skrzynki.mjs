// WYSYŁKA GOTOWEGO RAPORTU DO SKRZYNKI W SBS
//
// Raport przygotowany poza aplikacją (analiza nagrania) trafia do tabeli sbs_raport_inbox, a skaut
// wczytuje go w zakładce „Raporty" jednym kliknięciem. Dopisywanie idzie kluczem publicznym
// (VITE_SUPABASE_ANON_KEY z .env) — regułą bazy anon może tylko DOPISAĆ wpis ze statusem 'nowy',
// nie czyta i nie zmienia niczego innego. Patrz supabase/migration_2026-09-29_skrzynka_raportow.sql.
//
// UŻYCIE
//   node scripts/wyslij-raport-do-skrzynki.mjs <plik-raportu.json>
//
// PLIK RAPORTU (JSON)
//   {
//     "zawodnik": "Leśniak-Paduch Nikodem — Ruch Chorzów",   // podpis na liście
//     "tytul":    "Ruch Chorzów – Miedź Legnica 0:2, 02.08.2026",
//     "zrodlo":   "Claude — analiza wideo",
//     "playerId": "<id z kartoteki albo null>",
//     "dane": { date, scout, obsType, rywal, wynik, minutyObejrzane, pozycjaWMeczu,
//               mocne, doPoprawy, technika, taktyka, motoryka, mentalnoscOpis, potencjalOpis,
//               perspektywa, phases, setPieces, setPieceComment, description, status }
//   }

import fs from "node:fs";
import path from "node:path";

const plik = process.argv[2];
if (!plik) {
  console.error("Podaj plik raportu: node scripts/wyslij-raport-do-skrzynki.mjs raport.json");
  process.exit(1);
}

const korzen = path.resolve(new URL(".", import.meta.url).pathname, "..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(korzen, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const URL_BAZY = env.VITE_SUPABASE_URL;
const KLUCZ = env.VITE_SUPABASE_ANON_KEY;
if (!URL_BAZY || !KLUCZ) {
  console.error("Brak VITE_SUPABASE_URL albo VITE_SUPABASE_ANON_KEY w .env");
  process.exit(1);
}

const raport = JSON.parse(fs.readFileSync(plik, "utf8"));
const wiersz = {
  id: raport.id || "IN" + Date.now().toString(36).toUpperCase(),
  zrodlo: raport.zrodlo || "Claude — analiza wideo",
  player_id: raport.playerId || null,
  zawodnik: raport.zawodnik || "",
  tytul: raport.tytul || "",
  dane: raport.dane || {},
  status: "nowy",
};

const odp = await fetch(`${URL_BAZY}/rest/v1/sbs_raport_inbox`, {
  method: "POST",
  headers: {
    apikey: KLUCZ,
    Authorization: `Bearer ${KLUCZ}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify(wiersz),
});

const tresc = await odp.text();
if (!odp.ok) {
  console.error(`Nie udało się wysłać (HTTP ${odp.status}):`, tresc);
  if (odp.status === 404) console.error("Tabela sbs_raport_inbox nie istnieje — uruchom migrację w Supabase.");
  if (odp.status === 401 || odp.status === 403) console.error("Reguła RLS odrzuciła zapis — sprawdź politykę „inbox: dopisywanie z zewnatrz\".");
  process.exit(1);
}

console.log(`Wysłano do skrzynki: ${wiersz.zawodnik || wiersz.id} (${wiersz.tytul})`);
console.log("W SBS: zakładka Raporty → panel „Przygotowane raporty" → Wczytaj do formularza.");
