/* CA-03 P5, CA-15 P5, CA-15b P2: Add › "Check": a test that verifies this part of the build.

   Built from `modalRecipes` as the board "Add a check" draws it, 560 wide (a `BottomSheet` below 768). Required, in this
   order, each a block:

   - Test description: a text area, 2 rows, 1 to 280 characters, its count at the right ("42 / 280").
   - Pass criteria: a text area, 2 rows, 1 to 280.
   - Runs ("Or add test cases below"): a panel with "80% pass rate" at the left and two 56-wide number fields, "{passed}
     passed out of {total}", whole numbers from 0 to 10,000, then a 6px bar filled to the rate in `--evidence`. With test
     cases given, the numbers are worked out from them and Runs need not be typed (today's rule, kept).

   Optional, in this order: Test cases, Failure notes, Last run date (typed as 2026-10-12, no browser date picker), Test method,
   Reviewer, Scoring method, Model tested, Evidence (a URL or one file).

   A field it refuses says why in plain words ("Passed can't be more than the total."), with the same words `addCheck` refuses
   with. A check is evidence the maker gives: it never touches the lamp, the plaque or a reproduction. */

import { useId, useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { CHECK_FAIL_MAX, CHECK_TEXT_MAX, checkRefusal, type CheckCase, type CheckInput } from "@/lib/build/graph";
import { comparisonPatchRefusal } from "@/lib/build/comparison";
import { failureTypesOf } from "@/lib/build/evalHarness";
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
  cleanExtras,
  cleanUrl,
  type CheckMethod,
  type CheckReviewer,
  type ScoringHow,
} from "@/lib/build/tileExtras";

import { CheckCasesField, keptCases } from "./CheckCasesField";
import { comparisonFields, harnessFields, type EvalChoices, type Extras } from "./EvalHarnessFields";
import { MODAL_COPY, ModalForm, ModalShell, missingLabels, type EditMode } from "./ModalFrame";
import { EMPTY_EVIDENCE, EVIDENCE_KIND_LABEL, evidenceDraftRefusal, evidenceFromDraft, measurementLine, type EvidenceDraft, type EvidencePayload } from "@/lib/build/evidenceKinds";
import { EvidenceControl } from "./EvidenceControl";
import { ModelPicker } from "./ModelPicker";
import { Alert, Block, BlockHead, Count, FieldArea, FieldInput, FileButton, FileLine, Hint, Inline, LabelText, MODAL_WIDTH, NARROW, Panel, PanelBody, RateBar, SegmentedField, Spread } from "./modalRecipes";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";

export const CHECK_DIALOG_COPY = {
  title: "Add a check",
  subtitle: "Test of part of the build",
  tested: "Test description",
  testedPlaceholder: "Places a test order for 2 sourdough loaves",
  passing: "Pass criteria",
  passingPlaceholder: "The total shows £9.00",
  runs: "Runs",
  rateLine: (percent: number) => `${percent}% pass rate`,
  passed: "Passed",
  total: "Total",
  passedOf: "passed out of",
  passRate: "Pass rate",
  fromCases: "From test cases",
  failed: "Failure notes",
  failedLine: "What failed and what changed",
  failedPlaceholder: "The total showed 0.00 until the basket was refreshed",
  lastRun: "Last run date",
  lastRunPlaceholder: "2026-10-12",
  casesLine: "Input, expected output, actual output",
  method: "Test method",
  methodLine: "Manual, automated, test suite, peer review, comparison",
  reviewer: "Reviewer",
  reviewerLine: "Maker, user or client",
  scoring: "Scoring method",
  scoringLine: "Pass or fail, metric vs target, rating, comparison of approaches",
  target: "Target",
  targetPlaceholder: "95% of answers correct",
  modelTested: "Model tested",
  version: "Version",
  versionPlaceholder: "2026-09-30",
  evidence: "Evidence",
  evidenceLine: "Log, screenshot or link",
  evidenceUrl: "Evidence URL",
  evidenceFile: "Upload a file",
  evidenceBad: "Format: example.com/results",
  remove: "Remove",
  add: "Add",
  cancel: "Cancel",
} as const;

export type AddCheckInput = Omit<CheckInput, "testedStep" | "evidence"> & {
  /** CA-15 P5, SV-30 P8: evidence is a kind and a link, a measurement or pasted output, or one file the page stores. `evidence` is what a draft stores; `evidenceDraft` is the draft itself, for the Details row. */
  evidence?: EvidencePayload | null;
  evidenceDraft?: EvidenceDraft;
  evidenceFile?: File | null;
};

