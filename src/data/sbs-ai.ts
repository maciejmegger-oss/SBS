// SBS AI — czysta logika zakładki i karty na dashboardzie (bez przeglądarki, bez bazy).
//
// Dane przychodzą z zaplecza asystenta (api/raport-dzienny.js, api/agent.js), patrz AI-PRACOWNIK.md:
//   scouting:raport_dzienny     — ostatni raport dzienny (sbs_kv),
//   scouting:zadania_scoutingowe — zadania ustawione przez agenta (sbs_kv),
//   scouting:ai_dziennik        — dziennik zapisów agenta (sbs_kv),
//   sbs_observations            — PROPOZYCJE ocen: scout „SBS AI", stats_filled_in = false.
// Ten plik niczego nie importuje, żeby dało się go uruchomić w teście (scripts/test-sbs-ai.mjs).

export const KLUCZ_RAPORTU = "scouting:raport_dzienny";
export const KLUCZ_ZADAN = "scouting:zadania_scoutingowe";
export const KLUCZ_DZIENNIKA = "scouting:ai_dziennik";
export const AUTOR_AI = "SBS AI";
// Tym znacznikiem zaczyna się notatka propozycji (api/_agent-narzedzia.js, zaktualizuj_ocene).
export const ZNACZNIK_PROPOZYCJI = "[SBS AI – PROPOZYCJA do potwierdzenia przez skauta]";

export const OCENY_KLUCZE = ["technika", "taktyka", "motoryka", "mentalnosc", "potencjal"] as const;
export const OCENY_ETYKIETY: Record<string, string> = {
  technika: "Technika", taktyka: "Taktyka", motoryka: "Motoryka", mentalnosc: "Mentalność", potencjal: "Potencjał",
};

export interface WierszObserwacji {
  id: string; player_id?: string | null; date?: string | null; match?: string | null; scout?: string | null;
  ratings?: Record<string, number> | null; recommendation?: string | null; notes?: string | null;
  stats_filled_in?: boolean | null;
}

export interface Propozycja {
  id: string; playerId: string; data: string; mecz: string;
  oceny: Record<string, number>; srednia: number | null; uzasadnienie: string; wiersz: WierszObserwacji;
}

/** Czy wiersz to czekająca propozycja agenta (a nie zwykła obserwacja ani już rozstrzygnięta). */
export function czyPropozycja(w: WierszObserwacji): boolean {
  return w.scout === AUTOR_AI && !w.stats_filled_in && String(w.notes || "").startsWith(ZNACZNIK_PROPOZYCJI);
}

export function mapujPropozycje(wiersze: WierszObserwacji[]): Propozycja[] {
  return wiersze.filter(czyPropozycja).map((w) => {
    const oceny: Record<string, number> = {};
    for (const k of OCENY_KLUCZE) { const v = Number(w.ratings && w.ratings[k]); if (v > 0) oceny[k] = v; }
    const wart = Object.values(oceny);
    return {
      id: w.id, playerId: String(w.player_id || ""), data: String(w.date || ""), mecz: String(w.match || ""),
      oceny, srednia: wart.length ? Math.round((wart.reduce((a, b) => a + b, 0) / wart.length) * 10) / 10 : null,
      uzasadnienie: String(w.notes || "").slice(ZNACZNIK_PROPOZYCJI.length).trim(), wiersz: w,
    };
  }).sort((a, b) => b.data.localeCompare(a.data));
}

/** Notatka po decyzji skauta: znacznik propozycji zastępuje wpis, kto i kiedy rozstrzygnął. */
export function notatkaPoDecyzji(notatka: string, decyzja: "potwierdzona" | "odrzucona", kto: string, dzien: string): string {
  const reszta = String(notatka || "").startsWith(ZNACZNIK_PROPOZYCJI) ? String(notatka).slice(ZNACZNIK_PROPOZYCJI.length).trim() : String(notatka || "");
  const znacznik = decyzja === "potwierdzona"
    ? `[SBS AI – ocena potwierdzona przez ${kto || "skauta"}, ${dzien}]`
    : `[SBS AI – propozycja ODRZUCONA przez ${kto || "skauta"}, ${dzien}]`;
  return `${znacznik} ${reszta}`.trim();
}

