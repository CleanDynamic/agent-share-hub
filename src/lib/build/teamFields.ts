// SV-28: what a reader needs to copy an agent or a team, stored as fields rather than left inside free text.
//
//   Part 1  A team's instructions (`payload.system_prompt` on the team node), and an agent's handoff rules
//           (`payload.handoffs: { to, when, needs_approval? }[]`), each to another agent in the same team.
//   Part 3  A job: a prompt inside an agent (n.2 onward) takes `deliverable`, `destination` and `needs_approval`. An agent takes
//           `output_rules` and `rules_followed`.
//   Part 4  An Approval step: a `manual_step` with `payload.gate = { approves, by, reviewer_agent?, blocks, reason? }`.
//   Part 5  A team's `workspace = { kind, merge?, merged_by? }` and `example_run: { agent, did, passed_on? }[]`.
//
// Every key is new and optional, so a build saved before reads as it did. All of it is method: a fork keeps it (forkRules strips
// only evidence) and `rewritePayload` points every id at the copy (it rewrites any string that is a copied node's id). Nothing here
// takes a number: team instructions are drawn in the team's head, and SV-05's numbering is unchanged.
//
// PURE, but for registering the cleaners the existing extras writer (`setExtras`) uses. Kept apart from graph.ts so graph.ts can
// read it; it reads nothing from graph.ts (the order of the top-level steps is passed in).

import type { Json } from "@/integrations/supabase/types";

import { clean, registerCleaners } from "./tileExtras";

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const fail = (message: string): never => {
  throw new Error(message);
};

/** The node shape these read: a placed tree node, or a flat row with its parent. */
export interface TeamNode {
  id: string;
  type: string;
  parent_id: string | null;
  title?: string | null;
  position?: number | null;
  payload?: unknown;
  children?: readonly TeamNode[];
}

const AGENT = "agent_config";
const TEAM = "team";
const PROMPT = "prompt";
const MANUAL = "manual_step";

const flat = (nodes: readonly TeamNode[]): TeamNode[] => nodes.flatMap((node) => [node, ...flat(node.children ?? [])]);
const payloadOf = (node: Pick<TeamNode, "payload"> | undefined): Raw => (node && isRecord(node.payload) ? node.payload : {});

/** The agents a team holds, in position order. Reads either a placed tree or flat rows. */
export function agentsOfTeam(tree: readonly TeamNode[], teamId: string): TeamNode[] {
  const all = flat(tree);
  const team = all.find((node) => node.id === teamId);
  const held = team?.children?.length ? team.children : all.filter((node) => node.parent_id === teamId);
  return [...held].filter((node) => node.type === AGENT).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/** The team an agent sits in, or null. */
export function teamOfAgent(tree: readonly TeamNode[], agentId: string): TeamNode | null {
  const all = flat(tree);
  const agent = all.find((node) => node.id === agentId);
  const parent = agent?.parent_id ? all.find((node) => node.id === agent.parent_id) : undefined;
  return agent?.type === AGENT && parent?.type === TEAM ? parent : null;
}

/** What an agent is called in a line: its role, else its title, else "Agent". */
export function agentLabel(node: Pick<TeamNode, "title" | "payload"> | undefined): string {
  return str(payloadOf(node).role) || str(node?.title) || "Agent";
}

/* ── Part 1 · team instructions ── */

export const TEAM_INSTRUCTIONS_COPY = { label: "Team instructions", placeholder: "Every agent writes in plain English and keeps its notes in the shared folder" } as const;
export const TEAM_INSTRUCTIONS_MAX = 20_000;

export const teamInstructionsOf = (payload: unknown): string => (isRecord(payload) && typeof payload.system_prompt === "string" ? payload.system_prompt.trim() : "");

/* ── Part 1 · handoff rules ── */

export const HANDOFFS_MAX = 8;
export const HANDOFF_WHEN_MAX = 120;

export interface Handoff {
  /** Another agent in the same team, by node id. */
  to: string;
  /** The maker's condition, 1 to 120 characters. */
  when: string;
  /** Part 6: a person approves before the work passes. */
  needs_approval?: true;
}

export const HANDOFF_COPY = {
  label: "Hands off to",
  to: "Agent",
  pick: "Select an agent",
  when: "When",
  whenPlaceholder: "three sources are found",
  add: "Add a handoff",
  remove: "Remove this handoff",
  approval: "A person approves first",
  line: "hands off to",
  notInTeam: "A handoff goes to another agent in the same team.",
  lone: "Only an agent in a team hands off work.",
  needsWhen: "Say when it hands off.",
  max: `Up to ${HANDOFFS_MAX} handoffs.`,
} as const;

/** An agent's handoff rules, read defensively: entries with no `to` or no `when` are skipped. */
export function handoffsOf(payload: unknown): Handoff[] {
  const raw = isRecord(payload) ? payload.handoffs : null;
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const to = str(entry.to);
      const when = str(entry.when).slice(0, HANDOFF_WHEN_MAX);
      return to && when ? [{ to, when, ...(entry.needs_approval === true ? { needs_approval: true as const } : null) }] : [];
    })
    .slice(0, HANDOFFS_MAX);
}

