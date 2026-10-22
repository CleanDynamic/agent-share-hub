/* CA-02 P7, CA-15 P6 — Add › "Code": source code produced in this step, as it was used.

   The shared modal frame, 520 wide (a `BottomSheet` below 768). Required: the code, typed or uploaded.

   - The code: `CodeEditorField` (CA-11), a monospace well with a numbered gutter; Tab puts in two spaces.
   - Upload files: text files only. Each file is added as a separate step, named by its path; a file that is not text, or
     over 100,000 characters, is refused by name.
   - Language: a menu (`PickMenu`) showing the language's name ("TypeScript"), never a native select; the value it saves is the
     schema's enum ("ts"). Prefilled from the text (`codeLanguageFor`) until it is chosen by hand; a .tsx, .jsx or .yml
     file path overrides the guess.

   Optional section: File path (120 characters), Generated with (a tool for code and its model, by the Typed here rules).

   NOTHING HERE RUNS CODE. Only code and file paths are in the data face. */

import { X } from "lucide-react";
import { useId, useRef, useState, type CSSProperties } from "react";

import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { CodeEditorField } from "@/components/code/CodeEditorField";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { CODE_FILENAME_MAX, CODE_LANGUAGES, CODE_MAX, type CodeLanguage } from "@/lib/build/graph";
import { nextModelAfterToolChange } from "@/lib/tools/modelRules";
import { toolName } from "@/lib/tools/registry";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { CODE_COPY, codeLanguageFor, isCodeLanguage, lineCount, readCodeFile } from "./codeModel";
import { Field } from "./composeControls";
import { FieldRow, FieldRows, ModalForm, ModalShell, firstMissing } from "./ModalFrame";
import { ModelPicker } from "./ModelPicker";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { PickMenu } from "./PickMenu";
import { tnum, typedField } from "./refinedStyles";
import { ToolPicker } from "./ToolPicker";

export const CODE_DIALOG_COPY = {
  title: "Add code",
  subtitle: "Source code produced in this step, as it was used",
  code: "Code",
  placeholder: "Paste or type the code",
  language: "Language",
  filename: "File path",
  filenameLine: "Where the code lives in the project",
  filenamePlaceholder: "e.g. src/app.ts",
  writtenWith: "Generated with",
  writtenWithLine: "The tool and model that produced the code",
  writtenWithTool: "Generated with",
  upload: "Upload files",
  uploadLine: "Text files only. Each file is added as a separate step.",
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

function Form({ onAdd, onCancel, phone, inBuild = [], seed }: Pick<AddCodeDialogProps, "onAdd" | "inBuild" | "seed"> & { onCancel: () => void; phone: boolean }) {
  const [source, setSource] = useState(seed ?? "");
  const [filename, setFilename] = useState("");
  /** Null while the language follows the text and the file name. */
  const [chosen, setChosen] = useState<CodeLanguage | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [files, setFiles] = useState<CodeStepInput[]>([]);
  const [refused, setRefused] = useState<string[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const uid = useId();

  const language = chosen ?? codeLanguageFor(source, filename);
  const typed = source.trim().length > 0;
  const tooLong = source.length > CODE_MAX;
  const ready = (typed || files.length > 0) && !tooLong && filename.length <= CODE_FILENAME_MAX;

  const quiet: CSSProperties = { fontFamily: FIGTREE, fontSize: 12.5, color: t.text2 };
  const count: CSSProperties = { fontFamily: FIGTREE, fontSize: 11.5, color: t.text2, ...tnum };

  const take = async (picked: File[]) => {
    const read = await Promise.all(picked.map(readCodeFile));
    setFiles((list) => [...list, ...read.flatMap((entry) => ("reason" in entry ? [] : [{ source: entry.source, language: entry.language, filename: entry.filename }]))]);
    setRefused(read.flatMap((entry) => ("reason" in entry ? [`${entry.filename}: ${entry.reason}`] : [])));
  };

  const submit = () => {
    if (!ready) return;
    const steps: CodeStepInput[] = [...(typed ? [{ source, language, filename: filename.trim() || null }] : []), ...files];
    onAdd({ steps, tool, model });
  };

  const missing = firstMissing([[typed || files.length > 0, "code"]]);

  return (
    <ModalForm phone={phone} missing={missing} blocked={tooLong || filename.length > CODE_FILENAME_MAX} onSubmit={submit} onCancel={onCancel}>
      <Field id={`${uid}-code`} label={CODE_DIALOG_COPY.code}>
        <CodeEditorField id={`${uid}-code`} testId="code-well" value={source} placeholder={CODE_DIALOG_COPY.placeholder} onChange={setSource} />
        {tooLong ? (
          <span role="alert" style={quiet}>
            {CODE_COPY.tooLong}
          </span>
        ) : typed ? (
          <span style={{ ...count, alignSelf: "flex-end" }}>{`${lineCount(source)} ${lineCount(source) === 1 ? "line" : "lines"}`}</span>
        ) : null}
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
          <ul aria-label={CODE_DIALOG_COPY.upload} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {files.map((file, index) => (
              <li key={`${file.filename}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 32 }}>
                <span style={{ fontFamily: DM_MONO, fontSize: 12.5, color: t.text, overflowWrap: "anywhere", flexGrow: 1 }}>{file.filename}</span>
                <span style={count}>{`${CODE_DIALOG_COPY.languages[file.language]} · ${lineCount(file.source)} lines`}</span>
                <IconButton
                  icon={X}
                  glyph="x"
                  boxed={false}
                  size={26}
                  label={CODE_DIALOG_COPY.remove(file.filename ?? "")}
                  onClick={() => setFiles((list) => list.filter((_, i) => i !== index))}
                  style={{ width: phone ? 44 : 26, height: phone ? 44 : 26, flexShrink: 0 }}
                />
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

      <FieldRows>
        <FieldRow id={`${uid}-language`} label={CODE_DIALOG_COPY.language} phone={phone}>
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
        </FieldRow>
      </FieldRows>

      <OptionalSection>
        <OptionalField name={CODE_DIALOG_COPY.filename} description={CODE_DIALOG_COPY.filenameLine} summary={summaryOf(filename)} phone={phone}>
          <input
            aria-label={CODE_DIALOG_COPY.filename}
            type="text"
            value={filename}
            maxLength={CODE_FILENAME_MAX}
            placeholder={CODE_DIALOG_COPY.filenamePlaceholder}
            autoComplete="off"
            onChange={(event) => setFilename(event.target.value)}
            style={typedField(phone, { fontFamily: DM_MONO })}
          />
        </OptionalField>
        <OptionalField name={CODE_DIALOG_COPY.writtenWith} description={CODE_DIALOG_COPY.writtenWithLine} summary={summaryOf(tool ? (toolName(tool) ?? tool) : null, model)} phone={phone}>
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
        </OptionalField>
      </OptionalSection>
    </ModalForm>
  );
}

export function AddCodeDialog({ open, onOpenChange, onAdd, inBuild, seed = null }: AddCodeDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddCodeInput) => {
    onAdd(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={CODE_DIALOG_COPY.title} subtitle={CODE_DIALOG_COPY.subtitle} width={520} testId="add-code-dialog">
      <Form inBuild={inBuild} seed={seed} onAdd={add} onCancel={close} phone={phone} />
    </ModalShell>
  );
}

export default AddCodeDialog;
