// SV-27 — a build's deployment: everything a finished agent runs on and with, beyond its prompts.
//
// A DEPLOYMENT TILE is a top-level node of one of the nine deployment node types (host, inference_server, memory, channel,
// voice, monitoring, billing, knowledge_base, relay), or a `live_app` that names an agent (`front_end_of`), shown as Front end.
// Deployment tiles are not steps: their types are not in graph.ts's KIND_OF_TYPE, so `isStepNode` leaves them out and they take
// no number (SV-05's numbering and SV-23's stored counts are unchanged by one).
//
// PURE. No React, no Supabase.

import { toolName } from "@/lib/tools/registry";

/** The nine node types the SV-27 migration adds. */
export const DEPLOYMENT_TYPES = ["host", "inference_server", "knowledge_base", "memory", "relay", "channel", "voice", "monitoring", "billing"] as const;
export type DeploymentType = (typeof DEPLOYMENT_TYPES)[number];

/** The front end reuses the existing `live_app` node type. */
export const FRONT_END_TYPE = "live_app";

/** A deployment kind as the composer names it: the nine types and the front end. */
export type DeploymentKind = DeploymentType | "front_end";

/** The Add menu's Deployment group, in order (Part 7), each with its line. */
export const DEPLOYMENT_ADD_ITEMS: readonly { kind: DeploymentKind; name: string; line: string }[] = [
  { kind: "host", name: "Host", line: "Machine the agent runs on" },
  { kind: "inference_server", name: "Inference server", line: "Serves a model over HTTP" },
  { kind: "knowledge_base", name: "Knowledge base", line: "Shared notes every agent reads" },
  { kind: "memory", name: "Memory", line: "Memory kept between conversations" },
  { kind: "relay", name: "Relay", line: "Passes messages between agents" },
  { kind: "channel", name: "Channel", line: "Messaging service it's reached through" },
  { kind: "voice", name: "Voice", line: "Speech in or out" },
  { kind: "front_end", name: "Front end", line: "Screens people use to talk to it" },
  { kind: "monitoring", name: "Monitoring", line: "Metrics, traces and dashboards" },
  { kind: "billing", name: "Billing", line: "How its users are charged" },
];

export const DEPLOYMENT_GROUP_HEAD = "Deployment";

/** The node type a kind is stored as. */
export const typeOfKind = (kind: DeploymentKind): string => (kind === "front_end" ? FRONT_END_TYPE : kind);

/**
 * Each Deployment item, ready only when its node type is live. Front end is ready whenever `live_app` is (it is registered
 * already). Before the migration is applied the nine read `ready: false`, the existing pattern for a type that is not live.
 */
export function deploymentAddReadiness(live: (type: string) => boolean): { kind: DeploymentKind; name: string; line: string; ready: boolean }[] {
  return DEPLOYMENT_ADD_ITEMS.map((item) => ({ ...item, ready: live(typeOfKind(item.kind)) }));
}

/* ── each kind's payload (Part 3) ── */

/** One link drawn on the architecture map. `to` is a ref, `node:<id>`; `label` one of CONNECT_LABELS or the maker's own. */
export interface Connect {
  to: string;
  label: string;
}

export const CONNECT_LABELS = ["runs on", "calls", "serves", "reads", "writes", "receives from", "sends to", "speaks through", "watches", "bills through"] as const;
export const CONNECT_LABEL_MAX = 24;

/** What every deployment tile's payload holds. */
export interface DeploymentBase {
  /** The agent or team tile it belongs to, or null for the whole build. */
  agent: string | null;
  /** The session it was made in, or null. */
  made_in: string | null;
  connects: Connect[];
}

export const MACHINES = ["laptop", "desktop", "mini PC", "workstation", "server", "cloud machine", "other"] as const;
export type Machine = (typeof MACHINES)[number];

export interface Gpu {
  model: string;
  count: number;
  vram_gb: number;
}

export interface HostPayload extends DeploymentBase {
  machine: Machine;
  name: string;
  always_on: boolean;
  os?: string;
  ram_gb?: number;
  gpus?: Gpu[];
  storage?: string;
  /** Part 9: one figure, the maker's, in the build's currency. */
  setup_cost?: number;
}

export const SERVER_APIS = ["OpenAI-compatible", "Ollama API", "other"] as const;
export const REACHES = ["this machine only", "private network", "public"] as const;

