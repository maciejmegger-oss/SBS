// SKALA OCENY WEDŁUG POZYCJI.
//
// Bramkarz gra w inną grę niż reszta jedenastki — i to samo dotyczy pozostałych formacji.
// Jeden wspólny zestaw kafli i jeden wspólny protokół był ułożony pod „zawodnika z pola", czyli
// pod nikogo konkretnego: przy stoperze nie padał „Drybling", przy napastniku „Asekuracja",
// a to, co przy każdym z nich naprawdę rozstrzyga, nie miało gdzie się zapisać. Scout albo
// naciągał cudze rubryki, albo zostawiał je puste.
//
// CZTERY GRUPY: bramkarz, obrońca, pomocnik, napastnik. Skrzydłowi (7 i 11) idą do pomocników —
// tak jak rozstrzygnął scout: liczy się u nich praca w obie strony, nie samo wykańczanie.
//
// DLACZEGO OSOBNY PLIK, A NIE STAŁE W main.ts.
// Numeracja pozycji jest wpisana osobno w systemie i w panelu i już raz się przez to rozjechała
// (stopery 4 i 5 zamienione stronami — błąd zupełnie niemy: punkt po prostu siadał po złej
// stronie mapy). Ta skala od początku jest potrzebna w obu miejscach naraz: panel ją wystawia,
// system pokazuje ją w raporcie. Jako dwie kopie rozjechałaby się tak samo, tyle że ceną byłby
// raport, w którym oceny stoją pod cudzymi podpisami. Jedno źródło, dwa wejścia.

export type GrupaPozycji = "bramkarz" | "obronca" | "pomocnik" | "napastnik";

export interface Kafel { key: string; label: string; }
export interface Faza { key: string; label: string; krotko: string; }

// ---------------------------------------------------------------------------
// Rozpoznanie pozycji
// ---------------------------------------------------------------------------

/** Numer bramkarza na mapie pozycji — ten sam w systemie i w panelu (POZYCJE_PELNE). */
export const NUMER_BRAMKARZA = 1;

// Numeracja wg Narodowego Modelu Gry: 1 bramkarz, 2/3 boczni obrońcy, 4/5 stoperzy,
// 6/8/10 środek pola, 7/11 skrzydła, 9 napastnik.
const GRUPA_Z_NUMERU: Record<number, GrupaPozycji> = {
  1: "bramkarz",
  2: "obronca", 3: "obronca", 4: "obronca", 5: "obronca",
  6: "pomocnik", 7: "pomocnik", 8: "pomocnik", 10: "pomocnik", 11: "pomocnik",
  9: "napastnik",
};

/** Grupa wg numeru na mapie pozycji. Pusty numer to „nie wiem", nie „zawodnik z pola". */
export const grupaZNumeru = (numer: unknown): GrupaPozycji | null =>
  GRUPA_Z_NUMERU[Number(numer)] || null;

/** Grupa wg pozycji z kartoteki. Kolejność sprawdzania ma znaczenie: „pomocnik ofensywny" musi
 *  trafić do pomocników, a nie do napastników przez samo słowo „ofensywny". */
export function grupaZOpisu(tekst: unknown): GrupaPozycji | null {
  const n = String(tekst ?? "").toLowerCase();
  if (!n.trim()) return null;
  if (/bramkarz/.test(n)) return "bramkarz";
  if (/pomocnik|wahad[łl]ow|skrzyd[łl]ow/.test(n)) return "pomocnik";
  if (/obro[ńn]c/.test(n)) return "obronca";
  if (/napastnik|snajper/.test(n)) return "napastnik";
  return null;
}

/** Bramkarz ustawiony na mapie pozycji. */
export const pozycjaToBramkarz = (numer: unknown): boolean =>
  Number(numer) === NUMER_BRAMKARZA;

/** Bramkarz wg pozycji z kartoteki. */
export const opisToBramkarz = (tekst: unknown): boolean => grupaZOpisu(tekst) === "bramkarz";

