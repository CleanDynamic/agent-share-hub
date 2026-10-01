// The small data drawings (UI-P12): line, step, histogram and spark charts, as
// hand-written SVG. No chart library, no animation, no tooltip.
//
// DECORATIVE BY DEFAULT. A chart here is a picture of a number the page already
// says in words ("41 reproduced", "9 solutions"), so each is `aria-hidden`
// unless the caller passes `label`, which makes it an `img` with that name.
//
// EVERY COLOUR IS A TOKEN, except the histogram's two. Its salmon bars and the
// violet band behind them are the same in both themes and sit on a drawing, not
// on the room, so they are the named constants below — the arrangement
// `design/tokens/token-map.md` records for values that are identical in both
// themes. Nothing theme-dependent is ever a constant.
//
// VALUES ARE 0–1. Each chart takes its series already scaled to the unit
// interval, so the drawing never decides what a number means.

import { useId } from "react";

import { t } from "@/lib/theme/tokens";

/** The highlighted bars of a histogram. Identical in both themes. */
const HISTOGRAM_HIGHLIGHT = "#E8A283";
/** The band behind them. Identical in both themes. */
const HISTOGRAM_BAND = "rgba(140,120,196,.14)";

/** `useId()` is `:r0:`, which is not valid in a `url(#…)`. */
function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const f = (n: number) => n.toFixed(1);

interface ChartBase {
  width: number;
  height: number;
  /** An accessible name. Absent, the chart is decorative and hidden from assistive tech. */
  label?: string;
}

const svgA11y = (label?: string) =>
  label ? ({ role: "img", "aria-label": label } as const) : ({ "aria-hidden": true } as const);

/* ── LineChart ─────────────────────────────────────────────────────────── */

export interface LineChartProps extends ChartBase {
  /** The series, 0–1, oldest first. */
  values: readonly number[];
  /** Where the marker falls: the point at which something changed (a rebuild went live). */
  markerIndex: number;
}

/** Room under the series and over it, so a series never touches either edge. */
const LINE_BOTTOM = 14;
const LINE_TOP = 8;
/** Height of the tick band along the bottom, and of its short ticks. */
const TICK_BAND = 10;
const TICK_SHORT = 6;

export function LineChart({ width, height, values, markerIndex, label }: LineChartProps) {
  const gradient = useSvgId("line-fill");
  const n = values.length;
  const baseline = height - TICK_BAND;
  const x = (i: number) => (n > 1 ? (i * width) / (n - 1) : 0);
  const y = (v: number) => height - LINE_BOTTOM - clamp01(v) * (height - LINE_BOTTOM - LINE_TOP);
  const point = (i: number) => `${f(x(i))},${f(y(values[i]))}`;

  const marker = Math.min(Math.max(Math.round(markerIndex), 0), Math.max(n - 1, 0));
  const before = values.map((_, i) => i).slice(0, marker + 1);
  const after = values.map((_, i) => i).slice(marker);
  const mx = x(marker);

  return (
    <svg
      data-ui="chart-line"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
      {...svgA11y(label)}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.evidence} stopOpacity=".28" />
          <stop offset="1" stopColor={t.evidence} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[1, 2, 3, 4, 5].map((k) => (
        <line key={k} x1={f((k * width) / 6)} y1={0} x2={f((k * width) / 6)} y2={baseline} stroke={t.hairline} />
      ))}
      {Array.from({ length: 101 }, (_, k) => {
        const tx = f((k * width) / 100);
        return (
          <line
            key={k}
            x1={tx}
            y1={k % 5 === 0 ? baseline : height - TICK_SHORT}
            x2={tx}
            y2={height}
            stroke={t.line}
          />
        );
      })}
      {n > 0 ? (
        <>
          <path
            d={`M${f(mx)},${baseline} ${after.map((i) => `L${point(i)}`).join(" ")} L${width},${baseline} Z`}
            fill={`url(#${gradient})`}
          />
          <polyline
            points={before.map(point).join(" ")}
            fill="none"
            stroke={t.label}
            strokeWidth={1.5}
            opacity={0.7}
          />
          <polyline points={after.map(point).join(" ")} fill="none" stroke={t.evidence} strokeWidth={1.8} />
          <line x1={f(mx)} y1={0} x2={f(mx)} y2={height} stroke={t.text} strokeWidth={1.4} strokeDasharray="3 3" />
        </>
      ) : null}
    </svg>
  );
}

