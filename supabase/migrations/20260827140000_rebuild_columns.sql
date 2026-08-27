-- =============================================================================
-- NeoScale — the Rebuild edge: columns, counter, attribution snapshot (NS-P36)
-- =============================================================================
-- Schema only. Five columns on public.builds, one trigger function behind two
-- triggers, a backfill and two indexes. No new table, no policy change, no
-- change to any existing column, function or trigger.
--
-- A Rebuild is a fork that got published. The fork half already exists:
-- src/lib/build/fork.ts writes parent_build_id, root_build_id and
-- forked_from_event_id onto a new DRAFT build. What that leaves missing is
-- everything the social half needs — what the rebuilder changed, how many
-- rebuilds a source has actually earned, and who to credit once the source has
-- been renamed or deleted out from under the child. This migration adds those,
-- and nothing that reads them: the functions land in NS-P37, the route in
-- NS-P38.
--
-- WHY THE SNAPSHOT COLUMNS EXIST AT ALL
-- parent_build_id is ON DELETE SET NULL, so deleting a source silently strips
-- the credit line off every child that descended from it, and renaming a source
-- rewrites history on cards that were published months earlier. Credit that
-- can be revoked by the party being credited is not credit. source_title_at_fork
-- and source_handle_at_fork are copied at fork time and never maintained
-- afterwards: they are a record of what the child was forked FROM, deliberately
-- frozen, and a renderer that prefers them to a live join is showing the truth
-- about the fork rather than the truth about the parent's current row.
-- =============================================================================


-- =============================================================================
-- 1. The five columns
-- =============================================================================
-- All nullable except the counter, so this ALTER rewrites no rows: the counter's
-- default is a constant, which Postgres 11+ stores in the catalogue rather than
-- writing into every tuple. The lock is brief even though builds is live.
ALTER TABLE public.builds
  -- the rebuilder's "what I changed and why". Prose, like build_nodes.note, and
  -- the only free-prose field this migration adds.
  ADD COLUMN rebuild_note            TEXT NULL,
  -- denormalised onto the SOURCE row, maintained by section 3. Counts PUBLISHED
  -- children only — a draft fork of your build is nobody's business but the
  -- forker's, and must never appear on your card.
  ADD COLUMN rebuild_count           INTEGER NOT NULL DEFAULT 0,
  -- frozen at fork time; see the header. NULL on a build that is not a fork,
  -- and NULL on the NS-P16-era forks that predate this column.
  ADD COLUMN source_title_at_fork    TEXT NULL,
  -- profiles.username, not display_name: the handle is the stable address, and
  -- the thing a credit line can link to.
  ADD COLUMN source_handle_at_fork   TEXT NULL,
  -- set when this build was published to fill a named gap in another build.
  -- Phase B reads it; it is created here so the edge model is complete in one
  -- migration rather than two. ON DELETE SET NULL because a gap node
  -- disappearing must not take the build that answered it with it.
  ADD COLUMN solves_node_id          UUID NULL
    REFERENCES public.build_nodes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.builds.rebuild_note IS
  'The rebuilder''s account of what they changed and why. Set on the child, never on the source.';
COMMENT ON COLUMN public.builds.rebuild_count IS
  'Denormalised count of PUBLISHED children of this build. Maintained by trg_builds_rebuild_count_status and trg_builds_rebuild_count_delete — never write it from the client.';
COMMENT ON COLUMN public.builds.source_title_at_fork IS
  'The parent''s title as it read at fork time. Frozen on purpose: credit must survive the source being renamed or deleted.';
COMMENT ON COLUMN public.builds.source_handle_at_fork IS
  'The parent creator''s profiles.username as it read at fork time. Frozen for the same reason as source_title_at_fork.';
COMMENT ON COLUMN public.builds.solves_node_id IS
  'The gap node this build was published to fill, if any. Read by Phase B.';


