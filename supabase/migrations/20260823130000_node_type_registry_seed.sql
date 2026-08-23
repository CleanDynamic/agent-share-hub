-- =============================================================================
-- NeoScale — node type registry seed (NS-P02)
-- =============================================================================
-- Seeds the 26 rows of public.node_types created empty by NS-P01. Touches no
-- table definition, no existing table and no existing row.
--
-- THE PAYLOAD SCHEMA DIALECT
-- --------------------------
-- node_types.schema is NOT JSON Schema. It is a deliberately constrained
-- object the inspector can render generically without per-type code:
--
--   { "fields": [ { "key": ..., "label": ..., "type": ...,
--                   "required": ..., "help": ...,
--                   "options": [...], "of": [...], "format": ... } ] }
--
-- "type" is one of exactly six values and no others:
--
--   string   single-line text input
--   text     multi-line textarea
--   number   numeric input
--   boolean  toggle
--   enum     select, values taken from "options"
--   list     repeating group; "of" is an array of field definitions using the
--            same six types. ONE LEVEL OF NESTING ONLY — a field inside "of"
--            never itself carries "of".
--
-- "format" is an optional hint on a string field, one of: node_id, media_id,
-- url, timestamp. It changes which widget is rendered later; it does NOT
-- change the storage type, which stays string.
--
-- Six types is the contract. Do not introduce a seventh anywhere in this
-- sequence without changing this comment and the rows below together.
--
-- COLOUR maps onto the existing badge system: one colour per category, with
-- two documented overrides (agent_config, and the two red narrative rows).
-- RENDERER is the category name, except for the six rows whose payload needs
-- bespoke presentation, which name themselves.
-- ICONS are lucide-react component names, each verified to exist in the
-- installed version (0.462.0) rather than guessed.
--
-- The insert is written ON CONFLICT DO UPDATE so the registry can be re-seeded
-- from this file as the single source of truth without duplicating rows.
-- =============================================================================

INSERT INTO public.node_types
  (key, label, category, colour, icon, renderer, copyable, is_active, sort, schema)
VALUES

-- =============================================================================
-- instruction — #E8571A
-- =============================================================================

('prompt', 'Prompt', 'instruction', '#E8571A', 'MessageSquare', 'prompt', true, true, 1, '{
  "fields": [
    { "key": "text", "label": "Prompt text", "type": "text", "required": true },
    { "key": "variables", "label": "Variables", "type": "list", "of": [
        { "key": "name", "label": "Name", "type": "string" },
        { "key": "description", "label": "Description", "type": "string" },
        { "key": "example", "label": "Example", "type": "string" }
      ] },
    { "key": "model", "label": "Model", "type": "string" },
    { "key": "params", "label": "Parameters", "type": "text" },
    { "key": "sent_at", "label": "Sent at", "type": "string", "format": "timestamp" },
    { "key": "output_ref", "label": "Output", "type": "string", "format": "node_id", "help": "The node this prompt produced" }
  ]
}'::jsonb),

('system_prompt', 'System prompt', 'instruction', '#E8571A', 'ScrollText', 'instruction', true, true, 2, '{
  "fields": [
    { "key": "text", "label": "System prompt", "type": "text", "required": true },
    { "key": "model", "label": "Model", "type": "string" },
    { "key": "scope", "label": "Scope", "type": "string", "help": "Where this system prompt applies" },
    { "key": "version", "label": "Version", "type": "string" }
  ]
}'::jsonb),

-- =============================================================================
-- configuration — #22C55E, agent_config overridden to #7C3AED
-- =============================================================================

('model_params', 'Model parameters', 'configuration', '#22C55E', 'SlidersHorizontal', 'configuration', true, true, 1, '{
  "fields": [
    { "key": "model", "label": "Model", "type": "string", "required": true },
    { "key": "temperature", "label": "Temperature", "type": "number" },
    { "key": "max_tokens", "label": "Max tokens", "type": "number" },
    { "key": "top_p", "label": "Top P", "type": "number" },
    { "key": "context_window", "label": "Context window", "type": "number" },
    { "key": "seed", "label": "Seed", "type": "string" }
  ]
}'::jsonb),

