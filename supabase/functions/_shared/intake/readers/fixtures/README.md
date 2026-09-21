# Intake reader fixtures

Captured-shape fixtures for the `deno test` suites beside the readers.

**Nothing in here is anyone's real writing.** Each file keeps the *shape* of a
real export — its keys, its block types, their order, the alternation of
speakers, the turn count — and replaces every human and assistant message,
every conversation name and every attachment's text with invented content of
similar size and kind. Identifiers are invented too. A fixture is a structural
sample, never a transcript.

| File | Shape it preserves |
| --- | --- |
| `claude-one-conversation.json` | One conversation, eight alternating turns, from a Claude.ai `conversations.json` account export. Carries every block type the reader folds — `text`, `thinking`, `tool_use`, `tool_result` — plus an attachment with `extracted_content`, `files[]` entries with names only, a failed tool call, and a fenced code block in the last turn. Block counts are smaller than the export this was shaped from; the types, their order and the turn structure are not. |
| `claude-two-conversations.json` | Two short conversations in one file, the case an import cannot be. The first turn carries an `injected_prompt_block` — the one block Claude.ai writes rather than a person — kept verbatim because the platform wrote it, not the creator. |
