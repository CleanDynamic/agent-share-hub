-- 20260827130000_node_type_help_copy.sql
WITH help_copy (type_key, field_key, help) AS (
  VALUES
    ('prompt',        'text',          'Paste exactly what you typed into the AI.'),
    ('system_prompt', 'text',          'The instructions the AI was given before you said anything to it.'),
    ('model_params',  'model',         'Which AI you used — the name the app showed you.'),
    ('agent_config',  'system_prompt', 'The standing instructions this agent works from, before anyone talks to it.'),
    ('agent_config',  'model',         'Which AI does the thinking for this agent.'),
    ('code',          'source',        'Paste the code itself, exactly as it runs.'),
    ('result',        'summary',       'What happened? One or two sentences.'),
    ('screenshot',    'media_id',      'Upload the picture you want people to see.'),
    ('recording',     'media_id',      'Upload the recording — screen, video or audio.'),
    ('note',          'body',          'Whatever you want to say here, in your own words.'),
    ('decision',      'decision',      'What you chose to do.'),
    ('breakage',      'symptom',       'What went wrong, in your words.'),
    ('gap',           'problem',       'What you are stuck on, said plainly.')
)
UPDATE public.node_types AS nt
SET schema = jsonb_set(
  nt.schema,
  '{fields}',
  (
    SELECT jsonb_agg(
             CASE
               WHEN h.help IS NULL THEN f.field
               ELSE jsonb_set(f.field, '{help}', to_jsonb(h.help))
             END
             ORDER BY f.ord
           )
    FROM jsonb_array_elements(nt.schema -> 'fields') WITH ORDINALITY AS f(field, ord)
    LEFT JOIN help_copy AS h
      ON h.type_key = nt.key
     AND h.field_key = f.field ->> 'key'
  )
)
WHERE nt.key IN (
  SELECT DISTINCT type_key FROM help_copy
)
AND jsonb_typeof(nt.schema -> 'fields') = 'array';

DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(format('%s.%s', t.key, expected.field_key), ', ')
  INTO missing
  FROM (
    VALUES
      ('prompt', 'text'), ('system_prompt', 'text'),
      ('model_params', 'model'), ('agent_config', 'system_prompt'), ('agent_config', 'model'),
      ('code', 'source'),
      ('result', 'summary'), ('screenshot', 'media_id'), ('recording', 'media_id'),
      ('note', 'body'), ('decision', 'decision'), ('breakage', 'symptom'), ('gap', 'problem')
  ) AS expected(type_key, field_key)
  JOIN public.node_types AS t ON t.key = expected.type_key
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(t.schema -> 'fields') AS f(field)
    WHERE f.field ->> 'key' = expected.field_key
      AND (f.field -> 'required')::boolean IS TRUE
      AND length(coalesce(f.field ->> 'help', '')) > 0
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'NS-P30: help copy did not land on required fields: %', missing;
  END IF;
END
$$;

-- 20260828120000_build_feed_function.sql
CREATE INDEX idx_builds_feed_published
  ON public.builds (published_at DESC)
  WHERE status IN ('published', 'gallery')
    AND published_at IS NOT NULL
    AND parent_build_id IS NULL;

CREATE INDEX idx_builds_feed_rebuilt
  ON public.builds (published_at DESC)
  WHERE status IN ('published', 'gallery')
    AND published_at IS NOT NULL
    AND parent_build_id IS NOT NULL;

CREATE INDEX idx_build_reproductions_noted
  ON public.build_reproductions (confirmed_at DESC)
  WHERE note IS NOT NULL AND btrim(note) <> '';

