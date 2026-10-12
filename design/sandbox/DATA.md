# The composer sandbox — data

How each piece of CONCEPT §1 is stored. Names follow the code; RULES §8 applies.

## 1. Steps and their order
- A step is a top-level `build_nodes` row of type `prompt`, `agent_config`, `team` or `manual_step` with a `position`. Steps are numbered by position, from 1, counting steps only. Other top-level rows (the cover's evidence node, files, tools, results) keep their positions and are not numbered.
- Inside an agent: `payload.system_prompt` is sub-step n.1, "Instructions"; its child `prompt` rows, by position, are n.2 onward.
- Inside a team: its child `agent_config` rows, by position, are n.1 onward. An agent inside a team shows its instructions in its own row; its further prompts show only when it is opened. There is no third level of numbers.
- A step's title is `build_nodes.title`. Null means its default name: "Prompt 3", "Agent 3", "Team 3", "Manual step 3". A title is trimmed, at most 80 characters, and an empty title saves as null.

## 2. Payloads, beside the fields each type's registry schema already has
- `prompt`: `text` (required), `model?`, `tool?` (only on a prompt written by hand: a client `toolLabel` knows), `uses?: Use[]`, `dismissed?: string[]`.
- `agent_config`: its schema's fields (`system_prompt`, `model`, …) plus `runs?: Runs`, `uses?`, `dismissed?`.
- `team`: `runs?`, `uses?`, `dismissed?`.
- `manual_step`: `tool` (at most 40), `text` (at most 140), `media_id?`, `uses?`.
- `document`, a file: `title` (the file name), `url?`, `summary?`, `media_id?` (a file stored through the existing build media path in `media.ts`).
- `integration`, a tool: `service`, `scopes?` (what it was used for, as detected: "read, label, draft"), `notes?`.
- `result`: `summary`, `media_id?`, `url?`.

## 3. Uses
`Use = { "kind": "output" | "file" | "tool", "node_id": "<uuid>" }`
- `output` names a step, `file` a `document` row, `tool` an `integration` row.
- A step never uses itself, and the same use is never listed twice.
- A use of a later step is allowed only when that later step sits in the same agent or team and its runs is "until" (a checker sending work back). It draws as a loop.
- The order of `uses` is the order of the named inputs on the box.
- "Goes into" is never stored. It is every step whose `uses` names this one, plus the next step in the same session.
- A suggestion is never stored. A dismissed one is kept as `"<kind>:<node_id>"` in `dismissed`, so it is not offered again.

## 4. Runs
`Runs = { "how": "once" | "parallel" | "until" | "schedule" | "event", "count"?: number, "detail"?: string }`
- `count` only for parallel, 2 to 20. `detail` for until (at most 80), schedule and event (at most 60). No `runs` means "once".

## 5. Sessions
- The session a prompt came from is `source_ref.import_session_id`, which `addSessionPrompt` sets. A prompt written by hand has no `source_ref`.
- `import_sessions` is owner-only, so readers never read it. Its public copy is `builds.making.sessions[]`: today `{ client, model, prompts, turns }`. `refreshMakingStats` adds `id` (the import session's id) and `started_at` (its `created_at`). Older entries without them still read.
- A session's number is its order by first step in the build. Its tool label comes from `toolLabel(client)`, its model label from `modelLabel(model)`.

## 6. What this changes in the database
Two `node_types` rows, `team` and `manual_step`, in `supabase/migrations/20261001300000_sandbox_node_types.sql`. Nothing else.
