// The portable build file: one record, one JSON object, nothing installation-
// specific left in it.
//
// This is what carries a build out of NeoScale and into any AI tool. Two
// exports produce it: toPortable turns a loaded BuildRecord into the envelope,
// and toMarkdown turns that envelope into a document a language model can act
// on without being told what the shape means.
//
// FOUR RULES DECIDE WHAT SURVIVES THE EXPORT
//
// 1. Tray nodes never appear. The export walks record.tree, which is placed
//    nodes only. Unplaced work is the creator's scratch space and is not part
//    of the record.
// 2. Hidden events never appear. getEvents already excludes them at the query,
//    and this filters again — an export is the wrong place to trust a caller.
// 3. No uuid survives. Node ids become stable path indices — "1", "1.2",
//    "1.2.1" — and every reference in a payload is rewritten to the path it
//    points at. That is what makes the file portable between installations and
//    diffable between forks: two exports of the same build from two databases
//    are byte-identical apart from exported_at.
// 4. Media references become absolute public URLs, because a relative storage
//    path means nothing once the file has left this origin.
//
// THIS FORMAT IS INTERNAL. format_version starts at 1 and there is no public
// specification, no entry in the public-api function and no documentation of
// it outside this repository. Whether it becomes a published open format is an
// open product question, and publishing it now would foreclose the versioning
// choices before the first fork has ever been exported.

import type {
  Build,
  BuildEvent,
  BuildRecord,
  FieldDef,
  NodeTree,
  NodeType,
} from "./types";

/** Bumped only when a consumer that read version N would misread version N+1. */
export const PORTABLE_FORMAT_VERSION = 1;

// --- the envelope ------------------------------------------------------------

export interface PortableCost {
  setup: number | null;
  monthly: number | null;
  currency: string | null;
}

export interface PortableBuildHeader {
  title: string;
  outcome: string | null;
  shape: string | null;
  made_for: string[];
  made_with: string[];
  live_url: string | null;
  repo_url: string | null;
  cost: PortableCost | null;
  time_to_first_result: number | null;
}

export interface PortableNode {
  /** Position in the tree: "1", "1.2", "1.2.1". Replaces the row id. */
  path: string;
  type: string;
  title: string;
  note: string | null;
  payload: Record<string, unknown>;
  children: PortableNode[];
}

export interface PortableEvent {
  ordinal: number;
  kind: string;
  payload: Record<string, unknown>;
  phase_title: string | null;
}

export interface PortableBuild {
  neoscale_build: number;
  exported_at: string;
  /** Absolute /b2/<slug> URL, so the file says where it came from. */
  source_url: string;
  build: PortableBuildHeader;
  nodes: PortableNode[];
  events: PortableEvent[];
}

export interface PortableOptions {
  /** Origin for source_url and for site-relative media. Defaults below. */
  origin?: string;
  /** Fixed export time. Tests pass one so output is comparable run to run. */
  exportedAt?: Date;
}

// --- origin ------------------------------------------------------------------

