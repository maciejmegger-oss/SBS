// Statystyki zawodników z 90minut — dla jednego klubu naraz.
//
// PO CO TO JEST: dla III i IV ligi żaden komercyjny dostawca nie sprzedaje danych na poziomie
// zawodnika (sprawdzone kluczem konta, patrz /api/football-check). 90minut je publikuje i robi
// to w zwykłym HTML-u, bez JavaScriptu i bez bramki reCAPTCHA — więc czytamy je z serwera,
// zamiast prosić o kopiowanie stron w przeglądarce.
//
// JAK TO DZIAŁA:
//   1. strona ligi -> odnośniki do rozegranych meczów (krzyżówka wyników),
//   2. mecze wskazanego klubu -> protokoły -> identyfikatory zawodników na 90minut,
//   3. strona zawodnika (wystepy.php) -> GOTOWE sumy sezonowe: występy, minuty, bramki, kartki.
//
// Liczb nie sumujemy samodzielnie — robi to za nas 90minut. Dlatego dwukrotne uruchomienie
// niczego nie podwaja i nie trzeba pilnować, które mecze były już rozliczone.
//
// CZEGO NIE MA: asyst. 90minut ich nie publikuje i nie da się ich stąd wyliczyć — pole asyst
// zostaje nietknięte, żeby nie skasować liczb wpisanych ręcznie.
import {
  ZRODLA_LIG, poziomRozgrywek, pobierzZ90minut, parseLinkiMeczow, parseSkladyMeczu,
  parseWystepyZawodnika, normalizujNazwe,
} from "./_90minut.js";

const BAZA = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KLUCZ_BAZY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const naglowkiBazy = () => ({
  apikey: KLUCZ_BAZY,
  Authorization: "Bearer " + KLUCZ_BAZY,
  "Content-Type": "application/json",
});

const kluczNazwiska = (s) =>
  String(s || "").split(/\s+/).map(normalizujNazwe).filter(Boolean).sort().join(" ");

// 90minut to serwis prowadzony społecznie, nie komercyjne API. Pobieramy najwyżej kilka stron
// naraz i tylko tyle, ile trzeba — zalewanie go zapytaniami byłoby zwyczajnym nadużyciem.
const RÓWNOLEGLE = 4;
const MAKS_MECZOW = 6;

async function porcjami(elementy, ile, praca) {
  const wynik = [];
  for (let i = 0; i < elementy.length; i += ile) {
    wynik.push(...(await Promise.all(elementy.slice(i, i + ile).map(praca))));
  }
  return wynik;
}

// Nazwy klubów po obu stronach bywają zapisane inaczej („Wda Świecie" kontra „KP Wda Świecie"),
// więc dopuszczamy zawieranie — ale dopiero od pięciu znaków, żeby „Wisła" nie sklejała się
// z dowolną inną Wisłą.
function toSamKlub(a, b) {
  const x = normalizujNazwe(a), y = normalizujNazwe(b);
  if (!x || !y) return false;
  return x === y || (x.length >= 5 && y.length >= 5 && (x.includes(y) || y.includes(x)));
}

