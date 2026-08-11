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

// Eksportowany, żeby warstwa logowania (src/data/auth.ts) używała TEGO SAMEGO klienta.
// To istotne: po zalogowaniu klient sam dokłada token sesji do każdego zapytania o dane,
// więc reguły dostępu w bazie widzą zalogowanego użytkownika, a nie anonima.
export const sb = createClient(
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

// PUSTE ODWOŁANIE TO NULL, NIE PUSTY TEKST.
//
// Kolumny wskazujące na inną tabelę (player_id, club_id, …) mają w bazie klucz obcy. Aplikacja
// zapisywała „brak wskazania" jako pusty ciąg — a pusty ciąg to konkretna wartość, więc Postgres
// szukał rekordu o identyfikatorze "" i odrzucał zapis błędem 23503. Skutki były dotkliwe i
// niewidoczne: obserwacja ZESPOŁU (bez wskazanego zawodnika) nie dawała się zapisać nigdy, a że
// cała kolekcja idzie jednym wsadem, JEDEN taki wiersz przewracał zapis wszystkich pozostałych.
// Ten sam problem dotyczył zawodnika bez klubu.
//
// Zamiana robiona jest tutaj, w jednym miejscu na całą warstwę zapisu, żeby nie dało się jej
// obejść przypadkiem z poziomu widoku. Klucz główny `id` zostaje nietknięty.
const rowFromObj = (obj: Record<string, unknown>): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  for (const k in obj) {
    const kolumna = camelToSnake(k);
    const wartosc = obj[k];
    row[kolumna] = kolumna.endsWith("_id") && wartosc === "" ? null : wartosc;
  }
  return row;
};

const objFromRow = (row: Record<string, unknown>): Record<string, unknown> => {
  const obj: Record<string, unknown> = {};
  for (const k in row) if (k !== "updated_at") obj[snakeToCamel(k)] = row[k];
  return obj;
};

