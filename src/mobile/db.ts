// Warstwa danych panelu mobilnego.
//
// Różni się celowo od src/data/storage.ts, który obsługuje aplikację na komputerze. Tam zapis
// polega na wysłaniu CAŁEJ kolekcji (migawki z pamięci przeglądarki) i wyliczeniu różnicy —
// sensowne przy pracy na pełnej bazie w jednej karcie. Na telefonie byłoby to szkodliwe:
// scout ma w pamięci wycinek bazy sprzed kilku godzin, a wysłanie go w całości nadpisałoby
// zmiany zrobione w tym czasie na komputerze. Dlatego tutaj każdy zapis dotyczy JEDNEGO wiersza
// (upsert po identyfikatorze) i nigdy nie kasuje niczego, czego sam nie utworzył.
//
// Drugie założenie: brak zasięgu to stan normalny, nie awaria. Na stadionach młodzieżowych sieci
// zwykle nie ma. Każdy zapis ląduje najpierw w pamięci telefonu, a dopiero potem — gdy się da —
// idzie na serwer. Nic nie ginie po zamknięciu przeglądarki ani po rozładowaniu telefonu.

import { sb, EXT_CONFIG } from "../data/storage";
import type { Player, Club, Observation, Report, Match } from "../types";

// Część meczu: 1 i 2 to połowy regulaminowe, 3 i 4 to dogrywka. Doliczonego czasu nie liczymy
// osobno — zegar po prostu biegnie dalej, więc zdarzenie z 47. minuty pierwszej połowy zapisuje
// się jako 47', tak jak podałby je sprawozdawca.
export type Period = 1 | 2 | 3 | 4;

export interface LiveEvent {
  id: string;
  observationId: string;
  playerId?: string;
  half: Period;
  minute: number;
  type: string;      // klucz zdarzenia, np. "strzal"
  label: string;     // etykieta pokazywana scoutowi, np. "Strzał"
  quality: 1 | -1;   // 1 = udane, -1 = nieudane
  // Kogo dotyczy zdarzenie. Zawodnicy ze składu meczu nie mają identyfikatorów w bazie —
  // skład bywa wklejony z kartki albo ze strony meczu — więc zapisujemy nazwę tak, jak
  // widnieje na liście („10 Mosek"). Puste = zdarzenie zespołu.
  zawodnik?: string;
  note?: string;
  createdAt: string;
}

// Zadanie w kolejce wysyłki. Każde jest samodzielne i idempotentne (upsert po id), więc powtórna
// próba po zerwaniu połączenia niczego nie zdubluje.
type QueueJobPayload =
  | { kind: "observation"; row: Record<string, unknown> }
  | { kind: "report"; row: Record<string, unknown> }
  | { kind: "playerStatus"; playerId: string; status: string }
  | { kind: "liveEvents"; observationId: string; events: LiveEvent[] }
  // Skasowanie obserwacji. Jedyne zadanie, które coś z bazy ZABIERA — dlatego powstaje wyłącznie
  // na wyraźne polecenie scouta (przycisk „Usuń" z pytaniem potwierdzającym), nigdy ubocznie.
  | { kind: "usunObserwacje"; observationId: string };

// Zadanie w kolejce ma dodatkowo własny identyfikator, bo kolejka żyje w localStorage: przy każdym
// odczycie powstają NOWE obiekty i wykonanego zadania nie da się rozpoznać po tożsamości obiektu.
type QueueJob = QueueJobPayload & { id: string };

const LS = {
  cache: "sbs-m:cache",          // kopia bazy do pracy offline
  queue: "sbs-m:queue",          // zadania czekające na sieć
  live: "sbs-m:live",            // stan trwającej obserwacji (zdarzenia, zegar)
  archiwum: "sbs-m:zdarzenia",   // zdarzenia zakończonych meczów, wg obserwacji
  scout: "sbs-m:scout",          // ostatnio wybrany scout
};

export const uid = (prefix: string) =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const readLS = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeLS = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Pamięć przeglądarki potrafi się skończyć (limit ~5 MB). Lepiej powiedzieć to głośno
    // w konsoli niż po cichu zgubić zdarzenia z meczu.
    console.error("Nie udało się zapisać w pamięci telefonu:", e);
  }
};

