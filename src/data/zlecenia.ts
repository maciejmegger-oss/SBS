// ZLECENIA ANALIZ WIDEO — „Zleć analizę" przy zawodniku.
//
// Skaut zamawia obserwację z nagrania: wskazuje mecz i źródło (link albo plik na dysku), a zlecenie
// czeka w tabeli, aż analityk je odbierze. Gotowy raport wraca osobną drogą — do skrzynki raportów
// (src/data/skrzynka.ts), skąd skaut wczytuje go do formularza i zapisuje.
//
// Tabela i reguły dostępu: supabase/migration_2026-09-29_zlecenia_analiz.sql.

import { sb } from "./storage";

export interface ZlecenieAnalizy {
  id: string;
  utworzoneAt?: string;
  playerId?: string | null;
  zawodnik?: string;
  mecz?: string;
  link?: string;
  plik?: string;
  pozycja?: number | null;
  uwagi?: string;
  zlecil?: string;
  status?: string;
}

const TABELA = "sbs_analiza_zlecenia";

/** Nowe zlecenie. Zwraca komunikat błędu albo null, gdy zapis się udał. */
export async function zlecAnalize(z: ZlecenieAnalizy): Promise<string | null> {
  const { error } = await sb.from(TABELA).insert({
    id: z.id,
    player_id: z.playerId || null,
    zawodnik: z.zawodnik || "",
    mecz: z.mecz || "",
    link: z.link || "",
    plik: z.plik || "",
    pozycja: z.pozycja ?? null,
    uwagi: z.uwagi || "",
    zlecil: z.zlecil || "",
    status: "nowe",
  });
  return error ? error.message : null;
}

/** Zlecenia w toku i czekające — do odznaczenia w profilu zawodnika. */
export async function pobierzOtwarteZlecenia(): Promise<ZlecenieAnalizy[]> {
  const { data, error } = await sb
    .from(TABELA)
    .select("*")
    .in("status", ["nowe", "w_toku"])
    .order("utworzone_at", { ascending: false })
    .limit(200);
  if (error) {
    // Brak tabeli (migracja nieuruchomiona) nie może wywracać profilu zawodnika.
    console.warn("Zlecenia analiz niedostępne:", error.message);
    return [];
  }
  return (data || []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    utworzoneAt: r.utworzone_at as string | undefined,
    playerId: (r.player_id as string) || null,
    zawodnik: r.zawodnik as string | undefined,
    mecz: r.mecz as string | undefined,
    link: r.link as string | undefined,
    plik: r.plik as string | undefined,
    pozycja: (r.pozycja as number) ?? null,
    uwagi: r.uwagi as string | undefined,
    zlecil: r.zlecil as string | undefined,
    status: r.status as string | undefined,
  }));
}
