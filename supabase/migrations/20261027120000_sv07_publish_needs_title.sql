-- =============================================================================
-- SV-07 part 8: a build is not published without a title
-- =============================================================================
-- A build went live as "Untitled build": the legacy composer (rebuilds open it)
-- gated Publish on outcome, prompt and evidence only, and the publish write
-- itself checked nothing. The app now refuses it on every path. This makes the
-- database refuse it too, for any client.
--
-- A TRIGGER, NOT A CHECK. A CHECK constraint would be tested on every later
-- update of a build already live with no title, so its maker could not even
-- fix its description. This fires only on the move to live: a row inserted as
-- published or gallery, or one whose status leaves draft. Builds already live
-- are left as they are; renaming them works as before.
--
-- "No title" is what the app means by it (src/lib/build/publish.ts, hasTitle):
-- empty after trimming, or the title a new draft is given, "Untitled build".
--
-- SECURITY INVOKER: it reads only the row being written. search_path is set all
-- the same. It is a trigger function, which cannot be called directly; EXECUTE
-- is revoked from PUBLIC, anon and authenticated anyway, as SV-01 part 6 does.
--
-- Safe to run more than once: CREATE OR REPLACE, and the trigger is dropped
-- first if it is there.
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
     AND (TG_OP = 'INSERT' OR (OLD.status = 'draft' AND NEW.status IS DISTINCT FROM OLD.status))
     AND (NEW.title IS NULL OR btrim(NEW.title) = '' OR btrim(NEW.title) = 'Untitled build') THEN
    RAISE EXCEPTION 'Give the build a title before you publish it.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refuse_publish_without_title()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_builds_publish_needs_title ON public.builds;

CREATE TRIGGER trg_builds_publish_needs_title
BEFORE INSERT OR UPDATE OF status ON public.builds
FOR EACH ROW
EXECUTE FUNCTION public.refuse_publish_without_title();