// ---------------------------------------------------------------------------
// Kopia bazy na telefonie
// ---------------------------------------------------------------------------

export interface Cache {
  players: Player[];
  clubs: Club[];
  observations: Observation[];
  reports: Report[];
  // Terminarz z SBS. Leży w sbs_kv, a nie we własnej tabeli (patrz src/data/storage.ts), więc
  // czytamy go tak samo jak ustawienia. Przy meczu zachowane jest pole `competition` — pełna
  // nazwa rozgrywek z 90minut, wraz z grupą, bo III liga ma cztery grupy, a IV liga szesnaście.
  matches: (Match & { competition?: string })[];
  scouts: string[];
  fetchedAt: string | null;
  // Co się NIE pobrało przy ostatnim odświeżeniu, w ludzkich słowach. Bez tego pusta lista
  // wygląda identycznie w dwóch zupełnie różnych sytuacjach: „w bazie faktycznie nic nie ma"
  // i „baza odmówiła dostępu". Scout na trybunie musi wiedzieć, na którą z nich patrzy.
  problemy?: string[];
}

const EMPTY_CACHE: Cache = { players: [], clubs: [], observations: [], reports: [], matches: [], scouts: [], fetchedAt: null, problemy: [] };

export const getCache = (): Cache => readLS<Cache>(LS.cache, EMPTY_CACHE);

// Wylogowanie musi zabrać ze sobą kopię bazy z telefonu. Inaczej „wyloguj się" znaczyłoby tylko
// tyle, że znika przycisk: nazwiska zawodników, kluby i plany zostawały w pamięci urządzenia i
// pokazałyby się pierwszej osobie, która je otworzy. Kolejki wysyłki NIE ruszamy — czeka w niej
// praca scouta, której jeszcze nie przyjęła baza, i skasowanie jej byłoby utratą danych.
export function wyczyscKopieBazy(): void {
  try {
    localStorage.removeItem(LS.cache);
    localStorage.removeItem(LS.live);
    localStorage.removeItem(LS.archiwum);
  } catch {
    /* tryb prywatny bez localStorage — nie ma czego czyścić */
  }
}

const snakeToCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const camelToSnake = (k: string) => k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());

const objFromRow = (row: Record<string, unknown>): Record<string, unknown> => {
  const obj: Record<string, unknown> = {};
  for (const k in row) if (k !== "updated_at") obj[snakeToCamel(k)] = row[k];
  return obj;
};

// Pola dopisane do aplikacji po założeniu bazy nie mają własnych kolumn — aplikacja na komputerze
// chowa je w polu jsonb pod kluczem `__ext` (patrz src/data/storage.ts). Przy odczycie trzeba je
// wyciągnąć na wierzch, przy zapisie — schować z powrotem, inaczej rodzaj obserwacji i punkt
// startowy znikałyby po każdej edycji z telefonu.
//
// Listę bierzemy WPROST z warstwy aplikacji na komputerze, zamiast trzymać tu jej odpowiednik.
// Własna kopia już raz się rozjechała: doszły tam `skladMeczu` i `googleEventId`, o których ten
// plik nie wiedział — a pole spoza listy nie trafia do `__ext`, tylko leci jako osobna kolumna,
// której w tabeli nie ma. Zapis obserwacji z telefonu kończyłby się wtedy błędem i zawieszał
// kolejkę wysyłki, a przy okazji gubił powiązanie z wydarzeniem w Kalendarzu Google.
const OBS_EXT_FIELDS = EXT_CONFIG.sbs_observations.fields;

const liftObsExt = (o: Record<string, unknown>) => {
  const host = o.ratings as Record<string, unknown> | undefined;
  if (host && host.__ext) {
    const ext = host.__ext as Record<string, unknown>;
    for (const k in ext) if (o[k] === undefined || o[k] === null) o[k] = ext[k];
    delete host.__ext;
  }
  return o;
};

