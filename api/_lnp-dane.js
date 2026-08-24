// Dane meczu ukryte w skryptach strony „Łączy nas piłka".
//
// PO CO TO JEST: dotąd czytaliśmy stronę ŁNP jak zwykły tekst — a `htmlNaLinie` USUWA skrypty,
// zanim cokolwiek zobaczy. Strona ŁNP powstaje w przeglądarce, więc w samym tekście nie ma nazwisk
// i stąd wniosek „pusta skorupa, nie da się". Tyle że strona zbudowana w przeglądarce musi skądś
// wziąć dane — i praktycznie zawsze przywozi je ze sobą, wpisane w skrypt jako JSON. Ten plik
// zagląda właśnie tam. Jeśli dane są, mecz da się rozliczyć jednym kliknięciem, bez wklejania.
//
// CZEGO TU NIE ROBIMY: nie zgadujemy. Nie znamy nazw pól, których używa ŁNP, więc zamiast wpisywać
// je na sztywno, szukamy po KSZTAŁCIE: tablicy obiektów, z których większość ma coś wyglądającego
// na imię i nazwisko. Gdy dowodów jest za mało, oddajemy `null` i mecz idzie starą drogą —
// nigdy nie zmyślamy minut, bo błędny dorobek jest gorszy niż jego brak.

const DLUGOSC_MECZU = 90;

// ---------- 1. WYDOBYCIE JSON-ów ZE STRONY ----------

// Zrównoważony fragment JSON zaczynający się na podanej pozycji. Regularne wyrażenia nie umieją
// liczyć nawiasów, a te obiekty mają ich tysiące — więc liczymy je ręcznie, pamiętając o tekstach
// w cudzysłowach (nawias w środku napisu nie jest nawiasem) i o ucieczkach.
function wytnijObiekt(tekst, start) {
  const otw = tekst[start];
  const zam = otw === "[" ? "]" : "}";
  let glebokosc = 0, wNapisie = false, ucieczka = false;
  for (let i = start; i < tekst.length; i++) {
    const z = tekst[i];
    if (ucieczka) { ucieczka = false; continue; }
    if (z === "\\") { ucieczka = true; continue; }
    if (z === '"') { wNapisie = !wNapisie; continue; }
    if (wNapisie) continue;
    if (z === otw) glebokosc++;
    else if (z === zam) { glebokosc--; if (!glebokosc) return tekst.slice(start, i + 1); }
  }
  return null;
}

function sprobujJson(tekst) {
  if (!tekst) return null;
  try { return JSON.parse(tekst); } catch { return null; }
}

