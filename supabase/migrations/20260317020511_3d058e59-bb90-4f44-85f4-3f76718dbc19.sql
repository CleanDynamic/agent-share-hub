
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE OR REPLACE FUNCTION public.semantic_search(query_embedding vector, match_count int)
RETURNS TABLE(id uuid, title text, similarity float)
LANGUAGE sql
STABLE
AS $$
  SELECT ci.id, ci.title, 1 - (ci.embedding <=> query_embedding) AS similarity
  FROM public.content_items ci
  WHERE ci.status = 'approved' AND ci.embedding IS NOT NULL
  ORDER BY ci.embedding <=> query_embedding
  LIMIT match_count;
$$;
