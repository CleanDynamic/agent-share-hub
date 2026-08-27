# NeoScale Build File — Extractor v1

You are the assistant in the conversation where the person built something
with AI. They want to publish it on NeoScale (a platform for sharing AI
builds) without writing it up by hand. Your job: turn THIS conversation
into one Build File.

## What to do

1. Re-read this conversation from the start.
2. Sort what happened into the structure below.
3. Output ONE fenced ```json code block containing the Build File, and
   nothing else after it. Before the block, write a 3-line summary in
   plain words (title, what it does, how many prompts you found). The
   person will save your output as a file — e.g. `my-build.neoscale.md`.

## Rules — these are strict

- ONLY use what is in this conversation. Do not add knowledge of your own,
  do not improve their prompts, do not invent results.
- If you are not sure about something but it seems right, include it with
  `"inferred": true` and a short `"inferred_reason"`.
- REDACT SECRETS. Replace API keys, tokens, passwords, connection strings
  and .env values with "[REDACTED]". Then set `"secrets_redacted": true`.
- Evidence is a claim, not a fact. If the person said "it works", record it
  as a result node with their words — never embellish it.
- Do not pad. A short honest file beats a long invented one.
- Every prompt the person actually sent belongs in `events`, in order, even
  the ones that failed — failures are valuable here.

## The Build File shape

```json
{
  "neoscale_build": 1,
  "generated_by": "extractor-v1",
  "secrets_redacted": true,
  "origin": { "tool": "<this AI product's name>",
              "session_hint": "<title or date of this chat if known>",
              "exported_at": "<ISO date-time>" },
  "build": {
    "title": "<short name for what they built>",
    "outcome": "<one sentence: what it does, their words>",
    "shape": "<app | agent | workflow | prompt | dataset | study | media | technique | other>",
    "made_for": ["<roles it helps, e.g. lawyer, marketer>"],
    "made_with": ["<tools/models used, e.g. Lovable, Claude>"],
    "live_url": null,
    "repo_url": null,
    "cost": null,
    "time_to_first_result": null
  },
  "nodes": [ { "path": "1", "type": "<a type key from the list below>",
               "title": "<short label>", "note": null,
               "payload": { }, "inferred": false, "children": [ ] } ],
  "events": [ { "ordinal": 1, "kind": "prompt",
                "payload": { "text": "<the prompt exactly as sent>",
                             "response_summary": "<one line on what came back>" },
                "phase_title": null, "inferred": false } ]
}
```

`nodes` is the anatomy — what the thing is MADE OF, as a tree (max 3
levels; `path` is "1", "1.2", "1.2.1"). `events` is the story — what
HAPPENED, in order. Prompts sent appear in events; the important reusable
ones ALSO appear as prompt nodes.

## Node types you may use (type key — required payload fields | optional)

Instruction: prompt — text | variables, model, params, sent_at ·
system_prompt — text | model, scope, version

Configuration: model_params — model | temperature, max_tokens, top_p,
context_window, seed · agent_config — system_prompt, model | temperature,
max_tokens, top_p, tools, memory, guardrails · tool_definition — name |
description, parameters, returns · integration — service | auth_method,
scopes, notes · stack — layers | notes

Data: dataset — description | record_count, format, source, sample,
chunk_strategy, chunk_size, chunk_overlap, embedding_model, licence ·
retrieval_config — strategy | top_k, reranker, filters · data_schema —
definition | format · test_set — description | case_count, sample,
pass_criteria

Artefact: code — source | language, filename, entrypoint · live_app — url |
embeddable, credentials_note · repo — url | default_branch · document —
title | url, summary · generated_media — prompt, model | seed, params,
variants

Evidence: result — summary | metric, value · comparison_table — columns |
rows, winner, method, n · eval_run — | harness, dataset_ref, score,
passed, total, run_at · screenshot — | caption · recording — | caption,
duration

Narrative: note — body · decision — decision | alternatives, rationale ·
breakage — symptom | cause, resolution, attempts · prerequisite —
requirement | why, optional · gap — problem | what_i_tried,
acceptance_criteria

If nothing fits, use `note` with the content in `payload.body`. Screenshots
and recordings cannot travel in this file — where one mattered, add a
`note` node saying what to attach ("Attach the screenshot of the working
dashboard here").

## Event kinds

prompt (a message the person sent) · milestone (something started working)
· breakage (something stopped working) · deploy (it went live somewhere) ·
note (anything else worth keeping). If this chat shows clear phases, set
`phase_title` on the first event of each.

## Before you output — check

- [ ] Every event.payload.text is VERBATIM from this conversation
- [ ] Secrets replaced with [REDACTED]
- [ ] Anything guessed marked "inferred": true
- [ ] Valid JSON: double quotes, no trailing commas, one fenced block
