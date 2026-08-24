// =============================================================================
// NeoScale — generate-build-layers: the compact record description
// =============================================================================
// The model never sees the build record. It sees this: a line-oriented
// description of the typed tree and the kept sequence, carrying types, titles,
// notes and THE REQUIRED PAYLOAD FIELDS ONLY. Not whole payloads — a single
// `code` node's `source` would eat the budget on its own, and the shape of the
// build is what the layers are about.
//
// The registry is what makes "required fields only" a real filter rather than
// a guess: node_types.schema declares exactly which field carries the point of
// each type — prompt.text, live_app.url, breakage.symptom, result.summary.
// Twenty-five of the twenty-six seeded types declare at least one. The one
// that does not (eval_run) falls back to its first field, so no node arrives
// at the model as a bare type name.
//
// NODES ARE ADDRESSED BY SHORT REF (n1, n2, …), NOT BY UUID. Three reasons:
// uuids are 36 tokens of noise per mention; a hallucinated ref cannot
// accidentally collide with a real node id; and every ref the model returns is
// looked up in a map this file built, so an invented one resolves to nothing
// and becomes null rather than a dangling id.
//
// THE BUDGET. Very large builds are reduced by SUMMARISING THE DEEPEST LEVEL,
// not by truncating the tree: the roots always survive, so the shape of the
// build survives. Only when the tree is already flat does the reduction start
// shortening values and dropping the middle of the sequence.
// =============================================================================

import type {
  BuildRow,
  EventRow,
  FieldDef,
  NodeRow,
  NodeTypeRow,
  TreeNode,
} from "./types.ts";

/** ~6k tokens of record description, leaving room for instructions and output. */
export const MAX_DESCRIPTION_CHARS = 20_000;

/** Progressively harder reductions. The first one that fits is the one used. */
interface Pass {
  /** Tree levels rendered in full; deeper nodes fold into a summary line. */
  maxDepth: number;
  /** Kept events rendered; the middle is dropped first. */
  maxEvents: number;
  /** Character cap on a single payload value. */
  valueChars: number;
  /** What a reader should be told happened, or null for the full rendering. */
  note: string | null;
}

const PASSES: Pass[] = [
  { maxDepth: 99, maxEvents: 60, valueChars: 240, note: null },
  {
    maxDepth: 3,
    maxEvents: 60,
    valueChars: 200,
    note: "nodes below level 3 were summarised",
  },
  {
    maxDepth: 2,
    maxEvents: 40,
    valueChars: 160,
    note: "nodes below level 2 were summarised and the sequence was shortened",
  },
  {
    maxDepth: 1,
    maxEvents: 24,
    valueChars: 120,
    note: "only the top level of the tree was described in full",
  },
  {
    maxDepth: 1,
    maxEvents: 10,
    valueChars: 80,
    note:
      "only the top level of the tree was described, with values and the sequence cut hard",
  },
];

export interface Description {
  text: string;
  /** short ref -> build_nodes.id, for every node the model was shown. */
  refs: Map<string, string>;
  /** Index into PASSES. 0 means nothing was reduced. */
  pass: number;
  /** Set when the description was reduced to fit the budget. */
  reduction: string | null;
  /** Set in the pathological case where even the last pass overflowed. */
  hardTruncated: boolean;
}

// --- the tree ----------------------------------------------------------------

/**
 * Placed nodes (position IS NOT NULL), nested and ordered. Tray nodes are not
 * part of the record a reader sees, so they are not part of what is described
 * or hashed.
 *
 * A placed node whose parent is missing or unplaced is treated as a root
 * rather than dropped: a node the compose panel would still render must not
 * vanish from the description just because its parent is in a strange state.
 */