const cleanHandoffs = (value: unknown): Json | null => {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return fail(HANDOFF_COPY.notInTeam);
  if (value.length > HANDOFFS_MAX) fail(HANDOFF_COPY.max);
  const out = value.map((entry) => {
    const to = isRecord(entry) ? str(entry.to) : "";
    const when = isRecord(entry) ? str(entry.when) : "";
    if (!to) fail(HANDOFF_COPY.notInTeam);
    if (!when) fail(HANDOFF_COPY.needsWhen);
    if (when.length > HANDOFF_WHEN_MAX) fail(`When: ${HANDOFF_WHEN_MAX} characters max`);
    return { to, when, ...(isRecord(entry) && entry.needs_approval === true ? { needs_approval: true } : null) };
  });
  return out.length > 0 ? (out as unknown as Json) : null;
};

/* ── Part 3 · jobs ── */

export const DELIVERABLE_KINDS = ["sheet", "doc", "draft", "report", "message", "file", "other"] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];
export const DELIVERABLE_LABEL: Record<DeliverableKind, string> = { sheet: "Sheet", doc: "Doc", draft: "Draft", report: "Report", message: "Message", file: "File", other: "Other" };
/** "a draft", as the job line and the setup prompt say it. */
export const DELIVERABLE_ARTICLE: Record<DeliverableKind, string> = { sheet: "a sheet", doc: "a doc", draft: "a draft", report: "a report", message: "a message", file: "a file", other: "something" };
export const DELIVERABLE_NAME_MAX = 60;
export const DESTINATION_MAX = 60;

export interface Deliverable {
  kind: DeliverableKind;
  name: string;
}

export interface Job {
  deliverable?: Deliverable;
  /** A tool from the agent's Available tools (its integration node id, or its tool id), or typed text. */
  destination?: string;
  needsApproval?: true;
}

export const JOB_COPY = {
  deliverable: "Deliverable",
  kind: "Kind",
  name: "Name",
  namePlaceholder: "Weekly pipeline sheet",
  destination: "Destination",
  destinationPlaceholder: "Google Drive, Clients folder",
  approval: "A person approves before it's delivered",
  delivers: (kind: DeliverableKind) => `Delivers ${DELIVERABLE_ARTICLE[kind]}`,
  approvedFirst: "Approved first",
  onlyInAgent: "Only a prompt inside an agent is a job.",
} as const;

export function deliverableOf(value: unknown): Deliverable | null {
  if (!isRecord(value) || !DELIVERABLE_KINDS.includes(value.kind as DeliverableKind)) return null;
  return { kind: value.kind as DeliverableKind, name: str(value.name).slice(0, DELIVERABLE_NAME_MAX) };
}

/** A prompt's job fields; empty for a prompt with none. */
export function jobOf(payload: unknown): Job {
  const p = isRecord(payload) ? payload : {};
  const deliverable = deliverableOf(p.deliverable);
  const destination = str(p.destination).slice(0, DESTINATION_MAX);
  return { ...(deliverable ? { deliverable } : null), ...(destination ? { destination } : null), ...(p.needs_approval === true ? { needsApproval: true as const } : null) };
}

export const hasJob = (job: Job | undefined): boolean => Boolean(job && (job.deliverable || job.destination || job.needsApproval));

