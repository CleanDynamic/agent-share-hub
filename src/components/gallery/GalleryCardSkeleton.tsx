/* SV-04 P5: the gallery card's placeholder, in a module of its own, so a page's loading state (Library's, and the route
   table's Placeholder that is the same thing) can draw it without the card's code in the first download. GalleryCard.tsx
   re-exports it. */

import { COVER_HEIGHT } from "@/components/brand/coverHeight";
import { Skeleton } from "@/components/ui/skeleton";
import { aspectOf } from "@/lib/build/cover";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

import type { CardLayout } from "./CardThread";

/** The cover's height on the gallery wall. */
const COVER_PX = COVER_HEIGHT.wall;

/** The body under the cover, in skeleton lines: title, credit, plaque, chips. 20 before the UI-P56 density pass. */
const TITLE_LINE = 16;

/**
 * The card's shape before the card exists.
 *
 * THE SAME PROPORTIONS, NOT AN APPROXIMATION OF THEM: an 18px lamp spacer, the
 * card's 5px of padding and gap (7 before the UI-P56 density pass, as BuildCard),
 * the cover's height, and a body of the same lines, so the swap when the data
 * lands moves nothing. In feed layout the media
 * block reserves its height with `aspect-ratio` at `aspectOf(null).capped`, the
 * ratio the real card uses for a row whose dimensions it does not know yet.
 *
 * The shimmer is BG-P07's: `--recess` with a highlight swept across it by the
 * `bgShimmer` keyframe, reduced-motion answered in both the style object and the
 * stylesheet. Nothing here re-implements it.
 */
export function GalleryCardSkeleton({ layout = "grid" }: { layout?: CardLayout }) {
  return (
    <div
      data-visual-slot="gallery-card-skeleton"
      data-card-layout={layout}
      aria-hidden
      style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
    >
      <div style={{ height: 18 }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          padding: 5,
          background: t.glass,
          borderRadius: r.card,
          border: `1px solid ${t.glassBorder}`,
          boxSizing: "border-box",
        }}
      >
        <Skeleton
          style={{
            borderRadius: r.media,
            ...(layout === "feed" ? { aspectRatio: String(aspectOf(null).capped) } : { height: COVER_PX }),
          }}
        />
        <div style={{ padding: "0 5px 5px", display: "flex", flexDirection: "column", gap: 4 }}>
          <Skeleton style={{ height: TITLE_LINE, width: "70%", borderRadius: r.chip }} />
          {/* The plaque: one row, because its two halves are one object. */}
          <Skeleton style={{ height: 18, width: "78%", borderRadius: r.chip }} />
          <div style={{ display: "flex", gap: 4 }}>
            <Skeleton style={{ height: 16, width: 64, borderRadius: r.chip }} />
            <Skeleton style={{ height: 16, width: 48, borderRadius: r.chip }} />
          </div>
          {/* RC-P16 — the engagement row's 44px, so the card that replaces this
              placeholder does not grow on arrival. */}
          <div style={{ height: 44, display: "flex", alignItems: "center" }}>
            <Skeleton style={{ height: 18, width: 132, borderRadius: r.chip }} />
          </div>
        </div>
      </div>
    </div>
  );
}
