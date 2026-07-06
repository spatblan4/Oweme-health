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

create index if not exists claims_user_id_idx on claims (user_id, service_date desc);
create index if not exists claims_source_file_id_idx on claims (source_file_id);

