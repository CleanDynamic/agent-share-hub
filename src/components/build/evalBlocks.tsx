/* SV-29 P3, P4: what a Check shows beyond its status: a comparison of approaches (the test set, a table sorted by the metric with the
   chosen row first, and an accuracy-against-cost chart) and, from Part 4, its eval harness. Drawn once for the build page and the
   composer's Details. Every figure carries its source ("From the run", "Maker's figure", or on a copy "The original measured").

   PURE: it takes the facts `buildSteps` already makes. The chart is drawn in SVG, hidden from screen readers, and its group carries
   a text summary. No motion. */

import type { CSSProperties } from "react";

import { chartPoints, chartSummary, costWords, designLine, figureSourceWord, metricName, metricValue, OUTCOME_LABEL, ROW_KIND_LABEL, sortedRows, testSetLine, type Comparison } from "@/lib/build/comparison";
import type { CheckFacts } from "@/lib/build/graph";
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
      <span style={text(13, 500, t.text)}>{COMPARISON_COPY.title}{check.fromOriginal ? ` · ${COMPARISON_COPY.original}` : ""}</span>
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
