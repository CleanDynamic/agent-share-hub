/* CA-26 P4: the one live region of the build page.

   Everything the page says to a screen reader without a new element to find goes through `useAnnounce()`: every notice, the drag
   and move status lines, the save states, Copied, a model cleared, the count of characters past a title's limit. One polite region,
   visually hidden, mounted once with the page (the Radix windows leave an `aria-live` node alone when they hide the rest, so what
   a window says is heard too).

   ONE AT A TIME. There is one message. A newer one replaces the older at once, whether the older was said 5 ms ago or 500: a
   screen reader that has not got to the older one never will, and one that has is cut off for the newer. The region is emptied
   first, then filled a beat later, because a region whose text arrives in the same breath as its mount, or that says the same
   sentence twice running, is not announced. Form validation errors keep their own `role="alert"`; they are not said here. */

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";

/** The beat between emptying the region and filling it. */
export const ANNOUNCE_BEAT_MS = 50;
/** How long a message is left in the region before it is emptied (nothing is read from a stale one). */
export const ANNOUNCE_HOLD_MS = 6000;

export type Announce = (message: string) => void;

const AnnounceContext = createContext<Announce>(() => undefined);

/** `const announce = useAnnounce(); announce("Saved.")`. Outside the page's announcer it does nothing. */
export const useAnnounce = (): Announce => useContext(AnnounceContext);

/** A notice in the words a screen reader hears: its sentence as a sentence, then that Undo is there when it is. */
export function noticeWords(notice: { sentence: string; noUndo?: boolean }): string {
  const sentence = notice.sentence.trim().replace(/[.\s]+$/, "");
  return `${sentence}.${notice.noUndo ? "" : " Undo available."}`;
}

export function BuildAnnouncer({ children }: { children?: ReactNode }) {
  const [message, setMessage] = useState("");
  const beat = useRef<number | undefined>(undefined);
  const hold = useRef<number | undefined>(undefined);

  const announce = useCallback<Announce>((next) => {
    window.clearTimeout(beat.current);
    window.clearTimeout(hold.current);
    setMessage("");
    if (!next) return;
    beat.current = window.setTimeout(() => {
      setMessage(next);
      hold.current = window.setTimeout(() => setMessage(""), ANNOUNCE_HOLD_MS);
    }, ANNOUNCE_BEAT_MS);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(beat.current);
      window.clearTimeout(hold.current);
    },
    [],
  );

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" data-testid="build-announcer" style={VISUALLY_HIDDEN}>
        {message}
      </div>
    </AnnounceContext.Provider>
  );
}

export default BuildAnnouncer;
