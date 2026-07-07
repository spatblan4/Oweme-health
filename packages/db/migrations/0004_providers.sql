begin;

create table if not exists providers (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_normalized text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists providers_user_name_normalized_uidx
  on providers (user_id, name_normalized);

create index if not exists providers_user_id_idx on providers (user_id, updated_at desc);

alter table providers enable row level security;

create policy "providers_select_own" on providers
  for select using (user_id = auth.uid());
create policy "providers_insert_own" on providers
  for insert with check (user_id = auth.uid());
create policy "providers_update_own" on providers
  for update using (user_id = auth.uid());
create policy "providers_delete_own" on providers
  for delete using (user_id = auth.uid());

commit;
