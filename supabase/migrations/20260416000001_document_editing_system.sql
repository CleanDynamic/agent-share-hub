-- Document editing system migration
-- Adds TipTap article body support on content_items plus new tables for
-- stages, blocks, block connections, versions, comments and references.
-- Leaves legacy canvas_stages and content_blocks untouched.

-- 1. Extend content_items with article body metadata
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS article_body JSONB,
  ADD COLUMN IF NOT EXISTS document_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- 2. stages
CREATE TABLE IF NOT EXISTS public.stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL
    REFERENCES public.content_items(id) ON DELETE CASCADE,
  order_in_document INTEGER NOT NULL DEFAULT 0,
  grid_spacing INTEGER NOT NULL DEFAULT 20,
  background_style TEXT NOT NULL DEFAULT 'dot'
    CHECK (background_style IN ('dot','line','solid')),
  width_mode TEXT NOT NULL DEFAULT 'wide'
    CHECK (width_mode IN ('narrow','wide','full')),
  height INTEGER NOT NULL DEFAULT 360,
  stage_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stages_content_item_id
  ON public.stages(content_item_id);

-- 3. blocks
CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL
    REFERENCES public.stages(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN (
      'text','heading','prompt','code','result','image','video',
      'agent','workflow','compare','tool','model','tutorial',
      'resource','note','quote'
    )),
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 200,
  height INTEGER NOT NULL DEFAULT 120,
  z_index INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocks_stage_id
  ON public.blocks(stage_id);

-- 4. block_connections
CREATE TABLE IF NOT EXISTS public.block_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_block_id UUID NOT NULL
    REFERENCES public.blocks(id) ON DELETE CASCADE,
  to_block_id UUID NOT NULL
    REFERENCES public.blocks(id) ON DELETE CASCADE,
  from_port TEXT NOT NULL
    CHECK (from_port IN ('top','right','bottom','left')),
  to_port TEXT NOT NULL
    CHECK (to_port IN ('top','right','bottom','left')),
  connection_type TEXT NOT NULL DEFAULT 'feeds_into'
    CHECK (connection_type IN (
      'feeds_into','alternative_to','depends_on',
      'contradicts','references','custom'
    )),
  label TEXT,
  carries_data BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_block_connections_from_block_id
  ON public.block_connections(from_block_id);
CREATE INDEX IF NOT EXISTS idx_block_connections_to_block_id
  ON public.block_connections(to_block_id);

