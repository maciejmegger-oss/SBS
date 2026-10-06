# SBS AI — dzienny raport na telefon

Asystent, który codziennie rano przegląda nowych zawodników w SBS, porównuje ich z profilem
poszukiwanym przez klub i wysyła na telefon takie podsumowanie:

```
SBS AI – raport dzienny

7 nowych zawodników
3 spełniają profil
2 wymagają dodatkowej obserwacji
1 zawodnik – wysoki potencjał transferowy
1 zawodnik – brak wystarczających danych
```

Kod: `api/raport-dzienny.js` (baza + wysyłka), `api/_raport-dzienny.js` (logika oceny),
`api/_uzupelnianie.js` (braki z Transfermarktu); testy: `node scripts/test-raport-dzienny.mjs`, `node scripts/test-uzupelnianie.mjs`. Zadanie cykliczne: codziennie 06:00 UTC, godzinę po
odświeżeniu statystyk (`/api/refresh-stats`, 05:00 UTC), żeby minuty były świeże.

## Uruchomienie (jednorazowo)

### 1. Telefon
Najprościej ntfy (darmowa aplikacja, bez konta):
1. Zainstaluj aplikację **ntfy** (Android / iOS) i zasubskrybuj wymyślony, długi temat, np. `sbs-ai-k3x9q2m7p1`.
2. Vercel → Project → Settings → Environment Variables: `NTFY_TOPIC` = ten temat.
   Opcjonalnie `APP_URL` = `https://scoutbasesystem.com/app` (kliknięcie w powiadomienie otwiera system).

Każdy, kto zna temat, może czytać wiadomości — nie używaj w nim nazwy klubu ani nazwiska.
Zamiast ntfy możesz ustawić `TELEGRAM_BOT_TOKEN` i `TELEGRAM_CHAT_ID`.

### 2. Klucz serwisowy i sekret zadania
`SUPABASE_SERVICE_KEY` (patrz `WDROZENIE.md`) — bez niego zadanie nie widzi zamkniętej bazy.
Zalecane też `CRON_SECRET`; Vercel dokłada go do wywołań cyklicznych sam.

### 3. Profil poszukiwany przez klub
Bez profilu nikt nie „spełnia profilu" (raport o tym ostrzega). Supabase → SQL Editor:

```sql
insert into sbs_kv (key, value) values ('scouting:profil_poszukiwany', '{
  "klub": "Lechia Gdańsk U19",
  "kryteria": [
    { "nazwa": "Środkowy obrońca", "pozycje": ["Obrońca środkowy"],
      "rocznikOd": 2007, "rocznikDo": 2009, "wzrostMin": 183, "noga": "lewa",
      "minutyMin": 600, "ocenaMin": 4 },
    { "nazwa": "Skrzydłowy", "pozycje": ["Skrzydłowy"], "rocznikOd": 2007, "rocznikDo": 2009, "ocenaMin": 4 }
  ]
}') on conflict (key) do update set value = excluded.value, updated_at = now();
```

Każde pole kryterium jest opcjonalne; pominięte nie jest sprawdzane. Zawodnik jest porównywany
z każdym kryterium i liczy się najlepsze dopasowanie.

### 4. Próba
Podgląd bez zapisu i bez wysyłki: `https://<twoja-domena>/api/raport-dzienny?dry=1`
(z nagłówkiem `Authorization: Bearer <CRON_SECRET>`, jeśli ustawiony). Bez `?dry=1` raport idzie na telefon.

## Jak liczy

| Kategoria | Reguła |
|---|---|
| **Nowy** | zawodnik, którego nie było w poprzednim przebiegu (pierwszy przebieg: tylko dodani dzisiaj) |
| **Spełnia profil** | wszystkie warunki kryterium znane i zgodne, ≥ 70 pkt z 100, dość danych |
| **Punkty** | 60 zgodność z kryterium + 30 poziom ocen skauta (skala 1–6) + 10 liczba ocenionych obserwacji; znana niezgodność ogranicza wynik do 69 |
| **Wymaga obserwacji** | jeszcze nieobserwowany · ostatnia obserwacja > 60 dni · obiecujący, ale oceniony raz · skaut zapisał „Kontynuować obserwację" |
| **Wysoki potencjał transferowy** | potencjał ≥ 5 (lub ≤ 19 lat i średnia ≥ 4,5) **oraz** status/rekomendacja „Do transferu", brak umowy albo umowa kończy się w ciągu roku |
| **Brak wystarczających danych** | brak ≥ 3 z: pozycja, rocznik, noga, wzrost, minuty, oceny z obserwacji (lub brak ocen i minut) |

Zawodnicy ze statusem „Odrzucony" są pomijani. Progi są stałymi na górze `api/_raport-dzienny.js`.

