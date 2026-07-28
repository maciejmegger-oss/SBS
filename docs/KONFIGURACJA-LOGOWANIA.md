# Uruchomienie logowania — instrukcja krok po kroku

Ta instrukcja opisuje wszystko, co trzeba wyklikać poza kodem: w Supabase,
u dostawcy poczty i na Vercelu. Zajmuje około 40 minut.

Kolejność ma znaczenie — kroki 1–5 zakładają konta i uruchamiają logowanie,
krok 8 zamyka dostęp do bazy. **Kroku 8 nie wykonuj, dopóki wszyscy nie
potwierdzą, że potrafią się zalogować.**

---

## Zanim zaczniesz — co się właściwie zmienia

Dziś każda tabela w bazie ma regułę „pełny dostęp dla niezalogowanych", a klucz
`VITE_SUPABASE_ANON_KEY` jest wkompilowany w plik JavaScript wysyłany do
przeglądarki i da się go odczytać w narzędziach deweloperskich. W praktyce:
kto zna adres strony, może odczytać i skasować całą bazę zawodników,
obserwacji i raportów.

Po wykonaniu tej instrukcji:

- strona pod publicznym adresem pokazuje wyłącznie wizytówkę, bez żadnych danych,
- panel otwiera się dopiero po zalogowaniu,
- konta zakładasz Ty — nikt nie zarejestruje się sam,
- każde konto ma rolę: **administrator** (zarządza kontami), **scout**
  (normalna praca) albo **podgląd** (tylko odczyt),
- sam klucz `anon` przestaje dawać dostęp do czegokolwiek (po kroku 8).

---

## Krok 1. Migracja bazy danych

