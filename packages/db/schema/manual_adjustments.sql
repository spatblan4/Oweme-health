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

create index if not exists manual_adjustments_user_id_idx on manual_adjustments (user_id, created_at desc);

