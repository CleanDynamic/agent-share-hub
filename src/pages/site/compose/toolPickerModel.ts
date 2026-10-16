// The rows of the tool picker (TF-02), pure.
//
// What the list shows, in order. With an empty query: "In this build" (the tools the build already uses), then
// "Suggested", six tool rows at most, then "Show all {n} tools", which opens every tool under its group. With a query:
// the tools whose name or other spelling starts with it, then those that contain it, six at most, then "Show {n}
// more". A query that names no tool exactly adds a last row, Use "{query}", so any name is allowed.

import { SUGGESTED_TOOLS, TOOLS, TOOL_GROUPS, toolFor, type Tool } from "@/lib/tools/registry";

/** Tool rows shown before "Show all" or "Show more". */
export const PICKER_LIMIT = 6;

/** The longest name a typed tool can have. */
export const TYPED_TOOL_MAX = 40;

export type PickerRow =
  | { kind: "none" }
  | { kind: "heading"; label: string }
  | { kind: "tool"; tool: Tool }
  | { kind: "showAll"; count: number }
  | { kind: "showMore"; count: number }
  | { kind: "use"; name: string };

export interface PickerInput {
  query: string;
  /** The tools the build uses: ids, names or any spelling `toolFor` knows. Others are left out. */
  inBuild: readonly string[];
  expanded: boolean;
  allowNone: boolean;
}

/** Lower case with spaces, `-`, `_` and `.` removed: the registry's own way of comparing spellings. */
const squash = (raw: string): string => raw.toLowerCase().replace(/[\s._-]+/g, "");

const spellings = (tool: Tool): string[] => [tool.name, tool.id, ...tool.aliases].map(squash).filter(Boolean);

/** The build's tools, once each, in the order given. */
function buildTools(inBuild: readonly string[]): Tool[] {
  const seen = new Set<string>();
  const out: Tool[] = [];
  for (const raw of inBuild) {
    const tool = toolFor(raw);
    if (tool && !seen.has(tool.id)) {
      seen.add(tool.id);
      out.push(tool);
    }
  }
  return out;
}

function matches(query: string): Tool[] {
  const wanted = squash(query);
  const starts: Tool[] = [];
  const contains: Tool[] = [];
  for (const tool of TOOLS) {
    const all = spellings(tool);
    if (all.some((spelling) => spelling.startsWith(wanted))) starts.push(tool);
    else if (all.some((spelling) => spelling.includes(wanted))) contains.push(tool);
  }
  return [...starts, ...contains];
}

const toolRows = (tools: readonly Tool[]): PickerRow[] => tools.map((tool) => ({ kind: "tool", tool }));

function allGrouped(): PickerRow[] {
  return TOOL_GROUPS.flatMap((group) => {
    const tools = TOOLS.filter((tool) => tool.group === group.key);
    return tools.length ? [{ kind: "heading", label: group.label } as PickerRow, ...toolRows(tools)] : [];
  });
}

export function pickerRows({ query, inBuild, expanded, allowNone }: PickerInput): PickerRow[] {
  const rows: PickerRow[] = allowNone ? [{ kind: "none" }] : [];
  const typed = query.trim();

  if (!typed) {
    if (expanded) return [...rows, ...allGrouped()];
    const used = buildTools(inBuild).slice(0, PICKER_LIMIT);
    const taken = new Set(used.map((tool) => tool.id));
    const suggested: Tool[] = [];
    for (const id of SUGGESTED_TOOLS) {
      const tool = toolFor(id);
      if (!tool || taken.has(tool.id) || used.length + suggested.length >= PICKER_LIMIT) continue;
      taken.add(tool.id);
      suggested.push(tool);
    }
    if (used.length) rows.push({ kind: "heading", label: "In this build" }, ...toolRows(used));
    if (suggested.length) rows.push({ kind: "heading", label: "Suggested" }, ...toolRows(suggested));
    rows.push({ kind: "showAll", count: TOOLS.length });
    return rows;
  }

  const found = matches(typed);
  const shown = expanded ? found : found.slice(0, PICKER_LIMIT);
  rows.push(...toolRows(shown));
  if (shown.length < found.length) rows.push({ kind: "showMore", count: found.length - shown.length });
  if (typed.length <= TYPED_TOOL_MAX && !toolFor(typed)) rows.push({ kind: "use", name: typed });
  return rows;
}
