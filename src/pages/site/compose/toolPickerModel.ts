// The rows of the tool picker (TF-02), pure.
//
// What the list shows, in order. With an empty query: "In this build" (the tools the build already uses), then
// "Suggested", six tool rows at most, then "Show all {n} tools", which opens every tool under its group. With a query:
// the tools whose name or other spelling starts with it, then those that contain it, six at most, then "Show {n}
// more". A query that names no tool exactly adds a last row, Use "{query}", so any name is allowed.
//
// CA-02: THE ROWS FIT THE STEP. A tool whose `steps` leave out the step being named is left out of In this build,
// Suggested and Show all. A query that names one still shows it, last and drawn as unavailable, with a line saying
// where it goes, so a maker who types "hermes" on a prompt learns it is an agent. Only that kind of row, a tool that
// runs prompts by itself, can be picked on a prompt: the field then offers to add it as an agent. A retired tool is
// never shown.

import { fitsStep } from "@/lib/tools/modelRules";
import { SUGGESTED_TOOLS, TOOLS, TOOL_GROUPS, isPickable, toolFor, type StepKey, type Tool } from "@/lib/tools/registry";

/** The Add item each step is named on (SandboxView's ADD_ITEMS), for the line under an unavailable row. */
const ADD_NAME: Record<StepKey, string> = {
  prompt: "Prompt",
  session: "Session",
  agent: "Agent or team",
  file: "File",
  tool: "Tool",
  manual: "Manual step",
  result: "Result",
  code: "Code",
};

export const TOOL_PICKER_COPY = {
  /** CA-02 P4: a tool that only runs as an agent, named on a prompt. */
  runsItself: (tool: string) => `${tool} runs prompts by itself. Add it as an agent.`,
  /** CA-02 P4: an automation tool named on a prompt. */
  workflow: "Add its workflow with Add › File",
  /** A tool that does not fit this step: the Add item it does fit. */
  goesTo: (item: string) => `Add it with Add › ${item}`,
} as const;

/** Tool rows shown before "Show all" or "Show more". */
export const PICKER_LIMIT = 6;

/** The longest name a typed tool can have. */
export const TYPED_TOOL_MAX = 40;

export type PickerRow =
  | { kind: "none" }
  | { kind: "heading"; label: string }
  /** `line` is a quiet line under the name; `unavailable` draws the row as one that does not fit, and `pickable` says whether it can still be picked. */
  | { kind: "tool"; tool: Tool; line?: string; unavailable?: boolean; pickable?: boolean }
  | { kind: "showAll"; count: number }
  | { kind: "showMore"; count: number }
  | { kind: "use"; name: string };

export interface PickerInput {
  query: string;
  /** The tools the build uses: ids, names or any spelling `toolFor` knows. Others are left out. */
  inBuild: readonly string[];
  expanded: boolean;
  allowNone: boolean;
  /** The Add item the tool is being named on. */
  step: StepKey;
}

/** Whether a tool runs prompts by itself and is never named on a prompt (Hermes Agent, Manus). */
export const runsItself = (tool: Tool): boolean => tool.steps.includes("agent") && !tool.steps.includes("prompt");

/** The Add items a line can send a maker to, in the order they are tried. */
const GOES_TO: readonly StepKey[] = ["prompt", "agent", "file", "tool", "code", "manual"];

/** The row of a tool that does not fit `step`, or null when there is nowhere to send the maker. */
function unavailableRow(tool: Tool, step: StepKey): PickerRow | null {
  if (runsItself(tool)) return { kind: "tool", tool, unavailable: true, pickable: step === "prompt", line: TOOL_PICKER_COPY.runsItself(tool.name) };
  const fits = GOES_TO.find((key) => tool.steps.includes(key));
  return fits ? { kind: "tool", tool, unavailable: true, pickable: false, line: TOOL_PICKER_COPY.goesTo(ADD_NAME[fits]) } : null;
}

/** A row for a tool that fits, with the workflow line for an automation tool on a prompt. */
const fittingRow = (tool: Tool, step: StepKey): PickerRow =>
  step === "prompt" && tool.kind === "automation" ? { kind: "tool", tool, line: TOOL_PICKER_COPY.workflow } : { kind: "tool", tool };

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

const fits = (step: StepKey) => (tool: Tool): boolean => isPickable(tool) && fitsStep(tool.id, step);

/** The tools that can be picked for this step, in list order: what "Show all {n} tools" counts. */
export const toolsForStep = (step: StepKey): Tool[] => TOOLS.filter(fits(step));

function allGrouped(step: StepKey): PickerRow[] {
  return TOOL_GROUPS.flatMap((group) => {
    const tools = toolsForStep(step).filter((tool) => tool.group === group.key);
    return tools.length ? [{ kind: "heading", label: group.label } as PickerRow, ...tools.map((tool) => fittingRow(tool, step))] : [];
  });
}

export function pickerRows({ query, inBuild, expanded, allowNone, step }: PickerInput): PickerRow[] {
  const ok = fits(step);
  const toolRows = (tools: readonly Tool[]): PickerRow[] => tools.map((tool) => fittingRow(tool, step));
  const rows: PickerRow[] = allowNone ? [{ kind: "none" }] : [];
  const typed = query.trim();

  if (!typed) {
    if (expanded) return [...rows, ...allGrouped(step)];
    const used = buildTools(inBuild).filter(ok).slice(0, PICKER_LIMIT);
    const taken = new Set(used.map((tool) => tool.id));
    const suggested: Tool[] = [];
    for (const id of SUGGESTED_TOOLS) {
      const tool = toolFor(id);
      if (!tool || !ok(tool) || taken.has(tool.id) || used.length + suggested.length >= PICKER_LIMIT) continue;
      taken.add(tool.id);
      suggested.push(tool);
    }
    if (used.length) rows.push({ kind: "heading", label: "In this build" }, ...toolRows(used));
    if (suggested.length) rows.push({ kind: "heading", label: "Suggested" }, ...toolRows(suggested));
    rows.push({ kind: "showAll", count: toolsForStep(step).length });
    return rows;
  }

  const matched = matches(typed).filter(isPickable);
  const found = matched.filter(ok);
  const shown = expanded ? found : found.slice(0, PICKER_LIMIT);
  rows.push(...toolRows(shown));
  if (shown.length < found.length) rows.push({ kind: "showMore", count: found.length - shown.length });
  for (const tool of matched.filter((candidate) => !ok(candidate))) {
    const row = unavailableRow(tool, step);
    if (row) rows.push(row);
  }
  if (typed.length <= TYPED_TOOL_MAX && !toolFor(typed)) rows.push({ kind: "use", name: typed });
  return rows;
}
