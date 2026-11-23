// RC-P27 — the progress page's one bar. Synth 15: a plain track on the Raised shade with the Mint fill (`--brand-accent`:
// #6BE2A0 in the dark, #1F6A24 on #E7EBE7 in the light), radius 999, no stripes and nothing written on it. 6px under the
// level, 4px under a weekly challenge. The number the bar draws is always printed beside it in mono, so the bar is never the
// only carrier of a value, and it does not animate.
//
// ONE BAR, TWO USES ⟦law-of-similarity⟧: the level's progress and each weekly challenge, so "how far along" looks the same
// wherever it is asked.

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

export interface LitBarProps {
  /** How far along, from 0 to max. Clamped. */
  value: number;
  max: number;
  /** The bar's accessible name: what is being measured. */
  label: string;
  /** The value in words, as the text beside the bar says it: "1 of 3". */
  valueText: string;
  /** 6 under the level, 4 under a challenge. */
  height?: 4 | 6;
  "data-testid"?: string;
}

/** The fill's share of the track, as a percentage from 0 to 100. */
function litBarPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round((Math.min(Math.max(value, 0), max) / max) * 1000) / 10;
}

export function LitBar({ value, max, label, valueText, height = 6, "data-testid": testId }: LitBarProps) {
  const clamped = Math.min(Math.max(value, 0), Math.max(max, 0));
  const percent = litBarPercent(value, max);
  return (
    <div data-testid={testId ?? "lit-bar"} style={{ width: "100%" }}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={valueText}
        data-bar-track=""
        style={{ position: "relative", height, borderRadius: r.full, background: t.control, overflow: "hidden" }}
      >
        {percent > 0 ? (
          <span data-bar-fill="" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${percent}%`, borderRadius: r.full, background: t.brandAccent }} />
        ) : null}
      </div>
    </div>
  );
}

export default LitBar;
