// RC-P27 — the progress page's one bar: light, never type. Repainted UI-P09.
//
// AMBER IS LIGHT ⟦buildgallery-theme › Progress and achievement⟧: the fill is
// --lit and nothing is written on it, in either room. The number the bar draws
// is always printed beside it in DM Mono, so the bar is never the only carrier
// of a value.
//
// ONE BAR, AND NOW THE DESIGN KIT'S. UI-P09 made this a `StripedBar` in --lit:
// the diagonal-striped field the dashboard reference draws, with the unfilled
// part in --bar-base. The props are unchanged, so every call site changes look
// without changing code. The bar no longer animates: a bar that grows in on
// every render says something every time it is looked at, and the number beside
// it is what is read.
//
// ONE BAR, TWO USES ⟦law-of-similarity⟧: the level's progress under PROGRESS
// and each weekly challenge under THIS WEEK, so "how far along" looks the same
// wherever it is asked.

import { t } from "@/lib/theme/tokens";

import { StripedBar } from "@/components/brand/StripedBar";

export interface LitBarProps {
  /** How far along, from 0 to max. Clamped. */
  value: number;
  max: number;
  /** The bar's accessible name: what is being measured. */
  label: string;
  /** The value in words, as the text beside the bar says it: "1 of 3". */
  valueText: string;
  "data-testid"?: string;
}

/** The fill's share of the track, as a percentage from 0 to 100. */
function litBarPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round((Math.min(Math.max(value, 0), max) / max) * 1000) / 10;
}

export function LitBar({ value, max, label, valueText, "data-testid": testId }: LitBarProps) {
  const clamped = Math.min(Math.max(value, 0), Math.max(max, 0));

  return (
    <StripedBar
      value={litBarPercent(value, max)}
      colour={t.lit}
      height={8}
      label={label}
      valueText={valueText}
      valueNow={clamped}
      valueMax={max}
      data-testid={testId ?? "lit-bar"}
    />
  );
}

export default LitBar;
