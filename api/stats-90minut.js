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
  parseWystepyZawodnika, normalizujNazwe, minutyZWpisu, toSamKlub, tytulMaKlub,
} from "./_90minut.js";

import { BAZA, KLUCZ_BAZY, naglowkiDlaZadania, maDostepDoBazy, PODPOWIEDZ_BRAK_KLUCZA } from "./_baza.js";

const kluczNazwiska = (s) =>
  String(s || "").split(/\s+/).map(normalizujNazwe).filter(Boolean).sort().join(" ");

// 90minut to serwis prowadzony społecznie, nie komercyjne API. Pobieramy najwyżej kilka stron
// naraz i tylko tyle, ile trzeba — zalewanie go zapytaniami byłoby zwyczajnym nadużyciem.
const RÓWNOLEGLE = 4;
// Protokoły służą do dwóch rzeczy: ustalenia, kogo w tym klubie szukać, oraz zbudowania PRZEBIEGU
// SEZONU zawodnika (ile minut w którym meczu) — a ten ma sens dopiero na dłuższym odcinku, nie na
// sześciu ostatnich kolejkach. Dwadzieścia stron pobieranych czwórkami to pięć przebiegów, czyli
// wciąż kilka sekund i wciąż uprzejme wobec serwisu prowadzonego społecznie.
const MAKS_MECZOW = 20;

async function porcjami(elementy, ile, praca) {
  const wynik = [];
  for (let i = 0; i < elementy.length; i += ile) {
    wynik.push(...(await Promise.all(elementy.slice(i, i + ile).map(praca))));
  }
  return wynik;
}

