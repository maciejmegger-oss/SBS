// UZUPEŁNIANIE BRAKUJĄCYCH DANYCH ZAWODNIKA z Transfermarktu — krok 4 dziennego raportu SBS AI.
//
// ZASADY (dlaczego tak ostrożnie)
// Zła data urodzenia albo cudzy wzrost w kartotece są gorsze niż pusta rubryka — pusta rubryka
// widać, a błędna wygląda jak prawdziwa. Dlatego:
//   1. Wpisujemy WYŁĄCZNIE do pustych pól. Niczego, co ktoś już wpisał, nie nadpisujemy.
//   2. Profil na Transfermarkcie musi być PEWNY: albo zawodnik ma już zapisany adres (tm_link),
//      albo wyszukiwanie po nazwisku daje dokładnie jednego kandydata o tym samym imieniu
//      i nazwisku, którego rocznik albo klub zgadza się z kartoteką. Dwóch pasujących — nie
//      wybieramy żadnego, zawodnik trafia na listę „do ręcznego wskazania".
//   3. Każdy wpis ma ślad: custom_fields.__ext.uzupelnienieAI = { data, zrodlo, url, pola }.
//   4. Próba nieudana też jest zapisana (pole `proba`), żeby nie pytać Transfermarktu o tego
//      samego zawodnika codziennie — kolejna próba najwcześniej po DNI_MIEDZY_PROBAMI dniach.
//
// Funkcje tu są czyste albo dostają zależności z zewnątrz (pobieranie, zapis), więc da się je
// testować bez sieci: scripts/test-uzupelnianie.mjs.

import { rozbierzProfil, NAGLOWKI } from "./transfermarkt.js";
import { znajdzKandydatow } from "./tm-szukaj.js";

export const DNI_MIEDZY_PROBAMI = 14;
const MAX_KANDYDATOW = 3;

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[łøđ]/g, (c) => ({ ł: "l", ø: "o", đ: "d" }[c]))
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Imię i nazwisko jako ZBIÓR słów — Transfermarkt pisze „Imię Nazwisko", kartoteka bywa odwrotnie.
const zbiorSlow = (s) => norm(s).split(" ").filter(Boolean).sort().join(" ");

const ext = (p) => (p.custom_fields && p.custom_fields.__ext) || {};
const pusty = (v) => v === null || v === undefined || String(v).trim() === "";
const rokZ = (s) => { const m = String(s || "").match(/(19|20)\d{2}/); return m ? Number(m[0]) : null; };

/** Które pola kartoteki są puste i da się je zasilić z Transfermarktu. */
export function brakiDoUzupelnienia(p) {
  const e = ext(p);
  const braki = [];
  if (pusty(p.position)) braki.push("pozycja");
  if (pusty(p.height)) braki.push("wzrost");
  if (pusty(p.foot)) braki.push("noga");
  if (pusty(p.birth_date) && pusty(p.birth_year)) braki.push("data urodzenia");
  if (pusty(e.nationality) && pusty(p.nationality)) braki.push("narodowość");
  if (pusty(e.contractUntil)) braki.push("koniec umowy");
  if (!e.agentCheckedAt && !p.has_agent) braki.push("menedżer (niesprawdzony)");
  return braki;
}

/** Czy wolno teraz pytać Transfermarkt o tego zawodnika (nie za często). */
export function czyMoznaPytac(p, dzis = new Date()) {
  const proba = ext(p).uzupelnienieAI && ext(p).uzupelnienieAI.proba;
  if (!proba) return true;
  const t = Date.parse(proba);
  return !Number.isFinite(t) || dzis.getTime() - t > DNI_MIEDZY_PROBAMI * 86400000;
}

/**
 * Czy profil z Transfermarktu to ten sam człowiek co w kartotece. Wymaga zgodnego rocznika ALBO
 * klubu — samo podobne nazwisko nie wystarcza. Gdy kartoteka nie ma ani rocznika, ani klubu,
 * nie ma jak tego sprawdzić i odpowiedź brzmi „nie".
 */
export function czyTenSam(p, profil, nazwaKlubu) {
  const rocznik = rokZ(p.birth_year) || rokZ(p.birth_date);
  const rokProfilu = rokZ(profil.dataUrodzenia);
  if (rocznik && rokProfilu) return rocznik === rokProfilu;
  // Rocznik nieznany po jednej ze stron — ratuje zgodny klub.
  if (nazwaKlubu && profil.klub) {
    const a = norm(nazwaKlubu), b = norm(profil.klub);
    return !!a && !!b && (a.includes(b) || b.includes(a));
  }
  return false;
}

