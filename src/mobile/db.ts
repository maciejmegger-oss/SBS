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

import { sb, objFromRow, liftExt, prepareRow, missingColumn } from "../data/storage";
import { pushLiveEvents, type LiveEvent, type Period } from "../data/liveEvents";
import type { Player, Club, Observation, Report } from "../types";

export type { LiveEvent, Period };

// Zadanie w kolejce wysyłki. Każde jest samodzielne i idempotentne (upsert po id), więc powtórna
// próba po zerwaniu połączenia niczego nie zdubluje.
//
// W kolejce leży OBIEKT APLIKACJI, nie gotowy wiersz bazy. Różnica jest praktyczna: wiersz
// składany w chwili dodania do kolejki zamraża sposób pakowania z tamtej wersji panelu, więc
// zapis, który baza odrzuciła z powodu błędu w tym pakowaniu, byłby odrzucany także po poprawce —
// scout musiałby wpisać cały mecz od nowa. Obiekt zamienia się w wiersz dopiero przy wysyłce.
type QueueJobPayload =
  | { kind: "observation"; item: Record<string, unknown> }
  | { kind: "report"; item: Record<string, unknown> }
  | { kind: "playerStatus"; playerId: string; status: string }
  | { kind: "liveEvents"; observationId: string; events: LiveEvent[] };

// Zadanie w kolejce ma dodatkowo własny identyfikator, bo kolejka żyje w localStorage: przy każdym
// odczycie powstają NOWE obiekty i wykonanego zadania nie da się rozpoznać po tożsamości obiektu.
type QueueJob = QueueJobPayload & { id: string };

const LS = {
  cache: "sbs-m:cache",          // kopia bazy do pracy offline
  queue: "sbs-m:queue",          // zadania czekające na sieć
  blad: "sbs-m:blad",            // ostatnia odmowa bazy przy wysyłce
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
  scouts: string[];
  fetchedAt: string | null;
}

const EMPTY_CACHE: Cache = { players: [], clubs: [], observations: [], reports: [], scouts: [], fetchedAt: null };

export const getCache = (): Cache => readLS<Cache>(LS.cache, EMPTY_CACHE);

// Pola dopisane do aplikacji po założeniu bazy nie mają własnych kolumn — aplikacja na komputerze
// chowa je w polu jsonb pod kluczem `__ext` (patrz src/data/storage.ts). Przy odczycie trzeba je
// wyciągnąć na wierzch, przy zapisie — schować z powrotem, inaczej rodzaj obserwacji i punkt
// startowy znikałyby po każdej edycji z telefonu.
//
// Zamiana obiektu na wiersz i z powrotem idzie WPROST przez warstwę aplikacji na komputerze
// (objFromRow / liftExt / prepareRow), zamiast przez odpowiedniki trzymane tutaj. Własne kopie
// już się rozjechały, i to dwa razy: raz o `skladMeczu` i `googleEventId` przy obserwacjach,
// drugi raz — dotkliwiej — przy raportach, których ten plik w ogóle nie pakował, przez co baza
// odrzucała każdy raport z telefonu i zatrzymywała całą kolejkę wysyłki.
const czytaj = (table: string, row: Record<string, unknown>): Record<string, unknown> => {
  const obj = objFromRow(row);
  liftExt(table, obj);
  return obj;
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

// Pobranie kopii bazy. Wołane po zalogowaniu i z przycisku „Odśwież" — świadomie, a nie przy
// każdym wejściu do widoku, żeby nie zjadać transferu na stadionie.
export async function refreshCache(): Promise<Cache> {
  const [players, clubs, observations, reports, kv] = await Promise.all([
    page("sbs_players"),
    page("sbs_clubs"),
    page("sbs_observations"),
    page("sbs_reports"),
    sb.from("sbs_kv").select("value").eq("key", "scouting:settings").maybeSingle(),
  ]);

  let scouts: string[] = [];
  try {
    const settings = kv.data ? JSON.parse((kv.data as { value: string }).value) : null;
    if (settings && Array.isArray(settings.scouts)) scouts = settings.scouts;
  } catch {
    /* ustawienia w nieoczekiwanym kształcie — lista scoutów zostaje pusta, da się ją wpisać ręcznie */
  }

  const cache: Cache = {
    players: players.map((r) => czytaj("sbs_players", r)) as unknown as Player[],
    clubs: clubs.map((r) => czytaj("sbs_clubs", r)) as unknown as Club[],
    observations: observations.map((r) => czytaj("sbs_observations", r)) as unknown as Observation[],
    reports: reports.map((r) => czytaj("sbs_reports", r)) as unknown as Report[],
    scouts,
    fetchedAt: new Date().toISOString(),
  };
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
    if (a.kind === "observation" && b.kind === "observation") return a.item.id === b.item.id;
    if (a.kind === "report" && b.kind === "report") return a.item.id === b.item.id;
    if (a.kind === "playerStatus" && b.kind === "playerStatus") return a.playerId === b.playerId;
    if (a.kind === "liveEvents" && b.kind === "liveEvents") return a.observationId === b.observationId;
    return false;
  };
  setQueue([...q.filter((j) => !sameTarget(j, pelne)), pelne]);
}