CREATE OR REPLACE FUNCTION public.get_build_feed(
  before    TIMESTAMPTZ DEFAULT now(),
  page_size INT DEFAULT 20
)
RETURNS TABLE (
  item_kind             TEXT,
  item_at               TIMESTAMPTZ,
  build_id              UUID,
  slug                  TEXT,
  title                 TEXT,
  outcome               TEXT,
  shape                 TEXT,
  cover_media_id        UUID,
  creator_id            UUID,
  creator_username      TEXT,
  creator_display       TEXT,
  creator_avatar        TEXT,
  reproduction_count    INT,
  rebuild_count         INT,
  parent_build_id       UUID,
  source_title_at_fork  TEXT,
  source_handle_at_fork TEXT,
  rebuild_note          TEXT,
  repro_note            TEXT,
  repro_model           TEXT,
  repro_user_username   TEXT,
  status                TEXT,
  made_for              TEXT[],
  last_confirmed_at     TIMESTAMPTZ,
  last_confirmed_model  TEXT,
  cover_bucket          TEXT,
  cover_path            TEXT,
  cover_kind            TEXT,
  cover_poster_path     TEXT,
  repro_worked          BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH bounds AS (
    SELECT LEAST(GREATEST(COALESCE(get_build_feed.page_size, 20), 1), 50) AS n
  ),
  page AS MATERIALIZED (
    SELECT
      u.item_kind,
      u.item_at,
      u.build_id,
      u.repro_note,
      u.repro_model,
      u.repro_user_id,
      u.repro_worked
    FROM (
      (
        SELECT
          'build'::TEXT   AS item_kind,
          b.published_at  AS item_at,
          b.id            AS build_id,
          NULL::TEXT      AS repro_note,
          NULL::TEXT      AS repro_model,
          NULL::UUID      AS repro_user_id,
          NULL::BOOLEAN   AS repro_worked
        FROM public.builds b
        WHERE b.status IN ('published', 'gallery')
          AND b.published_at IS NOT NULL
          AND b.parent_build_id IS NULL
          AND b.published_at < get_build_feed.before
        ORDER BY b.published_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )
      UNION ALL
      (
        SELECT
          'rebuild'::TEXT AS item_kind,
          b.published_at  AS item_at,
          b.id            AS build_id,
          NULL::TEXT      AS repro_note,
          NULL::TEXT      AS repro_model,
          NULL::UUID      AS repro_user_id,
          NULL::BOOLEAN   AS repro_worked
        FROM public.builds b
        WHERE b.status IN ('published', 'gallery')
          AND b.published_at IS NOT NULL
          AND b.parent_build_id IS NOT NULL
          AND b.published_at < get_build_feed.before
        ORDER BY b.published_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )
      UNION ALL
      (
        SELECT
          'repro_note'::TEXT AS item_kind,
          r.confirmed_at     AS item_at,
          r.build_id         AS build_id,
          r.note             AS repro_note,
          r.model_used       AS repro_model,
          r.user_id          AS repro_user_id,
          r.worked           AS repro_worked
        FROM public.build_reproductions r
        WHERE r.note IS NOT NULL
          AND btrim(r.note) <> ''
          AND r.confirmed_at < get_build_feed.before
          AND EXISTS (
            SELECT 1
            FROM public.builds b
            WHERE b.id = r.build_id
              AND b.status IN ('published', 'gallery')
          )
        ORDER BY r.confirmed_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )
    ) u
    ORDER BY u.item_at DESC
    LIMIT (SELECT bounds.n FROM bounds)
  )
  SELECT
    page.item_kind,
    page.item_at,
    page.build_id,
    b.slug,
    b.title,
    b.outcome,
    b.shape,
    b.cover_media_id,
    b.creator_id,
    p.username     AS creator_username,
    p.display_name AS creator_display,
    p.avatar_url   AS creator_avatar,
    b.reproduction_count,
    b.rebuild_count,
    b.parent_build_id,
    b.source_title_at_fork,
    b.source_handle_at_fork,
    b.rebuild_note,
    page.repro_note,
    page.repro_model,
    rp.username    AS repro_user_username,
    b.status,
    b.made_for,
    b.last_confirmed_at,
    b.last_confirmed_model,
    cm.bucket      AS cover_bucket,
    cm.path        AS cover_path,
    cm.kind        AS cover_kind,
    cm.poster_path AS cover_poster_path,
    page.repro_worked
  FROM page
  JOIN public.builds b
    ON b.id = page.build_id
  JOIN public.profiles p
    ON p.id = b.creator_id
  LEFT JOIN public.build_media cm
    ON cm.id = b.cover_media_id
  LEFT JOIN public.profiles rp
    ON rp.id = page.repro_user_id
  ORDER BY page.item_at DESC, page.build_id DESC, page.item_kind DESC;
$$;

COMMENT ON FUNCTION public.get_build_feed(TIMESTAMPTZ, INT) IS
  'The new-path home feed: published builds, rebuilds and noted reproductions as one ordered page, newest first, keyset-paged on item_at. SECURITY INVOKER — every row is one the caller could have read for themselves. Consumed by src/lib/feed/getBuildFeed.ts.';

GRANT EXECUTE ON FUNCTION public.get_build_feed(TIMESTAMPTZ, INT)
  TO anon, authenticated;