// CO DECYDUJE NA DANEJ POZYCJI — przypisanie elementów profilu do profili pozycyjnych.
//
// SKĄD SIĘ TO WZIĘŁO I CZEGO NIE MA W ARKUSZU
// Arkusz klubowy ocenia każdego zawodnika tym samym zestawem 48 elementów — nie mówi, które z nich
// rozstrzygają o grze stopera, a które o grze skrzydłowego. To jest właśnie ten podział: „aspekty
// w profilu podzielone na dane pozycje". Lista KLUCZOWYCH jest decyzją skautingową, nie danymi
// z pliku, więc wolno ją poprawiać — ten plik pisze się ręcznie (w odróżnieniu od
// profil-kompetencji.ts, który generuje skrypt).
//
// JAK Z TEGO KORZYSTA SYSTEM
// Profil zawodnika liczy średnią z elementów KLUCZOWYCH dla jego pozycji osobno od średniej ze
// wszystkich. Stoper z oceną 6 za finalizację i 3 za powstrzymanie nie może wyglądać tak samo jak
// stoper odwrotnie oceniony, a przy jednej wspólnej średniej wygląda identycznie.
//
// NUMERY wg Narodowego Modelu Gry — te same, którymi posługuje się cała aplikacja (POSITION_NUMBERS).

import { OBSZARY_PROFILU } from "./profil-kompetencji";

export interface ProfilPozycji {
  /** Skrót używany przez klub w arkuszu: DCM (6), CB (4/5), LW/RW (7/11)… */
  kod: string;
  nazwa: string;
  /** Numery NMG, które ten profil obsługuje. */
  numery: number[];
  /** Elementy rozstrzygające o grze na tej pozycji. */
  kluczowe: string[];
  /** Czego ten profil w arkuszu nie ma — mówimy wprost, zamiast udawać pełną ocenę. */
  brakWArkuszu?: string;
}

