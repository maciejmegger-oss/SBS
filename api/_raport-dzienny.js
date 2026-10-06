// LOGIKA DZIENNEGO RAPORTU „SBS AI" — czysta, bez dostępu do bazy i sieci, żeby dało się ją testować
// (scripts/test-raport-dzienny.mjs). Zapytania do bazy i wysyłka na telefon są w api/raport-dzienny.js.
//
// ZASADA: o tym, kto spełnia profil, kto wymaga obserwacji, a kto ma potencjał, decydują PROGI
// I LICZBY policzone tutaj — nie model językowy. Model potrafi napisać ładne zdanie o zawodniku,
// którego nikt nie obejrzał; liczba w raporcie dziennym ma być do sprawdzenia w kartotece.
// Gdy brakuje danych, zawodnik ląduje w „brak wystarczających danych", a nie dostaje oceny z powietrza.
//
// PROFIL POSZUKIWANY przez klub leży w sbs_kv pod kluczem `scouting:profil_poszukiwany`:
//   { "klub": "Lechia Gdańsk U19",
//     "kryteria": [ { "nazwa": "Środkowy obrońca", "pozycje": ["Obrońca środkowy"],
//                     "rocznikOd": 2007, "rocznikDo": 2009, "wzrostMin": 183, "noga": "lewa",
//                     "minutyMin": 600, "ocenaMin": 4 } ] }
// Każde pole kryterium jest opcjonalne — pominięte pole nie jest sprawdzane.

export const KLUCZE_OCEN = ["technika", "taktyka", "motoryka", "mentalnosc", "potencjal"];
export const KLUCZ_PROFILU = "scouting:profil_poszukiwany";
export const KLUCZ_STANU = "scouting:ai_raport_stan";

export const PROG_SPELNIA = 70; // punkty 0–100, od których zawodnik „spełnia profil"
export const DNI_STARA_OBSERWACJA = 60;
export const POTENCJAL_WYSOKI = 5; // skala ocen 1–6

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[łøđ]/g, (c) => ({ ł: "l", ø: "o", đ: "d" }[c]))
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const liczba = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const srednia = (tab) => (tab.length ? tab.reduce((a, b) => a + b, 0) / tab.length : null);

