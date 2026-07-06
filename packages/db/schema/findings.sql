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

create index if not exists findings_user_id_idx on findings (user_id, created_at desc);
create index if not exists findings_status_idx on findings (status, created_at desc);

