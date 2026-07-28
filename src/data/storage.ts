// Warstwa dostępu do Supabase — bezpośredni klient npm, bez ukrytego iframe/postMessage.
// W oryginalnym pliku (legacy/scouting_app_original.html) ta sama logika (mapowanie
// kolekcja->tabela, camelCase<->snake_case, batchowy upsert, usuwanie różnicy) była
// wykonywana wewnątrz ukrytej ramki, bo samo wczytanie supabase-js na stronie psuło
// natywny window.storage Claude.ai. Tutaj tego ograniczenia nie ma.
//
// Interfejs get/set/delete jest CELOWO taki sam jak dawne window.storage, żeby reszta
// kodu (przeniesiona do src/main.ts) mogła zostać bez zmian: value to zawsze string JSON,
// serializację/deserializację robi wywołujący (loadAll/save* w main.ts), tak jak wcześniej.

// UWAGA: klient Supabase pochodzi teraz ze wspólnego modułu (./supabase). Wcześniej
// ten plik tworzył własny przez createClient() — po dodaniu logowania byłyby to dwie
// niezależne sesje i zapytania o dane szłyby bez tokenu zalogowanego użytkownika.
import { sb } from "./supabase";
import { getOrgId } from "./session";
import type { ClubCrestMap } from "../types";

const COLLECTION_TABLES: Record<string, string> = {
  "scouting:players": "sbs_players",
  "scouting:clubs": "sbs_clubs",
  "scouting:observations": "sbs_observations",
  "scouting:reports": "sbs_reports",
  "scouting:talents": "sbs_talents",
  "scouting:contacts": "sbs_contacts",
  // UWAGA: "scouting:matches" celowo NIE ma tu wpisu. Tabela sbs_matches figuruje w
  // supabase/schema.sql, ale w bazie nie istnieje — migracji nigdy nie uruchomiono, więc każdy
  // zapis terminarza kończył się błędem "Could not find the table 'public.sbs_matches'" i mecze
  // przepadały. Bez wpisu terminarz idzie ścieżką sbs_kv (jeden rekord JSON), tak samo jak
  // ustawienia czy mapa pozycji — działa od razu, bez migracji.
  // Gdy tabela zostanie kiedyś założona (wykonanie schema.sql), wystarczy przywrócić tu linię
  // "scouting:matches": "sbs_matches" — reszta kodu jest na to gotowa.
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
  // org_id pomijamy tak samo jak updated_at — to kolumna techniczna (do której
  // organizacji należy wiersz), a nie pole zawodnika czy obserwacji. Przy zapisie
  // stemplujemy ją na nowo z profilu zalogowanego użytkownika.
  for (const k in row) if (k !== "updated_at" && k !== "org_id") obj[snakeToCamel(k)] = row[k];
  return obj;
};

// Pola, dla których kolumny w Supabase mogą jeszcze nie istnieć (migracja niewykonana). Zamiast
// tracić te dane przy zapisie, chowamy je w ISTNIEJĄCEJ kolumnie jsonb danej tabeli pod kluczem
// `__ext`. Dzięki temu np. profil zawodnika (opis końcowy, asysty, narodowość, historia
// transferowa, monitoring, kartki) i dystans obserwacji zapisują się OD RAZU, bez żadnej migracji
// ani działań użytkownika. Przy odczycie wyciągamy je z powrotem na wierzch obiektu.
// hostField = nazwa (camelCase) jsonb-owego pola w tej tabeli, do którego chowamy `__ext`.
const EXT_CONFIG: Record<string, { hostField: string; fields: string[] }> = {
  sbs_players: {
    hostField: "customFields",
    fields: [
      "assists", "instagramLink", "facebookLink", "kadraWojewodzka", "reprezentacja",
      "powolania", "opisKoncowy", "monitored", "transferHistory", "nationality",
      "yellowCards", "redCards", "watchlistRemoved", "hasContract", "contractUntil",
      "statsUpdatedAt", "statsSource", "statsSeason",
    ],
  },
  sbs_observations: {
    // sbs_observations nie ma osobnej kolumny custom_fields — używamy istniejącej `ratings` (jsonb).
    hostField: "ratings",
    fields: ["startLocation", "distanceKm"],
  },
};

function packExt(table: string, item: Record<string, unknown>): Record<string, unknown> {
  const cfg = EXT_CONFIG[table];
  if (!cfg) return item;
  const clone: Record<string, unknown> = { ...item };
  const ext: Record<string, unknown> = {};
  for (const f of cfg.fields) {
    if (f in clone && clone[f] !== undefined) ext[f] = clone[f];
    delete clone[f];
  }
  const host: Record<string, unknown> = { ...((clone[cfg.hostField] as Record<string, unknown>) || {}) };
  if (Object.keys(ext).length) host.__ext = ext; else delete host.__ext;
  clone[cfg.hostField] = host;
  return clone;
}

function liftExt(table: string, obj: Record<string, unknown>): void {
  const cfg = EXT_CONFIG[table];
  if (!cfg) return;
  const host = obj[cfg.hostField] as Record<string, unknown> | undefined;
  if (host && host.__ext) {
    const ext = host.__ext as Record<string, unknown>;
    for (const k in ext) if (obj[k] === undefined || obj[k] === null) obj[k] = ext[k];
    delete host.__ext;
  }
}

