/* CA-12 P12 — a check's cases: what went in, what was expected, what came out, and whether it passed.

   One editor for Add › Check and Details. Up to 50 cases, each text up to 280 characters. A case with nothing in
   "In" or "Expected" is not kept. With cases, "passed out of total" is worked out from them. */

import { useState } from "react";

import { CASE_RULE_MAX, CASE_TEXT_MAX, CASES_MAX, casesRefusal, casesTotals, type CheckCase } from "@/lib/build/graph";
import { FLAKY_CAUSES, FLAKY_CAUSE_LABEL, STABILITIES, STABILITY_LABEL, type FlakyCause, type Stability } from "@/lib/build/evalHarness";
import { t } from "@/lib/theme/tokens";

import { Checkbox } from "@/components/brand/Checkbox";
import { Field, TextButton } from "./composeControls";
import { PickMenu } from "./PickMenu";
import { text, tnum, typedField } from "./refinedStyles";

export const CASES_COPY = {
  title: "Test cases",
  add: "Add a test case",
  remove: "Remove test case",
  input: "In",
  expected: "Expected",
  actual: "Got",
  passed: "Passed",
  failed: "Failed",
  /* SV-29 P4: under More. */
  more: "More",
  fewer: "Fewer",
  rule: "Rule",
  ruleHint: "The rule behind the expected answer",
  failureType: "Failure type",
  example: "Show this case in full on the build page",
  stability: "Across runs",
  cause: "Why it is flaky",
  none: "Not set",
} as const;

const NONE = "__none__";
const blank = (): CheckCase => ({ input: "", expected: "", actual: "", passed: true });

/** The cases worth keeping: a case that says nothing in or expected is dropped. */
export const keptCases = (cases: readonly CheckCase[]): CheckCase[] =>
  cases
    .filter((c) => c.input.trim() || c.expected.trim())
    .map((c) => ({
      input: c.input.trim(),
      expected: c.expected.trim(),
      actual: c.actual.trim(),
      passed: c.passed,
      // SV-29 P4: the four fields above are unchanged; these five are kept only when given.
      ...(c.rule?.trim() ? { rule: c.rule.trim() } : null),
      ...(c.failure_type ? { failure_type: c.failure_type } : null),
      ...(c.example ? { example: true as const } : null),
      ...(c.stability ? { stability: c.stability } : null),
      ...(c.stability === "flaky" && c.flaky_cause ? { flaky_cause: c.flaky_cause } : null),
    }));

export interface CheckCasesFieldProps {
  id: string;
  cases: readonly CheckCase[];
  phone: boolean;
  /** Called with the cases as they stand. In Details this saves; in the dialog it only holds them. */
  onChange: (cases: CheckCase[]) => void;
  /** Save only when the field loses focus (Details); the dialog calls on every change. */
  onBlurOnly?: boolean;
  /** CA-15 P1: the Optional section's row names it already; draw the group without a label of its own. */
  bare?: boolean;
  /** SV-29 P4: the names of the Check's failure types, for a case to pick from. */
  failureTypes?: readonly string[];
}