/** The job line's parts: "Delivers a draft", "Weekly pipeline email", "Gmail", "Approved first". The view draws " · " and "→". */
export function jobParts(job: Job, nameOf: (destination: string) => string = (destination) => destination): { delivers: string | null; name: string | null; destination: string | null; approved: string | null } {
  return {
    delivers: job.deliverable ? JOB_COPY.delivers(job.deliverable.kind) : null,
    name: job.deliverable?.name || null,
    destination: job.destination ? nameOf(job.destination) : null,
    approved: job.needsApproval ? JOB_COPY.approvedFirst : null,
  };
}

/** "Delivers a draft · Weekly pipeline email → Gmail · Approved first", as plain text (a screen reader's label, a test). */
export function jobLine(job: Job, nameOf?: (destination: string) => string): string | null {
  const parts = jobParts(job, nameOf);
  if (!parts.delivers && !parts.destination && !parts.approved) return null;
  const what = [parts.delivers, parts.name].filter(Boolean).join(" · ");
  const going = parts.destination ? (what ? `${what} → ${parts.destination}` : `→ ${parts.destination}`) : what;
  return [going, parts.approved].filter(Boolean).join(" · ");
}

/* ── Part 3 · output rules and rules followed ── */

export const OUTPUT_RULES_MAX = 8;
export const OUTPUT_RULE_MAX = 100;
export const RULES_FOLLOWED_MAX = 8;
export const RULE_TEXT_MAX = 120;

export interface RuleFollowed {
  text: string;
  url: string;
}

export const RULES_COPY = {
  output: "Output rules",
  outputHint: "One per line, for everything it produces",
  outputPlaceholder: "Drafts only, never send",
  follows: "Follows",
  followsHint: "Published guidance its instructions follow",
  text: "Guidance",
  url: "Link",
  add: "Add guidance",
  remove: "Remove this guidance",
  https: "A link to guidance starts with https://",
} as const;

export const outputRulesOf = (payload: unknown): string[] =>
  isRecord(payload) && Array.isArray(payload.output_rules) ? payload.output_rules.map((line) => str(line).slice(0, OUTPUT_RULE_MAX)).filter(Boolean).slice(0, OUTPUT_RULES_MAX) : [];

/** An https address, or null. */
export function httpsUrl(raw: unknown): string | null {
  const value = str(raw);
  if (!/^https:\/\//i.test(value) || /\s/.test(value)) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.includes(".") ? value : null;
  } catch {
    return null;
  }
}

export function rulesFollowedOf(payload: unknown): RuleFollowed[] {
  const raw = isRecord(payload) ? payload.rules_followed : null;
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const text = str(entry.text).slice(0, RULE_TEXT_MAX);
      const url = httpsUrl(entry.url);
      return text && url ? [{ text, url }] : [];
    })
    .slice(0, RULES_FOLLOWED_MAX);
}

/* ── Part 4 · the Approval step ── */

export const GATE_BY = ["maker", "reviewer", "client", "team"] as const;
export type GateBy = (typeof GATE_BY)[number];
export const GATE_BY_LABEL: Record<GateBy, string> = { maker: "The maker", reviewer: "A reviewer agent", client: "The client", team: "Someone on the team" };
export const GATE_APPROVES_MAX = 80;
export const GATE_REASON_MAX = 120;

export interface Gate {
  approves: string;
  by: GateBy;
  /** With `by: "reviewer"`: the reviewer agent's node id. */
  reviewer_agent?: string;
  /** The steps that wait for it, by node id: each numbered after the Approval step. */
  blocks: string[];
  reason?: string;
}

export const GATE_COPY = {
  title: "Approval",
  addLine: "A person approves before work continues",
  approves: "What is approved",
  approvesPlaceholder: "The client email draft",
  by: "Who approves",
  reviewer: "Reviewer agent",
  blocks: "Steps that wait for it",
  reason: "Why",
  needsApproves: "Say what is approved.",
  needsReviewer: "Pick the reviewer agent.",
  after: "A step that waits for an approval comes after it.",
  movedBefore: "Moved before its approval, so it no longer waits for it",
  waits: (number: string) => `Waits for approval (step ${number})`,
  open: (number: string) => `Open step ${number}`,
} as const;

