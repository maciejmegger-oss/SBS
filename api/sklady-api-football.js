// SKŁADY MECZU OD LICENCJONOWANEGO DOSTAWCY — DROGA, KTÓRA NIE ZALEŻY OD CZYJEJŚ STRONY.
//
// PO CO TO POWSTAŁO. Czytanie składów ze stron okazało się drogą zamkniętą i wiemy to z pomiaru,
// nie z przypuszczenia: ŁNP wysyła serwerowi sam szkielet strony — 25 560 znaków, zero śladów
// danych, zero adresów, pod które strona sama sięga — i robi to identycznie, gdy przedstawiamy
// się jako robot i gdy pytamy nagłówkami przeglądarki. Tam po prostu nie ma czego czytać.
//
// Serwisy wynikowe mają składy, ale ich regulamin zabrania automatycznego pobierania, a dane są
// gorsze: imię skrócone do inicjału („Nowak B.") nie wiąże się z kartoteką, bo nie wiadomo, KTÓRY
// Nowak. Zostaje dostawca, który te dane sprzedaje — z pełnymi nazwiskami, numerami i pozycjami.
//
// CZEGO TU NIE MA. Pokrycia. API-Football obejmuje rozgrywki, za które klient płaci, i nie
// obejmuje CLJ ani niższych lig — tam zostaje wklejanie składu ze strony (patrz src/domain/sklad.ts).
// Dlatego brak pokrycia MUSI być nazwany po imieniu: „nie znalazłem meczu" i „tych rozgrywek nie
// ma w twoim planie" wymagają od scouta czego innego, a pomylenie ich kosztuje wieczór na
// szukaniu błędu tam, gdzie błędu nie ma.

const KLUCZ = process.env.FOOTBALL_API_KEY;
const BAZA = "https://v3.football.api-sports.io";

const pierwszy = (v) => String((Array.isArray(v) ? v[0] : v) || "").trim();

