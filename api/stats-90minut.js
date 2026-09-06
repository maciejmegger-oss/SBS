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
  parseWystepyZawodnika, normalizujNazwe, minutyZWpisu, toSamKlub, tytulMaKlub, czlonyKlubu,
  parseKlubyZTabeli, parseSchedule, parseKadraKlubu,
} from "./_90minut.js";
import { czyLnp, pobierzLnp, parseProtokolLnp, protokolZDanychStrony, zbadajSkryptyStrony, opiszZawartosc } from "./_lnp.js";

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
// Ile protokołów wolno otworzyć „na ślepo", gdy strona ligi nie chce zdradzić, które mecze są
// czyje. Dwie kolejki osiemnastozespołowej grupy to osiemnaście spotkań — tyle wystarczy,
// żeby znaleźć te dwa nasze, a przy dłuższym sezonie i tak liczą się ostatnie kolejki.
const MAKS_MECZOW_DO_PRZESZUKANIA = 40;

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
  // Nazwy drużyn napotkane na przeszukiwanych stronach — materiał do komunikatu, gdy klubu nie ma.
  const widzianeNazwy = new Set();
  const bledyStron = [];

  // NAJPIERW PROFIL KLUBU NA 90MINUT, JEŚLI JEST W KARTOTECE.
  //
  // Szukanie po stronach ligi jest zgadywanką po nazwie: wystarczy, że 90minut pisze klub inaczej
  // niż my („GKS Mustang" kontra „Mustang Ostaszewo"), albo że dana grupa ma w tym sezonie inny
  // adres, i przebieg kończy się słowami „nie znalazłem meczów" — choć klub gra. Link do profilu
  // omija cały ten problem: mecze bierzemy wprost ze strony klubu.
  // SKRÓT NIE MOŻE PRZESŁANIAĆ PEŁNEGO ŹRÓDŁA.
  //
  // Dotąd było tak: jeśli strona klubu wymieniła choć jeden mecz, terminarz ligi nie był już
  // w ogóle czytany. Gdy więc strona klubu pokazywała dwa spotkania, a rozegrano pięć, dorobek
  // zamarzał na dwóch kolejkach i żadne kolejne odświeżenie tego nie ruszało — bo za każdym razem
  // program zatrzymywał się na tym samym, uboższym źródle. Dlatego teraz czytamy OBA i bierzemy
  // pełniejsze; skrót nadal ratuje sytuację, gdy klubu nie da się znaleźć w tabeli po nazwie.
  let meczeZProfilu = [];
  const profil = String(klub.profile_lnp || "").trim();
  if (/90minut\.pl/i.test(profil)) {
    try {
      const html = await pobierzZ90minut(profil);
      meczeZProfilu = parseLinkiMeczow(html);
    } catch {
      /* profil nieosiągalny — zostaje szukanie po stronach ligi */
    }
  }

  // KLUBU SZUKAMY W TABELI, NIE W PODPOWIEDZIACH ODNOŚNIKÓW.
  //
  // Poprzednia droga sprawdzała, czy nazwa klubu stoi w podpowiedzi odnośnika do meczu
  // („Gospodarz - Gość"). Okazała się dziurawa: w jednej grupie III ligi osiem klubów na osiemnaście
  // wypadało z przebiegu, choć wszystkie grają i stoją w tabeli — po prostu ich mecze nie mają tej
  // podpowiedzi. Tabela ligowa jest pewna: każdy klub ma tam pełną nazwę i odnośnik do własnej
  // strony. Znajdujemy więc klub w tabeli, a mecze czytamy wprost z jego strony.
  let adresKlubuNa90minut = "";
  let wTabeliRozgrywek = null;
  let zProtokolowWprost = false;
  let zTerminarzaRozpoznane = 0;
  let zLnpOdczytane = 0;
  const protokolyBezSkladu = [];
  for (const adres of adresy) {
    let html;
    // NIEUDANE POBRANIE STRONY TO NIE JEST „BRAK MECZÓW".
    //
    // Odrzucone połączenie (429/403 przy większym ruchu, urwany transfer) było dotąd połykane
    // w ciszy, a klub kończył przebieg komunikatem „nie znalazłem rozegranych meczów" — czyli
    // kłamstwem, bo mecze są, tylko strona nie odpowiedziała. Zapisujemy więc każdy taki błąd
    // i mówimy o nim wprost, bo działanie jest inne: nie poprawiać nazwę, tylko spróbować ponownie.
    try { html = await pobierzZ90minut(adres); }
    catch (e) { bledyStron.push({ adres, blad: String((e && e.message) || e) }); continue; }

    const wTabeli = parseKlubyZTabeli(html);
    wTabeli.forEach((k) => widzianeNazwy.add(k.nazwa));
    const nasz = wTabeli.find((k) => toSamKlub(k.nazwa, klub.name));
    if (nasz) {
      // Klub STOI W TABELI tych rozgrywek — to już rozstrzyga, że liga w kartotece jest dobra
      // i że nazwa się zgadza. Adres jego strony zapamiętujemy niezależnie od tego, czy są tam
      // już jakieś mecze: rozgrywki juniorskie startują później niż seniorskie, a link i tak
      // przyda się przy następnym pobraniu.
      const adresKlubu = `http://www.90minut.pl/skarb.php?id_klub=${nasz.id}` + (nasz.sezon ? `&id_sezon=${nasz.sezon}` : "");
      wTabeliRozgrywek = { nazwa: nasz.nazwa, adres: adresKlubu, stronaLigi: adres };
      adresKlubuNa90minut = adresKlubu;
    }

    // MECZE BIERZEMY Z TERMINARZA, A NIE Z PODPOWIEDZI ODNOŚNIKÓW ANI ZE STRONY KLUBU.
    //
    // W terminarzu obie nazwy drużyn stoją jako ZWYKŁY TEKST w komórkach wiersza, a w tym samym
    // wierszu jest wynik i odnośnik do protokołu. To jedyne miejsce na stronie, które wiąże mecz
    // z klubem niezależnie od tego, czy odnośnik ma podpowiedź (często nie ma) i czy strona klubu
    // wymienia mecze (bywa, że nie wymienia — cała IV liga pomorska pokazywała wtedy „nie ma
    // jeszcze rozegranych meczów", choć kluby miały za sobą kolejkę).
    const terminarz = parseSchedule(html);
    const nasze = terminarz
      .filter((m) => m.rozegrany && (toSamKlub(m.homeTeam, klub.name) || toSamKlub(m.awayTeam, klub.name)));

    // ROZGRYWKI BEZ PROTOKOŁÓW — POWIEDZ TO WPROST, ZAMIAST UDAWAĆ BRAK MECZÓW.
    //
    // Centralna Liga Juniorów ma na 90minut komplet terminarza i wyników, ale ANI JEDNEGO
    // protokołu: przy 240 spotkaniach zero odnośników „mecz.php", a strona klubu podaje tylko
    // historię rozgrywek, bez składu. Nie ma więc skąd wziąć minut. Dotąd wychodziło z tego
    // „brak meczów tego klubu" razem z radą, żeby wyrównać nazwę — a nazwa była poprawna
    // i poprawianie jej nic nie mogło dać.
    if (nasze.length && !html.includes("mecz.php?id_mecz=")) {
      return res.status(404).json({
        error: `90minut nie publikuje protokołów rozgrywek ${klub.league} — są tylko wyniki, bez składów i minut.`,
        podpowiedz: `„${klub.name}" ma tam ${nasze.length} rozegranych meczów, ale żaden nie ma protokołu, `
          + "więc nie ma skąd policzyć minut. Statystyki tych rozgrywek zbierz zakładką z „Łączy nas piłka” "
          + "— tak samo jak w IV lidze: otwórz grupę na ŁNP, kliknij zakładkę, potem „Wyślij do SBS”.",
        bezProtokolow: true,
        rozegranych: nasze.length,
      });
    }
    // Adres protokołu: identyfikator z odnośnika, a gdy go nie ma — surowy adres z wiersza,
    // rozwinięty względem strony ligi. Bez tego mecz z wynikiem, ale o nietypowym odnośniku,
    // przepadał bez śladu.
    const zTerminarza = nasze.map((m) => {
      let url = m.id ? `http://www.90minut.pl/mecz.php?id_mecz=${m.id}` : "";
      if (!url && m.hrefProtokolu) {
        try { url = new URL(m.hrefProtokolu, adres).toString(); } catch { url = ""; }
      }
      // Z TERMINARZA WIEMY, PO KTÓREJ STRONIE GRAŁ NASZ KLUB. To informacja pewniejsza niż nazwy
      // wyłuskane z protokołu (te bywają w innym miejscu szablonu albo nie ma ich wcale) — i to
      // ona ratuje odczyt, gdy protokół nie chce się przedstawić.
      const dom = toSamKlub(m.homeTeam, klub.name);
      return url ? { id: m.id || url, url, tytul: `${m.homeTeam} - ${m.awayTeam}`,
        dom, rywal: dom ? m.awayTeam : m.homeTeam,
        data: m.date || "", kolejka: m.round || null, wynik: m.wynik || "" } : null;
    }).filter(Boolean);
    // Ślad z odczytu strony. Bez niego „nie ma rozegranych meczów" jest nie do rozstrzygnięcia:
    // nie wiadomo, czy terminarz jest pusty, czy tylko tego klubu w nim nie ma.
    if (wTabeliRozgrywek && wTabeliRozgrywek.stronaLigi === adres) {
      wTabeliRozgrywek.diagnostyka = {
        wierszyTerminarza: terminarz.length,
        zWynikiem: terminarz.filter((m) => m.rozegrany).length,
        zProtokolem: terminarz.filter((m) => m.id || m.hrefProtokolu).length,
        // Surowe odnośniki z wierszy z wynikiem — jedyna rzecz, która rozstrzyga, dlaczego
        // rozegrany mecz bywa dla nas nie do otwarcia.
        odnosniki: terminarz.filter((m) => m.rozegrany).slice(0, 4)
          .map((m) => `${m.homeTeam}-${m.awayTeam}: ${m.hrefProtokolu || m.id || "BRAK ODNOŚNIKA"}`),
        przyklady: terminarz.slice(0, 6).map((m) => `${m.homeTeam} - ${m.awayTeam}${m.wynik ? " " + m.wynik : ""}`),
      };
    }
    if (zTerminarza.length) {
      mecze = zTerminarza;
      stronaLigi = adres;
      break;
    }

    if (wTabeliRozgrywek && wTabeliRozgrywek.stronaLigi === adres) {
      // Strona klubu jako druga droga — bywa, że ma mecze, których nie ma w terminarzu
      // (np. zaległe spotkanie dopisane ręcznie).
      try {
        const zeStronyKlubu = parseLinkiMeczow(await pobierzZ90minut(wTabeliRozgrywek.adres));
        if (zeStronyKlubu.length) {
          mecze = zeStronyKlubu;
          stronaLigi = adres;
          break;
        }
      } catch (e) {
        bledyStron.push({ adres: wTabeliRozgrywek.adres, blad: String((e && e.message) || e) });
      }
    }

    // Zapasowo stara droga — gdyby klub nie stał w tabeli (np. wycofany w trakcie sezonu),
    // a mecze mimo to były rozegrane.
    const linki = parseLinkiMeczow(html);
    linki.forEach((m) => String(m.tytul || "").split(/\s+[-–—]\s+/).forEach((n) => {
      const t = n.trim();
      if (t) widzianeNazwy.add(t);
    }));
    const trafione = linki.filter((m) => tytulMaKlub(m.tytul, klub.name));
    if (trafione.length) { mecze = trafione; stronaLigi = adres; break; }

    // OSTATNIA DESKA RATUNKU: ZAPYTAĆ SAME PROTOKOŁY.
    //
    // Wszystkie drogi wyżej opierają się na tym, JAK strona ligi jest zbudowana — a układ bywa
    // różny w różnych grupach (III liga trafiała, IV liga nie). Protokół meczu za to zawsze
    // podaje obie drużyny wprost. Skoro klub stoi w tabeli TEJ strony, jego mecze też tu są:
    // otwieramy więc protokoły i pytamy każdego z osobna, kto grał. Kosztuje to kilkanaście
    // dodatkowych stron, dlatego jest na końcu — ale kończy wszelkie zgadywanie.
    if (wTabeliRozgrywek && wTabeliRozgrywek.stronaLigi === adres && linki.length) {
      const doSprawdzenia = linki.slice(-MAKS_MECZOW_DO_PRZESZUKANIA);
      const sprawdzone = await porcjami(doSprawdzenia, RÓWNOLEGLE, async (m) => {
        try {
          const p = parseSkladyMeczu(await pobierzZ90minut(`http://www.90minut.pl/mecz.php?id_mecz=${m.id}`));
          const nasz = toSamKlub(p.gospodarzeNazwa, klub.name) || toSamKlub(p.goscieNazwa, klub.name);
          return nasz ? { id: m.id, tytul: `${p.gospodarzeNazwa} - ${p.goscieNazwa}`, data: p.data || "" } : null;
        } catch { return null; }
      });
      const nasze = sprawdzone.filter(Boolean);
      if (nasze.length) {
        mecze = nasze;
        stronaLigi = adres;
        zProtokolowWprost = true;
        break;
      }
    }
  }
  // ŁĄCZYMY OBA ŹRÓDŁA I BIERZEMY PEŁNIEJSZE OBRAZ. Terminarz ligi i strona klubu bywają niepełne
  // każde na swój sposób: terminarz gubi mecz zaległy, strona klubu bywa spóźniona o kolejkę.
  // Suma obu jest zawsze co najmniej tak dobra jak lepsze z nich, a ten sam mecz rozpoznajemy po
  // jego identyfikatorze, więc nic nie policzy się dwa razy.
  if (meczeZProfilu.length) {
    const wgKlucza = new Map();
    for (const m of [...mecze, ...meczeZProfilu]) {
      const klucz = String(m.id || m.url || m.tytul || "");
      if (klucz && !wgKlucza.has(klucz)) wgKlucza.set(klucz, m);
    }
    if (wgKlucza.size > mecze.length) {
      mecze = [...wgKlucza.values()];
      if (!stronaLigi) stronaLigi = profil;
    }
  }

  if (!mecze.length && wTabeliRozgrywek) {
    // KLUB JEST W TABELI, TYLKO JESZCZE NIE GRAŁ.
    //
    // To zupełnie co innego niż „nie znalazłem klubu": liga w kartotece jest dobra, nazwa się
    // zgadza, po prostu w tym sezonie nie ma jeszcze protokołów. Tak wygląda sierpień w CLJ,
    // gdzie rozgrywki juniorskie startują później niż seniorskie. Mówienie w takiej sytuacji
    // „sprawdź nazwę klubu" wysyłało do poprawiania czegoś, co jest poprawne.
    return res.status(404).json({
      error: `Klub „${klub.name}" jest w tabeli rozgrywek ${klub.league} (na 90minut: „${wTabeliRozgrywek.nazwa}"), ale nie ma tam jeszcze ANI JEDNEGO rozegranego meczu w tym sezonie.`,
      podpowiedz: (() => {
        const d = wTabeliRozgrywek.diagnostyka;
        if (!d) return "Nie ma czego pobierać — wróć tu po pierwszej kolejce.";
        if (!d.wierszyTerminarza) {
          return "UWAGA: na stronie tych rozgrywek nie odczytałem ANI JEDNEGO wiersza terminarza — " +
            "to raczej zmiana układu strony po stronie 90minut niż brak meczów. Zgłoś to, bo wymaga poprawki w programie.";
        }
        return `W terminarzu tej strony widzę ${d.wierszyTerminarza} spotkań (${d.zWynikiem} z wynikiem), ` +
          `ale w żadnym nie ma tego klubu. Przykłady: ${d.przyklady.join("; ")}. ` +
          "Jeśli któraś z tych par dotyczy Twojego klubu pod inną nazwą — wyrównaj nazwę w „Edytuj klub”.";
      })(),
      adresKlubuNa90minut,
      diagnostyka: wTabeliRozgrywek.diagnostyka || null,
      bezMeczow: true,
      przeszukaneStrony: adresy.length,
    });
  }
  if (!mecze.length) {
    // NAZWY, KTÓRE FAKTYCZNIE WIDZIAŁEM. Bez nich komunikat „nie znalazłem" jest ślepy: nie wiadomo,
    // czy klub nazywa się na 90minut inaczej, czy w ogóle przeszukałem niewłaściwe rozgrywki.
    // Podobne nazwy pokazujemy na początku — najczęściej to właśnie one są odpowiedzią.
    const nasze = czlonyKlubu(klub.name).slowa;
    const podobne = [...widzianeNazwy].filter((n) => {
      const ich = czlonyKlubu(n).slowa;
      return nasze.some((w) => w.length >= 4 && ich.includes(w));
    });
    const przyklady = podobne.length ? podobne : [...widzianeNazwy].slice(0, 12);

    // A MOŻE KLUB GRA GDZIE INDZIEJ?
    //
    // Najczęstsza przyczyna „nie ma go na stronach tych rozgrywek" to nie literówka, tylko spadek
    // albo awans: w kartotece został poprzedni poziom. Zaglądamy więc na strony poziomu wyżej
    // i niżej i mówimy wprost, gdzie ten klub faktycznie występuje. Strony i tak leżą już
    // w pamięci podręcznej z tego przebiegu, więc kosztuje to niewiele.
    let znalezionyPoziom = "";
    if (widzianeNazwy.size) {
      // Budżet czasu, bo IV liga to szesnaście stron wojewódzkich, a funkcja ma swój limit.
      // Diagnostyka nie może kosztować tyle, żeby przez nią przepadła odpowiedź.
      const koniecSzukania = Date.now() + 8000;
      const kolejnosc = { "Ekstraklasa": ["I liga"], "I liga": ["II liga", "Ekstraklasa"],
        "II liga": ["III liga", "I liga"], "III liga": ["IV liga", "II liga"], "IV liga": ["III liga"] };
      for (const innyPoziom of (kolejnosc[poziom] || [])) {
        for (const adres of (ZRODLA_LIG[innyPoziom] || [])) {
          if (Date.now() > koniecSzukania) break;
          let html;
          try { html = await pobierzZ90minut(adres); } catch { continue; }
          if (parseLinkiMeczow(html).some((m) => tytulMaKlub(m.tytul, klub.name))) { znalezionyPoziom = innyPoziom; break; }
        }
        if (znalezionyPoziom || Date.now() > koniecSzukania) break;
      }
    }
    if (znalezionyPoziom) {
      return res.status(404).json({
        error: `Klub „${klub.name}" nie gra w rozgrywkach ${klub.league} — jego mecze są w rozgrywkach ${znalezionyPoziom}.`,
        podpowiedz: `Popraw pole „Liga" w edycji klubu na właściwy poziom (${znalezionyPoziom}) i uruchom pobieranie jeszcze raz. ` +
          "Do czasu poprawki nie mam skąd wziąć protokołów tego klubu, bo szukam ich na stronach poziomu wpisanego w kartotece.",
        znalezionyPoziom,
        przeszukaneStrony: adresy.length,
      });
    }
    // Gdy ŻADNA strona się nie otworzyła, o nazwie klubu nie wiemy niczego — i trzeba to powiedzieć
    // wprost, zamiast obwiniać kartotekę.
    if (bledyStron.length && !widzianeNazwy.size) {
      return res.status(503).json({
        error: `90minut nie odpowiedziało przy klubie „${klub.name}" — żadnej ze stron rozgrywek nie udało się otworzyć.`,
        podpowiedz: "To chwilowa odmowa serwisu przy większym ruchu, nie błąd nazwy klubu. Spróbuj ponownie za chwilę — kolejne przejście jest szybsze, bo raz pobrane strony trzymam przez dziesięć minut.",
        bledyStron,
      });
    }
    return res.status(404).json({
      error: `Nie znalazłem rozegranych meczów klubu „${klub.name}" w rozgrywkach ${klub.league}.`,
      podpowiedz: (podobne.length
        ? `Na stronach tych rozgrywek są za to: ${podobne.slice(0, 6).join(", ")}. ` +
          `Jeśli któraś z tych nazw to ten sam klub, wyrównaj nazwę w „Edytuj klub" — pilnuję przy tym numeru drużyny, ` +
          `więc „II" po jednej stronie, a brak „II" po drugiej to dla mnie dwa różne kluby. `
        : "") +
        (profil
          ? "Sprawdź też, czy link do 90minut w edycji klubu prowadzi do strony klubu z listą meczów tego sezonu."
          : "Najpewniejsza droga: otwórz klub na 90minut.pl i wklej jego adres w „Edytuj klub” → pole 90minut. " +
            "Wtedy biorę mecze wprost ze strony klubu, zamiast szukać go po nazwie na stronach ligi. " +
            "Druga możliwość: klub jeszcze nie grał w tym sezonie."),
      przeszukaneStrony: adresy.length,
      widzianeKluby: przyklady.slice(0, 24),
      bledyStron,
    });
  }

  // Bierzemy ostatnie mecze, nie wszystkie. Sumy sezonowe i tak pochodzą ze stron zawodników,
  // a protokoły dokładają dwie rzeczy: skład (kogo szukać) i minuty mecz po meczu na wykres.
  const wybrane = mecze.slice(-MAKS_MECZOW);

  // --- 2. SKŁADY -> IDENTYFIKATORY ZAWODNIKÓW ---
  const skladyHtml = await porcjami(wybrane, RÓWNOLEGLE, async (m) => {
    const adresProtokolu = m.url || `http://www.90minut.pl/mecz.php?id_mecz=${m.id}`;
    try {
      // W IV lidze 90minut nie prowadzi własnych protokołów — odnośnik przy wyniku przenosi na
      // stronę PZPN. Czytamy więc stamtąd, tym samym parserem, którym aplikacja czyta wklejony
      // protokół. Skąd pochodzi strona, rozstrzyga jej adres.
      if (czyLnp(adresProtokolu)) return { m, html: await pobierzLnp(adresProtokolu), zLnp: true, adres: adresProtokolu };
      return { m, html: await pobierzZ90minut(adresProtokolu) };
    } catch (e) { return { m, error: e.message }; }
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

    // --- PROTOKÓŁ Z ŁNP ---
    // Nie ma tu identyfikatorów zawodników z 90minut, więc tożsamość budujemy z imienia
    // i nazwiska. Dorobek sezonowy i tak policzymy z protokołów, a do kartoteki dopasowujemy
    // po nazwisku — czyli dokładnie tak samo jak przy 90minut.
    if (s.zLnp) {
      // Najpierw sama strona, a gdy w niej pusto — adresy, które strona podaje jako źródło
      // swoich danych. Dopiero brak jednego i drugiego znaczy, że nie ma czego czytać.
      let prot = parseProtokolLnp(s.html, klub.name);
      if (!prot && s.adres) {
        try { prot = await protokolZDanychStrony(s.html, s.adres, klub.name); }
        catch { /* nie udało się — zostaje zwykły komunikat niżej */ }
      }
      if (!prot) { protokolyBezSkladu.push(s.m.url || s.m.id); continue; }
      zLnpOdczytane++;
      const opisLnp = {
        mecz: s.m.id, data: s.m.data || "", kolejka: s.m.kolejka || null,
        rywal: s.m.rywal || (prot.druzyny.find((d) => d !== prot.nazwaDruzyny) || ""),
        dom: typeof s.m.dom === "boolean" ? s.m.dom : true, wynik: s.m.wynik || "",
      };
      naszeMecze.push(opisLnp);
      prot.zawodnicy.forEach((z) => {
        const id = "lnp:" + normalizujNazwe(z.nazwaPelna);
        if (!zawodnicy90.has(id)) zawodnicy90.set(id, { id, sezon: "", nazwa: z.nazwaPelna, numer: z.numer, zLnp: true });
        if (!przebiegWg90.has(id)) przebiegWg90.set(id, new Map());
        przebiegWg90.get(id).set(opisLnp.mecz, {
          ...opisLnp, minuty: z.minutyGry, odMinuty: z.wszedl, doMinuty: z.zszedl,
          podstawowy: !!z.podstawowy, zolte: 0, czerwone: 0,
        });
      });
      continue;
    }

    const p = parseSkladyMeczu(s.html);
    rozgrywkiNagl = rozgrywkiNagl || p.rozgrywki;
    // Która strona to nasz klub? Rozstrzyga nazwa z samego protokołu, a nie zgadywanie
    // z podpowiedzi odnośnika.
    let nasi = null, dom = false;
    if (toSamKlub(p.gospodarzeNazwa, klub.name)) { nasi = p.gospodarze; dom = true; }
    else if (toSamKlub(p.goscieNazwa, klub.name)) { nasi = p.goscie; dom = false; }
    else if (typeof s.m.dom === "boolean") {
      // Protokół nie podał nazw w rozpoznawalnym miejscu, ale wiersz terminarza, z którego wzięliśmy
      // ten mecz, mówi wprost, czy graliśmy u siebie. Bez tego cała grupa kończyła przebieg
      // komunikatem „w żadnym protokole nie rozpoznałem strony tego klubu".
      nasi = s.m.dom ? p.gospodarze : p.goscie;
      dom = s.m.dom;
      zTerminarzaRozpoznane++;
    }
    if (!nasi || !nasi.length) continue;
    const opis = {
      mecz: s.m.id, data: p.data || s.m.data || "",
      kolejka: Number((p.rozgrywki.match(/Kolejka\s*(\d+)/i) || [])[1]) || s.m.kolejka || null,
      rywal: (dom ? p.goscieNazwa : p.gospodarzeNazwa) || s.m.rywal || "", dom,
      wynik: p.wynik || s.m.wynik || "",
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

  // DRUGA DROGA: KADRA ZE STRONY KLUBU.
  //
  // Protokołów IV ligi 90minut nie prowadzi, więc dotąd wszystko kończyło się tutaj. Ale strony
  // ZAWODNIKÓW 90minut prowadzi także niżej — a strona klubu jest do nich spisem treści. Skoro
  // z protokołów nie wyszedł ani jeden zawodnik, bierzemy skład stamtąd i dalej idziemy dokładnie
  // tą samą drogą co w II i III lidze: strona zawodnika oddaje gotowe sumy sezonu.
  let zKadryKlubu = 0;
  if (!zawodnicy90.size && adresKlubuNa90minut) {
    try {
      const htmlKlubu = await pobierzZ90minut(adresKlubuNa90minut);
      for (const z of parseKadraKlubu(htmlKlubu)) {
        if (!zawodnicy90.has(z.id)) { zawodnicy90.set(z.id, { ...z, zKadry: true }); zKadryKlubu++; }
      }
    } catch (e) { bledyStron.push({ adres: adresKlubuNa90minut, blad: String((e && e.message) || e) }); }
  }

  if (!zawodnicy90.size) {
    // Ślad z odczytu protokołów — bez niego nie da się rozstrzygnąć, czy chodzi o nazwę klubu,
    // o nieotwarty protokół, czy o szablon, w którym nie ma składów.
    const slad = skladyHtml.slice(0, 3).map((s) => {
      if (s.error) return `${s.m.url || s.m.id}: nie otworzyłem (${s.error})`;
      const p = parseSkladyMeczu(s.html);
      return `${s.m.url || s.m.id}: „${p.gospodarzeNazwa || "?"}" - „${p.goscieNazwa || "?"}", ` +
        `zawodników w protokole: ${p.gospodarze.length + p.goscie.length}`;
    });
    // PROTOKOŁY IV LIGI PROWADZI ŁNP, A TA STRONA POWSTAJE DOPIERO W PRZEGLĄDARCE.
    //
    // Do serwera przychodzi pusta skorupa — zero nazwisk — więc nie ma czego czytać. To nie jest
    // problem nazwy klubu ani ligi w kartotece, a poprzedni komunikat sugerował dokładnie to
    // i wysyłał do poprawiania czegoś, co jest poprawne.
    if (protokolyBezSkladu.length) {
      // CO STRONA W OGÓLE ZAWIERAŁA. Czytamy już nie tylko widoczny tekst, ale i dane wpisane
      // w skrypty — jeśli i tam nic nie ma, trzeba wiedzieć CZEGO nie ma, zamiast dostawać samo
      // „nie da się". Ten ślad wskazuje wprost, czy zabrakło danych, czy tylko nazwa klubu nie
      // trafiła w tę ze strony.
      const zajrzenie = skladyHtml.filter((s) => s.zLnp && s.html)
        .slice(0, 2).map((s) => ({ mecz: s.m.url || s.m.id, ...opiszZawartosc(s.html) }));
      // Strony, których w ogóle nie udało się pobrać (blokada, przekroczony czas) — bez tego
      // wyglądałyby tak samo jak strony puste, a to zupełnie inna przyczyna i inna naprawa.
      const nieodczytane = skladyHtml.filter((s) => s.zLnp && s.error)
        .slice(0, 3).map((s) => ({ mecz: s.m.url || s.m.id, blad: String(s.error).slice(0, 160) }));
      if (nieodczytane.length) zajrzenie.push({ nieodczytaneStrony: nieodczytane });
      const cosJest = zajrzenie.some((z) => z.listOsobowychTablic > 0);
      // Najważniejsze liczby WPROST W KOMUNIKACIE, nie tylko w zwiniętym śladzie. Przy osiemnastu
      // klubach nikt nie będzie rozwijał osiemnastu ramek, a bez tych kilku liczb nie da się
      // rozstrzygnąć, czy strona przyszła pusta, czy w ogóle nie przyszła.
      // KOLEJNOŚĆ MA ZNACZENIE. Starsze wydanie aplikacji ucina ten komunikat na 110 znakach,
      // a przeglądarka potrafi trzymać starą wersję strony przez dłuższy czas. Na początek idzie
      // więc to, co najcenniejsze — adresy, pod które strona sama sięga po dane — żeby dotarło
      // nawet wtedy, gdy reszta zdania zostanie obcięta.
      const pierwsze = zajrzenie.find((z) => z.dlugoscStrony != null);
      // Strona ŁNP jest w Angularze: adresu danych nie ma ani w niej, ani w jej treści — jest
      // w plikach z kodem. Zaglądamy tam i pokazujemy, co znaleźliśmy; bez tego każda kolejna
      // próba byłaby zgadywaniem.
      let zKodu = null;
      const zLnpHtml = skladyHtml.find((s) => s.zLnp && s.html && s.adres);
      if (zLnpHtml) {
        try { zKodu = await zbadajSkryptyStrony(zLnpHtml.html, zLnpHtml.adres); } catch { /* trudno */ }
      }
      // Szczegóły techniczne zostają w śladzie pod „dlaczego?", a nie w pierwszym zdaniu.
      // Dla czytającego liczy się jedno: co ma teraz zrobić.
      const skrot = pierwsze
        ? `API: ${[...(pierwsze.adresyApi || []), ...((zKodu && zKodu.adresy) || [])].slice(0, 6).join(" ") || "brak"}`
          + ` | ścieżki: ${((zKodu && zKodu.sciezki) || []).slice(0, 8).join(" ") || "brak"}`
          + ` | szablony: ${((zKodu && zKodu.szablony) || []).slice(0, 5).join(" ") || "brak"}`
          + ` | pliki kodu: ${(zKodu && zKodu.zbadane || []).join(" ; ") || "nie czytałem"}`
          + ` | ${pierwsze.dlugoscStrony} zn., ${pierwsze.skryptow} skryptów`
        : `żadnej strony meczu nie udało się pobrać`;
      // ŁNP WYSYŁA SERWEROM ATRAPĘ STRONY. Poznajemy to po tym, że plik z kodem aplikacji ma
      // kilkaset znaków zamiast megabajtów i nie ma w nim ani jednego adresu. Prawdziwą aplikację
      // dostaje wyłącznie przeglądarka — i to nie jest coś, co da się obejść od strony serwera.
      // Mówimy więc wprost, jaka droga działa, zamiast obiecywać kolejną próbę.
      const atrapaStrony = !!zKodu && !zKodu.adresy.length && !zKodu.sciezki.length
        && (zKodu.zbadane || []).some((z) => /main[^:]*:\s*\d{1,4} zn\./.test(z));
      return res.status(409).json({
        error: cosJest
          ? `Strona „Łączy nas piłka" oddała składy, ale pod nazwami drużyn, których nie umiem połączyć z „${klub.name}".`
          : atrapaStrony
            ? `„Łączy nas piłka" nie wysyła składów serwerom — prawdziwą stronę meczu dostaje wyłącznie przeglądarka.`
            : `Kod strony ŁNP bez składów. ${skrot}.`,
        podpowiedz: cosJest
          ? `Na stronie widzę drużyny: ${zajrzenie.flatMap((z) => z.nazwyDruzyn).join(", ") || "—"}. `
            + `Wyrównaj nazwę klubu w kartotece do tej ze strony, albo napisz mi, która to drużyna.`
          : atrapaStrony
            ? `Tę ligę rozliczasz w dwóch ruchach: na stronie kolejki w ŁNP kliknij zakładkę `
              + `„⚡ Zbierz całą kolejkę", wróć tutaj i naciśnij „📥 Wczytaj ze schowka" `
              + `(przycisk „📋 Wklejka z ŁNP" w klubie). Wklejać niczego nie musisz. `
              + `Szczegóły techniczne: ${skrot}.`
            : `Próbowałem też drugą drogą — spisem kadry ze strony klubu na 90minut `
              + `(${adresKlubuNa90minut || "adresu klubu nie znam"}) — i tam też nie ma zawodników. `
              + `Początek strony ŁNP: ${(pierwsze && pierwsze.poczatekStrony) || "—"}`,
        protokolyBezSkladu: protokolyBezSkladu.slice(0, 5),
        zrodloProtokolow: "laczynaspilka.pl",
        coWidacNaStronie: zKodu ? [...zajrzenie, { zKoduStrony: zKodu }] : zajrzenie,
      });
    }
    return res.status(404).json({
      error: "Znalazłem mecze, ale w żadnym protokole nie rozpoznałem składu tego klubu.",
      podpowiedz: `Sprawdziłem ${wybrane.length} protokołów. Co w nich widzę: ${slad.join(" | ")}. ` +
        (slad.some((t) => /zawodników w protokole: 0/.test(t))
          ? "Protokoły nie mają list zawodników — 90minut publikuje je zwykle dzień po meczu."
          : `Jeśli nazwy w protokole różnią się od „${klub.name}", wyrównaj nazwę w edycji klubu.`),
      sprawdzoneMecze: wybrane.map((m) => m.tytul),
      sladProtokolow: slad,
    });
  }

  // --- 3. STRONY ZAWODNIKÓW -> SUMY SEZONOWE ---
  //
  // SUMY ZE STRONY ZAWODNIKA POTRAFIĄ BYĆ SPÓŹNIONE. 90minut prowadzą wolontariusze: protokół
  // meczu pojawia się od razu, a zbiorcza tabela występów bywa przeliczona kilka dni później.
  // Stąd „rozegrane dwie kolejki, a w aplikacji jedna". Dlatego liczby z protokołów (przebieg)
  // traktujemy jako drugie źródło i bierzemy WIĘKSZĄ wartość — ale tylko wtedy, gdy protokoły
  // objęły CAŁY sezon klubu. Przy dłuższym sezonie pobieramy ostatnie dwadzieścia kolejek, więc
  // ich suma byłaby niepełna i zaniżałaby dorobek.
  const pelnySezonWProtokolach = wybrane.length === mecze.length;
  const zProtokolow = (id) => {
    const lista = przebiegWg90.get(id) || [];
    if (!lista.length) return null;
    return {
      wystepy: lista.filter((w) => (Number(w.minuty) || 0) > 0).length,
      minuty: lista.reduce((sum, w) => sum + (Number(w.minuty) || 0), 0),
      zolte: lista.reduce((sum, w) => sum + (Number(w.zolte) || 0), 0),
      czerwone: lista.reduce((sum, w) => sum + (Number(w.czerwone) || 0), 0),
    };
  };

  const lista = [...zawodnicy90.values()];
  const bezWierszaSezonu = [];
  const statystyki = await porcjami(lista, RÓWNOLEGLE, async (z) => {
    const zProtokolu = zProtokolow(z.id);
    // Zawodnik odczytany z protokołu ŁNP nie ma strony na 90minut, więc nie ma czego pytać
    // o sumy sezonowe — jego dorobek liczymy wprost z protokołów. Bramek stąd nie znamy
    // (rodzaj zdarzenia jest ikoną), więc pole bramek zostaje nietknięte.
    if (z.zLnp) {
      if (!zProtokolu) return null;
      return {
        ...z, nazwaPelna: z.nazwa, rocznik: null, klub: klub.name, rozgrywki: klub.league,
        wystepy: zProtokolu.wystepy, minuty: zProtokolu.minuty, gole: null,
        zolte: zProtokolu.zolte, czerwone: zProtokolu.czerwone, adres: "", zProtokolow: true,
      };
    }
    const adres = `http://www.90minut.pl/wystepy.php?id=${z.id}` + (z.sezon ? `&id_sezon=${z.sezon}` : "");
    let dane = null;
    try { dane = parseWystepyZawodnika(await pobierzZ90minut(adres)); } catch { /* strona zawodnika niedostępna */ }
    // Wiersz „RAZEM" zlicza ligę razem z pucharem. Chcemy wiersz samych rozgrywek ligowych,
    // a podsumowania używamy tylko wtedy, gdy innego wiersza nie ma.
    //
    // Przy drużynach rezerw numer bywa zapisany tylko po jednej stronie („Raków II Częstochowa"
    // w protokole, „Raków Częstochowa" w tabeli występów), więc na końcu dopuszczamy dopasowanie
    // BEZ numeru — ale wtedy wymagamy zgodnego poziomu rozgrywek, żeby nie wziąć wiersza z innej ligi.
    const poziom = poziomRozgrywek(klub.league);
    const ligowy = dane && (
      dane.sezony.find((s) => !s.podsumowanie && toSamKlub(s.klub, klub.name) && /liga|ekstraklasa/i.test(s.rozgrywki))
      || dane.sezony.find((s) => !s.podsumowanie && toSamKlub(s.klub, klub.name))
      || dane.sezony.find((s) => !s.podsumowanie && toSamKlub(s.klub, klub.name, { ignorujNumer: true })
           && poziom && poziomRozgrywek(s.rozgrywki) === poziom)
      || dane.sezony.find((s) => s.podsumowanie)
    );

    if (!ligowy) {
      // Zawodnik JEST w protokołach, tylko jego tabela występów jeszcze o tym nie wie (albo pisze
      // klub inaczej). Do niedawna wypadał tu po cichu i zostawał bez minut. Skoro mamy protokoły
      // całego sezonu, liczymy jego dorobek z nich — bez bramek, bo protokół ich nie wymienia,
      // a wpisanie zera skasowałoby liczbę wprowadzoną ręcznie.
      if (!pelnySezonWProtokolach || !zProtokolu) return null;
      bezWierszaSezonu.push(z.nazwa || String(z.id));
      return {
        ...z, nazwaPelna: (dane && dane.nazwa) || z.nazwa, rocznik: dane ? dane.rocznik : null,
        klub: klub.name, rozgrywki: klub.league, wystepy: zProtokolu.wystepy, minuty: zProtokolu.minuty,
        gole: null, zolte: zProtokolu.zolte, czerwone: zProtokolu.czerwone, adres, zProtokolow: true,
      };
    }

    const wyrownany = { ...ligowy };
    if (pelnySezonWProtokolach && zProtokolu) {
      wyrownany.wystepy = Math.max(ligowy.wystepy || 0, zProtokolu.wystepy);
      wyrownany.minuty = Math.max(ligowy.minuty || 0, zProtokolu.minuty);
      wyrownany.zolte = Math.max(ligowy.zolte || 0, zProtokolu.zolte);
      wyrownany.czerwone = Math.max(ligowy.czerwone || 0, zProtokolu.czerwone);
    }
    return { ...z, nazwaPelna: dane.nazwa || z.nazwa, rocznik: dane.rocznik, ...wyrownany, adres };
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

  // Wszystkie człony nazwy, każdy osobno — do dopasowania po nazwisku, gdy imiona zapisano inaczej.
  const czlonyNazwy = (s) => String(s || "").split(/\s+/).map(normalizujNazwe).filter((w) => w.length >= 3);
  // Odległość edycyjna: „Żołneczko" kontra „Żołnieczko" to jedna litera różnicy, a dla człowieka
  // ten sam zawodnik. Liczymy ją dopiero na końcu, gdy dokładne dopasowanie zawiodło.
  const odlegloscEdycyjna = (a, b) => {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 9;
    const wiersz = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let poprzedni = wiersz[0];
      wiersz[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const zapas = wiersz[j];
        wiersz[j] = Math.min(wiersz[j] + 1, wiersz[j - 1] + 1, poprzedni + (a[i - 1] === b[j - 1] ? 0 : 1));
        poprzedni = zapas;
      }
    }
    return wiersz[b.length];
  };

  const doZapisu = [], spozaBazy = [], niejednoznaczni = [], pominietiGorsze = [], innyRocznik = [];
  for (const z of zeStatystykami) {
    // Powód rozstania z zawodnikiem zapisujemy po drodze — inaczej lista „zagrali, ale nie ma ich
    // w kartotece" nie mówi, czy chodzi o zawodnika spoza bazy, o inną pisownię nazwiska,
    // czy o rocznik, który się nie zgadza. A to trzy zupełnie różne rzeczy do zrobienia.
    let powod = "nie ma go w kartotece tego klubu";
    let kandydaci = wgNazwiska.get(kluczNazwiska(z.nazwaPelna)) || [];
    if (!kandydaci.length && z.nazwa) kandydaci = wgNazwiska.get(kluczNazwiska(z.nazwa)) || [];
    if (!kandydaci.length) {
      // DOPASOWANIE PO SAMYM NAZWISKU — potrzebne, gdy imię zapisane jest inaczej po obu stronach
      // („Mateusz" kontra „Mateusz Robert", zdrobnienia, drugie imię).
      //
      // Porównujemy KAŻDY człon nazwy z KAŻDYM członem nazwy w kartotece. 90minut pisze
      // „Nazwisko Imię", nasza baza trzyma „Imię Nazwisko", a zdarza się i pełna nazwa w jednym
      // polu — branie samego last_name gubiło wszystkie takie wpisy.
      const czlony = czlonyNazwy(z.nazwaPelna).concat(czlonyNazwy(z.nazwa));
      if (czlony.length) {
        kandydaci = nasiZawodnicy.filter((g) =>
          czlonyNazwy(`${g.first_name || ""} ${g.last_name || ""}`).some((w) => w.length >= 4 && czlony.includes(w)));

        // Rocznik jest ROZSTRZYGACZEM, a nie warunkiem wstępnym. Wcześniej odrzucał trafienie
        // nawet wtedy, gdy w klubie był tylko jeden zawodnik o tym nazwisku — a rok urodzenia
        // w kartotece bywa po prostu przepisany z błędem. Przy jednym kandydacie ufamy nazwisku
        // i mówimy o rozbieżności wprost; przy kilku rozstrzyga rocznik, bo wtedy naprawdę
        // odróżnia braci i imienników.
        if (kandydaci.length > 1 && z.rocznik) {
          const zgodni = kandydaci.filter((g) => !g.birth_year || Number(g.birth_year) === Number(z.rocznik));
          if (zgodni.length) kandydaci = zgodni;
        }
      }
    }
    if (!kandydaci.length) {
      // OSTATNIA PRÓBA: różnica w pisowni nazwiska (jedna litera). „Mirczetić" kontra „Mirčetić",
      // „Żołneczko" kontra „Żołnieczko" — dla nas ten sam człowiek, dla porównania znak w znak nie.
      const czlony = czlonyNazwy(z.nazwaPelna).filter((w) => w.length >= 5);
      const bliscy = nasiZawodnicy.filter((g) =>
        czlonyNazwy(`${g.first_name || ""} ${g.last_name || ""}`)
          .some((w) => w.length >= 5 && czlony.some((c) => odlegloscEdycyjna(c, w) === 1)));
      if (bliscy.length === 1) {
        kandydaci = bliscy;
        powod = "";
      } else if (bliscy.length > 1) {
        powod = "kilku podobnych w kartotece: " + bliscy.map((g) => `${g.last_name} ${g.first_name}`).join(", ");
      }
    }
    if (!kandydaci.length) {
      spozaBazy.push({ kto: z.nazwaPelna, rocznik: z.rocznik, minuty: z.minuty, adres: z.adres, powod });
      continue;
    }
    // Rocznik po obu stronach bywa różny — trafienie zostaje (nazwisko w klubie jest jedno),
    // ale mówimy o tym wprost, bo to zwykle literówka w kartotece do poprawienia.
    if (kandydaci.length === 1 && z.rocznik && kandydaci[0].birth_year
        && Number(kandydaci[0].birth_year) !== Number(z.rocznik)) {
      innyRocznik.push({ kto: z.nazwaPelna, uNas: kandydaci[0].birth_year, na90minut: z.rocznik });
    }
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
    // Bramek nie znamy, gdy dorobek policzyliśmy z samych protokołów — wtedy zostawiamy pole
    // nietknięte i nie porównujemy go z niczym (null to „nie wiem", a nie „zero").
    const goleZnane = z.gole !== null && z.gole !== undefined;
    const gorszeNizMamy = zApiFootball
      && ((g.minutes || 0) > z.minuty || (g.matches || 0) > z.wystepy || (goleZnane && (g.goals || 0) > z.gole));
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

    // Dorobek policzony z protokołów obejmuje tylko te kolejki, które pobraliśmy (ostatnie
    // dwadzieścia). W trakcie sezonu byłby więc niepełny — dlatego nigdy nie OBNIŻA liczb,
    // które zawodnik już ma. Rosnąć może zawsze, maleć nie.
    if (z.zProtokolow) {
      z.wystepy = Math.max(z.wystepy || 0, g.matches || 0);
      z.minuty = Math.max(z.minuty || 0, g.minutes || 0);
    }

    const bezZmian =
      (g.matches || 0) === z.wystepy && (g.minutes || 0) === z.minuty
      && (!goleZnane || (g.goals || 0) === z.gole)
      && (ext.yellowCards || 0) === z.zolte && (ext.redCards || 0) === z.czerwone
      && !brakujeRocznika && przebiegBezZmian;
    if (bezZmian) continue;
    doZapisu.push({
      id: g.id, kto: `${g.last_name} ${g.first_name}`, ext, custom_fields: g.custom_fields,
      rocznik: brakujeRocznika ? z.rocznik : null,
      bylo: { mecze: g.matches, minuty: g.minutes, gole: g.goals, zolte: ext.yellowCards, czerwone: ext.redCards },
      bedzie: { mecze: z.wystepy, minuty: z.minuty, gole: goleZnane ? z.gole : g.goals,
                zolte: z.zolte, czerwone: z.czerwone },
      goleZnane, zProtokolow: !!z.zProtokolow,
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
        mecze: p.bedzie.mecze, minuty: p.bedzie.minuty, gole: p.goleZnane ? p.bedzie.gole : (p.bylo.gole ?? null),
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
        // Z ILU MECZÓW POLICZONE. Bez tej liczby "dorobek stoi w miejscu" jest nie do rozstrzygnięcia:
        // nie wiadomo, czy zrodlo jest spoznione, czy my widzimy tylko czesc kolejek. Zapisujemy ja
        // przy zawodniku, zeby bylo to widac w kartotece, a nie tylko w oknie przebiegu.
        statsMeczow: wybrane.length,
      };
      const doWyslania = {
        matches: p.bedzie.mecze, minutes: p.bedzie.minuty,
        custom_fields: { ...(p.custom_fields || {}), __ext: ext },
      };
      // Bramki wysyłamy tylko wtedy, gdy naprawdę je odczytaliśmy. Zawodnik policzony z protokołów
      // (bo jego tabela występów jeszcze nie istnieje) miałby inaczej wpisane zero na miejsce liczby,
      // którą ktoś wprowadził ręcznie.
      if (p.goleZnane) doWyslania.goals = p.bedzie.gole;
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
    zProtokolowWprost,
    stronaZTerminarza: zTerminarzaRozpoznane,
    protokolyZLnp: zLnpOdczytane,
    zKadryKlubu,
    meczeKlubu: mecze.length,
    // Adres strony klubu odnaleziony w tabeli — przeglądarka zapisuje go w kartotece, żeby
    // następnym razem pominąć całe szukanie i wejść od razu tam, gdzie trzeba.
    adresKlubuNa90minut,
    pelnySezonWProtokolach,
    // Zawodnicy, których dorobek policzyliśmy z samych protokołów, bo ich tabela występów na
    // 90minut jeszcze nie została przeliczona. To najczęstsza przyczyna „rozegrane dwie kolejki,
    // a w aplikacji jedna" — warto ją pokazać wprost, a nie milczeć.
    zProtokolow: bezWierszaSezonu,
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
    innyRocznik,
    bezDanych,
    // Nazwiska, które mam w kartotece tego klubu — żeby przy „nie ma go w kartotece" dało się
    // jednym spojrzeniem sprawdzić, czy to naprawdę nowy zawodnik, czy tylko inna pisownia.
    nazwiskaWKlubie: nasiZawodnicy.map((g) => `${g.last_name || ""} ${g.first_name || ""}`.trim()).filter(Boolean),
    // Gotowe do wysłania z powrotem pod „Zapisz" — patrz ścieżka szybkiego zapisu na górze pliku.
    pakiet: zapisz ? undefined : zadaniaZapisu.map(({ p, doWyslania }) => ({ id: p.id, kto: p.kto, dane: doWyslania })),
    bledyZapisu,
    pominietiGorsze,
    uwaga: "90minut nie publikuje asyst — to pole zostaje bez zmian.",
  });
}
