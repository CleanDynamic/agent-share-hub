// SV-27 P10: the architecture map: a drawing of the deployment, what connects to what. The deployment in, boxes and lines out,
// in the map's own px space, laid out left to right (or top to bottom: the same columns become rows). Drawn at rest.
//
//   Column 1 · In      channels, and what How did it run? says starts the agent (On a schedule, When something happened,
//                      All the time, Ongoing goal)
//   Column 2 · Agents  each agent or team (harness or framework, model used, approvals; a team its pattern, each agent its
//                      role), and a relay between the agents it joins, its network under it
//   Column 3 · Uses    inference servers (the model they serve and its quant type), knowledge base, memory, MCP servers,
//                      tools from Available tools, skills
//   Column 4 · Out     voice, front end, billing
//   Below              monitoring, with `watches` lines to what it watches
//
// The host is a frame around everything that runs on it, its name and GPUs in its top edge. Lines come from `connects` and the
// implied ones, each once. Coordinates are rounded to one decimal. PURE.

import { toolName } from "@/lib/tools/registry";

import { agentFieldsOf, APPROVAL_LABEL } from "./agentFields";
import { deploymentName, deploymentTilesOf, idOfRef, providerName, VOICE_MODE_LABEL, type DeploymentTile } from "./deployment";
import { gpusWord, modelRunOf } from "./modelRun";
import { agentSetupItemsOf } from "./setup";
import { mentionsOf } from "./mentions";
import { agentsOfTeam, handoffsOf, HANDOFF_COPY } from "./teamFields";
import { AGENT_PATTERN_LABEL, patternOf } from "./tileExtras";
import type { NodeTree } from "./types";

export type ArchColumn = 1 | 2 | 3 | 4 | 5;
export type ArchDirection = "horizontal" | "vertical";