Pełny raport (listy imienne, braki w danych, powody ponownej obserwacji, ranking całej bazy) zapisuje się
w `sbs_kv`: `scouting:raport_dzienny` i kopia z datą `scouting:raport_dzienny:RRRR-MM-DD`.

## Uzupełnianie braków z Transfermarktu

Przed policzeniem raportu asystent próbuje uzupełnić puste pola zawodników: pozycję, wzrost, nogę,
datę urodzenia, narodowość, koniec umowy i menedżera (`api/_uzupelnianie.js`, parser z `api/transfermarkt.js`).
Kolejność: najpierw nowi zawodnicy, potem ci z największą liczbą braków; domyślnie do 10 zawodników
na przebieg (`?limit=`), pauza 1,2 s między zapytaniami, stop po 35 s albo po błędzie 403/429.

Zasady, żeby nie wpisać cudzych danych:
- **tylko puste pola** — niczego wpisanego przez skauta nie nadpisuje; `has_agent` zmienia tylko z „nie" na „tak";
- **tylko pewny profil** — zawodnik ma już adres Transfermarkt, albo wyszukiwanie daje *dokładnie jednego*
  kandydata o tym samym imieniu i nazwisku, którego rocznik (lub klub) zgadza się z kartoteką.
  Dwóch pasujących albo żadnego → nic nie wpisuje, a nazwisko trafia do wiadomości
  („Do ręcznego wskazania profilu TM"). Wystarczy wkleić adres profilu w kartotece, a następnego dnia dane się dociągną;
- **ślad** w `custom_fields.__ext.uzupelnienieAI` (data, źródło, adres, lista pól); nieudana próba też jest
  zapisana, więc ten sam zawodnik nie jest odpytywany częściej niż co 14 dni;
- błąd tego kroku nie blokuje raportu; `?bez_uzupelniania=1` wyłącza go całkiem.

**Uwaga:** logikę sprawdzono testem na atrapie serwisu (`node scripts/test-uzupelnianie.mjs`). Odczyt prawdziwego
Transfermarktu wymaga sieci, której to środowisko nie miało — przy pierwszym uruchomieniu zrób `?dry=1` i obejrzyj
pole `uzupelnienie` w odpowiedzi. Transfermarkt zmienia układ stron; jeśli pola przestaną się wypełniać, zacznij od
parsera w `api/transfermarkt.js`.

## Czego asystent NIE robi (świadomie)

- **Nie zmienia kartoteki** — nie wpisuje ocen, statusów ani raportów. Tylko czyta i podsumowuje.
- **Nie nadpisuje danych** wpisanych ręcznie i nie zgaduje, który to zawodnik, gdy Transfermarkt ma kilku pasujących.
- **Nie ocenia na podstawie nagrań** — nie ogląda meczów; liczy z ocen, które wpisał skaut.
- Plan Vercel **Hobby** ma 2 zadania cykliczne; to trzecie może się nie zarejestrować (sprawdź
  Project → Settings → Cron Jobs). Wtedy: plan Pro albo wywołanie z GitHub Actions / zewnętrznego crona.

# Zakładka „SBS AI" w aplikacji

W aplikacji (`/app`) asystenta widać w trzech miejscach — kod: `src/ui/sbs-ai.ts` (widok), `src/data/sbs-ai.ts` (logika, test:
`node scripts/test-sbs-ai.mjs`, wymaga Node ≥ 22.18):

- **Karta „SBS AI" na dashboardzie** — liczby z ostatniego raportu dziennego (nowi, spełniają profil, do obserwacji, potencjał transferowy,
  brak danych), ile ocen czeka na potwierdzenie i ile zadań jest otwartych. Gdy raport jest starszy niż 2 dni, karta ostrzega,
  że zadanie dzienne nie działa.
- **Pozycja „SBS AI" w menu** z odznaką: liczba propozycji ocen czekających na Twoją decyzję.
- **Zakładka „SBS AI"**: propozycje ocen z uzasadnieniem (**Potwierdź / Odrzuć**), pełny raport dzienny (ten sam tekst, który idzie na telefon,
  rankingi, lista „do ręcznego wskazania profilu TM"), zadania scoutingowe ze zmianą statusu i dziennik zapisów agenta (tylko do odczytu).

Co robią przyciski:
- **Potwierdź ocenę** — ustawia `stats_filled_in = true` i zmienia notatkę na „ocena potwierdzona przez …". Od tej chwili ocena liczy się do średnich
  i rankingu (także w już otwartej aplikacji).
- **Odrzuć** — niczego nie kasuje, tylko oznacza notatkę jako odrzuconą; propozycja znika z listy, ślad zostaje w obserwacjach.
- **Status zadania** — zapisuje listę zadań w `sbs_kv`; tuż przed zapisem odczytuje ją na nowo, żeby nie nadpisać zadania dodanego w międzyczasie przez agenta.

