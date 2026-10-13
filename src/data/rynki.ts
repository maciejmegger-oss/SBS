// RYNKI — MAPA LIG 2. I 3. POZIOMU W SKANDYNAWII I EUROPIE ŚRODKOWO-WSCHODNIEJ.
//
// PO CO TO JEST
// Zakładka „Rynki" to geograficzne wejście do tej samej bazy co reszta systemu: Europa → kraj →
// liga → zawodnik. Szukamy zawodników 16–21 lat, którzy już grają w seniorach na niższym szczeblu,
// zanim zauważy ich rynek. Najważniejszy sygnał to nie gole, tylko TEMPO PRZYROSTU MINUT — udział
// zawodnika w minutach drużyny mierzony obserwacja po obserwacji. Transfermarkt pokazuje stan na
// dziś; system pamięta, jak do niego doszło.
//
// SKĄD DANE
// 1. Mapa lig — z arkusza „Mapa skautingowa Skandynawia–Wschód" (13.10.2026). Priorytet:
//    1 = start teraz, 2 = drugi etap, 3 = rozszerzenie.
// 2. MONITORING_RYNKI — zawodnicy wpisani ręcznie z profili Transfermarktu (zrzuty z 13.10.2026).
//    Minuty są SZACUNKIEM: Transfermarkt na profilu podaje procent minut, więc liczymy
//    procent × mecze możliwe × 90. Pole `szacunek` mówi o tym wprost przy każdej obserwacji.
// 3. Kadry U-19/U-18/U-17 (europa-mlodziez.ts + europa-statystyki.ts) — każdy reprezentant
//    młodzieżowy, którego klub gra w lidze z mapy, pojawia się na Rynkach automatycznie.
//
// CZEGO TU NIE MA: zmyślonych tabel ligowych ani liczby drużyn w lidze — to zmienia się co sezon
// i trzeba to sprawdzić u źródła, zanim cokolwiek się tu wpisze.

import { talentyEuropy } from "./europa-mlodziez";
import { statEuropy } from "./europa-statystyki";

export type Region = "Skandynawia" | "Europa Środkowo-Wschodnia" | "Europa Wschodnia";

export type LigaRynku = {
  id: string;
  kraj: string;
  region: Region;
  poziom: number;
  nazwa: string;
  sezon: "wiosna–jesień" | "jesień–wiosna";
  priorytet: 1 | 2 | 3;
  zrodla: string;
  uwagi: string;
  /** Nazwy, pod którymi liga występuje na Transfermarkcie — po nich łączymy kadry młodzieżowe. */
  aliasy: string[];
};

