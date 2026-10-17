-- TF-04: an agent's tool, registered on its node type so payload and schema agree.
UPDATE public.node_types
SET schema = jsonb_set(
  schema,
  '{fields}',
  COALESCE(schema -> 'fields', '[]'::jsonb) || '[{"key":"tool","label":"Runs in","type":"string"}]'::jsonb
)
WHERE key = 'agent_config'
  AND NOT COALESCE(schema -> 'fields', '[]'::jsonb) @> '[{"key":"tool"}]'::jsonb;
