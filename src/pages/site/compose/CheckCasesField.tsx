/* CA-12 P12 — a check's cases: what went in, what was expected, what came out, and whether it passed.

   One editor for Add › Check and Details. Up to 50 cases, each text up to 280 characters. A case with nothing in
   "In" or "Expected" is not kept. With cases, "passed out of total" is worked out from them. */

import { useState } from "react";

import { CASE_TEXT_MAX, CASES_MAX, casesRefusal, casesTotals, type CheckCase } from "@/lib/build/graph";
import { t } from "@/lib/theme/tokens";

import { Field, TextButton } from "./composeControls";
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
} as const;

const blank = (): CheckCase => ({ input: "", expected: "", actual: "", passed: true });

/** The cases worth keeping: a case that says nothing in or expected is dropped. */
export const keptCases = (cases: readonly CheckCase[]): CheckCase[] => cases.filter((c) => c.input.trim() || c.expected.trim()).map((c) => ({ input: c.input.trim(), expected: c.expected.trim(), actual: c.actual.trim(), passed: c.passed }));

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
}

export function CheckCasesField({ id, cases, phone, onChange, onBlurOnly = false, bare = false }: CheckCasesFieldProps) {
  const [rows, setRows] = useState<CheckCase[]>(() => [...cases]);
  const set = (next: CheckCase[], now: boolean) => {
    setRows(next);
    if (now || !onBlurOnly) onChange(next);
  };
  const edit = (at: number, patch: Partial<CheckCase>, now = false) => set(rows.map((row, i) => (i === at ? { ...row, ...patch } : row)), now);
  const why = casesRefusal(keptCases(rows));
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
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
