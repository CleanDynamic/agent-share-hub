/* CA-13 P3 — a run of tiles with its branches drawn, for the composer's list and the build page's.

   A head ("If team is billing") over the steps that run on that branch, indented 16 and joined to the decision by a 2px
   `--hairline` line; "Branches join here" where an unconditioned step follows; a quiet "How it runs" above the first decision
   of a run. A run with no decision and no condition is drawn exactly as the caller draws it. */

import type { ReactNode } from "react";

import { branchRows, hasBranches, JOIN_LINE } from "@/lib/build/branches";
import type { Step } from "@/lib/build/graph";
import { t } from "@/lib/theme/tokens";
import { text } from "@/pages/site/compose/refinedStyles";

export function drawBranches<T>(items: readonly T[], stepOf: (item: T) => Step, all: readonly Step[], draw: (item: T) => ReactNode): ReactNode {
  const steps = items.map(stepOf);
  if (!hasBranches(steps) && !steps.some((step) => step.kind === "decision")) return items.map(draw);
  const byId = new Map(items.map((item) => [stepOf(item).id, item]));
  const rows = branchRows(steps, all);
  const out: ReactNode[] = [];
  let i = 0;
  let sawDecision = false;
  while (i < rows.length) {
    const row = rows[i];
    if (row.kind === "head") {
      const inner: ReactNode[] = [];
      let j = i + 1;
      while (j < rows.length && rows[j].kind === "step" && (rows[j] as { group: number | null }).group === row.group) {
        inner.push(draw(byId.get((rows[j] as { step: Step }).step.id) as T));
        j += 1;
      }
      out.push(
        <div key={`branch-${row.group}-${row.decisionId}`} data-testid="branch-group" data-group={row.group} style={{ marginLeft: 16, paddingLeft: 12, borderLeft: `2px solid ${t.hairline}`, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <span data-testid="branch-head" style={text(12.5, 500, t.text2)}>{row.label}</span>
          {inner}
        </div>,
      );
      i = j;
      continue;
    }
    if (row.kind === "join") {
      out.push(<span key={`join-${i}`} data-testid="branch-join" style={text(11.5, 400, t.label)}>{JOIN_LINE}</span>);
    } else {
      if (row.step.kind === "decision" && !sawDecision) {
        out.push(<span key={`how-${row.step.id}`} data-testid="how-it-runs" style={text(11.5, 400, t.label)}>How it runs</span>);
        sawDecision = true;
      }
      out.push(draw(byId.get(row.step.id) as T));
    }
    i += 1;
  }
  return out;
}
