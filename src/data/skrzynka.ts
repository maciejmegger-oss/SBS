// SKRZYNKA RAPORTÓW — raporty przygotowane poza aplikacją, czekające na wczytanie do formularza.
//
// PO CO TO JEST
// Raport z analizy wideo powstaje dziś poza systemem (asystent AI, analityk pracujący na nagraniu)
// i trzeba go było przepisywać do formularza pole po polu. Schowek i konsola przeglądarki odpadają:
// Firefox blokuje wklejanie w konsoli, a każdy zrzut ekranu czyści schowek. Skrzynka rozwiązuje to
// od strony bazy — przygotowany raport ląduje w osobnej tabeli, a skaut wczytuje go jednym
// kliknięciem do zwykłego formularza, sprawdza i zapisuje jak każdy inny raport.
//
// DLACZEGO OSOBNA TABELA, A NIE OD RAZU sbs_reports
// Raport ma AUTORA i ten autor bierze na siebie ocenę. Wpis w skrzynce to dopiero propozycja:
// dopóki skaut jej nie przejrzy i nie kliknie „Zapisz raport", nie ma go w kartotece, nie liczy się
// do średnich i nie zmienia statusu zawodnika. Osobna tabela pozwala też dopisywać do niej kluczem
// publicznym (anon), nie otwierając zapisu do prawdziwych raportów.
//
// STATUSY: 'nowy' (czeka), 'wczytany' (skaut wciągnął go do formularza), 'odrzucony' (odłożony).
// Wpisy zostają w bazie razem ze statusem — widać, co przyszło i co z tym zrobiono.

import { sb } from "./storage";

export interface WpisSkrzynki {
  id: string;
  utworzoneAt?: string;
  zrodlo?: string;
  playerId?: string | null;
  zawodnik?: string;
  tytul?: string;
  status?: string;
  /** Treść raportu w kształcie formularza: date, scout, obsType, rywal, wynik, technika, phases… */
  dane: Record<string, unknown>;
}

const TABELA = "sbs_raport_inbox";

/** Powód ostatniego nieudanego odczytu — panel pokazuje go zamiast udawać pustą skrzynkę. */
export let bladSkrzynki = "";

/** Wpisy czekające na decyzję skauta, od najnowszego. Pusta tablica, gdy tabeli jeszcze nie ma. */
export async function pobierzSkrzynke(): Promise<WpisSkrzynki[]> {
  const { data, error } = await sb
    .from(TABELA)
    .select("*")
    .eq("status", "nowy")
    .order("utworzone_at", { ascending: false })
    .limit(50);
  bladSkrzynki = error ? error.message : "";
  if (error) {
    // Brak tabeli (migracja nieuruchomiona) nie może wywracać widoku raportów — skrzynka jest
    // dodatkiem, a nie warunkiem pracy. Każdy inny błąd też tylko gasi panel.
    console.warn("Skrzynka raportów niedostępna:", error.message);
    return [];
  }
  return (data || []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    utworzoneAt: r.utworzone_at as string | undefined,
    zrodlo: r.zrodlo as string | undefined,
    playerId: (r.player_id as string) || null,
    zawodnik: r.zawodnik as string | undefined,
    tytul: r.tytul as string | undefined,
    status: r.status as string | undefined,
    dane: (r.dane as Record<string, unknown>) || {},
  }));
}

/** Oznaczenie wpisu po decyzji skauta. Błąd zwraca false — wołający pokazuje komunikat. */
export async function oznaczWpisSkrzynki(id: string, status: "wczytany" | "odrzucony"): Promise<boolean> {
  const { error } = await sb.from(TABELA).update({ status }).eq("id", id);
  if (error) {
    console.warn("Nie udało się oznaczyć wpisu skrzynki:", error.message);
    return false;
  }
  return true;
}