/** A model row an inference server serves: the tile the model is on, and the model. */
export interface ServedModel {
  tile: string;
  model: string;
}

export interface InferenceServerPayload extends DeploymentBase {
  provider: string;
  api: (typeof SERVER_APIS)[number];
  reach: (typeof REACHES)[number];
  serves: ServedModel[];
  setup_cost?: number;
}

export const MEMORY_LIVES = ["cloud", "on the host"] as const;
export const MEMORY_STARTS = ["empty", "seeded"] as const;
export const MEMORY_KEEPS_MAX = 200;
export const REVIEW_DAYS_MIN = 1;
export const REVIEW_DAYS_MAX = 3650;

export interface MemoryPayload extends DeploymentBase {
  provider: string;
  keeps: string;
  lives: (typeof MEMORY_LIVES)[number];
  starts: (typeof MEMORY_STARTS)[number];
  tagged_by_agent: boolean;
  review_after_days?: number;
}

export const KB_FORMATS = ["markdown files", "documents", "other"] as const;
export const KB_SYNCS = ["git", "the app's own sync", "none"] as const;
export const KB_WRITERS = ["the maker", "the agents", "both"] as const;
export const KB_NOTES_MAX = 12;
export const KB_NOTE_NAME_MAX = 40;
export const KB_NOTE_PURPOSE_MAX = 80;
export const KB_NOTE_TEMPLATE_MAX = 4000;

export interface KnowledgeNote {
  name: string;
  purpose: string;
  /** A template only, never a filled-in note; may hold `{name}` variables. */
  template: string;
}

export interface KnowledgeBasePayload extends DeploymentBase {
  format: (typeof KB_FORMATS)[number];
  app: string;
  sync: (typeof KB_SYNCS)[number];
  written_by: (typeof KB_WRITERS)[number];
  notes: KnowledgeNote[];
  /** Agent node ids; empty for every agent. */
  read_by: string[];
}

export const RELAY_IDENTIFIES = ["network identity", "tokens", "other"] as const;
export const PUBLIC_INTERNET = "public internet";

export interface RelayPayload extends DeploymentBase {
  /** Two or more agent node ids; `agent` stays null. */
  joins: string[];
  provider: string;
  network: string;
  queues: boolean;
  identifies_by: (typeof RELAY_IDENTIFIES)[number];
}

export const CHANNEL_DIRECTIONS = ["receives", "sends", "both"] as const;

export interface ChannelPayload extends DeploymentBase {
  provider: string;
  direction: (typeof CHANNEL_DIRECTIONS)[number];
  starts_runs: boolean;
}

export const VOICE_MODES = ["stt", "tts", "speech-to-speech"] as const;
export const VOICE_MODE_LABEL: Record<(typeof VOICE_MODES)[number], string> = { stt: "Speech-to-text", tts: "Text-to-speech", "speech-to-speech": "Speech-to-speech" };

export interface VoicePayload extends DeploymentBase {
  provider: string;
  mode: (typeof VOICE_MODES)[number];
  voice_name?: string;
}

export const MEASURES = ["tokens per second", "latency", "GPU use", "cost", "errors", "traces"] as const;
export const MONITOR_TAGS_MAX = 6;
export const MONITOR_TAG_MAX = 30;

export interface MonitoringPayload extends DeploymentBase {
  provider: string;
  measures: (typeof MEASURES)[number][];
  tags: string[];
  test_traffic_tagged: boolean;
}

export const BILLING_MODELS = ["usage-based", "subscription", "one-off"] as const;
export const BILLING_UNITS = ["1M tokens", "request", "minute"] as const;
export const BILLING_UNIT_MAX = 20;
export const BILLING_CHARGES = ["the agent's users", "the maker's clients"] as const;

export interface BillingPayload extends DeploymentBase {
  provider: string;
  model: (typeof BILLING_MODELS)[number];
  unit?: string;
  charges: (typeof BILLING_CHARGES)[number];
  setup_cost?: number;
}

/** The existing live_app payload, plus the agent it is the front end of and what it was built with. */
export interface FrontEndPayload extends DeploymentBase {
  front_end_of: string;
  built_with: string;
  url?: string;
  screenshot?: string;
}

export interface DeploymentPayloads {
  host: HostPayload;
  inference_server: InferenceServerPayload;
  memory: MemoryPayload;
  knowledge_base: KnowledgeBasePayload;
  relay: RelayPayload;
  channel: ChannelPayload;
  voice: VoicePayload;
  monitoring: MonitoringPayload;
  billing: BillingPayload;
  front_end: FrontEndPayload;
}

