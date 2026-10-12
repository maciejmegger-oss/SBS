// POLACY ZA GRANICĄ, ROCZNIK 2005 I MŁODSI — z 90minut.pl („Polacy za granicą 2026/27", gracze), stan na 13.10.2026.
//
// Źródło: http://www.90minut.pl/stranieri.php?id_sezon=109&runda=1&typ=0 — lista wszystkich Polaków grających poza
// krajem. Wybrani są urodzeni w 2005 roku lub później. Przy zawodniku stoi kraj i klub z tej listy, data urodzenia
// i numer w bazie 90minut (kariera.php?id=…), z którego da się zejść do jego historii.
//
// Linia: kraj klubu|imię|nazwisko|data urodzenia|klub|numer 90minut
// NIE POPRAWIAJ RĘCZNIE — po nowym pobraniu plik powstaje od nowa.

export const POLACY_ZA_GRANICA = `
Anglia|Patrick|Stachow|2009-03-21|Arsenal FC|52286
Anglia|Dawid|Gaweł|2008-12-12|Luton Town FC|52476
Anglia|Kornel|Miściur|2007-04-27|Liverpool FC|50606
Anglia|Kamil|Dudek|2006-04-17|Burton Albion FC|49171
Anglia|Wiktor|Gromek|2005-01-18|Corby Town FC|51129
Anglia|Jakub|Kruszyński|2005-03-09|Alfreton Town FC|51110
Austria|Bartosz|Mazurek|2007-01-03|FC Salzburg|47107
Austria|Łukasz|Żagan|2007-07-24|First Vienna FC 1894|53675
Austria|Filip|Rózga|2006-08-07|SK Sturm Graz|47021
Belgia|Oskar|Szulc|2007-05-08|FCV Dender EH|52352
Belgia|Karol|Borys|2006-09-28|KVC Westerlo|44514
Belgia|Enzo|Geerts|2005-01-03|Belisia Bilzen SV|50239
Bułgaria|Bartosz|Żelazowski|2005-04-25|Dunaw Ruse|47496
Czechy|Bartosz|Szywała|2009-01-13|SK Slavia Praga B|48870
Czechy|Igor|Brzyski|2007-03-15|SK Sigma Ołomuniec|46936
Czechy|Filip|Kaczmarek|2007-01-06|FK Loko Praga|51154
Czechy|Dominik|Sarapata|2007-10-25|SK Artis Brno|47066
Czechy|Antoni|Franke|2006-09-30|FK Dukla Praga|45355
Czechy|Oskar|Kubiak|2006-09-25|SK Slavia Praga|49293
Francja|Noé|Kemtchoum-Stasiowski|2009-04-06|RC Lens|54132
Francja|Pascal|Mozie|2008-05-06|FC Annecy|48852
Francja|Miłosz|Piekutowski|2006-05-08|RC Strasbourg Alsace|45099
Hiszpania|Adrian|Lis-Zieliński|2009-04-18|Atlético Madrileño|54011
Hiszpania|Bright|Ede|2007-02-18|RC Deportivo de A Coruña|50077
Holandia|Krzysztof|Kurowski|2006-08-29|FC Twente|46793
Holandia|Michał|Rosiak|2005-10-12|FC Twente|47711
Irlandia|Filip|Wasilewski|2007-09-19|Waterford FC|50497
Islandia|Paweł|Broniszewski|2008-08-05|UMF Selfoss|50766
Niemcy|Mateusz|Kaleta|2010-02-06|1.FC Union Berlin|52974
Niemcy|Jakub|Zieliński|2008-02-21|VfL Wolfsburg|46222
Niemcy|Jan|Leszczyński|2007-04-12|VfL Borussia Mönchengladbach 1900|48761
Niemcy|Michał|Osikowski|2007-12-20|CFC Germania 03|51104
Niemcy|Kacper|Potulski|2007-10-19|1.FSV Mainz 05|47075
Niemcy|Eryk|Grzywacz|2006-03-24|TSV Havelse 1912|50444
Niemcy|Mike|Huras|2006-01-28|1.FC Normannia Gmünd|47031
Niemcy|Robin|Lisewski|2006-02-13|1.FC Nürnberg VfL|48236
Niemcy|Dariusz|Stalmach|2005-12-08|SV Werder Bremen 1899|43678
Norwegia|Eryk|Łukaszka|2008-04-24|FK Bodø/Glimt 2|48720
Norwegia|Maciej|Soboczyński|2007-01-30|Rosenborg BK 2|53676
Norwegia|Alex|Bugaj|2006-05-09|SK Træff|50720
Portugalia|Hubert|Charuży|2008-02-21|FC Porto|48857
Portugalia|Daniel|Ciesielski|2008-04-20|Sporting Clube de Portugal (Lizbona)|48897
Portugalia|Oskar|Pietuszewski|2008-05-20|FC Porto|47136
Portugalia|Leon|Ziętek|2007-05-01|CF Estrela da Amadora|53901
Słowacja|Fabian|Bzdyl|2007-12-02|MŠK Žilina|48486
Słowacja|Michał|Kęska|2005-01-20|Stará Ľubovňa Redfox FC|43397
Słowacja|Oskar|Lachowicz|2005-04-19|FC ViOn Zlaté Moravce|47090
Słowacja|Tomasz|Walczak|2005-08-17|MFK Zemplín Michalovce|43921
Szkocja|Miłosz|Śliwiński|2007-06-20|Queen's Park FC|50778
Szkocja|Miłosz|Ochmański|2006-05-21|Inverurie Loco Works FC|45210
Szwajcaria|Daniel|Mikołajewski|2006-01-24|FC Luzern|47033
Szwecja|Jakub|Mocio|2006-10-25|Motala AIF|51335
USA|Daniel|Baran|2006-09-16|FC Dallas|50371
USA|Hubert|Brysiak|2005-07-18|Seton Hall Pirates|48221
USA|Mikołaj|Chaciński|2005-05-01|FIU Panthers|47533
USA|Daniel|Cieśla|2005-01-07|Austin FC II|47014
Walia|Błażej|Krężołek|2006-02-13|Cwmamman United AFC|47239
Walia|Oliwier|Fiedor|2005-11-06|Cefn Albion FC|52474
Włochy|Nikodem|Licznerski|2010-03-09|ACF Fiorentina|52976
Włochy|Karol|Goralczyk|2009-02-23|Torino FC|50946
Włochy|Patryk|Mackiewicz|2008-10-23|FC Internazionale Milano|50862
Włochy|Filip|Skorb|2008-03-13|US Lecce|51462
Włochy|Dawid|Bembnista|2007-01-12|Empoli FC|50314
Włochy|Patryk|Mazur|2007-01-25|Juventus Next Gen|47286
Włochy|Adrian|Przyborek|2007-01-01|SS Lazio|46694
Włochy|Kornel|Lisman|2006-02-20|Venezia FC|47201
Włochy|Marcin|Słojkowski|2006-02-01|Francavilla Calcio 1927|49350
Włochy|Radosław|Żelezny|2006-09-06|AC Perugia|47608
Włochy|Tommaso|Guercio|2005-06-01|Carrarese Calcio 1908|47600
Włochy|Mateusz|Kowalski|2005-07-21|Dolomiti Bellunesi|45010
Włochy|Jan|Ziółkowski|2005-06-05|AS Roma|45670
`;

export type TalentPolakZagranica = {
  firstName: string; lastName: string; birthYear: number | null; club: string; krajKlubu: string; link90: string;
};

export function talentyPolacyZaGranica(): TalentPolakZagranica[] {
  return POLACY_ZA_GRANICA.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [kraj, imie, nazwisko, data, klub, id] = l.split('|');
    return {
      firstName: imie, lastName: nazwisko, birthYear: Number((data || '').slice(0, 4)) || null,
      club: klub || '', krajKlubu: kraj || '', link90: id ? 'http://www.90minut.pl/kariera.php?id=' + id : '',
    };
  });
}
