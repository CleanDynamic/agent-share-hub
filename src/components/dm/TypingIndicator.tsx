// BG-P26 — the typing indicator: three dots, opacity only.
//
// PRESENTATION ONLY, AND DELIBERATELY SO. BG-P26 asks for a typing indicator and
// forbids, in the same prompt, any change to realtime subscriptions or presence.
// Those two pull in opposite directions: nothing in this codebase broadcasts a
// typing state. `dm_presence` carries `is_online` and `last_seen_at` and nothing
// else, and no channel anywhere sends a `typing` event. Wiring one would mean a
// new broadcast channel or a new column — exactly the change hard constraint 1
// rules out.
//
// So this is the component, correct and ready, driven by a prop. Where a signal
// exists it renders; today nothing sets `active` to true, which means the
// indicator is dark rather than wrong. Wiring the signal is a separate piece of
// work and is called out in the handoff — it is not something to smuggle into a
// repaint.
//
// WHY OPACITY AND NOT A BOUNCE. A bouncing dot animates `transform: translateY`,
// which is compositable and would be legal, but three dots bouncing inside a row
// whose height is set by its content is how an indicator starts nudging the
// thread above it. Opacity cannot move anything.
//
// REDUCED MOTION IS ANSWERED TWICE, the way the rest of the kit answers it: the
// animation is dropped from the style object here, and `[data-bg-animated]` in
// index.css drops it again for a visitor who changes the setting while the
// indicator is already on screen.

import * as React from "react";
import { t } from "@/lib/theme/tokens";
import { r } from "@/lib/theme/radius";
import { prefersReducedMotion } from "@/lib/theme/controls";

interface TypingIndicatorProps {
  /** Whether the other party is typing. */
  active: boolean;
  /** Name to announce, for the screen-reader label only. */
  who?: string;
}

/** The three dots, staggered by delay off one shared keyframe. */
const DELAYS_MS = [0, 160, 320];

export function TypingIndicator({ active, who }: TypingIndicatorProps) {
  if (!active) return null;

  const reduced = prefersReducedMotion();

  return (
    <div
      className="flex items-center gap-2 px-1 py-1"
      // The dots are decoration; the label is what a screen reader gets.
      aria-live="polite"
      aria-label={who ? `${who} is typing` : "Typing"}
    >
      <div
        className="flex items-center gap-1"
        style={{
          padding: "8px 10px",
          // Their side of the conversation, so it takes their bubble's ground
          // and their squared corner — the indicator reads as a message
          // forming, not as a separate piece of chrome.
          background: t.recess,
          borderRadius: `${r["r-control"]} ${r["r-control"]} ${r["r-control"]} 0`,
        }}
      >
        {DELAYS_MS.map((delay) => (
          <span
            key={delay}
            aria-hidden="true"
            data-bg-animated=""
            className="inline-block rounded-full"
            style={{
              width: 5,
              height: 5,
              background: t.text2,
              opacity: reduced ? 0.6 : undefined,
              animation: reduced
                ? undefined
                : `dmTypingDot 1200ms ${delay}ms infinite ease-in-out`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