export default async function handler(req, res) {
  if (!BAZA || !KLUCZ_BAZY) {
    return res.status(500).json({ error: "Brak konfiguracji bazy (SUPABASE_URL / SUPABASE_SERVICE_KEY)." });
  }

  const pierwszy = (v) => (Array.isArray(v) ? v[0] : v) || "";
  const idKlubu = pierwszy(req.query.clubId);
  const zapisz = String(pierwszy(req.query.apply)) === "1";

  if (!idKlubu) return res.status(400).json({ error: "Brak parametru clubId." });

  // --- KLUB Z NASZEJ BAZY ---
  const rK = await fetch(
    `${BAZA}/rest/v1/sbs_clubs?select=id,name,league&id=eq.${encodeURIComponent(idKlubu)}`,
    { headers: naglowkiBazy() }
  );
  if (!rK.ok) return res.status(502).json({ error: "Odczyt klubu: " + rK.status });
  const klub = (await rK.json())[0];
  if (!klub) return res.status(404).json({ error: "Nie ma takiego klubu w bazie." });

  // Kartoteka trzyma pełną nazwę z grupą („IV liga (mazowiecka)"), a adresy są per poziom —
  // stąd sprowadzenie do poziomu. Grupy nie musimy odgadywać: przeszukujemy wszystkie strony
  // danego poziomu i zatrzymujemy się na tej, w której klub faktycznie występuje.
  const poziom = poziomRozgrywek(klub.league);
  const adresy = ZRODLA_LIG[poziom] || [];
  if (!adresy.length) {
    return res.status(400).json({
      error: `Dla rozgrywek „${klub.league || "—"}" nie mam adresu na 90minut.`,
      podpowiedz: `Obsługiwane poziomy: ${Object.keys(ZRODLA_LIG).join(", ")}. Sprawdź pole „Liga" w edycji klubu — rozgrywki młodzieżowe i klasy okręgowe nie są tu obsługiwane.`,
    });
  }

  // --- 1. ZNAJDŹ MECZE KLUBU ---
  // Nazwy drużyn czytamy z podpowiedzi odnośnika, bez rozcinania jej na gospodarzy i gości —
  // nazwy klubów bywają z liczbami („KKS 1925 Kalisz") i każde cięcie po wyniku jest zgadywanką.
  // Do wyboru meczów wystarczy sprawdzić, czy nazwa klubu w podpowiedzi w ogóle występuje.
  const nazwaKlubu = normalizujNazwe(klub.name);
  let mecze = [], stronaLigi = "";
  for (const adres of adresy) {
    let html;
    try { html = await pobierzZ90minut(adres); } catch { continue; }
    const trafione = parseLinkiMeczow(html).filter((m) => normalizujNazwe(m.tytul).includes(nazwaKlubu));
    if (trafione.length) { mecze = trafione; stronaLigi = adres; break; }
  }
  if (!mecze.length) {
    return res.status(404).json({
      error: `Nie znalazłem rozegranych meczów klubu „${klub.name}" w rozgrywkach ${klub.league}.`,
      podpowiedz: "Albo klub jeszcze nie grał w tym sezonie, albo jego nazwa u nas różni się od tej na 90minut.",
      przeszukaneStrony: adresy.length,
    });
  }

  // Bierzemy kilka ostatnich meczów, nie wszystkie. Liczby i tak pochodzą ze stron zawodników
  // (sumy za cały sezon) — protokoły służą wyłącznie do ustalenia, kogo w tym klubie szukać,
  // a kilka spotkań wystarczy, żeby pojawił się cały rotujący skład.
  const wybrane = mecze.slice(-MAKS_MECZOW);

  // --- 2. SKŁADY -> IDENTYFIKATORY ZAWODNIKÓW ---
  const skladyHtml = await porcjami(wybrane, RÓWNOLEGLE, async (m) => {
    try { return { m, html: await pobierzZ90minut(`http://www.90minut.pl/mecz.php?id_mecz=${m.id}`) }; }
    catch (e) { return { m, error: e.message }; }
  });

  const zawodnicy90 = new Map();   // id -> {id, sezon, nazwa, numer}
  let rozgrywkiNagl = "";
  for (const s of skladyHtml) {
    if (s.error) continue;
    const p = parseSkladyMeczu(s.html);
    rozgrywkiNagl = rozgrywkiNagl || p.rozgrywki;
    // Która strona to nasz klub? Rozstrzyga nazwa z samego protokołu, a nie zgadywanie
    // z podpowiedzi odnośnika.
    let nasi = null;
    if (toSamKlub(p.gospodarzeNazwa, klub.name)) nasi = p.gospodarze;
    else if (toSamKlub(p.goscieNazwa, klub.name)) nasi = p.goscie;
    if (!nasi) continue;
    nasi.forEach((z) => { if (!zawodnicy90.has(z.id)) zawodnicy90.set(z.id, z); });
  }

  if (!zawodnicy90.size) {
    return res.status(404).json({
      error: "Znalazłem mecze, ale w żadnym protokole nie rozpoznałem strony tego klubu.",
      podpowiedz: `Na 90minut klub nazywa się inaczej niż u nas („${klub.name}"). Wyrównaj nazwę w edycji klubu.`,
      sprawdzoneMecze: wybrane.map((m) => m.tytul),
    });
  }

  // --- 3. STRONY ZAWODNIKÓW -> SUMY SEZONOWE ---
  const lista = [...zawodnicy90.values()];
  const statystyki = await porcjami(lista, RÓWNOLEGLE, async (z) => {
    const adres = `http://www.90minut.pl/wystepy.php?id=${z.id}` + (z.sezon ? `&id_sezon=${z.sezon}` : "");
    try {
      const dane = parseWystepyZawodnika(await pobierzZ90minut(adres));
      // Wiersz „RAZEM" zlicza ligę razem z pucharem. Chcemy wiersz samych rozgrywek ligowych,
      // a podsumowania używamy tylko wtedy, gdy innego wiersza nie ma.
      const ligowy = dane.sezony.find((s) => !s.podsumowanie && toSamKlub(s.klub, klub.name) && /liga|ekstraklasa/i.test(s.rozgrywki))
        || dane.sezony.find((s) => !s.podsumowanie && toSamKlub(s.klub, klub.name))
        || dane.sezony.find((s) => s.podsumowanie);
      if (!ligowy) return null;
      return { ...z, nazwaPelna: dane.nazwa || z.nazwa, rocznik: dane.rocznik, ...ligowy, adres };
    } catch {
      return null;
    }
  });
  const zeStatystykami = statystyki.filter(Boolean);

  // --- 4. DOPASOWANIE DO NASZEJ BAZY ---
  const rZ = await fetch(
    `${BAZA}/rest/v1/sbs_players?select=id,first_name,last_name,birth_year,matches,minutes,goals,custom_fields&club_id=eq.${encodeURIComponent(idKlubu)}&limit=200`,
    { headers: naglowkiBazy() }
  );
  if (!rZ.ok) return res.status(502).json({ error: "Odczyt zawodników: " + rZ.status });
  const nasiZawodnicy = await rZ.json();

  const wgNazwiska = new Map();
  nasiZawodnicy.forEach((g) => {
    const k = kluczNazwiska(`${g.first_name || ""} ${g.last_name || ""}`);
    if (!k) return;
    if (!wgNazwiska.has(k)) wgNazwiska.set(k, []);
    wgNazwiska.get(k).push(g);
  });

  const doZapisu = [], spozaBazy = [], niejednoznaczni = [];
  for (const z of zeStatystykami) {
    let kandydaci = wgNazwiska.get(kluczNazwiska(z.nazwaPelna)) || [];
    if (!kandydaci.length && z.nazwa) kandydaci = wgNazwiska.get(kluczNazwiska(z.nazwa)) || [];
    if (!kandydaci.length) {
      const slowa = String(z.nazwaPelna || "").split(/\s+/).filter(Boolean);
      const samoNazwisko = slowa.length > 1 ? normalizujNazwe(slowa[slowa.length - 1]) : "";
      if (samoNazwisko.length >= 4) {
        kandydaci = nasiZawodnicy.filter((g) => normalizujNazwe(g.last_name) === samoNazwisko);
      }
    }
    if (!kandydaci.length) { spozaBazy.push({ kto: z.nazwaPelna, rocznik: z.rocznik, minuty: z.minuty, adres: z.adres }); continue; }
    // Przy imiennikach rozstrzyga rocznik — w jednym klubie zdarzają się bracia i kuzyni.
    if (kandydaci.length > 1 && z.rocznik) {
      const wRoczniku = kandydaci.filter((g) => Number(g.birth_year) === Number(z.rocznik));
      if (wRoczniku.length === 1) kandydaci = wRoczniku;
    }
    if (kandydaci.length !== 1) { niejednoznaczni.push(z.nazwaPelna); continue; }
    const g = kandydaci[0];
    const ext = ((g.custom_fields || {}).__ext) || {};
    const bezZmian =
      (g.matches || 0) === z.wystepy && (g.minutes || 0) === z.minuty && (g.goals || 0) === z.gole
      && (ext.yellowCards || 0) === z.zolte && (ext.redCards || 0) === z.czerwone;
    if (bezZmian) continue;
    doZapisu.push({
      id: g.id, kto: `${g.last_name} ${g.first_name}`, ext, custom_fields: g.custom_fields,
      bylo: { mecze: g.matches, minuty: g.minutes, gole: g.goals, zolte: ext.yellowCards, czerwone: ext.redCards },
      bedzie: { mecze: z.wystepy, minuty: z.minuty, gole: z.gole, zolte: z.zolte, czerwone: z.czerwone },
      m90Id: z.id,
    });
  }

  // --- 5. ZAPIS ---
  let zapisani = 0;
  const bledyZapisu = [];
  if (zapisz) {
    const dzis = new Date().toISOString().slice(0, 10);
    // Etykieta sezonu z nagłówka protokołu („... III liga 2026/2027 ..."), a nie z dzisiejszej
    // daty — inaczej pobranie zaległych statystyk w lipcu podpisałoby je złym sezonem.
    const zNaglowka = (rozgrywkiNagl.match(/(\d{4})\/(\d{4})/) || [])[0];
    const rok = new Date().getMonth() + 1 >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const etykietaSezonu = zNaglowka ? `${zNaglowka.slice(0, 4)}/${zNaglowka.slice(7)}` : `${rok}/${String(rok + 1).slice(2)}`;

    for (const p of doZapisu) {
      const sezony = { ...(p.ext.seasonStats || {}) };
      sezony[etykietaSezonu] = {
        mecze: p.bedzie.mecze, minuty: p.bedzie.minuty, gole: p.bedzie.gole,
        zolte: p.bedzie.zolte, czerwone: p.bedzie.czerwone,
        // Asyst nie ruszamy — 90minut ich nie podaje, a wyzerowanie skasowałoby wpisy ręczne.
        asysty: p.ext.assists ?? null,
        zrodlo: "90minut", zarchiwizowano: dzis,
      };
      const ext = {
        ...p.ext,
        yellowCards: p.bedzie.zolte, redCards: p.bedzie.czerwone,
        seasonStats: sezony,
        m90Id: p.m90Id,
        statsUpdatedAt: dzis, statsSource: `90minut (${klub.league})`, statsSeason: etykietaSezonu,
      };
      const r = await fetch(`${BAZA}/rest/v1/sbs_players?id=eq.${encodeURIComponent(p.id)}`, {
        method: "PATCH", headers: naglowkiBazy(),
        body: JSON.stringify({
          matches: p.bedzie.mecze, minutes: p.bedzie.minuty, goals: p.bedzie.gole,
          custom_fields: { ...(p.custom_fields || {}), __ext: ext },
        }),
      });
      if (r.ok) zapisani++;
      else bledyZapisu.push({ kto: p.kto, status: r.status, tresc: (await r.text()).slice(0, 200) });
    }
  }

  return res.status(200).json({
    ok: true,
    trybPodgladu: !zapisz,
    klub: klub.name,
    liga: klub.league,
    rozgrywki: rozgrywkiNagl,
    stronaLigi,
    sprawdzoneMecze: wybrane.length,
    zawodnikowNa90minut: zeStatystykami.length,
    doZapisu: doZapisu.length,
    zapisani,
    zmiany: doZapisu.map((p) => ({
      kto: p.kto,
      bylo: `${p.bylo.mecze ?? "—"} m / ${p.bylo.minuty ?? "—"} min / ${p.bylo.gole ?? "—"} g / ${p.bylo.zolte ?? "—"} ŻK`,
      bedzie: `${p.bedzie.mecze} m / ${p.bedzie.minuty} min / ${p.bedzie.gole} g / ${p.bedzie.zolte} ŻK`,
    })),
    spozaBazy,
    niejednoznaczni,
    bledyZapisu,
    uwaga: "90minut nie publikuje asyst — to pole zostaje bez zmian.",
  });
}