export interface RaportAi {
  data?: string; maProfil?: boolean; wiadomosc?: string; ostrzezenie?: string;
  nowi?: ZawodnikRaportu[]; ranking?: ZawodnikRaportu[]; rankingBazy?: ZawodnikRaportu[];
  zBazyDoObserwacji?: number; zBazyLista?: ZawodnikRaportu[];
  uzupelnienie?: { uzupelnieni: number; doRecznegoWskazania: string[]; bledy: string[]; sprawdzeni: number } | null;
}
export interface ZawodnikRaportu {
  id: string; nazwa: string; pozycja?: string | null; rocznik?: number | null; wynik: number;
  spelniaProfil?: boolean; wymagaObserwacji?: boolean; potencjalTransferowy?: boolean; brakDanych?: boolean;
  powodyObserwacji?: string[]; braki?: string[]; niezgodne?: string[]; ocenaSrednia?: number | null;
}

/** Cztery liczby z wiadomości na telefon — te same, które agent wysyła. */
export function podsumowanieRaportu(r: RaportAi | null) {
  const nowi = (r && r.nowi) || [];
  return {
    nowi: nowi.length,
    spelnia: nowi.filter((x) => x.spelniaProfil).length,
    doObserwacji: nowi.filter((x) => x.wymagaObserwacji).length,
    potencjal: nowi.filter((x) => x.potencjalTransferowy).length,
    brakDanych: nowi.filter((x) => x.brakDanych).length,
    zBazy: (r && r.zBazyDoObserwacji) || 0,
  };
}

export interface Zadanie {
  id: string; opis: string; status: string; termin?: string | null; priorytet?: string; przypisany?: string | null;
  zawodnik_id?: string | null; mecz?: string | null; utworzono?: string;
}
export const STATUSY_ZADAN = ["otwarte", "w_toku", "zrobione", "anulowane"];
const WAGA_PRIORYTETU: Record<string, number> = { wysoki: 0, normalny: 1, niski: 2 };

/** Zadania niezamknięte: najpierw wysoki priorytet, potem bliższy termin, potem starsze. */
export function zadaniaOtwarte(lista: Zadanie[] | null): Zadanie[] {
  return (lista || []).filter((z) => z.status === "otwarte" || z.status === "w_toku").sort((a, b) =>
    (WAGA_PRIORYTETU[a.priorytet || "normalny"] ?? 1) - (WAGA_PRIORYTETU[b.priorytet || "normalny"] ?? 1)
    || String(a.termin || "9999").localeCompare(String(b.termin || "9999"))
    || String(a.utworzono || "").localeCompare(String(b.utworzono || "")));
}

/** Zmiana statusu jednego zadania; zwraca nową listę albo null, gdy zadania nie ma / status jest zły. */
export function ustawStatusZadania(lista: Zadanie[], id: string, status: string, teraz: string): Zadanie[] | null {
  if (!STATUSY_ZADAN.includes(status)) return null;
  const z = lista.find((x) => x.id === id);
  if (!z) return null;
  return lista.map((x) => (x.id === id ? { ...x, status, zmieniono: teraz } as Zadanie : x));
}

/** „2026-10-06T06:00:12Z" → „06.10.2026 06:00" (czas lokalny przeglądarki). */
export function pokazCzas(iso: string | undefined | null): string {
  const t = Date.parse(String(iso || ""));
  if (!Number.isFinite(t)) return "—";
  const d = new Date(t), p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Raport niezależnie od pory ma datę dnia; cron idzie codziennie, więc starszy niż 2 dni znaczy awarię. */
export function raportNieswiezy(r: RaportAi | null, teraz: Date): boolean {
  const t = Date.parse(String((r && r.data) || ""));
  return !Number.isFinite(t) || teraz.getTime() - t > 2 * 86400000;
}
