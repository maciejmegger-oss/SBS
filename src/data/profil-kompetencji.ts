// PROFIL KOMPETENCJI — szkielet oceny zawodnika przeniesiony z arkusza klubowego.
//
// NIE POPRAWIAJ RĘCZNIE. Plik powstaje z arkusza „Nazwisko-U19.xlsx":
//   node scripts/wczytaj-profil-lechia.mjs "<plik.xlsx>" --taksonomia
//
// Model: pięć obszarów → elementy z oceną 1–6 → składowe oznaczone WIODĄCA / NEUTRALNIE / DEFICYT.
// Ocena elementu mówi o poziomie, znak składowej — co dokładnie ten poziom tworzy.

export type ZnakSkladowej = 'WIODĄCA' | 'NEUTRALNIE' | 'DEFICYT';

export interface ElementProfilu { nazwa: string; skladowe: string[]; grupa?: string; testy?: boolean; opis?: string }
export interface ObszarProfilu { nazwa: string; elementy: ElementProfilu[]; obligatoryjne?: string[] }

/** Skala 1–6 wspólna dla wszystkich obszarów — tak nazywa poziomy arkusz klubowy. */
export const LEGENDA_OCENY: { stopien: number; opis: string }[] = [
  {"stopien":6,"opis":"ZAWODNIK (UMIEJĘTNOŚCI) NA POZIOM MIĘDZYNARODOWY / MECZ POWTARZALNOŚĆ W KAŻDYM ŚRODOWISKU / OLBRZYMI WPLYW NA PRZEBIEG MECZU"},
  {"stopien":5,"opis":"ZAWODNIK (UMIEJĘTNOŚCI) WYBITNE NA POZIOM KRAJOWY W SWOJEJ KATEGORII WIEKOWEJ / LIDER / ZAWODNIK PRZEWYŻSZAJĄCY WŁASNE ŚRODOWISKO"},
  {"stopien":4,"opis":"ZAWODNIK (UMIEJĘTNOŚCI) WIODĄCY WE WŁASNYM ŚRODOWISKU / POWTARZALNOŚĆ DZIAŁAŃ MECZ I TRENING / WPŁYW NA PRZEBIEG MECZU / PODSTAWOWY ZAWODNIK"},
  {"stopien":3,"opis":"ZAWODNIK (UMIEJĘTNOŚCI) O PRZECIĘTNYCH UMIEJĘTNOŚCIACH WE WŁASNYM ŚRODOWISKU / RYWALIZUJĄCY O KADRĘ MECZOWĄ"},
  {"stopien":2,"opis":"ZAWODNIK (UMIEJĘTNOŚCI) O NISKICH MOŻLIWOŚCIACH / MAJĄCY PROBLEMY Z REGURALNĄ GRĄ I POWOŁANIAMI DO KADRY MECZOWEJ"},
  {"stopien":1,"opis":"ZAWODNIK (UMIEJĘTNOŚCI) NIE BĘDĄCY W STANIE SPROSTAĆ JAKIMKOLWIEK WYMAGANIOM SWOJEGO ŚRODOWISKA"},
];

/** Notowanie 1–21: jedna drabina od „pierwsza jedenastka U12" do „kluczowy zawodnik na poziomie CL".
 *  Trener zaznacza na niej DWA stopnie: stan faktyczny i potencjał. */
export const DRABINA_NOTOWANIA: { stopien: number; opis: string }[] = [
  {"stopien":20,"opis":"Kluczowy zawodnik na najwyższym poziomie CL"},
  {"stopien":19,"opis":"Pierwsza jedenastka na najwyższym poziomie CL"},
  {"stopien":18,"opis":"Pierwsza jedenastka UEL+UCL / kluczowy zawodnik drużyna Top 5 liga"},
  {"stopien":17,"opis":"Pierwsza jedenastka drużyna Top 5 liga"},
  {"stopien":16,"opis":"Najlepszy zawodnik w Ekstraklasa (EK), miejsce 1-3"},
  {"stopien":15,"opis":"Pierwsza jedenastka EK miejsca 1-3 / kluczowy zawodnik EK miejsca 4-8"},
  {"stopien":14,"opis":"Pierwsza jedenastka EK miejsca 4-8 / kluczowy zawodnik EK miejsca 9-18"},
  {"stopien":13,"opis":"Pierwsza jedenastka EK miejsca 9-18 / kluczowy zawodnik 1. liga PL"},
  {"stopien":12,"opis":"Pierwsza jedenastka 1. liga PL / kluczowy zawodnik 2. liga PL"},
  {"stopien":11,"opis":"Pierwsza jedenastka 2. liga PL"},
  {"stopien":10,"opis":"Zawodnik EK, pierwsza jedenastka"},
  {"stopien":9,"opis":"Zawodnik z potencjalnym zyskiem ekonomicznym EK"},
  {"stopien":8,"opis":"Kluczowy zawodnik U19 CLJ miejsca 1-3"},
  {"stopien":7,"opis":"Pierwsza jedenastka U19 CLJ miejsca 1-3 / kluczowy zawodnik U17 CLJ miejsca 1-3"},
  {"stopien":6,"opis":"Pierwsza jedenastka U17 CLJ miejsca 1-3 / kluczowy zawodnik U16 (LW B1)"},
  {"stopien":5,"opis":"Kluczowy zawodnik U15 CLJ"},
  {"stopien":4,"opis":"Pierwsza jedenastka U15 CLJ / kluczowy zawodnik U15 (LW C1)"},
  {"stopien":3,"opis":"Pierwsza jedenastka U14, najwyższa klasa rozgrywek (LW C2)"},
  {"stopien":2,"opis":"Pierwsza jedenastka U13, najwyższa klasa rozgrywek (LW D1)"},
  {"stopien":1,"opis":"Pierwsza jedenastka U12"},
];

