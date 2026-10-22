/* CA-13 P9 — /b2/:slug/compare/:otherSlug: two builds of the same thing, side by side.

   PURE. Two columns, step by step: steps are matched by kind and order and a step with no match is a gap. The totals sit at the
   top, "to build" and "to run" in separate rows (rule 3): time, tokens, cost, steps and models used. The differences read in plain
   words under the totals. On a phone a switch moves between the two builds' steps, with the totals table always visible. */

import { useState } from "react";
import { Link } from "react-router-dom";

import { Segmented } from "@/components/brand/Segmented";
import { useIsPhone } from "@/components/shell/useMinWidth";
import type { CompareRow, TotalsRow } from "@/lib/build/compare";
import { stepTitle, type Step } from "@/lib/build/graph";
import { t } from "@/lib/theme/tokens";
import { moduleStyle, text, tnum } from "@/pages/site/compose/refinedStyles";

export interface CompareColumn {
  title: string;
  /** The build's own page. */
  to: string;
}

export interface CompareViewProps {
  a: CompareColumn;
  b: CompareColumn;
  rows: readonly CompareRow[];
  totals: readonly TotalsRow[];
  /** "This one used a router and 40% fewer tokens." */
  sentence: string;
}

const KIND: Record<Step["kind"], string> = { prompt: "Prompt", agent: "Agent", team: "Team", manual: "Manual step", code: "Code", check: "Check", file: "File", tool: "Tool", decision: "Decision", system_prompt: "System prompt", dataset: "Dataset", repo: "GitHub repository" };

function Cell({ step }: { step: Step | null }) {
  if (!step) {
    return (
      <div data-testid="compare-gap" style={{ border: `1px dashed ${t.hairline}`, borderRadius: 6, padding: "8px 12px", minHeight: 40, boxSizing: "border-box", ...text(12, 400, t.label) }}>
        No matching step
      </div>
    );
  }
  return (
    <div data-testid="compare-step" style={{ background: t.tile, border: `1px solid ${t.tileBorder}`, borderRadius: 6, padding: "8px 12px", minHeight: 40, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={text(11.5, 400, t.label)}>{KIND[step.kind] ?? "Step"} {step.number}</span>
      <span style={{ ...text(13, 500, t.text), overflowWrap: "anywhere" }}>{stepTitle(step)}</span>
    </div>
  );
}

export function CompareView({ a, b, rows, totals, sentence }: CompareViewProps) {
  const phone = useIsPhone();
  const [side, setSide] = useState<"a" | "b">("a");
  const head = (column: CompareColumn) => (
    <Link to={column.to} style={{ ...text(14, 500, t.text), textDecoration: "underline", textUnderlineOffset: 3, overflowWrap: "anywhere" }}>
      {column.title}
    </Link>
  );
  return (
    <div data-testid="compare-view" data-viewport={phone ? "mobile" : "desktop"} style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <h1 style={{ ...text(20, 500, t.text), margin: 0 }}>Compare two builds</h1>
      <section aria-label="Totals" style={{ ...moduleStyle(false), display: "flex", flexDirection: "column", gap: 12 }}>
        <table data-testid="compare-totals" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", width: "28%", ...text(12, 500, t.text2), padding: "6px 8px 8px 0" }}>
                <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Figure</span>
              </th>
              <th scope="col" style={{ textAlign: "left", padding: "6px 8px 8px 0" }}>{head(a)}</th>
              <th scope="col" style={{ textAlign: "left", padding: "6px 0 8px 0" }}>{head(b)}</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((row) => (
              <tr key={row.label} data-testid="compare-total-row" style={{ borderTop: `1px solid ${t.hairlineModule}` }}>
                <th scope="row" style={{ textAlign: "left", ...text(12, 400, t.text2), padding: "8px 8px 8px 0", verticalAlign: "top" }}>{row.label}</th>
                <td style={{ ...text(13, 400, t.text), ...tnum, padding: "8px 8px 8px 0", verticalAlign: "top", overflowWrap: "anywhere" }}>{row.a}</td>
                <td style={{ ...text(13, 400, t.text), ...tnum, padding: "8px 0", verticalAlign: "top", overflowWrap: "anywhere" }}>{row.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p data-testid="compare-sentence" style={{ ...text(13.5, 400, t.text), margin: 0 }}>{sentence}</p>
      </section>
      <section aria-label="Steps" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {phone ? (
          <Segmented<"a" | "b"> label="Which build's steps" size={50} fontSize={13} fullWidth items={[{ value: "a", label: "This one" }, { value: "b", label: "The other" }]} value={side} onChange={setSide} />
        ) : null}
        {rows.length === 0 ? <p style={{ ...text(13, 400, t.text2), margin: 0 }}>Neither build has a step yet.</p> : null}
        {rows.map((row, index) => (
          <div key={index} data-testid="compare-row" style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)", gap: 8 }}>
            {!phone || side === "a" ? <Cell step={row.a} /> : null}
            {!phone || side === "b" ? <Cell step={row.b} /> : null}
          </div>
        ))}
      </section>
    </div>
  );
}

export default CompareView;