/**
 * Pola do wpisania — wyłącznie w puste miejsca. Zwraca { kolumny, ext, pola }; `kolumny` to
 * prawdziwe kolumny sbs_players, `ext` to klucze doklejane do custom_fields.__ext.
 */
export function zbudujPoprawke(p, profil, adresProfilu, dzis = new Date()) {
  const e = ext(p);
  const kolumny = {}, noweExt = {}, pola = [];
  const dzisTekst = dzis.toISOString().slice(0, 10);

  if (pusty(p.position) && profil.pozycja) { kolumny.position = profil.pozycja; pola.push("pozycja"); }
  if (pusty(p.height) && profil.wzrostCm) { kolumny.height = profil.wzrostCm; pola.push("wzrost"); }
  if (pusty(p.foot) && profil.noga) { kolumny.foot = profil.noga; pola.push("noga"); }
  if (pusty(p.birth_date) && /^\d{4}-\d{2}-\d{2}$/.test(profil.dataUrodzenia || "")) {
    kolumny.birth_date = profil.dataUrodzenia; pola.push("data urodzenia");
  }
  if (pusty(p.birth_year) && rokZ(profil.dataUrodzenia)) {
    kolumny.birth_year = String(rokZ(profil.dataUrodzenia));
    if (!pola.includes("data urodzenia")) pola.push("rocznik");
  }
  if (pusty(p.tm_link) && adresProfilu) { kolumny.tm_link = adresProfilu; pola.push("adres Transfermarkt"); }
  if (pusty(e.nationality) && pusty(p.nationality) && profil.narodowosc) {
    noweExt.nationality = profil.narodowosc; pola.push("narodowość");
  }
  if (pusty(e.contractUntil) && /^\d{4}-\d{2}-\d{2}$/.test(profil.umowaDo || "")) {
    noweExt.contractUntil = profil.umowaDo;
    if (e.hasContract === undefined || e.hasContract === null) noweExt.hasContract = true;
    pola.push("koniec umowy");
  }
  // Menedżer: „sprawdzone" zapisujemy zawsze (odróżnia „TM nikogo nie podaje" od „nikt nie patrzył").
  // has_agent zmieniamy tylko z false na true, nigdy w drugą stronę — brak agenta na TM bywa po prostu
  // nieaktualny, a kartoteka może mieć świeższą wiedzę od skauta.
  if (!e.agentCheckedAt) {
    noweExt.agentSource = "Transfermarkt";
    noweExt.agentCheckedAt = dzisTekst;
    if (profil.menadzer && !p.has_agent) {
      kolumny.has_agent = true;
      if (pusty(p.agency_name)) kolumny.agency_name = profil.menadzer;
      pola.push("menedżer");
    }
  }
  if (pola.length) {
    noweExt.uzupelnienieAI = { proba: dzis.toISOString(), wynik: "uzupelniono", data: dzisTekst, zrodlo: "Transfermarkt", url: adresProfilu, pola };
  }
  return { kolumny, ext: noweExt, pola };
}

/**
 * Znajduje pewny profil zawodnika. `pobierz(url)` zwraca HTML (rzuca przy błędzie HTTP).
 * Zwraca { profil, adres } albo { powod } z jednym z: "brak_kandydatow", "niejednoznaczny", "brak_danych_do_porownania".
 */
