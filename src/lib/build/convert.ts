// Converting one existing post into a typed build record.
//
// WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT
// ---------------------------------------------
// It is a creator-initiated, per-post conversion. A creator opens one of their
// own posts, sees what the conversion would make of it, and says yes. It is
// NOT a backfill: running the whole corpus through a mapping written weeks
// after the authoring surface would produce three hundred malformed records
// and no way to tell which of them anyone meant.
//
// NOTHING ON THE OLD PATH IS WRITTEN, EVER
// ----------------------------------------
// content_items and content_blocks are read here and nowhere else in this
// module. The source post keeps its row, its status, its URL and its readers.
// After a conversion both records exist; that is the point, not a transitional
// state. The only new fact anywhere is builds.source_content_item_id, which
// lives on the NEW table.
//
// THE TRAY IS WHERE AMBIGUITY GOES
// --------------------------------
// Ten block types map one to one onto a node type. Everything else — a
// resource, a section heading, a legacy type this mapping has never seen, and
// any block whose mapped node would come out empty — becomes a node with
// position NULL. It is in the record, it is typed as closely as the source
// allows, it is labelled with why it landed there, and the creator places it
// or throws it away. Nothing from the source is dropped: every block produces
// exactly one root node, so a converted build's placed count plus its tray
// count always equals the block count it came from.
//
// MEDIA IS REFERENCED, NOT COPIED
// -------------------------------
// An image on a content block lives in the content-files bucket and stays
// there. The screenshot node points at the same public URL the post already
// serves. MediaFigure resolves a payload reference that is a URL rather than a
// build_media id through the same transform endpoint, so the image renders on
// the build page without a byte moving between buckets — and deleting the
// build never removes an object the live post is still showing.
//
// A CONVERSION IS ALWAYS A DRAFT
// ------------------------------
// status stays 'draft' and published_at stays NULL. The creator reviews the
// tree, empties the tray and publishes from compose like any other build.

import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { BLOCK_TYPES } from "@/lib/content-types";
import { BUILD_COLUMNS, createBuild, updateBuild } from "./builds";
import {
  buildLayerError,
  type Build,
  type BuildNodeInsert,
  type BuildPatch,
} from "./types";

// -----------------------------------------------------------------------------
// What is read from the old path
// -----------------------------------------------------------------------------
// Named column lists rather than "*": these two tables carry well over a
// hundred columns between them and a conversion needs fourteen of them.

export const SOURCE_ITEM_COLUMNS =
  "id, creator_id, title, description, ai_tools, use_cases, difficulty, file_url, use_instructions, what_to_expect, monetisation_type, price_gbp, donation_enabled";

export const SOURCE_BLOCK_COLUMNS =
  "id, content_id, position, block_type, text_content, file_url, file_name, image_url, image_description, external_file_url, github_url, sub_blocks, use_instructions";

export type SourceItem = Pick<
  Tables<"content_items">,
  | "id"
  | "creator_id"
  | "title"
  | "description"
  | "ai_tools"
  | "use_cases"
  | "difficulty"
  | "file_url"
  | "use_instructions"
  | "what_to_expect"
  | "monetisation_type"
  | "price_gbp"
  | "donation_enabled"
>;

export type SourceBlock = Pick<
  Tables<"content_blocks">,
  | "id"
  | "content_id"
  | "position"
  | "block_type"
  | "text_content"
  | "file_url"
  | "file_name"
  | "image_url"
  | "image_description"
  | "external_file_url"
  | "github_url"
  | "sub_blocks"
  | "use_instructions"
>;

export interface ConversionSource {
  item: SourceItem;
  /** In the order the post presents them. */
  blocks: SourceBlock[];
}

/** A post far past this is a data problem, not a record worth converting. */
const BLOCK_LIMIT = 500;

/** Longest derived node title before it is cut. */
const TITLE_MAX = 80;

/** Fewer detected steps than this is a paragraph that happens to have a dash. */
const MIN_STEPS = 2;

// -----------------------------------------------------------------------------
// The mapping
// -----------------------------------------------------------------------------

/**
 * The exact one-to-one mappings, and the only ones.
 *
 * A block type that is not a key here is ambiguous by definition and goes to
 * the tray. `long_text` is here alongside `text` because it is the same thing
 * under a different name — the editor writes it for imported markdown — and
 * sending every long-form post's whole body to the tray would make the
 * conversion useless on exactly the posts most worth converting.
 */
