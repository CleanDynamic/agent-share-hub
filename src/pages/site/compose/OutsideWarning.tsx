/* CA-03 P7 — a warning when an agent reads content it doesn't control.

   One module under the agent, in the List, in Details and on the build page: a 7px `--cat-breakage` dot, the sentence
   13/500 `--text`, and the line 12.5 `--text2` naming the tools ("It can use Gmail and Notion."). The module recipe and
   nothing more: no coloured border, no fill of its own, no icon. Drawn only when the agent can use such a tool
   (`readsOutsideContent`). */

import type { CSSProperties } from "react";

import { joinNames } from "@/lib/build/outsideContent";
import { t } from "@/lib/theme/tokens";

import { moduleStyle, text } from "./refinedStyles";

export const OUTSIDE_COPY = {
  title: "This agent reads content it doesn't control.",
  line: (names: readonly string[]) => `It can use ${joinNames(names)}. Before you run it, check what it's allowed to change.`,
} as const;

export function OutsideWarning({ names, style }: { names: readonly string[]; style?: CSSProperties }) {
  if (names.length === 0) return null;
  return (
    <div data-testid="outside-warning" role="note" style={{ ...moduleStyle(false, 12), display: "flex", alignItems: "flex-start", gap: 8, ...style }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: t.catBreakage, flexShrink: 0, marginTop: 6 }} />
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ ...text(13, 500, t.text), lineHeight: "18px" }}>{OUTSIDE_COPY.title}</span>
        <span style={{ ...text(12.5, 400, t.text2), lineHeight: "18px", overflowWrap: "anywhere" }}>{OUTSIDE_COPY.line(names)}</span>
      </span>
    </div>
  );
}

export default OutsideWarning;
