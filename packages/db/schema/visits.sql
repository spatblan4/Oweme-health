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

create index if not exists visits_user_id_idx on visits (user_id, visit_date desc);

