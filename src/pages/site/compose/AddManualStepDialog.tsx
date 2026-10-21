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
import { MANUAL_LINES_MAX, MANUAL_TEXT_MAX, MANUAL_TOOL_MAX, type ManualWhere, type WhereKind } from "@/lib/build/graph";
import { toolName } from "@/lib/tools/registry";
import { MEDIA_MAX_BYTES, mediaKindFor } from "@/lib/build/media";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { Field } from "./composeControls";
import { dialogTitle, text as type, tnum, typedField, windowStyle } from "./refinedStyles";
import { ToolPicker } from "./ToolPicker";

export const MANUAL_DIALOG_COPY = {
  title: "Add a manual step",
  placeholder: "What you did",
  missing: "Manual steps need the Deploy queue item from UI-P61.",
  where: "Where was it done?",
  whatWasDone: "What was done",
  addLine: "Add a line",
  siteLink: "Link to the website",
} as const;

/** CA-12 P10: where a manual step can have been done. "App or website" takes an app from the apps list. */
export const WHERE_CHOICES: readonly { value: WhereKind; label: string }[] = [
  { value: "app", label: "An app or website" },
  { value: "terminal", label: "A terminal" },
  { value: "phone", label: "On a phone" },
  { value: "offline", label: "Offline, in person" },
  { value: "site", label: "Another website" },
];

export interface AddManualStepInput {
  where: ManualWhere;
  /** 1 to 12 lines, each up to 140 characters. */
  lines: string[];
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
  const [kind, setKind] = useState<WhereKind>("app");
  const [picked, setPicked] = useState<string | null>(null);
  const [site, setSite] = useState("");
  const [lines, setLines] = useState<string[]>([""]);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const lineRefs = useRef<(HTMLInputElement | null)[]>([]);
  const uid = useId();

  const appName = picked ? (toolName(picked) ?? picked.trim()) : "";
  const kept = lines.map((line) => line.trim()).filter(Boolean);
  const placeOk = kind === "app" ? appName.length > 0 && appName.length <= MANUAL_TOOL_MAX : kind === "site" ? site.trim().length > 0 : true;
  const ready = available && placeOk && kept.length > 0 && kept.length <= MANUAL_LINES_MAX;
  const where = (): ManualWhere => ({ kind, name: kind === "app" ? appName : null, url: kind === "site" ? site.trim() : null });
  const setLine = (at: number, value: string) => setLines((current) => current.map((line, i) => (i === at ? value : line)));
  const addLine = (focus = true) => {
    if (lines.length >= MANUAL_LINES_MAX) return;
    setLines((current) => [...current, ""]);
    if (focus) window.setTimeout(() => lineRefs.current[lines.length]?.focus(), 0);
  };

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
        if (ready) onAdd({ where: where(), lines: kept, file });
      }}
      /* The global field rule makes a field inherit its size on a desktop, so the form sets the fields' 13 here. */
      style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: phone ? 16 : 13 }}
    >
      {after ? <p style={{ ...type(12.5, 400, t.text2), margin: 0 }}>Goes after {after}</p> : null}

      <Field id={`${uid}-where`} label={MANUAL_DIALOG_COPY.where} group>
        <div role="radiogroup" aria-label={MANUAL_DIALOG_COPY.where} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {WHERE_CHOICES.map((choice) => (
            <Button key={choice.value} variant={kind === choice.value ? "primary" : "secondary"} size={phone ? 44 : 30} fontSize={13} aria-pressed={kind === choice.value} onClick={() => setKind(choice.value)}>
              {choice.label}
            </Button>
          ))}
        </div>
        {kind === "app" ? (
          <div>
            <ToolPicker label="Tool" value={picked} onChange={setPicked} inBuild={inBuild} phone={phone} step="manual" list="app" placeholder="Pick an app" />
          </div>
        ) : null}
        {kind === "site" ? (
          <input type="text" inputMode="url" aria-label={MANUAL_DIALOG_COPY.siteLink} placeholder="https://" value={site} onChange={(event) => setSite(event.target.value)} style={typedField(phone)} />
        ) : null}
      </Field>

      <Field id={`${uid}-text`} label={MANUAL_DIALOG_COPY.whatWasDone} group>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {lines.map((line, at) => (
            <li key={at} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...type(12, 400, t.text2), ...tnum, minWidth: 16 }}>{at + 1}</span>
              <input
                ref={(el) => {
                  lineRefs.current[at] = el;
                }}
                type="text"
                aria-label={`Line ${at + 1}`}
                value={line}
                maxLength={MANUAL_TEXT_MAX}
                placeholder={at === 0 ? MANUAL_DIALOG_COPY.placeholder : ""}
                onChange={(event) => setLine(at, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    // Enter adds the next line instead of sending the form; an empty line sends nothing.
                    event.preventDefault();
                    if (line.trim()) addLine();
                  }
                }}
                style={{ ...typedField(phone), flexGrow: 1 }}
              />
            </li>
          ))}
        </ol>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button variant="ghost" size={phone ? 44 : 30} fontSize={13} disabled={lines.length >= MANUAL_LINES_MAX} onClick={() => addLine()}>
            {MANUAL_DIALOG_COPY.addLine}
          </Button>
          <span data-testid="manual-counter" style={{ ...type(11.5, 400, t.text2), ...tnum }}>
            {lines.length} / {MANUAL_LINES_MAX} lines
          </span>
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
