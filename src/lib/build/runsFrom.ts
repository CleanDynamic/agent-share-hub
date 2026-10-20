// CA-04 P6 — a session that ran from a script or GitHub: what a command or a workflow file says, read plainly.
//
// PURE. Two readers, and both decline rather than guess:
//   - `claudePromptOf`: a pasted command that starts `claude -p` or `claude --print` names its prompt in quotes; that
//     text, exactly, is the prompt. The command is kept as written by its caller.
//   - `readWorkflow`: a GitHub workflow that uses anthropics/claude-code-action. A small line reader, no YAML: the
//     event names under `on:` (and an event's `types:` when it lists them on one line) and the `prompt:` value when
//     it is one line. Anything else it meets where it reads (a flow mapping, an anchor, a block scalar, a list it
//     cannot place) makes that field null: the file is kept and the field left for the maker.

/** The quoted prompt of a `claude -p` / `claude --print` command, exactly; null when the command is not one or names none in quotes. */
export function claudePromptOf(command: string): string | null {
  const match = /^\s*claude\s+(?:-p|--print)\b\s*/.exec(command);
  if (!match) return null;
  const rest = command.slice(match[0].length);
  // The first quoted argument after the flag, single or double quotes; a double-quoted one may escape its quote.
  const quoted = /^(?:(?:--?[\w-]+(?:[ =](?![-"'])\S+)?)\s+)*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')/.exec(rest);
  if (!quoted) return null;
  const text = quoted[1] !== undefined ? quoted[1].replace(/\\(["\\$`])/g, "$1") : quoted[2];
  return text.trim() ? text : null;
}

export interface WorkflowEvent {
  name: string;
  /** The event's activity types when listed on one line ("opened"); empty when it lists none. */
  types: string[];
}

export interface WorkflowReading {
  /** The events under `on:`; null when the reader is not sure of them. */
  events: WorkflowEvent[] | null;
  /** The action's `prompt:` when it is one plain line; null otherwise. */
  prompt: string | null;
}

export const CLAUDE_ACTION = "anthropics/claude-code-action";

/** Whether a workflow file's text uses Claude Code's GitHub action. */
export const usesClaudeAction = (text: string): boolean => text.includes(CLAUDE_ACTION);

const PLAIN = /^[A-Za-z_][\w-]*$/;

const unquote = (value: string): string | null => {
  const text = value.trim();
  if (/^"(?:[^"\\]|\\.)*"$/.test(text)) return text.slice(1, -1).replace(/\\(.)/g, "$1");
  if (/^'(?:[^']|'')*'$/.test(text)) return text.slice(1, -1).replace(/''/g, "'");
  if (/^[|>]/.test(text) || /^[&*!{[]/.test(text)) return null;
  return text.replace(/\s+#.*$/, "") || null;
};

/** A one-line list ("[opened, synchronize]") or a single word; null for anything else. */
function oneLineList(value: string): string[] | null {
  const text = value.replace(/\s+#.*$/, "").trim();
  if (!text) return null;
  if (text.startsWith("[")) {
    if (!text.endsWith("]")) return null;
    const items = text.slice(1, -1).split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    return items.every((item) => PLAIN.test(item)) ? items : null;
  }
  const word = text.replace(/^["']|["']$/g, "");
  return PLAIN.test(word) ? [word] : null;
}

const indentOf = (line: string) => line.length - line.trimStart().length;

function readEvents(lines: readonly string[]): WorkflowEvent[] | null {
  const at = lines.findIndex((line) => /^(on|"on"|'on'):/.test(line));
  if (at < 0) return null;
  const inline = lines[at].replace(/^(on|"on"|'on'):/, "");
  if (inline.trim() && !inline.trim().startsWith("#")) {
    const names = oneLineList(inline);
    return names ? names.map((name) => ({ name, types: [] })) : null;
  }
  const events: WorkflowEvent[] = [];
  let eventIndent: number | null = null;
  for (let i = at + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = indentOf(line);
    if (indent === 0) break;
    const body = line.trim();
    if (eventIndent === null) eventIndent = indent;
    if (indent === eventIndent) {
      const key = /^([A-Za-z_][\w-]*):(.*)$/.exec(body);
      if (!key) return null;
      const rest = key[2].replace(/\s+#.*$/, "").trim();
      if (rest && rest !== "{}" && rest !== "null" && rest !== "~") return null;
      events.push({ name: key[1], types: [] });
      continue;
    }
    if (indent < eventIndent) return null;
    // Inside an event: only `types:` on one line is read; branch and path filters are passed over as they are.
    const current = events[events.length - 1];
    if (!current) return null;
    const types = /^types:(.*)$/.exec(body);
    if (types) {
      const list = oneLineList(types[1]);
      if (!list) return null;
      current.types = list;
    }
  }
  return events.length > 0 ? events : null;
}

function readPrompt(lines: readonly string[]): string | null {
  const found = lines.filter((line) => /^\s*prompt:/.test(line));
  if (found.length !== 1) return null;
  return unquote(found[0].replace(/^\s*prompt:/, ""));
}

/** What a workflow file that uses Claude Code's action says, read plainly; null for one that does not use it. */
export function readWorkflow(text: string): WorkflowReading | null {
  if (!usesClaudeAction(text)) return null;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  // Anchors and aliases can move what a line means: not sure of anything then.
  if (lines.some((line) => /(^|\s)[&*][A-Za-z]/.test(line.replace(/["'][^"']*["']/g, "")) && !line.trim().startsWith("#"))) return { events: null, prompt: null };
  return { events: readEvents(lines), prompt: readPrompt(lines) };
}

const EVENT_WORDS: Record<string, string> = {
  push: "code is pushed",
  pull_request: "a pull request changes",
  pull_request_target: "a pull request changes",
  pull_request_review: "a pull request is reviewed",
  pull_request_review_comment: "someone comments on a pull request's code",
  issue_comment: "someone comments on an issue or a pull request",
  issues: "an issue changes",
  schedule: "on a schedule",
  workflow_dispatch: "someone starts it by hand",
};

const TYPED: Record<string, Record<string, string>> = {
  pull_request: { opened: "a pull request is opened", synchronize: "a pull request gets new commits", reopened: "a pull request is reopened", closed: "a pull request is closed", labeled: "a pull request is labelled" },
  pull_request_target: { opened: "a pull request is opened", synchronize: "a pull request gets new commits" },
  issues: { opened: "an issue is opened", assigned: "an issue is assigned", labeled: "an issue is labelled", closed: "an issue is closed" },
  issue_comment: { created: "someone comments on an issue or a pull request" },
  pull_request_review_comment: { created: "someone comments on a pull request's code" },
  pull_request_review: { submitted: "a pull request is reviewed" },
};

/** One event in plain words; an event the list does not know reads as its name as written. */
export function eventWords(event: WorkflowEvent): string {
  const typed = event.types.map((type) => TYPED[event.name]?.[type] ?? null);
  if (event.types.length > 0 && typed.every(Boolean)) return [...new Set(typed as string[])].join(" or ");
  return EVENT_WORDS[event.name] ?? event.name;
}

/** "Runs when a pull request is opened or someone comments on an issue or a pull request". */
export function runsWhenLine(events: readonly WorkflowEvent[]): string {
  return `Runs when ${[...new Set(events.map(eventWords))].join(" or ")}`;
}
