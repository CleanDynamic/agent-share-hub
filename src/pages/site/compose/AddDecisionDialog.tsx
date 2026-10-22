/* CA-13 P2, CA-15 P8: Add › "Decision": a structured classification your application requests from a model.

   The shared modal frame, 520 wide (a `BottomSheet` below 768). The fields are `DecisionFields`: a Model block (Model or
   service, Version, Invocation), the Questions block, then the Optional section. This holds the draft and the one primary,
   "Add", which waits for a model or service and for every question to have its key and what its type takes (`decisionMissing`).
   What else a draft refuses (an answer that is not one of the options, a threshold out of range) is said as a line under the
   fields. Not having code does not block adding it. */

import { useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { decisionMissing, draftToInput, emptyDraft } from "@/lib/build/decisionDraft";
import type { DecisionInput } from "@/lib/build/graph";

import { DecisionFields, type DecisionFieldsProps } from "./DecisionFields";
import { ModalForm, ModalShell } from "./ModalFrame";

export const DECISION_DIALOG_COPY = {
  title: "Add a decision",
  subtitle: "A structured classification your application requests from a model",
  add: "Add",
  cancel: "Cancel",
} as const;

export interface AddDecisionDialogProps extends Pick<DecisionFieldsProps, "codeTiles" | "stepChoices" | "inBuild" | "onAddCode"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: DecisionInput) => void;
}

function Form({ onAdd, onCancel, phone, ...fields }: Pick<AddDecisionDialogProps, "onAdd" | "codeTiles" | "stepChoices" | "inBuild" | "onAddCode"> & { onCancel: () => void; phone: boolean }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  /** Which Optional row the error points into, so it opens on its own. */
  const [into, setInto] = useState<DecisionFieldsProps["open"]>({});
  return (
    <ModalForm
      phone={phone}
      missing={decisionMissing(draft)}
      onCancel={onCancel}
      alert={error}
      onSubmit={() => {
        const made = draftToInput(draft);
        if ("error" in made) {
          setError(made.error);
          setInto(/answered with|ranking|yes or no from/.test(made.error) ? { answer: true } : /example/i.test(made.error) ? { examples: true } : /threshold/i.test(made.error) ? { low: true } : {});
          return;
        }
        onAdd(made.input);
      }}
    >
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
    </ModalForm>
  );
}

export function AddDecisionDialog({ open, onOpenChange, onAdd, ...fields }: AddDecisionDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: DecisionInput) => {
    onAdd(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={DECISION_DIALOG_COPY.title} subtitle={DECISION_DIALOG_COPY.subtitle} width={520} testId="add-decision-dialog">
      <Form {...fields} onAdd={add} onCancel={close} phone={phone} />
    </ModalShell>
  );
}

export default AddDecisionDialog;