-- =============================================================================
-- 2. Backfill
-- =============================================================================
-- Before the triggers exist, so this UPDATE cannot interact with them. Forks
-- exist from NS-P16-era testing; published ones may well be zero, in which case
-- this statement touches nothing and every row keeps the column default.
--
-- Rows with no published children are already correct at 0, so they are left
-- alone rather than written to — builds carries the BEFORE UPDATE trigger
-- trg_builds_updated_at, and a backfill that bumped updated_at across the whole
-- table would reorder anything that ever sorts by it.
UPDATE public.builds p
SET rebuild_count = c.published_children
FROM (
  SELECT
    b.parent_build_id,
    count(*)::INTEGER AS published_children
  FROM public.builds b
  WHERE b.parent_build_id IS NOT NULL
    AND b.status IN ('published', 'gallery')
  GROUP BY b.parent_build_id
) c
WHERE p.id = c.parent_build_id
  AND p.rebuild_count IS DISTINCT FROM c.published_children;


-- =============================================================================
-- 3. The counter
-- =============================================================================
-- SECURITY DEFINER because the person publishing a rebuild is by definition NOT
-- the source's creator, and the builds UPDATE policy ("Creators and admins
-- update builds") admits only the creator and admins. Without the definer right
-- the counter would silently stay at zero for every rebuild of someone else's
-- work, which is the only case that matters. The function writes exactly one
-- column of one row, keyed by a build id it read off the row that fired it —
-- it takes no argument and cannot be pointed at anything else.
--
-- search_path is pinned EMPTY and every reference is schema-qualified, so no
-- search path a caller sets can put a different `builds` in front of this one.
-- That is a deliberate half-step past refresh_build_reproduction_signals()
-- next door, which pins `= public`: identical in effect here because nothing in
-- this body is unqualified, and the stricter form is what the Postgres skill
-- prescribes for a definer function.
--
-- INCREMENT, NOT RECOUNT — and this is a deliberate departure from
-- refresh_build_reproduction_signals() next door, which recomputes. That one
-- has to: a reproduction row can be edited (`worked` flips) or deleted in ways
-- that change the aggregate without any status transition to observe. Here the
-- transition IS the event, both directions of it are covered below, and the
-- floor at 0 means the worst a missed edge can do is undercount rather than
-- strand a negative number on a card. The recount that repairs a drifted row is
-- section 2's UPDATE, which is safe to re-run at any time.
CREATE OR REPLACE FUNCTION public.sync_build_rebuild_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _was_published BOOLEAN;
  _is_published  BOOLEAN;
BEGIN
  -- A published child disappearing takes its point with it. A DRAFT child
  -- disappearing was never counted, so it takes nothing.
  IF TG_OP = 'DELETE' THEN
    IF OLD.parent_build_id IS NOT NULL
       AND OLD.status IN ('published', 'gallery') THEN
      UPDATE public.builds
      SET rebuild_count = GREATEST(rebuild_count - 1, 0)
      WHERE id = OLD.parent_build_id;
    END IF;
    RETURN NULL;
  END IF;

  -- 'gallery' is a curated published build, not a third state: a rebuild
  -- promoted from published to gallery is still exactly one rebuild, so both
  -- sides of the test treat the two as one.
  _was_published := OLD.status IN ('published', 'gallery');
  _is_published  := NEW.status IN ('published', 'gallery');

  IF _is_published AND NOT _was_published AND NEW.parent_build_id IS NOT NULL THEN
    UPDATE public.builds
    SET rebuild_count = rebuild_count + 1
    WHERE id = NEW.parent_build_id;

  ELSIF _was_published AND NOT _is_published AND OLD.parent_build_id IS NOT NULL THEN
    -- unpublishing back to draft, the only transition out of published there is
    UPDATE public.builds
    SET rebuild_count = GREATEST(rebuild_count - 1, 0)
    WHERE id = OLD.parent_build_id;
  END IF;

  RETURN NULL;
END;
$$;

