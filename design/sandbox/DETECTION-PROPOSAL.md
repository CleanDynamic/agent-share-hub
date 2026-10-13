# Detection: a proposal for the transcript parser

For the RC series that owns `supabase/functions/parse-transcript/` and `src/lib/build/intake.ts`. Both are locked by CONTRACT §4, so UI-P71 only proposes. Nothing here has been built.

## What ships now (UI-P71)

`src/lib/build/suggest.ts` suggests a file of the build as an input when its name is written word for word in a prompt (`named in the prompt`). Every suggestion is dashed until the maker accepts it, and readers never see one (CONCEPT §2.6). `suggestFromProposal(proposal, steps)` returns `[]` until the fields below exist.

Today a proposed event carries the prompt `text` and a `response_summary`, never the full reply. That is why nothing else can be detected.

## What `parse-transcript` would add to each proposed event

All from structured records in the transcript, never from prose.

| Field | Shape | Source |
| --- | --- | --- |
| `attachments` | `{ name: string, bytes?: number }[]` | attachment records on the user turn |
| `tool_calls` | `{ service: string, actions: string[] }[]` | tool-use records on the assistant turn, grouped by service |
| `agents` | `{ name?: string, count: number }[]` | sub-agent start records; `count` is how many were started at once |
| `reply_shingles` | `string[]` | see below |

## Outputs moved between sessions

For each turn, `reply_shingles` holds the first 12 hex characters of the SHA-256 of every 20-word window of the reply, after collapsing whitespace and lowercasing. The reply text is never stored.

The composer hashes the 20-word windows of each later prompt the same way, through SubtleCrypto. A run of matching windows becomes the suggestion "Output of {n} · {title} · {words} words match", where `words` is 20 plus one for each extra consecutive matching window.

## Why it is safe

- **What is stored:** names, byte counts, service and action names, counts, and 48-bit hash prefixes. No reply text, no prompt text beyond what is stored today.
- **Hashes do not hold the reply.** Each hash covers a 20-word window and is cut to 12 hex characters (48 bits), so it cannot be reversed into the words. Matching needs the same 20 words in the same order, which only someone who already holds the text can supply.
- **Redaction first.** The reply passes through `_shared/redact` before it is windowed, so a secret redacted from the reply never contributes a hash.
- **Size per turn.** A reply of W words gives W − 19 hashes of 12 characters. A 2,000-word reply is about 24 KB of hex, about 3 KB per 250 words. Cap it at 4,000 shingles per turn and drop the field beyond that.
- **Old imports:** nothing is backfilled. A turn imported before the parser change has no fields and gets no suggestions from them.
- **Errors:** identifiers only (CONTRACT §9). No field value goes into an error.

## What the client does with each field

| Field | Suggestion | Reason shown |
| --- | --- | --- |
| `attachments` | the matching file of the build, on the step made from that turn, when the name matches exactly | "attached in session {n}" |
| `tool_calls` | the matching tool of the build | "called in session {n}" |
| `agents` | an agent step for the start, with its count as "Runs several at once" | "started in session {n}" |
| `reply_shingles` | an `output` use from the step that held the reply | "{words} words match" |

Each goes through `inputRefusal` (DATA §3) and the step's `dismissed` list, as file names do now.

## Tests it would need

- Parser: an attachment, a tool call and a parallel start each produce their field from a fixture; prose that merely mentions a file produces nothing.
- Shingles: whitespace and case changes give the same hashes; 19 words give none; 20 give one; a redacted secret gives no hash.
- Client: 19 matching words give no suggestion, 20 give one; a dismissed or already-used input is not offered again; old imports give nothing.

## The order

1. The parser change, with the fields and tests above.
2. A short follow-up prompt that fills `suggestFromProposal` and its tests. No interface work is needed.
