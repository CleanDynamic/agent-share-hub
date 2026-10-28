// SV-18: the reader's saved items for the page tests (sv18.insert.test.tsx). Test support only.

import type { LibrarySavedItem } from "@/lib/library/savedItems";

const item = (id: string, kind: LibrarySavedItem["kind"], ref: string | null, snapshot: Record<string, unknown>): LibrarySavedItem => ({
  id,
  kind,
  buildId: "b-src",
  ref,
  snapshot,
  sourceVersion: null,
  note: null,
  savedAt: "2026-10-12T10:00:00Z",
  lastUsedAt: "2026-10-12T10:00:00Z",
});

const source = { buildId: "b-src", buildTitle: "Call notes", buildSlug: "call-notes", makerId: "maya-id" };

export const savedFixtures = (): LibrarySavedItem[] => [
  item("si-prompt", "step", "src-prompt", { type: "prompt", title: "Summary on one prompt", note: null, payload: { text: "Summarise the call.", model: "claude-opus-5-5" }, source: { ...source, nodeId: "src-prompt" } }),
  item("si-agent", "step", "src-agent", { type: "agent_config", title: "Research brief", note: null, payload: { system_prompt: "Research the topic.", model: "claude-sonnet-5-5" }, source: { ...source, nodeId: "src-agent" } }),
  item("si-session", "session", "import-9", { title: "Inbox triage", model: "claude-sonnet-5-5", prompts: [{ text: "Sort my inbox." }, { text: "Draft replies." }], source: { ...source, tool: "Claude Code" } }),
  item("si-request", "request", "bounty-1", { bountyId: "bounty-1", status: "open", rewardGbp: 50, gap: null, source: null, title: "A request" }),
];
