-- =============================================================================
-- NeoScale — build media table, storage bucket and object policies (NS-P11)
-- =============================================================================
-- The typed build record can point at uploaded material — a screenshot on a
-- result node, a screen recording on a demo node, a CSV on a dataset node.
-- This migration adds the one table that records those objects, the private
-- bucket they live in, and the object policies that gate them.
--
-- It touches no existing table, bucket, policy or migration. content-files,
-- content-results and avatars keep their own rules exactly as they stand; the
-- policies below are modelled on them and scoped to bucket_id = 'build-media'
-- so they can never widen anything already in place.
--
-- PATH CONVENTION — fixed here and depended on by every later prompt:
--
--   <build_id>/<node_id or 'unplaced'>/<uuid>.<ext>
--
-- The first segment is what the object policies read. An object whose first
-- segment is not a readable build id is not readable, so the convention is not
-- a nicety: it is the access rule.
-- =============================================================================


-- =============================================================================
-- 1. build_media
-- =============================================================================
-- node_id is nullable and ON DELETE SET NULL: material uploaded before it is
-- attached to anything, and material whose node was deleted, both stay
-- addressable rather than vanishing. The object keeps its original path in
-- that case — the path records where the file was uploaded, not where the row
-- currently points.
CREATE TABLE public.build_media (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id     UUID NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  node_id      UUID NULL REFERENCES public.build_nodes(id) ON DELETE SET NULL,
  bucket       TEXT NOT NULL DEFAULT 'build-media',
  path         TEXT NOT NULL,
  kind         TEXT NOT NULL,
  mime         TEXT NULL,
  bytes        BIGINT NULL,
  width        INTEGER NULL,
  height       INTEGER NULL,
  -- seconds, video and audio
  duration     NUMERIC NULL,
  poster_path  TEXT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT build_media_bucket_path_key UNIQUE (bucket, path),
  CONSTRAINT build_media_kind_check CHECK (kind IN ('image','video','audio','file'))
);


-- =============================================================================
-- 2. Indexes
-- =============================================================================
CREATE INDEX idx_build_media_build ON public.build_media (build_id);
CREATE INDEX idx_build_media_node  ON public.build_media (node_id);


-- =============================================================================
-- 3. Row level security — mirrors build_nodes
-- =============================================================================
-- Readable when the parent build is readable, writable by the build's creator
-- or an admin, through EXISTS subqueries. Every current-user call is wrapped
-- as (select auth.uid()) so Postgres evaluates it once per statement rather
-- than once per row.

ALTER TABLE public.build_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Build media follow build readability"
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

CREATE POLICY "Build media follow build writability on insert"
  ON public.build_media FOR INSERT
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

CREATE POLICY "Build media follow build writability on update"
  ON public.build_media FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_media.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

CREATE POLICY "Build media follow build writability on delete"
  ON public.build_media FOR DELETE
  USING (
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
-- 4. Grants — RLS above is what actually gates access
-- =============================================================================
GRANT SELECT ON public.build_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.build_media TO authenticated;
GRANT ALL ON public.build_media TO service_role;


-- =============================================================================
-- 5. The build-media bucket
-- =============================================================================
-- Private. Nothing in it is served without a signed URL, so a draft build's
-- screenshots are as unreachable as its rows.
--
-- file_size_limit mirrors the 25MB client guard in src/lib/build/media.ts so
-- the limit holds even if a caller reaches the storage API directly.
-- allowed_mime_types is deliberately left NULL: the accepted type list lives
-- in media.ts, in one place, where the kind mapping that depends on it lives
-- too. Two lists that must agree eventually disagree.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('build-media', 'build-media', false, 26214400)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 6. Object policies
-- =============================================================================
-- (storage.foldername(name))[1] is the first path segment: the build id. It is
-- compared as text against b.id::text rather than cast to uuid, because a path
-- whose first segment is not a uuid would make the cast error rather than
-- simply fail the check.
--
-- SELECT follows the builds SELECT rule. Writes are the creator's alone — an
-- admin can edit a build's rows but does not upload into someone else's
-- bucket path.

CREATE POLICY "Build media objects follow build readability"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'build-media'
    AND EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND (
          b.status <> 'draft'
          OR b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

CREATE POLICY "Creators upload build media objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'build-media'
    AND EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.creator_id = (select auth.uid())
    )
  );

CREATE POLICY "Creators update build media objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'build-media'
    AND EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.creator_id = (select auth.uid())
    )
  );

CREATE POLICY "Creators delete build media objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'build-media'
    AND EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.creator_id = (select auth.uid())
    )
  );