/* ── StepChart ─────────────────────────────────────────────────────────── */

export interface StepPoint {
  /** Where along the width this level begins, 0–1. The first point is at 0. */
  at: number;
  /** The level it holds until the next point, 0–1. */
  value: number;
}

export interface StepChartProps extends ChartBase {
  points: readonly StepPoint[];
}

export function StepChart({ width, height, points, label }: StepChartProps) {
  const gradient = useSvgId("step-fill");
  const px = (p: StepPoint) => clamp01(p.at) * width;
  const py = (p: StepPoint) => height * (1 - clamp01(p.value));

  /* Step-after: each level is held to the next point's x, then the line rises
     (or falls) at that x. The last level runs to the right edge. */
  let line = "";
  points.forEach((p, i) => {
    line += i === 0 ? `M0 ${f(py(p))}` : ` L${f(px(p))} ${f(py(points[i - 1]))} L${f(px(p))} ${f(py(p))}`;
  });
  if (points.length) line += ` L${width} ${f(py(points[points.length - 1]))}`;

  return (
    <svg
      data-ui="chart-step"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
      {...svgA11y(label)}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.catAgents} stopOpacity=".4" />
          <stop offset="1" stopColor={t.catAgents} stopOpacity=".03" />
        </linearGradient>
      </defs>
      {[1, 2, 3, 4, 5, 6].map((k) => (
        <line key={k} x1={f((k * width) / 7)} y1={0} x2={f((k * width) / 7)} y2={height} stroke={t.hairline} />
      ))}
      {points.length ? (
        <>
          <path d={`M0 ${height} L${line.slice(1)} L${width} ${height} Z`} fill={`url(#${gradient})`} />
          <path d={line} fill="none" stroke={t.catAgents} strokeWidth={1.6} />
        </>
      ) : null}
    </svg>
  );
}

/* ── Sparkline ─────────────────────────────────────────────────────────── */

export interface SparklineProps {
  values: readonly number[];
  /** 54–60 in the design. */
  width?: number;
  /** 18–20 in the design. */
  height?: number;
  label?: string;
}

export function Sparkline({ values, width = 60, height = 20, label }: SparklineProps) {
  const n = values.length;
  const points = values
    .map((v, i) => `${f(n > 1 ? (i * width) / (n - 1) : 0)},${f(2 + (1 - clamp01(v)) * (height - 4))}`)
    .join(" ");
  return (
    <svg
      data-ui="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", flexShrink: 0 }}
      {...svgA11y(label)}
    >
      <polyline points={points} fill="none" stroke={t.evidence} strokeWidth={1.4} />
    </svg>
  );
}

/* ── Histogram ─────────────────────────────────────────────────────────── */

export interface HistogramProps extends ChartBase {
  /** One bar per value, 0–1. */
  values: readonly number[];
  /** The first highlighted bar. Bars from here on are salmon, with a band behind them. */
  fromIndex: number;
}

/** Nothing uses this yet: it exists so the catalogue's Charts section compares, and so a distribution has a drawn form the day one is needed. */
export function Histogram({ width, height, values, fromIndex, label }: HistogramProps) {
  const n = values.length;
  const bw = n > 0 ? width / n : 0;
  const from = Math.min(Math.max(Math.round(fromIndex), 0), n);

  return (
    <svg
      data-ui="chart-histogram"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
      {...svgA11y(label)}
    >
      {from < n ? (
        <rect x={f(from * bw)} y={0} width={f(width - from * bw)} height={height} fill={HISTOGRAM_BAND} />
      ) : null}
      {values.map((v, k) => {
        const h = Math.max(4, clamp01(v) * (height - 6));
        return (
          <rect
            key={k}
            x={f(k * bw + 2)}
            y={f(height - h)}
            width={f(bw - 4)}
            height={f(h)}
            fill={k >= from ? HISTOGRAM_HIGHLIGHT : t.barBase}
          />
        );
      })}
    </svg>
  );
}
