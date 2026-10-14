# Przegląd ochrony danych osobowych — Scout Base System

**Stan na 14.10.2026. To techniczny przegląd tego, co robi kod, a nie porada prawna.** Ocenę zgodności
z RODO, podstawy prawne i treść dokumentów (rejestr czynności, umowy powierzenia, ocena skutków)
powinien potwierdzić prawnik albo inspektor ochrony danych, najlepiej znający sport młodzieżowy.
Poniższe punkty mówią, **o co pytać** i **co w systemie trzeba zmienić**.

## 1. Jakie dane są w systemie

| Dane | Gdzie | Uwagi |
|---|---|---|
| Zawodnicy: imię, nazwisko, data urodzenia, wzrost, noga, zdjęcie, linki do Instagrama i Facebooka, klub, statystyki, agent, kontrakt | `sbs_players` | Roczniki 2008–2014, czyli **osoby małoletnie** |
| Obserwacje i raporty skautów, w tym wolny tekst o „otoczeniu", „postawie", „stabilności" | `sbs_observations`, `sbs_reports`, `sbs_players` | Opisy charakteru i sytuacji dziecka; to najwrażliwsza treść w bazie |
| Kontakty (e-mail, telefon) do osób w klubach i agencjach | `sbs_contacts`, agencje i menedżerowie w `sbs_kv` | Osoby dorosłe, dane zawodowe |
| Konta użytkowników (imię i nazwisko, klub, rola, telefon, e-mail) | `sbs_konta`, Supabase Auth | |
| Dziennik zmian (kto, co, kiedy, **pełny stan wiersza przed i po**) | `sbs_audit` (migracja 14.10) | Zawiera kopie danych, w tym treści propozycji AI |
| Propozycje AI i decyzje | `sbs_ai_propozycje` | Opis zawodnika, ocena trenera, decyzja dyrektora |

## 2. Dokąd dane wychodzą (podmioty przetwarzające)

