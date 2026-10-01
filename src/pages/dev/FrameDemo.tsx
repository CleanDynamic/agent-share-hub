/* UI-P16 — /dev/kit/pages/frame?theme=noon|dusk&viewport=desktop|mobile.

   The empty frame: the page region of `SiteFrameView` holding only the 820px
   grid placeholder, so the column, the slots and the board height can be checked
   before any page exists. Not a board, so not in `design/reference/index.json`. */

import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import type { DesignPageProps } from "./KitPages";

export function FrameView({ fit = "content", viewport }: { fit?: PageFit; viewport: "desktop" | "mobile" }) {
  return (
    <div
      data-testid="frame-grid"
      style={{
        ...(viewport === "mobile" ? { minHeight: 480 } : boardHeight(fit)),
        border: `1px dashed ${t.line}`,
        borderRadius: 16,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: DM_MONO,
        fontSize: 11,
        letterSpacing: ".08em",
        color: t.label,
      }}
    >
      page grid · {viewport === "mobile" ? "fills the column" : "820px"}
    </div>
  );
}

export default function FrameDemo({ viewport }: DesignPageProps) {
  return <FrameView fit="board" viewport={viewport} />;
}
