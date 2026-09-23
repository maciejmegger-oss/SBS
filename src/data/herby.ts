// HERBY KLUBÓW JAKO PLIKI.
//
// PO CO
// Herb trzymany w bazie jako base64 jest dla przeglądarki zwykłym tekstem w odpowiedzi — nie ma
// czego zapamiętać, więc te same 14 MB lecą przy KAŻDYM otwarciu panelu. Plik pod własnym adresem
// przeglądarka pobiera raz i trzyma; drugie wejście nie kosztuje ani bajtu transferu.
//
// To nie jest oszczędzanie dla zasady: Supabase odciął projekt od limitu transferu (Egress
// Exceeded) i od 15.10 zacznie odrzucać zapytania. Herby to największa pojedyncza pozycja, jaką
// da się z tego limitu zdjąć bez ruszania danych.
//
// CO SIĘ NIE ZMIENIA
// Tabela sbs_club_crests zostaje bez zmian. W kolumnie `data_url` zamiast treści obrazka stoi jego
// adres. Znacznik <img src="..."> przyjmuje jedno i drugie, więc żaden widok nie wymaga przeróbki,
// a przejście da się robić klub po klubie i w każdej chwili przerwać.

import { sb } from "./storage";

export const KOSZ_HERBY = "herby";

// Czy pod tą wartością kryje się plik, czy jeszcze treść obrazka wklejona do bazy.
export function herbJestPlikiem(wartosc?: string | null): boolean {
  return !!wartosc && /^https?:\/\//i.test(wartosc);
}

// Zamiana „data:image/png;base64,..." na plik do wysłania.
//
// Świadomie bez fetch(dataUrl) — ta krótsza droga działa, ale przy 315 herbach po kolei potrafi
// zadławić przeglądarkę, a przy wyłączonych skryptach z innych źródeł bywa blokowana przez
// politykę bezpieczeństwa strony. atob() robi to samo lokalnie i przewidywalnie.
function plikZTresci(dataUrl: string): Blob {
  const przecinek = dataUrl.indexOf(",");
  if (przecinek < 0) throw new Error("To nie jest obrazek zapisany w bazie.");
  const naglowek = dataUrl.slice(0, przecinek);
  const typ = (naglowek.match(/^data:([^;,]+)/) || [])[1] || "image/png";
  if (!/;base64/i.test(naglowek)) throw new Error("Obrazek nie jest zapisany w base64.");
  const znaki = atob(dataUrl.slice(przecinek + 1));
  const bajty = new Uint8Array(znaki.length);
  for (let i = 0; i < znaki.length; i++) bajty[i] = znaki.charCodeAt(i);
  return new Blob([bajty], { type: typ });
}

const ROZSZERZENIA: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg",
};

// Wysłanie herbu do plików. Zwraca adres, który trafia do bazy w miejsce treści obrazka.
//
// ZNACZNIK WERSJI NA KOŃCU ADRESU (?v=...) JEST TU NIEZBĘDNY, a nie ozdobny. Pliki każemy
// przeglądarce trzymać przez ROK — bez tego podmiana herbu nie byłaby widoczna, bo adres
// zostałby ten sam i przeglądarka nadal pokazywałaby stary obrazek z pamięci. Nowy znacznik
// to dla niej nowy adres, więc pobiera go od nowa. Stary plik zostaje nadpisany, więc
// nie przybywa śmieci.
export async function wyslijHerb(idKlubu: string, tresc: string): Promise<string> {
  if (herbJestPlikiem(tresc)) return tresc;            // już przeniesiony, nie ruszamy
  const plik = plikZTresci(tresc);
  const sciezka = `${idKlubu}.${ROZSZERZENIA[plik.type] || "png"}`;
  const { error } = await sb.storage.from(KOSZ_HERBY).upload(sciezka, plik, {
    contentType: plik.type,
    upsert: true,
    cacheControl: "31536000",                           // rok — o to w tym wszystkim chodzi
  });
  if (error) throw new Error(bladPoLudzku(error.message));
  const { data } = sb.storage.from(KOSZ_HERBY).getPublicUrl(sciezka);
  return `${data.publicUrl}?v=${Date.now().toString(36)}`;
}

// Komunikaty z Supabase są po angielsku i mówią o „bucketach". Dwa zdarzają się naprawdę
// i oba mają konkretną, wykonalną odpowiedź.
function bladPoLudzku(wiadomosc: string): string {
  const m = (wiadomosc || "").toLowerCase();
  if (m.includes("bucket not found")) {
    return "W Supabase nie ma jeszcze kosza na herby. Uruchom skrypt "
      + "supabase/migration_2026-09-23_kosz_na_herby.sql (SQL Editor → wklej → Run).";
  }
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("violates")) {
    return "Baza nie pozwoliła wgrać pliku. Herby wgrywa wyłącznie konto pracowni — "
      + "klient ma tu sam podgląd.";
  }
  return "Nie udało się wysłać herbu: " + wiadomosc;
}

// PRZENIESIENIE WSZYSTKIEGO, CO JESZCZE SIEDZI W BAZIE.
//
// Idzie klub po klubie i melduje postęp, bo przy trzystu herbach cisza przez minutę wygląda jak
// zawieszenie. Potknięcie na jednym klubie NIE przerywa reszty: zapisujemy, co poszło, i lecimy
// dalej — przerwanie w połowie zostawiłoby bazę w stanie, którego nikt nie umie opisać.
//
// Funkcja niczego sama nie zapisuje do bazy — oddaje nowe adresy, a zapis robi strona wywołująca.
// Dzięki temu da się ją sprawdzić bez ruszania danych, a zapis idzie jednym wsadem na końcu.
export interface WynikPrzenoszenia {
  przeniesione: Record<string, string>;   // id klubu → nowy adres
  bledy: { idKlubu: string; powod: string }[];
  pominiete: number;                      // te, które już były plikami
}

export async function przeniesHerby(
  herby: Record<string, string>,
  postep?: (zrobione: number, wszystkich: number, idKlubu: string) => void,
): Promise<WynikPrzenoszenia> {
  const idki = Object.keys(herby || {});
  const wynik: WynikPrzenoszenia = { przeniesione: {}, bledy: [], pominiete: 0 };
  for (let i = 0; i < idki.length; i++) {
    const id = idki[i];
    const tresc = herby[id];
    if (postep) postep(i + 1, idki.length, id);
    if (!tresc) continue;
    if (herbJestPlikiem(tresc)) { wynik.pominiete++; continue; }
    try {
      wynik.przeniesione[id] = await wyslijHerb(id, tresc);
    } catch (e) {
      wynik.bledy.push({ idKlubu: id, powod: (e as Error).message || String(e) });
    }
  }
  return wynik;
}
