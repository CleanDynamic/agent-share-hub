/* CA-15 P9: Add › "System prompt": instructions that apply across prompts.

   The shared modal frame, 520 wide (a `BottomSheet` below 768). Required:

   - Name: the tile's title.
   - Text: the instructions, up to 20,000 characters. A `{name}` written in it is a variable.
   - Applies to: All prompts, This session, or Selected prompts. Selected prompts shows a checklist of the build's prompts. It
     is stored in `scope` as `all`, `session:<key>` or `prompts:<id,id>`.

   Optional: Model, Version, and Variables (each `{name}` found in the text, with a line about it, as in the prompt window). */

import { useId, useState } from "react";

import { Segmented } from "@/components/brand/Segmented";
import { Checkbox } from "@/components/brand/Checkbox";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { TITLE_MAX, type SystemPromptInput } from "@/lib/build/graph";
import { SYSTEM_PROMPT_TEXT_MAX, SYSTEM_PROMPT_VERSION_MAX, type SystemPromptScope } from "@/lib/build/sourceTiles";
import { VARIABLE_DESCRIPTION_MAX, variablesFor } from "@/lib/build/tileExtras";
import { t } from "@/lib/theme/tokens";

import { Field } from "./composeControls";
import { FieldRow, FieldRows, Hint, ModalForm, ModalShell, firstMissing } from "./ModalFrame";
import { ModelPicker } from "./ModelPicker";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { text, tnum, typedArea, typedField } from "./refinedStyles";

export const SYSTEM_PROMPT_DIALOG_COPY = {
  title: "Add a system prompt",
  subtitle: "Instructions that apply across prompts",
  name: "Name",
  namePlaceholder: "e.g. Brand voice",
  text: "Text",
  textPlaceholder: "e.g. You write in plain British English and never use buzzwords.",
  appliesTo: "Applies to",
  all: "All prompts",
  session: "This session",
  selected: "Selected prompts",
  noPrompts: "This build has no prompts yet.",
  noSession: "There is no current session to apply it to.",
  model: "Model",
  modelLine: "The model the system prompt was written for",
  version: "Version",
  versionLine: "A version or date, so a change can be told apart",
  versionPlaceholder: "e.g. v2",
  variables: "Variables",
  variablesLine: "The {names} written in the text, each with a line about it",
  noVariables: "No {variables} written in the text yet.",
  add: "Add",
  cancel: "Cancel",
} as const;

export type AddSystemPromptInput = Omit<SystemPromptInput, "session">;

export interface AddSystemPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddSystemPromptInput) => void;
  /** The build's prompts, for "Selected prompts". */
  prompts: readonly { id: string; label: string }[];
  /** The session the tile is being added to: what "This session" means. Null when there is none. */
  session: string | null;
}

type Applies = "all" | "session" | "prompts";

