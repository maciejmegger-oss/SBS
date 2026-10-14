// TEST MIGRACJI PRZEPŁYWU AI (supabase/migration_2026-10-14_przeplyw_ai.sql) NA PRAWDZIWYM POSTGRESIE.
//
// Używa PGlite (Postgres w WebAssembly), więc nie dotyka żadnej bazy produkcyjnej. Sprawdza, że
// kolejność AI -> skaut -> trener -> dyrektor jest wymuszana przez bazę, że klient nie widzi tabeli,
// a dziennik zmian jest tylko do dopisywania. PGlite nie jest zależnością projektu: CI instaluje go
// jednorazowo (`npm i --no-save @electric-sql/pglite`). Bez niego test się pomija.
let PGlite;
try { ({ PGlite } = await import("@electric-sql/pglite")); }
catch { console.log("Pominięto: brak @electric-sql/pglite (npm i --no-save @electric-sql/pglite)."); process.exit(0); }
import fs from "node:fs";
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
create table sbs_konta(user_id uuid primary key, email text, rola text not null default 'scout', status text not null default 'zatwierdzone');
create table sbs_players(id text primary key);
create function sbs_zatwierdzony() returns boolean language sql stable security definer as $$ select exists(select 1 from sbs_konta k where k.user_id=auth.uid() and k.status='zatwierdzone') $$;
create function sbs_admin() returns boolean language sql stable security definer as $$ select exists(select 1 from sbs_konta k where k.user_id=auth.uid() and k.status='zatwierdzone' and k.rola='admin') $$;
grant usage on schema public, auth to anon, authenticated;
grant execute on all functions in schema public to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
insert into sbs_konta values
 ('00000000-0000-0000-0000-000000000001','skaut@x','scout','zatwierdzone'),
 ('00000000-0000-0000-0000-000000000002','trener@x','trener','zatwierdzone'),
 ('00000000-0000-0000-0000-000000000003','dyr@x','dyrektor','zatwierdzone'),
 ('00000000-0000-0000-0000-000000000004','admin@x','admin','zatwierdzone'),
 ('00000000-0000-0000-0000-000000000005','klient@x','klient','zatwierdzone'),
 ('00000000-0000-0000-0000-000000000006','czeka@x','scout','oczekuje');
