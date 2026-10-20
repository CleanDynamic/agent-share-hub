# CA-05 P4: summarised, and helpers from the chat

**Stopped. Nothing was built for either item.** The prompt says to stop an item when the format on disk does not
record it, to show a redacted sample of what it does record, and not to guess from prose.

## What the prompt said, and what is on disk

- The prompt says to extend "CA-04's tool-record reader in `supabase/functions/_shared/intake/parsers/transcript.ts`".
  That file has no tool-record reader. It splits pasted transcripts into turns by their speaker labels and reads no
  tool call. CA-04 added nothing to `supabase/functions/` (its commits touch `src/` and `design/` only).
- The one reader that sees tool calls is `supabase/functions/_shared/intake/readers/claude.ts`, which reads the
  Claude.ai account export (`conversations.json`). It folds each `tool_use` block to one line, `[ran <name>]`, and
  by design never reads `input` or a tool result (its header, decision 3, gives the reason).
- Nothing reads a Claude Code session file (`.jsonl`). No fixture of one exists in the repository.

## What the Claude.ai export records (redacted: strings are shown as their length)

A conversation:

```json
{ "uuid": "<38>", "name": "<31>", "summary": "<0>", "created_at": "<27>", "updated_at": "<27>", "account": { "uuid": "<36>" } }
```

`summary` is the conversation's own one-line title text, empty here. It is not a position in the chat and says
nothing of the chat being compacted.

A `tool_use` block, from the assistant message that ran it:

```json
{ "type": "<8>", "id": "<2>", "name": "<4>", "input": { "path": "<15>" }, "message": "<18>",
  "start_timestamp": "<27>", "stop_timestamp": "<27>", "flags": null, "integration_name": null,
  "tool_identifier": null, "is_mcp_app": false, "hidden_in_chat": null, "mcp_server_url": null, "tool_origin": "<11>" }
```

The tool names in the two fixtures are `view` and `bash_tool`. No block marks a compaction, and no block names a
helper agent, its type or its instructions. A helper's type and instructions would sit in `input`, which the reader
deliberately never opens, and no sample here has one to read.

## What would unblock it

A real Claude Code session file (redacted) that was compacted, and one that started a helper through the Agent
tool, so the reader can be written against what the file records. The marker and the dashed helper suggestion
described in P4 are then a small step: the List and the build page already draw one-line, optional rows from
`sessions_meta`.
