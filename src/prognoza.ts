// PROGNOZA ZAWODNIKA — NA JAKI POZIOM GO STAĆ.
//
// PO CO TO JEST
// Dyrektor sportowy nie kupuje ocen, tylko odpowiedź na jedno pytanie: „czy ten chłopak udźwignie
// moją ligę?". Raport skautingowy opisuje, JAK zawodnik grał; prognoza mówi, DOKĄD może dojść —
// na tej samej drabinie 21 stopni, której klub używa w swoim arkuszu kompetencji, gdzie każdy
// stopień to zdanie po polsku („pierwsza jedenastka 1. ligi", „kluczowy zawodnik Ekstraklasy").
//
// CZEGO TU NIE MA: zgadywania. Prognoza albo stoi na faktach, albo jej nie ma. Trzy twarde bramki
// — minuty, historia sezonów, raport z oceną — zamykają drogę liczbie wziętej z powietrza. Lepiej
// napisać „nie wiem, brakuje mi tego i tego" niż podać pułap, który rozsypie się przy pierwszym
// sprawdzeniu. To jest produkt sprzedawany menedżerowi klubowemu: jedna pewna siebie bzdura kosztuje
// więcej niż dziesięć uczciwych odmów.
//
// CZYM TO NIE JEST: modelem uczonym na danych. Nie mamy jeszcze historii trafień — nie wiemy, ilu
// zawodników ocenionych dwa lata temu faktycznie weszło do Ekstraklasy. To jest system regułowy
// spisany z wytycznych klubu, przejrzysty i podważalny: każdy składnik widać w wyniku z osobna,
// razem z liczbą punktów, którą dołożył. Kalibracja przyjdzie, gdy baza dorobi się własnych
// rozstrzygnięć.

/** Jeden składnik prognozy — nazwa, ile punktów dołożył i dlaczego. */
export type Skladnik = { nazwa: string; punkty: number; opis: string };

export type WynikPrognozy = {
  mozliwa: boolean;
  braki: string[];
  stopienTeraz: number | null;
  rolaTeraz: string;
  pulapOd: number | null;
  pulapDo: number | null;
  horyzont: string;
  pewnosc: "WYSOKA" | "ŚREDNIA" | "NISKA" | "";
  skladniki: Skladnik[];
};

export type SezonKariery = {
  sezon?: string;
  klub?: string;
  rozgrywki?: string;
  wystepy?: number;
  wPodstawowym?: number;
  minuty?: number;
  gole?: number;
};

export type MeczPrzebiegu = {
  minuty?: number;
  podstawowy?: boolean;
  odMinuty?: number | null;
  gole?: number;
};

export type DanePrognozy = {
  wiek: number | null;
  pozycja: string;
  poziomTeraz: string;
  przebieg: MeczPrzebiegu[];
  sezony: SezonKariery[];
  ocenyAtrybutow: Record<string, number> | null;
  perspektywa: string;
  /** Mediana goli na 90 minut wśród zawodników tej samej pozycji i poziomu — tło do skuteczności. */
  goleNa90Odniesienie?: number | null;
};

// ---- BRAMKI WEJŚCIOWE -------------------------------------------------------------------------

/** Mniej niż tyle minut to nie jest próbka, tylko epizod — z epizodu nie stawiamy prognozy. */
export const MINIMUM_MINUT = 180;

