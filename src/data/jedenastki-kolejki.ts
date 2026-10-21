// JEDENASTKI KOLEJEK — wygenerowane, NIE POPRAWIAJ RĘCZNIE.
//
// Po dołożeniu kolejki uruchom: node scripts/zbuduj-jedenastki-kolejki.mjs <plik.json>
//
// Źródła (jedno na ligę — mieszanie wydawców zafałszowałoby liczbę wyróżnień):
//   Ekstraklasa — ekstraklasa.org — oficjalny serwis ligi
//   I liga — pilkanozna.pl — cykl „jedenastka N. kolejki Betclic 1 Ligi”
//   II liga — pilkanozna.pl — cykl „jedenastka N. kolejki Betclic 2 Ligi”
//
// Co jest, a czego nie ma — aplikacja pisze to wprost przy liczbie wyróżnień:
//   Ekstraklasa: kolejki 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 — komplet
//   I liga: kolejki 1, 2, 4, 5, 6, 7, 8, 10, 11 — brak 3, 9 (wydawca ich nie opublikował)
//   II liga: kolejki 1, 2, 4, 5, 6, 7, 10, 11, 12 — brak 3, 8, 9 (wydawca ich nie opublikował)

export type WyborKolejki = {
  liga: string;      // nazwa rozgrywek dokładnie jak w ustawieniach SBS
  kolejka: number;
  data: string;      // data publikacji jedenastki
  imie: string;      // puste przy jednoczłonowym pseudonimie
  nazwisko: string;
  klub: string;      // pełna nazwa klubu, tak jak w bazie SBS
  pozycja: string;   // tylko Ekstraklasa — oficjalny serwis ją podaje
  zrodlo: string;
};

// Kolejki, z których liczone są wyróżnienia w danej lidze — potrzebne, żeby napisać „3 z 9",
// a nie „3 z 12", bo to byłaby nieprawda.
export const KOLEJKI_W_ZESTAWIENIU: Record<string, number[]> = {
  "Ekstraklasa": [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11
  ],
  "I liga": [
    1,
    2,
    4,
    5,
    6,
    7,
    8,
    10,
    11
  ],
  "II liga": [
    1,
    2,
    4,
    5,
    6,
    7,
    10,
    11,
    12
  ]
};

export const ZRODLA_JEDENASTEK: Record<string, string> = {
  "Ekstraklasa": "ekstraklasa.org — oficjalny serwis ligi",
  "I liga": "pilkanozna.pl — cykl „jedenastka N. kolejki Betclic 1 Ligi”",
  "II liga": "pilkanozna.pl — cykl „jedenastka N. kolejki Betclic 2 Ligi”"
};

