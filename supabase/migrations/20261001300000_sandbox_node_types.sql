-- =============================================================================
-- buildgallery — the team and manual step node types (UI-P61)
-- =============================================================================
-- Adds two rows to public.node_types, `team` and `manual_step`, for the composer
-- sandbox (design/sandbox/DATA.md). Titles, uses, how a step runs and sessions
-- all fit columns that already exist; these two keys are the only database
-- change. No table, column, policy or grant is touched: node_types is already
-- world readable and admin writable.
--
-- Idempotent and correct in both worlds: ON CONFLICT (key) DO NOTHING, so a
-- second run changes nothing and a row already edited live is never rewritten.

INSERT INTO public.node_types
  (key, label, category, colour, icon, renderer, copyable, is_active, sort, schema)
VALUES
  ('team', 'Team', 'configuration', '#7C3AED', 'Users', 'configuration', true, true, 6,
   '{"fields":[]}'::jsonb),
  ('manual_step', 'Manual step', 'narrative', '#9CA3AF', 'Hand', 'narrative', false, true, 6,
   '{"fields":[{"key":"tool","label":"Tool","type":"string","required":true},{"key":"text","label":"What was done","type":"text","required":true},{"key":"media_id","label":"Picture","type":"string","format":"media_id"}]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
