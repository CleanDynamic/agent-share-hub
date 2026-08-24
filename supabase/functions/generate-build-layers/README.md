# generate-build-layers

NS-P22. A build id in, its two explanation layers out, written to
`build_layers`:

| Layer        | What it is                                                |
| ------------ | --------------------------------------------------------- |
| `run`        | Do this, then this. No understanding required.             |
| `understand` | What each step does and why, in plain language.            |

```
POST /functions/v1/generate-build-layers
{ "build_id": "<uuid>", "layers": ["run", "understand"], "force": false }
```

---

## Read this first: this function writes, and it can be told not to

`parse-transcript`, `parse-lovable` and `parse-repo` propose. They write
nothing, so the worst a bad answer costs is a creator's attention.

This one writes. That makes one rule load-bearing above all the others:

> **A row a human approved is never overwritten.** If the tree has moved on
> since an approved layer was generated, the function returns that row
> **unchanged** with `stale: true` and lets the client ask the creator. It does
> not decide for them.

The whole of that policy is the `decide()` function in `index.ts`, in one
readable block. If you change anything in this function, read it first.

The same protection extends to `edited_by_creator`, which is a small
deliberate widening of the handover (see **Divergences** below): content a
creator rewrote is their work whether or not they got as far as ticking
approve.

`force: true` is the creator's own answer to all of this. It is set by an
explicit creator action in NS-P23 and by nothing else.

---

## Read this second: the record is what makes this possible

The model is never shown a document. It is shown a compact, line-oriented
description assembled from the typed record: node types, titles, notes, and
**the required payload fields only** — never whole payloads.

That filter is only meaningful because `node_types.schema` declares which field
carries the point of each type. Twenty-five of the twenty-six seeded types name
at least one: `prompt.text`, `live_app.url`, `breakage.symptom`,
`result.summary`, `decision.decision`. The one that names none (`eval_run`)
falls back to its first field so no node arrives as a bare type name.

**Do not add a path that generates layers from prose.** There is nothing to
generate from — a rich-text document has no `required` field, no tree, and
nothing for `node_ref` to point at. The typed record is the feature.

---

## Configuration

### `verify_jwt = true`

Set in `supabase/config.toml`, deliberately, for the same reason as the three
parsers: this acts on a build the caller must own, so the gateway rejects an
unauthenticated call before the function runs. The `Authorization` check in
`index.ts` is the second lock, not the first.

The Supabase client carries the **caller's** token, so every read and every
write runs under their RLS. The service role key is never used here.

### The model key

Nothing in this repository called a language model before NS-P22 —
`generate-ai-pdf` builds its PDF with `pdf-lib` (its "AI" means AI-readable
output, not AI-generated), and `src/lib/llm.ts` deliberately keeps keys out of
the bundle by copying a prompt to the clipboard. There was no existing secret
to inherit, so this function resolves whichever one the deployment has:

| Order | Secret              | Endpoint                                     | Default model            |
| ----- | ------------------- | -------------------------------------------- | ------------------------ |
| 1     | `LOVABLE_API_KEY`   | `ai.gateway.lovable.dev/v1/chat/completions`  | `google/gemini-2.5-flash` |
| 2     | `ANTHROPIC_API_KEY` | `api.anthropic.com/v1/messages`               | `claude-opus-5`          |
| 3     | `OPENAI_API_KEY`    | `api.openai.com/v1/chat/completions`          | `gpt-4o-mini`            |

Set one in **Supabase Dashboard → Edge Functions → Secrets**. With none set the
function answers `503` naming all three — a deployment fact a caller can act
on, not a `500`.

Two optional overrides:

- `BUILD_LAYERS_PROVIDER` — `lovable` \| `anthropic` \| `openai`. Pins the
  provider when more than one key is present.
- `BUILD_LAYERS_MODEL` — the model id for whichever provider is chosen.

`build_layers.model_used` records `provider:model` on every row, e.g.
`anthropic:claude-opus-5`. A layer whose provenance is only "some model, once"
is not reviewable, and NS-P23 is a review pass.

---

## Contract

