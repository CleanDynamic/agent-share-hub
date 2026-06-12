-- =============================================================================
-- Gamification schema — single migration
-- =============================================================================
-- Introduces XP / levels / tracks, an append-only XP ledger, badges &
-- creator-marks, daily/weekly challenges, streaks, post lineage (remix tree),
-- guilds (T3, created-but-unused), and feature flags.
--
-- NOTE ON THE USER TABLE: this codebase has no `users` table. The canonical
-- user record is `public.profiles` (PK = auth.users.id), created on signup by
-- public.handle_new_user(). Every `REFERENCES users(id)` from the spec is
-- therefore wired to public.profiles(id), the backfill reads from
-- public.profiles, and the "create on signup" trigger fires on INSERT into
-- public.profiles.
--
-- Existing tables are left untouched except for the two-column addition to
-- content_items (section 9).
-- =============================================================================


-- =============================================================================
-- 1. user_progress
-- =============================================================================
CREATE TABLE public.user_progress (
  user_id                UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp_total               BIGINT NOT NULL DEFAULT 0,
  level                  INT NOT NULL DEFAULT 1,
  track                  TEXT NULL CHECK (track IN ('architect','curator','mentor','explorer')),
  track_xp               BIGINT NOT NULL DEFAULT 0,
  last_respec_at         TIMESTAMPTZ NULL,
  rep_score              NUMERIC(5,2) NOT NULL DEFAULT 0,
  rep_updated_at         TIMESTAMPTZ NULL,
  streak_current         INT NOT NULL DEFAULT 0,
  streak_best            INT NOT NULL DEFAULT 0,
  freezes_used_month     INT NOT NULL DEFAULT 0,
  last_active_date       DATE NULL,
  onboarding_quest_state JSONB NOT NULL DEFAULT '{}',
  -- denormalised counts the badge engine reads (posts_published,
  -- comments_made, downloads_received, saves_received, etc.)
  counters               JSONB NOT NULL DEFAULT '{}',
  -- set to (email_verified_at + 48h) when verification happens;
  -- XP awards check now() >= eligible_at
  eligible_at            TIMESTAMPTZ NULL,
  depth_revealed_at      TIMESTAMPTZ NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill a row for every existing user.
INSERT INTO public.user_progress (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Auto-create a progress row whenever a new profile (= a new user) is created.
CREATE OR REPLACE FUNCTION public.handle_new_user_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_progress (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_progress
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_progress();


-- =============================================================================
-- 2. xp_events  (append-only ledger; single source of truth)
-- =============================================================================
CREATE TABLE public.xp_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type    TEXT NOT NULL,
  base_xp        INT NOT NULL,
  awarded_xp     INT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'awarded'
                   CHECK (status IN ('awarded','pending_eligibility')),
  source_user_id UUID NULL REFERENCES public.profiles(id),
  source_post_id UUID NULL REFERENCES public.content_items(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_xp_events_user_created
  ON public.xp_events (user_id, created_at DESC);                  -- ledger paging
CREATE INDEX idx_xp_events_user_action_created
  ON public.xp_events (user_id, action_type, created_at);          -- diminishing math
CREATE INDEX idx_xp_events_user_source_created
  ON public.xp_events (user_id, source_user_id, created_at);       -- per-source cap


-- =============================================================================
-- 3. badges
-- =============================================================================
CREATE TABLE public.badges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('tiered','hidden','seasonal','category')),
  tier             SMALLINT NULL,            -- 1/2/3 for tiered, null otherwise
  layer            SMALLINT NOT NULL DEFAULT 1 CHECK (layer IN (1,2,3)),
  is_creator_mark  BOOLEAN NOT NULL DEFAULT false,
  icon_name        TEXT NOT NULL,            -- Lucide icon name
  criteria         JSONB NOT NULL,           -- e.g. {"counter":"posts_published","gte":10}
  season_tag       TEXT NULL,                -- e.g. 'S1-2026'
  is_active        BOOLEAN NOT NULL DEFAULT true
);


-- =============================================================================
-- 4. user_badges
-- =============================================================================
CREATE TABLE public.user_badges (
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id       UUID NOT NULL REFERENCES public.badges(id),
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  state          TEXT NOT NULL DEFAULT 'earned'
                   CHECK (state IN ('earned','pending_reveal')),
  is_showcased   BOOLEAN NOT NULL DEFAULT false,
  showcase_order SMALLINT NULL,
  PRIMARY KEY (user_id, badge_id)
);

-- Enforce a maximum of 5 showcased badges per user.
CREATE OR REPLACE FUNCTION public.enforce_showcase_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  showcased_count INT;
BEGIN
  IF NEW.is_showcased THEN
    SELECT count(*) INTO showcased_count
    FROM public.user_badges
    WHERE user_id = NEW.user_id
      AND is_showcased = true
      AND badge_id <> NEW.badge_id;   -- exclude the row being updated

    IF showcased_count >= 5 THEN
      RAISE EXCEPTION 'A user may showcase at most 5 badges (user_id=%)', NEW.user_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_badges_showcase_limit
  BEFORE INSERT OR UPDATE ON public.user_badges
  FOR EACH ROW EXECUTE FUNCTION public.enforce_showcase_limit();


-- =============================================================================
-- 5. challenges
-- =============================================================================
CREATE TABLE public.challenges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL,
  cadence      TEXT NOT NULL CHECK (cadence IN ('daily','weekly')),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  criteria     JSONB NOT NULL,    -- e.g. {"action":"comment_created","count":2,"min_chars":80}
  xp_reward    INT NOT NULL,
  active_date  DATE NULL,         -- null = pool template; set when the cron instantiates it
  layer        SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (slug, active_date)
);


-- =============================================================================
-- 6. user_challenge_progress
-- =============================================================================
CREATE TABLE public.user_challenge_progress (
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id),
  progress     JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ NULL,
  claimed_at   TIMESTAMPTZ NULL,
  PRIMARY KEY (user_id, challenge_id)
);


