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
