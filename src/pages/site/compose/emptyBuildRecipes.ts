/* CA-24 P2: the empty build's measures, as "Professional standard 2: loading, empty and error states" draws them. They are
   the board's own numbers (14, 56, 64 ...), so they live here, a recipe module, and the component spends them.

   - Heading: "Add your first session", 15/500.
   - The box, 12 below: `--window`, 1px `--window-border`, radius 12, padding 4 14, no shadow. Two rows of 56 with a 1px
     `--hairline` rule between them.
   - A row: a 24 square mark (`--control`, 1px `--control-border`, radius 5); 10 apart the name at 13/500 and 2 below it the
     detail at 12 `--label`; a chevron at the right in `--label`.
   - The drop zone, 12 below the box: 64 tall, 1px dashed `--skeleton-edge`, radius 10, "Drop sessions or files" centred at
     12.5 `--label`. While something is dragged over it the edge is `--skeleton-target`. */

import type { CSSProperties } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export const EMPTY_BUILD_COPY = {
  heading: "Add your first session",
  fromChats: "Import from connected chats",
  availableOf: (n: number) => `${n} available`,
  startNew: "New empty session",
  drop: "Drop sessions or files",
} as const;

const type = (px: number, weight: 400 | 500, color: string): CSSProperties => ({ fontFamily: FIGTREE, fontSize: px, fontWeight: weight, lineHeight: "normal", color });

export const EMPTY_HEADING: CSSProperties = { ...type(15, 500, t.text), margin: 0 };
export const EMPTY_COLUMN: CSSProperties = { display: "flex", flexDirection: "column", gap: 12, minWidth: 0 };
export const EMPTY_BOX: CSSProperties = {
  boxSizing: "border-box",
  background: t.window,
  border: `1px solid ${t.windowBorder}`,
  borderRadius: 12,
  padding: "4px 14px",
  boxShadow: "none",
  display: "flex",
  flexDirection: "column",
};
export const EMPTY_ROW_HEIGHT = 56;
export const EMPTY_ROW: CSSProperties = {
  appearance: "none",
  background: "none",
  border: 0,
  margin: 0,
  padding: 0,
  width: "100%",
  height: EMPTY_ROW_HEIGHT,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: 10,
  textAlign: "left",
  color: "inherit",
  cursor: "pointer",
};
export const EMPTY_RULE: CSSProperties = { height: 0, borderTop: `1px solid ${t.hairline}`, flexShrink: 0 };
export const EMPTY_MARK: CSSProperties = { width: 24, height: 24, boxSizing: "border-box", flexShrink: 0, background: t.control, border: `1px solid ${t.controlBorder}`, borderRadius: 5 };
export const EMPTY_NAMES: CSSProperties = { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flexGrow: 1 };
export const EMPTY_NAME: CSSProperties = type(13, 500, t.text);
export const EMPTY_DETAIL: CSSProperties = type(12, 400, t.label);
export const EMPTY_CHEVRON: CSSProperties = { color: t.label, display: "inline-flex", flexShrink: 0 };

export const EMPTY_DROP_HEIGHT = 64;
export const emptyDrop = (over: boolean): CSSProperties => ({
  boxSizing: "border-box",
  width: "100%",
  height: EMPTY_DROP_HEIGHT,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px dashed ${over ? t.skeletonTarget : t.skeletonEdge}`,
  borderRadius: 10,
  background: "none",
  textAlign: "center",
  ...type(12.5, 400, t.label),
});
