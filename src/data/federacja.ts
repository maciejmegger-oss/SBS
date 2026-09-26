// SPIS ZWIĄZKÓW PIŁKARSKICH — PZPN i szesnaście związków wojewódzkich.
//
// Skąd dane: spisane 25.09.2026 ze stron samego PZPN — pzpn.pl/kontakt oraz
// pzpn.pl/federacja/wojewodzkie-zpn. Nic tu nie jest zgadywane; gdy związek zmieni siedzibę
// albo telefon, poprawka jest w tym jednym pliku.
//
// Nazwa w polu `zpn` musi być DOKŁADNIE taka, jak w kartotece klubu w polu „ZPN / Region" —
// to ona wiąże związek z klubami, grupą IV ligi i herbem (LOGO_ZPN w src/main.ts).

export type Zwiazek = {
  zpn: string;          // nazwa jak w kartotece klubu ('Mazowiecki ZPN'); pusta dla PZPN
  nazwa: string;        // pełna nazwa do wyświetlenia
  herb: string;         // plik herbu na serwerze
  adres: string;        // ulica
  skrytka?: string;     // skrzynka pocztowa, gdy związek ją podaje — bez niej list wraca
  miasto: string;       // kod pocztowy i miasto
  telefon: string;
  email: string;
  www: string;
};

// Adres gotowy do koperty: nazwa, ulica (ze skrytką, jeśli jest), kod i miasto — każdy w osobnej linii.
export const adresPocztowy = (z: Zwiazek): string =>
  [z.nazwa, z.adres, z.skrytka, z.miasto].filter(Boolean).join('\n');

export const PZPN: Zwiazek = {
  zpn: '',
  nazwa: 'Polski Związek Piłki Nożnej',
  herb: '/logo-pzpn.png',
  adres: 'ul. Bitwy Warszawskiej 1920 r. 7',
  miasto: '02-366 Warszawa',
  telefon: '732 122 222',
  email: 'pzpn@pzpn.pl',
  www: 'www.pzpn.pl',
};

