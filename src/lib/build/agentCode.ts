// CA-13 Part 6: an agent's code, two ways, pure.
//
//   COPY. When the agent has a "defined in" Code tile the main button copies that tile's real code (rule 4). "Copy as a
//   starting point" writes `create_deep_agent(model=…, tools=[…], middleware=[…])` from the chips, labelled as written from
//   the settings on the page; it is the only button when there is no code. For any provider other than ScaleDown in Deep
//   Agents it copies a plain description instead of guessing code. The site never invents a package name.
//
//   READ. "Read the helpers from code" reads `create_deep_agent(...)` and its ScaleDown middleware, but only from literal
//   values; anything built from variables is listed as "Found, but set in code: fill this in". It never runs anything.

import { HELPERS_MAX, helperChip, providerLabel, type Helper } from "./helpers";
import { matchBracket, NotLiteral, PyReader, splitTopLevel, isCall, type Py } from "./pyLiteral";

export const STARTING_POINT_NOTE = "Written from the settings on this page, not the maker's own code";

export interface AgentSpec {
  name?: string | null;
  model: string;
  /** The tool id the agent ran in ("deep-agents"), or null for the maker's own code. */
  harness: string | null;
  /** The names of the tools it could call. */
  tools: readonly string[];
  instructions?: string;
  helpers: readonly Helper[];
}

const pyString = (value: string): string => JSON.stringify(value);
const pyIdent = (name: string): string => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "tool";
const share = (n: number): string => String(Math.round(n * 1000) / 1000);

/** Whether the starting point is code: Deep Agents (or no harness named) with every helper from ScaleDown. */
export const startingPointIsCode = (spec: Pick<AgentSpec, "harness" | "helpers">): boolean =>
  (!spec.harness || spec.harness === "deep-agents") && spec.helpers.every((helper) => /scaledown/i.test(helper.provider) && helper.job !== "decide");

/** A plain description of the setup, for a provider or framework the site will not guess code for. */
export function agentDescription(spec: AgentSpec, decisionName?: (id: string) => string | undefined): string {
  const lines = [`${STARTING_POINT_NOTE}.`, "", `Agent${spec.name ? ` '${spec.name}'` : ""}`, `Model: ${spec.model || "not given"}`];
  if (spec.harness) lines.push(`Runs in: ${providerLabel(spec.harness)}`);
  if (spec.tools.length) lines.push(`Tools: ${spec.tools.join(", ")}`);
  if (spec.instructions?.trim()) lines.push("", "Instructions:", spec.instructions.trim());
  if (spec.helpers.length) {
    lines.push("", "Helpers it used:");
    for (const helper of spec.helpers) lines.push(`- ${helperChip(helper, decisionName)} (${providerLabel(helper.provider)}${helper.model ? `, ${helper.model}` : ""})`);
  }
  return lines.join("\n");
}

/** The `create_deep_agent(...)` call for the chips, or a plain description where the site will not guess code. */
export function agentStartingPoint(spec: AgentSpec, decisionName?: (id: string) => string | undefined): string {
  if (!startingPointIsCode(spec)) return agentDescription(spec, decisionName);
  const middleware: string[] = [];
  const extra: string[] = [];
  for (const helper of spec.helpers) {
    if (helper.job === "summarize") {
      const args = [helper.model ? `model=${pyString(helper.model)}` : null, helper.trigger?.at !== undefined ? `trigger=("fraction", ${share(helper.trigger.at)})` : null, helper.trigger?.keep !== undefined ? `keep=("fraction", ${share(helper.trigger.keep)})` : null].filter(Boolean);
      middleware.push(`ScaledownSummarizationMiddleware(${args.join(", ")})`);
    } else if (helper.job === "compress") {
      middleware.push(`ScaledownToolCompressionMiddleware(${helper.tools?.length ? `tools=[${helper.tools.map(pyString).join(", ")}]` : ""})`);
    } else if (helper.job === "extract") {
      middleware.push(`ScaledownExtractionMiddleware(fields=[${(helper.fields ?? []).map(pyString).join(", ")}])`);
    } else if (helper.job === "classify") {
      middleware.push("stop_if_looping");
      extra.push(
        "@after_model",
        "def stop_if_looping(state, runtime):",
        `    # Labels: ${(helper.labels ?? []).join(", ") || "none given"}.`,
        helper.stopAt !== undefined ? `    # Stop the run when a non-progress label scores ${share(helper.stopAt)} or more.` : "    # Fill in when to stop the run.",
        "    ...",
        "",
      );
    }
  }
  const names = spec.tools.map(pyIdent);
  const lines = [
    `# ${STARTING_POINT_NOTE}.`,
    "# Set SCALEDOWN_API_KEY in your environment; never write the key into this file.",
    "# Import the ScaleDown middleware (and after_model) from the packages you installed for them.",
    "from deepagents import create_deep_agent",
    "",
    ...(names.length ? [`# Define these tools yourself: ${names.join(", ")}`, ""] : []),
    ...extra,
    "agent = create_deep_agent(",
    `    model=${pyString(spec.model || "")},`,
    `    tools=[${names.join(", ")}],`,
    ...(spec.instructions?.trim() ? [`    system_prompt=${pyString(spec.instructions.trim())},`] : []),
    `    middleware=[${middleware.length ? `\n${middleware.map((entry) => `        ${entry},`).join("\n")}\n    ` : ""}],`,
    ")",
  ];
  return lines.join("\n");
}

