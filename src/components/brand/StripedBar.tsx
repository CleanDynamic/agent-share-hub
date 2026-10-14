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
// UNDER THE REFINED LOOK (UI-P85) the bar is flat: 4 or 6 high (a height of 8 or less asks for 4), radius 1, the
// fill in the tone, a 2px gap, then the rest in `--bar-base`. A tick is a 1px `--label` line 12 high, standing 3
// proud of a 6px bar; one that carries a `label` gets its eyebrow centred under it. No stripes, no gradient.
//
// It does not animate. A bar that grows in on every render is a bar that says
// something every time it is looked at.

import type { CSSProperties } from "react";

import { useLook } from "@/lib/theme/look";
import { t } from "@/lib/theme/tokens";

import { Eyebrow } from "./Eyebrow";

export interface StripedBarTick {
  /** Position, 0 to 100. */
  at: number;
  /** A token: `t.text`, `t.text2`. The refined look draws every tick in `--label`. */
  colour: string;
  /** The refined look's eyebrow under the tick: "Publish 60". */
  label?: string;
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
  const refined = useLook() === "refined";

  if (refined) {
    const h = height <= 8 ? 4 : 6;
    const labelled = ticks.some((tick) => tick.label);
    return (
      <div data-ui="striped-bar" data-testid={testId} style={{ width: "100%" }}>
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={valueMax ?? 100}
          aria-valuenow={valueNow ?? percent}
          aria-valuetext={valueText}
          style={{ position: "relative", display: "flex", gap: 2, height: h }}
        >
          {percent > 0 ? (
            <span data-striped-fill="" style={{ width: `${percent}%`, borderRadius: 1, background: colour }} />
          ) : null}
          {percent < 100 ? <span style={{ flexGrow: 1, borderRadius: 1, background: t.barBase }} /> : null}
          {ticks.map((tick) => (
            <span
              key={tick.at}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: `${clamp(tick.at)}%`,
                top: (h - 12) / 2,
                width: 1,
                height: 12,
                background: t.label,
              }}
            />
          ))}
        </div>
        {labelled ? (
          <div aria-hidden="true" style={{ position: "relative", height: 14, marginTop: 12 }}>
            {ticks.map((tick) =>
              tick.label ? (
                <Eyebrow key={tick.at} style={{ position: "absolute", left: `${clamp(tick.at)}%`, transform: "translateX(-50%)" }}>
                  {tick.label}
                </Eyebrow>
              ) : null,
            )}
          </div>
        ) : null}
      </div>
    );
  }

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
