// The wall label (UI-P09): a museum label — a grid of small facts divided by
// hairlines.
//
// The cells sit on a `--hairline` background with a 1px gap, so the rules between
// them are the background showing through and no cell draws a border; the grid
// is clipped to radius 12. Each cell is a `--cell` ground, padding 12px 14px, a
// column with gap 7. What goes in a cell is a `Detail` or a `Stat`, both of which
// open with a 10px `Eyebrow`.

import type { ReactNode } from "react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

export interface WallLabelProps {
  columns: 2 | 3 | 4;
  /** One node per cell, in reading order. */
  cells: readonly ReactNode[];
}

export function WallLabel({ columns, cells }: WallLabelProps) {
  return (
    <div
      data-ui="wall-label"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 1,
        background: t.hairline,
        borderRadius: r.control,
        overflow: "hidden",
      }}
    >
      {cells.map((cell, index) => (
        <div
          key={index}
          style={{
            background: t.cell,
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 7,
            minWidth: 0,
          }}
        >
          {cell}
        </div>
      ))}
    </div>
  );
}

export default WallLabel;
