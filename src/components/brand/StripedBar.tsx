// The striped bar (UI-P09): how far along, as a field of diagonal stripes.
//
// A row the width of its box. The filled part is `value`% of it in the bar's
// colour, the rest is the same stripes in `--bar-base`, and each tick is a 1.5px
// rule standing 4px proud of the bar at its own position — a threshold the value
// is being measured against (the publish score of 60, the gallery cut-off).
//
// COLOUR IS MEANING, so it is chosen by what the bar measures and never by taste:
//   --lit        progress, XP and goals
//   --evidence   proof and freshness
//   --action     money and bounties
//   --cat-agents rebuilds
//
// LIGHT, NEVER TYPE, AND NEVER ALONE. A bar is a picture of a number that is
// printed beside it. It is still a `progressbar` with its value and a name,
// because a picture is nothing to a screen reader.
//
// It does not animate. A bar that grows in on every render is a bar that says
// something every time it is looked at.

import type { CSSProperties } from "react";

import { t } from "@/lib/theme/tokens";

export interface StripedBarTick {
  /** Position, 0 to 100. */
  at: number;
  /** A token: `t.text`, `t.text2`. */
  colour: string;
}

export interface StripedBarProps {
  /** The fill, 0 to 100. Clamped. */
  value: number;
  /** A token, chosen by what is measured. */
  colour: string;
  /** 8 to 16; 12 by default. */
  height?: number;
  ticks?: readonly StripedBarTick[];
  /** The accessible name: what is being measured. */
  label: string;
  /** The value in words, as the text beside the bar says it. */
  valueText?: string;
  /** `aria-valuenow` when the real figure is not a percentage. Defaults to `value`. */
  valueNow?: number;
  /** `aria-valuemax` when the real scale is not 100. */
  valueMax?: number;
  "data-testid"?: string;
}

const stripes = (colour: string): CSSProperties["background"] =>
  `repeating-linear-gradient(-60deg, ${colour} 0 2.5px, transparent 2.5px 6px)`;

const clamp = (value: number) => (Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0);

export function StripedBar({
  value,
  colour,
  height = 12,
  ticks = [],
  label,
  valueText,
  valueNow,
  valueMax,
  "data-testid": testId,
}: StripedBarProps) {
  const percent = clamp(value);

  return (
    <div
      data-ui="striped-bar"
      data-testid={testId}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={valueMax ?? 100}
      aria-valuenow={valueNow ?? percent}
      aria-valuetext={valueText}
      style={{ position: "relative", display: "flex", height, width: "100%" }}
    >
      <div data-striped-fill="" style={{ width: `${percent}%`, background: stripes(colour) }} />
      <div style={{ flexGrow: 1, background: stripes(t.barBase) }} />
      {ticks.map((tick) => (
        <span
          key={tick.at}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${clamp(tick.at)}%`,
            top: -4,
            bottom: -4,
            width: 1.5,
            background: tick.colour,
          }}
        />
      ))}
    </div>
  );
}

export default StripedBar;