export const LIGI_RYNKOW: LigaRynku[] = [
  { id: "SE2", kraj: "Szwecja", region: "Skandynawia", poziom: 2, nazwa: "Superettan", sezon: "wiosna–jesień", priorytet: 1, zrodla: "svenskfotboll.se (protokoły), ligan.se, Transfermarkt", uwagi: "Kontrakty często kończą się 31.12 — wolni zawodnicy na zimowe okno w Polsce.", aliasy: ["Superettan"] },
  { id: "SE3N", kraj: "Szwecja", region: "Skandynawia", poziom: 3, nazwa: "Ettan Norra", sezon: "wiosna–jesień", priorytet: 1, zrodla: "svenskfotboll.se, Transfermarkt", uwagi: "Sporo wypożyczeń z Allsvenskan — sprawdzaj klub macierzysty.", aliasy: ["Ettan Norra"] },
  { id: "SE3S", kraj: "Szwecja", region: "Skandynawia", poziom: 3, nazwa: "Ettan Södra", sezon: "wiosna–jesień", priorytet: 1, zrodla: "svenskfotboll.se, Transfermarkt", uwagi: "Sporo wypożyczeń z Allsvenskan i Superettan — sprawdzaj klub macierzysty.", aliasy: ["Ettan Södra"] },
  { id: "NO2", kraj: "Norwegia", region: "Skandynawia", poziom: 2, nazwa: "OBOS-ligaen", sezon: "wiosna–jesień", priorytet: 1, zrodla: "fotball.no (kampfakta), Transfermarkt", uwagi: "Norwegia w EOG — wyjątek 16–18 ma zastosowanie.", aliasy: ["OBOS-ligaen"] },
  { id: "NO3", kraj: "Norwegia", region: "Skandynawia", poziom: 3, nazwa: "PostNord-ligaen", sezon: "wiosna–jesień", priorytet: 1, zrodla: "fotball.no", uwagi: "Drużyny rezerw klubów Eliteserien — młodzi z minutami w seniorach.", aliasy: ["PostNord-ligaen", "PostNord-ligaen avdeling 1", "PostNord-ligaen avdeling 2"] },
  { id: "DK2", kraj: "Dania", region: "Skandynawia", poziom: 2, nazwa: "1. Division", sezon: "jesień–wiosna", priorytet: 1, zrodla: "dbu.dk, Transfermarkt", uwagi: "Dania gra jesień–wiosna, inaczej niż reszta Skandynawii.", aliasy: ["1.Division", "1. Division"] },
  { id: "DK3", kraj: "Dania", region: "Skandynawia", poziom: 3, nazwa: "2. Division", sezon: "jesień–wiosna", priorytet: 2, zrodla: "dbu.dk, Transfermarkt", uwagi: "", aliasy: ["2.Division", "2. Division"] },
  { id: "FI2", kraj: "Finlandia", region: "Skandynawia", poziom: 2, nazwa: "Ykkösliiga", sezon: "wiosna–jesień", priorytet: 2, zrodla: "palloliitto.fi, Transfermarkt", uwagi: "Nowy 2. poziom od 2024 r.", aliasy: ["Ykkösliiga"] },
  { id: "FI3", kraj: "Finlandia", region: "Skandynawia", poziom: 3, nazwa: "Ykkönen", sezon: "wiosna–jesień", priorytet: 2, zrodla: "palloliitto.fi, Transfermarkt", uwagi: "", aliasy: ["Ykkönen"] },
  { id: "CZ2", kraj: "Czechy", region: "Europa Środkowo-Wschodnia", poziom: 2, nazwa: "Národní liga", sezon: "jesień–wiosna", priorytet: 1, zrodla: "fotbal.cz, Transfermarkt", uwagi: "Zespoły B klubów 1. ligi — młodzi z minutami.", aliasy: ["Chance Národní liga", "Národní liga"] },
  { id: "CZ3", kraj: "Czechy", region: "Europa Środkowo-Wschodnia", poziom: 3, nazwa: "ČFL / MSFL", sezon: "jesień–wiosna", priorytet: 3, zrodla: "is.fotbal.cz", uwagi: "System federacji ma protokoły z minutami.", aliasy: ["ČFL", "MSFL", "Česká fotbalová liga", "Moravskoslezská fotbalová liga"] },
  { id: "SK2", kraj: "Słowacja", region: "Europa Środkowo-Wschodnia", poziom: 2, nazwa: "2. liga", sezon: "jesień–wiosna", priorytet: 1, zrodla: "futbalsfz.sk, Transfermarkt", uwagi: "Sporo zespołów rezerw.", aliasy: ["MONACObet Liga"] },
  { id: "HU2", kraj: "Węgry", region: "Europa Środkowo-Wschodnia", poziom: 2, nazwa: "NB II", sezon: "jesień–wiosna", priorytet: 2, zrodla: "mlsz.hu, Transfermarkt", uwagi: "Lokalne przepisy o młodzieżowcach — młodzi z regularnymi minutami.", aliasy: ["Nemzeti Bajnokság II.", "Merkantil Bank Liga"] },
  { id: "UA2", kraj: "Ukraina", region: "Europa Wschodnia", poziom: 2, nazwa: "Persha Liha", sezon: "jesień–wiosna", priorytet: 1, zrodla: "uaf.ua, Transfermarkt", uwagi: "Limit spoza UE; weryfikuj status rejestracyjny i warunki bezpieczeństwa.", aliasy: ["Persza Liga", "Persha Liga", "Persha Liha"] },
  { id: "UA3", kraj: "Ukraina", region: "Europa Wschodnia", poziom: 3, nazwa: "Druha Liha", sezon: "jesień–wiosna", priorytet: 2, zrodla: "uaf.ua, Transfermarkt", uwagi: "Słabsza dostępność nagrań.", aliasy: ["Druha Liga", "Druha Liha"] },
  { id: "LT2", kraj: "Litwa", region: "Europa Wschodnia", poziom: 2, nazwa: "Pirma lyga", sezon: "wiosna–jesień", priorytet: 2, zrodla: "lff.lt, Transfermarkt", uwagi: "", aliasy: ["I Lyga", "Pirma lyga"] },
  { id: "LV2", kraj: "Łotwa", region: "Europa Wschodnia", poziom: 2, nazwa: "1. līga", sezon: "wiosna–jesień", priorytet: 3, zrodla: "lff.lv, Transfermarkt", uwagi: "", aliasy: ["Futbola Pirmā līga", "1. līga"] },
  { id: "EE2", kraj: "Estonia", region: "Europa Wschodnia", poziom: 2, nazwa: "Esiliiga", sezon: "wiosna–jesień", priorytet: 3, zrodla: "jalgpall.ee, Transfermarkt", uwagi: "Drużyny rezerw (U21) klubów Premium liiga.", aliasy: ["Esiliiga"] },
  { id: "GE1", kraj: "Gruzja", region: "Europa Wschodnia", poziom: 1, nazwa: "Erovnuli Liga", sezon: "wiosna–jesień", priorytet: 3, zrodla: "gff.ge, Transfermarkt", uwagi: "Etap rozszerzenia; limit spoza UE.", aliasy: ["Erovnuli Liga"] },
  { id: "GE2", kraj: "Gruzja", region: "Europa Wschodnia", poziom: 2, nazwa: "Erovnuli Liga 2", sezon: "wiosna–jesień", priorytet: 3, zrodla: "gff.ge, Transfermarkt", uwagi: "Etap rozszerzenia; limit spoza UE.", aliasy: ["Erovnuli Liga 2"] },
];