### Request

| Field      | Type       | Required | Meaning                                            |
| ---------- | ---------- | -------- | -------------------------------------------------- |
| `build_id` | uuid       | yes      | The build to explain. Must be the caller's, or the caller must be an admin. |
| `layers`   | string[]   | no       | Any of `run`, `understand`. Both by default.       |
| `force`    | boolean    | no       | Overwrite protected content. Defaults to `false`.  |

### Response — `200`

```json
{
  "build_id": "…",
  "generated_from_hash": "v1:9f2c…",
  "model_used": "anthropic:claude-opus-5",
  "stale": false,
  "layers": [
    { "layer": "run", "status": "generated", "row": { "…": "the build_layers row" } },
    { "layer": "understand", "status": "unchanged", "row": { "…": "…" } }
  ],
  "warnings": []
}
```

`model_used` at the top level is the model this invocation used, or `null` when
nothing needed generating. The per-row `model_used` is the model that wrote
that row, which may be older.

### `layers[].status`

| Status      | Meaning                                                        | Model called | Row written |
| ----------- | -------------------------------------------------------------- | ------------ | ----------- |
| `generated` | New content. `approved` and `edited_by_creator` reset to false. | yes          | yes         |
| `unchanged` | The stored row already matches this tree hash.                  | no           | no          |
| `stale`     | The tree moved on, but the row is protected. Content untouched. | no           | no          |
| `failed`    | The model call failed for this layer. See `error`.              | attempted    | no          |

A `stale` entry also carries `stale: true` and `protected_by`, which is
`approved` or `edited_by_creator` — the sentence NS-P23 needs in order to ask
the right question. The top-level `stale` is true when any layer is.

### Other statuses

| Status | When                                                                     |
| ------ | ------------------------------------------------------------------------ |
| `400`  | Malformed body, bad `build_id`, unknown layer name, non-boolean `force`.  |
| `401`  | Missing or invalid access token.                                          |
| `403`  | The build does not exist, or is not the caller's. Deliberately the same answer, so this cannot be used to probe for build ids. |
| `405`  | Anything but `POST`.                                                      |
| `422`  | The build has no placed nodes. There is nothing to explain; material in the tray is not part of the record. |
| `429`  | The provider rate-limited the call.                                       |
| `502`  | Every requested layer failed at the model.                                |
| `503`  | No model key is configured for this deployment.                           |
| `504`  | The model did not answer within 90 seconds.                              |

If one layer succeeds and the other fails, the answer is `200`: the successful
row is written and returned, and the failure appears as a `failed` entry and a
`layer_failed` warning. A half-finished pair is more useful than an error.

---

## `generated_from_hash`

`v1:<sha-256 hex>` over the **placed node tree**, in tree order — each node
contributing its id, parent, position, type, title, note, gap flag and
canonicalised (key-sorted) payload. It is what lets the function answer "is
this still the record we generated from?" without asking the model anything.

Two things are deliberately outside it:

- **Tray nodes** (`position IS NULL`). Never rendered, never exported, never
  counted towards completeness — so they cannot change what a layer says.
  Placing one changes its position and moves the hash.
- **Events.** The handover specifies the hash over the node tree and this
  follows it. **NS-P23 should know the consequence:** editing only the
  sequence — folding an event, renaming a phase — does not mark a layer stale
  or trigger regeneration, even though the kept sequence is part of what the
  model was shown. A creator who reworks the sequence and wants that reflected
  needs the explicit regenerate action.

The `v1:` prefix means a later change of algorithm reads as a version change in
the data rather than as every build changing at once.

---

## `node_ref`, and why it is always real

`content.steps[].node_ref` is what makes an edited layer traceable back to the
record. The guarantee is that it is **a real `build_nodes.id` in that build, or
`null`** — never anything else.

That is enforced by never showing the model a uuid. Nodes are described by
short refs (`n1`, `n2`, …) minted from the real tree; every ref the model
returns is looked up in that map, and a ref that does not resolve becomes
`null`. An invented `n404` cannot collide with a real node id, and cannot
survive the lookup.

