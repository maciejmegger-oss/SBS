// CENNIK PAKIETÓW — jedno miejsce, w którym zmienia się ceny.
//
// TU I TYLKO TU. Kwoty nie są wpisane w index.html ani rozrzucone po widokach — strona prosi
// o nie ten plik. Zmiana ceny to poprawienie jednej liczby poniżej; reszta (trzy okresy, dwie
// waluty, trzy języki, przeliczenie na miesiąc) policzy się sama.
//
// DLACZEGO TRZY OKRESY, A NIE ABONAMENT MIESIĘCZNY
// Okno transferowe trwa mniej więcej kwartał: lato lipiec–początek września, zima koniec
// stycznia–luty. Abonament miesięczny albo kwartalny w cenie 1/4 rocznego byłby zaproszeniem
// do wykupienia dostępu na jedno okno, przerobienia całej bazy i zniknięcia do stycznia —
// czyli sto procent wartości za dwadzieścia pięć procent ceny.
//
// Dlatego krótszy okres kosztuje WIĘCEJ w przeliczeniu na miesiąc, i to widocznie:
// cztery kwartały to 160% ceny rocznej, dwa półrocza 120%. Sezon broni się sam, bez rabatów
// i bez negocjacji, a kto naprawdę potrzebuje jednego okna — płaci za ten przywilej.
//
// DWIE WALUTY, BO TO DWA RYNKI
// Polski klub może te dane zebrać sam, z mozołem — więc płaci cenę krajową. Klub z Niemiec czy
// Holandii nie ma nawet od czego zacząć: IV ligi i roczników 2011–2014 nie pokazuje żaden
// komercyjny serwis. Za brak alternatywy płaci się więcej i nie ma w tym nic niestosownego —
// w oprogramowaniu dla firm cena zależna od rynku jest regułą, nie wyjątkiem.

export type Okres = 'sezon' | 'polrocze' | 'kwartal';
export type Waluta = 'pln' | 'eur';

// ---------------------------------------------------------------------------
// CENY ZA SEZON (12 miesięcy). Netto, za jedno konto.
// ---------------------------------------------------------------------------
// Klucz musi być dokładnie taki sam jak data-pakiet na przycisku w index.html — po nim
// strona łączy cenę z kartą.
export const CENY: Record<string, Record<Waluta, number>> = {
  'Ekstraklasa':          { pln:  4800, eur: 2200 },
  'I liga':               { pln:  4800, eur: 2200 },
  'II liga':              { pln:  3600, eur: 1900 },
  'III liga':             { pln:  3000, eur: 1600 },
  'IV liga':              { pln:  2400, eur: 1400 },
  // NAJDROŻSZY POJEDYNCZY PAKIET — i to nie pomyłka. Roczniki 2011–2014 i Centralna Liga
  // Juniorów to jedyne dane, których nie ma nigdzie indziej. Tam siedzi przewaga tego systemu,
  // więc tam stoi najwyższa cena. Ekstraklasę ma każdy, dlatego jest tu dodatkiem, nie towarem.
  'Kategorie juniorskie': { pln:  6000, eur: 2400 },
  'Premium':              { pln: 18000, eur: 5900 },
};

// Ile trzeba zapłacić za krótszy okres. Liczby celowo NIE są proporcjonalne do długości.
export const MNOZNIKI: Record<Okres, number> = { sezon: 1, polrocze: 0.6, kwartal: 0.4 };
const MIESIECY: Record<Okres, number> = { sezon: 12, polrocze: 6, kwartal: 3 };

export const OKRESY: Okres[] = ['sezon', 'polrocze', 'kwartal'];

type Slownik = Record<string, string>;
const NAPISY: Record<string, Slownik> = {
  pl: { sezon: 'Sezon', polrocze: 'Półrocze', kwartal: 'Kwartał', mies: 'mies.', za: 'za', netto: 'netto' },
  en: { sezon: 'Season', polrocze: 'Half-year', kwartal: 'Quarter', mies: 'mo.', za: 'per', netto: 'excl. VAT' },
  de: { sezon: 'Saison', polrocze: 'Halbjahr', kwartal: 'Quartal', mies: 'Mon.', za: 'pro', netto: 'zzgl. MwSt.' },
};

// Polski czyta ceny w złotych, angielski i niemiecki w euro — patrz uwaga o dwóch rynkach wyżej.
export const walutaDlaJezyka = (jezyk: string): Waluta => (jezyk === 'pl' ? 'pln' : 'eur');