/** CA-18: what the form starts with on a check that is there. */
export interface CheckSeed {
  tested: string;
  passing: string;
  failed: string;
  passed: number | null;
  total: number | null;
  runAt: string;
  cases: CheckCase[];
  method: CheckMethod | null;
  reviewer: CheckReviewer | null;
  scoring: ScoringHow | null;
  target: string;
  model: string;
  version: string;
  /** SV-30 P8: the evidence as the one control holds it (a file kept as the evidence is carried in it). */
  evidence: EvidenceDraft;
  /** SV-29: the comparison's and the eval harness's payload keys, as stored. */
  extras?: Extras;
}

export interface AddCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (input: AddCheckInput) => void;
  seed?: CheckSeed | null;
  edit?: EditMode<AddCheckInput>;
  /** SV-29: the tiles a comparison row can name, and the kind of the tile under test. */
  evalChoices?: EvalChoices;
}

/** Why the comparison's and the eval harness's keys cannot be saved, in the writer's own words; null when they can. */
function extrasRefusal(extras: Extras, scoring: ScoringHow | null): string | null {
  const given = Object.fromEntries(Object.entries(extras).filter(([, value]) => value !== null && value !== undefined));
  if (Object.keys(given).length === 0) return null;
  try {
    cleanExtras("eval_run", given);
  } catch (cause) {
    return cause instanceof Error ? cause.message : "That value is not allowed.";
  }
  return comparisonPatchRefusal({ scoring: scoring ? { how: scoring } : undefined }, given);
}

/** A count as typed: digits only, and empty reads as nothing yet. */
const countOf = (raw: string): number => (raw.trim() === "" ? Number.NaN : Number(raw));

