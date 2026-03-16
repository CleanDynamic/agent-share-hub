
-- =============================================
-- NeoScale AI — Complete Database Schema
-- =============================================

-- 1. PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_creator BOOLEAN NOT NULL DEFAULT false,
  stripe_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. CONTENT_ITEMS TABLE
CREATE TABLE public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  ai_tools TEXT[] DEFAULT '{}',
  use_cases TEXT[] DEFAULT '{}',
  file_url TEXT,
  use_instructions TEXT,
  what_to_expect TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  monetisation_type TEXT NOT NULL DEFAULT 'free',
  price_gbp NUMERIC,
  donation_enabled BOOLEAN NOT NULL DEFAULT false,
  download_count INTEGER NOT NULL DEFAULT 0,
  star_rating NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is admin (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = _user_id),
    false
  );
$$;

-- Public can see approved content
CREATE POLICY "Anyone can view approved content"
  ON public.content_items FOR SELECT
  USING (
    status = 'approved'
    OR creator_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- Authenticated users can insert their own content
CREATE POLICY "Creators can insert content"
  ON public.content_items FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- Creators can update their own; admins can update any
CREATE POLICY "Creators can update own content"
  ON public.content_items FOR UPDATE
  TO authenticated
  USING (
    creator_id = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- Creators can delete their own
CREATE POLICY "Creators can delete own content"
  ON public.content_items FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- Index for faster filtering
CREATE INDEX idx_content_items_status ON public.content_items(status);
CREATE INDEX idx_content_items_content_type ON public.content_items(content_type);
CREATE INDEX idx_content_items_creator ON public.content_items(creator_id);
CREATE INDEX idx_content_items_ai_tools ON public.content_items USING GIN(ai_tools);
CREATE INDEX idx_content_items_use_cases ON public.content_items USING GIN(use_cases);

-- 3. DOWNLOADS TABLE
CREATE TABLE public.downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a download record
CREATE POLICY "Anyone can log a download"
  ON public.downloads FOR INSERT
  WITH CHECK (true);

-- Admins can view all downloads
CREATE POLICY "Admins can view all downloads"
  ON public.downloads FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Creators can see downloads of their content
CREATE POLICY "Creators can view downloads of own content"
  ON public.downloads FOR SELECT
  TO authenticated
  USING (
    content_id IN (
      SELECT id FROM public.content_items WHERE creator_id = auth.uid()
    )
  );

-- 4. SUBSCRIPTIONS TABLE
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (subscriber_id = auth.uid() OR creator_id = auth.uid());

CREATE POLICY "Authenticated users can insert subscriptions"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (subscriber_id = auth.uid());

CREATE POLICY "Users can update their own subscriptions"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (subscriber_id = auth.uid());

-- 5. SERVICE_LISTINGS TABLE
CREATE TABLE public.service_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_gbp NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings"
  ON public.service_listings FOR SELECT
  USING (is_active = true OR creator_id = auth.uid());

CREATE POLICY "Creators can insert own listings"
  ON public.service_listings FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can update own listings"
  ON public.service_listings FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY "Creators can delete own listings"
  ON public.service_listings FOR DELETE
  TO authenticated
  USING (creator_id = auth.uid());

-- 6. SERVICE_ENQUIRIES TABLE
CREATE TABLE public.service_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.service_listings(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_enquiries ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an enquiry
CREATE POLICY "Anyone can submit an enquiry"
  ON public.service_enquiries FOR INSERT
  WITH CHECK (true);

-- Creators can view enquiries for their listings
CREATE POLICY "Creators can view enquiries for own listings"
  ON public.service_enquiries FOR SELECT
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM public.service_listings WHERE creator_id = auth.uid()
    )
  );

-- Admins can view all enquiries
CREATE POLICY "Admins can view all enquiries"
  ON public.service_enquiries FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 7. STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-files', 'content-files', true);

-- Public read access
CREATE POLICY "Anyone can read content files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-files');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload content files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'content-files');

-- Users can update their own uploads
CREATE POLICY "Users can update own content files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'content-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own uploads
CREATE POLICY "Users can delete own content files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'content-files' AND auth.uid()::text = (storage.foldername(name))[1]);
