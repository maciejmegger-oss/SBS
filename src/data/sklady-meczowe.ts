// SKŁADY MECZOWE ODCZYTANE ZE SCHEMATU USTAWIENIA — 1. liga, 7. kolejka 2026/2027.
//
// PO CO TO JEST: pozycji zawodnika nie podaje ani 90minut, ani ŁNP. Transfermarkt podaje pozycję
// „w ogóle" (Obrońca środkowy), ale nie mówi, po której stronie zawodnik stoi ani jak głęboko.
// Schemat ustawienia z transmisji mówi to wprost — i tylko z niego da się wypełnić numer wg
// Narodowego Modelu Gry, na którym opiera się mapa zespołu i mapa pozycji w Rankingu.
//
// SKĄD LICZBY: dla każdego meczu bierzemy schemat boiska (numer na koszulce + miejsce) i listę
// „SKŁADY WYJŚCIOWE" (numer + pełne nazwisko). Schemat sam w sobie skraca nazwiska („27 Laskow…"),
// więc bez listy nie dałoby się ich rozwinąć; lista z kolei nie zna pozycji. Dopiero razem dają
// pewne przypisanie. Zmiennicy dziedziczą pole zawodnika, którego zmienili — tak, jak zapisuje to
// protokół („Rostek K. ⇄ Laskowski K. 46'").
//
// JAK CZYTAMY STRONĘ BOISKA: gospodarz atakuje w prawo, więc GÓRA ekranu to jego LEWA strona;
// gość atakuje w lewo, więc jego lewa strona jest na DOLE. Bez tego całe składy wyszłyby lustrzanie
// odbite i prawi obrońcy staliby po lewej.
//
// UMOWA CO DO NUMERÓW (NMG ma jedenaście pól, a ustawienia bywają szersze):
//   • czwórka obrony  → 3 (lewy), 4 (lewy stoper), 5 (prawy stoper), 2 (prawy);
//   • trójka obrony   → 4 (lewy), 5 (środkowy), 5 (prawy) — pól stoperskich są dwa, a środkowy
//                       obrońca to najczęściej prawonożny organizator, więc idzie do „piątki";
//   • wahadła         → 3 i 2;
//   • dwójka w środku → głębiej cofnięty 6, drugi 8; przy równej głębokości lewy dostaje 6;
//   • trójka w środku → najgłębszy 6, najwyżej wysunięty 10, trzeci 8;
//   • skrzydłowi      → 11 (lewy) i 7 (prawy);
//   • dwaj „dziesiątki" za napastnikiem (3-4-2-1) → OBAJ 10, bo w tym ustawieniu szerokość robią
//                       wahadła, a nie skrzydłowi — wpisanie ich na 7 i 11 kłamałoby o roli;
//   • dwaj napastnicy → OBAJ 9.
// Tam, gdzie schemat nie rozstrzyga (dwaj pomocnicy na tej samej wysokości), zamiana miejscami
// dotyczy dwóch kolegów z tej samej formacji i poprawia się jednym przeciągnięciem na mapie.

export type WpisSkladu = {
  /** Nazwisko dokładnie tak, jak w protokole — bywa dwuczłonowe („Leśniak Paduch"). */
  nazwisko: string;
  /** Inicjał imienia z protokołu — rozstrzyga, gdy w klubie są dwaj o tym samym nazwisku. */
  inicjal: string;
  /** Numer pola wg Narodowego Modelu Gry (1-11). */
  nmg: number;
};

export type SkladKlubu = {
  klub: string;
  system: string;
  /** Wyjściowa jedenastka. */
  pierwsi: WpisSkladu[];
  /** Zmiennicy — pole odziedziczone po zawodniku, którego zmienili. */
  zmiennicy: WpisSkladu[];
};