export interface ArchBox {
  id: string;
  /** The tile it draws, when it draws one (a trigger box draws none). */
  tile: string | null;
  kind: string;
  column: ArchColumn;
  title: string;
  lines: string[];
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArchLine {
  from: string;
  to: string;
  label: string;
  /** SV-28 P2: a mention with no handoff rule is drawn dotted. */
  dotted?: true;
  /** SV-28 P1: a handoff's condition, for the line's tooltip and Details. */
  when?: string;
  /** Start and end, on the boxes' edges. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ArchFrame {
  host: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArchitectureLayout {
  direction: ArchDirection;
  width: number;
  height: number;
  boxes: ArchBox[];
  lines: ArchLine[];
  frames: ArchFrame[];
}

/** The map's measures, in its own px space. */
export const ARCH = { boxW: 184, boxH: 48, lineH: 16, colGap: 72, rowGap: 16, framePad: 20, frameLabel: 20, monitorGap: 40 } as const;

export const TRIGGER_LABEL: Record<string, string> = { schedule: "On a schedule", event: "When something happened", background: "All the time", ongoing: "Ongoing goal" };

const round = (value: number): number => Math.round(value * 10) / 10;
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const str = (value: unknown): string => (typeof value === "string" ? value : "");

type Node = NodeTree;
const flatten = (nodes: readonly Node[]): Node[] => nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);

interface Draft {
  id: string;
  tile: string | null;
  kind: string;
  column: ArchColumn;
  title: string;
  lines: string[];
}

function agentDraft(node: Node): Draft {
  const payload = record(node.payload);
  const fields = agentFieldsOf(payload);
  const harness = str(payload.harness);
  const lines: string[] = [];
  const runsIn = harness ? (toolName(harness) ?? harness) : fields.framework ? (toolName(fields.framework) ?? fields.framework) : "";
  if (runsIn) lines.push(runsIn);
  if (str(payload.model)) lines.push(str(payload.model));
  if (fields.approvalMode) lines.push(APPROVAL_LABEL[fields.approvalMode]);
  if (node.type === "team") {
    const pattern = patternOf(payload.pattern);
    if (pattern) lines.push(AGENT_PATTERN_LABEL[pattern]);
  }
  if (node.type === "agent_config" && fields.role) lines.unshift(fields.role);
  return { id: node.id, tile: node.id, kind: node.type === "team" ? "team" : "agent", column: 2, title: node.title ?? (node.type === "team" ? "Team" : "Agent"), lines };
}

function tileDraft(tile: DeploymentTile, column: ArchColumn, all: readonly Node[]): Draft {
  const lines: string[] = [];
  if (tile.kind === "inference_server") {
    for (const served of tile.payload.serves) {
      const node = all.find((entry) => entry.id === served.tile);
      const run = modelRunOf(record(node?.payload).modelRun);
      lines.push([served.model, run?.precision].filter(Boolean).join(" · "));
    }
  }
  if (tile.kind === "voice") lines.push(VOICE_MODE_LABEL[tile.payload.mode]);
  if (tile.kind === "relay" && tile.payload.network) lines.push(providerName(tile.payload.network));
  if (tile.kind === "billing" && tile.payload.unit) lines.push(`Per ${tile.payload.unit}`);
  return { id: tile.id, tile: tile.id, kind: tile.kind, column, title: deploymentName(tile), lines: lines.filter(Boolean) };
}

const COLUMN_OF: Partial<Record<DeploymentTile["kind"], ArchColumn>> = { channel: 1, relay: 2, inference_server: 3, knowledge_base: 3, memory: 3, voice: 4, front_end: 4, billing: 4, monitoring: 5 };

/** The deployment of a build as boxes, lines and host frames. */
export function layoutArchitecture(tree: readonly Node[], direction: ArchDirection = "horizontal"): ArchitectureLayout {
  const all = flatten(tree);
  const tiles = deploymentTilesOf(tree);
  // Every agent or team, top level first; a team's agents follow it, each its own box (its role on it).
  const agents = tree.filter((node) => node.parent_id === null && (node.type === "agent_config" || node.type === "team")).flatMap((node) => [node, ...(node.type === "team" ? (node.children ?? []).filter((child) => child.type === "agent_config") : [])]);
  const parentOf = new Map(agents.flatMap((node) => (node.children ?? []).map((child) => [child.id, node.id] as const)));
  const drafts: Draft[] = [];
  const edges: { from: string; to: string; label: string; dotted?: true; when?: string }[] = [];
  const edge = (from: string, to: string, label: string, extra?: { dotted?: true; when?: string }) => {
    if (from === to || !drafts.some((draft) => draft.id === from) || !drafts.some((draft) => draft.id === to)) return;
    if (!edges.some((entry) => entry.from === from && entry.to === to && entry.label === label)) edges.push({ from, to, label, ...extra });
  };

  // Column 1: channels, then what starts each agent.
  for (const tile of tiles) if (tile.kind === "channel") drafts.push(tileDraft(tile, 1, all));
  for (const agent of agents) {
    const how = str(record(record(agent.payload).runs).how);
    if (TRIGGER_LABEL[how] && !drafts.some((draft) => draft.id === `trigger:${how}`)) drafts.push({ id: `trigger:${how}`, tile: null, kind: "trigger", column: 1, title: TRIGGER_LABEL[how], lines: how === "ongoing" && str(record(record(agent.payload).runs).detail) ? [str(record(record(agent.payload).runs).detail)] : [] });
  }
  // Column 2: agents and teams, relays between them.
  const relays = tiles.filter((tile) => tile.kind === "relay");
  agents.forEach((agent, at) => {
    drafts.push(agentDraft(agent));
    // A relay sits between the agents it joins: after the first of them.
    for (const relay of relays) if (relay.kind === "relay" && relay.payload.joins[0] === agent.id && !drafts.some((draft) => draft.id === relay.id)) drafts.push(tileDraft(relay, 2, all));
    void at;
  });
  for (const relay of relays) if (!drafts.some((draft) => draft.id === relay.id)) drafts.push(tileDraft(relay, 2, all));
  // Column 3: what the agents use.
  for (const tile of tiles) if (COLUMN_OF[tile.kind] === 3) drafts.push(tileDraft(tile, 3, all));
  for (const agent of agents) {
    for (const item of agentSetupItemsOf(tree as NodeTree[], agent.id)) if (item.kind === "server" || item.kind === "skill") drafts.push({ id: `setup:${item.id}`, tile: item.id, kind: item.kind, column: 3, title: item.name, lines: [item.kind === "server" ? "MCP server" : "Skill"] });
    const tools = Array.isArray(record(agent.payload).tools) ? (record(agent.payload).tools as unknown[]).filter((tool): tool is string => typeof tool === "string") : [];
    for (const tool of tools) if (!drafts.some((draft) => draft.id === `tool:${tool}`)) drafts.push({ id: `tool:${tool}`, tile: null, kind: "tool", column: 3, title: toolName(tool) ?? tool, lines: ["Tool"] });
  }
  // Column 4: what goes out; then monitoring under the columns.
  for (const tile of tiles) if (COLUMN_OF[tile.kind] === 4) drafts.push(tileDraft(tile, 4, all));
  for (const tile of tiles) if (tile.kind === "monitoring") drafts.push(tileDraft(tile, 5, all));

  // Lines: the implied ones, then each tile's own `connects`.
  const agentIds = agents.filter((agent) => agent.type === "agent_config").map((agent) => agent.id);
  const everyAgent = agentIds.length > 0 ? agentIds : agents.map((agent) => agent.id);
  const ownerOf = (tile: DeploymentTile): string | null => (tile.kind === "front_end" ? tile.payload.front_end_of : tile.payload.agent) || (agents.length === 1 ? agents[0].id : null);
  for (const agent of agents) {
    const runs = record(record(agent.payload).runs);
    if (TRIGGER_LABEL[str(runs.how)]) edge(`trigger:${str(runs.how)}`, agent.id, "starts");
    const run = modelRunOf(record(agent.payload).modelRun);
    if (run?.server) edge(agent.id, run.server, "calls");
    for (const item of agentSetupItemsOf(tree as NodeTree[], agent.id)) if (item.kind === "server" || item.kind === "skill") edge(agent.id, `setup:${item.id}`, item.kind === "server" ? "calls" : "reads");
    const tools = Array.isArray(record(agent.payload).tools) ? (record(agent.payload).tools as unknown[]) : [];
    for (const tool of tools) if (typeof tool === "string") edge(agent.id, `tool:${tool}`, "calls");
  }
  // SV-28 P1 and P2: inside a team, one line per handoff rule; a mention of another agent with no rule from A to B, dotted.
  for (const team of agents.filter((node) => node.type === "team")) {
    const members = agentsOfTeam(tree as NodeTree[], team.id);
    for (const agent of members) {
      const rules = handoffsOf(agent.payload);
      for (const rule of rules) edge(agent.id, rule.to, HANDOFF_COPY.line, { when: rule.when });
      const said = mentionsOf(str(record(agent.payload).system_prompt), members.map((member) => ({ id: member.id, role: str(record(member.payload).role), title: member.title ?? null })));
      for (const mention of said.mentions) if (!rules.some((rule) => rule.to === mention.id)) edge(agent.id, mention.id, "mentions", { dotted: true });
    }
  }
  for (const tile of tiles) {
    const owner = ownerOf(tile);
    if (tile.kind === "channel" && owner && tile.payload.direction !== "sends") edge(tile.id, owner, "sends to");
    if (tile.kind === "memory" && owner) edge(owner, tile.id, "writes");
    if (tile.kind === "voice" && owner) edge(owner, tile.id, "speaks through");
    if (tile.kind === "front_end" && owner) edge(owner, tile.id, "sends to");
    if (tile.kind === "billing" && owner) edge(owner, tile.id, "bills through");
    if (tile.kind === "inference_server") for (const served of tile.payload.serves) edge(served.tile, tile.id, "calls");
    if (tile.kind === "knowledge_base") {
      const readers = tile.payload.read_by.length > 0 ? tile.payload.read_by : everyAgent;
      for (const reader of readers) edge(tile.id, reader, "reads");
      if (tile.payload.written_by !== "the maker") for (const reader of readers) edge(reader, tile.id, "writes");
    }
    if (tile.kind === "relay") for (const joined of tile.payload.joins) edge(tile.id, joined, "relays");
    for (const link of tile.payload.connects) {
      const to = idOfRef(link.to);
      if (to) edge(tile.id, to, link.label);
    }
    if (tile.kind === "monitoring" && !tile.payload.connects.some((link) => link.label === "watches")) for (const id of everyAgent) edge(tile.id, id, "watches");
  }

  // Place: each column a stack, top to bottom; monitoring in a row under the columns.
  const heightOf = (draft: Draft) => ARCH.boxH + Math.max(0, draft.lines.length - 1) * ARCH.lineH;
  const hosts = tiles.filter((tile): tile is Extract<DeploymentTile, { kind: "host" }> => tile.kind === "host");
  const top = hosts.length > 0 ? ARCH.framePad + ARCH.frameLabel : 0;
  const left = hosts.length > 0 ? ARCH.framePad : 0;
  const placed = new Map<string, { x: number; y: number; w: number; h: number }>();
  const vertical = direction === "vertical";
  // Vertical: the same columns become rows, each as tall as its tallest box, the boxes side by side.
  const rowH = Math.max(ARCH.boxH, ...drafts.map(heightOf));
  let tallest = 0;
  for (const column of [1, 2, 3, 4] as const) {
    let along = vertical ? left : top;
    for (const draft of drafts.filter((entry) => entry.column === column)) {
      const h = heightOf(draft);
      if (vertical) {
        placed.set(draft.id, { x: along, y: top + (column - 1) * (rowH + ARCH.colGap), w: ARCH.boxW, h });
        along += ARCH.boxW + ARCH.rowGap;
      } else {
        placed.set(draft.id, { x: left + (column - 1) * (ARCH.boxW + ARCH.colGap), y: along, w: ARCH.boxW, h });
        along += h + ARCH.rowGap;
      }
    }
    tallest = Math.max(tallest, vertical ? top + (column - 1) * (rowH + ARCH.colGap) + rowH : along - ARCH.rowGap);
  }
  const frameBottom = tallest + (hosts.length > 0 ? ARCH.framePad : 0);
  let x = left;
  for (const draft of drafts.filter((entry) => entry.column === 5)) {
    placed.set(draft.id, { x, y: frameBottom + ARCH.monitorGap, w: ARCH.boxW, h: heightOf(draft) });
    x += ARCH.boxW + ARCH.colGap;
  }

  // The host frame: around the boxes that run on it (its agent and that agent's deployment; every agent when it names none).
  const frames: ArchFrame[] = hosts.map((host) => {
    const on = drafts.filter((draft) => {
      if (draft.column === 5) return false;
      if (!host.payload.agent) return true;
      const onIt = (id: string | null) => id !== null && (id === host.payload.agent || parentOf.get(id) === host.payload.agent);
      if (onIt(draft.id)) return true;
      const tile = tiles.find((entry) => entry.id === draft.tile);
      return tile ? onIt(ownerOf(tile)) : draft.kind === "trigger" || draft.id.startsWith("setup:") || draft.id.startsWith("tool:");
    });
    const boxes = on.map((draft) => placed.get(draft.id)).filter((box): box is { x: number; y: number; w: number; h: number } => Boolean(box));
    const minX = Math.min(...boxes.map((box) => box.x)) - ARCH.framePad;
    const minY = Math.min(...boxes.map((box) => box.y)) - ARCH.framePad - ARCH.frameLabel;
    const maxX = Math.max(...boxes.map((box) => box.x + box.w)) + ARCH.framePad;
    const maxY = Math.max(...boxes.map((box) => box.y + box.h)) + ARCH.framePad;
    const gpus = gpusWord({ name: deploymentName(host), gpus: host.payload.gpus });
    return { host: host.id, label: gpus ? `${deploymentName(host)} · ${gpus}` : deploymentName(host), x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  });

  const boxes: ArchBox[] = drafts.map((draft) => {
    const at = placed.get(draft.id) as { x: number; y: number; w: number; h: number };
    return { ...draft, x: round(at.x), y: round(at.y), w: round(at.w), h: round(at.h) };
  });
  const byId = new Map(boxes.map((box) => [box.id, box]));
  const lines: ArchLine[] = edges.map((entry) => {
    const a = byId.get(entry.from) as ArchBox;
    const b = byId.get(entry.to) as ArchBox;
    const horizontal = direction === "horizontal";
    // SV-28: two agents of one team sit in the same column (a row, drawn vertically): the line joins their facing edges.
    if (horizontal ? a.x === b.x : a.y === b.y) {
      const [p, q] = (horizontal ? a.y <= b.y : a.x <= b.x) ? [a, b] : [b, a];
      const ends = horizontal ? { x1: p.x + p.w / 2, y1: p.y + p.h, x2: q.x + q.w / 2, y2: q.y } : { x1: p.x + p.w, y1: p.y + p.h / 2, x2: q.x, y2: q.y + q.h / 2 };
      return { ...entry, x1: round(ends.x1), y1: round(ends.y1), x2: round(ends.x2), y2: round(ends.y2) };
    }
    const forward = horizontal ? a.x <= b.x : a.y <= b.y;
    const [p, q] = forward ? [a, b] : [b, a];
    const x1 = horizontal ? p.x + p.w : p.x + p.w / 2;
    const y1 = horizontal ? p.y + p.h / 2 : p.y + p.h;
    const x2 = horizontal ? q.x : q.x + q.w / 2;
    const y2 = horizontal ? q.y + q.h / 2 : q.y;
    return { ...entry, x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2) };
  });
  const outFrames = frames.map((frame) => ({ ...frame, x: round(frame.x), y: round(frame.y), w: round(frame.w), h: round(frame.h) }));
  const width = round(Math.max(0, ...boxes.map((box) => box.x + box.w), ...outFrames.map((frame) => frame.x + frame.w)));
  const height = round(Math.max(0, ...boxes.map((box) => box.y + box.h), ...outFrames.map((frame) => frame.y + frame.h)));
  return { direction, width, height, boxes, lines, frames: outFrames };
}
