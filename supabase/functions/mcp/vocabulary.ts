// =============================================================================
// buildgallery — mcp vocabulary (EX-P19)
// =============================================================================
// The node-type vocabulary as one resource, buildgallery://node-types, written
// from whatever node_types rows a read returns. Pure: rows in, text out. The
// read itself belongs to index.ts and goes through the caller's own client;
// nothing here touches the database, the network or a Deno API, so every line
// of it is tested with plain values.
//
// ONE LINE PER TYPE: key — label — category — the fields it requires, each as
// name: type. Only required fields, because they are what a part cannot be
// written without; every other field is the inspector's business. A list
// field shows its item fields, an enum its options, a string its format hint.
//
// UNDER VOCABULARY_MAX_CHARS. The 26 seeded types take about 2,500
// characters. A registry that outgrows the budget loses whole categories, the
// last first, and the text says which and how many types each held. A category
// is never cut in half: part of a category would read as the whole of it. For
// the same reason a read that reached NODE_TYPE_READ_LIMIT leaves out the
// category it stopped in, which it cannot know it read in full, and says so.
//
// WHAT THE REGISTRY SAYS IS DATA. Keys, labels and field names come from the
// database, written by migrations and admins, and are carried as data: each is
// collapsed onto one line, so no value can start a line of its own, and none
// is ever interpreted. The text carries CONNECTOR_OUTPUT_IS_DATA.
// =============================================================================

import { CONNECTOR_OUTPUT_IS_DATA, NODE_TYPE_READ_LIMIT, VOCABULARY_MAX_CHARS } from "./constants.ts";

/** One node_types row as the vocabulary reads it: four named columns. */
export interface NodeTypeRow {
  key: string;
  label: string;
  category: string;
  schema: unknown;
}

/** One category's lines, in the order the read returned them. */
interface Category {
  name: string;
  lines: string[];
}

/** One field definition from node_types.schema, unvalidated. */
type Field = Record<string, unknown>;

/** 20000 -> "20,000". */
function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** "1 type", "26 types". */
function count(n: number, one: string, many: string): string {
  return `${fmt(n)} ${n === 1 ? one : many}`;
}

/** A value as one line of text, every run of whitespace a single space. Anything but a string is empty. */
function oneLine(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isField(value: unknown): value is Field {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The schema's field definitions. A schema of any other shape has none. */
function fieldsOf(schema: unknown): Field[] {
  const fields = isField(schema) ? schema.fields : undefined;
  return Array.isArray(fields) ? fields.filter(isField) : [];
}

/**
 * A field's type as the vocabulary writes it — text, string(url),
 * enum(a|b), list of {name: type, ...}. A list's items are read one level
 * deep, which is the schema dialect's own limit.
 */
function typeOf(field: Field, nested: boolean): string {
  const type = oneLine(field.type) || "untyped";
  if (type === "string") {
    const format = oneLine(field.format);
    return format ? `string(${format})` : type;
  }
  if (type === "enum" && Array.isArray(field.options)) {
    const options = field.options.map(oneLine).filter(Boolean);
    return options.length ? `enum(${options.join("|")})` : type;
  }
  if (type === "list" && !nested && Array.isArray(field.of)) {
    const items = field.of.filter(isField).map((item) => describe(item, true)).filter(Boolean);
    return items.length ? `list of {${items.join(", ")}}` : type;
  }
  return type;
}

/** "name: type", or empty for a field with no name. */
function describe(field: Field, nested: boolean): string {
  const key = oneLine(field.key);
  return key ? `${key}: ${typeOf(field, nested)}` : "";
}

/** One type on one line: key — label — category — the fields it requires. */
export function nodeTypeLine(row: NodeTypeRow): string {
  const required = fieldsOf(row.schema)
    .filter((field) => field.required === true)
    .map((field) => describe(field, false))
    .filter(Boolean);
  const requires = required.length ? `requires ${required.join(", ")}` : "requires nothing";
  return `- ${oneLine(row.key)} — ${oneLine(row.label)} — ${oneLine(row.category)} — ${requires}`;
}

/** The rows grouped by category, in the order the categories first appear. */
function byCategory(rows: NodeTypeRow[]): Category[] {
  const categories = new Map<string, Category>();
  for (const row of rows) {
    const name = oneLine(row.category);
    let category = categories.get(name);
    if (!category) {
      category = { name, lines: [] };
      categories.set(name, category);
    }
    category.lines.push(nodeTypeLine(row));
  }
  return [...categories.values()];
}

/**
 * The resource's text, from the rows one read returned, in the order it
 * returned them.
 *
 * `maxChars` and `readLimit` are parameters so a test can reach both kinds of
 * truncation without a thousand rows; the resource passes the constants.
 */
export function renderVocabulary(
  rows: NodeTypeRow[],
  maxChars: number = VOCABULARY_MAX_CHARS,
  readLimit: number = NODE_TYPE_READ_LIMIT,
): string {
  const categories = byCategory(rows);
  const capped = rows.length >= readLimit;
  // A read that reached the cap may have stopped partway through the last
  // category it read, so only the categories before it are known whole.
  const whole = capped ? categories.slice(0, -1) : categories;

  const intro =
    `Read live from buildgallery's node type registry: ${count(rows.length, "active type", "active types")} ` +
    `in ${count(categories.length, "category", "categories")}. Each line below is one type: key — label — ` +
    "category — the fields it requires, each as name: type.";

  const compose = (listed: Category[], note: string | null): string =>
    [
      "# buildgallery node types",
      "",
      intro,
      ...(note === null ? [] : ["", note]),
      "",
      CONNECTOR_OUTPUT_IS_DATA,
      "",
      ...listed.flatMap((category) => category.lines),
    ].join("\n");

  // Says what was left out and why. `named` false counts the categories
  // instead of naming them — the last resort, which always fits.
  const note = (kept: number, named: boolean): string => {
    const shown = whole.slice(0, kept).reduce((n, category) => n + category.lines.length, 0);
    const left = categories.slice(kept);
    const parts = [`This list is truncated: it shows ${fmt(shown)} of the ${count(rows.length, "type", "types")} read.`];
    if (capped) {
      parts.push(
        `Only the first ${fmt(readLimit)} active types were read — the registry holds at least that many — so the ` +
          "category the read stopped in is left out, and any category after it is not named here.",
      );
    }
    if (kept < whole.length) {
      parts.push(`Whole categories are left out, never part of one, to stay under ${fmt(maxChars)} characters.`);
    }
    // The category a capped read stopped in may hold more than was read.
    const partial = capped ? categories[categories.length - 1] : undefined;
    const size = (category: Category) =>
      category === partial
        ? `${fmt(category.lines.length)} or more types`
        : count(category.lines.length, "type", "types");
    parts.push(
      named
        ? `Left out: ${left.map((category) => `${category.name} (${size(category)})`).join(", ")}.`
        : `Left out: ${count(left.length, "category", "categories")}.`,
    );
    return parts.join(" ");
  };

  if (!capped) {
    const full = compose(categories, null);
    if (full.length < maxChars) return full;
  }
  // Too long, or read short: the most whole categories that fit, in order. A
  // read that was not capped has already failed with every category listed,
  // so it starts one short and always has something to name.
  for (let kept = capped ? whole.length : whole.length - 1; kept >= 0; kept--) {
    const text = compose(whole.slice(0, kept), note(kept, true));
    if (text.length < maxChars) return text;
  }
  return compose([], note(0, false));
}