export default async function handler(req, res) {
  if (!BAZA || !KLUCZ_BAZY) {
    return res.status(500).json({ error: "Brak konfiguracji bazy (SUPABASE_URL / SUPABASE_SERVICE_KEY)." });
  }

  // Kluczem, którym pytamy bazę, rozstrzyga to, kto przysłał żądanie: zalogowany użytkownik
  // pracuje na swoim tokenie (reguły dostępu widzą jego konto), a zadanie cykliczne — na kluczu
  // serwisowym. Ustalamy to raz, na początku, żeby wszystkie zapytania szły tą samą drogą.
  const naglowki = naglowkiDlaZadania(req);

  // --- SZYBKI ZAPIS ---
  //
  // Przeglądarka odsyła gotowy ładunek policzony przy podglądzie, więc tutaj zostaje samo
  // zapisanie: kilka zapytań do bazy zamiast ponownego czytania kilkudziesięciu stron 90minut.
  // Dzięki temu „Zapisz" kończy się w sekundę, a nie po minucie — i nie ryzykuje limitu czasu
  // funkcji, po którym przycisk zostawał w bezruchu.
  const cialo = req.body && typeof req.body === "object" ? req.body : null;
  const pakiet = req.method === "POST" && cialo && Array.isArray(cialo.pakiet) ? cialo.pakiet : null;
  if (pakiet) {
    if (!pakiet.length) return res.status(200).json({ ok: true, zapisani: 0, szybkiZapis: true });
    let zapisaneSzybko = 0;
    const bledySzybkie = [];
    for (let i = 0; i < pakiet.length; i += 8) {
      await Promise.all(pakiet.slice(i, i + 8).map(async (poz) => {
        if (!poz || !poz.id || !poz.dane) return;
        const r = await fetch(`${BAZA}/rest/v1/sbs_players?id=eq.${encodeURIComponent(poz.id)}`, {
          method: "PATCH", headers: naglowki, body: JSON.stringify(poz.dane),
        });
        if (r.ok) zapisaneSzybko++;
        else bledySzybkie.push({ kto: poz.kto || poz.id, status: r.status, tresc: (await r.text()).slice(0, 200) });
      }));
    }
    return res.status(200).json({
      ok: true, szybkiZapis: true, zapisani: zapisaneSzybko, bledyZapisu: bledySzybkie,
    });
  }

  const pierwszy = (v) => (Array.isArray(v) ? v[0] : v) || "";
  const idKlubu = pierwszy(req.query.clubId);
  const zapisz = String(pierwszy(req.query.apply)) === "1";

  if (!idKlubu) return res.status(400).json({ error: "Brak parametru clubId." });

  // --- KLUB Z NASZEJ BAZY ---
  const rK = await fetch(
    `${BAZA}/rest/v1/sbs_clubs?select=id,name,league,profile_lnp&id=eq.${encodeURIComponent(idKlubu)}`,
    { headers: naglowki }
  );
  if (!rK.ok) return res.status(502).json({ error: "Odczyt klubu: " + rK.status });
  const klub = (await rK.json())[0];
  if (!klub) {
    // Pusta odpowiedź ma dwie zupełnie różne przyczyny, a Postgres ich nie rozróżnia: albo klubu
    // faktycznie nie ma, albo reguły dostępu nie oddały wiersza — bo żądanie przyszło bez sesji,
    // a serwer nie ma klucza serwisowego.
    const bezDostepu = !maDostepDoBazy(req);
    return res.status(bezDostepu ? 401 : 404).json({
      error: bezDostepu ? "Serwer nie ma dostępu do bazy." : "Nie ma takiego klubu w bazie.",
      podpowiedz: bezDostepu
        ? "Zaloguj się w aplikacji i spróbuj ponownie. " + PODPOWIEDZ_BRAK_KLUCZA
        : undefined,
    });
  }

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
  // Podpowiedź odnośnika ma postać „Gospodarz - Gość". Każdą stronę porównujemy z nazwą klubu
  // po SŁOWACH (patrz toSamKlub), bo kolejność członów bywa odwrotna: u nas „Raków Częstochowa II",
  // na 90minut „Raków II Częstochowa". Szukanie nazwy jako ciągu znaków dawało w takim przypadku
  // „nie znalazłem rozegranych meczów" przy klubie, który gra i ma protokoły.
  let mecze = [], stronaLigi = "";

  // NAJPIERW PROFIL KLUBU NA 90MINUT, JEŚLI JEST W KARTOTECE.
  //
  // Szukanie po stronach ligi jest zgadywanką po nazwie: wystarczy, że 90minut pisze klub inaczej
  // niż my („GKS Mustang" kontra „Mustang Ostaszewo"), albo że dana grupa ma w tym sezonie inny
  // adres, i przebieg kończy się słowami „nie znalazłem meczów" — choć klub gra. Link do profilu
  // omija cały ten problem: mecze bierzemy wprost ze strony klubu.
  const profil = String(klub.profile_lnp || "").trim();
  if (/90minut\.pl/i.test(profil)) {
    try {
      const html = await pobierzZ90minut(profil);
      const zProfilu = parseLinkiMeczow(html);
      if (zProfilu.length) { mecze = zProfilu; stronaLigi = profil; }
    } catch {
      /* profil nieosiągalny — schodzimy do szukania po stronach ligi */
    }
  }

  for (const adres of mecze.length ? [] : adresy) {
    let html;
    try { html = await pobierzZ90minut(adres); } catch { continue; }
    const trafione = parseLinkiMeczow(html).filter((m) => tytulMaKlub(m.tytul, klub.name));
    if (trafione.length) { mecze = trafione; stronaLigi = adres; break; }
  }
  if (!mecze.length) {
    return res.status(404).json({
      error: `Nie znalazłem rozegranych meczów klubu „${klub.name}" w rozgrywkach ${klub.league}.`,
      podpowiedz: profil
        ? "Sprawdź, czy link do 90minut w edycji klubu prowadzi do strony klubu z listą meczów tego sezonu."
        : "Najpewniejsza droga: otwórz klub na 90minut.pl i wklej jego adres w „Edytuj klub” → pole 90minut. " +
          "Wtedy biorę mecze wprost ze strony klubu, zamiast szukać go po nazwie na stronach ligi — " +
          "a nazwa u nas potrafi się różnić od tej na 90minut. Druga możliwość: klub jeszcze nie grał w tym sezonie.",
      przeszukaneStrony: adresy.length,
    });
  }

  // Bierzemy ostatnie mecze, nie wszystkie. Sumy sezonowe i tak pochodzą ze stron zawodników,
  // a protokoły dokładają dwie rzeczy: skład (kogo szukać) i minuty mecz po meczu na wykres.
  const wybrane = mecze.slice(-MAKS_MECZOW);

  // --- 2. SKŁADY -> IDENTYFIKATORY ZAWODNIKÓW ---
  const skladyHtml = await porcjami(wybrane, RÓWNOLEGLE, async (m) => {
    try { return { m, html: await pobierzZ90minut(`http://www.90minut.pl/mecz.php?id_mecz=${m.id}`) }; }
    catch (e) { return { m, error: e.message }; }
  });

  const zawodnicy90 = new Map();   // id -> {id, sezon, nazwa, numer}
  // PRZEBIEG SEZONU: dla każdego zawodnika lista meczów z liczbą rozegranych minut. To materiał
  // na wykres dostępności w profilu — pełne 90 minut, wejście z ławki i mecz opuszczony wyglądają
  // na nim inaczej, a sama suma minut tego nie pokazuje.
  const przebiegWg90 = new Map();  // id -> Map(idMeczu -> wpis)
  const naszeMecze = [];           // spotkania klubu w kolejności rozegrania
  let rozgrywkiNagl = "";
  for (const s of skladyHtml) {
    if (s.error) continue;
    const p = parseSkladyMeczu(s.html);
    rozgrywkiNagl = rozgrywkiNagl || p.rozgrywki;
    // Która strona to nasz klub? Rozstrzyga nazwa z samego protokołu, a nie zgadywanie
    // z podpowiedzi odnośnika.
    let nasi = null, dom = false;
    if (toSamKlub(p.gospodarzeNazwa, klub.name)) { nasi = p.gospodarze; dom = true; }
    else if (toSamKlub(p.goscieNazwa, klub.name)) { nasi = p.goscie; dom = false; }
    if (!nasi) continue;
    const opis = {
      mecz: s.m.id, data: p.data || "",
      kolejka: Number((p.rozgrywki.match(/Kolejka\s*(\d+)/i) || [])[1]) || null,
      rywal: (dom ? p.goscieNazwa : p.gospodarzeNazwa) || "", dom, wynik: p.wynik || "",
    };
    naszeMecze.push(opis);
    nasi.forEach((z) => {
      if (!zawodnicy90.has(z.id)) zawodnicy90.set(z.id, z);
      if (!przebiegWg90.has(z.id)) przebiegWg90.set(z.id, new Map());
      przebiegWg90.get(z.id).set(opis.mecz, {
        ...opis, minuty: minutyZWpisu(z), odMinuty: z.wszedl, doMinuty: z.zszedl,
        podstawowy: !!z.podstawowy, zolte: z.zolte, czerwone: z.czerwone,
      });
    });
  }

  // Mecz, w którym zawodnika nie było w protokole, też jest informacją — na wykresie to zero.
  // Dlatego każdą listę uzupełniamy o wszystkie spotkania klubu, w kolejności rozegrania.
  const porzadekMeczu = (m) => (m.data || "") + "|" + String(m.kolejka ?? "").padStart(3, "0");
  naszeMecze.sort((a, b) => porzadekMeczu(a).localeCompare(porzadekMeczu(b)));
  for (const [id, wgMeczu] of przebiegWg90) {
    przebiegWg90.set(id, naszeMecze.map((m) => wgMeczu.get(m.mecz)
      || { ...m, minuty: 0, odMinuty: null, doMinuty: null, podstawowy: false, zolte: 0, czerwone: 0 }));
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
    `${BAZA}/rest/v1/sbs_players?select=id,first_name,last_name,birth_year,position,matches,minutes,goals,custom_fields&club_id=eq.${encodeURIComponent(idKlubu)}&limit=200`,
    { headers: naglowki }
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

  const doZapisu = [], spozaBazy = [], niejednoznaczni = [], pominietiGorsze = [];
  for (const z of zeStatystykami) {
    let kandydaci = wgNazwiska.get(kluczNazwiska(z.nazwaPelna)) || [];
    if (!kandydaci.length && z.nazwa) kandydaci = wgNazwiska.get(kluczNazwiska(z.nazwa)) || [];
    if (!kandydaci.length) {
      // DOPASOWANIE PO SAMYM NAZWISKU — potrzebne, gdy imię zapisane jest inaczej po obu stronach
      // („Mateusz" kontra „Mateusz Robert", zdrobnienia, drugie imię).
      //
      // Porównujemy KAŻDY człon nazwy, nie tylko ostatni. 90minut pisze „Nazwisko Imię", nasza
      // baza trzyma „Imię Nazwisko" — branie ostatniego słowa oznaczało szukanie zawodnika
      // o nazwisku „Mateusz" i cichy brak trafienia przy każdym takim wpisie.
      const czlony = String(z.nazwaPelna || "")
        .split(/\s+/).map(normalizujNazwe).filter((w) => w.length >= 4);
      if (czlony.length) {
        kandydaci = nasiZawodnicy.filter((g) => czlony.includes(normalizujNazwe(g.last_name)));
        // Nazwisko bywa czyimś imieniem, więc gdy obie strony znają rocznik i on się nie zgadza,
        // trafienie odrzucamy — lepiej zgłosić „nie znalazłem" niż wpisać komuś cudzy dorobek.
        if (kandydaci.length && z.rocznik) {
          const zgodni = kandydaci.filter((g) => !g.birth_year || Number(g.birth_year) === Number(z.rocznik));
          kandydaci = zgodni;
        }
      }
    }
    if (!kandydaci.length) { spozaBazy.push({ kto: z.nazwaPelna, rocznik: z.rocznik, minuty: z.minuty, adres: z.adres }); continue; }
    // Przy imiennikach rozstrzyga rocznik — w jednym klubie zdarzają się bracia i kuzyni.
    if (kandydaci.length > 1 && z.rocznik) {
      const wRoczniku = kandydaci.filter((g) => Number(g.birth_year) === Number(z.rocznik));
      if (wRoczniku.length === 1) kandydaci = wRoczniku;
    }
    if (kandydaci.length !== 1) {
      // Najczęstsza przyczyna kilku kandydatów to TEN SAM zawodnik zapisany dwa razy — raz
      // z polskimi znakami, raz bez („Głowicki" i „Glowicki"). Mówimy o tym wprost, bo brzmi
      // to inaczej niż imiennicy i wymaga innego działania: usunięcia zdublowanego wpisu.
      const wariantyNazwiska = new Set(kandydaci.map((g) => kluczNazwiska(`${g.first_name} ${g.last_name}`)));
      niejednoznaczni.push({
        kto: z.nazwaPelna,
        powod: wariantyNazwiska.size === 1 ? "ten sam zawodnik jest w bazie kilka razy" : "kilku zawodników o tym nazwisku",
        wBazie: kandydaci.map((g) => `${g.last_name} ${g.first_name}${g.birth_year ? ` (${g.birth_year})` : ""}`),
      });
      continue;
    }
    const g = kandydaci[0];
    const ext = ((g.custom_fields || {}).__ext) || {};

    // NIE OBNIŻAMY danych pochodzących z API-Football.
    //
    // Dla Ekstraklasy płatne API jest źródłem dokładniejszym — liczy doliczony czas, którego
    // 90minut nie podaje. Bez tej blokady kliknięcie „Statystyki z 90minut" na klubie
    // ekstraklasowym cofałoby dorobek: 219 minut na 218, 234 na 233, 262 na 261. Wygląda to
    // niewinnie, a jest cichym psuciem lepszych danych gorszymi.
    const zApiFootball = /API-Football/i.test(ext.statsSource || "");
    const gorszeNizMamy = zApiFootball
      && ((g.minutes || 0) > z.minuty || (g.matches || 0) > z.wystepy || (g.goals || 0) > z.gole);
    if (gorszeNizMamy) {
      pominietiGorsze.push({ kto: `${g.last_name} ${g.first_name}`,
        mamy: `${g.matches} m / ${g.minutes} min`, z90: `${z.wystepy} m / ${z.minuty} min` });
      continue;
    }

    // ROCZNIK. 90minut podaje datę urodzenia na stronie zawodnika, więc wypełniamy nim PUSTE pole
    // — bez rocznika nie da się oznaczyć młodzieżowca, a to jedna z ważniejszych informacji
    // w skautingu. Istniejącego rocznika NIE nadpisujemy: mógł zostać poprawiony ręcznie,
    // a przy sprzeczności wpis człowieka jest bardziej wiarygodny niż odczyt ze strony.
    const brakujeRocznika = !g.birth_year && !!z.rocznik;

    // Przebieg sezonu potrafi się zmienić, choć sumy zostały te same — np. gdy poprzednie
    // pobranie objęło mniej kolejek. Dlatego liczy się do „czy jest co zapisywać".
    const przebieg = przebiegWg90.get(z.id) || [];
    const skrot = (lista) => (lista || []).map((w) => `${w.mecz}:${w.minuty}`).join(",");
    const przebiegBezZmian = skrot(ext.przebieg) === skrot(przebieg);

    const bezZmian =
      (g.matches || 0) === z.wystepy && (g.minutes || 0) === z.minuty && (g.goals || 0) === z.gole
      && (ext.yellowCards || 0) === z.zolte && (ext.redCards || 0) === z.czerwone
      && !brakujeRocznika && przebiegBezZmian;
    if (bezZmian) continue;
    doZapisu.push({
      id: g.id, kto: `${g.last_name} ${g.first_name}`, ext, custom_fields: g.custom_fields,
      rocznik: brakujeRocznika ? z.rocznik : null,
      bylo: { mecze: g.matches, minuty: g.minutes, gole: g.goals, zolte: ext.yellowCards, czerwone: ext.redCards },
      bedzie: { mecze: z.wystepy, minuty: z.minuty, gole: z.gole, zolte: z.zolte, czerwone: z.czerwone },
      m90Id: z.id, przebieg,
    });
  }

  // --- 5. PRZYGOTOWANIE ZAPISU ---
  //
  // Ładunek liczymy ZAWSZE, także w podglądzie — to sama arytmetyka na już pobranych danych,
  // bez ani jednego zapytania do sieci. Podgląd oddaje go przeglądarce, więc „Zapisz" nie musi
  // powtarzać całego pobierania z 90minut (kilkadziesiąt stron) tylko po to, żeby dojść do tych
  // samych liczb. Wcześniej właśnie tak było i zapis trwał tyle samo, co pobieranie.
  let zapisani = 0;
  const zadaniaZapisu = [];
  const bledyZapisu = [];
  {
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
        // Minuty mecz po meczu — źródło wykresu dostępności w profilu i w raporcie PDF.
        // Pustej listy nie zapisujemy, żeby nie skasować wcześniej pobranego przebiegu.
        przebieg: (p.przebieg && p.przebieg.length) ? p.przebieg : p.ext.przebieg,
        przebiegSezon: etykietaSezonu,
        statsUpdatedAt: dzis, statsSource: `90minut (${klub.league})`, statsSeason: etykietaSezonu,
      };
      const doWyslania = {
        matches: p.bedzie.mecze, minutes: p.bedzie.minuty, goals: p.bedzie.gole,
        custom_fields: { ...(p.custom_fields || {}), __ext: ext },
      };
      if (p.rocznik) doWyslania.birth_year = p.rocznik;
      zadaniaZapisu.push({ p, doWyslania });
    }

    // ZAPISY RÓWNOLEGLE, falami po osiem.
    //
    // Wcześniej każdy zawodnik szedł osobnym zapytaniem, jeden po drugim. Przy dwudziestu
    // zawodnikach to dwadzieścia przejść tam i z powrotem doliczonych do czasu, który już zszedł
    // na pobieranie z 90minut — a funkcja w Vercelu ma na wszystko limit czasu. Po jego
    // przekroczeniu przeglądarka nie dostawała odpowiedzi i przycisk zostawał na „Pobieram…",
    // co wyglądało dokładnie jak „nie zapisuje".
    for (let i = 0; zapisz && i < zadaniaZapisu.length; i += 8) {
      await Promise.all(zadaniaZapisu.slice(i, i + 8).map(async ({ p, doWyslania }) => {
        const r = await fetch(`${BAZA}/rest/v1/sbs_players?id=eq.${encodeURIComponent(p.id)}`, {
          method: "PATCH", headers: naglowki, body: JSON.stringify(doWyslania),
        });
        if (r.ok) zapisani++;
        else bledyZapisu.push({ kto: p.kto, status: r.status, tresc: (await r.text()).slice(0, 200) });
      }));
    }
  }

  // KTO ZOSTAŁ BEZ LICZB.
  //
  // Dotąd raport mówił, kogo 90minut ma, a my nie — ale nie odwrotnie. Zawodnik z naszej bazy,
  // którego przebieg w ogóle nie dotknął, przechodził bez śladu: w tabeli miał zera i nie było
  // jak zgadnąć, czy nie grał, czy tylko nie został rozpoznany. Ta lista zamyka tę lukę.
  const dotknieci = new Set(doZapisu.map((p) => p.id));
  const bezDanych = nasiZawodnicy
    .filter((g) => !dotknieci.has(g.id))
    .map((g) => ({
      kto: `${g.last_name || ""} ${g.first_name || ""}`.trim(),
      rocznik: g.birth_year || null,
      mamy: `${g.matches ?? "—"} m / ${g.minutes ?? "—"} min`,
    }));

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
    rocznikiDoUzupelnienia: doZapisu.filter((p) => p.rocznik).length,
    zmiany: doZapisu.map((p) => ({
      kto: p.kto,
      rocznik: p.rocznik || null,
      bylo: `${p.bylo.mecze ?? "—"} m / ${p.bylo.minuty ?? "—"} min / ${p.bylo.gole ?? "—"} g / ${p.bylo.zolte ?? "—"} ŻK`,
      bedzie: `${p.bedzie.mecze} m / ${p.bedzie.minuty} min / ${p.bedzie.gole} g / ${p.bedzie.zolte} ŻK`,
    })),
    spozaBazy,
    niejednoznaczni,
    bezDanych,
    // Gotowe do wysłania z powrotem pod „Zapisz" — patrz ścieżka szybkiego zapisu na górze pliku.
    pakiet: zapisz ? undefined : zadaniaZapisu.map(({ p, doWyslania }) => ({ id: p.id, kto: p.kto, dane: doWyslania })),
    bledyZapisu,
    pominietiGorsze,
    uwaga: "90minut nie publikuje asyst — to pole zostaje bez zmian.",
  });
}
