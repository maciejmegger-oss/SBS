# Dostęp do Scout Base System — jak to teraz działa

Krótka instrukcja obsługi dla administratora systemu. Wszystko, co trzeba zrobić raz przy
wdrożeniu, jest w części „Uruchomienie". Codzienna praca to jedna zakładka w aplikacji.

## Stan na dziś: blokada jest przygotowana, ale NIE włączona

Wszystko poniżej jest już w kodzie i czeka na jedno słowo. Dopóki nie zrobisz kroków z części
„Uruchomienie":

- `/app` i `/m` **otwierają się bez logowania** — dokładnie jak dotąd, praca idzie normalnie;
- ekran logowania, zakładka „Dostęp" i formularz zgłoszenia już działają dla kont, które istnieją;
- **nie wysyłaj jeszcze linku do `/app`** osobom spoza klubu — zamknięty jest dopiero po kroku 1.

Sam adres główny (`/`) możesz pokazywać od zaraz: to strona wizytówkowa, nie ma na niej danych.

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

5. **Włącz ekran logowania.** W `src/main.ts` ustaw `WYMAGAJ_LOGOWANIA = true` (przełącznik stoi
   tuż nad funkcją `startApp`, z opisem). Panel mobilny nie ma własnego przełącznika — sam
   zauważy, że baza przestała oddawać dane bez sesji, i poprosi o hasło.

   Punkty 1 i 5 są od siebie niezależne i tylko punkt 1 naprawdę zamyka dane. Przełącznik bez
   reguł byłby zasłoną (dane wciąż do wzięcia z pominięciem aplikacji), reguły bez przełącznika
   działają w pełni — pokazywałyby tylko brzydszy komunikat zamiast ekranu logowania.

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