export const EXACT_NODE_TYPE: Record<string, string> = {
  prompt: "prompt",
  agent_config: "agent_config",
  workflow: "stack",
  model_params: "model_params",
  tool_setup: "integration",
  code: "code",
  result: "result",
  comparison: "comparison_table",
  text: "note",
  long_text: "note",
  image: "screenshot",
};

/**
 * The node type an unmapped block is CARRIED in while it sits in the tray.
 *
 * build_nodes.type is NOT NULL, so an unmapped block still has to be typed as
 * something. These are carriers, not mappings: the node is unplaced, it says
 * on its face why, and it names the block type it came from. A resource is
 * carried as a document because that type is the only one with somewhere to
 * put a URL and a title; everything else is carried as a note, which is the
 * one type whose whole payload is prose.
 */
const TRAY_CARRIER: Record<string, string> = {
  resource: "document",
  section_heading: "note",
};

const DEFAULT_CARRIER = "note";

/** One node the conversion intends to write. */
export interface NodePlan {
  /** The content block this came from. null for a node derived from the post itself. */
  blockId: string | null;
  blockType: string | null;
  /** node_types.key */
  type: string;
  title: string;
  note: string | null;
  payload: Record<string, Json>;
  /** false means position NULL — the tray. */
  placed: boolean;
  /** Plain language, shown to the creator. null when placed. */
  trayReason: string | null;
  /** Ordered children. Only ever produced under a placed parent. */
  children: NodePlan[];
}

export interface ConversionCounts {
  /** Blocks read from the source post. */
  blocks: number;
  /** Root nodes from those blocks that land in the tree. */
  placed: number;
  /** Root nodes from those blocks that land in the tray. placed + tray === blocks. */
  tray: number;
  /** Extra children under placed nodes — the steps read out of a workflow. */
  steps: number;
  /** Nodes derived from the post itself rather than from a block. */
  fromPost: number;
}

export interface ConversionPlan {
  /** The builds columns this conversion sets, before it is written. */
  header: BuildPatch & { title: string };
  /** Root nodes in source order: the placed ones keep the post's order. */
  nodes: NodePlan[];
  counts: ConversionCounts;
  /** Decisions worth telling the creator before they agree. */
  notes: string[];
}

// -----------------------------------------------------------------------------
// Reading the source
// -----------------------------------------------------------------------------

/**
 * The post and its blocks, in order.
 *
 * Two reads rather than an embedded select: content_blocks has its own RLS
 * policy and its own ordering, and a PostgREST embed would hide both behind a
 * shape that is harder to reason about than two queries.
 */