('agent_config', 'Agent configuration', 'configuration', '#7C3AED', 'Bot', 'agent_config', true, true, 2, '{
  "fields": [
    { "key": "system_prompt", "label": "System prompt", "type": "text", "required": true },
    { "key": "model", "label": "Model", "type": "string", "required": true },
    { "key": "temperature", "label": "Temperature", "type": "number" },
    { "key": "max_tokens", "label": "Max tokens", "type": "number" },
    { "key": "top_p", "label": "Top P", "type": "number" },
    { "key": "tools", "label": "Tools", "type": "list", "of": [
        { "key": "tool_ref", "label": "Tool", "type": "string", "format": "node_id" }
      ] },
    { "key": "memory", "label": "Memory", "type": "text" },
    { "key": "guardrails", "label": "Guardrails", "type": "list", "of": [
        { "key": "rule", "label": "Rule", "type": "string" }
      ] },
    { "key": "test_passing", "label": "Tests passing", "type": "number" },
    { "key": "test_total", "label": "Tests total", "type": "number" },
    { "key": "test_run_at", "label": "Tests run at", "type": "string", "format": "timestamp" }
  ]
}'::jsonb),

('tool_definition', 'Tool definition', 'configuration', '#22C55E', 'Wrench', 'configuration', true, true, 3, '{
  "fields": [
    { "key": "name", "label": "Name", "type": "string", "required": true },
    { "key": "description", "label": "Description", "type": "text" },
    { "key": "parameters", "label": "Parameters", "type": "text", "help": "The parameter schema the model is shown" },
    { "key": "returns", "label": "Returns", "type": "text" }
  ]
}'::jsonb),

('integration', 'Integration', 'configuration', '#22C55E', 'Plug', 'configuration', false, true, 4, '{
  "fields": [
    { "key": "service", "label": "Service", "type": "string", "required": true },
    { "key": "auth_method", "label": "Auth method", "type": "string" },
    { "key": "scopes", "label": "Scopes", "type": "string", "help": "Comma separated" },
    { "key": "notes", "label": "Notes", "type": "text" }
  ]
}'::jsonb),

('stack', 'Stack', 'configuration', '#22C55E', 'Layers', 'configuration', false, true, 5, '{
  "fields": [
    { "key": "layers", "label": "Layers", "type": "list", "required": true, "of": [
        { "key": "layer", "label": "Layer", "type": "string" },
        { "key": "tool", "label": "Tool", "type": "string" },
        { "key": "version", "label": "Version", "type": "string" }
      ] },
    { "key": "notes", "label": "Notes", "type": "text" }
  ]
}'::jsonb),

-- =============================================================================
-- data — #3B82F6
-- =============================================================================

('dataset', 'Dataset', 'data', '#3B82F6', 'Database', 'data', false, true, 1, '{
  "fields": [
    { "key": "description", "label": "Description", "type": "text", "required": true },
    { "key": "record_count", "label": "Record count", "type": "number" },
    { "key": "format", "label": "Format", "type": "string" },
    { "key": "source", "label": "Source", "type": "string" },
    { "key": "sample", "label": "Sample records", "type": "list", "help": "Max 5", "of": [
        { "key": "record", "label": "Record", "type": "text" }
      ] },
    { "key": "chunk_strategy", "label": "Chunk strategy", "type": "string" },
    { "key": "chunk_size", "label": "Chunk size", "type": "number" },
    { "key": "chunk_overlap", "label": "Chunk overlap", "type": "number" },
    { "key": "embedding_model", "label": "Embedding model", "type": "string" },
    { "key": "licence", "label": "Licence", "type": "string" }
  ]
}'::jsonb),

('retrieval_config', 'Retrieval configuration', 'data', '#3B82F6', 'Search', 'data', true, true, 2, '{
  "fields": [
    { "key": "strategy", "label": "Strategy", "type": "string", "required": true },
    { "key": "top_k", "label": "Top K", "type": "number" },
    { "key": "reranker", "label": "Reranker", "type": "string" },
    { "key": "filters", "label": "Filters", "type": "text" }
  ]
}'::jsonb),

('data_schema', 'Data schema', 'data', '#3B82F6', 'FileJson', 'data', true, true, 3, '{
  "fields": [
    { "key": "format", "label": "Format", "type": "string", "help": "For example JSON Schema, SQL DDL, TypeScript types" },
    { "key": "definition", "label": "Definition", "type": "text", "required": true }
  ]
}'::jsonb),

