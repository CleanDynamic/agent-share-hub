// SV-30 P8: what kind of evidence a Check carries. PURE.
//
// A Check says what it tested; its evidence is the thing a reader can inspect. A claim with nothing attached reads `Stated, no
// artefact`: it is not evidence. A recording or a video can be an uploaded `recording` node (a media id) or a link.

export const EVIDENCE_KINDS = ["recording", "video", "measurement", "test_output", "link"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  recording: "End-to-end recording",
  video: "Demo video",
  measurement: "Before and after measurement",
  test_output: "Test run output",
  link: "Link",
};

export const STATED_NO_ARTEFACT = "Stated, no artefact";
export const EVIDENCE_TEXT_MAX = 8000;
export const MEASURE_METRIC_MAX = 40;
export const MEASURE_UNIT_MAX = 12;
export const MEASURE_RUNS_MAX = 1_000_000;

export interface EvidenceMeasurement {
  metric: string;
  unit: string;
  before: number;
  after: number;
  runs: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** A stored measurement, read defensively; null when it is not whole. */
export function measurementOf(raw: unknown): EvidenceMeasurement | null {
  if (!isRecord(raw)) return null;
  const metric = typeof raw.metric === "string" ? raw.metric.trim().slice(0, MEASURE_METRIC_MAX) : "";
  const unit = typeof raw.unit === "string" ? raw.unit.trim().slice(0, MEASURE_UNIT_MAX) : "";
  if (!metric || !finite(raw.before) || !finite(raw.after) || !Number.isInteger(raw.runs) || (raw.runs as number) < 1 || (raw.runs as number) > MEASURE_RUNS_MAX) return null;
  return { metric, unit, before: raw.before, after: raw.after, runs: raw.runs as number };
}

/** Why a measurement cannot be saved, or null. */
export function measurementRefusal(raw: unknown): string | null {
  if (!isRecord(raw)) return "Say what was measured.";
  const metric = typeof raw.metric === "string" ? raw.metric.trim() : "";
  if (!metric) return "Say what was measured.";
  if (metric.length > MEASURE_METRIC_MAX) return `Metric: ${MEASURE_METRIC_MAX} characters max`;
  if (typeof raw.unit === "string" && raw.unit.trim().length > MEASURE_UNIT_MAX) return `Unit: ${MEASURE_UNIT_MAX} characters max`;
  if (!finite(raw.before) || !finite(raw.after)) return "Before and after are numbers.";
  if (!Number.isInteger(raw.runs) || (raw.runs as number) < 1) return "Runs is a whole number from 1.";
  return null;
}

const withUnit = (value: number, unit: string): string => {
  const said = String(Math.round(value * 1000) / 1000);
  return unit ? (unit === "%" || unit === "x" ? `${said}${unit}` : `${said} ${unit}`) : said;
};

/** "Before 120 ms · after 58 ms · 20 runs". */
export const measurementLine = (m: EvidenceMeasurement): string => `Before ${withUnit(m.before, m.unit)} · after ${withUnit(m.after, m.unit)} · ${m.runs.toLocaleString("en-GB")} ${m.runs === 1 ? "run" : "runs"}`;

export interface EvidenceFacts {
  kind?: EvidenceKind;
  url: string | null;
  mediaId: string | null;
  name: string | null;
  measurement?: EvidenceMeasurement | null;
  text?: string | null;
}

/** What a reader is told about a Check's evidence; `Stated, no artefact` when there is none. Evidence from before kinds reads as a link or a file. */
export function evidenceText(evidence: EvidenceFacts | null | undefined): string {
  if (!evidence) return STATED_NO_ARTEFACT;
  if (evidence.measurement) return `${evidence.measurement.metric} · ${measurementLine(evidence.measurement)}`;
  const what = evidence.mediaId ? (evidence.name ?? "A file") : evidence.url ? evidence.url : evidence.text ? "Pasted output" : "";
  if (!what) return STATED_NO_ARTEFACT;
  return evidence.kind && evidence.kind !== "link" ? `${EVIDENCE_KIND_LABEL[evidence.kind]} · ${what}` : what;
}
