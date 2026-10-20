/* CA-02 P7 — Add › "Code".

   A Radix dialog, 600 wide, on the Card's surface tokens (a `BottomSheet` below 768), built like the manual step's:

   - Title, required: the name the step takes in the build list. It sits above the code.
   - The code: an editable `CodeFileBlock` (the file name as a field in its header, a line-number gutter, highlighted
     code, "+N" counted live). It grows as the text does; Tab puts in two spaces.
   - Language: a select over the code node type's enum, prefilled from the file name's ending (else from the text, by
     `codeLanguageFor`) until it is chosen by hand.
   - Written with, optional: a tool for code and its model, by the Typed here rules (`ModelPicker`).
   - Upload files: text files only. Each becomes its own step, with its own `CodeFileBlock` and a title that starts as
     its file name; a file that is not text, or over 100,000 characters, is refused by name.
   - "Add", the one primary (disabled until there is a title and code), and "Cancel".

   NOTHING HERE RUNS CODE.

   CA-03 P2: the labels are the composer's `Field`; the language is a menu (`PickMenu`) showing the language's name
   ("TypeScript"), never a native select, and the value it saves is the schema's enum as before ("ts"). Only code and
   file names are in the data face. The dialog is the window recipe with a 15/500 title. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, useRef, useState, type CSSProperties } from "react";

import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { CodeFileBlock } from "@/components/code/CodeFileBlock";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { CODE_FILENAME_MAX, CODE_LANGUAGES, CODE_MAX, TITLE_MAX, type CodeLanguage } from "@/lib/build/graph";
import { nextModelAfterToolChange } from "@/lib/tools/modelRules";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { CODE_COPY, codeLanguageFor, isCodeLanguage, lineCount, readCodeFile } from "./codeModel";
import { Field } from "./composeControls";
import { ModelPicker } from "./ModelPicker";
import { PickMenu } from "./PickMenu";
import { dialogTitle, tnum, typedField, windowStyle } from "./refinedStyles";
import { ToolPicker } from "./ToolPicker";

export const CODE_DIALOG_COPY = {
  title: "Add code",
  titleField: "Title",
  titleRequired: "Add a title.",
  titleOf: (name: string) => `Title of ${name}`,
  code: "Code",
  placeholder: "Paste or type the code",
  language: "Language",
  filename: "File name",
  filenamePlaceholder: "app.ts",
  writtenWith: "Written with, optional",
  writtenWithTool: "Written with",
  upload: "Upload files",
  uploadLine: "Text files only. Each one is its own step.",
  remove: (name: string) => `Remove ${name}`,
  add: "Add",
  cancel: "Cancel",
  /** CA-03: how each saved language is shown. What is saved does not change. */
  languages: {
    ts: "TypeScript",
    tsx: "TypeScript (TSX)",
    js: "JavaScript",
    jsx: "JavaScript (JSX)",
    python: "Python",
    sql: "SQL",
    json: "JSON",
    yaml: "YAML",
    bash: "Bash",
    html: "HTML",
    css: "CSS",
    other: "Other",
  } satisfies Record<CodeLanguage, string>,
} as const;

/** One code step the dialog hands back. */
export interface CodeStepInput {
  /** What the step is called in the build list. */
  title: string;
  source: string;
  language: CodeLanguage;
  filename: string | null;
}

export interface AddCodeInput {
  /** The typed code first, when there is any, then each uploaded file in the order chosen. */
  steps: CodeStepInput[];
  tool: string | null;
  model: string | null;
}

export interface AddCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddCodeInput) => void;
  /** The tools the build already uses, first in the tool picker. */
  inBuild?: readonly string[];
  /** "Keep it as code": the text pasted into Typed here, to start the well with. */
  seed?: string | null;
}

/** A file taken from the computer, on its way in as a step of its own. */
interface UploadedFile extends CodeStepInput {
  filename: string;
}