export function gateOf(payload: unknown): Gate | null {
  const raw = isRecord(payload) ? payload.gate : null;
  if (!isRecord(raw) || !GATE_BY.includes(raw.by as GateBy)) return null;
  const approves = str(raw.approves).slice(0, GATE_APPROVES_MAX);
  if (!approves) return null;
  const blocks = Array.isArray(raw.blocks) ? [...new Set(raw.blocks.map(str).filter(Boolean))] : [];
  const reason = str(raw.reason).slice(0, GATE_REASON_MAX);
  const reviewer = raw.by === "reviewer" ? str(raw.reviewer_agent) : "";
  return { approves, by: raw.by as GateBy, ...(reviewer ? { reviewer_agent: reviewer } : null), blocks, ...(reason ? { reason } : null) };
}

const cleanGate = (value: unknown): Json | null => {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return fail(GATE_COPY.needsApproves);
  const approves = str(value.approves);
  if (!approves) fail(GATE_COPY.needsApproves);
  if (approves.length > GATE_APPROVES_MAX) fail(`What is approved: ${GATE_APPROVES_MAX} characters max`);
  if (!GATE_BY.includes(value.by as GateBy)) fail("That is not who approves.");
  if (value.by === "reviewer" && !str(value.reviewer_agent)) fail(GATE_COPY.needsReviewer);
  const reason = str(value.reason);
  if (reason.length > GATE_REASON_MAX) fail(`Why: ${GATE_REASON_MAX} characters max`);
  return gateOf({ gate: value }) as unknown as Json;
};

/** "The maker approves the client email draft": who approves what. An article starting what is approved is lower-cased. */
export function gateLead(gate: Gate, reviewerName?: string): string {
  const who = gate.by === "reviewer" && reviewerName ? reviewerName : GATE_BY_LABEL[gate.by];
  const what = /^(The|A|An|This|That|These|Those|Each|Every)\b/.test(gate.approves) ? gate.approves.charAt(0).toLowerCase() + gate.approves.slice(1) : gate.approves;
  return `${who} approves ${what}`;
}

/** "before step" or "before steps", for the numbers the view draws as buttons. */
export const beforeSteps = (count: number): string => (count === 1 ? "before step" : "before steps");

/** The whole line as text: "The maker approves the client email draft before steps 5, 6". */
export function gateLine(gate: Gate, numbers: readonly string[], reviewerName?: string): string {
  const lead = gateLead(gate, reviewerName);
  return numbers.length > 0 ? `${lead} ${beforeSteps(numbers.length)} ${numbers.join(", ")}` : lead;
}

/* ── Part 5 · workspace and example run ── */

export const WORKSPACE_KINDS = ["git_worktrees", "shared_folder", "separate"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];
export const WORKSPACE_LABEL: Record<WorkspaceKind, string> = { git_worktrees: "Each agent in its own git worktree", shared_folder: "One shared folder", separate: "Separate places, nothing shared" };
/** The head line's words for each kind. */
export const WORKSPACE_SHORT: Record<WorkspaceKind, string> = { git_worktrees: "Git worktrees", shared_folder: "One shared folder", separate: "Separate places" };
export const MERGES = ["one_at_a_time", "batched"] as const;
export type Merge = (typeof MERGES)[number];
export const MERGE_LABEL: Record<Merge, string> = { one_at_a_time: "One at a time", batched: "In batches" };
export const MAKER = "maker";

export interface Workspace {
  kind: WorkspaceKind;
  merge?: Merge;
  /** An agent node id in the team, or "maker". */
  merged_by?: string;
}

export const WORKSPACE_COPY = { label: "Shared workspace", merge: "Merged", mergedBy: "Merged by", maker: "The maker", pick: "Select who merges" } as const;

/** Merging is said only where work is shared. */
export const takesMerge = (kind: WorkspaceKind | undefined): boolean => kind === "git_worktrees" || kind === "shared_folder";

export function workspaceOf(payload: unknown): Workspace | null {
  const raw = isRecord(payload) ? payload.workspace : null;
  if (!isRecord(raw) || !WORKSPACE_KINDS.includes(raw.kind as WorkspaceKind)) return null;
  const kind = raw.kind as WorkspaceKind;
  if (!takesMerge(kind)) return { kind };
  const merge = MERGES.includes(raw.merge as Merge) ? (raw.merge as Merge) : undefined;
  const by = str(raw.merged_by);
  return { kind, ...(merge ? { merge } : null), ...(by ? { merged_by: by } : null) };
}