const packObsExt = (o: Record<string, unknown>): Record<string, unknown> => {
  const clone = { ...o };
  const ext: Record<string, unknown> = {};
  for (const f of OBS_EXT_FIELDS) {
    if (f in clone && clone[f] !== undefined) ext[f] = clone[f];
    delete clone[f];
  }
  const ratings: Record<string, unknown> = { ...((clone.ratings as Record<string, unknown>) || {}) };
  if (Object.keys(ext).length) ratings.__ext = ext;
  clone.ratings = ratings;
  return clone;
};

const rowFromObj = (obj: Record<string, unknown>): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  for (const k in obj) {
    const col = camelToSnake(k);
    const val = obj[k];
    // Puste odwołanie musi być NULL-em, nie pustym tekstem — inaczej Postgres szuka rekordu
    // o identyfikatorze "" i odrzuca zapis. Dotyczy obserwacji zespołu (bez wskazanego zawodnika).
    row[col] = col.endsWith("_id") && val === "" ? null : val;
  }
  return row;
};

const page = async (table: string, columns = "*"): Promise<Record<string, unknown>[]> => {
  const PAGE = 1000;
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = (data || []) as unknown as Record<string, unknown>[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
};

// Jeden wiersz z sbs_kv. Brak wiersza to `null` BEZ błędu — to normalny stan (czegoś jeszcze nie
// zapisano); błąd bazy leci wyjątkiem, żeby dało się te dwie rzeczy od siebie odróżnić.
async function czytajKv(key: string): Promise<string | null> {
  const { data, error } = await sb.from("sbs_kv").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data as { value: string }).value : null;
}

// Wynik jednego pobrania. Świadomie JEDEN kształt zamiast unii rozróżnianej polem `ok`:
// projekt kompiluje się z wyłączonym `strict`, a bez `strictNullChecks` TypeScript nie zawęża
// typu po takim polu i każde odwołanie do `blad` byłoby błędem kompilacji.
// Puste `blad` = pobranie się udało; `dane === null` przy pustym `blad` = w bazie nic nie ma.
interface Wynik<T> {
  dane: T | null;
  blad: string;
}

const sprobuj = async <T>(fn: () => Promise<T>): Promise<Wynik<T>> => {
  try {
    return { dane: await fn(), blad: "" };
  } catch (e) {
    return { dane: null, blad: (e as Error).message || "nieznany błąd" };
  }
};

// PRACA CZEKAJĄCA W KOLEJCE MUSI PRZEŻYĆ ODŚWIEŻENIE.
//
// Kopia bazy powstaje z tego, co odda serwer. Obserwacja zaplanowana na telefonie bez zasięgu
// jeszcze tam nie dotarła — więc odświeżenie zastępowało ją listą, w której jej nie ma, i plan
// znikał scoutowi z ekranu. Dokładnie stąd brały się DUBLE: obserwacja „przepadała", scout
// planował ją drugi raz, a potem kolejka wysyłała obie i w bazie były dwie tego samego meczu.
//
// Dlatego po złożeniu kopii nakładamy na nią wszystko, co wciąż czeka na wysyłkę. Wersja lokalna
// jest z definicji nowsza od serwerowej — to ona dopiero ma tam pojechać.
function nalozKolejke(c: Cache): void {
  for (const j of getQueue()) {
    if (j.kind === "observation") {
      const obs = liftObsExt(objFromRow(j.row)) as unknown as Observation;
      const i = c.observations.findIndex((o) => o.id === obs.id);
      if (i >= 0) c.observations[i] = obs; else c.observations.push(obs);
    } else if (j.kind === "report") {
      const rep = objFromRow(j.row) as unknown as Report;
      const i = c.reports.findIndex((r) => r.id === rep.id);
      if (i >= 0) c.reports[i] = rep; else c.reports.push(rep);
    } else if (j.kind === "usunObserwacje") {
      // Kasowanie też jeszcze nie dotarło do bazy — skasowana obserwacja nie może wrócić na listę.
      c.observations = c.observations.filter((o) => o.id !== j.observationId);
    }
  }
}

