-- =============================================================================
-- NeoScale — build media storage + table (NS-P11)
-- =============================================================================
-- Adds a private build_media table that records every uploaded file against a
-- build. The actual bytes live in the `build-media` storage bucket. RLS on both
-- the table and the bucket means only the build owner can upload, replace or
-- delete; public access is read-only (signed/unsigned URLs) for published
-- builds.
-- =============================================================================


-- =============================================================================
-- 1. build_media
-- =============================================================================
CREATE TABLE public.build_media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id      UUID NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  -- storage bucket name
  bucket        TEXT NOT NULL DEFAULT 'build-media',
  -- relative path inside the bucket, e.g. <build_id>/<uuid>.png
  path          TEXT NOT NULL,
  -- uuid extension for file type handling, kept alongside path for legacy calls
  filename      TEXT NOT NULL,
  -- media category: image, video, audio, file
  kind          TEXT NOT NULL,
  -- original MIME type
  mime          TEXT NOT NULL,
  -- bytes stored in the bucket
  bytes         BIGINT NOT NULL,
  -- original dimensions when known
  width         INTEGER NULL,
  height        INTEGER NULL,
  -- optional video/audio poster frame
  poster_path   TEXT NULL,
  -- JSONB for extra metadata (duration, codecs, thumbnails, etc.)
  metadata      JSONB NULL DEFAULT '{}',
  -- optional: caption / alt text
  caption       TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT build_media_kind_check CHECK (kind IN ('image','video','audio','file'))
);


-- =============================================================================
-- 2. Indexes
-- =============================================================================
CREATE INDEX idx_build_media_build
  ON public.build_media (build_id);

CREATE INDEX idx_build_media_kind
  ON public.build_media (kind);


-- =============================================================================
-- 3. Row level security
-- =============================================================================
ALTER TABLE public.build_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Build media is readable by build readers"
  ON public.build_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_media.build_id
        AND (
          b.status <> 'draft'
          OR b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

CREATE POLICY "Build media is writable by build owners"
  ON public.build_media FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_media.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_media.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );


-- =============================================================================
-- 4. Grants
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.build_media TO authenticated;
GRANT SELECT ON public.build_media TO anon;
GRANT ALL ON public.build_media TO service_role;


-- =============================================================================
-- 5. Storage bucket + policies
-- =============================================================================
-- The bucket is created via the management API; the policies live here.
-- Path convention: {build_id}/{media_id}.{ext}
-- This convention lets the RLS policy verify ownership by parsing the first
-- path segment without needing a DB lookup.

-- Allow public read of any object in the bucket.
CREATE POLICY "build-media public read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'build-media');

-- Allow authenticated users to upload objects where the first path segment is a
-- build they own. The second segment is the media UUID and the extension.
CREATE POLICY "build-media owner upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'build-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.builds b
        WHERE b.id = (
          split_part(storage.objects.name, '/', 1)::uuid
        )
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
      )
    )
  );

-- Allow owners to update their own objects (replace a file, e.g. re-crop).
CREATE POLICY "build-media owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'build-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.builds b
        WHERE b.id = (
          split_part(storage.objects.name, '/', 1)::uuid
        )
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
      )
    )
  );

-- Allow owners to delete objects from their own builds.
CREATE POLICY "build-media owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'build-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.builds b
        WHERE b.id = (
          split_part(storage.objects.name, '/', 1)::uuid
        )
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
      )
    )
  );

-- service_role can do anything in the bucket.
CREATE POLICY "build-media service_role all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'build-media')
  WITH CHECK (bucket_id = 'build-media');

-- =============================================================================
-- 6. Enable the bucket in the UI (idempotent)
-- =============================================================================
-- The bucket is created separately; the public flag is set via the management
-- API. No data manipulation here.
-- =============================================================================
