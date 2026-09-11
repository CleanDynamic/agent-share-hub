import * as React from "react";

import { cn } from "@/lib/utils";
import { spinnerStyle } from "@/lib/theme/controls";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — the spinner, and one of the four places `--r-full` is correct.

   A RING WITH ONE LIT QUADRANT, not a filled disc: a ring reads as "working",
   a dot reads as a bullet point. The lit quadrant is `--action` and the rest of
   the ring is `--line`, so the contrast between them is what rotates rather
   than the whole shape appearing and disappearing.

   It reuses `sequenceSpin`, the rotation keyframe already in `index.css`, and
   adds no second one. A rotation is the other thing an inline style cannot
   express, which is why it is a keyframe at all.

   UNDER REDUCED MOTION THE RING IS DRAWN WHOLE, in `--text2`, and does not
   turn. A stationary ring with one quadrant a different colour would read as a
   rendering fault rather than as a paused animation — the stillness has to look
   deliberate. As with the skeleton, the setting is answered both in the style
   object and, for the case where nothing re-renders, by `data-bg-animated`.

   `role="status"` with a visually hidden label, because a spinner that says
   nothing to a screen reader is a silent wait.
   ──────────────────────────────────────────────────────────────────────────── */

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Edge length in px. The ring's stroke stays 2px at every size. */
  size?: number;
  /** Announced to assistive technology while the spinner is on screen. */
  label?: string;
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, style, size = 16, label = "Loading", ...props }, ref) => (
    <div ref={ref} role="status" className={cn("inline-flex items-center", className)} {...props}>
      <div
        data-bg-animated=""
        aria-hidden="true"
        style={{ width: size, height: size, ...spinnerStyle(), ...style }}
      />
      <span className="sr-only">{label}</span>
    </div>
  ),
);
Spinner.displayName = "Spinner";

export { Spinner };
