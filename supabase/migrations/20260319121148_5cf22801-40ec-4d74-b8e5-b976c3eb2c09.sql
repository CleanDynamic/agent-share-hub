
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS tool_subtype text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS model_parameters text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS model_base_architecture text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS model_format text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS model_license text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS model_run_with text[];
