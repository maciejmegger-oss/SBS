// REPREZENTANCI U-19 — ZAGRANICA, SEZON 2026/27.
//
// Źródło: oficjalne listy kadr na uefa.com („UEFA Under-19 2027"), stan na 13.10.2026. UEFA podaje
// imię i nazwisko, pozycję ogólną i WIEK — nie podaje klubu ani daty urodzenia, więc klubu tu nie ma
// (zawodnik trafia na listę z „klub nieznany", do uzupełnienia z Transfermarktu).
//
// ROCZNIK tylko dla 18-latków: kadra na ME U-19 2027 to rocznik 2008, a 18 lat dziś znaczy, że
// urodzili się w 2008. Przy 17 i 16 latkach wiek nie rozstrzyga między 2008 a 2009, więc rocznika
// nie zgadujemy.
//
// IMIĘ I NAZWISKO: ostatni człon to nazwisko, reszta imię. Przy nazwiskach wieloczłonowych
// („De Carvalho Otterud") podział bywa nietrafiony — do poprawienia ręcznie w wierszu.
//
// Pozycje: B bramkarz, O obrońca, P pomocnik, N napastnik. Wiek po drugim kresce.
// Kadr U-17 i U-18 UEFA jeszcze nie opublikowała („Official squad list not available yet").

export type EuropaU19 = { kraj: string; trener: string; lista: string };