// Miejsca, w których strony budowane w przeglądarce zostawiają swoje dane. Nie wiemy, na czym
// zbudowano ŁNP, więc sprawdzamy wszystkie znane sposoby — każdy kosztuje jedno przeszukanie tekstu.
export function jsonyZeStrony(html) {
  const tekst = String(html || "");
  const znalezione = [];
  const dodaj = (v) => { if (v && typeof v === "object") znalezione.push(v); };

  // a) <script type="application/json"> … </script> — m.in. __NEXT_DATA__ (Next.js).
  for (const m of tekst.matchAll(/<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    dodaj(sprobujJson(m[1].trim()));
  }

  // b) przypisania do zmiennej globalnej: window.__NUXT__ = {…}, self.__INITIAL_STATE__ = {…}
  for (const m of tekst.matchAll(/(?:window|self|globalThis)\s*\.\s*__[A-Z_]+__\s*=\s*/g)) {
    const start = m.index + m[0].length;
    if (tekst[start] === "{" || tekst[start] === "[") dodaj(sprobujJson(wytnijObiekt(tekst, start)));
  }

  // c) Next.js w nowszym wydaniu rozsypuje dane na kawałki: self.__next_f.push([1,"…"]).
  //    Kawałki trzeba najpierw skleić, bo pojedynczy z nich urywa się w połowie obiektu.
  const kawalki = [];
  for (const m of tekst.matchAll(/__next_f\.push\(\s*\[\s*\d+\s*,\s*(".*?[^\\]")\s*\]\s*\)/gs)) {
    const rozkodowany = sprobujJson(m[1]);
    if (typeof rozkodowany === "string") kawalki.push(rozkodowany);
  }
  if (kawalki.length) {
    const sklejone = kawalki.join("");
    // W sklejonym strumieniu obiekty stoją obok siebie; bierzemy każdy, który da się odczytać.
    for (let i = 0; i < sklejone.length; i++) {
      if (sklejone[i] !== "{" && sklejone[i] !== "[") continue;
      const kandydat = wytnijObiekt(sklejone, i);
      if (!kandydat || kandydat.length < 200) continue;
      const obiekt = sprobujJson(kandydat);
      if (obiekt) { dodaj(obiekt); i += kandydat.length - 1; }
    }
  }

  return znalezione;
}

// ---------- 2. SZUKANIE SKŁADÓW W ODCZYTANYM JSON-ie ----------

const NAZWISKO = /^\p{Lu}[\p{L}'’.-]+(?:\s+\p{Lu}[\p{L}'’.-]+)+$/u;
const norm = (s) => String(s || "").toLowerCase()
  .replace(/[łøđ]/g, (c) => ({ ł: "l", ø: "o", đ: "d" }[c]))
  .normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");

const pasuje = (klucz, wzor) => wzor.test(String(klucz));

// Imię i nazwisko z obiektu zawodnika — pod dowolną nazwą pola.
function nazwaZawodnika(o) {
  if (!o || typeof o !== "object") return "";
  const wpisy = Object.entries(o).filter(([, v]) => typeof v === "string" && v.trim());
  // Najpierw pola, które same się przedstawiają.
  const zPary = () => {
    const imie = wpisy.find(([k]) => pasuje(k, /^(first_?name|imie|imię|given_?name)$/i));
    const nazw = wpisy.find(([k]) => pasuje(k, /^(last_?name|nazwisko|surname|family_?name)$/i));
    return imie && nazw ? `${imie[1].trim()} ${nazw[1].trim()}` : "";
  };
  const para = zPary();
  if (para && NAZWISKO.test(para)) return para;
  const nazwane = wpisy.find(([k, v]) =>
    pasuje(k, /(name|nazwa|zawodnik|player|osoba)/i) && NAZWISKO.test(v.trim()));
  if (nazwane) return nazwane[1].trim();
  // Ostatecznie: jakikolwiek napis wyglądający na imię i nazwisko.
  const luzem = wpisy.find(([, v]) => NAZWISKO.test(v.trim()) && v.trim().length <= 48);
  return luzem ? luzem[1].trim() : "";
}

function liczbaZPola(o, wzor, min, max) {
  for (const [k, v] of Object.entries(o || {})) {
    if (!pasuje(k, wzor)) continue;
    const n = typeof v === "number" ? v : (typeof v === "string" && /^\d{1,3}$/.test(v.trim()) ? parseInt(v, 10) : null);
    if (n != null && n >= min && n <= max) return n;
  }
  return null;
}

function flagaZPola(o, wzor) {
  for (const [k, v] of Object.entries(o || {})) {
    if (pasuje(k, wzor) && typeof v === "boolean") return v;
  }
  return null;
}

// Czy ta tablica wygląda na skład drużyny? Wymagamy siedmiu nazwisk — mniej znaczy, że trafiliśmy
// na listę sędziów, trenerów albo na zupełnie coś innego.
function czySklad(tab) {
  if (!Array.isArray(tab) || tab.length < 7 || tab.length > 40) return null;
  const osoby = tab.filter((x) => x && typeof x === "object" && !Array.isArray(x));
  if (osoby.length < 7) return null;
  const nazwiska = osoby.map(nazwaZawodnika).filter(Boolean);
  if (nazwiska.length < Math.max(7, Math.floor(osoby.length * 0.7))) return null;
  return osoby;
}

