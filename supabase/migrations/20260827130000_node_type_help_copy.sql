-- =============================================================================
-- NeoScale — node type help copy (NS-P30)
-- =============================================================================
-- Rewrites the `help` string on the required field of the twelve most-used
-- node types, so the inspector explains itself to a creator who has never
-- heard the words "system prompt" or "parameter".
--
-- THIS MIGRATION CHANGES COPY AND NOTHING ELSE
-- --------------------------------------------
-- No key, no label, no type, no `required` flag, no `format`, no `options`, no
-- `of`, and no field added or removed. The field array is rebuilt in place with
-- jsonb_set applied per entry, ordered by the ordinality of the array it came
-- from, so every field object comes back byte-identical apart from its `help`.
-- A field this file names no copy for is passed straight through — the help
-- strings the NS-P02 seed put on optional fields (prompt.output_ref,
-- recording.duration, gap.acceptance_criteria and the rest) are left alone.
--
-- Diffing `schema` before and after on any row should show `help` values and
-- nothing else. That is the acceptance test for this file.
--
-- THE VOICE
-- ---------
-- One sentence, addressed to the creator, saying what to put in the box. No
-- jargon: a sentence that needs the field's own label explained to it has
-- failed. No echo of the field name either — "What you decided" under a field
-- called Decision tells nobody anything they could not already see.
--
-- Written against required fields only. A required field is the one a creator
-- cannot skip, so it is the one where not knowing what is wanted stops them.
--
-- Re-runnable: the UPDATE is idempotent and this file is safe to apply twice.
-- =============================================================================

WITH help_copy (type_key, field_key, help) AS (
  VALUES
    -- instruction
    ('prompt',        'text',          'Paste exactly what you typed into the AI.'),
    ('system_prompt', 'text',          'The instructions the AI was given before you said anything to it.'),

    -- configuration
    ('model_params',  'model',         'Which AI you used — the name the app showed you.'),
    ('agent_config',  'system_prompt', 'The standing instructions this agent works from, before anyone talks to it.'),
    ('agent_config',  'model',         'Which AI does the thinking for this agent.'),

    -- artefact
    ('code',          'source',        'Paste the code itself, exactly as it runs.'),

    -- evidence
    ('result',        'summary',       'What happened? One or two sentences.'),
    ('screenshot',    'media_id',      'Upload the picture you want people to see.'),
    ('recording',     'media_id',      'Upload the recording — screen, video or audio.'),

    -- narrative
    ('note',          'body',          'Whatever you want to say here, in your own words.'),
    ('decision',      'decision',      'What you chose to do.'),
    ('breakage',      'symptom',       'What went wrong, in your words.'),
    ('gap',           'problem',       'What you are stuck on, said plainly.')
)
UPDATE public.node_types AS nt
SET schema = jsonb_set(
  nt.schema,
  '{fields}',
  (
    SELECT jsonb_agg(
             CASE
               WHEN h.help IS NULL THEN f.field
               ELSE jsonb_set(f.field, '{help}', to_jsonb(h.help))
             END
             ORDER BY f.ord
           )
    FROM jsonb_array_elements(nt.schema -> 'fields') WITH ORDINALITY AS f(field, ord)
    LEFT JOIN help_copy AS h
      ON h.type_key = nt.key
     AND h.field_key = f.field ->> 'key'
  )
)
WHERE nt.key IN (
  SELECT DISTINCT type_key FROM help_copy
)
-- Rows whose fields array is missing or malformed are skipped rather than
-- flattened into null by jsonb_set.
AND jsonb_typeof(nt.schema -> 'fields') = 'array';


-- =============================================================================
-- Verification — the migration checks its own work
-- =============================================================================
-- Every pair above must have landed on a field that exists and is required. A
-- key renamed in the registry without this file being updated alongside it
-- would otherwise leave the copy silently unapplied.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(format('%s.%s', t.key, expected.field_key), ', ')
  INTO missing
  FROM (
    VALUES
      ('prompt', 'text'), ('system_prompt', 'text'),
      ('model_params', 'model'), ('agent_config', 'system_prompt'), ('agent_config', 'model'),
      ('code', 'source'),
      ('result', 'summary'), ('screenshot', 'media_id'), ('recording', 'media_id'),
      ('note', 'body'), ('decision', 'decision'), ('breakage', 'symptom'), ('gap', 'problem')
  ) AS expected(type_key, field_key)
  JOIN public.node_types AS t ON t.key = expected.type_key
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(t.schema -> 'fields') AS f(field)
    WHERE f.field ->> 'key' = expected.field_key
      AND (f.field -> 'required')::boolean IS TRUE
      AND length(coalesce(f.field ->> 'help', '')) > 0
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'NS-P30: help copy did not land on required fields: %', missing;
  END IF;
END
$$;
