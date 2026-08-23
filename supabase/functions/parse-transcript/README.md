# parse-transcript

Pasted chat transcript in, a **proposed** draft out. The first and highest
leverage of the NeoScale intake parsers (NS-P13).

It writes nothing. It reads one row of `builds` to confirm the caller owns the
build, splits the transcript, and returns a proposal that the intake surface
(NS-P14) shows to a creator to accept, edit or discard. `build_events`,
`build_nodes` and `builds` are untouched by this function.

```
index.ts   HTTP shell: CORS, method, auth, ownership, validation, response
parse.ts   the reading: splitting, extraction, provenance. Pure, no I/O
```

`parse.ts` imports nothing and touches no Deno API, which is what lets the next
parser borrow from it and what lets it be exercised without a running Supabase.

---

## The two rules

From the handover, and they apply to every parser in this sequence:

1. **Every proposed item carries `source_ref`** recording where it came from —
   `{ source: "transcript", session_id, index }`, where `index` is the turn it
   was read out of.
2. **Anything inferred rather than read carries `inferred: true` and a short
   reason string.** Items read verbatim carry `inferred: false` and
   `inferred_reason: null`, so the client never has to guess which is which.

Auto-extraction is only trustworthy when it admits what it guessed. A code block
lifted out of a fence is read. A model name assembled from scattered mentions, a
result inferred from the position of a turn, a title taken from the opening line
of a prompt — all guesses, all flagged, all with a reason a creator can read and
disagree with.

---

## Configuration

`verify_jwt = true`, set explicitly in `supabase/config.toml`.

Several of the seed functions in this repo are configured `verify_jwt = false`
and are therefore publicly invokable. **That is a known defect, not a pattern to
copy.** This function proposes a draft against a build the caller must own, so
the gateway rejects unauthenticated calls before the function runs, and
`index.ts` checks the header again anyway — a function that is safe only because
of its configuration is one config edit away from being open.

The Supabase client is built with the **caller's** token, so every read runs
under their RLS. The service role key is never used here.

---

## Contract

### Request

`POST` with a `Bearer` access token.

```json
{ "raw_text": "You said:\n...", "build_id": "uuid", "source_hint": "chatgpt" }
```

| Field | Required | Notes |
| --- | --- | --- |
| `raw_text` | yes | Rejected over **400,000 characters**. |
| `build_id` | yes | uuid. Must belong to the caller. |
| `source_hint` | no | Free text, trimmed to 120 chars. Recorded in `summary.source_hint`; it does not override detection. |

### Response

```json
{ "events": [...], "nodes": [...], "summary": {...}, "warnings": [...] }
```

| Status | When |
| --- | --- |
| `200` | A proposal, however thin. Prose that matched no convention still returns 200 with one event and a warning. |
| `400` | Body is not JSON, `raw_text` missing/empty/not a string, `build_id` missing or not a uuid, `source_hint` not a string. |
| `401` | No `Authorization` header, or the token is not valid. |
| `403` | The build does not exist **or** is not the caller's. The two answer identically, so this cannot be used to probe for build ids. |
| `405` | Anything but `POST` (and the `OPTIONS` preflight). |
| `413` | `raw_text` over 400,000 characters. The message says to split the paste; each part becomes its own proposal against the same build. |
| `500` | The ownership read failed, or something unforeseen. |

### `events[]` — one per **user** turn

```jsonc
{
  "ordinal": 1,                  // 1..N over user turns. -> build_events.ordinal
  "kind": "prompt",              // always
  "visibility": "folded",        // always: folded is the default for the sequence
  "occurred_at": null,           // ISO 8601, or null when the text names no date
  "payload": {
    "text": "…",                 // the user turn, verbatim
    "response_summary": "…"      // first 240 chars of the following assistant turn, or null
  },
  "source_ref": { "source": "transcript", "session_id": "…", "index": 1 },
  "inferred": false,
  "inferred_reason": null
}
```

`response_summary` is the turn immediately following. Where someone sent two
messages in a row, the first honestly gets `null` rather than borrowing the
second one's reply.

### `nodes[]` — destined for the tray

```jsonc
{
  "local_id": "node-1",          // a local handle; the client maps it to a uuid
  "type": "code",                // always a node_types.key
  "title": "src/lib/x.ts",
  "note": null,
  "payload": { "language": "ts", "source": "…" },
  "source_ref": { "source": "transcript", "session_id": "…", "index": 2 },
  "inferred": false,
  "inferred_reason": null
}
```

Proposed nodes have **no `position`** — they are tray material and the client
decides where they land. No `parent_id`, and no uuids: `local_id` is a handle
within one response, nothing more.

Types emitted: `code` (read), `model_params` (inferred), `result` (inferred).
`prompt` is emitted as an *event*, not a node. **`milestone` is a
`build_events.kind`, not a `node_types` key** — it is never emitted as a node.

### `summary`