insert into sbs_players values ('p1');
`);
const sql = fs.readFileSync("supabase/migration_2026-10-14_przeplyw_ai.sql","utf8");
await db.exec(sql); await db.exec(sql); // powtórzenie = idempotentne
console.log("migracja: OK (2x)");
const U = {s:1,t:2,d:3,a:4,k:5,c:6};
const as = async (u, q) => { await db.exec(`reset role; select set_config('app.uid','00000000-0000-0000-0000-00000000000${U[u]}',false); set role authenticated;`); return db.query(q); };
let bl=0;
const ok = async (opis,u,q)=>{ try{ const r=await as(u,q); console.log("  OK  ",opis, r.rows.length?JSON.stringify(r.rows[0]).slice(0,60):""); return r;}catch(e){bl++;console.log(" BŁĄD",opis,e.message);} };
const nie = async (opis,u,q,frag)=>{ try{ const r=await as(u,q); if(r.affectedRows===0 || (r.rows&&r.rows.length===0&&/select/i.test(q))){console.log("  OK  ",opis,"(0 wierszy)");return;} bl++; console.log(" BŁĄD",opis,"— przeszło, a nie powinno"); }catch(e){ const g=!frag||e.message.includes(frag); if(!g)bl++; console.log(g?"  OK  ":" BŁĄD",opis,"→",e.message.slice(0,70)); } };

await ok("skaut dopisuje propozycję","s",`insert into sbs_ai_propozycje(player_id,zawodnik,tresc,pewnosc) values('p1','Jan Test','opis AI','ŚREDNIA') returning id`);
await nie("skaut nie startuje od etapu trenera","s",`insert into sbs_ai_propozycje(tresc,stan) values('x','ocena_trenera')`);
await nie("klient nie widzi tabeli","k",`select * from sbs_ai_propozycje`);
await nie("oczekujące konto nie widzi","c",`select * from sbs_ai_propozycje`);
await nie("trener nie może przeskoczyć skauta","t",`update sbs_ai_propozycje set stan='ocena_trenera', trener_ocena='{"d":4}' where id=1`,"Niedozwolone");
await nie("skaut nie zmienia treści AI","s",`update sbs_ai_propozycje set tresc='zmienione' where id=1`,"AI");
await nie("dyrektor nie weryfikuje faktów","d",`update sbs_ai_propozycje set stan='zweryfikowane_skaut' where id=1`,"skaut");
await ok("skaut weryfikuje","s",`update sbs_ai_propozycje set stan='zweryfikowane_skaut', skaut_uwagi='fakty ok' where id=1 returning skaut_kto, skaut_at is not null as ma_date`);
await nie("skaut nie ocenia jako trener","s",`update sbs_ai_propozycje set stan='ocena_trenera', trener_ocena='{"d":4}' where id=1`,"trener");
await nie("trener bez oceny nie przechodzi","t",`update sbs_ai_propozycje set stan='ocena_trenera' where id=1`,"Brak oceny");
await ok("trener ocenia","t",`update sbs_ai_propozycje set stan='ocena_trenera', trener_ocena='{"dopasowanie":4}' where id=1 returning trener_kto`);
await nie("trener nie podejmuje decyzji","t",`update sbs_ai_propozycje set stan='decyzja_dyrektora', dyrektor_decyzja='transfer' where id=1`,"dyrektor");
await nie("dyrektor bez decyzji nie przechodzi","d",`update sbs_ai_propozycje set stan='decyzja_dyrektora' where id=1`,"Brak decyzji");
{ const r=await as("d",`update sbs_ai_propozycje set dyrektor_decyzja='transfer', dyrektor_kto='00000000-0000-0000-0000-000000000001' where id=1 returning dyrektor_kto`); const v=r.rows[0].dyrektor_kto; if(v!==null){bl++;console.log(" BŁĄD podszycie: autor ustawiony",v);} else console.log("  OK   ręcznie wpisany autor jest ignorowany (null)"); }
await ok("dyrektor decyduje","d",`update sbs_ai_propozycje set stan='decyzja_dyrektora', dyrektor_decyzja='testy', dyrektor_uzasadnienie='obejrzeć' where id=1 returning dyrektor_kto`);
await nie("zamknięta propozycja nie do ruszenia","a",`update sbs_ai_propozycje set skaut_uwagi='x' where id=1`,"zamknięta");
await nie("skaut nie kasuje","s",`delete from sbs_ai_propozycje where id=1`);
{ const r=await ok("skaut dopisuje drugą","s",`insert into sbs_ai_propozycje(tresc) values('druga') returning id`); if(r.rows[0].id!==3){bl++;console.log(" BŁĄD id",r.rows[0].id);} }
await nie("odrzucenie bez powodu","s",`update sbs_ai_propozycje set stan='odrzucone' where id=3`,"powodu");
await ok("odrzucenie z powodem","s",`update sbs_ai_propozycje set stan='odrzucone', odrzucil_powod='nie ten rocznik' where id=3 returning stan`);
await nie("audit: skaut nie czyta","s",`select * from sbs_audit`);
await ok("audit: admin czyta","a",`select count(*)::int as n from sbs_audit`);
await nie("audit: nikt nie dopisuje ręcznie","a",`insert into sbs_audit(tabela,akcja) values('x','INSERT')`);
await nie("audit: nikt nie kasuje","a",`delete from sbs_audit`);
await ok("admin kasuje","a",`delete from sbs_ai_propozycje where id=3 returning id`);
console.log(bl? `\nBŁĘDÓW: ${bl}` : "\nWszystko przeszło.");
process.exit(bl?1:0);