export function CheckCasesField({ id, cases, phone, onChange, onBlurOnly = false, bare = false, failureTypes = [] }: CheckCasesFieldProps) {
  const [rows, setRows] = useState<CheckCase[]>(() => [...cases]);
  /** The cases whose More is open: those that already hold something there open on their own. */
  const [more, setMore] = useState<Set<number>>(() => new Set(cases.flatMap((c, at) => (c.rule || c.failure_type || c.example || c.stability ? [at] : []))));
  const set = (next: CheckCase[], now: boolean) => {
    setRows(next);
    if (now || !onBlurOnly) onChange(next);
  };
  const edit = (at: number, patch: Partial<CheckCase>, now = false) => set(rows.map((row, i) => (i === at ? { ...row, ...patch } : row)), now);
  const why = casesRefusal(keptCases(rows), failureTypes.length > 0 || rows.some((row) => row.failure_type) ? failureTypes : undefined);
  const totals = casesTotals(keptCases(rows));
  const box = (at: number, key: "input" | "expected" | "actual", label: string) => (
    <input
      type="text"
      aria-label={`${label} of case ${at + 1}`}
      placeholder={label}
      maxLength={CASE_TEXT_MAX}
      value={rows[at][key]}
      onChange={(event) => edit(at, { [key]: event.target.value })}
      onBlur={() => onBlurOnly && onChange(rows)}
      style={typedField(phone, { width: "100%", boxSizing: "border-box" })}
    />
  );
  const list = (
      <div data-testid="check-cases-field" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        {rows.map((row, at) => (
          <div key={at} data-testid="check-case" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            {box(at, "input", CASES_COPY.input)}
            {box(at, "expected", CASES_COPY.expected)}
            {box(at, "actual", CASES_COPY.actual)}
            {more.has(at) ? (
              <div data-testid="check-case-more" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <input type="text" aria-label={`${CASES_COPY.rule} of case ${at + 1}`} placeholder={CASES_COPY.ruleHint} maxLength={CASE_RULE_MAX} value={row.rule ?? ""} onChange={(event) => edit(at, { rule: event.target.value })} onBlur={() => onBlurOnly && onChange(rows)} style={typedField(phone, { width: "100%", boxSizing: "border-box" })} />
                {failureTypes.length > 0 ? (
                  <PickMenu label={`${CASES_COPY.failureType} of case ${at + 1}`} phone={phone} placeholder={`${CASES_COPY.failureType}: ${CASES_COPY.none.toLowerCase()}`} value={row.failure_type ?? NONE} options={[{ value: NONE, label: `${CASES_COPY.failureType}: ${CASES_COPY.none.toLowerCase()}` }, ...failureTypes.map((name) => ({ value: name, label: name }))]} onChange={(next) => edit(at, { failure_type: next === NONE ? undefined : next }, true)} />
                ) : null}
                <PickMenu label={`${CASES_COPY.stability} of case ${at + 1}`} phone={phone} placeholder={`${CASES_COPY.stability}: ${CASES_COPY.none.toLowerCase()}`} value={row.stability ?? NONE} options={[{ value: NONE, label: `${CASES_COPY.stability}: ${CASES_COPY.none.toLowerCase()}` }, ...STABILITIES.map((value) => ({ value, label: STABILITY_LABEL[value] }))]} onChange={(next) => edit(at, { stability: next === NONE ? undefined : (next as Stability), ...(next === "flaky" ? null : { flaky_cause: undefined }) }, true)} />
                {row.stability === "flaky" ? (
                  <PickMenu label={`${CASES_COPY.cause} of case ${at + 1}`} phone={phone} placeholder={`${CASES_COPY.cause}: ${CASES_COPY.none.toLowerCase()}`} value={row.flaky_cause ?? NONE} options={[{ value: NONE, label: `${CASES_COPY.cause}: ${CASES_COPY.none.toLowerCase()}` }, ...FLAKY_CAUSES.map((value) => ({ value, label: FLAKY_CAUSE_LABEL[value] }))]} onChange={(next) => edit(at, { flaky_cause: next === NONE ? undefined : (next as FlakyCause) }, true)} />
                ) : null}
                <label style={{ display: "flex", alignItems: "center", gap: 8, ...text(12.5, 400, t.text2) }}>
                  <Checkbox checked={row.example === true} onChange={(event) => set(rows.map((other, i) => ({ ...other, example: i === at && event.target.checked ? (true as const) : undefined })), true)} />
                  {CASES_COPY.example}
                </label>
              </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <TextButton target={phone} onClick={() => setMore((open) => { const next = new Set(open); if (next.has(at)) next.delete(at); else next.add(at); return next; })} style={text(12, 500, t.text2)}>
                {more.has(at) ? CASES_COPY.fewer : CASES_COPY.more}
              </TextButton>
              <TextButton target={phone} onClick={() => edit(at, { passed: !row.passed }, true)} style={text(12.5, 500, row.passed ? t.text : t.text2)}>
                {row.passed ? CASES_COPY.passed : CASES_COPY.failed}
              </TextButton>
              <TextButton target={phone} onClick={() => set(rows.filter((_, i) => i !== at), true)} style={text(12, 500, t.text2)}>
                {`${CASES_COPY.remove} ${at + 1}`}
              </TextButton>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <TextButton target={phone} disabled={rows.length >= CASES_MAX} onClick={() => set([...rows, blank()], false)} style={text(12.5, 500, t.text2)}>
            {CASES_COPY.add}
          </TextButton>
          {totals.total > 0 ? <span style={{ ...text(11.5, 400, t.text2), ...tnum }}>{`${totals.passed} passed out of ${totals.total}`}</span> : null}
        </div>
        {why ? (
          <span role="alert" style={text(12.5, 400, t.text2)}>
            {why}
          </span>
        ) : null}
      </div>
  );
  return bare ? (
    <div role="group" aria-label={CASES_COPY.title}>
      {list}
    </div>
  ) : (
    <Field id={`${id}-cases`} label={CASES_COPY.title} group>
      {list}
    </Field>
  );
}
