-- Storage: private buckets, same tamper-evidence rules as before
-- (upload once, no update/delete, readable by any registered flat).

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false);

create policy "registered flats can read receipts" on storage.objects
  for select using (bucket_id = 'receipts' and auth.jwt() -> 'app_metadata' ->> 'flat_id' is not null);

create policy "registered flats can upload receipts" on storage.objects
  for insert with check (bucket_id = 'receipts' and auth.jwt() -> 'app_metadata' ->> 'flat_id' is not null);
-- No update/delete policy exists for receipts, so both are denied by default.

create policy "registered flats can read proofs" on storage.objects
  for select using (bucket_id = 'proofs' and auth.jwt() -> 'app_metadata' ->> 'flat_id' is not null);

-- Path convention: proofs/{billId}/{flatId}/{filename} — a flat can only
-- upload into its own folder, matching the flatId in its own JWT claim.
create policy "a flat can only upload its own proofs" on storage.objects
  for insert with check (
    bucket_id = 'proofs'
    and (storage.foldername(name))[2] = (auth.jwt() -> 'app_metadata' ->> 'flat_id')
  );
-- No update/delete policy exists for proofs either — permanent once written.
