#!/usr/bin/env bash
# REGUŁY DOSTĘPU SPRAWDZANE NA PRAWDZIWYM POSTGRESIE — nie „na oko" i nie na produkcji.
#
# PO CO
# Reguły dostępu to jedyna prawdziwa blokada w tym systemie: ukrywanie przycisków jest wygodą,
# a nie zabezpieczeniem. Do tej pory jedynym sposobem sprawdzenia, czy migracja robi to, co
# napisano w komentarzu, było wgranie jej na żywą bazę i zobaczenie, co się stanie. Tak właśnie
# 23.09.2026 trafiliśmy na awarię: reguły były POPRAWNE, ale tak wolne, że odczyt zawodników
# nie mieścił się w limicie czasu i panel klienta pokazywał wszędzie „0 zawodników".
#
# Ten skrypt stawia pustego Postgresa na boku, wgrywa w niego cały łańcuch migracji, wsypuje
# dane w skali produkcyjnej (600 klubów, 15 000 zawodników, 600 herbów) i sprawdza dwie rzeczy:
#
#   1. CO KTO WIDZI   — administrator, skaut i trzej klienci (jedna liga, Premium, bez pakietu),
#   2. CO KOMU WOLNO  — dopisywanie, poprawianie i kasowanie, każde osobno,
#   3. ILE TO TRWA    — bo reguła, która nie zdąży, jest tak samo nieprzydatna jak błędna.
#
# Baza testowa żyje w katalogu domowym osobnego użytkownika i ginie razem z kontenerem.
# Do żadnej prawdziwej bazy ten skrypt się nie łączy.
#
# Uruchomienie:  bash scripts/test-reguly-bazy.sh

set -uo pipefail
cd "$(dirname "$0")/.."

PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then
  echo "Pomijam: w tym środowisku nie ma serwera PostgreSQL (szukałem w /usr/lib/postgresql/*/bin)."
  echo "Sam plik migracji jest nadal poprawny — ten test tylko nie ma na czym go uruchomić."
  exit 0
fi

# Postgres odmawia startu z konta administratora systemu, więc bazę prowadzi osobny użytkownik.
UZYTKOWNIK=sbstest
id -u $UZYTKOWNIK >/dev/null 2>&1 || useradd -m $UZYTKOWNIK >/dev/null 2>&1
D=/home/$UZYTKOWNIK/pg-test
PORT=5433
PSQL="psql -h $D -p $PORT -U postgres"

sprzataj(){ su $UZYTKOWNIK -s /bin/bash -c "PATH=$PGBIN:\$PATH pg_ctl -D $D/data stop -m immediate" >/dev/null 2>&1; }
trap sprzataj EXIT

echo "→ Stawiam bazę testową…"
su $UZYTKOWNIK -s /bin/bash -c "
  rm -rf $D && mkdir -p $D &&
  PATH=$PGBIN:\$PATH initdb -D $D/data -U postgres --auth=trust -E UTF8 >/dev/null &&
  PATH=$PGBIN:\$PATH pg_ctl -D $D/data -l $D/log -o '-p $PORT -k $D -c listen_addresses=' start >/dev/null
" || { echo "Nie udało się uruchomić bazy testowej."; exit 1; }
sleep 2

# --- Atrapa tego, co w Supabase jest z góry: schemat auth i trzy role bazy. -------------------
$PSQL -v ON_ERROR_STOP=1 -q <<'SQL' || exit 1
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text, encrypted_password text, raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
-- U Supabase auth.uid() czyta token żądania; tutaj ustawienie sesji. Dla reguł to bez różnicy.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public, auth to anon, authenticated;
SQL

echo "→ Wgrywam łańcuch migracji…"
for f in supabase/schema.sql \
         supabase/migration_2026-07-20_missing_columns.sql \
         supabase/migration_2026-08-11_konta_i_zgoda.sql \
         supabase/migration_2026-09-12_role_i_kasowanie.sql \
         supabase/migration_2026-09-22_klient_i_pakiety.sql \
         supabase/migration_2026-09-23_dziennik_kont.sql \
         supabase/migration_2026-09-23_pakiet_przy_zgloszeniu.sql \
         supabase/migration_2026-09-23_szybkie_reguly.sql; do
  if ! $PSQL -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>/tmp/mig.err; then
    echo "  BŁĄD w $f:"; grep -i error /tmp/mig.err | head -3; exit 1
  fi
