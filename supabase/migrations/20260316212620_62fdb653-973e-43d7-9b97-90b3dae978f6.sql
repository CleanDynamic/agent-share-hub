
-- Add new columns to ai_tools_registry
ALTER TABLE public.ai_tools_registry
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;

-- Update seed data with descriptions, slugs, website URLs, categories, and is_official
UPDATE public.ai_tools_registry SET slug = 'any-tool', description = 'Universal compatibility — works with any AI tool', website_url = NULL, category = 'other', is_official = true WHERE name = 'Any Tool';
UPDATE public.ai_tools_registry SET slug = 'chatgpt', description = 'AI chatbot by OpenAI for conversation, writing, and coding', website_url = 'https://chat.openai.com', category = 'ai_chat', is_official = true WHERE name = 'ChatGPT';
UPDATE public.ai_tools_registry SET slug = 'claude', description = 'AI assistant by Anthropic for analysis, writing, and coding', website_url = 'https://claude.ai', category = 'ai_chat', is_official = true WHERE name = 'Claude';
UPDATE public.ai_tools_registry SET slug = 'gemini', description = 'Google AI for multimodal reasoning and conversation', website_url = 'https://gemini.google.com', category = 'ai_chat', is_official = true WHERE name = 'Gemini';
UPDATE public.ai_tools_registry SET slug = 'grok', description = 'AI assistant by xAI with real-time knowledge', website_url = 'https://grok.x.ai', category = 'ai_chat', is_official = true WHERE name = 'Grok';
UPDATE public.ai_tools_registry SET slug = 'zapier', description = 'No-code automation platform connecting 6000+ apps', website_url = 'https://zapier.com', category = 'automation', is_official = true WHERE name = 'Zapier';
UPDATE public.ai_tools_registry SET slug = 'make', description = 'Visual automation platform for complex workflows', website_url = 'https://www.make.com', category = 'automation', is_official = true WHERE name = 'Make';
UPDATE public.ai_tools_registry SET slug = 'n8n', description = 'Open-source workflow automation tool', website_url = 'https://n8n.io', category = 'automation', is_official = true WHERE name = 'n8n';

-- Add unique constraint on slug
ALTER TABLE public.ai_tools_registry ADD CONSTRAINT ai_tools_registry_slug_unique UNIQUE (slug);
