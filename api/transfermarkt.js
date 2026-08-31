// Odczyt profilu zawodnika z Transfermarktu — po adresie, bez kopiowania i wklejania.
//
// PO CO TO JEST: dane, których nie ma w polskich protokołach, siedzą właśnie tam — wzrost, noga,
// agent, data końca umowy, wartość rynkowa, zdjęcie. Dotąd przepisywało się je ręcznie albo
// wklejało fragment strony, a wklejka niosła wyłącznie statystyki. Przy kilkuset zawodnikach to
// godziny przepisywania czegoś, co stoi gotowe pod adresem, który i tak mamy w kartotece.
//
// CZEMU PO STRONIE SERWERA: przeglądarka nie pobierze strony z obcego serwisu (blokada CORS),
// a Transfermarkt oddaje serwerowi stronę bez przeszkód, o ile przedstawi się jak zwykła
// przeglądarka. Sprawdzone: 200 i pełny dokument.
//
// CZEGO TU NIE MA: statystyk meczowych. Te liczymy z protokołów PZPN i z 90minut — źródeł
// związkowych. Transfermarkt służy do opisu zawodnika, nie do liczenia jego minut.

const NAGLOWKI = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept-Language": "pl-PL,pl;q=0.9",
  "Accept": "text/html,application/xhtml+xml",
};

const MIESIACE = {
  sty: "01", lut: "02", mar: "03", kwi: "04", maj: "05", cze: "06",
  lip: "07", sie: "08", wrz: "09", paź: "10", paz: "10", lis: "11", gru: "12",
};

// „1 paź 2002 (23)" → „2002-10-01". Rok bez dnia i miesiąca oddajemy jako sam rok — lepiej mieć
// rocznik niż nic, a data urodzenia bywa na TM nieujawniona.
function dataZTekstu(s) {
  const t = String(s || "").trim();
  const m = t.match(/(\d{1,2})\s+([a-ząćęłńóśźż]{3,})\.?\s+(\d{4})/i);
  if (m) {
    const mies = MIESIACE[m[2].toLowerCase().slice(0, 3)];
    if (mies) return `${m[3]}-${mies}-${String(m[1]).padStart(2, "0")}`;
  }
  const rok = t.match(/(19|20)\d{2}/);
  return rok ? rok[0] : "";
}