// Pobranie kopii bazy. Wołane po zalogowaniu i z przycisku „Odśwież" — świadomie, a nie przy
// każdym wejściu do widoku, żeby nie zjadać transferu na stadionie.
//
// KAŻDE ŹRÓDŁO OSOBNO. Wcześniej sześć zapytań szło jednym `Promise.all` bez zabezpieczenia:
// wystarczyło, że JEDNO z nich odmówiło (reguły dostępu, uśpiona baza), a całe odświeżenie kończyło
// się wyjątkiem i w telefonie zostawała stara kopia — bez słowa wyjaśnienia. Terminarz miał jeszcze
// gorzej: jego błąd był łykany po cichu i panel pisał „terminarz jest pusty, pobierz go na
// komputerze", choć na komputerze był komplet meczów. Teraz to, co się pobrało, wchodzi do kopii;
// to, co się nie pobrało, zostaje z poprzedniego razu i trafia na listę problemów.
export async function refreshCache(): Promise<Cache> {
  const poprzednia = getCache();
  const problemy: string[] = [];

  const [players, clubs, observations, reports, ustawienia, terminarz] = await Promise.all([
    sprobuj(() => page("sbs_players")),
    sprobuj(() => page("sbs_clubs")),
    sprobuj(() => page("sbs_observations")),
    sprobuj(() => page("sbs_reports")),
    sprobuj(() => czytajKv("scouting:settings")),
    sprobuj(() => czytajKv("scouting:matches")),
  ]);

  const zTabeli = <T>(w: Wynik<Record<string, unknown>[]>, nazwa: string, stare: T[], mapuj: (r: Record<string, unknown>) => unknown): T[] => {
    if (w.blad) { problemy.push(nazwa + ": " + w.blad); return stare; }
    return (w.dane || []).map(mapuj) as T[];
  };

  let scouts = poprzednia.scouts || [];
  if (ustawienia.blad) problemy.push("ustawienia: " + ustawienia.blad);
  else if (ustawienia.dane) {
    try {
      const s = JSON.parse(ustawienia.dane);
      if (s && Array.isArray(s.scouts)) scouts = s.scouts;
    } catch {
      problemy.push("ustawienia: zapis w nieoczekiwanym kształcie");
    }
  }

  // Terminarz leży w sbs_kv pod „scouting:matches" — tam, gdzie zapisuje go aplikacja na komputerze
  // (patrz komentarz przy COLLECTION_TABLES w src/data/storage.ts). Brak wiersza znaczy naprawdę
  // „nikt jeszcze nie pobrał terminarza"; błąd odczytu znaczy coś zupełnie innego i mówimy o tym wprost.
  let matches = poprzednia.matches || [];
  if (terminarz.blad) problemy.push("terminarz: " + terminarz.blad);
  else if (terminarz.dane === null || terminarz.dane === undefined) matches = [];
  else {
    try {
      const surowe = JSON.parse(terminarz.dane);
      if (Array.isArray(surowe)) matches = surowe;
      else problemy.push("terminarz: zapis w nieoczekiwanym kształcie");
    } catch {
      problemy.push("terminarz: zapis w nieoczekiwanym kształcie");
    }
  }

  const cache: Cache = {
    players: zTabeli<Player>(players, "zawodnicy", poprzednia.players, objFromRow),
    clubs: zTabeli<Club>(clubs, "kluby", poprzednia.clubs, objFromRow),
    observations: zTabeli<Observation>(observations, "obserwacje", poprzednia.observations, (r) => liftObsExt(objFromRow(r))),
    reports: zTabeli<Report>(reports, "raporty", poprzednia.reports, objFromRow),
    matches,
    scouts,
    fetchedAt: new Date().toISOString(),
    problemy,
  };
  // PUSTKA BEZ BŁĘDU TO TEŻ OBJAW.
  //
  // Reguły dostępu w Supabase nie odmawiają — one FILTRUJĄ. Konto bez zgody administratora
  // (albo bez wiersza w sbs_konta, jeśli powstało przed wprowadzeniem zgód) dostaje na każde
  // pytanie poprawną odpowiedź: zero wierszy. Dla panelu wygląda to identycznie jak świeża,
  // pusta baza — i właśnie stąd bierze się „nie wgrało meczów z komputera", choć na komputerze
  // jest komplet. Nazywamy to wprost, bo sam scout nie ma jak tego odróżnić.
  const nicNieDoszlo =
    !problemy.length &&
    !cache.players.length && !cache.clubs.length &&
    !cache.observations.length && !cache.reports.length && !cache.matches.length;
  if (nicNieDoszlo) {
    problemy.push(
      "baza oddała zero rekordów — zwykle znaczy to, że konto nie ma jeszcze zgody administratora " +
      "SBS albo zalogowano się na inne konto niż na komputerze",
    );
  }

  nalozKolejke(cache);
  writeLS(LS.cache, cache);
  return cache;
}

