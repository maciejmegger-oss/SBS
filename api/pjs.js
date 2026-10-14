// Pro Junior System (PJS) — kto w danym klubie zdobywa punkty za granie młodzieżowców.
//
// PO CO TO JEST: PJS to jedyne miejsce, w którym PZPN sam liczy, ilu młodych zawodników i przez
// ile minut naprawdę gra w każdym klubie III ligi i niżej. Klub dostaje za to punkty i pieniądze,
// więc dane są pilnowane i aktualizowane co kolejkę. Dla skauta to gotowa lista nazwisk:
// chłopak, który uzbierał 1938 punktów w dwunastu meczach, gra regularnie w seniorskiej piłce
// przed dwudziestką — i nie ma go jeszcze w żadnym komercyjnym serwisie.
//
// SKĄD SIĘ WZIĘŁY TE ADRESY: strona laczynaspilka.pl/pjs buduje się w przeglądarce i po dane
// sięga osobnym serwisem. Adresy odczytane z jej własnego kodu i potwierdzone na żywym ruchu
// (performance.getEntriesByType). Serwis nie wymaga logowania ani klucza.
//
// CZEMU PO STRONIE SERWERA: przeglądarka nie pobierze danych z obcego serwisu (blokada CORS).
// Ten sam powód, dla którego po tej stronie stoi odczyt Transfermarktu i protokołów ŁNP.

const BAZA = "https://pjs-api.laczynaspilka.pl";

const NAGLOWKI = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "pl-PL,pl;q=0.9",
  "Referer": "https://www.laczynaspilka.pl/pjs",
};

// Identyfikatory w PJS to zawsze UUID. Sprawdzamy to, zanim cokolwiek dokleimy do adresu —
// bez tego parametr z zapytania mógłby wyprowadzić nas poza ten serwis.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function pjsPobierz(sciezka) {
  const odp = await fetch(BAZA + sciezka, {
    headers: NAGLOWKI,
    signal: AbortSignal.timeout(25000),
  });
  if (!odp.ok) throw new Error(`PJS odpowiedział ${odp.status} na ${sciezka}`);
  return odp.json();
}

// ---------- ODCZYTY ----------

// Sezony i ligi. Pole `grouping` rozstrzyga o szczeblu: 1 to rozgrywki centralne (III liga),
// 2 to wojewódzkie (IV liga i niżej), 0 to rozgrywki kobiet.
export const SZCZEBEL_CENTRALNY = 1;

export async function pjsFiltry() {
  const dane = await pjsPobierz("/filters");
  return (Array.isArray(dane) ? dane : []).map((s) => ({
    sezon: { id: s.season && s.season.key, nazwa: s.season && s.season.value },
    ligi: (s.leagues || []).map((l) => ({
      id: l.id, nazwa: l.name, szczebel: l.grouping, kolejnosc: l.index,
      centralna: l.grouping === SZCZEBEL_CENTRALNY,
    })),
  }));
}

// Grupy rozgrywkowe danej ligi w danym sezonie: { id: nazwa }.
export async function pjsRozgrywki(sezonId, ligaId) {
  const dane = await pjsPobierz(`/seasons/${sezonId}/leagues/${ligaId}/competitions`);
  return Object.entries(dane || {}).map(([id, nazwa]) => ({ id, nazwa }));
}

// Tabela klubów — ten sam kształt dla obu ścieżek, centralnej i wojewódzkiej.
function ksztaltTabeli(dane) {
  return {
    liga: dane.league ? { id: dane.league.id, nazwa: dane.league.name } : null,
    kluby: (dane.points || []).map((w) => ({
      miejsce: w.index,
      liczonyDoRankingu: !!w.isCounted,
      klub: { id: w.team && w.team.id, nazwa: w.team && w.team.name, herb: w.team && w.team.logo },
      punkty: w.league ? w.league.points : 0,
      minuty: w.league ? w.league.time : 0,
      meczeRozegrane: w.league ? w.league.playedMatches : 0,
      meczeWszystkie: w.league ? w.league.allMatches : 0,
    })),
  };
}

// Grupa ogólnopolska (III liga) — razem z identyfikatorami drużyn, po których pytamy o zawodników.
export async function pjsTabela(rozgrywkiId) {
  return ksztaltTabeli(await pjsPobierz(`/competitions/${rozgrywkiId}/points`));
}

// SZCZEBEL WOJEWÓDZKI IDZIE INNĄ ŚCIEŻKĄ NIŻ CENTRALNY.
//
// III liga ma cztery grupy ogólnopolskie i pyta się o nie przez /competitions/{id}/points.
// IV liga i niżej są podzielone na wojewódzkie związki (ZPN) — to samo zapytanie oddaje dla nich
// pustą tabelę, bo grupa bez wskazanego województwa nic nie znaczy. Dlatego osobna para odczytów.
// Potwierdzone na adresie z IV ligą kujawsko-pomorską: 16 związków, po osiemnaście klubów.
export async function pjsWojewodztwa(sezonId, ligaId) {
  const dane = await pjsPobierz(`/seasons/${sezonId}/leagues/${ligaId}/ZPNs`);
  return (Array.isArray(dane) ? dane : []).map((z) => ({
    id: z.id, nazwa: z.voivodeship, szczebel: z.grouping,
  }));
}