export const REGIONY: Region[] = ["Skandynawia", "Europa Środkowo-Wschodnia", "Europa Wschodnia"];

/** Kraje UE i EOG — bez limitu zawodników spoza UE i z wyjątkiem 16–18 z art. 19 RSTP FIFA. */
const UE_EOG = new Set([
  "Szwecja", "Norwegia", "Dania", "Finlandia", "Islandia", "Czechy", "Słowacja", "Węgry", "Litwa", "Łotwa",
  "Estonia", "Chorwacja", "Słowenia", "Rumunia", "Bułgaria", "Niemcy", "Austria", "Holandia", "Belgia",
  "Francja", "Włochy", "Hiszpania", "Portugalia", "Irlandia", "Grecja", "Cypr", "Malta", "Luksemburg", "Polska",
]);
export const czyUeEog = (kraj: string): boolean => UE_EOG.has(String(kraj || "").trim());

export const ligaRynku = (id: string): LigaRynku | undefined => LIGI_RYNKOW.find((l) => l.id === id);
export const ligiKraju = (kraj: string): LigaRynku[] => LIGI_RYNKOW.filter((l) => l.kraj === kraj);
export const krajeRegionu = (region: Region): string[] =>
  [...new Set(LIGI_RYNKOW.filter((l) => l.region === region).map((l) => l.kraj))];
/** Priorytet kraju = najwyższy priorytet spośród jego lig. */
export const priorytetKraju = (kraj: string): number => Math.min(...ligiKraju(kraj).map((l) => l.priorytet));

const NORM = (s: string) => String(s || "").trim().toLowerCase();
/** Liga z mapy po nazwie z Transfermarktu albo undefined, gdy ligi nie monitorujemy. */
export function ligaPoNazwieTM(nazwa: string): LigaRynku | undefined {
  const n = NORM(nazwa);
  if (!n) return undefined;
  return LIGI_RYNKOW.find((l) => l.aliasy.some((a) => NORM(a) === n));
}

// ---------- WIEK, PRZEDZIAŁ, MINUTY, TEMPO ----------

/** Pełne lata na dany dzień (data w formacie RRRR-MM-DD). */
export function wiekNaDzien(dataUr: string, dzien: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataUr || ""));
  if (!m) return null;
  let lata = dzien.getFullYear() - Number(m[1]);
  const przed = dzien.getMonth() + 1 < Number(m[2]) || (dzien.getMonth() + 1 === Number(m[2]) && dzien.getDate() < Number(m[3]));
  if (przed) lata--;
  return lata;
}

export type Przedzial = "A" | "B" | "C";
export const OPIS_PRZEDZIALU: Record<Przedzial, string> = { A: "16–17", B: "18–19", C: "20–21" };
export function przedzialWieku(wiek: number | null): Przedzial | null {
  if (wiek == null) return null;
  if (wiek >= 16 && wiek <= 17) return "A";
  if (wiek >= 18 && wiek <= 19) return "B";
  if (wiek >= 20 && wiek <= 21) return "C";
  return null;
}

/** Udział w minutach drużyny (0–1): minuty / (mecze możliwe × 90). */
export function udzialMinut(minuty: number | null, meczeMozliwe: number | null): number | null {
  if (minuty == null || !meczeMozliwe) return null;
  return Math.max(0, Math.min(1, minuty / (meczeMozliwe * 90)));
}

