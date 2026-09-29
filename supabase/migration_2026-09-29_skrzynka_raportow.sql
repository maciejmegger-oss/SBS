-- SKRZYNKA RAPORTÓW — raporty przygotowane poza aplikacją, czekające na skauta
--
-- PO CO TO JEST
-- Raport z analizy nagrania powstaje dziś poza systemem i trzeba go przepisywać do formularza pole
-- po polu. Ta tabela jest miejscem, do którego taki gotowy raport można dopisać z zewnątrz —
-- a skaut wczytuje go w zakładce „Raporty" jednym kliknięciem, sprawdza i zapisuje jak każdy inny.
--
-- DLACZEGO NIE PROSTO DO sbs_reports
-- Raport ma autora, który bierze na siebie ocenę. Wpis w skrzynce to dopiero PROPOZYCJA: dopóki
-- skaut jej nie przejrzy i nie kliknie „Zapisz raport", nie ma jej w kartotece, nie liczy się do
-- średnich i nie zmienia statusu zawodnika. Osobna tabela pozwala też przyjmować wpisy kluczem
-- publicznym, bez otwierania zapisu do prawdziwych raportów, zawodników czy klubów.
--
-- KTO CO MOŻE
--   * anon (klucz publiczny, ten sam, który siedzi w przeglądarce)  — TYLKO dopisywanie nowych wpisów.
--     Nie czyta niczego, nie zmienia i nie kasuje. Najgorsze, co może zrobić ktoś obcy z tym
--     kluczem, to wrzucić do skrzynki śmieciowy wpis — skaut odrzuca go jednym kliknięciem.
--   * zatwierdzone konto — czyta skrzynkę i zmienia status wpisu ('wczytany' / 'odrzucony').
--   * administrator — dodatkowo kasuje wpisy na stałe.
--
-- URUCHOMIENIE
--   Supabase → SQL Editor → New query → wklej całość → Run. Skrypt jest bezpieczny do powtórzenia.
--
-- COFNIĘCIE
--   drop table if exists public.sbs_raport_inbox;

create table if not exists public.sbs_raport_inbox (
  id            text primary key,
  utworzone_at  timestamptz not null default now(),
  -- Skąd przyszedł wpis: 'claude', 'analityk', nazwa narzędzia. Widoczne przy wpisie na liście,
  -- żeby skaut wiedział, czyją propozycję ogląda.
  zrodlo        text,
  -- Zawodnik z kartoteki. Zostawiamy bez klucza obcego świadomie: wpis może przyjść, zanim
  -- zawodnik zostanie założony, a wtedy klucz obcy odrzuciłby cały raport zamiast pozwolić
  -- skautowi dopisać zawodnika i wczytać treść.
  player_id     text,
  -- Podpis zawodnika i spotkania — to, co widać na liście, zanim ktokolwiek otworzy treść.
  zawodnik      text,
  tytul         text,
  -- Treść w kształcie formularza raportu: date, scout, obsType, rywal, wynik, minutyObejrzane,
  -- pozycjaWMeczu, mocne, doPoprawy, technika, taktyka, motoryka, mentalnoscOpis, potencjalOpis,
  -- perspektywa, phases, setPieces, setPieceComment, description, status.
  dane          jsonb not null default '{}'::jsonb,
  -- 'nowy' czeka na decyzję, 'wczytany' skaut wciągnął do formularza, 'odrzucony' odłożony.
  status        text not null default 'nowy'
);

create index if not exists sbs_raport_inbox_status_idx
  on public.sbs_raport_inbox (status, utworzone_at desc);

alter table public.sbs_raport_inbox enable row level security;

drop policy if exists "inbox: dopisywanie z zewnatrz" on public.sbs_raport_inbox;
create policy "inbox: dopisywanie z zewnatrz"
  on public.sbs_raport_inbox for insert to anon, authenticated
  with check (status = 'nowy');

drop policy if exists "inbox: odczyt dla zatwierdzonych" on public.sbs_raport_inbox;
create policy "inbox: odczyt dla zatwierdzonych"
  on public.sbs_raport_inbox for select to authenticated
  using (public.sbs_zatwierdzony());

drop policy if exists "inbox: zmiana statusu dla zatwierdzonych" on public.sbs_raport_inbox;
create policy "inbox: zmiana statusu dla zatwierdzonych"
  on public.sbs_raport_inbox for update to authenticated
  using (public.sbs_zatwierdzony())
  with check (public.sbs_zatwierdzony());

drop policy if exists "inbox: usuwanie tylko administrator" on public.sbs_raport_inbox;
create policy "inbox: usuwanie tylko administrator"
  on public.sbs_raport_inbox for delete to authenticated
  using (public.sbs_admin());

grant insert on public.sbs_raport_inbox to anon;
grant select, insert, update on public.sbs_raport_inbox to authenticated;
grant delete on public.sbs_raport_inbox to authenticated;
