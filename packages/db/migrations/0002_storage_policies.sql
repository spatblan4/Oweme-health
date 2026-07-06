begin;

drop policy if exists "uploads_select_own" on storage.objects;
drop policy if exists "uploads_insert_own" on storage.objects;
drop policy if exists "uploads_update_own" on storage.objects;
drop policy if exists "uploads_delete_own" on storage.objects;

create policy "uploads_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "uploads_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "uploads_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "uploads_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

commit;