// Pola, dla których kolumny w Supabase mogą jeszcze nie istnieć (migracja niewykonana). Zamiast
// tracić te dane przy zapisie, chowamy je w ISTNIEJĄCEJ kolumnie jsonb danej tabeli pod kluczem
// `__ext`. Dzięki temu np. profil zawodnika (opis końcowy, asysty, narodowość, historia
// transferowa, monitoring, kartki) i dystans obserwacji zapisują się OD RAZU, bez żadnej migracji
// ani działań użytkownika. Przy odczycie wyciągamy je z powrotem na wierzch obiektu.
// hostField = nazwa (camelCase) jsonb-owego pola w tej tabeli, do którego chowamy `__ext`.
// Eksportowane, bo panel mobilny (src/mobile/db.ts) zapisuje te same wiersze WŁASNĄ ścieżką
// (pojedynczy upsert zamiast całej kolekcji) i musi chować pola dokładnie tam samo. Własna
// kopia tej listy po jednej stronie rozjechałaby się przy pierwszym nowym polu — a wtedy pole
// spoza listy poleciałoby jako nieistniejąca kolumna i zapis z telefonu przestałby przechodzić.
export const EXT_CONFIG: Record<string, { hostField: string; fields: string[] }> = {
  sbs_players: {
    hostField: "customFields",
    fields: [
      "assists", "instagramLink", "facebookLink", "kadraWojewodzka", "reprezentacja",
      "powolania", "opisKoncowy", "monitored", "transferHistory", "nationality",
      "yellowCards", "redCards", "watchlistRemoved", "hasContract", "contractUntil",
      "statsUpdatedAt", "statsSource", "statsSeason",
      // Skąd i kiedy wzięliśmy informację o menedżerze. Bez tego nie da się odróżnić „sprawdzone,
      // Transfermarkt nikogo nie podaje" od „nikt tego jeszcze nie sprawdzał" — a to dla agencji
      // dwie zupełnie różne informacje.
      "agentSource", "agentCheckedAt",
      // Powiązanie z agencją i konkretnym menedżerem (zakładka Menedżerowie). Trzymamy same
      // identyfikatory — nazwa agencji zmienia się przy fuzjach i zmianach szyldu, a wtedy
      // wystarczy poprawić ją w JEDNYM miejscu, zamiast w każdym zawodniku z osobna.
      "agencyId", "agentId",
      // Mecze już rozliczone z protokołu PZPN. Statystyki SUMUJĄ się przy każdym wczytaniu,
      // więc bez tej listy ponowne wgranie tego samego protokołu policzyłoby wszystko drugi raz.
      "rozliczoneMecze",
      // Statystyki W ROZBICIU NA SEZONY: { "2025/26": {mecze, minuty, gole, ...}, "2026/27": {...} }.
      // Pola matches/minutes/goals na rekordzie pozostają dorobkiem BIEŻĄCEGO sezonu — na nich
      // opiera się cała dotychczasowa aplikacja. Tutaj trzymamy archiwum, żeby odświeżenie
      // z API nie kasowało tego, co zawodnik uzbierał wcześniej.
      "seasonStats",
      // Znacznik młodzieżowca wprost z protokołu PZPN — na ŁNP zawodnik ma przy nazwisku „(M)".
      // Trzymamy go osobno od rocznika, bo w IV lidze rocznika NIE MA skąd wziąć, a to właśnie
      // tam młodzież gra najwięcej. Protokół związkowy jest tu źródłem pewniejszym niż data
      // urodzenia przepisana z czyjegoś profilu.
      "mlodziezowiec",
    ],
  },
  sbs_observations: {
    // sbs_observations nie ma osobnej kolumny custom_fields — używamy istniejącej `ratings` (jsonb).
    hostField: "ratings",
    // skladMeczu: obsada obu drużyn na potrzeby obserwacji online i wideo, razem ze znacznikiem
    // zawodników wyróżniających się. Trzymamy to przy obserwacji, a nie przy meczu, bo to notatka
    // konkretnego skauta z konkretnego oglądania — dwóch obserwatorów może wyróżnić kogo innego.
    // googleEventId MUSI tu być. packExt odtwarza __ext wyłącznie z pól wymienionych na tej
    // liście, więc identyfikator wydarzenia zapisany przez serwer zniknąłby przy pierwszym
    // zapisie obserwacji z przeglądarki — a wtedy synchronizacja zakładałaby w kalendarzu
    // drugie wydarzenie dla tej samej obserwacji.
    // poziomMeczu / warunki / notatkaMeczu: ocena SAMEGO SPOTKANIA, nie zawodnika. Przy jednej
    // obserwacji na mecz to ona jest kontekstem dla wszystkich ocen indywidualnych — poziom rywalizacji
    // i pogoda zmieniają wagę tego, co zawodnik pokazał.
    fields: ["startLocation", "distanceKm", "obsType", "skladMeczu", "googleEventId",
             "poziomMeczu", "warunki", "notatkaMeczu"],
  },
  sbs_reports: {
    // sbs_reports nie ma kolumny custom_fields — chowamy w istniejącej `phases` (jsonb).
    // To bezpieczne: odczyt wyciąga __ext z powrotem na wierzch, więc widok faz gry dostaje
    // czysty obiekt, a nie dodatkowy klucz do pominięcia.
    hostField: "phases",
    // match: opis spotkania przy raporcie MECZOWYM, który z natury nie ma jednego zawodnika.
    //   Bez tego pola lista raportów pokazywałaby go jako „(zawodnik usunięty)".
    // kind: „mecz" albo puste dla raportu indywidualnego — rozróżnienie musi być jawne,
    //   bo brak zawodnika sam w sobie znaczy też „zawodnik skasowany z kartoteki".
    // fromObservationId: z której obserwacji raport powstał — pozwala ponowny zapis tej samej
    //   obserwacji potraktować jako aktualizację zamiast dokładać drugi raport o tym samym.
    fields: ["match", "kind", "fromObservationId"],
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
// Identyfikatory, które przyszły z serwera przy wczytaniu strony. Potrzebne, by odróżnić rekord
// USUNIĘTY w międzyczasie (nie wolno go wskrzeszać) od rekordu NOWO utworzonego w tej sesji
// (trzeba go zapisać). Patrz komentarz w setCollection.
const loadedIds: Record<string, Set<string>> = {};

async function fetchServerIds(table: string): Promise<Set<string>> {
  const PAGE = 1000;
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data || [];
    batch.forEach((r: { id: string }) => ids.add(r.id));
    if (batch.length < PAGE) break;
  }
  return ids;
}

async function getCollection(table: string): Promise<string> {
  const PAGE = 1000;
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data || [];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  const objs = all.map(objFromRow);
  objs.forEach((o) => liftExt(table, o));
  loadedIds[table] = new Set(objs.map((o) => String(o.id)));
  return JSON.stringify(objs);
}

async function setCollection(table: string, jsonValue: string): Promise<void> {
  const wszystkie: Record<string, unknown>[] = JSON.parse(jsonValue || "[]");

  // NIE WSKRZESZAMY rekordów usuniętych w międzyczasie.
  //
  // Zapis wysyła całą tablicę z pamięci przeglądarki — migawkę z chwili wczytania strony. Jeśli
  // w tym czasie ktoś (druga karta, porządki w bazie) usunął rekord, ślepy upsert wstawiał go
  // z powrotem. Tak wracały zduplikowane kluby, skasowane statystyki i puste wpisy — za każdym
  // razem wyglądało to jak „samo się przywróciło".
  //
  // Rozróżnienie jest proste: rekord, który BYŁ wczytany z serwera, a teraz go tam nie ma, został
  // usunięty celowo — pomijamy go. Rekord, którego nie było przy wczytaniu, powstał w tej sesji —
  // zapisujemy normalnie.
  let items = wszystkie;
  const znaneZWczytania = loadedIds[table];
  if (znaneZWczytania && znaneZWczytania.size) {
    const naSerwerze = await fetchServerIds(table);
    const pominiete: string[] = [];
    items = wszystkie.filter((it) => {
      const id = String(it.id);
      if (znaneZWczytania.has(id) && !naSerwerze.has(id)) { pominiete.push(id); return false; }
      return true;
    });
    if (pominiete.length) {
      console.info(`${table}: pomijam ${pominiete.length} rekordów usuniętych w międzyczasie — nie przywracam ich.`);
    }
  }

  const prepared = items.map((it) => packExt(table, it));
  const rows = prepared.map(rowFromObj);

  // Jeden wsad. Wydzielone z pętli, żeby wsady mogły lecieć RÓWNOLEGLE — obsługa braku kolumny
  // musi zostać per wsad, bo dotyczy konkretnego zestawu wierszy.
  const zapiszWsad = async (nrWsadu: number, wiersze: Record<string, unknown>[]) => {
    let chunk = wiersze;
    // Jedno pole spoza aktualnego schematu Supabase (np. `nationality` przed uruchomieniem
    // migracji) nie może blokować zapisu reszty. Supabase-js zgłasza brakującą kolumnę na dwa
    // różne sposoby zależnie od ścieżki (surowy Postgres 42703 "column X.Y does not exist", albo
    // PostgREST z cache schematu "Could not find the 'Y' column of 'X'") — sprawdzamy oba.
    for (;;) {
      const { error } = await sb.from(table).upsert(chunk, { onConflict: "id" });
      if (!error) return;
      const missing =
        error.message.match(/column [\w".]*\.(\w+) does not exist/) ||
        error.message.match(/Could not find the '(\w+)' column/);
      if (!missing) throw new Error("Wsad " + nrWsadu + ": " + error.message);
      const col = missing[1];
      console.warn(`Kolumna "${col}" nie istnieje jeszcze w ${table} (migracja niewykonana) — pomijam to pole w tym zapisie.`);
      chunk = chunk.map((r) => {
        const rest = { ...r };
        delete rest[col];
        return rest;
      });
    }
  };

  // WSADY RÓWNOLEGLE, falami po kilka.
  //
  // Wcześniej szły jeden po drugim: przy 4000 zawodników to dwadzieścia jeden przejść tam
  // i z powrotem, każde czekające na poprzednie — zapis potrafił trwać kilkanaście sekund
  // i wyglądał jak zawieszenie. Czas jest tu prawie w całości oczekiwaniem na sieć, więc
  // równoległość skraca go niemal proporcjonalnie.
  //
  // Fala jest ograniczona świadomie: kilkadziesiąt jednoczesnych zapytań do tej samej tabeli
  // potrafi skończyć się odrzuceniem po stronie bazy i wtedy zapis nie udaje się w całości.
  const RÓWNOLEGLE = 6;
  const wsady: Record<string, unknown>[][] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    if (chunk.length) wsady.push(chunk);
  }
  for (let i = 0; i < wsady.length; i += RÓWNOLEGLE) {
    await Promise.all(wsady.slice(i, i + RÓWNOLEGLE).map((w, j) => zapiszWsad(i + j + 1, w)));
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
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Usunięcie WIELU rekordów jednym zapytaniem. Kasowanie po jednym oznaczało tyle żądań, ilu
// zaznaczonych zawodników — przy stu z górą aplikacja wyglądała na zawieszoną. Tniemy na paczki,
// bo identyfikatory idą w adresie URL i zbyt długa lista zostałaby odrzucona.
async function deleteCollectionItems(table: string, ids: string[]): Promise<void> {
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    if (!chunk.length) continue;
    const { error } = await sb.from(table).delete().in("id", chunk);
    if (error) throw new Error(error.message);
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

  // ZAPIS POJEDYNCZEGO REKORDU.
  //
  // set() wysyła CAŁĄ kolekcję: przy 4050 zawodnikach to najpierw zapytanie o wszystkie
  // identyfikatory (~2 s), a potem 21 wsadów po 200 rekordów — łącznie ponad 7 MB. Płacenie tego
  // za skasowanie jednego wpisu w historii transferowej sprawiało, że interfejs wyglądał na
  // zawieszony, a operacja „nie działała", bo trwała kilkanaście sekund.
  //
  // Tutaj idzie jeden rekord i jedno zapytanie. Świadomie NIE ma tu ochrony przed wskrzeszaniem
  // (fetchServerIds) — dotyczy ona zapisu całej migawki; przy celowej zmianie JEDNEGO rekordu,
  // który użytkownik ma właśnie przed sobą, jest zbędna.
  async saveOne(key: string, item: Record<string, unknown>): Promise<boolean> {
    const table = COLLECTION_TABLES[key];
    if (!table) throw new Error("saveOne obsługuje tylko kolekcje tabelowe, nie " + key);
    const row = rowFromObj(packExt(table, item));
    for (;;) {
      const { error } = await sb.from(table).upsert(row, { onConflict: "id" });
      if (!error) return true;
      const missing =
        error.message.match(/column [\w".]*\.(\w+) does not exist/) ||
        error.message.match(/Could not find the '(\w+)' column/);
      if (!missing) throw new Error(error.message);
      delete row[missing[1]];
    }
  },

  async delete(key: string, shared?: boolean): Promise<{ key: string; deleted: true; shared?: boolean }> {
    const { error } = await sb.from("sbs_kv").delete().eq("key", key);
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

  // Zbiorcze usunięcie zaznaczonych rekordów — jedno zapytanie na paczkę zamiast jednego na rekord.
  async deleteItems(key: string, ids: string[]): Promise<{ key: string; count: number; deleted: true }> {
    const table = COLLECTION_TABLES[key];
    if (!table) throw new Error("Kolekcja bez tabeli: " + key);
    await deleteCollectionItems(table, ids);
    return { key, count: ids.length, deleted: true };
  },
};
