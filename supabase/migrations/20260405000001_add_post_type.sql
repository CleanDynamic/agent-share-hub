ALTER TABLE content_items
ADD COLUMN IF NOT EXISTS post_type TEXT
  CHECK (post_type IN ('build','technique','discovery','discussion'));

UPDATE content_items SET post_type = 'build'
  WHERE content_type IN (
    'Agent Blueprint','Agent Stack','Workflow Template',
    'AI Agent Install Guide','Integration Guide',
    'Model Config Guide','AI Tools (LLMs)','Prompt File',
    'Prompt(s)','Agent(s)','Install Guide'
  );

UPDATE content_items SET post_type = 'technique'
  WHERE content_type IN (
    'Evaluation Framework','Failure Library'
  );

UPDATE content_items SET post_type = 'discussion'
  WHERE content_type IN (
    'Open Question','Challenge','Blog'
  );

UPDATE content_items SET post_type = 'discovery'
  WHERE content_type IS NULL OR post_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_post_type
  ON content_items(post_type);
