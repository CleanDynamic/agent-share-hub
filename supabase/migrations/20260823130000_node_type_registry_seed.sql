-- =============================================================================
-- NeoScale — node type registry seed (NS-P02)
-- =============================================================================
-- Seeds the 26 node types created empty by NS-P01. No table definitions are
-- changed here; this migration only inserts rows.
--
-- THE PAYLOAD SCHEMA DIALECT
-- --------------------------
-- node_types.schema is NOT JSON Schema. It is a constrained object the
-- inspector renders generically:
--
--   { "fields": [ { "key", "label", "type", "required", "help",
--                   "options", "of", "format" } ] }
--
-- "type" is one of exactly six values and no others:
--   string   single-line text input
--   text     multi-line textarea
--   number   numeric input
--   boolean  toggle
--   enum     select, values from "options"
--   list     repeating group; "of" is an array of field definitions using the
--            same six types, one level of nesting only
--
-- "format" is an optional hint on a string field, one of: node_id, media_id,
-- url, timestamp. It changes the widget; it does not change the storage type.
--
-- Six types is the contract. Do not introduce a seventh without changing this
-- comment and everything downstream that switches on it.
--
-- "required" is omitted rather than written as false, so a field carrying the
-- key is always a required field. Readers must treat absent as false.
--
-- sort is globally ascending in category order, in steps of 10, so a plain
-- ORDER BY sort yields the picker listing and is also ascending within each
-- category. The gaps leave room to insert types later without a renumber.
--
-- icon is a lucide-react export name (PascalCase), matching the convention
-- already used by public.badges.icon_name. Every name below was checked
-- against the installed lucide-react 0.462.0.
-- =============================================================================


-- =============================================================================
-- instruction — #E8571A
-- =============================================================================
INSERT INTO public.node_types (key, label, category, colour, icon, renderer, copyable, is_active, sort, schema) VALUES
('prompt', 'Prompt', 'instruction', '#E8571A', 'MessageSquare', 'prompt', true, true, 10, '{
  "fields": [
    {"key": "text", "label": "Prompt", "type": "text", "required": true},
    {"key": "variables", "label": "Variables", "type": "list", "of": [
      {"key": "name", "label": "Name", "type": "string"},
      {"key": "description", "label": "Description", "type": "string"},
      {"key": "example", "label": "Example", "type": "string"}
    ]},
    {"key": "model", "label": "Model", "type": "string"},
    {"key": "params", "label": "Parameters", "type": "text"},
    {"key": "sent_at", "label": "Sent at", "type": "string", "format": "timestamp"},
    {"key": "output_ref", "label": "Output", "type": "string", "format": "node_id"}
  ]
}'),

('system_prompt', 'System Prompt', 'instruction', '#E8571A', 'ScrollText', 'instruction', true, true, 20, '{
  "fields": [
    {"key": "content", "label": "System prompt", "type": "text", "required": true},
    {"key": "model", "label": "Model", "type": "string"},
    {"key": "version", "label": "Version", "type": "string"},
    {"key": "token_estimate", "label": "Token estimate", "type": "number"}
  ]
}');


-- =============================================================================
-- configuration — #22C55E, except agent_config (#7C3AED)
-- =============================================================================
INSERT INTO public.node_types (key, label, category, colour, icon, renderer, copyable, is_active, sort, schema) VALUES
('model_params', 'Model Parameters', 'configuration', '#22C55E', 'SlidersHorizontal', 'configuration', true, true, 30, '{
  "fields": [
    {"key": "model", "label": "Model", "type": "string", "required": true},
    {"key": "temperature", "label": "Temperature", "type": "number"},
    {"key": "max_tokens", "label": "Max tokens", "type": "number"},
    {"key": "top_p", "label": "Top p", "type": "number"},
    {"key": "context_window", "label": "Context window", "type": "number"},
    {"key": "seed", "label": "Seed", "type": "string"}
  ]
}'),

