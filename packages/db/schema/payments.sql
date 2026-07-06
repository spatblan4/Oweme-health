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

create index if not exists payments_user_id_idx on payments (user_id, payment_date desc);
create index if not exists payments_source_file_id_idx on payments (source_file_id);