/** One deployment tile, read. */
export type DeploymentTile = { [K in DeploymentKind]: { id: string; kind: K; title: string | null; payload: DeploymentPayloads[K] } }[DeploymentKind];

/** The order the List, the build page and the architecture map use (Part 7). */
export const DEPLOYMENT_ORDER: readonly DeploymentKind[] = ["host", "inference_server", "knowledge_base", "memory", "relay", "channel", "voice", "front_end", "monitoring", "billing"];

export const DEPLOYMENT_KIND_NAME: Record<DeploymentKind, string> = Object.fromEntries(DEPLOYMENT_ADD_ITEMS.map((item) => [item.kind, item.name])) as Record<DeploymentKind, string>;

/* ── reading ── */

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown, max = 200): string => (typeof value === "string" ? value.trim().slice(0, max) : "");
const opt = (value: unknown, max: number): string | undefined => str(value, max) || undefined;
const oneOf = <T extends string>(list: readonly T[], value: unknown, fallback: T): T => (list.includes(value as T) ? (value as T) : fallback);
const ids = (value: unknown): string[] => (Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0))] : []);
const num = (value: unknown, min: number, max: number): number | undefined => (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : undefined);
const cost = (value: unknown): number | undefined => num(value, 0, 10_000_000);

const REF_PREFIX = "node:";
/** `node:<id>` for a tile; the id of a ref. */
export const refOf = (id: string): string => `${REF_PREFIX}${id}`;
export const idOfRef = (ref: string): string | null => (ref.startsWith(REF_PREFIX) && ref.length > REF_PREFIX.length ? ref.slice(REF_PREFIX.length) : null);

function connectsOf(value: unknown): Connect[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.to !== "string" || !idOfRef(entry.to)) return [];
    const label = str(entry.label, CONNECT_LABEL_MAX);
    return label ? [{ to: entry.to, label }] : [];
  });
}

function baseOf(p: Raw): DeploymentBase {
  return { agent: typeof p.agent === "string" && p.agent ? p.agent : null, made_in: typeof p.made_in === "string" && p.made_in ? p.made_in : null, connects: connectsOf(p.connects) };
}

function gpusOf(value: unknown): Gpu[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const model = str(entry.model, 40);
    const count = num(entry.count, 1, 16);
    const vram = num(entry.vram_gb, 0, 4096);
    return model && count !== undefined && Number.isInteger(count) && vram !== undefined ? [{ model, count, vram_gb: vram }] : [];
  });
  return list.length > 0 ? list : undefined;
}

/** A live_app names an agent: it is that agent's front end. */
export const frontEndOf = (payload: unknown): string | null => (isRecord(payload) && typeof payload.front_end_of === "string" && payload.front_end_of ? payload.front_end_of : null);

/** The kind a node is, as a deployment tile; null when it is not one. */
export function deploymentKindOf(node: { type: string; payload?: unknown }): DeploymentKind | null {
  if ((DEPLOYMENT_TYPES as readonly string[]).includes(node.type)) return node.type as DeploymentType;
  if (node.type === FRONT_END_TYPE && frontEndOf(node.payload)) return "front_end";
  return null;
}

export const isDeploymentNode = (node: { type: string; payload?: unknown; parent_id?: string | null }): boolean => (node.parent_id ?? null) === null && deploymentKindOf(node) !== null;

