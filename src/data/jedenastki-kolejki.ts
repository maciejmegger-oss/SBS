// JEDENASTKI KOLEJEK BETCLIC 2 LIGI — wygenerowane, NIE POPRAWIAJ RĘCZNIE.
//
// Źródło: pilkanozna.pl, cykl „jedenastka N. kolejki Betclic 2 Ligi" (odnośnik przy każdym wpisie).
// Po dołożeniu kolejnej kolejki uruchom: node scripts/zbuduj-jedenastki-kolejki.mjs <plik.json>
//
// CZEGO TU NIE MA: kolejek 3, 8 i 9 sezonu 2026/27 — wydawca ich nie opublikował. Liczba
// wyróżnień jest więc z 9 kolejek, nie z 12, i tak jest opisana w aplikacji.
// Zestawienie obejmuje rundę jesienną: kolejki 1, 2, 4, 5, 6, 7, 10, 11, 12.

export type WyborKolejki = {
  kolejka: number;
  data: string;      // data publikacji jedenastki
  imie: string;      // puste przy jednoczłonowym pseudonimie
  nazwisko: string;
  klub: string;      // pełna nazwa klubu, tak jak w bazie SBS
  zrodlo: string;
};

// Kolejki, z których liczone są wyróżnienia — potrzebne, żeby w aplikacji napisać „3 z 9",
// a nie „3 z 12", bo to byłaby nieprawda.
export const KOLEJKI_W_ZESTAWIENIU: number[] = [1,2,4,5,6,7,10,11,12];