The column is deliberately **not** a foreign key: `content` is one jsonb
document, and deleting a node should leave a step whose reference no longer
resolves rather than block the delete or silently rewrite the document. Render
an unresolvable ref as an unlinked step.

---

## The token budget

The description is capped at 20,000 characters (~6k tokens). Over that, it is
reduced by **summarising the deepest level of the tree, not by truncating it**,
so the roots — the shape of the build — always survive:

1. Full rendering.
2. Nodes below level 3 fold into `… 7 more nodes below this one: prompt, result`.
3. Below level 2, and the sequence starts dropping its middle (never its ends).
4. Only the top level in full.
5. The same, with values and the sequence cut hard.

The first pass that fits is the one used. Any reduction is reported as a
`record_summarised` warning so the client can say so rather than let a creator
wonder why the deepest detail is missing.

### `warnings[]`

| Code                | Meaning                                                   |
| ------------------- | --------------------------------------------------------- |
| `record_summarised` | The build was large enough that the description was reduced. |
| `layer_failed`      | One layer's model call failed; the other may have succeeded. |

---

## Files

| File          | What it holds                                                          |
| ------------- | ---------------------------------------------------------------------- |
| `index.ts`    | The HTTP shell, auth, ownership, the overwrite policy, the writes.      |
| `describe.ts` | Tree assembly, ref minting, the compact description and its budget.     |
| `hash.ts`     | Canonical JSON and the node tree hash.                                  |
| `model.ts`    | Provider resolution, the prompts, the call, and step validation.        |
| `types.ts`    | The row shapes this function selects.                                   |

`describe.ts`, `hash.ts`, `model.ts` and `types.ts` import no Deno API — the
same split `parse-repo` asks the next author to keep — so the whole of the
logic can be exercised without a network or a database.

---

## Divergences from the NS-P22 handover

1. **`edited_by_creator` protects like `approved` does.** The handover names
   `approved` as the gate. Content a creator rewrote but has not yet approved
   is still their work, and overwriting it silently is exactly the failure the
   approved rule exists to prevent. `force: true` unblocks both identically, so
   NS-P23's flow is unchanged — it just has one more `protected_by` value to
   put in a sentence.
2. **`force: true` regenerates even when the hash matches.** The handover says
   a matching hash returns the stored row and does nothing. Taken literally
   that would make NS-P23's "regenerate this" button do nothing for a creator
   who edited the words but not the record — the exact person most likely to
   press it. A same-hash return is the behaviour for every call that is *not*
   forced.
3. **A `content` shape check on the table.** `jsonb_typeof(content->'steps') =
   'array'` — the one assumption every reader makes, failing loudly at the
   boundary rather than rendering as an empty layer.
4. **The provider resolver**, rather than one hardcoded provider, because no
   LLM secret existed in this project to hardcode against. Confirmed with the
   operator before it was written.

---

## Notes for NS-P23

- **The review pass has everything it needs on the row.** `approved`,
  `approved_at`, `edited_by_creator`, `model_used`, `generated_at` and
  `generated_from_hash` are all written here; this function only ever *reads*
  the first three.
- **Regeneration resets approval.** A `generated` row comes back with
  `approved: false`, `approved_at: null`, `edited_by_creator: false`. New words
  have not been reviewed, and a tick given to different words is not a tick.
- **Setting `edited_by_creator` is NS-P23's job.** Nothing here sets it true.
  Write it when a creator saves an edit, and this function will stop
  overwriting that row.
- **`stale: true` is a question, not an error.** The row it comes with is the
  creator's current content. Show it, say the record has changed since, and
  offer the regenerate action that sets `force: true`.
- **Only NS-P23 sets `force`.** It is not a retry flag and it is not something
  a page should send on load.
- **A step whose `node_ref` no longer resolves is expected.** Nodes get
  deleted. Render it as an unlinked step.
- **The sequence does not move the hash.** See `generated_from_hash` above; if
  the review UI shows "up to date", that claim is about the node tree.
- **No UI was built here, per the handover.** There is no client wrapper in
  `src/lib/build/` for this function yet.
