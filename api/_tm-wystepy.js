// SUMY WYSTĘPÓW Z TRANSFERMARKTU — czysta logika, bez sieci (test: scripts/test-tm-wystepy.mjs).
//
// SKĄD DANE
// Strona „Występy" zawodnika na Transfermarkcie nie ma już tabeli w HTML — rysuje ją przeglądarka
// z serwisu danych tmapi.transfermarkt.technology/player/{id}/performance-game. Ten serwis oddaje
// KAŻDY mecz drużyny z okresu, w którym zawodnik był w klubie, a przy nim stan udziału:
//   „played"                      — zagrał (minuty, czy od 1. minuty, gole, asysty, kartki),
//   „in squad"                    — był w kadrze meczowej, nie wszedł,
//   „not in squad"                — poza kadrą meczową,
//   „played for a different team" — w tym terminie grał w innej drużynie klubu (np. rezerwach).
//
// DLACZEGO TO WAŻNE DLA SBS
// Udział w minutach (minuty / minuty możliwe) wymaga wiedzy, ile meczów zagrała DRUŻYNA, nie tylko
// zawodnik. Tu to mamy wprost: mecze drużyny = wszystkie wpisy poza „played for a different team"
// (te liczą się drużynie, w której wtedy grał). Minuty możliwe = suma długości tych meczów —
// mecz z dogrywką ma 120, nie 90.

const STAN_ZAGRAL = "played";
const STAN_KADRA = "in squad";
const STAN_INNA = "played for a different team";

const liczba = (x) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

/** Kartki z jednego meczu. Serwis dokłada obiekt kartki tylko wtedy, gdy była. */
function kartki(c) {
  const k = c || {};
  const zolte = liczba(k.yellowCardNet) || (k.yellowCard ? 1 : 0);
  const czerwone = (k.redCard ? 1 : 0) + (k.yellowRedCard || k.secondYellowCard ? 1 : 0);
  return { zolte, czerwone };
}

/**
 * Sumy na sezon i rozgrywki (osobno dla każdego klubu, bo zawodnik bywa w dwóch drużynach jednego
 * sezonu). Wynik jest posortowany od najnowszego sezonu.
 * @param {any[]} wystepy  data.performance z tmapi
 * @param {Record<string, {nazwa:string, typ:number}>} rozgrywki  nazwy i typy rozgrywek (z /competitions)
 * @param {Record<string, string>} kluby  nazwy klubów (z /clubs)
 */
export function zsumujWystepy(wystepy, rozgrywki = {}, kluby = {}) {
  const sumy = new Map();
  for (const w of Array.isArray(wystepy) ? wystepy : []) {
    const g = (w && w.gameInformation) || {};
    const s = (w && w.statistics) || {};
    const stan = String((s.generalStatistics || {}).participationState || "");
    const klubId = String(((w.clubsInformation || {}).club || {}).clubId || "");
    const klucz = `${g.seasonId}|${g.competitionId}|${klubId}`;
    if (!sumy.has(klucz)) {
      const r = rozgrywki[g.competitionId] || {};
      sumy.set(klucz, {
        sezonId: Number(g.seasonId) || 0,
        sezon: String((g.season || {}).display || g.seasonId || ""),
        rozgrywkiId: String(g.competitionId || ""),
        rozgrywki: r.nazwa || String(g.competitionId || ""),
        typRozgrywek: r.typ ?? g.competitionTypeId ?? null,
        reprezentacja: !!g.isNationalGame,
        klubId,
        klub: kluby[klubId] || "",
        meczeDruzyny: 0, wKadrze: 0, wystepy: 0, odPierwszej: 0, zLawki: 0,
        minuty: 0, minutyMozliwe: 0, gole: 0, asysty: 0, samoboje: 0, zolte: 0, czerwone: 0,
        ostatniMecz: "",
      });
    }
    const t = sumy.get(klucz);
    if (stan === STAN_INNA) continue;
    t.meczeDruzyny++;
    t.minutyMozliwe += liczba(g.gameDuration) || 90;
    const data = String(((g.date || {}).dateTimeUTC) || "").slice(0, 10);
    if (stan === STAN_ZAGRAL || stan === STAN_KADRA) t.wKadrze++;
    if (stan !== STAN_ZAGRAL) continue;
    const czas = s.playingTimeStatistics || {};
    const gole = s.goalStatistics || {};
    const k = kartki(s.cardStatistics);
    t.wystepy++;
    if (czas.isStarting) t.odPierwszej++; else t.zLawki++;
    t.minuty += liczba(czas.playedMinutes);
    t.gole += liczba(gole.goalsScoredTotal);
    t.asysty += liczba(gole.assists);
    t.samoboje += liczba(gole.ownGoalsScored);
    t.zolte += k.zolte;
    t.czerwone += k.czerwone;
    if (data > t.ostatniMecz) t.ostatniMecz = data;
  }
  const wiersze = [...sumy.values()].filter((t) => t.meczeDruzyny > 0);
  const sezony = new Map();
  for (const w of wiersze) {
    if (!sezony.has(w.sezonId)) sezony.set(w.sezonId, { sezonId: w.sezonId, sezon: w.sezon, rozgrywki: [] });
    sezony.get(w.sezonId).rozgrywki.push(w);
  }
  return [...sezony.values()]
    .sort((a, b) => b.sezonId - a.sezonId)
    .map((s) => ({ ...s, rozgrywki: s.rozgrywki.sort((a, b) => Number(a.reprezentacja) - Number(b.reprezentacja) || b.minuty - a.minuty) }));
}

