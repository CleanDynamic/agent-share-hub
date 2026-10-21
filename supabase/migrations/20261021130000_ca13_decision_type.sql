-- =============================================================================
-- buildgallery — the Decision node type (CA-13 Part 1)
-- =============================================================================
-- Adds one row to public.node_types, `decision`, for a typed choice, score or yes/no
-- that an app asks a small model for (TypeSafe Jev, an adapter on an ordinary model).
-- Its questions, the state it reads, the Code tiles that call it and one real answer
-- are all kept in build_nodes.payload; no table, column, policy or grant is touched.
--
-- Idempotent and correct in both worlds: ON CONFLICT (key) DO NOTHING, so a second
-- run changes nothing and a row already edited live is never rewritten.

INSERT INTO public.node_types
  (key, label, category, colour, icon, renderer, copyable, is_active, sort, schema)
VALUES
  ('decision', 'Decision', 'configuration', '#0EA5E9', 'GitBranch', 'configuration', true, true,
   COALESCE((SELECT sort + 1 FROM public.node_types WHERE key = 'agent_config'), 7),
   '{"fields":[{"key":"questions","label":"Questions","type":"json","required":true},{"key":"state_from","label":"State from","type":"string"}]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
