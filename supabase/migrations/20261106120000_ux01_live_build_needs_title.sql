-- =============================================================================
-- UX-01 part 2: a live build always has a title
-- =============================================================================
-- 20261027120000_sv07_publish_needs_title.sql refuses the move from draft to live
-- without a title. It does not look at a title changed AFTER the build is live:
-- the trigger fires only BEFORE INSERT OR UPDATE OF status, and refuses only
-- when OLD.status = 'draft'. A live build whose title is cleared, or set back to
-- "Untitled build", got through.
--
-- This replaces refuse_publish_without_title() so that it also refuses a row
-- whose NEW.status is 'published' or 'gallery' and whose title is not a title,
-- and the trigger now also fires BEFORE UPDATE OF title.
--
-- "No title" is what the app means by it (src/lib/build/publish.ts, hasTitle):
-- null, empty after trimming, or the title a new draft is given, "Untitled build".
--
-- BUILDS ALREADY LIVE WITH NO TITLE ARE NOT TOUCHED. Nothing here updates a row.
-- Such a build is refused only when someone next edits its title or its status
-- (an update that sets neither is not looked at). Give each a title by hand first;
-- the query in the Lovable message lists them.
--
-- A DRAFT is not affected: its title may be emptied, and a draft going live is
-- checked as before.
--
-- SECURITY INVOKER: it reads only the row being written. search_path is set all
-- the same. It is a trigger function, which cannot be called directly; EXECUTE
-- is revoked from PUBLIC, anon and authenticated anyway, as SV-01 part 6 does.
--
-- Safe to run more than once: CREATE OR REPLACE, and the trigger is dropped
-- first if it is there. If 20261027120000 was never applied, this file creates
-- the function and the trigger on its own, so it is complete either way.
--
-- No new index, and no read that scans a table: nothing to EXPLAIN.

CREATE OR REPLACE FUNCTION public.refuse_publish_without_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('published', 'gallery')
     AND (NEW.title IS NULL OR btrim(NEW.title) = '' OR btrim(NEW.title) = 'Untitled build') THEN
    -- A row is checked when it is new, when it moves to live, and when its title changes while it is live.
    -- A live row whose status and title are both unchanged is left alone, so a build already live with no
    -- title can still have its other columns written (a view count, its completeness).
    IF TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.title IS DISTINCT FROM NEW.title THEN
      RAISE EXCEPTION 'Give the build a title before you publish it.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refuse_publish_without_title()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_builds_publish_needs_title ON public.builds;

CREATE TRIGGER trg_builds_publish_needs_title
BEFORE INSERT OR UPDATE OF status, title ON public.builds
FOR EACH ROW
EXECUTE FUNCTION public.refuse_publish_without_title();
