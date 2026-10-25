/* CA-15 P9: Add › "System prompt": instructions that apply across prompts.

   CA-15b: built from `modalRecipes` in the boards' pattern (rows, blocks, Optional, footer), 560 wide (a `BottomSheet`
   below 768). Selected prompts is an option grid, several at once, never native checkboxes. Required:

   - Name: the tile's title.
   - Text: the instructions, up to 20,000 characters. A `{name}` written in it is a variable.
   - Applies to: All prompts, This session, or Selected prompts. Selected prompts shows a checklist of the build's prompts. It
     is stored in `scope` as `all`, `session:<key>` or `prompts:<id,id>`.

   Optional: Model, Version, and Variables (each `{name}` found in the text, with a line about it, as in the prompt window). */

import { useId, useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { TITLE_MAX, type SystemPromptInput } from "@/lib/build/graph";
import { SYSTEM_PROMPT_TEXT_MAX, SYSTEM_PROMPT_VERSION_MAX, type SystemPromptScope } from "@/lib/build/sourceTiles";
import { VARIABLE_DESCRIPTION_MAX, variablesFor } from "@/lib/build/tileExtras";

import { MODAL_COPY, ModalForm, ModalShell, missingLabels, type EditMode } from "./ModalFrame";
import { ModelPicker } from "./ModelPicker";
import { Block, BlockHead, FieldArea, FieldInput, Hint, MODAL_WIDTH, NARROW, OptionGrid, Row, SegmentedField } from "./modalRecipes";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";

export const SYSTEM_PROMPT_DIALOG_COPY = {
  title: "Add a system prompt",
  subtitle: "Instructions for several prompts",
  name: "Name",
  namePlaceholder: "Brand voice",
  text: "Text",
  textPlaceholder: "You write in plain British English and never use buzzwords.",
  appliesTo: "Applies to",
  all: "All prompts",
  session: "This session",
  selected: "Selected prompts",
  noPrompts: "No prompts in this build",
  noSession: "No current session",
  model: "Model",
  version: "Version",
  versionLine: "Version or date",
  versionPlaceholder: "v2",
  variables: "Variables",
  variablesLine: "{names} in the text, with a description each",
  noVariables: "No {variables} in the text",
  add: "Add",
  cancel: "Cancel",
} as const;

export type AddSystemPromptInput = Omit<SystemPromptInput, "session">;

/** CA-18: what the form starts with on a system prompt that is there. */
export interface SystemPromptCurrent {
  name: string;
  text: string;
  applies: "all" | "session" | "prompts";
  picked: string[];
  model: string;
  version: string;
  described: Record<string, string>;
}

export interface AddSystemPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (input: AddSystemPromptInput) => void;
  current?: SystemPromptCurrent | null;
  edit?: EditMode<AddSystemPromptInput>;
  /** The build's prompts, for "Selected prompts". */
  prompts: readonly { id: string; label: string }[];
  /** The session the tile is being added to: what "This session" means. Null when there is none. */
  session: string | null;
}

type Applies = "all" | "session" | "prompts";

