// ZDARZENIA REJESTROWANE NA ŻYWO — wspólne dla telefonu i komputera.
//
// Telefon je ZAPISUJE (jedno dotknięcie kafla = jedno zdarzenie z minutą meczu), komputer je
// CZYTA przy obserwacji. Dopóki ten plik nie powstał, druga połowa tego zdania była nieprawdą:
// aplikacja na komputerze nie miała ani jednej linii kodu dotykającej zdarzeń, więc cała oś
// z meczu zostawała w bazie i w telefonie, a przy obserwacji na komputerze nie było jej widać.
//
// Definicje siedzą tutaj, a nie po jednej ze stron, bo obie muszą rozumieć te same klucze:
// telefon zapisuje `type: "strzal"`, komputer musi wiedzieć, że to „Strzał". Etykiety NIE idą
// do bazy (tabela ma sam klucz), więc rozjazd list po cichu zamieniłby oś zdarzeń w listę
// surowych identyfikatorów.

import { sb } from "./storage";

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

// Zdarzenia rejestrowane jednym dotknięciem. Kafli jest tyle, ile mieści się na ekranie telefonu
// bez przewijania — a przewijanie w trakcie akcji oznacza przegapioną akcję.
export const EVENT_TAGS: { key: string; label: string }[] = [
  { key: "podanie_kluczowe", label: "Podanie kluczowe" },
  { key: "strzal", label: "Strzał" },
  { key: "drybling", label: "Drybling" },
  { key: "pojedynek", label: "Pojedynek" },
  { key: "gra_glowa", label: "Gra głową" },
  { key: "odbior", label: "Odbiór" },
  { key: "strata", label: "Strata" },
  { key: "ustawienie", label: "Ustawienie" },
  { key: "gol", label: "Gol" },
  { key: "asysta", label: "Asysta" },
];

// Zdarzenie zapisane starszą wersją panelu może nieść klucz, którego dziś nie ma na liście —
// pokazujemy wtedy sam klucz zamiast udawać, że zdarzenia nie było.
export const eventLabel = (type: string): string =>
  EVENT_TAGS.find((t) => t.key === type)?.label || type;

export const PERIOD_LABELS: Record<number, string> = {
  1: "1. połowa", 2: "2. połowa", 3: "1. dogrywka", 4: "2. dogrywka",
};

const KV_PREFIX = "scouting:liveEvents:";

// Czy tabela zdarzeń istnieje w bazie? Migracja (supabase/migration_2026-08-06_live_events.sql)
// może nie być jeszcze uruchomiona, a panel ma działać od razu. Gdy tabeli nie ma, oś zdarzeń
// idzie do sbs_kv — tej tabeli używa aplikacja na komputerze do terminarza i ustawień, więc
// istnieje na pewno. Rozstrzygnięcie pamiętamy na czas życia karty, żeby nie pytać za każdym razem.
let tabelaIstnieje: boolean | null = null;

// Brak tabeli (albo brak kolumny w tabeli założonej ze starszej wersji migracji) to jedyny błąd,
// który wolno obejść zapisem do sbs_kv. Każdy inny — odmowa dostępu, brak sieci — musi wrócić
// do wywołującego, żeby kolejka spróbowała ponownie, zamiast po cichu wylądować gdzie indziej.
const brakTabeli = (msg: string) =>
  /relation .* does not exist|could not find the table|schema cache|column .* does not exist/i.test(msg);

export async function pushLiveEvents(observationId: string, events: LiveEvent[]): Promise<void> {
  if (tabelaIstnieje !== false) {
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
    if (!error) { tabelaIstnieje = true; return; }
    if (!brakTabeli(error.message)) throw new Error(error.message);
    tabelaIstnieje = false;
  }
  const { error } = await sb
    .from("sbs_kv")
    .upsert({ key: KV_PREFIX + observationId, value: JSON.stringify(events) }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

// Odczyt osi zdarzeń jednej obserwacji. Szukamy w OBU miejscach, bo zapis mógł pójść każdą
// z dwóch dróg — zależnie od tego, czy w chwili meczu migracja była już uruchomiona. Mecze
// sprzed migracji muszą być widoczne tak samo jak te po niej.
export async function getLiveEvents(observationId: string): Promise<LiveEvent[]> {
  const zTabeli: LiveEvent[] = [];
  if (tabelaIstnieje !== false) {
    const { data, error } = await sb.from("sbs_live_events").select("*").eq("observation_id", observationId);
    if (error) {
      if (!brakTabeli(error.message)) throw new Error(error.message);
      tabelaIstnieje = false;
    } else {
      tabelaIstnieje = true;
      (data || []).forEach((r: Record<string, unknown>) => {
        zTabeli.push({
          id: String(r.id),
          observationId,
          playerId: (r.player_id as string) || undefined,
          half: (Number(r.half) || 1) as Period,
          minute: Number(r.minute) || 0,
          type: String(r.type || ""),
          // Etykiety w tabeli nie ma — odtwarzamy ją z klucza, patrz uwaga na górze pliku.
          label: eventLabel(String(r.type || "")),
          quality: Number(r.quality) < 0 ? -1 : 1,
          zawodnik: (r.zawodnik as string) || undefined,
          note: (r.note as string) || undefined,
          createdAt: String(r.created_at || ""),
        });
      });
    }
  }

  const { data: kv, error: kvErr } = await sb
    .from("sbs_kv").select("value").eq("key", KV_PREFIX + observationId).maybeSingle();
  if (kvErr) throw new Error(kvErr.message);

  let zKv: LiveEvent[] = [];
  if (kv && (kv as { value?: string }).value) {
    try {
      const parsed = JSON.parse((kv as { value: string }).value);
      if (Array.isArray(parsed)) zKv = parsed as LiveEvent[];
    } catch {
      /* wpis w nieoczekiwanym kształcie — lepiej pokazać to, co przyszło z tabeli, niż nic */
    }
  }

  // Ten sam mecz mógł trafić w oba miejsca (np. migracja uruchomiona w przerwie meczu).
  // Identyfikator zdarzenia jest ten sam po obu stronach, więc scalamy po nim.
  const wgId = new Map<string, LiveEvent>();
  [...zKv, ...zTabeli].forEach((e) => { if (e && e.id) wgId.set(e.id, e); });
  return [...wgId.values()].sort((a, b) =>
    a.half - b.half || a.minute - b.minute || String(a.createdAt).localeCompare(String(b.createdAt)));
}