// Zapis JEDNEGO wiersza z pominięciem kolumn, których w bazie jeszcze nie ma.
//
// Aplikacja na komputerze robi to od dawna (storage.saveOne): pole spoza aktualnego schematu
// jest pomijane, a rekord i tak zostaje zapisany. Telefon tego nie robił i wychodził na tym
// najgorzej z obu — na komputerze nieudany zapis widać od razu, a tu kończył się cichym
// zatrzymaniem kolejki na stadionie, gdzie nikt nie zagląda w konsolę.
async function upsertRow(table: string, item: Record<string, unknown>): Promise<void> {
  const row = prepareRow(table, item);
  for (;;) {
    const { error } = await sb.from(table).upsert(row, { onConflict: "id" });
    if (!error) return;
    const col = missingColumn(error.message);
    if (!col) throw new Error(error.message);
    console.warn(`Kolumna "${col}" nie istnieje w ${table} — pomijam to pole, żeby reszta zapisu doszła.`);
    delete row[col];
  }
}

// Zadania zapisane starszą wersją panelu niosą gotowy WIERSZ (`row`), nie obiekt. Zamieniamy go
// z powrotem na obiekt, zamiast wysyłać jak leży: to właśnie w składaniu wiersza był błąd, przez
// który te zadania utknęły w kolejce. Wysłanie ich bez przeróbki oznaczałoby, że poprawka
// naprawia dopiero następny mecz, a ten, który scout ma w telefonie, przepada.
function itemZZadania(job: QueueJob & { kind: "observation" | "report" }): Record<string, unknown> {
  const table = job.kind === "observation" ? "sbs_observations" : "sbs_reports";
  if (job.item) return job.item;
  const legacy = (job as unknown as { row?: Record<string, unknown> }).row || {};
  const obj = objFromRow(legacy);
  liftExt(table, obj);   // rozpakowujemy __ext, bo prepareRow zapakuje je z powrotem
  return obj;
}