/** Progi zmiany udziału sezon do sezonu (punkty procentowe). Robocze — do korekty po pierwszym miesiącu. */
export const PROG_SKOKU = 0.25;
export const PROG_WZROSTU = 0.10;
export type Tempo = "Skok" | "Wzrost" | "Stabilnie" | "Spadek" | "Brak danych poprz. sezonu";
export function tempoRozwoju(udzialPoprz: number | null, udzialBiez: number | null): Tempo | null {
  if (udzialBiez == null) return null;
  if (udzialPoprz == null) return "Brak danych poprz. sezonu";
  const d = udzialBiez - udzialPoprz;
  if (d >= PROG_SKOKU) return "Skok";
  if (d >= PROG_WZROSTU) return "Wzrost";
  if (d > -PROG_WZROSTU) return "Stabilnie";
  return "Spadek";
}

/** Co klub z Polski musi wiedzieć przed rozmową o transferze. */
export function uwagaTransferowa(wiek: number | null, ueEog: boolean | null): string {
  if (wiek == null) return "";
  if (wiek < 18 && ueEog === false) return "Za młody — poza UE/EOG (art. 19 RSTP)";
  const czesci: string[] = [];
  if (ueEog === false) czesci.push("Limit spoza UE");
  if (wiek < 23) czesci.push("ekwiwalent za wyszkolenie");
  const t = czesci.join("; ");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Bez ograniczeń";
}

// ---------- ZAWODNICY MONITOROWANI RĘCZNIE ----------

export type ObserwacjaRynku = {
  data: string;
  rodzaj: "Dane ligowe" | "Wideo" | "Na żywo" | "Informacja z klubu";
  minuty: number;
  meczeMozliwe: number | null;
  wystepy: number | null;
  odPierwszej: number | null;
  szacunek: boolean;
  notatka: string;
};

export type ZawodnikMonitorowany = {
  id: string;
  imie: string;
  nazwisko: string;
  dataUr: string;
  ligaId: string;
  klub: string;
  pozycja: string;
  obywatelstwo: string[];
  kontraktDo: string;
  wypozyczenie: { z: string; do: string } | null;
  status: "Do sprawdzenia" | "Obserwacja" | "Wideo" | "Raport" | "Rekomendacja" | "Odrzucony";
  wzrost: number | null;
  menedzer: string;
  wartoscTM: string;
  wKlubieOd: string;
  sciezka: { kiedy: string; co: string }[];
  /** Udział w minutach w poprzednim sezonie na tym poziomie — null, dopóki nie wpiszemy. */
  udzialPoprz: number | null;
  obserwacje: ObserwacjaRynku[];
  notatka: string;
  /** Numer zawodnika na Transfermarkcie — gdy profil założono z kadry młodzieżowej. */
  tmId?: string;
  tmLink?: string;
};

export const STATUSY_RYNKOW: ZawodnikMonitorowany["status"][] = ["Do sprawdzenia", "Obserwacja", "Wideo", "Raport", "Rekomendacja", "Odrzucony"];