// Nazwa drużyny sprowadzona do porównywalnej postaci. Dostawca pisze nazwy po swojemu
// („Rakow Czestochowa", bez ogonków), kartoteka po polsku — porównujemy po słowach.
const OGONKI = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
const norm = (s) => String(s || "").toLowerCase()
  .replace(/[ąćęłńóśźż]/g, (c) => OGONKI[c] || c)
  .normalize("NFD").replace(/\p{M}/gu, "")
  .replace(/\bs\s*\.?\s*a\s*\.?\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();
const slowa = (s) => norm(s).split(" ").filter((w) => w.length > 2);

function toSamaDruzyna(a, b) {
  const x = slowa(a), y = slowa(b);
  if (!x.length || !y.length) return false;
  return x.every((w) => y.includes(w)) || y.every((w) => x.includes(w));
}

async function pytaj(sciezka) {
  const odp = await fetch(BAZA + sciezka, {
    headers: { "x-apisports-key": KLUCZ },
    signal: AbortSignal.timeout(15000),
  });
  const dane = await odp.json().catch(() => null);
  if (!odp.ok) throw new Error(`dostawca odpowiedział kodem ${odp.status}`);
  // Błąd bywa przekazywany z kodem 200 — dlatego sprawdzamy też pole `errors`.
  const bledy = dane && dane.errors;
  const ileBledow = bledy ? (Array.isArray(bledy) ? bledy.length : Object.keys(bledy).length) : 0;
  if (ileBledow) throw new Error("dostawca zgłosił błąd: " + JSON.stringify(bledy).slice(0, 200));
  return dane || {};
}

// Zawodnik od dostawcy na nasz kształt — ten sam, który oddaje api/lnp-sklady.js, żeby panel
// nie musiał wiedzieć, skąd skład przyszedł.
const naZawodnika = (poz, rezerwa) => {
  const p = (poz && poz.player) || {};
  const nazwa = String(p.name || "").trim();
  if (!nazwa) return null;
  return {
    nazwa,
    numer: p.number === 0 || p.number ? String(p.number) : "",
    bramkarz: String(p.pos || "").toUpperCase() === "G",
    rezerwa: !!rezerwa,
  };
};

export default async function handler(req, res) {
  const gospodarz = pierwszy(req.query.home);
  const gosc = pierwszy(req.query.away);
  const data = pierwszy(req.query.date);

  if (!KLUCZ) {
    return res.status(200).json({
      gospodarze: null, goscie: null,
      powod: "Nie ustawiono klucza do dostawcy statystyk (FOOTBALL_API_KEY w ustawieniach Vercela).",
      brakKlucza: true,
    });
  }
  if (!gospodarz || !gosc) return res.status(400).json({ error: "Podaj obie drużyny (home, away)." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: "Podaj datę meczu (date=RRRR-MM-DD)." });

  // 1. DRUŻYNA PO NAZWIE. Szukamy po gospodarzu — jedno zapytanie zamiast przeglądania wszystkich
  //    meczów świata z tego dnia.
  let druzyny;
  try {
    druzyny = await pytaj("/teams?search=" + encodeURIComponent(gospodarz.slice(0, 40)));
  } catch (e) {
    return res.status(502).json({ gospodarze: null, goscie: null, powod: "Nie udało się zapytać dostawcy: " + e.message });
  }
  const kandydaci = (druzyny.response || []).filter((x) => toSamaDruzyna(x.team && x.team.name, gospodarz));
  if (!kandydaci.length) {
    return res.status(200).json({
      gospodarze: null, goscie: null,
      powod: `Dostawca nie zna drużyny „${gospodarz}". Jeśli to niższa liga albo rozgrywki młodzieżowe,`
        + " takich danych nie sprzedaje — wklej skład ze strony.",
      znalezione: (druzyny.response || []).slice(0, 5).map((x) => x.team && x.team.name),
    });
  }

  // 2. MECZ TEJ DRUŻYNY W TYM DNIU. Data jest warunkiem, nie podpowiedzią: te same dwie drużyny
  //    grają ze sobą dwa razy w sezonie.
  let mecz = null;
  for (const k of kandydaci.slice(0, 3)) {
    let spotkania;
    try {
      spotkania = await pytaj(`/fixtures?team=${k.team.id}&date=${encodeURIComponent(data)}`);
    } catch { continue; }
    mecz = (spotkania.response || []).find((f) => {
      const t = (f && f.teams) || {};
      return toSamaDruzyna(t.home && t.home.name, gospodarz) && toSamaDruzyna(t.away && t.away.name, gosc);
    }) || null;
    if (mecz) break;
  }
  if (!mecz) {
    return res.status(200).json({
      gospodarze: null, goscie: null,
      powod: `Dostawca zna „${gospodarz}", ale nie ma meczu z „${gosc}" w dniu ${data}.`
        + " To zwykle znaczy, że tych rozgrywek nie ma w twoim planie.",
    });
  }

  // 3. SKŁADY. Ogłaszane zwykle na godzinę przed pierwszym gwizdkiem — wcześniej odpowiedź jest
  //    pusta i trzeba to powiedzieć wprost, bo to jest właśnie „jeszcze nie", a nie „nigdy".
  let sklady;
  try {
    sklady = await pytaj(`/fixtures/lineups?fixture=${mecz.fixture.id}`);
  } catch (e) {
    return res.status(502).json({ gospodarze: null, goscie: null, powod: "Nie udało się pobrać składu: " + e.message });
  }
  const grupy = sklady.response || [];
  if (!grupy.length) {
    return res.status(200).json({
      gospodarze: null, goscie: null,
      powod: "Mecz znaleziony, ale składów jeszcze nie ogłoszono. Zwykle pojawiają się na godzinę"
        + " przed pierwszym gwizdkiem — spróbuj później.",
      mecz: { id: mecz.fixture.id, data: mecz.fixture.date },
    });
  }

  const zloz = (nazwa) => {
    const g = grupy.find((x) => toSamaDruzyna(x.team && x.team.name, nazwa));
    if (!g) return null;
    const zawodnicy = [
      ...(g.startXI || []).map((p) => naZawodnika(p, false)),
      ...(g.substitutes || []).map((p) => naZawodnika(p, true)),
    ].filter(Boolean);
    if (!zawodnicy.length) return null;
    return { nazwa: (g.team && g.team.name) || nazwa, zawodnicy };
  };

  const wynikG = zloz(gospodarz);
  const wynikS = zloz(gosc);
  if (!wynikG && !wynikS) {
    return res.status(200).json({
      gospodarze: null, goscie: null,
      powod: "Składy są, ale ich nazwy drużyn nie zgadzają się z nazwą meczu w obserwacji.",
      znalezione: grupy.map((g) => ({ nazwa: g.team && g.team.name, ilu: (g.startXI || []).length })),
    });
  }

  return res.status(200).json({
    gospodarze: wynikG, goscie: wynikS,
    zrodlo: "api-football",
    mecz: { id: mecz.fixture.id, data: mecz.fixture.date },
  });
}