/** What "Copy" gives for an agent: the maker's own code when a Code tile defines it, and the labelled starting point. */
export interface AgentCopy {
  code: { label: string; text: string } | null;
  start: { label: string; text: string; note: string };
}

export function agentCopy(spec: AgentSpec, definedIn: readonly { name: string; text: string }[], decisionName?: (id: string) => string | undefined): AgentCopy {
  return {
    code: definedIn.length ? { label: "Copy the code", text: definedIn.length === 1 ? definedIn[0].text : definedIn.map((tile) => `# ${tile.name}\n${tile.text}`).join("\n\n") } : null,
    start: { label: "Copy as a starting point", text: agentStartingPoint(spec, decisionName), note: STARTING_POINT_NOTE },
  };
}

// --- reading ------------------------------------------------------------------

export interface HelpersRead {
  /** The call was found at all. */
  found: boolean;
  model?: string;
  /** The tools it names (plain names, never evaluated). */
  tools: string[];
  helpers: Helper[];
  /** Things found whose values are set in code: each is listed so the maker fills it in. */
  setInCode: string[];
}

export const SET_IN_CODE_LINE = "Found, but set in code: fill this in";

const MIDDLEWARE = /^Scaledown(Summarization|ToolCompression|Extraction)Middleware$/;

/** The first positional or named argument of a literal call, for the argument names given. */
const arg = (call: { args: Py[]; kwargs: Record<string, Py> }, names: readonly string[], position?: number): Py | undefined => {
  for (const name of names) if (name in call.kwargs) return call.kwargs[name];
  return position !== undefined ? call.args[position] : undefined;
};

const asStrings = (value: Py | undefined): string[] | null => (Array.isArray(value) && value.every((entry) => typeof entry === "string") ? (value as string[]) : null);
const fraction = (value: Py | undefined): number | null => (Array.isArray(value) && value[0] === "fraction" && typeof value[1] === "number" && value[1] >= 0 && value[1] <= 1 ? value[1] : null);

function readMiddleware(piece: string): { helper?: Helper; setInCode?: string } {
  const name = /^([A-Za-z_][\w.]*)\s*\(/.exec(piece)?.[1]?.split(".").pop() ?? "";
  const match = MIDDLEWARE.exec(name);
  if (!match) return { setInCode: name ? undefined : undefined };
  let call: Py;
  try {
    call = new PyReader(piece, 0, MIDDLEWARE).value();
  } catch (error) {
    if (error instanceof NotLiteral) return { setInCode: `${name}` };
    throw error;
  }
  if (!isCall(call)) return { setInCode: name };
  if (match[1] === "Summarization") {
    const model = arg(call, ["model"], 0);
    const at = fraction(arg(call, ["trigger"]));
    const keep = fraction(arg(call, ["keep"]));
    if ((arg(call, ["trigger"]) !== undefined && at === null) || (arg(call, ["keep"]) !== undefined && keep === null)) return { setInCode: name };
    return { helper: { provider: "scaledown", job: "summarize", ...(typeof model === "string" ? { model } : null), ...(at !== null || keep !== null ? { trigger: { ...(at !== null ? { at } : null), ...(keep !== null ? { keep } : null) } } : null) } };
  }
  if (match[1] === "ToolCompression") {
    const given = arg(call, ["tools", "tool_names"], 0);
    const tools = given === undefined ? [] : asStrings(given);
    return tools === null ? { setInCode: name } : { helper: { provider: "scaledown", job: "compress", ...(tools.length ? { tools } : null) } };
  }
  const fields = asStrings(arg(call, ["fields"], 0));
  return fields && fields.length ? { helper: { provider: "scaledown", job: "extract", fields } } : { setInCode: name };
}

/** An `@after_model` classifier: its labels and the threshold, only when both are written as literals beside it. */
function readClassifier(text: string): { helper?: Helper; setInCode?: string } | null {
  const at = text.search(/@after_model\b/);
  if (at < 0) return null;
  const rest = text.slice(at);
  const labels = /\blabels\s*=\s*(\[[^\]]*\])/i.exec(rest)?.[1];
  const threshold = /\b(?:threshold|stop_at|stop_threshold)\s*=\s*(\d*\.?\d+)/i.exec(rest)?.[1] ?? /\bscore\s*>=?\s*(\d*\.?\d+)/i.exec(rest)?.[1];
  let list: string[] | null = null;
  if (labels) {
    try {
      list = asStrings(new PyReader(labels, 0).value());
    } catch {
      list = null;
    }
  }
  const stopAt = threshold !== undefined ? Number(threshold) : null;
  if (list && list.length && stopAt !== null && stopAt >= 0 && stopAt <= 1) return { helper: { provider: "scaledown", job: "classify", labels: list, stopAt } };
  return { setInCode: "after_model classifier" };
}

