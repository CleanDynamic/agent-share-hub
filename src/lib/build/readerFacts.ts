// CA-15 P12: what a reader is told of a tile beyond its body: the optional details its maker gave, as label and value.
//
// PURE. Each fact is one the maker filled in; a detail that was not given is not here, so a reader never meets an empty
// row. The labels are the Optional rows' names in the modals and in Details (the tests hold the two together).

import { modelLabel } from "@/lib/models/registry";
import { toolName } from "@/lib/tools/registry";

import type { Step } from "./graph";
import { datasetOf, licenceLine, repoOf, repoDay, REPO_PIN_LABEL, systemPromptOf } from "./sourceTiles";
import { evidenceText } from "./evidenceKinds";
import {
  AGENT_PATTERN_LABEL,
  CHECK_METHOD_LABEL,
  CHECK_REVIEWER_LABEL,
  EFFORT_LABEL,
  SCORING_LABEL,
  TOOL_PERMISSION_LABEL,
  agentExtrasOf,
  checkExtrasOf,
  patternOf,
  settingsOf,
  toolExtrasOf,
  variableNamesIn,
  variablesOf,
} from "./tileExtras";

type Raw = Record<string, unknown>;

export interface ReaderFact {
  label: string;
  /** One line of text. */
  text?: string;
  /** Or a list, one entry per line. */
  lines?: readonly string[];
  /** Set in the data font: a command, a path, a transcript. */
  mono?: boolean;
}

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** The facts, in the order the modal's Optional rows come. Empty when the maker gave none. */
export function readerFacts(step: Pick<Step, "kind" | "text">, payload: Raw | undefined): ReaderFact[] {
  const raw = payload ?? {};
  const out: ReaderFact[] = [];
  const add = (fact: ReaderFact | null) => {
    if (fact && ((fact.text && fact.text.trim()) || (fact.lines && fact.lines.length > 0))) out.push(fact);
  };
  const joined = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

  if (step.kind === "prompt") {
    const settings = settingsOf(raw.settings);
    if (settings) add({ label: "Model settings", text: joined(settings.model ? modelLabel(settings.model) : null, settings.effort !== "default" ? `${EFFORT_LABEL[settings.effort]} effort` : null, settings.instructions) });
    const saved = variablesOf(raw.variables);
    const described = variableNamesIn(step.text).flatMap((name) => {
      const line = saved.find((entry) => entry.name === name)?.description;
      return line ? [`{${name}}: ${line}`] : [];
    });
    add({ label: "Variables", lines: described });
  } else if (step.kind === "agent") {
    const extras = agentExtrasOf(raw);
    add({ label: "Limits", lines: extras.limits ?? [] });
    add({ label: "Output and destination", text: extras.output });
    add({ label: "Sample run", text: extras.sample, mono: true });
  } else if (step.kind === "team") {
    const pattern = patternOf(raw.pattern);
    add({ label: "Orchestration pattern", text: pattern ? AGENT_PATTERN_LABEL[pattern] : "" });
  } else if (step.kind === "check") {
    const extras = checkExtrasOf(raw);
    add({ label: "Test method", text: extras.method ? CHECK_METHOD_LABEL[extras.method] : "" });
    add({ label: "Reviewer", text: extras.reviewer ? CHECK_REVIEWER_LABEL[extras.reviewer] : "" });
    add({ label: "Scoring method", text: extras.scoring ? joined(SCORING_LABEL[extras.scoring.how], extras.scoring.how === "metric" ? extras.scoring.target : null) : "" });
    add({ label: "Model tested", text: extras.modelTested ? joined(extras.modelTested.model, extras.modelTested.version) : "" });
    add({ label: "Evidence", text: evidenceText(extras.evidence) });
  } else if (step.kind === "tool") {
    const extras = toolExtrasOf(raw);
    add({ label: "Permissions", text: extras.permissions ? TOOL_PERMISSION_LABEL[extras.permissions] : "" });
    add({ label: "Required plan", text: extras.plan });
    add({ label: "Setup steps", lines: extras.setup ?? [] });
    add({ label: "Alternatives", lines: extras.alternatives ?? [] });
  } else if (step.kind === "code") {
    const tool = str(raw.tool);
    add({ label: "File path", text: str(raw.filename), mono: true });
    add({ label: "Generated with", text: joined(tool ? (toolName(tool) ?? tool) : null, str(raw.model)) });
  } else if (step.kind === "system_prompt") {
    const facts = systemPromptOf(raw);
    add({ label: "Model", text: str(raw.model) });
    add({ label: "Version", text: facts.version ?? "" });
    const saved = variablesOf(raw.variables);
    add({ label: "Variables", lines: variableNamesIn(facts.text).flatMap((name) => {
      const line = saved.find((entry) => entry.name === name)?.description;
      return line ? [`{${name}}: ${line}`] : [];
    }) });
  } else if (step.kind === "dataset") {
    const facts = datasetOf(raw);
    add({ label: "Format", text: facts.format ?? "" });
    add({ label: "Record count", text: facts.recordCount === null ? "" : facts.recordCount.toLocaleString("en-GB") });
    add({ label: "Columns", lines: facts.columns, mono: true });
    add({ label: "Source", text: facts.source ?? "" });
    add({ label: "Sample records", lines: facts.sample, mono: true });
    add({ label: "Licence", text: facts.licence ?? "" });
    if (facts.use === "retrieval") add({ label: "Chunking", text: joined(facts.chunkStrategy, facts.chunkSize === null ? null : `size ${facts.chunkSize}`, facts.chunkOverlap === null ? null : `overlap ${facts.chunkOverlap}`, facts.embeddingModel) });
  } else if (step.kind === "repo") {
    const facts = repoOf(raw);
    if (facts) {
      add({ label: "Pinned version", text: facts.pin ? `${REPO_PIN_LABEL[facts.pin.kind]} ${facts.pin.value}` : "", mono: true });
      add({ label: "Path", text: facts.path ?? "", mono: true });
      if (facts.ownership === "third_party") add({ label: "Modifications", text: facts.modifications ?? "" });
      add({ label: "Key files", lines: facts.keyFiles, mono: true });
      add({ label: "Run instructions", lines: facts.run, mono: true });
    }
  }
  return out;
}

/** What GitHub said of a repository, as lines a reader can read: language, licence and last commit. Empty until it was retrieved. */
export function repoRetrievedLines(payload: Raw | undefined): ReaderFact[] {
  const facts = repoOf(payload ?? {});
  if (!facts || !facts.fetched.fetchedAt) return [];
  const licence = licenceLine(facts.fetched.licenceSpdx, facts.fetched.licenceName);
  const out: ReaderFact[] = [];
  if (facts.fetched.language) out.push({ label: "Primary language", text: facts.fetched.language });
  out.push({ label: "Licence", text: licence.reuse ? `${licence.text} · ${licence.reuse}` : licence.text });
  if (facts.fetched.pushedAt) out.push({ label: "Last commit", text: repoDay(facts.fetched.pushedAt) });
  return out;
}
