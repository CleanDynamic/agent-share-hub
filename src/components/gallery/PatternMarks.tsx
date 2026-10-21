/* CA-13 P12 — the patterns a build uses, as small marks on its card: "Uses a router", "Long-running agent", "Structured output". At
   most two are drawn, with "+1" for the third, in `--label`. Worked out from the build itself; nothing here is typed. */

import { PATTERN_LABEL, type Pattern } from "@/lib/build/patterns";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export const PATTERN_MARKS_SHOWN = 2;

export function PatternMarks({ patterns }: { patterns?: readonly Pattern[] }) {
  if (!patterns || patterns.length === 0) return null;
  const shown = patterns.slice(0, PATTERN_MARKS_SHOWN);
  const more = patterns.length - shown.length;
  return (
    <span data-testid="pattern-marks" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: FIGTREE, fontSize: 11.5, lineHeight: 1.4, color: t.label }}>
      {shown.map((pattern) => (
        <span key={pattern} data-testid="pattern-mark">{PATTERN_LABEL[pattern]}</span>
      ))}
      {more > 0 ? <span data-testid="pattern-more">+{more}</span> : null}
    </span>
  );
}
