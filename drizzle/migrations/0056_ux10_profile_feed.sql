-- UX-10 Part 1: the profile is a feed.
--
-- WHAT. The settings a person's profile is drawn from, the things they pin to it, a per-build choice of how a build shows there,
-- and four functions: the profile's feed (get_profile_feed), what the side column and the record line count (get_profile_side),
-- the followers and following lists (list_profile_follows), and Customise profile's one write (save_profile).
--
--   profiles.avatar_crop, banner_crop    {x,y,w,h}, each a fraction 0..1, as MediaCrop stores a post picture's crop. The file is never
--                                        changed: the crop is a rectangle the page shows (cropStyle).
--   profiles.avatar_alt, banner_alt      at most 1000 characters (ALT_MAX).
--   profiles.about                       at most 600 characters.
--   profiles.links                       at most 3, each an https:// URL of at most 200 characters.
--   profiles.profile_settings            {} by default. Keys: feed_filter (all|builds|topics|replies|notes), build_display
--                                        (first_post|map), side_sections ([{key, hidden}], key in about|spaces|others|collections|marks,
--                                        each once), notes_visible (everyone|followers|only_me), level_visible (everyone|only_me).
--                                        An unknown key or value is refused (profile_settings_ok).
--   profile_pins                         up to three things a person made, in order (position 1..3). Everyone reads; only the owner
--                                        writes. A trigger refuses a fourth pin and anything the person did not make.
--   build_profile_display                one build's own choice (first_post|map), written only by the build's maker.
--
-- WHY. UX-10 rebuilds /profile/:handle as one feed of everything a person has posted, newest first, with a short head and a side
-- column a Customise profile window controls. The old page read eight things on its own; this reads the feed in one ordered page
-- from the database (never pages merged in the browser) and the side column's counts in one more.
--
-- WHAT A SETTING HIDES IS HIDDEN HERE, NOT IN THE PAGE. notes_visible is applied inside get_profile_feed and get_profile_side, and
-- level_visible inside profile_level_of (the one SECURITY DEFINER function here: user_progress is readable by its owner only, so a
-- visitor's "Level 7" needs a definer, and it answers only what the owner's setting allows). A private profile (profiles.is_private)
-- that the reader does not follow returns no feed, no side column and no follow lists, whoever asks. Saves never appear: no function
-- here reads saved items.
--
-- NOTE ON NOTES. get_build_feed (Home) shows every reproduction note to everyone, as it did before this file. notes_visible governs
-- the profile only; the report says so.
--
-- STORAGE. No bucket is added. profile-assets (20260318185802) is public-read and writable only under the owner's own <uid>/ prefix,
-- which is what a profile picture needs: Avatar shows it on every page, and a public URL costs no signing round. Its limits are the
-- client's (pictureRejection's 25MB and still images only, checked before any upload); the bucket itself sets none.
--
-- No client write here notifies anyone: profile_pins, build_profile_display and the profile columns have no notification trigger.
--
-- Every policy calls (select auth.uid()), never a bare auth.uid(). Correct whether or not any of it already exists; running it twice
-- changes nothing the first run did not.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied, with real ids; paste the plans back.
--   1. The whole feed, first page and a later one:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.get_profile_feed('<a handle>', 'all', NULL, 20);
--      EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.get_profile_feed('<a handle>', 'all', now() - interval '30 days', 20);
--      SHOULD SHOW: a Function Scan, Execution Time in the low milliseconds, a few hundred shared buffers at most.
--   2. The build leg:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT b.id, b.published_at FROM public.builds b
--       WHERE b.creator_id = '<a user id>' AND b.status IN ('published','gallery') AND b.published_at IS NOT NULL
--         AND b.published_at < now() ORDER BY b.published_at DESC LIMIT 20;
--      SHOULD SHOW: an Index Scan Backward (or Index Scan) on idx_builds_creator_published that stops at the limit, no Sort,
--      no Seq Scan on builds.
--   3. The topic and reply legs:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT p.id, p.created_at FROM public.openbuild_posts p
--       WHERE p.author_id = '<a user id>' AND p.parent_id IS NULL AND p.hidden_by IS NULL AND p.created_at < now()
--       ORDER BY p.created_at DESC LIMIT 20;
--      SHOULD SHOW: an Index Scan Backward on idx_posts_author_created (UX-04) that stops at the limit, no Seq Scan.
--   4. The note leg:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT r.id, r.confirmed_at FROM public.build_reproductions r
--       WHERE r.user_id = '<a user id>' AND r.note IS NOT NULL AND r.confirmed_at < now() ORDER BY r.confirmed_at DESC LIMIT 20;
--      SHOULD SHOW: an Index Scan Backward on idx_build_reproductions_user_confirmed, no Sort, no Seq Scan.
--   5. The side column:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT public.get_profile_side('<a handle>');
--      SHOULD SHOW: a Result, Execution Time under 20 ms for a maker with a few hundred builds.
--   6. A follow list:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.list_profile_follows('<a handle>', 'followers', NULL, 30);
--      SHOULD SHOW: an Index Scan on idx_follows_following_created that stops at the limit, no Sort of every follower.