// Kwota z niełamliwą spacją w tysiącach: „4 800 zł" nie może się złamać na końcu wiersza.
//
// useGrouping:'always' jest tu konieczne, a nie ozdobne. Polska konwencja typograficzna
// NIE rozdziela liczb czterocyfrowych, więc bez tego wychodziło „4800 zł" obok „18 000 zł" —
// w jednej tabeli cennika dwa różne zapisy tej samej rzeczy. Przy cenach to wygląda na pomyłkę,
// nawet jeśli formalnie jest poprawne.
function kwota(wartosc: number, waluta: Waluta, jezyk: string): string {
  const zaokraglona = Math.round(wartosc);
  const liczba = zaokraglona
    .toLocaleString(jezyk === 'pl' ? 'pl-PL' : 'de-DE', { useGrouping: 'always' } as any)
    .replace(/\s/g, ' ');
  return waluta === 'pln' ? `${liczba} zł` : `${liczba} €`;
}

export interface CenaDoPokazania {
  glowna: string;      // „10 800 zł"
  miesiecznie: string; // „1 800 zł / mies."
}

export function policzCene(pakiet: string, okres: Okres, jezyk: string): CenaDoPokazania | null {
  const wpis = CENY[pakiet];
  if (!wpis) return null;
  const waluta = walutaDlaJezyka(jezyk);
  const n = NAPISY[jezyk] || NAPISY.pl;
  const zaOkres = wpis[waluta] * MNOZNIKI[okres];
  return {
    glowna: kwota(zaOkres, waluta, jezyk),
    // PRZELICZENIE NA MIESIĄC POKAZUJE PRAWDĘ o krótszych okresach: przy kwartale wychodzi
    // drożej niż przy sezonie. Nie ukrywamy tego — to jest właśnie ten argument, który sam
    // przekonuje do rocznego, bez ani jednego zdania sprzedażowego.
    miesiecznie: `${kwota(zaOkres / MIESIECY[okres], waluta, jezyk)} / ${n.mies}`,
  };
}

export const nazwaOkresu = (okres: Okres, jezyk: string): string =>
  (NAPISY[jezyk] || NAPISY.pl)[okres];

// ---------------------------------------------------------------------------
// ANALIZA INDYWIDUALNA — oferta dla zawodnika, nie dla klubu
// ---------------------------------------------------------------------------
//
// To jest DRUGI, osobny rynek. Klub kupuje dostęp do bazy na sezon; zawodnik albo jego rodzic
// kupuje jedną rzecz: ocenę konkretnego chłopaka. Dlatego ceny są jednorazowe, a nie
// abonamentowe, i nie przechodzą przez przełącznik Sezon / Półrocze / Kwartał.
//
// DLACZEGO TA OFERTA MA NAJCZYSTSZĄ PODSTAWĘ PRAWNĄ W CAŁYM SYSTEMIE
// Przy bazie klubowej dane zawodników zbieramy bez ich udziału — ze źródeł publicznych
// i z obserwacji. Tutaj jest odwrotnie: zawodnik albo rodzic SAM SIĘ ZGŁASZA i podpisuje
// zgodę. Żadnego uzasadnionego interesu, żadnego obowiązku z art. 14, żadnych wątpliwości
// przy małoletnich — o ile zgłoszenie składa opiekun prawny.
//
// Jedyne pole minowe to dodatki: analizę mentalną i motoryczną wykonuje specjalista, nie my.
// Marża to różnica między ceną tutaj a jego stawką — i to trzeba znać PRZED sprzedażą.

export interface UslugaIndywidualna {
  klucz: string;
  cena: Record<Waluta, number>;
  cykliczna?: boolean;   // monitoring rozlicza się miesięcznie, reszta jednorazowo
  dodatek?: boolean;     // dopłata do analizy, nie usługa samodzielna
}

export const USLUGI_INDYWIDUALNE: UslugaIndywidualna[] = [
  { klucz: 'analiza-podstawowa', cena: { pln: 490, eur: 149 } },
  { klucz: 'analiza-pelna',      cena: { pln: 890, eur: 269 } },
  { klucz: 'monitoring',         cena: { pln: 290, eur:  89 }, cykliczna: true },
  { klucz: 'dod-mentalna',       cena: { pln: 390, eur: 119 }, dodatek: true },
  { klucz: 'dod-motoryczna',     cena: { pln: 490, eur: 149 }, dodatek: true },
  { klucz: 'dod-plan',           cena: { pln: 590, eur: 179 }, dodatek: true },
];

// Kwota do pokazania na karcie: „490 zł", „290 zł / mies.", „+390 zł".
export function cenaUslugi(klucz: string, jezyk: string): string {
  const u = USLUGI_INDYWIDUALNE.find((x) => x.klucz === klucz);
  if (!u) return '';
  const n = NAPISY[jezyk] || NAPISY.pl;
  const kwotaTekst = kwota(u.cena[walutaDlaJezyka(jezyk)], walutaDlaJezyka(jezyk), jezyk);
  if (u.cykliczna) return `${kwotaTekst} / ${n.mies}`;
  // Plus przy dodatku nie jest ozdobą: mówi, że to DOPŁATA do analizy, a nie jej zamiennik.
  return u.dodatek ? `+ ${kwotaTekst}` : kwotaTekst;
}
