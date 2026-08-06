# SBS Scout Live — panel mobilny

Aplikacja na telefon do robienia raportu z obserwacji **w trakcie meczu**. Osobne wejście obok
aplikacji na komputerze, ta sama baza i to samo logowanie.

## Jak wejść na telefonie

1. Otwórz w przeglądarce telefonu adres wdrożonej aplikacji z końcówką **`/m`**
   (np. `https://twoj-adres.vercel.app/m`).
2. Zaloguj się tym samym e-mailem i hasłem, co w Scout Base System.
3. **Android (Chrome):** menu ⋮ → „Dodaj do ekranu głównego".
   **iPhone (Safari):** przycisk udostępniania → „Do ekranu początkowego".

Po dodaniu panel otwiera się jak zwykła aplikacja — bez paska adresu, na pełnym ekranie.

Lokalnie, w trakcie pracy nad kodem: `npm run dev`, a potem `http://localhost:5173/m`
(na telefonie w tej samej sieci: `npm run dev -- --host` i adres z sieci lokalnej).

## Jak to działa

| Ekran | Do czego służy | Co zapisuje |
| --- | --- | --- |
| **Obserwacje** | plany pobrane z SBS, od wczoraj wzwyż; wejście w mecz jednym kliknięciem | nic (albo nowa obserwacja spoza planu) |
| **Live** | zegar meczu, przełącznik *udane/nieudane*, dziewięć kafli zdarzeń, oś zdarzeń, cofnięcie | `sbs_live_events` (lub `sbs_kv`, patrz niżej) |
| **Ocena** | 5 atrybutów 1–10, fazy gry i stałe fragmenty 1–6, perspektywa, decyzja, dyktowany opis | `sbs_observations.ratings`, `sbs_reports`, `sbs_players.status` |
| **Baza** | wyszukiwarka zawodników offline, stan kolejki wysyłki, odświeżenie kopii bazy | nic |

Skale i klucze są **identyczne** z aplikacją na komputerze (`RATING_KEYS`, `REPORT_PHASES`,
`REPORT_SET_PIECES` w `src/main.ts`), więc radar, średnie i wykresy w SBS liczą się bez żadnej
konwersji.

## Praca bez zasięgu

Na stadionach młodzieżowych sieci zwykle nie ma, więc brak zasięgu jest tu stanem normalnym,
a nie awarią:

- kopia bazy (zawodnicy, kluby, obserwacje) leży w pamięci telefonu i wystarcza do pracy;
- każde zdarzenie zapisuje się lokalnie **natychmiast po dotknięciu** — przeglądarka może ubić
  kartę w tle, mecz się nie zgubi;
- zapisy czekają w kolejce i idą na serwer same, gdy wróci sieć; licznik kolejki widać w pasku
  u góry i w zakładce Baza.

## Tabela zdarzeń — nieobowiązkowa

Panel działa od razu, bez żadnej migracji. Oś zdarzeń zapisuje się wtedy w `sbs_kv` pod kluczem
`scouting:liveEvents:<id obserwacji>`. Gdy zdarzenia mają być przeszukiwalne w SQL albo widoczne
w aplikacji na komputerze, uruchom w Supabase (SQL Editor → New query → Run):

```
supabase/migration_2026-08-06_live_events.sql
```

Panel sam wykryje, że tabela istnieje, i od następnego meczu zapisze się właściwą drogą.

## Pliki

- `main.ts` — widoki, obsługa dotknięć, zegar meczu
- `db.ts` — dostęp do bazy, kopia offline, kolejka wysyłki
- `style.css` — wygląd (ciemne tło, pola dotyku min. 44 px)
- `../../mobile.html` — wejście, `../../public/sw.js` — mechanizm offline, `../../public/manifest.webmanifest` — instalacja na ekranie głównym