function Form({ onAdd, onCancel, phone, prompts, session, current, edit }: Pick<AddSystemPromptDialogProps, "onAdd" | "prompts" | "session" | "current" | "edit"> & { onCancel: () => void; phone: boolean }) {
  const [name, setName] = useState(current?.name ?? "");
  const [body, setBody] = useState(current?.text ?? "");
  const [applies, setApplies] = useState<Applies>(current?.applies ?? "all");
  const [picked, setPicked] = useState<string[]>(current?.picked ?? []);
  const [model, setModel] = useState<string | null>(current?.model || null);
  const [version, setVersion] = useState(current?.version ?? "");
  const [described, setDescribed] = useState<Record<string, string>>(current?.described ?? {});
  const uid = useId();
  const variables = variablesFor(body, []).map((variable) => ({ name: variable.name, description: (described[variable.name] ?? "").trim() }));

  const missing = missingLabels([
    [name.trim().length > 0, "Name"],
    [body.trim().length > 0, "Text"],
    [applies !== "prompts" || picked.length > 0, "A prompt to apply to"],
    [applies !== "session" || session !== null, "A current session"],
  ]);

  const submit = () => {
    const scope: SystemPromptScope = applies === "all" ? { kind: "all" } : applies === "session" ? { kind: "session", key: session as string } : { kind: "prompts", ids: picked };
    (edit ? edit.onSave : (onAdd ?? (() => undefined)))({
      name: name.trim(),
      text: body.trim(),
      scope,
      ...(model?.trim() ? { model: model.trim() } : null),
      ...(version.trim() ? { version: version.trim() } : null),
      ...(variables.some((variable) => variable.description) ? { variables } : null),
    });
  };

  return (
    <ModalForm phone={phone} onSubmit={submit} onCancel={onCancel} missing={missing} addLabel={edit ? MODAL_COPY.save : undefined}>
      <Row id={`${uid}-name`} label={SYSTEM_PROMPT_DIALOG_COPY.name} noRule phone={phone}>
        <FieldInput phone={phone} id={`${uid}-name`} value={name} maxLength={TITLE_MAX} placeholder={SYSTEM_PROMPT_DIALOG_COPY.namePlaceholder} onChange={(event) => setName(event.target.value)} />
      </Row>

      <Block>
        <BlockHead label={SYSTEM_PROMPT_DIALOG_COPY.text} htmlFor={`${uid}-text`} count={`${body.length.toLocaleString("en-GB")} / ${SYSTEM_PROMPT_TEXT_MAX.toLocaleString("en-GB")}`} />
        <FieldArea phone={phone} id={`${uid}-text`} rows={8} maxLength={SYSTEM_PROMPT_TEXT_MAX} value={body} placeholder={SYSTEM_PROMPT_DIALOG_COPY.textPlaceholder} onChange={(event) => setBody(event.target.value)} />
      </Block>

      <Block label={SYSTEM_PROMPT_DIALOG_COPY.appliesTo}>
        <BlockHead label={SYSTEM_PROMPT_DIALOG_COPY.appliesTo} />
        <SegmentedField<Applies>
          label={SYSTEM_PROMPT_DIALOG_COPY.appliesTo}
          phone={phone}
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
          <OptionGrid
            label={SYSTEM_PROMPT_DIALOG_COPY.selected}
            phone={phone}
            multiple
            columns={2}
            items={prompts.map((prompt) => ({ value: prompt.id, label: prompt.label }))}
            chosen={picked}
            onPick={(id) => setPicked((now) => (now.includes(id) ? now.filter((other) => other !== id) : [...now, id]))}
          />
        ) : null}
      </Block>

      <OptionalSection>
        <OptionalField name={SYSTEM_PROMPT_DIALOG_COPY.model} summary={summaryOf(model)} phone={phone}>
          <ModelPicker tool={null} anyWithoutTool value={model} onChange={setModel} phone={phone} field />
        </OptionalField>
        <OptionalField name={SYSTEM_PROMPT_DIALOG_COPY.version} description={SYSTEM_PROMPT_DIALOG_COPY.versionLine} summary={summaryOf(version)} phone={phone}>
          <FieldInput phone={phone} mono width={NARROW.version} aria-label={SYSTEM_PROMPT_DIALOG_COPY.version} maxLength={SYSTEM_PROMPT_VERSION_MAX} value={version} placeholder={SYSTEM_PROMPT_DIALOG_COPY.versionPlaceholder} onChange={(event) => setVersion(event.target.value)} />
        </OptionalField>
        <OptionalField name={SYSTEM_PROMPT_DIALOG_COPY.variables} description={SYSTEM_PROMPT_DIALOG_COPY.variablesLine} summary={summaryOf(variables.map((variable) => `{${variable.name}}`))} phone={phone}>
          {variables.length === 0 ? <Hint>{SYSTEM_PROMPT_DIALOG_COPY.noVariables}</Hint> : null}
          {variables.map((variable) => (
            <Row key={variable.name} id={`${uid}-var-${variable.name}`} label={`{${variable.name}}`} noRule phone={phone}>
              <FieldInput
                phone={phone}
                id={`${uid}-var-${variable.name}`}
                maxLength={VARIABLE_DESCRIPTION_MAX}
                value={described[variable.name] ?? ""}
                placeholder="The customer's first name"
                onChange={(event) => setDescribed((now) => ({ ...now, [variable.name]: event.target.value }))}
              />
            </Row>
          ))}
        </OptionalField>
      </OptionalSection>
      {edit?.after ? edit.after({ name, text: body, scope: { kind: "all" } }) : null}
    </ModalForm>
  );
}

export function AddSystemPromptDialog({ open, onOpenChange, onAdd, prompts, session, current, edit }: AddSystemPromptDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddSystemPromptInput) => {
    onAdd?.(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={edit ? edit.title : SYSTEM_PROMPT_DIALOG_COPY.title} eyebrow={edit ? MODAL_COPY.edit : undefined} subtitle={SYSTEM_PROMPT_DIALOG_COPY.subtitle} width={MODAL_WIDTH.standard} testId={edit ? "edit-system-prompt-dialog" : "add-system-prompt-dialog"}>
      <Form onAdd={add} onCancel={close} phone={phone} prompts={prompts} session={session} current={current} edit={edit && { ...edit, onSave: (input) => { edit.onSave(input); close(); } }} />
    </ModalShell>
  );
}

export default AddSystemPromptDialog;
