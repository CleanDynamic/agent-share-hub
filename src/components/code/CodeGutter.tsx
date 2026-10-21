/* CA-11 — the line number column, drawn as one text block ("1\n2\n3…") and rebuilt only when the line count changes.

   `aria-hidden` and unselectable. `active` puts one line's number in `--text` over the block, so the block itself
   never changes with the caret. */

import { forwardRef, memo, useMemo } from "react";

import { t } from "@/lib/theme/tokens";

import { CODE_PAD_Y, GUTTER_PAD_LEFT, GUTTER_PAD_RIGHT, codeFont, gutterDigits, gutterText, type CodeMetrics } from "./lineModel";

export interface CodeGutterProps {
  count: number;
  metrics: CodeMetrics;
  font: string;
  /** The 1-based line whose number reads in `--text`. */
  active?: number | null;
  /** Background of the well, so the active number can cover the quiet one beneath it. */
  fill: string;
  onPointerLine?: (line: number) => void;
  testId?: string;
}

/** The inner block moves with the code's vertical scroll: the editor sets its transform straight from the scroll event. */
export const CodeGutter = memo(
  forwardRef<HTMLDivElement, CodeGutterProps>(function CodeGutter({ count, metrics, font, active = null, fill, onPointerLine, testId }, innerRef) {
    const text = useMemo(() => gutterText(count), [count]);
    const digits = gutterDigits(count);
    const base = { ...codeFont(font, metrics), textAlign: "right" as const };
    return (
      <div
        aria-hidden="true"
        data-testid={testId ?? "code-gutter"}
        data-digits={digits}
        onMouseDown={
          onPointerLine
            ? (event) => {
                event.preventDefault();
                const top = event.currentTarget.getBoundingClientRect().top;
                const inner = innerRef && "current" in innerRef ? innerRef.current : null;
                const moved = inner ? Number(/translateY\((-?[\d.]+)px\)/.exec(inner.style.transform)?.[1] ?? 0) : 0;
                const line = Math.floor((event.clientY - top - moved - CODE_PAD_Y) / metrics.lineHeight) + 1;
                onPointerLine(Math.min(count, Math.max(1, line)));
              }
            : undefined
        }
        style={{
          flexShrink: 0,
          overflow: "hidden",
          position: "relative",
          boxSizing: "content-box",
          width: `${digits}ch`,
          padding: `0 ${GUTTER_PAD_RIGHT}px 0 ${GUTTER_PAD_LEFT}px`,
          borderRight: `1px solid ${t.hairline}`,
          color: t.label,
          userSelect: "none",
          WebkitUserSelect: "none",
          cursor: onPointerLine ? "text" : "default",
        }}
      >
        <div ref={innerRef} style={{ position: "relative", padding: `${CODE_PAD_Y}px 0`, willChange: "transform" }}>
          <div data-testid="code-gutter-numbers" style={{ ...base, whiteSpace: "pre" }}>
            {text}
          </div>
          {active ? (
            <div
              data-testid="code-gutter-active"
              data-line={active}
              style={{ ...base, position: "absolute", left: 0, right: 0, top: CODE_PAD_Y + (active - 1) * metrics.lineHeight, height: metrics.lineHeight, background: fill, color: t.text }}
            >
              {active}
            </div>
          ) : null}
        </div>
      </div>
    );
  }),
);
