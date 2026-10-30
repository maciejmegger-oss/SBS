// METRYCZKI KADRY KLUBU — DOKŁADNE DATY URODZENIA I ODNOŚNIKI DO PROFILI.
//
// PO CO TO JEST
// Efekt wieku względnego mierzy się KWARTAŁEM urodzenia, nie rocznikiem. Zawodnik z 3 stycznia
// i z 28 grudnia mają ten sam rocznik, a dzieli ich prawie rok rozwoju — i to wystarcza, żeby
// przez całą młodzież pierwszy wyglądał na lepszego, bo jest po prostu starszy. Bez dnia
// i miesiąca tej różnicy nie widać wcale, a w naszej kartotece daty urodzenia najczęściej nie ma.
//
// DLACZEGO NIE CZYTAMY TEGO ZE STRONY SKŁADU
// Bo próbowaliśmy i nie zadziałało. Wzorzec pisany pod układ HTML-u strony klubu odczytał
// nazwiska i pozycje, a daty nie znalazł ani jednej — układ strony był inny, niż zakładaliśmy.
// Serwis danych, z którego korzysta sama strona transfermarkt.pl, oddaje datę jako GOTOWE POLE.
// Nie ma tam czego zgadywać i nie zepsuje się przy najbliższej zmianie wyglądu serwisu.
//
// DLACZEGO OSOBNY PUNKT, SKORO JEST JUŻ /api/rynki-skaner
// Tamten dla KAŻDEGO zawodnika dociąga jeszcze wszystkie jego mecze — przy całej kadrze to
// dziesiątki sekund i ryzyko przekroczenia limitu czasu funkcji. Do uzupełnienia metryczek
// mecze są niepotrzebne: wystarczy kadra i profile. Dwa zapytania na klub zamiast trzydziestu.
//
// Wywołanie:  /api/tm-metryki?klub=9510
//             /api/tm-metryki?klub=9510&od=2006   (tylko urodzeni w 2006 i później)

import { pobierz, lista } from "./_tmapi.js";
import { profilZTmapi } from "./_tm-wystepy.js";

// Profile pobieramy paczkami — serwis przyjmuje listę identyfikatorów w jednym zapytaniu.
const PACZKA = 40;

export default async function handler(req, res) {
  const q = req.query || {};
  const klub = String(q.klub || "");
  if (!/^\d+$/.test(klub)) {
    return res.status(400).json({
      error: "Podaj numer klubu z Transfermarktu (?klub=…).",
      podpowiedz: "Numer stoi w adresie klubu na TM, po /verein/ — np. /verein/9510 to klub=9510.",
    });
  }
  // Ogranicznik rocznika jest opcjonalny: przy uzupełnianiu kartoteki chcemy CAŁĄ kadrę,
  // a nie tylko młodych. Domyślnie więc nie odcinamy nikogo.
  const od = q.od == null || q.od === "" ? null : Number(q.od);
  if (od != null && !(od >= 1940 && od <= new Date().getFullYear())) {
    return res.status(400).json({ error: "Parametr „od” to rok urodzenia, np. od=2006." });
  }

  let kadra;
  try {
    kadra = await pobierz(`/club/${klub}/squad`);
  } catch (e) {
    return res.status(502).json({ error: "Nie udało się pobrać kadry z Transfermarktu: " + String((e && e.message) || e) });
  }
  const ids = [...new Set(((kadra && kadra.squad) || []).map((x) => String(x.playerId)).filter(Boolean))];
  if (!ids.length) return res.status(404).json({ error: "Ten klub nie ma kadry w serwisie.", klub });

  let gracze = [];
  try {
    for (let i = 0; i < ids.length; i += PACZKA) {
      gracze = gracze.concat((await pobierz(`/players?${lista("ids", ids.slice(i, i + PACZKA))}`)) || []);
    }
  } catch (e) {
    return res.status(502).json({ error: "Nie udało się pobrać profili zawodników: " + String((e && e.message) || e) });
  }

  const zawodnicy = [];
  for (const p of gracze) {
    const profil = profilZTmapi(p);
    const dataUr = String(profil.dataUr || "").slice(0, 10);
    if (od != null && Number(dataUr.slice(0, 4)) < od) continue;
    zawodnicy.push({
      tmId: String(p.id),
      nazwa: profil.nazwa,
      dataUrodzenia: /^\d{4}-\d{2}-\d{2}$/.test(dataUr) ? dataUr : "",
      // Kwartał liczymy TU, a nie w aplikacji — żeby jedna reguła obowiązywała wszędzie,
      // gdzie kiedykolwiek policzymy efekt wieku względnego.
      kwartal: /^\d{4}-\d{2}-\d{2}$/.test(dataUr) ? Math.floor((Number(dataUr.slice(5, 7)) - 1) / 3) + 1 : null,
      pozycja: profil.pozycja,
      adres: profil.adres,
    });
  }

  // ILE METRYCZEK UDAŁO SIĘ ODCZYTAĆ — podane wprost.
  //
  // Przy poprzedniej próbie (czytanie HTML-u) brak dat wyglądał jak „ten klub nie ma dat
  // w serwisie", a był zepsutym wzorcem. Jedna liczba w odpowiedzi rozstrzyga to od razu.
  res.setHeader("cache-control", "public, s-maxage=3600, stale-while-revalidate=21600");
  return res.status(200).json({
    klub,
    kadra: ids.length,
    zawodnicy,
    zDataUrodzenia: zawodnicy.filter((z) => z.dataUrodzenia).length,
    pobrano: new Date().toISOString(),
  });
}