// Zmiana zrobiona na telefonie musi być od razu widoczna w kopii lokalnej — inaczej scout
// zapisuje ocenę, wraca do listy i widzi stary stan, co wygląda jak utrata danych.
export function patchCache(fn: (c: Cache) => void): Cache {
  const c = getCache();
  fn(c);
  writeLS(LS.cache, c);
  return c;
}

// ---------------------------------------------------------------------------
// Kolejka wysyłki
// ---------------------------------------------------------------------------

export const getQueue = (): QueueJob[] => readLS<QueueJob[]>(LS.queue, []);
const setQueue = (q: QueueJob[]) => writeLS(LS.queue, q);

export const queueLength = () => getQueue().length;

function enqueue(job: QueueJobPayload) {
  const pelne = { ...job, id: uid("job") } as QueueJob;
  const q = getQueue();
  // Zadania dotyczące tego samego obiektu zastępują się nawzajem — w kolejce ma czekać stan
  // AKTUALNY, a nie historia poprawek. Bez tego trzykrotna zmiana oceny wysyłałaby trzy zapisy.
  const sameTarget = (a: QueueJob, b: QueueJob) => {
    if (a.kind !== b.kind) return false;
    if (a.kind === "observation" && b.kind === "observation") return a.row.id === b.row.id;
    if (a.kind === "report" && b.kind === "report") return a.row.id === b.row.id;
    if (a.kind === "playerStatus" && b.kind === "playerStatus") return a.playerId === b.playerId;
    if (a.kind === "liveEvents" && b.kind === "liveEvents") return a.observationId === b.observationId;
    if (a.kind === "usunObserwacje" && b.kind === "usunObserwacje") return a.observationId === b.observationId;
    return false;
  };
  setQueue([...q.filter((j) => !sameTarget(j, pelne)), pelne]);
}

// Czy tabela zdarzeń na żywo istnieje w bazie? Migracja (supabase/migration_2026-08-06_live_events.sql)
// może nie być jeszcze uruchomiona, a panel ma działać od razu. Gdy tabeli nie ma, oś zdarzeń
// zapisuje się w sbs_kv — tej tabeli używa aplikacja na komputerze do terminarza i ustawień, więc
// istnieje na pewno. Po uruchomieniu migracji nowe mecze zapisują się już właściwą drogą.
let liveEventsTable: boolean | null = null;