export async function readSource(contentItemId: string): Promise<ConversionSource> {
  const { data: item, error: itemError } = await supabase
    .from("content_items")
    .select(SOURCE_ITEM_COLUMNS)
    .eq("id", contentItemId)
    .maybeSingle();

  if (itemError) throw buildLayerError("readSource (post)", itemError);
  if (!item) {
    throw buildLayerError(
      "readSource",
      new Error("That post could not be found, or is not readable by you.")
    );
  }

  const { data: blocks, error: blocksError } = await supabase
    .from("content_blocks")
    .select(SOURCE_BLOCK_COLUMNS)
    .eq("content_id", contentItemId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(BLOCK_LIMIT);

  if (blocksError) throw buildLayerError("readSource (blocks)", blocksError);

  return { item: item as SourceItem, blocks: (blocks ?? []) as SourceBlock[] };
}

// -----------------------------------------------------------------------------
// Small readers over an old-path row
// -----------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** "long_text" -> "Long text". The label BLOCK_TYPES gives, when it has one. */
export function blockLabel(blockType: string | null | undefined): string {
  const key = (blockType ?? "").trim();
  const known = BLOCK_TYPES.find((type) => type.value === key);
  if (known) return known.label;
  if (!key) return "Block";
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The extras the old editor stashes in sub_blocks.
 *
 * Two shapes exist in the table, both written by code still in service: the
 * object `{ subheading, groupId, groupTitle, subBlocks }`, and the bare array
 * of sub-list strings. Both are read; neither is written.
 */
function subBlocksOf(block: SourceBlock): { subheading: string; items: string[] } {
  const raw = block.sub_blocks;

  if (Array.isArray(raw)) {
    return { subheading: "", items: raw.map(text).filter(Boolean) };
  }
  if (isRecord(raw)) {
    const items = Array.isArray(raw.subBlocks) ? raw.subBlocks.map(text).filter(Boolean) : [];
    return { subheading: text(raw.subheading) || text(raw.groupTitle), items };
  }
  return { subheading: "", items: [] };
}

function firstLine(value: string): string {
  for (const line of value.split("\n")) {
    const trimmed = line.replace(/^#{1,6}\s*/, "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/**
 * What the node is called.
 *
 * The subheading the creator typed, then the first line of the block, then the
 * file it carries, then the block type's own label. Always something: a card
 * with an empty heading reads as a bug.
 */
export function blockTitle(block: SourceBlock): string {
  const { subheading } = subBlocksOf(block);
  if (subheading) return truncate(subheading, TITLE_MAX);

  const first = firstLine(text(block.text_content));
  if (first) return truncate(first, TITLE_MAX);

  const name = text(block.file_name);
  if (name) return truncate(name, TITLE_MAX);

  const description = text(block.image_description);
  if (description) return truncate(description, TITLE_MAX);

  return blockLabel(block.block_type);
}

/**
 * The URL of the media a block carries, or "".
 *
 * Returned as it stands, to be referenced rather than copied. image_url first
 * because that is where the editor puts a picture; the two file URLs after it,
 * because an older row may carry an image in either.
 */
function mediaUrlOf(block: SourceBlock): string {
  return text(block.image_url) || text(block.external_file_url) || text(block.file_url);
}

/**
 * Everything the payload has no field for, as prose on the node's one prose
 * column. Nothing a creator wrote is dropped on the floor.
 *
 * `used` is the URL the caller has already put IN the payload — the image on a
 * screenshot, the link on a document. Only that one is left out of the note.
 * Every other URL the block carries is written down, because most node types
 * have nowhere to put one and a file a creator attached must not vanish
 * because its block became a type with no url field.
 */
function noteFor(
  block: SourceBlock,
  { extra = [], used = "" }: { extra?: string[]; used?: string } = {}
): string | null {
  const lines = [...extra];

  const instructions = text(block.use_instructions);
  if (instructions) lines.push(`How to use it: ${instructions}`);

  const repo = text(block.github_url);
  if (repo) lines.push(`GitHub: ${repo}`);

  const attachment = text(block.file_url);
  if (attachment && attachment !== used) {
    lines.push(`Attached file: ${text(block.file_name) || attachment}`);
  }

  const external = text(block.external_file_url);
  if (external && external !== used && external !== attachment) {
    lines.push(`Linked file: ${external}`);
  }

  const image = text(block.image_url);
  if (image && image !== used) lines.push(`Image: ${image}`);

  const joined = lines.filter(Boolean).join("\n");
  return joined || null;
}

/** A payload with its empty values removed, so an empty field is absent. */
function compact(payload: Record<string, Json | undefined>): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

// -----------------------------------------------------------------------------
// The readers that do actual work
// -----------------------------------------------------------------------------

const STEP_PREFIX = /^\s*(?:\d{1,3}[.)]|[-*•–])\s+/;

/**
 * The ordered steps inside a workflow block.
 *
 * The sub-list the editor already stores, if there is one. Otherwise the lines
 * that announce themselves as steps — numbered, bulleted or dashed — and only
 * when there are at least two of them, so a paragraph containing one dash is
 * not read as a one-step process.
 */
export function detectSteps(block: SourceBlock): string[] {
  const { items } = subBlocksOf(block);
  if (items.length >= MIN_STEPS) return items;

  const lines = text(block.text_content)
    .split("\n")
    .filter((line) => STEP_PREFIX.test(line))
    .map((line) => line.replace(STEP_PREFIX, "").trim())
    .filter(Boolean);

  return lines.length >= MIN_STEPS ? lines : [];
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "ts", tsx: "tsx", js: "js", mjs: "js", cjs: "js", jsx: "jsx",
  py: "python", sql: "sql", json: "json", yaml: "yaml", yml: "yaml",
  sh: "bash", bash: "bash", zsh: "bash", html: "html", css: "css",
};

const FENCE_LANGUAGE: Record<string, string> = {
  ...LANGUAGE_BY_EXTENSION,
  typescript: "ts", javascript: "js", python: "python", shell: "bash",
};

/**
 * The `language` enum value for a code block, or undefined.
 *
 * The filename decides it when there is one, the opening fence when there is
 * not. Undefined rather than "other" when neither says: an absent field is a
 * question the inspector asks, and "other" is an answer nobody gave.
 */
export function detectLanguage(block: SourceBlock): string | undefined {
  const extension = text(block.file_name).split(".").pop()?.toLowerCase() ?? "";
  if (LANGUAGE_BY_EXTENSION[extension]) return LANGUAGE_BY_EXTENSION[extension];

  const fence = /^\s*```([a-z+#]+)/im.exec(text(block.text_content));
  const named = fence?.[1]?.toLowerCase() ?? "";
  return FENCE_LANGUAGE[named];
}

const PARAM_KEYS: Record<string, string> = {
  model: "model",
  temperature: "temperature",
  temp: "temperature",
  max_tokens: "max_tokens",
  "max tokens": "max_tokens",
  maxtokens: "max_tokens",
  top_p: "top_p",
  "top p": "top_p",
  topp: "top_p",
  context_window: "context_window",
  "context window": "context_window",
  seed: "seed",
};

const NUMERIC_PARAMS = new Set(["temperature", "max_tokens", "top_p", "context_window"]);

/**
 * The model parameters a prose block states as `key: value` lines.
 *
 * Conservative on purpose: only the six keys the node type declares, only when
 * the line names one of them, and only when a numeric field parses as a
 * number. Whatever this does not read stays verbatim on the node's note, so a
 * failed parse loses nothing and a wrong one is visible next to the original.
 */
export function parseModelParams(source: string): Record<string, Json> {
  const found: Record<string, Json> = {};

  for (const line of source.split("\n")) {
    const match = /^\s*[-*•]?\s*([A-Za-z_ ]{2,20}?)\s*[:=]\s*(.+?)\s*$/.exec(line);
    if (!match) continue;

    const key = PARAM_KEYS[match[1].trim().toLowerCase()];
    if (!key || key in found) continue;

    const value = match[2].replace(/[,;]+$/, "").trim();
    if (!value) continue;

    if (NUMERIC_PARAMS.has(key)) {
      const numeric = Number(value.replace(/[^0-9.eE+-]/g, ""));
      if (Number.isFinite(numeric)) found[key] = numeric;
      continue;
    }
    found[key] = value;
  }

  return found;
}

interface ParsedTable {
  columns: { key: string; label: string }[];
  rows: { cells: string }[];
}

const TABLE_DIVIDER = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

function tableCells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

/**
 * A markdown table, or null.
 *
 * Requires a header row of at least two cells followed by a divider row — the
 * shape a person writing a comparison in the old editor actually types. Rows
 * are stored as the pipe-joined string the comparison_table renderer already
 * reads, so nothing downstream learns a new shape.
 */
export function parseTable(source: string): ParsedTable | null {
  const lines = source.split("\n").map((line) => line.trim()).filter(Boolean);

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!lines[index].includes("|")) continue;
    if (!TABLE_DIVIDER.test(lines[index + 1])) continue;

    const header = tableCells(lines[index]).filter(Boolean);
    if (header.length < 2) continue;

    const columns = header.map((label, position) => ({
      key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `col_${position}`,
      label,
    }));

    const rows: { cells: string }[] = [];
    for (const line of lines.slice(index + 2)) {
      if (!line.includes("|") || TABLE_DIVIDER.test(line)) break;
      const cells = tableCells(line);
      if (cells.every((cell) => cell === "")) break;
      rows.push({ cells: cells.slice(0, columns.length).join(" | ") });
    }

    if (rows.length === 0) continue;
    return { columns, rows };
  }

  return null;
}

// -----------------------------------------------------------------------------
// One block -> one node
// -----------------------------------------------------------------------------

function trayPlan(
  block: SourceBlock,
  type: string,
  payload: Record<string, Json>,
  reason: string,
  note: string | null
): NodePlan {
  return {
    blockId: block.id,
    blockType: block.block_type,
    type,
    title: blockTitle(block),
    note,
    payload,
    placed: false,
    trayReason: reason,
    children: [],
  };
}

/**
 * The node one content block becomes.
 *
 * Every block produces exactly one root node. The only question this answers
 * is which type it carries, what its payload holds, and whether it is placed
 * or left in the tray for the creator to decide.
 */
export function mapBlock(block: SourceBlock): NodePlan {
  const blockType = text(block.block_type);
  const body = text(block.text_content);
  const media = mediaUrlOf(block);
  const title = blockTitle(block);

  const nodeType = EXACT_NODE_TYPE[blockType];

  // --- no exact mapping: carried, unplaced, and labelled -----------------------
  if (!nodeType) {
    const carrier = TRAY_CARRIER[blockType] ?? DEFAULT_CARRIER;
    const payload =
      carrier === "document"
        ? compact({ title, url: media || text(block.github_url), summary: body })
        : compact({ body: body || text(block.image_description) });

    return trayPlan(
      block,
      carrier,
      payload,
      `A ${blockLabel(blockType).toLowerCase()} block has no node type that means the same thing. It is here as a ${carrier} for you to place or drop.`,
      noteFor(block, { used: carrier === "document" ? media || text(block.github_url) : "" })
    );
  }

  const empty = (reason: string) =>
    trayPlan(block, nodeType, {}, reason, noteFor(block, { extra: body ? [body] : [] }));

  switch (nodeType) {
    case "prompt": {
      if (!body) return empty("The prompt block carried no text.");
      return {
        blockId: block.id, blockType, type: "prompt", title,
        note: noteFor(block),
        payload: compact({ text: body }),
        placed: true, trayReason: null, children: [],
      };
    }

    case "agent_config": {
      if (!body) return empty("The agent config block carried no text.");
      return {
        blockId: block.id, blockType, type: "agent_config", title,
        note: noteFor(block),
        payload: compact({ system_prompt: body }),
        placed: true, trayReason: null, children: [],
      };
    }

    case "stack": {
      const steps = detectSteps(block);
      if (!body && steps.length === 0) return empty("The workflow block carried no text.");
      return {
        blockId: block.id, blockType, type: "stack", title,
        note: noteFor(block),
        payload: compact({ notes: body }),
        placed: true, trayReason: null,
        // The steps a workflow states, as ordered instruction nodes under it.
        // A workflow with no readable steps stays one node rather than being
        // split on a guess.
        children: steps.map((step) => ({
          blockId: block.id,
          blockType,
          type: "prompt",
          title: truncate(step, TITLE_MAX),
          note: null,
          payload: { text: step },
          placed: true,
          trayReason: null,
          children: [],
        } satisfies NodePlan)),
      };
    }

    case "model_params": {
      const params = parseModelParams(body);
      if (Object.keys(params).length === 0) {
        return trayPlan(
          block,
          "model_params",
          {},
          "The parameters could not be read as fields. The text you wrote is on the note, unchanged.",
          noteFor(block, { extra: body ? [body] : [] })
        );
      }
      return {
        blockId: block.id, blockType, type: "model_params", title,
        // The prose stays whole next to the fields read out of it, so a wrong
        // reading is visible rather than authoritative.
        note: noteFor(block, { extra: [body] }),
        payload: params,
        placed: true, trayReason: null, children: [],
      };
    }

    case "integration": {
      const service = subBlocksOf(block).subheading || firstLine(body);
      if (!body && !service) return empty("The tool setup block carried no text.");
      return {
        blockId: block.id, blockType, type: "integration", title,
        note: noteFor(block),
        payload: compact({ service: truncate(service, TITLE_MAX), notes: body }),
        placed: true, trayReason: null, children: [],
      };
    }

    case "code": {
      if (!body) return empty("The code block carried no source.");
      return {
        blockId: block.id, blockType, type: "code", title,
        note: noteFor(block),
        payload: compact({
          source: body,
          language: detectLanguage(block),
          filename: text(block.file_name),
        }),
        placed: true, trayReason: null, children: [],
      };
    }

    case "result": {
      if (!body && !media) return empty("The result block carried neither text nor an image.");
      return {
        blockId: block.id, blockType, type: "result", title,
        note: noteFor(block, { used: media }),
        // media_id holds the post's own public URL. Nothing is copied.
        payload: compact({ summary: body, media_id: media }),
        placed: true, trayReason: null, children: [],
      };
    }

    case "comparison_table": {
      const table = parseTable(body);
      if (!table) {
        return trayPlan(
          block,
          "comparison_table",
          {},
          "The comparison could not be read as a table. The text you wrote is on the note, unchanged.",
          noteFor(block, { extra: body ? [body] : [] })
        );
      }
      return {
        blockId: block.id, blockType, type: "comparison_table", title,
        note: noteFor(block),
        payload: compact({
          columns: table.columns as unknown as Json,
          rows: table.rows as unknown as Json,
        }),
        placed: true, trayReason: null, children: [],
      };
    }

    case "note": {
      if (!body) return empty("The text block carried no text.");
      return {
        blockId: block.id, blockType, type: "note", title,
        note: noteFor(block),
        payload: { body },
        placed: true, trayReason: null, children: [],
      };
    }

    case "screenshot": {
      if (!media) {
        return trayPlan(
          block,
          "screenshot",
          compact({ caption: text(block.image_description) }),
          "The image block has no image on it any more.",
          noteFor(block, { extra: body ? [body] : [] })
        );
      }
      return {
        blockId: block.id, blockType, type: "screenshot", title,
        note: noteFor(block, { extra: body ? [body] : [], used: media }),
        // The post's own URL, referenced where the media id would go. The
        // object stays in content-files and the post keeps serving it.
        payload: compact({ media_id: media, caption: text(block.image_description) }),
        placed: true, trayReason: null, children: [],
      };
    }

    default:
      // Unreachable while EXACT_NODE_TYPE and this switch agree. If a mapping
      // is added above without a case here, the block still survives.
      return trayPlan(block, DEFAULT_CARRIER, compact({ body }), "This block type is mapped but not yet written out.", noteFor(block));
  }
}

// -----------------------------------------------------------------------------
// The whole plan
// -----------------------------------------------------------------------------

/**
 * What the conversion would make of a post, worked out without writing
 * anything.
 *
 * Pure, so the surface that asks a creator to agree shows exactly what the
 * write will do rather than a description of it.
 */
export function planConversion({ item, blocks }: ConversionSource): ConversionPlan {
  const nodes = blocks.map(mapBlock);

  // The post's own attachment, as an artefact after the body it belongs to.
  const fromPost: NodePlan[] = [];
  const fileUrl = text(item.file_url);
  if (fileUrl) {
    fromPost.push({
      blockId: null,
      blockType: null,
      type: "document",
      title: "Attached file",
      note: null,
      payload: compact({ title: "Attached file", url: fileUrl }),
      placed: true,
      trayReason: null,
      children: [],
    });
  }

  // Two prose fields the old post carries that the build header has nowhere to
  // put. They go to the tray rather than being invented into the record: the
  // creator decides whether they are a prerequisite, a note, or nothing.
  for (const [label, value] of [
    ["How to use it", item.use_instructions],
    ["What to expect", item.what_to_expect],
  ] as const) {
    const body = text(value);
    if (!body) continue;
    fromPost.push({
      blockId: null,
      blockType: null,
      type: "note",
      title: label,
      note: null,
      payload: { body },
      placed: false,
      trayReason: `"${label}" is a field on the old post with no home on a build record. Place it or drop it.`,
      children: [],
    });
  }

  const placed = nodes.filter((node) => node.placed);
  const counts: ConversionCounts = {
    blocks: blocks.length,
    placed: placed.length,
    tray: nodes.length - placed.length,
    steps: placed.reduce((total, node) => total + node.children.length, 0),
    fromPost: fromPost.length,
  };

  const notes = [
    "The post stays exactly as it is: published, unchanged, at the same URL. This makes a second record beside it.",
    "Images are referenced, not copied. The build points at the same files the post already serves.",
    "The build starts as a draft. Nothing is published until you publish it.",
  ];
  if (text(item.difficulty)) {
    notes.push(`Difficulty ("${text(item.difficulty)}") is not carried across — a build record has no such field.`);
  }

  return {
    header: {
      title: text(item.title) || "Untitled build",
      outcome: text(item.description) || null,
      made_with: (item.ai_tools ?? []).filter((tool) => text(tool) !== ""),
      made_for: (item.use_cases ?? []).filter((useCase) => text(useCase) !== ""),
      monetisation_type: item.monetisation_type ?? null,
      price_gbp: item.price_gbp ?? null,
      donation_enabled: item.donation_enabled ?? false,
      source_content_item_id: item.id,
      status: "draft",
    },
    nodes: [...nodes, ...fromPost],
    counts,
    notes,
  };
}

// -----------------------------------------------------------------------------
// Writing it
// -----------------------------------------------------------------------------

/**
 * The build already converted from this post, or null.
 *
 * A creator who converts twice gets the draft they already have rather than a
 * second one. RLS does the scoping: a draft is readable by its creator, so a
 * post converted by its owner finds their draft and nobody else's.
 */
export async function findConversion(contentItemId: string): Promise<Build | null> {
  const { data, error } = await supabase
    .from("builds")
    .select(BUILD_COLUMNS)
    .eq("source_content_item_id", contentItemId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw buildLayerError("findConversion", error);
  return (data as Build | null) ?? null;
}

async function currentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw buildLayerError("convertContentItem (session)", error);
  return data.session?.user?.id ?? null;
}

/** The rows one plan writes, with their ids settled so children can name parents. */
function nodeRows(buildId: string, contentItemId: string, plan: ConversionPlan): BuildNodeInsert[] {
  const rows: BuildNodeInsert[] = [];
  let position = 0;

  const rowFor = (node: NodePlan, parentId: string | null, index: number | null): BuildNodeInsert => ({
    id: crypto.randomUUID(),
    build_id: buildId,
    parent_id: parentId,
    // NULL is the tray, and it is a meaningful value here rather than a
    // missing one.
    position: node.placed ? index : null,
    type: node.type,
    title: node.title,
    note: node.note,
    payload: node.payload as Json,
    source_ref: {
      source: "content_item",
      session_id: contentItemId,
      index: rows.length,
      block_id: node.blockId,
      block_type: node.blockType,
    } as unknown as Json,
  });

  for (const node of plan.nodes) {
    const row = rowFor(node, null, node.placed ? position : null);
    if (node.placed) position += 1;
    rows.push(row);

    node.children.forEach((child, childIndex) => {
      rows.push(rowFor(child, row.id as string, childIndex));
    });
  }

  return rows;
}

/**
 * Convert one post into a draft build record.
 *
 * Returns the build. Converting the same post twice returns the draft the
 * first conversion made — the check is a read of builds by
 * source_content_item_id, and it happens before anything is written, so a
 * creator who clicks twice gets one record and two links to it.
 *
 * OWNERSHIP IS CHECKED HERE, NOT LEFT TO RLS. content_items is readable by
 * anyone once it is approved, so RLS alone would happily let a stranger
 * convert someone else's post into a build under their own name. The signed-in
 * user must be the post's creator.
 *
 * ORDER OF WRITES: the header first, then every node in one insert. There is
 * no browser-side transaction, so a failure between the two leaves an empty
 * draft rather than a half-written tree — which is a build the creator can
 * delete or fill in, and never a partial record wearing a finished one's name.
 */
export async function convertContentItem(contentItemId: string): Promise<Build> {
  const existing = await findConversion(contentItemId);
  if (existing) return existing;

  const userId = await currentUserId();
  if (!userId) {
    throw buildLayerError("convertContentItem", new Error("no signed-in user"));
  }

  const source = await readSource(contentItemId);
  if (source.item.creator_id !== userId) {
    throw buildLayerError(
      "convertContentItem",
      new Error("Only the creator of a post can convert it.")
    );
  }

  const plan = planConversion(source);

  const build = await createBuild({
    title: plan.header.title,
    outcome: plan.header.outcome ?? null,
    made_for: plan.header.made_for ?? [],
    made_with: plan.header.made_with ?? [],
  });

  // The columns createBuild does not take. Monetisation carries across
  // unchanged: those three columns exist on builds with the same names and the
  // same meanings, by design.
  const converted = await updateBuild(build.id, {
    source_content_item_id: contentItemId,
    monetisation_type: plan.header.monetisation_type ?? null,
    price_gbp: plan.header.price_gbp ?? null,
    donation_enabled: plan.header.donation_enabled ?? false,
  });

  const rows = nodeRows(build.id, contentItemId, plan);
  if (rows.length > 0) {
    // Parents and children in one statement: Postgres checks the self
    // reference at the end of the statement, so a child may name a parent
    // inserted beside it.
    const { error } = await supabase.from("build_nodes").insert(rows);
    if (error) throw buildLayerError("convertContentItem (nodes)", error);
  }

  return converted;
}
