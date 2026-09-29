-- ZLECENIA ANALIZ WIDEO — „Zleć analizę" przy zawodniku
--
-- PO CO TO JEST
-- Skaut ogląda profil zawodnika, ma link do meczu albo nagranie na dysku i chce zamówić analizę.
-- Dotąd musiał opisywać to poza systemem. Ta tabela jest listą zamówień: aplikacja dopisuje do niej
-- zlecenie, analityk (człowiek albo asystent pracujący na nagraniu) je odbiera, a gotowy raport
-- wraca do skrzynki `sbs_raport_inbox` i stamtąd trafia do formularza.
--
-- CZEGO TA TABELA NIE ROBI
-- Nie uruchamia niczego sama. Nagrania meczów mają po kilka gigabajtów i leżą na dysku skauta, nie
-- w chmurze — zlecenie czeka, aż analityk je pobierze. Status mówi wprost, na jakim jest etapie.
--
-- KTO CO MOŻE
--   * zatwierdzone konto — zleca, widzi wszystkie zlecenia i zmienia ich status.
--   * klucz publiczny (anon) — widzi i zmienia WYŁĄCZNIE zlecenia czekające ('nowe', 'w_toku').
--     Tyle wystarczy, by je odebrać i oznaczyć wykonanie. Zlecenie to zamówienie na obserwację:
--     nazwisko zawodnika, mecz i link do nagrania. Nie ma tu danych kontaktowych ani kartoteki.
--   * administrator — dodatkowo kasuje zlecenia.
--
-- URUCHOMIENIE
--   Supabase → SQL Editor → New query → wklej całość → Run. Bezpieczne do powtórzenia.
--
-- COFNIĘCIE
--   drop table if exists public.sbs_analiza_zlecenia;

create table if not exists public.sbs_analiza_zlecenia (
  id                 text primary key,
  utworzone_at       timestamptz not null default now(),
  zaktualizowane_at  timestamptz,
  player_id          text,
  -- Podpis zawodnika przepisany w chwili zlecenia. Kartoteka może się zmienić, a zamówienie ma
  -- zostać czytelne również wtedy, gdy ktoś poprawi nazwisko albo klub.
  zawodnik           text,
  mecz               text,
  -- Dwa źródła nagrania, bo takie są w praktyce: adres transmisji albo plik na dysku skauta.
  link               text,
  plik               text,
  -- Numer pozycji wg Narodowego Modelu Gry (1-11). Rozstrzyga, którą skalę 1-6 dostanie raport,
  -- gdy zawodnik zagrał gdzie indziej niż ma wpisane w kartotece.
  pozycja            int,
  uwagi              text,
  zlecil             text,
  -- 'nowe' czeka, 'w_toku' analityk pracuje, 'gotowe' raport poszedł do skrzynki, 'odrzucone'.
  status             text not null default 'nowe'
);

create index if not exists sbs_analiza_zlecenia_status_idx
  on public.sbs_analiza_zlecenia (status, utworzone_at desc);

alter table public.sbs_analiza_zlecenia enable row level security;

drop policy if exists "zlecenia: odczyt dla zatwierdzonych" on public.sbs_analiza_zlecenia;
create policy "zlecenia: odczyt dla zatwierdzonych"
  on public.sbs_analiza_zlecenia for select to authenticated
  using (public.sbs_zatwierdzony());

drop policy if exists "zlecenia: zlecanie przez zatwierdzonych" on public.sbs_analiza_zlecenia;
create policy "zlecenia: zlecanie przez zatwierdzonych"
  on public.sbs_analiza_zlecenia for insert to authenticated
  with check (public.sbs_zatwierdzony());

drop policy if exists "zlecenia: zmiana przez zatwierdzonych" on public.sbs_analiza_zlecenia;
create policy "zlecenia: zmiana przez zatwierdzonych"
  on public.sbs_analiza_zlecenia for update to authenticated
  using (public.sbs_zatwierdzony())
  with check (public.sbs_zatwierdzony());

-- Analityk odbierający zlecenia pracuje kluczem publicznym: widzi tylko kolejkę, nie kartotekę.
drop policy if exists "zlecenia: kolejka dla analityka" on public.sbs_analiza_zlecenia;
create policy "zlecenia: kolejka dla analityka"
  on public.sbs_analiza_zlecenia for select to anon
  using (status in ('nowe', 'w_toku'));

drop policy if exists "zlecenia: oznaczanie przez analityka" on public.sbs_analiza_zlecenia;
create policy "zlecenia: oznaczanie przez analityka"
  on public.sbs_analiza_zlecenia for update to anon
  using (status in ('nowe', 'w_toku'))
  with check (status in ('w_toku', 'gotowe', 'odrzucone'));

drop policy if exists "zlecenia: usuwanie tylko administrator" on public.sbs_analiza_zlecenia;
create policy "zlecenia: usuwanie tylko administrator"
  on public.sbs_analiza_zlecenia for delete to authenticated
  using (public.sbs_admin());

grant select, update on public.sbs_analiza_zlecenia to anon;
grant select, insert, update, delete on public.sbs_analiza_zlecenia to authenticated;
