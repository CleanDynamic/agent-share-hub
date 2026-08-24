# parse-lovable

A Lovable session export in, a **proposed** draft out. The second NeoScale
intake parser (NS-P20), and the one with the richest possible input to
`build_events`.

It writes nothing. It reads one row of `builds` to confirm the caller owns the
build, reads the export, and returns a proposal the intake surface (NS-P14)
shows to a creator to accept, edit or discard. `build_events`, `build_nodes`
and `builds` are untouched by this function.

```
index.ts   HTTP shell: CORS, method, auth, ownership, validation, response
parse.ts   the reading: detection, normalisation, provenance. Pure, no I/O
```

`parse.ts` imports nothing and touches no Deno API, so it can be exercised
without a running Supabase — which is how the envelope below was checked against
`parse-transcript`'s field by field before this was ever deployed.

---

## Read this first: Lovable has no native session export

This is the single most important fact about this parser, and it was not known
when NS-P20 was specified.

**Lovable's own export — the ZIP download and the GitHub sync — is source code
only.** It contains no prompts, no replies, no timestamps and no ordering. None
of the material NS-P20 exists to capture is in it. A creator who follows the
obvious path ("export my Lovable project") gets a file this parser cannot use,
which is why `lovable_source_only` is a first-class detection result with a
plain-language message rather than an error.

Everything that carries session history is **third-party**, and there are two
such tools in real use. This parser reads both. Neither is a format Lovable
controls or documents, so both are recorded here with the exact commit-level
source they were read from, and both should be re-checked when they change.

---

## Provenance of these schemas — an honest note

No captured export file was available when this parser was written. The two
schemas below were read from **the serialising source code of the tools that
write them**, not inferred from a sample and not guessed:

