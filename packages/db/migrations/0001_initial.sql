begin;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists files (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('claim', 'payment', 'eob', 'receipt', 'other')),
  bucket text not null,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  file_size_bytes bigint,
  sha256 text,
  status text not null check (status in ('uploaded', 'processing', 'processed', 'failed')),
  uploaded_at timestamptz not null default now()
);

create table if not exists file_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id uuid not null references files(id) on delete cascade,
  job_type text not null check (job_type in ('extract_claims', 'extract_payments', 'normalize', 'audit')),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempt_count integer not null default 0,
  worker_version text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists visits (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_name text not null,
  provider_name_normalized text,
  visit_type text not null default 'other' check (visit_type in ('medical', 'dental', 'vision', 'other')),
  visit_date date not null,
  status text not null default 'unknown' check (status in ('expected', 'attended', 'canceled', 'unknown')),
  insurance_name text,
  paid_amount numeric(12,2),
  payment_method text,
  reimbursement_needed boolean not null default false,
  claim_check_after date,
  next_appointment_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists claims (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  source_file_id uuid not null references files(id) on delete cascade,
  source_job_id uuid references file_jobs(id) on delete set null,
  provider_name_raw text,
  provider_name_normalized text,
  claim_number text,
  service_date date,
  patient_responsibility numeric(12,2),
  insurance_paid numeric(12,2),
  billed_amount numeric(12,2),
  allowed_amount numeric(12,2),
  status text,
  normalized_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  source_file_id uuid references files(id) on delete set null,
  source_job_id uuid references file_jobs(id) on delete set null,
  provider_name_raw text,
  provider_name_normalized text,
  payment_date date,
  amount numeric(12,2) not null,
  payment_method text,
  payment_source text,
  normalized_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists findings (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_id uuid references visits(id) on delete set null,
  claim_id uuid references claims(id) on delete set null,
  payment_id uuid references payments(id) on delete set null,
  finding_type text not null check (finding_type in ('possible_credit', 'allocation_unclear', 'questionable_canceled_charge', 'claim_in_process', 'unmatched_payment')),
  severity text not null check (severity in ('info', 'attention', 'urgent')),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  title text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists manual_adjustments (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('visit', 'claim', 'payment', 'finding')),
  target_id uuid not null,
  field_name text not null,
  previous_value jsonb,
  new_value jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists files_user_id_idx on files (user_id, uploaded_at desc);
create index if not exists file_jobs_user_id_idx on file_jobs (user_id, created_at desc);
create index if not exists file_jobs_status_idx on file_jobs (status, created_at asc);
create index if not exists visits_user_id_idx on visits (user_id, visit_date desc);
create index if not exists claims_user_id_idx on claims (user_id, service_date desc);
create index if not exists claims_source_file_id_idx on claims (source_file_id);
create index if not exists payments_user_id_idx on payments (user_id, payment_date desc);
create index if not exists payments_source_file_id_idx on payments (source_file_id);
create index if not exists findings_user_id_idx on findings (user_id, created_at desc);
create index if not exists findings_status_idx on findings (status, created_at desc);
create index if not exists manual_adjustments_user_id_idx on manual_adjustments (user_id, created_at desc);

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

commit;