-- 1. The profile's columns ------------------------------------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_crop      jsonb NULL,
  ADD COLUMN IF NOT EXISTS banner_crop      jsonb NULL,
  ADD COLUMN IF NOT EXISTS avatar_alt       text  NULL,
  ADD COLUMN IF NOT EXISTS banner_alt       text  NULL,
  ADD COLUMN IF NOT EXISTS about            text  NULL,
  ADD COLUMN IF NOT EXISTS links            text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profile_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- A crop is {x,y,w,h}, four numbers between 0 and 1, and nothing else.
CREATE OR REPLACE FUNCTION public.profile_crop_ok(c jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT c IS NULL OR (
    jsonb_typeof(c) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(c)) = 4
    AND c ?& ARRAY['x','y','w','h']
    AND jsonb_typeof(c->'x') = 'number' AND jsonb_typeof(c->'y') = 'number'
    AND jsonb_typeof(c->'w') = 'number' AND jsonb_typeof(c->'h') = 'number'
    AND (c->>'x')::numeric BETWEEN 0 AND 1 AND (c->>'y')::numeric BETWEEN 0 AND 1
    AND (c->>'w')::numeric BETWEEN 0 AND 1 AND (c->>'h')::numeric BETWEEN 0 AND 1
  )
$$;

-- Up to three links, each https:// and at most 200 characters.
CREATE OR REPLACE FUNCTION public.profile_links_ok(l text[])
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT l IS NOT NULL
    AND coalesce(array_length(l, 1), 0) <= 3
    AND NOT EXISTS (SELECT 1 FROM unnest(l) AS u(v) WHERE v IS NULL OR v !~ '^https://[^[:space:]]+$' OR char_length(v) > 200)
$$;

-- The settings: known keys, known values, and the side sections each once.
CREATE OR REPLACE FUNCTION public.profile_settings_ok(s jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT jsonb_typeof(s) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(s) AS k(key)
      WHERE key NOT IN ('feed_filter', 'build_display', 'side_sections', 'notes_visible', 'level_visible')
    )
    AND (NOT s ? 'feed_filter'   OR s->>'feed_filter'   IN ('all', 'builds', 'topics', 'replies', 'notes'))
    AND (NOT s ? 'build_display' OR s->>'build_display' IN ('first_post', 'map'))
    AND (NOT s ? 'notes_visible' OR s->>'notes_visible' IN ('everyone', 'followers', 'only_me'))
    AND (NOT s ? 'level_visible' OR s->>'level_visible' IN ('everyone', 'only_me'))
    AND (
      NOT s ? 'side_sections'
      OR (
        jsonb_typeof(s->'side_sections') = 'array'
        AND jsonb_array_length(s->'side_sections') <= 5
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(s->'side_sections') AS e(v)
          WHERE jsonb_typeof(v) <> 'object'
             OR v->>'key' IS NULL
             OR v->>'key' NOT IN ('about', 'spaces', 'others', 'collections', 'marks')
             OR jsonb_typeof(v->'hidden') IS DISTINCT FROM 'boolean'
             OR EXISTS (SELECT 1 FROM jsonb_object_keys(v) AS k(key) WHERE key NOT IN ('key', 'hidden'))
        )
        AND (SELECT count(DISTINCT v->>'key') FROM jsonb_array_elements(s->'side_sections') AS e(v)) = jsonb_array_length(s->'side_sections')
      )
    )
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_avatar_crop_ok' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_crop_ok CHECK (public.profile_crop_ok(avatar_crop));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_banner_crop_ok' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_banner_crop_ok CHECK (public.profile_crop_ok(banner_crop));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_avatar_alt_length' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_alt_length CHECK (avatar_alt IS NULL OR char_length(avatar_alt) <= 1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_banner_alt_length' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_banner_alt_length CHECK (banner_alt IS NULL OR char_length(banner_alt) <= 1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_about_length' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_about_length CHECK (about IS NULL OR char_length(about) <= 600);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_links_ok' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_links_ok CHECK (public.profile_links_ok(links));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_settings_ok' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_settings_ok CHECK (public.profile_settings_ok(profile_settings));
  END IF;
END $$;

-- 2. profile_pins --------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profile_pins (
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_kind  text        NOT NULL,
  item_id    uuid        NOT NULL,
  position   int         NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_kind, item_id),
  CONSTRAINT profile_pins_position UNIQUE (user_id, position),
  CONSTRAINT profile_pins_kind_check CHECK (item_kind IN ('build', 'topic', 'reply', 'repro_note')),
  CONSTRAINT profile_pins_position_check CHECK (position BETWEEN 1 AND 3)
);

