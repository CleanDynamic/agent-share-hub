-- SV-22 seed: the weekly requests-closed goal row.
-- THIS IS A SEED, NOT A MIGRATION. Run once after 20261102140000_sv22_reviews_goal.sql:
--   psql "$DATABASE_URL" -f supabase/seeds/sv22-weekly-goal.sql

INSERT INTO public.site_challenges (slug, title, goal)
VALUES ('weekly-requests-closed', 'Requests closed this week', 30)
ON CONFLICT (slug) DO NOTHING;
