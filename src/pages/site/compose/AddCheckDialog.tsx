/* CA-03 P5 — Add › "Check": how the build tested its own work.

   A Radix dialog, 420 wide, on the window recipe (a `BottomSheet` below 768), built like the code dialog. It asks, in
   this order:

   - What it tested: a well, 3 rows. Required, 1 to 280 characters.
   - What counts as passing: a well, 2 rows. Required, 1 to 280.
   - When it failed: a well, 3 rows, optional, up to 600.
   - Runs: two small number fields, "{passed} passed of {total}", whole numbers from 0 to 10,000.
   - Last run: a date, optional, typed as 2026-10-12 (no browser date picker).
   - "Add", the one primary, and "Cancel".

   A field it refuses says why in plain words ("Passed can't be more than the total."), with the same words `addCheck`
   refuses with. A check is evidence the maker gives: it never touches the lamp, the plaque or a reproduction. */

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useState, type CSSProperties } from "react";

import { Button } from "@/components/brand/Button";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { CHECK_FAIL_MAX, CHECK_TEXT_MAX, checkRefusal, type CheckCase, type CheckInput } from "@/lib/build/graph";
import { t } from "@/lib/theme/tokens";

import { CheckCasesField, keptCases } from "./CheckCasesField";
import { Field } from "./composeControls";
import { dialogTitle, text, tnum, typedArea, typedField, windowStyle } from "./refinedStyles";

export const CHECK_DIALOG_COPY = {
  title: "Add a check",
  tested: "What it tested",
  testedPlaceholder: "Places a test order for 2 sourdough loaves",
  passing: "What counts as passing",
  passingPlaceholder: "The total shows £9.00",
  failed: "When it failed",
  failedPlaceholder: "What went wrong, and what changed before it ran again",
  optional: "Optional",
  runs: "Runs",
  passed: "Passed",
  total: "Total",
  passedOf: "passed of",
  lastRun: "Last run",
  lastRunPlaceholder: "2026-10-12",
  add: "Add",
  cancel: "Cancel",
} as const;

export type AddCheckInput = Omit<CheckInput, "testedStep">;

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
  const [tried, setTried] = useState(false);
  const uid = useId();

  const given = keptCases(cases);
  const input: AddCheckInput = { tested, passing, onFail: failed, passed: countOf(passed), total: countOf(total), runAt, ...(given.length > 0 ? { cases: given } : null) };
  const why = checkRefusal(input);
  const ready = tested.trim().length > 0 && passing.trim().length > 0 && (given.length > 0 || (passed.trim() !== "" && total.trim() !== ""));
  const count: CSSProperties = { ...text(11.5, 400, t.text2), ...tnum, alignSelf: "flex-end" };
  const small = (value: string, set: (next: string) => void, label: string) => (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      maxLength={5}
      value={value}
      onChange={(event) => set(event.target.value.replace(/[^0-9]/g, ""))}
      style={typedField(phone, { width: 72, ...tnum })}
    />
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (!ready || why) return;
        onAdd({ ...input, tested: tested.trim(), passing: passing.trim(), onFail: failed.trim() || null, runAt: runAt.trim() || null });
      }}
      /* The global field rule makes a field inherit its size on a desktop, so the form sets the fields' 13 here. */
      style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: phone ? 16 : 13 }}
    >
      <Field id={`${uid}-tested`} label={CHECK_DIALOG_COPY.tested}>
        <textarea id={`${uid}-tested`} rows={3} maxLength={CHECK_TEXT_MAX} value={tested} placeholder={CHECK_DIALOG_COPY.testedPlaceholder} onChange={(event) => setTested(event.target.value)} style={typedArea(phone)} />
        <span style={count}>
          {tested.length} / {CHECK_TEXT_MAX}
        </span>
      </Field>

      <Field id={`${uid}-passing`} label={CHECK_DIALOG_COPY.passing}>
        <textarea id={`${uid}-passing`} rows={2} maxLength={CHECK_TEXT_MAX} value={passing} placeholder={CHECK_DIALOG_COPY.passingPlaceholder} onChange={(event) => setPassing(event.target.value)} style={typedArea(phone)} />
      </Field>

      <Field id={`${uid}-failed`} label={CHECK_DIALOG_COPY.failed} hint={CHECK_DIALOG_COPY.optional}>
        <textarea id={`${uid}-failed`} rows={3} maxLength={CHECK_FAIL_MAX} value={failed} placeholder={CHECK_DIALOG_COPY.failedPlaceholder} onChange={(event) => setFailed(event.target.value)} style={typedArea(phone)} />
      </Field>

      <CheckCasesField id={uid} cases={cases} phone={phone} onChange={setCases} />

      {given.length === 0 ? (
        <Field id={`${uid}-runs`} label={CHECK_DIALOG_COPY.runs} group>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {small(passed, setPassed, CHECK_DIALOG_COPY.passed)}
            <span style={text(13, 400, t.text2)}>{CHECK_DIALOG_COPY.passedOf}</span>
            {small(total, setTotal, CHECK_DIALOG_COPY.total)}
          </div>
        </Field>
      ) : null}

      <Field id={`${uid}-last`} label={CHECK_DIALOG_COPY.lastRun} hint={CHECK_DIALOG_COPY.optional}>
        <input
          id={`${uid}-last`}
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={runAt}
          placeholder={CHECK_DIALOG_COPY.lastRunPlaceholder}
          onChange={(event) => setRunAt(event.target.value.replace(/[^0-9-]/g, ""))}
          style={typedField(phone, { width: 128, ...tnum })}
        />
      </Field>

      {tried && why ? (
        <span role="alert" style={text(12.5, 400, t.text2)}>
          {why}
        </span>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" size={phone ? 44 : 30} onClick={onCancel}>
          {CHECK_DIALOG_COPY.cancel}
        </Button>
        <Button variant="primary" size={phone ? 44 : 30} type="submit" disabled={!ready}>
          {CHECK_DIALOG_COPY.add}
        </Button>
      </div>
    </form>
  );
}

export function AddCheckDialog({ open, onOpenChange, onAdd }: AddCheckDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddCheckInput) => {
    onAdd(input);
    close();
  };

  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={CHECK_DIALOG_COPY.title}>
        {open ? <Form onAdd={add} onCancel={close} phone /> : null}
      </BottomSheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          aria-describedby={undefined}
          data-testid="add-check-dialog"
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...windowStyle(420) }}
        >
          <Dialog.Title style={dialogTitle}>{CHECK_DIALOG_COPY.title}</Dialog.Title>
          <Form onAdd={add} onCancel={close} phone={false} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddCheckDialog;