const cleanWorkspace = (value: unknown): Json | null => {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || !WORKSPACE_KINDS.includes(value.kind as WorkspaceKind)) return fail("That is not a way the agents share their work.");
  if (value.merge !== undefined && value.merge !== null && !MERGES.includes(value.merge as Merge)) fail("That is not a way work is merged.");
  return workspaceOf({ workspace: value }) as unknown as Json;
};

/** "Git worktrees · merged one at a time by Reviewer". */
export function workspaceLine(workspace: Workspace, nameOf: (id: string) => string): string {
  const merged = takesMerge(workspace.kind) && (workspace.merge || workspace.merged_by)
    ? ["merged", workspace.merge ? MERGE_LABEL[workspace.merge].toLowerCase() : null, workspace.merged_by ? `by ${workspace.merged_by === MAKER ? "the maker" : nameOf(workspace.merged_by)}` : null].filter(Boolean).join(" ")
    : null;
  return [WORKSPACE_SHORT[workspace.kind], merged].filter(Boolean).join(" · ");
}

export const EXAMPLE_RUN_MIN = 2;
export const EXAMPLE_RUN_MAX = 12;
export const EXAMPLE_DID_MAX = 100;
export const EXAMPLE_PASSED_MAX = 60;

export interface ExampleEntry {
  agent: string;
  did: string;
  passed_on?: string;
}

export const EXAMPLE_COPY = {
  label: "Example run",
  head: (n: number) => `Example run · ${n} ${n === 1 ? "step" : "steps"}`,
  note: "Entered by the maker, not recorded from a run.",
  did: "What it did",
  didPlaceholder: "Found three sources",
  passedOn: "Passed on",
  passedPlaceholder: "A source list",
  passed: (what: string) => `Passed on: ${what}`,
  add: "Add a step",
  remove: (n: number) => `Remove step ${n}`,
  up: (n: number) => `Move step ${n} up`,
  down: (n: number) => `Move step ${n} down`,
  range: `An example run has ${EXAMPLE_RUN_MIN} to ${EXAMPLE_RUN_MAX} steps.`,
  needsDid: "Say what each agent did.",
} as const;

export function exampleRunOf(payload: unknown): ExampleEntry[] {
  const raw = isRecord(payload) ? payload.example_run : null;
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const agent = str(entry.agent);
      const did = str(entry.did).slice(0, EXAMPLE_DID_MAX);
      const passed = str(entry.passed_on).slice(0, EXAMPLE_PASSED_MAX);
      return agent && did ? [{ agent, did, ...(passed ? { passed_on: passed } : null) }] : [];
    })
    .slice(0, EXAMPLE_RUN_MAX);
}

const cleanExampleRun = (value: unknown): Json | null => {
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) return null;
  if (!Array.isArray(value) || value.length < EXAMPLE_RUN_MIN || value.length > EXAMPLE_RUN_MAX) return fail(EXAMPLE_COPY.range);
  for (const entry of value) {
    if (!isRecord(entry) || !str(entry.agent) || !str(entry.did)) fail(EXAMPLE_COPY.needsDid);
    if (str((entry as Raw).did).length > EXAMPLE_DID_MAX) fail(`What it did: ${EXAMPLE_DID_MAX} characters max`);
    if (str((entry as Raw).passed_on).length > EXAMPLE_PASSED_MAX) fail(`Passed on: ${EXAMPLE_PASSED_MAX} characters max`);
  }
  return exampleRunOf({ example_run: value }) as unknown as Json;
};

/* ── the cleaners (the existing extras writer) ── */

registerCleaners(TEAM, {
  system_prompt: (value) => {
    if (typeof value === "string" && value.trim().length > TEAM_INSTRUCTIONS_MAX) fail(`Team instructions: ${TEAM_INSTRUCTIONS_MAX.toLocaleString("en-GB")} characters max`);
    return clean(value) || null;
  },
  workspace: cleanWorkspace,
  example_run: cleanExampleRun,
});

