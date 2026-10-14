// OBIEG PROPOZYCJI: AI → skaut → trener → dyrektor — reguły po stronie aplikacji.
//
// To jest LUSTRO reguł z bazy (supabase/migration_2026-10-14_przeplyw_ai.sql), a nie ich
// zastępstwo: ekran pokazuje przyciski tylko tym, którym baza pozwoli kliknąć, żeby nikt nie
// trafiał w błąd „brak uprawnień". Prawdziwy zamek jest w wyzwalaczu bazy — gdyby ktoś ominął
// interfejs, odmówi on zapisu tak samo.

export type Stan =
  | "ai_propozycja" | "zweryfikowane_skaut" | "ocena_trenera" | "decyzja_dyrektora" | "odrzucone";

export type Decyzja = "transfer" | "testy" | "obserwacja" | "odrzucenie";

export const ETYKIETY_STANU: Record<Stan, string> = {
  ai_propozycja: "1. Do weryfikacji przez skauta",
  zweryfikowane_skaut: "2. Do oceny przez trenera",
  ocena_trenera: "3. Do decyzji dyrektora",
  decyzja_dyrektora: "Zdecydowane",
  odrzucone: "Odrzucone",
};

export const KOLEJNOSC_STANOW: Stan[] =
  ["ai_propozycja", "zweryfikowane_skaut", "ocena_trenera", "decyzja_dyrektora", "odrzucone"];

export const ETYKIETY_DECYZJI: Record<Decyzja, string> = {
  transfer: "Transfer",
  testy: "Zaproszenie na testy",
  obserwacja: "Dalsza obserwacja",
  odrzucenie: "Rezygnacja",
};

export const STANY_ZAMKNIETE: Stan[] = ["decyzja_dyrektora", "odrzucone"];

export interface Propozycja {
  id: number;
  playerId: string | null;
  zawodnik: string;
  rodzaj: string;
  tresc: string;
  zrodla: { url: string; opis?: string }[];
  pewnosc: string;
  model: string;
  stan: Stan;
  skautUwagi: string;
  skautAt: string;
  trenerOcena: { dopasowanie?: number; pozycja?: string; komentarz?: string } | null;
  trenerUwagi: string;
  trenerAt: string;
  dyrektorDecyzja: Decyzja | null;
  dyrektorUzasadnienie: string;
  dyrektorAt: string;
  odrzucilPowod: string;
  utworzoneAt: string;
}

/** Rola z konta; brak konta (logowanie wyłączone) traktujemy jak administratora — jak czyAdmin(). */
export type RolaUi = "admin" | "scout" | "trener" | "dyrektor" | "klient";

/** Co dana rola może zrobić z propozycją na jej obecnym etapie. */
export function coMozeRola(rola: RolaUi, stan: Stan): "weryfikuj" | "oceniaj" | "decyduj" | null {
  if (rola === "klient") return null;
  if (stan === "ai_propozycja" && (rola === "admin" || rola === "scout")) return "weryfikuj";
  if (stan === "zweryfikowane_skaut" && (rola === "admin" || rola === "trener")) return "oceniaj";
  if (stan === "ocena_trenera" && (rola === "admin" || rola === "dyrektor")) return "decyduj";
  return null;
}

