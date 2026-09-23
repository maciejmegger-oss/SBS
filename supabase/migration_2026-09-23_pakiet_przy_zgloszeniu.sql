-- KTÓRY PAKIET ZGŁASZAJĄCY WYBRAŁ NA STRONIE
--
-- PO CO TO JEST
-- Strona publiczna ma teraz sekcję „Pakiety": klient klika ten, który go interesuje, i dopiero
-- stamtąd trafia do formularza. Bez tej kolumny ten wybór ginął po drodze — zgłoszenie przychodziło
-- tak samo jak każde inne, a Ty musiałeś dopytywać, o które rozgrywki chodziło. Teraz stoi to
-- w kartotece kont obok nazwiska i telefonu, gotowe do odczytania przy nadawaniu dostępu.
--
-- To NIE JEST to samo co kolumna `pakiety`. Tamta trzyma pakiety NADANE przez administratora —
-- czyli za co klient faktycznie zapłacił. Ta trzyma pakiet, o który POPROSIŁ. Dwie różne rzeczy,
-- które trzeba umieć porównać: klient prosi o Premium, dostaje Ekstraklasę na próbę.

alter table public.sbs_konta
  add column if not exists pakiet_zadany text;

comment on column public.sbs_konta.pakiet_zadany is
  'Pakiet klikniety przez zglaszajacego na stronie publicznej. Nie mylic z `pakiety` — tam stoja pakiety NADANE.';

-- Wyzwalacz przepisujący dane ze zgłoszenia dostaje jedno pole więcej. Reszta bez zmian.
create or replace function public.sbs_nowe_konto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sbs_konta (user_id, email, imie_nazwisko, klub, rola_w_klubie, telefon, pakiet_zadany)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'imie_nazwisko', ''),
    nullif(new.raw_user_meta_data->>'klub', ''),
    nullif(new.raw_user_meta_data->>'rola_w_klubie', ''),
    nullif(new.raw_user_meta_data->>'telefon', ''),
    nullif(new.raw_user_meta_data->>'pakiet', '')
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- SPRAWDZENIE
-- ---------------------------------------------------------------------------
select email, imie_nazwisko, klub, telefon, pakiet_zadany, rola, status, pakiety
from public.sbs_konta
order by utworzone_at desc;
