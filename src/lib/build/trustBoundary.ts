// SV-28 Part 6: the trust boundary. An agent that reads outside content (email, web pages, messages the maker does not control)
// can be steered by what it reads. When its work reaches an agent that can send messages, write to accounts or spend, with no
// person approving in between, a reader should know before copying it.
//
//   Reads outside content  `readsOutsideContent(agent, tree)` names at least one tool (the harness, or an Available tool whose
//                          registry entry has `readsOutside: true`). `reads` holds those names.
//   Can send or spend      any `tool_permissions` value is `write` or `delegated`, or `approval_mode` is `full`. `acts` holds the
//                          tools and what they may do ("Slack", "write"), or "full access".
//   A crossing             one agent that does both (reading through a tool other than the ones it acts through), or a handoff
//                          rule from an agent that reads to one that acts.
//   Not a crossing         when an approval sits between: the handoff rule has `needs_approval`; every job of the receiving agent
//                          has `needs_approval`; an Approval step blocks the receiving agent (or the team it is in); or the
//                          receiving agent's `approval_mode` is `every` or `reviewer`.
//
// It describes the build; it blocks nothing. PURE.

import { toolName } from "@/lib/tools/registry";

import { readsOutsideContent } from "./outsideContent";
import { agentLabel, gateOf, handoffsOf, jobOf, type TeamNode } from "./teamFields";
import type { BuildRecord } from "./types";

export interface Crossing {
  /** The agent that reads outside content. */
  from: string;
  /** The agent that can send or spend: `from` itself when one agent does both. */
  to: string;
  reads: string[];
  acts: string[];
}

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const flat = (nodes: readonly TeamNode[]): TeamNode[] => nodes.flatMap((node) => [node, ...flat(node.children ?? [])]);
const payloadOf = (node: TeamNode | undefined): Raw => (node && isRecord(node.payload) ? node.payload : {});

const AGENT = "agent_config";
const TOOL_NODE = "integration";

/** An agent's Available tools as tool ids: an integration node's service, or the id or name stored as it is. */
function toolsOf(payload: Raw, all: readonly TeamNode[]): string[] {
  const raw = Array.isArray(payload.tools) ? payload.tools : [];
  return raw.flatMap((entry) => {
    if (typeof entry === "string" && entry.trim()) return [entry.trim()];
    const ref = isRecord(entry) && typeof entry.tool_ref === "string" ? entry.tool_ref : null;
    const service = ref ? payloadOf(all.find((node) => node.id === ref && node.type === TOOL_NODE)).service : null;
    return typeof service === "string" && service.trim() ? [service.trim()] : [];
  });
}

/** The outside tools an agent reads, through `readsOutsideContent`: its harness, then each of its tools. */
export function readsOf(agent: TeamNode, all: readonly TeamNode[]): string[] {
  const payload = payloadOf(agent);
  const tools = toolsOf(payload, all);
  const nodes = tools.map((service, at) => ({ id: `tool:${at}`, type: TOOL_NODE, payload: { service } }));
  return readsOutsideContent({ kind: "agent", harness: typeof payload.harness === "string" ? payload.harness : null, toolRefs: nodes.map((node) => node.id) }, nodes);
}

/** What an agent may do that sends or spends: its tools with Read and write or Acts as the maker, and full access. */
export function actsOf(agent: TeamNode): string[] {
  const payload = payloadOf(agent);
  const permissions = isRecord(payload.tool_permissions) ? payload.tool_permissions : {};
  const tools: string[] = [];
  const kinds: string[] = [];
  for (const [tool, permission] of Object.entries(permissions)) {
    if (permission !== "write" && permission !== "delegated") continue;
    const name = toolName(tool) ?? tool;
    if (!tools.includes(name)) tools.push(name);
    const word = permission === "write" ? "write" : "acts as the maker";
    if (!kinds.includes(word)) kinds.push(word);
  }
  return [...tools, ...kinds, ...(payload.approval_mode === "full" ? ["full access"] : [])];
}

/** Whether a person approves before this agent acts on work it is given. */
function approvedBefore(agent: TeamNode, all: readonly TeamNode[]): boolean {
  const payload = payloadOf(agent);
  if (payload.approval_mode === "every" || payload.approval_mode === "reviewer") return true;
  const jobs = all.filter((node) => node.parent_id === agent.id && node.type === "prompt").map((node) => jobOf(node.payload));
  if (jobs.length > 0 && jobs.every((job) => job.needsApproval)) return true;
  const holders = [agent.id, ...(agent.parent_id ? [agent.parent_id] : [])];
  return all.some((node) => node.type === "manual_step" && (gateOf(node.payload)?.blocks ?? []).some((id) => holders.includes(id)));
}

/** The build's trust boundary crossings, in the order of its agents, each once. */
export function trustBoundaryOf(build: Pick<BuildRecord, "tree"> | { tree: readonly TeamNode[] }): Crossing[] {
  const all = flat(build.tree as readonly TeamNode[]);
  const agents = all.filter((node) => node.type === AGENT);
  const out: Crossing[] = [];
  const add = (crossing: Crossing) => {
    if (!out.some((entry) => entry.from === crossing.from && entry.to === crossing.to)) out.push(crossing);
  };
  for (const agent of agents) {
    const reads = readsOf(agent, all);
    if (reads.length === 0) continue;
    const acts = actsOf(agent);
    // One agent that does both: what it reads from one place reaches another it can act on. A tool it reads and writes itself (a
    // Slack it reads and posts in) is not, on its own, a crossing: the content goes back where it came from.
    const elsewhere = reads.filter((name) => !acts.includes(name));
    if (acts.length > 0 && elsewhere.length > 0 && !approvedBefore(agent, all)) add({ from: agent.id, to: agent.id, reads: elsewhere, acts });
    for (const rule of handoffsOf(agent.payload)) {
      if (rule.needs_approval) continue;
      const to = agents.find((node) => node.id === rule.to);
      if (!to || to.parent_id !== agent.parent_id) continue;
      const theirs = actsOf(to);
      if (theirs.length > 0 && !approvedBefore(to, all)) add({ from: agent.id, to: to.id, reads, acts: theirs });
    }
  }
  return out;
}

/* ── the words ── */

export const TRUST_COPY = { head: "Trust boundary" } as const;

const join = (names: readonly string[]): string => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** What an agent is called in these lines: its role, else its title. */
export function crossingNames(crossing: Crossing, tree: readonly TeamNode[]): { from: string; to: string } {
  const all = flat(tree);
  return { from: agentLabel(all.find((node) => node.id === crossing.from)), to: agentLabel(all.find((node) => node.id === crossing.to)) };
}

/** Details, under Trust boundary: "Reads outside content (Gmail) and passes work to Operations, which can send (Slack, write). No approval between." */
export function crossingDetail(crossing: Crossing, tree: readonly TeamNode[]): string {
  const { to } = crossingNames(crossing, tree);
  const acts = crossing.acts.join(", ");
  return crossing.from === crossing.to
    ? `Reads outside content (${join(crossing.reads)}) and can send (${acts}). No approval between.`
    : `Reads outside content (${join(crossing.reads)}) and passes work to ${to}, which can send (${acts}). No approval between.`;
}

/** Before you copy: "Research reads outside content and passes work to Operations, which can send or spend, with no approval between." */
export function crossingLine(crossing: Crossing, tree: readonly TeamNode[]): string {
  const { from, to } = crossingNames(crossing, tree);
  return crossing.from === crossing.to
    ? `${from} reads outside content and can send or spend, with no approval between.`
    : `${from} reads outside content and passes work to ${to}, which can send or spend, with no approval between.`;
}