export const ZWIAZKI_WOJEWODZKIE: Zwiazek[] = [
  { zpn: 'Dolnośląski ZPN', nazwa: 'Dolnośląski Związek Piłki Nożnej', herb: '/zpn/dolnoslaski.png',
    adres: 'ul. Oporowska 62', miasto: '53-434 Wrocław',
    telefon: '(71) 342-23-50', email: 'dzpn@dolnoslaskizpn.pl', www: 'www.dolzpn.pl' },
  { zpn: 'Kujawsko-Pomorski ZPN', nazwa: 'Kujawsko-Pomorski Związek Piłki Nożnej', herb: '/zpn/kujawsko-pomorski.jpg',
    adres: 'ul. Gdańska 163', miasto: '85-674 Bydgoszcz',
    telefon: '(52) 341-13-33', email: 'kujawpomorski@zpn.pl', www: 'www.kpzpn.pl' },
  { zpn: 'Lubelski ZPN', nazwa: 'Lubelski Związek Piłki Nożnej', herb: '/zpn/lubelski.png',
    adres: 'ul. Rzeckiego 21', miasto: '20-637 Lublin',
    telefon: '(81) 528-05-68', email: 'lubelski@zpn.pl', www: 'www.lzpn.pl' },
  { zpn: 'Lubuski ZPN', nazwa: 'Lubuski Związek Piłki Nożnej', herb: '/zpn/lubuski.png',
    adres: 'ul. Ptasia 2a', skrytka: 'skr. poczt. 7', miasto: '65-514 Zielona Góra',
    telefon: '(68) 452-82-00', email: 'biuro@lubuskizpn.pl', www: 'www.lubuskizpn.pl' },
  { zpn: 'Łódzki ZPN', nazwa: 'Łódzki Związek Piłki Nożnej', herb: '/zpn/lodzki.jpg',
    adres: 'Al. Unii Lubelskiej 2', miasto: '94-020 Łódź',
    telefon: '+48 507 178 676', email: 'lodzki@zpn.pl', www: 'www.lzpn.org' },
  { zpn: 'Małopolski ZPN', nazwa: 'Małopolski Związek Piłki Nożnej', herb: '/zpn/malopolski.png',
    adres: 'ul. Solskiego 1', miasto: '31-216 Kraków',
    telefon: '(12) 632-66-00', email: 'biuro@malopolskizpn.pl', www: 'www.malopolskizpn.pl' },
  { zpn: 'Mazowiecki ZPN', nazwa: 'Mazowiecki Związek Piłki Nożnej', herb: '/zpn/mazowiecki.jpg',
    adres: 'ul. Puławska 111A lok. 50', miasto: '02-707 Warszawa',
    telefon: '(22) 827-58-74', email: 'mazowiecki@zpn.pl', www: 'www.mzpn.pl' },
  { zpn: 'Opolski ZPN', nazwa: 'Opolski Związek Piłki Nożnej', herb: '/zpn/opolski.png',
    adres: 'ul. Damrota 6', skrytka: 'skr. poczt. 223', miasto: '45-064 Opole',
    telefon: '(77) 454-37-34', email: 'sekretariat@opolskizpn.pl', www: 'www.pilkaopolska.pl' },
  { zpn: 'Podkarpacki ZPN', nazwa: 'Podkarpacki Związek Piłki Nożnej', herb: '/zpn/podkarpacki.png',
    adres: 'ul. Okulickiego 18', miasto: '35-206 Rzeszów',
    telefon: '(17) 853-43-25', email: 'podkarpacki@zpn.pl', www: 'www.podkarpackizpn.pl' },
  { zpn: 'Podlaski ZPN', nazwa: 'Podlaski Związek Piłki Nożnej', herb: '/zpn/podlaski.jpg',
    adres: 'ul. Jurowiecka 52', miasto: '15-101 Białystok',
    telefon: '(85) 654-52-81', email: 'biuro@podlaskizpn.org', www: 'www.podlaskizpn.org' },
  { zpn: 'Pomorski ZPN', nazwa: 'Pomorski Związek Piłki Nożnej', herb: '/zpn/pomorski.png',
    adres: 'ul. Uczniowska 22', miasto: '80-530 Gdańsk',
    telefon: '58 522 50 30', email: 'pomorski@zpn.pl', www: 'www.pomorski-zpn.pl' },
  { zpn: 'Śląski ZPN', nazwa: 'Śląski Związek Piłki Nożnej', herb: '/zpn/slaski.jpg',
    adres: 'ul. Francuska 32', miasto: '40-028 Katowice',
    telefon: '(32) 256-43-25', email: 'slaski@zpn.pl', www: 'www.slzpn.pl' },
  { zpn: 'Świętokrzyski ZPN', nazwa: 'Świętokrzyski Związek Piłki Nożnej', herb: '/zpn/swietokrzyski.webp',
    adres: 'ul. Ściegiennego 8', miasto: '25-033 Kielce',
    telefon: '(41) 361-91-79', email: 'biuro@szpnkielce.pl', www: 'www.szpnkielce.pl' },
  { zpn: 'Warmińsko-Mazurski ZPN', nazwa: 'Warmińsko-Mazurski Związek Piłki Nożnej', herb: '/zpn/warminsko-mazurski.png',
    adres: 'ul. Opolska 37', miasto: '10-625 Olsztyn',
    telefon: '(89) 533-70-40', email: 'sekretariat@wmzpn.pl', www: 'www.wmzpn.pl' },
  { zpn: 'Wielkopolski ZPN', nazwa: 'Wielkopolski Związek Piłki Nożnej', herb: '/zpn/wielkopolski.png',
    adres: 'ul. Warmińska 1', miasto: '60-622 Poznań',
    telefon: '61 679-48-30', email: 'sekretariat@wielkopolskizpn.pl', www: 'www.wielkopolskizpn.pl' },
  { zpn: 'Zachodniopomorski ZPN', nazwa: 'Zachodniopomorski Związek Piłki Nożnej', herb: '/zpn/zachodniopomorski.jpg',
    adres: 'ul. Pocztowa 30/12', miasto: '70-360 Szczecin',
    telefon: '91 484 47 25', email: 'biuro@zzpn.pl', www: 'www.zzpn.pl' },
];
