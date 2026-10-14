// Wspólne pobieranie z serwisu danych Transfermarktu (tmapi.transfermarkt.technology).
//
// Z tego serwisu korzysta sama strona transfermarkt.pl — tabela „Występy" i kadra klubu rysują się
// w przeglądarce z jego odpowiedzi. Przedstawiamy się więc tak, jak ona: nagłówki zwykłej
// przeglądarki i adres strony, z której przyszło zapytanie.

const API = "https://tmapi.transfermarkt.technology";
const NAGLOWKI = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "pl-PL,pl;q=0.9",
  "Origin": "https://www.transfermarkt.pl",
  "Referer": "https://www.transfermarkt.pl/",
};

export async function pobierz(sciezka) {
  const odp = await fetch(API + sciezka, { headers: NAGLOWKI, signal: AbortSignal.timeout(15000) });
  if (!odp.ok) throw new Error(`Transfermarkt odpowiedział ${odp.status} (${sciezka.split("?")[0]})`);
  const j = await odp.json();
  if (j && j.success === false) throw new Error(j.message || "Transfermarkt odrzucił zapytanie");
  return j && j.data;
}

/** „ids[]=1&ids[]=2" — tak serwis przyjmuje listy. */
export const lista = (nazwa, ids) => ids.map((x) => `${nazwa}[]=${encodeURIComponent(x)}`).join("&");

export const uspij = (ms) => new Promise((r) => setTimeout(r, ms));