export const PROFILE_POZYCJI: ProfilPozycji[] = [
  {
    kod: "GK (1)", nazwa: "Bramkarz", numery: [1],
    // Arkusz klubowy jest szablonem dla zawodnika z pola — nie ma w nim ani jednego elementu
    // bramkarskiego. Udawanie, że ocena 1–6 z „dryblingu" opisuje bramkarza, byłoby zmyślaniem.
    brakWArkuszu: "Arkusz nie zawiera elementów bramkarskich (gra na linii, wyjścia, 1x1 z napastnikiem, "
      + "gra nogami pod pressingiem, organizacja obrony). Dla bramkarzy trzeba dopisać osobny obszar.",
    kluczowe: ["PERCEPCJA", "ANTYCYPACJA", "KONTROLA", "KOMUNIKACJA", "OPANOWANIE EMOCJI",
      "ODPORNOŚĆ NA STRES", "KRÓTKIE PODANIE", "DŁUGIE PODANIE", "KOORDYNACJA"],
  },
  {
    kod: "CB (4/5)", nazwa: "Stoper", numery: [4, 5],
    kluczowe: ["POWSTRZYMANIE", "ANTYCYPACJA", "KONTROLA", "ASEKURACJA DEFENSYWNA",
      "UKIERUNKOWYWANIE PRZECIWNIKA", "1X1 (OBRONA)", "GRA GŁOWĄ", "DŁUGIE PODANIE",
      "POSTĘP", "PERCEPCJA", "SIŁA", "MOC", "LIDER", "KOMUNIKACJA"],
  },
  {
    kod: "LCB/RCB (3/4 - 2/5)", nazwa: "Stoper w trójce obrony", numery: [4, 5],
    kluczowe: ["POWSTRZYMANIE", "ANTYCYPACJA", "KONTROLA", "ASEKURACJA DEFENSYWNA",
      "1X1 (OBRONA)", "GRA GŁOWĄ", "POSTĘP", "DRYBLING / KONTROLA PIŁKI", "DŁUGIE PODANIE",
      "POZYCJA OTWARTA", "SZYBKOŚĆ", "SIŁA", "KOMUNIKACJA"],
  },
  {
    kod: "LB/RB (2/3)", nazwa: "Obrońca boczny", numery: [2, 3],
    kluczowe: ["1X1 (OBRONA)", "KONTROLA", "POWSTRZYMANIE", "REAKCJA PO STRACIE",
      "POZYCJA OTWARTA", "PRZESTRZEŃ / MOBILNOŚĆ", "KRÓTKIE PODANIE", "DOŚRODKOWANIE",
      "SZYBKOŚĆ", "WYTRZYMAŁOŚĆ", "W.SZYBKOŚCIOWA"],
  },
  {
    kod: "LBW/RBW (2/7 - 3/11)", nazwa: "Wahadłowy", numery: [2, 3],
    kluczowe: ["PRZESTRZEŃ / MOBILNOŚĆ", "POZYCJA OTWARTA", "DOŚRODKOWANIE",
      "DRYBLING / KONTROLA PIŁKI", "ZRYWANIE KRYCIA", "1X1 (OBRONA)", "REAKCJA PO STRACIE",
      "SZYBKOŚĆ", "WYTRZYMAŁOŚĆ", "W.SZYBKOŚCIOWA", "DETERMINACJA"],
  },
  {
    kod: "DCM (6)", nazwa: "Defensywny pomocnik", numery: [6],
    kluczowe: ["POSTĘP", "WSPARCIE", "PERCEPCJA", "KONTROLA TEMPA I KIERUNKU", "REAKCJA NA ODBIÓR",
      "POWSTRZYMANIE", "ANTYCYPACJA", "REAKCJA PO STRACIE", "ASEKURACJA DEFENSYWNA",
      // „Szóstka" zmienia stronę gry — długie podanie liczy się u niej tak samo jak krótkie.
      "KRÓTKIE PODANIE", "DŁUGIE PODANIE", "PRZYJĘCIE PIŁKI / 1ST TOUCH", "WYTRZYMAŁOŚĆ", "KOMUNIKACJA"],
  },
  {
    kod: "CM (8)", nazwa: "Środkowy pomocnik", numery: [8],
    kluczowe: ["POSTĘP", "POZYCJA OTWARTA", "WSPARCIE", "PRZESTRZEŃ / MOBILNOŚĆ", "PERCEPCJA",
      "KONTROLA TEMPA I KIERUNKU", "REAKCJA NA ODBIÓR", "REAKCJA PO STRACIE", "KRÓTKIE PODANIE",
      "PRZYJĘCIE PIŁKI / 1ST TOUCH", "DRYBLING / KONTROLA PIŁKI", "WYTRZYMAŁOŚĆ"],
  },
  {
    kod: "ACM (10)", nazwa: "Ofensywny pomocnik", numery: [10],
    kluczowe: ["POZYCJA OTWARTA", "ZRYWANIE KRYCIA", "MOMENTY SKUPIENIA", "KONTROLA TEMPA I KIERUNKU",
      "FINALIZACJA", "PERCEPCJA", "PRZESTRZEŃ / MOBILNOŚĆ", "DRYBLING / KONTROLA PIŁKI",
      "PRZYJĘCIE PIŁKI / 1ST TOUCH", "UDERZENIE PIŁKI", "ZWINNOŚĆ", "PEWNOŚĆ SIEBIE"],
  },
  {
    kod: "LW/RW (7/11)", nazwa: "Skrzydłowy", numery: [7, 11],
    kluczowe: ["ZRYWANIE KRYCIA", "DRYBLING / KONTROLA PIŁKI", "FINALIZACJA", "DOŚRODKOWANIE",
      "PRZESTRZEŃ / MOBILNOŚĆ", "UDERZENIE PIŁKI", "REAKCJA PO STRACIE",
      "SZYBKOŚĆ", "ZWINNOŚĆ", "W.SZYBKOŚCIOWA", "PEWNOŚĆ SIEBIE"],
  },
  {
    kod: "CF (9)", nazwa: "Napastnik", numery: [9],
    kluczowe: ["FINALIZACJA", "ZRYWANIE KRYCIA", "MOMENTY SKUPIENIA", "UDERZENIE PIŁKI",
      "GRA GŁOWĄ", "PRZYJĘCIE PIŁKI / 1ST TOUCH", "UKIERUNKOWYWANIE PRZECIWNIKA",
      "SIŁA", "MOC", "SZYBKOŚĆ", "ODPORNOŚĆ NA STRES"],
  },
];

/** Profil pozycyjny dla numeru NMG z kartoteki. Dla 2/3 i 4/5 zwraca wariant podstawowy. */
export function profilDlaNumeru(numer: number): ProfilPozycji | null {
  if (!numer) return null;
  const podstawowe = ["GK (1)", "CB (4/5)", "LB/RB (2/3)", "DCM (6)", "CM (8)", "ACM (10)", "LW/RW (7/11)", "CF (9)"];
  return PROFILE_POZYCJI.find((p) => podstawowe.includes(p.kod) && p.numery.includes(numer)) || null;
}

/** Profil po skrócie z arkusza klubowego („DCM (6)"), także gdy zapisano go bez numeru. */
export function profilPoKodzie(kod: string): ProfilPozycji | null {
  const norm = (s: string) => s.toUpperCase().replace(/\s+/g, "").replace(/[()]/g, "");
  const szukany = norm(kod || "");
  if (!szukany) return null;
  return PROFILE_POZYCJI.find((p) => norm(p.kod) === szukany)
    || PROFILE_POZYCJI.find((p) => norm(p.kod).startsWith(szukany.split("/")[0]) && szukany.length >= 2)
    || null;
}

/** Czy element rozstrzyga o grze na tej pozycji. */
export function kluczowyNaPozycji(element: string, profil: ProfilPozycji | null): boolean {
  return !!profil && profil.kluczowe.includes(element);
}

/** Wszystkie nazwy elementów z taksonomii — do sprawdzenia, że listy wyżej nie mają literówek. */
export function wszystkieElementy(): string[] {
  return OBSZARY_PROFILU.flatMap((o) => o.elementy.filter((e) => !e.testy).map((e) => e.nazwa));
}