('test_set', 'Test set', 'data', '#3B82F6', 'FlaskConical', 'data', false, true, 4, '{
  "fields": [
    { "key": "description", "label": "Description", "type": "text", "required": true },
    { "key": "case_count", "label": "Case count", "type": "number" },
    { "key": "sample", "label": "Sample cases", "type": "list", "help": "Max 5", "of": [
        { "key": "input", "label": "Input", "type": "text" },
        { "key": "expected", "label": "Expected", "type": "text" }
      ] },
    { "key": "pass_criteria", "label": "Pass criteria", "type": "text" }
  ]
}'::jsonb),

-- =============================================================================
-- artefact — #F59E0B
-- =============================================================================

('code', 'Code', 'artefact', '#F59E0B', 'Code2', 'artefact', true, true, 1, '{
  "fields": [
    { "key": "language", "label": "Language", "type": "enum", "options": [
        "ts", "tsx", "js", "jsx", "python", "sql", "json", "yaml", "bash", "html", "css", "other"
      ] },
    { "key": "source", "label": "Source", "type": "text", "required": true },
    { "key": "filename", "label": "Filename", "type": "string" },
    { "key": "entrypoint", "label": "Entrypoint", "type": "boolean", "help": "Start reading here" }
  ]
}'::jsonb),

('live_app', 'Live app', 'artefact', '#F59E0B', 'Globe', 'artefact', false, true, 2, '{
  "fields": [
    { "key": "url", "label": "URL", "type": "string", "format": "url", "required": true },
    { "key": "embeddable", "label": "Embeddable", "type": "boolean", "help": "Can be shown in an iframe" },
    { "key": "credentials_note", "label": "Credentials note", "type": "text", "help": "How a visitor signs in, if they must" }
  ]
}'::jsonb),

('repo', 'Repository', 'artefact', '#F59E0B', 'GitBranch', 'artefact', false, true, 3, '{
  "fields": [
    { "key": "url", "label": "URL", "type": "string", "format": "url", "required": true },
    { "key": "stars", "label": "Stars", "type": "number" },
    { "key": "default_branch", "label": "Default branch", "type": "string" }
  ]
}'::jsonb),

('generated_media', 'Generated media', 'artefact', '#F59E0B', 'Image', 'generated_media', false, true, 4, '{
  "fields": [
    { "key": "prompt", "label": "Prompt", "type": "text", "required": true },
    { "key": "model", "label": "Model", "type": "string", "required": true },
    { "key": "seed", "label": "Seed", "type": "string" },
    { "key": "params", "label": "Parameters", "type": "text" },
    { "key": "variants", "label": "Variants", "type": "list", "of": [
        { "key": "media_id", "label": "Media", "type": "string", "format": "media_id" },
        { "key": "chosen", "label": "Chosen", "type": "boolean" },
        { "key": "note", "label": "Note", "type": "string" }
      ] }
  ]
}'::jsonb),

('document', 'Document', 'artefact', '#F59E0B', 'FileText', 'artefact', false, true, 5, '{
  "fields": [
    { "key": "title", "label": "Title", "type": "string", "required": true },
    { "key": "url", "label": "URL", "type": "string", "format": "url" },
    { "key": "summary", "label": "Summary", "type": "text" }
  ]
}'::jsonb),

-- =============================================================================
-- evidence — #2EC4B6
-- =============================================================================

('result', 'Result', 'evidence', '#2EC4B6', 'BarChart3', 'evidence', false, true, 1, '{
  "fields": [
    { "key": "summary", "label": "Summary", "type": "text", "required": true },
    { "key": "metric", "label": "Metric", "type": "string" },
    { "key": "value", "label": "Value", "type": "string" },
    { "key": "media_id", "label": "Media", "type": "string", "format": "media_id" }
  ]
}'::jsonb),

('comparison_table', 'Comparison table', 'evidence', '#2EC4B6', 'Table2', 'comparison_table', false, true, 2, '{
  "fields": [
    { "key": "columns", "label": "Columns", "type": "list", "required": true, "of": [
        { "key": "key", "label": "Key", "type": "string" },
        { "key": "label", "label": "Label", "type": "string" },
        { "key": "type", "label": "Type", "type": "enum", "options": ["string", "number", "boolean"] }
      ] },
    { "key": "rows", "label": "Rows", "type": "list", "of": [
        { "key": "cells", "label": "Cells", "type": "text", "help": "One value per column, in column order" }
      ] },
    { "key": "winner", "label": "Winner", "type": "string" },
    { "key": "method", "label": "Method", "type": "text" },
    { "key": "n", "label": "Sample size", "type": "number" }
  ]
}'::jsonb),