| Shape | Schema read from |
| --- | --- |
| `lovable_chat_export` | [`lucioamor/lovable-chat-exporter`](https://github.com/lucioamor/lovable-chat-exporter) — `content.js`, the `exportJSON()` return and `parseMessageElement()` |
| `lovable_trajectory` | [`brendangooden/lovable-chat-history-capture`](https://github.com/brendangooden/lovable-chat-history-capture) — `src/messages.ts`, the `TrajectoryMessage` interface and `buildTrajectoryMessage()` |

That is stronger than a guess — it is the shape the writer actually emits — but
it is **weaker than a validated sample**, and the difference matters in exactly
one place: `timestampText`. See the warning under shape 1.

**The first creator to drop a real export should have their file checked against
the samples below**, and this README corrected if it differs.

---

## The two rules

Inherited from NS-P13 unchanged, because the contract is shared:

1. **Every proposed item carries `source_ref`** recording where it came from —
   `{ source: "lovable", session_id, index }`, where `index` is the message it
   was read out of, counted across both speakers from 1.
2. **Anything inferred rather than read carries `inferred: true` and a short
   reason string.** Items read verbatim carry `inferred: false` and
   `inferred_reason: null`.

`source` is `"lovable"` rather than `"transcript"`. That is the only value in
the whole envelope that a client could branch on, and `intake.ts` types it as
`string` and does not — `materialiseProposal` writes this proposal with no
source-specific branch.

---

## Configuration

`verify_jwt = true`, set explicitly in `supabase/config.toml`.

Several seed functions in this repo are configured `verify_jwt = false` and are
therefore publicly invokable. **That is a known defect, not a pattern to copy.**
This function proposes a draft against a build the caller must own, so the
gateway rejects unauthenticated calls before the function runs, and `index.ts`
checks the header again anyway.

The Supabase client is built with the **caller's** token, so every read runs
under their RLS. The service role key is never used here.

---

## Contract

Identical to `parse-transcript`. Same request fields, same statuses, same
response envelope, same `source_ref` and `inferred` rules. **The envelope did
not need to change, so it was not changed in either function.**

### Request

`POST` with a `Bearer` access token.

```json
{ "raw_text": "{\"exportedAt\":…}", "build_id": "uuid", "source_hint": "lovable export" }
```

| Field | Required | Notes |
| --- | --- | --- |
| `raw_text` | yes | The export file's **text**. Rejected over **400,000 characters**. |
| `build_id` | yes | uuid. Must belong to the caller. |
| `source_hint` | no | Free text, trimmed to 120 chars. Recorded in `summary.source_hint`. |

`raw_text` is a string, not an object, so this shell stays byte-for-byte
`parse-transcript`'s and the client has one way to send a file either way.

### Response

```json
{ "events": [...], "nodes": [...], "summary": {...}, "warnings": [...] }
```

| Status | When |
| --- | --- |
| `200` | A proposal, however thin — including for a file that turns out not to be a Lovable export at all. |
| `400` | Body is not JSON, `raw_text` missing/empty/not a string, `build_id` missing or not a uuid, `source_hint` not a string. |
| `401` | No `Authorization` header, or the token is not valid. |
| `403` | The build does not exist **or** is not the caller's. The two answer identically, so this cannot be used to probe for build ids. |
| `405` | Anything but `POST` (and the `OPTIONS` preflight). |
| `413` | `raw_text` over 400,000 characters. |
| `500` | The ownership read failed, or something unforeseen. |

A file that is not a Lovable export returns **200 with a warning**, not a 4xx.
That is what lets the intake surface use this function's own answer to decide
the file belongs to `parse-transcript` instead — detection is a reading, not an
error.

---

## Shape 1 — `lovable_chat_export` (the Chrome extension)

The simplest thing for a creator to produce: install the extension, scroll the
thread, click Export, drop one `.json`. Downloaded as
`lovable-chat-YYYY-MM-DD.json`.

**The literal envelope**, from `exportJSON()`:

```js
JSON.stringify({
  exportedAt: new Date().toISOString(),
  url: location.href,
  messageCount: Object.keys(capturedMessages).length,
  messages: getSortedMessages(),
}, null, 2)
```

**Each message**, from `parseMessageElement()`:

```js
{
  id: string,            // data-message-id; "umsg_…" prefix means the user
  role: 'user' | 'ai',   // derived from that prefix
  timestampText: string, // the date + time SPANS, as displayed
  topPx: number,         // CSS offset; what getSortedMessages() sorts on
  contentHtml: string,
  contentText: string
}
```

### ⚠ The one thing to know about this shape

`timestampText` is **scraped display text**, and `topPx` is a **CSS offset**.
Neither is a real timestamp. What the string contains depends on what Lovable's
UI happened to render — an absolute date, a bare clock time, or a relative
stamp. `parse.ts` therefore reads it defensively:

| `timestampText` contains | `occurred_at` | `inferred` |
| --- | --- | --- |
| `2026-08-18T09:12:04Z` or `2026-08-18 09:12` | read as-is (UTC when no zone) | `false` |
| `Aug 18, 2026, 9:12 AM` | read | `false` |
| `2 days ago` | resolved against the export's own `exportedAt` | **`true`** |
| `9:12 AM` (no date) | `null`, `timestamps_without_date` warning | `false` |

A bare clock time is **dropped rather than anchored to a day the export never
named**, exactly as NS-P13 does — `build_events.occurred_at` is `timestamptz`,
and a wrong date is worse than no date. Ordering survives either way.

**This shape carries no file-change data and no deploy record.** Code nodes come
from fenced blocks in the replies; deploys are inferred from wording and URLs.

### Sample

```json
{
  "exportedAt": "2026-08-20T18:04:11.522Z",
  "url": "https://lovable.dev/projects/recipe-box-planner",
  "messageCount": 4,
  "messages": [
    {
      "id": "umsg_01", "role": "user",
      "timestampText": "Aug 18, 2026, 9:12 AM", "topPx": 120,
      "contentHtml": "<p>Build me a recipe box…</p>",
      "contentText": "Build me a recipe box where I can save recipes and plan a week of meals."
    },
    {
      "id": "amsg_01", "role": "ai",
      "timestampText": "Aug 18, 2026, 9:13 AM", "topPx": 340,
      "contentHtml": "<p>Done.</p><pre>…</pre>",
      "contentText": "I've set up the recipe list.\n\n```tsx src/components/RecipeCard.tsx\nexport const RecipeCard = () => null;\n```"
    },
    {
      "id": "umsg_02", "role": "user",
      "timestampText": "Aug 18, 2026, 9:35 AM", "topPx": 560,
      "contentHtml": "<p>Still blank</p>",
      "contentText": "The planner page is still blank when I open it."
    },
    {
      "id": "amsg_02", "role": "ai",
      "timestampText": "Aug 18, 2026, 10:03 AM", "topPx": 780,
      "contentHtml": "<p>Published</p>",
      "contentText": "Published. Your app is live at https://recipe-box-planner.lovable.app"
    }
  ]
}
```

**What that yields** — 4 events, ordinals running across every kind:

| ordinal | kind | occurred_at | index | inferred | from |
| --- | --- | --- | --- | --- | --- |
| 1 | `prompt` | `2026-08-18T09:12:00.000Z` | 1 | `false` | the user message |
| 2 | `prompt` | `2026-08-18T09:35:00.000Z` | 3 | `false` | the user message |
| 3 | `breakage` | `2026-08-18T09:35:00.000Z` | 3 | **`true`** | a reply reported an error and this prompt says it persists |
| 4 | `deploy` | `2026-08-18T10:03:00.000Z` | 4 | **`true`** | a deployment URL in the reply |

Nodes: one `code` (`tsx`, `filename: "src/components/RecipeCard.tsx"`,
`inferred: false` — read out of the fence) and one `live_app`
(`inferred: true` — the URL was read, but nothing confirms it is still live).

`proposed_title` is `"recipe box planner"`, read from the project slug in `url`
and **inferred**: it is the name typed into Lovable, not a title written for
readers. `proposed_outcome` is the opening prompt, also inferred, because it is
the intention the session started with rather than what it produced.

---

## Shape 2 — `lovable_trajectory` (the Firestore CLI)

The richer shape, and the only one carrying **genuine** timestamps and real
file-change records. It costs the creator far more: Bun, a Firebase API key, a
refresh token pulled out of browser storage, four env vars, and a CLI run.

Its output is a **directory**, not a file:

```
chat-history/
├── raw/            one JSON per message (decoded Firestore doc)
├── edits/          per-turn edit metadata (file_path, action, commit_sha)
├── attachments/    image binaries
├── timeline.md     chronological transcript
└── index.json      manifest for incremental sync
```

**Each message**, from `TrajectoryMessage`:

```ts
interface TrajectoryMessage {
  id: string;
  name: string;
  role: string;                     // "user" | "assistant"
  content: string;
  createdAt: string;                // Lovable's own created_at — the session clock
  createTime: string | undefined;   // Firestore ISO 8601
  updateTime: string | undefined;   // Firestore ISO 8601
  currentPage: string | undefined;
  editId: string | undefined;
  costCredits: number | undefined;
  images: ImageRef[];
  patch: PatchEntry[];              // { path, action } — action defaults to "unknown"
  raw: Record<string, unknown>;
}
```

`parse.ts` accepts either a bare array of these or `{ messages: [...] }`, so a
creator can concatenate `raw/*.json` without reshaping anything.

**Timestamps are genuine here**, so `inferred` is `false`: `createdAt` is
preferred (Lovable's own clock), falling back to `createTime` then `updateTime`.
When every message carries one, messages are **sorted by timestamp and
re-indexed**, so `source_ref.index` reads as true session order even if the
files arrived in filename order. When some do not, the given order is kept and
`order_not_verified` is emitted rather than interleaving dated and undated
messages arbitrarily.

### Sample

```json
{ "messages": [
  { "id": "m1", "name": "Ada", "role": "user",
    "content": "Build me a recipe box.",
    "createdAt": "2026-08-18T09:12:04.000Z",
    "createTime": "2026-08-18T09:12:05.100Z",
    "updateTime": "2026-08-18T09:12:05.100Z",
    "currentPage": "/", "costCredits": 1, "images": [], "patch": [], "raw": {} },
  { "id": "m2", "name": "Lovable", "role": "assistant",
    "content": "Added the list.",
    "createdAt": "2026-08-18T09:13:20.000Z",
    "createTime": "2026-08-18T09:13:21.000Z",
    "updateTime": "2026-08-18T09:13:21.000Z",
    "currentPage": "/", "editId": "e1", "costCredits": 4, "images": [],
    "patch": [ { "path": "src/pages/Recipes.tsx", "action": "create" },
               { "path": "src/lib/store.ts",     "action": "update" } ],
    "raw": {} }
] }
```

**What that yields** — one `prompt` event at `2026-08-18T09:12:04.000Z`
(`inferred: false`, a real timestamp), and two `code` nodes:

| local_id | type | filename | language | source | inferred |
| --- | --- | --- | --- | --- | --- |
| node-1 | `code` | `src/pages/Recipes.tsx` | `tsx` | **empty** | `true` |
| node-2 | `code` | `src/lib/store.ts` | `ts` | **empty** | `true` |

`source` is empty on purpose. `patch[]` records the path and the action and
**deliberately carries no file body**, so the node arrives with its required
field blank and a `note` telling the creator to paste the code in. Inventing a
body would be fabricating the one thing the export does not contain.

---

## Shape 3 — `lovable_source_only`

Lovable's own ZIP or GitHub export: a `package.json`, a `tsconfig.json`, a file
manifest. Detected and answered with `no_session_history`:

> This looks like a Lovable code download. It carries your project's source but
> none of the session — no prompts, no timestamps, no order. Lovable has no
> native session export; use a chat-history exporter to capture the session
> itself.

`200`, no events, no nodes. A creator who took the obvious path gets told what
happened and what to do instead.

---

## What is read, and what is guessed

| Proposed | `inferred` | Why |
| --- | --- | --- |
| `prompt` event | `false` | The user message, verbatim. |
| `prompt` with a relative stamp | `true` | `occurred_at` computed against `exportedAt`. |
| `deploy` event | `true` | Neither shape records deploys. Read from a URL, or from wording. |
| `breakage` event | `true` | Neither shape records failure. See below. |
| `code` from a fence | `false` | Read out of the fence. |
| `code` from `patch[]` | `true` | Path and action are real; the body is absent. |
| `live_app` | `true` | The URL was read; nothing confirms it is live. |
| `proposed_title` / `proposed_outcome` | `true` | Always. A slug is not a title; an opening prompt is not a result. |

### Breakage candidates

A repeated prompt after a failure is the single most educational artefact in a
build, so the parser surfaces it — as a **candidate**, never a conclusion.

The reading: a reply matched a failure pattern (`error`, `failed`,
`cannot find`, `is not defined`, `build failed`, …), and the next user message
either repeats the previous one (Jaccard overlap ≥ `0.6` on content words) or
says the problem persists (`still …`, `same error`, `that didn't work`). That
emits a `breakage` event carrying the failing reply as its `response_summary`.

Capped at `MAX_BREAKAGE_CANDIDATES` (8) — past that, "retry" is noise rather
than signal — and always accompanied by the `breakage_candidates_inferred`
warning, because **nothing in either export shape records that anything broke**.
Every one of these is read from wording and is the creator's to keep or discard.

---

## `warnings[]`

`{ code, message }`. Codes emitted: `not_json`, `no_session_history`,
`timestamps_without_date`, `relative_timestamps_anchored`, `order_not_verified`,
`unmapped_code_language`, `unterminated_code_fence`, `breakage_candidates_inferred`,
`no_user_turns`, `no_events`.

`timestamps_without_date`, `unmapped_code_language`, `unterminated_code_fence`,
`no_user_turns` and `no_events` are shared with `parse-transcript` and mean the
same thing in both.

---

## Fields that are not columns

`local_id`, `inferred`, `inferred_reason`, and `source_ref` **on an event**, are
proposal metadata. `build_nodes.source_ref` is a real jsonb column and takes a
node's `source_ref` directly; `build_events` has no such column, so `intake.ts`
folds the event's `source_ref` into `payload` on materialisation — the same
handling it already applies to `parse-transcript`'s output.

Event `ordinal` runs `1..N` across **every** kind, not just prompts, so each is a
unique selection key for `IntakeSelections.eventOrdinals`. `materialiseProposal`
renumbers them against the build's existing rows on write.

---

## Notes for the next parser author (NS-P21)

- **Lift the shared half into `supabase/functions/_shared/`.** `parse.ts` here
  re-derives fence handling, `excerpt`, `trimBlock` and timestamp reading
  because NS-P13's versions are module-private (`function`, not
  `export function`) and NS-P20 was not allowed to edit that file. Two copies
  is one too many; three would be a defect.
- The `node_types.code` `language` field is a **closed enum**. An unmapped fence
  language is filed as `other` with `unmapped_code_language` rather than
  inventing a value the inspector cannot render.
- `milestone` is a `build_events.kind`, not a `node_types` key. `deploy` and
  `breakage` are both — this parser emits them as **events**.
- Returning `200` with a warning for a file that is not yours to read is what
  makes format detection composable. NS-P21 should do the same.