async function runJob(job: QueueJob): Promise<void> {
  if (job.kind === "observation") {
    await upsertRow("sbs_observations", itemZZadania(job));
    return;
  }
  if (job.kind === "report") {
    await upsertRow("sbs_reports", itemZZadania(job));
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

let flushing: Promise<number> | null = null;

// ODMOWA BAZY MUSI BYĆ WIDOCZNA.
//
// Kolejka rosnąca w milczeniu wygląda dokładnie tak samo jak brak zasięgu — a to dwie różne
// sytuacje: pierwsza sama nie minie. Trzymamy więc ostatnią odmowę w pamięci telefonu, żeby
// przetrwała zamknięcie panelu, i pokazujemy ją w pasku górnym oraz w zakładce Baza.
export interface QueueProblem {
  message: string;
  kind: string;
  at: string;
}

export const queueProblem = (): QueueProblem | null => readLS<QueueProblem | null>(LS.blad, null);
const setProblem = (p: QueueProblem | null) => {
  if (p) writeLS(LS.blad, p);
  else localStorage.removeItem(LS.blad);
};

// Brak sieci wygląda inaczej niż odmowa bazy: przeglądarka przerywa samo połączenie i nie ma
// czego pokazywać scoutowi — wysyłka po prostu poczeka na zasięg.
const bladSieci = (msg: string) =>
  !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed|timeout|aborted/i.test(msg);

// Próba opróżnienia kolejki. Zwraca liczbę zadań, które zostały.
//
// JEDNO ODRZUCONE ZADANIE NIE MOŻE ZATRZYMAĆ RESZTY. Wcześniej pętla przerywała się na pierwszym
// niepowodzeniu — sensowne przy braku zasięgu, zgubne przy odmowie bazy: zapis, którego baza nie
// przyjmie nigdy (brakująca kolumna, złamany klucz obcy), stawał na czele kolejki i blokował
// WSZYSTKO, co scout zapisał po nim. Panel meldował „wysłano", a na komputerze nie było niczego.
// Dlatego rozstrzyga rodzaj błędu: brak sieci przerywa wysyłkę (nie ma sensu dobijać się resztą),
// odmowa bazy odkłada tylko to jedno zadanie i przepuszcza kolejne. Odłożone zostaje w kolejce
// i wraca przy następnej próbie — po uruchomieniu migracji albo poprawce w kodzie dojdzie samo.
//
// Kolejkę czytamy ZE ŹRÓDŁA przed każdym zadaniem, zamiast pracować na migawce z początku pętli.
// Zapis oceny dokłada zadania jedno po drugim (obserwacja, raport, status zawodnika) — a wysyłka
// pierwszego z nich trwa na tyle długo, że pozostałe trafiają do kolejki już w trakcie.
// Wywołanie w trakcie trwającej wysyłki DOŁĄCZA SIĘ do niej, zamiast od razu oddawać stan sprzed
// jej zakończenia. Inaczej ekran meldowałby wynik poprzedniej próby: zapis oceny woła wysyłkę
// trzy razy pod rząd (obserwacja, raport, status), więc dwa ostatnie wywołania wracały
// natychmiast, z liczbą zadań sprzed wysłania czegokolwiek.
export function flushQueue(): Promise<number> {
  if (flushing) return flushing;
  if (!navigator.onLine) return Promise.resolve(queueLength());
  flushing = wykonajWysylke().finally(() => { flushing = null; });
  return flushing;
}

async function wykonajWysylke(): Promise<number> {
  const odlozone = new Set<string>();
  for (;;) {
    const job = getQueue().find((j) => !odlozone.has(j.id));
    if (!job) break;
    try {
      await runJob(job);
      setQueue(getQueue().filter((j) => j.id !== job.id));
    } catch (e) {
      const msg = (e as Error).message || String(e);
      if (bladSieci(msg)) {
        console.warn("Wysyłka wstrzymana — brak połączenia:", msg);
        return getQueue().length;
      }
      odlozone.add(job.id);
      setProblem({ message: msg, kind: job.kind, at: new Date().toISOString() });
      console.error(`Baza odrzuciła zapis (${job.kind}):`, msg);
    }
  }
  if (!odlozone.size) setProblem(null);
  return getQueue().length;
}

// ---------------------------------------------------------------------------
// Operacje panelu
// ---------------------------------------------------------------------------

export function saveObservation(obs: Observation): void {
  patchCache((c) => {
    const i = c.observations.findIndex((o) => o.id === obs.id);
    if (i >= 0) c.observations[i] = obs; else c.observations.push(obs);
  });
  enqueue({ kind: "observation", item: obs as unknown as Record<string, unknown> });
  void flushQueue();
}

export function saveReport(rep: Report): void {
  patchCache((c) => {
    const i = c.reports.findIndex((r) => r.id === rep.id);
    if (i >= 0) c.reports[i] = rep; else c.reports.push(rep);
  });
  enqueue({ kind: "report", item: rep as unknown as Record<string, unknown> });
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
