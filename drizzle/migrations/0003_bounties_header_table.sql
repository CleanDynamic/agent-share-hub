CREATE TABLE public.bounties (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id             UUID NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  gap_node_id          UUID NULL REFERENCES public.build_nodes(id) ON DELETE CASCADE,
  legacy_item_id       UUID NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  author_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'open',
  reward_gbp           NUMERIC NULL,
  closes_at            TIMESTAMPTZ NULL,
  is_meta              BOOLEAN NOT NULL DEFAULT false,
  meta_parent_id       UUID NULL REFERENCES public.bounties(id) ON DELETE SET NULL,
  accepted_solution_id UUID NULL,
  me_too_count         INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  solved_at            TIMESTAMPTZ NULL,
  CONSTRAINT bounties_status_check CHECK (
    status IN ('open', 'solved', 'closed', 'expired')
  ),
  CONSTRAINT bounties_one_home CHECK (
    (build_id IS NOT NULL AND legacy_item_id IS NULL)
    OR (build_id IS NULL AND legacy_item_id IS NOT NULL)
  ),
  CONSTRAINT bounties_gap_needs_build CHECK (
    gap_node_id IS NULL OR build_id IS NOT NULL
  )
);

COMMENT ON TABLE public.bounties IS
  'One row per bounty: the header for a gap in a build, or for a legacy content_items bounty. Exactly one home per row (bounties_one_home).';

GRANT SELECT, INSERT, UPDATE ON public.bounties TO authenticated;
GRANT SELECT ON public.bounties TO anon;
GRANT ALL ON public.bounties TO service_role;

CREATE UNIQUE INDEX idx_bounties_gap_unique
  ON public.bounties (build_id, gap_node_id)
  WHERE gap_node_id IS NOT NULL;

CREATE UNIQUE INDEX idx_bounties_legacy_item_unique
  ON public.bounties (legacy_item_id)
  WHERE legacy_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assert_bounty_gap_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.gap_node_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.build_nodes n
    WHERE n.id = NEW.gap_node_id
      AND n.build_id = NEW.build_id
      AND n.is_gap
  ) THEN
    RAISE EXCEPTION
      'bounties.gap_node_id % is not a gap node of build %', NEW.gap_node_id, NEW.build_id
      USING ERRCODE = 'check_violation',
            HINT = 'The node must belong to build_id and have is_gap = true.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assert_bounty_gap_node()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_bounties_gap_node_valid
BEFORE INSERT OR UPDATE ON public.bounties
FOR EACH ROW
WHEN (NEW.gap_node_id IS NOT NULL)
EXECUTE FUNCTION public.assert_bounty_gap_node();

ALTER TABLE public.bounties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bounties are readable when their home is"
  ON public.bounties FOR SELECT
  USING (
    (
      bounties.build_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.builds b
        WHERE b.id = bounties.build_id
          AND (
            b.status <> 'draft'
            OR b.creator_id = (select auth.uid())
            OR public.is_admin((select auth.uid()))
          )
      )
    )
    OR (
      bounties.legacy_item_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.content_items ci
        WHERE ci.id = bounties.legacy_item_id
          AND (
            ci.status = 'approved'
            OR ci.creator_id = (select auth.uid())
            OR public.is_admin((select auth.uid()))
          )
      )
    )
  );

CREATE POLICY "Authors and admins create bounties on their own work"
  ON public.bounties FOR INSERT TO authenticated
  WITH CHECK (
    (
      author_id = (select auth.uid())
      OR public.is_admin((select auth.uid()))
    )
    AND (
      public.is_admin((select auth.uid()))
      OR (
        build_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.builds b
          WHERE b.id = build_id
            AND b.creator_id = (select auth.uid())
        )
      )
      OR (
        legacy_item_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.content_items ci
          WHERE ci.id = legacy_item_id
            AND ci.creator_id = (select auth.uid())
        )
      )
    )
  );

CREATE POLICY "Authors and admins update their bounties"
  ON public.bounties FOR UPDATE TO authenticated
  USING (
    author_id = (select auth.uid())
    OR public.is_admin((select auth.uid()))
  )
  WITH CHECK (
    (
      author_id = (select auth.uid())
      OR public.is_admin((select auth.uid()))
    )
    AND (
      public.is_admin((select auth.uid()))
      OR (
        build_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.builds b
          WHERE b.id = build_id
            AND b.creator_id = (select auth.uid())
        )
      )
      OR (
        legacy_item_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.content_items ci
          WHERE ci.id = legacy_item_id
            AND ci.creator_id = (select auth.uid())
        )
      )
    )
  );

CREATE INDEX idx_bounties_status_closes
  ON public.bounties (status, closes_at);
CREATE INDEX idx_bounties_build
  ON public.bounties (build_id)
  WHERE build_id IS NOT NULL;
CREATE INDEX idx_bounties_meta_parent
  ON public.bounties (meta_parent_id)
  WHERE meta_parent_id IS NOT NULL;
CREATE INDEX idx_bounties_author
  ON public.bounties (author_id);
CREATE INDEX idx_bounties_gap_node
  ON public.bounties (gap_node_id)
  WHERE gap_node_id IS NOT NULL;

INSERT INTO public.bounties (
  legacy_item_id,
  author_id,
  status,
  reward_gbp,
  closes_at,
  is_meta,
  me_too_count,
  created_at
)
SELECT
  ci.id,
  ci.creator_id,
  CASE lower(COALESCE(ci.bounty_status, ''))
    WHEN 'open'    THEN 'open'
    WHEN 'solved'  THEN 'solved'
    WHEN 'closed'  THEN 'closed'
    WHEN 'expired' THEN 'expired'
    ELSE 'open'
  END,
  COALESCE(
    (to_jsonb(ci) ->> 'bounty_tip_gbp')::NUMERIC,
    CASE
      WHEN COALESCE(ci.bounty_reward_type, 'cash') = 'cash'
       AND COALESCE(ci.bounty_reward_currency, 'GBP') = 'GBP'
      THEN ci.bounty_reward_amount
    END
  ),
  COALESCE(
    (to_jsonb(ci) ->> 'bounty_closes_at')::TIMESTAMPTZ,
    ci.bounty_deadline
  ),
  COALESCE(ci.bounty_is_meta, false),
  COALESCE((to_jsonb(ci) ->> 'bounty_me_too_count')::INTEGER, 0),
  ci.created_at
FROM public.content_items ci
WHERE ci.post_type = 'bounty'
  AND NOT EXISTS (
    SELECT 1 FROM public.bounties b WHERE b.legacy_item_id = ci.id
  );

UPDATE public.bounties b
SET meta_parent_id = parent.id
FROM public.content_items ci
JOIN public.bounties parent
  ON parent.legacy_item_id = ci.bounty_meta_parent_id
WHERE b.legacy_item_id = ci.id
  AND ci.bounty_meta_parent_id IS NOT NULL
  AND b.meta_parent_id IS DISTINCT FROM parent.id;

DO $$
DECLARE
  _legacy_bounties INTEGER;
  _headers         INTEGER;
BEGIN
  SELECT count(*) INTO _legacy_bounties
  FROM public.content_items WHERE post_type = 'bounty';
  SELECT count(*) INTO _headers
  FROM public.bounties WHERE legacy_item_id IS NOT NULL;
  IF _legacy_bounties <> _headers THEN
    RAISE EXCEPTION
      'NS-P45 backfill incomplete: % content_items bounties, % header rows',
      _legacy_bounties, _headers;
  END IF;
  RAISE NOTICE 'NS-P45: % legacy bounties backfilled into public.bounties', _headers;
END $$;