export const JEDENASTKI_KOLEJEK: WyborKolejki[] = [
  {
    "liga": "Ekstraklasa",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Otto",
    "nazwisko": "Hindrich",
    "klub": "Legia Warszawa",
    "pozycja": "Bramkarz",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/grzesik-nadal-ton-sypek-odmienil-mecz-jedenastka-1-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Marcin",
    "nazwisko": "Flis",
    "klub": "Wisła Płock",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/grzesik-nadal-ton-sypek-odmienil-mecz-jedenastka-1-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Jan",
    "nazwisko": "Grzesik",
    "klub": "Radomiak Radom",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/grzesik-nadal-ton-sypek-odmienil-mecz-jedenastka-1-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Paweł",
    "nazwisko": "Wszołek",
    "klub": "Legia Warszawa",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/grzesik-nadal-ton-sypek-odmienil-mecz-jedenastka-1-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Rafał",
    "nazwisko": "Wolski",
    "klub": "Radomiak Radom",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/grzesik-nadal-ton-sypek-odmienil-mecz-jedenastka-1-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Kacper",
    "nazwisko": "Duda",
    "klub": "Wisła Kraków",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/grzesik-nadal-ton-sypek-odmienil-mecz-jedenastka-1-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Mbaye",
    "nazwisko": "N’Diaye",
    "klub": "Motor Lublin",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/grzesik-nadal-ton-sypek-odmienil-mecz-jedenastka-1-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Jakub",
    "nazwisko": "Sypek",
    "klub": "Zagłębie Lubin",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/grzesik-nadal-ton-sypek-odmienil-mecz-jedenastka-1-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Ivo",
    "nazwisko": "Rodrigues",
    "klub": "Motor Lublin",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/grzesik-nadal-ton-sypek-odmienil-mecz-jedenastka-1-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Jordi",
    "nazwisko": "Sanchez",
    "klub": "Wisła Kraków",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/grzesik-nadal-ton-sypek-odmienil-mecz-jedenastka-1-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Patryk",
    "nazwisko": "Makuch",
    "klub": "Raków Częstochowa",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/grzesik-nadal-ton-sypek-odmienil-mecz-jedenastka-1-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Rafał",
    "nazwisko": "Leszczyński",
    "klub": "Wisła Płock",
    "pozycja": "Bramkarz",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-radosc-jedenastka-2-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Ruben",
    "nazwisko": "Vinagre",
    "klub": "Legia Warszawa",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-radosc-jedenastka-2-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Przemysław",
    "nazwisko": "Wiśniewski",
    "klub": "Widzew Łódź",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-radosc-jedenastka-2-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Leo",
    "nazwisko": "Borges",
    "klub": "Pogoń Szczecin",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-radosc-jedenastka-2-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Piotr",
    "nazwisko": "Samiec-Talar",
    "klub": "Śląsk Wrocław",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-radosc-jedenastka-2-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Paul",
    "nazwisko": "Mukairu",
    "klub": "Pogoń Szczecin",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-radosc-jedenastka-2-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Bartosz",
    "nazwisko": "Nowak",
    "klub": "GKS Katowice",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-radosc-jedenastka-2-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Hugo",
    "nazwisko": "Vallejo",
    "klub": "Piast Gliwice",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-radosc-jedenastka-2-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Ilja",
    "nazwisko": "Szkurin",
    "klub": "GKS Katowice",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-radosc-jedenastka-2-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Łukasz",
    "nazwisko": "Zjawiński",
    "klub": "Legia Warszawa",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-radosc-jedenastka-2-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Jordi",
    "nazwisko": "Sanchez",
    "klub": "Wisła Kraków",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-radosc-jedenastka-2-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 3,
    "data": "2026-08-10",
    "imie": "Bartłomiej",
    "nazwisko": "Drągowski",
    "klub": "Widzew Łódź",
    "pozycja": "Bramkarz",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hat-trick-nominacji-jedenastka-3-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 3,
    "data": "2026-08-10",
    "imie": "Linus",
    "nazwisko": "Wahlqvist",
    "klub": "Pogoń Szczecin",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hat-trick-nominacji-jedenastka-3-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 3,
    "data": "2026-08-10",
    "imie": "Kamil",
    "nazwisko": "Piątkowski",
    "klub": "Legia Warszawa",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hat-trick-nominacji-jedenastka-3-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 3,
    "data": "2026-08-10",
    "imie": "Attila",
    "nazwisko": "Szalai",
    "klub": "Pogoń Szczecin",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hat-trick-nominacji-jedenastka-3-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 3,
    "data": "2026-08-10",
    "imie": "Mario",
    "nazwisko": "Garcia",
    "klub": "Widzew Łódź",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hat-trick-nominacji-jedenastka-3-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 3,
    "data": "2026-08-10",
    "imie": "Peter",
    "nazwisko": "Federico",
    "klub": "Górnik Zabrze",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hat-trick-nominacji-jedenastka-3-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 3,
    "data": "2026-08-10",
    "imie": "Patrik",
    "nazwisko": "Hellebrand",
    "klub": "Korona Kielce",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hat-trick-nominacji-jedenastka-3-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 3,
    "data": "2026-08-10",
    "imie": "Kacper",
    "nazwisko": "Urbański",
    "klub": "Górnik Zabrze",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hat-trick-nominacji-jedenastka-3-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 3,
    "data": "2026-08-10",
    "imie": "Luis",
    "nazwisko": "Palma",
    "klub": "Lech Poznań",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hat-trick-nominacji-jedenastka-3-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 3,
    "data": "2026-08-10",
    "imie": "Jordi",
    "nazwisko": "Sanchez",
    "klub": "Wisła Kraków",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hat-trick-nominacji-jedenastka-3-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Mihai",
    "nazwisko": "Popa",
    "klub": "Motor Lublin",
    "pozycja": "Bramkarz",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dublety-i-hat-trick-jedenastka-4-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Paweł",
    "nazwisko": "Wszołek",
    "klub": "Legia Warszawa",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dublety-i-hat-trick-jedenastka-4-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Josip",
    "nazwisko": "Ćorluka",
    "klub": "Zagłębie Lubin",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dublety-i-hat-trick-jedenastka-4-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Marcel",
    "nazwisko": "Pięczek",
    "klub": "Korona Kielce",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dublety-i-hat-trick-jedenastka-4-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Ruben",
    "nazwisko": "Vinagre",
    "klub": "Legia Warszawa",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dublety-i-hat-trick-jedenastka-4-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Peter",
    "nazwisko": "Federico",
    "klub": "Górnik Zabrze",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dublety-i-hat-trick-jedenastka-4-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Mbaye",
    "nazwisko": "N’Diaye",
    "klub": "Motor Lublin",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dublety-i-hat-trick-jedenastka-4-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Ajdin",
    "nazwisko": "Hasić",
    "klub": "Cracovia",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dublety-i-hat-trick-jedenastka-4-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Bartosz",
    "nazwisko": "Kapustka",
    "klub": "Legia Warszawa",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dublety-i-hat-trick-jedenastka-4-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Morgan",
    "nazwisko": "Fassbender",
    "klub": "Korona Kielce",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dublety-i-hat-trick-jedenastka-4-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Tobias",
    "nazwisko": "Christensen",
    "klub": "Wieczysta Kraków",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dublety-i-hat-trick-jedenastka-4-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Filip",
    "nazwisko": "Majchrowicz",
    "klub": "Radomiak Radom",
    "pozycja": "Bramkarz",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hasic-rozstrzygnal-derby-nowak-rozdawal-asysty-jedenastka-5-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Pau",
    "nazwisko": "Resta",
    "klub": "GKS Katowice",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hasic-rozstrzygnal-derby-nowak-rozdawal-asysty-jedenastka-5-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Arkadiusz",
    "nazwisko": "Jędrych",
    "klub": "GKS Katowice",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hasic-rozstrzygnal-derby-nowak-rozdawal-asysty-jedenastka-5-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Mario",
    "nazwisko": "Garcia",
    "klub": "Widzew Łódź",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hasic-rozstrzygnal-derby-nowak-rozdawal-asysty-jedenastka-5-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Piotr",
    "nazwisko": "Samiec-Talar",
    "klub": "Śląsk Wrocław",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hasic-rozstrzygnal-derby-nowak-rozdawal-asysty-jedenastka-5-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Maciej",
    "nazwisko": "Wojciechowski",
    "klub": "Pogoń Szczecin",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hasic-rozstrzygnal-derby-nowak-rozdawal-asysty-jedenastka-5-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Martin",
    "nazwisko": "Remacle",
    "klub": "Korona Kielce",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hasic-rozstrzygnal-derby-nowak-rozdawal-asysty-jedenastka-5-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Bartosz",
    "nazwisko": "Nowak",
    "klub": "GKS Katowice",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hasic-rozstrzygnal-derby-nowak-rozdawal-asysty-jedenastka-5-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Marko",
    "nazwisko": "Božić",
    "klub": "Wisła Kraków",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hasic-rozstrzygnal-derby-nowak-rozdawal-asysty-jedenastka-5-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Leandro",
    "nazwisko": "Sanca",
    "klub": "Piast Gliwice",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hasic-rozstrzygnal-derby-nowak-rozdawal-asysty-jedenastka-5-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Ajdin",
    "nazwisko": "Hasić",
    "klub": "Cracovia",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/hasic-rozstrzygnal-derby-nowak-rozdawal-asysty-jedenastka-5-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Otto",
    "nazwisko": "Hindrich",
    "klub": "Legia Warszawa",
    "pozycja": "Bramkarz",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/szkurin-bohaterem-slaskiego-klasyku-wolski-odwrocil-losy-meczu-jedenastka-6-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Leo",
    "nazwisko": "Borges",
    "klub": "Pogoń Szczecin",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/szkurin-bohaterem-slaskiego-klasyku-wolski-odwrocil-losy-meczu-jedenastka-6-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Juande",
    "nazwisko": "Rivas",
    "klub": "Piast Gliwice",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/szkurin-bohaterem-slaskiego-klasyku-wolski-odwrocil-losy-meczu-jedenastka-6-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Mariusz",
    "nazwisko": "Fornalczyk",
    "klub": "Widzew Łódź",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/szkurin-bohaterem-slaskiego-klasyku-wolski-odwrocil-losy-meczu-jedenastka-6-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Rafał",
    "nazwisko": "Wolski",
    "klub": "Radomiak Radom",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/szkurin-bohaterem-slaskiego-klasyku-wolski-odwrocil-losy-meczu-jedenastka-6-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Piotr",
    "nazwisko": "Samiec-Talar",
    "klub": "Śląsk Wrocław",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/szkurin-bohaterem-slaskiego-klasyku-wolski-odwrocil-losy-meczu-jedenastka-6-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Patrik",
    "nazwisko": "Walemark",
    "klub": "Lech Poznań",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/szkurin-bohaterem-slaskiego-klasyku-wolski-odwrocil-losy-meczu-jedenastka-6-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Ilja",
    "nazwisko": "Szkurin",
    "klub": "GKS Katowice",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/szkurin-bohaterem-slaskiego-klasyku-wolski-odwrocil-losy-meczu-jedenastka-6-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Nik",
    "nazwisko": "Prelec",
    "klub": "Jagiellonia Białystok",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/szkurin-bohaterem-slaskiego-klasyku-wolski-odwrocil-losy-meczu-jedenastka-6-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Jordi",
    "nazwisko": "Sanchez",
    "klub": "Wisła Kraków",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/szkurin-bohaterem-slaskiego-klasyku-wolski-odwrocil-losy-meczu-jedenastka-6-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Marcel",
    "nazwisko": "Łubik",
    "klub": "Wisła Kraków",
    "pozycja": "Bramkarz",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/zewlakow-bohaterem-szalonej-koncowki-czubak-nie-zwalnia-jedenastka-7-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Joel",
    "nazwisko": "Pereira",
    "klub": "Lech Poznań",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/zewlakow-bohaterem-szalonej-koncowki-czubak-nie-zwalnia-jedenastka-7-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Rafał",
    "nazwisko": "Janicki",
    "klub": "Górnik Zabrze",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/zewlakow-bohaterem-szalonej-koncowki-czubak-nie-zwalnia-jedenastka-7-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Juande",
    "nazwisko": "Rivas",
    "klub": "Piast Gliwice",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/zewlakow-bohaterem-szalonej-koncowki-czubak-nie-zwalnia-jedenastka-7-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Wiktor",
    "nazwisko": "Długosz",
    "klub": "Korona Kielce",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/zewlakow-bohaterem-szalonej-koncowki-czubak-nie-zwalnia-jedenastka-7-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Ousmane",
    "nazwisko": "Sow",
    "klub": "Jagiellonia Białystok",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/zewlakow-bohaterem-szalonej-koncowki-czubak-nie-zwalnia-jedenastka-7-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Kajetan",
    "nazwisko": "Szmyt",
    "klub": "Jagiellonia Białystok",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/zewlakow-bohaterem-szalonej-koncowki-czubak-nie-zwalnia-jedenastka-7-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Kamil",
    "nazwisko": "Jakubczyk",
    "klub": "Korona Kielce",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/zewlakow-bohaterem-szalonej-koncowki-czubak-nie-zwalnia-jedenastka-7-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Jakub",
    "nazwisko": "Żewłakow",
    "klub": "Legia Warszawa",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/zewlakow-bohaterem-szalonej-koncowki-czubak-nie-zwalnia-jedenastka-7-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Hugo",
    "nazwisko": "Vallejo",
    "klub": "Piast Gliwice",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/zewlakow-bohaterem-szalonej-koncowki-czubak-nie-zwalnia-jedenastka-7-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Karol",
    "nazwisko": "Czubak",
    "klub": "Motor Lublin",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/zewlakow-bohaterem-szalonej-koncowki-czubak-nie-zwalnia-jedenastka-7-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Otto",
    "nazwisko": "Hindrich",
    "klub": "Legia Warszawa",
    "pozycja": "Bramkarz",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/makuch-zapewnil-przelamanie-prekop-zatrzymal-mistrza-jedenastka-8-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Wiktor",
    "nazwisko": "Długosz",
    "klub": "Korona Kielce",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/makuch-zapewnil-przelamanie-prekop-zatrzymal-mistrza-jedenastka-8-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Jakub",
    "nazwisko": "Czerwiński",
    "klub": "Piast Gliwice",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/makuch-zapewnil-przelamanie-prekop-zatrzymal-mistrza-jedenastka-8-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Žan",
    "nazwisko": "Rogelj",
    "klub": "Wisła Płock",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/makuch-zapewnil-przelamanie-prekop-zatrzymal-mistrza-jedenastka-8-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Hugo",
    "nazwisko": "Vallejo",
    "klub": "Piast Gliwice",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/makuch-zapewnil-przelamanie-prekop-zatrzymal-mistrza-jedenastka-8-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Patryk",
    "nazwisko": "Dziczek",
    "klub": "Pogoń Szczecin",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/makuch-zapewnil-przelamanie-prekop-zatrzymal-mistrza-jedenastka-8-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Marko",
    "nazwisko": "Božić",
    "klub": "Wisła Kraków",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/makuch-zapewnil-przelamanie-prekop-zatrzymal-mistrza-jedenastka-8-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Darko",
    "nazwisko": "Churlinov",
    "klub": "Pogoń Szczecin",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/makuch-zapewnil-przelamanie-prekop-zatrzymal-mistrza-jedenastka-8-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Patryk",
    "nazwisko": "Makuch",
    "klub": "Raków Częstochowa",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/makuch-zapewnil-przelamanie-prekop-zatrzymal-mistrza-jedenastka-8-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Angel",
    "nazwisko": "Rodado",
    "klub": "Wisła Kraków",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/makuch-zapewnil-przelamanie-prekop-zatrzymal-mistrza-jedenastka-8-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Erik",
    "nazwisko": "Prekop",
    "klub": "Górnik Zabrze",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/makuch-zapewnil-przelamanie-prekop-zatrzymal-mistrza-jedenastka-8-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 9,
    "data": "2026-09-21",
    "imie": "Rafał",
    "nazwisko": "Leszczyński",
    "klub": "Wisła Płock",
    "pozycja": "Bramkarz",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dubletowy-koncert-jedenastka-9-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 9,
    "data": "2026-09-21",
    "imie": "Mario",
    "nazwisko": "Garcia",
    "klub": "Widzew Łódź",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dubletowy-koncert-jedenastka-9-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 9,
    "data": "2026-09-21",
    "imie": "Rafał",
    "nazwisko": "Augustyniak",
    "klub": "Legia Warszawa",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dubletowy-koncert-jedenastka-9-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 9,
    "data": "2026-09-21",
    "imie": "Paweł",
    "nazwisko": "Wszołek",
    "klub": "Legia Warszawa",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dubletowy-koncert-jedenastka-9-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 9,
    "data": "2026-09-21",
    "imie": "Darko",
    "nazwisko": "Churlinov",
    "klub": "Pogoń Szczecin",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dubletowy-koncert-jedenastka-9-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 9,
    "data": "2026-09-21",
    "imie": "Patrik",
    "nazwisko": "Walemark",
    "klub": "Lech Poznań",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dubletowy-koncert-jedenastka-9-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 9,
    "data": "2026-09-21",
    "imie": "Pablo",
    "nazwisko": "Rodriguez",
    "klub": "Lech Poznań",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dubletowy-koncert-jedenastka-9-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 9,
    "data": "2026-09-21",
    "imie": "Kacper",
    "nazwisko": "Duda",
    "klub": "Wisła Kraków",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dubletowy-koncert-jedenastka-9-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 9,
    "data": "2026-09-21",
    "imie": "Bartosz",
    "nazwisko": "Nowak",
    "klub": "GKS Katowice",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dubletowy-koncert-jedenastka-9-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 9,
    "data": "2026-09-21",
    "imie": "Angel",
    "nazwisko": "Rodado",
    "klub": "Wisła Kraków",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dubletowy-koncert-jedenastka-9-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 9,
    "data": "2026-09-21",
    "imie": "Mariusz",
    "nazwisko": "Stępiński",
    "klub": "Korona Kielce",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/dubletowy-koncert-jedenastka-9-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Otto",
    "nazwisko": "Hindrich",
    "klub": "Legia Warszawa",
    "pozycja": "Bramkarz",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-sila-razenia-jedenastka-10-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Kamil",
    "nazwisko": "Pestka",
    "klub": "Wieczysta Kraków",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-sila-razenia-jedenastka-10-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Rafał",
    "nazwisko": "Augustyniak",
    "klub": "Legia Warszawa",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-sila-razenia-jedenastka-10-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Mateusz",
    "nazwisko": "Skrzypczak",
    "klub": "Lech Poznań",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-sila-razenia-jedenastka-10-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Paul",
    "nazwisko": "Mukairu",
    "klub": "Pogoń Szczecin",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-sila-razenia-jedenastka-10-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Patrik",
    "nazwisko": "Walemark",
    "klub": "Lech Poznań",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-sila-razenia-jedenastka-10-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Ajdin",
    "nazwisko": "Hasić",
    "klub": "Cracovia",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-sila-razenia-jedenastka-10-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Bartosz",
    "nazwisko": "Nowak",
    "klub": "GKS Katowice",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-sila-razenia-jedenastka-10-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Lucas",
    "nazwisko": "Piazon",
    "klub": "Wieczysta Kraków",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-sila-razenia-jedenastka-10-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Lisandro",
    "nazwisko": "Semedo",
    "klub": "Wieczysta Kraków",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-sila-razenia-jedenastka-10-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Sondre",
    "nazwisko": "Liseth",
    "klub": "Górnik Zabrze",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/podwojna-sila-razenia-jedenastka-10-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Karol",
    "nazwisko": "Niemczycki",
    "klub": "Śląsk Wrocław",
    "pozycja": "Bramkarz",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/show-pilkarzy-kolejorza-jedenastka-11-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Attila",
    "nazwisko": "Szalai",
    "klub": "Pogoń Szczecin",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/show-pilkarzy-kolejorza-jedenastka-11-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Roman",
    "nazwisko": "Jakuba",
    "klub": "Zagłębie Lubin",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/show-pilkarzy-kolejorza-jedenastka-11-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Erik",
    "nazwisko": "Janza",
    "klub": "Górnik Zabrze",
    "pozycja": "Obrońca",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/show-pilkarzy-kolejorza-jedenastka-11-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Lamine",
    "nazwisko": "Diaby-Fadiga",
    "klub": "Raków Częstochowa",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/show-pilkarzy-kolejorza-jedenastka-11-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Piotr",
    "nazwisko": "Samiec-Talar",
    "klub": "Śląsk Wrocław",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/show-pilkarzy-kolejorza-jedenastka-11-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Yacine",
    "nazwisko": "Bourhane",
    "klub": "Motor Lublin",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/show-pilkarzy-kolejorza-jedenastka-11-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Patrik",
    "nazwisko": "Walemark",
    "klub": "Lech Poznań",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/show-pilkarzy-kolejorza-jedenastka-11-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Pablo",
    "nazwisko": "Rodriguez",
    "klub": "Lech Poznań",
    "pozycja": "Pomocnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/show-pilkarzy-kolejorza-jedenastka-11-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Lasse",
    "nazwisko": "Nordas",
    "klub": "Cracovia",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/show-pilkarzy-kolejorza-jedenastka-11-kolejki-20262027/"
  },
  {
    "liga": "Ekstraklasa",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Mikael",
    "nazwisko": "Ishak",
    "klub": "Lech Poznań",
    "pozycja": "Napastnik",
    "zrodlo": "https://ekstraklasa.org/aktualnosci/show-pilkarzy-kolejorza-jedenastka-11-kolejki-20262027/"
  },
  {
    "liga": "I liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Dawid",
    "nazwisko": "Arndt",
    "klub": "Arka Gdynia",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/dublety-i-hat-trick-asyst-popisy-w-inauguracyjnej-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Damian",
    "nazwisko": "Hilbrycht",
    "klub": "Bruk-Bet Termalica Nieciecza",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/dublety-i-hat-trick-asyst-popisy-w-inauguracyjnej-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Jakub",
    "nazwisko": "Budnicki",
    "klub": "Polonia Warszawa",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/dublety-i-hat-trick-asyst-popisy-w-inauguracyjnej-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Krystian",
    "nazwisko": "Miś",
    "klub": "Pogoń Siedlce",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/dublety-i-hat-trick-asyst-popisy-w-inauguracyjnej-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Kelechukwu",
    "nazwisko": "Ibe-Torti",
    "klub": "Chrobry Głogów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/dublety-i-hat-trick-asyst-popisy-w-inauguracyjnej-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Dominik",
    "nazwisko": "Kun",
    "klub": "Arka Gdynia",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/dublety-i-hat-trick-asyst-popisy-w-inauguracyjnej-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Bartłomiej",
    "nazwisko": "Ciepiela",
    "klub": "Pogoń Grodzisk Mazowiecki",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/dublety-i-hat-trick-asyst-popisy-w-inauguracyjnej-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Jehor",
    "nazwisko": "Szarabura",
    "klub": "Chrobry Głogów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/dublety-i-hat-trick-asyst-popisy-w-inauguracyjnej-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Kamil",
    "nazwisko": "Zapolnik",
    "klub": "Bruk-Bet Termalica Nieciecza",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/dublety-i-hat-trick-asyst-popisy-w-inauguracyjnej-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Kamil",
    "nazwisko": "Wojtyra",
    "klub": "Polonia Bytom",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/dublety-i-hat-trick-asyst-popisy-w-inauguracyjnej-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Kamil",
    "nazwisko": "Odolak",
    "klub": "Stal Mielec",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/dublety-i-hat-trick-asyst-popisy-w-inauguracyjnej-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Adrian",
    "nazwisko": "Chovan",
    "klub": "Bruk-Bet Termalica Nieciecza",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pierwszy-hat-trick-w-sezonie-kto-wyroznil-sie-w-2-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Konrad",
    "nazwisko": "Gruszkowski",
    "klub": "Arka Gdynia",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pierwszy-hat-trick-w-sezonie-kto-wyroznil-sie-w-2-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Maksymilian",
    "nazwisko": "Pingot",
    "klub": "Odra Opole",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pierwszy-hat-trick-w-sezonie-kto-wyroznil-sie-w-2-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Marcel",
    "nazwisko": "Stefaniak",
    "klub": "Warta Poznań",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pierwszy-hat-trick-w-sezonie-kto-wyroznil-sie-w-2-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Kamil",
    "nazwisko": "Antonik",
    "klub": "Miedź Legnica",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pierwszy-hat-trick-w-sezonie-kto-wyroznil-sie-w-2-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Piotr",
    "nazwisko": "Wlazło",
    "klub": "Stal Mielec",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pierwszy-hat-trick-w-sezonie-kto-wyroznil-sie-w-2-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Dave",
    "nazwisko": "Gnaase",
    "klub": "Polonia Warszawa",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pierwszy-hat-trick-w-sezonie-kto-wyroznil-sie-w-2-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Damian",
    "nazwisko": "Jaroń",
    "klub": "Pogoń Grodzisk Mazowiecki",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pierwszy-hat-trick-w-sezonie-kto-wyroznil-sie-w-2-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Kamil",
    "nazwisko": "Zapolnik",
    "klub": "Bruk-Bet Termalica Nieciecza",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pierwszy-hat-trick-w-sezonie-kto-wyroznil-sie-w-2-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Vladislavs",
    "nazwisko": "Gutkovskis",
    "klub": "Arka Gdynia",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pierwszy-hat-trick-w-sezonie-kto-wyroznil-sie-w-2-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 2,
    "data": "2026-08-04",
    "imie": "Fabian",
    "nazwisko": "Piasecki",
    "klub": "ŁKS Łódź",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pierwszy-hat-trick-w-sezonie-kto-wyroznil-sie-w-2-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 4,
    "data": "2026-08-18",
    "imie": "Ivan",
    "nazwisko": "Lucić",
    "klub": "Miedź Legnica",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-4-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 4,
    "data": "2026-08-18",
    "imie": "Bartosz",
    "nazwisko": "Biedrzycki",
    "klub": "Odra Opole",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-4-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 4,
    "data": "2026-08-18",
    "imie": "Przemysław",
    "nazwisko": "Szur",
    "klub": "Pogoń Siedlce",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-4-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 4,
    "data": "2026-08-18",
    "imie": "Krystian",
    "nazwisko": "Getinger",
    "klub": "Stal Mielec",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-4-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 4,
    "data": "2026-08-18",
    "imie": "Asier",
    "nazwisko": "Cordoba",
    "klub": "Miedź Legnica",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-4-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 4,
    "data": "2026-08-18",
    "imie": "Szymon",
    "nazwisko": "Szymański",
    "klub": "Ruch Chorzów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-4-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 4,
    "data": "2026-08-18",
    "imie": "Andreu",
    "nazwisko": "Arasa",
    "klub": "ŁKS Łódź",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-4-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 4,
    "data": "2026-08-18",
    "imie": "Kamil",
    "nazwisko": "Cybulski",
    "klub": "Stal Mielec",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-4-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 4,
    "data": "2026-08-18",
    "imie": "Filip",
    "nazwisko": "Waluś",
    "klub": "Arka Gdynia",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-4-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 4,
    "data": "2026-08-18",
    "imie": "Daniel",
    "nazwisko": "Stanclik",
    "klub": "Miedź Legnica",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-4-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 4,
    "data": "2026-08-18",
    "imie": "Szymon",
    "nazwisko": "Kobusiński",
    "klub": "Pogoń Siedlce",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-4-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 5,
    "data": "2026-08-25",
    "imie": "Mateusz",
    "nazwisko": "Jeleń",
    "klub": "Polonia Warszawa",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/piata-kolejka-betclic-1-ligi-za-nami-kto-w-niej-brylowal/"
  },
  {
    "liga": "I liga",
    "kolejka": 5,
    "data": "2026-08-25",
    "imie": "Lucjan",
    "nazwisko": "Zieliński",
    "klub": "Polonia Bytom",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/piata-kolejka-betclic-1-ligi-za-nami-kto-w-niej-brylowal/"
  },
  {
    "liga": "I liga",
    "kolejka": 5,
    "data": "2026-08-25",
    "imie": "Danyło",
    "nazwisko": "Beskorowajnyj",
    "klub": "Lechia Gdańsk",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/piata-kolejka-betclic-1-ligi-za-nami-kto-w-niej-brylowal/"
  },
  {
    "liga": "I liga",
    "kolejka": 5,
    "data": "2026-08-25",
    "imie": "Ilkay",
    "nazwisko": "Durmus",
    "klub": "Polonia Warszawa",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/piata-kolejka-betclic-1-ligi-za-nami-kto-w-niej-brylowal/"
  },
  {
    "liga": "I liga",
    "kolejka": 5,
    "data": "2026-08-25",
    "imie": "Ernest",
    "nazwisko": "Terpiłowski",
    "klub": "Polonia Warszawa",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/piata-kolejka-betclic-1-ligi-za-nami-kto-w-niej-brylowal/"
  },
  {
    "liga": "I liga",
    "kolejka": 5,
    "data": "2026-08-25",
    "imie": "Kacper",
    "nazwisko": "Łoś",
    "klub": "Pogoń Grodzisk Mazowiecki",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/piata-kolejka-betclic-1-ligi-za-nami-kto-w-niej-brylowal/"
  },
  {
    "liga": "I liga",
    "kolejka": 5,
    "data": "2026-08-25",
    "imie": "Aleksander",
    "nazwisko": "Wołczek",
    "klub": "Warta Poznań",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/piata-kolejka-betclic-1-ligi-za-nami-kto-w-niej-brylowal/"
  },
  {
    "liga": "I liga",
    "kolejka": 5,
    "data": "2026-08-25",
    "imie": "Kamil",
    "nazwisko": "Antonik",
    "klub": "Miedź Legnica",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/piata-kolejka-betclic-1-ligi-za-nami-kto-w-niej-brylowal/"
  },
  {
    "liga": "I liga",
    "kolejka": 5,
    "data": "2026-08-25",
    "imie": "Andreu",
    "nazwisko": "Arasa",
    "klub": "ŁKS Łódź",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/piata-kolejka-betclic-1-ligi-za-nami-kto-w-niej-brylowal/"
  },
  {
    "liga": "I liga",
    "kolejka": 5,
    "data": "2026-08-25",
    "imie": "Karol",
    "nazwisko": "Podliński",
    "klub": "ŁKS Łódź",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/piata-kolejka-betclic-1-ligi-za-nami-kto-w-niej-brylowal/"
  },
  {
    "liga": "I liga",
    "kolejka": 5,
    "data": "2026-08-25",
    "imie": "Kamil",
    "nazwisko": "Sabiłło",
    "klub": "Unia Skierniewice",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/piata-kolejka-betclic-1-ligi-za-nami-kto-w-niej-brylowal/"
  },
  {
    "liga": "I liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Krzysztof",
    "nazwisko": "Bąkowski",
    "klub": "Chrobry Głogów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/camilo-mena-show-przy-konwiktorskiej-kto-poza-nim-zaimponowal-w-6-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Jakub",
    "nazwisko": "Lis",
    "klub": "Chrobry Głogów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/camilo-mena-show-przy-konwiktorskiej-kto-poza-nim-zaimponowal-w-6-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Marco",
    "nazwisko": "Komenda",
    "klub": "Arka Gdynia",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/camilo-mena-show-przy-konwiktorskiej-kto-poza-nim-zaimponowal-w-6-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Przemysław",
    "nazwisko": "Szur",
    "klub": "Pogoń Siedlce",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/camilo-mena-show-przy-konwiktorskiej-kto-poza-nim-zaimponowal-w-6-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Krystian",
    "nazwisko": "Miś",
    "klub": "Pogoń Siedlce",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/camilo-mena-show-przy-konwiktorskiej-kto-poza-nim-zaimponowal-w-6-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Camilo",
    "nazwisko": "Mena",
    "klub": "Lechia Gdańsk",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/camilo-mena-show-przy-konwiktorskiej-kto-poza-nim-zaimponowal-w-6-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Sean",
    "nazwisko": "Goss",
    "klub": "Stal Rzeszów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/camilo-mena-show-przy-konwiktorskiej-kto-poza-nim-zaimponowal-w-6-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Zvonimir",
    "nazwisko": "Petrović",
    "klub": "Miedź Legnica",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/camilo-mena-show-przy-konwiktorskiej-kto-poza-nim-zaimponowal-w-6-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Mateusz",
    "nazwisko": "Cholewiak",
    "klub": "Puszcza Niepołomice",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/camilo-mena-show-przy-konwiktorskiej-kto-poza-nim-zaimponowal-w-6-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Andrzej",
    "nazwisko": "Trubeha",
    "klub": "Puszcza Niepołomice",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/camilo-mena-show-przy-konwiktorskiej-kto-poza-nim-zaimponowal-w-6-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Artur",
    "nazwisko": "Szach",
    "klub": "Lechia Gdańsk",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/camilo-mena-show-przy-konwiktorskiej-kto-poza-nim-zaimponowal-w-6-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Krzysztof",
    "nazwisko": "Kamiński",
    "klub": "Pogoń Grodzisk Mazowiecki",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-7-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Damian",
    "nazwisko": "Hilbrycht",
    "klub": "Bruk-Bet Termalica Nieciecza",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-7-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Jakub",
    "nazwisko": "Szymański",
    "klub": "Polonia Bytom",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-7-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Mateusz",
    "nazwisko": "Grudziński",
    "klub": "Miedź Legnica",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-7-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Krystian",
    "nazwisko": "Getinger",
    "klub": "Stal Mielec",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-7-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Damian",
    "nazwisko": "Jaroń",
    "klub": "Pogoń Grodzisk Mazowiecki",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-7-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Sean",
    "nazwisko": "Goss",
    "klub": "Stal Rzeszów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-7-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Krzysztof",
    "nazwisko": "Kubica",
    "klub": "Bruk-Bet Termalica Nieciecza",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-7-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Shuma",
    "nazwisko": "Nagamatsu",
    "klub": "Ruch Chorzów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-7-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Patryk",
    "nazwisko": "Szwedzik",
    "klub": "Ruch Chorzów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-7-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 7,
    "data": "2026-09-08",
    "imie": "Marcel",
    "nazwisko": "Mansfeld",
    "klub": "Miedź Legnica",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-7-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Jakub",
    "nazwisko": "Lemanowicz",
    "klub": "Pogoń Siedlce",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-8-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Damian",
    "nazwisko": "Hilbrycht",
    "klub": "Bruk-Bet Termalica Nieciecza",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-8-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Ołeksandr",
    "nazwisko": "Azaćkyj",
    "klub": "Warta Poznań",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-8-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Danyło",
    "nazwisko": "Beskorowajnyj",
    "klub": "Lechia Gdańsk",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-8-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Lenard",
    "nazwisko": "Szczygieł",
    "klub": "ŁKS Łódź",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-8-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Sean",
    "nazwisko": "Goss",
    "klub": "Stal Rzeszów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-8-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Tomasz",
    "nazwisko": "Neugebauer",
    "klub": "Lechia Gdańsk",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-8-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Jakub",
    "nazwisko": "Kristan",
    "klub": "Ruch Chorzów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-8-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Konrad",
    "nazwisko": "Andrzejczak",
    "klub": "Polonia Bytom",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-8-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Bartosz",
    "nazwisko": "Bida",
    "klub": "Unia Skierniewice",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-8-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 8,
    "data": "2026-09-15",
    "imie": "Mateusz",
    "nazwisko": "Stanek",
    "klub": "Warta Poznań",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-8-kolejce-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Krzysztof",
    "nazwisko": "Kamiński",
    "klub": "Pogoń Grodzisk Mazowiecki",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pokaz-sily-lidera-jedenastka-10-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Paweł",
    "nazwisko": "Olszewski",
    "klub": "Polonia Warszawa",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pokaz-sily-lidera-jedenastka-10-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Marcin",
    "nazwisko": "Biernat",
    "klub": "Podbeskidzie Bielsko-Biała",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pokaz-sily-lidera-jedenastka-10-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Maksymilian",
    "nazwisko": "Pingot",
    "klub": "Odra Opole",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pokaz-sily-lidera-jedenastka-10-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Jan",
    "nazwisko": "Mierzwa",
    "klub": "Unia Skierniewice",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pokaz-sily-lidera-jedenastka-10-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Kacper",
    "nazwisko": "Łoś",
    "klub": "Pogoń Grodzisk Mazowiecki",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pokaz-sily-lidera-jedenastka-10-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Marcin",
    "nazwisko": "Cebula",
    "klub": "Stal Mielec",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pokaz-sily-lidera-jedenastka-10-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Bartłomiej",
    "nazwisko": "Ciepiela",
    "klub": "Pogoń Grodzisk Mazowiecki",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pokaz-sily-lidera-jedenastka-10-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Teddy",
    "nazwisko": "Sutherland",
    "klub": "Ruch Chorzów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pokaz-sily-lidera-jedenastka-10-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Vladislav",
    "nazwisko": "Blanuta",
    "klub": "Lechia Gdańsk",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pokaz-sily-lidera-jedenastka-10-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 10,
    "data": "2026-10-13",
    "imie": "Konrad",
    "nazwisko": "Andrzejczak",
    "klub": "Polonia Bytom",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/pokaz-sily-lidera-jedenastka-10-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Dmytro",
    "nazwisko": "Sydorenko",
    "klub": "Miedź Legnica",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-11-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Jakub",
    "nazwisko": "Apolinarski",
    "klub": "Warta Poznań",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-11-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Władysław",
    "nazwisko": "Krasowskij",
    "klub": "Stal Rzeszów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-11-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Damian",
    "nazwisko": "Hilbrycht",
    "klub": "Bruk-Bet Termalica Nieciecza",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-11-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Kevin",
    "nazwisko": "Dodaj",
    "klub": "Lechia Gdańsk",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-11-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Szymon",
    "nazwisko": "Szymański",
    "klub": "Ruch Chorzów",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-11-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Dave",
    "nazwisko": "Gnaase",
    "klub": "Polonia Warszawa",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-11-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Benedik",
    "nazwisko": "Mioc",
    "klub": "Polonia Bytom",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-11-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Cezary",
    "nazwisko": "Demianiuk",
    "klub": "Pogoń Siedlce",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-11-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Karol",
    "nazwisko": "Podliński",
    "klub": "ŁKS Łódź",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-11-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "I liga",
    "kolejka": 11,
    "data": "2026-10-20",
    "imie": "Artur",
    "nazwisko": "Szach",
    "klub": "Lechia Gdańsk",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-znalazl-sie-w-jedenastce-11-kolejki-betclic-1-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Jakub",
    "nazwisko": "Mądrzyk",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "liga": "II liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Mateusz",
    "nazwisko": "Jeleński",
    "klub": "Znicz Pruszków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "liga": "II liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Damian",
    "nazwisko": "Zbozień",
    "klub": "Avia Świdnik",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "liga": "II liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Tobiasz",
    "nazwisko": "Kubik",
    "klub": "Podhale Nowy Targ",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "liga": "II liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Dariusz",
    "nazwisko": "Kamiński",
    "klub": "Stal Stalowa Wola",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "liga": "II liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Maksymilian",
    "nazwisko": "Hebel",
    "klub": "Stal Stalowa Wola",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "liga": "II liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Adam",
    "nazwisko": "Deja",
    "klub": "Górnik Łęczna",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "liga": "II liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Michał",
    "nazwisko": "Walski",
    "klub": "Górnik Łęczna",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "liga": "II liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Maciej",
    "nazwisko": "Mas",
    "klub": "Zawisza Bydgoszcz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "liga": "II liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Bartosz",
    "nazwisko": "Kurzeja",
    "klub": "Podhale Nowy Targ",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "liga": "II liga",
    "kolejka": 1,
    "data": "2026-07-28",
    "imie": "Andrij",
    "nazwisko": "Remeniuk",
    "klub": "Avia Świdnik",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/popisowa-partia-beniaminka-w-inauguracyjnej-kolejce-betclic-2-ligi-kto-znalazl-sie-w-jedenastce/"
  },
  {
    "liga": "II liga",
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Adrian",
    "nazwisko": "Lis",
    "klub": "Sokół Kleczew",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Patryk",
    "nazwisko": "Kieliś",
    "klub": "Sandecja Nowy Sącz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Bartosz",
    "nazwisko": "Zbiciak",
    "klub": "Olimpia Grudziądz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Dawid",
    "nazwisko": "Barnowski",
    "klub": "Znicz Pruszków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Wiktor",
    "nazwisko": "Kamiński",
    "klub": "Śląsk II Wrocław",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Michał",
    "nazwisko": "Trąbka",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Andrij",
    "nazwisko": "Remeniuk",
    "klub": "Avia Świdnik",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Oskar",
    "nazwisko": "Zawada",
    "klub": "Hutnik Kraków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Piotr",
    "nazwisko": "Janczukowicz",
    "klub": "Sandecja Nowy Sącz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 2,
    "data": "2026-08-03",
    "imie": "Jan",
    "nazwisko": "Ciućka",
    "klub": "Rekord Bielsko-Biała",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-drugiej-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Michał",
    "nazwisko": "Oczkowski",
    "klub": "Zawisza Bydgoszcz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Paweł",
    "nazwisko": "Olkowski",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Paweł",
    "nazwisko": "Jaroszyński",
    "klub": "Górnik Łęczna",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Mateusz",
    "nazwisko": "Bąkowicz",
    "klub": "Chojniczanka Chojnice",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Patryk",
    "nazwisko": "Kieliś",
    "klub": "Sandecja Nowy Sącz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Adam",
    "nazwisko": "Deja",
    "klub": "Górnik Łęczna",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Jakub",
    "nazwisko": "Stec",
    "klub": "Olimpia Grudziądz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Filip",
    "nazwisko": "Adamski",
    "klub": "Sokół Kleczew",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Maksymilian",
    "nazwisko": "Hebel",
    "klub": "Stal Stalowa Wola",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Oskar",
    "nazwisko": "Zawada",
    "klub": "Hutnik Kraków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 4,
    "data": "2026-08-17",
    "imie": "Javier Mateo",
    "nazwisko": "Ortiz",
    "klub": "Resovia",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-wyroznienie-w-4-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Karol",
    "nazwisko": "Szymkowiak",
    "klub": "Sandecja Nowy Sącz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Paweł",
    "nazwisko": "Olkowski",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Sebastian",
    "nazwisko": "Golak",
    "klub": "Zawisza Bydgoszcz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Dawid",
    "nazwisko": "Szwiec",
    "klub": "Świt Szczecin",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Dawid",
    "nazwisko": "Abramowicz",
    "klub": "Olimpia Grudziądz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Mateusz",
    "nazwisko": "Stępień",
    "klub": "Zawisza Bydgoszcz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Michał",
    "nazwisko": "Trąbka",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Aleksander",
    "nazwisko": "Wyganowski",
    "klub": "Legia II Warszawa",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Cyprian",
    "nazwisko": "Pchełka",
    "klub": "Legia II Warszawa",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Bekem",
    "nazwisko": "Bicki",
    "klub": "Legia II Warszawa",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 5,
    "data": "2026-08-24",
    "imie": "Valerijs",
    "nazwisko": "Sabala",
    "klub": "Chojniczanka Chojnice",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-wyroznil-sie-w-5-kolejce-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Mateusz",
    "nazwisko": "Abramowicz",
    "klub": "Świt Szczecin",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Rafał",
    "nazwisko": "Kobryń",
    "klub": "Górnik Łęczna",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Jarosław",
    "nazwisko": "Jach",
    "klub": "Znicz Pruszków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Michał",
    "nazwisko": "Szmigiel",
    "klub": "Lechia Zielona Góra",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Bartosz",
    "nazwisko": "Florek",
    "klub": "Hutnik Kraków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Władysław",
    "nazwisko": "Ochronczuk",
    "klub": "Znicz Pruszków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Adam",
    "nazwisko": "Brenkus",
    "klub": "Sandecja Nowy Sącz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Przemysław",
    "nazwisko": "Bargiel",
    "klub": "Lechia Zielona Góra",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Mateusz",
    "nazwisko": "Stępień",
    "klub": "Zawisza Bydgoszcz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "",
    "nazwisko": "Marcinho",
    "klub": "Podhale Nowy Targ",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 6,
    "data": "2026-08-31",
    "imie": "Filip",
    "nazwisko": "Kozłowski",
    "klub": "Zawisza Bydgoszcz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/kto-zapracowal-na-miejsce-w-jedenastce-6-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Mateusz",
    "nazwisko": "Abramowicz",
    "klub": "Świt Szczecin",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Józef",
    "nazwisko": "Chorosiński",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Mikołaj",
    "nazwisko": "Staniak",
    "klub": "Zawisza Bydgoszcz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Dawid",
    "nazwisko": "Barnowski",
    "klub": "Znicz Pruszków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Adam",
    "nazwisko": "Deja",
    "klub": "Górnik Łęczna",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Dennis",
    "nazwisko": "Jastrzembski",
    "klub": "Olimpia Grudziądz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Tymon",
    "nazwisko": "Proczek",
    "klub": "Znicz Pruszków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Łukasz",
    "nazwisko": "Seweryn",
    "klub": "Podhale Nowy Targ",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Adam",
    "nazwisko": "Frączczak",
    "klub": "Świt Szczecin",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Jakub",
    "nazwisko": "Jeleń",
    "klub": "Stal Stalowa Wola",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 7,
    "data": "2026-09-07",
    "imie": "Kacper",
    "nazwisko": "Kasprzak",
    "klub": "Rekord Bielsko-Biała",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/syn-swojego-ojca-jakub-jelen-bohaterem-7-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Michał",
    "nazwisko": "Jerke",
    "klub": "Olimpia Grudziądz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Paweł",
    "nazwisko": "Jaroszyński",
    "klub": "Górnik Łęczna",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Matija",
    "nazwisko": "Horvat",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Kacper",
    "nazwisko": "Orzechowski",
    "klub": "Avia Świdnik",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Dennis",
    "nazwisko": "Jastrzembski",
    "klub": "Olimpia Grudziądz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Kacper",
    "nazwisko": "Żendełek",
    "klub": "Świt Szczecin",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Arkadiusz",
    "nazwisko": "Nowak",
    "klub": "Podhale Nowy Targ",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Tymon",
    "nazwisko": "Proczek",
    "klub": "Znicz Pruszków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Damian",
    "nazwisko": "Kądzior",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Dawid",
    "nazwisko": "Dębski",
    "klub": "Lechia Zielona Góra",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 10,
    "data": "2026-10-06",
    "imie": "Adrian",
    "nazwisko": "Kazimierczak",
    "klub": "Znicz Pruszków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/spadkowicze-gora-jedenastka-10-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Kacper",
    "nazwisko": "Napieraj",
    "klub": "Znicz Pruszków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Dawid",
    "nazwisko": "Barnowski",
    "klub": "Znicz Pruszków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Igor",
    "nazwisko": "Łasicki",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Cyprian",
    "nazwisko": "Pchełka",
    "klub": "Legia II Warszawa",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Dariusz",
    "nazwisko": "Kamiński",
    "klub": "Stal Stalowa Wola",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Hubert",
    "nazwisko": "Adamczyk",
    "klub": "Chojniczanka Chojnice",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Damian",
    "nazwisko": "Kądzior",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Kacper",
    "nazwisko": "Plichta",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Jakub",
    "nazwisko": "Jeleń",
    "klub": "Stal Stalowa Wola",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Kacper",
    "nazwisko": "Wełniak",
    "klub": "Avia Świdnik",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 11,
    "data": "2026-10-13",
    "imie": "Kacper",
    "nazwisko": "Rzepka",
    "klub": "Hutnik Kraków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/znicz-nie-zwalnia-tempa-jedenastka-11-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Dorian",
    "nazwisko": "Frątczak",
    "klub": "Podhale Nowy Targ",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Krystian",
    "nazwisko": "Szymocha",
    "klub": "Sokół Kleczew",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Dmytro",
    "nazwisko": "Juchymowycz",
    "klub": "Chojniczanka Chojnice",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Jarosław",
    "nazwisko": "Jach",
    "klub": "Znicz Pruszków",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Michał",
    "nazwisko": "Kołodziejski",
    "klub": "Avia Świdnik",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Mateusz",
    "nazwisko": "Stępień",
    "klub": "Zawisza Bydgoszcz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Dawid",
    "nazwisko": "Kort",
    "klub": "Świt Szczecin",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Maksymilian",
    "nazwisko": "Hebel",
    "klub": "Stal Stalowa Wola",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Damian",
    "nazwisko": "Kądzior",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Filip",
    "nazwisko": "Piszczek",
    "klub": "Sandecja Nowy Sącz",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  },
  {
    "liga": "II liga",
    "kolejka": 12,
    "data": "2026-10-20",
    "imie": "Mateusz",
    "nazwisko": "Lewandowski",
    "klub": "GKS Tychy",
    "pozycja": "",
    "zrodlo": "https://pilkanozna.pl/damian-kadzior-i-spolka-czyli-jedenastka-12-kolejki-betclic-2-ligi/"
  }
];
