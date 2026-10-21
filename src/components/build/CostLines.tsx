/* CA-13 P8 — what it took to make and what it costs to run, drawn once for the composer, the build page and Preview.

   A tile's one small `tnum` line, only when it has a figure: "Made in 1.2 s · 3,400 tokens · £0.01" on a prompt, "Each call:
   120 ms · £0.0001" on a decision. The strip at the top of the build: "To build: …" and "To run: …", never added together,
   each saying how many parts it counted. Money shows to readers only when the maker ticked Show readers. PURE. */

import { costLines, tileCostLines } from "@/lib/build/costView";
import type { SessionGroup, Step } from "@/lib/build/graph";
import { t } from "@/lib/theme/tokens";
import { text, tnum } from "@/pages/site/compose/refinedStyles";

export function TileCostLines({ step, audience, groups, indent = 0 }: { step: Pick<Step, "buildCost" | "runCost">; audience: "maker" | "reader"; groups: readonly SessionGroup[]; indent?: number }) {
  const lines = tileCostLines(step, audience, groups);
  if (!lines.build && !lines.run) return null;
  return (
    <span data-testid="tile-cost" style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: indent }}>
      {lines.build ? <span data-testid="cost-build" style={{ ...text(11.5, 400, t.label), ...tnum }}>{lines.build}</span> : null}
      {lines.run ? <span data-testid="cost-run" style={{ ...text(11.5, 400, t.label), ...tnum }}>{lines.run}</span> : null}
    </span>
  );
}

export function CostStrip({ steps, groups, audience }: { steps: readonly Step[]; groups: readonly SessionGroup[]; audience: "maker" | "reader" }) {
  const lines = costLines(steps, groups, audience);
  if (!lines.build && lines.run.length === 0) return null;
  return (
    <div data-testid="cost-strip" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {lines.build ? <span data-testid="cost-total-build" style={{ ...text(12, 400, t.text2), ...tnum }}>{lines.build}</span> : null}
      {lines.run.map((line) => (
        <span key={line} data-testid="cost-total-run" style={{ ...text(12, 400, t.text2), ...tnum }}>{line}</span>
      ))}
      {lines.savings ? <span data-testid="cost-savings" style={{ ...text(12, 400, t.text2), ...tnum }}>{lines.savings}</span> : null}
    </div>
  );
}