const CONFIGURED_SITE_URL = String(import.meta.env?.VITE_SITE_URL ?? "").replace(/\/+$/, "");
const DEFAULT_SITE_URL = "https://neoscaleai.com";
const SUPABASE_URL = String(import.meta.env?.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");

/**
 * The configured site URL wins over the window's origin on purpose: a file
 * exported from a preview deployment or a dev server should still point a
 * reader at the published build, not at localhost.
 */
function defaultOrigin(): string {
  if (CONFIGURED_SITE_URL) return CONFIGURED_SITE_URL;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return DEFAULT_SITE_URL;
}

// --- identifiers -------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keys that hold a node reference even when the registry does not say so. */
function isNodeRefKey(key: string): boolean {
  return key.endsWith("_ref") || key === "node_id" || key.endsWith("_node_id");
}

/** Keys that hold a media reference even when the registry does not say so. */
function isMediaKey(key: string): boolean {
  return (
    key === "media_id" ||
    key === "media_url" ||
    key === "poster_url" ||
    key.endsWith("_media_id")
  );
}

/**
 * A media reference as something a reader outside this installation can open.
 *
 * A bare storage path becomes a public object URL and a site-relative path
 * becomes absolute. An opaque handle with no path cannot be resolved without a
 * lookup this module does not do, so it is left exactly as it was rather than
 * dropped — a handle a consumer can ask about beats a null.
 */
function absoluteMedia(value: string, origin: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${origin}${value}`;
  if (value.includes("/") && SUPABASE_URL) {
    return `${SUPABASE_URL}/storage/v1/object/public/${value.replace(/^\/+/, "")}`;
  }
  return value;
}

interface Context {
  origin: string;
  pathById: Map<string, string>;
  typesByKey: Map<string, NodeType>;
}

// --- payload rewriting -------------------------------------------------------

function fieldsOf(nodeType: NodeType | undefined): FieldDef[] {
  return nodeType?.schema?.fields ?? [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * One leaf value.
 *
 * The registry's `format` hint decides first, the key name second, and an
 * exact-uuid sweep last. That last pass is what guarantees the file carries no
 * identifiers: a string that IS a uuid is a reference to a row in the source
 * database, never content. A uuid quoted inside a sentence is content and is
 * left alone, because only whole-string matches are rewritten.
 *
 * A reference that does not resolve — into the tray, or onto another build —
 * becomes null. The thing it points at is not in this file, so there is no
 * honest path to give.
 */
function rewriteString(
  value: string,
  field: FieldDef | undefined,
  key: string,
  context: Context
): string | null {
  const trimmed = value.trim();

  if (field?.format === "node_id" || isNodeRefKey(key)) {
    if (UUID.test(trimmed)) return context.pathById.get(trimmed.toLowerCase()) ?? null;
  }

  if (field?.format === "media_id" || isMediaKey(key)) {
    return trimmed ? absoluteMedia(trimmed, context.origin) : value;
  }

  if (UUID.test(trimmed)) return context.pathById.get(trimmed.toLowerCase()) ?? null;

  return value;
}

function rewriteValue(
  value: unknown,
  field: FieldDef | undefined,
  key: string,
  context: Context
): unknown {
  if (Array.isArray(value)) {
    const members = field?.of ?? [];
    return value.map((item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? rewritePayload(item, members, context)
        : rewriteValue(item, undefined, key, context)
    );
  }

  // The dialect has no nested objects, but a hand-written payload might.
  if (value && typeof value === "object") return rewritePayload(value, [], context);

  if (typeof value === "string") return rewriteString(value, field, key, context);

  return value ?? null;
}

function rewritePayload(
  payload: unknown,
  fields: FieldDef[],
  context: Context
): Record<string, unknown> {
  const source = asRecord(payload);
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const out: Record<string, unknown> = {};

  // Schema order first, so two exports of the same build agree key for key,
  // then anything the payload carries that the schema does not declare.
  const ordered = [
    ...fields.map((field) => field.key).filter((key) => key in source),
    ...Object.keys(source).filter((key) => !byKey.has(key)),
  ];

  for (const key of ordered) {
    out[key] = rewriteValue(source[key], byKey.get(key), key, context);
  }

  return out;
}

// --- the tree ----------------------------------------------------------------

/** Defensive ordering. getNodeTree already sorts; an export must not assume it. */
function ordered(nodes: NodeTree[]): NodeTree[] {
  return [...nodes].sort((a, b) => {
    const byPosition = (a.position ?? 0) - (b.position ?? 0);
    if (byPosition !== 0) return byPosition;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
}

/** Every node id to its path index, before any payload is rewritten. */
function indexPaths(nodes: NodeTree[], prefix: string, into: Map<string, string>): void {
  ordered(nodes).forEach((node, index) => {
    const path = prefix ? `${prefix}.${index + 1}` : String(index + 1);
    into.set(String(node.id).toLowerCase(), path);
    if (node.children.length > 0) indexPaths(node.children, path, into);
  });
}

function portableNode(node: NodeTree, path: string, context: Context): PortableNode {
  const nodeType = context.typesByKey.get(node.type);
  return {
    path,
    type: node.type,
    title: node.title,
    note: node.note ?? null,
    payload: rewritePayload(node.payload, fieldsOf(nodeType), context),
    children: ordered(node.children).map((child, index) =>
      portableNode(child, `${path}.${index + 1}`, context)
    ),
  };
}

function portableHeader(build: Build): PortableBuildHeader {
  const hasCost = build.cost_setup !== null || build.cost_monthly !== null;
  return {
    title: build.title,
    outcome: build.outcome ?? null,
    shape: build.shape ?? null,
    made_for: build.made_for ?? [],
    made_with: build.made_with ?? [],
    live_url: build.live_url ?? null,
    repo_url: build.repo_url ?? null,
    cost: hasCost
      ? {
          setup: build.cost_setup ?? null,
          monthly: build.cost_monthly ?? null,
          currency: build.currency ?? null,
        }
      : null,
    time_to_first_result: build.time_to_first_result ?? null,
  };
}

function portableEvents(events: BuildEvent[], context: Context): PortableEvent[] {
  return events
    .filter((event) => event.visibility !== "hidden")
    .slice()
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((event) => ({
      ordinal: event.ordinal,
      kind: event.kind,
      payload: rewritePayload(event.payload, [], context),
      phase_title: event.phase_title ?? null,
    }));
}

/**
 * A loaded build record as the portable envelope.
 *
 * Takes the record whole rather than fetching anything: the page has already
 * loaded it, and an export that queried again could disagree with what the
 * reader is looking at.
 */
export function toPortable(record: BuildRecord, options: PortableOptions = {}): PortableBuild {
  const origin = (options.origin ?? defaultOrigin()).replace(/\/+$/, "");
  const pathById = new Map<string, string>();
  indexPaths(record.tree, "", pathById);

  const context: Context = {
    origin,
    pathById,
    typesByKey: new Map(record.nodeTypes.map((type) => [type.key, type])),
  };

  return {
    neoscale_build: PORTABLE_FORMAT_VERSION,
    exported_at: (options.exportedAt ?? new Date()).toISOString(),
    source_url: `${origin}/b2/${record.build.slug}`,
    build: portableHeader(record.build),
    nodes: ordered(record.tree).map((node, index) =>
      portableNode(node, String(index + 1), context)
    ),
    events: portableEvents(record.events, context),
  };
}

// --- markdown ----------------------------------------------------------------
//
// The JSON is for a program. This is for a model: the same record as a headed
// document, so pasting it into a fresh chat gives a set of instructions rather
// than a shape to be interpreted first.

/** Payload keys whose value is a block to be fenced, not a bullet. */
const BLOCK_KEYS = new Set([
  "text",
  "source",
  "system_prompt",
  "prompt",
  "definition",
  "parameters",
  "returns",
  "params",
  "memory",
]);

/** Longest string a bullet carries before it becomes a block instead. */
const INLINE_MAX = 200;

/** How much of an event's text the sequence section shows. */
const EVENT_SUMMARY_MAX = 240;

const EVENT_TEXT_KEYS = ["text", "summary", "symptom", "problem", "decision", "note"];

function humanise(key: string): string {
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function inline(value: string): string {
  return value.replace(/\s*\n\s*/g, " ").trim();
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/**
 * A fence long enough for its content. Creator text containing three backticks
 * would otherwise close the block early and swallow the rest of the document.
 */
function fence(text: string): string {
  const longest = (text.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  return "`".repeat(Math.max(3, longest + 1));
}

function scalarText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * A rewritten node reference as something readable.
 *
 * The JSON carries "2.2" because a program wants an address. A model reading
 * the document wants to know what is at that address, so the markdown prints
 * the path and the title of the node it points at.
 */
function refLabel(key: string, value: unknown, titleByPath: Map<string, string>): string | null {
  if (!isNodeRefKey(key) || typeof value !== "string") return null;
  const title = titleByPath.get(value);
  return title ? `${value}. ${title}` : null;
}

function payloadLines(node: PortableNode, titleByPath: Map<string, string>): string[] {
  const lines: string[] = [];
  const payload = node.payload;
  const language = typeof payload.language === "string" ? payload.language : "";

  for (const [key, value] of Object.entries(payload)) {
    if (!isPresent(value)) continue;
    // Folded into the fence info string on the block it describes.
    if (key === "language") continue;

    if (Array.isArray(value)) {
      lines.push(`- ${humanise(key)}:`);
      for (const item of value) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const entries = Object.entries(item as Record<string, unknown>).filter(([, member]) =>
            isPresent(member)
          );
          if (entries.length === 0) continue;
          const member = ([memberKey, memberValue]: [string, unknown]) =>
            refLabel(memberKey, memberValue, titleByPath) ?? inline(scalarText(memberValue));
          lines.push(
            entries.length === 1
              ? `  - ${member(entries[0])}`
              : `  - ${entries
                  .map((entry) => `${humanise(entry[0])}: ${member(entry)}`)
                  .join(" · ")}`
          );
        } else {
          lines.push(`  - ${inline(scalarText(item))}`);
        }
      }
      continue;
    }

    if (typeof value === "object") {
      lines.push(`- ${humanise(key)}: ${JSON.stringify(value)}`);
      continue;
    }

    const reference = refLabel(key, value, titleByPath);
    if (reference) {
      lines.push(`- ${humanise(key)}: ${reference}`);
      continue;
    }

    const text = scalarText(value);
    const blocked = typeof value === "string" && (BLOCK_KEYS.has(key) || text.includes("\n") || text.length > INLINE_MAX);

    if (blocked) {
      const marks = fence(text);
      lines.push("", `${humanise(key)}:`, "", `${marks}${key === "source" ? language : ""}`, text, marks, "");
      continue;
    }

    lines.push(`- ${humanise(key)}: ${inline(text)}`);
  }

  return lines;
}