// ---- DRABINA: GDZIE NA NIEJ STOI DANY POZIOM ROZGRYWEK -----------------------------------------
//
// Drabina z arkusza klubowego jest akademijna: schodzi od Ligi Mistrzów przez Ekstraklasę i 1.-2.
// ligę prosto do CLJ U19. III i IV ligi nie ma na niej wcale — a to w nich gra większość kartoteki.
// Wstawiamy je więc w lukę między „kluczowy zawodnik U19 CLJ" (8) a „pierwsza jedenastka 2. ligi"
// (11), zgodnie z tym, czym te poziomy są w praktyce. To jedyne miejsce, w którym dokładamy coś od
// siebie do drabiny klubu — i dlatego stoi osobno, zamiast cicho zmieniać arkusz.
//
// Rola bierze się z minut: ten sam poziom rozgrywek znaczy co innego dla zawodnika grającego
// osiemdziesiąt procent minut, a co innego dla wchodzącego na kwadrans.
const STOPIEN_POZIOMU: { wzor: RegExp; kluczowy: number; podstawowy: number; rotacyjny: number; epizod: number }[] = [
  { wzor: /^Ekstraklasa/i,        kluczowy: 15, podstawowy: 13, rotacyjny: 12, epizod: 10 },
  { wzor: /^I liga\b/i,           kluczowy: 13, podstawowy: 12, rotacyjny: 11, epizod: 10 },
  { wzor: /^II liga\b/i,          kluczowy: 12, podstawowy: 11, rotacyjny: 10, epizod: 9 },
  { wzor: /^III liga\b/i,         kluczowy: 10, podstawowy: 9,  rotacyjny: 8,  epizod: 7 },
  { wzor: /^IV liga\b/i,          kluczowy: 8,  podstawowy: 7,  rotacyjny: 6,  epizod: 5 },
  { wzor: /^Klasa okręgowa/i,     kluczowy: 6,  podstawowy: 5,  rotacyjny: 4,  epizod: 3 },
  { wzor: /^CLJ U1?9|^CLJ U19/i,  kluczowy: 8,  podstawowy: 7,  rotacyjny: 6,  epizod: 5 },
  { wzor: /^CLJ U17/i,            kluczowy: 7,  podstawowy: 6,  rotacyjny: 5,  epizod: 4 },
  { wzor: /^CLJ U16|Liga makroregionalna U16/i, kluczowy: 6, podstawowy: 5, rotacyjny: 4, epizod: 3 },
  { wzor: /^CLJ U15/i,            kluczowy: 5,  podstawowy: 4,  rotacyjny: 3,  epizod: 2 },
];

