import * as React from "react";

import { InlineLoader } from "@/components/brand/InlineLoader";

/* ────────────────────────────────────────────────────────────────────────────
   The spinner (BG-P07); Part E (G27): replaced by InlineLoader, the circle of
   dots with a bright arc travelling round it. The props are the spinner's:
   `size` (held to InlineLoader's 16 to 22px) and `label`, still announced
   through `role="status"` and a visually hidden label.
   ──────────────────────────────────────────────────────────────────────────── */

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Edge length in px. */
  size?: number;
  /** Announced to assistive technology while the spinner is on screen. */
  label?: string;
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(({ size = 16, label = "Loading", style, ...props }, ref) => (
  <div ref={ref} className="inline-flex items-center" {...props}>
    <InlineLoader size={size} label={label} style={style} />
  </div>
));
Spinner.displayName = "Spinner";

export { Spinner };
