begin;

alter table claims
  add column if not exists facility_name text,
  add column if not exists facility_name_normalized text;

commit;
