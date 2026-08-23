-- =============================================================================
-- NeoScale — core build record schema (NS-P01)
-- =============================================================================
-- Introduces the typed build record that will run alongside the existing
-- content_items path: a build header, a nested tree of typed nodes, the node
-- type registry those nodes reference, and the ordered event sequence.
--
-- This migration adds tables, constraints, indexes, RLS and one trigger.
-- It seeds nothing (node_types rows land in NS-P02) and touches no existing
-- table, function or policy.
--
-- NOTE ON THE USER TABLE: this codebase has no `users` table. The canonical
-- user record is public.profiles (PK = auth.users.id), so builds.creator_id
-- references public.profiles(id).
--
-- Circular references (builds.hero_node_id, build_nodes.event_id,
-- build_events.produced_node_id, builds.forked_from_event_id) are declared as
-- plain uuid columns up front and wired with ALTER TABLE in section 5, once
-- all four tables exist.
-- =============================================================================


-- =============================================================================
-- 1. builds — the build header
-- =============================================================================
CREATE TABLE public.builds (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug                  TEXT UNIQUE NOT NULL,
  title                 TEXT NOT NULL,
  -- the one-line description
  outcome               TEXT NULL,
  shape                 TEXT NOT NULL DEFAULT 'other',
  status                TEXT NOT NULL DEFAULT 'draft',
  -- roles: lawyer, designer, developer
  made_for              TEXT[] NULL DEFAULT '{}',
  -- tools/models, joins ai_tools_registry
  made_with             TEXT[] NULL DEFAULT '{}',
  live_url              TEXT NULL,
  repo_url              TEXT NULL,
  -- FK to build_nodes(id) added in section 5
  hero_node_id          UUID NULL,
  cost_setup            NUMERIC NULL,
  cost_monthly          NUMERIC NULL,
  currency              TEXT NULL DEFAULT 'GBP',
  -- minutes
  time_to_first_result  INTEGER NULL,
  completeness          INTEGER NULL DEFAULT 0,
  reproduction_count    INTEGER NOT NULL DEFAULT 0,
  last_confirmed_at     TIMESTAMPTZ NULL,
  last_confirmed_model  TEXT NULL,
  parent_build_id       UUID NULL REFERENCES public.builds(id) ON DELETE SET NULL,
  root_build_id         UUID NULL REFERENCES public.builds(id) ON DELETE SET NULL,
  -- FK to build_events(id) added in section 5
  forked_from_event_id  UUID NULL,
  monetisation_type     TEXT NULL,
  price_gbp             NUMERIC NULL,
  donation_enabled      BOOLEAN NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- addition to the handover schema, required by draft autosave (section 6)
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at          TIMESTAMPTZ NULL,

  CONSTRAINT builds_status_check CHECK (status IN ('draft','published','gallery')),
  CONSTRAINT builds_shape_check  CHECK (shape IN (
    'app','agent','workflow','prompt','dataset','study','media','technique','other'
  ))
);


-- =============================================================================
-- 2. node_types — the node type registry (seeded in NS-P02)
-- =============================================================================
CREATE TABLE public.node_types (
  key        TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  category   TEXT NOT NULL,
  colour     TEXT NOT NULL,
  icon       TEXT NULL,
  schema     JSONB NOT NULL DEFAULT '{}',
  renderer   TEXT NOT NULL,
  copyable   BOOLEAN NOT NULL DEFAULT false,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  sort       INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT node_types_category_check CHECK (category IN (
    'instruction','configuration','data','artefact','evidence','narrative'
  ))
);


-- =============================================================================
-- 3. build_nodes — the nested tree of typed nodes
-- =============================================================================
-- position is nullable and NULL carries meaning: a node with position IS NULL
-- is unassigned material sitting in the compose tray. It is never rendered
-- publicly, never exported, and never counted towards completeness. A placed
-- node always has an integer position, unique within its (build_id, parent_id)
-- — enforced by the partial unique index in section 4.
CREATE TABLE public.build_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id    UUID NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  parent_id   UUID NULL REFERENCES public.build_nodes(id) ON DELETE CASCADE,
  position    INTEGER NULL,
  type        TEXT NOT NULL REFERENCES public.node_types(key),
  title       TEXT NULL,
  -- the ONLY free-prose field
  note        TEXT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  -- {source, session_id, index}
  source_ref  JSONB NULL,
  -- FK to build_events(id) added in section 5
  event_id    UUID NULL,
  is_gap      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- 4. build_events — the ordered event sequence
-- =============================================================================
CREATE TABLE public.build_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id         UUID NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  ordinal          INTEGER NOT NULL,
  occurred_at      TIMESTAMPTZ NULL,
  kind             TEXT NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}',
  phase            INTEGER NULL,
  phase_title      TEXT NULL,
  visibility       TEXT NOT NULL DEFAULT 'folded',
  -- FK to build_nodes(id) added in section 5
  produced_node_id UUID NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT build_events_kind_check CHECK (kind IN (
    'prompt','milestone','breakage','deploy','note'
  )),
  CONSTRAINT build_events_visibility_check CHECK (visibility IN (
    'kept','folded','hidden'
  ))
);


-- =============================================================================
-- 5. Circular foreign keys — added now that all four tables exist
-- =============================================================================
ALTER TABLE public.builds
  ADD CONSTRAINT builds_hero_node_id_fkey
  FOREIGN KEY (hero_node_id) REFERENCES public.build_nodes(id) ON DELETE SET NULL;

