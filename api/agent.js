// BRAMKA NARZĘDZI ASYSTENTA AI — jedyne miejsce, przez które agent (Claude API, rutyna Claude Code,
// dowolny klient HTTP) czyta i zmienia dane w SBS. Same narzędzia: api/_agent-narzedzia.js.
//
//   GET  /api/agent                      → lista narzędzi w formacie `tools` API Claude
//   POST /api/agent  { "narzedzie": "pobierz_zawodnika", "argumenty": { "id": "p123" } }
//
// DOSTĘP: nagłówek `Authorization: Bearer <token>`.
//   * AGENT_TOKEN          — pełny dostęp (odczyt i zapis).
//   * AGENT_TOKEN_ODCZYT   — opcjonalny; tylko narzędzia czytające. Dobry do agentów, które mają
//                            wyłącznie analizować (np. poranny przegląd), bez prawa zmieniania czegokolwiek.
// Bez ustawionego AGENT_TOKEN bramka jest ZAMKNIĘTA (503) — nie ma trybu „otwarte, bo nie skonfigurowano".
// Funkcja pracuje kluczem serwisowym, który omija reguły bazy, więc token jest jedyną barierą:
// długi, losowy (np. `openssl rand -hex 32`), tylko w zmiennych środowiskowych Vercela.

import crypto from "node:crypto";
import { BAZA, KLUCZ_BAZY, MA_KLUCZ_SERWISOWY } from "./_baza.js";
import { wybierz, wstaw, zmien, czytajKv, zapiszKv } from "./_db.js";
import { definicje, wykonaj } from "./_agent-narzedzia.js";

const rowne = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const pelny = process.env.AGENT_TOKEN, odczyt = process.env.AGENT_TOKEN_ODCZYT;
  if (!pelny) return res.status(503).json({ error: "Bramka agenta jest wyłączona: ustaw AGENT_TOKEN w zmiennych środowiskowych." });

  const podany = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const jestPelny = !!podany && rowne(podany, pelny);
  const jestOdczyt = !!podany && !!odczyt && rowne(podany, odczyt);
  if (!jestPelny && !jestOdczyt) return res.status(401).json({ error: "Brak uprawnień." });

  if (req.method === "GET") return res.status(200).json({ tryb: jestPelny ? "pelny" : "odczyt", narzedzia: definicje() });
  if (req.method !== "POST") return res.status(405).json({ error: "Dozwolone: GET, POST." });

  if (!BAZA || !KLUCZ_BAZY) return res.status(500).json({ error: "Brak konfiguracji bazy." });
  if (!MA_KLUCZ_SERWISOWY) return res.status(500).json({ error: "Brak SUPABASE_SERVICE_KEY — serwer nie widzi zamkniętej bazy (patrz WDROZENIE.md)." });

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body;
  if (!body || typeof body.narzedzie !== "string") return res.status(400).json({ error: "Podaj { narzedzie, argumenty }." });

  try {
    const wynik = await wykonaj(body.narzedzie, body.argumenty ?? {},
      { db: { wybierz, wstaw, zmien, kvGet: czytajKv, kvSet: zapiszKv }, dzis: new Date() },
      { tylkoOdczyt: !jestPelny });
    // Odmowy narzędzi (ok:false) to normalna odpowiedź — agent ma ją przeczytać i zareagować,
    // dlatego 200, a nie błąd HTTP. Kod błędu zostawiamy na awarie bazy.
    return res.status(200).json(wynik);
  } catch (e) {
    return res.status(502).json({ ok: false, powod: "blad_bazy", szczegoly: String((e && e.message) || e) });
  }
}

function safeJson(t) { try { return JSON.parse(t); } catch { return null; } }