Widoczne dla skautów i administratorów, **ukryte dla kont klienta**. Aplikacja nie uruchamia asystenta — zakładka tylko czyta jego wyniki;
asystent pracuje na serwerze (zadanie dzienne i `/api/agent`).

# Narzędzia agenta — `/api/agent`

Dziesięć funkcji, którymi asystent AI czyta i zmienia dane w SBS (kod: `api/_agent-narzedzia.js`, bramka: `api/agent.js`,
test: `node scripts/test-agent-narzedzia.mjs`).

| Narzędzie | Co robi | Zapis |
|---|---|---|
| `pobierz_zawodnika` | kartoteka + obserwacje + raporty + analiza względem profilu klubu | – |
| `pobierz_liste_zawodnikow` | lista z filtrami (status, klub, pozycja, rocznik), do 100 na stronę | – |
| `wyszukaj_zawodnika` | po fragmencie imienia i nazwiska, kolejność słów bez znaczenia | – |
| `porownaj_zawodnikow` | zestawienie 2–5 zawodników; „najlepszy" tylko przy dość danych i ocenach | – |
| `pobierz_dane_meczu` | mecz z terminarza + obserwacje do tego meczu | – |
| `dodaj_zawodnika` | nowa kartoteka (status „Do Obserwacji", autor „SBS AI"); blokuje duplikat | tak |
| `zaktualizuj_ocene` | **propozycja** oceny 1–6 z uzasadnieniem | tak |
| `utworz_raport` | raport do **skrzynki raportów** | tak |
| `ustaw_zadanie_scoutingowe` | tworzy lub aktualizuje zadanie dla skauta (`scouting:zadania_scoutingowe`) | tak |
| `zmien_status_zawodnika` | zmiana statusu z powodem dopisanym do notatek | tak |

## Bezpieczeństwo — co agent może, a czego nie

- **Oceny agenta nie liczą się do rankingu**, dopóki skaut ich nie potwierdzi (`stats_filled_in = false`).
- **Raporty agenta trafiają do skrzynki**, nie do kartoteki — skaut przegląda je w zakładce Raporty, jak raport każdego analityka.
- **Statusy „Odrzucony", „Do transferu", „Na Testy"** wymagają `potwierdzone_przez_uzytkownika: true`. Agent ma ustawiać tę flagę
  wyłącznie po wyraźnej zgodzie użytkownika (jest to napisane w opisie narzędzia).
- **Duplikaty:** `dodaj_zawodnika` odmawia przy tym samym imieniu i nazwisku, dopóki nie padnie `na_pewno: true`.
- **Dziennik:** każdy zapis ląduje w `sbs_kv` pod `scouting:ai_dziennik` (ostatnie 500 wpisów: czas, narzędzie, zawodnik, wynik).
- **Notatki:** zmiana statusu dopisuje wiersz `[SBS AI RRRR-MM-DD] status: A → B. powód` — nic nie jest nadpisywane.

## Uruchomienie

1. Wygeneruj token: `openssl rand -hex 32`. W Vercelu dodaj `AGENT_TOKEN` (pełny dostęp).
   Opcjonalnie drugi, `AGENT_TOKEN_ODCZYT` — dla agentów, które mają tylko analizować.
2. Wymagany jest też `SUPABASE_SERVICE_KEY` (patrz `WDROZENIE.md`). Bez `AGENT_TOKEN` bramka odpowiada 503 — nigdy nie jest otwarta.
3. Sprawdź: `curl -H "Authorization: Bearer $AGENT_TOKEN" https://<domena>/api/agent` → lista narzędzi.
4. Wywołanie: `curl -X POST -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" \
   -d '{"narzedzie":"wyszukaj_zawodnika","argumenty":{"fraza":"kowalski"}}' https://<domena>/api/agent`

Odmowa narzędzia (np. duplikat, brak zgody) to odpowiedź 200 z `{"ok": false, "powod": …}` — agent ma ją przeczytać i zareagować.
Błąd 502 oznacza awarię bazy.

## Podłączenie do Claude (pętla tool-use)

Lista z `GET /api/agent` ma kształt parametru `tools` API Claude. Szkic w Node:

```js
const { narzedzia } = await (await fetch(`${URL}/api/agent`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
// messages.create({ model, tools: narzedzia, messages })
// dla każdego bloku tool_use: POST /api/agent { narzedzie: blok.name, argumenty: blok.input } → tool_result
```

Instrukcja systemowa agenta powinna powtarzać zasady wyżej: nie wymyślać ocen, nie opisywać nieobejrzanych meczów,
pytać użytkownika przed statusami o skutkach poza systemem.
