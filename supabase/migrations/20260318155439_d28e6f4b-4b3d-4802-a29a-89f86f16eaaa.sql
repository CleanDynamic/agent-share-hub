
-- =============================================
-- NEW TABLES
-- =============================================

-- 1. user_library
CREATE TABLE public.user_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE NOT NULL,
  added_at timestamptz DEFAULT now(),
  last_seen_version text,
  has_update boolean DEFAULT false,
  UNIQUE (user_id, content_id)
);
ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;

-- 2. content_dependencies
CREATE TABLE public.content_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE NOT NULL,
  requires_content_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE NOT NULL,
  dependency_note text,
  UNIQUE (content_id, requires_content_id)
);
ALTER TABLE public.content_dependencies ENABLE ROW LEVEL SECURITY;

-- 3. content_changelogs
CREATE TABLE public.content_changelogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE NOT NULL,
  version_label text,
  change_note text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.content_changelogs ENABLE ROW LEVEL SECURITY;

-- 4. revenue_splits
CREATE TABLE public.revenue_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  percentage numeric(5,2) NOT NULL,
  set_by uuid REFERENCES public.profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.revenue_splits ENABLE ROW LEVEL SECURITY;

-- 5. collab_invites
CREATE TABLE public.collab_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE NOT NULL,
  inviter_id uuid REFERENCES public.profiles(id) NOT NULL,
  invitee_id uuid REFERENCES public.profiles(id) NOT NULL,
  status text DEFAULT 'pending',
  invited_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (content_id, invitee_id)
);
ALTER TABLE public.collab_invites ENABLE ROW LEVEL SECURITY;

-- 6. content_collaborators
CREATE TABLE public.content_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE NOT NULL,
  collaborator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  is_primary_author boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (content_id, collaborator_id)
);
ALTER TABLE public.content_collaborators ENABLE ROW LEVEL SECURITY;

-- 7. curators
CREATE TABLE public.curators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  approved_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES public.profiles(id),
  is_active boolean DEFAULT true
);
ALTER TABLE public.curators ENABLE ROW LEVEL SECURITY;

-- 8. curator_recommendations
CREATE TABLE public.curator_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id uuid REFERENCES public.curators(id) ON DELETE CASCADE NOT NULL,
  content_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE NOT NULL,
  recommendation_text text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (curator_id, content_id)
);
ALTER TABLE public.curator_recommendations ENABLE ROW LEVEL SECURITY;

-- 9. curator_applications
CREATE TABLE public.curator_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'pending',
  applied_at timestamptz DEFAULT now()
);
ALTER TABLE public.curator_applications ENABLE ROW LEVEL SECURITY;

-- 10. microtag_definitions + content_microtags
CREATE TABLE public.microtag_definitions (
  tag text PRIMARY KEY,
  description text
);
ALTER TABLE public.microtag_definitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.content_microtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE NOT NULL,
  tag text NOT NULL REFERENCES public.microtag_definitions(tag)
);
ALTER TABLE public.content_microtags ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ADD COLUMNS TO EXISTING TABLES
-- =============================================

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS compatibility_status text DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_by_creator_at timestamptz,
  ADD COLUMN IF NOT EXISTS pwyw_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pwyw_floor_gbp numeric,
  ADD COLUMN IF NOT EXISTS pwyw_avg_paid_gbp numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pwyw_purchase_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_curator_recommendation boolean DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_curator boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS curator_application_status text;

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.update_curator_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _content_id uuid;
  _has_active boolean;
BEGIN
  _content_id := COALESCE(NEW.content_id, OLD.content_id);
  SELECT EXISTS (
    SELECT 1 FROM public.curator_recommendations
    WHERE content_id = _content_id AND is_active = true
  ) INTO _has_active;
  UPDATE public.content_items
  SET has_curator_recommendation = _has_active
  WHERE id = _content_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_update_curator_badge
AFTER INSERT OR UPDATE OR DELETE ON public.curator_recommendations
FOR EACH ROW EXECUTE FUNCTION public.update_curator_badge();

CREATE OR REPLACE FUNCTION public.mark_library_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_library
  SET has_update = true
  WHERE content_id = NEW.content_id
    AND last_seen_version IS DISTINCT FROM NEW.version_number;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_mark_library_updates
AFTER INSERT ON public.content_versions
FOR EACH ROW EXECUTE FUNCTION public.mark_library_updates();

-- =============================================
-- SEED DATA
-- =============================================

INSERT INTO public.microtag_definitions (tag, description) VALUES
('#one-prompt', 'Everything in a single prompt — no multi-step setup'),
('#requires-api-key', 'Needs a paid API key to run'),
('#works-offline', 'No internet connection required once set up'),
('#under-5-mins', 'Setup takes under 5 minutes'),
('#for-teams', 'Designed for multiple users or team use'),
('#mobile-friendly', 'Works on mobile AI apps'),
('#no-coding', 'Zero technical knowledge required'),
('#free-tools-only', 'Works with free tiers of all required tools'),
('#recurring-use', 'Designed to be used daily or weekly'),
('#one-time-use', 'Single-use or occasional use'),
('#template-included', 'Includes a ready-to-copy template'),
('#claude-optimised', 'Specifically tested and tuned for Claude'),
('#gpt-optimised', 'Specifically tested and tuned for ChatGPT/GPT-4'),
('#gemini-optimised', 'Specifically tested and tuned for Gemini'),
('#zapier-ready', 'Includes a ready-to-import Zapier Zap'),
('#make-ready', 'Includes a ready-to-import Make scenario'),
('#n8n-ready', 'Includes a ready-to-import n8n workflow'),
('#beginner-first', 'Written specifically for people new to AI'),
('#advanced-only', 'Requires prior experience with AI setups');