-- =============================================================================
-- 7. streak_days
-- =============================================================================
CREATE TABLE public.streak_days (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date    DATE NOT NULL,
  kind    TEXT NOT NULL CHECK (kind IN ('active','frozen')),
  PRIMARY KEY (user_id, date)
);


-- =============================================================================
-- 8. post_lineage
-- =============================================================================
CREATE TABLE public.post_lineage (
  post_id        UUID PRIMARY KEY REFERENCES public.content_items(id) ON DELETE CASCADE,
  parent_post_id UUID NOT NULL REFERENCES public.content_items(id),
  root_post_id   UUID NOT NULL REFERENCES public.content_items(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_lineage_parent ON public.post_lineage (parent_post_id);
CREATE INDEX idx_post_lineage_root   ON public.post_lineage (root_post_id);


-- =============================================================================
-- 9. content_items — two-column addition (only permitted change to an existing table)
-- =============================================================================
ALTER TABLE public.content_items
  ADD COLUMN is_remixable               BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN remix_attribution_required BOOLEAN NOT NULL DEFAULT true;


-- =============================================================================
-- 10. guilds / guild_members  (T3 — created now, unused)
-- =============================================================================
CREATE TABLE public.guilds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  purpose      TEXT,
  emblem_icon  TEXT,
  emblem_color TEXT,
  member_cap   INT DEFAULT 50,
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.guild_members (
  guild_id  UUID NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('founder','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);


-- =============================================================================
-- 11. feature_flags
-- =============================================================================
CREATE TABLE public.feature_flags (
  key     TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO public.feature_flags (key, enabled) VALUES
  ('FLAG_REPUTATION',         false),
  ('FLAG_LEADERBOARDS',       false),
  ('FLAG_SEASONAL',           false),
  ('FLAG_GUILDS',             false),
  ('FLAG_DEPTH_DEFAULT_OPEN', false);


-- =============================================================================
-- 12. Row-Level Security
-- =============================================================================
-- Per-user tables: a user may read only their own rows. All writes go through
-- service-role functions (service role bypasses RLS), so no write policies and
-- no UPDATE/DELETE policies are defined here (xp_events rows stay immutable).
ALTER TABLE public.user_progress           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_days             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON public.user_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own xp_events"
  ON public.xp_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own badges"
  ON public.user_badges FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own challenge progress"
  ON public.user_challenge_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view own streak days"
  ON public.streak_days FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Catalogue / reference tables: world-readable, writes service-role only.
ALTER TABLE public.badges        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_lineage  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges are viewable by everyone"
  ON public.badges FOR SELECT USING (true);
CREATE POLICY "Challenges are viewable by everyone"
  ON public.challenges FOR SELECT USING (true);
CREATE POLICY "Feature flags are viewable by everyone"
  ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "Post lineage is viewable by everyone"
  ON public.post_lineage FOR SELECT USING (true);

-- Guilds (T3): world-readable, writes service-role only for now.
ALTER TABLE public.guilds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guild_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guilds are viewable by everyone"
  ON public.guilds FOR SELECT USING (true);
CREATE POLICY "Guild members are viewable by everyone"
  ON public.guild_members FOR SELECT USING (true);


-- =============================================================================
-- 13. Seed data
-- =============================================================================

-- 13a. Creator Marks (layer 1, is_creator_mark = true) -------------------------
INSERT INTO public.badges (slug, name, description, kind, tier, layer, is_creator_mark, icon_name, criteria, season_tag) VALUES
  ('first-steps',         'First Steps',         'Completed the onboarding quest.',                          'category', NULL, 1, true, 'Footprints',     '{"quest_complete":true}',                       NULL),
  ('blueprint-author',    'Blueprint Author',    'Published your first blueprint.',                          'category', NULL, 1, true, 'Sparkles',       '{"counter":"blueprints_published","gte":1}',    NULL),
  ('blog-author',         'Blog Author',         'Published your first blog post.',                          'category', NULL, 1, true, 'PenLine',        '{"counter":"blogs_published","gte":1}',         NULL),
  ('bounty-setter',       'Bounty Setter',       'Published your first bounty.',                             'category', NULL, 1, true, 'Trophy',         '{"counter":"bounties_published","gte":1}',      NULL),
  ('first-download',      'First Download',      'Your work was downloaded for the first time.',            'category', NULL, 1, true, 'Download',       '{"counter":"downloads_received","gte":1}',      NULL),
  ('conversationalist-1', 'Conversationalist I', 'Left 10 comments across the community.',                   'tiered',   1,    1, true, 'MessageCircle',  '{"counter":"comments_made","gte":10}',          NULL),
  ('week-one',            'Week One',            'Maintained a 7-day activity streak.',                      'category', NULL, 1, true, 'Flame',          '{"streak_gte":7}',                              NULL),
  ('founder',             'Founder',             'Among the first 100 members of NeoScale.',                 'seasonal', NULL, 1, true, 'Crown',          '{"founder_rank_lte":100}',                      'FOUNDING');

-- 13b. Layer-2 tiered ----------------------------------------------------------
INSERT INTO public.badges (slug, name, description, kind, tier, layer, is_creator_mark, icon_name, criteria) VALUES
  ('publisher-1',         'Publisher I',          'Published 1 post.',                'tiered', 1, 2, false, 'Upload',        '{"counter":"posts_published","gte":1}'),
  ('publisher-2',         'Publisher II',         'Published 10 posts.',              'tiered', 2, 2, false, 'Upload',        '{"counter":"posts_published","gte":10}'),
  ('publisher-3',         'Publisher III',        'Published 50 posts.',              'tiered', 3, 2, false, 'Upload',        '{"counter":"posts_published","gte":50}'),

  ('downloaded-1',        'Downloaded I',         'Your work was downloaded 10 times.',    'tiered', 1, 2, false, 'Download',  '{"counter":"downloads_received","gte":10}'),
  ('downloaded-2',        'Downloaded II',        'Your work was downloaded 100 times.',   'tiered', 2, 2, false, 'Download',  '{"counter":"downloads_received","gte":100}'),
  ('downloaded-3',        'Downloaded III',       'Your work was downloaded 1000 times.',  'tiered', 3, 2, false, 'Download',  '{"counter":"downloads_received","gte":1000}'),

  ('conversationalist-2', 'Conversationalist II', 'Left 100 comments across the community.', 'tiered', 2, 2, false, 'MessageCircle', '{"counter":"comments_made","gte":100}'),
  ('conversationalist-3', 'Conversationalist III','Left 500 comments across the community.', 'tiered', 3, 2, false, 'MessageCircle', '{"counter":"comments_made","gte":500}'),

  ('bounty-hunter-1',     'Bounty Hunter I',      'Had 1 bounty solution accepted.',   'tiered', 1, 2, false, 'Target', '{"counter":"bounties_accepted","gte":1}'),
  ('bounty-hunter-2',     'Bounty Hunter II',     'Had 5 bounty solutions accepted.',  'tiered', 2, 2, false, 'Target', '{"counter":"bounties_accepted","gte":5}'),
  ('bounty-hunter-3',     'Bounty Hunter III',    'Had 25 bounty solutions accepted.', 'tiered', 3, 2, false, 'Target', '{"counter":"bounties_accepted","gte":25}'),

  ('magnet-1',            'Magnet I',             'Your work was saved 10 times.',    'tiered', 1, 2, false, 'Bookmark', '{"counter":"saves_received","gte":10}'),
  ('magnet-2',            'Magnet II',            'Your work was saved 100 times.',   'tiered', 2, 2, false, 'Bookmark', '{"counter":"saves_received","gte":100}'),
  ('magnet-3',            'Magnet III',           'Your work was saved 1000 times.',  'tiered', 3, 2, false, 'Bookmark', '{"counter":"saves_received","gte":1000}');

-- 13c. Layer-2 hidden (12) -----------------------------------------------------
-- description text is what shows AFTER earning.
INSERT INTO public.badges (slug, name, description, kind, tier, layer, is_creator_mark, icon_name, criteria) VALUES
  ('night-shift',     'Night Shift',     'Published something between midnight and 5am.',                  'hidden', NULL, 2, false, 'Moon',        '{"action":"post_published","time_window":"00:00-05:00"}'),
  ('first-responder', 'First Responder', 'Were the first to comment on a brand-new post.',                'hidden', NULL, 2, false, 'Zap',         '{"first_comment_on_post":true}'),
  ('deep-diver',      'Deep Diver',      'Read a long post all the way through.',                          'hidden', NULL, 2, false, 'Anchor',      '{"deep_read":true,"min_read_pct":95}'),
  ('completionist',   'Completionist',   'Completed every stage of a learning path.',                      'hidden', NULL, 2, false, 'CheckCheck',  '{"completed_all_stages":true}'),
  ('archaeologist',   'Archaeologist',   'Engaged with a post over a year old.',                           'hidden', NULL, 2, false, 'Pickaxe',     '{"interacted_with_post_age_days_gte":365}'),
  ('lone-wolf',       'Lone Wolf',       'Published 10 posts without remixing anyone.',                    'hidden', NULL, 2, false, 'Wolf',        '{"counter":"solo_publishes","gte":10}'),
  ('butterfly',       'Social Butterfly','Interacted with 50 different creators.',                         'hidden', NULL, 2, false, 'Bird',        '{"distinct_users_interacted_gte":50}'),
  ('marathon',        'Marathon',        'Held a 30-day activity streak.',                                 'hidden', NULL, 2, false, 'Timer',       '{"streak_gte":30}'),
  ('echo',            'Echo',            'Your work was remixed by someone else.',                         'hidden', NULL, 2, false, 'Repeat',      '{"counter":"times_remixed","gte":1}'),
  ('polyglot',        'Polyglot',        'Published across blueprints, blogs and bounties.',               'hidden', NULL, 2, false, 'Languages',   '{"distinct_categories_gte":3}'),
  ('ghost-writer',    'Ghost Writer',    'Contributed steadily while showcasing nothing.',                 'hidden', NULL, 2, false, 'Ghost',       '{"counter":"posts_published","gte":10,"showcased":0}'),
  ('founding-spirit', 'Founding Spirit', 'Joined during the founding season.',                             'hidden', NULL, 2, false, 'Sprout',      '{"joined_before":"2026-12-31"}');

-- 13d. Layer-3: connected I/II/III (followers) ---------------------------------
INSERT INTO public.badges (slug, name, description, kind, tier, layer, is_creator_mark, icon_name, criteria) VALUES
  ('connected-1', 'Connected I',   'Reached 10 followers.',  'tiered', 1, 3, false, 'Users', '{"counter":"followers","gte":10}'),
  ('connected-2', 'Connected II',  'Reached 100 followers.', 'tiered', 2, 3, false, 'Users', '{"counter":"followers","gte":100}'),
  ('connected-3', 'Connected III', 'Reached 1000 followers.','tiered', 3, 3, false, 'Users', '{"counter":"followers","gte":1000}');

-- 13e. Category mastery templates per tag-category at 5/20/50 -------------------
-- This platform's tag-categories are the post_category values: blueprint / blog / bounty.
INSERT INTO public.badges (slug, name, description, kind, tier, layer, is_creator_mark, icon_name, criteria) VALUES
  ('mastery-blueprint-1', 'Blueprint Adept',    'Published 5 blueprints.',  'category', 1, 2, false, 'FolderOpen', '{"counter":"category_blueprint_posts","gte":5}'),
  ('mastery-blueprint-2', 'Blueprint Expert',   'Published 20 blueprints.', 'category', 2, 2, false, 'FolderOpen', '{"counter":"category_blueprint_posts","gte":20}'),
  ('mastery-blueprint-3', 'Blueprint Master',   'Published 50 blueprints.', 'category', 3, 2, false, 'FolderOpen', '{"counter":"category_blueprint_posts","gte":50}'),

  ('mastery-blog-1',      'Blog Adept',         'Published 5 blogs.',       'category', 1, 2, false, 'FolderOpen', '{"counter":"category_blog_posts","gte":5}'),
  ('mastery-blog-2',      'Blog Expert',        'Published 20 blogs.',      'category', 2, 2, false, 'FolderOpen', '{"counter":"category_blog_posts","gte":20}'),
  ('mastery-blog-3',      'Blog Master',        'Published 50 blogs.',      'category', 3, 2, false, 'FolderOpen', '{"counter":"category_blog_posts","gte":50}'),

  ('mastery-bounty-1',    'Bounty Adept',       'Published 5 bounties.',    'category', 1, 2, false, 'FolderOpen', '{"counter":"category_bounty_posts","gte":5}'),
  ('mastery-bounty-2',    'Bounty Expert',      'Published 20 bounties.',   'category', 2, 2, false, 'FolderOpen', '{"counter":"category_bounty_posts","gte":20}'),
  ('mastery-bounty-3',    'Bounty Master',      'Published 50 bounties.',   'category', 3, 2, false, 'FolderOpen', '{"counter":"category_bounty_posts","gte":50}');

-- 13f. Challenge pool (active_date NULL) ---------------------------------------
-- 8 daily creator-nudge templates.
INSERT INTO public.challenges (slug, cadence, title, description, criteria, xp_reward, active_date, layer) VALUES
  -- layer 1
  ('thoughtful-comment',   'daily', 'Thoughtful Comment',   'Leave a comment of at least 80 characters.',          '{"action":"comment_created","count":1,"min_chars":80}', 20, NULL, 1),
  ('save-3-to-collection', 'daily', 'Curate Three',         'Save 3 items to a collection.',                       '{"action":"save_to_collection","count":3}',             15, NULL, 1),
  ('annotate-passage',     'daily', 'Annotate a Passage',   'Add an annotation to a post.',                        '{"action":"annotation_created","count":1}',             15, NULL, 1),
  ('update-a-draft',       'daily', 'Update a Draft',       'Make progress on one of your drafts.',                '{"action":"draft_updated","count":1}',                  10, NULL, 1),
  ('publish-anything',     'daily', 'Ship It',              'Publish anything today.',                             '{"action":"post_published","count":1}',                 30, NULL, 1),
  -- layer 2 (wider daily pool)
  ('react-to-three',       'daily', 'Spread the Love',      'React to 3 posts.',                                   '{"action":"reaction_created","count":3}',               10, NULL, 2),
  ('follow-a-creator',     'daily', 'Find Your People',     'Follow a creator.',                                   '{"action":"follow_created","count":1}',                 10, NULL, 2),
  ('remix-a-post',         'daily', 'Remix It',             'Remix an existing post.',                             '{"action":"remix_created","count":1}',                  25, NULL, 2);

-- 3 weekly templates (layer 2).
INSERT INTO public.challenges (slug, cadence, title, description, criteria, xp_reward, active_date, layer) VALUES
  ('publish-blueprint', 'weekly', 'Blueprint of the Week', 'Publish a blueprint this week.',          '{"action":"blueprint_published","count":1}', 60, NULL, 2),
  ('five-day-streak',   'weekly', 'Five-Day Streak',       'Stay active 5 days this week.',           '{"action":"streak_reached","count":5}',      75, NULL, 2),
  ('submit-solution',   'weekly', 'Solve a Bounty',        'Submit a bounty solution this week.',     '{"action":"solution_submitted","count":1}',  70, NULL, 2);


-- =============================================================================
-- 14. Verification queries (run manually AFTER applying — NOT part of the migration)
-- =============================================================================
-- SELECT count(*) FROM public.user_progress;                    -- equals profiles count
-- SELECT count(*) FROM public.badges WHERE is_creator_mark;     -- 8
-- SELECT count(*) FROM public.feature_flags WHERE enabled;      -- 0
--
-- Showcase-limit check (expects an exception on the 6th showcased badge):
--   WITH u AS (SELECT user_id FROM public.user_progress LIMIT 1)
--   -- showcase 5 badges for that user, then attempt a 6th UPDATE ... is_showcased = true
--   -- => raises: 'A user may showcase at most 5 badges'
