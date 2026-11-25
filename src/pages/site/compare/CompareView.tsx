/* Synth 14 Part C: /b2/:slug/compare/:otherSlug, two builds of the same thing, side by side. PURE.

   One panel at 980: a 13 Text 3 link to the first build, the h1 "Compare two builds" (20/600). The totals table: the column
   heads are the two builds' names in Geist Serif 15 Text; "to build" and "to run" in separate rows; values right-aligned in
   mono 15. Under it the difference in plain words, 15 Text 2. Then the steps under their fact ("12 and 9 steps, side by
   side"): two columns of step Cards matched by kind and order ("Prompt 1", the title 15/600); a step with no match is a
   dashed empty Card (1px, radius 12, 56 tall). On a phone the "This one" / "The other" pills show one column at a time. */

import { useState } from "react";
import { Link } from "react-router-dom";

import { Segmented } from "@/components/brand/Segmented";
import { PhonePills } from "@/components/phone/PhonePills";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { useIsPhone } from "@/components/shell/useMinWidth";
import type { CompareRow, TotalsRow } from "@/lib/build/compare";
import { stepTitle, type Step } from "@/lib/build/graph";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, SENTIENT } from "@/lib/theme/type";

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

const KIND: Record<Step["kind"], string> = { prompt: "Prompt", agent: "Agent", team: "Team", manual: "Manual step", code: "Code", check: "Check", file: "File", tool: "Tool", decision: "Decision", system_prompt: "System prompt", dataset: "Dataset", repo: "GitHub repository", retrieval: "Retrieval" };

const type = (px: 13 | 15 | 20, weight: 400 | 500 | 600, color: string) => ({ fontFamily: FIGTREE, fontSize: px, fontWeight: weight, lineHeight: px === 20 ? "24px" : px === 15 ? "20px" : "16px", color });

/** "12 and 9 steps, side by side". */
export function stepsFact(rows: readonly CompareRow[]): string {
  const a = rows.filter((row) => row.a).length;
  const b = rows.filter((row) => row.b).length;
  return `${a.toLocaleString("en-GB")} and ${b.toLocaleString("en-GB")} ${a === 1 && b === 1 ? "step" : "steps"}, side by side`;
}