export async function znajdzProfil(p, nazwaKlubu, pobierz) {
  if (!pusty(p.tm_link)) {
    const html = await pobierz(p.tm_link);
    return { profil: rozbierzProfil(html, p.tm_link), adres: p.tm_link, zAdresu: true };
  }
  const nazwa = `${p.first_name || ""} ${p.last_name || ""}`.trim();
  if (nazwa.length < 3) return { powod: "brak_danych_do_porownania" };
  if (!(rokZ(p.birth_year) || rokZ(p.birth_date)) && !nazwaKlubu) return { powod: "brak_danych_do_porownania" };

  const htmlSzukania = await pobierz("https://www.transfermarkt.pl/schnellsuche/ergebnis/schnellsuche?query=" + encodeURIComponent(nazwa));
  const kandydaci = znajdzKandydatow(htmlSzukania).filter((k) => zbiorSlow(k.nazwa) === zbiorSlow(nazwa)).slice(0, MAX_KANDYDATOW);
  if (!kandydaci.length) return { powod: "brak_kandydatow" };

  const pasujacy = [];
  for (const k of kandydaci) {
    const profil = rozbierzProfil(await pobierz(k.url), k.url);
    if (czyTenSam(p, profil, nazwaKlubu)) pasujacy.push({ profil, adres: k.url });
  }
  if (pasujacy.length === 1) return pasujacy[0];
  return { powod: pasujacy.length ? "niejednoznaczny" : "brak_kandydatow" };
}

/**
 * Główna pętla. Przechodzi po zawodnikach (kolejność: nowi, potem z największą liczbą braków),
 * w granicach limitu i budżetu czasu. `zapisz(p, kolumny, noweExt)` utrwala poprawkę.
 */
export async function uzupelnijZawodnikow({
  zawodnicy, nazwaKlubuPo, idNowych = new Set(), limit = 10, budzetMs = 35000,
  pobierz, zapisz, przerwaMs = 1200, dzis = new Date(), teraz = () => Date.now(),
}) {
  const start = teraz();
  const wynik = { sprawdzeni: 0, uzupelnieni: 0, pola: {}, doRecznegoWskazania: [], bezZmian: 0, bledy: [], przerwanoPoCzasie: false };

  const kolejka = zawodnicy
    .filter((p) => p.status !== "Odrzucony" && brakiDoUzupelnienia(p).length && czyMoznaPytac(p, dzis))
    .sort((a, b) => (idNowych.has(b.id) - idNowych.has(a.id)) || (brakiDoUzupelnienia(b).length - brakiDoUzupelnienia(a).length))
    .slice(0, limit);

  for (const p of kolejka) {
    if (teraz() - start > budzetMs) { wynik.przerwanoPoCzasie = true; break; }
    const nazwa = `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.id;
    wynik.sprawdzeni++;
    try {
      const znaleziono = await znajdzProfil(p, nazwaKlubuPo ? nazwaKlubuPo(p) : "", pobierz);
      if (znaleziono.powod) {
        if (znaleziono.powod === "niejednoznaczny") wynik.doRecznegoWskazania.push(nazwa);
        // Zapisujemy samą próbę, żeby jutro nie pytać znowu.
        await zapisz(p, {}, { uzupelnienieAI: { proba: dzis.toISOString(), wynik: znaleziono.powod } });
        wynik.bezZmian++;
      } else {
        const popr = zbudujPoprawke(p, znaleziono.profil, znaleziono.adres, dzis);
        if (!popr.pola.length && !Object.keys(popr.ext).length) {
          await zapisz(p, {}, { uzupelnienieAI: { proba: dzis.toISOString(), wynik: "nic_nowego" } });
          wynik.bezZmian++;
        } else {
          await zapisz(p, popr.kolumny, popr.ext);
          if (popr.pola.length) {
            wynik.uzupelnieni++;
            popr.pola.forEach((f) => { wynik.pola[f] = (wynik.pola[f] || 0) + 1; });
            // Poprawka ma być widoczna dla dalszej części raportu w tym samym przebiegu.
            Object.assign(p, popr.kolumny);
            p.custom_fields = { ...(p.custom_fields || {}), __ext: { ...ext(p), ...popr.ext } };
          } else wynik.bezZmian++;
        }
      }
    } catch (e) {
      wynik.bledy.push(`${nazwa}: ${String((e && e.message) || e)}`);
      // 403/429 z Transfermarktu = serwis nas ogranicza; dalsze pytania pogłębiłyby problem.
      if (/\b(403|429)\b/.test(String(e && e.message))) break;
    }
    await new Promise((r) => setTimeout(r, przerwaMs));
  }
  return wynik;
}

/** Pobieranie strony jak zwykła przeglądarka (tak samo robią istniejące endpointy TM). */
export async function pobierzStrone(url) {
  const odp = await fetch(url, { headers: NAGLOWKI, signal: AbortSignal.timeout(12000) });
  if (!odp.ok) throw new Error(`Transfermarkt odpowiedział kodem ${odp.status}`);
  return odp.text();
}