ALTER TABLE public.build_nodes
  ADD CONSTRAINT build_nodes_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.build_events(id) ON DELETE SET NULL;

ALTER TABLE public.build_events
  ADD CONSTRAINT build_events_produced_node_id_fkey
  FOREIGN KEY (produced_node_id) REFERENCES public.build_nodes(id) ON DELETE SET NULL;

ALTER TABLE public.builds
  ADD CONSTRAINT builds_forked_from_event_id_fkey
  FOREIGN KEY (forked_from_event_id) REFERENCES public.build_events(id) ON DELETE SET NULL;


-- =============================================================================
-- 6. updated_at trigger — required by draft autosave
-- =============================================================================
-- Reuses the existing public.set_updated_at_timestamp() helper, unchanged.
CREATE TRIGGER trg_builds_updated_at
  BEFORE UPDATE ON public.builds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();


-- =============================================================================
-- 7. Indexes
-- =============================================================================
CREATE INDEX idx_build_nodes_tree
  ON public.build_nodes (build_id, parent_id, position);

-- A placed node's position is unique within its (build_id, parent_id). Tray
-- nodes (position IS NULL) are exempt, so the index is partial. parent_id is
-- coalesced to a sentinel because SQL treats NULLs as distinct in a unique
-- index, which would otherwise let root-level siblings share a position.
CREATE UNIQUE INDEX idx_build_nodes_placed_position
  ON public.build_nodes (
    build_id,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    position
  )
  WHERE position IS NOT NULL;

CREATE INDEX idx_build_events_ordinal
  ON public.build_events (build_id, ordinal);

CREATE INDEX idx_builds_status_published
  ON public.builds (status, published_at DESC);

CREATE INDEX idx_builds_made_for
  ON public.builds USING GIN (made_for);

CREATE INDEX idx_builds_made_with
  ON public.builds USING GIN (made_with);

CREATE INDEX idx_builds_creator
  ON public.builds (creator_id);

-- builds.slug is already covered by its UNIQUE constraint's index.

CREATE INDEX idx_node_types_sort
  ON public.node_types (sort);


-- =============================================================================
-- 8. Row level security
-- =============================================================================
-- Every call to the current-user helper below is wrapped as
-- (select auth.uid()) so Postgres evaluates it once per statement rather than
-- once per row.

ALTER TABLE public.builds       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_nodes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_types   ENABLE ROW LEVEL SECURITY;

-- --- builds ------------------------------------------------------------------
CREATE POLICY "Builds are readable unless draft"
  ON public.builds FOR SELECT
  USING (
    status <> 'draft'
    OR creator_id = (select auth.uid())
    OR public.is_admin((select auth.uid()))
  );

CREATE POLICY "Users create their own builds"
  ON public.builds FOR INSERT
  WITH CHECK (creator_id = (select auth.uid()));

CREATE POLICY "Creators and admins update builds"
  ON public.builds FOR UPDATE
  USING (
    creator_id = (select auth.uid())
    OR public.is_admin((select auth.uid()))
  );

CREATE POLICY "Creators and admins delete builds"
  ON public.builds FOR DELETE
  USING (
    creator_id = (select auth.uid())
    OR public.is_admin((select auth.uid()))
  );

-- --- build_nodes — readability and writability inherited from the parent build
CREATE POLICY "Build nodes follow build readability"
  ON public.build_nodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_nodes.build_id
        AND (
          b.status <> 'draft'
          OR b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

CREATE POLICY "Build nodes follow build writability on insert"
  ON public.build_nodes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_nodes.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

CREATE POLICY "Build nodes follow build writability on update"
  ON public.build_nodes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_nodes.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

CREATE POLICY "Build nodes follow build writability on delete"
  ON public.build_nodes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_nodes.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

-- --- build_events — readability and writability inherited from the parent build
CREATE POLICY "Build events follow build readability"
  ON public.build_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_events.build_id
        AND (
          b.status <> 'draft'
          OR b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

CREATE POLICY "Build events follow build writability on insert"
  ON public.build_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_events.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

CREATE POLICY "Build events follow build writability on update"
  ON public.build_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_events.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

CREATE POLICY "Build events follow build writability on delete"
  ON public.build_events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_events.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

-- --- node_types — world readable, admin writable --------------------------
CREATE POLICY "Node types are readable by everyone"
  ON public.node_types FOR SELECT
  USING (true);

CREATE POLICY "Admins create node types"
  ON public.node_types FOR INSERT
  WITH CHECK (public.is_admin((select auth.uid())));

CREATE POLICY "Admins update node types"
  ON public.node_types FOR UPDATE
  USING (public.is_admin((select auth.uid())));

CREATE POLICY "Admins delete node types"
  ON public.node_types FOR DELETE
  USING (public.is_admin((select auth.uid())));


-- =============================================================================
-- 9. Grants — RLS above is what actually gates access
-- =============================================================================
GRANT SELECT ON public.builds       TO anon, authenticated;
GRANT SELECT ON public.build_nodes  TO anon, authenticated;
GRANT SELECT ON public.build_events TO anon, authenticated;
GRANT SELECT ON public.node_types   TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.builds       TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.build_nodes  TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.build_events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.node_types   TO authenticated;

GRANT ALL ON public.builds       TO service_role;
GRANT ALL ON public.build_nodes  TO service_role;
GRANT ALL ON public.build_events TO service_role;
GRANT ALL ON public.node_types   TO service_role;