export function buildTree(nodes: NodeRow[]): TreeNode[] {
  const placed = nodes.filter((n) => n.position !== null);
  const byId = new Map(placed.map((n) => [n.id, n]));
  const childrenOf = new Map<string | null, NodeRow[]>();

  for (const node of placed) {
    const parent = node.parent_id && byId.has(node.parent_id)
      ? node.parent_id
      : null;
    const bucket = childrenOf.get(parent);
    if (bucket) bucket.push(node);
    else childrenOf.set(parent, [node]);
  }

  const assemble = (parent: string | null): TreeNode[] =>
    (childrenOf.get(parent) ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((node) => ({ node, children: assemble(node.id) }));

  return assemble(null);
}

/** n1, n2, … in tree order. Depth-first, so a ref's number reads as position. */
export function mintRefs(tree: TreeNode[]): {
  refOf: Map<string, string>;
  idOf: Map<string, string>;
} {
  const refOf = new Map<string, string>(); // node id -> ref
  const idOf = new Map<string, string>(); // ref -> node id
  let next = 1;
  const walk = (nodes: TreeNode[]) => {
    for (const item of nodes) {
      const ref = `n${next++}`;
      refOf.set(item.node.id, ref);
      idOf.set(ref, item.node.id);
      walk(item.children);
    }
  };
  walk(tree);
  return { refOf, idOf };
}

// --- value rendering ---------------------------------------------------------

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, max: number): string {
  const flat = collapse(value);
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/**
 * One payload value, rendered for a reader rather than for a parser.
 *
 * The two id formats are deliberately NOT passed through: a media_id is a
 * storage uuid the model can do nothing with, and a node_id is only meaningful
 * as the short ref this description already uses.
 */
function renderValue(
  field: FieldDef,
  raw: unknown,
  refOf: Map<string, string>,
  valueChars: number,
): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

  if (field.format === "media_id") {
    return "(attached media)";
  }
  if (field.format === "node_id") {
    const ref = typeof raw === "string" ? refOf.get(raw) : undefined;
    return ref ? `-> ${ref}` : "(another node)";
  }

  if (field.type === "list") {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const first = field.of?.[0]?.key;
    const parts = raw.slice(0, 4).map((item) => {
      if (item && typeof item === "object" && first) {
        const inner = (item as Record<string, unknown>)[first];
        return inner === null || inner === undefined
          ? "?"
          : clip(String(inner), 60);
      }
      return clip(String(item), 60);
    });
    const more = raw.length > parts.length ? `, +${raw.length - parts.length} more` : "";
    return `${raw.length} item${raw.length === 1 ? "" : "s"}: ${parts.join("; ")}${more}`;
  }

  if (typeof raw === "boolean" || typeof raw === "number") {
    return String(raw);
  }
  if (typeof raw === "object") {
    return clip(JSON.stringify(raw), valueChars);
  }
  return clip(String(raw), valueChars);
}

/**
 * The fields of a type that carry its point. Required fields, and — for a type
 * that declares none — its first field, so the node is not described as a bare
 * type name.
 */
function describedFields(type: NodeTypeRow | undefined): FieldDef[] {
  const fields = type?.schema?.fields ?? [];
  const required = fields.filter((f) => f.required);
  if (required.length > 0) return required;
  return fields.slice(0, 1);
}

// --- the description ---------------------------------------------------------

function countDescendants(item: TreeNode): number {
  return item.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

function foldedTypes(item: TreeNode): string[] {
  const seen: string[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const child of nodes) {
      if (!seen.includes(child.node.type)) seen.push(child.node.type);
      walk(child.children);
    }
  };
  walk(item.children);
  return seen;
}

function renderNodes(
  tree: TreeNode[],
  types: Map<string, NodeTypeRow>,
  refOf: Map<string, string>,
  pass: Pass,
): string[] {
  const lines: string[] = [];

  const walk = (nodes: TreeNode[], depth: number) => {
    for (const item of nodes) {
      const { node } = item;
      const pad = "  ".repeat(depth);
      const ref = refOf.get(node.id) ?? "?";
      const title = node.title ? ` "${clip(node.title, 120)}"` : "";
      const gap = node.is_gap ? " (GAP — a known hole, not a working part)" : "";
      lines.push(`${pad}- ${ref} [${node.type}]${title}${gap}`);

      if (node.note) {
        lines.push(`${pad}    note: ${clip(node.note, pass.valueChars)}`);
      }

      for (const field of describedFields(types.get(node.type))) {
        const value = renderValue(
          field,
          (node.payload ?? {})[field.key],
          refOf,
          pass.valueChars,
        );
        if (value !== null) lines.push(`${pad}    ${field.key}: ${value}`);
      }

      if (item.children.length === 0) continue;

      if (depth + 1 < pass.maxDepth) {
        walk(item.children, depth + 1);
      } else {
        const total = countDescendants(item);
        const kinds = foldedTypes(item).slice(0, 6).join(", ");
        lines.push(
          `${pad}    … ${total} more node${total === 1 ? "" : "s"} below this one: ${kinds}`,
        );
      }
    }
  };

  walk(tree, 0);
  return lines;
}