function Cell({ step }: { step: Step | null }) {
  if (!step) {
    return (
      <div data-testid="compare-gap" style={{ border: `1px dashed ${t.treeLine}`, borderRadius: 12, height: 56, boxSizing: "border-box" }}>
        <span className="sr-only">No matching step</span>
      </div>
    );
  }
  return (
    <div data-testid="compare-step" style={{ background: t.module, borderRadius: 12, padding: "8px 12px", minHeight: 56, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={type(13, 400, t.label)}>{KIND[step.kind] ?? "Step"} {step.number}</span>
      <span style={{ ...type(15, 600, t.text), overflowWrap: "anywhere" }}>{stepTitle(step)}</span>
    </div>
  );
}

/** Mobile 28 C: a value column's width on a phone. */
export const PHONE_VALUE_COLUMN = 64;

/** A step on a phone: a Card, radius 12, padding 10 12, the kind and number 13 Text 3 over the title 13/600. A missing step is an empty Panel slot. */
function PhoneCell({ step }: { step: Step | null }) {
  if (!step) {
    return (
      <div data-testid="compare-gap" style={{ background: t.surface, borderRadius: 12, minHeight: 56, boxSizing: "border-box" }}>
        <span className="sr-only">No matching step</span>
      </div>
    );
  }
  return (
    <div data-testid="compare-step" style={{ background: t.module, borderRadius: 12, padding: "10px 12px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={type(13, 400, t.label)}>{KIND[step.kind] ?? "Step"} {step.number}</span>
      <span style={{ ...type(13, 600, t.text), overflowWrap: "anywhere" }}>{stepTitle(step)}</span>
    </div>
  );
}

/**
 * Mobile 28 C: two builds on a phone. The top bar names the page, so the h1 is for screen readers. The totals are a table
 * whose rows sit on Panel (radius 8, padding 10 16, 2 apart): the figure 15 Text 2 and the two values in mono 15 in 64-wide
 * right-aligned columns, the builds' names in Geist Serif 13 over them. The plain-words difference under it. Then the steps
 * under their fact in two columns 8 apart; "This one" and "The other" show one column at a time, and pressing the chosen one
 * again shows both.
 */
function ComparePhone({ a, b, rows, totals, sentence }: CompareViewProps) {
  const [side, setSide] = useState<"a" | "b" | null>(null);
  const name = (column: CompareColumn) => (
    <Link to={column.to} style={{ display: "block", fontFamily: SENTIENT, fontSize: 13, lineHeight: "16px", fontWeight: 400, color: t.text, textDecoration: "none", overflowWrap: "anywhere" }}>
      {column.title}
    </Link>
  );
  const valueCell = { padding: "10px 0 10px 8px", ...type(15, 400, t.text), fontFamily: DM_MONO, fontVariantNumeric: "tabular-nums" as const, textAlign: "right" as const, background: t.surface, verticalAlign: "top" as const, overflowWrap: "anywhere" as const };
  const columns = side ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)";
  return (
    <div data-testid="compare-view" data-viewport="mobile" style={{ boxSizing: "border-box", padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
      <h1 className="sr-only">Compare two builds</h1>
      <section aria-label="Totals" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <table data-testid="compare-totals" style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 2px", tableLayout: "fixed", margin: "-2px 0" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: "0 0 6px" }}>
                <span className="sr-only">Figure</span>
              </th>
              <th scope="col" style={{ width: PHONE_VALUE_COLUMN, textAlign: "right", verticalAlign: "bottom", padding: "0 0 6px 8px" }}>{name(a)}</th>
              <th scope="col" style={{ width: PHONE_VALUE_COLUMN + 16, textAlign: "right", verticalAlign: "bottom", padding: "0 16px 6px 8px" }}>{name(b)}</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((row) => (
              <tr key={row.label} data-testid="compare-total-row">
                <th scope="row" style={{ textAlign: "left", ...type(15, 400, t.text2), background: t.surface, padding: "10px 8px 10px 16px", borderRadius: "8px 0 0 8px", verticalAlign: "top" }}>{row.label}</th>
                <td style={valueCell}>{row.a}</td>
                <td style={{ ...valueCell, padding: "10px 16px 10px 8px", borderRadius: "0 8px 8px 0" }}>{row.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p data-testid="compare-sentence" style={{ ...type(15, 400, t.text2), margin: 0 }}>{sentence}</p>
      </section>
      <section aria-labelledby="compare-steps" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 id="compare-steps" style={{ ...type(20, 600, t.text), letterSpacing: "-0.01em", margin: 0 }}>{stepsFact(rows)}</h2>
        <div style={{ margin: "0 -16px" }}>
          <PhonePills<"a" | "b">
            label="Which build's steps"
            pills={[{ value: "a", label: "This one" }, { value: "b", label: "The other" }]}
            value={side}
            onChange={(value) => setSide((current) => (current === value ? null : value))}
          />
        </div>
        {rows.length === 0 ? <p style={{ ...type(15, 400, t.text2), margin: 0 }}>Neither build has a step yet.</p> : null}
        {rows.map((row, index) => (
          <div key={index} data-testid="compare-row" style={{ display: "grid", gridTemplateColumns: columns, gap: 8 }}>
            {side !== "b" ? <PhoneCell step={row.a} /> : null}
            {side !== "a" ? <PhoneCell step={row.b} /> : null}
          </div>
        ))}
      </section>
    </div>
  );
}

export function CompareView(props: CompareViewProps) {
  useColumnPanels(true);
  const phone = useIsPhone();
  if (phone) return <ComparePhone {...props} />;
  return <CompareDesktop {...props} />;
}

function CompareDesktop({ a, b, rows, totals, sentence }: CompareViewProps) {
  const phone = false;
  const [side, setSide] = useState<"a" | "b">("a");
  const head = (column: CompareColumn) => (
    <Link to={column.to} style={{ fontFamily: SENTIENT, fontSize: 15, lineHeight: "20px", fontWeight: 400, color: t.text, textDecoration: "none", overflowWrap: "anywhere" }}>
      {column.title}
    </Link>
  );
  const cell = { ...type(15, 400, t.text), fontFamily: DM_MONO, fontVariantNumeric: "tabular-nums" as const, textAlign: "right" as const, padding: "8px 0 8px 12px", verticalAlign: "top" as const, overflowWrap: "anywhere" as const };
  return (
    <div
      data-testid="compare-view"
      data-viewport={phone ? "mobile" : "desktop"}
      style={{ width: "100%", maxWidth: 980, margin: "0 auto", boxSizing: "border-box", padding: phone ? 16 : 24, borderRadius: 12, background: t.surface, display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}
    >
      <div>
        <Link to={a.to} data-testid="compare-back" style={{ ...type(13, 400, t.label), textDecoration: "none" }}>
          {`Back to ${a.title}`}
        </Link>
        <h1 style={{ ...type(20, 600, t.text), margin: "8px 0 0" }}>Compare two builds</h1>
      </div>
      <section aria-label="Totals" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <table data-testid="compare-totals" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", width: "34%", padding: "6px 8px 8px 0" }}>
                <span className="sr-only">Figure</span>
              </th>
              <th scope="col" style={{ textAlign: "right", padding: "6px 0 8px 12px" }}>{head(a)}</th>
              <th scope="col" style={{ textAlign: "right", padding: "6px 0 8px 12px" }}>{head(b)}</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((row) => (
              <tr key={row.label} data-testid="compare-total-row">
                <th scope="row" style={{ textAlign: "left", ...type(15, 400, t.text2), padding: "8px 8px 8px 0", verticalAlign: "top" }}>{row.label}</th>
                <td style={cell}>{row.a}</td>
                <td style={cell}>{row.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p data-testid="compare-sentence" style={{ ...type(15, 400, t.text2), margin: 0 }}>{sentence}</p>
      </section>
      <section aria-labelledby="compare-steps" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 id="compare-steps" style={{ ...type(20, 600, t.text), margin: "0 0 4px" }}>{stepsFact(rows)}</h2>
        {phone ? (
          <Segmented<"a" | "b"> label="Which build's steps" size={50} fontSize={13} fullWidth items={[{ value: "a", label: "This one" }, { value: "b", label: "The other" }]} value={side} onChange={setSide} />
        ) : null}
        {rows.length === 0 ? <p style={{ ...type(15, 400, t.text2), margin: 0 }}>Neither build has a step yet.</p> : null}
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
