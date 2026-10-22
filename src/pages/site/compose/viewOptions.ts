/* CA-14 P6 — the two switches under "View": the session list, and split and merge. Both are off until the maker turns them on,
   and are remembered for that maker on this device (`localStorage`). Storage can be missing or refuse (a private window, site
   data blocked): every read and write is in a try/catch, and a failed read is "off". No migration, nothing sent anywhere. */

import { useCallback, useState } from "react";

export interface ViewOptions {
  /** A row for jumping between sessions. */
  sessionList: boolean;
  /** "Split session here" on a tile, "Merge with the session above" on a session. */
  splitMerge: boolean;
}

export const VIEW_OFF: ViewOptions = { sessionList: false, splitMerge: false };

/** One entry per maker, so two makers on one device keep their own. */
export const viewOptionsKey = (makerId: string | null | undefined): string => `bg-compose-view:${makerId ?? "signed-out"}`;

/** What was kept for this maker; "off" for anything missing, unreadable, or not a switch. */
export function readViewOptions(makerId: string | null | undefined): ViewOptions {
  try {
    const raw = window.localStorage.getItem(viewOptionsKey(makerId));
    if (!raw) return VIEW_OFF;
    const value = JSON.parse(raw) as Partial<Record<keyof ViewOptions, unknown>> | null;
    return { sessionList: value?.sessionList === true, splitMerge: value?.splitMerge === true };
  } catch {
    return VIEW_OFF;
  }
}

/** Keep the switches. A write that fails is dropped: the switch still holds for this visit. */
export function writeViewOptions(makerId: string | null | undefined, options: ViewOptions): void {
  try {
    window.localStorage.setItem(viewOptionsKey(makerId), JSON.stringify(options));
  } catch {
    /* Nothing to do: the choice lasts until the page is closed. */
  }
}

export function useViewOptions(makerId: string | null | undefined): [ViewOptions, (patch: Partial<ViewOptions>) => void] {
  const [options, setOptions] = useState<ViewOptions>(() => readViewOptions(makerId));
  const [forMaker, setForMaker] = useState(makerId);
  // A different maker signed in: read theirs.
  if (forMaker !== makerId) {
    setForMaker(makerId);
    setOptions(readViewOptions(makerId));
  }
  const change = useCallback(
    (patch: Partial<ViewOptions>) => {
      setOptions((before) => {
        const next = { ...before, ...patch };
        writeViewOptions(makerId, next);
        return next;
      });
    },
    [makerId],
  );
  return [options, change];
}