async function pushLiveEvents(observationId: string, events: LiveEvent[]): Promise<void> {
  if (liveEventsTable !== false) {
    const rows = events.map((e) => ({
      id: e.id,
      observation_id: observationId,
      player_id: e.playerId || null,
      half: e.half,
      minute: e.minute,
      type: e.type,
      quality: e.quality,
      zawodnik: e.zawodnik || null,
      note: e.note || null,
      created_at: e.createdAt,
    }));
    const { error } = await sb.from("sbs_live_events").upsert(rows, { onConflict: "id" });
    if (!error) {
      liveEventsTable = true;
      return;
    }
    // Brak tabeli to jedyny błąd, który wolno obejść. Każdy inny (np. odmowa dostępu) musi
    // wrócić do kolejki, żeby próba się powtórzyła, zamiast po cichu wylądować w kv.
    // Obejściem obejmujemy też brakującą KOLUMNĘ, nie tylko brakującą tabelę: tabela mogła
    // powstać ze starszej wersji migracji, bez kolumny `zawodnik`, i wtedy zapis kończyłby się
    // błędem przy każdej próbie — a oś zdarzeń z meczu jest zbyt cenna, żeby ją na tym stracić.
    const doObejscia = /relation .* does not exist|could not find the table|schema cache|column .* does not exist/i.test(error.message);
    if (!doObejscia) throw new Error(error.message);
    liveEventsTable = false;
  }
  const { error } = await sb
    .from("sbs_kv")
    .upsert({ key: "scouting:liveEvents:" + observationId, value: JSON.stringify(events) }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

async function runJob(job: QueueJob): Promise<void> {
  if (job.kind === "observation") {
    const { error } = await sb.from("sbs_observations").upsert(job.row, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return;
  }
  if (job.kind === "report") {
    const { error } = await sb.from("sbs_reports").upsert(job.row, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return;
  }
  if (job.kind === "usunObserwacje") {
    const { error } = await sb.from("sbs_observations").delete().eq("id", job.observationId);
    if (error) throw new Error(error.message);
    return;
  }
  if (job.kind === "playerStatus") {
    // Świadomie update, nie upsert: telefon zmienia JEDNO pole istniejącego zawodnika i nie może
    // nadpisać reszty jego profilu wersją z lokalnej kopii, która bywa nieaktualna.
    const { error } = await sb.from("sbs_players").update({ status: job.status }).eq("id", job.playerId);
    if (error) throw new Error(error.message);
    return;
  }
  await pushLiveEvents(job.observationId, job.events);
}

let flushing = false;

// Próba opróżnienia kolejki. Zwraca liczbę zadań, które zostały. Zadania idą po kolei i pierwsze
// niepowodzenie przerywa przetwarzanie — jeśli sieci nie ma, nie ma sensu dobijać się resztą.
//
// Kolejkę czytamy ZE ŹRÓDŁA przed każdym zadaniem i usuwamy wykonane po identyfikatorze, zamiast
// pracować na migawce z początku pętli. Zapis oceny dokłada trzy zadania jedno po drugim
// (obserwacja, raport, status zawodnika) — a wysyłka pierwszego z nich trwa na tyle długo, że
// pozostałe dwa trafiają do kolejki już w trakcie. Odłożenie migawki pomniejszonej o wykonane
// zadanie kasowałoby je bezgłośnie: raport i status nigdy nie docierały do bazy.
export async function flushQueue(): Promise<number> {
  if (flushing) return queueLength();
  if (!navigator.onLine) return queueLength();
  flushing = true;
  try {
    for (;;) {
      const q = getQueue();
      if (!q.length) return 0;
      try {
        await runJob(q[0]);
      } catch (e) {
        console.warn("Wysyłka wstrzymana:", (e as Error).message);
        return getQueue().length;
      }
      setQueue(getQueue().filter((j) => j.id !== q[0].id));
    }
  } finally {
    flushing = false;
  }
}

// ---------------------------------------------------------------------------
// Operacje panelu
// ---------------------------------------------------------------------------

export function saveObservation(obs: Observation): void {
  patchCache((c) => {
    const i = c.observations.findIndex((o) => o.id === obs.id);
    if (i >= 0) c.observations[i] = obs; else c.observations.push(obs);
  });
  enqueue({ kind: "observation", row: rowFromObj(packObsExt(obs as unknown as Record<string, unknown>)) });
  void flushQueue();
}

// USUNIĘCIE OBSERWACJI.
//
// Jedyna operacja panelu, która coś z bazy zabiera. Dlatego wołana wyłącznie z przycisku
// potwierdzonego pytaniem — nigdy jako skutek uboczny czegoś innego.
//
// Zaległe zapisy TEJ obserwacji wyrzucamy z kolejki przed dołożeniem kasowania. Bez tego telefon
// bez zasięgu wysyłałby najpierw upsert, a potem delete — dwa przejścia po sieci po to, żeby
// skończyć w tym samym miejscu. Oś zdarzeń w bazie znika sama (klucz obcy z `on delete cascade`).
export function deleteObservation(id: string): void {
  patchCache((c) => {
    c.observations = c.observations.filter((o) => o.id !== id);
  });
  const bezZaleglych = getQueue().filter(
    (j) => !((j.kind === "observation" && j.row.id === id) || (j.kind === "liveEvents" && j.observationId === id)),
  );
  setQueue(bezZaleglych);
  enqueue({ kind: "usunObserwacje", observationId: id });

  // Sprzątamy też kopię zdarzeń w telefonie — inaczej oś skasowanego meczu zostawałaby w pamięci
  // urządzenia bez niczego, co by ją pokazywało.
  const archiwum = archiwumZdarzen();
  if (archiwum[id]) { delete archiwum[id]; writeLS(LS.archiwum, archiwum); }

  void flushQueue();
}

export function saveReport(rep: Report): void {
  patchCache((c) => {
    const i = c.reports.findIndex((r) => r.id === rep.id);
    if (i >= 0) c.reports[i] = rep; else c.reports.push(rep);
  });
  enqueue({ kind: "report", row: rowFromObj(rep as unknown as Record<string, unknown>) });
  void flushQueue();
}

export function savePlayerStatus(playerId: string, status: string): void {
  patchCache((c) => {
    const p = c.players.find((x) => x.id === playerId);
    if (p) p.status = status;
  });
  enqueue({ kind: "playerStatus", playerId, status });
  void flushQueue();
}

export function saveLiveEvents(observationId: string, events: LiveEvent[]): void {
  if (!events.length) return;
  enqueue({ kind: "liveEvents", observationId, events });
  void flushQueue();
}

// ---------------------------------------------------------------------------
// Stan trwającej obserwacji
// ---------------------------------------------------------------------------
//
// Trzymany osobno od kolejki, bo to nie jest „zapis czekający na sieć", tylko mecz W TRAKCIE.
// Zapisujemy go po każdym dotknięciu kafla: telefon potrafi ubić kartę przeglądarki w tle,
// a scout nie może stracić pierwszej połowy dlatego, że odebrał telefon.

export interface LiveState {
  observationId: string;
  playerId?: string;
  matchLabel: string;
  half: Period;
  seconds: number;         // czas bieżącej części meczu
  running: boolean;
  startedAt: number | null; // znacznik czasu telefonu przy ostatnim starcie zegara
  // Komu przypisują się kolejne zdarzenia (nazwa ze składu). Puste = zespół. Trzymane w stanie
  // meczu, a nie w pamięci widoku, bo wybór ma przetrwać zamknięcie karty w trakcie gry.
  wybranyZawodnik?: string;
  events: LiveEvent[];
}

export const getLive = (): LiveState | null => readLS<LiveState | null>(LS.live, null);
export const setLive = (s: LiveState | null) => (s ? writeLS(LS.live, s) : localStorage.removeItem(LS.live));

// ZDARZENIA ZAKOŃCZONYCH MECZÓW.
//
// Po zapisaniu ocen stan meczu jest kasowany — i razem z nim znikała z telefonu cała oś zdarzeń.
// Dane szły do bazy, ale panel nie miał ich skąd odczytać, więc z perspektywy scouta przepadał
// dorobek całego meczu. Trzymamy je więc osobno, pod identyfikatorem obserwacji, żeby dało się
// do nich wrócić — także bez zasięgu, w drodze powrotnej ze stadionu.
export const archiwumZdarzen = (): Record<string, LiveEvent[]> =>
  readLS<Record<string, LiveEvent[]>>(LS.archiwum, {});

export const zdarzeniaObserwacji = (observationId: string): LiveEvent[] =>
  archiwumZdarzen()[observationId] || [];

export function zarchiwizujZdarzenia(observationId: string, events: LiveEvent[]): void {
  if (!events.length) return;
  const wszystkie = archiwumZdarzen();
  wszystkie[observationId] = events;
  writeLS(LS.archiwum, wszystkie);
}

export const getScout = (): string => localStorage.getItem(LS.scout) || "";
export const setScout = (s: string) => localStorage.setItem(LS.scout, s);
