// SV-29 P8: the pipeline and the eval harness, as lines of the setup prompt. Pure; no model call: the same build gives the same text.
//
// In this order, each line left out when it has nothing to say:
//   Retrieval   Build a vector index of <corpus> with <embedding model>; return the top <k>.
//   Decision    Ask <model> to choose one label from those candidates; return a confidence. Then the low-confidence rule.
//   Eval harness  where the test cases come from; the failures to read first; one line per grader; runs per case; the CI gate and the
//                 rules it dropped
//   Results to beat  the chosen row's metric and cost, each rejected row with its reason, and the newest run
//
// Money is written only when the caller says readers see it (`showCost`).

import { toolName } from "@/lib/tools/registry";

import { costWords, metricName, metricValue, OUTCOME_LABEL, DRAWN_FROM_LABEL } from "./comparison";
import { modelShort, type DecisionQuestion } from "./decision";
import { gateRuleClause, graderInstruction, GATE_ON_LABEL, runsOfCasesLine } from "./evalHarness";
import type { Step } from "./graph";
import { selectionLabel, adaptationLine, labelSetLine } from "./pipelineFields";
import { corpusText } from "./retrieval";

const sentence = (line: string): string => {
  const said = line.trim();
  return said && !/[.!?:]$/.test(said) ? `${said}.` : said;
};
const lowerFirst = (line: string): string => (/^([A-Z][a-z]|A\b)/.test(line) && !/^[A-Z][a-z]*[A-Z]/.test(line) ? line.charAt(0).toLowerCase() + line.slice(1) : line);

/** What a question asks the model to do with the candidates. */
function askFor(question: DecisionQuestion | undefined, hasCandidates: boolean): string {
  const from = hasCandidates ? " from those candidates" : "";
  if (!question || question.type === "choice") return `choose one label${from}`;
  if (question.type === "multi") return `choose every label that applies${from}`;
  if (question.type === "rank") return `put the labels in order${from}`;
  if (question.type === "yesno") return "answer yes or no";
  if (question.type === "score") return "give a score";
  return "pull out the value";
}

const droppedAsWords = (rule: string): string => `Don't ${lowerFirst(rule.replace(/[.\s]+$/, "")).replace(/,\s+((?:one|two|three|four|five|\d+)\s+runs?)$/i, " from $1")}`;

/** The Retrieval and Decision lines of the pipeline, in the order of the List. */
function runtimeLines(steps: readonly Step[]): string[] {
  const lines: string[] = [];
  for (const step of steps) {
    if (step.kind === "retrieval" && step.retrieval) {
      const r = step.retrieval;
      const what = r.corpus ?? "the items to search";
      lines.push(`Build a vector index of ${what}${r.embeddingModel ? ` with ${r.embeddingModel}` : ""}; return the top ${r.k ?? "k"}.`);
      if (r.query) lines.push(`Build each search from ${lowerFirst(r.query)}.`);
      if (r.hybrid) lines.push("Also run a keyword search over the same items.");
    }
    if (step.kind === "decision" && step.decision) {
      const d = step.decision;
      lines.push(`Ask ${modelShort(d.provider, d.model)} to ${askFor(d.questions[0], Boolean(d.candidatesFrom))}; return a confidence.`);
      if (d.labelSet) lines.push(sentence(labelSetLine(d.labelSet).replace(/^Label set:/, "The label set is")));
      if (d.selection) lines.push(sentence(`Cover the label set this way: ${lowerFirst(selectionLabel(d.selection))}`));
      if (d.adaptation) lines.push(sentence(adaptationLine(d.adaptation)));
      if (d.lowConfidence) lines.push("threshold" in d.lowConfidence ? `When confidence is below ${d.lowConfidence.threshold}, don't trust the answer.` : "When it is not confident, pass the decision to a person.");
      for (const limit of d.knownLimits ?? []) lines.push(sentence(`Known limit: ${limit}`));
    }
  }
  return lines;
}

