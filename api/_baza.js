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