// Przechodzimy cały JSON i zbieramy każdą tablicę wyglądającą na skład, razem z drogą do niej
// (nazwy kluczy po drodze) — z drogi odczytamy potem, czy to pierwszy skład, czy ławka.
function znajdzSklady(korzen) {
  const wynik = [];
  const odwiedzone = new Set();
  (function idz(wezel, droga, rodzic) {
    if (!wezel || typeof wezel !== "object") return;
    if (odwiedzone.has(wezel)) return;
    odwiedzone.add(wezel);
    if (odwiedzone.size > 200000) return;
    if (Array.isArray(wezel)) {
      const osoby = czySklad(wezel);
      if (osoby) wynik.push({ osoby, droga, rodzic });
      wezel.forEach((v) => idz(v, droga, rodzic));
      return;
    }
    for (const [k, v] of Object.entries(wezel)) idz(v, droga.concat(k), wezel);
  })(korzen, [], null);
  return wynik;
}

// Nazwa drużyny — szukamy jej przy obiekcie, w którym stoi skład.
//
// UWAGA NA POZORNE NAZWISKA: „Anioły Garczegorze", „Stolem Gniewino", „Pogoń Szczecin" — to dwa
// słowa z wielkiej litery, czyli dokładnie to, co uznajemy za imię i nazwisko. Odrzucanie takich
// napisów kasowało prawdziwe nazwy klubów i zostawało brzydkie „homeTeam" z nazwy pola. Obiekt,
// przy którym stoi jedenastka, JEST drużyną, więc jego „name" bierzemy bez tego zastrzeżenia.
function nazwaDruzyny(rodzic, droga) {
  const napis = (k) => {
    const v = (rodzic || {})[k];
    return typeof v === "string" && v.trim() && v.trim().length <= 60 ? v.trim() : "";
  };
  // Pola, które same mówią, że chodzi o drużynę — te są pewne.
  for (const k of Object.keys(rodzic || {})) {
    if (pasuje(k, /(team|club|druzyn|drużyn|klub)/i) && napis(k)) return napis(k);
  }
  // Zwykłe „name"/„nazwa" przy składzie — to nazwa drużyny, choćby wyglądała jak nazwisko.
  for (const k of Object.keys(rodzic || {})) {
    if (pasuje(k, /^(name|nazwa|title|tytul|tytuł|display_?name|short_?name)$/i) && napis(k)) return napis(k);
  }
  for (const [k, v] of Object.entries(rodzic || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && pasuje(k, /(team|club|druzyn|klub|home|away|gospodarz|gosc|gość)/i)) {
      const n = nazwaDruzyny(v, droga);
      if (n) return n;
    }
  }
  const zDrogi = droga.slice().reverse().find((k) => /home|away|gospodarz|gosc|gość/i.test(k));
  return zDrogi ? String(zDrogi) : "";
}

const czyLawka = (droga, rodzic) => {
  const sciezka = droga.join("/");
  if (/bench|substitut|rezerw|zmiennic/i.test(sciezka)) return true;
  if (/lineup|starting|start|podstawow|wyjsciow|wyjściow|first/i.test(sciezka)) return false;
  return null;
};

// ---------- 3. SKŁAD -> MINUTY ----------