('agent_config', 'Agent Config', 'configuration', '#7C3AED', 'Bot', 'agent_config', true, true, 40, '{
  "fields": [
    {"key": "system_prompt", "label": "System prompt", "type": "text", "required": true},
    {"key": "model", "label": "Model", "type": "string", "required": true},
    {"key": "temperature", "label": "Temperature", "type": "number"},
    {"key": "max_tokens", "label": "Max tokens", "type": "number"},
    {"key": "top_p", "label": "Top p", "type": "number"},
    {"key": "tools", "label": "Tools", "type": "list", "of": [
      {"key": "tool_ref", "label": "Tool", "type": "string", "format": "node_id"}
    ]},
    {"key": "memory", "label": "Memory", "type": "text"},
    {"key": "guardrails", "label": "Guardrails", "type": "list", "of": [
      {"key": "rule", "label": "Rule", "type": "string"}
    ]},
    {"key": "test_passing", "label": "Tests passing", "type": "number"},
    {"key": "test_total", "label": "Tests total", "type": "number"},
    {"key": "test_run_at", "label": "Tests run at", "type": "string", "format": "timestamp"}
  ]
}'),

('tool_definition', 'Tool Definition', 'configuration', '#22C55E', 'Wrench', 'configuration', true, true, 50, '{
  "fields": [
    {"key": "name", "label": "Name", "type": "string", "required": true},
    {"key": "description", "label": "Description", "type": "text"},
    {"key": "parameters", "label": "Parameters", "type": "text"},
    {"key": "returns", "label": "Returns", "type": "text"}
  ]
}'),

('integration', 'Integration', 'configuration', '#22C55E', 'Plug', 'configuration', false, true, 60, '{
  "fields": [
    {"key": "service", "label": "Service", "type": "string", "required": true},
    {"key": "auth_method", "label": "Auth method", "type": "string"},
    {"key": "scopes", "label": "Scopes", "type": "list", "of": [
      {"key": "scope", "label": "Scope", "type": "string"}
    ]},
    {"key": "notes", "label": "Notes", "type": "text"}
  ]
}'),

('stack', 'Stack', 'configuration', '#22C55E', 'Layers', 'configuration', false, true, 70, '{
  "fields": [
    {"key": "layers", "label": "Layers", "type": "list", "required": true, "of": [
      {"key": "layer", "label": "Layer", "type": "string"},
      {"key": "tool", "label": "Tool", "type": "string"},
      {"key": "version", "label": "Version", "type": "string"}
    ]}
  ]
}');


-- =============================================================================
-- data — #3B82F6
-- =============================================================================
INSERT INTO public.node_types (key, label, category, colour, icon, renderer, copyable, is_active, sort, schema) VALUES
('dataset', 'Dataset', 'data', '#3B82F6', 'Database', 'data', false, true, 80, '{
  "fields": [
    {"key": "description", "label": "Description", "type": "text", "required": true},
    {"key": "record_count", "label": "Record count", "type": "number"},
    {"key": "format", "label": "Format", "type": "string"},
    {"key": "source", "label": "Source", "type": "string"},
    {"key": "sample", "label": "Sample", "type": "list", "help": "max 5", "of": [
      {"key": "record", "label": "Record", "type": "text"}
    ]},
    {"key": "chunk_strategy", "label": "Chunk strategy", "type": "string"},
    {"key": "chunk_size", "label": "Chunk size", "type": "number"},
    {"key": "chunk_overlap", "label": "Chunk overlap", "type": "number"},
    {"key": "embedding_model", "label": "Embedding model", "type": "string"},
    {"key": "licence", "label": "Licence", "type": "string"}
  ]
}'),

('retrieval_config', 'Retrieval Config', 'data', '#3B82F6', 'Search', 'data', true, true, 90, '{
  "fields": [
    {"key": "strategy", "label": "Strategy", "type": "string", "required": true},
    {"key": "top_k", "label": "Top k", "type": "number"},
    {"key": "reranker", "label": "Reranker", "type": "string"},
    {"key": "filters", "label": "Filters", "type": "text"}
  ]
}'),

('data_schema', 'Data Schema', 'data', '#3B82F6', 'Table2', 'data', true, true, 100, '{
  "fields": [
    {"key": "format", "label": "Format", "type": "string"},
    {"key": "definition", "label": "Definition", "type": "text", "required": true}
  ]
}'),

