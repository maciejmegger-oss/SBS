// Metryczki kadry klubu — dokładne daty urodzenia z serwisu danych Transfermarktu.
//
// DLACZEGO TEN PLIK W OGÓLE POWSTAŁ
// Pierwsze podejście czytało datę ze strony klubu, dopasowując wzorzec do układu HTML-u. Skład
// odczytał się poprawnie — nazwiska i pozycje na miejscu — a daty nie znalazł ani jednej. Wzorzec
// pisany z pamięci o cudzym HTML-u nie jest źródłem, na którym buduje się import 16 000 rekordów.
// Serwis danych, z którego korzysta sama strona transfermarkt.pl, oddaje datę jako gotowe pole.
//
// Test sprawdza REGUŁY, nie sieć: żadne zapytanie tu nie wychodzi, odpowiedzi serwisu są
// podstawione. Czy serwis naprawdę zna polskie kluby, rozstrzyga jedno prawdziwe wywołanie.
//
// Uruchomienie:  node scripts/test-tm-metryki.mjs
import fs from "node:fs";

let bledy = 0;
const sprawdz = (opis, warunek, dodatek = "") => {
  console.log(`${warunek ? "  OK  " : " BŁĄD "} ${opis}${warunek ? "" : "   " + JSON.stringify(dodatek)}`);
  if (!warunek) bledy++;
};

const handler = (await import("../api/tm-metryki.js")).default;

// Odpowiedź serwisu w kształcie, który czyta profilZTmapi.
const gracz = (id, nazwa, dataUr, pozycjaId = 14) => ({
  id,
  name: nazwa,
  lifeDates: { dateOfBirth: dataUr },
  attributes: { positionId: pozycjaId, height: 180, preferredFootId: 1 },
  relativeUrl: `/${nazwa.toLowerCase().replace(/\s+/g, "-")}/profil/spieler/${id}`,
});

// Podstawiamy fetch: serwis odpowiada tym, co mu każemy, zależnie od ścieżki.
function zPodstawionymApi(odpowiedzi, f) {
  const oryginal = globalThis.fetch;
  globalThis.fetch = async (adres) => {
    const sciezka = String(adres).replace("https://tmapi.transfermarkt.technology", "");
    const klucz = Object.keys(odpowiedzi).find((k) => sciezka.startsWith(k));
    if (!klucz) return { ok: false, status: 404, json: async () => ({}) };
    const d = odpowiedzi[klucz];
    if (d instanceof Error) throw d;
    return { ok: true, status: 200, json: async () => ({ data: d }) };
  };
  return Promise.resolve(f()).finally(() => { globalThis.fetch = oryginal; });
}

// Zaślepka odpowiedzi HTTP — zbiera to, co endpoint oddał.
function fałszywyRes() {
  const r = { kod: 0, tresc: null, naglowki: {} };
  r.setHeader = (k, v) => { r.naglowki[k] = v; };
  r.status = (k) => { r.kod = k; return r; };
  r.json = (t) => { r.tresc = t; return r; };
  return r;
}
const wywolaj = (query, odpowiedzi) =>
  zPodstawionymApi(odpowiedzi, async () => {
    const res = fałszywyRes();
    await handler({ query }, res);
    return res;
  });

const KADRA = { squad: [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }] };

console.log("\n1. Data urodzenia i kwartał");
{
  const res = await wywolaj({ klub: "9510" }, {
    "/club/9510/squad": KADRA,
    "/players": [
      gracz(1, "Styczniowy Zawodnik", "2007-01-03"),
      gracz(2, "Grudniowy Zawodnik", "2007-12-28"),
      gracz(3, "Lipcowy Zawodnik", "2009-07-19"),
    ],
  });
  sprawdz("odpowiedź 200", res.kod === 200, res.kod);
  sprawdz("trzej zawodnicy", res.tresc.zawodnicy.length === 3, res.tresc.zawodnicy.length);
  sprawdz("data co do dnia", res.tresc.zawodnicy[0].dataUrodzenia === "2007-01-03", res.tresc.zawodnicy[0]);
  // Cała rzecz polega na tym, że ci dwaj mają TEN SAM rocznik, a dzieli ich prawie rok.
  sprawdz("styczeń to I kwartał", res.tresc.zawodnicy[0].kwartal === 1, res.tresc.zawodnicy[0]);
  sprawdz("grudzień to IV kwartał", res.tresc.zawodnicy[1].kwartal === 4, res.tresc.zawodnicy[1]);
  sprawdz("ten sam rocznik mimo wszystko",
    res.tresc.zawodnicy[0].dataUrodzenia.slice(0, 4) === res.tresc.zawodnicy[1].dataUrodzenia.slice(0, 4));
  sprawdz("lipiec to III kwartał", res.tresc.zawodnicy[2].kwartal === 3, res.tresc.zawodnicy[2]);
  sprawdz("odnośnik do profilu", /transfermarkt\.pl\/.*\/profil\/spieler\/1$/.test(res.tresc.zawodnicy[0].adres),
    res.tresc.zawodnicy[0].adres);
  // Licznik istnieje, bo przy poprzedniej próbie brak dat wyglądał jak brak danych w serwisie.
  sprawdz("licznik odczytanych dat", res.tresc.zDataUrodzenia === 3, res.tresc.zDataUrodzenia);
}

