/* CA-03 P5, CA-15 P5: Add › "Check": a test that verifies this part of the build.

   The shared modal frame, 520 wide (a `BottomSheet` below 768). Required, in this order:

   - Test description: a well, 3 rows, 1 to 280 characters.
   - Pass criteria: a well, 2 rows, 1 to 280.
   - Runs: a nested panel (`--flat` fill, `--line` edge) with two small number fields, "{passed} passed out of {total}", whole
     numbers from 0 to 10,000, the pass rate in mono and a 6px bar filled to the rate in `--evidence` on a `--bar-base` track.
     With test cases given, the numbers are worked out from them and Runs need not be typed (today's rule, kept).

   Optional, in this order: Test cases, Failure notes, Last run date (typed as 2026-10-12, no browser date picker), Test method,
   Reviewer, Scoring method, Model tested, Evidence (a URL or one file).

   A field it refuses says why in plain words ("Passed can't be more than the total."), with the same words `addCheck` refuses
   with. A check is evidence the maker gives: it never touches the lamp, the plaque or a reproduction. */

import { useId, useRef, useState, type CSSProperties } from "react";

import { Segmented } from "@/components/brand/Segmented";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { CHECK_FAIL_MAX, CHECK_TEXT_MAX, checkRefusal, type CheckCase, type CheckInput } from "@/lib/build/graph";
import { MEDIA_MAX_BYTES, fileKindFor } from "@/lib/build/media";
import {
  CHECK_METHODS,
  CHECK_METHOD_LABEL,
  CHECK_REVIEWERS,
  CHECK_REVIEWER_LABEL,
  MODEL_VERSION_MAX,
  SCORING_HOWS,
  SCORING_LABEL,
  SCORING_TARGET_MAX,
  cleanUrl,
  type CheckMethod,
  type CheckReviewer,
  type ScoringHow,
} from "@/lib/build/tileExtras";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { CheckCasesField, keptCases } from "./CheckCasesField";
import { ChoiceGrid } from "./ChoiceGrid";
import { Field, TextButton } from "./composeControls";
import { ModalForm, ModalShell, SectionHeading, firstMissing } from "./ModalFrame";
import { ModelPicker } from "./ModelPicker";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { text, tnum, typedArea, typedField } from "./refinedStyles";

export const CHECK_DIALOG_COPY = {
  title: "Add a check",
  subtitle: "A test that verifies this part of the build",
  tested: "Test description",
  testedPlaceholder: "e.g. Places a test order for 2 sourdough loaves",
  passing: "Pass criteria",
  passingPlaceholder: "e.g. The total shows £9.00",
  runs: "Runs",
  passed: "Passed",
  total: "Total",
  passedOf: "passed out of",
  passRate: "Pass rate",
  fromCases: "Worked out from the test cases",
  failed: "Failure notes",
  failedLine: "What went wrong, and what changed before it ran again",
  failedPlaceholder: "e.g. The total showed 0.00 until the basket was refreshed",
  lastRun: "Last run date",
  lastRunLine: "The day it last ran, written as 2026-10-12",
  lastRunPlaceholder: "e.g. 2026-10-12",
  casesLine: "What went in, what was expected, what came out",
  method: "Test method",
  methodLine: "How the test was carried out",
  reviewer: "Reviewer",
  reviewerLine: "Who judged the result",
  scoring: "Scoring method",
  scoringLine: "How the result was scored",
  target: "Target",
  targetPlaceholder: "e.g. 95% of answers correct",
  modelTested: "Model tested",
  modelTestedLine: "The model, and its version, the test ran against",
  version: "Version",
  versionPlaceholder: "e.g. 2026-09-30",
  evidence: "Evidence",
  evidenceLine: "A URL, or one file, that shows the result",
  evidenceUrl: "Evidence URL",
  evidenceUrlPlaceholder: "e.g. example.com/results",
  evidenceFile: "Choose an evidence file",
  evidenceBad: "Evidence is a URL, like example.com/results.",
  remove: "Remove",
  add: "Add",
  cancel: "Cancel",
} as const;

