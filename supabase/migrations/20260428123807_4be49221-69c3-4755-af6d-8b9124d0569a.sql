ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS block_types_used TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS models_referenced TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tools_referenced TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stage_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS block_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS connection_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS word_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_metadata_recompute_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_content_items_block_types
  ON public.content_items USING GIN (block_types_used);

CREATE INDEX IF NOT EXISTS idx_content_items_models
  ON public.content_items USING GIN (models_referenced);

CREATE INDEX IF NOT EXISTS idx_content_items_tools
  ON public.content_items USING GIN (tools_referenced);