// Minuty liczymy tak samo jak przy czytaniu strony jako tekstu: kto zaczął, gra do swojego zejścia,
// kto wszedł — od swojej minuty do końca. Gdy o zmianach nic nie wiemy, NIE zgadujemy: zawodnik
// z ławki bez minuty wejścia dostaje zero i tyle.
function zlozZawodnikow(osoby, rezerwaZDrogi) {
  return osoby.map((o) => {
    const nazwaPelna = nazwaZawodnika(o);
    if (!nazwaPelna) return null;
    const numer = liczbaZPola(o, /(number|numer|shirt|koszulk|jersey)/i, 1, 99);
    const zLawki = flagaZPola(o, /(bench|substitut|rezerw|zmiennik)/i);
    const podstawowyFlaga = flagaZPola(o, /(starting|starter|podstawow|wyjsciow|wyjściow|lineup|first_?eleven)/i);
    let rezerwa = rezerwaZDrogi;
    if (zLawki != null) rezerwa = zLawki;
    if (podstawowyFlaga != null) rezerwa = !podstawowyFlaga;
    if (rezerwa == null) rezerwa = false;
    const wszedl = liczbaZPola(o, /(minute_?in|min_?in|wszedl|wszedł|substitution_?in|on_?minute|enter)/i, 1, 120);
    const zszedl = liczbaZPola(o, /(minute_?out|min_?out|zszedl|zszedł|substitution_?out|off_?minute|exit)/i, 1, 120);
    const wprost = liczbaZPola(o, /(minutes_?played|minuty_?gry|minutes|minuty)$/i, 0, 130);
    const bramkarz = !!(flagaZPola(o, /(goalkeeper|bramkarz|keeper)/i)
      || Object.entries(o).some(([k, v]) => pasuje(k, /(position|pozycja|role)/i) && /^(gk|b|bramkarz|goalkeeper)$/i.test(String(v).trim())));
    const mlodziezowiec = !!flagaZPola(o, /(mlodziezowiec|młodzieżowiec|youth|u21|young)/i);
    let minutyGry;
    if (wprost != null) minutyGry = Math.min(wprost, DLUGOSC_MECZU);
    else if (!rezerwa) minutyGry = zszedl != null ? zszedl : DLUGOSC_MECZU;
    else minutyGry = wszedl != null ? Math.max(0, DLUGOSC_MECZU - wszedl) : 0;
    return {
      numer: numer ?? null, nazwaPelna, rezerwa, bramkarz, mlodziezowiec,
      podstawowy: !rezerwa, wszedl: rezerwa ? wszedl : 0, zszedl: rezerwa ? null : zszedl,
      minutyGry,
    };
  }).filter(Boolean);
}

// ---------- 4. WEJŚCIE ----------

// Protokół jednej drużyny odczytany z danych wpisanych w skrypty strony.
// Zwraca ten sam kształt co `parseProtokolLnp`, więc reszta aplikacji nie musi wiedzieć,
// którą drogą przyszły dane. `null` znaczy „nie znalazłem" — nigdy „chyba tak".
export function protokolZeSkryptow(html, nazwaKlubu) {
  return protokolZJsonow(jsonyZeStrony(html), nazwaKlubu);
}

// To samo, ale na danych już odczytanych — używamy tego, gdy dane przychodzą nie w stronie,
// tylko osobnym zapytaniem, pod adres, który strona sama podaje.
export function protokolZJsonow(jsony, nazwaKlubu) {
  const szukany = norm(nazwaKlubu);
  if (!szukany) return null;

  const grupy = [];
  for (const korzen of jsony) {
    for (const { osoby, droga, rodzic } of znajdzSklady(korzen)) {
      grupy.push({ osoby, droga, rodzic, nazwa: nazwaDruzyny(rodzic, droga), rezerwa: czyLawka(droga, rodzic) });
    }
  }
  if (!grupy.length) return null;

  const dopasowana = (n) => {
    const x = norm(n);
    return !!x && x.length >= 4 && (x === szukany || x.includes(szukany) || szukany.includes(x));
  };
  const nasze = grupy.filter((g) => dopasowana(g.nazwa));
  if (!nasze.length) return null;

  // Pierwszy skład i ławka bywają osobnymi tablicami przy tej samej drużynie — bierzemy obie.
  const zawodnicy = [];
  const widziane = new Set();
  nasze.forEach((g) => zlozZawodnikow(g.osoby, g.rezerwa).forEach((z) => {
    const klucz = norm(z.nazwaPelna);
    if (widziane.has(klucz)) return;
    widziane.add(klucz);
    zawodnicy.push(z);
  }));
  if (zawodnicy.length < 7) return null;

  const suma = zawodnicy.reduce((n, z) => n + z.minutyGry, 0);
  const druzyny = [...new Set(grupy.map((g) => g.nazwa).filter(Boolean))];
  return {
    druzyny,
    nazwaDruzyny: nasze[0].nazwa,
    zawodnicy,
    suma,
    zgodne: suma === 11 * DLUGOSC_MECZU,
    zrodlo: "skrypty",
  };
}