/** Poziom rozgrywek bez grupy: „IV liga (opolska)" → „IV liga", „CLJ U17 gr. II" → „CLJ U17". */
export function poziomBezGrupy(nazwa: string): string {
  return String(nazwa || "").replace(/\s*[\(,].*$/, "").replace(/\s+gr\..*$/i, "").trim();
}

/** Im niżej liczba, tym wyższy szczebel. Nieznane rozgrywki lądują na końcu. */
export function rangaPoziomu(nazwa: string): number {
  const i = STOPIEN_POZIOMU.findIndex((x) => x.wzor.test(poziomBezGrupy(nazwa)));
  return i >= 0 ? i : 99;
}

// ---- ROLA W DRUŻYNIE Z MINUT -------------------------------------------------------------------
//
// „Pierwsza jedenastka" i „kluczowy zawodnik" to słowa z drabiny, a my mamy je czym zmierzyć:
// protokoły ŁNP dają minuta po minucie, kto wyszedł w pierwszym składzie i kiedy wszedł z ławki.
// To właśnie zamienia opinię w liczbę — i to jest miejsce, w którym ta prognoza różni się od
// wpisania przez skauta liczby „z oka".
export function rolaZPrzebiegu(przebieg: MeczPrzebiegu[]): { rola: string; udzial: number; startow: number; meczow: number } {
  const lista = (przebieg || []).filter(Boolean);
  const meczow = lista.length;
  if (!meczow) return { rola: "brak", udzial: 0, startow: 0, meczow: 0 };
  const minuty = lista.reduce((s, m) => s + (Number(m.minuty) || 0), 0);
  const startow = lista.filter((m) => m.podstawowy).length;
  const udzial = minuty / (meczow * 90);
  // Kluczowy to nie tylko dużo minut — to „trener stawia go od pierwszej minuty". Zawodnik
  // wchodzący co mecz na pół godziny uzbiera podobny udział, a to zupełnie inna rola.
  let rola = "epizod";
  if (udzial >= 0.8 && startow / meczow >= 0.8) rola = "kluczowy";
  else if (udzial >= 0.6) rola = "podstawowy";
  else if (udzial >= 0.25) rola = "rotacyjny";
  return { rola, udzial, startow, meczow };
}

/** Stopień na drabinie dla pary (poziom rozgrywek, rola). */
export function stopienZaPoziom(poziom: string, rola: string): number | null {
  const def = STOPIEN_POZIOMU.find((x) => x.wzor.test(poziomBezGrupy(poziom)));
  if (!def) return null;
  if (rola === "kluczowy") return def.kluczowy;
  if (rola === "podstawowy") return def.podstawowy;
  if (rola === "rotacyjny") return def.rotacyjny;
  return def.epizod;
}

// ---- WIEK ---------------------------------------------------------------------------------------
//
// Trzy przedziały wskazane przez klub. Drugi i trzeci dostają najwyższy mnożnik — to wiek, w którym
// zawodnik realizuje swój poziom. Nastolatek jest oceniany ostrożniej, a po trzydziestce prognoza
// wzrostu praktycznie się zamyka.
//
// UWAGA PRZY STROJENIU: ta tabela decyduje o tym, że siedemnastolatek z takimi samymi ocenami jak
// dwudziestotrzylatek dostanie niższy pułap. Jeśli kiedyś okaże się, że system przegapia młodych,
// to jest jedyne miejsce, które trzeba ruszyć.
export const MNOZNIK_WIEKU: { od: number; do: number; mnoznik: number; opis: string }[] = [
  { od: 15, do: 20, mnoznik: 0.7, opis: "15-21 lat — przed wiekiem najwyższej progresji" },
  { od: 21, do: 25, mnoznik: 1.0, opis: "21-25 lat — wiek najwyższej progresji" },
  { od: 26, do: 30, mnoznik: 1.0, opis: "26-30 lat — wiek najwyższej progresji" },
  { od: 31, do: 99, mnoznik: 0.3, opis: "po trzydziestce — pułap zwykle już osiągnięty" },
];

export function mnoznikWieku(wiek: number | null): { mnoznik: number; opis: string } {
  if (wiek == null || !Number.isFinite(wiek)) return { mnoznik: 0.7, opis: "wiek nieznany — liczymy ostrożnie" };
  const p = MNOZNIK_WIEKU.find((x) => wiek >= x.od && wiek <= x.do);
  return p ? { mnoznik: p.mnoznik, opis: p.opis } : { mnoznik: 0.3, opis: "wiek poza przedziałami" };
}

// ---- ŚCIEŻKA PRZEZ POZIOMY ----------------------------------------------------------------------
//
// Sedno wytycznej: „ważne, żeby przechodził kolejne szczeble i progresował". Sezon z garstką minut
// nie jest szczeblem — żeby wiersz się liczył, musi mieć co najmniej tyle samo minut, co bramka
// wejściowa. Inaczej jeden mecz w pierwszej drużynie wyglądałby jak awans o poziom.
export function sciezkaPoziomow(sezony: SezonKariery[]): {
  istotne: SezonKariery[];
  kierunek: "w górę" | "stabilnie" | "w dół" | "nieznany";
  opis: string;
} {
  const istotne = (sezony || [])
    .filter((s) => s && (Number(s.minuty) || 0) >= MINIMUM_MINUT && rangaPoziomu(s.rozgrywki || "") < 99);
  if (istotne.length < 2) return { istotne, kierunek: "nieznany", opis: "za mało sezonów z realną liczbą minut" };
  // Sezony przychodzą od najnowszego; porównujemy dwa ostatnie poziomy.
  const teraz = rangaPoziomu(istotne[0].rozgrywki || "");
  const przedtem = rangaPoziomu(istotne[1].rozgrywki || "");
  if (teraz < przedtem) {
    return { istotne, kierunek: "w górę",
      opis: `awans: ${poziomBezGrupy(istotne[1].rozgrywki || "")} → ${poziomBezGrupy(istotne[0].rozgrywki || "")}` };
  }
  if (teraz > przedtem) {
    return { istotne, kierunek: "w dół",
      opis: `spadek poziomu: ${poziomBezGrupy(istotne[1].rozgrywki || "")} → ${poziomBezGrupy(istotne[0].rozgrywki || "")}` };
  }
  return { istotne, kierunek: "stabilnie", opis: `drugi sezon na poziomie ${poziomBezGrupy(istotne[0].rozgrywki || "")}` };
}

/** Czy rośnie udział meczów od pierwszej minuty — sezon do sezonu. */
export function progresjaStartow(sezony: SezonKariery[]): { kierunek: "w górę" | "stabilnie" | "w dół" | "nieznany"; opis: string } {
  const z = (sezony || []).filter((s) => s && (Number(s.wystepy) || 0) >= 3 && s.wPodstawowym != null);
  if (z.length < 2) return { kierunek: "nieznany", opis: "za mało sezonów z rozbiciem na pierwszy skład" };
  const udzial = (s: SezonKariery) => (Number(s.wPodstawowym) || 0) / (Number(s.wystepy) || 1);
  const roznica = udzial(z[0]) - udzial(z[1]);
  const proc = (x: number) => Math.round(x * 100) + "%";
  if (roznica >= 0.15) return { kierunek: "w górę", opis: `starty w pierwszym składzie: ${proc(udzial(z[1]))} → ${proc(udzial(z[0]))}` };
  if (roznica <= -0.15) return { kierunek: "w dół", opis: `mniej gry od pierwszej minuty: ${proc(udzial(z[1]))} → ${proc(udzial(z[0]))}` };
  return { kierunek: "stabilnie", opis: `starty w pierwszym składzie bez zmian (${proc(udzial(z[0]))})` };
}

// ---- SKUTECZNOŚĆ NA TLE POZYCJI ------------------------------------------------------------------
//
// „Jeśli obrońca ma gole, to duży plus". Ta sama liczba bramek znaczy co innego na każdej pozycji,
// więc porównujemy do tego, co na tej pozycji normalne. Gdy nie mamy z czym porównać (za mało
// ocenionych rywali), używamy progów orientacyjnych zamiast udawać, że mamy rozkład.
const GOLE_NA_90_TYPOWE: { wzor: RegExp; typowe: number }[] = [
  { wzor: /bramkarz/i, typowe: 0.0 },
  { wzor: /obrońca|obronca/i, typowe: 0.05 },
  { wzor: /pomocnik defensywny/i, typowe: 0.06 },
  { wzor: /pomocnik/i, typowe: 0.12 },
  { wzor: /skrzydł|skrzydl/i, typowe: 0.22 },
  { wzor: /napastnik/i, typowe: 0.35 },
];

export function skutecznoscNaPozycji(
  pozycja: string, gole: number, minuty: number, odniesienie?: number | null
): { punkty: number; opis: string } {
  if (!minuty || minuty < MINIMUM_MINUT) return { punkty: 0, opis: "za mało minut, żeby liczyć skuteczność" };
  const na90 = (gole || 0) / (minuty / 90);
  const typowe = odniesienie != null && Number.isFinite(odniesienie)
    ? odniesienie
    : (GOLE_NA_90_TYPOWE.find((x) => x.wzor.test(String(pozycja || "")))?.typowe ?? 0.12);
  const fmt = (x: number) => x.toFixed(2).replace(".", ",");
  // Bramkarz z golami to kuriozum, nie przesłanka — tej osi dla niego nie liczymy.
  if (/bramkarz/i.test(String(pozycja || ""))) return { punkty: 0, opis: "bramkarz — skuteczności strzeleckiej nie oceniamy" };
  if (typowe <= 0.001) return { punkty: gole > 0 ? 1 : 0, opis: gole > 0 ? `${gole} gol(e) z tej pozycji to wyraźny plus` : "bez goli" };
  if (na90 >= typowe * 2) return { punkty: 1, opis: `${fmt(na90)} gola/90 przy typowych ${fmt(typowe)} na tej pozycji — dwukrotnie powyżej` };
  if (na90 >= typowe * 1.3) return { punkty: 0.5, opis: `${fmt(na90)} gola/90 przy typowych ${fmt(typowe)} — powyżej normy pozycji` };
  if (na90 <= typowe * 0.3) return { punkty: -0.5, opis: `${fmt(na90)} gola/90 przy typowych ${fmt(typowe)} — wyraźnie poniżej` };
  return { punkty: 0, opis: `${fmt(na90)} gola/90 — typowo dla tej pozycji` };
}

// ---- DYSTANS Z OCENY POTENCJAŁU ------------------------------------------------------------------
//
// Ocena potencjału 1-6 nie mówi, NA JAKIM poziomie zawodnik wyląduje — mówi, ILE STOPNI ponad to,
// co pokazuje dziś, da się jeszcze z niego wyciągnąć. Dopiero przemnożona przez wiek staje się
// prognozą: ta sama czwórka znaczy co innego u dwudziestolatka, a co innego u trzydziestolatka.
export function dystansZPotencjalu(ocena: number | null | undefined): { punkty: number; opis: string } {
  const v = Number(ocena);
  if (!Number.isFinite(v) || v <= 0) return { punkty: 0, opis: "skaut nie wystawił oceny potencjału" };
  if (v >= 6) return { punkty: 4, opis: "potencjał 6/6 — poziom międzynarodowy" };
  if (v >= 5) return { punkty: 3, opis: "potencjał 5/6 — wybitny w swojej kategorii" };
  if (v >= 4) return { punkty: 2, opis: "potencjał 4/6 — wiodący we własnym środowisku" };
  if (v >= 3) return { punkty: 1, opis: "potencjał 3/6 — przeciętny we własnym środowisku" };
  return { punkty: 0, opis: `potencjał ${v}/6 — bez zapasu na wyższy poziom` };
}

export function dodatekZaPerspektywe(perspektywa: string): { punkty: number; opis: string } {
  const p = String(perspektywa || "").toUpperCase();
  if (p === "WYSOKA") return { punkty: 1, opis: "perspektywa WYSOKA" };
  if (p === "NISKA") return { punkty: -1, opis: "perspektywa NISKA" };
  if (p === "ŚREDNIA") return { punkty: 0, opis: "perspektywa ŚREDNIA" };
  return { punkty: 0, opis: "perspektywa niewskazana" };
}

// ---- HORYZONT ------------------------------------------------------------------------------------
function horyzontCzasowy(wiek: number | null, dystans: number): string {
  if (dystans <= 0) return "jest na swoim poziomie";
  if (wiek == null) return dystans >= 3 ? "4-6 lat" : "2-3 lata";
  if (wiek <= 20) return dystans >= 3 ? "5-7 lat" : "3-4 lata";
  if (wiek <= 25) return dystans >= 3 ? "3-4 lata" : "1-2 lata";
  if (wiek <= 30) return dystans >= 2 ? "2-3 lata" : "1-2 lata";
  return "1 sezon";
}

// ---- CAŁOŚĆ ---------------------------------------------------------------------------------------

export function prognozaZawodnika(d: DanePrognozy): WynikPrognozy {
  const pusta = (braki: string[]): WynikPrognozy => ({
    mozliwa: false, braki, stopienTeraz: null, rolaTeraz: "", pulapOd: null, pulapDo: null,
    horyzont: "", pewnosc: "", skladniki: [],
  });

  const przebieg = (d.przebieg || []).filter(Boolean);
  const minutyTeraz = przebieg.reduce((s, m) => s + (Number(m.minuty) || 0), 0);
  const sezony = (d.sezony || []).filter(Boolean);
  const minutyNajlepszySezon = sezony.reduce((mx, s) => Math.max(mx, Number(s.minuty) || 0), 0);

  // TRZY TWARDE BRAMKI. Zbieramy WSZYSTKIE braki naraz, a nie pierwszy z brzegu — skaut ma od razu
  // wiedzieć, czego dołożyć, zamiast poprawiać jedną rzecz i dostawać kolejną odmowę.
  const braki: string[] = [];
  if (Math.max(minutyTeraz, minutyNajlepszySezon) < MINIMUM_MINUT) {
    braki.push(`rozegrane minuty: ${Math.max(minutyTeraz, minutyNajlepszySezon)} z wymaganych ${MINIMUM_MINUT}`);
  }
  const sciezka = sciezkaPoziomow(sezony);
  if (sciezka.istotne.length < 2) {
    braki.push("historia poprzednich sezonów — potrzebne dwa poziomy rozgrywek z min. 180 minutami (dodaj link do 90minut i odśwież statystyki)");
  }
  const ocenaPotencjalu = d.ocenyAtrybutow ? Number(d.ocenyAtrybutow.potencjal) : NaN;
  if (!Number.isFinite(ocenaPotencjalu) || ocenaPotencjalu <= 0) {
    braki.push("raport z wystawioną oceną potencjału (1-6)");
  }
  if (braki.length) return pusta(braki);

  // STAN FAKTYCZNY — z poziomu rozgrywek i roli zmierzonej w minutach.
  const rola = rolaZPrzebiegu(przebieg);
  const poziom = d.poziomTeraz || sciezka.istotne[0].rozgrywki || "";
  const stopienTeraz = stopienZaPoziom(poziom, rola.rola);
  if (stopienTeraz == null) return pusta([`nieznany poziom rozgrywek: „${poziom || "—"}"`]);

  const skladniki: Skladnik[] = [];
  const dodaj = (nazwa: string, w: { punkty: number; opis: string }) => {
    skladniki.push({ nazwa, punkty: w.punkty, opis: w.opis });
    return w.punkty;
  };

  let dystans = 0;
  dystans += dodaj("Potencjał z raportu", dystansZPotencjalu(ocenaPotencjalu));
  dystans += dodaj("Perspektywa", dodatekZaPerspektywe(d.perspektywa));
  dystans += dodaj("Ścieżka przez poziomy", {
    punkty: sciezka.kierunek === "w górę" ? 1 : sciezka.kierunek === "w dół" ? -1 : 0,
    opis: sciezka.opis,
  });
  const starty = progresjaStartow(sezony);
  dystans += dodaj("Progresja gry od pierwszej minuty", {
    punkty: starty.kierunek === "w górę" ? 1 : starty.kierunek === "w dół" ? -1 : 0,
    opis: starty.opis,
  });
  const gole = przebieg.reduce((s, m) => s + (Number(m.gole) || 0), 0)
    || (Number(sciezka.istotne[0].gole) || 0);
  const minutyDoSkutecznosci = minutyTeraz >= MINIMUM_MINUT ? minutyTeraz : (Number(sciezka.istotne[0].minuty) || 0);
  dystans += dodaj("Skuteczność na tle pozycji", skutecznoscNaPozycji(d.pozycja, gole, minutyDoSkutecznosci, d.goleNa90Odniesienie));

  // WIEK JAKO MNOŻNIK, NIE DODATEK. Dodatek przesuwałby pułap każdemu tak samo; mnożnik skaluje to,
  // co zawodnik faktycznie pokazał — i dlatego zawodnikowi bez żadnych przesłanek wzrostu wiek
  // niczego nie dorzuci.
  const wiek = mnoznikWieku(d.wiek);
  const przedMnoznikiem = dystans;
  dystans = Math.max(0, dystans) * wiek.mnoznik;
  skladniki.push({
    nazwa: "Wiek", punkty: +(dystans - Math.max(0, przedMnoznikiem)).toFixed(2),
    opis: `${wiek.opis} (mnożnik ×${String(wiek.mnoznik).replace(".", ",")})`,
  });

  const dystansZaokr = Math.round(dystans);
  const pulap = Math.max(1, Math.min(21, stopienTeraz + dystansZaokr));

  // PEWNOŚĆ — ile pod tą liczbą stoi materiału. Trzy warunki, każdy wart jeden punkt.
  let punktyPewnosci = 0;
  if (minutyTeraz >= 900 || minutyNajlepszySezon >= 900) punktyPewnosci++;
  if (sciezka.istotne.length >= 3) punktyPewnosci++;
  if (rola.meczow >= 8) punktyPewnosci++;
  const pewnosc = punktyPewnosci >= 3 ? "WYSOKA" : punktyPewnosci >= 2 ? "ŚREDNIA" : "NISKA";

  // ZAKRES, NIE PUNKT. Prognoza punktowa, która się nie sprawdzi, zabija zaufanie do całego
  // narzędzia; przedział z uzasadnieniem obroni się nawet wtedy, gdy zawodnik z niego wyjdzie.
  // Im mniej materiału, tym szerszy.
  const rozrzut = pewnosc === "WYSOKA" ? 0 : pewnosc === "ŚREDNIA" ? 1 : 2;

  return {
    mozliwa: true,
    braki: [],
    stopienTeraz,
    rolaTeraz: rola.rola,
    pulapOd: Math.max(stopienTeraz, Math.min(21, pulap - rozrzut)),
    pulapDo: Math.max(1, Math.min(21, pulap + rozrzut)),
    horyzont: horyzontCzasowy(d.wiek, dystansZaokr),
    pewnosc,
    skladniki,
  };
}
