// NARZĘDZIA ASYSTENTA AI — dziesięć funkcji, którymi agent pracuje w SBS. Wystawia je api/agent.js.
//
// Każde narzędzie ma definicję w formacie `tools` z API Claude (name, description, input_schema),
// więc ta sama lista działa w pętli tool-use, w rutynie Claude Code i w dowolnym innym kliencie.
//
// ZASADY ZAPISU — to, co odróżnia agenta od skauta
//   * Agent NIE tworzy obowiązujących ocen ani raportów. `zaktualizuj_ocene` zapisuje obserwację
//     jako PROPOZYCJĘ (stats_filled_in = false), a aplikacja liczy średnie wyłącznie z obserwacji
//     z wypełnioną oceną — dopóki skaut nie potwierdzi, ocena nie wchodzi do rankingu.
//     `utworz_raport` odkłada raport do skrzynki (sbs_raport_inbox), nie do sbs_reports: tak samo
//     jak robi to dziś każdy zewnętrzny analityk (patrz supabase/migration_…skrzynka_raportow.sql).
//   * `zmien_status_zawodnika` wymaga powodu, a trzy statusy o skutkach poza systemem (Odrzucony,
//     Do transferu, Na Testy) — dodatkowo flagi `potwierdzone_przez_uzytkownika`.
//   * `dodaj_zawodnika` nie założy duplikatu (to samo imię i nazwisko) bez `na_pewno`.
//   * Każdy zapis trafia do dziennika `scouting:ai_dziennik` (ostatnie 500 wpisów): kiedy, jakie
//     narzędzie, na kim, z jakim wynikiem.
//
// Funkcje dostają `ctx = { db, dzis }`, gdzie `db` to małe API (wybierz/wstaw/zmien/kv) — dzięki
// temu testy (scripts/test-agent-narzedzia.mjs) działają na atrapie, bez bazy.

import { analizujZawodnika, KLUCZE_OCEN, KLUCZ_PROFILU } from "./_raport-dzienny.js";

export const STATUSY = ["Do Obserwacji", "Rekomendowany", "Na Testy", "Odrzucony", "Do transferu"];
const STATUSY_WYMAGAJACE_POTWIERDZENIA = new Set(["Odrzucony", "Do transferu", "Na Testy"]);
export const KLUCZ_DZIENNIKA = "scouting:ai_dziennik";
export const KLUCZ_ZADAN = "scouting:zadania_scoutingowe";

const KOLUMNY_KARTY = "id,first_name,last_name,birth_year,birth_date,position,foot,height,status,club_id,minutes,matches,goals,assists,has_agent,agency_name,tm_link,date_added,custom_fields";

