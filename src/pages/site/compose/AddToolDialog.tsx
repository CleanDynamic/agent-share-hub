/* CA-02 P6, CA-12 P7, CA-15 P4, CA-15b P2: Add › "Tool": an external application the model used during the build.

   Built from `modalRecipes` exactly as the board "Add a tool" draws it, 560 wide (a `BottomSheet` below 768). One required
   row:

   - Application: a picker field ("Select an application"), from the apps and services list with the build's own first. A
     listed application is stored by its name, any other name as typed (at most 40). Add waits until one is picked.

   Then the Optional section, six rows, each closed:

   1. Connection method: an option grid of nine (MCP server, Native integration, Custom code, Browser extension, API key,
      Zapier, Make or n8n, Plugin or skill, Command-line interface, Manual copy and paste).
   2. Actions performed: one line.
   3. Permissions: Read only, Read and write, Acting on your behalf.
   4. Required plan: one line.
   5. Setup steps: one step per line. With the API key method chosen it says: name the key, never paste its value.
   6. Alternatives: other applications that perform the same function, picked with "Select applications".

   The footer says "Required: an application" until one is picked. No secret value is ever asked for, shown or stored. */

import { useId, useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { CONNECTION_LABEL, TOOL_CONNECTIONS, TOOL_SCOPES_MAX, type ToolConnection } from "@/lib/build/graph";
import { TOOL_ALTERNATIVES_MAX, TOOL_PERMISSIONS, TOOL_PERMISSION_LABEL, TOOL_PLAN_MAX, TOOL_SETUP_LINE_MAX, TOOL_SETUP_MAX, linesOf, type ToolPermission } from "@/lib/build/tileExtras";
import { toolName } from "@/lib/tools/registry";

import { ChoiceGrid } from "./ChoiceGrid";
import { MODAL_COPY, ModalForm, ModalShell, firstMissing, type EditMode } from "./ModalFrame";
import { FieldArea, FieldInput, Hint, MODAL_WIDTH, RemovableTag, Row, SegmentedField, TagList } from "./modalRecipes";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { ToolPicker } from "./ToolPicker";

export const TOOL_DIALOG_COPY = {
  title: "Add a tool",
  subtitle: "An external application the model used during the build",
  tool: "Application",
  selectTool: "Select an application",
  connected: "Connection method",
  connectedLine: "MCP server, native integration, custom code and 6 more",
  did: "Actions performed",
  didLine: "What the application did in this build",
  didPlaceholder: "e.g. Read issues, opened pull requests",
  permissions: "Permissions",
  permissionsLine: "Read only, read and write, or acting on your behalf",
  plan: "Required plan",
  planLine: "Free, or the name of the paid plan",
  planPlaceholder: "e.g. Free",
  setup: "Setup steps",
  setupLine: "The steps required to connect it",
  setupPlaceholder: "One step per line",
  setupKeyHint: "Name the key, for example GITHUB_TOKEN. Never paste its value.",
  alternatives: "Alternatives",
  alternativesLine: "Other applications that perform the same function",
  selectAlternatives: "Select applications",
  removeAlternative: (name: string) => `Remove ${name}`,
  add: "Add",
  cancel: "Cancel",
} as const;

/** The nine ways a tool was connected, in the words the tile uses. */
export const CONNECTION_CHOICES: readonly { value: ToolConnection; label: string }[] = TOOL_CONNECTIONS.map((value) => ({ value, label: CONNECTION_LABEL[value] }));

export interface AddToolInput {
  /** The application's name, as the integration node's `service`: a listed application's name, or as typed. */
  service: string;
  connection: ToolConnection | null;
  /** The actions it performed: one line, or empty. */
  scopes: string;
  permissions: ToolPermission | null;
  /** The plan it needed: one line, or empty. */
  plan: string;
  /** One step per entry; empty when none. */
  setup: string[];
  /** Other applications that could do the same job, by name. */
  alternatives: string[];
}

export interface AddToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd?: (input: AddToolInput) => void;
  /** The tools the build already uses, first in the application picker. */
  inBuild?: readonly string[];
  /** CA-18: what the form starts with, when it is opened on a tool that is there. */
  seed?: Partial<AddToolInput> | null;
  /** CA-18: opened on a tool that is there: "Edit", its own line as the title, Save. */
  edit?: EditMode<AddToolInput>;
}