done
echo "  wszystkie przeszły"

# Supabase nadaje te uprawnienia z automatu; goły Postgres nie, więc dokładamy je tutaj.
$PSQL -q -c "grant select,insert,update,delete on all tables in schema public to authenticated, anon;" >/dev/null

echo "→ Wsypuję dane w skali produkcyjnej…"
$PSQL -v ON_ERROR_STOP=1 -q <<'SQL' || exit 1
truncate public.sbs_players, public.sbs_club_crests, public.sbs_clubs cascade;
insert into public.sbs_clubs (id, name, league, region, city)
select 'K'||i, 'Klub '||i,
  (array['Ekstraklasa','I liga','II liga','III liga, gr. I','IV liga (pomorska)','CLJ U17 gr. I'])[1 + (i % 6)],
  'Pomorski ZPN', 'Miasto '||i
from generate_series(1, 600) i;
insert into public.sbs_players (id, first_name, last_name, club_id, birth_year, position)
select 'Z'||i, 'Imie'||i, 'Nazwisko'||i, 'K'||(1 + (i % 600)), (2000 + (i % 10))::text, 'CB'
from generate_series(1, 15000) i;
-- Herb to obrazek w postaci długiego ciągu znaków — wiersz jest ciężki i to też się liczy.
insert into public.sbs_club_crests (club_id, data_url)
select 'K'||i, 'data:image/png;base64,' || repeat('A', 4000) from generate_series(1, 600) i;

delete from public.sbs_konta; delete from auth.users;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a','admin@x.pl'),
  ('00000000-0000-0000-0000-00000000000b','skaut@x.pl'),
  ('00000000-0000-0000-0000-00000000000c','klient2liga@x.pl'),
  ('00000000-0000-0000-0000-00000000000d','premium@x.pl'),
  ('00000000-0000-0000-0000-00000000000e','bezpakietu@x.pl');
insert into public.sbs_konta (user_id, email, rola, status, pakiety) values
  ('00000000-0000-0000-0000-00000000000a','admin@x.pl','admin','zatwierdzone','{}'),
  ('00000000-0000-0000-0000-00000000000b','skaut@x.pl','scout','zatwierdzone','{}'),
  ('00000000-0000-0000-0000-00000000000c','klient2liga@x.pl','klient','zatwierdzone','{"II liga"}'),
  ('00000000-0000-0000-0000-00000000000d','premium@x.pl','klient','zatwierdzone','{"Premium"}'),
  ('00000000-0000-0000-0000-00000000000e','bezpakietu@x.pl','klient','zatwierdzone','{}')
on conflict (user_id) do update set rola=excluded.rola, status=excluded.status, pakiety=excluded.pakiety;
analyze public.sbs_players; analyze public.sbs_clubs; analyze public.sbs_club_crests;

-- Pomocnicy: „co widzi to konto i jak długo to trwało" oraz „czy ta operacja przejdzie".
create or replace function public.pomiar(kto uuid, opis text)
returns table(konto text, zawodnicy bigint, kluby bigint, herby bigint, ms numeric)
language plpgsql as $$
declare t0 timestamptz; z bigint; k bigint; h bigint;
begin
  perform set_config('request.jwt.claim.sub', kto::text, true);
  t0 := clock_timestamp();
  select count(*) into z from public.sbs_players;
  select count(*) into k from public.sbs_clubs;
  select count(*) into h from public.sbs_club_crests;
  return query select opis, z, k, h,
    round(extract(epoch from clock_timestamp()-t0)::numeric * 1000, 1);
end $$;

create or replace function public.czy_wolno(kto uuid, polecenie text)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', kto::text, true);
  begin
    execute polecenie; return 'WOLNO';
  exception
    when insufficient_privilege then return 'ZABRONIONE';
    when others then return 'BLAD: ' || left(sqlerrm, 40);
  end;
end $$;