/** A stored payload read defensively for its kind. Never throws. */
export function readDeployment<K extends DeploymentKind>(kind: K, raw: unknown): DeploymentPayloads[K] {
  const p = isRecord(raw) ? raw : {};
  const base = baseOf(p);
  const out = ((): DeploymentPayloads[DeploymentKind] => {
    switch (kind) {
      case "host":
        return { ...base, machine: oneOf(MACHINES, p.machine, "other"), name: str(p.name, 40), always_on: p.always_on === true, os: opt(p.os, 40), ram_gb: num(p.ram_gb, 0, 65536), gpus: gpusOf(p.gpus), storage: opt(p.storage, 40), setup_cost: cost(p.setup_cost) };
      case "inference_server":
        return {
          ...base,
          provider: str(p.provider, 60),
          api: oneOf(SERVER_APIS, p.api, "other"),
          reach: oneOf(REACHES, p.reach, "this machine only"),
          serves: Array.isArray(p.serves) ? p.serves.flatMap((entry) => (isRecord(entry) && typeof entry.tile === "string" && typeof entry.model === "string" ? [{ tile: entry.tile, model: entry.model }] : [])) : [],
          setup_cost: cost(p.setup_cost),
        };
      case "memory":
        return { ...base, provider: str(p.provider, 60), keeps: str(p.keeps, MEMORY_KEEPS_MAX), lives: oneOf(MEMORY_LIVES, p.lives, "cloud"), starts: oneOf(MEMORY_STARTS, p.starts, "empty"), tagged_by_agent: p.tagged_by_agent === true, review_after_days: num(p.review_after_days, REVIEW_DAYS_MIN, REVIEW_DAYS_MAX) };
      case "knowledge_base":
        return {
          ...base,
          format: oneOf(KB_FORMATS, p.format, "markdown files"),
          app: str(p.app, 60),
          sync: oneOf(KB_SYNCS, p.sync, "none"),
          written_by: oneOf(KB_WRITERS, p.written_by, "the maker"),
          notes: Array.isArray(p.notes) ? p.notes.slice(0, KB_NOTES_MAX).flatMap((note) => (isRecord(note) && str(note.name, KB_NOTE_NAME_MAX) ? [{ name: str(note.name, KB_NOTE_NAME_MAX), purpose: str(note.purpose, KB_NOTE_PURPOSE_MAX), template: typeof note.template === "string" ? note.template.slice(0, KB_NOTE_TEMPLATE_MAX) : "" }] : [])) : [],
          read_by: ids(p.read_by),
        };
      case "relay":
        return { ...base, agent: null, joins: ids(p.joins), provider: str(p.provider, 60), network: str(p.network, 60), queues: p.queues === true, identifies_by: oneOf(RELAY_IDENTIFIES, p.identifies_by, "other") };
      case "channel":
        return { ...base, provider: str(p.provider, 60), direction: oneOf(CHANNEL_DIRECTIONS, p.direction, "both"), starts_runs: p.starts_runs === true };
      case "voice":
        return { ...base, provider: str(p.provider, 60), mode: oneOf(VOICE_MODES, p.mode, "tts"), voice_name: opt(p.voice_name, 40) };
      case "monitoring":
        return { ...base, provider: str(p.provider, 60), measures: Array.isArray(p.measures) ? MEASURES.filter((measure) => (p.measures as unknown[]).includes(measure)) : [], tags: Array.isArray(p.tags) ? p.tags.flatMap((tag) => (str(tag, MONITOR_TAG_MAX) ? [str(tag, MONITOR_TAG_MAX)] : [])).slice(0, MONITOR_TAGS_MAX) : [], test_traffic_tagged: p.test_traffic_tagged === true };
      case "billing":
        return { ...base, provider: str(p.provider, 60), model: oneOf(BILLING_MODELS, p.model, "usage-based"), unit: opt(p.unit, BILLING_UNIT_MAX), charges: oneOf(BILLING_CHARGES, p.charges, "the agent's users"), setup_cost: cost(p.setup_cost) };
      case "front_end":
        return { ...base, agent: frontEndOf(p) ?? base.agent, front_end_of: frontEndOf(p) ?? "", built_with: str(p.built_with, 60), url: opt(p.url, 2000), screenshot: opt(p.screenshot, 2000) };
    }
  })();
  // Optional keys that read as nothing are left off, so a payload round-trips without `undefined`s.
  for (const key of Object.keys(out) as (keyof typeof out)[]) if (out[key] === undefined) delete out[key];
  return out as DeploymentPayloads[K];
}

/** The deployment tiles of a tree, in the List's order (DEPLOYMENT_ORDER, then by position). */
export function deploymentTilesOf(tree: readonly { id: string; type: string; title?: string | null; payload?: unknown; parent_id: string | null; position?: number | null }[]): DeploymentTile[] {
  return tree
    .filter((node) => isDeploymentNode(node))
    .map((node) => ({ node, kind: deploymentKindOf(node) as DeploymentKind }))
    .sort((a, b) => DEPLOYMENT_ORDER.indexOf(a.kind) - DEPLOYMENT_ORDER.indexOf(b.kind) || (a.node.position ?? 0) - (b.node.position ?? 0))
    .map(({ node, kind }) => ({ id: node.id, kind, title: node.title ?? null, payload: readDeployment(kind, node.payload) }) as DeploymentTile);
}

/* ── refusals (Part 3) ── */