GRANT SELECT ON public.profile_pins TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_pins TO authenticated;
ALTER TABLE public.profile_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone reads profile pins" ON public.profile_pins;
CREATE POLICY "Everyone reads profile pins" ON public.profile_pins FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owners pin" ON public.profile_pins;
CREATE POLICY "Owners pin" ON public.profile_pins FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Owners reorder pins" ON public.profile_pins;
CREATE POLICY "Owners reorder pins" ON public.profile_pins FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Owners unpin" ON public.profile_pins;
CREATE POLICY "Owners unpin" ON public.profile_pins FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- The guard: a pin with no position takes the next free one; a fourth pin is refused; so is anything the person did not make.
-- SECURITY INVOKER: the owner reads their own builds, posts and runs, which is all it asks.
CREATE OR REPLACE FUNCTION public.profile_pins_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  made boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM public.profile_pins WHERE user_id = NEW.user_id) >= 3 THEN
      RAISE EXCEPTION 'A profile holds 3 pins. Unpin one first.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.position IS NULL THEN
      SELECT min(n) INTO NEW.position FROM generate_series(1, 3) AS g(n)
       WHERE NOT EXISTS (SELECT 1 FROM public.profile_pins p WHERE p.user_id = NEW.user_id AND p.position = g.n);
    END IF;
  END IF;

  made := CASE NEW.item_kind
    WHEN 'build' THEN EXISTS (SELECT 1 FROM public.builds b WHERE b.id = NEW.item_id AND b.creator_id = NEW.user_id
                                AND b.status IN ('published', 'gallery'))
    WHEN 'topic' THEN EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = NEW.item_id AND p.author_id = NEW.user_id
                                AND p.parent_id IS NULL)
    WHEN 'reply' THEN EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = NEW.item_id AND p.author_id = NEW.user_id
                                AND p.parent_id IS NOT NULL)
    WHEN 'repro_note' THEN EXISTS (SELECT 1 FROM public.build_reproductions r WHERE r.id = NEW.item_id AND r.user_id = NEW.user_id)
    ELSE false
  END;
  IF NOT made THEN
    RAISE EXCEPTION 'You can only pin something you made.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_pins_guard ON public.profile_pins;
CREATE TRIGGER trg_profile_pins_guard
BEFORE INSERT OR UPDATE OF item_kind, item_id, user_id ON public.profile_pins
FOR EACH ROW EXECUTE FUNCTION public.profile_pins_guard();

-- A pin written without a position takes the next free one from the guard: NOT NULL is checked after BEFORE triggers run.

-- 3. build_profile_display -----------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.build_profile_display (
  build_id   uuid        PRIMARY KEY REFERENCES public.builds(id) ON DELETE CASCADE,
  display    text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT build_profile_display_check CHECK (display IN ('first_post', 'map'))
);

