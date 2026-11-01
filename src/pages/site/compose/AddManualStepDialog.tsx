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
   numbers; the dialog is the window recipe with a 15/500 title.

   CA-15b: it has no board, so it is built from `modalRecipes` in the boards' pattern, on the shared frame (`ModalShell`,
   `ModalForm`), 560 wide: a block for where it was done (an option grid, then the application's picker field or the
   website's link), a block for what was done (numbered lines, "Add a line", the count at the right), a block for the
   picture, and the footer, which says what is still required. */

import { useId, useRef, useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { MANUAL_LINES_MAX, MANUAL_TEXT_MAX, MANUAL_TOOL_MAX, type ManualWhere, type WhereKind } from "@/lib/build/graph";
import { toolName } from "@/lib/tools/registry";
import { MEDIA_MAX_BYTES, mediaKindFor } from "@/lib/build/media";

import { MODAL_COPY, ModalForm, ModalShell, missingLabels, type EditMode } from "./ModalFrame";
import { Alert, Block, BlockHead, FieldInput, FileButton, FileLine, GROW, Inline, LabelText, MODAL_WIDTH, OptionGrid, PANEL_LIST, TextLink } from "./modalRecipes";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { ToolPicker } from "./ToolPicker";
import { ApprovalForm, type ApprovalChoices } from "./ApprovalForm";
import { GATE_COPY, type Gate } from "@/lib/build/teamFields";

export const MANUAL_DIALOG_COPY = {
  title: "Add a manual step",
  missing: "Not available yet",
  where: "Where",
  whatWasDone: "What was done",
  addLine: "Add a line",
  siteLink: "Website link",
  subtitle: "Work done outside AI",
  after: (step: string) => `Goes after ${step}`,
  picture: "Picture",
  addPicture: "Add a picture",
  anotherPicture: "Replace",
  lines: (n: number) => `${n} / ${MANUAL_LINES_MAX} lines`,
} as const;

/** CA-12 P10: where a manual step can have been done. "App or website" takes an app from the apps list. */
export const WHERE_CHOICES: readonly { value: WhereKind; label: string }[] = [
  { value: "app", label: "App or website" },
  { value: "terminal", label: "Terminal" },
  { value: "phone", label: "Phone" },
  { value: "offline", label: "In person" },
  { value: "site", label: "Other website" },
];

export interface AddManualStepInput {
  where: ManualWhere;
  /** 1 to 12 lines, each up to 140 characters. */
  lines: string[];
  file: File | null;
  /** CA-18: opened on a step that is there: its picture was taken off, and no other put in its place. */
  pictureRemoved?: boolean;
  /** SV-28 P4: Add > Approval, or an Approval step's window: the gate it holds (and then no lines). */
  gate?: Gate;
}

/** CA-18: what the form starts with on a step that is there. */
export interface ManualSeed {
  where: ManualWhere | null;
  lines: string[];
  /** Its picture, by the name it was kept under. */
  picture: string | null;
}

export interface AddManualStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The step it will go after, named for the line under the title ("after 3 · Fix the layout"); null: at the end. */
  after: string | null;
  /** False while the `manual_step` node type is not live. */
  available: boolean;
  onAdd?: (input: AddManualStepInput) => void;
  /** The tools the build already uses, first in the tool picker. */
  inBuild?: readonly string[];
  seed?: ManualSeed | null;
  edit?: EditMode<AddManualStepInput>;
  /** SV-28 P4: the window is for an Approval step: the steps it can hold back, and its gate when it is there. */
  approval?: ApprovalChoices & { gate?: Gate | null; self?: string };
}

function Form({ available, onAdd, onCancel, phone, inBuild = [], seed, edit }: Pick<AddManualStepDialogProps, "available" | "onAdd" | "inBuild" | "seed" | "edit"> & { onCancel: () => void; phone: boolean }) {
  const [kind, setKind] = useState<WhereKind>(seed?.where?.kind ?? "app");
  const [picked, setPicked] = useState<string | null>(seed?.where?.kind === "app" ? seed.where.name : null);
  const [site, setSite] = useState(seed?.where?.kind === "site" ? (seed.where.url ?? "") : "");
  const [lines, setLines] = useState<string[]>(seed && seed.lines.length > 0 ? seed.lines : [""]);
  const [file, setFile] = useState<File | null>(null);
  const [kept, setKept] = useState<string | null>(seed?.picture ?? null);
  const [fileError, setFileError] = useState<string | null>(null);
  const lineRefs = useRef<(HTMLInputElement | null)[]>([]);
  const uid = useId();

  const appName = picked ? (toolName(picked) ?? picked.trim()) : "";
  const done = lines.map((line) => line.trim()).filter(Boolean);
  const placeOk = kind === "app" ? appName.length > 0 && appName.length <= MANUAL_TOOL_MAX : kind === "site" ? site.trim().length > 0 : true;
  const missing = missingLabels([
    [placeOk, kind === "site" ? MANUAL_DIALOG_COPY.siteLink : "App"],
    [done.length > 0, MANUAL_DIALOG_COPY.whatWasDone],
  ]);
  const where = (): ManualWhere => ({ kind, name: kind === "app" ? appName : null, url: kind === "site" ? site.trim() : null });
  const input = (): AddManualStepInput => ({ where: where(), lines: done, file, ...(seed?.picture && kept === null && !file ? { pictureRemoved: true } : null) });

  const setLine = (at: number, value: string) => setLines((current) => current.map((line, i) => (i === at ? value : line)));
  const addLine = (focus = true) => {
    if (lines.length >= MANUAL_LINES_MAX) return;
    setLines((current) => [...current, ""]);
    if (focus) window.setTimeout(() => lineRefs.current[lines.length]?.focus(), 0);
  };

  const choose = (list: FileList | null) => {
    const picked = list?.[0];
    if (!picked) return;
    if (mediaKindFor(picked.type) !== "image") setFileError(`${picked.name}: image only`);
    else if (picked.size > MEDIA_MAX_BYTES) setFileError(`${picked.name}: ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} MB max`);
    else {
      setFileError(null);
      setFile(picked);
    }
  };

  return (
    <ModalForm phone={phone} missing={missing} blocked={!available || done.length > MANUAL_LINES_MAX} alert={available ? null : MANUAL_DIALOG_COPY.missing} onCancel={onCancel} addLabel={edit ? MODAL_COPY.save : undefined} onSubmit={() => (edit ? edit.onSave(input()) : onAdd?.(input()))}>
      {edit?.before ? edit.before(input()) : null}
      <Block label={MANUAL_DIALOG_COPY.where} noRule>
        <BlockHead label={MANUAL_DIALOG_COPY.where} />
        <OptionGrid<WhereKind> label={MANUAL_DIALOG_COPY.where} bare phone={phone} items={WHERE_CHOICES} chosen={[kind]} onPick={setKind} />
        {kind === "app" ? <ToolPicker label="App" value={picked} onChange={setPicked} inBuild={inBuild} phone={phone} step="manual" list="app" placeholder="Select an app" field /> : null}
        {kind === "site" ? <FieldInput phone={phone} mono inputMode="url" aria-label={MANUAL_DIALOG_COPY.siteLink} placeholder="https://" value={site} onChange={(event) => setSite(event.target.value)} /> : null}
      </Block>

      <Block label={MANUAL_DIALOG_COPY.whatWasDone}>
        <BlockHead label={MANUAL_DIALOG_COPY.whatWasDone} count={MANUAL_DIALOG_COPY.lines(lines.length)} countTestId="manual-counter" />
        <ol style={{ ...PANEL_LIST, margin: 0, padding: 0, listStyle: "none" }}>
          {lines.map((line, at) => (
            <li key={at}>
              <Inline>
                <LabelText>{at + 1}</LabelText>
                <span style={GROW}>
                  <FieldInput
                    phone={phone}
                    ref={(el) => {
                      lineRefs.current[at] = el;
                    }}
                    aria-label={`Line ${at + 1}`}
                    value={line}
                    maxLength={MANUAL_TEXT_MAX}
                    
                    onChange={(event) => setLine(at, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                        // Enter adds the next line instead of sending the form; an empty line sends nothing.
                        event.preventDefault();
                        if (line.trim()) addLine();
                      }
                    }}
                  />
                </span>
              </Inline>
            </li>
          ))}
        </ol>
        <TextLink phone={phone} disabled={lines.length >= MANUAL_LINES_MAX} onClick={() => addLine()}>
          {MANUAL_DIALOG_COPY.addLine}
        </TextLink>
      </Block>

      <OptionalSection>
        <OptionalField name={MANUAL_DIALOG_COPY.picture} summary={summaryOf(file?.name, file ? null : kept)} phone={phone}>
          <Inline>
            <FileButton phone={phone} accept="image/*" onFiles={choose} testId="manual-picture" inputLabel={MANUAL_DIALOG_COPY.addPicture}>
              {file ? MANUAL_DIALOG_COPY.anotherPicture : MANUAL_DIALOG_COPY.addPicture}
            </FileButton>
          </Inline>
          {file ? <FileLine name={file.name} removeLabel="Remove" onRemove={() => setFile(null)} phone={phone} /> : null}
          {!file && kept ? <FileLine name={kept} removeLabel="Remove the picture" onRemove={() => setKept(null)} phone={phone} /> : null}
          {fileError ? <Alert>{fileError}</Alert> : null}
        </OptionalField>
      </OptionalSection>
      {edit?.after ? edit.after(input()) : null}
    </ModalForm>
  );
}