export const MONITORING_RYNKI: ZawodnikMonitorowany[] = [
  {
    id: "R001", imie: "Ayo", nazwisko: "Rupia-Ellis", dataUr: "2005-07-18", ligaId: "SE2", klub: "Falkenbergs FF",
    pozycja: "Prawy obrońca", obywatelstwo: ["Szwecja", "Tanzania"], kontraktDo: "2030-12-31", wypozyczenie: null,
    status: "Obserwacja", wzrost: 182, menedzer: "MD Management", wartoscTM: "100 tys. €", wKlubieOd: "2026-08-03",
    sciezka: [{ kiedy: "do 2024", co: "Akademia AIK Solna" }, { kiedy: "2025", co: "Brak danych — do uzupełnienia" }, { kiedy: "08.2026", co: "Falkenbergs FF (Superettan)" }],
    udzialPoprz: null,
    obserwacje: [{ data: "2026-10-13", rodzaj: "Dane ligowe", minuty: 486, meczeMozliwe: 9, wystepy: 8, odPierwszej: 6, szacunek: true, notatka: "8/9 meczów od transferu, 6 od 1. minuty, 1 asysta." }],
    notatka: "Od razu podstawowy w drużynie walczącej o awans (2. miejsce w tabeli).",
  },
  {
    id: "R002", imie: "Noel", nazwisko: "Lundgren", dataUr: "2005-04-02", ligaId: "SE3S", klub: "Tvååkers IF",
    pozycja: "Środkowy pomocnik", obywatelstwo: ["Szwecja"], kontraktDo: "", wypozyczenie: { z: "Falkenbergs FF", do: "2026-11-30" },
    status: "Obserwacja", wzrost: null, menedzer: "", wartoscTM: "", wKlubieOd: "2026-05-06",
    sciezka: [{ kiedy: "do 2024", co: "Akademia Falkenbergs FF" }, { kiedy: "05.2026", co: "Wypożyczenie do Tvååkers IF (Ettan Södra)" }],
    udzialPoprz: null,
    obserwacje: [{ data: "2026-10-13", rodzaj: "Dane ligowe", minuty: 851, meczeMozliwe: 21, wystepy: 15, odPierwszej: 9, szacunek: true, notatka: "15/21 meczów, 9 od 1. minuty, 1 żółta kartka." }],
    notatka: "Wypożyczenie kończy się 30.11.2026 — przyszłość w Falkenbergu niepewna.",
  },
  {
    id: "R003", imie: "Gazton", nazwisko: "Alexandersson", dataUr: "2008-02-24", ligaId: "SE2", klub: "Falkenbergs FF",
    pozycja: "Pomocnik", obywatelstwo: ["Szwecja"], kontraktDo: "2028-12-31", wypozyczenie: null,
    status: "Do sprawdzenia", wzrost: null, menedzer: "", wartoscTM: "50 tys. €", wKlubieOd: "2026-01-29",
    sciezka: [{ kiedy: "do 2025", co: "Akademia Falkenbergs FF" }, { kiedy: "01.2026", co: "Pierwsza drużyna Falkenbergs FF" }],
    udzialPoprz: null,
    obserwacje: [{ data: "2026-10-13", rodzaj: "Dane ligowe", minuty: 47, meczeMozliwe: 26, wystepy: 5, odPierwszej: 0, szacunek: true, notatka: "5 wejść z ławki — pierwszy sezon w seniorach." }],
    notatka: "",
  },
  {
    id: "R004", imie: "Wilton", nazwisko: "Ljunggren", dataUr: "2006-04-27", ligaId: "SE2", klub: "Falkenbergs FF",
    pozycja: "Obrońca", obywatelstwo: ["Szwecja"], kontraktDo: "", wypozyczenie: null,
    status: "Do sprawdzenia", wzrost: null, menedzer: "Modyr MGMT", wartoscTM: "", wKlubieOd: "",
    sciezka: [],
    udzialPoprz: null,
    obserwacje: [{ data: "2026-10-13", rodzaj: "Dane ligowe", minuty: 0, meczeMozliwe: 19, wystepy: 0, odPierwszej: 0, szacunek: false, notatka: "0 z 19 możliwych meczów." }],
    notatka: "Kontraktu brak w Transfermarkcie.",
  },
  {
    id: "R005", imie: "Alexander", nazwisko: "Carlsson", dataUr: "2007-08-02", ligaId: "SE2", klub: "Falkenbergs FF",
    pozycja: "Bramkarz", obywatelstwo: ["Szwecja"], kontraktDo: "", wypozyczenie: { z: "klubu Allsvenskan (do potwierdzenia)", do: "2026-11-30" },
    status: "Do sprawdzenia", wzrost: null, menedzer: "", wartoscTM: "", wKlubieOd: "2026-05-25",
    sciezka: [{ kiedy: "25/26", co: "Svenska Cupen w klubie macierzystym: 1 mecz, 28 min" }, { kiedy: "05.2026", co: "Wypożyczenie do Falkenbergs FF" }],
    udzialPoprz: null,
    obserwacje: [{ data: "2026-10-13", rodzaj: "Dane ligowe", minuty: 0, meczeMozliwe: null, wystepy: 0, odPierwszej: 0, szacunek: false, notatka: "Brak występów w Superettan." }],
    notatka: "",
  },
];

// ---------- EDYCJE Z SYSTEMU ----------
//
// Profile poprawione w aplikacji („Edytuj profil") i zawodnicy dopisani z kadr trzymamy w jednym
// wierszu bazy (sbs_kv, klucz scouting:rynki_zawodnicy): { id: pełny profil }. Wpis o tym samym id
// co zawodnik z MONITORING_RYNKI zastępuje go w całości — w bazie leży to, co skaut zatwierdził,
// a lista w kodzie jest tylko punktem startu.

let EDYCJE: Record<string, ZawodnikMonitorowany> = {};
export function ustawEdycjeRynkow(e: Record<string, ZawodnikMonitorowany> | null | undefined): void {
  EDYCJE = e && typeof e === "object" ? e : {};
}
export const edycjeRynkow = (): Record<string, ZawodnikMonitorowany> => EDYCJE;
export function zapiszProfilRynku(m: ZawodnikMonitorowany): void {
  EDYCJE = { ...EDYCJE, [m.id]: m };
}

