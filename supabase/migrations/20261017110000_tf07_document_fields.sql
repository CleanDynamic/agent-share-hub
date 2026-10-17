-- =============================================================================
-- buildgallery — registered fields of the document node type (TF-07)
-- =============================================================================
-- A step can name a file it makes (`made_by`, the id of that step). Adds three
-- fields to the `document` row's schema.fields in public.node_types, each only
-- when no field already has its key:
--   media_id         written today by addFile, never registered
--   made_by          the step that makes the file
--   preview_media_id a preview picture (used by TF-10)
-- The app does not wait for this: nothing reads these fields from the database.
--
-- Safe to run twice: a field already listed is not added again, and a row whose
-- schema has no fields array is left alone.

UPDATE public.node_types AS nt
SET schema = jsonb_set(
  nt.schema,
  '{fields}',
  coalesce(nt.schema -> 'fields', '[]'::jsonb) || (
    SELECT coalesce(jsonb_agg(f.field), '[]'::jsonb)
    FROM (
      VALUES
        ('media_id',         '{"key":"media_id","label":"File","type":"string","format":"media_id"}'::jsonb),
        ('made_by',          '{"key":"made_by","label":"Made in step","type":"string","format":"node_id"}'::jsonb),
        ('preview_media_id', '{"key":"preview_media_id","label":"Preview","type":"string","format":"media_id"}'::jsonb)
    ) AS f(key, field)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(nt.schema -> 'fields', '[]'::jsonb)) AS existing
      WHERE existing ->> 'key' = f.key
    )
  )
)
WHERE nt.key = 'document'
  AND jsonb_typeof(nt.schema) = 'object'
  AND (nt.schema -> 'fields' IS NULL OR jsonb_typeof(nt.schema -> 'fields') = 'array');