export const JEDENASTKI_KOLEJEK: WyborKolejki[] = [
  {
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Jakub",
    "nazwisko": "Mądrzyk",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Mateusz",
    "nazwisko": "Jeleński",
    "klub": "Znicz Pruszków",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Damian",
    "nazwisko": "Zbozień",
    "klub": "Avia Świdnik",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Tobiasz",
    "nazwisko": "Kubik",
    "klub": "Podhale Nowy Targ",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Dariusz",
    "nazwisko": "Kamiński",
    "klub": "Stal Stalowa Wola",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Maksymilian",
    "nazwisko": "Hebel",
    "klub": "Stal Stalowa Wola",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Adam",
    "nazwisko": "Deja",
    "klub": "Górnik Łęczna",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Michał",
    "nazwisko": "Walski",
    "klub": "Górnik Łęczna",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Maciej",
    "nazwisko": "Mas",
    "klub": "Zawisza Bydgoszcz",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Bartosz",
    "nazwisko": "Kurzeja",
    "klub": "Podhale Nowy Targ",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Andrij",
    "nazwisko": "Remeniuk",
    "klub": "Avia Świdnik",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Adrian",
    "nazwisko": "Lis",
    "klub": "Sokół Kleczew",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Patryk",
    "nazwisko": "Kieliś",
    "klub": "Sandecja Nowy Sącz",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Bartosz",
    "nazwisko": "Zbiciak",
    "klub": "Olimpia Grudziądz",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Dawid",
    "nazwisko": "Barnowski",
    "klub": "Znicz Pruszków",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Wiktor",
    "nazwisko": "Kamiński",
    "klub": "Śląsk II Wrocław",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Michał",
    "nazwisko": "Trąbka",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Andrij",
    "nazwisko": "Remeniuk",
    "klub": "Avia Świdnik",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Oskar",
    "nazwisko": "Zawada",
    "klub": "Hutnik Kraków",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Piotr",
    "nazwisko": "Janczukowicz",
    "klub": "Sandecja Nowy Sącz",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Jan",
    "nazwisko": "Ciućka",
    "klub": "Rekord Bielsko-Biała",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Michał",
    "nazwisko": "Oczkowski",
    "klub": "Zawisza Bydgoszcz",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Paweł",
    "nazwisko": "Olkowski",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Paweł",
    "nazwisko": "Jaroszyński",
    "klub": "Górnik Łęczna",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Mateusz",
    "nazwisko": "Bąkowicz",
    "klub": "Chojniczanka Chojnice",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Patryk",
    "nazwisko": "Kieliś",
    "klub": "Sandecja Nowy Sącz",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Adam",
    "nazwisko": "Deja",
    "klub": "Górnik Łęczna",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Jakub",
    "nazwisko": "Stec",
    "klub": "Olimpia Grudziądz",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Filip",
    "nazwisko": "Adamski",
    "klub": "Sokół Kleczew",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Maksymilian",
    "nazwisko": "Hebel",
    "klub": "Stal Stalowa Wola",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Oskar",
    "nazwisko": "Zawada",
    "klub": "Hutnik Kraków",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Javier Mateo",
    "nazwisko": "Ortiz",
    "klub": "Resovia",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Karol",
    "nazwisko": "Szymkowiak",
    "klub": "Sandecja Nowy Sącz",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Paweł",
    "nazwisko": "Olkowski",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Sebastian",
    "nazwisko": "Golak",
    "klub": "Zawisza Bydgoszcz",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Dawid",
    "nazwisko": "Szwiec",
    "klub": "Świt Szczecin",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Dawid",
    "nazwisko": "Abramowicz",
    "klub": "Olimpia Grudziądz",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Mateusz",
    "nazwisko": "Stępień",
    "klub": "Zawisza Bydgoszcz",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Michał",
    "nazwisko": "Trąbka",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Aleksander",
    "nazwisko": "Wyganowski",
    "klub": "Legia II Warszawa",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Cyprian",
    "nazwisko": "Pchełka",
    "klub": "Legia II Warszawa",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Bekem",
    "nazwisko": "Bicki",
    "klub": "Legia II Warszawa",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Valerijs",
    "nazwisko": "Sabala",
    "klub": "Chojniczanka Chojnice",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Mateusz",
    "nazwisko": "Abramowicz",
    "klub": "Świt Szczecin",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Rafał",
    "nazwisko": "Kobryń",
    "klub": "Górnik Łęczna",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Jarosław",
    "nazwisko": "Jach",
    "klub": "Znicz Pruszków",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Michał",
    "nazwisko": "Szmigiel",
    "klub": "Lechia Zielona Góra",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Bartosz",
    "nazwisko": "Florek",
    "klub": "Hutnik Kraków",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Władysław",
    "nazwisko": "Ochronczuk",
    "klub": "Znicz Pruszków",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Adam",
    "nazwisko": "Brenkus",
    "klub": "Sandecja Nowy Sącz",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Przemysław",
    "nazwisko": "Bargiel",
    "klub": "Lechia Zielona Góra",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Mateusz",
    "nazwisko": "Stępień",
    "klub": "Zawisza Bydgoszcz",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "",
    "nazwisko": "Marcinho",
    "klub": "Podhale Nowy Targ",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Filip",
    "nazwisko": "Kozłowski",
    "klub": "Zawisza Bydgoszcz",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Mateusz",
    "nazwisko": "Abramowicz",
    "klub": "Świt Szczecin",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Józef",
    "nazwisko": "Chorosiński",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Mikołaj",
    "nazwisko": "Staniak",
    "klub": "Zawisza Bydgoszcz",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Dawid",
    "nazwisko": "Barnowski",
    "klub": "Znicz Pruszków",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Adam",
    "nazwisko": "Deja",
    "klub": "Górnik Łęczna",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Dennis",
    "nazwisko": "Jastrzembski",
    "klub": "Olimpia Grudziądz",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Tymon",
    "nazwisko": "Proczek",
    "klub": "Znicz Pruszków",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Łukasz",
    "nazwisko": "Seweryn",
    "klub": "Podhale Nowy Targ",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Adam",
    "nazwisko": "Frączczak",
    "klub": "Świt Szczecin",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Jakub",
    "nazwisko": "Jeleń",
    "klub": "Stal Stalowa Wola",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Kacper",
    "nazwisko": "Kasprzak",
    "klub": "Rekord Bielsko-Biała",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Michał",
    "nazwisko": "Jerke",
    "klub": "Olimpia Grudziądz",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Paweł",
    "nazwisko": "Jaroszyński",
    "klub": "Górnik Łęczna",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Matija",
    "nazwisko": "Horvat",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Kacper",
    "nazwisko": "Orzechowski",
    "klub": "Avia Świdnik",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Dennis",
    "nazwisko": "Jastrzembski",
    "klub": "Olimpia Grudziądz",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Kacper",
    "nazwisko": "Żendełek",
    "klub": "Świt Szczecin",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Arkadiusz",
    "nazwisko": "Nowak",
    "klub": "Podhale Nowy Targ",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Tymon",
    "nazwisko": "Proczek",
    "klub": "Znicz Pruszków",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Damian",
    "nazwisko": "Kądzior",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Dawid",
    "nazwisko": "Dębski",
    "klub": "Lechia Zielona Góra",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Adrian",
    "nazwisko": "Kazimierczak",
    "klub": "Znicz Pruszków",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Kacper",
    "nazwisko": "Napieraj",
    "klub": "Znicz Pruszków",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Dawid",
    "nazwisko": "Barnowski",
    "klub": "Znicz Pruszków",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Igor",
    "nazwisko": "Łasicki",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Cyprian",
    "nazwisko": "Pchełka",
    "klub": "Legia II Warszawa",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Dariusz",
    "nazwisko": "Kamiński",
    "klub": "Stal Stalowa Wola",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Hubert",
    "nazwisko": "Adamczyk",
    "klub": "Chojniczanka Chojnice",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Damian",
    "nazwisko": "Kądzior",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Kacper",
    "nazwisko": "Plichta",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Jakub",
    "nazwisko": "Jeleń",
    "klub": "Stal Stalowa Wola",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Kacper",
    "nazwisko": "Wełniak",
    "klub": "Avia Świdnik",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Kacper",
    "nazwisko": "Rzepka",
    "klub": "Hutnik Kraków",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Dorian",
    "nazwisko": "Frątczak",
    "klub": "Podhale Nowy Targ",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Krystian",
    "nazwisko": "Szymocha",
    "klub": "Sokół Kleczew",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Dmytro",
    "nazwisko": "Juchymowycz",
    "klub": "Chojniczanka Chojnice",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Jarosław",
    "nazwisko": "Jach",
    "klub": "Znicz Pruszków",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Michał",
    "nazwisko": "Kołodziejski",
    "klub": "Avia Świdnik",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Mateusz",
    "nazwisko": "Stępień",
    "klub": "Zawisza Bydgoszcz",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Dawid",
    "nazwisko": "Kort",
    "klub": "Świt Szczecin",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Maksymilian",
    "nazwisko": "Hebel",
    "klub": "Stal Stalowa Wola",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Damian",
    "nazwisko": "Kądzior",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Filip",
    "nazwisko": "Piszczek",
    "klub": "Sandecja Nowy Sącz",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Mateusz",
    "nazwisko": "Lewandowski",
    "klub": "GKS Tychy",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  }
];
