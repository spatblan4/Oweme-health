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

create index if not exists file_jobs_user_id_idx on file_jobs (user_id, created_at desc);
create index if not exists file_jobs_status_idx on file_jobs (status, created_at asc);

