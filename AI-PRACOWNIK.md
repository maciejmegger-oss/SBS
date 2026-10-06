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

Kod: `api/raport-dzienny.js` (baza + wysyłka), `api/_raport-dzienny.js` (cała logika oceny),
test: `node scripts/test-raport-dzienny.mjs`. Zadanie cykliczne: codziennie 06:00 UTC, godzinę po
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

## Czego asystent NIE robi (świadomie)

- **Nie zmienia kartoteki** — nie wpisuje ocen, statusów ani raportów. Tylko czyta i podsumowuje.
- **Nie ocenia na podstawie nagrań** — nie ogląda meczów; liczy z ocen, które wpisał skaut.
- **Nie szuka braków w internecie sam.** Wypisuje, czego brakuje (`braki` w raporcie). Minuty uzupełniają
  `/api/refresh-stats` i `/api/stats-90minut`. Automatyczne dociąganie reszty (np. wzrost, noga z Transfermarkt)
  to osobny, następny krok.
- Plan Vercel **Hobby** ma 2 zadania cykliczne; to trzecie może się nie zarejestrować (sprawdź
  Project → Settings → Cron Jobs). Wtedy: plan Pro albo wywołanie z GitHub Actions / zewnętrznego crona.
