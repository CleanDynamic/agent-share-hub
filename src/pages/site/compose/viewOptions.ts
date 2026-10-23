/* CA-14 P6 — the switch under "View": the session list. It is off until the maker turns it on, and is remembered for that maker on
   this device (`localStorage`). Storage can be missing or refuse (a private window, site data blocked): every read and write is in a
   try/catch, and a failed read is "off". No migration, nothing sent anywhere.

   CA-20 P1: "Split and merge" is gone. Its two menu items ("Split session here", "Merge with the session above") are always
   there where they apply. A value kept for it by an earlier visit is read past and ignored, and the next write leaves it out. */

import { useCallback, useState } from "react";

export interface ViewOptions {
  /** A row for jumping between sessions. */
  sessionList: boolean;
}

export const VIEW_OFF: ViewOptions = { sessionList: false };

/** One entry per maker, so two makers on one device keep their own. */
export const viewOptionsKey = (makerId: string | null | undefined): string => `bg-compose-view:${makerId ?? "signed-out"}`;

/** What was kept for this maker; "off" for anything missing, unreadable, or not a switch. */
export function readViewOptions(makerId: string | null | undefined): ViewOptions {
  try {
    const raw = window.localStorage.getItem(viewOptionsKey(makerId));
    if (!raw) return VIEW_OFF;
    const value = JSON.parse(raw) as Partial<Record<keyof ViewOptions, unknown>> | null;
    return { sessionList: value?.sessionList === true };
  } catch {
    return VIEW_OFF;
  }
}

/** Keep the switch. A write that fails is dropped: the switch still holds for this visit. */
export function writeViewOptions(makerId: string | null | undefined, options: ViewOptions): void {
  try {
    window.localStorage.setItem(viewOptionsKey(makerId), JSON.stringify({ sessionList: options.sessionList }));
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
