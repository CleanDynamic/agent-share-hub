/* CA-04 P1 — Add › "New session".

   A session is one sitting: one chat with one tool. This asks only for the tool, the tool picker with "Typed here" as
   its no-tool row, as the add field's own picker offers it. Add makes the session (`making.sessions_meta`, dated
   today) and it becomes the session new steps go into. Built like the tool dialog: a Radix dialog, 420 wide, on the
   Card's surface tokens, and a `BottomSheet` below 768. "Add" is the one primary. */

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { Button } from "@/components/brand/Button";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { Field } from "./composeControls";
import { ToolPicker } from "./ToolPicker";

export const SESSION_DIALOG_COPY = {
  title: "New session",
  line: "One sitting with one tool. What you add next goes into it.",
  tool: "Tool",
  typedHere: "Typed here",
  add: "Add",
  cancel: "Cancel",
} as const;

export interface AddSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tool picked: a tool id or a typed name, or null for "Typed here". */
  onAdd: (tool: string | null) => void;
  /** The tools the build already uses, first in the tool picker. */
  inBuild?: readonly string[];
}

function Form({ onAdd, onCancel, phone, inBuild = [] }: Pick<AddSessionDialogProps, "onAdd" | "inBuild"> & { onCancel: () => void; phone: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onAdd(picked);
      }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>{SESSION_DIALOG_COPY.line}</p>
      <Field id="new-session-tool" label={SESSION_DIALOG_COPY.tool} group>
        <div>
          <ToolPicker
            label={SESSION_DIALOG_COPY.tool}
            value={picked}
            onChange={setPicked}
            inBuild={inBuild}
            allowNone
            noneLabel={SESSION_DIALOG_COPY.typedHere}
            phone={phone}
            step="session"
          />
        </div>
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" size={phone ? 44 : 36} onClick={onCancel}>
          {SESSION_DIALOG_COPY.cancel}
        </Button>
        <Button variant="primary" size={phone ? 44 : 36} type="submit">
          {SESSION_DIALOG_COPY.add}
        </Button>
      </div>
    </form>
  );
}

export function AddSessionDialog({ open, onOpenChange, onAdd, inBuild }: AddSessionDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (tool: string | null) => {
    onAdd(tool);
    close();
  };

  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={SESSION_DIALOG_COPY.title}>
        {open ? <Form inBuild={inBuild} onAdd={add} onCancel={close} phone /> : null}
      </BottomSheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          aria-describedby={undefined}
          data-testid="add-session-dialog"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 51,
            width: 420,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "90dvh",
            overflowY: "auto",
            boxSizing: "border-box",
            padding: 20,
            borderRadius: r.panel,
            background: t.solid,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadowFloat,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <Dialog.Title style={{ margin: "0 0 16px", fontFamily: FIGTREE, fontSize: 16, fontWeight: 600, color: t.text }}>{SESSION_DIALOG_COPY.title}</Dialog.Title>
          <Form inBuild={inBuild} onAdd={add} onCancel={close} phone={false} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddSessionDialog;
