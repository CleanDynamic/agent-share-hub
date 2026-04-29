-- 1) New column for bounty reward currency (free-text so we can store fiat or token symbols)
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS bounty_reward_currency text;

-- 2) Server-side validation when a bounty transitions to 'approved'
CREATE OR REPLACE FUNCTION public.validate_bounty_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  missing_count integer := 0;
  stages_obj jsonb;
  blocks_obj jsonb;
  v jsonb;
BEGIN
  -- Only validate when transitioning to 'approved' on a bounty.
  IF NEW.post_type IS DISTINCT FROM 'bounty' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;
  -- Skip if it was already approved (re-saves shouldn't re-validate).
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    -- On first publish auto-fill bounty_status if NULL; afterwards leave alone.
    RETURN NEW;
  END IF;

  -- Reward type required.
  IF NEW.bounty_reward_type IS NULL OR length(trim(NEW.bounty_reward_type)) = 0 THEN
    RAISE EXCEPTION 'Bounty reward type is required'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Cash / token bounties need amount + currency.
  IF NEW.bounty_reward_type IN ('cash', 'token') THEN
    IF NEW.bounty_reward_amount IS NULL OR NEW.bounty_reward_amount <= 0 THEN
      RAISE EXCEPTION 'Bounty reward amount is required for % bounties', NEW.bounty_reward_type
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.bounty_reward_currency IS NULL OR length(trim(NEW.bounty_reward_currency)) = 0 THEN
      RAISE EXCEPTION 'Bounty reward currency is required for % bounties', NEW.bounty_reward_type
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Acceptance criteria minimum length.
  IF NEW.bounty_acceptance_criteria IS NULL
     OR length(trim(NEW.bounty_acceptance_criteria)) < 50 THEN
    RAISE EXCEPTION 'Bounty acceptance criteria must be at least 50 characters'
      USING ERRCODE = 'check_violation';
  END IF;

  -- At least one missing stage or block in stage_grids JSONB.
  stages_obj := COALESCE(NEW.stage_grids -> 'stages', '{}'::jsonb);
  blocks_obj := COALESCE(NEW.stage_grids -> 'blocks', '{}'::jsonb);

  IF jsonb_typeof(stages_obj) = 'object' THEN
    FOR v IN SELECT value FROM jsonb_each(stages_obj) LOOP
      IF (v ->> 'is_missing')::boolean IS TRUE THEN
        missing_count := missing_count + 1;
      END IF;
    END LOOP;
  END IF;

  IF jsonb_typeof(blocks_obj) = 'object' THEN
    FOR v IN SELECT value FROM jsonb_each(blocks_obj) LOOP
      IF (v ->> 'is_missing')::boolean IS TRUE THEN
        missing_count := missing_count + 1;
      END IF;
    END LOOP;
  END IF;

  IF missing_count = 0 THEN
    RAISE EXCEPTION 'A bounty must mark at least one stage or block as missing before publishing'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Default bounty_status on first publish.
  IF NEW.bounty_status IS NULL OR length(trim(NEW.bounty_status)) = 0 THEN
    NEW.bounty_status := 'open';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_bounty_publish_trigger ON public.content_items;

CREATE TRIGGER validate_bounty_publish_trigger
BEFORE INSERT OR UPDATE ON public.content_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_bounty_publish();