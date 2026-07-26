-- Reguły dostępu — ten sam wzorzec co poprzednio: tymczasowy pełny dostęp, do czasu
-- dodania prawdziwego logowania. Patrz uwaga bezpieczeństwa z poprzedniej wiadomości.

alter table sbs_clubs enable row level security;
alter table sbs_club_crests enable row level security;
alter table sbs_players enable row level security;
alter table sbs_observations enable row level security;
alter table sbs_reports enable row level security;
alter table sbs_talents enable row level security;
alter table sbs_contacts enable row level security;
alter table sbs_matches enable row level security;
alter table sbs_kv enable row level security;

create policy "Tymczasowy pełny dostęp" on sbs_clubs for all to anon using (true) with check (true);
create policy "Tymczasowy pełny dostęp" on sbs_club_crests for all to anon using (true) with check (true);
create policy "Tymczasowy pełny dostęp" on sbs_players for all to anon using (true) with check (true);
create policy "Tymczasowy pełny dostęp" on sbs_observations for all to anon using (true) with check (true);
create policy "Tymczasowy pełny dostęp" on sbs_reports for all to anon using (true) with check (true);
create policy "Tymczasowy pełny dostęp" on sbs_talents for all to anon using (true) with check (true);
create policy "Tymczasowy pełny dostęp" on sbs_contacts for all to anon using (true) with check (true);
create policy "Tymczasowy pełny dostęp" on sbs_matches for all to anon using (true) with check (true);
create policy "Tymczasowy pełny dostęp" on sbs_kv for all to anon using (true) with check (true);
