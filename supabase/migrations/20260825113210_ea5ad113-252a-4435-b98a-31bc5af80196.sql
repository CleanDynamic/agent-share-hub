-- =============================================================================
-- NeoScale — link converted builds to source content items (NS-P24)
-- =============================================================================
-- Adds a nullable pointer from a build back to the content_item it was
-- converted from. This lets the site show "originally a post by X" and lets
-- the converted build inherit cover image / social metadata if desired.
-- =============================================================================

ALTER TABLE public.builds
  ADD COLUMN source_content_item_id UUID NULL REFERENCES public.content_items(id) ON DELETE SET NULL;

CREATE INDEX idx_builds_source_content_item
  ON public.builds (source_content_item_id);

COMMENT ON COLUMN public.builds.source_content_item_id IS
  'Reference to the original content_item when this build was converted from a post.';