const odsloniec = (s) =>
  String(s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

// Strona podaje dane jako pary „etykieta:" i wartość w kolejnych wierszach. Czytamy je tak, jak
// stoją — to znacznie odporniejsze niż celowanie w klasy CSS, które Transfermarkt zmienia.
function wartoscPo(linie, wzor) {
  for (let i = 0; i < linie.length; i++) {
    if (!wzor.test(linie[i])) continue;
    for (let j = i + 1; j < Math.min(i + 4, linie.length); j++) {
      const v = linie[j];
      if (v && !/:$/.test(v)) return v;
    }
  }
  return "";
}

export default async function handler(req, res) {
  const adres = String((req.query && req.query.url) || "");
  if (!/^https?:\/\/(www\.)?transfermarkt\.[a-z.]+\/.+\/profil\/spieler\/\d+/i.test(adres)) {
    return res.status(400).json({
      error: "To nie jest adres profilu zawodnika na Transfermarkcie.",
      podpowiedz: "Adres wygląda tak: https://www.transfermarkt.pl/imie-nazwisko/profil/spieler/123456",
    });
  }

  let html;
  try {
    const odp = await fetch(adres, { headers: NAGLOWKI });
    if (!odp.ok) {
      return res.status(502).json({
        error: `Transfermarkt odpowiedział kodem ${odp.status}.`,
        podpowiedz: odp.status === 403 || odp.status === 429
          ? "Serwis chwilowo odrzuca zapytania — spróbuj za kilka minut."
          : "Sprawdź, czy adres profilu jest poprawny.",
      });
    }
    html = await odp.text();
  } catch (e) {
    return res.status(502).json({ error: "Nie udało się połączyć z Transfermarktem: " + String((e && e.message) || e) });
  }

  const linie = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map(odsloniec)
    .filter(Boolean);

  const wzrostTekst = wartoscPo(linie, /^Wzrost:?$/i);
  const wzrostCm = (() => {
    const m = wzrostTekst.match(/(\d)[,.](\d{2})\s*m/);
    if (m) return Number(m[1]) * 100 + Number(m[2]);
    const cm = wzrostTekst.match(/(\d{3})\s*cm/);
    return cm ? Number(cm[1]) : null;
  })();

  const nogaTekst = wartoscPo(linie, /^Noga:?$/i).toLowerCase();
  const noga = /prawo/.test(nogaTekst) ? "Prawa" : /lewo/.test(nogaTekst) ? "Lewa" : /obie|obu/.test(nogaTekst) ? "Obie" : "";

  // Pozycja na TM bywa złożona („Napastnik - Prawy napastnik") — bierzemy człon główny, bo to on
  // odpowiada nazewnictwu w kartotece.
  const pozycjaTekst = wartoscPo(linie, /^Pozycja:?$/i);
  const pozycjaGlowna = pozycjaTekst.split(/\s*[-–]\s*/)[0].trim();

  // Transfermarkt nazywa pozycje po swojemu i drobniej niż kartoteka („Prawy napastnik",
  // „Środkowy pomocnik"). Przekładamy na osiem nazw używanych w SBS, bo to one stoją na mapie
  // pozycji — nieprzełożona nazwa nie trafiłaby na żadne pole boiska.
  const pozycjaSBS = (() => {
    const t = pozycjaTekst.toLowerCase();
    if (/bramkarz/.test(t)) return "Bramkarz";
    if (/skrzyd/.test(t)) return "Skrzydłowy";
    if (/napastnik|snajper/.test(t)) return "Napastnik";
    if (/ofensywny pomocnik|pomocnik ofensywny/.test(t)) return "Pomocnik ofensywny";
    if (/defensywny pomocnik|pomocnik defensywny/.test(t)) return "Pomocnik defensywny";
    if (/pomocnik/.test(t)) return "Pomocnik środkowy";
    if (/(prawy|lewy)\s+obro/.test(t) || /obro[ńn]ca boczny/.test(t)) return "Obrońca boczny";
    if (/obro/.test(t)) return "Obrońca środkowy";
    return "";
  })();

  const menadzer = wartoscPo(linie, /^Menad[żz]er/i);
  const wartoscM = html.match(/class="[^"]*data-header__market-value-wrapper[^"]*"[^>]*>([\s\S]{0,200}?)<\/a>/i);
  const wartoscRynkowa = wartoscM
    ? odsloniec(wartoscM[1].replace(/<[^>]+>/g, " ")).replace(/Ostatnia zmiana.*$/i, "").trim()
    : "";
  const zdjecie = (html.match(/<img[^>]+src="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/[^"]+)"/i) || [])[1] || "";

  return res.status(200).json({
    zrodlo: adres,
    nazwaPelna: wartoscPo(linie, /^Nazwisko w kraju/i),
    dataUrodzenia: dataZTekstu(wartoscPo(linie, /^Urodz|^Data urodzenia/i)),
    miejsceUrodzenia: wartoscPo(linie, /^Miejsce urodzenia:?$/i),
    wzrostCm,
    narodowosc: wartoscPo(linie, /^Narodowo/i),
    pozycja: pozycjaSBS || pozycjaGlowna,
    pozycjaPelna: pozycjaTekst,
    noga,
    menadzer: menadzer && !/^-$/.test(menadzer) ? menadzer : "",
    klub: wartoscPo(linie, /^Obecny klub:?$/i),
    wDruzynieOd: dataZTekstu(wartoscPo(linie, /^W dru[żz]ynie od:?$/i)),
    umowaDo: dataZTekstu(wartoscPo(linie, /^Umowa do:?$/i)),
    wartoscRynkowa,
    zdjecie,
  });
}