export const DEPLOYMENT_COPY = {
  relayJoins: "A relay joins two or more agents.",
  noAddress: "Never paste an address, a port or a key here.",
  frontEndAgent: "A front end names the agent it is for.",
  tooLong: (what: string, max: number) => `${what}: ${max} characters max`,
  gpuCount: "A host has 1 to 16 of each GPU.",
  reviewDays: `Review after: ${REVIEW_DAYS_MIN} to ${REVIEW_DAYS_MAX} days`,
  notes: `A knowledge base keeps up to ${KB_NOTES_MAX} notes.`,
  tags: `Up to ${MONITOR_TAGS_MAX} tags, each up to ${MONITOR_TAG_MAX} characters.`,
} as const;

/** Keys that would hold an address, a port or a secret. None is ever stored on a deployment tile (a front end's url aside). */
const FORBIDDEN_KEYS = new Set(["address", "host_url", "endpoint", "base_url", "port", "ports", "ip", "api_key", "apikey", "key", "token", "secret", "password", "bearer", "authorization", "headers", "env"]);

/** Text that reads as an address, a port or a key. */
export function looksLikeAddressOrKey(text: string): boolean {
  const value = text.trim();
  if (!value) return false;
  if (/\bhttps?:\/\//i.test(value) || /\bwss?:\/\//i.test(value)) return true;
  if (/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(value)) return true;
  if (/\blocalhost\b/i.test(value) || /\b[a-z0-9-]+(\.[a-z0-9-]+)+:\d{2,5}\b/i.test(value) || /:\d{4,5}\b/.test(value)) return true;
  if (/\b(sk|pk|rk)[-_][A-Za-z0-9_-]{8,}/.test(value) || /\b(ghp|gho|xox[abps]|AKIA)[A-Za-z0-9_-]{8,}/.test(value)) return true;
  if (/\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/.test(value)) return true;
  return false;
}

function findAddress(value: unknown, path: string, allowUrl: boolean): string | null {
  if (typeof value === "string") return looksLikeAddressOrKey(value) ? path : null;
  if (Array.isArray(value)) {
    for (let at = 0; at < value.length; at += 1) {
      const found = findAddress(value[at], `${path}[${at}]`, allowUrl);
      if (found) return found;
    }
    return null;
  }
  if (isRecord(value)) {
    for (const [key, inner] of Object.entries(value)) {
      if (allowUrl && path === "" && (key === "url" || key === "screenshot")) continue;
      // A ref or an id is not an address.
      if (key === "to" || key === "agent" || key === "front_end_of" || key === "made_in" || key === "tile" || key === "joins" || key === "read_by") continue;
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) return path ? `${path}.${key}` : key;
      // A knowledge base note's template is the maker's writing about their business, not an address field; it is still checked.
      const found = findAddress(inner, path ? `${path}.${key}` : key, allowUrl);
      if (found) return found;
    }
  }
  return null;
}

/** Why a deployment payload cannot be kept, or null. */
export function deploymentRefusal(kind: DeploymentKind, raw: unknown): string | null {
  const p = isRecord(raw) ? raw : {};
  if (findAddress(p, "", kind === "front_end")) return DEPLOYMENT_COPY.noAddress;
  if (kind === "relay" && ids(p.joins).length < 2) return DEPLOYMENT_COPY.relayJoins;
  if (kind === "front_end" && !frontEndOf(p)) return DEPLOYMENT_COPY.frontEndAgent;
  if (kind === "host" && Array.isArray(p.gpus) && p.gpus.some((gpu) => !isRecord(gpu) || typeof gpu.count !== "number" || !Number.isInteger(gpu.count) || gpu.count < 1 || gpu.count > 16)) return DEPLOYMENT_COPY.gpuCount;
  if (kind === "memory" && p.review_after_days !== undefined && p.review_after_days !== null && num(p.review_after_days, REVIEW_DAYS_MIN, REVIEW_DAYS_MAX) === undefined) return DEPLOYMENT_COPY.reviewDays;
  if (kind === "memory" && typeof p.keeps === "string" && p.keeps.trim().length > MEMORY_KEEPS_MAX) return DEPLOYMENT_COPY.tooLong("What it keeps", MEMORY_KEEPS_MAX);
  if (kind === "knowledge_base" && Array.isArray(p.notes) && p.notes.length > KB_NOTES_MAX) return DEPLOYMENT_COPY.notes;
  if (kind === "monitoring" && Array.isArray(p.tags) && (p.tags.length > MONITOR_TAGS_MAX || p.tags.some((tag) => typeof tag !== "string" || tag.trim().length > MONITOR_TAG_MAX))) return DEPLOYMENT_COPY.tags;
  if (Array.isArray(p.connects) && p.connects.some((entry) => isRecord(entry) && typeof entry.label === "string" && entry.label.trim().length > CONNECT_LABEL_MAX)) return DEPLOYMENT_COPY.tooLong("A line's label", CONNECT_LABEL_MAX);
  return null;
}

