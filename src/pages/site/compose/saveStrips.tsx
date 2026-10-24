/* CA-23: the two strips at the top of the Build column, above the post, 8 below the title row.

   Both are one recipe: min-height 40, padding 8 8 8 14, radius 10, the well's fill, a 1px `--hairline`, 13/18 `--text`.
   "Offline. Changes save when you reconnect." shows while there is no connection and goes when it is back. "Changed in
   another tab" has "Show changes" at its right, a small button of the control recipe (26 tall, padding 0 9, 12/500, radius
   7); the strip goes once it is pressed. */

import type { CSSProperties, ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { RecipeButton } from "./modalRecipes";

export const STRIP_COPY = {
  offline: "Offline. Changes save when you reconnect.",
  changed: "Changed in another tab",
  show: "Show changes",
} as const;

/** The strip's own measures. */
export const STRIP: CSSProperties = {
  boxSizing: "border-box",
  minHeight: 40,
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 8px 8px 14px",
  borderRadius: 10,
  background: t.well,
  border: `1px solid ${t.hairline}`,
  fontFamily: FIGTREE,
  fontSize: 13,
  fontWeight: 400,
  lineHeight: "18px",
  color: t.text,
  minWidth: 0,
};

/** The small button at a strip's right. */
const SHOW: CSSProperties = { height: 26, padding: "0 9px", borderRadius: 7, fontSize: 12, fontWeight: 500, marginLeft: "auto" };

export function OfflineStrip() {
  return (
    <div role="status" data-testid="offline-strip" style={STRIP}>
      {STRIP_COPY.offline}
    </div>
  );
}

export function OtherTabStrip({ onShow }: { onShow: () => void }) {
  return (
    <div role="status" data-testid="other-tab-strip" style={STRIP}>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{STRIP_COPY.changed}</span>
      <RecipeButton small data-testid="show-changes" style={SHOW} onClick={onShow}>
        {STRIP_COPY.show}
      </RecipeButton>
    </div>
  );
}

/** The strips, stacked 8 apart. Nothing is drawn when there are none. */
export function Strips({ children }: { children: ReactNode }) {
  return (
    <div data-testid="sandbox-strips" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      {children}
    </div>
  );
}