function Form({ onAdd, onCancel, phone, seed, edit, evalChoices }: Pick<AddCheckDialogProps, "onAdd" | "seed" | "edit" | "evalChoices"> & { onCancel: () => void; phone: boolean }) {
  const [tested, setTested] = useState(seed?.tested ?? "");
  const [passing, setPassing] = useState(seed?.passing ?? "");
  const [failed, setFailed] = useState(seed?.failed ?? "");
  const [passed, setPassed] = useState(seed?.passed != null ? String(seed.passed) : "");
  const [total, setTotal] = useState(seed?.total != null ? String(seed.total) : "");
  const [runAt, setRunAt] = useState(seed?.runAt ?? "");
  const [cases, setCases] = useState<CheckCase[]>(seed?.cases ?? []);
  const [method, setMethod] = useState<CheckMethod | null>(seed?.method ?? null);
  const [reviewer, setReviewer] = useState<CheckReviewer | null>(seed?.reviewer ?? null);
  const [scoring, setScoring] = useState<ScoringHow | null>(seed?.scoring ?? null);
  const [target, setTarget] = useState(seed?.target ?? "");
  const [model, setModel] = useState<string | null>(seed?.model || null);
  const [version, setVersion] = useState(seed?.version ?? "");
  const [evidence, setEvidence] = useState<EvidenceDraft>(seed?.evidence ?? EMPTY_EVIDENCE);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [fileWrong, setFileWrong] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [extras, setExtras] = useState<Extras>(seed?.extras ?? {});
  const uid = useId();

  const given = keptCases(cases);
  const fromCases = given.length > 0;
  const casesCount = given.filter((c) => c.passed).length;
  const shownPassed = fromCases ? String(casesCount) : passed;
  const shownTotal = fromCases ? String(given.length) : total;
  const input = { tested, passing, onFail: failed, passed: countOf(passed), total: countOf(total), runAt, ...(fromCases ? { cases: given } : null) };
  // A check that is there keeps its counts as they are, so only its text and date are held to the Add rules.
  const why = (edit ? checkRefusal({ ...input, passed: 0, total: 0, cases: undefined }) : checkRefusal(input)) ?? evidenceDraftRefusal(evidence) ?? extrasRefusal(extras, scoring);
  const missing = missingLabels([
    [tested.trim().length > 0, "Test description"],
    [passing.trim().length > 0, "Pass criteria"],
    [fromCases || (passed.trim() !== "" && total.trim() !== ""), "Runs"],
  ]);

  const rate = (() => {
    const p = Number(shownPassed);
    const n = Number(shownTotal);
    return shownPassed !== "" && shownTotal !== "" && n > 0 && p <= n ? p / n : null;
  })();
  const small = (value: string, set: (next: string) => void, label: string) => (
    <FieldInput phone={phone} mono width={NARROW.count} inputMode="numeric" aria-label={label} maxLength={5} value={value} readOnly={fromCases} onChange={(event) => set(event.target.value.replace(/[^0-9]/g, ""))} />
  );

  const chooseEvidence = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    const decided = fileKindFor(file);
    if ("refused" in decided) setFileWrong(decided.refused);
    else if (file.size > MEDIA_MAX_BYTES) setFileWrong(`${file.name}: 25 MB max`);
    else {
      setFileWrong(null);
      setEvidenceFile(file);
    }
  };

  const submit = () => {
    setTried(true);
    if (why) return;
    const onFail = failed.trim() || null;
    (edit ? edit.onSave : (onAdd ?? (() => undefined)))({
      ...input,
      tested: tested.trim(),
      passing: passing.trim(),
      onFail,
      runAt: runAt.trim() || null,
      ...(method ? { method } : null),
      ...(reviewer ? { reviewer } : null),
      ...(scoring ? { scoring: { how: scoring, ...(scoring === "metric" && target.trim() ? { target: target.trim() } : null) } } : null),
      ...(model?.trim() || version.trim() ? { modelTested: { model: (model ?? "").trim(), version: version.trim() } } : null),
      ...(edit || evidenceFromDraft(evidence) || evidenceFile ? { evidenceDraft: evidence } : null),
      ...(evidenceFile ? { evidenceFile } : null),
      ...(!evidenceFile && evidenceFromDraft(evidence) ? { evidence: evidenceFromDraft(evidence) } : null),
      ...(Object.keys(extras).length > 0 ? { extras } : null),
    });
  };

  return (
    <ModalForm phone={phone} onSubmit={submit} onCancel={onCancel} missing={edit ? null : missing} addLabel={edit ? MODAL_COPY.save : undefined} alert={tried && why ? why : null}>
      {edit?.before ? edit.before(input as never) : null}
      <Block noRule>
        <BlockHead label={CHECK_DIALOG_COPY.tested} htmlFor={`${uid}-tested`} count={`${tested.length} / ${CHECK_TEXT_MAX}`} />
        <FieldArea phone={phone} id={`${uid}-tested`} rows={2} maxLength={CHECK_TEXT_MAX} value={tested} placeholder={CHECK_DIALOG_COPY.testedPlaceholder} onChange={(event) => setTested(event.target.value)} />
      </Block>

      <Block>
        <BlockHead label={CHECK_DIALOG_COPY.passing} htmlFor={`${uid}-passing`} />
        <FieldArea phone={phone} id={`${uid}-passing`} rows={2} maxLength={CHECK_TEXT_MAX} value={passing} placeholder={CHECK_DIALOG_COPY.passingPlaceholder} onChange={(event) => setPassing(event.target.value)} />
      </Block>

      <Block label={CHECK_DIALOG_COPY.runs} testId="check-runs">
        <BlockHead label={CHECK_DIALOG_COPY.runs} />
        {edit?.slots?.runs ?? (
        <Panel padding="12px 14px">
          <PanelBody>
            <Spread>
              <Count testId="check-rate">{rate === null ? "" : CHECK_DIALOG_COPY.rateLine(Math.round(rate * 100))}</Count>
              <Inline>
                {small(shownPassed, setPassed, CHECK_DIALOG_COPY.passed)}
                <LabelText>{CHECK_DIALOG_COPY.passedOf}</LabelText>
                {small(shownTotal, setTotal, CHECK_DIALOG_COPY.total)}
              </Inline>
            </Spread>
            <RateBar rate={rate ?? 0} />
            {fromCases ? <Hint>{CHECK_DIALOG_COPY.fromCases}</Hint> : null}
          </PanelBody>
        </Panel>
        )}
      </Block>

      <OptionalSection>
        <OptionalField name="Test cases" description={CHECK_DIALOG_COPY.casesLine} summary={fromCases ? `${given.length} ${given.length === 1 ? "test case" : "test cases"}, ${casesCount} passed` : null} phone={phone}>
          <CheckCasesField id={uid} cases={cases} phone={phone} onChange={setCases} bare failureTypes={failureTypesOf(extras.failure_types).map((type) => type.name)} />
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.failed} description={CHECK_DIALOG_COPY.failedLine} summary={summaryOf(failed)} phone={phone}>
          <FieldArea phone={phone} rows={2} aria-label={CHECK_DIALOG_COPY.failed} maxLength={CHECK_FAIL_MAX} value={failed} placeholder={CHECK_DIALOG_COPY.failedPlaceholder} onChange={(event) => setFailed(event.target.value)} />
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.lastRun} summary={summaryOf(runAt)} phone={phone}>
          <FieldInput phone={phone} mono width={NARROW.date} aria-label={CHECK_DIALOG_COPY.lastRun} inputMode="numeric" maxLength={10} value={runAt} placeholder={CHECK_DIALOG_COPY.lastRunPlaceholder} onChange={(event) => setRunAt(event.target.value.replace(/[^0-9-]/g, ""))} />
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.method} description={CHECK_DIALOG_COPY.methodLine} summary={method ? CHECK_METHOD_LABEL[method] : null} phone={phone}>
          <SegmentedField<CheckMethod> label={CHECK_DIALOG_COPY.method} phone={phone} items={CHECK_METHODS.map((value) => ({ value, label: CHECK_METHOD_LABEL[value] }))} value={method} onChange={(next) => setMethod((current) => (current === next ? null : next))} />
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.reviewer} description={CHECK_DIALOG_COPY.reviewerLine} summary={reviewer ? CHECK_REVIEWER_LABEL[reviewer] : null} phone={phone}>
          <SegmentedField<CheckReviewer> label={CHECK_DIALOG_COPY.reviewer} phone={phone} items={CHECK_REVIEWERS.map((value) => ({ value, label: CHECK_REVIEWER_LABEL[value] }))} value={reviewer} onChange={(next) => setReviewer((current) => (current === next ? null : next))} />
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.scoring} description={CHECK_DIALOG_COPY.scoringLine} summary={summaryOf(scoring ? SCORING_LABEL[scoring] : null, scoring === "metric" ? target : null)} phone={phone}>
          <SegmentedField<ScoringHow> label={CHECK_DIALOG_COPY.scoring} phone={phone} items={SCORING_HOWS.map((value) => ({ value, label: SCORING_LABEL[value] }))} value={scoring} onChange={(next) => setScoring((current) => (current === next ? null : next))} />
          {scoring === "metric" ? <FieldInput phone={phone} aria-label={CHECK_DIALOG_COPY.target} maxLength={SCORING_TARGET_MAX} value={target} placeholder={CHECK_DIALOG_COPY.targetPlaceholder} onChange={(event) => setTarget(event.target.value)} /> : null}
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.modelTested} summary={summaryOf(model, version)} phone={phone}>
          <ModelPicker tool={null} anyWithoutTool value={model} onChange={setModel} phone={phone} field />
          <FieldInput phone={phone} aria-label={CHECK_DIALOG_COPY.version} maxLength={MODEL_VERSION_MAX} value={version} placeholder={CHECK_DIALOG_COPY.versionPlaceholder} onChange={(event) => setVersion(event.target.value)} />
        </OptionalField>

        <OptionalField name={CHECK_DIALOG_COPY.evidence} description={CHECK_DIALOG_COPY.evidenceLine} summary={summaryOf(evidence.kind ? EVIDENCE_KIND_LABEL[evidence.kind] : null, evidenceFile?.name ?? (evidence.mediaId ? evidence.name : null), evidenceFile || evidence.mediaId ? null : evidence.kind === "measurement" ? evidenceFromDraft(evidence)?.measurement && measurementLine(evidenceFromDraft(evidence)?.measurement as NonNullable<EvidencePayload["measurement"]>) : evidence.url)} phone={phone}>
          <EvidenceControl draft={evidence} onChange={(next) => setEvidence(next)} phone={phone} fileChosen={Boolean(evidenceFile)} />
          {edit ? null : (
            <Inline>
              <FileButton phone={phone} onFiles={chooseEvidence} testId="check-evidence-file" inputLabel={CHECK_DIALOG_COPY.evidenceFile} disabled={evidence.url.trim().length > 0 || evidence.kind === "measurement"}>
                {CHECK_DIALOG_COPY.evidenceFile}
              </FileButton>
            </Inline>
          )}
          {evidenceFile ? <FileLine name={evidenceFile.name} removeLabel={`${CHECK_DIALOG_COPY.remove} ${evidenceFile.name}`} onRemove={() => setEvidenceFile(null)} phone={phone} /> : null}
          {fileWrong ? <Alert>{fileWrong}</Alert> : null}
        </OptionalField>
        {comparisonFields({ extras, onChange: setExtras, phone, comparing: scoring === "ab", choices: evalChoices ?? { testedKind: "other", tiles: [] } })}
        {harnessFields({ extras, onChange: setExtras, phone, comparing: scoring === "ab", choices: evalChoices ?? { testedKind: "other", tiles: [] } })}
      </OptionalSection>
      {edit?.after ? edit.after(input as never) : null}
    </ModalForm>
  );
}

export function AddCheckDialog({ open, onOpenChange, onAdd, seed, edit, evalChoices }: AddCheckDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddCheckInput) => {
    onAdd?.(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={edit ? edit.title : CHECK_DIALOG_COPY.title} eyebrow={edit ? MODAL_COPY.edit : undefined} subtitle={CHECK_DIALOG_COPY.subtitle} width={MODAL_WIDTH.standard} testId={edit ? "edit-check-dialog" : "add-check-dialog"}>
      <Form seed={seed} evalChoices={evalChoices} edit={edit && { ...edit, onSave: (input) => { edit.onSave(input); close(); } }} onAdd={add} onCancel={close} phone={phone} />
    </ModalShell>
  );
}

export default AddCheckDialog;
