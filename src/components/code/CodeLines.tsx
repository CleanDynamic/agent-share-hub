/* CA-11 — code, read-only, with the editor's numbered gutter.

   The same gutter and code in one well. The text is a `<pre><code>`, selectable; the numbers sit in a sibling column
   that cannot be selected, so copying gives the code without them. A long line scrolls sideways. There is no height
   cap, except where `compact` says so: then at most `COMPACT_LINES` lines show, with a plain "Show all N lines" under
   them. Copy buttons elsewhere keep copying the raw code. */

import { useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { WELL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { CodeGutter } from "./CodeGutter";
import { CODE_PAD_Y, codeFont, codeMetrics, head, numberedLines } from "./lineModel";

export const COMPACT_LINES = 8;

export interface CodeLinesProps {
  text: string;
  /** In a compact place (a step's preview in a list or panel): cap at 8 lines until asked. */
  compact?: boolean;
  /** Cap at this many lines until asked, in a place with its own limit (the run view's 20). Wins over `compact`. */
  maxLines?: number;
  /** On the `<pre>`. */
  testId?: string;
  /** Names the well for a screen reader, which the numbers cannot. */
  label?: string;
  /** Shown when there is no text. */
  empty?: string;
  /** Extra room for the well, e.g. a left margin. */
  style?: React.CSSProperties;
}

export function CodeLines({ text, compact = false, maxLines, testId = "code-lines", label, empty, style }: CodeLinesProps) {
  const phone = useIsPhone();
  const metrics = codeMetrics(phone);
  const [all, setAll] = useState(false);
  const cap = maxLines ?? (compact ? COMPACT_LINES : null);
  const capped = cap !== null && !all;
  const { shown, total } = capped ? head(text, cap) : { shown: text, total: numberedLines(text) };
  const count = capped ? Math.min(total, cap) : total;
  const body = text ? shown : (empty ?? "");
  const hidden = capped && total > (cap ?? total);

  return (
    <div data-testid={`${testId}-well`} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, ...style }}>
      <div role={label ? "region" : undefined} aria-label={label} style={{ ...WELL, borderRadius: 6, boxSizing: "border-box", display: "flex", width: "100%", minWidth: 0, overflow: "hidden", color: t.text, ...codeFont(DM_MONO, metrics) }}>
        <CodeGutter count={count} metrics={metrics} font={DM_MONO} fill={t.well} />
        <div tabIndex={0} data-ring-inset style={{ flex: "1 1 0", minWidth: 0, overflowX: "auto", outline: "none" }}>
          <pre
            data-testid={testId}
            style={{
              ...codeFont(DM_MONO, metrics),
              margin: 0,
              padding: `${CODE_PAD_Y}px 8px`,
              boxSizing: "border-box",
              minHeight: count * metrics.lineHeight + CODE_PAD_Y * 2,
              width: "max-content",
              minWidth: "100%",
              whiteSpace: "pre",
              tabSize: 2,
              color: t.text,
            }}
          >
            <code style={{ font: "inherit" }}>{body}</code>
          </pre>
        </div>
      </div>
      {cap !== null && total > cap ? (
        <button
          type="button"
          aria-expanded={all}
          onClick={() => setAll((open) => !open)}
          style={{ alignSelf: "flex-start", fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 500, minHeight: phone ? 44 : 24, padding: 0, background: "transparent", border: "none", cursor: "pointer", color: t.action, textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          {hidden ? `Show all ${total.toLocaleString("en-GB")} lines` : "Show fewer lines"}
        </button>
      ) : null}
    </div>
  );
}
