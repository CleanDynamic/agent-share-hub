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
//
// UNDER THE REFINED LOOK (UI-P85) the lamp is a BAR: 3px high, radius 1, `--lit` with `--lamp-glow`, 8 wide unless a
// caller says otherwise (14 in a streak day, 32 above a picture). Dimmed is `filter: var(--dim-filter)`, never an
// opacity. The lamp is light, so it never becomes an edge colour and is never written on.

import type { CSSProperties, HTMLAttributes } from "react";

import { t } from "@/lib/theme/tokens";

export interface LampDotProps extends Omit<HTMLAttributes<HTMLSpanElement>, "style" | "children"> {
  /** Width in px. */
  width?: number;
  /** Height in px. Ignored under the refined look, where the lamp is 3px. */
  height?: number;
  /** Dimmed to 45%: the claim has gone stale. */
  dim?: boolean;
}

export function LampDot({ width, height = 7, dim = false, ...rest }: LampDotProps) {
  return <LampBar {...rest} width={width ?? 8} dim={dim} />;
}

/** The refined lamp: a bar. Exported for the streak day, the figure's label and the picture lamp, which size it themselves. */
export function LampBar({
  width = 8,
  dim = false,
  style,
  ...rest
}: Omit<LampDotProps, "height" | "width"> & {
  /** Px, or a CSS length (the framed work's `max(12px, 25%)`). */
  width?: number | string;
  /** Placement only: where a caller hangs the bar. */
  style?: CSSProperties;
}) {
  return (
    <span
      {...rest}
      aria-hidden="true"
      data-ui="lamp-dot"
      data-variant={dim ? "dim" : "on"}
      style={{
        width,
        height: 3,
        borderRadius: 1,
        backgroundColor: t.lit,
        boxShadow: t.lampGlow,
        filter: dim ? t.dimFilter : undefined,
        flexShrink: 0,
        display: "inline-block",
        ...style,
      }}
    />
  );
}

export default LampDot;
