// SKALA OCENY BRAMKARZA.
//
// Bramkarz gra w inną grę niż reszta jedenastki. Kafle do tagowania i protokół 1–6 były ułożone
// pod zawodnika z pola: „Drybling", „Gra głową", „Strzał" przy bramkarzu praktycznie nie padają,
// a to, co przy nim decyduje — obrona strzału, wyjście na dośrodkowanie, sytuacja sam na sam,
// gra nogami — nie miało gdzie się zapisać. Scout albo naciągał cudze kafle, albo nie tagował
// bramkarza wcale.
//
// DLACZEGO OSOBNY PLIK, A NIE STAŁE W main.ts.
// Numeracja pozycji jest wpisana osobno w systemie i w panelu i już raz się przez to rozjechała
// (stopery 4 i 5 zamienione stronami — błąd zupełnie niemy: punkt po prostu siadał po złej
// stronie mapy). Skala bramkarza od początku jest potrzebna w obu miejscach naraz: panel ją
// wystawia, system ją pokazuje w raporcie. Gdyby powstała jako dwie kopie, rozjechałaby się
// dokładnie tak samo — tyle że tu ceną byłby raport, w którym oceny stoją pod cudzymi
// podpisami. Jedno źródło, dwa wejścia (app.html i mobile.html) importują to samo.

// ---------------------------------------------------------------------------
// Rozpoznanie bramkarza
// ---------------------------------------------------------------------------

/** Numer bramkarza na mapie pozycji — ten sam w systemie i w panelu (POZYCJE_PELNE). */
export const NUMER_BRAMKARZA = 1;

/** Bramkarz ustawiony na mapie pozycji. */
export const pozycjaToBramkarz = (numer: unknown): boolean =>
  Number(numer) === NUMER_BRAMKARZA;

/** Bramkarz wg pozycji z kartoteki („Bramkarz"). Znosi ogonki i wielkość liter, bo ta sama
 *  pozycja wpisana ręcznie bywa zapisana na kilka sposobów. */
export const opisToBramkarz = (tekst: unknown): boolean =>
  /bramkarz/i.test(String(tekst ?? ""));

// ---------------------------------------------------------------------------
// Kafle do tagowania na żywo
// ---------------------------------------------------------------------------
//
// Pięć kafli zostaje z listy zawodnika z pola, bo znaczą przy bramkarzu dokładnie to samo:
// podanie kluczowe (bramkarz otwiera akcję), pojedynek, ustawienie, strata i gol. Pozostałe
// pięć ustępuje miejsca bramkarskim. Dziesięć to nadal cała lista — kafli nie przybywa, bo
// przewijanie w trakcie akcji oznacza akcję przegapioną.
//
// Kolejność nie jest przypadkowa: najczęstsze interwencje idą pierwsze, żeby palec trafiał
// w nie bez szukania, a „Gol" stoi na końcu, bo pada najrzadziej i pomyłkowe dotknięcie
// akurat tego kafla kosztuje najwięcej.

export const EVENT_TAGS_BRAMKARZ = [
  { key: "obrona_strzalu", label: "Obrona strzału" },
  { key: "wyjscie_dosrodkowanie", label: "Wyjście na dośrodkowanie" },
  { key: "sam_na_sam", label: "Sam na sam" },
  { key: "gra_nogami", label: "Gra nogami" },
  { key: "wznowienie", label: "Wznowienie długie" },
  { key: "podanie_kluczowe", label: "Podanie kluczowe" },
  { key: "pojedynek", label: "Pojedynek" },
  { key: "ustawienie", label: "Ustawienie" },
  { key: "strata", label: "Strata" },
  { key: "gol", label: "Gol" },
] as const;

// ---------------------------------------------------------------------------
// Protokół 1–6
// ---------------------------------------------------------------------------
//
// Cztery pozycje, tak samo jak cztery fazy gry zawodnika z pola — i to nie jest kosmetyka:
// radar w systemie rysuje tyle wierzchołków, ile jest pozycji, więc każda inna liczba
// zmieniłaby kształt wykresu i raport bramkarza przestałby dać się porównać z pozostałymi.
//
// `krotko` to podpis na radarze i w PDF — pełne nazwy nie mieszczą się przy wierzchołku.

export const FAZY_BRAMKARZ = [
  { key: "gkObronaBramki", label: "Obrona bramki", krotko: "Obrona" },
  { key: "gkGraWPolu", label: "Gra w polu karnym", krotko: "Pole karne" },
  { key: "gkGraNogami", label: "Gra nogami", krotko: "Gra nogami" },
  { key: "gkOrganizacja", label: "Organizacja obrony", krotko: "Organizacja" },
] as const;

const KLUCZE_FAZ_BRAMKARZA: string[] = FAZY_BRAMKARZ.map((f) => f.key);

/** Czy ten protokół jest bramkarski? Rozstrzyga sama zawartość, nie kartoteka — dzięki temu
 *  raport wystawiony bramkarzowi pokazuje bramkarskie podpisy nawet wtedy, gdy zawodnikowi
 *  ktoś później zmienił pozycję w kartotece, a raporty sprzed tej zmiany zostają nietknięte. */
export const fazyToBramkarskie = (fazy: unknown): boolean =>
  !!fazy && typeof fazy === "object" &&
  KLUCZE_FAZ_BRAMKARZA.some((k) => (fazy as Record<string, unknown>)[k] != null);

// Stałe fragmenty zostają wspólne. Rzuty rożne i wolne bramkarz przeżywa tak samo jak reszta
// zespołu — tyle że z drugiej strony — więc rozdzielanie ich niczego by nie wniosło, a raport
// przestałby się zgadzać między pozycjami.