/** Monitorowani po uwzględnieniu edycji: profile z kodu (poprawione, jeśli są edycje) + dopisani w systemie. */
export function monitorowani(): ZawodnikMonitorowany[] {
  const zKodu = MONITORING_RYNKI.map((m) => EDYCJE[m.id] || m);
  const dopisani = Object.values(EDYCJE).filter((m) => !MONITORING_RYNKI.some((x) => x.id === m.id));
  return zKodu.concat(dopisani);
}

/** Pusty profil do założenia z zawodnika z kadry (dane z Transfermarktu jako punkt startu). */
export function profilZKadry(z: { imie: string; nazwisko: string; dataUr: string; liga: LigaRynku; klub: string;
  pozycja: string; kadra: string; tmLink: string; minuty: number | null; wystepy: number | null }, dzis: string): ZawodnikMonitorowany {
  const tmId = String(z.tmLink || "").split("/spieler/")[1] || "";
  const kraj = String(z.kadra || "").split(" U-")[0].trim();
  return {
    id: "K" + (tmId || Date.now()), imie: z.imie, nazwisko: z.nazwisko, dataUr: z.dataUr, ligaId: z.liga.id, klub: z.klub,
    pozycja: z.pozycja, obywatelstwo: kraj ? [kraj] : [], kontraktDo: "", wypozyczenie: null, status: "Do sprawdzenia",
    wzrost: null, menedzer: "", wartoscTM: "", wKlubieOd: "", sciezka: [], udzialPoprz: null,
    obserwacje: z.minuty != null ? [{ data: dzis, rodzaj: "Dane ligowe", minuty: z.minuty, meczeMozliwe: null,
      wystepy: z.wystepy, odPierwszej: null, szacunek: false, notatka: "Z Transfermarktu (kadra " + z.kadra + ")." }] : [],
    notatka: "", tmId, tmLink: z.tmLink,
  };
}

// ---------- STATYSTYKI Z TRANSFERMARKTU ----------
//
// Zgłoszenie (13.10.2026): „jak są na Transfermarkt, to niech system już wprowadza ich dane
// statystyczne — mecze, minuty, gole, asysty". Liczby przychodzą z /api/tm-wystepy (sumy na sezon
// i rozgrywki, razem z liczbą meczów DRUŻYNY), a tutaj trzymamy je w pamięci podręcznej
// (sbs_kv: scouting:rynki_tm) — klucz to numer zawodnika na Transfermarkcie.

export type WierszTM = {
  sezonId: number; sezon: string; rozgrywkiId: string; rozgrywki: string; typRozgrywek: number | null;
  reprezentacja: boolean; klubId: string; klub: string; meczeDruzyny: number; wKadrze: number; wystepy: number;
  odPierwszej: number; zLawki: number; minuty: number; minutyMozliwe: number; gole: number; asysty: number;
  samoboje: number; zolte: number; czerwone: number; ostatniMecz: string;
};
export type ProfilTM = { nazwa: string; dataUr: string; wzrost: number | null; noga: string; kontraktDo: string;
  menedzer: string; wartosc: string; wypozyczony: boolean };
export type StatystykiTM = { pobrano: string; profil: ProfilTM | null; sezony: { sezonId: number; sezon: string; rozgrywki: WierszTM[] }[] };

let STATY_TM: Record<string, StatystykiTM> = {};
export function ustawStatystykiTM(e: Record<string, StatystykiTM> | null | undefined): void {
  STATY_TM = e && typeof e === "object" ? e : {};
}
export const statystykiTM = (): Record<string, StatystykiTM> => STATY_TM;
export const statystykiZawodnikaTM = (tmId: string): StatystykiTM | null => (tmId && STATY_TM[tmId]) || null;
export function zapiszStatystykiTM(tmId: string, d: StatystykiTM): void {
  STATY_TM = { ...STATY_TM, [tmId]: d };
}
export const tmIdZLinku = (link: string): string => (String(link || "").match(/\/spieler\/(\d+)/) || [])[1] || "";

/** Czy statystyki trzeba odświeżyć: nie ma ich albo są starsze niż `godzin`. */
export function staryStanTM(tmId: string, teraz: Date, godzin = 24): boolean {
  const d = statystykiZawodnikaTM(tmId);
  if (!d || !d.pobrano) return true;
  return teraz.getTime() - new Date(d.pobrano).getTime() > godzin * 3600000;
}

