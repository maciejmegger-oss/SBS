// Jeden wspólny klient Supabase dla całej aplikacji.
//
// Dlaczego osobny plik: warstwa danych (storage.ts) i logowanie (auth.ts) MUSZĄ
// używać tej samej instancji. Dwa niezależne wywołania createClient() to dwie
// osobne sesje — zapytania o dane szłyby wtedy bez tokenu zalogowanego
// użytkownika i po zamknięciu reguł dostępu (rls_authenticated.sql) zwracałyby
// pustkę, mimo poprawnego zalogowania.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Bez tego użytkownik zobaczyłby pustą stronę i błąd w konsoli, którego nie
  // otworzy. Rzucamy czytelny komunikat — obsługuje go ekran logowania.
  throw new Error(
    "Brak konfiguracji Supabase. Uzupełnij VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY " +
      "w pliku .env (lokalnie) lub w zmiennych środowiskowych na Vercelu (produkcja).",
  );
}

export const sb = createClient(url, anonKey, {
  auth: {
    persistSession: true,     // sesja przeżywa odświeżenie strony
    autoRefreshToken: true,   // token odnawia się sam, bez wylogowania w trakcie pracy
    detectSessionInUrl: true, // obsługa linków z e-maila (zaproszenie, reset hasła)
  },
});

// Adres, na który wracają linki z e-maili. Na produkcji to adres wdrożenia,
// lokalnie — localhost. Bierzemy go z bieżącej strony, żeby nie trzymać go
// w dwóch miejscach i nie wysyłać ludzi na localhost z produkcyjnego maila.
export const siteUrl = () => window.location.origin;
