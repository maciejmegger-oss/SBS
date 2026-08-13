// Składy grup rozgrywkowych z 90minut — kto w ogóle gra w danej lidze.
//
// PO CO TO JEST: żeby założyć kartotekę klubów całego poziomu, trzeba mieć ich listę. Wpisywanie
// szesnastu grup IV ligi po osiemnaście klubów ręcznie to blisko trzysta wpisów. Tabela ligowa na
// 90minut ma wszystko, czego potrzeba: pełną nazwę klubu, odnośnik do jego strony (a stamtąd biorą
// się mecze i statystyki) oraz nazwę grupy w nagłówku.
//
// Endpoint niczego nie zapisuje — oddaje listy przeglądarce, a ta pokazuje je do zatwierdzenia
// i zakłada tylko brakujące kluby. Decyzja, co wpada do kartoteki, zostaje po stronie człowieka.
import { ZRODLA_LIG, pobierzZ90minut, parseKlubyZTabeli, parseLeagueName } from "./_90minut.js";

// Grupa z nagłówka strony: „Betclic IV liga 2026/2027, grupa: mazowiecka" albo „... grupa: III".
// Bez niej nie da się rozstrzygnąć, do której z szesnastu grup trafia klub.
function grupaZeStrony(html) {
  const naglowek = (html.match(/grupa:\s*([^<\n]{1,40})/i) || [])[1] || "";
  return naglowek.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().replace(/[.,;]$/, "");
}

// Nazwa rozgrywek w naszej kartotece. III liga ma grupy rzymskie, IV liga wojewódzkie.
function etykietaLigi(poziom, grupa) {
  if (!grupa) return poziom;
  if (poziom === "III liga") return `III liga, gr. ${grupa}`;
  if (poziom === "IV liga") return `IV liga (${grupa.toLowerCase()})`;
  if (poziom === "CLJ U17") return `CLJ U17 (${grupa.toLowerCase()})`;
  return poziom;
}

// Województwo z nazwy grupy IV ligi — kartoteka trzyma przy klubie związek wojewódzki.
const ZPN_WG_GRUPY = {
  "dolnośląska": "Dolnośląski ZPN", "kujawsko-pomorska": "Kujawsko-Pomorski ZPN",
  "lubelska": "Lubelski ZPN", "lubuska": "Lubuski ZPN", "łódzka": "Łódzki ZPN",
  "małopolska": "Małopolski ZPN", "mazowiecka": "Mazowiecki ZPN", "opolska": "Opolski ZPN",
  "podkarpacka": "Podkarpacki ZPN", "podlaska": "Podlaski ZPN", "pomorska": "Pomorski ZPN",
  "śląska": "Śląski ZPN", "świętokrzyska": "Świętokrzyski ZPN",
  "warmińsko-mazurska": "Warmińsko-Mazurski ZPN", "wielkopolska": "Wielkopolski ZPN",
  "zachodniopomorska": "Zachodniopomorski ZPN",
};

// Miasto zgadujemy z końcówki nazwy („Pelikan Łowicz" → Łowicz). Przy nazwie dwuczłonowej
// („Konstantynów Łódzki") bierzemy dwa ostatnie słowa. To tylko podpowiedź do pola „Miasto" —
// przeglądarka pokazuje wynik przed założeniem klubów.
function miastoZNazwy(nazwa) {
  const slowa = String(nazwa || "").split(/\s+/).filter(Boolean);
  if (slowa.length < 2) return "";
  const ostatnie = slowa[slowa.length - 1];
  if (/(ski|cki|dzki|ska|cka|dzka|skie|ckie|dzkie)$/i.test(ostatnie) && slowa.length >= 3) {
    return slowa.slice(-2).join(" ");
  }
  return ostatnie;
}

export default async function handler(req, res) {
  const pierwszy = (v) => (Array.isArray(v) ? v[0] : v) || "";
  const poziom = pierwszy(req.query.poziom);
  const adresy = ZRODLA_LIG[poziom];
  if (!adresy) {
    return res.status(400).json({
      error: `Nie znam poziomu „${poziom || "—"}".`,
      podpowiedz: `Obsługiwane: ${Object.keys(ZRODLA_LIG).join(", ")}.`,
    });
  }

  const grupy = [];
  const bledy = [];
  // Po kolei, nie równolegle — 90minut prowadzą wolontariusze, a szesnaście stron naraz to
  // niepotrzebne uderzenie. Raz pobrana strona i tak leży w pamięci podręcznej.
  for (const adres of adresy) {
    let html;
    try { html = await pobierzZ90minut(adres); }
    catch (e) { bledy.push({ adres, blad: String((e && e.message) || e) }); continue; }

    const grupa = grupaZeStrony(html);
    const kluby = parseKlubyZTabeli(html).map((k) => ({
      nazwa: k.nazwa,
      miasto: miastoZNazwy(k.nazwa),
      adresKlubu: `http://www.90minut.pl/skarb.php?id_klub=${k.id}` + (k.sezon ? `&id_sezon=${k.sezon}` : ""),
    }));
    grupy.push({
      adres,
      rozgrywki: parseLeagueName(html),
      grupa,
      liga: etykietaLigi(poziom, grupa),
      region: poziom === "IV liga" ? (ZPN_WG_GRUPY[grupa.toLowerCase()] || "") : "",
      kluby,
    });
  }

  return res.status(200).json({ ok: true, poziom, grupy, bledy });
}