export type SezonLigowy = { sezon: string; sezonId: number; rozgrywki: string; kluby: string; meczeDruzyny: number;
  wystepy: number; odPierwszej: number; minuty: number; minutyMozliwe: number; gole: number; asysty: number;
  zolte: number; czerwone: number; udzial: number | null };

/** Sumy LIGOWE (bez pucharów, sparingów i reprezentacji) dla każdego sezonu, od najnowszego. */
export function sezonyLigowe(d: StatystykiTM | null): SezonLigowy[] {
  if (!d) return [];
  return d.sezony.map((s) => {
    const w = s.rozgrywki.filter((r) => !r.reprezentacja && (r.typRozgrywek === 1 || r.typRozgrywek === 2));
    if (!w.length) return null;
    const suma = (k: keyof WierszTM) => w.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const minuty = suma("minuty"), mozliwe = suma("minutyMozliwe");
    return { sezon: s.sezon, sezonId: s.sezonId, rozgrywki: [...new Set(w.map((r) => r.rozgrywki))].join(", "),
      kluby: [...new Set(w.map((r) => r.klub).filter(Boolean))].join(", "), meczeDruzyny: suma("meczeDruzyny"),
      wystepy: suma("wystepy"), odPierwszej: suma("odPierwszej"), minuty, minutyMozliwe: mozliwe,
      gole: suma("gole"), asysty: suma("asysty"), zolte: suma("zolte"), czerwone: suma("czerwone"),
      udzial: mozliwe ? Math.min(1, minuty / mozliwe) : null } as SezonLigowy;
  }).filter((x): x is SezonLigowy => !!x).sort((a, b) => b.sezonId - a.sezonId);
}

// ---------- JEDNA LISTA DLA ZAKŁADKI ----------

export type ZawodnikRynku = {
  klucz: string;
  zrodlo: "monitoring" | "kadra";
  imie: string;
  nazwisko: string;
  dataUr: string;
  wiek: number | null;
  przedzial: Przedzial | null;
  liga: LigaRynku;
  klub: string;
  pozycja: string;
  ueEog: boolean | null;
  /** Udział w minutach — tylko gdy znamy mecze możliwe (monitoring). */
  udzial: number | null;
  minuty: number | null;
  wystepy: number | null;
  tempo: Tempo | null;
  status: string;
  kadra: string;
  tmLink: string;
  uwagaTransferowa: string;
  monitorowany: ZawodnikMonitorowany | null;
  /** Numer na Transfermarkcie — klucz do statystyk pobieranych automatycznie. */
  tmId: string;
  odPierwszej: number | null;
  gole: number | null;
  asysty: number | null;
  /** Skąd liczby meczów i minut: obserwacja skauta, Transfermarkt (pełne, z meczami drużyny) albo plik kadr. */
  zrodloLiczb: "obserwacja" | "transfermarkt" | "kadry" | "";
  staty: StatystykiTM | null;
};

