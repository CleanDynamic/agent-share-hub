/* UI-P12 — the Charts section: line, step, histogram, sparkline and the activity
   grid, with the reference catalogue's own series so the drawings compare. The
   series are the reference's polylines read back into 0–1. */

import { ActivityGrid, type ActivityDay } from "@/components/brand/ActivityGrid";
import { Histogram, LineChart, Sparkline, StepChart } from "@/components/brand/charts";

import { Example, Row, Section } from "./parts";

const LINE = [
  0.463, 0.407, 0.393, 0.345, 0.284, 0.27, 0.329, 0.37, 0.408, 0.369, 0.374, 0.343, 0.297, 0.25, 0.25, 0.31, 0.356,
  0.399, 0.441, 0.398, 0.371, 0.389, 0.421, 0.641, 0.695, 0.637, 0.651, 0.676, 0.677, 0.632, 0.628, 0.57, 0.631,
  0.682, 0.689, 0.66, 0.718, 0.729, 0.782, 0.831, 0.832, 0.819, 0.834, 0.823, 0.777, 0.749, 0.793, 0.729, 0.665,
  0.683, 0.652, 0.657, 0.653, 0.631, 0.701, 0.658, 0.646, 0.604, 0.622, 0.592, 0.571, 0.606, 0.581, 0.589,
];
const STEP = [
  { at: 0, value: 0.18 },
  { at: 0.1, value: 0.42 },
  { at: 0.28, value: 0.6 },
  { at: 0.52, value: 0.66 },
  { at: 0.74, value: 0.82 },
];
const HISTOGRAM = [0.04, 0.08, 0.2, 0.34, 0.45, 0.6, 0.72, 0.8, 0.56, 0.42, 0.22, 0.14, 0.08, 0.04];
const SPARK = [
  0.431, 0.444, 0.412, 0.438, 0.469, 0.356, 0.25, 0.338, 0.275, 0.25, 0.381, 0.369, 0.456, 0.45, 0.488, 0.4, 0.431,
  0.531, 0.537, 0.6, 0.644, 0.531,
];

/** The reference's 22 weeks: 0 empty, 1–4 volume, F frozen. Counts equal the level, which the quartile rule maps to itself. */
const WEEKS = [
  "222323F", "1323010", "11F0032", "02020F3", "0043041", "2032430", "000F02F", "2002101", "2F4F23F", "201FF04",
  "0233001", "20223F3", "0023031", "000F024", "0F41101", "311F3F1", "3023220", "1030143", "4112101", "0044210",
  "0023022", "2220201",
];
const DAYS: ActivityDay[] = WEEKS.flatMap((week) =>
  [...week].map((c) => (c === "F" ? { count: 0, frozen: true } : { count: Number(c) })),
);

export function ChartsSection() {
  return (
    <Section name="Charts" note="hand-drawn SVG, no chart library">
      <Row style={{ alignItems: "flex-end" }}>
        <Example caption="line · dashed marker where a rebuild went live">
          <LineChart width={360} height={120} values={LINE} markerIndex={23} />
        </Example>
        <Example caption="step area · solutions over time">
          <StepChart width={360} height={90} points={STEP} />
        </Example>
        <Example caption="histogram · highlighted range">
          <Histogram width={300} height={120} values={HISTOGRAM} fromIndex={9} />
        </Example>
        <Example caption="sparkline">
          <Sparkline values={SPARK} width={60} height={20} />
        </Example>
      </Row>
      <div style={{ height: 18 }} />
      <Row>
        <Example caption="activity grid · amber is light, outlined = frozen day">
          <ActivityGrid days={DAYS} />
        </Example>
      </Row>
    </Section>
  );
}