export const EUROPA_U19: EuropaU19[] = [
  { kraj: 'Szwecja', trener: 'Andreas Pettersson', lista: `
John-Oliver Lacayo|B|18
Norton De Carvalho Otterud|B|18
Charlie Pavey|O|18
Björn Hedlöf|O|18
Elvis Van Der Laan|O|18
Theodor Lundbergh|O|18
Kevin Andersson-Lönnergård|O|18
Mario Amini|O|18
Rasmus Bergvall|O|18
Romeo Leandersson|P|18
Axel Brönner|P|18
Benjamin Brantlind|P|18
Oliver Klang|P|18
Ludvig Arvidsson|P|18
Atle Wahlund|P|18
Ahmed Saeed|N|18
Emil Sadarangani|N|18
Kevin Filling|N|17
Dion Gashi|N|18
Haydar Sultan|N|18` },
  { kraj: 'Dania', trener: 'Morten Mølkjær', lista: `
Thorbjørn Pløger|B|17
Otto Lyhne|B|17
Johan Hvistendahl|O|18
Villads Rutkjær|O|18
William Møller|O|18
Emil Monrad|O|18
Adam Amrani|O|18
Gustav Ruby-Johansen|O|17
Max Birkjær Jensen|P|18
Sean Fetterlein|P|18
Luca Dahl Tomasson|P|18
Viggo Poulsen|P|18
Frederik Bunten|P|18
Philip Christian Riis Keller|P|18
Christian Laurits Jørgensen|P|18
Malik Pimpong|N|18
Nicolas Gammelgaard|N|17
Oskar Fenger|N|18
Julius Lucena|N|18
Martin Søholm|N|18` },
  { kraj: 'Finlandia', trener: 'Sami Ristilä', lista: `
Niki Hasselman|B|18
Kasperi Silen|B|17
Eetu Grönlund|O|18
Musa Hietakangas|O|18
Iivo Nybäck|O|17
Eerik Salmivuori|O|17
Roope Aho|O|18
Miska Laaksonen|O|18
Luka Puhakainen|O|18
Leevi Palmula|P|18
Nicholas Vainio|P|18
Ahti Haikala|P|18
Bruno Katz|P|18
Eeli Kiiskilä|P|18
Philip Otoo|P|17
Abdu Muchipay|P|18
Valtteri Lehtomäki|P|18
Eze Onuoha|P|17
Noah Rantasalmi|N|18
Osagie Okungbowa|N|18` },
  { kraj: 'Słowacja', trener: 'Martin Fabuš', lista: `
Adam Královič|B|18
Daniel Gramblička|B|17
Nicolas Richter|O|18
Oliver Fecso|O|18
Maevan Vincent|O|18
Peter Pittel|O|18
Milan Kodaj|O|18
Kristóf Beke|O|17
Adam Lábo|P|18
Martin Jenčuš|P|18
Simon Baláž|P|18
Roman Skaličan|P|18
Maxim Mateáš|P|18
Filip Rajčan|P|18
Adam Rajnoha|P|18
Maroš Novák|N|18
Máté Fehér|N|18
Fedor Kasana|N|18
Tadeáš Husár|N|18
Šimon Koribský|N|18` },
  { kraj: 'Serbia', trener: 'Sladjan Nikolić', lista: `
Luka Petrić|B|18
Bogdan Bogdanović|B|18
Strahinja Anđelić|O|18
Strahinja Baucal|O|16
Andrej Milanović|O|18
Ognjen Ivković|O|18
Leon Ivanović|O|18
Balša Papović|O|17
Vukašin Topić|P|18
David Milovanović|P|18
Jovan Ostojić|P|17
Ignjat Miletić|P|18
Andrej Ilić|P|18
Jagoš Đurković|P|18
Stefan Tomović|P|18
William Millwood Rece|P|17
Damjan Djokanović|N|18
Dimitrije Šarić|N|17
Vasilije Subotić|N|18
Dušan Radović|N|18` },
  { kraj: 'Chorwacja', trener: 'Zoran Vulić', lista: `
Matej Grahovac|B|18
Vito Kovač|B|18
Nikola Radnić|O|18
Leon Jakirović|O|18
Raul Kumar|O|18
Karlo Pajsar|O|18
Andrija Burcar|O|18
Roko Vojvodić|P|18
Krešimir Radoš|P|18
Niko Horvat|P|18
David Kalem|P|18
Duje Slišković|P|18
Nikolas Matić|P|18
Ivan Križić|P|18
Jona Ježić|P|18
Silvio Ivanišević Dvornik|P|18
Tino Kusanović|N|18
Gabrijel Šivalec|N|18
Lukas Murica|N|18
Davor Bistre|N|18` },
  { kraj: 'Rumunia', trener: 'Marin Ion', lista: `
Răzvan Farcaș|B|18
Luca Crăciun|B|18
Costyn Gheorghe|O|18
Fabio Badarau|O|18
Raul Cojocariu|O|18
Bogdan Ungureanu|O|18
Raul Avram|O|17
Christian Vechiu|O|18
Matei Ceuca|P|18
Sebastian Banu|P|18
Ianis Podoleanu|P|18
Denis Țăroi|P|18
Rares Coman|P|18
Robert Drăghici|P|18
Ștefan Amarandei|P|18
Hunor Batzula|P|18
Andrei Roateș|N|18
Alexandru Bota|N|18
Mario David|N|18
Fernando Pellegrini|N|18` },
  { kraj: 'Ukraina', trener: 'Oleksandr Sytnyk', lista: `
Kyrylo Khadasevych|B|18
Fedir Tkachenko|B|18
Mykyta Melnyk|O|18
Danylo Ohorodnik|O|17
Yehor Kostiuk|O|18
Bohdan Levytskyi|O|17
Yehor Onishchuk|O|17
Artem Muradian|O|18
Arsen Zalypka|O|18
Pavlo Liusin|P|18
Illia Kutia|P|18
Vitaliy Hlyut|P|18
Ivan Andreyko|P|18
Mykola Petrovskyi|P|18
Oleksandr Balakai|P|18
Mukhammad Dzhurabaiev|P|18
Dmytro Zudin|N|18
Artem Zubriy|N|18
Kirill Serdiuk|N|17
Matvii Bodnar|N|18` },
  { kraj: 'Litwa', trener: 'Mindaugas Čepas', lista: `
Kristupas Čepulis|B|18
Dominykas Čekavičius|B|18
Jugas Turčinskas|O|18
Dovydas Balsys|O|18
Tomas Jonyla|O|17
Donatas Jermakovas|O|18
Oskar Pukelis|O|18
Jokūbas Žiedelis|O|18
Martynas Stambrauskas|O|18
Dovas Grudzinskas|P|18
Dominykas Taučas|P|18
Klemensas Gustas|P|18
Simas Grabauskas|P|18
Grant Emerhi|P|18
Dominykas Liepis|P|18
Vakaris Bradūnas|P|18
Norbert Diugevič|P|18
Kristupas Padegimas|P|18
Rodion Piazenko|N|18
Carmine Mennea|N|17` },
  { kraj: 'Łotwa', trener: 'Viktors Dobrecovs', lista: `
Nils Balagušs|B|18
Rendijs Mihelsons|B|18
Patriks Brūns|O|18
Alekss Kotļevs|O|18
Sevēlijs Boroviks|O|18
Kristaps Rekmanis|O|18
Jegors Čugunovs|O|18
Artjoms Butriks|P|18
Miķelis Menniks|P|17
Felikss Sproģis|P|18
Markuss Gomins|P|18
Oskars Šulcs|P|17
Fabio Rošā|P|17
Rojs Bušs|P|18
Olivers Dzenītis|P|18
Markuss Blaubergs|P|18
Aleks Ščerbinskis|P|16
Marko Bajārs|N|17
Olivers Beķeris|N|18
Georgijs Bombāns|N|17` },
  { kraj: 'Bułgaria', trener: 'Atanas Ribarski', lista: `
Plamen Penev|B|18
Ognian Vladimirov|B|18
Borislav Stoichkov|O|18
Emanuil Nyagolov|O|18
Radoslav Palazov|O|18
Valeri Vladimirov|O|18
Aleks Tunchev|O|17
Daniel Kirilov|O|18
Radostin Stoilov|P|18
Marto Boychev|P|18
Kristian Mihaylov|P|18
Stefan Krumov|P|18
Ivo Motev|P|18
Kaloyan Bozhkov|P|18
Ricardo Fernandes|N|18
Samuil Tsonov|N|18
Maksim Minkov|N|18
Nikola Genchev|N|17
Dimitar Mrankov|N|18
Kristiyan Goryanov|N|17` },
  { kraj: 'Węgry', trener: 'Máté Gerliczki', lista: `
Zétény Baranyi|B|17
Desmond Esery|B|18
Teó Balázs|O|18
Kristóf Lakatos|O|18
Bátor Szebellédi|O|18
Gergely Csóka|O|18
Márton Prettenhoffer|O|18
Ferenc Ujváry|O|18
Bence Rab|P|18
Márkó Mándity|P|18
Ádám Zubor|P|18
Erik Magyarics|P|18
Levente Bősze|P|17
Zsombor Varga|P|18
Áron Palkó|P|18
Szabolcs Buki|P|18
Zsombor Riba|P|18
Barna Vörös|P|18
Ádám Nyers|N|18
Benjámin Gólik|N|18` },
];

const POZYCJE: Record<string, string> = { B: 'Bramkarz', O: 'Obrońca', P: 'Pomocnik', N: 'Napastnik' };

export type TalentEuropy = {
  firstName: string; lastName: string; birthYear: number | null;
  pozycja: string; krajKlubu: string; europa: true;
};

export function talentyEuropyU19(): TalentEuropy[] {
  const out: TalentEuropy[] = [];
  EUROPA_U19.forEach((k) => {
    k.lista.split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => {
      const [nazwa, poz, wiek] = l.split('|');
      const czlony = nazwa.trim().split(/\s+/);
      const lastName = czlony.length > 1 ? czlony[czlony.length - 1] : czlony[0];
      const firstName = czlony.length > 1 ? czlony.slice(0, -1).join(' ') : '';
      out.push({
        firstName, lastName,
        birthYear: Number(wiek) === 18 ? 2008 : null,
        pozycja: POZYCJE[poz] || '',
        krajKlubu: `${k.kraj} U-19`,
        europa: true,
      });
    });
  });
  return out;
}
