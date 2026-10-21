// CA-13 Part 14: "What you need", worked out from the build: the accounts, keys and installs a reader needs to copy what the
// maker built. Each entry is listed once, however many steps need it. Keys are only NAMED, never shown or stored. Install
// commands are the maker's to give, exactly as given: the site never invents a package name.

import { apiOf } from "./answerShape";
import type { SessionGroup, Step } from "./graph";
import { isTypeSafe } from "./decision";

export interface RuntimeNeed {
  /** What a reader needs: "A TypeSafe account and API key (TYPESAFE_API_KEY). Jev is in early access." */
  title: string;
  /** The steps that need it, by number. */
  steps: string[];
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children.filter((child) => !child.id.endsWith(":instructions"))), ...flatten(step.sentWith ?? [])]);

export const NEEDS = {
  typesafe: "A TypeSafe account and API key (`TYPESAFE_API_KEY`). Jev is in early access.",
  deepAgents: "Python with LangChain Deep Agents",
  scaledown: "A ScaleDown key (`SCALEDOWN_API_KEY`), or a LangSmith key through its gateway",
  langsmith: "LangSmith, if you want traces like the original's",
  apiKey: (provider: string) => `An API key for ${provider}`,
  install: (line: string) => `Install: ${line}`,
} as const;

const API_NAME = { claude: "Claude", openai: "OpenAI", gemini: "Gemini" } as const;

/** The needs of a build, in the order the prompt lists them, each once, with the steps that need it. */
export function runtimeNeeds(steps: readonly Step[], groups: readonly SessionGroup[] = []): RuntimeNeed[] {
  const all = flatten(steps);
  const order: string[] = [];
  const needs = new Map<string, Set<string>>();
  const add = (title: string, step?: Step) => {
    if (!needs.has(title)) {
      needs.set(title, new Set());
      order.push(title);
    }
    if (step?.number) needs.get(title)?.add(step.number);
  };
  for (const step of all) if (step.kind === "decision" && step.decision && isTypeSafe(step.decision.provider)) add(NEEDS.typesafe, step);
  for (const step of all) if (step.kind === "agent" && step.harness && /deep ?agents/i.test(step.harness)) add(NEEDS.deepAgents, step);
  for (const step of all) if (step.kind === "agent" && step.helpers?.some((helper) => /scaledown/i.test(helper.provider))) add(NEEDS.scaledown, step);
  for (const step of all) if (step.traceUrl) add(NEEDS.langsmith, step);
  if (groups.some((group) => group.extras?.traceUrl)) add(NEEDS.langsmith);
  for (const step of all) {
    const api = step.outputShape ? apiOf(step.outputShape.where) : null;
    if (api) add(NEEDS.apiKey(API_NAME[api]), step);
  }
  for (const step of all) {
    const line = step.kind === "decision" ? step.decision?.install : step.install;
    if (line) add(NEEDS.install(line), step);
  }
  return order.map((title) => ({ title, steps: [...(needs.get(title) ?? [])] }));
}

/** The keys named by the build, for `.env.example`: one line each, with an empty value. */
export function envKeys(steps: readonly Step[]): string[] {
  const titles = runtimeNeeds(steps).map((need) => need.title);
  return [titles.includes(NEEDS.typesafe) ? "TYPESAFE_API_KEY" : null, titles.includes(NEEDS.scaledown) ? "SCALEDOWN_API_KEY" : null].filter((key): key is string => key !== null);
}
