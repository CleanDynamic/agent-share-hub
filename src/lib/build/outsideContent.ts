// CA-03 P7: which outside tools an agent can use. PURE.
//
// An agent that reads email, web pages or other people's files can be steered by what it reads. A reader should see
// that in plain words, without needing the term for it. A tool says it reads such content with `readsOutside` in the
// registry; this finds the ones an agent can use: the tool it runs in (its harness), then each integration node in its
// `payload.tools` whose service is one. A typed tool the registry does not know is not counted: it cannot be checked.
// An agent inside a team is checked on its own.

import { toolFor } from "@/lib/tools/registry";

import { TOOL_TYPE, type Step } from "./graph";
import type { BuildNode } from "./types";

type ToolNode = Pick<BuildNode, "id" | "type"> & { payload?: unknown };

const serviceOf = (node: ToolNode): string | null => {
  const payload = node.payload;
  const service = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>).service : null;
  return typeof service === "string" && service.trim() ? service.trim() : null;
};

/** The names of the outside tools an agent can use, in order and once each: its harness first, then its tools. */
export function readsOutsideContent(agent: Pick<Step, "kind" | "harness" | "toolRefs">, tree: readonly ToolNode[]): string[] {
  if (agent.kind !== "agent") return [];
  const out: string[] = [];
  const note = (raw: string | null | undefined) => {
    const tool = toolFor(raw);
    if (tool?.readsOutside && !out.includes(tool.name)) out.push(tool.name);
  };
  note(agent.harness);
  for (const ref of agent.toolRefs ?? []) {
    const node = tree.find((candidate) => candidate.id === ref && candidate.type === TOOL_TYPE);
    if (node) note(serviceOf(node));
  }
  return out;
}

/** "Gmail", "Gmail and Notion", "Gmail, Notion and Zapier". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
