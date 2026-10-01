// The lamp dot (UI-P08): the small oval that says "this is lit".
//
// AMBER IS LIGHT, NEVER TEXT. The dot is `--lit` and nothing is written on it:
// `--lit` is under 3:1 on Noon's ground, so it is a lamp and never a word or a
// border carrying state. Dimming is `opacity`, not a second colour, so the
// colour stays one token in both rooms; the lit dot adds `--lamp-glow`, which is
// `none` on Noon and a soft halo on Dusk, because a glow needs darkness and the
// token says so rather than the component.
//
// SIZES the design draws: 10×7 (the default, in the plaque), 12×8, 20×12, 22×14.
// The lamp is an oval — a light, not a dot — so it is never given equal sides.

import type { HTMLAttributes } from "react";

export interface LampDotProps extends Omit<HTMLAttributes<HTMLSpanElement>, "style" | "children"> {
  /** Width in px. */
  width?: number;
  /** Height in px. */
  height?: number;
  /** Dimmed to 45%: the claim has gone stale. */
  dim?: boolean;
}

export function LampDot({ width = 10, height = 7, dim = false, ...rest }: LampDotProps) {
  return (
    <span
      {...rest}
      aria-hidden="true"
      data-ui="lamp-dot"
      data-variant={dim ? "dim" : "on"}
      style={{
        width,
        height,
        borderRadius: "50%",
        /* Longhand: the value is a colour and nothing else, and a shorthand
           holding a `var()` is the declaration jsdom's cssstyle drops whole. */
        backgroundColor: "var(--lit)",
        opacity: dim ? 0.45 : 1,
        boxShadow: dim ? undefined : "var(--lamp-glow)",
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

export default LampDot;
