// COTYGODNIOWY PRZEGLĄD PRO JUNIOR SYSTEM — III I IV LIGA.
//
// Zgłoszenia (14.10.2026): „zautomatyzuj, aby raz w tygodniu system sam prześledził dane PJS
// i wyłapał zawodników na poziomie centralnym młodzieżowców", a po pierwszej wersji: „tylko
// 3 ligę zrobiłeś? 4 liga też jest potrzebna".
//
// CO ROBI: przechodzi wszystkie kluby III i IV ligi, pyta o każdy z osobna, kto zdobywa dla niego
// punkty w PJS, i dopisuje ten dorobek do kartotek. Zawodnik trafia do monitoringu i dostaje
// znacznik młodzieżowca. Kto nie ma jeszcze kartoteki — ląduje na liście do decyzji skauta.
//
// DLACZEGO WZNAWIALNY: klubów jest około 360, a serwis PZPN ma limit zapytań na minutę — przy
// pierwszym przebiegu obejmującym IV ligę zaczął po kilkudziesięciu klubach odpowiadać 429.
// Jeden przebieg funkcji tego nie przerobi, choćby dostał najdłuższy dozwolony czas. Dlatego
// przegląd pracuje z budżetem: robi tyle, ile zdąży, zapisuje, na którym klubie stanął, i kończy
// się czysto. Kolejne uruchomienie podejmuje od tego miejsca. Zadanie chodzi w poniedziałki co
// dziesięć minut przez godzinę — pierwsze buduje kolejkę, następne ją domykają, a gdy nie ma już
// czego robić, kończą się od razu.
//
// CZEGO NIE ROBI: nie zakłada kartotek od zera. PJS nie podaje rocznika ani pozycji, a kilkaset
// pustych kartotek zaśmieciłoby bazę szybciej, niż ktokolwiek zdążyłby je przejrzeć — duplikaty
// kartotek to w tym systemie problem, który już raz kosztował sporo pracy.

import {
  pjsFiltry, pjsRozgrywki, pjsTabela, pjsWojewodztwa, pjsTabelaWojewodztwa, pjsZawodnicyKlubu,
} from "./pjs.js";
import { BAZA, KLUCZ_BAZY, naglowkiBazy, PODPOWIEDZ_BRAK_KLUCZA } from "./_baza.js";

// KTÓRE LIGI PRZECHODZIMY.
//
// Niżej (V liga, klasa okręgowa, A, B) to kolejne 72 grupy i grubo ponad tysiąc klubów. Dla klubu
// z III ligi wartość takiej listy jest znikoma, a przegląd ciągnąłby się godzinami. Gdyby były
// potrzebne, wystarczy dopisać nazwę tutaj — mechanizm wznawiania udźwignie dowolną długość.
const LIGI_DO_PRZEGLADU = ["Trzecia liga", "Czwarta liga"];

// Ile sekund jedno uruchomienie poświęca na odpytywanie klubów. Reszta budżetu funkcji
// (maxDuration 120) zostaje na zbudowanie kolejki, odczyt kartotek i zapis wyniku.
const BUDZET_SEKUND = 70;
// Tyle klubów naraz. Przy dwunastu PZPN odpowiadał 429 po kilkudziesięciu zapytaniach, przy
// pięciu odpadał co czwarty klub. Cztery z przerwą między paczkami trzymają się limitu.
const PACZKA = 4;
// Przerwa między paczkami. Limit PZPN jest liczony na minutę, więc chodzi o średnie tempo,
// a nie o chwilowy szczyt — ćwierć sekundy wystarcza, żeby się w nim zmieścić.
const PRZERWA_MS = 250;
const KLUCZ_POSTEPU = "pjsPostep";
const KLUCZ_WYNIKU = "pjsPrzeglad";

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[łøđ]/g, (c) => ({ ł: "l", ø: "o", đ: "d" }[c]))
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");

// Imię i nazwisko bywają zapisane w odwrotnej kolejności i raz wielkimi literami — porównujemy
// więc ZBIÓR słów, tak samo jak przy odświeżaniu statystyk z API-Football.
const kluczNazwiska = (imie, nazwisko) =>
  [imie, nazwisko].map(norm).filter(Boolean).sort().join(" ");

// ---------- BAZA ----------