function Form({ onAdd, onCancel, phone, inBuild = [], seed, edit }: Pick<AddToolDialogProps, "onAdd" | "inBuild" | "seed" | "edit"> & { onCancel: () => void; phone: boolean }) {
  const [picked, setPicked] = useState<string | null>(seed?.service ?? null);
  const [connection, setConnection] = useState<ToolConnection | null>(seed?.connection ?? null);
  const [did, setDid] = useState(seed?.scopes ?? "");
  const [permissions, setPermissions] = useState<ToolPermission | null>(seed?.permissions ?? null);
  const [plan, setPlan] = useState(seed?.plan ?? "");
  const [setup, setSetup] = useState((seed?.setup ?? []).join("\n"));
  const [alternatives, setAlternatives] = useState<string[]>(seed?.alternatives ?? []);
  const uid = useId();
  const service = picked ? (toolName(picked) ?? picked.trim()) : "";
  const missing = firstMissing([[service.length > 0, "an application"]]);
  const steps = linesOf(setup);
  const keyed = connection === "api_key";
  const input = (): AddToolInput => ({ service, connection, scopes: did.trim(), permissions, plan: plan.trim(), setup: steps.slice(0, TOOL_SETUP_MAX).map((line) => line.slice(0, TOOL_SETUP_LINE_MAX)), alternatives });

  return (
    <ModalForm phone={phone} missing={missing} onCancel={onCancel} addLabel={edit ? MODAL_COPY.save : undefined} onSubmit={() => (edit ? edit.onSave(input()) : onAdd?.(input()))}>
      {edit?.before ? edit.before(input()) : null}
      <Row id={`${uid}-tool`} label={TOOL_DIALOG_COPY.tool} group phone={phone} noRule>
        <ToolPicker label={TOOL_DIALOG_COPY.tool} value={picked} onChange={setPicked} inBuild={inBuild} phone={phone} step="tool" list="app" placeholder={TOOL_DIALOG_COPY.selectTool} field />
      </Row>

      <OptionalSection>
        <OptionalField name={TOOL_DIALOG_COPY.connected} description={TOOL_DIALOG_COPY.connectedLine} summary={connection ? CONNECTION_LABEL[connection] : null} phone={phone}>
          <ChoiceGrid<ToolConnection> label={TOOL_DIALOG_COPY.connected} items={CONNECTION_CHOICES} value={connection} onChange={setConnection} phone={phone} allowClear />
        </OptionalField>

        <OptionalField name={TOOL_DIALOG_COPY.did} description={TOOL_DIALOG_COPY.didLine} summary={summaryOf(did)} phone={phone}>
          <FieldInput phone={phone} aria-label={TOOL_DIALOG_COPY.did} value={did} maxLength={TOOL_SCOPES_MAX} placeholder={TOOL_DIALOG_COPY.didPlaceholder} onChange={(event) => setDid(event.target.value)} />
        </OptionalField>

        <OptionalField name={TOOL_DIALOG_COPY.permissions} description={TOOL_DIALOG_COPY.permissionsLine} summary={permissions ? TOOL_PERMISSION_LABEL[permissions] : null} phone={phone}>
          <SegmentedField<ToolPermission>
            label={TOOL_DIALOG_COPY.permissions}
            phone={phone}
            items={TOOL_PERMISSIONS.map((value) => ({ value, label: TOOL_PERMISSION_LABEL[value] }))}
            value={permissions}
            onChange={(next) => setPermissions((current) => (current === next ? null : next))}
          />
        </OptionalField>

        <OptionalField name={TOOL_DIALOG_COPY.plan} description={TOOL_DIALOG_COPY.planLine} summary={summaryOf(plan)} phone={phone}>
          <FieldInput phone={phone} aria-label={TOOL_DIALOG_COPY.plan} value={plan} maxLength={TOOL_PLAN_MAX} placeholder={TOOL_DIALOG_COPY.planPlaceholder} onChange={(event) => setPlan(event.target.value)} />
        </OptionalField>

        <OptionalField name={TOOL_DIALOG_COPY.setup} description={TOOL_DIALOG_COPY.setupLine} summary={summaryOf(steps)} phone={phone}>
          <FieldArea phone={phone} rows={3} aria-label={TOOL_DIALOG_COPY.setup} value={setup} placeholder={TOOL_DIALOG_COPY.setupPlaceholder} onChange={(event) => setSetup(event.target.value)} />
          {keyed ? <Hint testId="setup-key-hint">{TOOL_DIALOG_COPY.setupKeyHint}</Hint> : null}
        </OptionalField>

        <OptionalField name={TOOL_DIALOG_COPY.alternatives} description={TOOL_DIALOG_COPY.alternativesLine} summary={summaryOf(alternatives)} phone={phone}>
          {alternatives.length > 0 ? (
            <TagList label={TOOL_DIALOG_COPY.alternatives}>
              {alternatives.map((name) => (
                <RemovableTag key={name} removeLabel={TOOL_DIALOG_COPY.removeAlternative(name)} phone={phone} onRemove={() => setAlternatives((now) => now.filter((other) => other !== name))}>
                  {name}
                </RemovableTag>
              ))}
            </TagList>
          ) : null}
          <ToolPicker
            label={TOOL_DIALOG_COPY.alternatives}
            value={null}
            onChange={(next) => {
              if (!next) return;
              const name = (toolName(next) ?? next).trim();
              setAlternatives((now) => (now.some((other) => other.toLowerCase() === name.toLowerCase()) || now.length >= TOOL_ALTERNATIVES_MAX || name.toLowerCase() === service.toLowerCase() ? now : [...now, name]));
            }}
            inBuild={inBuild}
            phone={phone}
            step="tool"
            list="app"
            placeholder={TOOL_DIALOG_COPY.selectAlternatives}
            small
          />
        </OptionalField>
      </OptionalSection>
      {edit?.after ? edit.after(input()) : null}
    </ModalForm>
  );
}

export function AddToolDialog({ open, onOpenChange, onAdd, inBuild, seed, edit }: AddToolDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddToolInput) => {
    onAdd?.(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={edit ? edit.title : TOOL_DIALOG_COPY.title} eyebrow={edit ? MODAL_COPY.edit : undefined} subtitle={TOOL_DIALOG_COPY.subtitle} width={MODAL_WIDTH.standard} testId={edit ? "edit-tool-dialog" : "add-tool-dialog"}>
      <Form inBuild={inBuild} seed={seed} edit={edit && { ...edit, onSave: (input) => { edit.onSave(input); close(); } }} onAdd={add} onCancel={close} phone={phone} />
    </ModalShell>
  );
}

export default AddToolDialog;
