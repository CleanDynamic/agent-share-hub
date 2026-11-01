/* SV-29 P3, P4: what a Check shows beyond its status: a comparison of approaches (the test set, a table sorted by the metric with the
   chosen row first, and an accuracy-against-cost chart) and, from Part 4, its eval harness. Drawn once for the build page and the
   composer's Details. Every figure carries its source ("From the run", "Maker's figure", or on a copy "The original measured").

   PURE: it takes the facts `buildSteps` already makes. The chart is drawn in SVG, hidden from screen readers, and its group carries
   a text summary. No motion. */

import type { CSSProperties } from "react";

import { chartPoints, chartSummary, costWords, designLine, figureSourceWord, metricName, metricValue, OUTCOME_LABEL, ROW_KIND_LABEL, sortedRows, testSetLine, type Comparison } from "@/lib/build/comparison";
import { checkDay, type CheckFacts, type CheckCase } from "@/lib/build/graph";
import { FIX_IN_LABEL, failureCountLine, gateDroppedLines, gateLine, graderLine, harnessSourceWord, needsDecisionLine, runHistoryLine, stabilityLine, validatedLine } from "@/lib/build/evalHarness";
import { testSetSourceLine } from "@/lib/build/comparison";
import { money } from "@/lib/build/cost";
import { toolName } from "@/lib/tools/registry";
import { text } from "@/pages/site/compose/refinedStyles";
import { t } from "@/lib/theme/tokens";

const CELL: CSSProperties = { padding: "8px 8px 8px 0", verticalAlign: "top", textAlign: "left", borderTop: `1px solid ${t.hairline}`, overflowWrap: "anywhere" };

export const COMPARISON_COPY = {
  title: "Comparison of approaches",
  original: "The original measured",
  approach: "Approach",
  value: "Result",
  cost: "Cost per item",
  outcome: "Outcome",
  chart: "Result against cost per item",
} as const;

/** The chart: result on the vertical axis, cost per item on a log scale across. Hidden from screen readers; the text summary stands for it. */
function CostChart({ comparison }: { comparison: Comparison }) {
  const points = chartPoints(comparison.rows);
  if (points.length < 2) return null;
  const W = 320;
  const H = 150;
  const pad = { l: 36, r: 12, t: 10, b: 28 };
  const costs = points.map((p) => Math.log10(Math.max(p.cost, 1e-9)));
  const lo = Math.min(...costs);
  const hi = Math.max(...costs);
  const values = points.map((p) => p.value);
  const vLo = Math.min(...values);
  const vHi = Math.max(...values);
  const x = (cost: number) => pad.l + ((Math.log10(Math.max(cost, 1e-9)) - lo) / Math.max(hi - lo, 1e-9)) * (W - pad.l - pad.r);
  const y = (value: number) => H - pad.b - ((value - vLo) / Math.max(vHi - vLo, 1e-9)) * (H - pad.t - pad.b);
  const sign = points[0].currency === "USD" ? "$" : "£";
  return (
    <div role="group" aria-label={chartSummary(comparison.rows, comparison.metric ?? null)} data-testid="comparison-chart" style={{ marginTop: 12 }}>
      <span style={text(12, 400, t.label)}>{COMPARISON_COPY.chart}</span>
      <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxWidth: 420, marginTop: 6 }}>
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke={t.line} strokeWidth={1} />
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke={t.line} strokeWidth={1} />
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={x(p.cost)} cy={y(p.value)} r={5} fill={p.outcome === "chosen" ? t.evidence : t.label} />
            <text x={x(p.cost)} y={y(p.value) - 8} textAnchor="middle" fontSize={10} fill={t.text2} style={{ fontVariantNumeric: "tabular-nums" }}>
              {metricValue(p.value)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 8} fontSize={10} fill={t.label}>{`${sign}${Math.min(...points.map((p) => p.cost))}`}</text>
        <text x={W - pad.r} y={H - 8} textAnchor="end" fontSize={10} fill={t.label}>{`${sign}${Math.max(...points.map((p) => p.cost))}`}</text>
      </svg>
    </div>
  );
}