function Form({ onAdd, onCancel, phone, prompts, session }: Pick<AddSystemPromptDialogProps, "onAdd" | "prompts" | "session"> & { onCancel: () => void; phone: boolean }) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [applies, setApplies] = useState<Applies>("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [model, setModel] = useState<string | null>(null);
  const [version, setVersion] = useState("");
  const [described, setDescribed] = useState<Record<string, string>>({});
  const uid = useId();
  const variables = variablesFor(body, []).map((variable) => ({ name: variable.name, description: (described[variable.name] ?? "").trim() }));

  const missing = firstMissing([
    [name.trim().length > 0, "a name"],
    [body.trim().length > 0, "the text"],
    [applies !== "prompts" || picked.length > 0, "at least one prompt for it to apply to"],
    [applies !== "session" || session !== null, "a current session to apply it to"],
  ]);

  const submit = () => {
    const scope: SystemPromptScope = applies === "all" ? { kind: "all" } : applies === "session" ? { kind: "session", key: session as string } : { kind: "prompts", ids: picked };
    onAdd({
      name: name.trim(),
      text: body.trim(),
      scope,
      ...(model?.trim() ? { model: model.trim() } : null),
      ...(version.trim() ? { version: version.trim() } : null),
      ...(variables.some((variable) => variable.description) ? { variables } : null),
    });
  };

  return (
    <ModalForm phone={phone} onSubmit={submit} onCancel={onCancel} missing={missing}>
      <FieldRows>
        <FieldRow id={`${uid}-name`} label={SYSTEM_PROMPT_DIALOG_COPY.name} phone={phone}>
          <input id={`${uid}-name`} type="text" value={name} maxLength={TITLE_MAX} placeholder={SYSTEM_PROMPT_DIALOG_COPY.namePlaceholder} onChange={(event) => setName(event.target.value)} style={typedField(phone)} />
        </FieldRow>
      </FieldRows>

      <Field id={`${uid}-text`} label={SYSTEM_PROMPT_DIALOG_COPY.text}>
        <textarea id={`${uid}-text`} rows={8} maxLength={SYSTEM_PROMPT_TEXT_MAX} value={body} placeholder={SYSTEM_PROMPT_DIALOG_COPY.textPlaceholder} onChange={(event) => setBody(event.target.value)} style={typedArea(phone, { resize: "vertical" })} />
        <span style={{ ...text(11.5, 400, t.text2), ...tnum, alignSelf: "flex-end" }}>
          {body.length.toLocaleString("en-GB")} / {SYSTEM_PROMPT_TEXT_MAX.toLocaleString("en-GB")}
        </span>
      </Field>

      <Field id={`${uid}-applies`} label={SYSTEM_PROMPT_DIALOG_COPY.appliesTo} group>
        <Segmented<Applies>
          label={SYSTEM_PROMPT_DIALOG_COPY.appliesTo}
          semantics="radio"
          size={phone ? 50 : 30}
          fontSize={13}
          fullWidth
          items={[
            { value: "all", label: SYSTEM_PROMPT_DIALOG_COPY.all },
            { value: "session", label: SYSTEM_PROMPT_DIALOG_COPY.session, disabled: session === null },
            { value: "prompts", label: SYSTEM_PROMPT_DIALOG_COPY.selected, disabled: prompts.length === 0 },
          ]}
          value={applies}
          onChange={setApplies}
        />
        {session === null ? <Hint>{SYSTEM_PROMPT_DIALOG_COPY.noSession}</Hint> : null}
        {prompts.length === 0 ? <Hint>{SYSTEM_PROMPT_DIALOG_COPY.noPrompts}</Hint> : null}
        {applies === "prompts" ? (
          <div role="group" aria-label={SYSTEM_PROMPT_DIALOG_COPY.selected} style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
            {prompts.map((prompt) => (
              <label key={prompt.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 28 }}>
                <Checkbox checked={picked.includes(prompt.id)} onChange={(event) => setPicked((now) => (event.target.checked ? [...now, prompt.id] : now.filter((id) => id !== prompt.id)))} />
                <span style={{ ...text(13, 400, t.text), overflowWrap: "anywhere" }}>{prompt.label}</span>
              </label>
            ))}
          </div>
        ) : null}
      </Field>

      <OptionalSection>
        <OptionalField name={SYSTEM_PROMPT_DIALOG_COPY.model} description={SYSTEM_PROMPT_DIALOG_COPY.modelLine} summary={summaryOf(model)} phone={phone}>
          <Field id={`${uid}-model`} label={SYSTEM_PROMPT_DIALOG_COPY.model} group>
            <div>
              <ModelPicker tool={null} anyWithoutTool value={model} onChange={setModel} phone={phone} />
            </div>
          </Field>
        </OptionalField>

        <OptionalField name={SYSTEM_PROMPT_DIALOG_COPY.version} description={SYSTEM_PROMPT_DIALOG_COPY.versionLine} summary={summaryOf(version)} phone={phone}>
          <input aria-label={SYSTEM_PROMPT_DIALOG_COPY.version} type="text" maxLength={SYSTEM_PROMPT_VERSION_MAX} value={version} placeholder={SYSTEM_PROMPT_DIALOG_COPY.versionPlaceholder} onChange={(event) => setVersion(event.target.value)} style={typedField(phone, { width: 200 })} />
        </OptionalField>

        <OptionalField name={SYSTEM_PROMPT_DIALOG_COPY.variables} description={SYSTEM_PROMPT_DIALOG_COPY.variablesLine} summary={summaryOf(variables.map((variable) => `{${variable.name}}`))} phone={phone}>
          {variables.length === 0 ? <Hint>{SYSTEM_PROMPT_DIALOG_COPY.noVariables}</Hint> : null}
          {variables.map((variable) => (
            <Field key={variable.name} id={`${uid}-var-${variable.name}`} label={`{${variable.name}}`}>
              <input
                id={`${uid}-var-${variable.name}`}
                type="text"
                maxLength={VARIABLE_DESCRIPTION_MAX}
                value={described[variable.name] ?? ""}
                placeholder="e.g. The customer's first name"
                onChange={(event) => setDescribed((now) => ({ ...now, [variable.name]: event.target.value }))}
                style={typedField(phone)}
              />
            </Field>
          ))}
        </OptionalField>
      </OptionalSection>
    </ModalForm>
  );
}

export function AddSystemPromptDialog({ open, onOpenChange, onAdd, prompts, session }: AddSystemPromptDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddSystemPromptInput) => {
    onAdd(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={SYSTEM_PROMPT_DIALOG_COPY.title} subtitle={SYSTEM_PROMPT_DIALOG_COPY.subtitle} width={520} testId="add-system-prompt-dialog">
      <Form onAdd={add} onCancel={close} phone={phone} prompts={prompts} session={session} />
    </ModalShell>
  );
}

export default AddSystemPromptDialog;