`session_id`, `source_hint`, `detected_format`, `detected_labels`,
`turn_count`, `user_turn_count`, `assistant_turn_count`, `event_count`,
`node_count`, `character_count`, `line_count`, and:

```jsonc
"proposed_title":   { "value": "…", "source_ref": {…}, "inferred": true, "inferred_reason": "…" },
"proposed_outcome": { "value": "…", "source_ref": {…}, "inferred": true, "inferred_reason": "…" }
```

Both are `builds` columns rather than nodes, which is why they sit in `summary`
and not in `nodes`. Either can be `null` when there is no user turn to read. On
a one-sentence opening prompt the two will often say the same thing; both are
inferred and the creator is expected to rewrite them.

### `warnings[]`

`{ code, message }`. Codes currently emitted: `no_format_detected`,
`positional_split`, `weak_labels_used`, `no_user_turns`, `no_events`,
`unmapped_code_language`, `unterminated_code_fence`, `timestamps_without_date`.

### Fields that are not columns

`local_id`, `inferred`, `inferred_reason`, and `source_ref` **on an event**, are
proposal metadata. `build_nodes.source_ref` is a real jsonb column and takes a
node's `source_ref` directly; `build_events` has no such column, so NS-P14 either
drops the event's `source_ref` or folds it into `payload` on materialisation.

---

## Turn numbering

Turns are numbered across **both** speakers from 1. A clean 20-exchange
transcript has 40 turns: the person on 1, 3, 5 … and the assistant on 2, 4, 6 …

`source_ref.index` is always that turn ordinal. Event `ordinal` is separate: it
runs 1..N over user turns only, because one event is emitted per user turn. So
the twentieth event has `ordinal: 20` and `source_ref.index: 39`, and a code
node pulled from the reply to it carries `source_ref.index: 40`.

---

## Detection

The convention is chosen from the **first 40 lines**, then applied to the whole
text — the window decides *which* convention, not how far the split runs, so a
transcript whose opening turn is fifty lines long still splits correctly.

| `detected_format` | Matches |
| --- | --- |
| `labelled_colon` | `You:` · `User:` · `Human:` · `Assistant:` · `ChatGPT:` · `Claude:` · `You said:` · `Claude (2026-08-23 10:22):` |
| `markdown_bold` | `**You**` · `**You:**` · `__ChatGPT__:` · `**Human** (2026-08-23 09:14):` |
| `markdown_heading` | `## You` · `### Assistant` · `## ChatGPT said:` |
| `blank_line_alternating` | Bare paragraphs separated by blank lines, taken as user then assistant, alternating |
| `unstructured` | Nothing matched: one event holding the whole text, plus a warning |

Guards, in the order they matter:

- **Speaker labels are vocabulary-gated.** A line only opens a turn when its
  label is a speaker name. `Note: …` and `TODO: …` are prose.
- **Weak labels are a second tier.** `Prompt:` / `Response:` / `Output:` lead
  ordinary prose as often as they lead a turn, so they are consulted only when
  no strong label appears in the window *and* both sides are represented. That
  split emits `weak_labels_used`.
- **Fenced code is never a turn.** A yaml block containing `model: gpt-4o` or
  `User: postgres` is inside a fence, so it is invisible to label matching and
  to blank-line splitting.
- **Never guess a split that produces one-line turns.** The positional split is
  refused unless a majority of blocks are multi-line or at least 80 characters,
  so a poem or a bullet list falls through to `unstructured` rather than being
  cut into fake turns. When it is accepted it emits `positional_split`, because
  who spoke is a guess.
- **A single labelled turn is only believed when the label opens the document**,
  so one stray `AI:` in the middle of an essay cannot hijack the parse.
- **`occurred_at` needs a date.** `build_events.occurred_at` is `timestamptz`, so
  a bare clock time (`2:31 PM`) is dropped rather than anchored to a day the
  transcript never names — and `timestamps_without_date` is emitted so the
  creator knows why.

---

## Three examples

### 1. ChatGPT web export → `labelled_colon`

````
You said:
Build me a script that renames photos by the date they were taken.

ChatGPT said:
Use exiftool. It reads the date out of the exif block and renames in place.

```bash
exiftool '-filename<CreateDate' -d %Y%m%d_%%f.%%e -r .
```

You said:
It skipped every raw file, which is most of the folder.

ChatGPT said:
Raw files keep the date under DateTimeOriginal. Add it as a fallback tag and it picks both up.

You said:
Ran it on the whole folder.

ChatGPT said:
That worked — all 2,400 photos renamed with no errors.
````

**Expected split** — `detected_format: "labelled_colon"`, labels
`{ user: ["You said"], assistant: ["ChatGPT said"] }`, 6 turns, **3 events**:

| event.ordinal | source_ref.index | text | response_summary |
| --- | --- | --- | --- |
| 1 | 1 | Build me a script that renames photos… | Use exiftool. It reads the date… |
| 2 | 3 | It skipped every raw file… | Raw files keep the date under… |
| 3 | 5 | Ran it on the whole folder. | That worked — all 2,400 photos… |

Nodes:

| local_id | type | index | inferred | why |
| --- | --- | --- | --- | --- |
| node-1 | `code` (`language: "bash"`) | 2 | `false` | Read out of the fence in that turn. |
| node-2 | `result` | 6 | `true` | Matched a success statement in the last turn. Nothing was verified. |

`proposed_title` and `proposed_outcome` both come from turn 1, both
`inferred: true`. No warnings.

### 2. Claude-style labels and timestamps → `markdown_bold`

````
**Human** (2026-08-23 09:14):
Our support bot keeps inventing refund policy. How do I stop it?

**Claude** (2026-08-23 09:15):
Ground it in the policy document instead of the model's memory. Retrieve the
relevant clause first, then answer only from that clause.

```python
chunks = retrieve(question, k=4)
answer = model.complete(PROMPT.format(policy="\n".join(chunks)))
```

**Human** (2026-08-23 09:40):
It refuses everything now, even questions the policy covers.

**Claude** (2026-08-23 09:41):
Your chunks are too small, so the clause is being cut in half. Raise chunk size
to 800 characters with a 100 character overlap. I ran it with claude-3-5-sonnet
at temperature 0.2 and it answers correctly now.
````

**Expected split** — `detected_format: "markdown_bold"`, labels
`{ user: ["Human"], assistant: ["Claude"] }`, 4 turns, **2 events**:

| event.ordinal | source_ref.index | occurred_at | text |
| --- | --- | --- | --- |
| 1 | 1 | `2026-08-23T09:14:00.000Z` | Our support bot keeps inventing refund policy… |
| 2 | 3 | `2026-08-23T09:40:00.000Z` | It refuses everything now… |

The bracketed timestamp is label decoration, so it is read into `occurred_at`
and kept out of the turn text. The label itself is stored as `Human`, not
`Human (2026-08-23 09:14)` — but a version *is* kept, so `GPT-4` and
`Claude 3.5 Sonnet` survive as labels intact.

Nodes:

| local_id | type | index | inferred | why |
| --- | --- | --- | --- | --- |
| node-1 | `code` (`language: "python"`) | 2 | `false` | Read out of the fence. |
| node-2 | `model_params` (`model: "claude-3-5-sonnet"`) | 4 | `true` | Assembled from a mention, not a stated configuration. |
| node-3 | `result` | 4 | `true` | The last turn, which claims no success in so many words. |

Had the transcript written `temperature: 0.2` as a parameter rather than in
prose, it would have landed in the same node's payload — the node stays
`inferred: true` either way, because *which* model this build ran on is still a
guess assembled from mentions.

### 3. Unstructured prose → one event and a warning

```
Spent the weekend trying to get a small summariser working for my reading list.
It took a lot of fiddling before anything useful came out of it, and I am still
not certain the output is reliable enough to publish. Eventually I settled on a
two pass approach: pull the key sentences first, then rewrite them into a
paragraph.
```

**Expected split** — `detected_format: "unstructured"`, 1 turn, **1 event**
holding the whole text with `response_summary: null`, and:

```json
{ "code": "no_format_detected",
  "message": "No transcript convention matched. The text was kept whole as a single event rather than split on a guess. Add speaker labels such as 'You:' and 'Assistant:' and parse again for a turn-by-turn sequence." }
```

Status is still `200`. It never fails silently and it never invents turns.
`proposed_title` and `proposed_outcome` are still offered (inferred, from the
only turn there is). **No `result` node is proposed**: "the last turn of the
transcript" means nothing when the transcript is one unsplit block, and a
positional guess with no position to stand on is not worth a creator's time.

---

## Notes for the next parser author

- Everything above the entry point in `parse.ts` is reusable: `fenceMask`,
  `extractFences`, `findTimestamp`, `excerpt`, `trimBlock`, the label
  vocabularies and the provenance types. The next parser should not re-derive
  fence handling.
- `payload` keys are governed by `node_types.schema`, which is the constrained
  six-field-type dialect from NS-P02, not JSON Schema. A key the schema does not
  name will not render in the inspector, so match the registry (`code`:
  `language`, `source`, `filename`, `entrypoint` — `language` is an enum, and an
  unmapped fence language is filed as `other` with an `unmapped_code_language`
  warning rather than inventing a seventh value).
- Positional guesses degrade badly on transcripts containing code. A block that
  opens inside a fence is folded into the previous speaker's turn, but the block
  *after* a fence cannot be attributed with any confidence — which is why
  `blank_line_alternating` always warns.
- Keep the split pure and keep the I/O in `index.ts`. The reason this parser
  could be verified against twenty-odd transcript shapes before it was ever
  deployed is that reading it requires nothing but a string.
