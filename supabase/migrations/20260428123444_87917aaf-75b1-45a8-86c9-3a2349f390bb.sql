ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS use_case TEXT,
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS prerequisites TEXT,
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS estimated_reading_minutes INT,
  ADD COLUMN IF NOT EXISTS bounty_reward_type TEXT,
  ADD COLUMN IF NOT EXISTS bounty_reward_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS bounty_acceptance_criteria TEXT,
  ADD COLUMN IF NOT EXISTS bounty_status TEXT,
  ADD COLUMN IF NOT EXISTS blog_topic_category TEXT,
  ADD COLUMN IF NOT EXISTS blog_referenced_post_ids UUID[];

ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_domain_check
  CHECK (domain IS NULL OR domain IN ('academic','finance','marketing','engineering','creative','productivity','research','other'));

ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_bounty_reward_type_check
  CHECK (bounty_reward_type IS NULL OR bounty_reward_type IN ('none','kudos','cash','token'));

ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_bounty_status_check2
  CHECK (bounty_status IS NULL OR bounty_status IN ('open','closed','solved'));

CREATE INDEX IF NOT EXISTS idx_content_items_tags ON public.content_items USING GIN (tags);