/* CA-13 P2 — Add › "Decision".

   A Radix dialog, 520 wide, on the Card's surface tokens (a `BottomSheet` below 768), built like the tool dialog. The fields
   are `DecisionFields`; this holds the draft and the one primary, "Add". A Decision with no questions, or a choice with
   fewer than two options, is not added: the line says which. Not having code does not block adding it. */

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { Button } from "@/components/brand/Button";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { draftToInput, emptyDraft } from "@/lib/build/decisionDraft";
import type { DecisionInput } from "@/lib/build/graph";
import { t } from "@/lib/theme/tokens";

import { DecisionFields, type DecisionFieldsProps } from "./DecisionFields";
import { dialogTitle, text as type, windowStyle } from "./refinedStyles";

export const DECISION_DIALOG_COPY = { title: "Add a decision", add: "Add", cancel: "Cancel" } as const;

export interface AddDecisionDialogProps extends Pick<DecisionFieldsProps, "codeTiles" | "stepChoices" | "inBuild" | "onAddCode"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: DecisionInput) => void;
}

function Form({ onAdd, onCancel, phone, ...fields }: Pick<AddDecisionDialogProps, "onAdd" | "codeTiles" | "stepChoices" | "inBuild" | "onAddCode"> & { onCancel: () => void; phone: boolean }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const made = draftToInput(draft);
        if ("error" in made) {
          setError(made.error);
          return;
        }
        onAdd(made.input);
      }}
      style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: phone ? undefined : "70vh", overflowY: phone ? undefined : "auto" }}
    >
      <DecisionFields draft={draft} onChange={(next) => { setDraft(next); setError(null); }} phone={phone} {...fields} />
      {error ? (
        <span role="alert" style={type(12.5, 400, t.text)}>
          {error}
        </span>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" size={phone ? 44 : 36} onClick={onCancel}>
          {DECISION_DIALOG_COPY.cancel}
        </Button>
        <Button variant="primary" size={phone ? 44 : 36} type="submit">
          {DECISION_DIALOG_COPY.add}
        </Button>
      </div>
    </form>
  );
}

export function AddDecisionDialog({ open, onOpenChange, onAdd, ...fields }: AddDecisionDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: DecisionInput) => {
    onAdd(input);
    close();
  };

  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={DECISION_DIALOG_COPY.title}>
        {open ? <Form {...fields} onAdd={add} onCancel={close} phone /> : null}
      </BottomSheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content aria-describedby={undefined} data-testid="add-decision-dialog" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...windowStyle(520) }}>
          <Dialog.Title style={dialogTitle}>{DECISION_DIALOG_COPY.title}</Dialog.Title>
          {open ? <Form {...fields} onAdd={add} onCancel={close} phone={false} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddDecisionDialog;
