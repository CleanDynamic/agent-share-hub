/* UI-P70 — Add › "Manual step".

   A Radix dialog, 420 wide, on the Card's surface tokens (a `BottomSheet` below
   768). Work done outside AI, put between two prompts so readers see every step:

   - Tool: the tool picker (TF-02), with the build's own tools first. A listed
     tool is stored as its id, any other name as typed (at most 40). There is
     no default: Add waits until one is picked.
   - What was done: one line, at most 140, with a DM Mono counter.
   - Picture, optional: one, through the media path (`uploadMedia`, in the page).
   - "Add", the one primary, and "Cancel".

   A manual step is never detected or suggested (CONCEPT §4): this dialog is
   the only way one is made.

   CA-03 P2: the labels are the composer's `Field`; the line under the title and the counter are Geist, with tabular
   numbers; the dialog is the window recipe with a 15/500 title. */

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/brand/Button";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { MANUAL_TEXT_MAX, MANUAL_TOOL_MAX } from "@/lib/build/graph";
import { MEDIA_MAX_BYTES, mediaKindFor } from "@/lib/build/media";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { Field } from "./composeControls";
import { dialogTitle, text as type, tnum, typedField, windowStyle } from "./refinedStyles";
import { ToolPicker } from "./ToolPicker";

export const MANUAL_DIALOG_COPY = {
  title: "Add a manual step",
  placeholder: "What you did, in one line",
  missing: "Manual steps need the Deploy queue item from UI-P61.",
} as const;

export interface AddManualStepInput {
  tool: string;
  text: string;
  file: File | null;
}

export interface AddManualStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The step it will go after, named for the line under the title ("after 3 · Fix the layout"); null: at the end. */
  after: string | null;
  /** False while the `manual_step` node type is not live. */
  available: boolean;
  onAdd: (input: AddManualStepInput) => void;
  /** The tools the build already uses, first in the tool picker. */
  inBuild?: readonly string[];
}

function Form({ after, available, onAdd, onCancel, phone, inBuild = [] }: Pick<AddManualStepDialogProps, "after" | "available" | "onAdd" | "inBuild"> & { onCancel: () => void; phone: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const uid = useId();

  const tool = (picked ?? "").trim();
  const ready = available && tool.length > 0 && tool.length <= MANUAL_TOOL_MAX && text.trim().length > 0 && text.length <= MANUAL_TEXT_MAX;


  const choose = (picked: File | undefined) => {
    if (!picked) return;
    if (mediaKindFor(picked.type) !== "image") setFileError(`${picked.name} is not a picture.`);
    else if (picked.size > MEDIA_MAX_BYTES) setFileError(`${picked.name} is too big. The limit is ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} MB.`);
    else {
      setFileError(null);
      setFile(picked);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onAdd({ tool, text: text.trim(), file });
      }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {after ? <p style={{ ...type(12.5, 400, t.text2), margin: 0 }}>Goes after {after}</p> : null}

      <Field id={`${uid}-tool`} label="Tool" group>
        <div>
          <ToolPicker label="Tool" value={picked} onChange={setPicked} inBuild={inBuild} phone={phone} step="manual" />
        </div>
      </Field>

      <Field id={`${uid}-text`} label="What was done">
        <input id={`${uid}-text`} type="text" value={text} maxLength={MANUAL_TEXT_MAX} placeholder={MANUAL_DIALOG_COPY.placeholder} onChange={(event) => setText(event.target.value)} style={typedField(phone)} />
        <span data-testid="manual-counter" style={{ ...type(11.5, 400, t.text2), ...tnum, alignSelf: "flex-end" }}>
          {text.length} / {MANUAL_TEXT_MAX}
        </span>
      </Field>

      <Field id={`${uid}-picture`} label="Picture, optional" group>
        <input
          ref={picker}
          type="file"
          accept="image/*"
          hidden
          data-testid="manual-picture"
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" size={phone ? 44 : 30} fontSize={13} onClick={() => picker.current?.click()}>
            {file ? "Choose another" : "Add a picture"}
          </Button>
          {file ? (
            <>
              <span style={{ fontFamily: FIGTREE, fontSize: 13, color: t.text, overflowWrap: "anywhere" }}>{file.name}</span>
              <Button variant="ghost" size={phone ? 44 : 30} fontSize={13} onClick={() => setFile(null)}>
                Remove
              </Button>
            </>
          ) : null}
        </div>
        {fileError ? (
          <span role="alert" style={{ fontFamily: FIGTREE, fontSize: 12.5, color: t.text2 }}>
            {fileError}
          </span>
        ) : null}
      </Field>

      {!available ? <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12.5, color: t.text2 }}>{MANUAL_DIALOG_COPY.missing}</p> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" size={phone ? 44 : 30} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size={phone ? 44 : 30} type="submit" disabled={!ready}>
          Add
        </Button>
      </div>
    </form>
  );
}

export function AddManualStepDialog({ open, onOpenChange, after, available, onAdd, inBuild }: AddManualStepDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddManualStepInput) => {
    onAdd(input);
    close();
  };

  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={MANUAL_DIALOG_COPY.title}>
        {open ? <Form after={after} available={available} inBuild={inBuild} onAdd={add} onCancel={close} phone /> : null}
      </BottomSheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          aria-describedby={undefined}
          data-testid="add-manual-dialog"
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...windowStyle(420) }}
        >
          <Dialog.Title style={dialogTitle}>{MANUAL_DIALOG_COPY.title}</Dialog.Title>
          <Form after={after} available={available} inBuild={inBuild} onAdd={add} onCancel={close} phone={false} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddManualStepDialog;
