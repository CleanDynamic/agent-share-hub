// A polite live region (UI-P38): the sentence a screen reader hears when a result arrives with no new element to
// find. "Marked read", "Run recorded", "Me too added". It is mounted before the message is set, because a region that
// arrives with its text already inside is not announced; the text is drawn nowhere.

import { useCallback, useState } from "react";

import { VISUALLY_HIDDEN } from "./VisuallyHidden";

export function LiveRegion({ message }: { message: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" data-ui="live-region" style={VISUALLY_HIDDEN}>
      {message}
    </div>
  );
}

/** `[message, say]`: `say("Marked read")` sets it. Saying the same sentence twice announces it twice. */
export function useAnnouncer(): readonly [string, (message: string) => void] {
  const [message, setMessage] = useState("");
  const say = useCallback((next: string) => {
    setMessage("");
    window.setTimeout(() => setMessage(next), 50);
  }, []);
  return [message, say] as const;
}

export default LiveRegion;