const uid = (prefiks) => prefiks + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const e = encodeURIComponent;
// Wartość wstawiana do filtru PostgREST: bez znaków, które zmieniają jego składnię.
const czysta = (s) => String(s ?? "").replace(/[*,()%\\"]/g, " ").replace(/\s+/g, " ").trim();
const ext = (p) => (p.custom_fields && p.custom_fields.__ext) || {};

const karta = (p) => ({
  id: p.id,
  nazwa: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
  rocznik: p.birth_year || (String(p.birth_date || "").slice(0, 4) || null),
  pozycja: p.position || null,
  klub_id: p.club_id || null,
  status: p.status || null,
  noga: p.foot || null,
  wzrost: p.height || null,
  minuty: p.minutes ?? null,
  mecze: p.matches ?? null,
  gole: p.goals ?? null,
  asysty: p.assists ?? ext(p).assists ?? null,
  agent: p.has_agent ? (p.agency_name || "tak") : null,
  koniec_umowy: ext(p).contractUntil || null,
  adres_transfermarkt: p.tm_link || null,
});

async function dziennik(ctx, narzedzie, szczegoly) {
  try {
    const lista = (await ctx.db.kvGet(KLUCZ_DZIENNIKA)) || [];
    lista.push({ czas: new Date().toISOString(), narzedzie, ...szczegoly });
    await ctx.db.kvSet(KLUCZ_DZIENNIKA, lista.slice(-500));
  } catch {
    // Dziennik jest pomocniczy — jego awaria nie może cofać zapisu, który już się udał.
  }
}

async function wczytajZawodnika(ctx, id) {
  const w = await ctx.db.wybierz("sbs_players", `select=${KOLUMNY_KARTY}&id=eq.${e(id)}`);
  return w[0] || null;
}

const blad = (powod, wiecej = {}) => ({ ok: false, powod, ...wiecej });

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ODCZYT
// ─────────────────────────────────────────────────────────────────────────────────────────────

async function pobierz_zawodnika({ id }, ctx) {
  const p = await wczytajZawodnika(ctx, id);
  if (!p) return blad("nie_znaleziono", { id });
  const [obs, raporty, profil] = await Promise.all([
    ctx.db.wybierz("sbs_observations", `select=id,date,match,scout,ratings,recommendation,stats_filled_in,notes&player_id=eq.${e(id)}&order=date.desc&limit=30`),
    ctx.db.wybierz("sbs_reports", `select=id,date,scout,perspektywa,obs_type,description&player_id=eq.${e(id)}&order=date.desc&limit=10`),
    ctx.db.kvGet(KLUCZ_PROFILU),
  ]);
  return {
    ok: true,
    zawodnik: karta(p),
    notatki: p.notes || null,
    obserwacje: obs,
    raporty,
    analiza: analizujZawodnika(p, obs, profil, ctx.dzis),
  };
}

async function pobierz_liste_zawodnikow({ status, klub_id, pozycja, rocznik, limit = 50, offset = 0 }, ctx) {
  const filtry = [];
  if (status) filtry.push(`status=eq.${e(status)}`);
  if (klub_id) filtry.push(`club_id=eq.${e(klub_id)}`);
  if (pozycja) filtry.push(`position=ilike.*${e(czysta(pozycja))}*`);
  if (rocznik) filtry.push(`birth_year=eq.${e(String(rocznik))}`);
  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const wiersze = await ctx.db.wybierz("sbs_players",
    `select=${KOLUMNY_KARTY}${filtry.length ? "&" + filtry.join("&") : ""}&order=last_name.asc&limit=${lim}&offset=${Math.max(parseInt(offset, 10) || 0, 0)}`);
  return { ok: true, liczba: wiersze.length, limit: lim, zawodnicy: wiersze.map(karta) };
}

async function wyszukaj_zawodnika({ fraza, klub_id, rocznik }, ctx) {
  const slowa = czysta(fraza).split(" ").filter((s) => s.length >= 2).slice(0, 4);
  if (!slowa.length) return blad("za_krotka_fraza");
  // Każde słowo musi trafić w imię ALBO nazwisko — „kowalski jan” i „jan kowalski” dają ten sam wynik.
  const warunki = slowa.map((s) => `or(first_name.ilike.*${e(s)}*,last_name.ilike.*${e(s)}*)`);
  const filtry = [`and=(${warunki.join(",")})`];
  if (klub_id) filtry.push(`club_id=eq.${e(klub_id)}`);
  if (rocznik) filtry.push(`birth_year=eq.${e(String(rocznik))}`);
  const wiersze = await ctx.db.wybierz("sbs_players", `select=${KOLUMNY_KARTY}&${filtry.join("&")}&limit=20`);
  return { ok: true, liczba: wiersze.length, zawodnicy: wiersze.map(karta) };
}

async function porownaj_zawodnikow({ ids }, ctx) {
  const unikalne = [...new Set(ids)];
  if (unikalne.length < 2) return blad("potrzeba_co_najmniej_dwoch_roznych_zawodnikow");
  const [wiersze, obsWszystkie, profil] = await Promise.all([
    ctx.db.wybierz("sbs_players", `select=${KOLUMNY_KARTY}&id=in.(${unikalne.map(e).join(",")})`),
    ctx.db.wybierz("sbs_observations", `select=player_id,date,ratings,recommendation,stats_filled_in&player_id=in.(${unikalne.map(e).join(",")})`),
    ctx.db.kvGet(KLUCZ_PROFILU),
  ]);
  const brakujace = unikalne.filter((id) => !wiersze.some((p) => p.id === id));
  const zestawienie = wiersze.map((p) => {
    const a = analizujZawodnika(p, obsWszystkie.filter((o) => o.player_id === p.id), profil, ctx.dzis);
    return { ...karta(p), wynik: a.wynik, srednia_ocen: a.ocenaSrednia, potencjal: a.potencjal, obserwacje: a.obserwacje,
      spelnia_profil: a.spelniaProfil, brak_danych: a.brakDanych, braki: a.braki, niezgodne_z_profilem: a.niezgodne };
  }).sort((a, b) => b.wynik - a.wynik);
  // „Rzetelny" = dość danych ORAZ co najmniej jedna potwierdzona ocena z obserwacji. Bez ocen wynik
  // zależy od samej kompletności karty, więc kolejność nic nie mówi o jakości zawodnika.
  const rzetelne = zestawienie.filter((z) => !z.brak_danych && z.srednia_ocen !== null);
  const wskazany = rzetelne.length >= 2 && rzetelne[0].wynik > rzetelne[1].wynik ? rzetelne[0].id : null;
  return {
    ok: true,
    zestawienie,
    najlepszy: wskazany,
    uwaga: wskazany ? undefined
      : rzetelne.length < 2 ? "Nie wskazuję lepszego: co najmniej dwóch zawodników musi mieć dość danych i potwierdzone oceny z obserwacji (patrz `braki`)."
      : "Nie wskazuję lepszego: wyniki są równe.",
    nie_znaleziono: brakujace,
    profil_klubu_ustawiony: !!(profil && profil.kryteria && profil.kryteria.length),
  };
}

function czesciMeczu(m) { return [m.homeTeam, m.awayTeam].filter(Boolean); }

async function pobierz_dane_meczu({ id, druzyna, data }, ctx) {
  const wszystkie = (await ctx.db.kvGet("scouting:matches")) || [];
  const fraza = druzyna ? czysta(druzyna).toLowerCase() : "";
  const trafione = wszystkie.filter((m) =>
    (!id || m.id === id) &&
    (!data || String(m.date || "").slice(0, 10) === data) &&
    (!fraza || czesciMeczu(m).some((t) => String(t).toLowerCase().includes(fraza))),
  ).slice(0, 5);
  if (!id && !druzyna && !data) return blad("podaj_id_druzyne_lub_date");
  const wynik = [];
  for (const m of trafione) {
    const [gospodarz, gosc] = czesciMeczu(m);
    // Obserwacje opisują mecz tekstem („Gospodarz - Gość”), nie identyfikatorem — szukamy po nazwie.
    const obs = gospodarz
      ? await ctx.db.wybierz("sbs_observations",
        `select=player_id,date,match,scout,ratings,stats_filled_in&match=ilike.*${e(czysta(gospodarz))}*&date=eq.${e(String(m.date || "").slice(0, 10))}&limit=50`)
      : [];
    wynik.push({ mecz: m, obserwacje: obs.filter((o) => !gosc || String(o.match || "").toLowerCase().includes(czysta(gosc).toLowerCase())) });
  }
  return { ok: true, liczba: wynik.length, mecze: wynik };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ZAPIS
// ─────────────────────────────────────────────────────────────────────────────────────────────

async function dodaj_zawodnika(a, ctx) {
  const imie = czysta(a.imie), nazwisko = czysta(a.nazwisko);
  if (!imie || !nazwisko) return blad("brak_imienia_lub_nazwiska");
  if (!a.na_pewno) {
    const duble = await ctx.db.wybierz("sbs_players", `select=${KOLUMNY_KARTY}&first_name=ilike.${e(imie)}&last_name=ilike.${e(nazwisko)}&limit=5`);
    if (duble.length) {
      return blad("mozliwy_duplikat", {
        podpowiedz: "Jeśli to inna osoba, wywołaj ponownie z na_pewno: true.",
        istniejacy: duble.map(karta),
      });
    }
  }
  const dzis = ctx.dzis.toISOString().slice(0, 10);
  const wiersz = {
    id: uid("p"),
    first_name: imie, last_name: nazwisko,
    birth_year: a.rocznik ? String(a.rocznik) : null,
    birth_date: a.data_urodzenia || null,
    position: a.pozycja || null, foot: a.noga || null, height: a.wzrost || null,
    club_id: a.klub_id || null, tm_link: a.link_transfermarkt || null,
    status: "Do Obserwacji", scout: "SBS AI", source: "SBS AI", date_added: dzis,
    notes: a.uwagi ? `[SBS AI ${dzis}] ${czysta(a.uwagi)}` : null,
  };
  const [zapisany] = await ctx.db.wstaw("sbs_players", wiersz);
  await dziennik(ctx, "dodaj_zawodnika", { zawodnik_id: wiersz.id, nazwa: `${imie} ${nazwisko}` });
  return { ok: true, zawodnik: karta(zapisany || wiersz) };
}

async function zaktualizuj_ocene(a, ctx) {
  const ratings = {};
  for (const k of KLUCZE_OCEN) if (a[k] !== undefined) ratings[k] = a[k];
  if (!Object.keys(ratings).length) return blad("podaj_co_najmniej_jedna_ocene", { dozwolone: KLUCZE_OCEN });
  if (!czysta(a.uzasadnienie)) return blad("brak_uzasadnienia", { podpowiedz: "Ocena bez uzasadnienia (skąd wynika, z jakiego meczu/danych) nie jest przyjmowana." });
  const p = await wczytajZawodnika(ctx, a.zawodnik_id);
  if (!p) return blad("nie_znaleziono", { id: a.zawodnik_id });
  const dzis = ctx.dzis.toISOString().slice(0, 10);
  const wiersz = {
    id: uid("o"), player_id: p.id, date: dzis, match: a.mecz || null, scout: "SBS AI",
    ratings, recommendation: "",
    notes: `[SBS AI – PROPOZYCJA do potwierdzenia przez skauta] ${czysta(a.uzasadnienie)}`,
    // false = aplikacja nie liczy tej oceny do średnich i rankingu, dopóki skaut jej nie potwierdzi.
    stats_filled_in: false,
  };
  await ctx.db.wstaw("sbs_observations", wiersz);
  await dziennik(ctx, "zaktualizuj_ocene", { zawodnik_id: p.id, obserwacja_id: wiersz.id, oceny: ratings });
  return { ok: true, obserwacja_id: wiersz.id, oceny: ratings, uwaga: "Zapisano jako propozycję — nie wpływa na średnie, dopóki skaut nie potwierdzi." };
}

async function utworz_raport(a, ctx) {
  const p = await wczytajZawodnika(ctx, a.zawodnik_id);
  if (!p) return blad("nie_znaleziono", { id: a.zawodnik_id });
  const dzis = ctx.dzis.toISOString().slice(0, 10);
  const dane = {
    date: dzis, scout: "SBS AI", obsType: a.typ_obserwacji || "analiza danych",
    rywal: a.rywal || "", wynik: a.wynik || "",
    description: a.opis || "", technika: a.technika || "", taktyka: a.taktyka || "", motoryka: a.motoryka || "",
    mentalnoscOpis: a.mentalnosc || "", potencjalOpis: a.potencjal || "", perspektywa: a.perspektywa || "",
  };
  const wiersz = {
    id: uid("r"), zrodlo: "SBS AI", player_id: p.id,
    zawodnik: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
    tytul: a.tytul, dane, status: "nowy",
  };
  await ctx.db.wstaw("sbs_raport_inbox", wiersz);
  await dziennik(ctx, "utworz_raport", { zawodnik_id: p.id, raport_id: wiersz.id, tytul: a.tytul });
  return { ok: true, raport_id: wiersz.id, gdzie: "skrzynka raportów (zakładka Raporty) — czeka na przejrzenie przez skauta" };
}

async function ustaw_zadanie_scoutingowe(a, ctx) {
  const lista = (await ctx.db.kvGet(KLUCZ_ZADAN)) || [];
  const teraz = ctx.dzis.toISOString();
  if (a.id) {
    const z = lista.find((x) => x.id === a.id);
    if (!z) return blad("nie_znaleziono_zadania", { id: a.id });
    for (const k of ["opis", "termin", "priorytet", "przypisany", "status", "mecz"]) if (a[k] !== undefined) z[k] = a[k];
    z.zmieniono = teraz;
    await ctx.db.kvSet(KLUCZ_ZADAN, lista);
    await dziennik(ctx, "ustaw_zadanie_scoutingowe", { zadanie_id: z.id, zmiana: true });
    return { ok: true, zadanie: z };
  }
  if (!czysta(a.opis)) return blad("brak_opisu");
  const zadanie = {
    id: uid("z"), utworzono: teraz, zrodlo: "SBS AI", status: "otwarte",
    opis: czysta(a.opis), zawodnik_id: a.zawodnik_id || null, mecz: a.mecz || null,
    termin: a.termin || null, priorytet: a.priorytet || "normalny", przypisany: a.przypisany || null,
  };
  lista.push(zadanie);
  await ctx.db.kvSet(KLUCZ_ZADAN, lista.slice(-300));
  await dziennik(ctx, "ustaw_zadanie_scoutingowe", { zadanie_id: zadanie.id, zawodnik_id: zadanie.zawodnik_id });
  return { ok: true, zadanie };
}

async function zmien_status_zawodnika(a, ctx) {
  if (!STATUSY.includes(a.status)) return blad("nieznany_status", { dozwolone: STATUSY });
  if (!czysta(a.powod)) return blad("brak_powodu");
  if (STATUSY_WYMAGAJACE_POTWIERDZENIA.has(a.status) && a.potwierdzone_przez_uzytkownika !== true) {
    return blad("wymaga_potwierdzenia_uzytkownika", {
      podpowiedz: `Status „${a.status}” ma skutki poza systemem. Zapytaj użytkownika i dopiero po jego zgodzie wywołaj ponownie z potwierdzone_przez_uzytkownika: true.`,
    });
  }
  const p = await wczytajZawodnika(ctx, a.zawodnik_id);
  if (!p) return blad("nie_znaleziono", { id: a.zawodnik_id });
  if (p.status === a.status) return { ok: true, bez_zmian: true, status: p.status };
  const dzis = ctx.dzis.toISOString().slice(0, 10);
  const wpis = `[SBS AI ${dzis}] status: ${p.status || "—"} → ${a.status}. ${czysta(a.powod)}`;
  await ctx.db.zmien("sbs_players", `id=eq.${e(p.id)}`, { status: a.status, notes: p.notes ? `${p.notes}\n${wpis}` : wpis });
  await dziennik(ctx, "zmien_status_zawodnika", { zawodnik_id: p.id, z: p.status || null, na: a.status, powod: czysta(a.powod) });
  return { ok: true, poprzedni_status: p.status || null, status: a.status };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// DEFINICJE (format `tools` API Claude)
// ─────────────────────────────────────────────────────────────────────────────────────────────

const tekst = (opis) => ({ type: "string", description: opis });
const OCENA = (nazwa) => ({ type: "integer", minimum: 1, maximum: 6, description: `${nazwa} w skali 1–6` });

export const NARZEDZIA = [
  { name: "pobierz_zawodnika", zapis: false, wykonaj: pobierz_zawodnika,
    description: "Pełna kartoteka jednego zawodnika: dane, obserwacje, raporty oraz analiza względem profilu poszukiwanego przez klub (wynik 0–100, braki w danych, czy spełnia profil, czy wymaga ponownej obserwacji).",
    input_schema: { type: "object", required: ["id"], properties: { id: tekst("Identyfikator zawodnika w SBS") } } },
  { name: "pobierz_liste_zawodnikow", zapis: false, wykonaj: pobierz_liste_zawodnikow,
    description: "Lista zawodników z opcjonalnymi filtrami. Zwraca skrócone karty (maks. 100 na stronę), posortowane po nazwisku.",
    input_schema: { type: "object", properties: {
      status: { type: "string", enum: STATUSY }, klub_id: tekst("Identyfikator klubu"),
      pozycja: tekst("Fragment nazwy pozycji, np. „środkowy”"), rocznik: { type: "integer", minimum: 1980, maximum: 2020 },
      limit: { type: "integer", minimum: 1, maximum: 100 }, offset: { type: "integer", minimum: 0 } } } },
  { name: "dodaj_zawodnika", zapis: true, wykonaj: dodaj_zawodnika,
    description: "Zakłada nowego zawodnika w kartotece (status „Do Obserwacji”, autor „SBS AI”). Odmawia, gdy istnieje zawodnik o tym samym imieniu i nazwisku — wtedy pokaż go użytkownikowi, a ponownie wywołaj z na_pewno: true tylko jeśli to ktoś inny.",
    input_schema: { type: "object", required: ["imie", "nazwisko"], properties: {
      imie: tekst("Imię"), nazwisko: tekst("Nazwisko"), rocznik: { type: "integer", minimum: 1980, maximum: 2020 },
      data_urodzenia: tekst("RRRR-MM-DD"), pozycja: tekst("Pozycja wg nazewnictwa SBS"), noga: { type: "string", enum: ["Prawa", "Lewa", "Obie"] },
      wzrost: { type: "integer", minimum: 140, maximum: 220 }, klub_id: tekst("Identyfikator klubu"),
      link_transfermarkt: tekst("Adres profilu na Transfermarkt"), uwagi: tekst("Skąd zawodnik się wziął, co o nim wiadomo"),
      na_pewno: { type: "boolean", description: "Załóż mimo możliwego duplikatu" } } } },
  { name: "zaktualizuj_ocene", zapis: true, wykonaj: zaktualizuj_ocene,
    description: "Zapisuje PROPOZYCJĘ oceny zawodnika (skala 1–6: technika, taktyka, motoryka, mentalnosc, potencjal). Wymaga uzasadnienia. Propozycja nie wchodzi do średnich i rankingu, dopóki skaut jej nie potwierdzi. Nie wolno wpisywać ocen za zagrania, których nikt nie opisał ani nie zmierzył.",
    input_schema: { type: "object", required: ["zawodnik_id", "uzasadnienie"], properties: {
      zawodnik_id: tekst("Identyfikator zawodnika"), technika: OCENA("Technika"), taktyka: OCENA("Taktyka"), motoryka: OCENA("Motoryka"),
      mentalnosc: OCENA("Mentalność"), potencjal: OCENA("Potencjał"), mecz: tekst("Mecz, którego dotyczy (opcjonalnie)"),
      uzasadnienie: tekst("Na jakich danych opiera się ocena") } } },
  { name: "porownaj_zawodnikow", zapis: false, wykonaj: porownaj_zawodnikow,
    description: "Zestawia 2–5 zawodników: wynik względem profilu klubu, średnia ocen, potencjał, liczba obserwacji, braki. Wskazuje lepszego tylko wtedy, gdy o co najmniej dwóch jest dość danych.",
    input_schema: { type: "object", required: ["ids"], properties: { ids: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } } } } },
  { name: "wyszukaj_zawodnika", zapis: false, wykonaj: wyszukaj_zawodnika,
    description: "Szuka zawodników po fragmencie imienia i nazwiska (kolejność słów bez znaczenia, bez względu na wielkość liter). Zwraca do 20 kart.",
    input_schema: { type: "object", required: ["fraza"], properties: {
      fraza: tekst("Np. „kowalski jan” albo „kowal”"), klub_id: tekst("Zawęź do klubu"), rocznik: { type: "integer", minimum: 1980, maximum: 2020 } } } },
  { name: "utworz_raport", zapis: true, wykonaj: utworz_raport,
    description: "Odkłada raport o zawodniku do SKRZYNKI RAPORTÓW (autor „SBS AI”). Skaut przegląda go w zakładce Raporty i zapisuje albo odrzuca — do kartoteki sam z siebie nie trafia. Pisz wyłącznie o tym, co wynika z danych, które masz; nie opisuj zagrań z meczu, którego nikt nie obejrzał.",
    input_schema: { type: "object", required: ["zawodnik_id", "tytul"], properties: {
      zawodnik_id: tekst("Identyfikator zawodnika"), tytul: tekst("Tytuł wpisu w skrzynce"), opis: tekst("Opis ogólny"),
      technika: tekst("Technika — opis"), taktyka: tekst("Taktyka — opis"), motoryka: tekst("Motoryka — opis"),
      mentalnosc: tekst("Mentalność — opis"), potencjal: tekst("Potencjał — opis"), perspektywa: tekst("Perspektywa zawodnika"),
      rywal: tekst("Rywal"), wynik: tekst("Wynik meczu"), typ_obserwacji: tekst("Rodzaj obserwacji, domyślnie „analiza danych”") } } },
  { name: "pobierz_dane_meczu", zapis: false, wykonaj: pobierz_dane_meczu,
    description: "Dane meczu z terminarza (po id, nazwie drużyny albo dacie RRRR-MM-DD) wraz z obserwacjami zapisanymi do tego meczu. Wymaga co najmniej jednego kryterium.",
    input_schema: { type: "object", properties: { id: tekst("Identyfikator meczu"), druzyna: tekst("Fragment nazwy gospodarza lub gościa"), data: tekst("RRRR-MM-DD") } } },
  { name: "ustaw_zadanie_scoutingowe", zapis: true, wykonaj: ustaw_zadanie_scoutingowe,
    description: "Tworzy zadanie dla skauta (np. „Obejrzeć X w sobotę”) albo, gdy podasz id, zmienia istniejące (status: otwarte / w_toku / zrobione / anulowane, termin, przypisany).",
    input_schema: { type: "object", properties: {
      id: tekst("Identyfikator istniejącego zadania — do aktualizacji"), opis: tekst("Co ma być zrobione (wymagane przy tworzeniu)"),
      zawodnik_id: tekst("Zawodnik, którego dotyczy"), mecz: tekst("Mecz, którego dotyczy"), termin: tekst("RRRR-MM-DD"),
      priorytet: { type: "string", enum: ["niski", "normalny", "wysoki"] }, przypisany: tekst("Skaut"),
      status: { type: "string", enum: ["otwarte", "w_toku", "zrobione", "anulowane"] } } } },
  { name: "zmien_status_zawodnika", zapis: true, wykonaj: zmien_status_zawodnika,
    description: `Zmienia status zawodnika (${STATUSY.join(", ")}) i dopisuje powód do notatek. „Odrzucony”, „Do transferu” i „Na Testy” wymagają wcześniejszej zgody użytkownika — dopiero wtedy ustaw potwierdzone_przez_uzytkownika: true. Nigdy nie ustawiaj tej flagi z własnej inicjatywy.`,
    input_schema: { type: "object", required: ["zawodnik_id", "status", "powod"], properties: {
      zawodnik_id: tekst("Identyfikator zawodnika"), status: { type: "string", enum: STATUSY }, powod: tekst("Dlaczego zmieniasz status"),
      potwierdzone_przez_uzytkownika: { type: "boolean", description: "true tylko, gdy użytkownik wprost się zgodził" } } } },
];

/** Definicje w kształcie, jaki przyjmuje parametr `tools` API Claude (bez pól wewnętrznych). */
export const definicje = () => NARZEDZIA.map(({ name, description, input_schema }) => ({ name, description, input_schema }));

// Minimalny walidator schematu (required, typ, enum, zakres, tablice) — wystarcza do tych definicji
// i nie wymaga zewnętrznej biblioteki w funkcji serwerowej.
export function sprawdzArgumenty(schemat, args) {
  const bledy = [];
  if (args === null || typeof args !== "object" || Array.isArray(args)) return ["argumenty muszą być obiektem"];
  for (const k of schemat.required || []) if (args[k] === undefined || args[k] === null || args[k] === "") bledy.push(`brak wymaganego pola: ${k}`);
  for (const [k, def] of Object.entries(schemat.properties || {})) {
    const v = args[k];
    if (v === undefined) continue;
    if (def.type === "string" && typeof v !== "string") bledy.push(`${k}: oczekiwano tekstu`);
    else if (def.type === "integer" && !Number.isInteger(v)) bledy.push(`${k}: oczekiwano liczby całkowitej`);
    else if (def.type === "boolean" && typeof v !== "boolean") bledy.push(`${k}: oczekiwano true/false`);
    else if (def.type === "array" && !Array.isArray(v)) bledy.push(`${k}: oczekiwano listy`);
    if (def.enum && !def.enum.includes(v)) bledy.push(`${k}: dozwolone wartości: ${def.enum.join(", ")}`);
    if (typeof v === "number" && def.minimum !== undefined && v < def.minimum) bledy.push(`${k}: minimum ${def.minimum}`);
    if (typeof v === "number" && def.maximum !== undefined && v > def.maximum) bledy.push(`${k}: maksimum ${def.maximum}`);
    if (Array.isArray(v)) {
      if (def.minItems && v.length < def.minItems) bledy.push(`${k}: co najmniej ${def.minItems} elementy`);
      if (def.maxItems && v.length > def.maxItems) bledy.push(`${k}: najwyżej ${def.maxItems} elementów`);
    }
    if (typeof v === "string" && v.length > 4000) bledy.push(`${k}: za długi tekst`);
  }
  return bledy;
}

/** Wywołanie narzędzia po nazwie. `tylkoOdczyt` blokuje narzędzia zapisujące. */
export async function wykonaj(nazwa, args, ctx, { tylkoOdczyt = false } = {}) {
  const n = NARZEDZIA.find((x) => x.name === nazwa);
  if (!n) return { ok: false, powod: "nieznane_narzedzie", dostepne: NARZEDZIA.map((x) => x.name) };
  if (n.zapis && tylkoOdczyt) return { ok: false, powod: "token_tylko_do_odczytu" };
  const bledy = sprawdzArgumenty(n.input_schema, args);
  if (bledy.length) return { ok: false, powod: "bledne_argumenty", bledy };
  return n.wykonaj(args, ctx);
}