export async function pjsTabelaWojewodztwa(sezonId, ligaId, zpnId) {
  const dane = await pjsPobierz(`/seasons/${sezonId}/leagues/${ligaId}/ZPNs/${zpnId}/points`);
  return ksztaltTabeli(dane);
}

// Zawodnicy punktujący dla klubu. To jest sedno całej tej ścieżki.
export async function pjsZawodnicyKlubu(druzynaId) {
  const dane = await pjsPobierz(`/teams/${druzynaId}/points`);
  return {
    klub: dane.team ? { id: dane.team.id, nazwa: dane.team.name, herb: dane.team.logo } : null,
    punktyKlubu: dane.points || 0,
    minutyKlubu: dane.time || 0,
    meczeRozegrane: dane.playedMatches || 0,
    meczeWszystkie: dane.allMatches || 0,
    zawodnicy: (dane.players || []).map((w) => {
      const z = w.player || {};
      const liga = w.leagueScore || {};
      const kadra = w.representationScore || {};
      return {
        pjsId: z.id,
        imie: ladnieImie(z.firstName),
        nazwisko: ladnieImie(z.lastName),
        miejsce: w.index,
        // „isCounted: false" znaczy, że zawodnik gra, ale do klasyfikacji klubu się nie liczy
        // (na stronie PZPN taki wiersz ma pasek z boku i podpis „nieuwzględniony").
        liczonyDoRankingu: !!w.isCounted,
        mecze: liga.matches || 0,
        minuty: liga.minutes || 0,
        punkty: liga.points || 0,
        kadraMecze: kadra.matches || 0,
        kadraPunkty: kadra.points || 0,
      };
    }),
  };
}

// PJS podaje nazwiska RAZ WIELKIMI LITERAMI, raz normalnie — w jednej i tej samej tabeli
// („BARTŁOMIEJ CHYB" obok „Eryc Papiernik"). Zapisanie wersji krzyczącej do kartoteki
// wyglądałoby na błąd i rozjechałoby sortowanie, więc sprowadzamy do jednej postaci.
function ladnieImie(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t !== t.toUpperCase()) return t;   // już ma małe litery — zostawiamy, jak jest
  return t.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, przed, litera) => przed + litera.toUpperCase());
}

// ---------- WEJŚCIE HTTP ----------

export default async function handler(req, res) {
  const { akcja, sezon, liga, rozgrywki, druzyna, wojewodztwo } = req.query || {};
  const zlyId = (v) => v && !UUID.test(String(v));
  if (zlyId(sezon) || zlyId(liga) || zlyId(rozgrywki) || zlyId(druzyna) || zlyId(wojewodztwo)) {
    return res.status(400).json({ error: "Identyfikator PJS musi być w postaci UUID." });
  }

  try {
    if (akcja === "filtry") return res.status(200).json({ sezony: await pjsFiltry() });

    if (akcja === "rozgrywki") {
      if (!sezon || !liga) return res.status(400).json({ error: "Podaj sezon i ligę." });
      return res.status(200).json({ rozgrywki: await pjsRozgrywki(sezon, liga) });
    }

    if (akcja === "wojewodztwa") {
      if (!sezon || !liga) return res.status(400).json({ error: "Podaj sezon i ligę." });
      return res.status(200).json({ wojewodztwa: await pjsWojewodztwa(sezon, liga) });
    }

    if (akcja === "tabela") {
      // Szczebel wojewódzki rozpoznajemy po tym, że podano województwo — wtedy grupa nie jest
      // potrzebna, bo w IV lidze i niżej to związek wojewódzki wyznacza tabelę.
      if (wojewodztwo) {
        if (!sezon || !liga) return res.status(400).json({ error: "Przy województwie podaj też sezon i ligę." });
        return res.status(200).json(await pjsTabelaWojewodztwa(sezon, liga, wojewodztwo));
      }
      if (!rozgrywki) return res.status(400).json({ error: "Podaj identyfikator rozgrywek albo województwo." });
      return res.status(200).json(await pjsTabela(rozgrywki));
    }

    if (akcja === "druzyna") {
      if (!druzyna) return res.status(400).json({ error: "Podaj identyfikator drużyny." });
      return res.status(200).json(await pjsZawodnicyKlubu(druzyna));
    }

    return res.status(400).json({
      error: "Nieznana akcja.",
      podpowiedz: "akcja=filtry | rozgrywki&sezon=&liga= | wojewodztwa&sezon=&liga= | tabela&rozgrywki= | tabela&sezon=&liga=&wojewodztwo= | druzyna&druzyna=",
    });
  } catch (e) {
    return res.status(502).json({
      error: "Nie udało się odczytać danych Pro Junior System.",
      szczegoly: String((e && e.message) || e),
    });
  }
}