-- 5. block_versions
CREATE TABLE IF NOT EXISTS public.block_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL
    REFERENCES public.blocks(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE(block_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_block_versions_block_id
  ON public.block_versions(block_id);
CREATE INDEX IF NOT EXISTS idx_block_versions_created_by
  ON public.block_versions(created_by);

-- 6. document_comments
CREATE TABLE IF NOT EXISTS public.document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL
    REFERENCES public.content_items(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('prose','block','stage','arrow')),
  target_id TEXT,
  prose_range JSONB,
  body TEXT NOT NULL,
  author_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_comments_content_item_id
  ON public.document_comments(content_item_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_author_id
  ON public.document_comments(author_id);

-- 7. block_references
CREATE TABLE IF NOT EXISTS public.block_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL
    REFERENCES public.content_items(id) ON DELETE CASCADE,
  block_id UUID NOT NULL
    REFERENCES public.blocks(id) ON DELETE CASCADE,
  prose_position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_block_references_content_item_id
  ON public.block_references(content_item_id);
CREATE INDEX IF NOT EXISTS idx_block_references_block_id
  ON public.block_references(block_id);

-- 8. Enable RLS
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_references ENABLE ROW LEVEL SECURITY;

-- 9. RLS policies mirror the content_items pattern:
--    Public SELECT when parent content is approved, creator sees their own,
--    admins see everything; creators manage their own.

-- stages
CREATE POLICY "View stages for approved or own content"
  ON public.stages FOR SELECT
  USING (
    content_item_id IN (
      SELECT id FROM public.content_items
      WHERE status = 'approved'
        OR creator_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Creators insert stages on own content"
  ON public.stages FOR INSERT
  TO authenticated
  WITH CHECK (
    content_item_id IN (
      SELECT id FROM public.content_items
      WHERE creator_id = auth.uid()
    )
  );

CREATE POLICY "Creators update stages on own content"
  ON public.stages FOR UPDATE
  TO authenticated
  USING (
    content_item_id IN (
      SELECT id FROM public.content_items
      WHERE creator_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Creators delete stages on own content"
  ON public.stages FOR DELETE
  TO authenticated
  USING (
    content_item_id IN (
      SELECT id FROM public.content_items
      WHERE creator_id = auth.uid()
    )
  );

-- blocks
CREATE POLICY "View blocks for approved or own content"
  ON public.blocks FOR SELECT
  USING (
    stage_id IN (
      SELECT s.id FROM public.stages s
      JOIN public.content_items c ON c.id = s.content_item_id
      WHERE c.status = 'approved'
        OR c.creator_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Creators insert blocks on own content"
  ON public.blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    stage_id IN (
      SELECT s.id FROM public.stages s
      JOIN public.content_items c ON c.id = s.content_item_id
      WHERE c.creator_id = auth.uid()
    )
  );

CREATE POLICY "Creators update blocks on own content"
  ON public.blocks FOR UPDATE
  TO authenticated
  USING (
    stage_id IN (
      SELECT s.id FROM public.stages s
      JOIN public.content_items c ON c.id = s.content_item_id
      WHERE c.creator_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Creators delete blocks on own content"
  ON public.blocks FOR DELETE
  TO authenticated
  USING (
    stage_id IN (
      SELECT s.id FROM public.stages s
      JOIN public.content_items c ON c.id = s.content_item_id
      WHERE c.creator_id = auth.uid()
    )
  );

-- block_connections
CREATE POLICY "View block_connections for approved or own content"
  ON public.block_connections FOR SELECT
  USING (
    from_block_id IN (
      SELECT b.id FROM public.blocks b
      JOIN public.stages s ON s.id = b.stage_id
      JOIN public.content_items c ON c.id = s.content_item_id
      WHERE c.status = 'approved'
        OR c.creator_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Creators manage block_connections on own content"
  ON public.block_connections FOR ALL
  TO authenticated
  USING (
    from_block_id IN (
      SELECT b.id FROM public.blocks b
      JOIN public.stages s ON s.id = b.stage_id
      JOIN public.content_items c ON c.id = s.content_item_id
      WHERE c.creator_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
  );

-- block_versions
CREATE POLICY "View block_versions for approved or own content"
  ON public.block_versions FOR SELECT
  USING (
    block_id IN (
      SELECT b.id FROM public.blocks b
      JOIN public.stages s ON s.id = b.stage_id
      JOIN public.content_items c ON c.id = s.content_item_id
      WHERE c.status = 'approved'
        OR c.creator_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Creators insert block_versions on own content"
  ON public.block_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    block_id IN (
      SELECT b.id FROM public.blocks b
      JOIN public.stages s ON s.id = b.stage_id
      JOIN public.content_items c ON c.id = s.content_item_id
      WHERE c.creator_id = auth.uid()
    )
  );

CREATE POLICY "Creators delete block_versions on own content"
  ON public.block_versions FOR DELETE
  TO authenticated
  USING (
    block_id IN (
      SELECT b.id FROM public.blocks b
      JOIN public.stages s ON s.id = b.stage_id
      JOIN public.content_items c ON c.id = s.content_item_id
      WHERE c.creator_id = auth.uid()
    )
  );

-- document_comments
CREATE POLICY "View document_comments for approved or own content"
  ON public.document_comments FOR SELECT
  USING (
    content_item_id IN (
      SELECT id FROM public.content_items
      WHERE status = 'approved'
        OR creator_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Authenticated users insert document_comments"
  ON public.document_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors and creators update document_comments"
  ON public.document_comments FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR content_item_id IN (
      SELECT id FROM public.content_items
      WHERE creator_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Authors and creators delete document_comments"
  ON public.document_comments FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR content_item_id IN (
      SELECT id FROM public.content_items
      WHERE creator_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
  );

-- block_references
CREATE POLICY "View block_references for approved or own content"
  ON public.block_references FOR SELECT
  USING (
    content_item_id IN (
      SELECT id FROM public.content_items
      WHERE status = 'approved'
        OR creator_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
  );

CREATE POLICY "Creators manage block_references on own content"
  ON public.block_references FOR ALL
  TO authenticated
  USING (
    content_item_id IN (
      SELECT id FROM public.content_items
      WHERE creator_id = auth.uid()
        OR public.is_admin(auth.uid())
    )
  );