async function wczytajZawodnikow() {
  const wszyscy = [];
  for (let od = 0; ; od += 1000) {
    const r = await fetch(
      `${BAZA}/rest/v1/sbs_players?select=id,first_name,last_name,club_id,custom_fields&limit=1000&offset=${od}`,
      { headers: naglowkiBazy() },
    );
    if (!r.ok) throw new Error(`baza odpowiedziała ${r.status} przy czytaniu zawodników`);
    const porcja = await r.json();
    wszyscy.push(...porcja);
    if (porcja.length < 1000) break;
  }
  return wszyscy;
}

async function zapiszZawodnika(id, polaWlasne) {
  const r = await fetch(`${BAZA}/rest/v1/sbs_players?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...naglowkiBazy(), Prefer: "return=minimal" },
    body: JSON.stringify({ custom_fields: polaWlasne }),
  });
  if (!r.ok) throw new Error(`baza odpowiedziała ${r.status} przy zapisie zawodnika ${id}`);
}

async function czytajKv(klucz) {
  const r = await fetch(`${BAZA}/rest/v1/sbs_kv?select=value&key=eq.${encodeURIComponent(klucz)}`, {
    headers: naglowkiBazy(),
  });
  if (!r.ok) return null;
  const wiersze = await r.json();
  if (!Array.isArray(wiersze) || !wiersze.length) return null;
  try {
    return typeof wiersze[0].value === "string" ? JSON.parse(wiersze[0].value) : wiersze[0].value;
  } catch { return null; }
}

async function zapiszKv(klucz, dane) {
  const r = await fetch(`${BAZA}/rest/v1/sbs_kv`, {
    method: "POST",
    headers: { ...naglowkiBazy(), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key: klucz, value: JSON.stringify(dane) }),
  });
  if (!r.ok) throw new Error(`baza odpowiedziała ${r.status} przy zapisie ${klucz}`);
}

// ---------- KOLEJKA KLUBÓW ----------

// Spis klubów budujemy od nowa przy każdym uruchomieniu — to tylko dwadzieścia zapytań o tabele,
// a dzięki temu nie trzeba trzymać w bazie listy na kilkaset pozycji. Kolejność jest stała, więc
// zapisany indeks wskazuje przy kolejnym przebiegu dokładnie ten sam klub.
//
// Dwie ścieżki, bo PJS inaczej dzieli oba szczeble: III liga ma cztery grupy ogólnopolskie,
// a IV liga szesnaście związków wojewódzkich. Zapytanie o grupę oddaje dla IV ligi PUSTĄ tabelę,
// bez błędu — i właśnie dlatego pierwsza wersja przeglądu jej nie widziała.
async function zbudujKolejke(sezon, ligi, bledy) {
  const kolejka = [];
  for (const liga of ligi) {
    if (liga.centralna) {
      const grupy = await pjsRozgrywki(sezon.id, liga.id);
      for (const grupa of grupy) {
        try {
          const tabela = await pjsTabela(grupa.id);
          for (const w of tabela.kluby) {
            if (w.klub && w.klub.id) {
              kolejka.push({ id: w.klub.id, nazwa: w.klub.nazwa, rozgrywki: grupa.nazwa });
            }
          }
        } catch (e) { bledy.push(`grupa ${grupa.nazwa}: ${e.message}`); }
      }
    } else {
      const zpny = await pjsWojewodztwa(sezon.id, liga.id);
      for (const zpn of zpny) {
        try {
          const tabela = await pjsTabelaWojewodztwa(sezon.id, liga.id, zpn.id);
          for (const w of tabela.kluby) {
            if (w.klub && w.klub.id) {
              kolejka.push({ id: w.klub.id, nazwa: w.klub.nazwa, rozgrywki: `${liga.nazwa} — ${zpn.nazwa}` });
            }
          }
        } catch (e) { bledy.push(`${liga.nazwa} ${zpn.nazwa}: ${e.message}`); }
      }
    }
  }
  return kolejka;
}

// ---------- PRZEBIEG ----------

export default async function handler(req, res) {
  if (!BAZA || !KLUCZ_BAZY) {
    return res.status(503).json({ error: "Brak połączenia z bazą.", jakNaprawic: PODPOWIEDZ_BRAK_KLUCZA });
  }

  const start = Date.now();
  const dzis = new Date().toISOString().slice(0, 10);
  // Wymuszenie przebiegu od zera, gdyby trzeba było powtórzyć ten sam dzień: ?odNowa=1
  const odNowa = String((req.query || {}).odNowa || "") === "1";

  try {
    const sezony = await pjsFiltry();
    const sezon = sezony[0] && sezony[0].sezon;
    if (!sezon) throw new Error("PJS nie podał żadnego sezonu");
    const ligi = (sezony[0].ligi || []).filter((l) => LIGI_DO_PRZEGLADU.includes(l.nazwa));
    if (!ligi.length) throw new Error("PJS nie podał żadnej z lig: " + LIGI_DO_PRZEGLADU.join(", "));

    // Postęp z poprzedniego uruchomienia — ale tylko z dzisiaj. Wczorajszy jest bez znaczenia:
    // nowy przegląd zaczyna od początku, bo w międzyczasie rozegrano kolejkę.
    const zapisany = odNowa ? null : await czytajKv(KLUCZ_POSTEPU);
    const wznawiamy = !!(zapisany && zapisany.data === dzis && zapisany.stan === "wTrakcie");

    // Nie ma czego robić: dzisiejszy przegląd jest domknięty. Kończymy od razu, żeby kolejne
    // uruchomienia w poniedziałkowe przedpołudnie nie odpytywały PZPN bez potrzeby.
    if (!odNowa && zapisany && zapisany.data === dzis && zapisany.stan === "gotowe") {
      return res.status(200).json({ stan: "gotowe", pominiete: "dzisiejszy przegląd już się domknął" });
    }

    const postep = wznawiamy ? zapisany : {
      data: dzis, stan: "wTrakcie", indeks: 0, przebiegow: 0,
      sprawdzonychKlubow: 0, punktujacych: 0, zaktualizowanych: 0,
      nowi: [], bledy: [], nieudane: [],
    };
    if (!Array.isArray(postep.nieudane)) postep.nieudane = [];
    postep.przebiegow++;

    const kolejka = await zbudujKolejke(sezon, ligi, postep.bledy);
    postep.klubowRazem = kolejka.length;
    // KLUBY, KTÓRE ODPADŁY NA LIMICIE, WRACAJĄ NA KONIEC KOLEJKI.
    //
    // Bez tego przegląd kończył się jako „gotowy" z dziurą: przy pierwszym przebiegu po 429
    // odpadło trzydzieści kilka klubów i nikt już do nich nie wracał. Dokładamy je za główną
    // kolejką, więc indeks nadal rośnie liniowo, a kolejny przebieg po prostu idzie dalej.
    const doPrzejscia = kolejka.concat(postep.nieudane);

    const wBazie = await wczytajZawodnikow();
    const wgNazwiska = new Map();
    for (const p of wBazie) {
      const k = kluczNazwiska(p.first_name, p.last_name);
      if (!wgNazwiska.has(k)) wgNazwiska.set(k, []);
      wgNazwiska.get(k).push(p);
    }
    // Nazwiska zebrane w poprzednich przebiegach — żeby ten sam zawodnik nie trafił na listę dwa razy.
    const juzNaLiscie = new Set((postep.nowi || []).map((n) => n.pjsId));

    let zabrakloCzasu = false;
    const nieudaneTegoPrzebiegu = [];
    while (postep.indeks < doPrzejscia.length) {
      if ((Date.now() - start) / 1000 > BUDZET_SEKUND) { zabrakloCzasu = true; break; }

      const paczka = doPrzejscia.slice(postep.indeks, postep.indeks + PACZKA);
      const odpowiedzi = await Promise.all(paczka.map(async (klub) => {
        try { return { klub, dane: await pjsZawodnicyKlubu(klub.id) }; }
        catch (e) {
          postep.bledy.push(`klub ${klub.nazwa}: ${e.message}`);
          nieudaneTegoPrzebiegu.push({ id: klub.id, nazwa: klub.nazwa, rozgrywki: klub.rozgrywki });
          return null;
        }
      }));
      postep.indeks += paczka.length;
      await new Promise((gotowe) => setTimeout(gotowe, PRZERWA_MS));

      for (const odpowiedz of odpowiedzi) {
        if (!odpowiedz) continue;
        const { klub, dane } = odpowiedz;
        postep.sprawdzonychKlubow++;

        for (const z of dane.zawodnicy) {
          if (!z.punkty) continue;
          postep.punktujacych++;
          const dorobek = {
            pjsId: z.pjsId, punkty: z.punkty, minuty: z.minuty, mecze: z.mecze,
            liczonyDoRankingu: z.liczonyDoRankingu,
            rozgrywki: klub.rozgrywki, sezon: sezon.id,
            druzynaPjs: klub.id, zaktualizowano: dzis,
          };

          const kandydaci = wgNazwiska.get(kluczNazwiska(z.imie, z.nazwisko)) || [];
          // Najpierw ten, którego już stąd zapisaliśmy — identyfikator PJS jest pewniejszy niż
          // nazwisko. Potem jedyny imiennik. Przy kilku imiennikach nie zgadujemy: wpisanie
          // dorobku do cudzej kartoteki byłoby gorsze niż jego brak.
          const poId = kandydaci.find((p) => (p.custom_fields || {}).pjs?.pjsId === z.pjsId);
          const trafiony = poId || (kandydaci.length === 1 ? kandydaci[0] : null);

          if (trafiony) {
            const pola = { ...(trafiony.custom_fields || {}) };
            const bylo = pola.pjs || {};
            // Zapisujemy tylko wtedy, gdy coś się zmieniło — inaczej co tydzień przepisywalibyśmy
            // do bazy tę samą treść.
            if (bylo.punkty === z.punkty && bylo.minuty === z.minuty && bylo.mecze === z.mecze) continue;
            pola.pjs = dorobek;
            pola.monitored = true;
            pola.mlodziezowiec = true;
            pola.watchlistRemoved = false;
            try {
              await zapiszZawodnika(trafiony.id, pola);
              postep.zaktualizowanych++;
            } catch (e) {
              postep.bledy.push(`zapis ${z.imie} ${z.nazwisko}: ${e.message}`);
            }
          } else if (!juzNaLiscie.has(z.pjsId)) {
            juzNaLiscie.add(z.pjsId);
            postep.nowi.push({
              imie: z.imie, nazwisko: z.nazwisko, klub: dane.klub ? dane.klub.nazwa : klub.nazwa,
              rozgrywki: klub.rozgrywki, punkty: z.punkty, minuty: z.minuty, mecze: z.mecze,
              pjsId: z.pjsId,
              // Kilku imienników w bazie — skaut rozstrzygnie, który to, otwierając listę.
              imiennikow: kandydaci.length,
            });
          }
        }
      }
    }

    // Lista błędów potrafi urosnąć przy kiepskim dniu serwisu PZPN — do bazy idzie początek,
    // bo czyta się ją po to, żeby stwierdzić „coś było nie tak", a nie po kolei.
    postep.bledy = postep.bledy.slice(0, 50);
    // Nieudane z TEGO przebiegu dokładamy do listy na kolejny. Te, które właśnie ponawialiśmy
    // i tym razem przeszły, z listy znikają — bo lista jest odtwarzana od zera co przebieg.
    postep.nieudane = nieudaneTegoPrzebiegu;
    postep.stan = (postep.indeks >= doPrzejscia.length && !postep.nieudane.length) ? "gotowe" : "wTrakcie";
    // Po domknięciu głównej kolejki indeks wraca na jej koniec, żeby kolejny przebieg zaczął
    // od samych ponowień, a nie przechodził wszystkiego raz jeszcze.
    if (postep.indeks >= doPrzejscia.length && postep.nieudane.length) postep.indeks = kolejka.length;
    postep.sekund = Math.round((Date.now() - start) / 10) / 100;
    await zapiszKv(KLUCZ_POSTEPU, postep);

    // Wynik dla Radaru zapisujemy po KAŻDYM przebiegu, nie dopiero na końcu — skaut, który wejdzie
    // w trakcie, ma zobaczyć to, co już wiadomo, a nie wynik sprzed tygodnia.
    const nowi = postep.nowi.slice().sort((a, b) => b.punkty - a.punkty);
    await zapiszKv(KLUCZ_WYNIKU, {
      data: dzis,
      stan: postep.stan,
      sprawdzonychKlubow: postep.sprawdzonychKlubow,
      klubowRazem: postep.klubowRazem,
      punktujacych: postep.punktujacych,
      zaktualizowanych: postep.zaktualizowanych,
      nowych: nowi.length,
      nowi: nowi.slice(0, 200),
      bledy: postep.bledy,
    });

    return res.status(200).json({
      stan: postep.stan,
      przebiegow: postep.przebiegow,
      klubow: `${postep.indeks}/${doPrzejscia.length}`,
      doPonowienia: postep.nieudane.length,
      sprawdzonychKlubow: postep.sprawdzonychKlubow,
      punktujacych: postep.punktujacych,
      zaktualizowanych: postep.zaktualizowanych,
      nowych: postep.nowi.length,
      bledow: postep.bledy.length,
      sekund: postep.sekund,
      zabrakloCzasu,
    });
  } catch (e) {
    return res.status(502).json({ error: "Przegląd PJS przerwany.", szczegoly: String((e && e.message) || e) });
  }
}
