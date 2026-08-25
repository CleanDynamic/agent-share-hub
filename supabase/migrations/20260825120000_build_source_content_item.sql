-- =============================================================================
-- NeoScale — the pointer from a converted build back to its source post (NS-P24)
-- =============================================================================
-- One column, one foreign key, one index. Nothing else.
--
-- WHY THE POINTER LIVES HERE AND NOT ON content_items
-- ---------------------------------------------------
-- content_items is on the existing content path, which this rebuild runs
-- alongside and does not touch. A column added there would be a change to a
-- live table read by Upload, ContentDetail and everything they import, for the
-- benefit of a table that did not exist last month. The new table carries the
-- reference to the old one; the old one never learns the new one exists.
--
-- ON DELETE SET NULL, NOT CASCADE
-- -------------------------------
-- A converted build is the creator's own record, written and edited after the
-- conversion. Deleting the post it started from must not delete it. The
-- provenance is lost, which is a small and honest loss; the record is not.
--
-- NULL IS THE NORMAL CASE
-- -----------------------
-- Every build authored in compose has no source post. Only a converted one
-- does, so the index is partial: it serves exactly one question — "has this
-- post already been converted?" — and costs nothing on the builds that answer
-- it with NULL.
--
-- NOT UNIQUE, DELIBERATELY
-- ------------------------
-- Nothing here forbids a second conversion of the same post at the database
-- level. src/lib/build/convert.ts checks first and offers the existing draft
-- instead, which is the behaviour a creator wants; a unique constraint would
-- additionally forbid a fork of a converted build from carrying its origin,
-- and would turn a double-click into a Postgres error rather than a second
-- link to the same draft.
--
-- This migration adds one nullable column and one index to a table introduced
-- by NS-P01. It alters no existing table, policy, function or row, and adds no
-- policy — builds already carries its own RLS, and a new column on it is
-- covered by the policies that are there.
-- =============================================================================

ALTER TABLE public.builds
  ADD COLUMN source_content_item_id UUID NULL
    REFERENCES public.content_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.builds.source_content_item_id IS
  'The content_items row this build was converted from (NS-P24). NULL for a build authored in compose. The source row is never modified and stays published at its own URL.';

CREATE INDEX idx_builds_source_content_item
  ON public.builds (source_content_item_id)
  WHERE source_content_item_id IS NOT NULL;
