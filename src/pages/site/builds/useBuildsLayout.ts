/* SV-24 P2: where the Builds layout is kept, per viewer.

   WITH A SET OPEN THAT THE VIEWER MADE, the layout is the set's own (`query.layout`): a change is shown at once and written to
   the set a moment after it stops (one write for a burst of drags, and one when the page is left). Everywhere else, the open set
   being someone else's or none, it is this browser's, in `localStorage` under `builds:layout:v1` (`client-localstorage-schema`).
   A set that holds no layout yet shows the browser's, so opening one never resets what the reader has arranged.

   The pointer's moves are not here: a drag keeps its position in a ref and writes the layout once, on drop. */

import { useEffect, useRef, useState } from "react";

import { readStoredLayout, writeStoredLayout, type BuildsLayout } from "@/lib/build/buildsLayout";

/** How long after the last change the set is written. */
export const LAYOUT_SAVE_MS = 800;

export interface KeptSet {
  id: string;
  /** The set's own search: `query` is replaced whole, so every write carries it. */
  search: string;
  layout: BuildsLayout | null;
}

export function useBuildsLayout(kept: KeptSet | null, save: (set: KeptSet, layout: BuildsLayout) => void | Promise<void>) {
  const [stored, setStored] = useState<BuildsLayout>(readStoredLayout);
  const [draft, setDraft] = useState<{ setId: string; layout: BuildsLayout } | null>(null);
  const pending = useRef<{ set: KeptSet; layout: BuildsLayout; timer: ReturnType<typeof setTimeout> } | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = () => {
    const waiting = pending.current;
    if (!waiting) return;
    clearTimeout(waiting.timer);
    pending.current = null;
    void saveRef.current(waiting.set, waiting.layout);
  };

  /* Leaving the page, or opening another set, writes what is waiting. */
  const keptId = kept?.id ?? null;
  useEffect(() => flush, [keptId]);

  const keptLayout = kept ? (draft?.setId === kept.id ? draft.layout : kept.layout) : null;
  const layout = keptLayout ?? stored;

  const update = (change: (current: BuildsLayout) => BuildsLayout) => {
    const next = change(layout);
    if (kept) {
      setDraft({ setId: kept.id, layout: next });
      if (pending.current) clearTimeout(pending.current.timer);
      pending.current = { set: kept, layout: next, timer: setTimeout(flush, LAYOUT_SAVE_MS) };
    } else {
      setStored(next);
      writeStoredLayout(next);
    }
  };

  return { layout, update };
}
