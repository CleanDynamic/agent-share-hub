/* UI-P30 — "Where it broke", inside the part viewer.

   Every recorded breakage in the order it happened (collectBreakages: a
   written-up part and the step it links are one breakage, not two), as rows: a
   7px `--cat-breakage` dot, the part's name in Figtree 13 600, what happened in
   Figtree 13 `--text2`, and the fix in `--text`. Each row that names a step
   opens the replay there.

   Then every gap still open, as a dashed breakage card: what is missing, the
   reward when a bounty pays for it, and the one primary, "Solve it", which
   opens that bounty's solve sheet.

   RESOLVED, NOT ALARMING. A breakage is the creator saying where it went wrong
   so the next person does not repeat it; the hue is spent on the dot and the
   dashed edge, never on a ground or on the prose.

   PURE. */

import { Play } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import type { BreakageBodyView, BreakageRowView, OpenGapView } from "./buildModel";

function Row({ row, onOpenReplay }: { row: BreakageRowView; onOpenReplay?: (ordinal: number) => void }) {
  return (
    <li
      data-testid="build-breakage-row"
      data-breakage-start={row.start ?? undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "7px minmax(0, 1fr) auto",
        gap: 10,
        alignItems: "start",
        padding: "10px 0",
        borderBottom: `1px solid ${t.hairline}`,
      }}
    >
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: r.full, background: t.catBreakage, marginTop: 6 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.5 }}>
        <h3 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: t.text }}>{row.name}</h3>
        {row.happened ? <p style={{ margin: 0, color: t.text2, whiteSpace: "pre-wrap" }}>{row.happened}</p> : null}
        {row.fix ? (
          <p style={{ margin: 0, color: t.text, whiteSpace: "pre-wrap" }}>
            <span style={{ fontFamily: DM_MONO, fontSize: 10, letterSpacing: ".09em", color: t.label, marginRight: 6 }}>FIX</span>
            {row.fix}
          </p>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        {row.span && onOpenReplay && row.start !== null ? (
          <Button
            variant="ghost"
            size={28}
            fontSize={11}
            icon={Play}
            aria-label={`Watch ${row.span} in the replay`}
            onClick={() => onOpenReplay(row.start as number)}
          >
            {row.span}
          </Button>
        ) : (
          <span style={{ fontFamily: DM_MONO, fontSize: 10, color: t.label, lineHeight: "28px" }}>{row.span ?? "no step recorded"}</span>
        )}
        {row.attempts ? <span style={{ fontFamily: DM_MONO, fontSize: 10, color: t.label }}>{row.attempts}</span> : null}
      </div>
    </li>
  );
}

function Gap({ gap, onSolve }: { gap: OpenGapView; onSolve?: (id: string) => void }) {
  return (
    <li
      data-testid="build-open-gap"
      data-part-id={gap.id}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: r.card,
        /* Longhands: a shorthand holding a var() is one declaration some engines drop whole. */
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: t.catBreakage,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.5 }}>
        <h3 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: t.text }}>{gap.title}</h3>
        <p style={{ margin: 0, color: t.text2 }}>{gap.problem ?? "Left open on purpose: the build works without it."}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {gap.reward ? <span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.catBreakage }}>{gap.reward}</span> : null}
        {gap.solvable && onSolve ? (
          <Button variant="primary" size={30} fontSize={12} aria-label={`Solve it: ${gap.title}`} onClick={() => onSolve(gap.id)}>
            Solve it
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function BreakageBody({ breakage }: { breakage: BreakageBodyView }) {
  const { rows, gaps, onOpenReplay, onSolve } = breakage;

  if (rows.length === 0 && gaps.length === 0) {
    return (
      <section data-testid="build-breakage" aria-label="Where it broke" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>No breakages recorded</p>
        <p style={{ margin: 0, color: t.text2 }}>Either nothing broke, or nothing was written down. Both are worth knowing.</p>
      </section>
    );
  }

  return (
    <section data-testid="build-breakage" aria-label="Where it broke" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rows.length > 0 ? (
        <div>
          <p style={{ margin: 0, fontSize: 13, color: t.text2 }}>
            {rows.length === 1 ? "1 recorded breakage" : `${rows.length.toLocaleString("en-GB")} recorded breakages`}, in the order they
            happened.
          </p>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {rows.map((row) => (
              <Row key={row.key} row={row} onOpenReplay={onOpenReplay} />
            ))}
          </ol>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: t.text2 }}>No breakages recorded.</p>
      )}

      {gaps.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Eyebrow size={10} as="h3" style={{ margin: 0 }}>
            Still open
          </Eyebrow>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {gaps.map((gap) => (
              <Gap key={gap.id} gap={gap} onSolve={onSolve} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default BreakageBody;
