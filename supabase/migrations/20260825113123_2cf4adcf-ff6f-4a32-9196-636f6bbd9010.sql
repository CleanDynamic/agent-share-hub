-- =============================================================================
-- NeoScale — build explanation layers (NS-P22)
-- =============================================================================
-- Stores generated "run" and "understand" explanation layers for builds. Each
-- layer is a JSON array of steps, plus metadata about which model generated it
-- and what hash of the build tree it was generated from. The approval workflow
-- lets a creator review, edit, and approve a generated layer.
--
-- The table is intentionally separate from build_nodes so that generated
-- explanation content is ephemeral and does not pollute the reproducible tree.
-- =============================================================================


-- =============================================================================
-- 1. build_layers
-- =============================================================================
CREATE TABLE public.build_layers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id            UUID NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  -- 'run' or 'understand'
  layer               TEXT NOT NULL,
  -- { steps: [...] }
  content             JSONB NOT NULL DEFAULT '{}',
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- hash of the build tree used to generate this layer
  generated_from_hash TEXT NOT NULL,
  approved            BOOLEAN NOT NULL DEFAULT false,
  approved_at         TIMESTAMPTZ NULL,
  -- whether the creator has edited the generated content
  edited_by_creator   BOOLEAN NOT NULL DEFAULT false,
  model_used          TEXT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT build_layers_layer_check
    CHECK (layer IN ('run','understand'))
);

-- One approved layer per build per layer type. Pending layers are allowed to
-- accumulate for versioning/history.
CREATE UNIQUE INDEX idx_build_layers_approved_unique
  ON public.build_layers (build_id, layer)
  WHERE approved = true;

CREATE INDEX idx_build_layers_build
  ON public.build_layers (build_id, layer, created_at DESC);


-- =============================================================================
-- 2. Row level security
-- =============================================================================
ALTER TABLE public.build_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Build layers are readable by build readers"
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

CREATE POLICY "Build layers are writable by build owners"
  ON public.build_layers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_layers.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  )
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


-- =============================================================================
-- 3. Grants
-- =============================================================================
GRANT SELECT ON public.build_layers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.build_layers TO authenticated;
GRANT ALL ON public.build_layers TO service_role;
