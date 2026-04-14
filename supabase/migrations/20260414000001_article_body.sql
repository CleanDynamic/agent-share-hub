-- Article body (TipTap JSON document)
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS article_body JSONB;

-- Track whether a post uses the article editor
-- or the legacy canvas-only mode
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS editor_mode
    TEXT DEFAULT 'canvas'
    CHECK (editor_mode IN ('canvas', 'article'));

-- Stage grids embedded in the article
-- Each stage_grid links to a canvas_stages row
-- and stores its article position (node index)
CREATE TABLE IF NOT EXISTS article_stage_grids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL
    REFERENCES content_items(id) ON DELETE CASCADE,
  stage_id UUID
    REFERENCES canvas_stages(id) ON DELETE CASCADE,
  article_node_index INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT 'Stage',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE article_stage_grids
  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read article_stage_grids"
  ON article_stage_grids FOR SELECT USING (true);
CREATE POLICY "Creator manages article_stage_grids"
  ON article_stage_grids FOR ALL
  USING (
    content_id IN (
      SELECT id FROM content_items
      WHERE creator_id = auth.uid()
    )
  );
