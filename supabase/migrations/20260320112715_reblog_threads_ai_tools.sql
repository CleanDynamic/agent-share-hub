-- ============================================================
-- PART 1: AI Tools Registry — add tag and url columns
-- ============================================================

ALTER TABLE ai_tools_registry ADD COLUMN IF NOT EXISTS tag text;
ALTER TABLE ai_tools_registry ADD COLUMN IF NOT EXISTS url text;

-- Backfill tag and url from existing name / website_url
UPDATE ai_tools_registry SET tag = name WHERE tag IS NULL;
UPDATE ai_tools_registry SET url = website_url WHERE url IS NULL;

-- Replace existing approved entries with the full alphabetical list
DELETE FROM ai_tools_registry WHERE status = 'approved';

INSERT INTO ai_tools_registry (tag, url, description, category, status) VALUES
-- API / WEB AI TOOLS (alphabetical)
('Anthropic API', 'https://console.anthropic.com', 'Direct API access to Claude models', 'api', 'approved'),
('Character.ai', 'https://character.ai', 'Chat with AI personas and characters', 'api', 'approved'),
('ChatGPT', 'https://chatgpt.com', 'OpenAI AI assistant', 'api', 'approved'),
('Claude', 'https://claude.ai', 'Anthropic AI assistant', 'api', 'approved'),
('Copy.ai', 'https://www.copy.ai', 'AI copywriting tool', 'api', 'approved'),
('Coze', 'https://www.coze.com', 'ByteDance no-code AI agent builder', 'api', 'approved'),
('DeepSeek', 'https://chat.deepseek.com', 'High-performance AI chatbot', 'api', 'approved'),
('Gemini', 'https://gemini.google.com', 'Google AI assistant', 'api', 'approved'),
('Grok', 'https://grok.com', 'xAI assistant with real-time X access', 'api', 'approved'),
('Jasper', 'https://www.jasper.ai', 'Enterprise AI writing platform', 'api', 'approved'),
('Meta AI', 'https://www.meta.ai', 'Meta AI assistant', 'api', 'approved'),
('Microsoft Copilot', 'https://copilot.microsoft.com', 'Microsoft GPT-4o assistant', 'api', 'approved'),
('Mistral Le Chat', 'https://chat.mistral.ai', 'Mistral AI assistant', 'api', 'approved'),
('OpenRouter', 'https://openrouter.ai', 'Unified API for 400+ AI models', 'api', 'approved'),
('Perplexity AI', 'https://www.perplexity.ai', 'AI answer engine with citations', 'api', 'approved'),
('Pi', 'https://pi.ai', 'Conversational AI by Inflection', 'api', 'approved'),
('Poe', 'https://poe.com', 'Multi-model AI aggregator', 'api', 'approved'),
('Qwen', 'https://chat.qwen.ai', 'Alibaba multilingual AI assistant', 'api', 'approved'),
('Writesonic', 'https://writesonic.com', 'AI writing and SEO platform', 'api', 'approved'),
('You.com', 'https://you.com', 'AI search assistant', 'api', 'approved'),
-- LOCAL RUNTIMES (alphabetical)
('AnythingLLM', 'https://anythingllm.com', 'All-in-one local AI app with RAG', 'local_runtime', 'approved'),
('GPT4All', 'https://gpt4all.io', 'Beginner-friendly offline AI desktop app', 'local_runtime', 'approved'),
('Jan.ai', 'https://jan.ai', 'Privacy-first offline AI desktop app', 'local_runtime', 'approved'),
('KoboldCpp', 'https://github.com/LostRuins/koboldcpp', 'Local LLM for creative writing', 'local_runtime', 'approved'),
('LibreChat', 'https://librechat.ai', 'Self-hosted multi-provider chat platform', 'local_runtime', 'approved'),
('LM Studio', 'https://lmstudio.ai', 'Desktop GUI for running local models', 'local_runtime', 'approved'),
('llama.cpp', 'https://github.com/ggml-org/llama.cpp', 'C++ inference engine for local LLMs', 'local_runtime', 'approved'),
('llamafile', 'https://github.com/Mozilla-Ocho/llamafile', 'Single-file executable local LLM', 'local_runtime', 'approved'),
('LocalAI', 'https://localai.io', 'Self-hosted OpenAI-compatible API server', 'local_runtime', 'approved'),
('Msty', 'https://msty.app', 'Desktop app for local and remote AI', 'local_runtime', 'approved'),
('Ollama', 'https://ollama.com', 'Run open-source models locally via CLI', 'local_runtime', 'approved'),
('Open WebUI', 'https://openwebui.com', 'Self-hosted web interface for Ollama', 'local_runtime', 'approved'),
('Text Generation WebUI', 'https://github.com/oobabooga/text-generation-webui', 'Gradio interface for local LLMs', 'local_runtime', 'approved'),
('vLLM', 'https://vllm.ai', 'Production-grade local inference server', 'local_runtime', 'approved'),
-- AUTOMATION (alphabetical)
('Activepieces', 'https://www.activepieces.com', 'Open-source Zapier alternative', 'automation', 'approved'),
('Bardeen', 'https://www.bardeen.ai', 'AI browser extension automation', 'automation', 'approved'),
('Botpress', 'https://botpress.com', 'Open-source AI chatbot builder', 'automation', 'approved'),
('Dify', 'https://dify.ai', 'Visual AI app builder for RAG and agents', 'automation', 'approved'),
('Flowise', 'https://flowiseai.com', 'Open-source visual LLM flow builder', 'automation', 'approved'),
('Gumloop', 'https://www.gumloop.com', 'Visual AI workflow builder', 'automation', 'approved'),
('IFTTT', 'https://ifttt.com', 'Consumer trigger-action automation', 'automation', 'approved'),
('Langflow', 'https://www.langflow.org', 'Visual AI agent and LLM workflow builder', 'automation', 'approved'),
('Lindy AI', 'https://www.lindy.ai', 'No-code AI agent platform', 'automation', 'approved'),
('Make', 'https://www.make.com', 'Visual scenario automation builder', 'automation', 'approved'),
('Microsoft Power Automate', 'https://powerautomate.microsoft.com', 'Microsoft enterprise automation', 'automation', 'approved'),
('n8n', 'https://n8n.io', 'Open-source workflow automation with AI nodes', 'automation', 'approved'),
('Pabbly Connect', 'https://www.pabbly.com/connect', 'Budget-friendly no-code automation', 'automation', 'approved'),
('Pipedream', 'https://pipedream.com', 'Code-first automation for developers', 'automation', 'approved'),
('Relay.app', 'https://www.relay.app', 'Modern automation with human-in-loop support', 'automation', 'approved'),
('Relevance AI', 'https://relevanceai.com', 'No-code autonomous AI agent platform', 'automation', 'approved'),
('Stack AI', 'https://www.stack-ai.com', 'No-code AI workflow builder', 'automation', 'approved'),
('Typebot', 'https://typebot.io', 'Open-source conversational form builder', 'automation', 'approved'),
('Voiceflow', 'https://www.voiceflow.com', 'No-code voice and text AI agent builder', 'automation', 'approved'),
('Zapier', 'https://zapier.com', 'Most-used no-code automation platform', 'automation', 'approved');

