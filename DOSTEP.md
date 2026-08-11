# Dostęp do Scout Base System — jak to teraz działa

Krótka instrukcja obsługi dla administratora systemu. Wszystko, co trzeba zrobić raz przy
wdrożeniu, jest w części „Uruchomienie". Codzienna praca to jedna zakładka w aplikacji.

## Stan na dziś: ekran logowania WŁĄCZONY, reguły w bazie czekają

- `/app` i `/m` **pytają o hasło** — osoba z zewnątrz nie zobaczy już ani jednego ekranu systemu.
- Po zalogowaniu masz **pełen dostęp, dokładnie jak dotąd** — żadnych nowych ograniczeń w środku.
- Adres główny (`/`) jest otwarty i taki ma być: to wizytówka, bez danych.
- **Zostaje jeden krok po Twojej stronie** — uruchomienie migracji w Supabase (część
  „Uruchomienie"). Dopóki tego nie zrobisz, zamknięty jest *widok*, a nie *dane*: kto zna adres
  bazy i klucz ze strony, ten wciąż może odpytać ją z pominięciem aplikacji.

Czego ta blokada z natury nie obejmuje: kod strony zawiera wbudowane listy klubów i składów
(dane jawne, z ogólnodostępnych serwisów) — one są w pliku aplikacji i da się je odczytać.
Praca klubu, czyli obserwacje, oceny, raporty i opinie, jest wyłącznie w bazie i to ją zamyka
migracja.

## Jak Ty się logujesz

Logowanie idzie przez konto w Supabase Auth — nie ma osobnego hasła „do strony". Zanim cokolwiek
zamkniemy, upewnij się, że masz konto i że wchodzisz.

**Raz, zanim wejdziesz pierwszy raz po zamknięciu:**

1. Supabase → **Authentication → Users → Add user**: podaj swój adres (`maciejmegger@gmail.com`)
   i hasło, zaznacz **Auto Confirm User**. Bez tego konto czeka na potwierdzenie z maila.
2. Wejdź na `/app` i zaloguj się tym adresem i hasłem. Powinno wpuścić od razu na dashboard.
3. Potem dopiero migracja z części „Uruchomienie" — w tej kolejności, bo migracja otwiera
   dostęp kontom, które w tym momencie już istnieją.

Gdyby konto powstało dopiero PO migracji, wejdzie ono ze stanem „oczekuje" i zobaczysz ekran
„Konto czeka na akceptację". Naprawa: uruchom skrypt migracji jeszcze raz — jest do tego
przystosowany i przy każdym przebiegu ustawia Twój adres jako administratora z dostępem.

**Na co dzień, po zamknięciu:**

- komputer: `/app` → adres e-mail + hasło;
- telefon: `/m` → to samo konto, ten sam e-mail i hasło;
- zapomniane hasło: „Nie pamiętam hasła" na ekranie logowania wysyła link (wymaga adresów
  ustawionych w punkcie 3 „Uruchomienia").

**Gdyby coś poszło nie tak** — hasło zawsze zmienisz w Supabase (Authentication → Users → menu
przy koncie → *Reset password* albo *Send magic link*), a dostęp przywrócisz jednym zapytaniem
w SQL Editorze:

```sql
update sbs_konta set status = 'zatwierdzone', rola = 'admin'
where lower(email) = 'maciejmegger@gmail.com';
```

Nie da się więc zamknąć na zewnątrz na stałe: klucz do bazy masz w panelu Supabase, a panel
Supabase ma własne logowanie, niezależne od tego systemu.

## Co jest publiczne, a co zamknięte

| Adres | Co tam jest | Kto ma dostęp |
|---|---|---|
| `/` | Strona wizytówkowa: czym jest system, moduły, formularz zgłoszenia | każdy |
| `/app` | Cały system (baza, obserwacje, raporty, ranking) | wyłącznie konta zalogowane **i zatwierdzone** |
| `/m` | Panel mobilny SBS Live | wyłącznie konta zalogowane **i zatwierdzone** |

Na stronie publicznej nie ma ani jednego rekordu z bazy — żadnych nazwisk, klubów, ocen. Można
więc bez obaw wysłać adres główny w wizytówce e-mail: kto wejdzie, zobaczy opis systemu, a nie
projekt.

## Uruchomienie (jednorazowo, gdy zdecydujesz, że zamykamy)

1. **Wgraj reguły dostępu do bazy.** Supabase → SQL Editor → New query → wklej całą zawartość
   `supabase/migration_2026-08-11_konta_i_zgoda.sql` → Run.
   Przed uruchomieniem podmień w sekcji *ADMINISTRATOR SYSTEMU* adres e-mail na swój.
   Skrypt można uruchomić ponownie, nic nie psuje.

   To jest **właściwe** zabezpieczenie. Ekran logowania w przeglądarce sam z siebie niczego nie
   chroni: klucz dostępu do bazy jest wpisany w kod każdej strony i każdy może go odczytać.
   Dopiero reguły z tego skryptu sprawiają, że baza nie odda ani jednego wiersza komuś, kto nie
   jest zalogowany i zatwierdzony.

2. **Sprawdź, że wchodzisz.** Wejdź na `/app`, zaloguj się swoim kontem, zobacz dane. Konta, które
   istniały przed wdrożeniem, skrypt zostawia z dostępem — nikt nie traci wejścia w trakcie.

3. **Ustaw adresy w Supabase.** Authentication → URL Configuration:
   - *Site URL*: `https://scoutbasesystem.com`
   - *Redirect URLs*: dopisz `https://scoutbasesystem.com/app` (link z e-maila potwierdzającego
     i link do zmiany hasła mają prowadzić do systemu, nie na stronę wizytówkową).

4. **Zdecyduj o potwierdzaniu adresu.** Authentication → Providers → Email → *Confirm email*.
   Włączone (zalecane) oznacza, że zgłaszający musi kliknąć link ze swojej skrzynki — dzięki temu
   nikt nie zgłasza się z cudzego adresu. Zgłoszenie i tak trafia do Ciebie od razu.

Ekran logowania jest już włączony (`WYMAGAJ_LOGOWANIA = true` w `src/main.ts`, przełącznik stoi
tuż nad funkcją `startApp`); panel mobilny pyta o hasło tak samo. Te dwie rzeczy — ekran i reguły
w bazie — są od siebie niezależne i tylko reguły naprawdę zamykają dane. Ekran bez reguł jest
zasłoną, reguły bez ekranu działają w pełni.

## Codzienna praca: zakładka „Dostęp"

Zakładkę widzisz w bocznym menu tylko Ty (rola `admin`). Są w niej trzy listy:

- **Czekają na decyzję** — nowe zgłoszenia ze strony. Widzisz imię i nazwisko, klub, rolę,
  telefon, e-mail i datę zgłoszenia. Dwa przyciski: *Przyznaj dostęp* albo *Odrzuć*.
- **Mają dostęp** — kto pracuje w systemie. Stąd *Cofnij dostęp* (działa natychmiast — konto
  przestaje widzieć dane przy pierwszym zapytaniu, nie po wygaśnięciu sesji) oraz nadanie praw
  administratora komuś innemu.
- **Bez dostępu** — odrzuceni i ci, którym dostęp odebrano. Można ich w każdej chwili przywrócić.

Własnego konta nie da się odrzucić ani pozbawić praw administratora jednym kliknięciem — to
najprostsza droga do zamknięcia się na zewnątrz własnego systemu.

## Jak wygląda to od strony zgłaszającego

1. Wypełnia formularz na stronie głównej (imię i nazwisko, klub, rola, e-mail, telefon, hasło).
2. Konto powstaje ze stanem **oczekuje**. Po zalogowaniu widzi ekran „Konto czeka na akceptację",
   a nie system — i nie ma znaczenia, czy wejdzie przez komputer, czy przez telefon.
3. Gdy przyznasz dostęp, klika „Sprawdź ponownie" (albo loguje się jeszcze raz) i wchodzi.

## Czego to nie obejmuje

- **Poziomów uprawnień wewnątrz systemu.** Każde zatwierdzone konto widzi całą bazę; role są dwie:
  `scout` i `admin`, a `admin` różni się tylko możliwością przyznawania dostępu. Gdyby kiedyś
  potrzebny był podział (np. skaut widzi wyłącznie swoje obserwacje), trzeba to dołożyć w regułach
  dostępu — sama aplikacja tego nie rozstrzygnie.
- **Rejestru zmian.** Baza pamięta stan konta i datę decyzji, ale nie historię „kto komu i kiedy"
  odbierał dostęp.
- **Wylogowania na odległość.** Cofnięcie dostępu odcina od danych natychmiast, ale sesja w cudzej
  przeglądarce formalnie trwa do wygaśnięcia — po prostu nic już nie pobiera.
