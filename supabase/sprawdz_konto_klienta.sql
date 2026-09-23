-- CO BAZA NAPRAWDĘ MYŚLI O KONCIE KLIENTA
--
-- PO CO TEN PLIK
-- Gdy klient mówi „widzę wszystkie ligi, a wykupiłem jedną", odpowiedź leży w bazie, a nie na
-- ekranie. Ten skrypt niczego nie zmienia — wypisuje sześć rzeczy, które razem dają pewność:
-- czy konto jest klientem, co ma wykupione, czy reguły dostępu są na miejscu i ile klubów
-- powinno w takim razie widzieć.
--
-- JAK URUCHOMIĆ
-- Supabase → SQL Editor → New query → wklej całość → Run. Wyników będzie kilka tabelek pod sobą.
--
-- UWAGA: w SQL Editorze jesteś właścicielem bazy, a nie zalogowanym klientem. Dlatego NIE da się
-- tu wywołać sbs_klient() „za klienta" — sprawdzamy więc SKŁADNIKI, z których ta funkcja liczy
-- odpowiedź. Wychodzi na to samo, tylko widać, który składnik zawodzi.

-- ---------------------------------------------------------------------------
-- 1. KONTA: KTO JEST KIM I CO MA WYKUPIONE
-- ---------------------------------------------------------------------------
-- Czytaj tak:
--   werdykt „KLIENT — widzi tylko swoje pakiety"  → tak ma być,
--   „SKAUT — WIDZI CAŁĄ BAZĘ"                     → to jest szukana przyczyna,
--   „klient bez pakietu — panel pusty"            → rola jest, brakuje pakietu,
--   „czeka na dostęp"                             → konto jeszcze nic nie widzi.

select
  email,
  rola,
  status,
  coalesce(pakiety, '{}')            as pakiety_wykupione,
  coalesce(pakiet_zadany, '—')       as pakiet_z_formularza,
  case
    when status <> 'zatwierdzone'                   then 'czeka na dostęp — nic nie widzi'
    when rola = 'admin'                             then 'ADMINISTRATOR — widzi i zmienia wszystko'
    when rola = 'klient' and coalesce(array_length(pakiety,1),0) = 0
                                                    then 'klient bez pakietu — panel pusty'
    when rola = 'klient' and 'Premium' = any(pakiety)
                                                    then 'KLIENT — Premium, wszystkie rozgrywki'
    when rola = 'klient'                            then 'KLIENT — widzi tylko swoje pakiety'
    else '>>> SKAUT — WIDZI CAŁĄ BAZĘ, WSZYSTKIE LIGI <<<'
  end as werdykt
from public.sbs_konta
order by (rola = 'klient') desc, utworzone_at desc;

-- ---------------------------------------------------------------------------
-- 2. CZY REGUŁY DOSTĘPU W OGÓLE DZIAŁAJĄ
-- ---------------------------------------------------------------------------
-- Obie tabele muszą mieć „rls_wlaczone = true". Gdy któraś ma false, reguły są wyłączone
-- i KAŻDE zalogowane konto widzi wszystko, niezależnie od roli i pakietów.

select relname as tabela, relrowsecurity as rls_wlaczone
from pg_class
where relname in ('sbs_clubs','sbs_players','sbs_konta')
order by relname;

-- ---------------------------------------------------------------------------
-- 3. JAKIE REGUŁY ODCZYTU STOJĄ PRZY KLUBACH I ZAWODNIKACH
-- ---------------------------------------------------------------------------
-- Przy sbs_clubs ma być DOKŁADNIE JEDNA reguła select, a w jej treści ma być „sbs_ma_lige".
-- Przy sbs_players — jedna, z „sbs_ma_zawodnika". Jeśli reguł jest więcej, wystarczy, że
-- jedna z nich przepuszcza wszystko, i pakiety przestają cokolwiek znaczyć: Postgres łączy
-- reguły przez LUB. Taka nadmiarowa reguła to najczęściej pozostałość po starszej migracji
-- uruchomionej ponownie już po wdrożeniu pakietów.

select tablename as tabela, policyname as regula, cmd as operacja, qual as warunek
from pg_policies
where schemaname = 'public' and tablename in ('sbs_clubs','sbs_players') and cmd = 'SELECT'
order by tablename, policyname;

-- ---------------------------------------------------------------------------
-- 4. CZY FUNKCJE OD PAKIETÓW ISTNIEJĄ
-- ---------------------------------------------------------------------------
-- Ma być pięć wierszy. Brak którejkolwiek oznacza, że migracja z 22.09 nie przeszła do końca.

select proname as funkcja
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('sbs_klient','sbs_pakiety','sbs_poziom_ligi','sbs_ma_lige','sbs_ma_zawodnika')
order by proname;

-- ---------------------------------------------------------------------------
-- 5. ILE KLUBÓW DAJE KTÓRY PAKIET
-- ---------------------------------------------------------------------------
-- Tyle klubów ma zobaczyć klient z danym pakietem — i tyle ma być w jego zakładce „Kluby".
-- Gdy widzi więcej (albo wszystkie), przyczyna jest w punkcie 1, 2 albo 3.

select public.sbs_poziom_ligi(league) as pakiet, count(*) as klubow
from public.sbs_clubs
group by 1
order by 2 desc;

-- ---------------------------------------------------------------------------
-- 6. CZY ODCZYT ZAWODNIKÓW NIE JEST ZA WOLNY
-- ---------------------------------------------------------------------------
-- Dotyczy komunikatu „Nie wczytałem wszystkich danych — brakuje: players".
--
-- Reguła przy sbs_players woła sbs_ma_zawodnika() DLA KAŻDEGO WIERSZA, a ta funkcja zagląda do
-- sbs_konta i sbs_clubs. Przy kilkunastu tysiącach zawodników to kilkanaście tysięcy zapytań
-- w jednym odczycie i baza potrafi przerwać go po swoim limicie czasu — wtedy przeglądarka
-- dostaje błąd i pokazuje ten właśnie pasek.
--
-- Poniżej: ilu jest zawodników i czy sbs_clubs.id ma indeks (bez niego każde z tych wywołań
-- przegląda całą tabelę klubów od początku).

select count(*) as zawodnikow_w_bazie from public.sbs_players;

select indexname as indeks, indexdef as definicja
from pg_indexes
where schemaname = 'public' and tablename = 'sbs_clubs';