-- Also backfill name from tag for newly inserted rows (name column is NOT NULL)
UPDATE ai_tools_registry SET name = tag WHERE name IS NULL OR name = '';

-- ============================================================
-- PART 2: Reblog Feature
-- ============================================================

-- Add reblog columns to content_items
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS is_reblog boolean DEFAULT false;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS reblog_of_content_id uuid REFERENCES content_items(id) ON DELETE SET NULL;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS reblog_of_creator_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS reblog_comment text;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS like_count integer DEFAULT 0;

-- Create content_likes table
CREATE TABLE IF NOT EXISTS content_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(content_id, user_id)
);

ALTER TABLE content_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'content_likes' AND policyname = 'Users can manage their own likes'
  ) THEN
    CREATE POLICY "Users can manage their own likes"
    ON content_likes FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'content_likes' AND policyname = 'Public can view likes'
  ) THEN
    CREATE POLICY "Public can view likes"
    ON content_likes FOR SELECT TO public USING (true);
  END IF;
END $$;

-- Trigger to update like_count
CREATE OR REPLACE FUNCTION update_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE content_items SET like_count = like_count + 1 WHERE id = NEW.content_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE content_items SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.content_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_like_count ON content_likes;
CREATE TRIGGER trigger_update_like_count
AFTER INSERT OR DELETE ON content_likes
FOR EACH ROW EXECUTE FUNCTION update_like_count();

-- ============================================================
-- PART 3: Blog Threads
-- ============================================================

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS thread_id uuid;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS thread_position integer DEFAULT 1;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS thread_total integer DEFAULT 1;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS is_thread_post boolean DEFAULT false;
