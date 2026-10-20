// ADRESY OBIEKTÓW I E-MAILE POLSKICH KLUBÓW — wygenerowane z arkusza, NIE POPRAWIAJ RĘCZNIE.
//
// Źródło: Kluby_Polska_Adresy.xlsx (arkusz „Adresy").
// Po zmianie w arkuszu uruchom: node scripts/wczytaj-adresy-klubow.mjs "<ścieżka do pliku>"
// Stan na dzień przeniesienia: 2026-10-20 · 270 klubów.

export type AdresKlubu = {
  liga: string;    // rozgrywki, w których klub jest w bazie SBS (pierwsze, jeśli jest w dwóch)
  klub: string;    // nazwa dokładnie jak w bazie klubów SBS
  miasto: string;
  adres: string;   // adres obiektu, na którym klub gra mecze
  email: string;   // oficjalny kontakt klubu — pusty, gdy klub go nie publikuje
  zrodlo: string;  // strona, z której wzięto dane
  status: string;  // Zweryfikowany / Częściowo / Do potwierdzenia / Do uzupełnienia
  uwagi: string;
};

export const ADRESY_KLUBOW: AdresKlubu[] = [
  {
    "liga": "III liga, gr. I",
    "klub": "Olimpia Elbląg",
    "miasto": "Elbląg",
    "adres": "Stadion Miejski, ul. Agrykola 8, 82-300 Elbląg",
    "email": "klub@zksolimpia.pl",
    "zrodlo": "https://zksolimpia.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "akademia: akademia@zksolimpia.pl"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Polonia Lidzbark Warmiński",
    "miasto": "Lidzbark Warmiński",
    "adres": "Stadion Miejski im. H. Wobalisa, ul. Bartoszycka 24, 11-100 Lidzbark Warmiński",
    "email": "polonialidzbarkwarminski@wmzpn.pl",
    "zrodlo": "https://wmzpn.pl/?page_id=12185",
    "status": "Zweryfikowany",
    "uwagi": "adres z bazy klubów Warmińsko-Mazurskiego ZPN; prezes Mariusz Miecznikowski; tel. 89 767 20 87"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Olimpia Zambrów",
    "miasto": "Zambrów",
    "adres": "Stadion Miejski, ul. Prymasa Stefana Wyszyńskiego 8, 18-300 Zambrów",
    "email": "biuro@olimpiazambrow.pl",
    "zrodlo": "https://olimpiazambrow.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Widzew II Łódź",
    "miasto": "Łódź",
    "adres": "Stadion Widzewa, al. Piłsudskiego 138, 92-300 Łódź",
    "email": "sekretariat@widzew.com",
    "zrodlo": "https://www.widzew.com/en/reserve-schedule",
    "status": "Do potwierdzenia",
    "uwagi": "rezerwy – obiekt meczowy do potwierdzenia w terminarzu; e-mail jak Widzew Łódź"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Mazovia Mińsk Mazowiecki",
    "miasto": "Mińsk Mazowiecki",
    "adres": "Stadion Miejski MOSiR, ul. Sportowa 1, 05-300 Mińsk Mazowiecki",
    "email": "mksmazoviamm@wp.pl",
    "zrodlo": "https://mksmazovia.com/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "administracja seniorów tel. 530 699 926"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Wigry Suwałki",
    "miasto": "Suwałki",
    "adres": "Stadion Miejski OSiR, ul. Zarzecze 26, 16-400 Suwałki",
    "email": "",
    "zrodlo": "https://wigrysuwalki.eu/kontakt/",
    "status": "Częściowo",
    "uwagi": "na stronie formularz kontaktowy; tel. stadionu 87 566 57 08"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Warta Sieradz",
    "miasto": "Sieradz",
    "adres": "Stadion MOSiR, ul. Sportowa 1, 98-200 Sieradz",
    "email": "klub@wartasieradz.com",
    "zrodlo": "https://wartasieradz.com/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "prezes: prezes@wartasieradz.com"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Pelikan Łowicz",
    "miasto": "Łowicz",
    "adres": "Stadion Miejski, ul. Starzyńskiego 6/8, 99-400 Łowicz",
    "email": "",
    "zrodlo": "https://pelikan.lowicz.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "klub publikuje na stronie adres \"biuro@pelikanłowicz.pl\" — z polską literą ł w domenie, więc w poczcie nie zadziała; poprawnej wersji nie podaje. Tel. 690 041 945. mukspelikan@onet.eu to osobny klub młodzieżowy MUKS; tel. 46 837 62 08; adres obiektu wg: https://pelikan.lowicz.pl/stadion/"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "KTS Weszło Warszawa",
    "miasto": "Warszawa",
    "adres": "Stadion Hutnika, ul. Marymoncka 42, 01-813 Warszawa",
    "email": "akademia@weszlo.com",
    "zrodlo": "https://kts.weszlo.com/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "klub nie podaje adresu ogólnego; sprawy organizacyjne jakub.swiatek@weszlo.com; adres obiektu wg: https://en.wikipedia.org/wiki/KTS_Wesz%C5%82o"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Lechia Tomaszów Mazowiecki",
    "miasto": "Tomaszów Mazowiecki",
    "adres": "Stadion Miejski im. Braci Gadajów, ul. Nowowiejska 9/27, 97-200 Tomaszów Mazowiecki",
    "email": "info@lechiatm.pl",
    "zrodlo": "https://lechiatm.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "RKS Lechia 1923; także biuro@lechiatm.pl; tel. 44 725 25 73. biuro@kslechia.pl to inny podmiot"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "ŁKS Łomża",
    "miasto": "Łomża",
    "adres": "Stadion Miejski, ul. Zjazd 18, 18-400 Łomża",
    "email": "kontakt@lks.lomza.pl",
    "zrodlo": "https://lks.lomza.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Mławianka Mława",
    "miasto": "Mława",
    "adres": "Stadion Miejski im. Ireny Szewińskiej, ul. Kopernika 38, 06-500 Mława",
    "email": "mksmlawa@gmail.com",
    "zrodlo": "http://mksmlawa.futbolowo.pl/menu,2,14,adres-i-kontakt-do-klubu.html",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. I",
    "klub": "ŁKS II Łódź",
    "miasto": "Łódź",
    "adres": "Ośrodek Akademii ŁKS, ul. Krańcowa 19, Łódź",
    "email": "lkslodz@lkslodz.pl",
    "zrodlo": "https://lkslodz.pl/akademia/lks-ii-lodz/",
    "status": "Częściowo",
    "uwagi": "rezerwy – e-mail jak ŁKS Łódź"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Jagiellonia II Białystok",
    "miasto": "Białystok",
    "adres": "Boisko boczne Stadionu Miejskiego, ul. Słoneczna 1, 15-323 Białystok",
    "email": "klub@jagiellonia.pl",
    "zrodlo": "https://jagiellonia.pl/aktualnosci/iii-liga-mecze-rezerw-na-boisku-bocznym/",
    "status": "Częściowo",
    "uwagi": "rezerwy – e-mail jak Jagiellonia"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "KS CK Troszyn",
    "miasto": "Troszyn",
    "adres": "Stadion gminny, 07-405 Troszyn",
    "email": "",
    "zrodlo": "https://www.facebook.com/KSTROSZYN/",
    "status": "Do potwierdzenia",
    "uwagi": "ulicy i e-maila nie znalazłem; kontakt przez FB"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Ząbkovia Ząbki",
    "miasto": "Ząbki",
    "adres": "Dozbud Arena (Stadion Miejski), ul. Słowackiego 21, 05-091 Ząbki",
    "email": "mks.zabkovia@gmail.com",
    "zrodlo": "https://www.zabkovia1927.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "ul. Słowackiego 21; tel. 514 344 388; tel. 514 344 388"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Świt Nowy Dwór Mazowiecki",
    "miasto": "Nowy Dwór Mazowiecki",
    "adres": "Stadion Miejski, ul. Sportowa 66, 05-100 Nowy Dwór Mazowiecki",
    "email": "biuro@mksswit.pl",
    "zrodlo": "https://www.mksswit.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "także switndm1@wp.pl"
  },
  {
    "liga": "III liga, gr. I",
    "klub": "Wisła II Płock",
    "miasto": "Płock",
    "adres": "ORLEN Stadion im. K. Górskiego, ul. Łukasiewicza 34, 09-400 Płock",
    "email": "poczta@wisla-plock.pl",
    "zrodlo": "https://www.wisla-plock.pl/klub/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "rezerwy — kontakt jak Wisła Płock; dyr. skautingu Arkadiusz Stelmach arkadiusz.stelmach@wisla-plock.pl; rezerwy – boisko meczowe potwierdź w terminarzu; adres obiektu wg: https://wisla-plock.pl/klub/stadion/"
  },
  {
    "liga": "II liga",
    "klub": "GKS Tychy",
    "miasto": "Tychy",
    "adres": "Stadion Miejski, ul. Edukacji 7, 43-100 Tychy",
    "email": "biuro@kp-gkstychy.pl",
    "zrodlo": "https://kp-gkstychy.pl/klub/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "II liga",
    "klub": "Górnik Łęczna",
    "miasto": "Łęczna",
    "adres": "Stadion Górnika, al. Jana Pawła II 13, 21-010 Łęczna",
    "email": "biuro@gornik.leczna.pl",
    "zrodlo": "https://www.gornik.leczna.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "II liga",
    "klub": "Znicz Pruszków",
    "miasto": "Pruszków",
    "adres": "Stadion MZOS, ul. Bohaterów Warszawy 4, 05-800 Pruszków",
    "email": "zniczpruszkow@zniczpruszkow.home.pl",
    "zrodlo": "https://zniczpruszkow.com.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "akademia: akademia@zniczpruszkow.com.pl"
  },
  {
    "liga": "II liga",
    "klub": "Chojniczanka Chojnice",
    "miasto": "Chojnice",
    "adres": "Stadion Miejski Chojniczanka 1930, ul. Mickiewicza 12, 89-600 Chojnice",
    "email": "akademia@mkschojniczanka.pl",
    "zrodlo": "https://mkschojniczanka.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "na stronie podany adres akademii; biuro klubu tel. 692 351 869"
  },
  {
    "liga": "II liga",
    "klub": "Hutnik Kraków",
    "miasto": "Kraków",
    "adres": "Stadion Suche Stawy, ul. Ptaszyckiego 4, 31-979 Kraków",
    "email": "sekretariat@hutnikkrakow.com",
    "zrodlo": "https://hutnikkrakow.com/hutnik-krakow-sp-zoo",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "II liga",
    "klub": "Olimpia Grudziądz",
    "miasto": "Grudziądz",
    "adres": "Stadion Miejski, ul. Piłsudskiego 14, 86-300 Grudziądz",
    "email": "klub@olimpiagrudziadz.com",
    "zrodlo": "https://www.olimpiagrudziadz.com/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "Olimpia Grudziądz S.A. — spółka prowadząca zespół; akademia apolimpia.grudziadz@kpzpn.pl; gks.olimpia@onet.pl to stowarzyszenie GKS (młodzież)"
  },
  {
    "liga": "II liga",
    "klub": "Podhale Nowy Targ",
    "miasto": "Nowy Targ",
    "adres": "Stadion Miejski im. J. Piłsudskiego, ul. Kolejowa 161, 34-400 Nowy Targ",
    "email": "media@nkp.podhale.pl",
    "zrodlo": "https://nkp.podhale.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "na stronie tylko biuro prasowe i kierownik drużyny"
  },
  {
    "liga": "II liga",
    "klub": "Rekord Bielsko-Biała",
    "miasto": "Bielsko-Biała",
    "adres": "Centrum Sportu Rekord, ul. Startowa 13, 43-300 Bielsko-Biała",
    "email": "sportbts@rekord.com.pl",
    "zrodlo": "https://bts.rekord.com.pl/klub/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "II liga",
    "klub": "Resovia",
    "miasto": "Rzeszów",
    "adres": "Stadion Miejski, ul. Hetmańska 69, 35-078 Rzeszów",
    "email": "rzecznik@cwks-resovia.pl",
    "zrodlo": "https://cwks-resovia.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "biuro: ul. Wyspiańskiego 22, Rzeszów; na stronie tylko marketing@ i rzecznik@"
  },
  {
    "liga": "II liga",
    "klub": "Sandecja Nowy Sącz",
    "miasto": "Nowy Sącz",
    "adres": "Stadion im. o. Władysława Augustynka, ul. Kilińskiego 47, 33-300 Nowy Sącz",
    "email": "biuro@sandecja.com.pl",
    "zrodlo": "https://sandecja.pl/Klub/Kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "II liga",
    "klub": "Sokół Kleczew",
    "miasto": "Kleczew",
    "adres": "Stadion Miejski, al. 600-lecia 21, 62-540 Kleczew",
    "email": "sokol.kleczew@wp.pl",
    "zrodlo": "https://sokolkleczew.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "II liga",
    "klub": "Stal Stalowa Wola",
    "miasto": "Stalowa Wola",
    "adres": "Stadion Stali, ul. Hutnicza 10a, 37-450 Stalowa Wola",
    "email": "psa@stalowawola.pl",
    "zrodlo": "https://stal1938.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "II liga",
    "klub": "Śląsk II Wrocław",
    "miasto": "Wrocław",
    "adres": "Stadion przy Oporowskiej, ul. Oporowska 62, 53-434 Wrocław",
    "email": "biuro@slaskwroclaw.pl",
    "zrodlo": "https://slaskwroclaw.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "rezerwy — kontakt jak Śląsk Wrocław; adres obiektu wg: https://www.slaskwroclaw.pl/stadion"
  },
  {
    "liga": "II liga",
    "klub": "Świt Szczecin",
    "miasto": "Szczecin",
    "adres": "Obiekt Sportowy Skolwin, ul. Stołczyńska 100, 71-871 Szczecin",
    "email": "sekretariat@swit.szczecin.pl",
    "zrodlo": "https://swit.szczecin.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "II liga",
    "klub": "Legia II Warszawa",
    "miasto": "Warszawa",
    "adres": "Legia Training Center, ul. Legionistów 3, 05-825 Książenice",
    "email": "biuro@legia.pl",
    "zrodlo": "https://legia.com/legia-training-center/5543",
    "status": "Częściowo",
    "uwagi": "rezerwy – e-mail jak Legia Warszawa"
  },
  {
    "liga": "II liga",
    "klub": "Zawisza Bydgoszcz",
    "miasto": "Bydgoszcz",
    "adres": "Stadion Miejski im. Z. Krzyszkowiaka, ul. Gdańska 163, 85-915 Bydgoszcz",
    "email": "sekretariat@zawisza.bydgoszcz.pl",
    "zrodlo": "https://zawisza.bydgoszcz.eu/10001-0-326.html",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "II liga",
    "klub": "Avia Świdnik",
    "miasto": "Świdnik",
    "adres": "Stadion Miejski im. Cz. Krygiera, ul. Sportowa 2, 21-040 Świdnik",
    "email": "kontakt@avia-swidnik.pl",
    "zrodlo": "https://avia-swidnik.pl/pilka-nozna/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "II liga",
    "klub": "Lechia Zielona Góra",
    "miasto": "Zielona Góra",
    "adres": "Stadion MOSiR „Dołek”, ul. Sulechowska 37, 65-147 Zielona Góra",
    "email": "kontakt@lechia-zg.pl",
    "zrodlo": "https://lechia-zg.pl/klub/",
    "status": "Zweryfikowany",
    "uwagi": "biuro klubu, ul. Sulechowska 37"
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Flota Świnoujście",
    "miasto": "Świnoujście",
    "adres": "Stadion Miejski, ul. Matejki 22, 72-600 Świnoujście",
    "email": "biuro@mksflota.swinoujscie.pl",
    "zrodlo": "http://mksflota.swinoujscie.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Kotwica Kórnik",
    "miasto": "Kórnik",
    "adres": "Stadion KSS Kotwica, ul. Leśna 6, 62-035 Kórnik",
    "email": "kotwica.kornik@wielkopolskizpn.pl",
    "zrodlo": "https://kotwicakornik.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Bałtyk Koszalin",
    "miasto": "Koszalin",
    "adres": "Stadion ZOS Bałtyk, ul. Andersa 16, 75-015 Koszalin",
    "email": "kkpn@baltykkoszalin.pl",
    "zrodlo": "https://baltykkoszalin.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "akademia ap@baltykkoszalin.pl; biuro@zos.koszalin.pl to zarządca stadionu, nie klub; adres obiektu wg: https://zos.koszalin.pl/stadion-baltyk/"
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Victoria Września",
    "miasto": "Września",
    "adres": "Stadion Miejski, ul. Kosynierów 1, 62-300 Września",
    "email": "",
    "zrodlo": "https://victoria.wrzesnia.pl/kontakt-10.html",
    "status": "Częściowo",
    "uwagi": "e-maila nie znalazłem – formularz na stronie"
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Chemik Bydgoszcz",
    "miasto": "Bydgoszcz",
    "adres": "Stadion Chemik, ul. Glinki 79, 85-861 Bydgoszcz",
    "email": "sekretariat@chemikbydgoszcz.pl",
    "zrodlo": "https://chemikbydgoszcz.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "piłka: pilka.nozna@chemikbydgoszcz.pl"
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Błękitni Stargard",
    "miasto": "Stargard",
    "adres": "Piłkarski Stadion Miejski, ul. Ceglana 1, 73-110 Stargard",
    "email": "klub@blekitni.stargard.pl",
    "zrodlo": "https://blekitni.stargard.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Lipno Stęszew",
    "miasto": "Stęszew",
    "adres": "Stadion KS Lipno, ul. Trzebawska 15, 62-060 Stęszew",
    "email": "kslipno-steszew@wp.pl",
    "zrodlo": "https://kslipnosteszew.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Gedania Gdańsk",
    "miasto": "Gdańsk",
    "adres": "Stadion KS Gedania, al. gen. J. Hallera 201, 80-416 Gdańsk",
    "email": "biuro@gedania1922.pl",
    "zrodlo": "https://gedania1922.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Grom Nowy Staw",
    "miasto": "Nowy Staw",
    "adres": "Stadion Miejski, ul. Sportowa 5, 82-230 Nowy Staw",
    "email": "grom.nowy-staw@pomorski-zpn.pl",
    "zrodlo": "https://gromnowystaw.pl/contact",
    "status": "Zweryfikowany",
    "uwagi": "adres w domenie Pomorskiego ZPN — tak podaje go sam klub; adres obiektu wg: https://gromnowystaw.pl/"
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Unia Swarzędz",
    "miasto": "Swarzędz",
    "adres": "Stadion Miejski, ul. Kosynierów 3, 62-020 Swarzędz",
    "email": "klub@sksunia.pl",
    "zrodlo": "https://www.sksunia.pl/klub/o-klubie/",
    "status": "Zweryfikowany",
    "uwagi": "biuro: ul. Św. Marcina 1"
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Noteć Czarnków",
    "miasto": "Czarnków",
    "adres": "Stadion MKS Noteć, ul. Nowa 8, 64-700 Czarnków",
    "email": "biuro@mksnotecczarnkow.pl",
    "zrodlo": "https://www.mksnotecczarnkow.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Elana Toruń",
    "miasto": "Toruń",
    "adres": "Stadion Miejski im. G. Duneckiego, ul. gen. J. Bema 23/29, 87-100 Toruń",
    "email": "biuro@elanatorun.com",
    "zrodlo": "https://elanatorun.com/i/kontakt/19",
    "status": "Zweryfikowany",
    "uwagi": "akademia: akademia@elanatorun.com"
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Wda Świecie",
    "miasto": "Świecie",
    "adres": "Stadion KS Wda, ul. Sienkiewicza 18, 86-100 Świecie",
    "email": "biuro@wda-swiecie.pl",
    "zrodlo": "https://wda-swiecie.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Kluczevia Stargard",
    "miasto": "Stargard",
    "adres": "Stadion ZKS Kluczevia, ul. Niemcewicza 23, 73-102 Stargard",
    "email": "kontakt@kluczevia.pl",
    "zrodlo": "https://kluczevia.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "biuro: ul. Broniewskiego 23"
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Lech II Poznań",
    "miasto": "Poznań",
    "adres": "Stadion Akademii Lecha, ul. Leśna 15a, 64-510 Wronki",
    "email": "lech@lechpoznan.pl",
    "zrodlo": "https://www.lechpoznan.pl/kontakt,85.html",
    "status": "Zweryfikowany",
    "uwagi": "rezerwy — kontakt jak Lech Poznań; adres obiektu wg: https://bilety.lechpoznan.pl/CMS?page=lechII"
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Polonia Środa Wielkopolska",
    "miasto": "Środa Wielkopolska",
    "adres": "Stadion Średzki, ul. Sportowa 12, 63-000 Środa Wielkopolska",
    "email": "administracja@polonia-sroda.pl",
    "zrodlo": "https://www.polonia-sroda.pl/kontakt1",
    "status": "Zweryfikowany",
    "uwagi": "sekretariat; dyrektor generalny dyrektor@polonia-sroda.pl; dyr. akademii w.gasiorowski@polonia-sroda.pl; koordynator akademii marcin.parus@polonia-sroda.pl; tel. 61 287 01 77; adres nowego stadionu potwierdź; adres obiektu wg: https://polonia-sroda.pl/kontakt.html"
  },
  {
    "liga": "III liga, gr. II",
    "klub": "Wikęd Luzino",
    "miasto": "Luzino",
    "adres": "Stadion Gminny, ul. Mickiewicza 22, 84-242 Luzino",
    "email": "wiked.luzino@pomorski-zpn.pl",
    "zrodlo": "https://wiked-luzino.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. II",
    "klub": "KKS 1925 Kalisz",
    "miasto": "Kalisz",
    "adres": "Stadion Miejski, ul. Łódzka 19-29, 62-800 Kalisz",
    "email": "sekretariat@kkskalisz.com",
    "zrodlo": "https://bilety.kkskalisz.com/en/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Karkonosze Jelenia Góra",
    "miasto": "Jelenia Góra",
    "adres": "Stadion Miejski, ul. Złotnicza 12, 58-500 Jelenia Góra",
    "email": "biuro@kskarkonosze.pl",
    "zrodlo": "https://kskarkonosze.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. III",
    "klub": "ROW 1964 Rybnik",
    "miasto": "Rybnik",
    "adres": "Stadion MOSiR, ul. Gliwicka 72, 44-200 Rybnik",
    "email": "biuro@row1964rybnik.com",
    "zrodlo": "https://www.row1964rybnik.com/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Carina Gubin",
    "miasto": "Gubin",
    "adres": "Stadion Miejski, ul. Sikorskiego, 66-620 Gubin",
    "email": "kscarinagubin@gmail.com",
    "zrodlo": "https://carinagubin.com.pl/kontakt",
    "status": "Częściowo",
    "uwagi": "numer posesji stadionu nie podany; biuro: ul. Kresowa 257D"
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Barycz Sułów",
    "miasto": "Sułów",
    "adres": "Stadion w Sułowie, ul. Polna 2D, 56-300 Sułów",
    "email": "kontakt@baryczsulow.com",
    "zrodlo": "https://baryczsulow.pl/i/kontakt/6",
    "status": "Zweryfikowany",
    "uwagi": "akademia akademia@baryczsulow.com"
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Górnik Polkowice",
    "miasto": "Polkowice",
    "adres": "Stadion Miejski, ul. Kopalniana 4, 59-100 Polkowice",
    "email": "klub@ksgornik.eu",
    "zrodlo": "https://ksgornik.eu/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Odra Bytom Odrzański",
    "miasto": "Bytom Odrzański",
    "adres": "Stadion Miejski, ul. Sportowa 1, 67-115 Bytom Odrzański",
    "email": "",
    "zrodlo": "https://www.bytomodrzanski.pl/sport/",
    "status": "Częściowo",
    "uwagi": "tel. 68 388 41 20; e-maila nie znalazłem"
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Zagłębie Lubin II",
    "miasto": "Lubin",
    "adres": "KGHM Zagłębie Arena, ul. M. Skłodowskiej-Curie 98, 59-300 Lubin",
    "email": "sekretariat@zaglebie.com",
    "zrodlo": "https://www.zaglebie.com/Klub",
    "status": "Zweryfikowany",
    "uwagi": "rezerwy — kontakt jak Zagłębie Lubin; rezerwy – część meczów na bocznych boiskach; adres obiektu wg: https://www.zaglebie.com/"
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Stilon Gorzów",
    "miasto": "Gorzów Wielkopolski",
    "adres": "Stadion OSiR, ul. Olimpijska 29, 66-400 Gorzów Wielkopolski",
    "email": "biuro@stilon.gorzow.pl",
    "zrodlo": "http://stilon.gorzow.pl/klub/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Stal Brzeg",
    "miasto": "Brzeg",
    "adres": "Stadion Miejski, ul. Sportowa 1, 49-304 Brzeg",
    "email": "stalbrzeg67@gmail.com",
    "zrodlo": "https://stal.brzeg.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Goczałkowice-Zdrój",
    "miasto": "Goczałkowice-Zdrój",
    "adres": "Stadion Gminny (Panattoni Arena), ul. Krzyżanowskiego 1A, 43-230 Goczałkowice-Zdrój",
    "email": "biuro@ksgoczalkowice.pl",
    "zrodlo": "https://lksgoczalkowice.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Ślęza Wrocław",
    "miasto": "Wrocław",
    "adres": "KGHM Ślęza Arena, ul. Kłokoczycka 5, 51-376 Wrocław",
    "email": "biuro@slezawroclaw.pl",
    "zrodlo": "https://pilkanozna.slezawroclaw.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Sparta Katowice",
    "miasto": "Katowice",
    "adres": "Stadion BKS Sparta, ul. Rolna 43, 40-555 Katowice",
    "email": "info@sparta.katowice.pl",
    "zrodlo": "https://sparta.katowice.pl/kontakt/",
    "status": "Do potwierdzenia",
    "uwagi": "adres obiektu ze starszego wpisu; biuro: ul. Żeromskiego 4"
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Polonia Nysa",
    "miasto": "Nysa",
    "adres": "Stadion Polonii, ul. Sudecka 28, 48-300 Nysa",
    "email": "",
    "zrodlo": "https://kspolonianysa.pl/kontakt",
    "status": "Częściowo",
    "uwagi": "e-mail dyrektora ukryty na stronie (ochrona antyspamowa) – skopiuj ze strony; tel. 600 390 817"
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Raków Częstochowa II",
    "miasto": "Częstochowa",
    "adres": "Stadion Rakowa, ul. Limanowskiego 83, 42-200 Częstochowa",
    "email": "kontakt@rakow.com",
    "zrodlo": "https://www.rakow.com/pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "rezerwy — kontakt jak Raków Częstochowa; rezerwy – obiekt meczowy potwierdź; adres obiektu wg: https://rakow.com/aktualnosci/drugadruzyna"
  },
  {
    "liga": "III liga, gr. III",
    "klub": "MKS Kluczbork",
    "miasto": "Kluczbork",
    "adres": "Stadion Miejski, ul. Sportowa 7, 46-200 Kluczbork",
    "email": "biuro@mkskluczbork.pl",
    "zrodlo": "https://www.mkskluczbork.pl/informacje/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Miedź II Legnica",
    "miasto": "Legnica",
    "adres": "Stadion im. Orła Białego, ul. Hetmańska 2, 59-220 Legnica",
    "email": "biuro@miedzlegnica.eu",
    "zrodlo": "https://miedzlegnica.eu/informacje-89",
    "status": "Zweryfikowany",
    "uwagi": "rezerwy – mail klubu"
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Warta Gorzów Wielkopolski",
    "miasto": "Gorzów Wielkopolski",
    "adres": "Stadion OSiR, ul. Olimpijska 29, 66-400 Gorzów Wielkopolski",
    "email": "biuro@apwartagorzow.pl",
    "zrodlo": "https://www.wartagorzow.pl/kontakt/",
    "status": "Do potwierdzenia",
    "uwagi": "obiekt meczowy potwierdź (klub ma też Warta Arena, ul. Żwirowa 6)"
  },
  {
    "liga": "III liga, gr. III",
    "klub": "Zagłębie Sosnowiec",
    "miasto": "Sosnowiec",
    "adres": "ArcelorMittal Park, pl. Zagłębia 1, 41-219 Sosnowiec",
    "email": "sekretariat@zaglebie.eu",
    "zrodlo": "https://pilka.zaglebie.eu/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "tel. centrala 32 299 64 40"
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Pogoń-Sokół Lubaczów",
    "miasto": "Lubaczów",
    "adres": "Stadion MOS, ul. Sportowa 1, 37-600 Lubaczów",
    "email": "biuro@pogonsokol.pl",
    "zrodlo": "https://pogonsokol.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "NIP 7931638429; tel. 603 888 524"
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Moravia Morawica",
    "miasto": "Morawica",
    "adres": "Stadion Miejsko-Gminny, ul. Na Stadion 1, Brzeziny, 26-026 Morawica",
    "email": "biuro@ksmoravia.pl",
    "zrodlo": "https://www.ksmoravia.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Naprzód Jędrzejów",
    "miasto": "Jędrzejów",
    "adres": "Stadion KS Naprzód im. P. Świerkowskiego, ul. Sportowa 1, 28-300 Jędrzejów",
    "email": "ksnaprzodjedrzejow@gmail.com",
    "zrodlo": "https://naprzodjedrzejow.pl/oklubie.php",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Wisła II Kraków",
    "miasto": "Kraków",
    "adres": "Obiekt Prądniczanki Kraków (mecze rezerw od 2024/25)",
    "email": "sekretariat@tswisla.pl",
    "zrodlo": "https://www.tswisla.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "rezerwy — kontakt jak Wisła Kraków (sekretariat TS Wisła); rezerwy – obiekt i ulicę potwierdź w terminarzu; adres obiektu wg: https://wislakrakow.com/Wis%C5%82aII"
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "KSZO 1929 Ostrowiec Świętokrzyski",
    "miasto": "Ostrowiec Świętokrzyski",
    "adres": "Miejski Stadion Sportowy KSZO, ul. Świętokrzyska 11, 27-400 Ostrowiec Świętokrzyski",
    "email": "biuro@kszo1929.pl",
    "zrodlo": "https://kszo1929.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Hetman Zamość",
    "miasto": "Zamość",
    "adres": "Stadion OSiR, ul. Królowej Jadwigi 8, 22-400 Zamość",
    "email": "sekretariat@kshetman.zamosc.pl",
    "zrodlo": "https://kshetman.zamosc.pl/klub/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Czarni Połaniec",
    "miasto": "Połaniec",
    "adres": "Stadion Miejski OSiR, ul. Sportowa 1, 28-230 Połaniec",
    "email": "mksczarnipolaniec1948@gmail.com",
    "zrodlo": "http://mksczarnipolaniec.pl/?page_id=1110",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "AKS 1947 Busko Zdrój",
    "miasto": "Busko-Zdrój",
    "adres": "Stadion AKS, ul. Kusocińskiego 1, 28-100 Busko-Zdrój",
    "email": "aks1947busko@gmail.com",
    "zrodlo": "https://aks1947.busko.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "JKS Jarosław",
    "miasto": "Jarosław",
    "adres": "Stadion Miejski MOSiR, ul. Bandurskiego 2, 37-500 Jarosław",
    "email": "",
    "zrodlo": "https://www.mosir.jaroslaw.pl/obiekty/stadion-pilkarski",
    "status": "Częściowo",
    "uwagi": "e-maila klubu nie znalazłem; stadion: stadion@mosir.jaroslaw.pl"
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Sokół Kolbuszowa Dolna",
    "miasto": "Kolbuszowa Dolna",
    "adres": "Stadion Nad Nilem, ul. Nad Nilem 6, 36-100 Kolbuszowa Dolna",
    "email": "swrks@sokolkolbuszowa.pl",
    "zrodlo": "https://sokolkolbuszowa.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "MUKS Sokół Kolbuszowa Dolna; tel. klubu 603 645 015; adres obiektu wg: http://sokolkolbuszowa.pl/stadion/"
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Wisłoka Dębica",
    "miasto": "Dębica",
    "adres": "Stadion Miejski, ul. Parkowa 1, 39-200 Dębica",
    "email": "sekretariat@wislokadebica.pl",
    "zrodlo": "https://www.wislokadebica.pl/kontakt/z-klubem/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Wieczysta II Kraków",
    "miasto": "Kraków",
    "adres": "Stadion Wieczystej, ul. K. Chałupnika 16, 31-464 Kraków",
    "email": "kontakt@kswieczysta.com",
    "zrodlo": "https://www.kswieczysta.pl/klub",
    "status": "Zweryfikowany",
    "uwagi": "rezerwy — kontakt jak Wieczysta Kraków; kierownik seniorów maciej.bebenek@kswieczysta.com; rezerwy; adres obiektu wg: https://www.kswieczysta.com/rezerwy"
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Siarka Tarnobrzeg",
    "miasto": "Tarnobrzeg",
    "adres": "Stadion Miejski, al. Niepodległości 2, 39-400 Tarnobrzeg",
    "email": "sekretariat@siarka-tarnobrzeg.pl",
    "zrodlo": "https://siarka-tarnobrzeg.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Podlasie Biała Podlaska",
    "miasto": "Biała Podlaska",
    "adres": "Stadion Miejski, ul. Piłsudskiego 38, 21-500 Biała Podlaska",
    "email": "biuro@mkspodlasie.com",
    "zrodlo": "https://www.kspodlasie.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Star Starachowice",
    "miasto": "Starachowice",
    "adres": "Stadion Miejski, ul. Szkolna 14, 27-200 Starachowice",
    "email": "biuro@star1926.pl",
    "zrodlo": "https://star1926.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Korona II Kielce",
    "miasto": "Kielce",
    "adres": "Stary stadion Korony, ul. Szczepaniaka, Kielce",
    "email": "korona.sa@korona-kielce.pl",
    "zrodlo": "https://www.korona-kielce.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "rezerwy — kontakt jak Korona Kielce; rezerwy – numer posesji potwierdź; adres obiektu wg: https://en.wikipedia.org/wiki/Korona_Kielce_II"
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Wiślanie Skawina",
    "miasto": "Skawina",
    "adres": "Stadion Miejski, ul. Mickiewicza 27, 32-050 Skawina",
    "email": "klub@wislanie.org",
    "zrodlo": "https://wislanie.org/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "III liga, gr. IV",
    "klub": "Chełmianka Chełm",
    "miasto": "Chełm",
    "adres": "Stadion Miejski MOSiR, ul. 1 Pułku Szwoleżerów 15, 22-100 Chełm",
    "email": "sekretariat@chkschelm.pl",
    "zrodlo": "https://chelmianka.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "marketing@chkschelm.pl; media@chkschelm.pl"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Radunia Stężyca",
    "miasto": "Stężyca",
    "adres": "Arena Radunia, ul. Abrahama 11, 83-322 Stężyca",
    "email": "radunia.stezyca@pomorski-zpn.pl",
    "zrodlo": "https://raduniastezyca.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Anioły Garczegorze",
    "miasto": "Garczegorze",
    "adres": "Stadion KS Anioły, Garczegorze 38, 84-351 Nowa Wieś Lęborska",
    "email": "",
    "zrodlo": "https://www.pomorskifutbol.pl/druzyna.php?id=531&info=fb",
    "status": "Częściowo",
    "uwagi": "tel. 605 564 696; e-maila nie znalazłem"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Gryf Słupsk",
    "miasto": "Słupsk",
    "adres": "Stadion Gryf, ul. Zielona 9, 76-200 Słupsk",
    "email": "sekretariat@gryf-slupsk.pl",
    "zrodlo": "https://gryf-slupsk.pl/contacts/",
    "status": "Zweryfikowany",
    "uwagi": "media: media@gryf-slupsk.pl"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Dolina Speranda Niepoględzie",
    "miasto": "Niepoględzie",
    "adres": "Boisko w Niepoględziu, ul. Puttkamerów 3, 76-248 Niepoględzie",
    "email": "biuro@niepogledzie.pl",
    "zrodlo": "https://www.niepogledzie.pl/index/niepogledzie-i-my/sport/",
    "status": "Do potwierdzenia",
    "uwagi": "adres to siedziba klubu – boisko potwierdź"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Powiśle Dzierzgoń",
    "miasto": "Dzierzgoń",
    "adres": "Stadion DKS Powiśle, ul. Krzywa 19, 82-440 Dzierzgoń",
    "email": "",
    "zrodlo": "https://regiowyniki.pl/stadiony/Pilka_Nozna/Pomorskie/1832/informacje/Stadion_DKS_Powisle/",
    "status": "Częściowo",
    "uwagi": "tel. 784 959 252; e-maila nie znalazłem"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Chojniczanka II Chojnice",
    "miasto": "Chojnice",
    "adres": "Stadion Miejski Chojniczanka 1930, ul. Mickiewicza 12, 89-600 Chojnice",
    "email": "akademia@mkschojniczanka.pl",
    "zrodlo": "https://mkschojniczanka.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "rezerwy – obiekt i mail jak Chojniczanka"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Sparta Sycewice",
    "miasto": "Sycewice",
    "adres": "Stadion KS Sparta, ul. Szkolna 1, 76-200 Sycewice",
    "email": "hendryk.ryszard@wp.pl",
    "zrodlo": "https://lzs-pomorski.pl/klub/ks-sparta-sycewice/",
    "status": "Częściowo",
    "uwagi": "prywatny adres działacza podany jako kontakt klubu"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Stoczniowiec Gdańsk",
    "miasto": "Gdańsk",
    "adres": "Stadion przy ul. Marynarki Polskiej, Gdańsk",
    "email": "kontakt@stoczniowiecgdansk.pl",
    "zrodlo": "http://www.stoczniowiecgdansk.pl/kontakt.php",
    "status": "Do potwierdzenia",
    "uwagi": "numer posesji boiska potwierdź; sekretariat@stoczniowiec.org.pl to inny klub (GKS – hokej/siatkówka)"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Stolem Gniewino",
    "miasto": "Gniewino",
    "adres": "Arena Mistrzów, ul. Sportowa 1, 84-250 Gniewino",
    "email": "centrum.sportowe@gniewino.pl",
    "zrodlo": "https://www.stolemgniewino.pl/kontakt",
    "status": "Częściowo",
    "uwagi": "mail gminnego centrum sportowego podany jako kontakt klubu"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "KP Starogard Gdański",
    "miasto": "Starogard Gdański",
    "adres": "Stadion Miejski im. K. Deyny, ul. Olimpijczyków Starogardzkich 1, 83-200 Starogard Gdański",
    "email": "kpstarogard@wp.pl",
    "zrodlo": "https://kociewie24.eu/obiekt/kp-starogard-gdanski/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Wierzyca Pelplin",
    "miasto": "Pelplin",
    "adres": "Stadion Miejski, ul. Czarnieckiego 8, 83-130 Pelplin",
    "email": "wierzycapelplin@op.pl",
    "zrodlo": "http://wierzyca.pelplin.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Jaguar Gdańsk",
    "miasto": "Gdańsk",
    "adres": "Stadion – do potwierdzenia (biuro: ul. Budowlanych 49/5, 80-298 Gdańsk)",
    "email": "info@jaguargdansk.pl",
    "zrodlo": "https://jaguargdansk.pl/kontakt/",
    "status": "Do potwierdzenia",
    "uwagi": "obiekt meczowy seniorów potwierdź w terminarzu"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Pogoń Lębork",
    "miasto": "Lębork",
    "adres": "Stadion Miejski, 84-300 Lębork",
    "email": "pogonlebork@oknet.com.pl",
    "zrodlo": "http://www.pogon.lebork.pl/",
    "status": "Do potwierdzenia",
    "uwagi": "ulicę stadionu potwierdź; biuro: ul. Krzywoustego 1, pok. 201"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Arka II Gdynia",
    "miasto": "Gdynia",
    "adres": "Stadion Miejski, ul. Olimpijska 5, 81-538 Gdynia",
    "email": "sekretariat@arka.gdynia.pl",
    "zrodlo": "https://arka.gdynia.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "rezerwy — kontakt jak Arka Gdynia; koordynator ds. młodzieży r.wilczynski@arka.gdynia.pl; rezerwy – część meczów na boiskach bocznych; adres obiektu wg: https://www.arka.gdynia.pl/index.php?typ=podstrona&id=9"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Czarni Pruszcz Gdański",
    "miasto": "Pruszcz Gdański",
    "adres": "Stadion MOSiR, ul. Chopina 34, 83-000 Pruszcz Gdański",
    "email": "biuro@czarnipruszcz.pl",
    "zrodlo": "https://czarnipruszcz.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "tel. 501 836 917"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Sokół Bożepole Wielkie",
    "miasto": "Bożepole Wielkie",
    "adres": "Stadion, ul. Sportowa 2, 84-214 Bożepole Wielkie",
    "email": "",
    "zrodlo": "http://sokolbozepole2005.futbolowo.pl/menu,2,o-klubie.html",
    "status": "Częściowo",
    "uwagi": "ogólnego e-maila brak; kontakt przez FB"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Cartusia Kartuzy",
    "miasto": "Kartuzy",
    "adres": "Stadion Cartusii, ul. 3 Maja 24, 83-300 Kartuzy",
    "email": "gks-cartusia@wp.pl",
    "zrodlo": "https://www.cartusia.pl/kontakt.html",
    "status": "Zweryfikowany",
    "uwagi": "adres ze strony klubu — wcześniejszy zapis biuro@cartusia123.pl był błędny; adres obiektu wg: https://cartusia1923.pl/kontakt"
  },
  {
    "liga": "IV liga (pomorska)",
    "klub": "Gryf Wejherowo",
    "miasto": "Wejherowo",
    "adres": "Stadion WKS Gryf, ul. Wzgórze Wolności 1, 84-200 Wejherowo",
    "email": "gryf.wejherowo@pomorski-zpn.pl",
    "zrodlo": "https://gryfwejherowo1.futbolowo.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Orzeł Wałcz",
    "miasto": "Wałcz",
    "adres": "Stadion Miejski, ul. Wojska Polskiego 25a, 78-600 Wałcz",
    "email": "orzel.walcz@zzpn.pl",
    "zrodlo": "https://zzpn.pl/index.php?option=com_clubs&task=clubdetail&id=369",
    "status": "Zweryfikowany",
    "uwagi": "adres z katalogu klubów Zachodniopomorskiego ZPN; Wojska Polskiego 25A; inny wpis podaje al. Tysiąclecia; tel. 67 258 04 58; adres obiektu wg: https://spis.ngo.pl/245090-stowarzyszenie-klub-sportowy-orzel-walcz"
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Pogoń II Szczecin",
    "miasto": "Szczecin",
    "adres": "Boiska treningowe Pogoni (B1), ul. Twardowskiego, Szczecin",
    "email": "sekretariat@pogonszczecin.pl",
    "zrodlo": "https://pogonszczecin.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "rezerwy — kontakt jak Pogoń Szczecin; stadion główny ul. Karłowicza 28; rezerwy; stadion główny: ul. Karłowicza 28, 71-102 Szczecin; adres obiektu wg: https://pogonszczecin.pl/ii-zespol"
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Astra Ustronie Morskie",
    "miasto": "Ustronie Morskie",
    "adres": "Stadion NKS Astra, ul. Wojska Polskiego 24b, 78-111 Ustronie Morskie",
    "email": "astra.ustroniemorskie@zzpn.pl",
    "zrodlo": "https://zzpn.pl/component/clubs/?task=clubdetail&id=385",
    "status": "Zweryfikowany",
    "uwagi": "adres z katalogu klubów Zachodniopomorskiego ZPN; tel. 94 351 55 35; adres obiektu wg: https://regiowyniki.pl/stadiony/Pilka_Nozna/Zachodniopomorskie/270/informacje/Stadion_NKS_Astra/"
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Świt II Szczecin",
    "miasto": "Szczecin",
    "adres": "Obiekt Sportowy Skolwin, ul. Stołczyńska 100, 71-871 Szczecin",
    "email": "sekretariat@swit.szczecin.pl",
    "zrodlo": "https://swit.szczecin.pl/kontakt/",
    "status": "Do potwierdzenia",
    "uwagi": "rezerwy – boisko meczowe potwierdź"
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Iskierka Śmierdnica",
    "miasto": "Szczecin",
    "adres": "Stadion przy ul. Topolowej, Szczecin-Śmierdnica",
    "email": "kontakt@iskierkaszczecin.pl",
    "zrodlo": "https://www.iskierkaszczecin.pl/?page_id=96",
    "status": "Zweryfikowany",
    "uwagi": "biuro: ul. Pyrzycka 28, 70-892 Szczecin"
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "CRS Barlinek",
    "miasto": "Barlinek",
    "adres": "Stadion Miejski, ul. Sportowa 2, 74-320 Barlinek",
    "email": "crspogon.barlinek@zzpn.pl",
    "zrodlo": "https://zzpn.pl/index.php?option=com_clubs&task=clubdetail&id=311",
    "status": "Zweryfikowany",
    "uwagi": "klub występuje jako CRS Pogoń Barlinek"
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "GKS Manowo",
    "miasto": "Manowo",
    "adres": "Stadion Gminny, Manowo 75, 76-015 Manowo",
    "email": "lesnik.manowo@zzpn.pl",
    "zrodlo": "https://zzpn.pl/component/clubs/?task=clubdetail&id=53",
    "status": "Zweryfikowany",
    "uwagi": "adres z katalogu klubów Zachodniopomorskiego ZPN; Szkolna 2; tel. 94 318 32 91; adres obiektu wg: https://gkslesnikmanowo.futbolowo.pl/stadion"
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "MKS Kotwica Kołobrzeg",
    "miasto": "Kołobrzeg",
    "adres": "Stadion Miejski im. S. Karpiniuka, ul. Śliwińskiego 10, 78-100 Kołobrzeg",
    "email": "biuro@mkskotwica.kolobrzeg.pl",
    "zrodlo": "https://mkskotwica.kolobrzeg.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "koordynator klubu Mirosław Czuryło m.czurylo@mkskotwica.kolobrzeg.pl; sekretariat@kotwicakolobrzeg.com to MKP w likwidacji; adres obiektu wg: https://mkskotwica.kolobrzeg.pl/stadion/"
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Sparta Gryfice",
    "miasto": "Gryfice",
    "adres": "Stadion Miejski, ul. Sportowa 1, 72-300 Gryfice",
    "email": "sparta.gryfice@zzpn.pl",
    "zrodlo": "https://zzpn.pl/component/clubs/?task=clubdetail&id=66",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Chemik Police",
    "miasto": "Police",
    "adres": "Stadion OSiR, ul. Siedlecka 2b, 72-010 Police",
    "email": "sekretariat@chemik.police.pl",
    "zrodlo": "http://www.chemik.police.pl/kontakt.php",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Dąb Dębno",
    "miasto": "Dębno",
    "adres": "Stadion im. H. Witkowskiego, ul. Gorzowska 7, 74-400 Dębno",
    "email": "maciej.sadlowski@gmail.com",
    "zrodlo": "https://www.polskapilka.net/klub/319/dab-debno/",
    "status": "Częściowo",
    "uwagi": "prywatny adres działacza podany jako kontakt klubu"
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Arkonia Szczecin",
    "miasto": "Szczecin",
    "adres": "Stadion Arkonii, ul. Arkońska, 71-245 Szczecin",
    "email": "arkonia@arkonia.szczecin.pl",
    "zrodlo": "https://arkonia.szczecin.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "numer posesji stadionu nie podany"
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Ina Ińsko",
    "miasto": "Ińsko",
    "adres": "Stadion Miejski, ul. Armii Krajowej 26, 73-140 Ińsko",
    "email": "ina.insko@zzpn.pl",
    "zrodlo": "https://zzpn.pl/index.php?option=com_clubs&task=clubdetail&id=82",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Wybrzeże Rewalskie Rewal",
    "miasto": "Rewal",
    "adres": "Stadion LKS, ul. Kamieńska 102, 72-344 Rewal",
    "email": "wybrzezerewalskie.rewal@zzpn.pl",
    "zrodlo": "https://zzpn.pl/index.php?option=com_clubs&task=clubdetail&id=47",
    "status": "Zweryfikowany",
    "uwagi": "adres z katalogu klubów Zachodniopomorskiego ZPN; siedziba Niechorze, Leśna 3; tel. 91 384 52 79; adres obiektu wg: https://spis.ngo.pl/201202-ludowy-klub-sportowy-wybrzeze-rewalskie-rewal"
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Gwardia Koszalin",
    "miasto": "Koszalin",
    "adres": "Stadion im. S. Figasa, ul. Fałata 34, 75-434 Koszalin",
    "email": "biuro@gwardia-koszalin.pl",
    "zrodlo": "http://www.gwardia-koszalin.pl/kontakt.html",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (zachodniopomorska)",
    "klub": "Biali Sądów",
    "miasto": "Sądów",
    "adres": "Boisko w Sądowie, Sądów 6, 73-115 Dolice",
    "email": "biali.sadow@zzpn.pl",
    "zrodlo": "https://zzpn.pl/index.php?option=com_clubs&task=clubdetail&id=244",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "WKS Wierzbice",
    "miasto": "Wierzbice",
    "adres": "Boisko WKS, ul. Lipowa, 55-040 Wierzbice",
    "email": "klub@wkswierzbice.pl",
    "zrodlo": "https://4ligadolnoslaska.pl/druzyna/wks-wierzbice/",
    "status": "Do potwierdzenia",
    "uwagi": "drugi wpis podaje ul. Tarnopolską 15 – boisko meczowe potwierdź"
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "GKS Raciborowice",
    "miasto": "Raciborowice",
    "adres": "Stadion, Raciborowice Górne 196, 59-720 Raciborowice Górne",
    "email": "gksraciborowice@vp.pl",
    "zrodlo": "https://spis.ngo.pl/155889-gminny-klub-sportowy-raciborowice",
    "status": "Częściowo",
    "uwagi": "stadion przejmuje nowe stowarzyszenie GKS „Podgrodzie” – kontakt może się zmienić"
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Odra Ścinawa",
    "miasto": "Ścinawa",
    "adres": "Stadion Miejski, ul. Sportowa 16, 59-330 Ścinawa",
    "email": "odrascinawa1946@gmail.com",
    "zrodlo": "https://mapa.targeo.pl/mks-odra-scinawa-sportowa-16-59-330-scinawa~10133627/boisko-sportowe/adres",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Polonia-Stal Świdnica",
    "miasto": "Świdnica",
    "adres": "Stadion OSiR im. J. Kusocińskiego, ul. Śląska 35a, 58-100 Świdnica",
    "email": "velrakoczy@wp.pl",
    "zrodlo": "https://www.poloniastal.swidnica.pl/kontakt",
    "status": "Częściowo",
    "uwagi": "prywatny adres działacza podany na stronie klubu"
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Polonia Bielany Wrocławskie",
    "miasto": "Bielany Wrocławskie",
    "adres": "Boisko Polonii, ul. Przystankowa 4, 55-040 Ślęza",
    "email": "poloniabielany@gmail.com",
    "zrodlo": "http://poloniabielany.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Błyskawica Gać",
    "miasto": "Gać",
    "adres": "Stadion w Gaci, Gać 10, 55-200 Oława",
    "email": "blyskawicagac@gmail.com",
    "zrodlo": "https://www.gowork.pl/stowarzyszenie-ludowy-klub-sportowy-blyskawica,21943861/dane-kontaktowe-firmy",
    "status": "Częściowo",
    "uwagi": "źródło: katalog firm, nie strona klubu"
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "AKS Strzegom",
    "miasto": "Strzegom",
    "adres": "Stadion Miejski OSiR, ul. Mickiewicza 2, 58-150 Strzegom",
    "email": "klub@aks.strzegom.pl",
    "zrodlo": "https://aks.strzegom.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Moto Jelcz Oława",
    "miasto": "Jelcz-Laskowice",
    "adres": "Stadion Miejski, ul. Sportowa 1, 55-200 Oława",
    "email": "ksmotojelczolawa@gmail.com",
    "zrodlo": "http://mksolawa.futbolowo.pl/kontakt-z-klubem-1",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Chrobry II Głogów",
    "miasto": "Głogów",
    "adres": "Stadion Chrobrego, ul. Wita Stwosza 3, 67-200 Głogów",
    "email": "klub@chrobry-glogow.pl",
    "zrodlo": "https://www.chrobry-glogow.pl/Klub/Kontakt",
    "status": "Częściowo",
    "uwagi": "rezerwy – mail sekcji piłkarskiej klubu"
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Górnik Złotoryja",
    "miasto": "Złotoryja",
    "adres": "Stadion Miejski, ul. Sportowa 7, 59-500 Złotoryja",
    "email": "zksgornik1951@wp.pl",
    "zrodlo": "https://spis.ngo.pl/171833-zlotoryjski-klub-sportowy-gornik-zlotoryja",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Lechia Dzierżoniów",
    "miasto": "Dzierżoniów",
    "adres": "Stadion Miejski OSiR, ul. Wrocławska 49, 58-200 Dzierżoniów",
    "email": "adam.baginski@lechia.dzierzoniow.pl",
    "zrodlo": "https://www.lechia.dzierzoniow.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "Adam Bagiński, dyrektor klubu, tel. 785 850 703; klub nie podaje adresu ogólnego; tel. 74 831 35 29; adres obiektu wg: http://www.lechia.dzierzoniow.pl/kontakt/"
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Polonia Środa Śląska",
    "miasto": "Środa Śląska",
    "adres": "Stadion Polonii, al. Janusza Korczaka, 55-300 Środa Śląska",
    "email": "mlkspoloniasrodaslaska@gmail.com",
    "zrodlo": "https://poloniasrodaslaska.com/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Orzeł Ząbkowice Śląskie",
    "miasto": "Ząbkowice Śląskie",
    "adres": "Stadion OSiR, ul. Kusocińskiego 17, 57-200 Ząbkowice Śląskie",
    "email": "",
    "zrodlo": "https://4ligadolnoslaska.pl/druzyna/orzel-zabkowice-slaskie/",
    "status": "Częściowo",
    "uwagi": "tel. 74 815 45 19; e-maila nie znalazłem"
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Prochowiczanka Prochowice",
    "miasto": "Prochowice",
    "adres": "Stadion Miejski, ul. Wojska Polskiego 21, 59-230 Prochowice",
    "email": "prochowiczanka1948@wp.pl",
    "zrodlo": "https://4ligadolnoslaska.pl/druzyna/prochowiczanka-prochowice/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Piast Śmigród",
    "miasto": "Śmigród",
    "adres": "Stadion Miejski, 55-140 Żmigród",
    "email": "piast_zmigrod@op.pl",
    "zrodlo": "https://piast-zmigrod.pl/kontakt/",
    "status": "Do potwierdzenia",
    "uwagi": "w SBS nazwa „Śmigród” – to MKS Piast Żmigród; ulicę stadionu potwierdź"
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Iskra Księginice",
    "miasto": "Księginice",
    "adres": "Stadion LKS Iskra, ul. Sportowa 8, Księginice, 59-300 Lubin",
    "email": "lksiskra.media@gmail.com",
    "zrodlo": "https://4ligadolnoslaska.pl/druzyna/lks-iskra-ksieginice/",
    "status": "Częściowo",
    "uwagi": "adres działu mediów klubu; kod pocztowy potwierdź"
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "Piast Nowa Ruda",
    "miasto": "Nowa Ruda",
    "adres": "Stadion CTS, ul. Sportowa 1, 57-400 Nowa Ruda",
    "email": "",
    "zrodlo": "https://www.piastnowaruda.pl/kontakt",
    "status": "Częściowo",
    "uwagi": "e-mail ukryty na stronie (ochrona antyspamowa) – skopiuj ze strony"
  },
  {
    "liga": "IV liga (dolnośląska)",
    "klub": "GKS Mirków/Długołęka",
    "miasto": "Długołęka",
    "adres": "Stadion GKS, ul. Kiełczowska, Mirków, 55-095 Długołęka",
    "email": "",
    "zrodlo": "https://gksmirkow1952.futbolowo.pl/",
    "status": "Częściowo",
    "uwagi": "tel. 71 315 10 53; e-maila nie znalazłem"
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Unia Turza Śląska",
    "miasto": "Turza Śląska",
    "adres": "Stadion KS Unia, ul. Bogumińska 17, 44-351 Turza Śląska",
    "email": "uniaturza@o2.pl",
    "zrodlo": "https://uniaturza.pl/home/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Rozwój Katowice",
    "miasto": "Katowice",
    "adres": "Stadion Rozwoju, ul. Zgody 28, 40-573 Katowice",
    "email": "klub@rozwoj.info.pl",
    "zrodlo": "https://rozwoj.info.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Victoria Częstochowa",
    "miasto": "Częstochowa",
    "adres": "Stadion Victorii, ul. Krakowska 80, 42-202 Częstochowa",
    "email": "biuro@victoriaczestochowa.pl",
    "zrodlo": "http://victoriaczestochowa.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Polonia Łaziska Górne",
    "miasto": "Łaziska Górne",
    "adres": "Stadion Miejski, ul. Sportowa 3, 43-170 Łaziska Górne",
    "email": "polonialaziska@onet.pl",
    "zrodlo": "https://polonia.laziska.pl/klub/informacje",
    "status": "Zweryfikowany",
    "uwagi": "biuro, tel. 32 322 93 53; adres obiektu wg: https://www.polonia.laziska.pl/klub/informacje"
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Kuźnia Ustroń",
    "miasto": "Ustroń",
    "adres": "Stadion Kuźni, ul. Sportowa 5, 43-450 Ustroń",
    "email": "kuznia.ustron@beskidzkapilka.pl",
    "zrodlo": "http://kskuzniaustron.pl/kontakt-i-lokalizacja/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Podbeskidzie II Bielsko-Biała",
    "miasto": "Bielsko-Biała",
    "adres": "Stadion Miejski, ul. Rychlińskiego 21, 43-300 Bielsko-Biała",
    "email": "sekretariat@tspodbeskidzie.pl",
    "zrodlo": "https://tspodbeskidzie.pl/kontakt",
    "status": "Do potwierdzenia",
    "uwagi": "rezerwy – boisko meczowe potwierdź; mail klubu"
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Ruch Radzionków",
    "miasto": "Radzionków",
    "adres": "Boisko SMS Radzionków (siedziba: ul. Św. Wojciecha 15, 41-922 Radzionków)",
    "email": "klub@ruchradzionkow.com",
    "zrodlo": "https://ruchradzionkow.com/kontakt/",
    "status": "Do potwierdzenia",
    "uwagi": "ulicę boiska meczowego potwierdź"
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "MRKS Czechowice-Dziedzice",
    "miasto": "Czechowice-Dziedzice",
    "adres": "Stadion MRKS, ul. Legionów 145, 43-502 Czechowice-Dziedzice",
    "email": "mrks@czechowice.pl",
    "zrodlo": "https://mrks.czechowice.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Podlesianka Katowice",
    "miasto": "Katowice",
    "adres": "Stadion LGKS 38 Podlesianka, ul. Sołtysia 25, 40-748 Katowice",
    "email": "biuro@podlesianka-katowice.pl",
    "zrodlo": "https://podlesianka-katowice.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "dyr. sportowy / menadżer drużyny Maciej Szulce maciej.szulce@podlesianka-katowice.pl, tel. 690 576 666; tel. 789 666 707"
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Przemsza Siewierz",
    "miasto": "Siewierz",
    "adres": "Stadion LKS Przemsza, ul. Sportowa 1, 42-470 Siewierz",
    "email": "kontakt@przemsza-siewierz.pl",
    "zrodlo": "https://przemsza-siewierz.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Drama Zbrosławice",
    "miasto": "Zbrosławice",
    "adres": "Boisko LKS Drama, ul. Reptowska, 42-674 Ptakowice",
    "email": "",
    "zrodlo": "https://www.facebook.com/lksdramazbroslawice/",
    "status": "Częściowo",
    "uwagi": "e-maila nie znalazłem; kontakt przez FB"
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Piast II Gliwice",
    "miasto": "Gliwice",
    "adres": "Boiska Piasta, ul. Okrzei 20, 44-100 Gliwice",
    "email": "piast@piast-gliwice.eu",
    "zrodlo": "https://piast-gliwice.eu/kontakt",
    "status": "Do potwierdzenia",
    "uwagi": "rezerwy – boisko meczowe potwierdź; mail spółki"
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Gwarek Tarnowskie Góry",
    "miasto": "Tarnowskie Góry",
    "adres": "Stadion Gwarka, ul. Wojska Polskiego 2, 42-600 Tarnowskie Góry",
    "email": "sekretariat@tsgwarek.pl",
    "zrodlo": "https://tsgwarek.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Ruch II Chorzów",
    "miasto": "Chorzów",
    "adres": "Boisko przy ul. Cichej 6, 41-506 Chorzów",
    "email": "ruch@ruchchorzow.com.pl",
    "zrodlo": "http://www.ruchchorzow.com.pl/strony/5/kontakt/",
    "status": "Do potwierdzenia",
    "uwagi": "rezerwy – boisko meczowe potwierdź; mail spółki"
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "LKS Bełk",
    "miasto": "Bełk",
    "adres": "Stadion LKS Bełk, ul. Główna 28, 44-230 Bełk",
    "email": "lksbelk1929@gmail.com",
    "zrodlo": "https://lksbelk.futbolowo.pl/najwazniejsze-informacje",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Raków II Częstochowa",
    "miasto": "Częstochowa",
    "adres": "Stadion Rakowa, ul. Limanowskiego 83, 42-200 Częstochowa",
    "email": "kontakt@rakow.com",
    "zrodlo": "https://www.rakow.com/pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "rezerwy — kontakt jak Raków Częstochowa; rezerwy – obiekt meczowy potwierdź; adres obiektu wg: https://rakow.com/aktualnosci/drugadruzyna"
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Szombierki Bytom",
    "miasto": "Bytom",
    "adres": "Stadion Szombierek, ul. Frycza-Modrzewskiego 3, 41-907 Bytom",
    "email": "sekretariat@szombierkibytom.com",
    "zrodlo": "https://www.bisnode.pl/firma/?id=2335261&nazwa=TOWARZYSTWO_SPORTOWE_SZOMBIERKI_BYTOM",
    "status": "Częściowo",
    "uwagi": "źródło: katalog firm – sprawdź na szombierkibytom.com"
  },
  {
    "liga": "IV liga (śląska)",
    "klub": "Spójnia Landek",
    "miasto": "Landek",
    "adres": "Boisko KS Spójnia, Landek 32, 43-394 Landek",
    "email": "spojnialandek@beskidzkapilka.pl",
    "zrodlo": "http://spojnialandek.futbolowo.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Huragan Pobiedziska",
    "miasto": "Pobiedziska",
    "adres": "Stadion Miejski, ul. Kiszkowska 7, 62-010 Pobiedziska",
    "email": "info@huraganpobiedziska.pl",
    "zrodlo": "https://www.huraganpobiedziska.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Obra Kościan",
    "miasto": "Kościan",
    "adres": "Stadion Miejski im. H. Tomkiewicza, ul. Wojciecha Maya 26, 64-000 Kościan",
    "email": "kontakt@obra.koscian.pl",
    "zrodlo": "https://obra.koscian.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Warta Śrem",
    "miasto": "Śrem",
    "adres": "Stadion Miejski, ul. Poznańska 15, 63-100 Śrem",
    "email": "klub@wartasrem.pl",
    "zrodlo": "https://wartasrem.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Górnik Konin",
    "miasto": "Konin",
    "adres": "Stadion im. M. Paska, ul. Dmowskiego 4, 62-500 Konin",
    "email": "biuro@gornikkonin.com.pl",
    "zrodlo": "https://gornikkonin.com.pl/4018-2/",
    "status": "Zweryfikowany",
    "uwagi": "klub gra też na stadionie im. Złotej Jedenastki"
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Meblorz Swarzędz",
    "miasto": "Swarzędz",
    "adres": "Boisko Meblorza, os. Raczyńskiego 10, 62-020 Swarzędz",
    "email": "klub@meblorz.pl",
    "zrodlo": "https://meblorz.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "SSNC Meblorz Swarzędz; adres to siedziba; adres obiektu wg: https://meblorz.pl/www/kontakt/"
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Astra Krotoszyn",
    "miasto": "Krotoszyn",
    "adres": "Stadion Miejski, ul. Sportowa 1, 63-700 Krotoszyn",
    "email": "",
    "zrodlo": "https://wspoldzialamy.krotoszyn.pl/strona-994-krotoszynski_klub_sportowy_astra.html",
    "status": "Częściowo",
    "uwagi": "tel. 62 725 46 55; e-maila nie znalazłem"
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Avia Kamionki",
    "miasto": "Kamionki",
    "adres": "Stadion KS Avia, ul. Mieczewska 2, 62-023 Kamionki",
    "email": "zarzad@ksavia.pl",
    "zrodlo": "https://ksavia.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Ostrovia 1909 Ostrów Wielkopolski",
    "miasto": "Ostrów Wielkopolski",
    "adres": "Stadion Miejski, ul. Piłsudskiego, 63-400 Ostrów Wielkopolski",
    "email": "",
    "zrodlo": "http://www.ostrovia1909.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "numer posesji stadionu nie podany; e-mail skopiuj ze strony kontaktowej"
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Kłos Budzyń",
    "miasto": "Budzyń",
    "adres": "Boisko BKS Kłos, ul. Lipowa 6, 64-840 Budzyń",
    "email": "",
    "zrodlo": "https://mapa.targeo.pl/budzynski-klub-sportowy-klos-lipowa-6-64-840-budzyn~14032585/przedsiebiorstwo-firma/adres",
    "status": "Do potwierdzenia",
    "uwagi": "adres to siedziba klubu; tel. 607 911 907"
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Pogoń Nowe Skalmierzyce",
    "miasto": "Nowe Skalmierzyce",
    "adres": "Stadion Miejsko-Gminny, ul. Mostowa 1a, 63-460 Nowe Skalmierzyce",
    "email": "pogon.noweskalmierzyce@wielkopolskizpn.pl",
    "zrodlo": "https://kspogonnsc.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Polonia Chodzież",
    "miasto": "Chodzież",
    "adres": "Stadion im. S. Kitkowskiego, ul. Staszica 12, 64-800 Chodzież",
    "email": "",
    "zrodlo": "https://spis.ngo.pl/202901-chodzieski-klub-sportowy-polonia",
    "status": "Częściowo",
    "uwagi": "tel. 67 281 25 10; e-maila nie znalazłem; stadion w przebudowie"
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Piast Kobylnica",
    "miasto": "Kobylnica",
    "adres": "Stadion w Kobylnicy, ul. Poznańska 50, 62-006 Kobylnica",
    "email": "piast.kobylnica@wielkopolskizpn.pl",
    "zrodlo": "https://lzspiastkobylnica.sportbm.com/contact/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Nielba Wągrowiec",
    "miasto": "Wągrowiec",
    "adres": "Stadion OSiR im. S. Bąka, ul. Kościuszki 59, 62-100 Wągrowiec",
    "email": "biuro@nielba.pl",
    "zrodlo": "http://mksnielba.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Polonia 1912 Leszno",
    "miasto": "Leszno",
    "adres": "Stadion lekkoatletyczny, ul. Strzelecka 8, 64-100 Leszno",
    "email": "info@polonia1912leszno.pl",
    "zrodlo": "https://polonia1912leszno.pl/klub/",
    "status": "Zweryfikowany",
    "uwagi": "biuro: ul. Górowska 49"
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Polonia Golina",
    "miasto": "Golina",
    "adres": "Stadion Miejski, 62-590 Golina",
    "email": "polonia.golina@wp.pl",
    "zrodlo": "https://golinapolonia.futbolowo.pl/",
    "status": "Częściowo",
    "uwagi": "ulicy stadionu nie znalazłem"
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Kania Gostyń",
    "miasto": "Gostyń",
    "adres": "Stadion Miejski, ul. Sportowa 1, 63-800 Gostyń",
    "email": "kania@kaniagostyn.pl",
    "zrodlo": "https://kaniagostyn.pl/stadion/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "Mieszko Gniezno",
    "miasto": "Gniezno",
    "adres": "Stadion Miejski GOSiR, ul. Strumykowa 8, 62-200 Gniezno",
    "email": "sekretariat@mieszkogniezno.eu",
    "zrodlo": "http://mieszkogniezno.eu/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "akademia: akademia@mieszkogniezno.eu"
  },
  {
    "liga": "IV liga (wielkopolska)",
    "klub": "LKS Gołuchów",
    "miasto": "Gołuchów",
    "adres": "Boisko LKS, ul. Słowackiego (wjazd od ul. Czartoryskich 53), 63-322 Gołuchów",
    "email": "lks.goluchow@wielkopolskizpn.pl",
    "zrodlo": "http://lksgoluchow.com.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "POLONIA WARSZAWA S.A.",
    "miasto": "Warszawa",
    "adres": "Stadion Polonii, ul. Konwiktorska 6, 00-206 Warszawa",
    "email": "biuro@kspolonia.pl",
    "zrodlo": "https://kspolonia.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "KS Polonia Warszawa SA; kks@poloniawarszawa.com to osobny podmiot KKS; na stronie formularz"
  },
  {
    "liga": "CLJ U15",
    "klub": "Legia Warszawa S.A.",
    "miasto": "Warszawa",
    "adres": "Stadion Legii, ul. Łazienkowska 3, 00-449 Warszawa",
    "email": "biuro@legia.pl",
    "zrodlo": "https://legia.com/pilka-nozna/kontakt/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "akademia trenuje w Legia Training Center (Książenice)"
  },
  {
    "liga": "CLJ U15",
    "klub": "Widzew Łódź SA",
    "miasto": "Łódź",
    "adres": "Stadion Widzewa, al. Piłsudskiego 138, 92-230 Łódź",
    "email": "sekretariat@widzew.com",
    "zrodlo": "https://widzew-trainingcenter.pl/klub/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "akademia: tel. 728 402 235"
  },
  {
    "liga": "CLJ U15",
    "klub": "Escola Varsovia",
    "miasto": "Warszawa",
    "adres": "Ośrodek Escola Varsovia, ul. Fleminga 2, 03-176 Warszawa",
    "email": "biuro@escolavarsovia.pl",
    "zrodlo": "https://escolavarsovia.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "UKS TORPEDO MOKOTÓW",
    "miasto": "Warszawa",
    "adres": "Siedziba: ul. Puławska 25A lok. 1, 02-515 Warszawa",
    "email": "kontakt@torpedo.waw.pl",
    "zrodlo": "https://torpedo.waw.pl/",
    "status": "Zweryfikowany",
    "uwagi": "ul. Puławska 25A/1; adres związkowy uks.torpedo.mokotow@klubmzpn.pl; adres obiektu wg: https://spis.ngo.pl/320069-uks-torpedo-mokotow"
  },
  {
    "liga": "CLJ U15",
    "klub": "RADOMIAK S.A.",
    "miasto": "Radom",
    "adres": "Stadion im. Braci Czachorów, ul. Struga 63, 26-600 Radom",
    "email": "biuro@rksradomiak.pl",
    "zrodlo": "https://rksradomiak.pl/kategoria-341-kontakt.html",
    "status": "Zweryfikowany",
    "uwagi": "akademia: akademia@rksradomiak.pl"
  },
  {
    "liga": "CLJ U15",
    "klub": "Jagiellonia Białystok SSA",
    "miasto": "Białystok",
    "adres": "Stadion Miejski (Chorten Arena), ul. Słoneczna 1, 15-323 Białystok",
    "email": "klub@jagiellonia.pl",
    "zrodlo": "https://www.jagiellonia.pl/aktualnosci/czytaj,12868,kontakt.html",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "S.S.M. WISŁA PŁOCK",
    "miasto": "Płock",
    "adres": "ORLEN Stadion im. K. Górskiego, ul. Łukasiewicza 34, 09-400 Płock",
    "email": "poczta@wisla-plock.pl",
    "zrodlo": "https://www.wisla-plock.pl/klub/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "dyr. akademii Mateusz Lewandowski mateusz.lewandowski@wisla-plock.pl; koordynator skautingu młodzieżowego Piotr Śmigielski piotr.smigielski@wisla-plock.pl; adres obiektu wg: https://wisla-plock.pl/klub/stadion/"
  },
  {
    "liga": "CLJ U15",
    "klub": "MKS Znicz Pruszków",
    "miasto": "Pruszków",
    "adres": "Stadion MZOS, ul. Bohaterów Warszawy 4, 05-800 Pruszków",
    "email": "akademia@zniczpruszkow.com.pl",
    "zrodlo": "https://zniczpruszkow.com.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "MUKS STAL NIEWIADÓW",
    "miasto": "Niewiadów",
    "adres": "",
    "email": "",
    "zrodlo": "",
    "status": "Do uzupełnienia",
    "uwagi": "Do uzupełnienia"
  },
  {
    "liga": "CLJ U15",
    "klub": "ZKS Olimpia Elbląg",
    "miasto": "Elbląg",
    "adres": "Stadion Miejski, ul. Agrykola 8, 82-300 Elbląg",
    "email": "akademia@zksolimpia.pl",
    "zrodlo": "https://zksolimpia.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "AP TALENT BIAŁYSTOK",
    "miasto": "Białystok",
    "adres": "",
    "email": "talent@aptalent.pl",
    "zrodlo": "https://www.aptalent.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "ul. Kościelna 3; tel. 690 913 999"
  },
  {
    "liga": "CLJ U15",
    "klub": "ŁKS Łódź S.A.",
    "miasto": "Łódź",
    "adres": "Stadion Miejski im. W. Króla, al. Unii Lubelskiej 2, 94-020 Łódź",
    "email": "lkslodz@lkslodz.pl",
    "zrodlo": "https://lkslodz.pl/klub/informacje-ogolne/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "UKS VARSOVIA",
    "miasto": "Warszawa",
    "adres": "",
    "email": "varsovia@varsovia.waw.pl",
    "zrodlo": "https://varsovia.waw.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "ul. Międzyparkowa 4, Warszawa"
  },
  {
    "liga": "CLJ U15",
    "klub": "Lechia Gdańsk AP",
    "miasto": "Gdańsk",
    "adres": "Polsat Plus Arena Gdańsk, ul. Pokoleń Lechii Gdańsk 1, 80-560 Gdańsk",
    "email": "p.wolanski@lechia.pl",
    "zrodlo": "https://lechia.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "Paweł Wolański, dyrektor Akademii; administracja akademii r.rybakowski@lechia.pl; adres stadionu z wiedzy ogólnej, nie sprawdzony w sieci"
  },
  {
    "liga": "CLJ U15",
    "klub": "FASE Szczecin",
    "miasto": "Szczecin",
    "adres": "",
    "email": "klub@fase.com.pl",
    "zrodlo": "https://fase.com.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "departament skautingu skauting@fase.com.pl; departament transferowy transfery@fase.com.pl"
  },
  {
    "liga": "CLJ U15",
    "klub": "MIESZKO Gniezno",
    "miasto": "Gniezno",
    "adres": "Stadion Miejski GOSiR, ul. Strumykowa 8, 62-200 Gniezno",
    "email": "akademia@mieszkogniezno.eu",
    "zrodlo": "http://mieszkogniezno.eu/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "KKS LECH Poznań",
    "miasto": "Poznań",
    "adres": "Enea Stadion, ul. Bułgarska 17, 60-320 Poznań",
    "email": "lech@lechpoznan.pl",
    "zrodlo": "https://www.lechpoznan.pl/kontakt,85.html",
    "status": "Zweryfikowany",
    "uwagi": "infolinia klubowa 61 886 30 00; akademia gra we Wronkach, ul. Leśna 15a; adres z wiedzy ogólnej; akademia gra we Wronkach (ul. Leśna 15a)"
  },
  {
    "liga": "CLJ U15",
    "klub": "Akademia Piłkarska Chemik Bydgoszcz",
    "miasto": "Bydgoszcz",
    "adres": "Stadion Chemik, ul. Glinki 79, 85-861 Bydgoszcz",
    "email": "pilka.nozna@chemikbydgoszcz.pl",
    "zrodlo": "https://chemikbydgoszcz.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "WARTA POZNAŃ SA",
    "miasto": "Poznań",
    "adres": "",
    "email": "info@wartapoznan.pl",
    "zrodlo": "https://wartapoznan.pl/",
    "status": "Częściowo",
    "uwagi": "adres ze stopki strony klubu"
  },
  {
    "liga": "CLJ U15",
    "klub": "ARKONIA Szczecin",
    "miasto": "Szczecin",
    "adres": "Stadion Arkonii, ul. Arkońska, 71-245 Szczecin",
    "email": "arkonia@arkonia.szczecin.pl",
    "zrodlo": "https://arkonia.szczecin.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "Pogoń Szczecin",
    "miasto": "Szczecin",
    "adres": "Stadion im. F. Krygiera, ul. Karłowicza 28, 71-102 Szczecin",
    "email": "sekretariat@pogonszczecin.pl",
    "zrodlo": "https://pogonszczecin.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "tel. 91 819 48 00; punkt obsługi kibica pok@pogonszczecin.pl; adres obiektu wg: https://pogonszczecin.pl/stadion"
  },
  {
    "liga": "CLJ U15",
    "klub": "Arka Gdynia SI",
    "miasto": "Gdynia",
    "adres": "Stadion Miejski, ul. Olimpijska 5, 81-538 Gdynia",
    "email": "r.wilczynski@arka.gdynia.pl",
    "zrodlo": "https://arka.gdynia.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "Robert Wilczyński, koordynator ds. młodzieży; sekretariat sekretariat@arka.gdynia.pl; adres obiektu wg: https://www.arka.gdynia.pl/index.php?typ=podstrona&id=9"
  },
  {
    "liga": "CLJ U15",
    "klub": "Jaguar Gdańsk AP",
    "miasto": "Gdańsk",
    "adres": "Siedziba: ul. Budowlanych 49/5, 80-298 Gdańsk",
    "email": "info@jaguargdansk.pl",
    "zrodlo": "https://jaguargdansk.pl/kontakt/",
    "status": "Do potwierdzenia",
    "uwagi": "boisko akademii potwierdź"
  },
  {
    "liga": "CLJ U15",
    "klub": "Salos Szczecin",
    "miasto": "Szczecin",
    "adres": "",
    "email": "salos@salesianum.pl",
    "zrodlo": "https://salos.szczecin.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "SL SALOS Szczecin"
  },
  {
    "liga": "CLJ U15",
    "klub": "APR Lampart Poznań",
    "miasto": "Poznań",
    "adres": "",
    "email": "info@aprlampart.pl",
    "zrodlo": "https://www.aprlampart.pl/kontakt",
    "status": "Częściowo",
    "uwagi": "dział sportu Marek Pawłowski m.pawlowski@aprlampart.pl"
  },
  {
    "liga": "CLJ U15",
    "klub": "FOOTBALL ARENA Szczecin",
    "miasto": "Szczecin",
    "adres": "",
    "email": "biuro@footballarena.pl",
    "zrodlo": "https://footballarena.pl/",
    "status": "Częściowo",
    "uwagi": "tel. 791 503 505"
  },
  {
    "liga": "CLJ U15",
    "klub": "GÓRNIK ZABRZE S.A.",
    "miasto": "Zabrze",
    "adres": "Arena Zabrze, ul. Roosevelta 81, 41-800 Zabrze",
    "email": "gornikzabrze@gornikzabrze.pl",
    "zrodlo": "https://www.gornikzabrze.pl/klub/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "dział sportowy sportowy@gornikzabrze.pl; tel. 32 271 49 26; adres z wiedzy ogólnej"
  },
  {
    "liga": "CLJ U15",
    "klub": "ŚLĄSK WROCŁAW",
    "miasto": "Wrocław",
    "adres": "Tarczyński Arena, al. Śląska 1, 54-118 Wrocław",
    "email": "biuro@slaskwroclaw.pl",
    "zrodlo": "https://slaskwroclaw.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "Biuro Zarządu WKS Śląsk; akademia gra przy ul. Oporowskiej 62; adres z wiedzy ogólnej; akademia gra przy ul. Oporowskiej 62"
  },
  {
    "liga": "CLJ U15",
    "klub": "GKS GIEKSA KATOWICE S.A.",
    "miasto": "Katowice",
    "adres": "",
    "email": "biuro@gkskatowice.eu",
    "zrodlo": "https://www.gkskatowice.eu/kontakt",
    "status": "Częściowo",
    "uwagi": "tel. 32 341 92 40"
  },
  {
    "liga": "CLJ U15",
    "klub": "FC Wrocław Academy U.K.S.",
    "miasto": "Wrocław",
    "adres": "",
    "email": "t.klobuszewski@fcwroclaw.pl",
    "zrodlo": "https://www.fcwroclaw.pl/",
    "status": "Częściowo",
    "uwagi": "jedyny adres podany przez klub — na stronie nie ma skrzynki ogólnej"
  },
  {
    "liga": "CLJ U15",
    "klub": "CHROBRY GŁOGÓW S.A.",
    "miasto": "Głogów",
    "adres": "Stadion Chrobrego, ul. Wita Stwosza 3, 67-200 Głogów",
    "email": "klub@chrobry-glogow.pl",
    "zrodlo": "https://www.chrobry-glogow.pl/Klub/Kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "ZAGŁĘBIE LUBIN",
    "miasto": "Lubin",
    "adres": "KGHM Zagłębie Arena, ul. M. Skłodowskiej-Curie 98, 59-300 Lubin",
    "email": "sekretariat@zaglebie.com",
    "zrodlo": "https://www.zaglebie.com/Klub",
    "status": "Zweryfikowany",
    "uwagi": "KGHM Zagłębie Lubin; dyr. akademii Krzysztof Paluszek krzysztof.paluszek@zaglebie.com; adres obiektu wg: https://www.zaglebie.com/"
  },
  {
    "liga": "CLJ U15",
    "klub": "GKS PIAST GLIWICE S.A.",
    "miasto": "Gliwice",
    "adres": "Stadion Miejski im. P. Wieczorka, ul. Okrzei 20, 44-100 Gliwice",
    "email": "piast@piast-gliwice.eu",
    "zrodlo": "https://piast-gliwice.eu/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "sekcje młodzieżowe stowarzyszenia: sekretariat@piast.gliwice.pl"
  },
  {
    "liga": "CLJ U15",
    "klub": "MIEDŹ LEGNICA",
    "miasto": "Legnica",
    "adres": "Stadion im. Orła Białego, ul. Hetmańska 2, 59-220 Legnica",
    "email": "biuro@miedzlegnica.eu",
    "zrodlo": "https://miedzlegnica.eu/informacje-89",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "RKS RAKÓW CZĘSTOCHOWA S.A.",
    "miasto": "Częstochowa",
    "adres": "Stadion Rakowa, ul. Limanowskiego 83, 42-200 Częstochowa",
    "email": "kontakt@rakow.com",
    "zrodlo": "https://www.rakow.com/pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "tel. 34 323 54 62; adres obiektu wg: https://www.rakow.com/en/stadion"
  },
  {
    "liga": "CLJ U15",
    "klub": "OKS ODRA OPOLE",
    "miasto": "Opole",
    "adres": "",
    "email": "klub@odraopole.pl",
    "zrodlo": "https://odraopole.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "kluby partnerskie klubypartnerskie@odraopole.pl"
  },
  {
    "liga": "CLJ U15",
    "klub": "STILON GORZÓW WLKP.",
    "miasto": "Gorzów Wielkopolski",
    "adres": "Stadion OSiR, ul. Olimpijska 29, 66-400 Gorzów Wielkopolski",
    "email": "biuro@stilon.gorzow.pl",
    "zrodlo": "http://stilon.gorzow.pl/klub/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "BTS REKORD BIELSKO-BIAŁA",
    "miasto": "Bielsko-Biała",
    "adres": "Centrum Sportu Rekord, ul. Startowa 13, 43-300 Bielsko-Biała",
    "email": "sportbts@rekord.com.pl",
    "zrodlo": "https://bts.rekord.com.pl/klub/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "LECHIA ZIELONA GÓRA",
    "miasto": "Zielona Góra",
    "adres": "Stadion MOSiR „Dołek”, ul. Sulechowska 37, 65-147 Zielona Góra",
    "email": "kontakt@lechia-zg.pl",
    "zrodlo": "https://lechia-zg.pl/klub/",
    "status": "Zweryfikowany",
    "uwagi": "biuro klubu, ul. Sulechowska 37"
  },
  {
    "liga": "CLJ U15",
    "klub": "MKS KLUCZBORK",
    "miasto": "Kluczbork",
    "adres": "Stadion Miejski, ul. Sportowa 7, 46-200 Kluczbork",
    "email": "biuro@mkskluczbork.pl",
    "zrodlo": "https://www.mkskluczbork.pl/informacje/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "Resovia Rzeszów S.A.",
    "miasto": "Rzeszów",
    "adres": "Stadion Miejski, ul. Hetmańska 69, 35-078 Rzeszów",
    "email": "rzecznik@cwks-resovia.pl",
    "zrodlo": "https://cwks-resovia.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "Wisła Kraków",
    "miasto": "Kraków",
    "adres": "Stadion Wisły, ul. Reymonta 22, 30-059 Kraków",
    "email": "sekretariat@tswisla.pl",
    "zrodlo": "https://www.tswisla.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "sekretariat TS Wisła Kraków, tel. 12 630 45 00. UWAGA: wislakrakow.com publikuje tylko adresy działowe (bilety@, biznes@, biuro.prasowe@) — skrzynki ogólnej tam nie ma; adres z wiedzy ogólnej"
  },
  {
    "liga": "CLJ U15",
    "klub": "Beniaminek PROFBUD Krosno",
    "miasto": "Krosno",
    "adres": "",
    "email": "kontakt@beniaminek.org",
    "zrodlo": "https://beniaminek.org/kontakt/",
    "status": "Częściowo",
    "uwagi": "ul. Boh. Westerplatte 20, Krosno"
  },
  {
    "liga": "CLJ U15",
    "klub": "Górnik Łęczna S.A.",
    "miasto": "Łęczna",
    "adres": "Stadion Górnika, al. Jana Pawła II 13, 21-010 Łęczna",
    "email": "biuro@gornik.leczna.pl",
    "zrodlo": "https://www.gornik.leczna.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "CLJ U15",
    "klub": "Garbarnia Kraków",
    "miasto": "Kraków",
    "adres": "",
    "email": "administracja@garbarnia.krakow.pl",
    "zrodlo": "https://garbarnia.krakow.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "sekretariat akademii akademia@garbarnia.krakow.pl, tel. 736 665 563"
  },
  {
    "liga": "CLJ U15",
    "klub": "KORONA S.A. Kielce",
    "miasto": "Kielce",
    "adres": "Exbud Arena, ul. Ściegiennego 8, 25-033 Kielce",
    "email": "korona.sa@korona-kielce.pl",
    "zrodlo": "https://www.korona-kielce.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "recepcja tel. 41 340 34 00; osobna strona akademii korona-kielce.pl/kontakt-akademia"
  },
  {
    "liga": "CLJ U15",
    "klub": "Akademia Mistrzów Cracovia Kraków",
    "miasto": "Kraków",
    "adres": "Stadion Cracovii, ul. Kałuży 1, 30-111 Kraków",
    "email": "klub@cracovia.pl",
    "zrodlo": "https://cracovia.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "akademia Cracovii; centrum treningowe Rączna 757 — centrumtreningowe@cracovia.pl; adres z wiedzy ogólnej"
  },
  {
    "liga": "CLJ U15",
    "klub": "KS Cracovia SA Kraków",
    "miasto": "Kraków",
    "adres": "Stadion Cracovii, ul. Kałuży 1, 30-111 Kraków",
    "email": "klub@cracovia.pl",
    "zrodlo": "https://cracovia.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "tel. 12 29 29 100; centrum treningowe Rączna centrumtreningowe@cracovia.pl; adres z wiedzy ogólnej"
  },
  {
    "liga": "CLJ U15",
    "klub": "MKS Limanovia w Limanowej",
    "miasto": "Limanowa",
    "adres": "",
    "email": "limanovia@limanovia.net",
    "zrodlo": "https://www.limanovia.net/klub/kontakt.html",
    "status": "Częściowo",
    "uwagi": "adres do prezesa klubu: limanovia@op.pl"
  },
  {
    "liga": "CLJ U15",
    "klub": "DAP Dębica",
    "miasto": "Dębica",
    "adres": "",
    "email": "biuro@dapdebica.pl",
    "zrodlo": "https://dapdebica.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "MKS DAP Dębica"
  },
  {
    "liga": "CLJ U15",
    "klub": "LKS ORLĘTA Kielce",
    "miasto": "Kielce",
    "adres": "",
    "email": "info@orletakielce.pl",
    "zrodlo": "https://orletakielce.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "ul. Warszawska 338; tel. 888 615 855"
  },
  {
    "liga": "CLJ U15",
    "klub": "Stal Rzeszów S.A.",
    "miasto": "Rzeszów",
    "adres": "Stadion Miejski, ul. Hetmańska 69, 35-078 Rzeszów",
    "email": "sekretariat@stalrzeszow.pl",
    "zrodlo": "https://stalrzeszow.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "tel. 17 710 00 08"
  },
  {
    "liga": "CLJ U15",
    "klub": "FA Sandecja Nowy Sącz",
    "miasto": "Nowy Sącz",
    "adres": "Stadion im. o. Władysława Augustynka, ul. Kilińskiego 47, 33-300 Nowy Sącz",
    "email": "biuro@akademiasandecja.pl",
    "zrodlo": "https://www.akademiasandecja.pl/?page_id=736",
    "status": "Zweryfikowany",
    "uwagi": "Akademia Sandecja, KRS 0000869347, tel. 784 515 199 — osobny podmiot od Sandecji"
  },
  {
    "liga": "CLJ U15",
    "klub": "KKP KORONA Kielce",
    "miasto": "Kielce",
    "adres": "",
    "email": "info@kkp-korona.pl",
    "zrodlo": "https://kkp-korona.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "dyrektor sportowy Marcin Gawron marcin.gawron@kkp-korona.pl — osobny podmiot od Korona S.A."
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "Boruta Zgierz",
    "miasto": "Zgierz",
    "adres": "Stadion Miejski MOSiR, ul. Wschodnia 2, 95-100 Zgierz",
    "email": "kontakt@borutazgierz.pl",
    "zrodlo": "https://borutazgierz.pl/contact-us/",
    "status": "Zweryfikowany",
    "uwagi": "mosir-zgierz@wp.pl to zarządca stadionu, nie klub; adres obiektu wg: https://borutazgierz.pl/"
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "Zjednoczeni Stryków",
    "miasto": "Stryków",
    "adres": "Stadion im. M. Koprowskiego, ul. Brzezińska 24, 95-010 Stryków",
    "email": "zjednoczeni@strykow.pl",
    "zrodlo": "https://www.strykow.pl/829,pilka-nozna",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "Polonia Piotrków Trybunalski",
    "miasto": "Piotrków Trybunalski",
    "adres": "Stadion Miejski „Polonia”, ul. Ronalda Reagana 18, 97-300 Piotrków Trybunalski",
    "email": "",
    "zrodlo": "https://pkspolonia.pl/kontakt",
    "status": "Częściowo",
    "uwagi": "tel. 605 741 034; e-mail skopiuj ze strony kontaktowej"
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "ŁKS III Łódź",
    "miasto": "Łódź",
    "adres": "Ośrodek Akademii ŁKS, ul. Krańcowa 19, Łódź",
    "email": "lkslodz@lkslodz.pl",
    "zrodlo": "https://lkslodz.pl/klub/informacje-ogolne/",
    "status": "Do potwierdzenia",
    "uwagi": "trzecia drużyna – boisko potwierdź; mail klubu"
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "RKS Radomsko",
    "miasto": "Radomsko",
    "adres": "Stadion Miejski, ul. Brzeźnicka 26, 97-500 Radomsko",
    "email": "biuro@rksradomsko.pl",
    "zrodlo": "https://rksradomsko.pl/klub/dane-kontaktowe",
    "status": "Zweryfikowany",
    "uwagi": "adres obiektu wg: https://www.rksradomsko.pl/klub/dane-kontaktowe"
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "Orzeł Parzęczew",
    "miasto": "Parzęczew",
    "adres": "Stadion LKS Orzeł, ul. Południowa 1a, 95-045 Parzęczew",
    "email": "",
    "zrodlo": "https://spis.ngo.pl/213234-ludowy-klub-sportowy-orzel-parzeczew",
    "status": "Częściowo",
    "uwagi": "tel. 606 311 188; e-maila nie znalazłem"
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "Ekolog Wojsławice",
    "miasto": "Wojsławice",
    "adres": "Boisko LKS Ekolog, Wojsławice 105, 98-220 Zduńska Wola",
    "email": "",
    "zrodlo": "https://mapa.targeo.pl/lks-ekolog-wojslawice-wojslawice-98-220-wojslawice~21027220/boisko-sportowe/adres",
    "status": "Częściowo",
    "uwagi": "tel. 667 547 864; e-maila nie znalazłem"
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "Orkan Buczek",
    "miasto": "Buczek",
    "adres": "Stadion gminny, ul. Spółdzielcza 1, 98-113 Buczek",
    "email": "",
    "zrodlo": "https://www.buczek.pl/gminny-klub-sportowy-orkan-buczek-omega-kleszczow/",
    "status": "Do potwierdzenia",
    "uwagi": "adres to siedziba klubu; e-maila nie znalazłem"
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "Concordia Piotrków Trybunalski",
    "miasto": "Piotrków Trybunalski",
    "adres": "Stadion Miejski „Concordia”, ul. Żwirki 6, 97-300 Piotrków Trybunalski",
    "email": "biuro@uks-concordia1909.pl",
    "zrodlo": "https://www.uks-concordia1909.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "mail UKS Concordia 1909 – sprawdź, czy prowadzi drużynę seniorów"
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "Włókniarz Pabianice",
    "miasto": "Pabianice",
    "adres": "Stadion MOSiR, ul. Grota Roweckiego 3, 95-200 Pabianice",
    "email": "",
    "zrodlo": "https://mosir.pabianice.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "e-maila klubu nie znalazłem"
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "Stal Głowno",
    "miasto": "Głowno",
    "adres": "Stadion Miejski, ul. Kopernika 37, 95-015 Głowno",
    "email": "kontakt@stalglowno.com.pl",
    "zrodlo": "https://stalglowno.com.pl/kontakt.html",
    "status": "Zweryfikowany",
    "uwagi": "na tej samej stronie figuruje też wariant kontakt@stal-glowno.com.pl — przy pierwszej wysyłce sprawdź, który odbiera; adres obiektu wg: https://stalglowno.com.pl/kontakt"
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "AKS SMS Łódź",
    "miasto": "Łódź",
    "adres": "Ośrodek SMS im. K. Górskiego, ul. Milionowa 12, 93-193 Łódź",
    "email": "biuro@akssmslodz.pl",
    "zrodlo": "https://akssmslodz.pl/contact/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "Zryw Wygoda",
    "miasto": "Wygoda",
    "adres": "Boisko SKF Zryw, Wygoda 55, 99-400 Łowicz",
    "email": "arekstolarczyk81@wp.pl",
    "zrodlo": "https://zrywwygoda.futbolowo.pl/informacje",
    "status": "Częściowo",
    "uwagi": "prywatny adres kierownika podany jako kontakt klubu"
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "GKS Bełchatów",
    "miasto": "Bełchatów",
    "adres": "GIEKSA Arena, ul. Sportowa 3, 97-400 Bełchatów",
    "email": "sekretariat@gksbelchatow.com.pl",
    "zrodlo": "https://gksbelchatow.com.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "LZS Justynów",
    "miasto": "Justynów",
    "adres": "Stadion LZS, ul. Główna 86, 95-020 Justynów",
    "email": "stowarzyszenie.justjan@gmail.com",
    "zrodlo": "https://www.lzsjustynow.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "KS Kutno",
    "miasto": "Kutno",
    "adres": "Stadion Miejski, ul. Kościuszki 26, 99-300 Kutno",
    "email": "biuro@kskutno.pl",
    "zrodlo": "http://kskutno.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "adres siedziby = obiekt; potwierdź boisko"
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "Ceramika Opoczno",
    "miasto": "Opoczno",
    "adres": "Stadion Ceramiki, al. Sportowa 1, 26-300 Opoczno",
    "email": "sekretariat@mksceramikaopoczno.pl",
    "zrodlo": "https://mksceramikaopoczno.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "IV liga (łódzka)",
    "klub": "Sokół Aleksandrów Łódzki",
    "miasto": "Aleksandrów Łódzki",
    "adres": "Stadion MOSiR, ul. 11 Listopada 98, 95-070 Aleksandrów Łódzki",
    "email": "biuro@tssokol.pl",
    "zrodlo": "https://tssokol.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "I liga",
    "klub": "Lechia Gdańsk",
    "miasto": "",
    "adres": "Polsat Plus Arena Gdańsk, ul. Pokoleń Lechii Gdańsk 1, 80-560 Gdańsk",
    "email": "biuro@lechia.pl",
    "zrodlo": "https://lechia.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "dyr. akademii p.wolanski@lechia.pl; biuro prasowe biuroprasowe@lechia.pl; adres stadionu z wiedzy ogólnej, nie sprawdzony w sieci"
  },
  {
    "liga": "I liga",
    "klub": "Arka Gdynia",
    "miasto": "",
    "adres": "Stadion Miejski, ul. Olimpijska 5, 81-538 Gdynia",
    "email": "sekretariat@arka.gdynia.pl",
    "zrodlo": "https://arka.gdynia.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "dyr. skautingu m.pasieka@; koordynator ds. młodzieży r.wilczynski@; dyr. sportowy t.wichniarek@; adres obiektu wg: https://www.arka.gdynia.pl/index.php?typ=podstrona&id=9"
  },
  {
    "liga": "I liga",
    "klub": "Polonia Warszawa",
    "miasto": "",
    "adres": "Stadion Polonii, ul. Konwiktorska 6, 00-206 Warszawa",
    "email": "biuro@kspolonia.pl",
    "zrodlo": "https://kspolonia.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "KS Polonia Warszawa SA — to ten klub z I ligi; kks@poloniawarszawa.com to osobny podmiot KKS; na stronie formularz"
  },
  {
    "liga": "I liga",
    "klub": "Miedź Legnica",
    "miasto": "",
    "adres": "Stadion im. Orła Białego, ul. Hetmańska 2, 59-220 Legnica",
    "email": "biuro@miedzlegnica.eu",
    "zrodlo": "https://miedzlegnica.eu/informacje-89",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "I liga",
    "klub": "ŁKS Łódź",
    "miasto": "",
    "adres": "Stadion Miejski im. W. Króla, al. Unii Lubelskiej 2, 94-020 Łódź",
    "email": "lkslodz@lkslodz.pl",
    "zrodlo": "https://lkslodz.pl/klub/informacje-ogolne/",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "I liga",
    "klub": "Odra Opole",
    "miasto": "",
    "adres": "",
    "email": "klub@odraopole.pl",
    "zrodlo": "https://odraopole.pl/kontakt/",
    "status": "Częściowo",
    "uwagi": "kluby partnerskie klubypartnerskie@odraopole.pl"
  },
  {
    "liga": "I liga",
    "klub": "Bruk-Bet Termalica Nieciecza",
    "miasto": "",
    "adres": "",
    "email": "dawid.krupa@bruk-bet.pl",
    "zrodlo": "https://termalica.brukbet.com/index.php/kontakt/",
    "status": "Częściowo",
    "uwagi": "Dawid Krupa — Akademia i koordynator ds. bezpieczeństwa dzieci, tel. 726 406 723; klub nie publikuje adresu ogólnego, rzecznik ola.sepek@bbtn.pl"
  },
  {
    "liga": "I liga",
    "klub": "Ruch Chorzów",
    "miasto": "",
    "adres": "Stadion Śląski, ul. Katowicka 10, 41-500 Chorzów",
    "email": "ruch@ruchchorzow.com.pl",
    "zrodlo": "http://www.ruchchorzow.com.pl/strony/5/kontakt/",
    "status": "Do potwierdzenia",
    "uwagi": "obiekt meczowy potwierdź (stadion przy ul. Cichej 6 w przebudowie); mail sekretariatu spółki"
  },
  {
    "liga": "I liga",
    "klub": "Puszcza Niepołomice",
    "miasto": "",
    "adres": "",
    "email": "roman.koroza@puszcza-niepolomice.pl",
    "zrodlo": "https://www.puszcza-niepolomice.pl/sztab-zarzad/",
    "status": "Częściowo",
    "uwagi": "Roman Koroza, dyrektor klubu; akademia akademia@puszcza-niepolomice.pl; klub nie publikuje adresu ogólnego"
  },
  {
    "liga": "I liga",
    "klub": "Polonia Bytom",
    "miasto": "",
    "adres": "Stadion im. E. Szymkowiaka, ul. Olimpijska 2, 41-902 Bytom",
    "email": "kontakt@bspb.pl",
    "zrodlo": "https://bspoloniabytom.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": "operator klubu: Bytomski Sport Polonia Bytom sp. z o.o., ul. Piłkarska 8; tel. 32 288 08 88; adres z wiedzy ogólnej"
  },
  {
    "liga": "I liga",
    "klub": "Pogoń Grodzisk Mazowiecki",
    "miasto": "",
    "adres": "",
    "email": "sekretariat@pogongrodzisk.pl",
    "zrodlo": "https://pogongrodzisk.pl/kontakt",
    "status": "Częściowo",
    "uwagi": "koordynator młodzieży koordynator@pogongrodzisk.pl; prezes prezes@pogongrodzisk.pl"
  },
  {
    "liga": "I liga",
    "klub": "Chrobry Głogów",
    "miasto": "",
    "adres": "Stadion Chrobrego, ul. Wita Stwosza 3, 67-200 Głogów",
    "email": "klub@chrobry-glogow.pl",
    "zrodlo": "https://www.chrobry-glogow.pl/Klub/Kontakt",
    "status": "Zweryfikowany",
    "uwagi": "sekretariat spółki: sekretariat@chrobry-glogow.pl"
  },
  {
    "liga": "I liga",
    "klub": "Stal Rzeszów",
    "miasto": "",
    "adres": "Stadion Miejski, ul. Hetmańska 69, 35-078 Rzeszów",
    "email": "sekretariat@stalrzeszow.pl",
    "zrodlo": "https://stalrzeszow.pl/kontakt/",
    "status": "Zweryfikowany",
    "uwagi": "tel. 17 710 00 08"
  },
  {
    "liga": "I liga",
    "klub": "Pogoń Siedlce",
    "miasto": "",
    "adres": "",
    "email": "biuro@mkppogonsiedlce.pl",
    "zrodlo": "https://mkppogonsiedlce.pl/?page_id=94",
    "status": "Częściowo",
    "uwagi": "UWAGA: stara domena pogonsiedlce.pl nie należy już do klubu — przekierowuje na sieć reklamową. Dyrektor akademii Bogusz Suchecki b.suchecki@mkppogonsiedlce.pl"
  },
  {
    "liga": "I liga",
    "klub": "Stal Mielec",
    "miasto": "",
    "adres": "Stadion Miejski, ul. Solskiego 1, 39-300 Mielec",
    "email": "klub@stalmielec.com",
    "zrodlo": "https://stalmielec.com/kontakt-fks-stal-mielec-s-a/",
    "status": "Zweryfikowany",
    "uwagi": "adres z wiedzy ogólnej"
  },
  {
    "liga": "I liga",
    "klub": "Warta Poznań",
    "miasto": "",
    "adres": "",
    "email": "info@wartapoznan.pl",
    "zrodlo": "https://wartapoznan.pl/",
    "status": "Częściowo",
    "uwagi": "adres ze stopki strony klubu"
  },
  {
    "liga": "I liga",
    "klub": "Podbeskidzie Bielsko-Biała",
    "miasto": "",
    "adres": "Stadion Miejski, ul. Rychlińskiego 21, 43-300 Bielsko-Biała",
    "email": "sekretariat@tspodbeskidzie.pl",
    "zrodlo": "https://tspodbeskidzie.pl/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  },
  {
    "liga": "I liga",
    "klub": "Unia Skierniewice",
    "miasto": "",
    "adres": "",
    "email": "leszek.kozbial@uniaskierniewice.pl",
    "zrodlo": "https://uniaskierniewice.pl/contact",
    "status": "Częściowo",
    "uwagi": "Leszek Koźbiał, dyrektor klubu; kierownik Kamil Kaczyński kamil.kaczynski@uniaskierniewice.pl; klub nie podaje adresu ogólnego"
  },
  {
    "liga": "—",
    "klub": "Piast Gliwice",
    "miasto": "",
    "adres": "Stadion Miejski im. P. Wieczorka, ul. Okrzei 20, 44-100 Gliwice",
    "email": "piast@piast-gliwice.eu",
    "zrodlo": "https://piast-gliwice.eu/kontakt",
    "status": "Zweryfikowany",
    "uwagi": ""
  }
];