-- A function RETURNING trigger cannot be called directly — Postgres refuses
-- before the body runs — so this REVOKE closes no hole that is open today. It
-- is here because the definer right is the thing worth being conservative with,
-- and because a later refactor that gives this function a callable signature
-- would otherwise inherit EXECUTE from PUBLIC silently. Trigger firing does not
-- consult EXECUTE, so the triggers below are unaffected.
REVOKE EXECUTE ON FUNCTION public.sync_build_rebuild_count()
  FROM PUBLIC, anon, authenticated;

-- Two triggers, one function: an AFTER DELETE trigger's WHEN clause may not
-- reference NEW, so the two firing conditions cannot share a declaration
-- without giving up the WHEN clauses — and the WHEN clauses are the point.
-- Publishing a build that is nobody's child, which is almost every publish this
-- platform will ever do, never enters the function at all.

-- AFTER UPDATE OF status: the trigger fires only when status appears in the SET
-- list. The counter UPDATE above writes rebuild_count and nothing else, so the
-- function cannot re-enter itself, and a rebuild of a rebuild moves only ITS
-- parent's count — the row it touches is named by parent_build_id, and nothing
-- walks up to root_build_id.
CREATE TRIGGER trg_builds_rebuild_count_status
AFTER UPDATE OF status ON public.builds
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  AND (OLD.parent_build_id IS NOT NULL OR NEW.parent_build_id IS NOT NULL)
)
EXECUTE FUNCTION public.sync_build_rebuild_count();

-- Deleting the SOURCE does not come through here: parent_build_id is ON DELETE
-- SET NULL, and clearing it is an UPDATE that does not mention status, so the
-- trigger above stays quiet and no count is decremented on a row that is on its
-- way out anyway.
CREATE TRIGGER trg_builds_rebuild_count_delete
AFTER DELETE ON public.builds
FOR EACH ROW
WHEN (
  OLD.parent_build_id IS NOT NULL
  AND OLD.status IN ('published', 'gallery')
)
EXECUTE FUNCTION public.sync_build_rebuild_count();

-- ONE EDGE THIS DOES NOT COVER, STATED PLAINLY: a row INSERTED already
-- published with a parent_build_id set is not counted, because there is no
-- INSERT trigger. Nothing in the application does that — forkBuild() creates a
-- draft and NS-P37 will publish it with an UPDATE — but a seed script or a hand
-- written INSERT can, and section 2's UPDATE is the repair when one does.


-- =============================================================================
-- 4. Indexes
-- =============================================================================
-- The Rebuilds tab and the count queries both ask the same question: which
-- builds name THIS build as their parent. Partial, because parent_build_id is
-- NULL on every build that is not a fork and those rows have no business in an
-- index that only ever serves an IS NOT NULL lookup.
CREATE INDEX idx_builds_parent_build
  ON public.builds (parent_build_id)
  WHERE parent_build_id IS NOT NULL;

-- solves_node_id gets one too, for a different reason: the column is ON DELETE
-- SET NULL against build_nodes, and Postgres does not index a foreign key for
-- you. Without this, every build_nodes delete scans builds to find referencing
-- rows — and node deletes are routine (every removal in the compose tray) and
-- multiplied (deleting a build cascades to all of its nodes, one scan each).
-- That is the difference from builds.cover_media_id, which NS-P27 deliberately
-- left unindexed: build_media rows are deleted rarely and one at a time.
CREATE INDEX idx_builds_solves_node
  ON public.builds (solves_node_id)
  WHERE solves_node_id IS NOT NULL;


-- =============================================================================
-- 5. Row level security — nothing to do
-- =============================================================================
-- New columns on an existing table ride that table's existing policies, and
-- builds has no column-level grants for them to fall outside of. The four
-- policies on builds are unchanged and are not re-stated here.
--
-- Worth knowing before NS-P37 is written: rebuild_count is writable by the row's
-- creator through the ordinary UPDATE policy, exactly as reproduction_count
-- already is. Neither is a client's to set. The counter is the trigger's.