registerCleaners(AGENT, {
  handoffs: cleanHandoffs,
  output_rules: (value) => {
    const lines = Array.isArray(value) ? value.map((line) => clean(line)).filter(Boolean) : typeof value === "string" ? value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
    if (lines.length > OUTPUT_RULES_MAX) fail(`Output rules: ${OUTPUT_RULES_MAX} max, one per line`);
    if (lines.some((line) => line.length > OUTPUT_RULE_MAX)) fail(`Each output rule: ${OUTPUT_RULE_MAX} characters max`);
    return lines.length > 0 ? lines : null;
  },
  rules_followed: (value) => {
    if (value === null || value === undefined) return null;
    if (!Array.isArray(value)) return fail(RULES_COPY.https);
    if (value.length > RULES_FOLLOWED_MAX) fail(`Follows: ${RULES_FOLLOWED_MAX} max`);
    const out = value.map((entry) => {
      const text = isRecord(entry) ? str(entry.text) : "";
      if (!text) fail("Name the guidance.");
      if (text.length > RULE_TEXT_MAX) fail(`Guidance: ${RULE_TEXT_MAX} characters max`);
      const url = httpsUrl(isRecord(entry) ? entry.url : null);
      if (!url) fail(RULES_COPY.https);
      return { text, url: url as string };
    });
    return out.length > 0 ? (out as unknown as Json) : null;
  },
});

registerCleaners(PROMPT, {
  deliverable: (value) => {
    if (value === null || value === undefined) return null;
    if (!isRecord(value) || !DELIVERABLE_KINDS.includes(value.kind as DeliverableKind)) return fail("That is not a kind of deliverable.");
    if (str(value.name).length > DELIVERABLE_NAME_MAX) fail(`Name: ${DELIVERABLE_NAME_MAX} characters max`);
    return deliverableOf(value) as unknown as Json;
  },
  destination: (value) => {
    const said = clean(value);
    if (said.length > DESTINATION_MAX) fail(`Destination: ${DESTINATION_MAX} characters max`);
    return said || null;
  },
  needs_approval: (value) => (value === true ? true : null),
});

registerCleaners(MANUAL, { gate: cleanGate });

/* ── refusals that need the tree ── */

/**
 * Why a patch cannot be written on this node, given the build's tree and the order of its top-level steps (by id), beyond what
 * the cleaners check; null when it can. Without a tree, only what the node itself says is checked.
 */
export function teamFieldsRefusal(node: Pick<TeamNode, "id" | "type" | "parent_id">, patch: Raw, tree?: readonly TeamNode[], stepOrder?: readonly string[]): string | null {
  const all = tree ? flat(tree) : [];
  const parent = node.parent_id ? all.find((entry) => entry.id === node.parent_id) : undefined;
  if ("handoffs" in patch && Array.isArray(patch.handoffs) && patch.handoffs.length > 0) {
    if (node.type !== AGENT || node.parent_id === null) return HANDOFF_COPY.lone;
    if (tree) {
      if (parent?.type !== TEAM) return HANDOFF_COPY.lone;
      const siblings = agentsOfTeam(tree, parent.id).map((agent) => agent.id).filter((id) => id !== node.id);
      if (patch.handoffs.some((entry) => !isRecord(entry) || !siblings.includes(str(entry.to)))) return HANDOFF_COPY.notInTeam;
    }
  }
  const jobKeys = ["deliverable", "destination", "needs_approval"].filter((key) => key in patch && patch[key] !== null && patch[key] !== undefined && patch[key] !== false && patch[key] !== "");
  if (jobKeys.length > 0 && (node.type !== PROMPT || node.parent_id === null || (tree && parent?.type !== AGENT))) return JOB_COPY.onlyInAgent;
  if (tree && node.type === TEAM) {
    const members = agentsOfTeam(tree, node.id).map((agent) => agent.id);
    const workspace = isRecord(patch.workspace) ? patch.workspace : null;
    if (workspace && str(workspace.merged_by) && str(workspace.merged_by) !== MAKER && !members.includes(str(workspace.merged_by))) return "Whoever merges is the maker or an agent in this team.";
    if (Array.isArray(patch.example_run) && patch.example_run.some((entry) => !isRecord(entry) || !members.includes(str(entry.agent)))) return "Each step of the example run is one of this team's agents.";
  }
  if (tree && stepOrder && node.type === MANUAL && isRecord(patch.gate)) {
    const blocks = Array.isArray(patch.gate.blocks) ? patch.gate.blocks.map(str) : [];
    const at = stepOrder.indexOf(node.id);
    if (blocks.some((id) => topIndexIn(all, stepOrder, id) <= at)) return GATE_COPY.after;
    if (patch.gate.by === "reviewer" && !all.some((entry) => entry.id === str((patch.gate as Raw).reviewer_agent) && entry.type === AGENT)) return GATE_COPY.needsReviewer;
  }
  return null;
}