// ---------------------------------------------------------------------------
// Kafle do tagowania na żywo
// ---------------------------------------------------------------------------
//
// Dziesięć kafli w każdej grupie — nie więcej, bo przewijanie w trakcie akcji oznacza akcję
// przegapioną, i nie mniej, bo ekran i tak mieści trzy w rzędzie.
//
// Część kluczy powtarza się między grupami CELOWO: „Pojedynek", „Strata" czy „Gol" znaczą przy
// każdej pozycji dokładnie to samo, więc dzielą klucz i zostają porównywalne przez cały sezon,
// niezależnie od tego, gdzie zawodnik zagrał w danym meczu.
//
// Kolejność też nie jest przypadkowa: najczęstsze zdarzenia idą pierwsze, żeby palec trafiał
// w nie bez szukania, a „Gol" stoi na końcu, bo pada najrzadziej i pomyłkowe dotknięcie akurat
// tego kafla kosztuje najwięcej.

const KAFLE_BRAMKARZ: Kafel[] = [
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
];

const KAFLE_OBRONCA: Kafel[] = [
  { key: "obrona_1v1", label: "Obrona 1 na 1" },
  { key: "odbior", label: "Odbiór" },
  { key: "przechwyt", label: "Przechwyt" },
  { key: "gra_glowa", label: "Gra głową" },
  { key: "asekuracja", label: "Asekuracja" },
  { key: "wyprowadzenie", label: "Wyprowadzenie piłki" },
  { key: "pojedynek", label: "Pojedynek" },
  { key: "ustawienie", label: "Ustawienie" },
  { key: "strata", label: "Strata" },
  { key: "gol", label: "Gol" },
];

const KAFLE_POMOCNIK: Kafel[] = [
  { key: "podanie_kluczowe", label: "Podanie kluczowe" },
  { key: "drybling", label: "Drybling" },
  { key: "przyjecie", label: "Przyjęcie pod presją" },
  { key: "odbior", label: "Odbiór" },
  { key: "dosrodkowanie", label: "Dośrodkowanie" },
  { key: "strzal", label: "Strzał" },
  { key: "pojedynek", label: "Pojedynek" },
  { key: "ustawienie", label: "Ustawienie" },
  { key: "strata", label: "Strata" },
  { key: "asysta", label: "Asysta" },
];

const KAFLE_NAPASTNIK: Kafel[] = [
  { key: "strzal", label: "Strzał" },
  { key: "ruch_bez_pilki", label: "Ruch bez piłki" },
  { key: "gra_tylem", label: "Gra tyłem do bramki" },
  { key: "gra_glowa", label: "Gra głową" },
  { key: "presja", label: "Presja na obrońcach" },
  { key: "drybling", label: "Drybling" },
  { key: "pojedynek", label: "Pojedynek" },
  { key: "strata", label: "Strata" },
  { key: "asysta", label: "Asysta" },
  { key: "gol", label: "Gol" },
];

// ---------------------------------------------------------------------------
// Protokół 1–6
// ---------------------------------------------------------------------------
//
// CZTERY POZYCJE W KAŻDEJ GRUPIE, tak samo jak cztery fazy gry — i to nie jest kosmetyka:
// radar w systemie rysuje tyle wierzchołków, ile jest pozycji, więc każda inna liczba zmieniłaby
// kształt wykresu i raport przestałby dać się porównać między zawodnikami.
//
// `krotko` to podpis na radarze i w PDF — pełne nazwy nie mieszczą się przy wierzchołku.
//
// Przedrostek klucza (gk/obr/pom/nap) niesie grupę. To on pozwala rozpoznać PO SAMEJ ZAWARTOŚCI
// raportu, którą skalę mu wystawiono — patrz grupaZFaz.

const FAZY_BRAMKARZ: Faza[] = [
  { key: "gkObronaBramki", label: "Obrona bramki", krotko: "Obrona" },
  { key: "gkGraWPolu", label: "Gra w polu karnym", krotko: "Pole karne" },
  { key: "gkGraNogami", label: "Gra nogami", krotko: "Gra nogami" },
  { key: "gkOrganizacja", label: "Organizacja obrony", krotko: "Organizacja" },
];

