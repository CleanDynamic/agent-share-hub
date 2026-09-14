import { Bookmark, MessageCircle, Upload, Repeat, Heart, Users, Eye, Calendar } from "lucide-react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, tabular } from "@/lib/theme/type";

export interface EngagementGridProps {
  counters: Record<string, number>;
}

const ITEMS: { key: string; label: string; icon: any }[] = [
  { key: "saves", label: "Saves", icon: Bookmark },
  { key: "comments", label: "Comments", icon: MessageCircle },
  { key: "publishes", label: "Publishes", icon: Upload },
  { key: "reblogs", label: "Reblogs", icon: Repeat },
  { key: "likes", label: "Likes", icon: Heart },
  { key: "follows", label: "Follows", icon: Users },
  { key: "views", label: "Views", icon: Eye },
  { key: "returns", label: "Day-returns", icon: Calendar },
];

/**
 * The engagement counters — eight tiles of one number each. Repainted by
 * BG-P28b.
 *
 * THESE ARE STAT TILES, SO THEY ARE SET AS DATA. The number was Figtree at 600;
 * it is DM Mono with tabular numerals now, because eight counts laid out in a
 * 4-across grid are a column whether or not anyone called them one, and a
 * proportional face makes "1,204" and "998" different widths in adjacent cells.
 * `data-visualization`'s rule about aligned figures applies to a grid of tiles
 * exactly as it does to a table.
 *
 * NO AMBER HERE, deliberately. Every tile is the same weight because every
 * counter is the same KIND of thing — lighting one would say it mattered more.
 * The page's one lit element is the level marker in the hero above.
 */
export function EngagementGrid({ counters }: EngagementGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 10,
      }}
    >
      {ITEMS.map(({ key, label, icon: Icon }) => {
        const v = counters?.[key] ?? 0;
        return (
          <div
            key={key}
            style={{
              background: t.glass2,
              border: `0.5px solid ${t.line}`,
              borderRadius: r.media,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <Icon size={14} color="currentColor" style={{ color: t.text2 }} />
            <div
              style={{
                fontFamily: DM_MONO,
                ...tabular,
                fontSize: 18,
                fontWeight: 500,
                color: t.text,
              }}
            >
              {v.toLocaleString()}
            </div>
            <div
              style={{
                fontFamily: FIGTREE,
                fontSize: 11,
                color: t.text2,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default EngagementGrid;