function flattenNodes(nodes: PortableNode[]): PortableNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function formatCost(cost: PortableCost): string {
  const currency = cost.currency ?? "";
  const parts: string[] = [];
  if (cost.setup !== null) parts.push(`${cost.setup} ${currency}`.trim() + " to set up");
  if (cost.monthly !== null) parts.push(`${cost.monthly} ${currency}`.trim() + " a month");
  return parts.join(", ");
}

/**
 * The portable envelope as a document.
 *
 * Order is deliberate and is the order a reader needs it in: what this build
 * achieves, what must be true before starting, then every node in tree order
 * with its payload — code and prompt text fenced so a model copies them
 * verbatim — and the build sequence last, as context rather than instruction.
 */
export function toMarkdown(portable: PortableBuild): string {
  const build = portable.build;
  const lines: string[] = [`# ${build.title}`, ""];

  if (build.outcome) lines.push(`**Outcome.** ${build.outcome}`, "");

  if (build.shape) lines.push(`- Shape: ${build.shape}`);
  if (build.made_for.length > 0) lines.push(`- Made for: ${build.made_for.join(", ")}`);
  if (build.made_with.length > 0) lines.push(`- Made with: ${build.made_with.join(", ")}`);
  if (build.cost) lines.push(`- Cost: ${formatCost(build.cost)}`);
  if (build.time_to_first_result !== null) {
    lines.push(`- Time to first result: ${build.time_to_first_result} minutes`);
  }
  if (build.live_url) lines.push(`- Running at: ${build.live_url}`);
  if (build.repo_url) lines.push(`- Repository: ${build.repo_url}`);
  lines.push(`- Source: ${portable.source_url}`);
  lines.push(`- Exported: ${portable.exported_at}`);
  lines.push("");

  const flat = flattenNodes(portable.nodes);
  const titleByPath = new Map(flat.map((node) => [node.path, node.title]));
  const prerequisites = flat.filter((node) => node.type === "prerequisite");
  const steps = flat.filter((node) => node.type !== "prerequisite");

  lines.push("## Before you start", "");
  if (prerequisites.length === 0) {
    lines.push("Nothing is listed as a prerequisite.", "");
  } else {
    for (const node of prerequisites) {
      const requirement = node.payload.requirement;
      lines.push(
        `- [ ] **${node.title}**${
          typeof requirement === "string" && requirement.trim() ? ` — ${inline(requirement)}` : ""
        }`
      );
      const why = node.payload.why;
      if (typeof why === "string" && why.trim()) lines.push(`  - ${inline(why)}`);
    }
    lines.push("");
  }

  lines.push("## Steps", "");
  if (steps.length === 0) {
    lines.push("This build has no nodes yet.", "");
  } else {
    for (const node of steps) {
      const depth = node.path.split(".").length;
      const hashes = "#".repeat(Math.min(6, 2 + depth));
      lines.push(`${hashes} ${node.path}. ${node.title}`, "");
      lines.push(`*${node.type}*`, "");
      if (node.note) lines.push(node.note, "");
      const payload = payloadLines(node, titleByPath);
      if (payload.length > 0) lines.push(...payload, "");
    }
  }

  if (portable.events.length > 0) {
    lines.push("## How it was built", "");
    for (const event of portable.events) {
      const text = EVENT_TEXT_KEYS.map((key) => event.payload[key]).find(
        (value) => typeof value === "string" && value.trim()
      );
      const phase = event.phase_title ? `${event.phase_title} — ` : "";
      const summary = typeof text === "string" ? `: ${truncate(inline(text), EVENT_SUMMARY_MAX)}` : "";
      lines.push(`${event.ordinal}. ${phase}${event.kind}${summary}`);
    }
    lines.push("");
  }

  // Collapse the runs of blank lines the section builders leave behind.
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