export function AddManualStepDialog({ open, onOpenChange, after, available, onAdd, inBuild, seed, edit, approval }: AddManualStepDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddManualStepInput) => {
    onAdd?.(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={edit ? edit.title : approval ? "Add an approval" : MANUAL_DIALOG_COPY.title} eyebrow={edit ? MODAL_COPY.edit : undefined} subtitle={after && !edit ? MANUAL_DIALOG_COPY.after(after) : approval ? GATE_COPY.addLine : MANUAL_DIALOG_COPY.subtitle} width={MODAL_WIDTH.standard} testId={approval ? (edit ? "edit-approval-dialog" : "add-approval-dialog") : edit ? "edit-manual-dialog" : "add-manual-dialog"}>
      {approval ? (
        <ApprovalForm
          choices={approval}
          gate={approval.gate}
          self={approval.self}
          phone={phone}
          editing={Boolean(edit)}
          onCancel={close}
          onSubmit={(gate) => {
            const input: AddManualStepInput = { where: { kind: "offline", name: null, url: null }, lines: [], file: null, gate };
            if (edit) {
              edit.onSave(input);
              close();
            } else add(input);
          }}
        />
      ) : (
        <Form available={available} inBuild={inBuild} seed={seed} edit={edit && { ...edit, onSave: (input) => { edit.onSave(input); close(); } }} onAdd={add} onCancel={close} phone={phone} />
      )}
    </ModalShell>
  );
}

export default AddManualStepDialog;
