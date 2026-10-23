/* CA-06 P5 — the colour picker on a page: which part it is open on, the colour it previews, and what Done writes.

   The page keeps the preview (`preview`, `setPreview`) beside its steps, so the tile, the session and the post's
   links all draw it while the picker is open. Cancel drops it: the part's own colour is back. Done writes the colour
   (and, for a session with "Also colour its tiles that have no colour", those tiles'), adds it to Recent, and holds
   the preview until the saved build shows it, so nothing flickers back while the write lands. */

import { useCallback, useEffect, useRef, useState } from "react";

import { ColourPicker, recentAfterDone, type PickerHistory, type PickerReferences } from "@/components/brand/ColourPicker";
import { useColourSwatches } from "@/components/brand/useColourSwatches";
import { previewColours, uncolouredSessions, uncolouredTiles, type ColourPreview } from "@/lib/build/colourPreview";
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
  /** CA-17 P5: the keys of a part's sessions, for a part's "Also colour its sessions that have no colour". */
  sessionsOfPart?: (workstream: string) => readonly string[];
  /**
   * CA-19 P4: Done as one step of the history: the component's colour (or a group's, for `group:<id>`) and, for a session or a
   * part with "Also colour…", the uncoloured ones it names. Absent: each colour goes to `write`.
   */
  commit?: (to: string, colour: string | null, also: readonly string[]) => void;
  /** CA-19 P4: the component's linked text and groups, for the picker's third section and its group state. */
  references?: (to: string, controls: { finish: () => void }) => PickerReferences | undefined;
  history?: PickerHistory;
}

export function useColourPicking({ preview, setPreview, savedSteps, savedGroups, write, phone, sessionsOfPart, commit, references, history }: ColourPickingInput) {
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
    const shown = previewColours([...savedSteps], [...savedGroups], preview, sessionsOfPart);
    const same = JSON.stringify(shown) === JSON.stringify({ steps: savedSteps, groups: savedGroups });
    if (same) {
      window.clearTimeout(settling.current);
      settling.current = null;
      setPreview(null);
    }
  }, [preview, open, savedSteps, savedGroups, setPreview, sessionsOfPart]);

  const cancel = useCallback(() => {
    setOpen(null);
    setPreview(null);
  }, [setPreview]);

  const done = useCallback(
    (colour: string | null, alsoTiles: boolean) => {
      if (!open) return;
      const target = parseRefTo(open.to);
      const also: string[] = [];
      if (target?.kind === "session" && alsoTiles && colour) {
        const group = savedGroups.find((candidate) => groupKey(candidate) === target.id);
        for (const id of group ? uncolouredTiles(savedSteps, group) : []) also.push(refTo({ kind: "node", id }));
      }
      // A part's colour with "Also colour its sessions that have no colour": those sessions only, and nothing else.
      if (target?.kind === "workstream" && alsoTiles && colour && sessionsOfPart) {
        for (const key of uncolouredSessions(savedGroups, sessionsOfPart(target.id))) also.push(refTo({ kind: "session", id: key }));
      }
      if (commit) {
        if (colour !== open.colour || also.length > 0) commit(open.to, colour, also);
      } else {
        if (colour !== open.colour) write(open.to, colour);
        for (const to of also) write(to, colour);
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
    [open, write, commit, savedGroups, savedSteps, setSwatches, swatches, setPreview, sessionsOfPart],
  );
  /** Keeps what the picker shows and closes it: a reference action (Select words, Make a group) that leaves the picker. */
  const finish = useCallback(() => done(preview && open && preview.to === open.to ? preview.colour : (open?.colour ?? null), Boolean(preview?.alsoTiles)), [done, preview, open]);

  const picker = open ? (
    <ColourPicker
      open
      anchor={open.anchor}
      what={open.what}
      initial={open.colour}
      session={parseRefTo(open.to)?.kind === "session"}
      part={parseRefTo(open.to)?.kind === "workstream"}
      references={references?.(open.to, { finish })}
      history={history}
      swatches={swatches}
      onSwatches={setSwatches}
      onPreview={(colour, alsoTiles) => setPreview({ to: open.to, colour, alsoTiles })}
      onCancel={cancel}
      onDone={done}
      phone={phone}
    />
  ) : null;

  return { onColour, picker, open: Boolean(open), finish, close: cancel };
}