1. Wejdź na [supabase.com](https://supabase.com) → Twój projekt.
2. Menu po lewej → **SQL Editor** → **New query**.
3. Wklej całą zawartość pliku `supabase/migration_2026-07-28_auth.sql`.
4. **Run** (albo Ctrl+Enter).

Powinno pojawić się „Success. No rows returned". Migracja nie usuwa żadnych
danych i można ją bezpiecznie uruchomić ponownie.

Co powstało: tabela organizacji, tabela profili z rolami, kolumna `org_id`
we wszystkich tabelach z danymi oraz rejestr logowań.

---

## Krok 2. Wyłączenie samodzielnej rejestracji

To najważniejsze kliknięcie w całej instrukcji. Bez niego każdy, kto zna adres,
założy sobie konto.

1. Supabase → **Authentication** → **Sign In / Providers**.
2. Sekcja **Email** → wyłącz **Allow new users to sign up**.
3. W tej samej sekcji upewnij się, że **Confirm email** jest włączone.
4. **Save**.

---

## Krok 3. Adresy powrotne z e-maili

Linki wysyłane w zaproszeniach muszą wiedzieć, dokąd wrócić.

1. Supabase → **Authentication** → **URL Configuration**.
2. **Site URL**: adres produkcyjny, np. `https://twoj-projekt.vercel.app`
   (albo własna domena, jeśli ją masz).
3. **Redirect URLs** — dodaj obie pozycje:
   - `https://twoj-projekt.vercel.app/**`
   - `http://localhost:5173/**` (żeby dało się testować lokalnie)
4. **Save**.

> Jeśli pominiesz ten krok, kliknięcie linku z zaproszenia wyrzuci błąd
> „redirect URL not allowed".

---

## Krok 4. Twoje konto administratora

1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**.
2. E-mail: `maciejmegger@gmail.com`, hasło: dowolne (zmienisz je później w aplikacji).
3. Zaznacz **Auto Confirm User** — inaczej konto będzie czekać na potwierdzenie.
4. **Create user**.
5. Wróć do **SQL Editor** i uruchom:

```sql
update sbs_users set role = 'admin', active = true
where email = 'maciejmegger@gmail.com';

select email, role, active from sbs_users;
```

Druga komenda musi pokazać Twój adres z rolą `admin`. Dopóki nie ma ani jednego
konta administratora, nikt nie może zapraszać kolejnych osób — to celowe.

---

## Krok 5. Klucz serwisowy dla zarządzania kontami

Zapraszanie i usuwanie kont wymaga klucza `service_role`. Ten klucz daje pełną,
nieograniczoną władzę nad bazą — **nigdy nie umieszczaj go w kodzie aplikacji
ani w zmiennej zaczynającej się od `VITE_`**, bo wszystko z tym przedrostkiem
trafia do przeglądarki i jest czytelne dla każdego odwiedzającego.

1. Supabase → **Project Settings** → **API keys**.
2. Skopiuj **`service_role`** (sekcja „Secret keys", trzeba kliknąć „Reveal").
3. Vercel → Twój projekt → **Settings** → **Environment Variables** → dodaj:

| Nazwa | Wartość | Środowiska |
|---|---|---|
| `SUPABASE_URL` | adres projektu, np. `https://abcxyz.supabase.co` | wszystkie |
| `SUPABASE_ANON_KEY` | klucz `anon` / `publishable` | wszystkie |
| `SUPABASE_SERVICE_ROLE_KEY` | klucz `service_role` | wszystkie |

4. **Redeploy** projektu — zmienne środowiskowe wczytują się dopiero przy
   nowym wdrożeniu.

Sprawdź też, czy istnieją już `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`
(potrzebuje ich aplikacja w przeglądarce). Jeśli ich nie ma — dodaj.

---

## Krok 6. Poczta wychodząca (własny SMTP)

Wbudowany nadawca Supabase pozwala na kilka wiadomości na godzinę i często
ląduje w spamie. Do zapraszania użytkowników to za mało.

### 6a. Załóż konto u dostawcy poczty

Polecam [Resend](https://resend.com) — darmowy próg 3000 wiadomości miesięcznie,
najprostsza konfiguracja. Alternatywy: Brevo, Postmark, Mailgun.

1. Zarejestruj się w Resend.
2. **Domains** → **Add Domain** → wpisz swoją domenę.
3. Resend pokaże 3 wpisy DNS (SPF, DKIM, DMARC) — dodaj je u operatora domeny
   (tam, gdzie ją kupiłeś). Weryfikacja trwa od kilku minut do kilku godzin.
4. **API Keys** → **Create API Key** → skopiuj klucz.

> **Nie masz własnej domeny?** Pomiń ten krok i na razie korzystaj z wbudowanego
> nadawcy Supabase. Przy kilku zaproszeniach miesięcznie wystarczy — trzeba
> tylko uprzedzić zapraszane osoby, żeby sprawdziły folder ze spamem.
> SMTP dołożysz później bez zmian w kodzie.

### 6b. Podłącz SMTP do Supabase

1. Supabase → **Project Settings** → **Authentication** → **SMTP Settings**.
2. Włącz **Enable Custom SMTP** i wpisz dane z Resend:

| Pole | Wartość |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | klucz API z Resend |
| Sender email | `system@twojadomena.pl` |
| Sender name | `Scout Base System` |

3. **Save**.

### 6c. Spolszcz treść zaproszenia

Supabase wysyła domyślnie angielskie wiadomości.

1. Supabase → **Authentication** → **Emails** → zakładka **Invite user**.
2. **Subject**: `Zaproszenie do Scout Base System`
3. **Message body**:

```html
<h2>Zaproszenie do Scout Base System</h2>
<p>Otrzymujesz dostęp do systemu skautingowego Scout Base System.</p>
<p>Kliknij poniższy link, żeby ustawić swoje hasło i wejść do panelu:</p>
<p><a href="{{ .ConfirmationURL }}">Ustaw hasło i zaloguj się</a></p>
<p>Link jest jednorazowy i wygasa po 24 godzinach. Jeśli wygaśnie,
poproś administratora o ponowne zaproszenie.</p>
<p style="color:#888;font-size:12px">Jeśli nie spodziewasz się tej wiadomości, zignoruj ją.</p>
```

4. To samo dla zakładki **Reset password** (temat: `Reset hasła — Scout Base System`).

---

## Krok 7. Sprawdzenie, że działa

1. Otwórz adres produkcyjny w **oknie prywatnym** przeglądarki.
   Powinna pojawić się wizytówka bez żadnych danych.
2. **Zaloguj się** → Twój adres i hasło z kroku 4 → wchodzisz do panelu.
3. W bocznym menu pojawia się zakładka **Użytkownicy** (widoczna tylko dla admina).
4. Zaproś sam siebie na drugi adres e-mail i sprawdź, czy wiadomość dochodzi
   i czy link do ustawienia hasła działa.
5. Zaproś resztę zespołu.

**Dopiero gdy wszyscy potwierdzą, że potrafią się zalogować, przejdź do kroku 8.**

---

## Krok 8. Zamknięcie dostępu do bazy

To krok, który faktycznie zamyka dziurę opisaną na początku.

1. Otwórz w drugiej zakładce plik `supabase/schema_rls.sql` — to Twoja droga
   powrotna, gdyby coś poszło nie tak.
2. Supabase → **SQL Editor** → **New query**.
3. Wklej całą zawartość `supabase/rls_authenticated.sql` → **Run**.
4. Odśwież aplikację i sprawdź, czy dane nadal się wczytują.

Skrypt sam odmówi wykonania, jeśli nie istnieje aktywne konto administratora —
zabezpieczenie przed zamknięciem się na zewnątrz.

### Gdyby coś poszło nie tak

Uruchom ponownie `supabase/schema_rls.sql`. Przywróci stary, otwarty dostęp
i aplikacja zacznie działać jak dawniej. Potem możesz spokojnie szukać przyczyny.

### Sprawdzenie

```sql
select tablename, policyname, roles, cmd
from pg_policies where schemaname = 'public' order by tablename, cmd;
```

Na liście nie powinno być ani jednej reguły z rolą `anon`.

---

## Role — co kto może

| | Administrator | Scout | Podgląd |
|---|---|---|---|
| Przeglądanie danych | ✔ | ✔ | ✔ |
| Dodawanie i edycja zawodników, obserwacji, raportów | ✔ | ✔ | — |
| Usuwanie rekordów | ✔ | — | — |
| Zarządzanie kontami | ✔ | — | — |

Rolę zmieniasz w zakładce **Użytkownicy**. Ograniczenia są egzekwowane przez
bazę danych, nie przez przeglądarkę — obejście przez konsolę nic nie da.

---

## Praca lokalna

Utwórz plik `.env` w katalogu projektu (jest w `.gitignore`, nie trafi do repozytorium):

```
VITE_SUPABASE_URL=https://twoj-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=klucz-anon
```

Zarządzanie kontami wymaga lokalnie także zmiennych serwerowych:

```
SUPABASE_URL=https://twoj-projekt.supabase.co
SUPABASE_ANON_KEY=klucz-anon
SUPABASE_SERVICE_ROLE_KEY=klucz-service-role
```

Uruchomienie: `npm run dev` → http://localhost:5173

---

## Najczęstsze problemy

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| „Brak konfiguracji Supabase" | Nie ma zmiennych `VITE_*`. Dodaj je i zrób redeploy. |
| Zaproszenie nie dochodzi | Sprawdź spam. Bez własnego SMTP obowiązuje limit kilku maili na godzinę. |
| „redirect URL not allowed" po kliknięciu linku | Krok 3 — dodaj adres do **Redirect URLs**. |
| „Funkcja /api/admin-users nie odpowiedziała poprawnie" | Brakuje `SUPABASE_SERVICE_ROLE_KEY` na Vercelu, albo nie zrobiono redeploy. |
| „Twoje konto nie ma przypisanego profilu" | Nie wykonano migracji z kroku 1. |
| Po kroku 8 aplikacja nie wczytuje danych | Uruchom `supabase/schema_rls.sql`, żeby cofnąć zmianę, i sprawdź `select email, role from sbs_users;` |
| Straciłeś dostęp administratora | SQL Editor: `update sbs_users set role='admin', active=true where email='twoj@adres.pl';` |

---

## Czego ta instrukcja NIE obejmuje

Świadomie pominięte na tym etapie — do ustalenia osobno:

- **Pakiety i płatności.** Kolumna `plan` w tabeli organizacji istnieje, ale nic
  jej jeszcze nie odczytuje. Fundament wielodostępowy (`org_id`) jest gotowy.
- **Logowanie dwuskładnikowe (2FA).** Supabase to obsługuje; do rozważenia,
  gdy pojawią się konta klientów zewnętrznych.
- **Zgodność z RODO.** System loguje dostępy i pozwala usuwać konta, ale sama
  polityka przetwarzania, obowiązek informacyjny wobec zawodników i podstawa
  prawna to kwestie prawne, nie techniczne. Przed sprzedażą dostępu na zewnątrz
  wymagają konsultacji z prawnikiem.
