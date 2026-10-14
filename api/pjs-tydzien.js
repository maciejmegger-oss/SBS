// COTYGODNIOWY PRZEGLĄD PRO JUNIOR SYSTEM NA SZCZEBLU CENTRALNYM.
//
// Zgłoszenie (14.10.2026): „zautomatyzuj, aby raz w tygodniu system sam prześledził dane PJS
// i wyłapał zawodników na poziomie centralnym młodzieżowców".
//
// CO ROBI: przechodzi wszystkie grupy ligi oznaczonej w PJS jako centralna (pole `grouping` = 1,
// dziś to III liga), pyta o każdy klub z osobna i zbiera zawodników, którzy zdobywają punkty.
// Każdego dopisuje do monitoringu, oznacza jako młodzieżowca i zapisuje dorobek PJS.
//
// CZEGO NIE ROBI: nie zakłada kartotek od zera. Nowe nazwisko ląduje na liście „do obejrzenia",
// którą skaut otwiera w Radarze młodzieży i decyduje sam. Automat, który sam dopisuje setki
// kartotek bez rocznika i pozycji, zaśmieciłby bazę szybciej, niż ktokolwiek zdążyłby to przejrzeć
// — a duplikaty kartotek to w tym systemie problem, który już raz kosztował sporo pracy.
//
// KOSZT: jedno zapytanie o filtry, jedno o grupy, po jednym na grupę i po jednym na klub.
// Przy czterech grupach po osiemnaście klubów to około 80 zapytań raz w tygodniu.

import { pjsFiltry, pjsRozgrywki, pjsTabela, pjsZawodnicyKlubu } from "./pjs.js";
import { BAZA, KLUCZ_BAZY, naglowkiBazy, PODPOWIEDZ_BRAK_KLUCZA } from "./_baza.js";

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