GRANT SELECT ON public.build_profile_display TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.build_profile_display TO authenticated;
ALTER TABLE public.build_profile_display ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone reads a build's profile display" ON public.build_profile_display;
CREATE POLICY "Everyone reads a build's profile display" ON public.build_profile_display FOR SELECT USING (true);
DROP POLICY IF EXISTS "Makers choose their build's profile display" ON public.build_profile_display;
CREATE POLICY "Makers choose their build's profile display" ON public.build_profile_display FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_profile_display.build_id AND b.creator_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_profile_display.build_id AND b.creator_id = (select auth.uid())));

-- 4. Indexes, each for a leg of get_profile_feed or list_profile_follows ---------------------------------------------------------

-- A maker's published builds, newest first.
CREATE INDEX IF NOT EXISTS idx_builds_creator_published
  ON public.builds (creator_id, published_at DESC) WHERE status IN ('published', 'gallery') AND published_at IS NOT NULL;
-- A person's runs, newest first (idx_build_reproductions_user is on created_at, which the feed does not order by).
CREATE INDEX IF NOT EXISTS idx_build_reproductions_user_confirmed
  ON public.build_reproductions (user_id, confirmed_at DESC);
-- A person's followers and the people they follow, newest first.
CREATE INDEX IF NOT EXISTS idx_follows_following_created ON public.follows (following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower_created ON public.follows (follower_id, created_at DESC);
-- openbuild_posts (author_id, created_at DESC) is UX-04's idx_posts_author_created.

-- 5. Who may read a profile's feed --------------------------------------------------------------------------------------------
-- The profile by its handle, with what the reader is to it. A private profile the reader does not follow (and is not) is absent.

CREATE OR REPLACE FUNCTION public.profile_reader_view(p_username text)
RETURNS TABLE (user_id uuid, own boolean, follows boolean, notes_visible text, level_visible text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT p.id,
         p.id = (select auth.uid()),
         EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = (select auth.uid()) AND f.following_id = p.id),
         coalesce(p.profile_settings->>'notes_visible', 'everyone'),
         coalesce(p.profile_settings->>'level_visible', 'everyone')
    FROM public.profiles p
   WHERE lower(p.username) = lower(ltrim(btrim(p_username), '@'))
     AND (
       NOT coalesce(p.is_private, false)
       OR p.id = (select auth.uid())
       OR EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = (select auth.uid()) AND f.following_id = p.id)
     )
   LIMIT 1
$$;