/** The one line an event contributes: what happened, and what it produced. */
function renderEvent(
  event: EventRow,
  refOf: Map<string, string>,
  valueChars: number,
): string {
  const payload = event.payload ?? {};
  const summary = ["title", "summary", "text", "message", "note", "label"]
    .map((key) => payload[key])
    .find((value) => typeof value === "string" && value.trim() !== "");

  const phase = event.phase_title ? `${clip(event.phase_title, 60)} — ` : "";
  const body = typeof summary === "string" ? clip(summary, valueChars) : "";
  const produced = event.produced_node_id
    ? ` -> ${refOf.get(event.produced_node_id) ?? "(unplaced node)"}`
    : "";

  return `${event.ordinal}. [${event.kind}] ${phase}${body}${produced}`.trimEnd();
}

function renderEvents(
  events: EventRow[],
  refOf: Map<string, string>,
  pass: Pass,
): string[] {
  if (events.length === 0) return [];
  if (events.length <= pass.maxEvents) {
    return events.map((e) => renderEvent(e, refOf, pass.valueChars));
  }
  // Drop the middle, never the ends: a sequence is read for how it started and
  // how it finished.
  const head = Math.ceil(pass.maxEvents / 2);
  const tail = pass.maxEvents - head;
  return [
    ...events.slice(0, head).map((e) => renderEvent(e, refOf, pass.valueChars)),
    `… ${events.length - pass.maxEvents} further events omitted …`,
    ...events.slice(events.length - tail).map((e) =>
      renderEvent(e, refOf, pass.valueChars)
    ),
  ];
}

function renderHeader(build: BuildRow): string[] {
  const lines = [
    "BUILD",
    `title: ${clip(build.title, 200)}`,
    `shape: ${build.shape}`,
  ];
  if (build.outcome) lines.push(`outcome: ${clip(build.outcome, 400)}`);
  if (build.made_for?.length) lines.push(`made for: ${build.made_for.join(", ")}`);
  if (build.made_with?.length) lines.push(`made with: ${build.made_with.join(", ")}`);
  return lines;
}

function render(
  build: BuildRow,
  tree: TreeNode[],
  events: EventRow[],
  types: Map<string, NodeTypeRow>,
  refOf: Map<string, string>,
  pass: Pass,
): string {
  const sections = [
    renderHeader(build).join("\n"),
    [
      "NODES — the record, nested. Each line is: ref [type] \"title\", then its",
      "note and the field that carries its point. Indentation is nesting.",
      ...renderNodes(tree, types, refOf, pass),
    ].join("\n"),
  ];

  const eventLines = renderEvents(events, refOf, pass);
  if (eventLines.length > 0) {
    sections.push(
      [
        "SEQUENCE — the kept events, in the order they happened.",
        ...eventLines,
      ].join("\n"),
    );
  }

  return sections.join("\n\n");
}

/**
 * The description the model is given, reduced only as far as the budget forces.
 */
export function describeRecord(
  build: BuildRow,
  tree: TreeNode[],
  events: EventRow[],
  nodeTypes: NodeTypeRow[],
  refOf: Map<string, string>,
): Description {
  const types = new Map(nodeTypes.map((t) => [t.key, t]));
  const refs = new Map<string, string>();
  for (const [id, ref] of refOf) refs.set(ref, id);

  let text = "";
  for (let index = 0; index < PASSES.length; index++) {
    text = render(build, tree, events, types, refOf, PASSES[index]);
    if (text.length <= MAX_DESCRIPTION_CHARS) {
      return {
        text,
        refs,
        pass: index,
        reduction: PASSES[index].note,
        hardTruncated: false,
      };
    }
  }

  // Every pass overflowed — a build with hundreds of root nodes. Cut the text
  // itself, and say so rather than letting the model infer the record simply
  // stops there.
  const last = PASSES.length - 1;
  return {
    text: `${text.slice(0, MAX_DESCRIPTION_CHARS)}\n… the description was cut here; the record continues.`,
    refs,
    pass: last,
    reduction: `${PASSES[last].note}, and the description was still cut to fit`,
    hardTruncated: true,
  };
}
