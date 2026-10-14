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

// ---------------------------------------------------------------------------
// POMIAR: CO Z PROPOZYCJI AI NAPRAWDĘ PRZECHODZI PRZEZ OBIEG
// ---------------------------------------------------------------------------
//
// Bez tego nie wiadomo, czy AI i reguły oszczędzają czas, czy tylko produkują papier. Liczymy
// wyłącznie to, co jest w bazie: ile propozycji z danego źródła (reguły, opinia AI) dotarło do
// decyzji dyrektora i jaka to była decyzja, a ile odpadło po drodze. To jest też materiał do
// późniejszej kalibracji prognozy (src/prognoza.ts) — ona sama przyznaje, że nie ma jeszcze
// historii trafień.

export interface WierszStatystyki {
  zrodlo: string;           // „reguly" | nazwa modelu AI | „(brak)"
  rodzaj: string;
  razem: number;
  otwarte: number;
  transfer: number;
  testy: number;
  obserwacja: number;
  rezygnacja: number;       // decyzja dyrektora „odrzucenie"
  odrzuconeWObiegu: number; // odrzucone przez skauta/trenera/dyrektora przed decyzją
  rozstrzygniete: number;   // decyzja dyrektora + odrzucone w obiegu
  pozytywne: number;        // transfer + testy
  odsetekPozytywnych: number | null; // pozytywne / rozstrzygnięte; null gdy nic nie rozstrzygnięto
}

export interface Statystyka {
  razem: number;
  poStanie: Record<Stan, number>;
  wiersze: WierszStatystyki[];
  sredniDniDoDecyzji: number | null;
}

export function statystykaPropozycji(lista: Propozycja[]): Statystyka {
  const poStanie = Object.fromEntries(KOLEJNOSC_STANOW.map((s) => [s, 0])) as Record<Stan, number>;
  const mapa = new Map<string, WierszStatystyki>();
  const dni: number[] = [];

  for (const p of lista) {
    poStanie[p.stan] = (poStanie[p.stan] || 0) + 1;
    const zrodlo = p.model || "(brak)";
    const klucz = p.rodzaj + "|" + zrodlo;
    let w = mapa.get(klucz);
    if (!w) {
      w = { zrodlo, rodzaj: p.rodzaj, razem: 0, otwarte: 0, transfer: 0, testy: 0, obserwacja: 0,
            rezygnacja: 0, odrzuconeWObiegu: 0, rozstrzygniete: 0, pozytywne: 0, odsetekPozytywnych: null };
      mapa.set(klucz, w);
    }
    w.razem++;
    if (p.stan === "odrzucone") { w.odrzuconeWObiegu++; w.rozstrzygniete++; }
    else if (p.stan === "decyzja_dyrektora") {
      w.rozstrzygniete++;
      if (p.dyrektorDecyzja === "transfer") w.transfer++;
      else if (p.dyrektorDecyzja === "testy") w.testy++;
      else if (p.dyrektorDecyzja === "obserwacja") w.obserwacja++;
      else if (p.dyrektorDecyzja === "odrzucenie") w.rezygnacja++;
      const od = Date.parse(p.utworzoneAt), do_ = Date.parse(p.dyrektorAt);
      if (Number.isFinite(od) && Number.isFinite(do_) && do_ >= od) dni.push((do_ - od) / 86400000);
    } else w.otwarte++;
  }
  const wiersze = [...mapa.values()].map((w) => {
    w.pozytywne = w.transfer + w.testy;
    w.odsetekPozytywnych = w.rozstrzygniete ? w.pozytywne / w.rozstrzygniete : null;
    return w;
  }).sort((a, b) => b.razem - a.razem);
  return {
    razem: lista.length, poStanie, wiersze,
    sredniDniDoDecyzji: dni.length ? dni.reduce((a, b) => a + b, 0) / dni.length : null,
  };
}

// ---------------------------------------------------------------------------
// KARTA DLA DYREKTORA — JEDNA STRONA: FAKTY, GŁOSY, BRAKI, DECYZJA
// ---------------------------------------------------------------------------
//
// Dyrektor nie ma czytać trzech zakładek. Karta zbiera w jednym miejscu to, co ustalili skaut
// i trener, fakty z kartoteki i — osobno — to, CZEGO NIE WIEMY. Lista braków liczona jest z
// danych, nie wymyślana: brak źródeł, brak kontraktu, mało minut, brak oceny trenera.

export interface DaneZawodnikaKarty {
  imieNazwisko: string; rocznik?: string; pozycja?: string; klub?: string; liga?: string;
  mecze?: number | null; minuty?: number | null; gole?: number | null; asysty?: number | null;
  kontrakt?: string;          // np. „do 2027-06-30", „brak informacji"
  agent?: string;             // np. „Agencja X", „brak informacji"
}