export const OBSZARY_PROFILU: ObszarProfilu[] = [
  {
    nazwa: "Koncepty — ofensywa",
    elementy: [
      { nazwa: "POSTĘP", skladowe: ["PROWADZENIEM","PODANIEM","PRZYJĘCIEM","OSZUSTWO W PODANIU","MOMENT PODANIA"] },
      { nazwa: "POZYCJA OTWARTA", skladowe: ["MIĘDZY LINIAMI","W PRZESTRZENI","PRZED PIERWSZĄ LINIĄ PRESSINGU","W BOCZNYM SEKTORZE BOISKA"] },
      { nazwa: "ZRYWANIE KRYCIA", skladowe: ["RUCHY ZWODNE","W KONTAKCIE","BEZ KONTAKTU (POD KONTROLĄ)"] },
      { nazwa: "PERCEPCJA", skladowe: ["Z PIŁKĄ","BEZ PIŁKI","PRZED SOBĄ","ZA SOBĄ"] },
      { nazwa: "WSPARCIE", skladowe: ["UTRZYMUJĄCE","ZDOBYWAJĄCE","SEKTORALNE","MOMENT WSPARCIA"] },
      { nazwa: "PRZESTRZEŃ / MOBILNOŚĆ", skladowe: ["TWORZENIE LINII PODANIA","TWORZENIE PRZESTRZENI DLA PARTNERA","RUCHY DIAGONALNE","SZUKANIE GRY PO TRÓJKĄCIE","GRA NA 3 ZAWODNIKA","ATAK WOLNEJ PRZESTRZENI","SZEROKOŚĆ"] },
      { nazwa: "MOMENTY SKUPIENIA", skladowe: ["ZATRZYMANIE Z PIŁKĄ","NAPROWADZANIE DO SKUPIENIA"] },
      { nazwa: "KONTROLA TEMPA I KIERUNKU", skladowe: ["PODANIE FINALNE","PODANIE DIAGONALNE","ZMIANY SEKTORALNE","PODANIE PRZEZ (2/3) BAZY","PODANIE MIĘDZY LINIAMI","ZDOBYWANIE BRAMEK LUDZKICH","ZDOBYWANIE PLECÓW","KONTROLA SPALONEGO","TIMING"] },
      { nazwa: "FINALIZACJA", skladowe: ["WYGRANIE POZYCJI","WBIEGNIĘCIA W POLE KARNE","WYPEŁNIANIE PRZESTRZENI (PK)","ASEKURACJA OFENSYWNA (PK)","DECYZYJNOŚĆ W UDERZENIU","KONTROLA PIŁKI W (3/3PK) BAZIE"] },
      { nazwa: "REAKCJA NA ODBIÓR", skladowe: ["GRA DO PRZODU","UTRZYMANIE PIŁKI (ponowna strata)","TWORZENIE OPCJI GRY"] },
    ],
  },
  {
    nazwa: "Koncepty — defensywa",
    elementy: [
      { nazwa: "POWSTRZYMANIE", skladowe: ["WYGRANIE POZYCJI","SKUTECZNY ODBIÓR","PRZERWANIE (FAUL)","WYBICIE","WŚLIZG"] },
      { nazwa: "ANTYCYPACJA", skladowe: ["DZIAŁAŃ PRZECIWNIKA","W PRZESTRZENI","PRZED 1 LINIĄ PRESSINGU"] },
      { nazwa: "KONTROLA", skladowe: ["ZAWODNIKA W STREFIE DZIAŁANIA","DYSTANSU DO PRZECIWNIKA","PRZECIWNIKA W KONTAKCIE"] },
      { nazwa: "REAKCJA PO STRACIE", skladowe: ["REAKCJA PO WŁASNEJ STRACIE","ZAMYKANIE KRÓTKICH LINI PODAŃ","REAGOWANIE NA ZAMIAR (Piłka Otwarta)","REGOWANIE PO STRACIE (Piłka Zamknięta)"] },
      { nazwa: "UKIERUNKOWYWANIE PRZECIWNIKA", skladowe: ["SKRACANIE POLA GRY","ZAMYKANIE KIERUNKU GRY","WSPÓŁPRACA Z 1 LINIĄ PRESSINGU"] },
      { nazwa: "ASEKURACJA DEFENSYWNA", skladowe: ["PODWAJANIE","POTRAJANIE"] },
    ],
  },
  {
    nazwa: "Umiejętności techniczne",
    elementy: [
      { nazwa: "DRYBLING / KONTROLA PIŁKI", skladowe: ["KRÓTKIE PROWADZENIA","ZATRZYMANIE","ZMIANA KIERUNKU","OCHRONA PIŁKI","POD PRESJĄ","BEZ PRESJI"] },
      { nazwa: "KRÓTKIE PODANIE", skladowe: ["PO PRZYJĘCIU","PO PROWADZENIU","W 1 KONTAKCIE","Z POWIETRZNA","JAKOŚĆ PODANIA","CELNOŚĆ PODANIA"] },
      { nazwa: "DŁUGIE PODANIE", skladowe: ["PO PRZYJĘCIU","PO PROWADZENIU","W 1 KONTAKCIE","JAKOŚĆ PODANIA","CELNOŚĆ PODANIA"] },
      { nazwa: "DOŚRODKOWANIE", skladowe: ["PO PRZYJĘCIU","PO PROWADZENIU","W 1 KONTAKCIE"] },
      { nazwa: "UDERZENIE PIŁKI", skladowe: ["PO PRZYJĘCIU","PO PROWADZENIU","W 1 KONTAKCIE","Z POWIETRZNA","PO KOŹLE"] },
      { nazwa: "WRZUT Z AUTU", skladowe: ["KRÓTKI","DŁUGI"] },
      { nazwa: "PRZYJĘCIE PIŁKI / 1ST TOUCH", skladowe: ["PO ZIEMI","Z POWIETRZA","KIERUNKOWE W PRZESTRZEŃ","Z PRZECIWNIKIEM NA PLECACH","ZMYLENIE PRZECIWNIKA"] },
      { nazwa: "GRA GŁOWĄ", skladowe: ["W ATAKU","W OBRONIE"] },
      { nazwa: "1X1 (OBRONA)", skladowe: ["PRACA NA NOGACH","USTAWIENIE CIAŁA","PRACA RĘKĄ - DYSTANS","GRA WŚLIZGIEM","NA ZIEMI","W POWIETRZU"] },
    ],
  },
  {
    nazwa: "Umiejętności mentalne",
    obligatoryjne: ["KONCENTRACJA","AKCEPTACJA KRYTYKI","SUMIENNOŚĆ / PUNKTUALNOŚĆ","PRACOWITOŚĆ","MENTALNOŚĆ ZWYCIĘZCY","DĄŻENIE DO ZWYCIĘSTWA / CHĘĆ WYGRYWANIA"],
    elementy: [
      { nazwa: "OPANOWANIE EMOCJI", grupa: "Trening i mecz", opis: "Panowanie nad swoim zachowaniem i okazywaniem emocji podczas wpływu czynników zewnętrznych (pozytywnych i negatywnych). Dopasowanie emocji do sytuacji, radzenie sobie z sytuacjami trudnymi.", skladowe: [] },
      { nazwa: "PEWNOŚĆ SIEBIE", grupa: "Trening i mecz", opis: "Powtarzalność i dążenie do prawodłoych rozwiązań nawet w przypadku niepowodzenia (utrzymanie poziomu gry). Nastawienie do podejmowania ryzyka. Postawa ciała - odbiór zewnętrzny.", skladowe: [] },
      { nazwa: "ODPORNOŚĆ NA STRES", grupa: "Trening i mecz", opis: "Radzenie sobie z wewnętrzną i zewnetrzną presją. Oczekiwania zawodnika, rodzica, środowiska i Klubu. Umiejętność radzenia sobie w trudnych sytuacjach oraz prawidłowe nastawienia przed, w trakcie i po meczu.", skladowe: [] },
      { nazwa: "KONSEKWENTOŚĆ DZIAŁAŃ", grupa: "Trening i mecz", opis: "Umiejętność realizowania lub powtarzania działań, które są naszym celem w momentach gdy są one wykonywane dobrze oraz wtedy gdy nam nie wychdodzą.", skladowe: [] },
      { nazwa: "ODPOWIEDZIALNOŚĆ", grupa: "Trening i mecz", opis: "Umiejętność reagowania na różne sytuacje boiskowe, które będą korzystne dla naszego zespołu, bądź danego zawodnika, a nie spowodują utraty pozytywnego nastawienia bądź innych konsekwencji np. dyscyplinarnych (kartki)", skladowe: [] },
      { nazwa: "LIDER", grupa: "Trening i mecz", opis: "Wzięcie na siebie ciężaru danego meczu, wsparcie dla kolegów z zespołu, umiejność zarządzania grupą i kierownia jej w odpowiednim kierunku.", skladowe: [] },
      { nazwa: "KOMUNIKACJA", grupa: "Trening i mecz", opis: "W czasie treningu / meczu. Werbalna i niewerbalna zawodnicy. Rozumienie komunikatów na linii trener - zawodnik.", skladowe: [] },
      { nazwa: "ZAANGAŻOWANIE", grupa: "Poza meczem", opis: "Podejście oraz samoistne realizowanie zadań i obowiązków przed i po treningowych. Motywacja siebie i innych.", skladowe: [] },
      { nazwa: "DETERMINACJA", grupa: "Poza meczem", opis: "AUTONOMIA - uprawianie sportu musi być ambicją zawodnika, a nie rodzica. Wewnętrzne dążenie do realizacji celów (również w przypadku niepowodźeń), przełamywanie barier.", skladowe: [] },
      { nazwa: "SAMOŚWIADOMOŚĆ", grupa: "Poza meczem", opis: "Umiejętność samooceny oraz swojej pozycji w grupie. (sportowo i koleżeńsko), znajomość mocnych i słabych stron. Praca nad samorozowjem.", skladowe: [] },
    ],
  },
  {
    nazwa: "Atrybuty fizyczne",
    elementy: [
      { nazwa: "SIŁA", skladowe: ["GRA W KONTAKCIE"] },
      { nazwa: "SZYBKOŚĆ", skladowe: ["SZYBKOŚĆ Z PIŁKĄ","SZYBKOŚĆ PODEJMOWANIA DECYZJI","DOSKOK"] },
      { nazwa: "WYTRZYMAŁOŚĆ", skladowe: ["PRACA W WYSOKIEJ INTENSYWNOŚCI","EFEKTYWNOŚĆ DZIAŁAŃ W II POŁOWIE"] },
      { nazwa: "MOC", skladowe: ["WYSKOK DO GŁOWY"] },
      { nazwa: "ZWINNOŚĆ", skladowe: ["SZYBKOŚĆ ZMIANY KIERUNKÓW","SZYBKOŚĆ ZM. KIERUNKÓW Z PIŁKĄ"] },
      { nazwa: "W.SZYBKOŚCIOWA", skladowe: ["RSA"] },
      { nazwa: "KOORDYNACJA", skladowe: ["PROWADZENIE PIŁKI OBIEMA NOGAMI","TIMING","OBSERWACJA PRZED PRZYJĘCIEM PIŁKI","RÓŻNE FORMY PORUSZANIA","TECHNIKA BIEGU","GRA WŚLIZGIEM"] },
      { nazwa: "SIŁA", testy: true, skladowe: ["NB PN","NB LN","AD PN","AD LN","AB PN","AB LN"] },
      { nazwa: "SZYBKOŚĆ", testy: true, skladowe: ["CZAS 40m","Vmax","Fmax"] },
      { nazwa: "WYTRZYMAŁOŚĆ", testy: true, skladowe: ["MAS","VO2max"] },
      { nazwa: "MOC", testy: true, skladowe: ["CMJ (wysokość)","CMJ (asm. siły)","CMJ (moc szczytowa)"] },
      { nazwa: "W.SZYBKOŚCIOWA", testy: true, skladowe: ["Rampinini"] },
      { nazwa: "DANE BIOLOGICZNE", testy: true, skladowe: ["PHV","PAH","%PAH"] },
    ],
  },
];

/** Ile w sumie elementów i składowych — do podpisu pod profilem. */
export const ILE_ELEMENTOW = 48;
export const ILE_SKLADOWYCH = 141;
