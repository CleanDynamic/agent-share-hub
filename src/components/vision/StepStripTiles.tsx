/* UX-05 P1: a build's top-level steps as a row of tiles, the open one a dashed slot. Moved from the OpenBuilds view, since the
   requests page and the post card both draw it. Without `openLabel` a tile is "4 · Prompt" over its title and the open one
   "4 · Prompt · open"; with it (the post card) the open one is its head over `openLabel` ("Step 4 · Prompt" over "Still open"). */

import type { CSSProperties, ReactNode } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { DashedSlot } from "@/components/vision/DashedSlot";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
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

/** A tile that can be pressed: padded as the tile is, with the app's focus ring. */
function TileButton({ label, pressed, onPick, children }: { label: string; pressed: boolean; onPick: () => void; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onPick}
      {...handlers}
      style={{ display: "block", boxSizing: "border-box", width: "100%", padding: "10px 12px", background: "none", border: 0, borderRadius: r.control, textAlign: "left", color: "inherit", font: "inherit", cursor: "pointer", ...ring(state.focusVisible) }}
    >
      {children}
    </button>
  );
}

export function StepStripTiles({ tiles, openLabel, margin = "16px 0 0", onPick }: { tiles: readonly StripTileData[]; openLabel?: string; margin?: string; onPick?: (id: string) => void }) {
  const phone = useIsPhone();
  if (tiles.length === 0) return null;
  const columns = phone ? Math.min(tiles.length, 2) : tiles.length;
  return (
    <ol aria-label="Steps" style={{ listStyle: "none", margin, padding: 0, display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 6 }}>
      {tiles.map((tile) => {
        const head = [tile.number, tile.kind].filter(Boolean).join(" · ");
        const inner = tile.open ? (
          <>
            <div style={{ fontSize: 11.5, color: t.text }}>{openLabel ? head : head ? `${head} · open` : "Open"}</div>
            <div style={{ fontSize: 12.5, color: t.text2, overflowWrap: "anywhere" }}>{openLabel ?? tile.title}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11.5, color: t.label }}>{head}</div>
            <div style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>{tile.title}</div>
          </>
        );
        // With onPick a tile is a button: the composer's way to mark the step that is still open.
        const content = onPick ? (
          <TileButton label={`${head}, ${tile.title}`} pressed={tile.open} onPick={() => onPick(tile.id)}>
            {inner}
          </TileButton>
        ) : (
          inner
        );
        return tile.open ? (
          <DashedSlot key={tile.id} as="li" style={{ padding: onPick ? 0 : "10px 12px" }}>
            {content}
          </DashedSlot>
        ) : (
          <li key={tile.id} style={onPick ? { ...tileBox, padding: 0 } : tileBox}>
            {content}
          </li>
        );
      })}
    </ol>
  );
}