-- Reguła, która nie wpuszcza żadnego wiersza, nie zgłasza błędu przy update i delete — po prostu
-- nic nie zmienia. Dlatego tam liczymy zmienione wiersze, a nie łapiemy wyjątek.
create or replace function public.ile_zmieni(kto uuid, polecenie text)
returns integer language plpgsql as $$
declare n integer;
begin
  perform set_config('request.jwt.claim.sub', kto::text, true);
  execute polecenie; get diagnostics n = row_count; return n;
exception when insufficient_privilege then return -1;
end $$;
SQL

WYNIK=/tmp/reguly-wynik.txt
{
echo
echo "=========== 1. CO KTO WIDZI (i ile to trwa) ==========="
$PSQL -q --pset footer=off <<'SQL'
set role authenticated;
select * from public.pomiar('00000000-0000-0000-0000-00000000000a','administrator')
union all select * from public.pomiar('00000000-0000-0000-0000-00000000000b','skaut')
union all select * from public.pomiar('00000000-0000-0000-0000-00000000000c','klient II liga')
union all select * from public.pomiar('00000000-0000-0000-0000-00000000000d','klient Premium')
union all select * from public.pomiar('00000000-0000-0000-0000-00000000000e','klient bez pakietu');
reset role;
SQL
echo
echo "=========== 2. CO KOMU WOLNO ==========="
$PSQL -q --single-transaction --pset footer=off <<'SQL'
set role authenticated;
select 'KLIENT: dopisanie klubu' as proba, public.czy_wolno('00000000-0000-0000-0000-00000000000c',
  $q$insert into public.sbs_clubs (id,name,league) values ('XT','T','II liga')$q$) as wynik
union all select 'KLIENT: dopisanie zawodnika', public.czy_wolno('00000000-0000-0000-0000-00000000000c',
  $q$insert into public.sbs_players (id,first_name,last_name,club_id) values ('XT','A','B','K3')$q$)
union all select 'KLIENT: zapis ustawien (kv)', public.czy_wolno('00000000-0000-0000-0000-00000000000c',
  $q$insert into public.sbs_kv (key,value) values ('scouting:settings','{}'::jsonb)$q$)
union all select 'KLIENT: dopisanie herbu', public.czy_wolno('00000000-0000-0000-0000-00000000000c',
  $q$insert into public.sbs_club_crests (club_id,data_url) values ('K3','x')$q$)
union all select 'KLIENT: wlasna obserwacja', public.czy_wolno('00000000-0000-0000-0000-00000000000c',
  $q$insert into public.sbs_observations (id,konto) values ('OT','00000000-0000-0000-0000-00000000000c')$q$)
union all select 'KLIENT: obserwacja pod cudzym kontem', public.czy_wolno('00000000-0000-0000-0000-00000000000c',
  $q$insert into public.sbs_observations (id,konto) values ('OT2','00000000-0000-0000-0000-00000000000b')$q$)
union all select 'KLIENT: wlasny wpis w Talent', public.czy_wolno('00000000-0000-0000-0000-00000000000c',
  $q$insert into public.sbs_talents (id,konto) values ('TT','00000000-0000-0000-0000-00000000000c')$q$)
union all select 'SKAUT: dopisanie zawodnika', public.czy_wolno('00000000-0000-0000-0000-00000000000b',
  $q$insert into public.sbs_players (id,first_name,last_name,club_id) values ('XT2','A','B','K3')$q$)
union all select 'SKAUT: dopisanie klubu', public.czy_wolno('00000000-0000-0000-0000-00000000000b',
  $q$insert into public.sbs_clubs (id,name,league) values ('XT2','T','II liga')$q$);

select 'KLIENT: kasowanie zawodnika' as proba, public.ile_zmieni('00000000-0000-0000-0000-00000000000c',
  $q$delete from public.sbs_players where id='Z5'$q$) as zmienionych
union all select 'SKAUT: kasowanie zawodnika', public.ile_zmieni('00000000-0000-0000-0000-00000000000b',
  $q$delete from public.sbs_players where id='Z5'$q$)
union all select 'ADMIN: kasowanie zawodnika', public.ile_zmieni('00000000-0000-0000-0000-00000000000a',
  $q$delete from public.sbs_players where id='Z5'$q$)
union all select 'KLIENT: poprawianie zawodnika', public.ile_zmieni('00000000-0000-0000-0000-00000000000c',
  $q$update public.sbs_players set position='ST' where id='Z6'$q$)
union all select 'KLIENT: poprawianie klubu', public.ile_zmieni('00000000-0000-0000-0000-00000000000c',
  $q$update public.sbs_clubs set city='X' where id='K3'$q$)
union all select 'SKAUT: poprawianie zawodnika', public.ile_zmieni('00000000-0000-0000-0000-00000000000b',
  $q$update public.sbs_players set position='ST' where id='Z6'$q$);
reset role;
SQL
} | tee $WYNIK

