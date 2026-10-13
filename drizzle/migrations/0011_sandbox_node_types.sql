INSERT INTO public.node_types
  (key, label, category, colour, icon, renderer, copyable, is_active, sort, schema)
VALUES
  ('team', 'Team', 'configuration', '#7C3AED', 'Users', 'configuration', true, true, 6,
   '{"fields":[]}'::jsonb),
  ('manual_step', 'Manual step', 'narrative', '#9CA3AF', 'Hand', 'narrative', false, true, 6,
   '{"fields":[{"key":"tool","label":"Tool","type":"string","required":true},{"key":"text","label":"What was done","type":"text","required":true},{"key":"media_id","label":"Picture","type":"string","format":"media_id"}]}'::jsonb)
ON CONFLICT (key) DO NOTHING;