-- =============================================
-- RLS POLICIES
-- =============================================

-- user_library
CREATE POLICY "Users can select own library" ON public.user_library FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own library" ON public.user_library FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own library" ON public.user_library FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own library" ON public.user_library FOR DELETE TO authenticated USING (user_id = auth.uid());

-- content_dependencies
CREATE POLICY "Public can view dependencies" ON public.content_dependencies FOR SELECT TO public USING (true);
CREATE POLICY "Creator can insert dependencies" ON public.content_dependencies FOR INSERT TO authenticated WITH CHECK (content_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));
CREATE POLICY "Creator can delete dependencies" ON public.content_dependencies FOR DELETE TO authenticated USING (content_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

-- content_changelogs
CREATE POLICY "Public can view changelogs" ON public.content_changelogs FOR SELECT TO public USING (true);
CREATE POLICY "Creator can insert changelogs" ON public.content_changelogs FOR INSERT TO authenticated WITH CHECK (content_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));
CREATE POLICY "Admin can update changelogs" ON public.content_changelogs FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- revenue_splits
CREATE POLICY "Setter can select own splits" ON public.revenue_splits FOR SELECT TO authenticated USING (set_by = auth.uid());
CREATE POLICY "Recipient can select own splits" ON public.revenue_splits FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "Admin can select all splits" ON public.revenue_splits FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Setter can insert splits" ON public.revenue_splits FOR INSERT TO authenticated WITH CHECK (set_by = auth.uid());
CREATE POLICY "Setter can delete own splits" ON public.revenue_splits FOR DELETE TO authenticated USING (set_by = auth.uid());

-- collab_invites
CREATE POLICY "Inviter can select own invites" ON public.collab_invites FOR SELECT TO authenticated USING (inviter_id = auth.uid());
CREATE POLICY "Invitee can select own invites" ON public.collab_invites FOR SELECT TO authenticated USING (invitee_id = auth.uid());
CREATE POLICY "Admin can select all invites" ON public.collab_invites FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Inviter can insert invites" ON public.collab_invites FOR INSERT TO authenticated WITH CHECK (inviter_id = auth.uid());
CREATE POLICY "Inviter can update invites" ON public.collab_invites FOR UPDATE TO authenticated USING (inviter_id = auth.uid());
CREATE POLICY "Invitee can update invites" ON public.collab_invites FOR UPDATE TO authenticated USING (invitee_id = auth.uid());

-- content_collaborators
CREATE POLICY "Public can view collaborators" ON public.content_collaborators FOR SELECT TO public USING (true);
CREATE POLICY "Accepted invitee can insert collaborator" ON public.content_collaborators FOR INSERT TO authenticated WITH CHECK (
  collaborator_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.collab_invites
    WHERE collab_invites.content_id = content_collaborators.content_id
      AND collab_invites.invitee_id = auth.uid()
      AND collab_invites.status = 'accepted'
  )
);
CREATE POLICY "Creator can insert primary collaborator" ON public.content_collaborators FOR INSERT TO authenticated WITH CHECK (
  content_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid())
  AND collaborator_id = auth.uid()
  AND is_primary_author = true
);
CREATE POLICY "Collaborator can delete own row" ON public.content_collaborators FOR DELETE TO authenticated USING (collaborator_id = auth.uid());

-- curators
CREATE POLICY "Public can view active curators" ON public.curators FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Admin can insert curators" ON public.curators FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update curators" ON public.curators FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- curator_recommendations
CREATE POLICY "Public can view active recommendations" ON public.curator_recommendations FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Curator can insert own recommendations" ON public.curator_recommendations FOR INSERT TO authenticated WITH CHECK (
  curator_id IN (SELECT id FROM public.curators WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "Curator can update own recommendations" ON public.curator_recommendations FOR UPDATE TO authenticated USING (
  curator_id IN (SELECT id FROM public.curators WHERE user_id = auth.uid())
);
CREATE POLICY "Admin can update all recommendations" ON public.curator_recommendations FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- curator_applications
CREATE POLICY "User can select own application" ON public.curator_applications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin can select all applications" ON public.curator_applications FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "User can insert own application" ON public.curator_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin can update applications" ON public.curator_applications FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- content_microtags
CREATE POLICY "Public can view microtags" ON public.content_microtags FOR SELECT TO public USING (true);
CREATE POLICY "Creator can insert microtags" ON public.content_microtags FOR INSERT TO authenticated WITH CHECK (content_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));
CREATE POLICY "Creator can delete microtags" ON public.content_microtags FOR DELETE TO authenticated USING (content_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

-- microtag_definitions
CREATE POLICY "Public can view microtag definitions" ON public.microtag_definitions FOR SELECT TO public USING (true);
CREATE POLICY "Admin can insert microtag definitions" ON public.microtag_definitions FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admin can update microtag definitions" ON public.microtag_definitions FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admin can delete microtag definitions" ON public.microtag_definitions FOR DELETE TO authenticated USING (is_admin(auth.uid()));