('eval_run', 'Eval run', 'evidence', '#2EC4B6', 'Gauge', 'evidence', false, true, 3, '{
  "fields": [
    { "key": "harness", "label": "Harness", "type": "string" },
    { "key": "dataset_ref", "label": "Dataset", "type": "string", "format": "node_id" },
    { "key": "score", "label": "Score", "type": "number" },
    { "key": "passed", "label": "Passed", "type": "number" },
    { "key": "total", "label": "Total", "type": "number" },
    { "key": "run_at", "label": "Run at", "type": "string", "format": "timestamp" }
  ]
}'::jsonb),

('screenshot', 'Screenshot', 'evidence', '#2EC4B6', 'Camera', 'evidence', false, true, 4, '{
  "fields": [
    { "key": "media_id", "label": "Media", "type": "string", "format": "media_id", "required": true },
    { "key": "caption", "label": "Caption", "type": "string" }
  ]
}'::jsonb),

('recording', 'Recording', 'evidence', '#2EC4B6', 'Video', 'evidence', false, true, 5, '{
  "fields": [
    { "key": "media_id", "label": "Media", "type": "string", "format": "media_id", "required": true },
    { "key": "caption", "label": "Caption", "type": "string" },
    { "key": "duration", "label": "Duration", "type": "number", "help": "Seconds" }
  ]
}'::jsonb),

-- =============================================================================
-- narrative — #9CA3AF, breakage and gap overridden to #EF4444
-- =============================================================================

('note', 'Note', 'narrative', '#9CA3AF', 'StickyNote', 'narrative', false, true, 1, '{
  "fields": [
    { "key": "body", "label": "Note", "type": "text", "required": true }
  ]
}'::jsonb),

('decision', 'Decision', 'narrative', '#9CA3AF', 'GitFork', 'narrative', false, true, 2, '{
  "fields": [
    { "key": "decision", "label": "Decision", "type": "text", "required": true },
    { "key": "alternatives", "label": "Alternatives considered", "type": "text" },
    { "key": "rationale", "label": "Rationale", "type": "text" }
  ]
}'::jsonb),

('breakage', 'Breakage', 'narrative', '#EF4444', 'TriangleAlert', 'breakage', false, true, 3, '{
  "fields": [
    { "key": "symptom", "label": "Symptom", "type": "text", "required": true },
    { "key": "cause", "label": "Cause", "type": "text" },
    { "key": "resolution", "label": "Resolution", "type": "text" },
    { "key": "attempts", "label": "Attempts", "type": "number" },
    { "key": "event_start", "label": "First event", "type": "number", "help": "Event ordinal where it broke" },
    { "key": "event_end", "label": "Last event", "type": "number", "help": "Event ordinal where it was fixed" }
  ]
}'::jsonb),

('prerequisite', 'Prerequisite', 'narrative', '#9CA3AF', 'ListChecks', 'narrative', false, true, 4, '{
  "fields": [
    { "key": "requirement", "label": "Requirement", "type": "text", "required": true },
    { "key": "why", "label": "Why it is needed", "type": "text" },
    { "key": "optional", "label": "Optional", "type": "boolean" }
  ]
}'::jsonb),

('gap', 'Gap', 'narrative', '#EF4444', 'CircleHelp', 'gap', false, true, 5, '{
  "fields": [
    { "key": "problem", "label": "Problem", "type": "text", "required": true },
    { "key": "what_i_tried", "label": "What was tried", "type": "text" },
    { "key": "acceptance_criteria", "label": "Acceptance criteria", "type": "text", "help": "How someone would know they have solved it" },
    { "key": "reward_note", "label": "Reward", "type": "text" }
  ]
}'::jsonb)

ON CONFLICT (key) DO UPDATE SET
  label     = EXCLUDED.label,
  category  = EXCLUDED.category,
  colour    = EXCLUDED.colour,
  icon      = EXCLUDED.icon,
  renderer  = EXCLUDED.renderer,
  copyable  = EXCLUDED.copyable,
  is_active = EXCLUDED.is_active,
  sort      = EXCLUDED.sort,
  schema    = EXCLUDED.schema;
