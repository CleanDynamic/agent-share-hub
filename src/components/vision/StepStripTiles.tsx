/* UX-05 P1: a build's top-level steps as a row of tiles, the open one a dashed slot. Moved from the OpenBuilds view, since the
   requests page and the post card both draw it. Without `openLabel` a tile is "4 · Prompt" over its title and the open one
   "4 · Prompt · open"; with it (the post card) the open one is its head over `openLabel` ("Step 4 · Prompt" over "Still open"). */

import type { CSSProperties } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { DashedSlot } from "@/components/vision/DashedSlot";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

export interface StripTileData {
  id: string;
  /** "4": its place among the build's top-level steps. */
  number: string;
  /** "Prompt", "Code". */
  kind: string;
  title: string;
  /** The step the gap is, or is in. */
  open: boolean;
}

/** A tile: `--tile`, 1px `--tile-border`, radius 6, padding 10 12. */
export const tileBox: CSSProperties = { boxSizing: "border-box", minWidth: 0, background: t.tile, border: `1px solid ${t.tileBorder}`, borderRadius: r.control, padding: "10px 12px" };

export function StepStripTiles({ tiles, openLabel, margin = "16px 0 0" }: { tiles: readonly StripTileData[]; openLabel?: string; margin?: string }) {
  const phone = useIsPhone();
  if (tiles.length === 0) return null;
  const columns = phone ? Math.min(tiles.length, 2) : tiles.length;
  return (
    <ol aria-label="Steps" style={{ listStyle: "none", margin, padding: 0, display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 6 }}>
      {tiles.map((tile) => {
        const head = [tile.number, tile.kind].filter(Boolean).join(" · ");
        return tile.open ? (
          <DashedSlot key={tile.id} as="li" style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 11.5, color: t.text }}>{openLabel ? head : head ? `${head} · open` : "Open"}</div>
            <div style={{ fontSize: 12.5, color: t.text2, overflowWrap: "anywhere" }}>{openLabel ?? tile.title}</div>
          </DashedSlot>
        ) : (
          <li key={tile.id} style={tileBox}>
            <div style={{ fontSize: 11.5, color: t.label }}>{head}</div>
            <div style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>{tile.title}</div>
          </li>
        );
      })}
    </ol>
  );
}