// Supabase/PostgREST zwraca maksymalnie 1000 wierszy na żądanie. Przy >1000 zawodników brakująca
// paginacja powodowała, że aplikacja wczytywała tylko część bazy (migawka niepełna) — a to, w parze
// z dawnym "usuwaniem różnicy" w setCollection, kasowało nadmiarowych zawodników przy kolejnym zapisie.
// Dlatego wczytujemy WSZYSTKIE wiersze stronami po 1000, aż strona wróci niepełna.
async function getCollection(table: string): Promise<string> {
  const PAGE = 1000;
  const orgId = getOrgId();
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    // Filtr po organizacji jest tu jawnie, mimo że po zamknięciu reguł dostępu
    // (rls_authenticated.sql) baza i tak nie odda cudzych wierszy. Dublowanie jest
    // celowe: dopóki reguły są otwarte, to jedyne, co rozdziela dane klientów.
    let q = sb.from(table).select("*").range(from, from + PAGE - 1);
    if (orgId) q = q.eq("org_id", orgId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const batch = data || [];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  const objs = all.map(objFromRow);
  objs.forEach((o) => liftExt(table, o));
  return JSON.stringify(objs);
}

async function setCollection(table: string, jsonValue: string): Promise<void> {
  const items: Record<string, unknown>[] = JSON.parse(jsonValue || "[]");
  const prepared = items.map((it) => packExt(table, it));
  const orgId = getOrgId();
  const rows = prepared.map((it) => {
    const row = rowFromObj(it);
    // Każdy zapisywany wiersz dostaje org_id zalogowanego użytkownika. Bez tego
    // reguła `with check` odrzuciłaby zapis jako próbę dopisania do cudzej organizacji.
    if (orgId) row.org_id = orgId;
    return row;
  });
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
  // UWAGA: setCollection TYLKO dopisuje/aktualizuje (upsert) — nigdy nie usuwa rekordów, których
  // nie ma w przekazanej tablicy. Wcześniej robiła to przez "różnicę" (usuń z bazy to, czego nie
  // ma w bieżącym stanie), co jest ZASADNICZO niebezpieczne: stan w pamięci przeglądarki (DB.*)
  // to migawka z chwili wczytania strony. Jeśli w międzyczasie ktokolwiek inny (drugi scout,
  // inna karta, import zrobiony bezpośrednio w Supabase) dopisał rekordy do tej samej tabeli,
  // to każdy KOLEJNY zapis z tej "starej" karty — nawet dodanie jednego nowego zawodnika czy
  // zmiana jednego pola — kasował WSZYSTKO, czego nie było w tej starej migawce. Dokładnie to
  // ucięło zawodników z Ekstraklasy/II ligi/Korony Kielce. Usuwanie pojedynczego rekordu musi
  // być JAWNE — patrz deleteCollectionItem() / storage.deleteItem() poniżej.
}

async function deleteCollectionItem(table: string, id: string): Promise<void> {
  const orgId = getOrgId();
  let q = sb.from(table).delete().eq("id", id);
  if (orgId) q = q.eq("org_id", orgId);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

async function getClubCrests(): Promise<string> {
  const orgId = getOrgId();
  let q = sb.from("sbs_club_crests").select("club_id, data_url");
  if (orgId) q = q.eq("org_id", orgId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const map: ClubCrestMap = {};
  (data || []).forEach((r: { club_id: string; data_url: string }) => {
    map[r.club_id] = r.data_url;
  });
  return JSON.stringify(map);
}

async function setClubCrests(jsonValue: string): Promise<void> {
  const map: ClubCrestMap = JSON.parse(jsonValue || "{}");
  const orgId = getOrgId();
  const rows = Object.keys(map).map((clubId) => ({
    club_id: clubId,
    data_url: map[clubId],
    ...(orgId ? { org_id: orgId } : {}),
  }));
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
    // Klucz główny sbs_kv to teraz para (org_id, key) — dwie organizacje mogą mieć
    // własne ustawienia pod tą samą nazwą klucza, bez nadpisywania się nawzajem.
    const orgId = getOrgId();
    let q = sb.from("sbs_kv").select("value").eq("key", key);
    if (orgId) q = q.eq("org_id", orgId);
    const { data, error } = await q.maybeSingle();
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
    const orgId = getOrgId();
    const row: Record<string, string> = { key, value };
    if (orgId) row.org_id = orgId;
    const { error } = await sb
      .from("sbs_kv")
      .upsert(row, { onConflict: orgId ? "org_id,key" : "key" });
    if (error) throw new Error(error.message);
    return { key, value, shared };
  },

  async delete(key: string, shared?: boolean): Promise<{ key: string; deleted: true; shared?: boolean }> {
    const orgId = getOrgId();
    let q = sb.from("sbs_kv").delete().eq("key", key);
    if (orgId) q = q.eq("org_id", orgId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { key, deleted: true, shared };
  },

  // JAWNE usunięcie POJEDYNCZEGO rekordu z kolekcji (np. gdy użytkownik kliknie "usuń" przy
  // zawodniku/klubie/obserwacji). To jedyna droga usuwania rekordów — zapisy (set) nigdy nie kasują.
  async deleteItem(key: string, id: string): Promise<{ key: string; id: string; deleted: true }> {
    const table = COLLECTION_TABLES[key];
    if (!table) throw new Error("Kolekcja bez tabeli: " + key);
    await deleteCollectionItem(table, id);
    return { key, id, deleted: true };
  },
};