const FAZY_OBRONCA: Faza[] = [
  { key: "obrObrona1v1", label: "Obrona 1 na 1", krotko: "1 na 1" },
  { key: "obrPowietrze", label: "Gra w powietrzu", krotko: "Powietrze" },
  { key: "obrUstawienie", label: "Ustawienie i asekuracja", krotko: "Ustawienie" },
  { key: "obrWyprowadzenie", label: "Wyprowadzenie piłki", krotko: "Wyprowadzenie" },
];

const FAZY_POMOCNIK: Faza[] = [
  { key: "pomPodania", label: "Podania i gra w posiadaniu", krotko: "Podania" },
  { key: "pomOdbior", label: "Odbiór i presja", krotko: "Odbiór" },
  { key: "pomMiedzyLiniami", label: "Gra między liniami", krotko: "Między liniami" },
  { key: "pomDecyzje", label: "Decyzje i prowadzenie gry", krotko: "Decyzje" },
];

const FAZY_NAPASTNIK: Faza[] = [
  { key: "napWykonczenie", label: "Wykończenie akcji", krotko: "Wykończenie" },
  { key: "napGraTylem", label: "Gra tyłem do bramki", krotko: "Gra tyłem" },
  { key: "napRuchBezPilki", label: "Ruch bez piłki", krotko: "Ruch" },
  { key: "napPresja", label: "Presja na obrońcach", krotko: "Presja" },
];

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface Profil {
  kafle: Kafel[];
  fazy: Faza[];
  /** Podpis nad protokołem 1–6 w panelu. */
  etykietaFaz: string;
}

export const PROFILE: Record<GrupaPozycji, Profil> = {
  bramkarz: { kafle: KAFLE_BRAMKARZ, fazy: FAZY_BRAMKARZ, etykietaFaz: "Gra bramkarza" },
  obronca: { kafle: KAFLE_OBRONCA, fazy: FAZY_OBRONCA, etykietaFaz: "Gra w obronie" },
  pomocnik: { kafle: KAFLE_POMOCNIK, fazy: FAZY_POMOCNIK, etykietaFaz: "Gra w środku pola" },
  napastnik: { kafle: KAFLE_NAPASTNIK, fazy: FAZY_NAPASTNIK, etykietaFaz: "Gra w ataku" },
};

/** Wszystkie kafle wszystkich grup — do odczytania etykiety zdarzenia zapisanego kiedykolwiek. */
export const WSZYSTKIE_KAFLE: Kafel[] = Object.values(PROFILE).flatMap((p) => p.kafle);

/** Wszystkie pozycje protokołu — do liczenia średnich z historii, niezależnie od pozycji. */
export const WSZYSTKIE_FAZY: Faza[] = Object.values(PROFILE).flatMap((p) => p.fazy);

/**
 * Której grupie odpowiada ZAPISANY protokół.
 *
 * Rozstrzyga sama zawartość, nie kartoteka. To ważne w dwie strony: raport wystawiony
 * bramkarzowi zachowa bramkarskie podpisy nawet po tym, jak ktoś zmieni mu pozycję w kartotece,
 * a raporty sprzed zmiany nie zaczną pokazywać cudzych nazw przy swoich liczbach.
 *
 * `null` znaczy „to stary protokół faz gry albo pusty" — wtedy zostają cztery fazy gry.
 */
export function grupaZFaz(fazy: unknown): GrupaPozycji | null {
  if (!fazy || typeof fazy !== "object") return null;
  const obiekt = fazy as Record<string, unknown>;
  for (const [grupa, profil] of Object.entries(PROFILE)) {
    if (profil.fazy.some((f) => obiekt[f.key] != null)) return grupa as GrupaPozycji;
  }
  return null;
}

/** Czy ten protokół jest bramkarski. Zostawione osobno, bo czyta się lepiej w warunkach. */
export const fazyToBramkarskie = (fazy: unknown): boolean => grupaZFaz(fazy) === "bramkarz";

// Stałe fragmenty zostają wspólne dla wszystkich. Rzuty rożne i wolne przeżywa tak samo cały
// zespół — tyle że z różnych stron — więc rozdzielanie ich niczego by nie wniosło, a raport
// przestałby się zgadzać między pozycjami.
