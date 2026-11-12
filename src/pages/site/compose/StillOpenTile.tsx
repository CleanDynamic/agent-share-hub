/* UX-08 P1: a step tile marked still open. The tile's `···` menu offers `Mark still open`, which asks `What's missing` in the same
   window the session and part marks use, titled `Still open: <step tile label>`. Marked, the menu offers `Edit what's missing` and
   `Not still open`, and the tile says `Still open` in 12 `--label` under its title (the composer's tiles have no dashed treatment of
   their own for a gap, so no border is added). The mark is stored the way the disk stores a gap: `is_gap` and `payload.gap_problem`.

   PRESENTATIONAL. The caller writes (`onStillOpen`). The window opens from outside the menu, so closing the menu does not unmount it. */

import { useState, type ReactNode } from "react";

import { stepTitle, type Step } from "@/lib/build/graph";
import { t } from "@/lib/theme/tokens";

import { text } from "./refinedStyles";
import { OpenRequestWindow } from "./composerWindows";
import { OPEN_REQUEST_COPY } from "./openRequestCopy";

import { textStep } from "@/lib/theme/type";
export const STILL_OPEN_TILE_COPY = {
  mark: "Mark still open",
  edit: "Edit what's missing",
  take: "Not still open",
  line: "Still open",
} as const;

export interface StillOpenItem {
  key: string;
  label: string;
  onSelect: () => void;
}

/** The menu items a tile offers, and the window they open. Absent `on`: no items, no window. */
export function useStillOpenTile(step: Step, on?: (id: string, problem: string | null) => void): { items: StillOpenItem[]; dialog: ReactNode } {
  const [asking, setAsking] = useState(false);
  if (!on) return { items: [], dialog: null };
  const marked = step.stillOpen !== undefined;
  const items: StillOpenItem[] = marked
    ? [
        { key: "edit", label: STILL_OPEN_TILE_COPY.edit, onSelect: () => setAsking(true) },
        { key: "take", label: STILL_OPEN_TILE_COPY.take, onSelect: () => on(step.id, null) },
      ]
    : [{ key: "mark", label: STILL_OPEN_TILE_COPY.mark, onSelect: () => setAsking(true) }];
  const dialog = (
    <OpenRequestWindow
      open={asking}
      title={OPEN_REQUEST_COPY.titleTile(stepTitle(step))}
      initial={step.stillOpen}
      onClose={() => setAsking(false)}
      onSubmit={(problem) => {
        setAsking(false);
        on(step.id, problem);
      }}
    />
  );
  return { items, dialog };
}

/** `Still open`, under the tile's title; nothing when the tile is not marked. */
export function StillOpenLine({ step }: { step: Pick<Step, "stillOpen"> }) {
  if (step.stillOpen === undefined) return null;
  return (
    <span data-testid="tile-still-open" title={step.stillOpen || undefined} style={text(textStep.meta, 400, t.label)}>
      {STILL_OPEN_TILE_COPY.line}
    </span>
  );
}