/** The comparison: its test set, a table (chosen row first, then by the metric) and the chart. */
export function ComparisonBlock({ check, indent = 0 }: { check: CheckFacts; indent?: number }) {
  const comparison = check.comparison;
  if (!comparison || (comparison.rows.length === 0 && !comparison.testSet)) return null;
  const metric = comparison.metric ?? null;
  const rows = sortedRows(comparison.rows, metric);
  return (
    <div data-testid="comparison" style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: indent, minWidth: 0 }}>
      {rows.length > 0 ? <span style={text(13, 500, t.text)}>{COMPARISON_COPY.title}{check.fromOriginal ? ` · ${COMPARISON_COPY.original}` : ""}</span> : null}
      {comparison.testSet ? <span data-testid="comparison-test-set" style={text(12.5, 400, t.text2)}>{testSetLine(comparison.testSet)}</span> : null}
      {metric ? <span data-testid="comparison-metric" style={text(12.5, 400, t.text2)}>{`Metric: ${metricName(metric)}`}</span> : null}
      {rows.length > 0 ? (
        <table data-testid="comparison-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", ...text(12.5, 400, t.text), fontVariantNumeric: "tabular-nums" }}>
          <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{COMPARISON_COPY.title}</caption>
          <thead>
            <tr>
              <th scope="col" style={{ ...CELL, borderTop: "none", width: "42%", ...text(11.5, 400, t.label) }}>{COMPARISON_COPY.approach}</th>
              <th scope="col" style={{ ...CELL, borderTop: "none", width: "20%", ...text(11.5, 400, t.label) }}>{metric ? metricName(metric) : COMPARISON_COPY.value}</th>
              <th scope="col" style={{ ...CELL, borderTop: "none", width: "20%", ...text(11.5, 400, t.label) }}>{COMPARISON_COPY.cost}</th>
              <th scope="col" style={{ ...CELL, borderTop: "none", ...text(11.5, 400, t.label) }}>{COMPARISON_COPY.outcome}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} data-testid="comparison-row" data-outcome={row.outcome}>
                <th scope="row" style={{ ...CELL, ...text(12.5, row.outcome === "chosen" ? 500 : 400, t.text) }}>
                  {row.label}
                  <span style={{ display: "block", ...text(11.5, 400, t.label) }}>{ROW_KIND_LABEL[row.kind]}</span>
                  {row.reason ? <span data-testid="comparison-reason" style={{ display: "block", ...text(12, 400, t.text2) }}>{row.reason}</span> : null}
                </th>
                <td style={CELL}>
                  {row.value ? metricValue(row.value.value) : ""}
                  {row.value ? <span style={{ display: "block", ...text(11.5, 400, t.label) }}>{figureSourceWord(row.value.source)}</span> : null}
                </td>
                <td style={CELL}>
                  {row.costPerItem ? costWords(row.costPerItem) : ""}
                  {row.costPerItem ? <span style={{ display: "block", ...text(11.5, 400, t.label) }}>{figureSourceWord(row.costPerItem.source)}</span> : null}
                </td>
                <td style={{ ...CELL, ...text(12.5, row.outcome === "chosen" ? 500 : 400, row.outcome === "chosen" || row.outcome === "confirmed" ? t.evidence : row.outcome ? t.text2 : t.label) }}>{row.outcome ? OUTCOME_LABEL[row.outcome] : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <CostChart comparison={comparison} />
      {comparison.design ? <span data-testid="comparison-design" style={text(12.5, 400, t.text2)}>{designLine(comparison.design)}</span> : null}
    </div>
  );
}

export const HARNESS_COPY = {
  title: "Eval harness",
  original: "The original measured",
  example: "Example test case",
  failureTypes: "Failure types",
  graders: "Graders",
  stability: "Across runs",
  history: "Run history",
  fixIn: "Fix in",
  judge: "Judge model",
  framework: "Framework",
  runsPerCase: (n: number) => `Each case run ${n} ${n === 1 ? "time" : "times"}`,
  mixed: "Treat mixed results as flaky and read them before trusting a score.",
} as const;

const SUB: CSSProperties = text(11.5, 400, t.label);

/** The example case in full: what went in, what was expected, the rule behind it and the failure it showed. */
function ExampleCase({ entry }: { entry: CheckCase }) {
  return (
    <div data-testid="harness-example" style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 12px", border: `1px solid ${t.hairline}`, borderRadius: 6 }}>
      <span style={SUB}>{HARNESS_COPY.example}</span>
      <span style={text(12.5, 400, t.text)}>{entry.input}</span>
      <span style={text(12.5, 400, t.text2)}>{`Expected: ${entry.expected}`}</span>
      {entry.rule ? <span style={text(12.5, 400, t.text2)}>{`Rule: ${entry.rule}`}</span> : null}
      {entry.failure_type ? <span style={text(12.5, 400, t.text2)}>{`Failure type: ${entry.failure_type}`}</span> : null}
    </div>
  );
}

