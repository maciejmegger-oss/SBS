// ODNALEZIENIE MECZU NA LIŚCIE MECZÓW W „ŁĄCZY NAS PIŁKA".
//
// PO CO TO JEST. Skład potrafimy już pobrać, ale tylko wtedy, gdy ktoś poda adres KONKRETNEGO
// meczu. A tego adresu nie da się ułożyć samemu: mecze na ŁNP nie mają numerów po kolei, tylko
// identyfikatory z myślnikami (f0cf66a2-633b-4df7-a602-4cdfe2d564d9) — losowe, więc nie do
// odgadnięcia z nazw drużyn i daty.
//
// Jest jednak strona, na której ten identyfikator stoi wypisany: lista meczów klubu (albo grupy).
// Każdy wiersz to data, dwie drużyny i odnośnik do meczu. Skoro obserwacja zna datę i obie
// drużyny, wystarczy znaleźć TEN wiersz i wziąć z niego adres. Wtedy scout podaje adres RAZ przy
// klubie, a składy z każdego kolejnego meczu wgrywają się same.
//
// SKĄD CZYTAMY. Z dwóch źródeł naraz, bo nie wiemy z góry, którędy ŁNP poda dane:
//   1) z odczytanego JSON-a (dane wpisane w stronę albo spod adresów, które strona sama podaje),
//   2) wprost z HTML-a — po odnośnikach „/mecz/<identyfikator>" i tekście wiersza wokół nich.
// Wystarczy, że zadziała jedno.
//
// CZEGO TU NIE ROBIMY: nie zgadujemy. Gdy do daty i drużyn pasuje WIĘCEJ niż jeden wiersz, nie
// wybieramy „chyba tego" — oddajemy wszystkie znalezione. Pobranie składu nie tego meczu jest
// gorsze niż niepobranie żadnego: nazwiska wyglądają wiarygodnie, a cała obserwacja jest do kosza.

