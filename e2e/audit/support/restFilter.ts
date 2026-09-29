/* RC-P14c — answer a PostgREST read from fixture rows the way PostgREST would.
 *
 * WHY THIS EXISTS. harness.ts answers every seeded table with ALL its rows,
 * whatever the request filters on. That is enough for a list, and wrong for a
 * lookup: a `.maybeSingle()` read of builds by slug gets every build back, and
 * postgrest-js reports "multiple rows" — so a build page opened through the
 * harness renders "This build could not be loaded" (it did before Phase 3
 * too). The phase-3 critique opens a build page, its lineage and the boards,
 * so its fixtures answer through this: the query string's column filters,
 * `or` (ilike terms only), order, limit and offset, applied to plain rows.
 *
 * WHAT IT DOES NOT DO. Filters on an embedded table (`builds.status`,
 * `build_nodes.type`) are left to the fixture rows, which already carry only
 * what a card or a board needs; an `or` holding anything but ilike terms (the
 * gallery's eligibility rule) is taken as met, because every fixture build is
 * eligible.
 */

type Row = Record<string, unknown>;

/** Split "a,b,(c,d)" on top-level commas. */
function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && (ch === "(" || ch === "{")) depth += 1;
    if (!quoted && (ch === ")" || ch === "}")) depth -= 1;
    if (ch === "," && depth === 0 && !quoted) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** "(a,\"b c\")" or "{a,b}" to ["a", "b c"]. */
function listOf(text: string): string[] {
  return splitTop(text.replace(/^[({]/, "").replace(/[)}]$/, "")).map((item) =>
    item.trim().replace(/^"(.*)"$/, "$1"),
  );
}

function compare(a: unknown, b: string): number {
  const x = Number(a);
  const y = Number(b);
  if (a !== null && a !== "" && b !== "" && Number.isFinite(x) && Number.isFinite(y)) return x - y;
  return String(a ?? "").localeCompare(b);
}

function likePattern(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

/** One `op.value` test against one row value. */
function matches(value: unknown, expression: string): boolean {
  if (expression.startsWith("not.")) return !matches(value, expression.slice(4));
  const dot = expression.indexOf(".");
  const op = expression.slice(0, dot);
  const operand = expression.slice(dot + 1);
  switch (op) {
    case "eq":
      return String(value) === operand;
    case "neq":
      return String(value) !== operand;
    case "gt":
      return value !== null && value !== undefined && compare(value, operand) > 0;
    case "gte":
      return value !== null && value !== undefined && compare(value, operand) >= 0;
    case "lt":
      return value !== null && value !== undefined && compare(value, operand) < 0;
    case "lte":
      return value !== null && value !== undefined && compare(value, operand) <= 0;
    case "in":
      return listOf(operand).includes(String(value));
    case "is":
      return operand === "null" ? value === null || value === undefined : String(value) === operand;
    case "ov": {
      const wanted = listOf(operand);
      return Array.isArray(value) && value.some((item) => wanted.includes(String(item)));
    }
    case "cs": {
      const wanted = listOf(operand);
      return Array.isArray(value) && wanted.every((item) => value.map(String).includes(item));
    }
    case "ilike":
    case "like":
      return likePattern(operand).test(String(value ?? ""));
    default:
      return true;
  }
}

/** `or=(title.ilike.*x*,outcome.ilike.*x*)`: true when any ilike term matches; other forms pass. */
function orMatches(row: Row, expression: string): boolean {
  const terms = splitTop(expression.replace(/^\(/, "").replace(/\)$/, ""));
  const likes = terms
    .map((term) => /^([a-z_]+)\.(ilike|like)\.(.*)$/i.exec(term))
    .filter((match): match is RegExpExecArray => match !== null);
  if (likes.length === 0 || likes.length !== terms.length) return true;
  return likes.some(([, column, op, pattern]) => matches(row[column], `${op}.${pattern.replace(/^"(.*)"$/, "$1")}`));
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

/** The rows a PostgREST GET for `url` would return, before any embed is attached. */
export function filterRows(rows: readonly Row[], url: string): Row[] {
  const params = new URL(url).searchParams;
  let out = rows.filter((row) => {
    for (const [key, expression] of params.entries()) {
      if (RESERVED.has(key)) continue;
      if (key === "or") {
        if (!orMatches(row, expression)) return false;
        continue;
      }
      if (key.includes(".")) continue; // a filter on an embedded table
      if (!matches(row[key], expression)) return false;
    }
    return true;
  });

  const order = params.get("order");
  if (order) {
    const keys = order.split(",").map((part) => {
      const [column, ...flags] = part.split(".");
      const desc = flags.includes("desc");
      // Postgres's default when no nulls flag is sent: NULLS FIRST descending, NULLS LAST ascending.
      const nulls = flags.find((flag) => flag === "nullsfirst" || flag === "nullslast");
      return { column, desc, nullsFirst: nulls ? nulls === "nullsfirst" : desc };
    });
    out = [...out].sort((a, b) => {
      for (const { column, desc, nullsFirst } of keys) {
        const x = a[column];
        const y = b[column];
        const xNull = x === null || x === undefined;
        const yNull = y === null || y === undefined;
        if (xNull || yNull) {
          if (xNull && yNull) continue;
          return (xNull ? 1 : -1) * (nullsFirst ? -1 : 1);
        }
        const cmp = compare(x, String(y));
        if (cmp !== 0) return desc ? -cmp : cmp;
      }
      return 0;
    });
  }

  const offset = Number(params.get("offset") ?? 0);
  const limit = params.get("limit");
  return out.slice(offset, limit === null ? undefined : offset + Number(limit));
}
