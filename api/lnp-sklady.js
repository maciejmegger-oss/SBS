// SKŁADY MECZU Z „ŁĄCZY NAS PIŁKA" — PRZED PIERWSZYM GWIZDKIEM.
//
// PO CO TO JEST. Dotąd skład wpisywało się na trybunie ręcznie albo kopiowało z ekranu ŁNP.
// Kopiowanie tekstu ze zrzutu to sztuczka iPhone'a — na Androidzie jej nie ma, więc scout z innym
// telefonem zostawał z przepisywaniem dwudziestu dwóch nazwisk na kwadrans przed meczem. Stąd
// droga przez serwer: telefon podaje adres meczu, serwer czyta stronę i oddaje gotowe składy.
//
// DLACZEGO PRZEZ SERWER, A NIE Z TELEFONU. Panel stoi pod naszym adresem, a strona ŁNP pod swoim.
// Przeglądarka nie pozwoli jednej stronie czytać drugiej (zasady pochodzenia) — i to nie jest do
// obejścia z panelu. Serwer żadnym takim ograniczeniem nie jest objęty.
//
// CO TU JEST NOWE, A CO NIE. Czytanie stron ŁNP działa u nas od dawna: tą samą drogą rozliczamy
// mecze IV ligi (patrz api/_lnp.js). Strona buduje się w przeglądarce, więc w samym jej tekście
// nazwisk nie ma — dane przyjeżdżają osobnym zapytaniem, a adresy tych zapytań strona podaje
// w swoim kodzie. Nowe jest tylko to, że bierzemy z nich SKŁAD, a nie minuty gry: przed meczem
// minut jeszcze nie ma, składy już są.
//
// CZEGO TU NIE ROBIMY: nie zgadujemy. Gdy danych nie ma albo nie da się ich przypisać do drużyn,
// oddajemy pusty wynik Z POWODEM — panel pokaże go scoutowi i zostanie wklejanie ręczne. Skład
// zmyślony jest gorszy niż jego brak: przy nazwiskach, których nie było na boisku, cała obserwacja
// idzie do kosza.

import { czyLnp, pobierzLnp, daneStrony, opiszZawartosc, ostatniOdczytLnp } from "./_lnp.js";
import { jsonyZeStrony, skladyZJsonow } from "./_lnp-dane.js";

const pierwszy = (v) => String((Array.isArray(v) ? v[0] : v) || "").trim();