/** The eval harness lines of one Check, in their order. */
function harnessLines(check: Step): string[] {
  const c = check.check;
  if (!c) return [];
  const lines: string[] = [];
  const set = c.comparison?.testSet;
  const cases = c.caseList ?? [];
  if (set?.drawnFrom || set?.file) {
    const from = set.drawnFrom ? DRAWN_FROM_LABEL[set.drawnFrom].toLowerCase() : "the cases you trust";
    const tag = set.traceTag ? ` (tag ${set.traceTag})` : "";
    const rule = cases.some((entry) => entry.rule) ? " and the rule behind it" : "";
    lines.push(`Collect test cases from ${from}${tag}${set.file ? ` into ${set.file}` : ""}, each with the expected answer${rule}.`);
  }
  const types = (c.harness?.failureTypesWritten ?? []).filter((type) => type.fixIn !== "people");
  if (types.length > 0) lines.push(`Read the failures first. The maker found: ${types.map((type) => `${type.name} (${type.count} of ${type.read})`).join(", ")}.`);
  for (const type of (c.harness?.failureTypes ?? []).filter((entry) => entry.fixIn === "people" && entry.note)) lines.push(`Ask a person to decide: ${type.note?.replace(/[.\s]+$/, "")}.`);
  for (const grader of c.harness?.graders ?? []) lines.push(graderInstruction(grader, c.harness?.judgeModel, c.harness?.framework ? (toolName(c.harness.framework) ?? c.harness.framework) : undefined));
  if (c.harness?.runsPerCase) lines.push(`Run each case ${c.harness.runsPerCase} times. Treat mixed results as flaky and read them before trusting a score.`);
  const gate = c.harness?.gate;
  if (gate) {
    lines.push(`Add a CI gate in ${toolName(gate.runsIn) ?? gate.runsIn} ${GATE_ON_LABEL[gate.on]}${gate.paths ? ` for changes to ${gate.paths}` : ""} that ${gateRuleClause(gate).replace(", over", " over")}. ${gate.missingResultFails ? "Treat a missing result as a failure." : ""}`.trim());
    for (const dropped of gate.rejected) lines.push(`${droppedAsWords(dropped.rule)}${dropped.why ? `: ${lowerFirst(dropped.why.replace(/[.\s]+$/, ""))}` : ""}.`);
  }
  return lines;
}

/** Results to beat: the chosen row's metric and cost, each rejected row with its reason, and the newest run. */
function resultsToBeat(checks: readonly Step[], showCost: boolean, noun: string): string[] {
  const lines: string[] = [];
  for (const check of checks) {
    const c = check.check;
    const comparison = c?.comparison;
    const metric = comparison?.metric ? metricName(comparison.metric) : "Result";
    for (const row of comparison?.rows ?? []) {
      if (row.outcome === "chosen") lines.push(`Chosen: ${row.label}: ${metric} ${row.value ? metricValue(row.value.value) : "not measured"}${showCost && row.costPerItem ? `, ${costWords(row.costPerItem, noun)}` : ""}.`);
    }
    for (const row of comparison?.rows ?? []) {
      if (row.outcome === "rejected" || row.outcome === "ruled out") lines.push(`${OUTCOME_LABEL[row.outcome]}: ${row.label}${row.value ? ` (${metric} ${metricValue(row.value.value)})` : ""}: ${(row.reason ?? "").replace(/[.\s]+$/, "")}.`);
    }
    const newest = c?.runs?.find((run) => run.id) ?? null;
    if (newest) lines.push(`Newest run: ${newest.id}, ${c?.casesPerRun && c.runsPerCase ? runsOfCasesLine(newest.passed, c.casesPerRun, c.runsPerCase) : `${newest.passed} of ${newest.total}`}${newest.changed ? ` (${lowerFirst(newest.changed)})` : ""}.`);
  }
  return lines.length > 0 ? ["Results to beat:", ...lines.map((line) => `- ${line}`)] : [];
}

/** Whether the build has a pipeline or an eval harness worth a setup prompt of its own. */
export function hasPipelineSetup(steps: readonly Step[]): boolean {
  return steps.some((step) => step.kind === "retrieval" || (step.kind === "decision" && step.decision) || (step.kind === "check" && (step.check?.comparison?.rows.length || step.check?.harness)));
}

/** The pipeline's sections for the setup prompt: runtime lines, the eval harness, then Results to beat. Each a block of lines. */
export function pipelineSections(steps: readonly Step[], options: { showCost?: boolean } = {}): string[] {
  const top = steps.filter((step) => step.kind === "retrieval" || step.kind === "decision" || step.kind === "check");
  const noun = steps.find((step) => step.runCost?.itemNoun)?.runCost?.itemNoun ?? "item";
  const checks = top.filter((step) => step.kind === "check" && (step.check?.comparison || step.check?.harness));
  const sections: string[] = [];
  const runtime = runtimeLines(top.filter((step) => step.kind !== "check"));
  if (runtime.length > 0) sections.push(runtime.join("\n"));
  for (const check of checks) {
    const lines = harnessLines(check);
    if (lines.length > 0) sections.push(lines.join("\n"));
  }
  const beat = resultsToBeat(checks, options.showCost === true, noun);
  if (beat.length > 0) sections.push(beat.join("\n"));
  return sections;
}
