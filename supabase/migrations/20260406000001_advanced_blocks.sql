-- Subheading on blocks
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS subheading TEXT;

-- Prompt block fields
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS prompt_role TEXT
    DEFAULT 'user'
    CHECK (prompt_role IN ('system','user','assistant','full'));
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS prompt_model TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS prompt_variables JSONB DEFAULT '[]';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS prompt_example_output TEXT;

-- Agent config block fields
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS agent_model TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS agent_temperature NUMERIC(3,2);
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS agent_max_tokens INTEGER;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS agent_tools JSONB DEFAULT '[]';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS agent_memory_type TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS agent_capabilities JSONB DEFAULT '[]';

-- Workflow block fields
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS workflow_trigger TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS workflow_output TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS workflow_steps JSONB DEFAULT '[]';

-- Model params block fields
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS model_name TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS model_temperature NUMERIC(3,2);
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS model_top_p NUMERIC(3,2);
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS model_max_tokens INTEGER;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS model_system_prompt TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS model_stop_sequences JSONB DEFAULT '[]';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS model_reasoning TEXT;

-- Tool setup block fields
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS tool_name TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS tool_url TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS tool_prerequisites JSONB DEFAULT '[]';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS tool_steps JSONB DEFAULT '[]';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS tool_errors JSONB DEFAULT '[]';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS tool_time_estimate TEXT;

-- Code block fields
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS code_language TEXT DEFAULT 'python';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS code_dependencies JSONB DEFAULT '[]';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS code_env_vars JSONB DEFAULT '[]';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS code_run_instructions TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS code_example_output TEXT;

-- Result block fields
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS result_before TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS result_after TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS result_metrics JSONB DEFAULT '[]';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS result_verdict TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS result_rating INTEGER;

-- Comparison block fields (enhanced)
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS comparison_label_a TEXT DEFAULT 'Option A';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS comparison_label_b TEXT DEFAULT 'Option B';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS comparison_type_a TEXT DEFAULT 'text';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS comparison_type_b TEXT DEFAULT 'text';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS comparison_content_a JSONB DEFAULT '{}';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS comparison_content_b JSONB DEFAULT '{}';
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS comparison_axis TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS comparison_verdict TEXT;

-- Resource block fields (enhanced)
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS resource_title TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS resource_type TEXT DEFAULT 'article'
    CHECK (resource_type IN ('paper','tool','video',
      'course','repo','article','other'));
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS resource_annotation TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS resource_is_paywalled BOOLEAN DEFAULT false;
