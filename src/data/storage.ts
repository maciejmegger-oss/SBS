// Warstwa dostępu do Supabase — bezpośredni klient npm, bez ukrytego iframe/postMessage.
// W oryginalnym pliku (legacy/scouting_app_original.html) ta sama logika (mapowanie
// kolekcja->tabela, camelCase<->snake_case, batchowy upsert, usuwanie różnicy) była
// wykonywana wewnątrz ukrytej ramki, bo samo wczytanie supabase-js na stronie psuło
// natywny window.storage Claude.ai. Tutaj tego ograniczenia nie ma.
//
// Interfejs get/set/delete jest CELOWO taki sam jak dawne window.storage, żeby reszta
// kodu (przeniesiona do src/main.ts) mogła zostać bez zmian: value to zawsze string JSON,
// serializację/deserializację robi wywołujący (loadAll/save* w main.ts), tak jak wcześniej.

import { createClient } from "@supabase/supabase-js";
import type { ClubCrestMap } from "../types";

const sb = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

const COLLECTION_TABLES: Record<string, string> = {
  "scouting:players": "sbs_players",
  "scouting:clubs": "sbs_clubs",
  "scouting:observations": "sbs_observations",
  "scouting:reports": "sbs_reports",
  "scouting:talents": "sbs_talents",
  "scouting:contacts": "sbs_contacts",
};

const BATCH_SIZE = 200; // wsad zapisu na jedno zapytanie — unika przekroczenia limitu czasu

const camelToSnake = (k: string) => k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
const snakeToCamel = (k: string) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const rowFromObj = (obj: Record<string, unknown>): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  for (const k in obj) row[camelToSnake(k)] = obj[k];
  return row;
};

const objFromRow = (row: Record<string, unknown>): Record<string, unknown> => {
  const obj: Record<string, unknown> = {};
  for (const k in row) if (k !== "updated_at") obj[snakeToCamel(k)] = row[k];
  return obj;
};

async function getCollection(table: string): Promise<string> {
  const { data, error } = await sb.from(table).select("*");
  if (error) throw new Error(error.message);
  return JSON.stringify((data || []).map(objFromRow));
}

async function setCollection(table: string, jsonValue: string): Promise<void> {
  const items: Record<string, unknown>[] = JSON.parse(jsonValue || "[]");
  const rows = items.map(rowFromObj);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    let chunk = rows.slice(i, i + BATCH_SIZE);
    if (!chunk.length) continue;
    // To jeden wsad obejmujący WSZYSTKICH zawodników (całościowy upsert) — jedno pole spoza
    // aktualnego schematu Supabase (np. `nationality` przed uruchomieniem migracji) nie może
    // blokować zapisu reszty. Supabase-js zgłasza brakującą kolumnę na dwa różne sposoby zależnie
    // od ścieżki (surowy Postgres 42703 "column X.Y does not exist", albo PostgREST z cache schematu
    // "Could not find the 'Y' column of 'X' in the schema cache") — sprawdzamy oba warianty.
    for (;;) {
      const { error } = await sb.from(table).upsert(chunk, { onConflict: "id" });
      if (!error) break;
      const missing =
        error.message.match(/column [\w".]*\.(\w+) does not exist/) ||
        error.message.match(/Could not find the '(\w+)' column/);
      if (!missing) throw new Error("Wsad " + (i / BATCH_SIZE + 1) + ": " + error.message);
      const col = missing[1];
      console.warn(`Kolumna "${col}" nie istnieje jeszcze w ${table} (migracja niewykonana) — pomijam to pole w tym zapisie.`);
      chunk = chunk.map((r) => {
        const rest = { ...r };
        delete rest[col];
        return rest;
      });
    }
  }
  // Usuń z bazy rekordy, których już nie ma w bieżącej tablicy (np. usunięty zawodnik).
  const currentIds = items.map((it) => it.id).filter(Boolean);
  const { data: existing, error: exErr } = await sb.from(table).select("id");
  if (exErr) throw new Error(exErr.message);
  const toDelete = (existing || [])
    .map((r: { id: string }) => r.id)
    .filter((id: string) => !currentIds.includes(id));
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const chunk = toDelete.slice(i, i + BATCH_SIZE);
    const { error } = await sb.from(table).delete().in("id", chunk);
    if (error) throw new Error("Usuwanie: " + error.message);
  }
}

async function getClubCrests(): Promise<string> {
  const { data, error } = await sb.from("sbs_club_crests").select("club_id, data_url");
  if (error) throw new Error(error.message);
  const map: ClubCrestMap = {};
  (data || []).forEach((r: { club_id: string; data_url: string }) => {
    map[r.club_id] = r.data_url;
  });
  return JSON.stringify(map);
}

async function setClubCrests(jsonValue: string): Promise<void> {
  const map: ClubCrestMap = JSON.parse(jsonValue || "{}");
  const rows = Object.keys(map).map((clubId) => ({ club_id: clubId, data_url: map[clubId] }));
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    if (!chunk.length) continue;
    const { error } = await sb.from("sbs_club_crests").upsert(chunk, { onConflict: "club_id" });
    if (error) throw new Error(error.message);
  }
}

export interface StorageEntry {
  key: string;
  value: string;
  shared?: boolean;
}

export const storage = {
  async get(key: string, shared?: boolean): Promise<StorageEntry | null> {
    if (key === "scouting:club_crests") {
      return { key, value: await getClubCrests(), shared };
    }
    const table = COLLECTION_TABLES[key];
    if (table) {
      return { key, value: await getCollection(table), shared };
    }
    const { data, error } = await sb.from("sbs_kv").select("value").eq("key", key).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { key, value: data.value, shared } : null;
  },

  async set(key: string, value: string, shared?: boolean): Promise<StorageEntry> {
    if (key === "scouting:club_crests") {
      await setClubCrests(value);
      return { key, value, shared };
    }
    const table = COLLECTION_TABLES[key];
    if (table) {
      await setCollection(table, value);
      return { key, value, shared };
    }
    const { error } = await sb.from("sbs_kv").upsert({ key, value }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { key, value, shared };
  },

  async delete(key: string, shared?: boolean): Promise<{ key: string; deleted: true; shared?: boolean }> {
    const { error } = await sb.from("sbs_kv").delete().eq("key", key);
    if (error) throw new Error(error.message);
    return { key, deleted: true, shared };
  },
};
