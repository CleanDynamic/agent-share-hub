/* UI-P13 — /dev/kit/pages/backdrop?theme=noon|dusk&viewport=desktop|mobile.

   A throwaway: the page backdrop on its own, in a box as tall as the longest
   page is likely to be, so the arc, the horizon below it and (on Dusk) the grain
   can be checked against the empty areas of the reference boards. It is not in
   `design/reference/index.json`, so the compare harness does not visit it. */

import { PageBackdrop } from "@/components/brand/PageBackdrop";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import type { DesignPageProps } from "./KitPages";

export default function BackdropDemo({ viewport }: DesignPageProps) {
  return (
    <div style={{ position: "relative", minHeight: viewport === "mobile" ? 1400 : 1500 }}>
      <PageBackdrop viewport={viewport} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: 24,
          fontFamily: DM_MONO,
          fontSize: 11,
          letterSpacing: ".08em",
          color: t.label,
        }}
      >
        page backdrop · {viewport}
      </div>
    </div>
  );
}
