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
//
// CA-12 P13: TWO LISTS. `list: "ai"` offers the AI tools (sessions, prompts, an agent's "Runs in"); `list: "app"` offers the
// apps and services (a Tool tile, a manual step's "Where was it done?", an agent's tools). The app list is not fitted to a
// step: an app is an app wherever it is named. Typing a name that is only in the other list says so, plainly, in a note row
// ("GitHub Copilot is an AI tool. Add it to a session or a prompt."); any other typed name still has its Use "{query}" row.

import { fitsStep } from "@/lib/tools/modelRules";
import { AI_TOOLS, APPS, APP_GROUP_LABEL, SUGGESTED_APPS, SUGGESTED_TOOLS, TOOL_GROUPS, TOOLS, isPickable, toolFor, type StepKey, type Tool, type ToolList } from "@/lib/tools/registry";

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
  /** CA-12 P13: a plain sentence, not a choice: the name typed is in the other list. */
  | { kind: "note"; text: string }
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
  /** CA-12 P13: the list offered. AI tools when absent. */
  list?: ToolList;
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

function matches(query: string, from: readonly Tool[]): Tool[] {
  const wanted = squash(query);
  const starts: Tool[] = [];
  const contains: Tool[] = [];
  for (const tool of from) {
    const all = spellings(tool);
    if (all.some((spelling) => spelling.startsWith(wanted))) starts.push(tool);
    else if (all.some((spelling) => spelling.includes(wanted))) contains.push(tool);
  }
  return [...starts, ...contains];
}

const fits = (step: StepKey, list: ToolList = "ai") => (tool: Tool): boolean => isPickable(tool) && (list === "app" || fitsStep(tool.id, step));

/** The tools that can be picked for this step, in list order: what "Show all {n} tools" counts. */
export const toolsForStep = (step: StepKey, list: ToolList = "ai"): Tool[] => (list === "app" ? APPS : AI_TOOLS).filter(fits(step, list));

/** CA-12 P13: the note a name typed in one list earns when it is only in the other. */
export const OTHER_LIST_COPY = {
  isAiTool: (name: string) => `${name} is an AI tool. Add it to a session or a prompt.`,
  isApp: (name: string) => `${name} is an app. Add it with Add › Tool.`,
} as const;

/** Notes for the tools typed that are in the other list only, at most two. */
function otherListNotes(query: string, list: ToolList): PickerRow[] {
  const other = list === "ai" ? "app" : "ai";
  const here = (list === "ai" ? AI_TOOLS : APPS).map((tool) => tool.id);
  return matches(query, TOOLS.filter((tool) => tool.lists.includes(other) && !here.includes(tool.id)))
    .filter(isPickable)
    .slice(0, 2)
    .map((tool): PickerRow => ({ kind: "note", text: list === "ai" ? OTHER_LIST_COPY.isApp(tool.name) : OTHER_LIST_COPY.isAiTool(tool.name) }));
}

function allGrouped(step: StepKey, list: ToolList): PickerRow[] {
  if (list === "app") {
    const tools = toolsForStep(step, list);
    return tools.length ? [{ kind: "heading", label: APP_GROUP_LABEL } as PickerRow, ...tools.map((tool) => fittingRow(tool, step))] : [];
  }
  return TOOL_GROUPS.flatMap((group) => {
    const tools = toolsForStep(step, list).filter((tool) => tool.group === group.key);
    return tools.length ? [{ kind: "heading", label: group.label } as PickerRow, ...tools.map((tool) => fittingRow(tool, step))] : [];
  });
}

export function pickerRows({ query, inBuild, expanded, allowNone, step, list = "ai" }: PickerInput): PickerRow[] {
  const ok = fits(step, list);
  const inList = (tool: Tool) => tool.lists.includes(list);
  const toolRows = (tools: readonly Tool[]): PickerRow[] => tools.map((tool) => fittingRow(tool, step));
  const rows: PickerRow[] = allowNone ? [{ kind: "none" }] : [];
  const typed = query.trim();

  if (!typed) {
    if (expanded) return [...rows, ...allGrouped(step, list)];
    const used = buildTools(inBuild).filter((tool) => inList(tool) && ok(tool)).slice(0, PICKER_LIMIT);
    const taken = new Set(used.map((tool) => tool.id));
    const suggested: Tool[] = [];
    for (const id of list === "app" ? SUGGESTED_APPS : SUGGESTED_TOOLS) {
      const tool = toolFor(id);
      if (!tool || !inList(tool) || !ok(tool) || taken.has(tool.id) || used.length + suggested.length >= PICKER_LIMIT) continue;
      taken.add(tool.id);
      suggested.push(tool);
    }
    if (used.length) rows.push({ kind: "heading", label: "In this build" }, ...toolRows(used));
    if (suggested.length) rows.push({ kind: "heading", label: "Suggested" }, ...toolRows(suggested));
    rows.push({ kind: "showAll", count: toolsForStep(step, list).length });
    return rows;
  }

  const matched = matches(typed, list === "app" ? APPS : AI_TOOLS).filter(isPickable);
  const found = matched.filter(ok);
  const shown = expanded ? found : found.slice(0, PICKER_LIMIT);
  rows.push(...toolRows(shown));
  if (shown.length < found.length) rows.push({ kind: "showMore", count: found.length - shown.length });
  if (list === "ai") {
    for (const tool of matched.filter((candidate) => !ok(candidate))) {
      const row = unavailableRow(tool, step);
      if (row) rows.push(row);
    }
  }
  rows.push(...otherListNotes(typed, list));
  if (typed.length <= TYPED_TOOL_MAX && !toolFor(typed)) rows.push({ kind: "use", name: typed });
  return rows;
}
