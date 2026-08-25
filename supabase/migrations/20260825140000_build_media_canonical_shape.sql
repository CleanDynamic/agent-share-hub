-- =============================================================================
-- NeoScale — bring build_media back to the NS-P11 shape
-- =============================================================================
-- WHY THIS EXISTS
-- ---------------
-- build_media has two definitions in this repository. The one the application
-- is written against is NS-P11 (20260823140000_build_media_storage.sql). The
-- one that actually reached the database is 20260825112911, which re-created
-- the table from scratch with a different column set and never carried
-- node_id or duration across.
--
-- The result is a table the data layer cannot use. Every call in
-- src/lib/build/media.ts names node_id and duration in MEDIA_COLUMNS, and
-- src/lib/build/gallery.ts embeds node_id, so the live database answers them
-- with:
--
--   42703: column build_media.node_id does not exist
--   42703: column build_media.duration does not exist
--
-- NS-P11 is the intended design and the code is right, so this migration moves
-- the table to it rather than moving the code to the table.
--
-- WHAT IT CHANGES
-- ---------------
--   + node_id      the whole point of the table: which node the file hangs off
--   + duration     seconds, for video and audio
--   + the node index and the (bucket, path) uniqueness NS-P11 declares
--   + the build-media bucket itself, which no migration ever created
--   ~ filename, mime, bytes relaxed to nullable
--
-- ON filename, caption AND metadata
-- ---------------------------------
-- Three columns 20260825112911 invented that NS-P11 does not have and no
-- application code writes. filename is the blocking one: it was NOT NULL with
-- no default, so an insert from uploadMedia — which writes path, not filename
-- — could not have succeeded even with node_id and duration in place.
--
-- They are relaxed rather than dropped. Dropping a column is not reversible
-- and this migration has no way to know whether anything was written into them
-- before now. Nothing reads them; they can be dropped in a later migration
-- once that has been checked.
--
-- ON IDEMPOTENCE
-- --------------
-- Every statement is guarded, because this has to be correct against two
-- starting points: the live database (20260825112911's shape) and a fresh one
-- built from the repository (NS-P11's shape, where most of this is already
-- true).
-- =============================================================================


-- =============================================================================
-- 1. The two missing columns
-- =============================================================================
-- node_id is nullable and ON DELETE SET NULL, per NS-P11: material uploaded
-- before it is attached to anything, and material whose node was deleted, both
-- stay addressable rather than vanishing.
ALTER TABLE public.build_media
  ADD COLUMN IF NOT EXISTS node_id UUID NULL REFERENCES public.build_nodes(id) ON DELETE SET NULL;

ALTER TABLE public.build_media
  ADD COLUMN IF NOT EXISTS duration NUMERIC NULL;

COMMENT ON COLUMN public.build_media.node_id IS
  'The build node this file hangs off. NULL while it is unplaced, or after its node was deleted.';
COMMENT ON COLUMN public.build_media.duration IS
  'Length in seconds, for video and audio. NULL for everything else.';


-- =============================================================================
-- 2. Columns the application never writes
-- =============================================================================
-- Guarded on the catalog: a database built from NS-P11 has none of these, and
-- ALTER COLUMN on a column that is not there is an error, not a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'build_media' AND column_name = 'filename'
  ) THEN
    ALTER TABLE public.build_media ALTER COLUMN filename DROP NOT NULL;
    COMMENT ON COLUMN public.build_media.filename IS
      'Not part of the NS-P11 design and not written by src/lib/build/media.ts, which stores the name in path. Kept nullable rather than dropped.';
  END IF;
END $$;

-- NS-P11 has both of these nullable. The client always supplies them, so this
-- only removes a constraint the code does not depend on.
ALTER TABLE public.build_media ALTER COLUMN mime  DROP NOT NULL;
ALTER TABLE public.build_media ALTER COLUMN bytes DROP NOT NULL;


-- =============================================================================
-- 3. Index and uniqueness
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_build_media_node ON public.build_media (node_id);

-- One row per object. Without it a retried upload can record the same object
-- twice, and deleteMedia would then remove the object out from under the row
-- that is left.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.build_media'::regclass
      AND conname  = 'build_media_bucket_path_key'
  ) THEN
    ALTER TABLE public.build_media
      ADD CONSTRAINT build_media_bucket_path_key UNIQUE (bucket, path);
  END IF;
END $$;


-- =============================================================================
-- 4. The bucket
-- =============================================================================
-- 20260825112911 left this to "the management API" and it was never done, so
-- build-media does not exist and every upload fails before it starts. NS-P11
-- creates it in SQL, which is the only version of this that cannot be
-- forgotten.
--
-- Private: nothing in it is served without a signed URL, so a draft build's
-- screenshots are as unreachable as its rows. file_size_limit mirrors
-- MEDIA_MAX_BYTES in src/lib/build/media.ts so the limit holds even if a
-- caller reaches the storage API directly.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('build-media', 'build-media', false, 26214400)
ON CONFLICT (id) DO NOTHING;