export function zawodnicyRynkow(dzis: Date): ZawodnikRynku[] {
  const wynik: ZawodnikRynku[] = [];
  const lista = monitorowani();
  const wMonitoringu = new Set(lista.map((m) => m.tmId).filter(Boolean));
  for (const m of lista) {
    const liga = ligaRynku(m.ligaId);
    if (!liga) continue;
    const wiek = wiekNaDzien(m.dataUr, dzis);
    const ost = m.obserwacje[m.obserwacje.length - 1] || null;
    const tmId = m.tmId || tmIdZLinku(m.tmLink || "");
    const staty = statystykiZawodnikaTM(tmId);
    const [biez, poprz] = sezonyLigowe(staty);
    const udzialObs = ost ? udzialMinut(ost.minuty, ost.meczeMozliwe) : null;
    // Transfermarkt ma pierwszeństwo, gdy jest: liczy mecze drużyny co do jednego, a obserwacja
    // skauta bywa szacunkiem z procentu na profilu.
    const zTM = !!(biez && biez.udzial != null);
    const udzial = zTM ? biez.udzial : udzialObs;
    const udzialPoprz = m.udzialPoprz != null ? m.udzialPoprz : (poprz ? poprz.udzial : null);
    const ue = m.obywatelstwo.some(czyUeEog);
    wynik.push({
      klucz: "m:" + m.id, zrodlo: "monitoring", imie: m.imie, nazwisko: m.nazwisko, dataUr: m.dataUr,
      wiek, przedzial: przedzialWieku(wiek), liga, klub: m.klub, pozycja: m.pozycja, ueEog: ue,
      udzial, minuty: zTM ? biez.minuty : (ost ? ost.minuty : null), wystepy: zTM ? biez.wystepy : (ost ? ost.wystepy : null),
      tempo: tempoRozwoju(udzialPoprz, udzial), status: m.status, kadra: "", tmLink: m.tmLink || "",
      uwagaTransferowa: uwagaTransferowa(wiek, ue), monitorowany: m, tmId,
      odPierwszej: zTM ? biez.odPierwszej : (ost ? ost.odPierwszej : null),
      gole: zTM ? biez.gole : null, asysty: zTM ? biez.asysty : null,
      zrodloLiczb: zTM ? "transfermarkt" : (ost ? "obserwacja" : ""), staty,
    });
  }
  for (const t of talentyEuropy()) {
    const id = String(t.tmLink || "").split("/spieler/")[1] || "";
    if (id && wMonitoringu.has(id)) continue;
    const s = id ? statEuropy(id) : null;
    const liga = s ? ligaPoNazwieTM(s.liga) : undefined;
    if (!liga) continue;
    const kraj = String(t.krajKlubu || "").split(" U-")[0].trim();
    const wiek = wiekNaDzien(t.birthDate, dzis);
    const ue = kraj ? czyUeEog(kraj) : null;
    const staty = statystykiZawodnikaTM(id);
    const [biez, poprz] = sezonyLigowe(staty);
    const zTM = !!biez;
    wynik.push({
      klucz: "k:" + id, zrodlo: "kadra", imie: t.firstName, nazwisko: t.lastName, dataUr: t.birthDate,
      wiek, przedzial: przedzialWieku(wiek), liga, klub: t.club, pozycja: t.pozycja, ueEog: ue,
      udzial: zTM ? biez.udzial : null, minuty: zTM ? biez.minuty : (s ? s.min : null),
      wystepy: zTM ? biez.wystepy : (s ? s.wyst : null),
      tempo: zTM ? tempoRozwoju(poprz ? poprz.udzial : null, biez.udzial) : null,
      status: "Kadra", kadra: t.krajKlubu, tmLink: t.tmLink, uwagaTransferowa: uwagaTransferowa(wiek, ue),
      monitorowany: null, tmId: id, odPierwszej: zTM ? biez.odPierwszej : null,
      gole: zTM ? biez.gole : (s ? s.gole : null), asysty: zTM ? biez.asysty : (s ? s.asysty : null),
      zrodloLiczb: zTM ? "transfermarkt" : "kadry", staty,
    });
  }
  return wynik;
}

// ---------- SYGNAŁY ----------

export type Sygnal = { rodzaj: string; klucz: string; nazwisko: string; tekst: string };

/** Najważniejsze zmiany do przejrzenia: koniec wypożyczenia w ciągu 60 dni i wysoki udział w minutach. */
export function sygnalyRynkow(lista: ZawodnikRynku[], dzis: Date): Sygnal[] {
  const out: Sygnal[] = [];
  const dniDo = (d: string) => Math.round((new Date(d + "T12:00:00").getTime() - dzis.getTime()) / 86400000);
  const pl = (d: string) => d.split("-").reverse().join(".");
  for (const z of lista) {
    const m = z.monitorowany;
    if (!m) continue;
    if (m.wypozyczenie && m.wypozyczenie.do) {
      const dni = dniDo(m.wypozyczenie.do);
      if (dni >= 0 && dni <= 60) out.push({ rodzaj: "WYPOŻYCZENIE", klucz: z.klucz, nazwisko: `${z.imie} ${z.nazwisko}`,
        tekst: `${z.klub} · wypożyczenie z ${m.wypozyczenie.z} kończy się ${pl(m.wypozyczenie.do)} (za ${dni} dni)` });
    }
    if (z.udzial != null && z.udzial >= 0.5) out.push({ rodzaj: "MINUTY ↑", klucz: z.klucz, nazwisko: `${z.imie} ${z.nazwisko}`,
      tekst: `${z.klub} · ok. ${Math.round(z.udzial * 100)}% minut drużyny` });
  }
  const kadrowicze = lista.filter((z) => z.zrodlo === "kadra" && (z.minuty || 0) >= 270)
    .sort((a, b) => (b.minuty || 0) - (a.minuty || 0)).slice(0, 3);
  for (const z of kadrowicze) out.push({ rodzaj: "SENIORZY", klucz: z.klucz, nazwisko: `${z.imie} ${z.nazwisko}`,
    tekst: `${z.kadra} · ${z.klub} (${z.liga.nazwa}) · ${z.wystepy} wyst., ${z.minuty} min` });
  return out;
}
