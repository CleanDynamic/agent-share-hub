
-- Add package pricing columns to projects
ALTER TABLE public.projects
  ADD COLUMN package_price_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN package_price_gbp numeric,
  ADD COLUMN package_stripe_price_id text;

-- Create project_package_purchases table
CREATE TABLE public.project_package_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_payment_intent_id text,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  amount_gbp numeric,
  UNIQUE (project_id, user_id)
);

ALTER TABLE public.project_package_purchases ENABLE ROW LEVEL SECURITY;

-- RLS: users can insert their own rows
CREATE POLICY "Users can insert own package purchases"
  ON public.project_package_purchases
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS: users can select their own rows
CREATE POLICY "Users can view own package purchases"
  ON public.project_package_purchases
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- RLS: admins can select all
CREATE POLICY "Admins can view all package purchases"
  ON public.project_package_purchases
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