export const SKLADY_MECZOWE: SkladKlubu[] = [
  // Ruch Chorzów 3-1 Unia Skierniewice, 07.09.2026
  {
    klub: 'Ruch Chorzów', system: '1-4-2-3-1',
    pierwsi: [
      { nazwisko: 'Wrąbel', inicjal: 'J', nmg: 1 },
      { nazwisko: 'del Moral', inicjal: 'A', nmg: 3 },
      { nazwisko: 'Lukic', inicjal: 'A', nmg: 4 },
      { nazwisko: 'Leśniak Paduch', inicjal: 'N', nmg: 5 },
      { nazwisko: 'Konczkowski', inicjal: 'M', nmg: 2 },
      { nazwisko: 'Kristan', inicjal: 'J', nmg: 8 },
      { nazwisko: 'Rosol', inicjal: 'M', nmg: 6 },
      { nazwisko: 'Szwedzik', inicjal: 'P', nmg: 11 },
      { nazwisko: 'Chrapek', inicjal: 'M', nmg: 10 },
      { nazwisko: 'Laskowski', inicjal: 'K', nmg: 7 },
      { nazwisko: 'Pawlowski', inicjal: 'M', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Nagamatsu', inicjal: 'S', nmg: 6 },
      { nazwisko: 'Rostek', inicjal: 'K', nmg: 7 },
      { nazwisko: 'Sutherland', inicjal: 'T', nmg: 9 },
      { nazwisko: 'Wójcik', inicjal: 'F', nmg: 2 },
      { nazwisko: 'Sikora', inicjal: 'P', nmg: 10 },
    ],
  },
  {
    klub: 'Unia Skierniewice', system: '1-3-4-3',
    pierwsi: [
      { nazwisko: 'Pruszkowski', inicjal: 'S', nmg: 1 },
      { nazwisko: 'Straus', inicjal: 'J', nmg: 4 },
      { nazwisko: 'Stępień', inicjal: 'M', nmg: 5 },
      { nazwisko: 'Wolinski', inicjal: 'E', nmg: 5 },
      { nazwisko: 'Eizenchart', inicjal: 'B', nmg: 3 },
      { nazwisko: 'Makuch', inicjal: 'D', nmg: 8 },
      { nazwisko: 'Bieroński', inicjal: 'J', nmg: 6 },
      { nazwisko: 'Kalisz', inicjal: 'K', nmg: 2 },
      { nazwisko: 'Gaska', inicjal: 'D', nmg: 11 },
      { nazwisko: 'Bida', inicjal: 'B', nmg: 9 },
      { nazwisko: 'Burkiewicz', inicjal: 'A', nmg: 7 },
    ],
    zmiennicy: [
      { nazwisko: 'Sabiło', inicjal: 'K', nmg: 7 },
      { nazwisko: 'Dudek', inicjal: 'S', nmg: 6 },
      { nazwisko: 'Mierzwa', inicjal: 'J', nmg: 2 },
      { nazwisko: 'Toporkiewicz', inicjal: 'K', nmg: 9 },
      { nazwisko: 'Szmyd', inicjal: 'M', nmg: 3 },
    ],
  },

  // Polonia Bytom 0-0 Podbeskidzie Bielsko-Biała, 06.09.2026
  {
    klub: 'Polonia Bytom', system: '1-3-4-2-1',
    pierwsi: [
      { nazwisko: 'Banasik', inicjal: 'W', nmg: 1 },
      { nazwisko: 'Wołkowicz', inicjal: 'K', nmg: 4 },
      { nazwisko: 'Krzyżak', inicjal: 'O', nmg: 5 },
      { nazwisko: 'Szymanski', inicjal: 'J', nmg: 5 },
      { nazwisko: 'Zieliński', inicjal: 'L', nmg: 3 },
      { nazwisko: 'Kądziołka', inicjal: 'S', nmg: 6 },
      { nazwisko: 'Konieczny', inicjal: 'D', nmg: 8 },
      { nazwisko: 'Stefanski', inicjal: 'P', nmg: 2 },
      { nazwisko: 'Andrzejczak', inicjal: 'K', nmg: 10 },
      { nazwisko: 'Orlik', inicjal: 'K', nmg: 10 },
      { nazwisko: 'Wojtyra', inicjal: 'K', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Malachowski', inicjal: 'A', nmg: 8 },
      { nazwisko: 'Mioc', inicjal: 'B', nmg: 10 },
      { nazwisko: 'Rumin', inicjal: 'D', nmg: 9 },
      { nazwisko: 'Gajgier', inicjal: 'A', nmg: 4 },
      { nazwisko: 'Szymusik', inicjal: 'G', nmg: 2 },
    ],
  },
  {
    klub: 'Podbeskidzie Bielsko-Biała', system: '1-3-4-2-1',
    pierwsi: [
      { nazwisko: 'Branczyk', inicjal: 'S', nmg: 1 },
      { nazwisko: 'Sewerzyński', inicjal: 'O', nmg: 4 },
      { nazwisko: 'Kasperkiewicz', inicjal: 'A', nmg: 5 },
      { nazwisko: 'Biernat', inicjal: 'M', nmg: 5 },
      { nazwisko: 'Sochan', inicjal: 'K', nmg: 3 },
      { nazwisko: 'Urynowicz', inicjal: 'M', nmg: 8 },
      { nazwisko: 'Iwanczyk', inicjal: 'A', nmg: 6 },
      { nazwisko: 'Sitek', inicjal: 'M', nmg: 2 },
      { nazwisko: 'Martosz', inicjal: 'B', nmg: 10 },
      { nazwisko: 'Klisiewicz', inicjal: 'L', nmg: 10 },
      { nazwisko: 'Shikavka', inicjal: 'Y', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Słomka', inicjal: 'W', nmg: 6 },
      { nazwisko: 'Hirosawa', inicjal: 'T', nmg: 2 },
      { nazwisko: 'Pietraszkiewicz', inicjal: 'D', nmg: 10 },
      { nazwisko: 'Tomczyk', inicjal: 'O', nmg: 9 },
    ],
  },

  // Arka Gdynia 1-1 ŁKS Łódź, 06.09.2026
  {
    klub: 'Arka Gdynia', system: '1-4-2-3-1',
    pierwsi: [
      { nazwisko: 'Grobelny', inicjal: 'J', nmg: 1 },
      { nazwisko: 'Gojny', inicjal: 'D', nmg: 3 },
      { nazwisko: 'Komenda', inicjal: 'M', nmg: 4 },
      { nazwisko: 'Szota', inicjal: 'S', nmg: 5 },
      { nazwisko: 'Gruszkowski', inicjal: 'K', nmg: 2 },
      { nazwisko: 'Lewkot', inicjal: 'S', nmg: 8 },
      { nazwisko: 'Kun', inicjal: 'D', nmg: 6 },
      { nazwisko: 'Milewski', inicjal: 'M', nmg: 11 },
      { nazwisko: 'Walus', inicjal: 'F', nmg: 10 },
      { nazwisko: 'Kowalski', inicjal: 'J', nmg: 7 },
      { nazwisko: 'Gutkovskis', inicjal: 'V', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Dominguez', inicjal: 'J', nmg: 4 },
      { nazwisko: 'Krefft', inicjal: 'P', nmg: 7 },
      { nazwisko: 'Rama', inicjal: 'E', nmg: 9 },
      { nazwisko: 'Ambrosiewicz', inicjal: 'M', nmg: 6 },
      { nazwisko: 'Lipkowski', inicjal: 'K', nmg: 3 },
    ],
  },
  {
    klub: 'ŁKS Łódź', system: '1-3-5-2',
    pierwsi: [
      { nazwisko: 'Węglarz', inicjal: 'D', nmg: 1 },
      { nazwisko: 'Falowski', inicjal: 'K', nmg: 4 },
      { nazwisko: 'Craciun', inicjal: 'A', nmg: 5 },
      { nazwisko: 'Farbiszewski', inicjal: 'B', nmg: 5 },
      { nazwisko: 'Keiblinger', inicjal: 'J', nmg: 3 },
      { nazwisko: 'Hinokio', inicjal: 'K', nmg: 10 },
      { nazwisko: 'Wysokinski', inicjal: 'M', nmg: 8 },
      { nazwisko: 'Terlecki', inicjal: 'K', nmg: 6 },
      { nazwisko: 'Sokół', inicjal: 'D', nmg: 2 },
      { nazwisko: 'Nowakowski', inicjal: 'K', nmg: 9 },
      { nazwisko: 'Podlinski', inicjal: 'K', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Kaput', inicjal: 'M', nmg: 8 },
      { nazwisko: 'Szczygieł', inicjal: 'L', nmg: 9 },
      { nazwisko: 'Strzałek', inicjal: 'I', nmg: 10 },
      { nazwisko: 'Błachewicz', inicjal: 'M', nmg: 2 },
      { nazwisko: 'Siwek', inicjal: 'A', nmg: 3 },
    ],
  },

  // Miedź Legnica 1-1 Chrobry Głogów, 05.09.2026
  {
    klub: 'Miedź Legnica', system: '1-3-4-2-1',
    pierwsi: [
      { nazwisko: 'Lucic', inicjal: 'I', nmg: 1 },
      { nazwisko: 'Grudziński', inicjal: 'M', nmg: 4 },
      { nazwisko: 'Mazur', inicjal: 'M', nmg: 5 },
      { nazwisko: 'Noiszewski', inicjal: 'K', nmg: 5 },
      { nazwisko: 'Korczakowski', inicjal: 'I', nmg: 3 },
      { nazwisko: 'Petrovic', inicjal: 'Z', nmg: 8 },
      { nazwisko: 'Hajda', inicjal: 'W', nmg: 6 },
      { nazwisko: 'Maliszewski', inicjal: 'I', nmg: 2 },
      { nazwisko: 'Cordoba', inicjal: 'A', nmg: 10 },
      { nazwisko: 'Antonik', inicjal: 'K', nmg: 10 },
      { nazwisko: 'Stanclik', inicjal: 'D', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Jovicic', inicjal: 'M', nmg: 3 },
      { nazwisko: 'Fucak', inicjal: 'K', nmg: 9 },
      { nazwisko: 'Bochnak', inicjal: 'M', nmg: 10 },
      { nazwisko: 'Norlin', inicjal: 'G', nmg: 10 },
      { nazwisko: 'Mansfeld', inicjal: 'M', nmg: 5 },
    ],
  },
  {
    klub: 'Chrobry Głogów', system: '1-4-2-3-1',
    pierwsi: [
      { nazwisko: 'Bąkowski', inicjal: 'K', nmg: 1 },
      { nazwisko: 'Bartolewski', inicjal: 'M', nmg: 3 },
      { nazwisko: 'Gric', inicjal: 'J', nmg: 4 },
      { nazwisko: 'Czajka', inicjal: 'B', nmg: 5 },
      { nazwisko: 'Tabiś', inicjal: 'K', nmg: 2 },
      { nazwisko: 'Mandrysz', inicjal: 'R', nmg: 8 },
      { nazwisko: 'Grzelak', inicjal: 'K', nmg: 6 },
      { nazwisko: 'Lis', inicjal: 'J', nmg: 11 },
      { nazwisko: 'Staszak', inicjal: 'W', nmg: 10 },
      { nazwisko: 'Ibe-Torti', inicjal: 'K', nmg: 7 },
      { nazwisko: 'Strózik', inicjal: 'S', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Bak', inicjal: 'R', nmg: 8 },
      { nazwisko: 'Sadiku', inicjal: 'A', nmg: 2 },
      { nazwisko: 'Ozimek', inicjal: 'M', nmg: 10 },
      { nazwisko: 'Rybak', inicjal: 'A', nmg: 6 },
      { nazwisko: 'Bukowski', inicjal: 'A', nmg: 7 },
    ],
  },

  // Stal Mielec 1-1 Odra Opole, 05.09.2026
  {
    klub: 'Stal Mielec', system: '1-4-2-3-1',
    pierwsi: [
      { nazwisko: 'Gostomski', inicjal: 'M', nmg: 1 },
      { nazwisko: 'Getinger', inicjal: 'K', nmg: 3 },
      { nazwisko: 'Puerto', inicjal: 'I', nmg: 4 },
      { nazwisko: 'Kwiecień', inicjal: 'B', nmg: 5 },
      { nazwisko: 'Kukulowicz', inicjal: 'B', nmg: 2 },
      { nazwisko: 'Kościelny', inicjal: 'K', nmg: 8 },
      { nazwisko: 'Gerbowski', inicjal: 'F', nmg: 6 },
      { nazwisko: 'Cybulski', inicjal: 'K', nmg: 11 },
      { nazwisko: 'Cebula', inicjal: 'M', nmg: 10 },
      { nazwisko: 'Gmur', inicjal: 'T', nmg: 7 },
      { nazwisko: 'Musiolik', inicjal: 'S', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Chrapusta', inicjal: 'P', nmg: 1 },
      { nazwisko: 'Kruszelnicki', inicjal: 'P', nmg: 10 },
      { nazwisko: 'Odolak', inicjal: 'K', nmg: 7 },
      { nazwisko: 'Oure', inicjal: 'S', nmg: 11 },
      { nazwisko: 'Wyparlo', inicjal: 'M', nmg: 5 },
    ],
  },
  {
    klub: 'Odra Opole', system: '1-3-4-3',
    pierwsi: [
      { nazwisko: 'Haluch', inicjal: 'A', nmg: 1 },
      { nazwisko: 'Pingot', inicjal: 'M', nmg: 4 },
      { nazwisko: 'Piroch', inicjal: 'J', nmg: 5 },
      { nazwisko: 'Mijuskovic', inicjal: 'N', nmg: 5 },
      { nazwisko: 'Biedrzycki', inicjal: 'B', nmg: 3 },
      { nazwisko: 'Gajda', inicjal: 'T', nmg: 8 },
      { nazwisko: 'Liber', inicjal: 'A', nmg: 6 },
      { nazwisko: 'Spychała', inicjal: 'M', nmg: 2 },
      { nazwisko: 'Baranski', inicjal: 'B', nmg: 11 },
      { nazwisko: 'Feliks', inicjal: 'M', nmg: 9 },
      { nazwisko: 'Szysz', inicjal: 'P', nmg: 7 },
    ],
    zmiennicy: [
      { nazwisko: 'Spacil', inicjal: 'B', nmg: 2 },
      { nazwisko: 'Kupczyk', inicjal: 'F', nmg: 11 },
      { nazwisko: 'Perez', inicjal: 'J', nmg: 7 },
      { nazwisko: 'Gieroba', inicjal: 'S', nmg: 9 },
      { nazwisko: 'Scalet', inicjal: 'M', nmg: 6 },
    ],
  },

  // Stal Rzeszów 2-1 Polonia Warszawa, 05.09.2026
  {
    klub: 'Stal Rzeszów', system: '1-4-2-3-1',
    pierwsi: [
      { nazwisko: 'Koziol', inicjal: 'M', nmg: 1 },
      { nazwisko: 'Kukułka', inicjal: 'K', nmg: 3 },
      { nazwisko: 'Kaczor', inicjal: 'M', nmg: 4 },
      { nazwisko: 'Krasovskiy', inicjal: 'V', nmg: 5 },
      { nazwisko: 'Thiede', inicjal: 'M', nmg: 2 },
      { nazwisko: 'Leniart', inicjal: 'M', nmg: 6 },
      { nazwisko: 'Goss', inicjal: 'S', nmg: 8 },
      { nazwisko: 'Rittmuller', inicjal: 'M', nmg: 11 },
      { nazwisko: 'Brzek', inicjal: 'W', nmg: 10 },
      { nazwisko: 'Pukala', inicjal: 'S', nmg: 7 },
      { nazwisko: 'Salamon', inicjal: 'S', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Masiak', inicjal: 'K', nmg: 7 },
      { nazwisko: 'Madej', inicjal: 'O', nmg: 10 },
      { nazwisko: 'Musik', inicjal: 'M', nmg: 9 },
      { nazwisko: 'Machura', inicjal: 'W', nmg: 11 },
    ],
  },
  {
    klub: 'Polonia Warszawa', system: '1-4-2-3-1',
    pierwsi: [
      { nazwisko: 'Jelen', inicjal: 'M', nmg: 1 },
      { nazwisko: 'Olafsson', inicjal: 'D', nmg: 3 },
      { nazwisko: 'Marcjanik', inicjal: 'M', nmg: 4 },
      { nazwisko: 'Budnicki', inicjal: 'J', nmg: 5 },
      { nazwisko: 'Terpiłowski', inicjal: 'E', nmg: 2 },
      { nazwisko: 'Gnaase', inicjal: 'D', nmg: 6 },
      { nazwisko: 'Kuusk', inicjal: 'M', nmg: 8 },
      { nazwisko: 'Durmus', inicjal: 'I', nmg: 11 },
      { nazwisko: 'Skrabb', inicjal: 'S', nmg: 10 },
      { nazwisko: 'Dadok', inicjal: 'R', nmg: 7 },
      { nazwisko: 'Tabara', inicjal: 'K', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Kapusta', inicjal: 'A', nmg: 9 },
      { nazwisko: 'Kowalczyk', inicjal: 'S', nmg: 8 },
      { nazwisko: 'Vega', inicjal: 'D', nmg: 3 },
      { nazwisko: 'Paszkowski', inicjal: 'J', nmg: 7 },
      { nazwisko: 'Ziółkowski', inicjal: 'K', nmg: 2 },
    ],
  },

  // Bruk-Bet Termalica Nieciecza 2-1 Lechia Gdańsk, 04.09.2026
  {
    klub: 'Bruk-Bet Termalica Nieciecza', system: '1-4-4-2',
    pierwsi: [
      { nazwisko: 'Chovan', inicjal: 'A', nmg: 1 },
      { nazwisko: 'Kozik', inicjal: 'M', nmg: 3 },
      { nazwisko: 'Putivtsev', inicjal: 'A', nmg: 4 },
      { nazwisko: 'Masoero', inicjal: 'L', nmg: 5 },
      { nazwisko: 'Jaroszewski', inicjal: 'M', nmg: 2 },
      { nazwisko: 'Boboc', inicjal: 'R', nmg: 11 },
      { nazwisko: 'Kubica', inicjal: 'K', nmg: 8 },
      { nazwisko: 'Guerrero', inicjal: 'S', nmg: 6 },
      { nazwisko: 'Hilbrycht', inicjal: 'D', nmg: 7 },
      { nazwisko: 'Biniek', inicjal: 'D', nmg: 9 },
      { nazwisko: 'Jakubik', inicjal: 'W', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Sławiński', inicjal: 'O', nmg: 9 },
      { nazwisko: 'Wróbel', inicjal: 'J', nmg: 9 },
      { nazwisko: 'Dabrowski', inicjal: 'S', nmg: 11 },
      { nazwisko: 'Zarowny', inicjal: 'A', nmg: 3 },
    ],
  },
  {
    klub: 'Lechia Gdańsk', system: '1-4-4-2',
    pierwsi: [
      { nazwisko: 'Holewiński', inicjal: 'A', nmg: 1 },
      { nazwisko: 'Malov', inicjal: 'D', nmg: 3 },
      { nazwisko: 'Beskorovaynyi', inicjal: 'D', nmg: 4 },
      { nazwisko: 'Lopata', inicjal: 'K', nmg: 5 },
      { nazwisko: 'Kopasek', inicjal: 'S', nmg: 2 },
      { nazwisko: 'Dodaj', inicjal: 'K', nmg: 11 },
      { nazwisko: 'Wójtowicz', inicjal: 'T', nmg: 6 },
      { nazwisko: 'Ivanov', inicjal: 'H', nmg: 8 },
      { nazwisko: 'Mena', inicjal: 'C', nmg: 7 },
      { nazwisko: 'Głogowski', inicjal: 'M', nmg: 9 },
      { nazwisko: 'Shakh', inicjal: 'A', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Blanuta', inicjal: 'V', nmg: 9 },
      { nazwisko: 'Neugebauer', inicjal: 'T', nmg: 8 },
      { nazwisko: 'Bambecki', inicjal: 'I', nmg: 11 },
    ],
  },

  // Pogoń Grodzisk Mazowiecki 1-0 Warta Poznań, 04.09.2026
  {
    klub: 'Pogoń Grodzisk Mazowiecki', system: '1-3-5-2',
    pierwsi: [
      { nazwisko: 'Kamiński', inicjal: 'K', nmg: 1 },
      { nazwisko: 'Niewiadomski', inicjal: 'J', nmg: 4 },
      { nazwisko: 'Dembek', inicjal: 'B', nmg: 5 },
      { nazwisko: 'Głogowski', inicjal: 'K', nmg: 5 },
      { nazwisko: 'Niski', inicjal: 'N', nmg: 3 },
      { nazwisko: 'Ciepiela', inicjal: 'B', nmg: 8 },
      { nazwisko: 'Los', inicjal: 'K', nmg: 6 },
      { nazwisko: 'Uzoigwe', inicjal: 'H', nmg: 10 },
      { nazwisko: 'Zbrog', inicjal: 'J', nmg: 2 },
      { nazwisko: 'Majewski', inicjal: 'R', nmg: 9 },
      { nazwisko: 'Oshafi', inicjal: 'A', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Ruszkiewicz', inicjal: 'M', nmg: 10 },
      { nazwisko: 'Jedrasik', inicjal: 'J', nmg: 3 },
      { nazwisko: 'Jaron', inicjal: 'D', nmg: 9 },
      { nazwisko: 'Konstantyn', inicjal: 'J', nmg: 2 },
      { nazwisko: 'Turski', inicjal: 'H', nmg: 8 },
    ],
  },
  {
    klub: 'Warta Poznań', system: '1-3-4-2-1',
    pierwsi: [
      { nazwisko: 'Przybylak', inicjal: 'L', nmg: 1 },
      { nazwisko: 'Avdeev', inicjal: 'D', nmg: 4 },
      { nazwisko: 'Azatsky', inicjal: 'O', nmg: 5 },
      { nazwisko: 'Lepczynski', inicjal: 'K', nmg: 5 },
      { nazwisko: 'Stefaniak', inicjal: 'M', nmg: 3 },
      { nazwisko: 'Niedzielski', inicjal: 'J', nmg: 8 },
      { nazwisko: 'Łysiak', inicjal: 'K', nmg: 6 },
      { nazwisko: 'Apolinarski', inicjal: 'J', nmg: 2 },
      { nazwisko: 'Kendzia', inicjal: 'J', nmg: 10 },
      { nazwisko: 'Wolczek', inicjal: 'A', nmg: 10 },
      { nazwisko: 'Stanek', inicjal: 'M', nmg: 9 },
    ],
    zmiennicy: [
      { nazwisko: 'Kusztal', inicjal: 'P', nmg: 10 },
      { nazwisko: 'Rychert', inicjal: 'K', nmg: 2 },
      { nazwisko: 'Wybieralski', inicjal: 'K', nmg: 10 },
    ],
  },
];