export function brakiDoDecyzji(p: Propozycja, z: DaneZawodnikaKarty | null): string[] {
  const braki: string[] = [];
  if (!p.zrodla.length) braki.push("Brak osobno podanych źródeł — sprawdź, na czym opiera się opis.");
  if (!z) braki.push("Zawodnika nie ma już w kartotece — brak aktualnych danych.");
  else {
    if ((z.minuty ?? 0) < 500) braki.push(`Mało minut w danych (${z.minuty ?? "brak"}) — liczby niewiele mówią.`);
    if (!z.kontrakt || /brak/i.test(z.kontrakt)) braki.push("Nieznana sytuacja kontraktowa.");
    if (!z.agent || /brak/i.test(z.agent)) braki.push("Nieznany agent / reprezentacja zawodnika.");
  }
  if (!p.trenerOcena) braki.push("Trener nie wystawił jeszcze oceny dopasowania.");
  if (p.pewnosc === "NISKA") braki.push("Pewność propozycji oznaczona jako niska.");
  return braki;
}

const e = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

/** Kompletny dokument HTML jednej strony A4, gotowy do wydruku. */
export function kartaDyrektoraHtml(p: Propozycja, z: DaneZawodnikaKarty | null, dataWydruku: string): string {
  const braki = brakiDoDecyzji(p, z);
  const wiersz = (k: string, v: unknown) => `<tr><th>${e(k)}</th><td>${e(v ?? "—") || "—"}</td></tr>`;
  const zrodla = p.zrodla.filter((s) => /^https?:\/\//i.test(s.url))
    .map((s) => `<li>${e(s.opis || s.url)} — ${e(s.url)}</li>`).join("");
  const oc = p.trenerOcena;
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Karta: ${e(p.zawodnik)}</title>
<style>
  @page{size:A4;margin:14mm}
  body{font:12px/1.4 system-ui,Arial,sans-serif;color:#111}
  h1{font-size:20px;margin:0 0 2px} h2{font-size:13px;margin:14px 0 4px;border-bottom:1px solid #999;padding-bottom:2px}
  table{border-collapse:collapse;width:100%} th{text-align:left;width:34%;font-weight:600;padding:2px 6px 2px 0;vertical-align:top}
  td{padding:2px 0}.tresc{white-space:pre-wrap}.braki li{color:#8a1c1c}.nota{color:#555;font-size:10px}
</style></head><body>
<h1>${e(p.zawodnik)}</h1>
<div class="nota">Karta dla dyrektora sportowego · wygenerowana ${e(dataWydruku)} · etap: ${e(ETYKIETY_STANU[p.stan])}</div>

<h2>Fakty z kartoteki</h2>
<table>${z ? [wiersz("Rocznik", z.rocznik), wiersz("Pozycja", z.pozycja),
  wiersz("Klub", [z.klub, z.liga].filter(Boolean).join(", ")),
  wiersz("Mecze / minuty", `${z.mecze ?? "brak"} / ${z.minuty ?? "brak"}`),
  wiersz("Gole / asysty", `${z.gole ?? "brak"} / ${z.asysty ?? "brak"}`),
  wiersz("Kontrakt", z.kontrakt || "brak informacji"), wiersz("Agent", z.agent || "brak informacji")].join("")
  : wiersz("Dane", "zawodnika nie ma w kartotece")}</table>

<h2>Propozycja (${e(p.rodzaj)}, źródło: ${e(p.model || "—")}${p.pewnosc ? ", pewność: " + e(p.pewnosc) : ""})</h2>
<div class="tresc">${e(p.tresc)}</div>
${zrodla ? `<div class="nota">Źródła:</div><ul>${zrodla}</ul>` : ""}

<h2>Głos skauta</h2>
<div>${p.skautAt ? e(p.skautUwagi || "Fakty potwierdzone, bez uwag.") : "Jeszcze niezweryfikowane."}</div>

<h2>Ocena trenera — dopasowanie sportowe</h2>
<div>${oc ? `Dopasowanie: <strong>${e(oc.dopasowanie ?? "—")}/6</strong>${oc.pozycja ? " · pozycja: " + e(oc.pozycja) : ""}${oc.komentarz ? "<br>" + e(oc.komentarz) : ""}` : "Brak oceny trenera."}</div>

<h2>Czego nie wiemy</h2>
${braki.length ? `<ul class="braki">${braki.map((b) => `<li>${e(b)}</li>`).join("")}</ul>` : "<div>Brak oczywistych luk w danych.</div>"}

<h2>Decyzja dyrektora</h2>
<div>${p.dyrektorDecyzja ? `<strong>${e(ETYKIETY_DECYZJI[p.dyrektorDecyzja])}</strong>${p.dyrektorUzasadnienie ? " — " + e(p.dyrektorUzasadnienie) : ""}`
  : p.stan === "odrzucone" ? `Propozycja odrzucona: ${e(p.odrzucilPowod)}` : "Czeka na decyzję."}</div>
<p class="nota">Propozycja AI nie jest oceną ani rekomendacją transferu — to materiał do weryfikacji przez skauta i trenera.</p>
</body></html>`;
}
