CREATE OR REPLACE FUNCTION public.expire_import_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _expired INTEGER;
BEGIN
  UPDATE public.import_sessions
  SET status     = 'expired',
      updated_at = now()
  WHERE expires_at < now()
    AND status IN ('open', 'assembling');

  GET DIAGNOSTICS _expired = ROW_COUNT;
  RETURN _expired;
END
$$;

COMMENT ON FUNCTION public.expire_import_sessions() IS
  'Nightly sweep: flips public.import_sessions past expires_at from open/assembling to expired. A parsed session is never swept. Status only — it touches no storage. Returns the number of rows flipped.';

REVOKE ALL ON FUNCTION public.expire_import_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_import_sessions() FROM anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.build_sessions (
  build_id    UUID        NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  session_key TEXT        NOT NULL,
  import_id   UUID        NULL REFERENCES public.import_sessions(id) ON DELETE SET NULL,
  position    INTEGER     NOT NULL,
  collapsed   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (build_id, session_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS build_sessions_build_position_key
  ON public.build_sessions (build_id, position);

CREATE INDEX IF NOT EXISTS build_sessions_import_id_idx
  ON public.build_sessions (import_id)
  WHERE import_id IS NOT NULL;

ALTER TABLE public.build_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Build sessions follow build readability" ON public.build_sessions;
CREATE POLICY "Build sessions follow build readability"
  ON public.build_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_sessions.build_id
        AND (
          b.status <> 'draft'
          OR b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "Build sessions follow build writability on insert" ON public.build_sessions;
CREATE POLICY "Build sessions follow build writability on insert"
  ON public.build_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_sessions.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "Build sessions follow build writability on update" ON public.build_sessions;
CREATE POLICY "Build sessions follow build writability on update"
  ON public.build_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_sessions.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_sessions.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "Build sessions follow build writability on delete" ON public.build_sessions;
CREATE POLICY "Build sessions follow build writability on delete"
  ON public.build_sessions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_sessions.build_id
        AND (
          b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

GRANT SELECT ON public.build_sessions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.build_sessions TO authenticated;

COMMENT ON TABLE public.build_sessions IS
  'The sessions in a draft, in the maker''s order. One import can be in any number of drafts; each draft has its own copy of the tiles.';

WITH src AS (
  SELECT i.build_id,
         i.id::text AS session_key,
         i.id       AS import_id,
         i.created_at AS sort_at
  FROM public.import_sessions i
  JOIN public.builds b ON b.id = i.build_id
  WHERE i.status = 'claimed'
    AND i.build_id IS NOT NULL
  UNION ALL
  SELECT b.id,
         m.key,
         NULL::uuid,
         CASE
           WHEN jsonb_typeof(m.value) = 'object' AND (m.value ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$'
             THEN ((m.value ->> 'date')::date)::timestamptz
           ELSE b.created_at
         END
  FROM public.builds b
  CROSS JOIN LATERAL jsonb_each(
    CASE WHEN jsonb_typeof(b.making -> 'sessions_meta') = 'object' THEN b.making -> 'sessions_meta' ELSE '{}'::jsonb END
  ) AS m(key, value)
  WHERE m.key LIKE 'typed-%'
    AND m.key NOT LIKE 'typed-legacy-%'
),
placed AS (
  SELECT s.*,
         (
           SELECT min(n.position)
           FROM public.build_nodes n
           WHERE n.build_id = s.build_id
             AND n.parent_id IS NULL
             AND n.position IS NOT NULL
             AND coalesce(n.payload ->> 'session', n.source_ref ->> 'import_session_id') = s.session_key
         ) AS first_position
  FROM src s
),
ordered AS (
  SELECT p.build_id,
         p.session_key,
         p.import_id,
         (row_number() OVER (
            PARTITION BY p.build_id
            ORDER BY p.first_position NULLS LAST, p.sort_at, p.session_key
          ) - 1)::integer AS position
  FROM placed p
)
INSERT INTO public.build_sessions (build_id, session_key, import_id, position)
SELECT o.build_id, o.session_key, o.import_id, o.position
FROM ordered o
ON CONFLICT DO NOTHING;