/** Rozgrywki ligowe (typ 1 = najwyższa liga, 2 = niższa liga) — te liczą się do udziału w minutach. */
export const czyLiga = (w) => w.typRozgrywek === 1 || w.typRozgrywek === 2;

// Pozycje według numeru z serwisu Transfermarktu (attributes.positionId).
export const POZYCJE_TM = {
  1: "Bramkarz", 2: "Libero", 3: "Środkowy obrońca", 4: "Lewy obrońca", 5: "Prawy obrońca",
  6: "Defensywny pomocnik", 7: "Środkowy pomocnik", 8: "Prawy pomocnik", 9: "Lewy pomocnik",
  10: "Ofensywny pomocnik", 11: "Lewy napastnik", 12: "Prawy napastnik", 13: "Cofnięty napastnik", 14: "Środkowy napastnik",
};
const GRUPY_TM = { GOALKEEPER: "Bramkarz", DEFENDER: "Obrońca", MIDFIELDER: "Pomocnik", FORWARD: "Napastnik" };
// Kraje po numerze z Transfermarktu — tylko sprawdzone na prawdziwych profilach. Reszta zostaje
// pustym polem: lepiej „do sprawdzenia" niż cudze obywatelstwo w kartotece.
export const KRAJE_TM = { 147: "Szwecja" };

/**
 * DEBIUT W SENIORACH — najmocniejszy sygnał radaru. Pierwszy mecz ligowy (typ rozgrywek 1 lub 2),
 * w którym zawodnik zagrał, i pierwszy, który zaczął od 1. minuty. Daty RRRR-MM-DD albo "".
 */
export function debiutyLigowe(wystepy) {
  let debiut = "", start = "";
  for (const w of Array.isArray(wystepy) ? wystepy : []) {
    const g = (w && w.gameInformation) || {};
    const s = (w && w.statistics) || {};
    if (g.isNationalGame) continue;
    if (!(g.competitionTypeId === 1 || g.competitionTypeId === 2)) continue;
    if (((s.generalStatistics || {}).participationState) !== STAN_ZAGRAL) continue;
    const data = String(((g.date || {}).dateTimeUTC) || "").slice(0, 10);
    if (!data) continue;
    if (!debiut || data < debiut) debiut = data;
    if ((s.playingTimeStatistics || {}).isStarting && (!start || data < start)) start = data;
  }
  return { debiutLigowy: debiut, pierwszyStartLigowy: start };
}

/** Profil z /players — tylko to, co SBS przechowuje. Puste, gdy serwis czegoś nie podaje. */
export function profilZTmapi(p) {
  const a = (p && p.attributes) || {};
  const nogi = { 1: "Prawa", 2: "Lewa", 3: "Obie" };
  const mv = ((p && p.marketValueDetails) || {}).current || {};
  const wartosc = mv.value ? (mv.value >= 1e6 ? (mv.value / 1e6).toLocaleString("pl-PL", { maximumFractionDigits: 2 }) + " mln €"
    : Math.round(mv.value / 1000) + " tys. €") : "";
  return {
    nazwa: (p && p.name) || "",
    dataUr: (((p || {}).lifeDates) || {}).dateOfBirth || "",
    wzrost: a.height ? Math.round(Number(a.height) > 3 ? Number(a.height) : Number(a.height) * 100) : null,
    noga: nogi[a.preferredFootId] || "",
    kontraktDo: a.contractUntil || "",
    menedzer: (a.consultantAgency && a.consultantAgency.name) || "",
    wartosc,
    wypozyczony: ((p || {}).ribbon || {}).ribbonType === "ON_LOAN",
    nowyNabytek: ((p || {}).ribbon || {}).ribbonType === "NEW_SIGNING",
    pozycja: POZYCJE_TM[a.positionId] || GRUPY_TM[a.positionGroup] || "",
    obywatelstwo: [((p || {}).nationalityDetails || {}).nationalities || {}].flatMap((n) => [n.nationalityId, n.secondNationalityId])
      .filter((x) => x).map((x) => KRAJE_TM[x] || "").filter(Boolean),
    adres: (p && p.relativeUrl) ? "https://www.transfermarkt.pl" + p.relativeUrl : "",
  };
}
