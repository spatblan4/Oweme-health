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

create index if not exists files_user_id_idx on files (user_id, uploaded_at desc);

