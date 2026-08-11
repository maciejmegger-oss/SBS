// Dostęp do bazy z funkcji serwerowych (katalog api/).
//
// KTÓRY KLUCZ I DLACZEGO TO WAŻNE
// Przeglądarka pracuje kluczem publicznym („anon"), a od zamknięcia dostępu (patrz
// supabase/migration_2026-08-11_konta_i_zgoda.sql) ten klucz nie widzi ANI JEDNEGO wiersza —
// reguły wpuszczają wyłącznie konta zalogowane i zatwierdzone. Funkcje serwerowe nie mają
// zalogowanego użytkownika: cykliczne odświeżanie statystyk czy terminarza uruchamia harmonogram,
// nie człowiek. Dlatego serwer musi pracować kluczem serwisowym (service_role), który reguły
// omija. Bez niego każde zapytanie wraca puste, a błąd wygląda myląco — jakby klubu nie było
// w bazie.
//
// KLUCZ SERWISOWY NIE MOŻE TRAFIĆ DO PRZEGLĄDARKI. W Vercelu zmienna nazywa się
// SUPABASE_SERVICE_KEY — bez przedrostka VITE_, bo tylko zmienne z tym przedrostkiem Vite wkleja
// do kodu strony. Kto ma ten klucz, ma pełny dostęp do danych z pominięciem wszystkich reguł.

export const BAZA = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

export const MA_KLUCZ_SERWISOWY = !!process.env.SUPABASE_SERVICE_KEY;

export const KLUCZ_BAZY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export const naglowkiBazy = () => ({
  apikey: KLUCZ_BAZY,
  Authorization: "Bearer " + KLUCZ_BAZY,
  "Content-Type": "application/json",
});

// Podpowiedź doklejana do błędów „pusto w bazie". Gdy serwer pracuje kluczem publicznym, to jest
// najczęstsza przyczyna — i jedyna, której nie widać po samej odpowiedzi z Postgresa: reguły
// dostępu nie zgłaszają odmowy, tylko oddają zero wierszy.
export const PODPOWIEDZ_BRAK_KLUCZA = MA_KLUCZ_SERWISOWY
  ? ""
  : "Serwer pracuje kluczem publicznym, a baza jest zamknięta regułami dostępu — tym kluczem nie " +
    "widzi żadnych danych. W Vercelu (Project → Settings → Environment Variables) dodaj " +
    "SUPABASE_SERVICE_KEY z wartością klucza service_role z Supabase (Project Settings → API Keys) " +
    "i wdróż projekt ponownie.";

// ---------------------------------------------------------------------------
// ZAPYTANIE W IMIENIU ZALOGOWANEGO
// ---------------------------------------------------------------------------
//
// Gdy żądanie przychodzi z przeglądarki zalogowanego użytkownika, aplikacja dokłada do niego jego
// token sesji. Podajemy go dalej do bazy — wtedy reguły dostępu widzą KTO pyta i wpuszczają go
// dokładnie tak, jak przy pracy w aplikacji. Dzięki temu ręczne pobranie statystyk działa bez
// klucza serwisowego: użytkownik i tak ma prawo do tych danych.
//
// Klucz serwisowy zostaje potrzebny tylko tam, gdzie nie ma żadnego użytkownika — czyli w
// zadaniach cyklicznych (nocne odświeżanie statystyk i terminarza) oraz w synchronizacji z
// Kalendarzem Google.

const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

// Token sesji z nagłówka Authorization. Sekret zadań cyklicznych przychodzi tym samym nagłówkiem,
// więc odróżniamy je po kształcie: JWT ma trzy części rozdzielone kropkami.
export function tokenUzytkownika(req) {
  const naglowek = (req && req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  const token = String(naglowek).replace(/^Bearer\s+/i, "").trim();
  return token && token.split(".").length === 3 ? token : "";
}

export function naglowkiDlaZadania(req) {
  const token = tokenUzytkownika(req);
  if (!token || !ANON) return naglowkiBazy();
  return {
    apikey: ANON,
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  };
}

// Czy to żądanie ma czym sięgnąć do zamkniętej bazy: albo tokenem użytkownika, albo kluczem
// serwisowym. Gdy nie ma ani jednego, lepiej powiedzieć to wprost niż zwrócić pustkę.
export function maDostepDoBazy(req) {
  return MA_KLUCZ_SERWISOWY || !!tokenUzytkownika(req);
}
