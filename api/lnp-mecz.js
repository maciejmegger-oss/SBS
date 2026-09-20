// ADRES MECZU Z LISTY MECZÓW W „ŁĄCZY NAS PIŁKA".
//
// Ostatni brakujący kawałek automatycznego wgrywania składów. Skład spod adresu meczu pobiera
// api/lnp-sklady.js — ale ten adres ktoś musiał wcześniej wkleić ręcznie, bo identyfikatora meczu
// (f0cf66a2-633b-4df7-a602-4cdfe2d564d9) nie da się ułożyć z nazw drużyn i daty.
//
// Tutaj bierzemy go z listy meczów: strony klubu albo grupy, gdzie każdy wiersz to data, dwie
// drużyny i odnośnik. Scout podaje adres takiej listy RAZ, przy klubie w kartotece, a panel
// odnajduje na niej właściwy mecz sam — przed każdym kolejnym spotkaniem.
//
// Zwracamy SAM ADRES, nie skład. Dzięki temu oba punkty zostają proste i osobno sprawdzalne,
// a panel może adres zapamiętać przy obserwacji i nie szukać go drugi raz.

import { czyLnp, pobierzLnp, daneStrony, opiszZawartosc } from "./_lnp.js";
import { jsonyZeStrony } from "./_lnp-dane.js";
import { meczeZHtml, meczeZJsonow, znajdzMecz } from "./_lnp-terminarz.js";

const pierwszy = (v) => String((Array.isArray(v) ? v[0] : v) || "").trim();

// Listy z kilku źródeł w jedną. Ten sam mecz bywa i w HTML-u, i w danych — zostawiamy wpis
// bogatszy, czyli ten, który ma datę.
function scal(...listy) {
  const wg = new Map();
  for (const lista of listy) {
    for (const m of lista) {
      const juz = wg.get(m.id);
      if (!juz) { wg.set(m.id, m); continue; }
      if (!juz.data && m.data) wg.set(m.id, { ...m, opis: `${juz.opis || ""} ${m.opis || ""}`.trim() });
      else if (m.opis && m.opis !== juz.opis) juz.opis = `${juz.opis || ""} ${m.opis}`.trim();
    }
  }
  return [...wg.values()];
}

// Najkrótszy opis tego, czym okazała się czytana strona. Mieści się w jednym powiadomieniu na
// telefonie, a rozstrzyga rzecz, której inaczej nie da się ustalić bez dostępu do ŁNP: czy strona
// niesie treść, czy tylko rusztowanie doklejane potem w przeglądarce.
function krotkaDiagnoza(adres, z) {
  const czesci = [];
  try { czesci.push(new URL(adres).pathname.slice(0, 40)); } catch { /* adres i tak sprawdzony */ }
  czesci.push(`${Math.round((z.dlugoscStrony || 0) / 1024)} kB`);
  czesci.push(`skryptów ${z.skryptow || 0}`);
  if ((z.znakiRozpoznawcze || []).length) czesci.push(z.znakiRozpoznawcze.slice(0, 2).join("+"));
  else czesci.push("bez śladów danych w stronie");
  if ((z.adresyApi || []).length) czesci.push(`adresów danych ${z.adresyApi.length}`);
  if (z.znalezionychJsonow) czesci.push(`json ${z.znalezionychJsonow}`);
  return "[" + czesci.join(" · ") + "]";
}

export default async function handler(req, res) {
  const adres = pierwszy(req.query.url);
  const gospodarz = pierwszy(req.query.home);
  const gosc = pierwszy(req.query.away);
  const data = pierwszy(req.query.date);

  if (!adres) return res.status(400).json({ error: "Podaj adres listy meczów w ŁNP (parametr url)." });
  // Adres bierze się od użytkownika, więc sprawdzamy go, zanim cokolwiek pobierzemy: bez tego
  // ten punkt dostępowy byłby otwartym pośrednikiem do dowolnego miejsca w internecie.
  if (!czyLnp(adres)) return res.status(400).json({ error: "To nie jest adres z laczynaspilka.pl." });

  let html;
  try {
    html = await pobierzLnp(adres);
  } catch (e) {
    return res.status(504).json({ error: "Nie udało się otworzyć listy meczów: " + e.message });
  }

  let mecze = scal(meczeZHtml(html, adres), meczeZJsonow(jsonyZeStrony(html), adres));
  let skad = "sama strona";

  // Strona zbudowana w przeglądarce nie ma w sobie ani odnośników, ani danych — wtedy tą samą
  // drogą co przy składach sięgamy po dane spod adresów, które strona podaje w swoim kodzie.
  if (!mecze.length) {
    try {
      mecze = meczeZJsonow(await daneStrony(html, adres), adres);
      skad = "dane spod adresu podanego przez stronę";
    } catch (e) {
      return res.status(504).json({ error: "Strona odpowiedziała, ale jej dane są nieosiągalne: " + e.message });
    }
  }

  if (!mecze.length) {
    // ADRES, KTÓRY CZYTALIŚMY, MUSI WRÓCIĆ W ODPOWIEDZI. Bez tego „nie znalazłem listy meczów"
    // nie daje się odróżnić od „czytałem nie tę stronę" — a panel ma kilka źródeł adresu
    // (podany na telefonie, pole przy klubie, terminarz rozgrywek z systemu) i przy błędzie
    // pierwszym pytaniem jest, które z nich poszło do boju.
    const zawartosc = opiszZawartosc(html);
    return res.status(200).json({
      adres: null,
      // DIAGNOZA WCHODZI W SAM POWÓD, NIE TYLKO OBOK NIEGO.
      //
      // Panel pokazuje „powod" od pierwszej wersji, a bogatsze pola („zawartosc", „adresSzukany")
      // umie wyświetlić dopiero wersja v26. Telefon na stadionie bywa o kilka wdrożeń z tyłu —
      // i wtedy jedyne, co dociera do scouta, to właśnie to zdanie. Skoro tak, to ono musi nieść
      // rozstrzygnięcie: czy strona w ogóle ma treść, czy buduje się dopiero w przeglądarce
      // i pod jakie adresy sama sięga. Inaczej diagnoza czeka na aktualizację, która nie
      // przychodzi, a my stoimy w miejscu.
      powod: "Na tej stronie nie znalazłem listy meczów. " + krotkaDiagnoza(adres, zawartosc),
      adresSzukany: adres,
      zawartosc,
    });
  }

  const { mecz, powod, kandydaci } = znajdzMecz(mecze, { gospodarz, gosc, data });
  if (!mecz) {
    return res.status(200).json({
      adres: null, powod, kandydaci, zrodlo: skad, ilu: mecze.length, adresSzukany: adres,
    });
  }

  return res.status(200).json({ adres: mecz.adres, data: mecz.data, zrodlo: skad });
}
