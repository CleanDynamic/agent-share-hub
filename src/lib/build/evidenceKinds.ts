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

/* ── the one control's draft: the Check window, the Details row and a comparison row all edit evidence through it ── */

/** Evidence as it is stored (a Check's `payload.evidence`, a comparison row's `evidence`). */
export interface EvidencePayload {
  kind?: EvidenceKind;
  url?: string;
  media_id?: string;
  name?: string;
  measurement?: EvidenceMeasurement;
  text?: string;
}

/** Evidence as typed: every field a string, so a half-made measurement can be held until it is whole. */
export interface EvidenceDraft {
  kind: EvidenceKind | "";
  url: string;
  metric: string;
  unit: string;
  before: string;
  after: string;
  runs: string;
  text: string;
  /** An uploaded file kept as the evidence: carried, not edited. */
  mediaId: string;
  name: string;
}

export const EMPTY_EVIDENCE: EvidenceDraft = { kind: "", url: "", metric: "", unit: "", before: "", after: "", runs: "", text: "", mediaId: "", name: "" };

const str = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * The draft for stored evidence. Evidence from before kinds reads as a link when it is an address and as test output when it is a
 * file, the same in every place it is edited.
 */
export function evidenceDraftOf(raw: unknown): EvidenceDraft {
  if (!isRecord(raw)) return { ...EMPTY_EVIDENCE };
  const measurement = measurementOf(raw.measurement);
  const url = str(raw.url);
  const mediaId = str(raw.media_id) || str(raw.mediaId);
  const kind = EVIDENCE_KINDS.includes(raw.kind as EvidenceKind) ? (raw.kind as EvidenceKind) : measurement ? "measurement" : url ? "link" : mediaId || str(raw.text) ? "test_output" : "";
  return {
    kind,
    url,
    metric: measurement?.metric ?? "",
    unit: measurement?.unit ?? "",
    before: measurement ? String(measurement.before) : "",
    after: measurement ? String(measurement.after) : "",
    runs: measurement ? String(measurement.runs) : "",
    text: str(raw.text),
    mediaId,
    name: str(raw.name),
  };
}

/** Why a draft cannot be saved, or null. An empty draft is fine: it is no evidence. */
export function evidenceDraftRefusal(draft: EvidenceDraft): string | null {
  if (draft.kind === "measurement") {
    const touched = [draft.metric, draft.before, draft.after, draft.runs].some((part) => part.trim() !== "");
    return touched ? measurementRefusal({ metric: draft.metric, unit: draft.unit, before: draft.before.trim() === "" ? NaN : Number(draft.before), after: draft.after.trim() === "" ? NaN : Number(draft.after), runs: draft.runs.trim() === "" ? NaN : Number(draft.runs) }) : null;
  }
  if (draft.kind === "test_output" && draft.text.length > EVIDENCE_TEXT_MAX) return `Test output: ${EVIDENCE_TEXT_MAX.toLocaleString("en-GB")} characters max`;
  if (draft.kind !== "test_output" && draft.url.trim() && !/^https?:\/\//i.test(draft.url.trim()) && !/^[a-z0-9.-]+\.[a-z]{2,}/i.test(draft.url.trim())) return "Format: example.com/results";
  return null;
}

/** What a draft stores; null when it holds nothing. A draft that is refused stores nothing: the caller checks `evidenceDraftRefusal` first. */
export function evidenceFromDraft(draft: EvidenceDraft): EvidencePayload | null {
  const kind = draft.kind || undefined;
  if (draft.mediaId) return { ...(kind ? { kind } : null), media_id: draft.mediaId, ...(draft.name ? { name: draft.name } : null) };
  if (kind === "measurement") {
    const m = measurementOf({ metric: draft.metric, unit: draft.unit, before: Number(draft.before), after: Number(draft.after), runs: Number(draft.runs) });
    return m ? { kind, measurement: m } : null;
  }
  if (kind === "test_output") return draft.text.trim() ? { kind, text: draft.text.trim() } : null;
  return draft.url.trim() ? { ...(kind ? { kind } : null), url: draft.url.trim() } : null;
}