// Nazwa klubu sprowadzona do porównywalnej postaci: bez ogonków, form prawnych i członów
// oznaczających zespół. „GÓRNIK ZABRZE S.A." i „Górnik Zabrze" mają tu wyjść tym samym.
const OGONKI = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
const norm = (s) => String(s || "").toLowerCase()
  .replace(/[ąćęłńóśźż]/g, (c) => OGONKI[c] || c)
  .replace(/\bs\s*\.?\s*a\s*\.?\b/g, " ")
  .replace(/\bsp\s*\.?\s*z\s*o\s*\.?\s*o\s*\.?\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const slowa = (s) => norm(s).split(" ").filter((w) => w.length > 2);

// Czy te dwie nazwy to ta sama drużyna. Po SŁOWACH, nie po zawieraniu tekstu: „Arka II Gdynia"
// i „Arka Gdynia II" to jeden zespół, a żaden z tych napisów nie zawiera drugiego.
function toSamaDruzyna(a, b) {
  const x = slowa(a), y = slowa(b);
  if (!x.length || !y.length) return false;
  return x.every((w) => y.includes(w)) || y.every((w) => x.includes(w));
}

export default async function handler(req, res) {
  const adres = pierwszy(req.query.url);
  const gospodarz = pierwszy(req.query.home);
  const gosc = pierwszy(req.query.away);

  if (!adres) return res.status(400).json({ error: "Podaj adres meczu w ŁNP (parametr url)." });
  // Adres bierze się od użytkownika, więc sprawdzamy go, zanim cokolwiek pobierzemy: bez tego
  // ten punkt dostępowy byłby otwartym pośrednikiem do dowolnego miejsca w internecie.
  if (!czyLnp(adres)) {
    return res.status(400).json({ error: "To nie jest adres z laczynaspilka.pl." });
  }

  let html;
  try {
    html = await pobierzLnp(adres);
  } catch (e) {
    return res.status(504).json({ error: "Nie udało się otworzyć strony meczu: " + e.message });
  }

  // Najpierw dane wpisane wprost w stronę, potem te spod adresów, które strona sama podaje.
  let grupy = skladyZJsonow(jsonyZeStrony(html));
  let skad = "dane wpisane w stronę";
  if (!grupy.length) {
    try {
      const dodatkowe = await daneStrony(html, adres);
      grupy = skladyZJsonow(dodatkowe);
      skad = "dane spod adresu podanego przez stronę";
    } catch (e) {
      return res.status(504).json({ error: "Strona odpowiedziała, ale jej dane są nieosiągalne: " + e.message });
    }
  }

  if (!grupy.length) {
    // Mówimy, co na tej stronie w ogóle było — bez tego „nie znalazłem" nie daje się odróżnić
    // od „skład jeszcze nie został ogłoszony", a to dwie różne sytuacje i różne reakcje.
    // Diagnoza wchodzi w sam powód — patrz api/lnp-mecz.js. Telefon na stadionie bywa o kilka
    // wdrożeń z tyłu i wtedy jedyne, co dociera do scouta, to to zdanie.
    const zawartosc = opiszZawartosc(html);
    const slady = (zawartosc.znakiRozpoznawcze || []).slice(0, 2).join("+") || "bez śladów danych w stronie";
    // Wynik OBU prób pobrania wchodzi w powód. Rozstrzyga rzecz, której inaczej nie da się
    // ustalić: czy strona jest pusta dla każdego, czy tylko dla nas — patrz pobierzLnp.
    const listaProb = ostatniOdczytLnp.proby || [];
    const proby = listaProb.join(" | ");

    // SAM SZKIELET PRZY OBU PYTANIACH — I TO NIE JEST „JESZCZE".
    //
    // Sprawdzone na prawdziwym meczu: oba pytania, nasze i przeglądarki, dostały odpowiedź co do
    // bajta tę samą — 25 560 znaków szkieletu, zero śladów danych, zero adresów, pod które strona
    // sama sięga. ŁNP nie podaje serwerowi składu w ogóle, więc czekanie nic nie zmieni.
    //
    // Zdanie „nie ma JESZCZE składów" byłoby tu kłamstwem przez sugestię: obiecywałoby, że za
    // kwadrans się pojawi, i kazałoby scoutowi odświeżać w kółko coś, co nie ma jak zadziałać.
    // Mówimy więc wprost i oddajemy znacznik, po którym panel przestaje pytać.
    const samSzkielet = listaProb.length > 0 && listaProb.every((p) => /sam szkielet/.test(p));
    if (samSzkielet) {
      // Co dały PLIKI Z KODEM tej strony. To ostatnia rzecz, która może tę drogę otworzyć: adresy
      // danych stoją w kodzie, nie w samej stronie. Bez tego „nie znalazłem adresów" nie odróżnia
      // się od „nie udało się tych plików pobrać" — a to dwie różne diagnozy.
      const pliki = ostatniOdczytLnp.plikow || 0;
      const zKodu = (ostatniOdczytLnp.adresyZKodu || []).length;
      const slad = `plików z kodem ${pliki} · adresów w kodzie ${zKodu}`
        + ((ostatniOdczytLnp.skrypty || []).length ? ` · ${ostatniOdczytLnp.skrypty.join(" ; ")}` : "");
      return res.status(200).json({
        gospodarze: null, goscie: null,
        bezSzans: true,
        powod: "ŁNP nie wysyła składu poza przeglądarkę — ta strona jest pusta także dla serwera,"
          + " więc czekanie nic nie da. Skład trzeba wpisać albo wkleić."
          + ` [${Math.round((zawartosc.dlugoscStrony || 0) / 1024)} kB · ${proby} · ${slad}]`,
        zawartosc,
        proby: listaProb,
        pliki: {
          plikow: pliki,
          skrypty: ostatniOdczytLnp.skrypty || [],
          adresyZKodu: ostatniOdczytLnp.adresyZKodu || [],
          szablony: ostatniOdczytLnp.szablony || [],
          skad: ostatniOdczytLnp.skadSlad || "",
        },
      });
    }

    return res.status(200).json({
      gospodarze: null, goscie: null,
      powod: `Na tej stronie nie ma jeszcze składów. [${Math.round((zawartosc.dlugoscStrony || 0) / 1024)} kB`
        + ` · skryptów ${zawartosc.skryptow || 0} · ${slady}`
        + ` · adresów danych ${(zawartosc.adresyApi || []).length}`
        + (proby ? ` · próby: ${proby}` : "") + "]",
      zawartosc,
      proby: listaProb,
    });
  }

  // Grupy tej samej drużyny (pierwszy skład i ławka bywają osobno) sklejamy w jedną.
  const scal = (nazwa) => {
    const nasze = grupy.filter((g) => toSamaDruzyna(g.nazwa, nazwa));
    if (!nasze.length) return null;
    const widziane = new Set();
    const zawodnicy = [];
    for (const g of nasze) {
      for (const z of g.zawodnicy) {
        const klucz = norm(z.nazwa);
        if (!klucz || widziane.has(klucz)) continue;
        widziane.add(klucz);
        zawodnicy.push(z);
      }
    }
    return { nazwa: nasze[0].nazwa || nazwa, zawodnicy };
  };

  const wynikG = gospodarz ? scal(gospodarz) : null;
  const wynikS = gosc ? scal(gosc) : null;

  // Nazwy z obserwacji nie pasują do niczego na stronie? Oddajemy, co strona ma, pod własnymi
  // nazwami — scout zobaczy, czyje to składy, i rozstrzygnie sam. To lepsze niż puste „nie
  // znalazłem" przy stronie, na której składy wyraźnie są.
  if (!wynikG && !wynikS) {
    return res.status(200).json({
      gospodarze: null, goscie: null,
      powod: "Składy są, ale ich nazwy drużyn nie zgadzają się z nazwą meczu w obserwacji.",
      znalezione: grupy.map((g) => ({ nazwa: g.nazwa, ilu: g.zawodnicy.length })),
      zrodlo: skad,
    });
  }

  return res.status(200).json({ gospodarze: wynikG, goscie: wynikS, zrodlo: skad });
}
