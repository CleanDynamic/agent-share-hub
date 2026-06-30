
create policy "blueprint-media public read"
on storage.objects for select
using (bucket_id = 'blueprint-media');

create policy "blueprint-media owner insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'blueprint-media'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "blueprint-media owner update"
on storage.objects for update to authenticated
using (
  bucket_id = 'blueprint-media'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "blueprint-media owner delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'blueprint-media'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);
