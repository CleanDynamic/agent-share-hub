-- =============================================================================
-- NeoScale — generated explanation layers (NS-P22)
-- =============================================================================
-- One table. It stores the two generated explanation layers for a build:
--
--   run         do this, then this. No understanding required.
--   understand  what each step does and why, in plain language.
--
-- Both are GENERATED FROM THE TYPED RECORD, never from prose, by the
-- generate-build-layers edge function added alongside this migration. The
-- record is what makes that mechanically possible: typed nodes with typed
-- payloads and a declared schema per type.
--
-- THE COLUMN THAT MATTERS IS generated_from_hash. It is a hash of the node
-- tree the layer was generated from, so the function can answer three
-- questions without asking the model anything:
--
--   same hash                     nothing changed. Return what is stored.
--   different hash, not approved  the tree moved on. Regenerate.
--   different hash, approved      the tree moved on but a human signed this
--                                 off. DO NOT OVERWRITE. Report it stale and
--                                 let NS-P23 ask the creator.
--
-- That last row is the difference between a helpful feature and one that
-- destroys someone's edits, and it is enforced in the function, not here —
-- a database constraint cannot tell a regeneration from a creator's own save.
--
-- CONTENT SHAPE
--   { "steps": [ { "n": 1, "title": "...", "body": "...",
--                  "node_ref": "<build_nodes.id or null>" } ] }
--
-- node_ref is what makes an edited layer traceable back to the record: every
-- step either points at the node it explains or admits it points at nothing.
-- It is deliberately NOT a foreign key — content is one jsonb document, and a
-- deleted node should leave a step whose reference no longer resolves rather
-- than block the delete or silently rewrite the document. The generating
-- function resolves every ref against that build's real nodes before it
-- writes, so a stored ref is real at write time; NS-P23 renders an
-- unresolvable ref as an unlinked step.
--
-- This migration adds one table, its constraints, its RLS and its grants. It
-- touches no existing table, no existing policy and no existing function.
-- =============================================================================


-- =============================================================================
-- 1. build_layers
-- =============================================================================
CREATE TABLE public.build_layers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id             UUID NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  -- 'run' | 'understand'
  layer                TEXT NOT NULL,
  -- ordered steps; shape documented above
  content              JSONB NOT NULL,
  generated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- hash of the node tree this content was generated from
  generated_from_hash  TEXT NOT NULL,
  approved             BOOLEAN NOT NULL DEFAULT false,
  approved_at          TIMESTAMPTZ NULL,
  edited_by_creator    BOOLEAN NOT NULL DEFAULT false,
  model_used           TEXT NULL,

  CONSTRAINT build_layers_layer_check CHECK (layer IN ('run','understand')),

  -- One row per layer per build. This is also what the generating function
  -- upserts on, so a concurrent second invocation updates rather than
  -- duplicates.
  CONSTRAINT build_layers_build_layer_key UNIQUE (build_id, layer),

  -- content is a document, not a schema, but "has ordered steps" is the one
  -- thing every reader assumes. Guard it here so a malformed write fails
  -- loudly at the boundary instead of rendering as an empty layer.
  CONSTRAINT build_layers_content_shape_check CHECK (
    jsonb_typeof(content -> 'steps') = 'array'
  )
);

-- No separate index on build_id: the UNIQUE (build_id, layer) constraint's
-- index leads with build_id, which serves "every layer for this build".


-- =============================================================================
-- 2. Row level security — mirrors build_nodes exactly
-- =============================================================================
-- Readable when the parent build is readable, writable by the build's creator
-- or an admin. Every call to the current-user helper is wrapped as
-- (select auth.uid()) so Postgres evaluates it once per statement rather than
-- once per row.

ALTER TABLE public.build_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Build layers follow build readability"
  ON public.build_layers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_layers.build_id
        AND (
          b.status <> 'draft'
          OR b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

CREATE POLICY "Build layers follow build writability on insert"
  ON public.build_layers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_layers.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

CREATE POLICY "Build layers follow build writability on update"
  ON public.build_layers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_layers.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

CREATE POLICY "Build layers follow build writability on delete"
  ON public.build_layers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_layers.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );


-- =============================================================================
-- 3. Grants — RLS above is what actually gates access
-- =============================================================================
GRANT SELECT ON public.build_layers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.build_layers TO authenticated;
GRANT ALL ON public.build_layers TO service_role;