/** Where a step stands among the top-level steps: its own place, or its top-level ancestor's; -1 when it is not in the build. */
function topIndexIn(all: readonly TeamNode[], stepOrder: readonly string[], id: string): number {
  for (let node = all.find((entry) => entry.id === id); node; node = node.parent_id ? all.find((entry) => entry.id === node?.parent_id) : undefined) {
    const at = stepOrder.indexOf(node.id);
    if (at >= 0) return at;
  }
  return -1;
}

/* ── what a move or a removal leaves behind ── */

export interface TeamFix {
  id: string;
  payload: Raw;
  /** A blocked step now sits before its Approval step and no longer waits for it. */
  movedBeforeGate?: true;
}

/**
 * The payloads to write after a move or a removal, so nothing points where it no longer can: a handoff from an agent no longer in
 * a team, or to one no longer beside it; an example run's entry for an agent that left the team, and who merges when that agent
 * left; a gate's blocked step that now comes before it (or is gone). Empty when nothing changed. Pure: the caller writes each
 * through the node writer, in the same undo step as the move.
 */
export function teamWorkFixes(tree: readonly TeamNode[], stepOrder: readonly string[]): TeamFix[] {
  const all = flat(tree);
  const out: TeamFix[] = [];
  for (const node of all) {
    const payload = payloadOf(node);
    if (node.type === AGENT && Array.isArray(payload.handoffs)) {
      const team = teamOfAgent(tree, node.id);
      const siblings = team ? agentsOfTeam(tree, team.id).map((agent) => agent.id).filter((id) => id !== node.id) : [];
      const kept = handoffsOf(payload).filter((rule) => siblings.includes(rule.to));
      if (kept.length !== payload.handoffs.length) {
        const next = { ...payload };
        if (kept.length > 0) next.handoffs = kept;
        else delete next.handoffs;
        out.push({ id: node.id, payload: next });
      }
    }
    if (node.type === TEAM && (Array.isArray(payload.example_run) || isRecord(payload.workspace))) {
      const members = agentsOfTeam(tree, node.id).map((agent) => agent.id);
      const next = { ...payload };
      let changed = false;
      if (Array.isArray(payload.example_run)) {
        const kept = exampleRunOf(payload).filter((entry) => members.includes(entry.agent));
        if (kept.length !== payload.example_run.length) {
          changed = true;
          if (kept.length > 0) next.example_run = kept;
          else delete next.example_run;
        }
      }
      const workspace = workspaceOf(payload);
      if (workspace?.merged_by && workspace.merged_by !== MAKER && !members.includes(workspace.merged_by)) {
        const { merged_by: _gone, ...rest } = workspace;
        next.workspace = rest;
        changed = true;
      }
      if (changed) out.push({ id: node.id, payload: next });
    }
    if (node.type === MANUAL && isRecord(payload.gate)) {
      const gate = gateOf(payload);
      if (!gate) continue;
      const at = stepOrder.indexOf(node.id);
      const kept = gate.blocks.filter((id) => topIndexIn(all, stepOrder, id) > at);
      if (kept.length !== (Array.isArray(payload.gate.blocks) ? payload.gate.blocks.length : 0)) {
        const before = gate.blocks.some((id) => {
          const where = topIndexIn(all, stepOrder, id);
          return where >= 0 && where <= at;
        });
        out.push({ id: node.id, payload: { ...payload, gate: { ...payload.gate, blocks: kept } }, ...(before ? { movedBeforeGate: true as const } : null) });
      }
    }
  }
  return out;
}

/* ── Part 4: which steps wait for which gate ── */

/** For each blocked step id, the id of the Approval step it waits for (the first one, in step order). */
export function waitsForOf(tree: readonly TeamNode[], stepOrder: readonly string[]): Map<string, string> {
  const all = flat(tree);
  const out = new Map<string, string>();
  for (const id of stepOrder) {
    const node = all.find((entry) => entry.id === id);
    const gate = node?.type === MANUAL ? gateOf(node.payload) : null;
    if (!gate) continue;
    const at = stepOrder.indexOf(id);
    for (const blocked of gate.blocks) if (!out.has(blocked) && topIndexIn(all, stepOrder, blocked) > at) out.set(blocked, id);
  }
  return out;
}