/** Odrzucić może skaut, trener i dyrektor (i admin) — dopóki propozycja jest otwarta. */
export function mozeOdrzucic(rola: RolaUi, stan: Stan): boolean {
  if (rola === "klient" || STANY_ZAMKNIETE.includes(stan)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// KANDYDACI WYBIERANI REGUŁAMI — BEZ AI I BEZ KOSZTU
// ---------------------------------------------------------------------------
//
// Pierwszy etap „wyszukiwania i filtrowania" to zwykłe zapytanie do własnej kartoteki: rocznik,
// minuty, pozycja. Model językowy nie jest do tego potrzebny, a każde jego wywołanie kosztuje.
// Dlatego propozycje z tej drogi mają model „reguly" i opisują WYŁĄCZNIE liczby z kartoteki —
// niczego nie dopowiadają. AI wchodzi dopiero później (druga opinia, szkic raportu) i tylko dla
// tych, których skaut uzna za wartych dalszej pracy.

export interface KryteriaKandydatow {
  rocznikOd?: number;
  rocznikDo?: number;
  minMinut?: number;
  pozycja?: string;
  limit?: number;
}

export interface ZawodnikWejscie {
  id: string; firstName?: string; lastName?: string; birthYear?: string; position?: string;
  minutes?: number; matches?: number; goals?: number; assists?: number; status?: string;
  lnpLink?: string; tmLink?: string; clubId?: string; klubBezLigi?: boolean;
}

export interface SzkicPropozycji {
  playerId: string; zawodnik: string; rodzaj: "kandydat"; tresc: string;
  zrodla: { url: string; opis: string }[]; pewnosc: "ŚREDNIA" | "NISKA"; model: "reguly";
}

export function wybierzKandydatow(
  zawodnicy: ZawodnikWejscie[],
  kryteria: KryteriaKandydatow,
  zajeteId: Set<string>,
  nazwaKlubu: (clubId?: string) => string,
  ligaKlubu: (p: ZawodnikWejscie) => string,
): SzkicPropozycji[] {
  const limit = Math.max(1, Math.min(kryteria.limit || 20, 50));
  const minMinut = Math.max(0, kryteria.minMinut || 0);
  const poz = (kryteria.pozycja || "").trim().toLowerCase();
  const wynik = zawodnicy
    .filter((p) => {
      if (zajeteId.has(p.id)) return false;
      if (p.status === "Odrzucony") return false;
      const rocznik = parseInt(String(p.birthYear || ""), 10);
      if (kryteria.rocznikOd && !(rocznik >= kryteria.rocznikOd)) return false;
      if (kryteria.rocznikDo && !(rocznik <= kryteria.rocznikDo)) return false;
      if ((p.minutes || 0) < minMinut) return false;
      if (poz && !String(p.position || "").toLowerCase().includes(poz)) return false;
      return !!(p.lastName || p.firstName);
    })
    .sort((a, b) => (b.minutes || 0) - (a.minutes || 0))
    .slice(0, limit);

  return wynik.map((p) => {
    const klub = nazwaKlubu(p.clubId), liga = ligaKlubu(p);
    const minuty = p.minutes || 0;
    const czesci = [
      `Rocznik ${p.birthYear || "?"}`, p.position ? `pozycja: ${p.position}` : "",
      klub && klub !== "—" ? `klub: ${klub}${liga ? " (" + liga + ")" : ""}` : "",
    ].filter(Boolean).join(", ");
    const liczby = `Mecze: ${p.matches ?? "brak danych"}, minuty: ${p.minutes ?? "brak danych"}, `
      + `gole: ${p.goals ?? "brak danych"}, asysty: ${p.assists ?? "brak danych"}.`;
    const zrodla = [
      p.lnpLink ? { url: p.lnpLink, opis: "Łączy Nas Piłka / 90minut" } : null,
      p.tmLink ? { url: p.tmLink, opis: "Transfermarkt" } : null,
    ].filter(Boolean) as { url: string; opis: string }[];
    return {
      playerId: p.id,
      zawodnik: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
      rodzaj: "kandydat" as const,
      tresc: `${czesci}. ${liczby} Wybrany regułami według kryteriów skauta — to zestawienie liczb z kartoteki, nie ocena.`,
      zrodla,
      // Poniżej ok. 500 minut liczby jeszcze niewiele mówią — i tak to nazywamy.
      pewnosc: minuty >= 500 ? ("ŚREDNIA" as const) : ("NISKA" as const),
      model: "reguly" as const,
    };
  });
}