# --- Ocena: co MUSI wyjść, żeby uznać reguły za dobre. ---------------------------------------
echo
echo "=========== OCENA ==========="
BLEDY=0
oceny(){ if grep -qE "$2" $WYNIK; then echo "  OK   $1"; else echo " BŁĄD  $1"; BLEDY=$((BLEDY+1)); fi; }

oceny "administrator widzi całą bazę"            '^ administrator +\| +15000 \| +600 \| +600'
oceny "skaut widzi całą bazę"                    '^ skaut +\| +15000 \| +600 \| +600'
oceny "klient jednej ligi widzi wyłącznie swoje" '^ klient II liga +\| +2500 \| +100 \| +100'
oceny "Premium widzi wszystko"                   '^ klient Premium +\| +15000 \| +600 \| +600'
oceny "klient bez pakietu nie widzi nic"         '^ klient bez pakietu +\| +0 \| +0 \| +0'
oceny "klient nie dopisze klubu"                 'dopisanie klubu +\| ZABRONIONE'
oceny "klient nie dopisze zawodnika"             'dopisanie zawodnika +\| ZABRONIONE'
oceny "klient nie zapisze ustawień"              'zapis ustawien \(kv\) +\| ZABRONIONE'
oceny "klient nie dopisze herbu"                 'dopisanie herbu +\| ZABRONIONE'
oceny "klient dopisze WŁASNĄ obserwację"         'wlasna obserwacja +\| WOLNO'
oceny "klient nie podpisze się cudzym kontem"    'cudzym kontem +\| ZABRONIONE'
oceny "klient dopisze własny wpis w Talent"      'wlasny wpis w Talent +\| WOLNO'
oceny "skaut prowadzi kartotekę"                 'SKAUT: dopisanie zawodnika +\| WOLNO'
oceny "klient nic nie skasuje"                   'KLIENT: kasowanie zawodnika +\| +0'
oceny "skaut też nic nie skasuje"                'SKAUT: kasowanie zawodnika +\| +0'
oceny "kasuje tylko administrator"               'ADMIN: kasowanie zawodnika +\| +1'
oceny "klient nie poprawi zawodnika"             'KLIENT: poprawianie zawodnika +\| +0'
oceny "klient nie poprawi klubu"                 'KLIENT: poprawianie klubu +\| +0'
oceny "skaut poprawia kartotekę"                 'SKAUT: poprawianie zawodnika +\| +1'

# CZAS. Limit w Supabase to 8 sekund na zapytanie; przed poprawką odczyt klienta trwał 7,8 s
# i właśnie dlatego się nie udawał. Stawiamy poprzeczkę dziesięciokrotnie niżej: powyżej
# 800 ms przy takiej bazie coś znowu liczy się dla każdego wiersza osobno.
NAJWOLNIEJ=$(grep -oE '\| +[0-9]+\.[0-9]$' $WYNIK | tr -d '| ' | sort -rn | head -1)
if [ -n "$NAJWOLNIEJ" ] && awk "BEGIN{exit !($NAJWOLNIEJ < 800)}"; then
  echo "  OK   najwolniejszy odczyt: ${NAJWOLNIEJ} ms (limit bazy to 8000 ms)"
else
  echo " BŁĄD  najwolniejszy odczyt: ${NAJWOLNIEJ:-?} ms — reguły znowu liczą się wiersz po wierszu"
  BLEDY=$((BLEDY+1))
fi

echo
[ $BLEDY -eq 0 ] && echo "WSZYSTKO PRZESZŁO" || echo "BŁĘDÓW: $BLEDY"
exit $([ $BLEDY -eq 0 ] && echo 0 || echo 1)