export function rocznikZawodnika(p) {
  const r = liczba(p.birth_year);
  if (r && r > 1900) return r;
  const m = String(p.birth_date || "").match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

const dniTemu = (dataTekst, dzis) => {
  const t = Date.parse(String(dataTekst || "").slice(0, 10));
  if (!Number.isFinite(t)) return null;
  return Math.floor((dzis.getTime() - t) / 86400000);
};

/** Oceny z obserwacji (tylko z wypełnioną oceną — jak w aplikacji, `statsFilledIn`). */
export function podsumujObserwacje(obs, dzis) {
  const ocenione = obs
    .filter((o) => o.stats_filled_in && o.ratings && KLUCZE_OCEN.some((k) => Number(o.ratings[k]) > 0))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const wszystkie = obs.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const sred = ocenione.map((o) => {
    const v = KLUCZE_OCEN.map((k) => Number(o.ratings[k]) || 0).filter((x) => x > 0);
    return srednia(v);
  });
  const potencjaly = ocenione.map((o) => Number(o.ratings.potencjal) || 0).filter((x) => x > 0);
  return {
    liczbaObserwacji: obs.length,
    liczbaOcenionych: ocenione.length,
    ocenaSrednia: srednia(sred.filter((x) => x !== null)),
    potencjalOstatni: potencjaly.length ? potencjaly[0] : null,
    ostatniaData: wszystkie.length ? wszystkie[0].date || null : null,
    dniOdOstatniej: wszystkie.length ? dniTemu(wszystkie[0].date, dzis) : null,
    ostatniaRekomendacja: wszystkie.length ? wszystkie[0].recommendation || "" : "",
  };
}

function pozycjaPasuje(pozycjaZawodnika, dozwolone) {
  const z = norm(pozycjaZawodnika);
  return dozwolone.some((d) => {
    const n = norm(d);
    return n && (z.includes(n) || n.includes(z));
  });
}

/**
 * Porównanie z jednym kryterium profilu. Zwraca punkty (0–100), listę niespełnionych WARUNKÓW
 * (znane i niezgodne) oraz listę braków (nieznane — nie można stwierdzić ani tak, ani nie).
 */
export function ocenKryterium(p, kr, obsPod) {
  const niezgodne = [];
  const brakujace = [];
  let sprawdzone = 0;
  let zgodne = 0;

  const warunek = (nazwa, wartosc, test) => {
    if (wartosc === null || wartosc === undefined || wartosc === "") { brakujace.push(nazwa); return; }
    sprawdzone++;
    if (test(wartosc)) zgodne++; else niezgodne.push(nazwa);
  };

  if (Array.isArray(kr.pozycje) && kr.pozycje.length) {
    warunek("pozycja", p.position, (v) => pozycjaPasuje(v, kr.pozycje));
  }
  const rocznik = rocznikZawodnika(p);
  if (liczba(kr.rocznikOd) !== null || liczba(kr.rocznikDo) !== null) {
    warunek("rocznik", rocznik, (v) =>
      (liczba(kr.rocznikOd) === null || v >= kr.rocznikOd) && (liczba(kr.rocznikDo) === null || v <= kr.rocznikDo));
  }
  if (liczba(kr.wzrostMin) !== null) {
    warunek("wzrost", liczba(p.height), (v) => v >= kr.wzrostMin);
  }
  if (kr.noga) {
    warunek("noga", p.foot, (v) => norm(v).startsWith(norm(kr.noga).slice(0, 3)) || /^obie|^obu/.test(norm(v)));
  }
  if (liczba(kr.minutyMin) !== null) {
    warunek("minuty", liczba(p.minutes), (v) => v >= kr.minutyMin);
  }
  if (liczba(kr.ocenaMin) !== null) {
    warunek("oceny", obsPod.ocenaSrednia, (v) => v >= kr.ocenaMin);
  }

  // Punkty: 60 za zgodność warunków, 30 za poziom ocen skauta (skala 1–6), 10 za liczbę obserwacji.
  // Brak warunków w kryterium = brak czego porównywać, więc zgodność liczymy jako 0, nie 100.
  const czescZgodnosci = sprawdzone ? zgodne / sprawdzone : 0;
  const czescOcen = obsPod.ocenaSrednia !== null ? Math.min(obsPod.ocenaSrednia / 6, 1) : 0;
  const czescObs = Math.min(obsPod.liczbaOcenionych / 3, 1);
  const surowe = Math.round(60 * czescZgodnosci + 30 * czescOcen + 10 * czescObs);
  // Znana niezgodność (zła pozycja, za niski) nie może być zatuszowana dobrymi ocenami — taki
  // zawodnik zostaje poniżej progu „spełnia profil" i nie wyprzedza w rankingu pasujących.
  const punkty = niezgodne.length ? Math.min(surowe, PROG_SPELNIA - 1) : surowe;

  return { kryterium: kr.nazwa || "profil", punkty, niezgodne, brakujace };
}

/** Kluczowe dane, bez których nie da się uczciwie ocenić zawodnika. */
export function brakiDanych(p, obsPod) {
  const braki = [];
  if (!p.position) braki.push("pozycja");
  if (!rocznikZawodnika(p)) braki.push("rocznik");
  if (!p.foot) braki.push("noga");
  if (!liczba(p.height)) braki.push("wzrost");
  if (!liczba(p.minutes)) braki.push("minuty");
  if (!obsPod.liczbaOcenionych) braki.push("oceny z obserwacji");
  return braki;
}

// Umowa i narodowość nie mają własnych kolumn — aplikacja chowa je w custom_fields.__ext
// (patrz EXT_CONFIG w src/data/storage.ts).
const ext = (p) => (p.custom_fields && p.custom_fields.__ext) || {};

function umowaWygasaWCiaguRoku(p, dzis) {
  const data = ext(p).contractUntil;
  if (!data) return false;
  const t = Date.parse(String(data).slice(0, 10));
  return Number.isFinite(t) && t - dzis.getTime() < 365 * 86400000;
}

/** Pełna analiza jednego zawodnika. */
export function analizujZawodnika(p, obs, profil, dzis = new Date()) {
  const obsPod = podsumujObserwacje(obs, dzis);
  const braki = brakiDanych(p, obsPod);
  const kryteria = profil && Array.isArray(profil.kryteria) ? profil.kryteria : [];

  let najlepsze = null;
  for (const kr of kryteria) {
    const w = ocenKryterium(p, kr, obsPod);
    if (!najlepsze || w.punkty > najlepsze.punkty) najlepsze = w;
  }

  const rocznik = rocznikZawodnika(p);
  const wiek = rocznik ? dzis.getFullYear() - rocznik : null;

  const brakWystarczajacychDanych = braki.length >= 3 || (!obsPod.liczbaOcenionych && !liczba(p.minutes));
  const spelniaProfil =
    !!najlepsze && !brakWystarczajacychDanych &&
    najlepsze.niezgodne.length === 0 && najlepsze.brakujace.length === 0 &&
    najlepsze.punkty >= PROG_SPELNIA;

  // Ponowna obserwacja: zawodnik już oceniany, ale obserwacja jest jedna, stara albo skaut sam
  // zapisał „kontynuować" — oraz zawodnik, którego nikt jeszcze nie oglądał, a dane wystarczają.
  const powodyObserwacji = [];
  if (!brakWystarczajacychDanych) {
    if (!obsPod.liczbaObserwacji) powodyObserwacji.push("nie był jeszcze obserwowany");
    else {
      if (obsPod.dniOdOstatniej !== null && obsPod.dniOdOstatniej > DNI_STARA_OBSERWACJA)
        powodyObserwacji.push(`ostatnia obserwacja ${obsPod.dniOdOstatniej} dni temu`);
      if (obsPod.liczbaOcenionych === 1 && najlepsze && najlepsze.punkty >= 60)
        powodyObserwacji.push("obiecujący, ale oceniony tylko raz");
      if (/kontynuowa/i.test(obsPod.ostatniaRekomendacja)) powodyObserwacji.push("skaut zaleca kontynuację obserwacji");
    }
  }
  const wymagaObserwacji = powodyObserwacji.length > 0;

  // Potencjał transferowy: wysoka ocena potencjału (albo bardzo młody i dobrze oceniany) ORAZ
  // sytuacja kontraktowa, która pozwala coś z tym zrobić (umowa na wyczerpaniu, brak umowy,
  // zawodnik wskazany do transferu). Sam talent bez drogi do transferu to nie „potencjał transferowy".
  const wysokiPotencjal =
    (obsPod.potencjalOstatni !== null && obsPod.potencjalOstatni >= POTENCJAL_WYSOKI) ||
    (wiek !== null && wiek <= 19 && obsPod.ocenaSrednia !== null && obsPod.ocenaSrednia >= 4.5);
  const drogaDoTransferu =
    p.status === "Do transferu" ||
    /do transferu/i.test(obsPod.ostatniaRekomendacja) ||
    ext(p).hasContract === false ||
    umowaWygasaWCiaguRoku(p, dzis);
  const potencjalTransferowy = !brakWystarczajacychDanych && wysokiPotencjal && drogaDoTransferu;

  // Ranking: punkty z profilu, a gdy profilu brak — sama średnia ocen przeskalowana do 0–100.
  const wynik = najlepsze ? najlepsze.punkty
    : obsPod.ocenaSrednia !== null ? Math.round((obsPod.ocenaSrednia / 6) * 100) : 0;

  return {
    id: p.id,
    nazwa: `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.id,
    pozycja: p.position || null,
    rocznik,
    klubId: p.club_id || null,
    wynik,
    kryterium: najlepsze ? najlepsze.kryterium : null,
    niezgodne: najlepsze ? najlepsze.niezgodne : [],
    braki,
    ocenaSrednia: obsPod.ocenaSrednia !== null ? Math.round(obsPod.ocenaSrednia * 10) / 10 : null,
    potencjal: obsPod.potencjalOstatni,
    obserwacje: obsPod.liczbaObserwacji,
    spelniaProfil,
    wymagaObserwacji,
    powodyObserwacji,
    potencjalTransferowy,
    brakDanych: brakWystarczajacychDanych,
  };
}

/** Które z zawodników są „nowi": nieznani poprzedniemu przebiegowi. Pierwszy przebieg tylko ustawia punkt odniesienia. */
export function wybierzNowych(zawodnicy, stan, dzisTekst) {
  const znane = new Set((stan && stan.znane) || []);
  if (!stan || !Array.isArray(stan.znane)) {
    // Pierwszy przebieg: nowi to wyłącznie dodani dzisiaj; reszta bazy to tło, nie 400 „nowych".
    return zawodnicy.filter((p) => String(p.date_added || "").slice(0, 10) === dzisTekst);
  }
  return zawodnicy.filter((p) => !znane.has(p.id));
}

const odmiana = (n, jeden, wiele) => (n === 1 ? jeden : wiele);

/** Treść wiadomości na telefon — w formacie, który zamówił właściciel. */
export function zlozWiadomosc(raport) {
  const { nowi, ranking, zBazyDoObserwacji } = raport;
  const n = nowi.length;
  const spelnia = nowi.filter((x) => x.spelniaProfil).length;
  const obs = nowi.filter((x) => x.wymagaObserwacji).length;
  const potencjal = nowi.filter((x) => x.potencjalTransferowy).length;
  const brak = nowi.filter((x) => x.brakDanych).length;

  const linie = ["SBS AI – raport dzienny", ""];
  linie.push(`${n} ${odmiana(n, "nowy zawodnik", "nowych zawodników")}`);
  if (n) {
    if (spelnia) linie.push(`${spelnia} ${odmiana(spelnia, "spełnia profil", "spełniają profil")}`);
    if (obs) linie.push(`${obs} ${odmiana(obs, "wymaga dodatkowej obserwacji", "wymagają dodatkowej obserwacji")}`);
    if (potencjal) linie.push(`${potencjal} ${odmiana(potencjal, "zawodnik", "zawodników")} – wysoki potencjał transferowy`);
    if (brak) linie.push(`${brak} ${odmiana(brak, "zawodnik", "zawodników")} – brak wystarczających danych`);
  }
  if (ranking.length) {
    linie.push("", "Ranking:");
    ranking.slice(0, 3).forEach((x, i) => linie.push(`${i + 1}. ${x.nazwa}${x.pozycja ? ` (${x.pozycja})` : ""} – ${x.wynik} pkt`));
  }
  if (zBazyDoObserwacji > 0) {
    linie.push("", `W bazie: ${zBazyDoObserwacji} ${odmiana(zBazyDoObserwacji, "zawodnik czeka", "zawodników czeka")} na ponowną obserwację`);
  }
  const u = raport.uzupelnienie;
  if (u && (u.uzupelnieni || u.doRecznegoWskazania.length)) {
    linie.push("");
    if (u.uzupelnieni) linie.push(`Uzupełniono dane (Transfermarkt): ${u.uzupelnieni} ${odmiana(u.uzupelnieni, "zawodnik", "zawodników")}`);
    if (u.doRecznegoWskazania.length) {
      linie.push(`Do ręcznego wskazania profilu TM: ${u.doRecznegoWskazania.slice(0, 3).join(", ")}${u.doRecznegoWskazania.length > 3 ? "…" : ""}`);
    }
  }
  if (raport.ostrzezenie) linie.push("", "⚠ " + raport.ostrzezenie);
  return linie.join("\n");
}

/** Cały raport: analiza nowych, ranking, zawodnicy z bazy do ponownej obserwacji. */
export function zbudujRaport({ zawodnicy, obserwacjePoZawodniku, profil, stan, uzupelnienie = null, dzis = new Date() }) {
  const dzisTekst = dzis.toISOString().slice(0, 10);
  const aktywni = zawodnicy.filter((p) => p.status !== "Odrzucony");
  const analizy = new Map(aktywni.map((p) => [p.id, analizujZawodnika(p, obserwacjePoZawodniku.get(p.id) || [], profil, dzis)]));

  const nowiSurowi = wybierzNowych(aktywni, stan, dzisTekst);
  const nowi = nowiSurowi.map((p) => analizy.get(p.id));
  const idNowych = new Set(nowi.map((x) => x.id));

  const ranking = nowi.filter((x) => !x.brakDanych).sort((a, b) => b.wynik - a.wynik);
  const zBazy = [...analizy.values()].filter((x) => x.wymagaObserwacji && !idNowych.has(x.id));
  const rankingBazy = [...analizy.values()].filter((x) => x.spelniaProfil).sort((a, b) => b.wynik - a.wynik).slice(0, 10);

  const raport = {
    data: dzisTekst,
    maProfil: !!(profil && Array.isArray(profil.kryteria) && profil.kryteria.length),
    nowi,
    ranking,
    rankingBazy,
    zBazyDoObserwacji: zBazy.length,
    zBazyLista: zBazy.slice(0, 20),
    uzupelnienie,
    ostrzezenie: "",
  };
  if (!raport.maProfil) {
    raport.ostrzezenie = "Brak profilu poszukiwanego w bazie — nikt nie może spełniać profilu. Dodaj go (patrz AI-PRACOWNIK.md).";
  }
  raport.wiadomosc = zlozWiadomosc(raport);
  return raport;
}
