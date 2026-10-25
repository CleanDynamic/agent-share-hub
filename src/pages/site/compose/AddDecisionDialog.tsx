/* CA-13 P2, CA-15 P8: Add › "Decision": a structured classification your application requests from a model.

   CA-15b: built from `modalRecipes` as the board "Add a decision" draws it, 640 wide (a `BottomSheet` below 768). The fields are `DecisionFields`: a Model block (Model or
   service, Version, Invocation), the Questions block, then the Optional section. This holds the draft and the one primary,
   "Add", which waits for a model or service and for every question to have its key and what its type takes (`decisionMissing`).
   What else a draft refuses (an answer that is not one of the options, a threshold out of range) is said as a line under the
   fields. Not having code does not block adding it. */

import { useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { decisionMissing, draftToInput, emptyDraft, type DecisionDraft } from "@/lib/build/decisionDraft";
import type { DecisionInput } from "@/lib/build/graph";

import { DecisionFields, type DecisionFieldsProps } from "./DecisionFields";
import { MODAL_COPY, ModalForm, ModalShell, type EditMode } from "./ModalFrame";
import { MODAL_WIDTH } from "./modalRecipes";

export const DECISION_DIALOG_COPY = {
  title: "Add a decision",
  subtitle: "Structured answer from a model",
  add: "Add",
  cancel: "Cancel",
} as const;

export interface AddDecisionDialogProps extends Pick<DecisionFieldsProps, "codeTiles" | "stepChoices" | "inBuild" | "onAddCode"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (input: DecisionInput) => void;
  /** CA-18: a decision that is there, as its form holds it. */
  current?: DecisionDraft | null;
  edit?: EditMode<DecisionInput>;
}

function Form({ onAdd, onCancel, phone, current, edit, ...fields }: Pick<AddDecisionDialogProps, "onAdd" | "codeTiles" | "stepChoices" | "inBuild" | "onAddCode" | "current" | "edit"> & { onCancel: () => void; phone: boolean }) {
  const [draft, setDraft] = useState(() => current ?? emptyDraft());
  const [error, setError] = useState<string | null>(null);
  /** Which Optional row the error points into, so it opens on its own. */
  const [into, setInto] = useState<DecisionFieldsProps["open"]>({});
  return (
    <ModalForm
      phone={phone}
      missing={decisionMissing(draft)}
      onCancel={onCancel}
      addLabel={edit ? MODAL_COPY.save : undefined}
      alert={error}
      onSubmit={() => {
        const made = draftToInput(draft);
        if ("error" in made) {
          setError(made.error);
          setInto(/answered with|ranking|yes or no from/.test(made.error) ? { answer: true } : /example/i.test(made.error) ? { examples: true } : /threshold/i.test(made.error) ? { low: true } : {});
          return;
        }
        if (edit) edit.onSave(made.input);
        else onAdd?.(made.input);
      }}
    >
      {edit?.before ? edit.before({} as DecisionInput) : null}
      <DecisionFields
        draft={draft}
        onChange={(next) => {
          setDraft(next);
          setError(null);
          setInto({});
        }}
        phone={phone}
        open={into}
        {...fields}
      />
      {edit?.after ? edit.after({} as DecisionInput) : null}
    </ModalForm>
  );
}

export function AddDecisionDialog({ open, onOpenChange, onAdd, current, edit, ...fields }: AddDecisionDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: DecisionInput) => {
    onAdd?.(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={edit ? edit.title : DECISION_DIALOG_COPY.title} eyebrow={edit ? MODAL_COPY.edit : undefined} subtitle={DECISION_DIALOG_COPY.subtitle} width={MODAL_WIDTH.wide} testId={edit ? "edit-decision-dialog" : "add-decision-dialog"}>
      <Form {...fields} current={current} edit={edit && { ...edit, onSave: (input) => { edit.onSave(input); close(); } }} onAdd={add} onCancel={close} phone={phone} />
    </ModalShell>
  );
}

export default AddDecisionDialog;
