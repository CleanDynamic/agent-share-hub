
-- Create ai_tools_registry table
CREATE TABLE public.ai_tools_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  rejected_reason text,
  CONSTRAINT ai_tools_registry_name_unique UNIQUE (name)
);

-- Enable RLS
ALTER TABLE public.ai_tools_registry ENABLE ROW LEVEL SECURITY;

-- Public can read approved tools
CREATE POLICY "Anyone can view approved tools"
ON public.ai_tools_registry FOR SELECT
TO public
USING (status = 'approved' OR is_admin(auth.uid()));

-- Authenticated users can submit tools
CREATE POLICY "Authenticated users can submit tools"
ON public.ai_tools_registry FOR INSERT
TO authenticated
WITH CHECK (submitted_by = auth.uid());

-- Admins can update tools (approve/reject)
CREATE POLICY "Admins can update tools"
ON public.ai_tools_registry FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

-- Seed existing tools as approved
INSERT INTO public.ai_tools_registry (name, status, approved_at) VALUES
  ('Any Tool', 'approved', now()),
  ('ChatGPT', 'approved', now()),
  ('Claude', 'approved', now()),
  ('Gemini', 'approved', now()),
  ('Grok', 'approved', now()),
  ('Zapier', 'approved', now()),
  ('Make', 'approved', now()),
  ('n8n', 'approved', now());
