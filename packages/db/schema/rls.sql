alter table profiles enable row level security;
alter table files enable row level security;
alter table file_jobs enable row level security;
alter table visits enable row level security;
alter table claims enable row level security;
alter table payments enable row level security;
alter table findings enable row level security;
alter table manual_adjustments enable row level security;

create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

create policy "files_select_own" on files
  for select using (user_id = auth.uid());
create policy "files_insert_own" on files
  for insert with check (user_id = auth.uid());
create policy "files_update_own" on files
  for update using (user_id = auth.uid());
create policy "files_delete_own" on files
  for delete using (user_id = auth.uid());

create policy "file_jobs_select_own" on file_jobs
  for select using (user_id = auth.uid());
create policy "file_jobs_insert_own" on file_jobs
  for insert with check (user_id = auth.uid());
create policy "file_jobs_update_own" on file_jobs
  for update using (user_id = auth.uid());
create policy "file_jobs_delete_own" on file_jobs
  for delete using (user_id = auth.uid());

create policy "visits_select_own" on visits
  for select using (user_id = auth.uid());
create policy "visits_insert_own" on visits
  for insert with check (user_id = auth.uid());
create policy "visits_update_own" on visits
  for update using (user_id = auth.uid());
create policy "visits_delete_own" on visits
  for delete using (user_id = auth.uid());

create policy "claims_select_own" on claims
  for select using (user_id = auth.uid());
create policy "claims_insert_own" on claims
  for insert with check (user_id = auth.uid());
create policy "claims_update_own" on claims
  for update using (user_id = auth.uid());
create policy "claims_delete_own" on claims
  for delete using (user_id = auth.uid());

create policy "payments_select_own" on payments
  for select using (user_id = auth.uid());
create policy "payments_insert_own" on payments
  for insert with check (user_id = auth.uid());
create policy "payments_update_own" on payments
  for update using (user_id = auth.uid());
create policy "payments_delete_own" on payments
  for delete using (user_id = auth.uid());

create policy "findings_select_own" on findings
  for select using (user_id = auth.uid());
create policy "findings_insert_own" on findings
  for insert with check (user_id = auth.uid());
create policy "findings_update_own" on findings
  for update using (user_id = auth.uid());
create policy "findings_delete_own" on findings
  for delete using (user_id = auth.uid());

create policy "manual_adjustments_select_own" on manual_adjustments
  for select using (user_id = auth.uid());
create policy "manual_adjustments_insert_own" on manual_adjustments
  for insert with check (user_id = auth.uid());
create policy "manual_adjustments_update_own" on manual_adjustments
  for update using (user_id = auth.uid());
create policy "manual_adjustments_delete_own" on manual_adjustments
  for delete using (user_id = auth.uid());

