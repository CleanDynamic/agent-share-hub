-- 1. node_types ------------------------------------------------------------------------------------------------------------

INSERT INTO public.node_types
  (key, label, category, colour, icon, renderer, copyable, is_active, sort, schema)
VALUES
  ('host', 'Host', 'configuration', '#64748B', 'Server', 'configuration', true, true,
   COALESCE((SELECT max(sort) + 1 FROM public.node_types), 40),
   '{"fields":[{"key":"machine","label":"Machine","type":"string","required":true},{"key":"name","label":"Name","type":"string"},{"key":"always_on","label":"Always on","type":"boolean"},{"key":"os","label":"Operating system","type":"string"},{"key":"ram_gb","label":"RAM (GB)","type":"number"},{"key":"gpus","label":"GPUs","type":"json"},{"key":"storage","label":"Storage","type":"string"}]}'::jsonb),
  ('inference_server', 'Inference server', 'configuration', '#64748B', 'Cpu', 'configuration', true, true,
   COALESCE((SELECT max(sort) + 2 FROM public.node_types), 41),
   '{"fields":[{"key":"provider","label":"Provider","type":"string","required":true},{"key":"api","label":"API","type":"string"},{"key":"reach","label":"Reach","type":"string"},{"key":"serves","label":"Serves","type":"json"}]}'::jsonb),
  ('memory', 'Memory', 'data', '#64748B', 'Database', 'data', true, true,
   COALESCE((SELECT max(sort) + 3 FROM public.node_types), 42),
   '{"fields":[{"key":"provider","label":"Provider","type":"string","required":true},{"key":"keeps","label":"What it keeps","type":"string"},{"key":"lives","label":"Where it lives","type":"string"},{"key":"starts","label":"Starts","type":"string"},{"key":"tagged_by_agent","label":"Tagged by agent","type":"boolean"},{"key":"review_after_days","label":"Review after (days)","type":"number"}]}'::jsonb),
  ('channel', 'Channel', 'configuration', '#64748B', 'MessageSquare', 'configuration', true, true,
   COALESCE((SELECT max(sort) + 4 FROM public.node_types), 43),
   '{"fields":[{"key":"provider","label":"Provider","type":"string","required":true},{"key":"direction","label":"Direction","type":"string"},{"key":"starts_runs","label":"Starts runs","type":"boolean"}]}'::jsonb),
  ('voice', 'Voice', 'configuration', '#64748B', 'AudioLines', 'configuration', true, true,
   COALESCE((SELECT max(sort) + 5 FROM public.node_types), 44),
   '{"fields":[{"key":"provider","label":"Provider","type":"string","required":true},{"key":"mode","label":"Mode","type":"string"},{"key":"voice_name","label":"Voice","type":"string"}]}'::jsonb),
  ('monitoring', 'Monitoring', 'configuration', '#64748B', 'Activity', 'configuration', true, true,
   COALESCE((SELECT max(sort) + 6 FROM public.node_types), 45),
   '{"fields":[{"key":"provider","label":"Provider","type":"string","required":true},{"key":"measures","label":"Measures","type":"json"},{"key":"tags","label":"Tags","type":"json"},{"key":"test_traffic_tagged","label":"Test traffic tagged","type":"boolean"}]}'::jsonb),
  ('billing', 'Billing', 'configuration', '#64748B', 'CreditCard', 'configuration', true, true,
   COALESCE((SELECT max(sort) + 7 FROM public.node_types), 46),
   '{"fields":[{"key":"provider","label":"Provider","type":"string","required":true},{"key":"model","label":"Model","type":"string"},{"key":"unit","label":"Unit","type":"string"},{"key":"charges","label":"Charges","type":"string"}]}'::jsonb),
  ('knowledge_base', 'Knowledge base', 'data', '#64748B', 'BookOpen', 'data', true, true,
   COALESCE((SELECT max(sort) + 8 FROM public.node_types), 47),
   '{"fields":[{"key":"format","label":"Format","type":"string","required":true},{"key":"app","label":"App","type":"string"},{"key":"sync","label":"Sync","type":"string"},{"key":"written_by","label":"Written by","type":"string"},{"key":"notes","label":"Notes","type":"json"},{"key":"read_by","label":"Read by","type":"json"}]}'::jsonb),
  ('relay', 'Relay', 'configuration', '#64748B', 'Network', 'configuration', true, true,
   COALESCE((SELECT max(sort) + 9 FROM public.node_types), 48),
   '{"fields":[{"key":"joins","label":"Joins","type":"json","required":true},{"key":"provider","label":"Provider","type":"string"},{"key":"network","label":"Network","type":"string"},{"key":"queues","label":"Queues","type":"boolean"},{"key":"identifies_by","label":"Identifies by","type":"string"}]}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. build_updates ---------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.build_updates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id   uuid        NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  note       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT build_updates_note_length CHECK (char_length(note) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS idx_build_updates_build_created
  ON public.build_updates (build_id, created_at DESC);

ALTER TABLE public.build_updates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.build_updates FROM anon, authenticated, service_role;
GRANT SELECT ON public.build_updates TO anon;
GRANT SELECT, INSERT, DELETE ON public.build_updates TO authenticated;
GRANT ALL ON public.build_updates TO service_role;

DROP POLICY IF EXISTS "Build updates of a published build are readable" ON public.build_updates;
CREATE POLICY "Build updates of a published build are readable"
  ON public.build_updates FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_updates.build_id AND b.status <> 'draft')
  );

DROP POLICY IF EXISTS "Makers read their own build updates" ON public.build_updates;
CREATE POLICY "Makers read their own build updates"
  ON public.build_updates FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_updates.build_id AND b.creator_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Makers add updates to their own builds" ON public.build_updates;
CREATE POLICY "Makers add updates to their own builds"
  ON public.build_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_updates.build_id AND b.creator_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Makers delete updates on their own builds" ON public.build_updates;
CREATE POLICY "Makers delete updates on their own builds"
  ON public.build_updates FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_updates.build_id AND b.creator_id = (select auth.uid()))
  );

-- No UPDATE policy: a note is never edited.