// Propozycje AI — zapis i odczyt tabeli sbs_ai_propozycje (supabase/migration_2026-10-14_przeplyw_ai.sql).
//
// Tabela powstaje dopiero po uruchomieniu migracji. Do tego czasu każda operacja zwraca czytelny
// komunikat, a nie surowy błąd Postgresa — ekran pokazuje wtedy, co zrobić, i reszta systemu
// działa bez zmian.

import { sb } from "./storage";
import type { Propozycja, Stan, Decyzja } from "../domain/propozycje";

/** Nowa propozycja do dopisania — start obiegu (etap 1), niczego więcej ustawić się nie da. */
export interface NowaPropozycja {
  playerId?: string | null; zawodnik?: string; rodzaj?: string; tresc: string;
  zrodla?: { url: string; opis?: string }[]; pewnosc?: string; model?: string;
}

const TABELA = "sbs_ai_propozycje";

export const brakTabeliPropozycji = (komunikat: string) =>
  /schema cache|does not exist|relation .*sbs_ai_propozycje/i.test(String(komunikat || ""));

const BRAK_TABELI =
  "Baza nie ma jeszcze tabeli propozycji. Uruchom w Supabase skrypt supabase/migration_2026-10-14_przeplyw_ai.sql.";

function blad(e: { message?: string } | null, domyslny: string): string {
  const m = (e && e.message) || "";
  if (brakTabeliPropozycji(m)) return BRAK_TABELI;
  // Komunikaty z wyzwalacza bazy są po polsku i mówią wprost, czego brakuje — pokazujemy je.
  return m || domyslny;
}

function mapuj(r: any): Propozycja {
  return {
    id: r.id, playerId: r.player_id || null, zawodnik: r.zawodnik || "", rodzaj: r.rodzaj || "",
    tresc: r.tresc || "", zrodla: Array.isArray(r.zrodla) ? r.zrodla : [], pewnosc: r.pewnosc || "",
    model: r.model || "", stan: r.stan as Stan,
    skautUwagi: r.skaut_uwagi || "", skautAt: r.skaut_at || "",
    trenerOcena: r.trener_ocena || null, trenerUwagi: r.trener_uwagi || "", trenerAt: r.trener_at || "",
    dyrektorDecyzja: (r.dyrektor_decyzja as Decyzja) || null,
    dyrektorUzasadnienie: r.dyrektor_uzasadnienie || "", dyrektorAt: r.dyrektor_at || "",
    odrzucilPowod: r.odrzucil_powod || "", utworzoneAt: r.utworzone_at || "",
  };
}

export async function listaPropozycji(): Promise<{ lista: Propozycja[]; error?: string }> {
  const { data, error } = await sb.from(TABELA).select("*").order("utworzone_at", { ascending: false }).limit(500);
  if (error) return { lista: [], error: blad(error, "Nie udało się wczytać propozycji.") };
  return { lista: (data || []).map(mapuj) };
}

export async function dodajPropozycje(szkice: NowaPropozycja[]): Promise<string | null> {
  if (!szkice.length) return null;
  const { error } = await sb.from(TABELA).insert(szkice.map((s) => ({
    player_id: s.playerId || null, zawodnik: s.zawodnik || "", rodzaj: s.rodzaj || "kandydat",
    tresc: s.tresc, zrodla: s.zrodla || [], pewnosc: s.pewnosc || null, model: s.model || null,
  })));
  return error ? blad(error, "Nie udało się dopisać propozycji.") : null;
}

async function zmien(id: number, zmiany: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await sb.from(TABELA).update(zmiany).eq("id", id).select("id");
  if (error) return blad(error, "Nie udało się zapisać zmiany.");
  // RLS potrafi odpowiedzieć sukcesem bez zmiany wiersza — wtedy nic się nie zapisało.
  if (!data || !data.length) return "Zmiana nie została zapisana — sprawdź, czy masz uprawnienia do tego etapu.";
  return null;
}

export const weryfikujPropozycje = (id: number, uwagi: string) =>
  zmien(id, { stan: "zweryfikowane_skaut", skaut_uwagi: uwagi });

export const ocenPropozycje = (id: number, ocena: { dopasowanie: number; pozycja: string; komentarz: string }) =>
  zmien(id, { stan: "ocena_trenera", trener_ocena: ocena, trener_uwagi: ocena.komentarz });

export const zdecydujPropozycje = (id: number, decyzja: Decyzja, uzasadnienie: string) =>
  zmien(id, { stan: "decyzja_dyrektora", dyrektor_decyzja: decyzja, dyrektor_uzasadnienie: uzasadnienie });

export const odrzucPropozycje = (id: number, powod: string) =>
  zmien(id, { stan: "odrzucone", odrzucil_powod: powod });