('test_set', 'Test Set', 'data', '#3B82F6', 'FlaskConical', 'data', false, true, 110, '{
  "fields": [
    {"key": "description", "label": "Description", "type": "text", "required": true},
    {"key": "case_count", "label": "Case count", "type": "number"},
    {"key": "sample", "label": "Sample cases", "type": "list", "help": "max 5", "of": [
      {"key": "input", "label": "Input", "type": "text"},
      {"key": "expected", "label": "Expected", "type": "text"}
    ]},
    {"key": "pass_criteria", "label": "Pass criteria", "type": "text"}
  ]
}');


-- =============================================================================
-- artefact — #F59E0B
-- =============================================================================
INSERT INTO public.node_types (key, label, category, colour, icon, renderer, copyable, is_active, sort, schema) VALUES
('code', 'Code', 'artefact', '#F59E0B', 'Code2', 'artefact', true, true, 120, '{
  "fields": [
    {"key": "language", "label": "Language", "type": "enum", "options": [
      "ts", "tsx", "js", "jsx", "python", "sql", "json", "yaml", "bash", "html", "css", "other"
    ]},
    {"key": "source", "label": "Source", "type": "text", "required": true},
    {"key": "filename", "label": "Filename", "type": "string"},
    {"key": "entrypoint", "label": "Entrypoint", "type": "boolean"}
  ]
}'),

('live_app', 'Live App', 'artefact', '#F59E0B', 'MonitorPlay', 'artefact', false, true, 130, '{
  "fields": [
    {"key": "url", "label": "URL", "type": "string", "format": "url", "required": true},
    {"key": "embeddable", "label": "Embeddable", "type": "boolean"},
    {"key": "credentials_note", "label": "Credentials", "type": "text", "help": "how a visitor signs in, if they need to"}
  ]
}'),

('repo', 'Repository', 'artefact', '#F59E0B', 'GitBranch', 'artefact', false, true, 140, '{
  "fields": [
    {"key": "url", "label": "URL", "type": "string", "format": "url", "required": true},
    {"key": "stars", "label": "Stars", "type": "number"},
    {"key": "default_branch", "label": "Default branch", "type": "string"}
  ]
}'),

('generated_media', 'Generated Media', 'artefact', '#F59E0B', 'Image', 'generated_media', false, true, 150, '{
  "fields": [
    {"key": "prompt", "label": "Prompt", "type": "text", "required": true},
    {"key": "model", "label": "Model", "type": "string", "required": true},
    {"key": "seed", "label": "Seed", "type": "string"},
    {"key": "params", "label": "Parameters", "type": "text"},
    {"key": "variants", "label": "Variants", "type": "list", "of": [
      {"key": "media_id", "label": "Media", "type": "string", "format": "media_id"},
      {"key": "chosen", "label": "Chosen", "type": "boolean"},
      {"key": "note", "label": "Note", "type": "string"}
    ]}
  ]
}'),

('document', 'Document', 'artefact', '#F59E0B', 'FileText', 'artefact', false, true, 160, '{
  "fields": [
    {"key": "title", "label": "Title", "type": "string", "required": true},
    {"key": "url", "label": "URL", "type": "string", "format": "url"},
    {"key": "summary", "label": "Summary", "type": "text"}
  ]
}');


-- =============================================================================
-- evidence — #2EC4B6
-- =============================================================================
INSERT INTO public.node_types (key, label, category, colour, icon, renderer, copyable, is_active, sort, schema) VALUES
('result', 'Result', 'evidence', '#2EC4B6', 'Target', 'evidence', false, true, 170, '{
  "fields": [
    {"key": "summary", "label": "Summary", "type": "text", "required": true},
    {"key": "metric", "label": "Metric", "type": "string"},
    {"key": "value", "label": "Value", "type": "string", "help": "keep the units, e.g. 2.3x or 40ms"},
    {"key": "media_id", "label": "Media", "type": "string", "format": "media_id"}
  ]
}'),