// Co strona w ogóle zawiera — do komunikatu o błędzie. Bez tego każda nieudana próba kończy się
// zdaniem „nie znalazłem" i nie wiadomo, czego szukać dalej.
// Adresy, pod które strona sama sięga po dane. Zwracamy je osobno, bo służą do dwóch rzeczy:
// do komunikatu o błędzie i do tego, żeby tam po prostu zajrzeć.
export function adresyDanychZeStrony(html) {
  return [...new Set([...String(html || "").matchAll(
    /["'`](https?:\/\/[^"'`\s]*\/api\/[^"'`\s]{0,90}|\/api\/[^"'`\s]{0,90})["'`]/gi
  )].map((m) => m[1]))];
}

export function opiszZawartosc(html) {
  const jsony = jsonyZeStrony(html);
  const opis = jsony.slice(0, 6).map((j, i) => {
    const klucze = Array.isArray(j) ? `tablica(${j.length})` : Object.keys(j).slice(0, 8).join(", ");
    return `#${i + 1}: ${klucze}`;
  });
  const sklady = jsony.flatMap((j) => znajdzSklady(j));
  const tekst = String(html || "");

  // Skrypty na stronie — ile ich jest i które są duże. Duży skrypt to najczęściej właśnie dane;
  // sama ich obecność mówi, czy w ogóle jest czego szukać.
  const skrypty = [...tekst.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .map((m) => ({ znaczniki: m[1].slice(0, 90).replace(/\s+/g, " ").trim(), dlugosc: m[2].length }))
    .sort((a, b) => b.dlugosc - a.dlugosc);

  // Ślady znanych sposobów budowania stron. Gdy żadnego nie ma, dane najpewniej dociągane są
  // osobnym zapytaniem już w przeglądarce — wtedy trzeba znaleźć TEN adres, nie szukać w stronie.
  const znaki = ["__NEXT_DATA__", "__next_f", "__NUXT__", "__INITIAL_STATE__", "__APOLLO_STATE__",
    "application/json", "sveltekit", "ng-version", "data-reactroot"]
    .filter((z) => tekst.includes(z));

  // Adresy, pod które strona sama sięga po dane. To najkrótsza droga do źródła, gdy w samej
  // stronie nic nie ma.
  const adresyApi = adresyDanychZeStrony(tekst).slice(0, 10);

  return {
    dlugoscStrony: tekst.length,
    skryptow: skrypty.length,
    najwiekszeSkrypty: skrypty.slice(0, 4).map((s) => `${s.dlugosc} zn. ${s.znaczniki ? "<" + s.znaczniki + ">" : ""}`),
    znakiRozpoznawcze: znaki,
    adresyApi,
    znalezionychJsonow: jsony.length,
    kluczeNajwyzszegoPoziomu: opis,
    listOsobowychTablic: sklady.length,
    nazwyDruzyn: [...new Set(sklady.map((s) => nazwaDruzyny(s.rodzic, s.droga)).filter(Boolean))].slice(0, 8),
    przykladoweNazwiska: sklady.slice(0, 2).flatMap((s) => s.osoby.slice(0, 3).map(nazwaZawodnika)).filter(Boolean),
    poczatekStrony: tekst.slice(0, 300).replace(/\s+/g, " "),
  };
}
