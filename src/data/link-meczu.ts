// LINK DO TRANSMISJI ALBO NAGRANIA MECZU — wspólny dla komputera i telefonu.
//
// Coraz więcej meczów, także rezerw i juniorów, leci na serwerach klubów, na YouTube czy na
// platformach streamingowych. Scout kopiuje adres i wkleja go do obserwacji, a potem ma mecz pod
// ręką jednym kliknięciem „▶ Oglądaj" — zamiast szukać transmisji drugi raz.
//
// ADRES SPRAWDZAMY DWA RAZY: przy wpisaniu i przy każdym wyświetleniu. Do bazy piszą też telefon
// i serwer, a link trafia wprost do href — „javascript:…" wklejone zamiast adresu wykonałoby się
// po kliknięciu. Dopuszczamy wyłącznie http i https.

export type WynikLinku = { ok: true; wartosc: string } | { ok: false; powod: string };

const RE_Z_PROTOKOLEM = /\bhttps?:\/\/[^\s<>"']+/i;
// Bez protokołu („www.klub.pl/mecz", „youtu.be/abc") — ale tylko z domeną kończącą się literami,
// żeby „17.30" albo „2.0" z opisu meczu nie udawały adresu.
const RE_BEZ_PROTOKOLU = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s<>"']*)?/i;
// „javascript:alert(1)", „data:text/html,…", „mailto:…" — schemat sklejony z treścią, bez spacji.
// „Mecz: https://…" tu nie wpada: po dwukropku jest spacja, a adres i tak znajdzie się wyżej.
const RE_OBCY_SCHEMAT = /^\s*[a-z][a-z0-9+.-]*:\S/i;
// Kropka czy nawias zamykający zdanie, w którym wklejono link, nie należą do adresu.
const RE_OGON_ZDANIA = /[.,;:!?)\]}'"»]+$/;

export function bezpiecznyLinkMeczu(adres: unknown): string {
  const s = String(adres ?? "").trim();
  if (!s) return "";
  let u: URL;
  try { u = new URL(s); } catch { return ""; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  // Login i hasło przed adresem („https://ktos:haslo@…") to albo wyciek, albo podszywka pod inną stronę.
  if (u.username || u.password) return "";
  if (!u.hostname) return "";
  return u.href;
}

// Pole z formularza → adres do zapisu. Pusty wpis to świadome usunięcie linku, nie błąd.
export function linkDoMeczuZPola(tekst: unknown): WynikLinku {
  const s = String(tekst ?? "").trim();
  if (!s) return { ok: true, wartosc: "" };
  let kandydat = (s.match(RE_Z_PROTOKOLEM) || [])[0] || "";
  if (!kandydat) {
    if (RE_OBCY_SCHEMAT.test(s)) {
      return { ok: false, powod: "To nie jest adres strony. Link do meczu musi zaczynać się od http:// albo https://." };
    }
    const bezProtokolu = (s.match(RE_BEZ_PROTOKOLU) || [])[0];
    if (bezProtokolu) kandydat = "https://" + bezProtokolu;
  }
  if (!kandydat) {
    return { ok: false, powod: "Nie widzę tu adresu strony. Skopiuj link z paska adresu przeglądarki, na której leci mecz (zaczyna się od https://)." };
  }
  kandydat = kandydat.replace(RE_OGON_ZDANIA, "");
  const href = bezpiecznyLinkMeczu(kandydat);
  if (!href) {
    return { ok: false, powod: /@/.test(kandydat)
      ? "Link ma login albo hasło przed adresem strony — takiego nie zapisuję. Skopiuj sam adres transmisji."
      : "Ten adres jest niepoprawny. Skopiuj go jeszcze raz z paska adresu przeglądarki." };
  }
  return { ok: true, wartosc: href };
}

// Nazwa serwisu do podpowiedzi przy przycisku: „youtube.com", „lechpoznan.tv".
export function serwisLinkuMeczu(adres: unknown): string {
  const href = bezpiecznyLinkMeczu(adres);
  return href ? new URL(href).hostname.replace(/^www\./, "") : "";
}

// Ten sam mecz zaplanowany dla kilku zawodników to kilka obserwacji — a transmisja jest jedna.
// Porównujemy nazwę meczu bez wielkości liter, polskich znaków i odstępów oraz datę: „Lech II -
// Noteć" i „lech ii – notec" z tego samego dnia to jedno spotkanie.
const kluczMeczu = (m: unknown): string => String(m ?? "").toLowerCase()
  .replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

export function obserwacjeTegoSamegoMeczu(lista: any[], obs: any): any[] {
  const klucz = kluczMeczu(obs && obs.match);
  if (!klucz || !obs.date) return [];
  return (lista || []).filter((x) => x && x !== obs && x.id !== obs.id
    && x.date === obs.date && kluczMeczu(x.match) === klucz);
}
