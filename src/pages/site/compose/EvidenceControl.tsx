/* SV-30 P8: the one control that edits a piece of evidence: what kind it is, and the thing itself (a link, a measurement of five
   numbers, or pasted output). The Check's window, the Check's Details row and each comparison row all use it, so it says the same
   words everywhere. It holds nothing: the caller keeps the draft and decides when to save. */

import {
  EVIDENCE_KINDS,
  EVIDENCE_KIND_LABEL,
  EVIDENCE_TEXT_MAX,
  MEASURE_METRIC_MAX,
  MEASURE_UNIT_MAX,
  evidenceDraftRefusal,
  type EvidenceDraft,
  type EvidenceKind,
} from "@/lib/build/evidenceKinds";
import { t } from "@/lib/theme/tokens";

import { ChoiceGrid } from "./ChoiceGrid";
import { text, typedArea, typedField } from "./refinedStyles";

export const EVIDENCE_COPY = {
  kind: "Kind of evidence",
  url: "Evidence URL",
  metric: "What was measured",
  unit: "Unit",
  before: "Before",
  after: "After",
  runs: "Runs measured",
  output: "Pasted output",
  attached: (name: string) => `${name} attached`,
} as const;

const number = (raw: string): string => raw.replace(/[^0-9.\-]/g, "");

export function EvidenceControl({
  draft,
  onChange,
  onBlur,
  phone,
  prefix = "",
  fileChosen = false,
}: {
  draft: EvidenceDraft;
  onChange: (next: EvidenceDraft, now?: boolean) => void;
  onBlur?: () => void;
  phone: boolean;
  prefix?: string;
  fileChosen?: boolean;
}) {
  const label = (words: string) => `${prefix}${words}`;
  const set = (patch: Partial<EvidenceDraft>, now = false) =>
    onChange({ ...draft, ...patch }, now);
  const why = evidenceDraftRefusal(draft);
  const input = (
    key: keyof EvidenceDraft,
    words: string,
    options: {
      max: number;
      placeholder?: string;
      mono?: boolean;
      numeric?: boolean;
      width?: number;
      disabled?: boolean;
    },
  ) => (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        ...(options.width ? { width: options.width } : { flex: "1 1 160px" }),
      }}
    >
      <span style={text(12, 400, t.label)}>{words}</span>
      <input
        type="text"
        aria-label={label(words)}
        value={draft[key]}
        maxLength={options.max}
        disabled={options.disabled}
        placeholder={options.placeholder}
        inputMode={options.numeric ? "decimal" : undefined}
        onChange={(event) =>
          set({
            [key]: options.numeric
              ? number(event.target.value)
              : event.target.value,
          } as Partial<EvidenceDraft>)
        }
        onBlur={onBlur}
        style={typedField(
          phone,
          options.mono ? { fontFamily: "var(--font-data)" } : undefined,
        )}
      />
    </label>
  );
  return (
    <div
      data-testid="evidence-control"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <ChoiceGrid
        label={label(EVIDENCE_COPY.kind)}
        items={EVIDENCE_KINDS.map((value) => ({
          value,
          label: EVIDENCE_KIND_LABEL[value],
        }))}
        value={draft.kind || null}
        onChange={(next) =>
          set({ kind: (next ?? "") as EvidenceKind | "" }, true)
        }
        phone={phone}
        allowClear
        columns={2}
      />
      {draft.mediaId ? (
        <span style={text(12.5, 400, t.text2)}>
          {EVIDENCE_COPY.attached(draft.name || "A file")}
        </span>
      ) : null}
      {draft.kind === "measurement" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {input("metric", EVIDENCE_COPY.metric, {
            max: MEASURE_METRIC_MAX,
            placeholder: "Latency",
          })}
          {input("unit", EVIDENCE_COPY.unit, {
            max: MEASURE_UNIT_MAX,
            placeholder: "ms",
            width: 96,
          })}
          {input("before", EVIDENCE_COPY.before, {
            max: 14,
            numeric: true,
            mono: true,
            width: 112,
          })}
          {input("after", EVIDENCE_COPY.after, {
            max: 14,
            numeric: true,
            mono: true,
            width: 112,
          })}
          {input("runs", EVIDENCE_COPY.runs, {
            max: 7,
            numeric: true,
            mono: true,
            width: 96,
          })}
        </div>
      ) : draft.kind === "test_output" ? (
        draft.mediaId ? null : (
          <textarea
            aria-label={label(EVIDENCE_COPY.output)}
            rows={5}
            maxLength={EVIDENCE_TEXT_MAX}
            value={draft.text}
            onChange={(event) => set({ text: event.target.value })}
            onBlur={onBlur}
            style={typedArea(phone, { fontFamily: "var(--font-data)" })}
          />
        )
      ) : draft.mediaId ? null : (
        input("url", EVIDENCE_COPY.url, { max: 2000, disabled: fileChosen })
      )}
      {why ? <span style={text(12, 400, t.text2)}>{why}</span> : null}
    </div>
  );
}