/** What a Check shows of its eval harness: where the cases came from, failure types, graders, runs per case and stability, the run history and the CI gate. */
export function EvalHarnessBlock({ check, indent = 0 }: { check: CheckFacts; indent?: number }) {
  const harness = check.harness;
  const set = check.comparison?.testSet;
  const source = set ? testSetSourceLine(set) : null;
  const example = check.caseList?.find((entry) => entry.example === true);
  const runs = (check.runs ?? []).filter((run) => run.id || run.compare || run.cost || run.minutes !== undefined);
  const stability = stabilityLine(check.stability ?? null);
  if (!harness && !source && !stability && runs.length === 0) return null;
  const original = check.fromOriginal ? ` · ${HARNESS_COPY.original}` : "";
  const gate = harness?.gate;
  return (
    <div data-testid="eval-harness" style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: indent, minWidth: 0 }}>
      <span style={text(13, 500, t.text)}>{HARNESS_COPY.title}</span>
      {source ? <span data-testid="harness-source" style={text(12.5, 400, t.text2)}>{source}</span> : null}
      {example ? <ExampleCase entry={example} /> : null}
      {harness && harness.failureTypes.length > 0 ? (
        <div data-testid="harness-failure-types" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={SUB}>{`${HARNESS_COPY.failureTypes}${original}`}</span>
          {harness.failureTypes.map((type) => (
            <span key={type.name} data-testid="harness-failure-type" style={text(12.5, 400, t.text)}>
              {`${type.name} · ${failureCountLine(type)} · ${HARNESS_COPY.fixIn.toLowerCase()} ${FIX_IN_LABEL[type.fixIn].toLowerCase()}`}
              {needsDecisionLine(type) ? <span style={{ display: "block", ...text(12.5, 400, t.text2) }}>{needsDecisionLine(type)}</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      {harness && harness.graders.length > 0 ? (
        <div data-testid="harness-graders" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={SUB}>{HARNESS_COPY.graders}</span>
          {harness.graders.map((grader) => (
            <span key={grader.name} data-testid="harness-grader" style={text(12.5, 400, t.text)}>
              {graderLine(grader)}
              {grader.criteria ? <span style={{ display: "block", ...text(12, 400, t.text2) }}>{grader.criteria}</span> : null}
              {grader.validated ? <span style={{ display: "block", ...text(12, 400, t.text2) }}>{validatedLine(grader.validated)}</span> : null}
            </span>
          ))}
          {harness.judgeModel ? <span style={text(12, 400, t.text2)}>{`${HARNESS_COPY.judge}: ${harness.judgeModel}`}</span> : null}
          {harness.framework ? <span style={text(12, 400, t.text2)}>{`${HARNESS_COPY.framework}: ${toolName(harness.framework) ?? harness.framework}`}</span> : null}
        </div>
      ) : null}
      {harness?.runsPerCase ? <span data-testid="harness-runs-per-case" style={text(12.5, 400, t.text2)}>{HARNESS_COPY.runsPerCase(harness.runsPerCase)}</span> : null}
      {stability ? <span data-testid="harness-stability" style={text(12.5, 400, t.text2)}>{`${HARNESS_COPY.stability}${original}: ${stability}`}</span> : null}
      {runs.length > 0 ? (
        <div data-testid="harness-history" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={SUB}>{`${HARNESS_COPY.history}${original}`}</span>
          {runs.map((run, index) => (
            <span key={`${run.id ?? run.at}-${index}`} data-testid="harness-run" style={{ ...text(12.5, 400, t.text), fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
              {runHistoryLine(run, checkDay)}
              {run.cost ? <span style={{ display: "block", ...text(12, 400, t.label) }}>{`${money(run.cost.cost, run.cost.currency)} per run · ${harnessSourceWord(run.cost.source)}`}</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      {gate ? (
        <div data-testid="harness-gate" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={text(12.5, 400, t.text)}>{gateLine(gate, (id) => toolName(id) ?? id)}</span>
          {gate.minutes || gate.costPerRun ? <span style={text(12, 400, t.label)}>{[gate.minutes ? harnessSourceWord(gate.minutes.source) : null, gate.costPerRun ? `${money(gate.costPerRun.cost, gate.costPerRun.currency)} per run` : null].filter(Boolean).join(" · ")}</span> : null}
          {gateDroppedLines(gate).map((line) => (
            <span key={line} data-testid="harness-dropped" style={text(12.5, 400, t.text2)}>{line}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