('comparison_table', 'Comparison Table', 'evidence', '#2EC4B6', 'Columns3', 'comparison_table', false, true, 180, '{
  "fields": [
    {"key": "columns", "label": "Columns", "type": "list", "of": [
      {"key": "key", "label": "Key", "type": "string"},
      {"key": "label", "label": "Label", "type": "string"},
      {"key": "type", "label": "Type", "type": "enum", "options": ["string", "number", "boolean"]}
    ]},
    {"key": "rows", "label": "Rows", "type": "list", "of": [
      {"key": "cells", "label": "Cells", "type": "text"}
    ]},
    {"key": "winner", "label": "Winner", "type": "string"},
    {"key": "method", "label": "Method", "type": "text"},
    {"key": "n", "label": "n", "type": "number"}
  ]
}'),

('eval_run', 'Eval Run', 'evidence', '#2EC4B6', 'Gauge', 'evidence', false, true, 190, '{
  "fields": [
    {"key": "harness", "label": "Harness", "type": "string"},
    {"key": "dataset_ref", "label": "Dataset", "type": "string", "format": "node_id"},
    {"key": "score", "label": "Score", "type": "number"},
    {"key": "passed", "label": "Passed", "type": "number"},
    {"key": "total", "label": "Total", "type": "number"},
    {"key": "run_at", "label": "Run at", "type": "string", "format": "timestamp"}
  ]
}'),

('screenshot', 'Screenshot', 'evidence', '#2EC4B6', 'Camera', 'evidence', false, true, 200, '{
  "fields": [
    {"key": "media_id", "label": "Media", "type": "string", "format": "media_id", "required": true},
    {"key": "caption", "label": "Caption", "type": "string"}
  ]
}'),

('recording', 'Recording', 'evidence', '#2EC4B6', 'Video', 'evidence', false, true, 210, '{
  "fields": [
    {"key": "media_id", "label": "Media", "type": "string", "format": "media_id", "required": true},
    {"key": "caption", "label": "Caption", "type": "string"},
    {"key": "duration", "label": "Duration", "type": "number", "help": "seconds"}
  ]
}');


-- =============================================================================
-- narrative — #9CA3AF, except breakage and gap (#EF4444)
-- =============================================================================
INSERT INTO public.node_types (key, label, category, colour, icon, renderer, copyable, is_active, sort, schema) VALUES
('note', 'Note', 'narrative', '#9CA3AF', 'StickyNote', 'narrative', false, true, 220, '{
  "fields": [
    {"key": "body", "label": "Note", "type": "text", "required": true}
  ]
}'),

('decision', 'Decision', 'narrative', '#9CA3AF', 'GitFork', 'narrative', false, true, 230, '{
  "fields": [
    {"key": "decision", "label": "Decision", "type": "text", "required": true},
    {"key": "alternatives", "label": "Alternatives", "type": "text"},
    {"key": "rationale", "label": "Rationale", "type": "text"}
  ]
}'),

('breakage', 'Breakage', 'narrative', '#EF4444', 'AlertTriangle', 'breakage', false, true, 240, '{
  "fields": [
    {"key": "symptom", "label": "Symptom", "type": "text", "required": true},
    {"key": "cause", "label": "Cause", "type": "text"},
    {"key": "resolution", "label": "Resolution", "type": "text"},
    {"key": "attempts", "label": "Attempts", "type": "number"},
    {"key": "event_start", "label": "First event", "type": "number"},
    {"key": "event_end", "label": "Last event", "type": "number"}
  ]
}'),

('prerequisite', 'Prerequisite', 'narrative', '#9CA3AF', 'ListChecks', 'narrative', false, true, 250, '{
  "fields": [
    {"key": "requirement", "label": "Requirement", "type": "text", "required": true},
    {"key": "why", "label": "Why", "type": "text"},
    {"key": "optional", "label": "Optional", "type": "boolean"}
  ]
}'),

('gap', 'Gap', 'narrative', '#EF4444', 'HelpCircle', 'gap', false, true, 260, '{
  "fields": [
    {"key": "problem", "label": "Problem", "type": "text", "required": true},
    {"key": "what_i_tried", "label": "What I tried", "type": "text"},
    {"key": "acceptance_criteria", "label": "Acceptance criteria", "type": "text"},
    {"key": "reward_note", "label": "Reward", "type": "text"}
  ]
}');