-- Whether the reader may see this person's reproduction notes.
CREATE OR REPLACE FUNCTION public.profile_notes_shown(own boolean, follows boolean, notes_visible text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT own OR notes_visible = 'everyone' OR (notes_visible = 'followers' AND follows)
$$;

-- 6. get_profile_feed ----------------------------------------------------------------------------------------------------------
-- One page of a person's builds, topics, replies and reproduction notes, newest first: (kind, id, created_at, pinned_position).
-- Pins lead the FIRST page only (p_cursor null), in their order, and never repeat in the newest-first rows. The next page's cursor
-- is the created_at of the last row whose pinned_position is null. Published builds only, never drafts; a topic or reply hidden by
-- its space (hidden_by) or by the site (the read policy) is absent; notes follow notes_visible; saves are never read.

CREATE OR REPLACE FUNCTION public.get_profile_feed(
  p_username text,
  p_filter   text        DEFAULT 'all',
  p_cursor   timestamptz DEFAULT NULL,
  p_limit    int         DEFAULT 20
)
RETURNS TABLE (kind text, id uuid, created_at timestamptz, pinned_position int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH who AS (SELECT * FROM public.profile_reader_view(p_username)),
  bounds AS (
    SELECT least(greatest(coalesce(p_limit, 20), 1), 50) AS n,
           coalesce(p_cursor, 'infinity'::timestamptz)   AS before,
           coalesce(p_filter, 'all')                     AS f
  ),
  pins AS (
    SELECT pp.item_kind, pp.item_id, pp.position
      FROM public.profile_pins pp JOIN who ON pp.user_id = who.user_id
  ),
  everything AS (
    (SELECT 'build'::text AS kind, b.id, b.published_at AS created_at
       FROM who, bounds, public.builds b
      WHERE bounds.f IN ('all', 'builds')
        AND b.creator_id = who.user_id AND b.status IN ('published', 'gallery') AND b.published_at IS NOT NULL
        AND b.published_at < bounds.before
        AND NOT EXISTS (SELECT 1 FROM pins WHERE pins.item_kind = 'build' AND pins.item_id = b.id)
      ORDER BY b.published_at DESC LIMIT (SELECT n FROM bounds))
    UNION ALL
    (SELECT 'topic'::text, p.id, p.created_at
       FROM who, bounds, public.openbuild_posts p
      WHERE bounds.f IN ('all', 'topics')
        AND p.author_id = who.user_id AND p.parent_id IS NULL AND p.hidden_by IS NULL AND p.created_at < bounds.before
        AND NOT EXISTS (SELECT 1 FROM pins WHERE pins.item_kind = 'topic' AND pins.item_id = p.id)
      ORDER BY p.created_at DESC LIMIT (SELECT n FROM bounds))
    UNION ALL
    (SELECT 'reply'::text, p.id, p.created_at
       FROM who, bounds, public.openbuild_posts p
      WHERE bounds.f IN ('all', 'replies')
        AND p.author_id = who.user_id AND p.parent_id IS NOT NULL AND p.hidden_by IS NULL AND p.created_at < bounds.before
        AND EXISTS (SELECT 1 FROM public.openbuild_posts root WHERE root.id = p.root_id AND root.hidden_by IS NULL)
        AND NOT EXISTS (SELECT 1 FROM pins WHERE pins.item_kind = 'reply' AND pins.item_id = p.id)
      ORDER BY p.created_at DESC LIMIT (SELECT n FROM bounds))
    UNION ALL
    (SELECT 'repro_note'::text, r.id, r.confirmed_at
       FROM who, bounds, public.build_reproductions r
      WHERE bounds.f IN ('all', 'notes')
        AND public.profile_notes_shown(who.own, who.follows, who.notes_visible)
        AND r.user_id = who.user_id AND r.note IS NOT NULL AND btrim(r.note) <> '' AND r.confirmed_at < bounds.before
        AND EXISTS (SELECT 1 FROM public.builds b WHERE b.id = r.build_id AND b.status IN ('published', 'gallery') AND b.creator_id <> r.user_id)
        AND NOT EXISTS (SELECT 1 FROM pins WHERE pins.item_kind = 'repro_note' AND pins.item_id = r.id)
      ORDER BY r.confirmed_at DESC LIMIT (SELECT n FROM bounds))
  ),
  page AS (
    SELECT e.kind, e.id, e.created_at, NULL::int AS pinned_position
      FROM everything e ORDER BY e.created_at DESC LIMIT (SELECT n FROM bounds)
  ),
  pinned AS (
    SELECT x.kind, x.id, x.created_at, x.position AS pinned_position
      FROM bounds, (
        SELECT 'build'::text AS kind, b.id, b.published_at AS created_at, pins.position
          FROM pins JOIN public.builds b ON pins.item_kind = 'build' AND b.id = pins.item_id
         WHERE b.status IN ('published', 'gallery') AND b.published_at IS NOT NULL
        UNION ALL
        SELECT 'topic', p.id, p.created_at, pins.position
          FROM pins JOIN public.openbuild_posts p ON pins.item_kind = 'topic' AND p.id = pins.item_id
         WHERE p.parent_id IS NULL AND p.hidden_by IS NULL
        UNION ALL
        SELECT 'reply', p.id, p.created_at, pins.position
          FROM pins JOIN public.openbuild_posts p ON pins.item_kind = 'reply' AND p.id = pins.item_id
         WHERE p.parent_id IS NOT NULL AND p.hidden_by IS NULL
           AND EXISTS (SELECT 1 FROM public.openbuild_posts root WHERE root.id = p.root_id AND root.hidden_by IS NULL)
        UNION ALL
        SELECT 'repro_note', r.id, r.confirmed_at, pins.position
          FROM who, pins JOIN public.build_reproductions r ON pins.item_kind = 'repro_note' AND r.id = pins.item_id
         WHERE public.profile_notes_shown(who.own, who.follows, who.notes_visible)
           AND r.note IS NOT NULL AND btrim(r.note) <> ''
           AND EXISTS (SELECT 1 FROM public.builds b WHERE b.id = r.build_id AND b.status IN ('published', 'gallery'))
      ) x
     WHERE p_cursor IS NULL
       AND (bounds.f = 'all'
            OR (bounds.f = 'builds' AND x.kind = 'build') OR (bounds.f = 'topics' AND x.kind = 'topic')
            OR (bounds.f = 'replies' AND x.kind = 'reply') OR (bounds.f = 'notes' AND x.kind = 'repro_note'))
  )
  SELECT kind, id, created_at, pinned_position FROM pinned
  UNION ALL
  SELECT kind, id, created_at, pinned_position FROM page
  ORDER BY pinned_position NULLS LAST, created_at DESC
$$;

-- 7. A visitor's level, as the owner's setting allows ----------------------------------------------------------------------------
-- user_progress is readable by its owner only, so this is SECURITY DEFINER. It answers one number, the level, and only when the
-- owner's level_visible is 'everyone' or the caller is the owner; otherwise null. It reads nothing else and writes nothing.

CREATE OR REPLACE FUNCTION public.profile_level_of(p_user uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT up.level
    FROM public.profiles p
    JOIN public.user_progress up ON up.user_id = p.id
   WHERE p.id = p_user
     AND (p.id = (select auth.uid()) OR coalesce(p.profile_settings->>'level_visible', 'everyone') = 'everyone')
   LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.profile_level_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_level_of(uuid) TO anon, authenticated;

-- 8. get_profile_side ----------------------------------------------------------------------------------------------------------
-- The side column and the record line in one request, as one jsonb: what the feed has of each kind (the filter hides an empty
-- option), the record line's counts, the level the owner allows, Works in, the spaces, and What others did with it. Every count is
-- what the reader may see (SECURITY INVOKER), so steps in other people's drafts the reader cannot open are not counted.

CREATE OR REPLACE FUNCTION public.get_profile_side(p_username text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH who AS (SELECT * FROM public.profile_reader_view(p_username)),
  mine AS (
    SELECT b.id, b.made_with FROM who, public.builds b
     WHERE b.creator_id = who.user_id AND b.status IN ('published', 'gallery') AND b.published_at IS NOT NULL
     LIMIT 1000
  )
  SELECT jsonb_build_object(
    'builds',   (SELECT count(*) FROM mine),
    'topics',   (SELECT count(*) FROM who, public.openbuild_posts p WHERE p.author_id = who.user_id AND p.parent_id IS NULL AND p.hidden_by IS NULL),
    'replies',  (SELECT count(*) FROM who, public.openbuild_posts p WHERE p.author_id = who.user_id AND p.parent_id IS NOT NULL AND p.hidden_by IS NULL),
    'notes',    (SELECT count(*) FROM who, public.build_reproductions r
                  WHERE public.profile_notes_shown(who.own, who.follows, who.notes_visible)
                    AND r.user_id = who.user_id AND r.note IS NOT NULL AND btrim(r.note) <> ''
                    AND EXISTS (SELECT 1 FROM public.builds b WHERE b.id = r.build_id AND b.status IN ('published', 'gallery') AND b.creator_id <> r.user_id)),
    'reproduced_by_others', (SELECT count(*) FROM who, mine JOIN public.build_reproductions r ON r.build_id = mine.id
                              WHERE r.user_id <> who.user_id AND r.worked),
    'rebuilt_from', (SELECT count(*) FROM who, mine JOIN public.builds c ON c.parent_build_id = mine.id
                      WHERE c.creator_id <> who.user_id AND c.status IN ('published', 'gallery')),
    'first_rebuild_slug', (SELECT c.slug FROM who, mine JOIN public.builds c ON c.parent_build_id = mine.id
                            WHERE c.creator_id <> who.user_id AND c.status IN ('published', 'gallery') AND c.published_at IS NOT NULL
                            ORDER BY c.published_at ASC LIMIT 1),
    'steps_added', (SELECT count(DISTINCT n.build_id) FROM who, public.build_nodes n JOIN public.builds b ON b.id = n.build_id
                     WHERE n.contributor_id = who.user_id AND b.creator_id <> who.user_id),
    'topics_started', (SELECT count(DISTINCT a.post_id) FROM who, mine JOIN public.post_attachments a ON a.build_id = mine.id
                        JOIN public.openbuild_posts p ON p.id = a.post_id
                        WHERE p.parent_id IS NULL AND p.hidden_by IS NULL AND p.author_id <> who.user_id),
    'level', (SELECT public.profile_level_of(who.user_id) FROM who),
    'works_in', coalesce((SELECT jsonb_agg(t.tool ORDER BY t.uses DESC, t.tool) FROM (
                   SELECT tool, count(*) AS uses FROM mine, unnest(coalesce(mine.made_with, '{}')) AS u(tool)
                   WHERE btrim(tool) <> '' GROUP BY tool ORDER BY count(*) DESC, tool LIMIT 5) t), '[]'::jsonb),
    'spaces', coalesce((SELECT jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name,
                  'standing', CASE WHEN s.creator_id = who.user_id THEN 'created' WHEN m.role = 'moderator' THEN 'moderator' ELSE 'member' END)
                  ORDER BY (s.creator_id = who.user_id) DESC, (m.role = 'moderator') DESC, m.created_at DESC)
                FROM who, public.space_members m JOIN public.spaces s ON s.id = m.space_id
               WHERE m.user_id = who.user_id AND NOT m.invited), '[]'::jsonb)
  )
  FROM who
$$;

-- 9. list_profile_follows ------------------------------------------------------------------------------------------------------
-- A person's followers ('followers') or the people they follow ('following'), newest first, 30 a page, each with whether the
-- reader follows them: one request per page. A private profile the reader does not follow lists nobody.

CREATE OR REPLACE FUNCTION public.list_profile_follows(
  p_username text,
  p_which    text,
  p_cursor   timestamptz DEFAULT NULL,
  p_limit    int         DEFAULT 30
)
RETURNS TABLE (user_id uuid, username text, display_name text, avatar_url text, bio text, followed_at timestamptz, reader_follows boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH who AS (SELECT * FROM public.profile_reader_view(p_username)),
  edges AS (
    SELECT CASE WHEN p_which = 'following' THEN f.following_id ELSE f.follower_id END AS person, f.created_at
      FROM who, public.follows f
     WHERE p_which IN ('followers', 'following')
       AND ((p_which = 'followers' AND f.following_id = who.user_id) OR (p_which = 'following' AND f.follower_id = who.user_id))
       AND f.created_at < coalesce(p_cursor, 'infinity'::timestamptz)
     ORDER BY f.created_at DESC
     LIMIT least(greatest(coalesce(p_limit, 30), 1), 50)
  )
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.bio, e.created_at,
         EXISTS (SELECT 1 FROM public.follows r WHERE r.follower_id = (select auth.uid()) AND r.following_id = p.id)
    FROM edges e JOIN public.profiles p ON p.id = e.person
   ORDER BY e.created_at DESC
$$;

-- 10. save_profile --------------------------------------------------------------------------------------------------------------
-- Customise profile's Save: every field and the pins' order, in one request and one transaction. SECURITY INVOKER: it writes the
-- caller's own profile row and pins through their policies, and the checks above refuse anything out of bounds.
-- p: {display_name, bio, location, links, about, profile_settings, pins: [{kind, id}]}. A key left out is left as it is.

CREATE OR REPLACE FUNCTION public.save_profile(p jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  me uuid := (select auth.uid());
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Sign in to change your profile.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.profiles SET
    display_name     = CASE WHEN p ? 'display_name' THEN nullif(btrim(p->>'display_name'), '') ELSE display_name END,
    bio              = CASE WHEN p ? 'bio' THEN nullif(btrim(p->>'bio'), '') ELSE bio END,
    location         = CASE WHEN p ? 'location' THEN nullif(btrim(p->>'location'), '') ELSE location END,
    about            = CASE WHEN p ? 'about' THEN nullif(p->>'about', '') ELSE about END,
    links            = CASE WHEN p ? 'links' THEN ARRAY(SELECT jsonb_array_elements_text(p->'links')) ELSE links END,
    profile_settings = CASE WHEN p ? 'profile_settings' THEN p->'profile_settings' ELSE profile_settings END
  WHERE id = me;

  IF p ? 'pins' THEN
    DELETE FROM public.profile_pins WHERE user_id = me;
    INSERT INTO public.profile_pins (user_id, item_kind, item_id, position)
    SELECT me, e.v->>'kind', (e.v->>'id')::uuid, e.n::int
      FROM jsonb_array_elements(p->'pins') WITH ORDINALITY AS e(v, n);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_profile(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_feed(text, text, timestamptz, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_side(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_profile_follows(text, text, timestamptz, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_reader_view(text) TO anon, authenticated;