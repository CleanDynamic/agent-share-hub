/* CA-06 P5 — the colour picker on a page: which part it is open on, the colour it previews, and what Done writes.

   The page keeps the preview (`preview`, `setPreview`) beside its steps, so the tile, the session and the post's
   links all draw it while the picker is open. Cancel drops it: the part's own colour is back. Done writes the colour
   (and, for a session with "Also colour its tiles that have no colour", those tiles'), adds it to Recent, and holds
   the preview until the saved build shows it, so nothing flickers back while the write lands. */

import { useCallback, useEffect, useRef, useState } from "react";

import { ColourPicker, recentAfterDone } from "@/components/brand/ColourPicker";
import { useColourSwatches } from "@/components/brand/useColourSwatches";
import { previewColours, uncolouredTiles, type ColourPreview } from "@/lib/build/colourPreview";
import { groupKey, type SessionGroup, type Step } from "@/lib/build/graph";
import { parseRefTo, refTo } from "@/lib/build/thread";

/** How long a kept preview waits for the saved build at most. */
const SETTLE_MS = 5000;

export interface ColourPickingInput {
  preview: ColourPreview | null;
  setPreview: (next: ColourPreview | null) => void;
  /** The build as saved, without the preview. */
  savedSteps: readonly Step[];
  savedGroups: readonly SessionGroup[];
  /** Write one part's colour, or take it off. */
  write: (to: string, colour: string | null) => void;
  phone: boolean;
}

export function useColourPicking({ preview, setPreview, savedSteps, savedGroups, write, phone }: ColourPickingInput) {
  const [open, setOpen] = useState<{ to: string; anchor: HTMLElement; what: string; colour: string | null } | null>(null);
  const [swatches, setSwatches] = useColourSwatches();
  const settling = useRef<number | null>(null);

  const onColour = useCallback(
    (to: string, anchor: HTMLElement, what: string, colour: string | null) => {
      setPreview(null);
      setOpen({ to, anchor, what, colour });
    },
    [setPreview],
  );

  // A kept preview goes once the saved build shows what it showed (or after a while, whatever happens).
  useEffect(() => {
    if (!preview || open || settling.current === null) return;
    const shown = previewColours([...savedSteps], [...savedGroups], preview);
    const same = JSON.stringify(shown) === JSON.stringify({ steps: savedSteps, groups: savedGroups });
    if (same) {
      window.clearTimeout(settling.current);
      settling.current = null;
      setPreview(null);
    }
  }, [preview, open, savedSteps, savedGroups, setPreview]);

  const cancel = useCallback(() => {
    setOpen(null);
    setPreview(null);
  }, [setPreview]);

  const done = useCallback(
    (colour: string | null, alsoTiles: boolean) => {
      if (!open) return;
      const target = parseRefTo(open.to);
      if (colour !== open.colour) write(open.to, colour);
      if (target?.kind === "session" && alsoTiles && colour) {
        const group = savedGroups.find((candidate) => groupKey(candidate) === target.id);
        for (const id of group ? uncolouredTiles(savedSteps, group) : []) write(refTo({ kind: "node", id }), colour);
      }
      setSwatches(recentAfterDone(swatches, colour));
      setOpen(null);
      setPreview({ to: open.to, colour, alsoTiles });
      if (settling.current !== null) window.clearTimeout(settling.current);
      settling.current = window.setTimeout(() => {
        settling.current = null;
        setPreview(null);
      }, SETTLE_MS);
    },
    [open, write, savedGroups, savedSteps, setSwatches, swatches, setPreview],
  );

  const picker = open ? (
    <ColourPicker
      open
      anchor={open.anchor}
      what={open.what}
      initial={open.colour}
      session={parseRefTo(open.to)?.kind === "session"}
      swatches={swatches}
      onSwatches={setSwatches}
      onPreview={(colour, alsoTiles) => setPreview({ to: open.to, colour, alsoTiles })}
      onCancel={cancel}
      onDone={done}
      phone={phone}
    />
  ) : null;

  return { onColour, picker };
}
