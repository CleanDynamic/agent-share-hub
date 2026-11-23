/* Synth 15: one panel at a reading width (680 for the legal pages, About, API docs and not found; 820 for progress),
   centred on the page shade at every desktop width. The frame's own full-width panel steps back (`useColumnPanels`) and
   this draws the panel itself: Panel fill, radius 12, no edge, no shadow. On a phone the frame's panel is the page, so
   nothing is drawn here but the content and its padding. */

import type { CSSProperties, ReactNode } from "react";

import { PANEL_RADIUS } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** The reading widths. */
export const READING_WIDTH = { text: 680, progress: 820 } as const;

export interface ReadingPanelProps {
  width?: number;
  /** The panel's padding on a desktop. A phone keeps the frame panel's own. */
  padding?: CSSProperties["padding"];
  /** Painted inside the panel behind the content (the not-found dot band). */
  backdrop?: ReactNode;
  "data-testid"?: string;
  children: ReactNode;
}

export function ReadingPanel({ width = READING_WIDTH.text, padding = 28, backdrop, children, "data-testid": testId }: ReadingPanelProps) {
  const phone = useIsPhone();
  useColumnPanels(!phone);
  return (
    <div
      data-testid={testId}
      data-ui="reading-panel"
      style={{
        position: "relative",
        boxSizing: "border-box",
        width: "100%",
        maxWidth: phone ? undefined : width,
        margin: "0 auto",
        padding: phone ? 0 : padding,
        minWidth: 0,
        fontFamily: FIGTREE,
        color: t.text,
        ...(phone ? null : { background: t.surface, borderRadius: PANEL_RADIUS, overflow: "clip" }),
      }}
    >
      {backdrop}
      <div style={{ position: "relative", minWidth: 0 }}>{children}</div>
    </div>
  );
}

export default ReadingPanel;
