// CA-15 P10: what every tile says about itself, as words: its type line, and the facts of its footer.
//
// A tile reads as a header (its number, its type line and its title), a body of at most two lines of the thing itself, and a
// footer of at most three facts in one mono line, with at most one text link beside it. These two functions are the words of
// the first and the last. They are pure, and shared by the composer's List and by readers, so both say the same.
//
// A fact that does not exist is left out: never an empty fact, and never a zero ("0 variables"). Optional detail appears on a
// tile only as one of these counted facts, where it is useful; the rest lives in the modal and in Details.

import { modelLabel } from "@/lib/models/registry";
import { toolName } from "@/lib/tools/registry";

import { CONNECTION_LABEL, manualWhereLabel, type Step } from "./graph";
import { formatSize } from "./readerSteps";
import { AGENT_PATTERN_LABEL, CHECK_METHOD_LABEL, variableNamesIn } from "./tileExtras";
import { DATASET_USE_LABEL, REPO_OWNERSHIP_LABEL, licenceLine } from "./sourceTiles";

/** "3 test cases", "1 variable": a count with its noun, or nothing at all for none. */
export const counted = (n: number | null | undefined, one: string, many: string = `${one}s`): string | null => (typeof n === "number" && n > 0 ? `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}` : null);

const LANGUAGE_LABEL: Record<string, string> = { ts: "TypeScript", tsx: "TypeScript (TSX)", js: "JavaScript", jsx: "JavaScript (JSX)", python: "Python", sql: "SQL", json: "JSON", yaml: "YAML", bash: "Bash", html: "HTML", css: "CSS", other: "Other" };
const FILE_WORD = { text: "Text", code: "Code", pdf: "PDF", picture: "Picture", spreadsheet: "Spreadsheet", other: "File" } as const;

const lineCount = (text: string): number => (text.trim() ? text.split(/\r?\n/).length : 0);

/** Parts joined by " · ", leaving out any that are missing. */
const dotted = (...parts: readonly (string | null | undefined | false)[]): string => parts.filter(Boolean).join(" · ");

/** The type line under a tile's number: "Code · TypeScript · 42 lines", "System prompt · Applies to 3 prompts". Always at least the kind's name. */
export function typeLineOf(step: Step): string {
  switch (step.kind) {
    case "prompt":
      return "Prompt";
    case "agent":
      return dotted("Agent", step.model ? modelLabel(step.model) : null);
    case "team":
      return dotted("Multi-agent team", step.pattern ? AGENT_PATTERN_LABEL[step.pattern] : null);
    case "tool":
      return dotted("Tool", step.app?.connection ? CONNECTION_LABEL[step.app.connection] : null);
    case "code": {
      const lines = counted(lineCount(step.text), "line");
      return dotted("Code", step.language ? (LANGUAGE_LABEL[step.language] ?? step.language) : null, lines);
    }
    case "check":
      return "Check";
    case "file":
      return dotted("File", step.fileFacts ? FILE_WORD[step.fileFacts.kind] : null, step.fileFacts ? formatSize(step.fileFacts.size) : null);
    case "manual":
      return dotted("Manual step", step.where ? manualWhereLabel(step.where) : null);
    case "decision": {
      const facts = step.decision;
      const service = facts ? (toolName(facts.provider) ?? facts.provider) : "";
      return dotted("Decision", service || null, facts?.model || null);
    }
    case "system_prompt": {
      const n = step.systemPrompt?.appliesTo ?? 0;
      return dotted("System prompt", `Applies to ${n.toLocaleString("en-GB")} ${n === 1 ? "prompt" : "prompts"}`);
    }
    case "repo":
      return dotted("GitHub repository", step.repo?.ownership ? REPO_OWNERSHIP_LABEL[step.repo.ownership] : null);
    case "dataset":
      return dotted("Dataset", step.dataset?.use ? DATASET_USE_LABEL[step.dataset.use] : null);
    default:
      return "Step";
  }
}

/** The facts of a tile's footer, at most three, each only when it exists. */
export function footerFactsOf(step: Step): string[] {
  const facts: (string | null)[] = [];
  switch (step.kind) {
    case "prompt":
      facts.push(counted(step.words, "word"), counted(variableNamesIn(step.text).length, "variable"));
      break;
    case "code":
      facts.push(step.tool ? (toolName(step.tool) ?? step.tool) : null, step.model ? modelLabel(step.model) : null);
      break;
    case "check":
      facts.push(counted(step.check?.caseList?.length ?? step.check?.cases ?? 0, "test case"), step.check?.method ? CHECK_METHOD_LABEL[step.check.method] : null);
      break;
    case "agent":
      facts.push(counted(step.helpers?.length ?? 0, "supporting model"), counted(step.toolRefs?.length ?? 0, "tool"), counted(step.limits?.length ?? 0, "limit"));
      break;
    case "team":
      facts.push(counted(step.children.length, "agent"));
      break;
    case "tool":
      facts.push(step.app?.permissions ? { read: "Read only", write: "Read and write", delegated: "Acting on your behalf" }[step.app.permissions] : null, counted(step.app?.alternatives?.length ?? 0, "alternative"));
      break;
    case "manual":
      facts.push(counted(step.lines?.length && step.lines.length > 1 ? step.lines.length : 0, "step"), step.mediaId ? "1 screenshot" : null);
      break;
    case "decision":
      facts.push(counted(step.decision?.questions.length ?? 0, "question"), counted(step.decision?.examples?.length ?? 0, "example"));
      break;
    case "system_prompt":
      facts.push(counted(variableNamesIn(step.text).length, "variable"), step.systemPrompt?.version ?? null);
      break;
    case "dataset":
      facts.push(step.dataset?.format ?? null, counted(step.dataset?.columns.length ?? 0, "column"), counted(step.dataset?.recordCount ?? 0, "record"));
      break;
    case "repo": {
      const repo = step.repo;
      const fetched = repo?.fetched;
      const licence = fetched?.fetchedAt ? licenceLine(fetched.licenceSpdx, fetched.licenceName).text.replace(/ · reuse not granted$/, "") : null;
      facts.push(fetched?.language ?? null, licence, repo?.ownership === "third_party" && repo.author ? `Author ${repo.author}` : null);
      break;
    }
    case "file":
      facts.push(step.rows ? counted(step.rows, "row") : null);
      break;
    default:
      break;
  }
  return facts.filter((fact): fact is string => Boolean(fact)).slice(0, 3);
}
