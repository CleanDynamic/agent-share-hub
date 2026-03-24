-- RESTRUCTURE: post_category + is_project columns
-- post_category: top-level category 'blog' | 'blueprint' | 'bounty'
-- is_project: true when submitted with the Project toggle ON

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS post_category text DEFAULT 'blueprint',
  ADD COLUMN IF NOT EXISTS is_project boolean DEFAULT false;

-- Migrate existing Blog posts
UPDATE content_items
SET post_category = 'blog'
WHERE content_type = 'Blog';

-- Migrate existing Failure Library posts → Bounty category
UPDATE content_items
SET post_category = 'bounty',
    bounty_enabled = true,
    bounty_status = COALESCE(bounty_status, 'open')
WHERE content_type = 'Failure Library';
