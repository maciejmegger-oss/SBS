# Wdrożenie (Vercel) — notatki do `vercel.json`

Objaśnienia siedziały wcześniej **w środku** `vercel.json`, pod kluczami `"//"`. Vercel sprawdza ten
plik według sztywnego schematu i nieznana właściwość — zwłaszcza wewnątrz `headers` — przerywa
wdrożenie błędem `Invalid vercel.json`. JSON nie ma komentarzy, więc opis mieszka tutaj, a plik
konfiguracyjny zawiera wyłącznie to, co Vercel rozumie.

## Adresy (`rewrites`)

| Adres | Plik | Kto wchodzi |
|---|---|---|
| `/` | `index.html` | każdy — strona wizytówkowa, bez danych z bazy |
| `/app` | `app.html` | wyłącznie po zalogowaniu |
| `/m` | `mobile.html` | wyłącznie po zalogowaniu (panel na trybunie) |

Bez wpisu w `rewrites` adresy `/app` i `/m` nie istnieją na produkcji — Vercel oddawałby stronę
główną. Ten sam podział odtwarza lokalnie wtyczka `friendlyRoutesDevPlugin` w `vite.config.ts`,
żeby serwer deweloperski zachowywał się tak samo jak wdrożenie.

## Nagłówki (`headers`)

- Dla całego serwisu: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Strict-Transport-Security` — standardowy zestaw, nic specyficznego dla projektu.
- Dla `/app` i `/m`: `X-Robots-Tag: noindex` oraz `Cache-Control: no-store`. Część zamknięta nie ma
  po co trafiać do wyszukiwarek ani zostawać w pamięci pośredniej. To higiena, nie zabezpieczenie —
  zabezpieczeniem jest logowanie i reguły dostępu w bazie (patrz `DOSTEP.md`).

## Zadania cykliczne (`crons`)

**Uwaga co do liczby zadań:** plan Hobby dopuszcza dwa zadania i uruchamia je raz na dobę. Przy
większej liczbie wpisów część nie zostaje w ogóle zarejestrowana — to był najbardziej prawdopodobny
powód, dla którego statystyki Ekstraklasy stały na drugiej kolejce. Sprawdzić można w Vercelu:
Project → Settings → Cron Jobs; widoczne tam są tylko te, które naprawdę działają.

Żaden z adresów w `crons` nie ma ciągu zapytania. Endpointy zapisują domyślnie, a podgląd wymaga
`?dry=1` — dzięki temu zgubienie parametru przez harmonogram nie zamienia przebiegu w bezczynność.

## Gdy wdrożenie się nie powiedzie

Vercel → projekt → **Deployments** → kliknij wpis z czerwonym znaczkiem → **Building** / **Logs**.
Pierwsza linia błędu wskazuje przyczynę; najczęstsze to niepoprawny `vercel.json` (jak wyżej) albo
brak zmiennych `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` w danym środowisku — muszą być
włączone także dla **Preview**, nie tylko dla **Production**, a po ich dodaniu trzeba wdrożyć
ponownie.