/** Read a `create_deep_agent(...)` call (and the classifier beside it) from code or pasted text. Pure: nothing is run. */
export function readHelpersFromCode(text: string): HelpersRead {
  const start = /\bcreate_deep_agent\s*\(/.exec(text);
  if (!start) return { found: false, tools: [], helpers: [], setInCode: [] };
  const open = start.index + start[0].length - 1;
  const close = matchBracket(text, open);
  const inside = text.slice(open + 1, close < 0 ? text.length : close);
  const out: HelpersRead = { found: true, tools: [], helpers: [], setInCode: [] };
  for (const piece of splitTopLevel(inside)) {
    const kw = /^([A-Za-z_]\w*)\s*=(?!=)\s*([\s\S]*)$/.exec(piece);
    const key = kw?.[1] ?? "";
    const value = kw?.[2] ?? piece;
    if (key === "model") {
      try {
        const v = new PyReader(value, 0).value();
        if (typeof v === "string") out.model = v;
        else out.setInCode.push("model");
      } catch {
        out.setInCode.push("model");
      }
    } else if (key === "tools") {
      const list = /^\[([\s\S]*)\]$/.exec(value.trim());
      if (list) {
        for (const entry of splitTopLevel(list[1])) {
          if (/^[A-Za-z_][\w.]*$/.test(entry)) out.tools.push(entry.split(".").pop() as string);
          else out.setInCode.push("a tool");
        }
      } else out.setInCode.push("tools");
    } else if (key === "middleware") {
      const list = /^\[([\s\S]*)\]$/.exec(value.trim());
      if (!list) {
        out.setInCode.push("middleware");
        continue;
      }
      for (const entry of splitTopLevel(list[1])) {
        if (/^Scaledown\w*Middleware\b/.test(entry) || /\.Scaledown\w*Middleware\b/.test(entry)) {
          const read = readMiddleware(entry);
          if (read.helper) out.helpers.push(read.helper);
          else if (read.setInCode) out.setInCode.push(read.setInCode);
        } else if (/^[A-Za-z_]\w*$/.test(entry)) {
          // A bare name: the classifier function when it is decorated, else something set elsewhere.
          if (!new RegExp(`@after_model[\\s\\S]{0,40}def\\s+${entry}\\b`).test(text)) out.setInCode.push(entry);
        } else out.setInCode.push("middleware");
      }
    }
  }
  const classifier = readClassifier(text);
  if (classifier?.helper) out.helpers.push(classifier.helper);
  else if (classifier?.setInCode) out.setInCode.push(classifier.setInCode);
  out.helpers = out.helpers.slice(0, HELPERS_MAX);
  out.tools = [...new Set(out.tools)];
  out.setInCode = [...new Set(out.setInCode)];
  return out;
}

// --- what an agent's tile hands to Copy ----------------------------------------

import { toolFor } from "@/lib/tools/registry";
import type { Step } from "./graph";

/** The agent as the starting-point writer reads it. `names` gives the tools' names by node id. */
export function agentSpecOf(step: Pick<Step, "title" | "defaultTitle" | "model" | "harness" | "toolRefs" | "text" | "helpers">, names: Readonly<Record<string, string>> = {}): AgentSpec {
  return {
    name: step.title,
    model: step.model ?? "",
    harness: step.harness ? (toolFor(step.harness)?.id ?? step.harness) : null,
    tools: (step.toolRefs ?? []).map((id) => names[id]).filter((name): name is string => Boolean(name)),
    instructions: step.text,
    helpers: step.helpers ?? [],
  };
}

/** The Code tiles an agent is defined in, as they exist in the build. */
export function definedInTiles(step: Pick<Step, "definedIn">, parts: readonly Pick<Step, "id" | "kind" | "text" | "filename" | "title" | "defaultTitle">[]): { id: string; name: string; text: string }[] {
  return (step.definedIn ?? []).flatMap((id) => {
    const tile = parts.find((part) => part.id === id && part.kind === "code");
    return tile ? [{ id, name: tile.filename ?? tile.title ?? tile.defaultTitle, text: tile.text }] : [];
  });
}

/** What a Code tile says of the agents it defines: "Defines agent 'Kitchen agent'". */
export function definesOf(codeId: string, steps: readonly Pick<Step, "id" | "kind" | "title" | "defaultTitle" | "definedIn">[]): { id: string; label: string }[] {
  return steps.flatMap((step) => (step.kind === "agent" && step.definedIn?.includes(codeId) ? [{ id: step.id, label: `Defines agent '${step.title ?? step.defaultTitle}'` }] : []));
}