| Podmiot | Co dostaje | Do zweryfikowania |
|---|---|---|
| **Supabase** (baza, logowanie) | Wszystko z tabeli powyżej | Region bazy (UE?), umowa powierzenia (DPA), kopie zapasowe |
| **Vercel** (hosting, funkcje, logi) | Ruch aplikacji; logi funkcji | W logach jest identyfikator konta i liczba tokenów (`ai-zuzycie`), **bez treści** zapytań. Lokalizacja logów, DPA |
| **Anthropic** (API) | Przy drugiej opinii: imię, nazwisko, rocznik, klub, liga, pozycja, wzrost, narodowość, statystyki, **treść raportów skautów** (łącznie z polami „otoczenie/postawa/stabilność"). Przy szkicu raportu: notatki skauta i poprzednie raporty | Warunki API: czy dane są używane do trenowania, okres przechowywania, DPA, lokalizacja. Sprawdzić w aktualnych warunkach i ustawieniach konta, nie z pamięci |
| **Wyszukiwarka w sieci** (narzędzie modelu w drugiej opinii) | Model sam układa zapytania z nazwiskiem zawodnika | To dodatkowy, niekontrolowany przepływ nazwiska małoletniego do wyszukiwarek |
| **API-Football** | Nazwy drużyn, daty meczów (bez danych zawodników z naszej bazy) | Licencja i warunki |
| Google (Kalendarz) | Plan obserwacji | Tylko jeśli synchronizacja jest włączona |

## 3. Co już jest zrobione dobrze

- Polecenia dla modelu zabraniają analizy kont w mediach społecznościowych i życia prywatnego
  (`api/opinia-ai.js`). Model ma pisać „nie wiem", gdy nie ma danych.
- Funkcje AI wymagają logowania i mają dzienne limity (PR #104), a w logach nie zostaje treść zapytań.
- Role i RLS ograniczają dostęp do zatwierdzonych kont; klient widzi tylko wykupione ligi.
- Dziennik zmian jest tylko do dopisywania, czytany wyłącznie przez administratora.
- **Zmiana w tym PR:** druga opinia nie wysyła już do modelu pełnej daty urodzenia, tylko rocznik.

## 4. Ryzyka i luki do zamknięcia

1. **Brak okresów przechowywania.** Nic nie usuwa starych obserwacji, propozycji ani wpisów dziennika.
2. **Dziennik a prawo do usunięcia danych.** `sbs_audit` jest celowo niezmienialny i trzyma pełne kopie
   wierszy. Żądanie usunięcia danych dziecka nie obejmie więc kopii w dzienniku. Potrzebna decyzja:
   okres retencji dziennika albo pseudonimizacja (np. zapis samych identyfikatorów i nazw pól bez treści).
3. **Treści o charakterze i otoczeniu dziecka** trafiają do modelu i do zewnętrznej wyszukiwarki
   (patrz sekcja 2). Rozważyć: wyłączenie pól „otoczenie/postawa/stabilność" z danych dla modelu
   albo wyraźną zgodę i podstawę prawną dla tego konkretnego przetwarzania.
4. **Linki do Instagrama i Facebooka** zawodników są w bazie. Samo przechowywanie adresu to jedno,
   ale profilowanie kont małoletnich jest wykluczone w poleceniach modelu i tak powinno zostać
   w procedurze skautów.
5. **Zgody i informowanie.** Kartoteka dziecka powstaje zwykle bez jego wiedzy i bez wiedzy
   opiekunów. Trzeba ustalić podstawę (uzasadniony interes? zgoda opiekuna?) i obowiązek
   informacyjny. To pytanie do prawnika.
6. **Dostęp `anon` do zleceń analiz i skrzynki raportów** (migracje z 29.09) zawiera dane o obserwowanych
   zawodnikach. To świadomy kompromis na potrzeby zewnętrznego analityka, ale wymaga decyzji, jak
   uwierzytelnić analityka.
7. **Kopie zapasowe i region bazy.** Na planie darmowym Supabase brak pełnych kopii. To ryzyko
   dostępności, a nie ochrony danych, ale kopie poza systemem też są danymi osobowymi.

## 5. Lista kroków

| # | Krok | Kto | Priorytet |
|---|---|---|---|
| 1 | Zapisać cele i podstawę prawną przetwarzania danych zawodników (w tym małoletnich) | właściciel + prawnik | wysoki |
| 2 | Uzupełnić rejestr czynności przetwarzania | właściciel + prawnik | wysoki |
| 3 | Sprawdzić i podpisać umowy powierzenia: Supabase, Vercel, Anthropic | właściciel | wysoki |
| 4 | Potwierdzić region bazy i logów; ustawić region UE, jeśli to możliwe | właściciel | wysoki |
| 5 | Ocena skutków (DPIA): profilowanie małoletnich, przekazanie do modelu AI | prawnik | wysoki |
| 6 | Zdecydować, czy pola „otoczenie/postawa/stabilność" mogą trafiać do modelu | właściciel | średni |
| 7 | Ustalić okresy przechowywania (obserwacje, propozycje, dziennik) | właściciel | średni |
| 8 | Zdecydować o pseudonimizacji dziennika zmian | właściciel + deweloper | średni |
| 9 | Procedura na żądania osób (wgląd, sprostowanie, usunięcie) — kto, w jakim terminie | właściciel | średni |
| 10 | Zdecydować o uwierzytelnieniu analityka zewnętrznego zamiast dostępu `anon` | właściciel + deweloper | średni |
| 11 | Pismo do PZPN (źródło danych rozgrywkowych) — potwierdzić wysyłkę i zapisać odpowiedź | właściciel | wysoki |

## 6. Co może zrobić deweloper bez decyzji prawnej

- Dodać zadanie czyszczące stare wpisy limitu AI w `sbs_kv` (`ai_limit:*` rosną co dzień).
- Wyłączyć pola „otoczenie/postawa/stabilność" z danych dla modelu — po decyzji z punktu 6.
- Dodać eksport danych jednego zawodnika (przydatny przy żądaniu wglądu).
- Dodać kasowanie wszystkich danych jednego zawodnika razem z propozycjami i pseudonimizacją
  dziennika — po decyzji z punktów 7–8.