console.log("\n2. Brak daty nie udaje daty");
{
  const res = await wywolaj({ klub: "9510" }, {
    "/club/9510/squad": { squad: [{ playerId: 1 }, { playerId: 2 }] },
    "/players": [gracz(1, "Bez Daty", ""), gracz(2, "Z Datą", "2008-05-11")],
  });
  sprawdz("pusta data zostaje pusta", res.tresc.zawodnicy[0].dataUrodzenia === "", res.tresc.zawodnicy[0]);
  sprawdz("bez daty nie ma kwartału", res.tresc.zawodnicy[0].kwartal === null, res.tresc.zawodnicy[0]);
  sprawdz("licznik liczy tylko odczytane", res.tresc.zDataUrodzenia === 1, res.tresc.zDataUrodzenia);
}

console.log("\n3. Ogranicznik rocznika jest opcjonalny");
{
  const dane = {
    "/club/9510/squad": KADRA,
    "/players": [gracz(1, "Stary", "1990-03-02"), gracz(2, "Młody", "2008-03-02"), gracz(3, "Nowy", "2010-03-02")],
  };
  // Przy uzupełnianiu kartoteki chcemy CAŁĄ kadrę, nie tylko młodych — stąd brak odcięcia domyślnie.
  const cala = await wywolaj({ klub: "9510" }, dane);
  sprawdz("bez „od” bierzemy wszystkich", cala.tresc.zawodnicy.length === 3, cala.tresc.zawodnicy.length);
  const mlodzi = await wywolaj({ klub: "9510", od: "2008" }, dane);
  sprawdz("z „od” odcinamy starszych", mlodzi.tresc.zawodnicy.length === 2, mlodzi.tresc.zawodnicy.map(z => z.nazwa));
}

console.log("\n4. Błędy mówią, co jest nie tak");
{
  const bezKlubu = await wywolaj({}, {});
  sprawdz("brak numeru klubu to 400", bezKlubu.kod === 400, bezKlubu.kod);
  sprawdz("i podpowiedź, gdzie go znaleźć", /verein/.test(bezKlubu.tresc.podpowiedz || ""), bezKlubu.tresc);
  const zlyRok = await wywolaj({ klub: "9510", od: "1812" }, {});
  sprawdz("zły rocznik to 400", zlyRok.kod === 400, zlyRok.kod);
  const pustaKadra = await wywolaj({ klub: "9510" }, { "/club/9510/squad": { squad: [] } });
  sprawdz("pusta kadra to 404", pustaKadra.kod === 404, pustaKadra.kod);
  const awaria = await wywolaj({ klub: "9510" }, { "/club/9510/squad": new Error("sieć padła") });
  sprawdz("awaria serwisu to 502", awaria.kod === 502, awaria.kod);
  sprawdz("z powodem w treści", /sieć padła/.test(awaria.tresc.error || ""), awaria.tresc);
}

console.log("\n5. Jedno zapytanie na czterdziestu zawodników");
{
  // Profil po profilu to kilka tysięcy żądań do cudzego serwisu. Paczkowanie jest różnicą
  // między popołudniem a tygodniem — i między wypadaniem z limitu czasu a mieszczeniem się w nim.
  const duza = { squad: Array.from({ length: 45 }, (_, i) => ({ playerId: i + 1 })) };
  let zapytan = 0;
  const oryginal = globalThis.fetch;
  globalThis.fetch = async (adres) => {
    const s = String(adres);
    if (s.includes("/players")) zapytan++;
    const d = s.includes("/squad") ? duza
      : (s.match(/ids%5B%5D=\d+|ids\[\]=\d+/g) || []).map((_, i) => gracz(i + 1, "Ktoś " + i, "2007-02-02"));
    return { ok: true, status: 200, json: async () => ({ data: d }) };
  };
  const res = fałszywyRes();
  await handler({ query: { klub: "9510" } }, res).finally(() => { globalThis.fetch = oryginal; });
  sprawdz("45 zawodników to 2 zapytania o profile", zapytan === 2, zapytan);
}

console.log(bledy ? `\nBŁĘDÓW: ${bledy}\n` : "\nWszystko w porządku.\n");
process.exit(bledy ? 1 : 0);