function Form({ onAdd, onCancel, phone, inBuild = [], seed }: Pick<AddCodeDialogProps, "onAdd" | "inBuild" | "seed"> & { onCancel: () => void; phone: boolean }) {
  const [title, setTitle] = useState("");
  const [source, setSource] = useState(seed ?? "");
  const [filename, setFilename] = useState("");
  /** Null while the language follows the file name and the text. */
  const [chosen, setChosen] = useState<CodeLanguage | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [refused, setRefused] = useState<string[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const uid = useId();

  const language = chosen ?? codeLanguageFor(source, filename);
  const typed = source.trim().length > 0;
  const titled = title.trim().length > 0;
  const tooLong = source.length > CODE_MAX;
  /* The title and the code are both needed for what is typed; an uploaded file brings its own title (its name, to start). */
  const ready = (typed || files.length > 0) && (!typed || titled) && files.every((file) => file.title.trim().length > 0) && !tooLong && filename.length <= CODE_FILENAME_MAX;

  const quiet: CSSProperties = { fontFamily: FIGTREE, fontSize: 12.5, color: t.text2 };

  const take = async (picked: File[]) => {
    const read = await Promise.all(picked.map(readCodeFile));
    setFiles((list) => [...list, ...read.flatMap((entry) => ("reason" in entry ? [] : [{ title: entry.filename.slice(0, TITLE_MAX), source: entry.source, language: entry.language, filename: entry.filename }]))]);
    setRefused(read.flatMap((entry) => ("reason" in entry ? [`${entry.filename}: ${entry.reason}`] : [])));
  };

  const submit = () => {
    if (!ready) return;
    const steps: CodeStepInput[] = [...(typed ? [{ title: title.trim(), source, language, filename: filename.trim() || null }] : []), ...files.map((file) => ({ ...file, title: file.title.trim() }))];
    onAdd({ steps, tool, model });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      /* The global field rule makes a field inherit its size on a desktop, so the form sets the fields' 13 here. */
      style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: phone ? 16 : 13 }}
    >
      <Field id={`${uid}-title`} label={CODE_DIALOG_COPY.titleField}>
        <input
          id={`${uid}-title`}
          type="text"
          value={title}
          maxLength={TITLE_MAX}
          autoComplete="off"
          aria-required="true"
          aria-invalid={typed && !titled ? true : undefined}
          aria-describedby={typed && !titled ? `${uid}-title-needed` : undefined}
          onChange={(event) => setTitle(event.target.value)}
          style={typedField(phone)}
        />
        {typed && !titled ? (
          <span id={`${uid}-title-needed`} role="alert" style={quiet}>
            {CODE_DIALOG_COPY.titleRequired}
          </span>
        ) : null}
      </Field>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <CodeFileBlock
          data-testid="code-block"
          filename={filename}
          onFilenameChange={setFilename}
          filenamePlaceholder={CODE_DIALOG_COPY.filenamePlaceholder}
          filenameMax={CODE_FILENAME_MAX}
          filenameLabel={CODE_DIALOG_COPY.filename}
          source={source}
          onSourceChange={setSource}
          codeLabel={CODE_DIALOG_COPY.code}
          codePlaceholder={CODE_DIALOG_COPY.placeholder}
          language={language}
          phone={phone}
        />
        {tooLong ? (
          <span role="alert" style={quiet}>
            {CODE_COPY.tooLong}
          </span>
        ) : null}
      </div>

      <Field id={`${uid}-language`} label={CODE_DIALOG_COPY.language}>
        <span>
          <PickMenu
            id={`${uid}-language`}
            label={CODE_DIALOG_COPY.language}
            options={CODE_LANGUAGES.map((value) => ({ value, label: CODE_DIALOG_COPY.languages[value] }))}
            value={language}
            onChange={(next) => {
              if (isCodeLanguage(next)) setChosen(next);
            }}
            phone={phone}
          />
        </span>
      </Field>

      <Field id={`${uid}-written`} label={CODE_DIALOG_COPY.writtenWith} group>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <ToolPicker
            label={CODE_DIALOG_COPY.writtenWithTool}
            value={tool}
            onChange={(next) => {
              setTool(next);
              setModel(nextModelAfterToolChange(next, model).model);
            }}
            inBuild={inBuild}
            allowNone
            phone={phone}
            step="code"
          />
          <ModelPicker tool={tool} value={model} onChange={setModel} phone={phone} />
        </div>
      </Field>

      <Field id={`${uid}-upload`} label={CODE_DIALOG_COPY.upload} group>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          accept="text/*,.ts,.tsx,.js,.jsx,.mjs,.py,.sql,.json,.yml,.yaml,.sh,.html,.css,.md,.toml"
          data-testid="code-files"
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (picked.length) void take(picked);
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" size={phone ? 44 : 30} fontSize={13} onClick={() => picker.current?.click()}>
            {CODE_DIALOG_COPY.upload}
          </Button>
          <span style={quiet}>{CODE_DIALOG_COPY.uploadLine}</span>
        </div>
        {files.length > 0 ? (
          <ul aria-label={CODE_DIALOG_COPY.upload} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            {files.map((file, index) => (
              <li key={`${file.filename}-${index}`} data-testid="uploaded-step" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="text"
                    aria-label={CODE_DIALOG_COPY.titleOf(file.filename)}
                    aria-invalid={file.title.trim() ? undefined : true}
                    value={file.title}
                    maxLength={TITLE_MAX}
                    autoComplete="off"
                    onChange={(event) => setFiles((list) => list.map((entry, i) => (i === index ? { ...entry, title: event.target.value } : entry)))}
                    style={{ ...typedField(phone), flexGrow: 1, minWidth: 0 }}
                  />
                  <IconButton
                    icon={X}
                    glyph="x"
                    boxed={false}
                    size={26}
                    label={CODE_DIALOG_COPY.remove(file.filename)}
                    onClick={() => setFiles((list) => list.filter((_, i) => i !== index))}
                    style={{ width: phone ? 44 : 26, height: phone ? 44 : 26, flexShrink: 0 }}
                  />
                </div>
                <CodeFileBlock filename={file.filename} source={file.source} language={file.language} codeLabel={file.filename} phone={phone} />
              </li>
            ))}
          </ul>
        ) : null}
        {refused.length > 0 ? (
          <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {refused.map((line) => (
              <span key={line} style={quiet}>
                {line}
              </span>
            ))}
          </div>
        ) : null}
      </Field>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" size={phone ? 44 : 30} onClick={onCancel}>
          {CODE_DIALOG_COPY.cancel}
        </Button>
        <Button variant="primary" size={phone ? 44 : 30} type="submit" disabled={!ready}>
          {CODE_DIALOG_COPY.add}
        </Button>
      </div>
    </form>
  );
}

export function AddCodeDialog({ open, onOpenChange, onAdd, inBuild, seed = null }: AddCodeDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddCodeInput) => {
    onAdd(input);
    close();
  };

  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={CODE_DIALOG_COPY.title}>
        {open ? <Form inBuild={inBuild} seed={seed} onAdd={add} onCancel={close} phone /> : null}
      </BottomSheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          aria-describedby={undefined}
          data-testid="add-code-dialog"
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...windowStyle(600) }}
        >
          <Dialog.Title style={dialogTitle}>{CODE_DIALOG_COPY.title}</Dialog.Title>
          <Form inBuild={inBuild} seed={seed} onAdd={add} onCancel={close} phone={false} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddCodeDialog;
