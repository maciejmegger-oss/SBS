-- HERBY JAKO PLIKI, NIE JAKO TEKST W BAZIE
--
-- PO CO TO ROBIMY
-- Supabase odciął nas od limitu TRANSFERU (Egress Exceeded), nie od miejsca na dysku. Miejsca jest
-- pod dostatkiem — 98 MB z 500 MB. Problemem jest to, ile danych leci z bazy do przeglądarki przy
-- każdym otwarciu panelu.
--
-- A herby to dziś 14 MB tego transferu. 315 obrazków zapisanych w bazie jako długie ciągi znaków
-- (base64), po jakieś 45 kB każdy. Pobierane w całości przy KAŻDYM wejściu do systemu, bo dla
-- przeglądarki to nie są obrazki, tylko zwykły tekst w odpowiedzi — nie ma czego zapamiętać.
--
-- Po przeniesieniu do plików dzieje się trzykrotny zysk:
--   1. baza oddaje 315 krótkich adresów zamiast 14 MB treści,
--   2. obrazki pobiera przeglądarka OSOBNO i zapamiętuje je na rok — drugie wejście nie kosztuje nic,
--   3. ten ruch liczy się jako „Cached Egress" (osobna pula, u nas 0 z 5 GB), a nie z limitu,
--      który właśnie przekroczyliśmy.
--
-- CZEGO NIE ZMIENIAMY: tabela sbs_club_crests zostaje taka, jaka jest. W kolumnie `data_url`
-- zamiast „data:image/png;base64,iVBOR..." stanie „https://...supabase.co/storage/.../K123.png".
-- Dla znacznika <img> to bez różnicy, więc ani jeden widok w aplikacji nie wymaga przeróbki.
-- Dzięki temu przejście jest odwracalne i można je przeprowadzić klub po klubie.

-- ---------------------------------------------------------------------------
-- 1. KOSZ NA PLIKI
-- ---------------------------------------------------------------------------
--
-- PUBLICZNY, i to jest świadoma decyzja. Herb klubu nie jest tajemnicą — wisi na stronie klubu,
-- na koszulkach i na ścianie stadionu. Gdyby kosz był prywatny, każdy obrazek wymagałby podpisanego
-- adresu z terminem ważności, a wtedy przeglądarka nie mogłaby go zapamiętać na dłużej — czyli
-- stracilibyśmy dokładnie to, po co to robimy.
--
-- Publiczny jest ODCZYT. Wgrywać i kasować może wyłącznie pracownia — reguły niżej.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('herby', 'herby', true, 1048576, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml'];

-- Ograniczenie 1 MB na plik nie jest ostrożnością na wyrost: aplikacja zmniejsza herb do 128 pikseli
-- przed wysłaniem, więc realnie waży 20–40 kB. Limit jest po to, żeby pomyłka przy wgrywaniu
-- (ktoś wrzuci zdjęcie z telefonu zamiast herbu) odbiła się od bazy, a nie od limitu transferu.

-- ---------------------------------------------------------------------------
-- 2. KTO MOŻE CO ZROBIĆ Z PLIKAMI
-- ---------------------------------------------------------------------------
--
-- Kasujemy WYŁĄCZNIE swoje reguły, po nazwie. storage.objects to tabela wspólna dla wszystkich
-- koszy w projekcie — pętla kasująca wszystko po kolei, jak w naszych migracjach na tabelach
-- własnych, zdjęłaby tu również reguły cudze.

drop policy if exists "herby: odczyt dla wszystkich" on storage.objects;
drop policy if exists "herby: wgrywa pracownia"      on storage.objects;
drop policy if exists "herby: podmienia pracownia"   on storage.objects;
drop policy if exists "herby: kasuje administrator"  on storage.objects;

create policy "herby: odczyt dla wszystkich"
  on storage.objects for select
  using (bucket_id = 'herby');

-- Wgrywanie i podmiana: konto zatwierdzone, które nie jest klientem. Dokładnie ta sama zasada,
-- co przy kartotece — klient ogląda, pracownia prowadzi.
create policy "herby: wgrywa pracownia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'herby'
    and (select public.sbs_zatwierdzony())
    and not (select public.sbs_klient())
  );

create policy "herby: podmienia pracownia"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'herby'
    and (select public.sbs_zatwierdzony())
    and not (select public.sbs_klient())
  )
  with check (
    bucket_id = 'herby'
    and (select public.sbs_zatwierdzony())
    and not (select public.sbs_klient())
  );

create policy "herby: kasuje administrator"
  on storage.objects for delete to authenticated
  using (bucket_id = 'herby' and (select public.sbs_admin()));

-- ---------------------------------------------------------------------------
-- SPRAWDZENIE
-- ---------------------------------------------------------------------------

-- 1. Kosz istnieje i jest publiczny.
select id, name, public as publiczny, file_size_limit as limit_bajtow
from storage.buckets where id = 'herby';

-- 2. Cztery reguły — i tylko nasze.
select policyname as regula, cmd as operacja
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like 'herby:%'
order by cmd;

-- 3. Ile plików już wgrano (po świeżym wdrożeniu zero — przenosi je przycisk w panelu,
--    zakładka Kluby → „Herby do plików").
select count(*) as plikow_w_koszu from storage.objects where bucket_id = 'herby';

-- 4. Ile herbów siedzi jeszcze w bazie jako tekst i ile to waży.
select
  count(*) filter (where data_url like 'data:%')  as jeszcze_w_bazie,
  count(*) filter (where data_url like 'http%')   as juz_w_plikach,
  pg_size_pretty(sum(octet_length(data_url)) filter (where data_url like 'data:%')::bigint) as do_przeniesienia
from public.sbs_club_crests;