export default async function handler(req, res) {
  if (!BAZA || !KLUCZ_BAZY) {
    return res.status(503).json({ error: "Brak połączenia z bazą.", jakNaprawic: PODPOWIEDZ_BRAK_KLUCZA });
  }

  const dzis = new Date().toISOString().slice(0, 10);
  const podsumowanie = {
    data: dzis, sprawdzonychKlubow: 0, punktujacych: 0,
    zaktualizowanych: 0, nowych: 0, bledy: [],
  };
  const nowi = [];

  try {
    const sezony = await pjsFiltry();
    const biezacy = sezony[0];
    if (!biezacy) throw new Error("PJS nie podał żadnego sezonu");

    const centralne = biezacy.ligi.filter((l) => l.centralna);
    if (!centralne.length) throw new Error("PJS nie podał żadnej ligi na szczeblu centralnym");

    const wBazie = await wczytajZawodnikow();
    const wgNazwiska = new Map();
    for (const p of wBazie) {
      const k = kluczNazwiska(p.first_name, p.last_name);
      if (!wgNazwiska.has(k)) wgNazwiska.set(k, []);
      wgNazwiska.get(k).push(p);
    }

    // Najpierw spis wszystkich klubow do sprawdzenia, potem odpytanie paczkami. Jeden po drugim
    // to przy 72 klubach 59 sekund niemal samego czekania na siec — za blisko limitu funkcji.
    const doSprawdzenia = [];
    for (const liga of centralne) {
      const grupy = await pjsRozgrywki(biezacy.sezon.id, liga.id);
      for (const grupa of grupy) {
        try {
          const tabela = await pjsTabela(grupa.id);
          for (const wiersz of tabela.kluby) {
            if (wiersz.klub && wiersz.klub.id) doSprawdzenia.push({ grupa, wiersz });
          }
        } catch (e) {
          podsumowanie.bledy.push(`grupa ${grupa.nazwa}: ${e.message}`);
        }
      }
    }

    const PACZKA = 6;   // tyle rownoleglych zapytan do PZPN — szybko, a serwisu nie zalewamy
    for (let od = 0; od < doSprawdzenia.length; od += PACZKA) {
      const paczka = doSprawdzenia.slice(od, od + PACZKA);
      const odpowiedzi = await Promise.all(paczka.map(async ({ grupa, wiersz }) => {
        try {
          return { grupa, wiersz, dane: await pjsZawodnicyKlubu(wiersz.klub.id) };
        } catch (e) {
          podsumowanie.bledy.push(`klub ${wiersz.klub.nazwa}: ${e.message}`);
          return null;
        }
      }));

      for (const odpowiedz of odpowiedzi) {
        if (!odpowiedz) continue;
        const { grupa, wiersz, dane } = odpowiedz;
        const idKlubu = wiersz.klub.id;
        podsumowanie.sprawdzonychKlubow++;

        for (const z of dane.zawodnicy) {
          if (!z.punkty) continue;
          podsumowanie.punktujacych++;
          const dorobek = {
            pjsId: z.pjsId, punkty: z.punkty, minuty: z.minuty, mecze: z.mecze,
            liczonyDoRankingu: z.liczonyDoRankingu,
            rozgrywki: grupa.nazwa, sezon: biezacy.sezon.id,
            druzynaPjs: idKlubu, zaktualizowano: dzis,
          };

          const kandydaci = wgNazwiska.get(kluczNazwiska(z.imie, z.nazwisko)) || [];
          // Najpierw ten, którego już stąd zapisaliśmy — identyfikator PJS jest pewniejszy
          // niż nazwisko. Potem jedyny imiennik. Przy kilku imiennikach nie zgadujemy:
          // wybranie złodziejskiej kartoteki byłoby gorsze niż jej brak.
          const poId = kandydaci.find((p) => (p.custom_fields || {}).pjs?.pjsId === z.pjsId);
          const trafiony = poId || (kandydaci.length === 1 ? kandydaci[0] : null);

          if (trafiony) {
            const pola = { ...(trafiony.custom_fields || {}) };
            const bylo = pola.pjs || {};
            // Zapisujemy tylko wtedy, gdy coś się zmieniło — inaczej co tydzień
            // przepisywalibyśmy do bazy tę samą treść.
            if (bylo.punkty === z.punkty && bylo.minuty === z.minuty && bylo.mecze === z.mecze) continue;
            pola.pjs = dorobek;
            pola.monitored = true;
            pola.mlodziezowiec = true;
            pola.watchlistRemoved = false;
            try {
              await zapiszZawodnika(trafiony.id, pola);
              podsumowanie.zaktualizowanych++;
            } catch (e) {
              podsumowanie.bledy.push(`zapis ${z.imie} ${z.nazwisko}: ${e.message}`);
            }
          } else {
            nowi.push({
              imie: z.imie, nazwisko: z.nazwisko, klub: dane.klub ? dane.klub.nazwa : "",
              rozgrywki: grupa.nazwa, punkty: z.punkty, minuty: z.minuty, mecze: z.mecze,
              pjsId: z.pjsId,
              // Kilku imienników w bazie — skaut rozstrzygnie, który to, otwierając listę.
              imiennikow: kandydaci.length,
            });
          }
        }
      }
    }

    // Nowi idą do sbs_kv, skąd czyta ich Radar młodzieży. Trzymamy najmocniejszych na górze:
    // lista ma być do przejrzenia przy kawie, a nie do przewijania.
    nowi.sort((a, b) => b.punkty - a.punkty);
    podsumowanie.nowych = nowi.length;
    await zapiszPrzeglad({ ...podsumowanie, nowi: nowi.slice(0, 200) });

    return res.status(200).json(podsumowanie);
  } catch (e) {
    podsumowanie.bledy.push(String((e && e.message) || e));
    return res.status(502).json(podsumowanie);
  }
}

// Wynik przeglądu ląduje w sbs_kv pod jednym kluczem — tą samą drogą, którą system zapamiętuje
// terminarz i inne rzeczy bez własnej tabeli. Radar czyta go razem z resztą ustawień.
async function zapiszPrzeglad(wynik) {
  const r = await fetch(`${BAZA}/rest/v1/sbs_kv`, {
    method: "POST",
    headers: { ...naglowkiBazy(), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key: "pjsPrzeglad", value: JSON.stringify(wynik) }),
  });
  if (!r.ok) throw new Error(`baza odpowiedziała ${r.status} przy zapisie przeglądu PJS`);
}
