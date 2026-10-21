// CA-13 Part 17: the files a reader needs to run what the maker built, added to the setup download. Pure.
//
// Code tiles at their file names; one JSON per Decision (its questions, never the original's answer as the copier's own);
// the maker's agent as code only when no Code tile defines it; the answer shape's schema where one was given; `.env.example`
// with the key NAMES and empty values; and a README. Never a key value, a trace link, a cost or a run figure.

import { agentSpecOf, agentStartingPoint, definedInTiles, startingPointIsCode } from "./agentCode";
import { envKeys, runtimeNeeds } from "./runtimeNeeds";
import { schemaName } from "./answerShape";
import { checkLine } from "./decision";
import type { Step } from "./graph";
import type { ZipEntry } from "./zip";

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children.filter((child) => !child.id.endsWith(":instructions"))), ...flatten(step.sentWith ?? [])]);

const slug = (name: string): string => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
const safeFile = (name: string): string => name.replace(/[\\/:*?"<>|]+/g, "-").replace(/^\.+$/, "file").trim() || "file";

export interface RuntimeFolder {
  entries: ZipEntry[];
}

export function runtimeFolder(steps: readonly Step[]): RuntimeFolder {
  const encoder = new TextEncoder();
  const all = flatten(steps);
  const entries: ZipEntry[] = [];
  const used = new Set<string>();
  const add = (path: string, text: string) => {
    let at = path;
    for (let n = 2; used.has(at); n += 1) at = path.replace(/(\.[^./]+)?$/, `-${n}$1`);
    used.add(at);
    entries.push({ path: at, data: encoder.encode(text) });
  };
  const files: string[] = [];
  const checks: string[] = [];

  for (const step of all.filter((entry) => entry.kind === "code" && entry.text.trim())) {
    const path = safeFile(step.filename ?? `${slug(step.title ?? step.defaultTitle)}.txt`);
    add(path, step.text.endsWith("\n") ? step.text : `${step.text}\n`);
    files.push(path);
  }

  for (const step of all.filter((entry) => entry.kind === "decision" && entry.decision)) {
    const facts = step.decision!;
    const name = slug(step.title ?? step.defaultTitle);
    // The request is the decision's questions and nothing the maker ran: the original's answer is not a copier's answer.
    const body = { provider: facts.provider, model: facts.model, ...(facts.via ? { via: facts.via } : null), questions: facts.questions };
    add(`decisions/${name}.json`, `${JSON.stringify(body, null, 2)}\n`);
    files.push(`decisions/${name}.json`);
    const known = facts.answer ?? facts.expected;
    if (known) for (const question of facts.questions) if (known[question.id]) checks.push(checkLine(question, known[question.id]));
  }

  for (const step of all.filter((entry) => entry.kind === "agent")) {
    const name = slug(step.title ?? step.defaultTitle);
    const spec = agentSpecOf(step);
    if (definedInTiles(step, all).length === 0 && startingPointIsCode(spec)) {
      add(`agents/${name}.py`, `${agentStartingPoint(spec)}\n`);
      files.push(`agents/${name}.py`);
    }
    if (step.outputShape?.schema) {
      const named = schemaName(step.outputShape.schema);
      const file = `schemas/${slug(named === "JSON" ? name : named)}.schema.json`;
      if (/^\s*[{[]/.test(step.outputShape.schema)) {
        add(file, `${step.outputShape.schema.trim()}\n`);
        files.push(file);
      }
    }
  }

  const keys = envKeys(all);
  if (keys.length > 0) {
    add(".env.example", `${keys.map((key) => `${key}=`).join("\n")}\n`);
    files.push(".env.example");
  }

  const needs = runtimeNeeds(all);
  const readme = [
    "# Run it",
    "",
    ...(needs.length > 0 ? ["## What you need", "", ...needs.map((need) => `- ${need.title}`), ""] : []),
    ...(keys.length > 0 ? ["Copy `.env.example` to `.env` and fill in your own keys. Do not share them.", ""] : []),
    ...(files.length > 0 ? ["## Files", "", ...files.map((file) => `- \`${file}\``), ""] : []),
    ...(checks.length > 0 ? ["## Check against the original", "", ...checks.map((line) => `- ${line}`), ""] : []),
  ];
  add("README.md", `${readme.join("\n")}\n`);
  return { entries };
}
