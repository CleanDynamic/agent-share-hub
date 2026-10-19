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
   the only way one is made. */

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useRef, useState, type CSSProperties } from "react";

import { Button } from "@/components/brand/Button";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { MANUAL_TEXT_MAX, MANUAL_TOOL_MAX } from "@/lib/build/graph";
import { MEDIA_MAX_BYTES, mediaKindFor } from "@/lib/build/media";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { fieldBase } from "./composeFields";
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

  const control: CSSProperties = { ...fieldBase, padding: "7px 10px", minHeight: phone ? 44 : 34, fontSize: phone ? 16 : 13.5 };
  const label: CSSProperties = { fontFamily: DM_MONO, fontSize: 11.5, color: t.text2, textTransform: "uppercase", letterSpacing: "0.06em" };

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
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      {after ? <p style={{ margin: 0, fontFamily: DM_MONO, fontSize: 11.5, color: t.text2 }}>Goes after {after}</p> : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={label}>Tool</span>
        <div>
          <ToolPicker label="Tool" value={picked} onChange={setPicked} inBuild={inBuild} phone={phone} step="manual" />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label htmlFor={`${uid}-text`} style={label}>
          What was done
        </label>
        <input id={`${uid}-text`} type="text" value={text} maxLength={MANUAL_TEXT_MAX} placeholder={MANUAL_DIALOG_COPY.placeholder} onChange={(event) => setText(event.target.value)} style={control} />
        <span data-testid="manual-counter" style={{ alignSelf: "flex-end", fontFamily: DM_MONO, fontSize: 11, color: t.text2 }}>
          {text.length} / {MANUAL_TEXT_MAX}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={label}>Picture, optional</span>
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
          <Button variant="secondary" size={phone ? 44 : 32} fontSize={13} onClick={() => picker.current?.click()}>
            {file ? "Choose another" : "Add a picture"}
          </Button>
          {file ? (
            <>
              <span style={{ fontFamily: FIGTREE, fontSize: 13, color: t.text, overflowWrap: "anywhere" }}>{file.name}</span>
              <Button variant="ghost" size={phone ? 44 : 32} fontSize={13} onClick={() => setFile(null)}>
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
      </div>

      {!available ? <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12.5, color: t.text2 }}>{MANUAL_DIALOG_COPY.missing}</p> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" size={phone ? 44 : 36} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size={phone ? 44 : 36} type="submit" disabled={!ready}>
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
          <Dialog.Title style={{ margin: "0 0 14px", fontFamily: FIGTREE, fontSize: 16, fontWeight: 600, color: t.text }}>{MANUAL_DIALOG_COPY.title}</Dialog.Title>
          <Form after={after} available={available} inBuild={inBuild} onAdd={add} onCancel={close} phone={false} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddManualStepDialog;