/** The payload to write: refused (throws) when `deploymentRefusal` says so, else read clean. */
export function cleanDeployment<K extends DeploymentKind>(kind: K, raw: unknown): DeploymentPayloads[K] {
  const refusal = deploymentRefusal(kind, raw);
  if (refusal) throw new Error(refusal);
  return readDeployment(kind, raw);
}

/* ── references, copies and forks (Part 3) ── */

/** The ids a deployment payload points at, wherever they sit. */
export const REF_KEYS = ["agent", "front_end_of", "read_by", "joins"] as const;

/**
 * A deployment payload with its references pointed at the copied tiles: `agent`, `front_end_of`, `serves[].tile`, `read_by`,
 * `joins`, `connects[].to` (as `node:<id>`) and `runs.channels`. An id not in the map is kept as it is (the copy points at the
 * same tile, as Duplicate does for `uses`). Pure.
 */
export function rewriteDeploymentRefs<T>(payload: T, map: ReadonlyMap<string, string>): T {
  if (!isRecord(payload)) return payload;
  const swap = (id: unknown) => (typeof id === "string" ? (map.get(id) ?? id) : id);
  const out: Raw = { ...payload };
  if (typeof out.agent === "string") out.agent = swap(out.agent);
  if (typeof out.front_end_of === "string") out.front_end_of = swap(out.front_end_of);
  if (Array.isArray(out.read_by)) out.read_by = out.read_by.map(swap);
  if (Array.isArray(out.joins)) out.joins = out.joins.map(swap);
  if (Array.isArray(out.serves)) out.serves = out.serves.map((entry) => (isRecord(entry) ? { ...entry, tile: swap(entry.tile) } : entry));
  if (Array.isArray(out.connects)) out.connects = out.connects.map((entry) => (isRecord(entry) && typeof entry.to === "string" && idOfRef(entry.to) ? { ...entry, to: refOf(swap(idOfRef(entry.to)) as string) } : entry));
  if (isRecord(out.runs) && Array.isArray(out.runs.channels)) out.runs = { ...out.runs, channels: out.runs.channels.map(swap) };
  if (isRecord(out.modelRun)) {
    const run = { ...out.modelRun };
    if (typeof run.server === "string") run.server = swap(run.server);
    if (typeof run.host === "string") run.host = swap(run.host);
    out.modelRun = run;
  }
  return out as T;
}

/**
 * Fork rules for deployment (Part 3): every deployment field is method and kept. A front end's `url` and screenshot are the
 * original's deployment (evidence): the copy has none yet, so they go. `made_in` is kept when its session is copied (a fork
 * copies every session) and cleared otherwise.
 */
export function deploymentMethodOf<T>(type: string, payload: T, copiedSessions?: ReadonlySet<string>): T {
  if (!isRecord(payload)) return payload;
  const out: Raw = { ...payload };
  if (type === FRONT_END_TYPE && frontEndOf(out)) {
    delete out.url;
    delete out.screenshot;
  }
  if (copiedSessions && typeof out.made_in === "string" && !copiedSessions.has(out.made_in)) out.made_in = null;
  return out as T;
}

/* ── the agent's old Memory note (Part 3.4) ── */

/**
 * Adding a Memory tile to an agent that has the old Memory note (`payload.memory`, free text): the note moves into the tile's
 * `keeps`, and the agent's note is cleared. Both payloads come back, to be written as one change (one undo step).
 */
export function moveMemoryNote(agentPayload: unknown, memoryPayload: unknown): { agent: Raw; memory: Raw } {
  const agent = isRecord(agentPayload) ? { ...agentPayload } : {};
  const memory = isRecord(memoryPayload) ? { ...memoryPayload } : {};
  const note = typeof agent.memory === "string" ? agent.memory.trim() : "";
  if (note && !str(memory.keeps)) memory.keeps = note.slice(0, MEMORY_KEEPS_MAX);
  delete agent.memory;
  return { agent, memory };
}

