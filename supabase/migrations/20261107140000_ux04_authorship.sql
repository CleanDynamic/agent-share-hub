-- UX-04 Part 3: the authorship rule, enforced where attachments are written.
--
-- THE RULE. Ask with anything, answer with your own.
--   * A REPLY may attach only work its author made. Media must sit under the author's own storage folder.
--   * A ROOT POST may attach anyone's published work, unless that build's maker switched builds.allow_as_post_source off.
--   * Nobody can attach someone else's draft, and attaching never makes a draft readable: work from the author's own draft is
--     stored as the copy the client took (post_attachments.snapshot), and published work is referenced and carries no copy.
--
-- WHOSE WORK IS IT. Judged by the build's creator and, where SV-16 set one, by the contributor:
--   build     builds.creator_id
--   step      build_nodes.contributor_id where set, else builds.creator_id
--   part      builds.creator_id (a part is a group of sessions kept in builds.making.workstreams; it has no contributor of its own)
--   session   builds.making -> sessions_meta -> <session_key> -> contributor_id where set, else builds.creator_id
-- A REBUILD COUNTS AS THE REBUILDER'S OWN WORK: it is a build whose creator is the rebuilder, so the rule above already says so.
--
-- WHAT IS NOT CHECKED, AND WHY. A reply that attaches a rebuild nobody has changed is allowed. Telling an unchanged rebuild from a
-- changed one is rebuild.ts's changeSet, computed in the browser from two loaded build records; build_nodes keeps no pointer from a
-- forked node to its source (fork.ts mints every id fresh), and updated_at (SV-19) moves only on an edit after the copy, which a
-- node written new in the rebuild does not show either. Telling them apart in the database would need new tracking, and this does
-- not add any. The report says so.
--
-- THE ERRORS are plain words and name the rule, and they reach the caller unchanged:
--   A reply can attach only your own work.
--   This build's maker doesn't allow it to start posts.
--
-- post_attachment_owner and the triggers are SECURITY DEFINER because they read builds and build_nodes that the writer may not
-- (a draft). They set search_path and nobody can call them: a trigger fires without EXECUTE.
--
-- post_attachment_owner is shared: Part 5 uses it to tell the maker of work a root post started from.
--
-- No new index and no read that scans a table: the reads are by primary key.

CREATE OR REPLACE FUNCTION public.post_attachment_owner(_kind text, _build uuid, _node uuid, _session text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator uuid;
  _making  jsonb;
  _owner   uuid;
  _raw     text;
BEGIN
  SELECT b.creator_id, b.making INTO _creator, _making FROM public.builds b WHERE b.id = _build;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF _kind = 'step' AND _node IS NOT NULL THEN
    SELECT n.contributor_id INTO _owner FROM public.build_nodes n WHERE n.id = _node AND n.build_id = _build;
  ELSIF _kind = 'session' AND _session IS NOT NULL THEN
    _raw := _making -> 'sessions_meta' -> _session ->> 'contributor_id';
    IF _raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      _owner := _raw::uuid;
    END IF;
  END IF;

  RETURN coalesce(_owner, _creator);
END;
$$;

REVOKE ALL ON FUNCTION public.post_attachment_owner(text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_post_attachment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid;
  _parent uuid;
  _status text;
  _allow  boolean;
  _owner  uuid;
BEGIN
  SELECT p.author_id, p.parent_id INTO _author, _parent FROM public.posts p WHERE p.id = NEW.post_id;
  IF NOT FOUND THEN
    RETURN NEW; -- the foreign key refuses it
  END IF;

  IF NEW.kind = 'media' THEN
    IF split_part(NEW.media_path, '/', 1) <> _author::text THEN
      RAISE EXCEPTION 'Media must sit in your own storage folder.';
    END IF;
    RETURN NEW;
  END IF;

  SELECT b.status, b.allow_as_post_source INTO _status, _allow FROM public.builds b WHERE b.id = NEW.build_id;
  IF NOT FOUND THEN
    RETURN NEW; -- the foreign key refuses it
  END IF;

  IF NEW.node_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.build_nodes n WHERE n.id = NEW.node_id AND n.build_id = NEW.build_id) THEN
    RAISE EXCEPTION 'That step is not in that build.';
  END IF;

  _owner := public.post_attachment_owner(NEW.kind, NEW.build_id, NEW.node_id, NEW.session_key);

  IF _owner IS DISTINCT FROM _author THEN
    IF _parent IS NOT NULL THEN
      RAISE EXCEPTION 'A reply can attach only your own work.';
    END IF;
    IF _status = 'draft' THEN
      RAISE EXCEPTION 'That work is not published, so it can''t be attached.';
    END IF;
    IF NOT _allow THEN
      RAISE EXCEPTION 'This build''s maker doesn''t allow it to start posts.';
    END IF;
  END IF;

  -- Work from a draft travels as the copy taken now; published work is referenced and carries none.
  IF _status = 'draft' THEN
    IF NEW.snapshot IS NULL OR jsonb_typeof(NEW.snapshot) <> 'object' THEN
      RAISE EXCEPTION 'Work from a draft needs a copy taken when it is attached.';
    END IF;
  ELSE
    NEW.snapshot := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_post_attachment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_post_attachment ON public.post_attachments;
CREATE TRIGGER trg_check_post_attachment
BEFORE INSERT OR UPDATE ON public.post_attachments
FOR EACH ROW EXECUTE FUNCTION public.check_post_attachment();
