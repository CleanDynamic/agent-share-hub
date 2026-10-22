/* UI-P93 — the composer's refined pieces, shared by its forks: the number tile (UI-P90's), the tool's mark and the
   quiet words of a row. Their styles are in `refinedStyles.ts`. */

import type { CSSProperties, ReactNode } from "react";

import { ModelMark } from "@/components/brand/ModelMark";
import { checkHistoryLine, checkStatus, type CheckFacts } from "@/lib/build/graph";
import { casesLine } from "@/lib/build/testCases";
import { markFor } from "@/lib/models/marks";
import { CONTROL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { text, tnum } from "./refinedStyles";

/* ── pieces ── */

/** The step's number in a 24 control tile, Geist Mono 11. */
export function NumberTile({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      style={{
        ...CONTROL,
        flexShrink: 0,
        minWidth: 24,
        height: 24,
        padding: "0 4px",
        boxSizing: "border-box",
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: DM_MONO,
        fontSize: 11,
        lineHeight: "normal",
        color: t.text,
        ...tnum,
      }}
    >
      {children}
    </span>
  );
}

/** The tool's real mark, or a 6px square when it has none. */
export function ToolMark({ tool, model, size }: { tool?: string | null; model?: string | null; size: 14 | 20 | 24 }) {
  if (markFor({ tool, model }) === null) {
    return <span aria-hidden="true" style={{ width: 6, height: 6, margin: (size - 6) / 2, borderRadius: 1, background: t.label, flexShrink: 0 }} />;
  }
  return (
    <span style={{ display: "inline-flex", flexShrink: 0, color: t.text }}>
      <ModelMark tool={tool} model={model} size={size} />
    </span>
  );
}

/** "Uses", "Goes into", "words": the quiet 11.5 `--label` words of a row. */
export function Quiet({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ ...text(11.5, 400, t.label), ...style }}>{children}</span>;
}

/**
 * CA-03: one quiet line led by a 7px dot: how a step ran ("On a schedule · Weekdays 07:30"), what an agent remembers,
 * how a check went. State is a small mark, not a coloured card: the dot carries it, in `--label` for a plain fact,
 * `--evidence` for a pass and `--cat-breakage` for a failure; the words are 12 `--text2`.
 */
export function DotLine({ dot = t.label, children, style, testId }: { dot?: string; children: ReactNode; style?: CSSProperties; testId?: string }) {
  return (
    <span data-testid={testId} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, ...text(12, 400, t.text2), lineHeight: "18px", ...style }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{children}</span>
    </span>
  );
}

/** CA-03: a label over its value, as the reference's lists draw them: 12 `--text2` over 13 `--text`, a hairline under. */
export function LabelValue({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId ?? "label-value"} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 0", borderBottom: `1px solid ${t.hairlineModule}`, minWidth: 0 }}>
      <span style={text(12, 400, t.text2)}>{label}</span>
      <span style={{ ...text(13, 400, t.text), overflowWrap: "anywhere" }}>{children}</span>
    </div>
  );
}

/** CA-03 P5: the words a check is shown with, in the composer and on the build page. */
export const CHECK_COPY = {
  eyebrow: "Check · how it checked its work",
  tested: "Test description",
  passing: "Pass criteria",
  failed: "Failure notes",
} as const;

/** CA-05 P7: the lines a check says beyond its status, only the ones it has: the cases it was tested on, and how its runs went. */
export function CheckExtraLines({ check, style }: { check: CheckFacts; style?: CSSProperties }) {
  const history = checkHistoryLine(check.runs);
  return (
    <>
      {check.cases ? (
        <DotLine testId="check-cases" style={style}>
          <span style={tnum}>{casesLine(check.cases)}</span>
        </DotLine>
      ) : null}
      {history ? (
        <DotLine testId="check-history" style={style}>
          <span style={tnum}>{history}</span>
        </DotLine>
      ) : null}
    </>
  );
}

/** CA-03 P5: a check's one status line (a 7px `--evidence` or `--cat-breakage` dot) and its three answers, label over value. */
export function CheckBlock({ check, style }: { check: CheckFacts; style?: CSSProperties }) {
  const status = checkStatus(check);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, ...style }}>
      {status ? (
        <DotLine testId="check-status" dot={status.allPassed ? t.evidence : t.catBreakage}>
          <span style={tnum}>{status.line}</span>
        </DotLine>
      ) : null}
      <CheckExtraLines check={check} />
      <div>
        <LabelValue label={CHECK_COPY.tested}>{check.tested}</LabelValue>
        {check.passing ? <LabelValue label={CHECK_COPY.passing}>{check.passing}</LabelValue> : null}
        {check.onFail ? <LabelValue label={CHECK_COPY.failed}>{check.onFail}</LabelValue> : null}
      </div>
    </div>
  );
}
