-- Canvas layout metadata on content_items
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS canvas_column_count
    INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS canvas_row_height
    INTEGER DEFAULT 32,
  ADD COLUMN IF NOT EXISTS canvas_layout_mode
    TEXT DEFAULT 'freeform',
  ADD COLUMN IF NOT EXISTS canvas_theme
    TEXT DEFAULT 'blueprint';

-- Canvas position on content_blocks
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS canvas_col
    INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS canvas_row
    INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS canvas_col_span
    INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS canvas_row_span
    INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stage_id TEXT,
  ADD COLUMN IF NOT EXISTS stage_index TEXT,
  ADD COLUMN IF NOT EXISTS is_locked
    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lock_type
    TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS mobile_order
    INTEGER,
  ADD COLUMN IF NOT EXISTS creator_annotation
    TEXT;

-- Canvas arrows
CREATE TABLE IF NOT EXISTS canvas_arrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL
    REFERENCES content_items(id) ON DELETE CASCADE,
  from_block_id TEXT NOT NULL,
  to_block_id TEXT NOT NULL,
  from_edge TEXT NOT NULL
    CHECK (from_edge IN ('top','right','bottom','left')),
  to_edge TEXT NOT NULL
    CHECK (to_edge IN ('top','right','bottom','left')),
  label TEXT,
  arrow_type TEXT DEFAULT 'produces',
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Canvas stages
CREATE TABLE IF NOT EXISTS canvas_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL
    REFERENCES content_items(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  estimated_minutes INTEGER,
  difficulty TEXT,
  block_ids JSONB DEFAULT '[]'::jsonb,
  colour TEXT DEFAULT 'rgba(232,87,26,0.06)',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(content_id, stage_number)
);

-- Canvas block versions (for version history)
CREATE TABLE IF NOT EXISTS canvas_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL
    REFERENCES content_items(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(content_id, version_number)
);

-- RLS policies
ALTER TABLE canvas_arrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read canvas_arrows"
  ON canvas_arrows FOR SELECT USING (true);
CREATE POLICY "Creator manages canvas_arrows"
  ON canvas_arrows FOR ALL
  USING (
    content_id IN (
      SELECT id FROM content_items
      WHERE creator_id = auth.uid()
    )
  );

CREATE POLICY "Public read canvas_stages"
  ON canvas_stages FOR SELECT USING (true);
CREATE POLICY "Creator manages canvas_stages"
  ON canvas_stages FOR ALL
  USING (
    content_id IN (
      SELECT id FROM content_items
      WHERE creator_id = auth.uid()
    )
  );

CREATE POLICY "Creator manages canvas_versions"
  ON canvas_versions FOR ALL
  USING (
    content_id IN (
      SELECT id FROM content_items
      WHERE creator_id = auth.uid()
    )
  );