const OGONKI = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
const norm = (s) => String(s || "").toLowerCase()
  .replace(/[ąćęłńóśźż]/g, (c) => OGONKI[c] || c)
  .normalize("NFD").replace(/\p{M}/gu, "")
  // Formy prawne i człony oznaczające zespół: „RKS RAKÓW CZĘSTOCHOWA S.A." i „Raków Częstochowa"
  // to ten sam klub, a na liście meczów stoi zwykle ta pierwsza postać.
  .replace(/\bs\s*\.?\s*a\s*\.?\b/g, " ")
  .replace(/\bssa\b/g, " ")
  .replace(/\bsp\s*\.?\s*z\s*o\s*\.?\s*o\s*\.?\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

// Słowa, po których poznajemy klub. Krótkie skróty („RKS", „KS", „KKS", „MKS") odpadają same przez
// długość — i dobrze, bo nie mówią o klubie nic.
const slowa = (s) => norm(s).split(" ").filter((w) => w.length > 2);

export const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const UUID_G = new RegExp(UUID.source, "gi");

// Czy w tym tekście stoi nazwa tej drużyny. Po SŁOWACH, nie po zawieraniu napisu: „Arka II Gdynia"
// i „Arka Gdynia II" to jeden zespół, a żaden z tych napisów nie zawiera drugiego.
function jestDruzyna(tekst, nazwa) {
  const szukane = slowa(nazwa);
  if (!szukane.length) return false;
  const wTekscie = new Set(slowa(tekst));
  return szukane.every((w) => wTekscie.has(w));
}

// ---------- DATA ----------

// Data sprowadzona do postaci RRRR-MM-DD. ŁNP pisze „26.07.2026", obserwacja trzyma „2026-07-26".
export function normDate(v) {
  const t = String(v || "").trim();
  if (!t) return "";
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\b/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  return "";
}

const DATA_W_TEKSCIE = /\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/;

// ---------- 1. MECZE WPROST Z HTML-a ----------

const bezZnacznikow = (html) => String(html || "")
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
  .replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ")
  .trim();

// Lista meczów z samej strony: każdy odnośnik „…/mecz/<identyfikator>" to jeden wiersz, a treść
// wiersza bierzemy STĄD DO NASTĘPNEGO ODNOŚNIKA. Tak właśnie zbudowana jest taka lista: cały
// wiersz — data, herby, nazwy, rozgrywki — jest klikalny, więc stoi wewnątrz swojego odnośnika.
export function meczeZHtml(html, adresStrony = "") {
  const tekst = String(html || "");
  let trafienia = [...tekst.matchAll(/\/mecz\/([0-9a-f-]{36})/gi)]
    .filter((m) => UUID.test(m[1]));

  // DROGA ZAPASOWA: ODNOŚNIK Z IDENTYFIKATOREM, ALE BEZ „/mecz/".
  //
  // Ścieżkę „/rozgrywki/mecz/…" znam z jednego prawdziwego odnośnika. Nie jest powiedziane, że
  // wszystkie listy w ŁNP prowadzą do meczu tą samą ścieżką — a gdy prowadzą inną, powyższe
  // szukanie nie znajduje NIC i kończy się zdaniem „na tej stronie nie ma listy meczów",
  // choć lista jest.
  //
  // Bierzemy więc każdy odnośnik z identyfikatorem. Ryzyko jest małe i samoograniczające się:
  // odnośnik do klubu albo zawodnika też ma identyfikator, ale żeby taki wiersz został uznany
  // za nasz mecz, musiałby nieść JEDNOCZEŚNIE tę datę i obie nazwy drużyn. Gdy nie niesie,
  // odpowiedź zmienia się z „nie ma listy" na „nie ma meczu tych drużyn" — a to już zupełnie
  // inna wiadomość i mówi nam, gdzie naprawdę stoimy.
  if (!trafienia.length) {
    trafienia = [...tekst.matchAll(/href=["'][^"']*?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi)];
  }
  if (!trafienia.length) return [];

  const mecze = [];
  const widziane = new Set();
  for (let i = 0; i < trafienia.length; i++) {
    const id = trafienia[i][1].toLowerCase();
    const poczatek = trafienia[i].index;
    const koniec = i + 1 < trafienia.length ? trafienia[i + 1].index : tekst.length;
    const opis = bezZnacznikow(tekst.slice(poczatek, koniec));
    const granica = i > 0 ? trafienia[i - 1].index + trafienia[i - 1][0].length : 0;
    const data = dataPrzyOdnosniku(tekst, poczatek, granica, koniec);

    // Ten sam mecz bywa na stronie odnośnikiem dwa razy (wiersz i przycisk „szczegóły").
    // Zostawiamy ten opis, który ma datę — drugi zwykle jest gołym przyciskiem.
    const juz = widziane.has(id) ? mecze.find((x) => x.id === id) : null;
    if (juz) {
      if (!juz.data && data) { juz.data = data; juz.opis = opis; }
      continue;
    }
    widziane.add(id);
    mecze.push({ id, adres: adresMeczu(id, adresStrony), data, opis });
  }
  return mecze;
}

// DATA WIERSZA TO DATA NAJBLIŻSZA ODNOŚNIKOWI — nie pierwsza, jaka się trafi.
//
// Listy meczów są budowane na dwa sposoby i oba trzeba obsłużyć tym samym kodem:
//   • cały wiersz jest odnośnikiem, a data stoi w środku, tuż ZA nim;
//   • data jest osobną kolumną i stoi tuż PRZED odnośnikiem.
// Branie pierwszej daty od odnośnika w prawo działa przy pierwszym układzie, a przy drugim
// przypisuje wierszowi datę NASTĘPNEGO meczu — bo własnej daty ma przed sobą, a pierwsza po
// prawej należy już do sąsiada. Jest to pomyłka cicha: adres wychodzi poprawny, tyle że nie tego
// spotkania, i skład wgrywa się nie z tego meczu.
//
// Odległość rozstrzyga to sama, bez zgadywania układu strony: własna data wiersza jest przy
// swoim odnośniku, data sąsiada — za całą jego treścią. Nie wychodzimy przy tym poza sąsiednie
// odnośniki, więc cudza data nigdy nie jest nawet brana pod uwagę.
function dataPrzyOdnosniku(tekst, poczatek, granicaLewa, granicaPrawa) {
  const lewa = Math.max(granicaLewa, poczatek - 1200);
  const okno = tekst.slice(lewa, granicaPrawa);
  let najlepsza = "";
  let najblizej = Infinity;
  for (const m of okno.matchAll(new RegExp(DATA_W_TEKSCIE.source, "g"))) {
    const gdzie = lewa + m.index;
    const odleglosc = Math.abs(gdzie - poczatek);
    if (odleglosc >= najblizej) continue;
    const d = normDate(m[0]);
    if (!d) continue;
    najblizej = odleglosc;
    najlepsza = d;
  }
  return najlepsza;
}

export function adresMeczu(id, adresStrony = "") {
  let baza = "https://www.laczynaspilka.pl";
  try { baza = new URL(adresStrony).origin; } catch { /* zostaje adres domyślny */ }
  return `${baza}/rozgrywki/mecz/${id}`;
}

// ---------- 2. MECZE Z ODCZYTANEGO JSON-a ----------

const napis = (v) => (typeof v === "string" && v.trim() && v.trim().length <= 80 ? v.trim() : "");

// Nazwa drużyny spod pola, które bywa albo napisem, albo obiektem z nazwą w środku.
function nazwaZPola(v) {
  if (napis(v)) return napis(v);
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const k of Object.keys(v)) {
      if (/^(name|nazwa|title|display_?name|short_?name|full_?name|club_?name|team_?name)$/i.test(k) && napis(v[k])) {
        return napis(v[k]);
      }
    }
  }
  return "";
}

function zObiektu(o, wzor) {
  for (const [k, v] of Object.entries(o)) {
    if (!wzor.test(k)) continue;
    const n = nazwaZPola(v);
    if (n) return n;
  }
  return "";
}

// Obiekt jest meczem, jeżeli ma identyfikator z myślnikami ORAZ obie drużyny. Data bywa pusta —
// wtedy mecz zostaje na liście, ale bez daty do niczego go nie dopasujemy i tak.
function meczZObiektu(o) {
  const id = Object.entries(o)
    .filter(([k, v]) => /^(id|uuid|match_?id|game_?id|mecz_?id)$/i.test(k) && typeof v === "string" && UUID.test(v))
    .map(([, v]) => v.match(UUID)[0].toLowerCase())[0];
  if (!id) return null;
  const gospodarz = zObiektu(o, /^(home|home_?team|gospodarz|gospodarze|team_?a|druzyna_?a)$/i);
  const gosc = zObiektu(o, /^(away|away_?team|gosc|gość|goscie|goście|team_?b|druzyna_?b)$/i);
  if (!gospodarz || !gosc) return null;
  let data = "";
  for (const [k, v] of Object.entries(o)) {
    if (!/(date|data|kickoff|start|termin|when)/i.test(k)) continue;
    data = normDate(typeof v === "number" ? new Date(v).toISOString() : v);
    if (data) break;
  }
  return { id, data, gospodarz, gosc, opis: `${data} ${gospodarz} ${gosc}` };
}

export function meczeZJsonow(jsony, adresStrony = "") {
  const mecze = [];
  const widziane = new Set();
  const obejdz = (w, glebokosc) => {
    if (!w || typeof w !== "object" || glebokosc > 12) return;
    if (Array.isArray(w)) { w.forEach((x) => obejdz(x, glebokosc + 1)); return; }
    const m = meczZObiektu(w);
    if (m && !widziane.has(m.id)) {
      widziane.add(m.id);
      mecze.push({ ...m, adres: adresMeczu(m.id, adresStrony) });
    }
    Object.values(w).forEach((x) => obejdz(x, glebokosc + 1));
  };
  (jsony || []).forEach((j) => obejdz(j, 0));
  return mecze;
}

// ---------- 3. WYBÓR WŁAŚCIWEGO WIERSZA ----------

// Mecz z listy po dacie i obu drużynach.
//
// DATA JEST WARUNKIEM, NIE PODPOWIEDZIĄ. Te same dwie drużyny grają ze sobą dwa razy w sezonie —
// bez daty wybralibyśmy losowo mecz u siebie albo na wyjeździe. Dlatego gdy daty nie znamy albo
// nie ma jej na stronie, wolimy nie oddać nic.
export function znajdzMecz(mecze, { gospodarz = "", gosc = "", data = "" } = {}) {
  const szukanaData = normDate(data);
  const nazwy = [gospodarz, gosc].filter((n) => slowa(n).length);
  if (!szukanaData || nazwy.length < 2) {
    return { mecz: null, powod: "Do wyszukania meczu potrzebna jest data i obie drużyny.", kandydaci: [] };
  }

  const zDaty = mecze.filter((m) => m.data === szukanaData);
  if (!zDaty.length) {
    return {
      mecz: null,
      powod: "Na tej liście nie ma meczu z dnia " + szukanaData + ".",
      kandydaci: mecze.slice(0, 12).map(podglad),
    };
  }

  const pasujace = zDaty.filter((m) => {
    const tekst = m.opis || `${m.gospodarz || ""} ${m.gosc || ""}`;
    return nazwy.every((n) => jestDruzyna(tekst, n));
  });

  if (pasujace.length === 1) return { mecz: pasujace[0], powod: "", kandydaci: [] };
  if (!pasujace.length) {
    return {
      mecz: null,
      powod: "Mecze z tego dnia są, ale żaden nie jest meczem tych drużyn.",
      kandydaci: zDaty.map(podglad),
    };
  }
  // Więcej niż jeden — NIE wybieramy. Patrz nagłówek: zły skład jest gorszy niż brak składu.
  return {
    mecz: null,
    powod: "Do tej daty i tych drużyn pasuje więcej niż jeden mecz — nie zgaduję który.",
    kandydaci: pasujace.map(podglad),
  };
}

const podglad = (m) => ({
  adres: m.adres,
  data: m.data,
  opis: String(m.opis || "").slice(0, 120),
});