/** The deployment tiles that belong to an agent (`agent`), or that a relay joins with it. */
export function tilesOfAgent(tiles: readonly DeploymentTile[], agentId: string): DeploymentTile[] {
  return tiles.filter(
    (tile) =>
      tile.payload.agent === agentId ||
      (tile.kind === "relay" && tile.payload.joins.includes(agentId)) ||
      (tile.kind === "knowledge_base" && tile.payload.read_by.includes(agentId)) ||
      (tile.kind === "front_end" && tile.payload.front_end_of === agentId),
  );
}

/**
 * Removing an agent and keeping its deployment tiles (the default): each is attached to the whole build. A relay drops the
 * agent from `joins`. Returns the payloads to write, by id.
 */
export function detachFromAgent(tiles: readonly DeploymentTile[], agentId: string): { id: string; payload: Raw }[] {
  return tilesOfAgent(tiles, agentId).map((tile) => {
    const payload: Raw = { ...(tile.payload as unknown as Raw), agent: null };
    if (tile.kind === "relay") payload.joins = tile.payload.joins.filter((id) => id !== agentId);
    if (tile.kind === "knowledge_base") payload.read_by = tile.payload.read_by.filter((id) => id !== agentId);
    return { id: tile.id, payload };
  });
}

/* ── the model run's host (Part 4) ── */

/** The build's Host tiles as Where offers them: id, name, GPUs. */
export function runHostsOf(tree: readonly { id: string; type: string; title?: string | null; payload?: unknown; parent_id: string | null; position?: number | null }[]): { id: string; name: string; gpus?: Gpu[] }[] {
  return deploymentTilesOf(tree).flatMap((tile) => (tile.kind === "host" ? [{ id: tile.id, name: tile.payload.name || tile.title || DEPLOYMENT_KIND_NAME.host, ...(tile.payload.gpus ? { gpus: tile.payload.gpus } : null) }] : []));
}

/* ── the agent's Deployment line and its channels (Part 5) ── */

/** A provider as shown: the registry tool's name, or the name as typed. */
export const providerName = (provider: string): string => (provider ? (toolName(provider) ?? provider) : "");

/** What a tile is called in a line: a host's name, a provider's name, else the kind ("Front end"). */
export function deploymentName(tile: DeploymentTile): string {
  switch (tile.kind) {
    case "host":
      return tile.payload.name || tile.title || DEPLOYMENT_KIND_NAME.host;
    case "knowledge_base":
      return providerName(tile.payload.app) || tile.title || DEPLOYMENT_KIND_NAME.knowledge_base;
    case "relay":
      return providerName(tile.payload.provider) || tile.payload.network || tile.title || DEPLOYMENT_KIND_NAME.relay;
    case "front_end":
      return DEPLOYMENT_KIND_NAME.front_end;
    default:
      return providerName(tile.payload.provider) || tile.title || DEPLOYMENT_KIND_NAME[tile.kind];
  }
}

/**
 * An agent's or team's Deployment line, in DEPLOYMENT_ORDER: "Mac Mini · Letta · Telegram, WhatsApp · ElevenLabs · Front end".
 * Each entry opens its tile; entries of one kind sit together, separated by commas.
 */
export function deploymentLineOf(tiles: readonly DeploymentTile[], agentId: string): { id: string; kind: DeploymentKind; name: string }[] {
  return tilesOfAgent(tiles, agentId).map((tile) => ({ id: tile.id, kind: tile.kind, name: deploymentName(tile) }));
}

/** The line as text: kinds apart by " · ", tiles of one kind by ", ". */
export function deploymentLineText(entries: readonly { kind: DeploymentKind; name: string }[]): string {
  const groups: string[][] = [];
  let last: DeploymentKind | null = null;
  for (const entry of entries) {
    if (entry.kind === last) groups[groups.length - 1].push(entry.name);
    else groups.push([entry.name]);
    last = entry.kind;
  }
  return groups.map((group) => group.join(", ")).join(" · ");
}

/** The Channel tiles that start runs, as How did it run? offers them: id and provider name. */
export function runChannelsOf(tiles: readonly DeploymentTile[]): { id: string; name: string }[] {
  return tiles.flatMap((tile) => (tile.kind === "channel" && tile.payload.starts_runs ? [{ id: tile.id, name: deploymentName(tile) }] : []));
}