export type AddCheckInput = Omit<CheckInput, "testedStep" | "evidence"> & {
  /** CA-15 P5: evidence is a URL, or one file the page stores. */
  evidenceUrl?: string;
  evidenceFile?: File | null;
};

export interface AddCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddCheckInput) => void;
}

/** A count as typed: digits only, and empty reads as nothing yet. */
const countOf = (raw: string): number => (raw.trim() === "" ? Number.NaN : Number(raw));

function Form({ onAdd, onCancel, phone }: Pick<AddCheckDialogProps, "onAdd"> & { onCancel: () => void; phone: boolean }) {
  const [tested, setTested] = useState("");
  const [passing, setPassing] = useState("");
  const [failed, setFailed] = useState("");
  const [passed, setPassed] = useState("");
  const [total, setTotal] = useState("");
  const [runAt, setRunAt] = useState("");
  const [cases, setCases] = useState<CheckCase[]>([]);
  const [method, setMethod] = useState<CheckMethod | null>(null);
  const [reviewer, setReviewer] = useState<CheckReviewer | null>(null);
  const [scoring, setScoring] = useState<ScoringHow | null>(null);
  const [target, setTarget] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const [version, setVersion] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [fileWrong, setFileWrong] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const uid = useId();

  const given = keptCases(cases);
  const fromCases = given.length > 0;
  const casesCount = given.filter((c) => c.passed).length;
  const shownPassed = fromCases ? String(casesCount) : passed;
  const shownTotal = fromCases ? String(given.length) : total;
  const input = { tested, passing, onFail: failed, passed: countOf(passed), total: countOf(total), runAt, ...(fromCases ? { cases: given } : null) };
  const why = checkRefusal(input) ?? (evidenceUrl.trim() && !cleanUrl(evidenceUrl) ? CHECK_DIALOG_COPY.evidenceBad : null);
  const missing = firstMissing([
    [tested.trim().length > 0, "a test description"],
    [passing.trim().length > 0, "pass criteria"],
    [fromCases || (passed.trim() !== "" && total.trim() !== ""), "runs or a test case"],
  ]);

  const rate = (() => {
    const p = Number(shownPassed);
    const n = Number(shownTotal);
    return shownPassed !== "" && shownTotal !== "" && n > 0 && p <= n ? p / n : null;
  })();
  const count: CSSProperties = { ...text(11.5, 400, t.text2), ...tnum, alignSelf: "flex-end" };
  const small = (value: string, set: (next: string) => void, label: string) => (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      maxLength={5}
      value={value}
      readOnly={fromCases}
      onChange={(event) => set(event.target.value.replace(/[^0-9]/g, ""))}
      style={typedField(phone, { width: 72, ...tnum })}
    />
  );

  const chooseEvidence = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    const decided = fileKindFor(file);
    if ("refused" in decided) setFileWrong(decided.refused);
    else if (file.size > MEDIA_MAX_BYTES) setFileWrong(`${file.name} is too big. The most is 25 MB.`);
    else {
      setFileWrong(null);
      setEvidenceFile(file);
    }
  };

  const submit = () => {
    setTried(true);
    if (why) return;
    const onFail = failed.trim() || null;
    onAdd({
      ...input,
      tested: tested.trim(),
      passing: passing.trim(),
      onFail,
      runAt: runAt.trim() || null,
      ...(method ? { method } : null),
      ...(reviewer ? { reviewer } : null),
      ...(scoring ? { scoring: { how: scoring, ...(scoring === "metric" && target.trim() ? { target: target.trim() } : null) } } : null),
      ...(model?.trim() || version.trim() ? { modelTested: { model: (model ?? "").trim(), version: version.trim() } } : null),
      ...(evidenceFile ? { evidenceFile } : evidenceUrl.trim() ? { evidenceUrl: evidenceUrl.trim() } : null),
    });
  };

  return (
    <ModalForm phone={phone} onSubmit={submit} onCancel={onCancel} missing={missing} alert={tried && why ? why : null}>
      <Field id={`${uid}-tested`} label={CHECK_DIALOG_COPY.tested}>
        <textarea id={`${uid}-tested`} rows={3} maxLength={CHECK_TEXT_MAX} value={tested} placeholder={CHECK_DIALOG_COPY.testedPlaceholder} onChange={(event) => setTested(event.target.value)} style={typedArea(phone)} />
        <span style={count}>
          {tested.length} / {CHECK_TEXT_MAX}
        </span>
      </Field>

      <Field id={`${uid}-passing`} label={CHECK_DIALOG_COPY.passing}>
        <textarea id={`${uid}-passing`} rows={2} maxLength={CHECK_TEXT_MAX} value={passing} placeholder={CHECK_DIALOG_COPY.passingPlaceholder} onChange={(event) => setPassing(event.target.value)} style={typedArea(phone)} />
      </Field>

      <div role="group" aria-label={CHECK_DIALOG_COPY.runs} data-testid="check-runs" style={{ background: t.flat, border: `1px solid ${t.line}`, borderRadius: 6, padding: 12, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <SectionHeading>{CHECK_DIALOG_COPY.runs}</SectionHeading>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {small(shownPassed, setPassed, CHECK_DIALOG_COPY.passed)}
          <span style={text(13, 400, t.text2)}>{CHECK_DIALOG_COPY.passedOf}</span>
          {small(shownTotal, setTotal, CHECK_DIALOG_COPY.total)}
          <span data-testid="check-rate" aria-label={CHECK_DIALOG_COPY.passRate} style={{ marginLeft: "auto", fontFamily: DM_MONO, fontSize: 13, color: t.text, ...tnum }}>
            {rate === null ? "" : `${Math.round(rate * 100)}%`}
          </span>
        </div>
        <div aria-hidden="true" data-testid="check-bar" style={{ height: 6, borderRadius: 3, background: t.barBase, overflow: "hidden" }}>
          <div data-testid="check-bar-fill" style={{ height: "100%", width: `${Math.round((rate ?? 0) * 100)}%`, background: t.evidence }} />
        </div>
        {fromCases ? <span style={text(12, 400, t.label)}>{CHECK_DIALOG_COPY.fromCases}</span> : null}
      </div>

      <OptionalSection>
        <OptionalField name="Test cases" description={CHECK_DIALOG_COPY.casesLine} summary={fromCases ? `${given.length} ${given.length === 1 ? "test case" : "test cases"}, ${casesCount} passed` : null} phone={phone}>
          <CheckCasesField id={uid} cases={cases} phone={phone} onChange={setCases} bare />
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.failed} description={CHECK_DIALOG_COPY.failedLine} summary={summaryOf(failed)} phone={phone}>
          <textarea aria-label={CHECK_DIALOG_COPY.failed} rows={3} maxLength={CHECK_FAIL_MAX} value={failed} placeholder={CHECK_DIALOG_COPY.failedPlaceholder} onChange={(event) => setFailed(event.target.value)} style={typedArea(phone)} />
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.lastRun} description={CHECK_DIALOG_COPY.lastRunLine} summary={summaryOf(runAt)} phone={phone}>
          <input
            aria-label={CHECK_DIALOG_COPY.lastRun}
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={runAt}
            placeholder={CHECK_DIALOG_COPY.lastRunPlaceholder}
            onChange={(event) => setRunAt(event.target.value.replace(/[^0-9-]/g, ""))}
            style={typedField(phone, { width: 128, ...tnum })}
          />
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.method} description={CHECK_DIALOG_COPY.methodLine} summary={method ? CHECK_METHOD_LABEL[method] : null} phone={phone}>
          <ChoiceGrid<CheckMethod> label={CHECK_DIALOG_COPY.method} items={CHECK_METHODS.map((value) => ({ value, label: CHECK_METHOD_LABEL[value] }))} value={method} onChange={setMethod} phone={phone} allowClear />
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.reviewer} description={CHECK_DIALOG_COPY.reviewerLine} summary={reviewer ? CHECK_REVIEWER_LABEL[reviewer] : null} phone={phone}>
          <Segmented<CheckReviewer>
            label={CHECK_DIALOG_COPY.reviewer}
            semantics="radio"
            size={phone ? 50 : 30}
            fontSize={13}
            fullWidth
            items={CHECK_REVIEWERS.map((value) => ({ value, label: CHECK_REVIEWER_LABEL[value] }))}
            value={reviewer ?? ("" as CheckReviewer)}
            onChange={(next) => setReviewer((current) => (current === next ? null : next))}
          />
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.scoring} description={CHECK_DIALOG_COPY.scoringLine} summary={summaryOf(scoring ? SCORING_LABEL[scoring] : null, scoring === "metric" ? target : null)} phone={phone}>
          <ChoiceGrid<ScoringHow> label={CHECK_DIALOG_COPY.scoring} items={SCORING_HOWS.map((value) => ({ value, label: SCORING_LABEL[value] }))} value={scoring} onChange={setScoring} phone={phone} columns={2} allowClear />
          {scoring === "metric" ? (
            <input aria-label={CHECK_DIALOG_COPY.target} type="text" maxLength={SCORING_TARGET_MAX} value={target} placeholder={CHECK_DIALOG_COPY.targetPlaceholder} onChange={(event) => setTarget(event.target.value)} style={typedField(phone)} />
          ) : null}
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.modelTested} description={CHECK_DIALOG_COPY.modelTestedLine} summary={summaryOf(model, version)} phone={phone}>
          <Field id={`${uid}-model`} label="Model" group>
            <div>
              <ModelPicker tool={null} anyWithoutTool value={model} onChange={setModel} phone={phone} />
            </div>
          </Field>
          <Field id={`${uid}-version`} label={CHECK_DIALOG_COPY.version}>
            <input id={`${uid}-version`} type="text" maxLength={MODEL_VERSION_MAX} value={version} placeholder={CHECK_DIALOG_COPY.versionPlaceholder} onChange={(event) => setVersion(event.target.value)} style={typedField(phone)} />
          </Field>
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.evidence} description={CHECK_DIALOG_COPY.evidenceLine} summary={summaryOf(evidenceFile?.name, evidenceFile ? null : evidenceUrl)} phone={phone}>
          <input
            aria-label={CHECK_DIALOG_COPY.evidenceUrl}
            type="text"
            inputMode="url"
            disabled={Boolean(evidenceFile)}
            value={evidenceUrl}
            placeholder={CHECK_DIALOG_COPY.evidenceUrlPlaceholder}
            onChange={(event) => setEvidenceUrl(event.target.value)}
            style={typedField(phone)}
          />
          <input
            ref={picker}
            data-testid="check-evidence-file"
            type="file"
            aria-label={CHECK_DIALOG_COPY.evidenceFile}
            disabled={evidenceUrl.trim().length > 0}
            onChange={(event) => {
              chooseEvidence(event.target.files);
              event.target.value = "";
            }}
            style={{ ...text(13, 400, t.text), maxWidth: "100%" }}
          />
          {evidenceFile ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ ...text(13, 400, t.text), overflowWrap: "anywhere" }}>{evidenceFile.name}</span>
              <TextButton target={phone} onClick={() => setEvidenceFile(null)} style={text(12, 500, t.text2)}>
                {`${CHECK_DIALOG_COPY.remove} ${evidenceFile.name}`}
              </TextButton>
            </div>
          ) : null}
          {fileWrong ? (
            <span role="alert" style={text(12.5, 400, t.text2)}>
              {fileWrong}
            </span>
          ) : null}
        </OptionalField>
      </OptionalSection>
    </ModalForm>
  );
}

export function AddCheckDialog({ open, onOpenChange, onAdd }: AddCheckDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddCheckInput) => {
    onAdd(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={CHECK_DIALOG_COPY.title} subtitle={CHECK_DIALOG_COPY.subtitle} width={520} testId="add-check-dialog">
      <Form onAdd={add} onCancel={close} phone={phone} />
    </ModalShell>
  );
}

export default AddCheckDialog;
