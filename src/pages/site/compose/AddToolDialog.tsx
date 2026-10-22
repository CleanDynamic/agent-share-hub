/* CA-02 P6, CA-12 P7, CA-15 P4: Add › "Tool": an external application the model used during the build.

   The shared modal frame, 520 wide (a `BottomSheet` below 768). One required field:

   - Application: from the apps and services list (GitHub, Stripe, Supabase ...), with the build's own first. A listed
     application is stored by its name, any other name as typed (at most 40). There is no default: Add waits until one is
     picked.

   Then the Optional section, in this order:

   1. Connection method: nine choices (MCP server, Native integration, Custom code, Browser extension, API key, Zapier, Make
      or n8n, Plugin or skill, Command-line interface, Manual copy and paste).
   2. Actions performed: one line ("e.g. Read issues, open pull requests").
   3. Permissions: Read only, Read and write, Acting on your behalf.
   4. Required plan: one line.
   5. Setup steps: one step per line. With the API key method chosen it says: name the key, never paste its value.
   6. Alternatives: other applications that could do the same job.

   The tool then stands in the session as a tile that shows exactly this. "Add" is the one primary. No secret value is ever
   asked for, shown or stored here. */

import { useId, useState } from "react";

import { Segmented } from "@/components/brand/Segmented";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { CONNECTION_LABEL, TOOL_CONNECTIONS, TOOL_SCOPES_MAX, type ToolConnection } from "@/lib/build/graph";
import { TOOL_ALTERNATIVES_MAX, TOOL_PERMISSIONS, TOOL_PERMISSION_LABEL, TOOL_PLAN_MAX, TOOL_SETUP_LINE_MAX, TOOL_SETUP_MAX, linesOf, type ToolPermission } from "@/lib/build/tileExtras";
import { toolName } from "@/lib/tools/registry";
import { t } from "@/lib/theme/tokens";

import { ChoiceGrid } from "./ChoiceGrid";
import { Field } from "./composeControls";
import { FieldRow, FieldRows, GlyphButton, Hint, ModalForm, ModalShell, firstMissing } from "./ModalFrame";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { chipStyle, text as type, tnum, typedArea, typedField } from "./refinedStyles";
import { ToolPicker } from "./ToolPicker";

export const TOOL_DIALOG_COPY = {
  title: "Add a tool",
  subtitle: "An external application the model used during the build",
  tool: "Application",
  selectTool: "Select an application",
  connected: "Connection method",
  connectedLine: "How the application was connected",
  did: "Actions performed",
  didLine: "What the application did, in one line",
  didPlaceholder: "e.g. Read issues, open pull requests",
  permissions: "Permissions",
  permissionsLine: "What the connection allowed it to do",
  plan: "Required plan",
  planLine: "The plan or tier the application needed, if any",
  planPlaceholder: "e.g. Pro plan",
  setup: "Setup steps",
  setupLine: "How it was set up, one step per line",
  setupPlaceholder: "e.g. Create a token with repository access\nAdd the token to the project's environment",
  setupKeyHint: "Name the key, for example GITHUB_TOKEN. Never paste its value.",
  alternatives: "Alternatives",
  alternativesLine: "Other applications that could do the same job",
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
  onAdd: (input: AddToolInput) => void;
  /** The tools the build already uses, first in the application picker. */
  inBuild?: readonly string[];
}

function Form({ onAdd, onCancel, phone, inBuild = [] }: Pick<AddToolDialogProps, "onAdd" | "inBuild"> & { onCancel: () => void; phone: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [connection, setConnection] = useState<ToolConnection | null>(null);
  const [did, setDid] = useState("");
  const [permissions, setPermissions] = useState<ToolPermission | null>(null);
  const [plan, setPlan] = useState("");
  const [setup, setSetup] = useState("");
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const uid = useId();
  const service = picked ? (toolName(picked) ?? picked.trim()) : "";
  const missing = firstMissing([[service.length > 0, "an application"]]);
  const steps = linesOf(setup);
  const keyed = connection === "api_key";

  return (
    <ModalForm
      phone={phone}
      missing={missing}
      onCancel={onCancel}
      onSubmit={() => onAdd({ service, connection, scopes: did.trim(), permissions, plan: plan.trim(), setup: steps.slice(0, TOOL_SETUP_MAX).map((line) => line.slice(0, TOOL_SETUP_LINE_MAX)), alternatives })}
    >
      <FieldRows>
        <FieldRow id={`${uid}-tool`} label={TOOL_DIALOG_COPY.tool} group phone={phone}>
          <div>
            <ToolPicker label={TOOL_DIALOG_COPY.tool} value={picked} onChange={setPicked} inBuild={inBuild} phone={phone} step="tool" list="app" placeholder={TOOL_DIALOG_COPY.selectTool} />
          </div>
        </FieldRow>
      </FieldRows>

      <OptionalSection>
        <OptionalField name={TOOL_DIALOG_COPY.connected} description={TOOL_DIALOG_COPY.connectedLine} summary={connection ? CONNECTION_LABEL[connection] : null} phone={phone}>
          <ChoiceGrid<ToolConnection> label={TOOL_DIALOG_COPY.connected} items={CONNECTION_CHOICES} value={connection} onChange={setConnection} phone={phone} allowClear />
        </OptionalField>

        <OptionalField name={TOOL_DIALOG_COPY.did} description={TOOL_DIALOG_COPY.didLine} summary={summaryOf(did)} phone={phone}>
          <input aria-label={TOOL_DIALOG_COPY.did} type="text" value={did} maxLength={TOOL_SCOPES_MAX} placeholder={TOOL_DIALOG_COPY.didPlaceholder} onChange={(event) => setDid(event.target.value)} style={typedField(phone)} />
          <span style={{ ...type(11.5, 400, t.text2), ...tnum, alignSelf: "flex-end" }}>
            {did.length} / {TOOL_SCOPES_MAX}
          </span>
        </OptionalField>

        <OptionalField name={TOOL_DIALOG_COPY.permissions} description={TOOL_DIALOG_COPY.permissionsLine} summary={permissions ? TOOL_PERMISSION_LABEL[permissions] : null} phone={phone}>
          <Segmented<ToolPermission>
            label={TOOL_DIALOG_COPY.permissions}
            semantics="radio"
            size={phone ? 50 : 30}
            fontSize={13}
            fullWidth
            items={TOOL_PERMISSIONS.map((value) => ({ value, label: TOOL_PERMISSION_LABEL[value] }))}
            value={permissions ?? ("" as ToolPermission)}
            onChange={(next) => setPermissions((current) => (current === next ? null : next))}
          />
        </OptionalField>

        <OptionalField name={TOOL_DIALOG_COPY.plan} description={TOOL_DIALOG_COPY.planLine} summary={summaryOf(plan)} phone={phone}>
          <input aria-label={TOOL_DIALOG_COPY.plan} type="text" value={plan} maxLength={TOOL_PLAN_MAX} placeholder={TOOL_DIALOG_COPY.planPlaceholder} onChange={(event) => setPlan(event.target.value)} style={typedField(phone)} />
        </OptionalField>

        <OptionalField name={TOOL_DIALOG_COPY.setup} description={keyed ? TOOL_DIALOG_COPY.setupKeyHint : TOOL_DIALOG_COPY.setupLine} summary={summaryOf(steps)} phone={phone}>
          <textarea aria-label={TOOL_DIALOG_COPY.setup} rows={4} value={setup} placeholder={TOOL_DIALOG_COPY.setupPlaceholder} onChange={(event) => setSetup(event.target.value)} style={typedArea(phone)} />
          {keyed ? <Hint testId="setup-key-hint">{TOOL_DIALOG_COPY.setupKeyHint}</Hint> : null}
        </OptionalField>

        <OptionalField name={TOOL_DIALOG_COPY.alternatives} description={TOOL_DIALOG_COPY.alternativesLine} summary={summaryOf(alternatives)} phone={phone}>
          <Field id={`${uid}-alternatives`} label={TOOL_DIALOG_COPY.alternatives} group>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
              {alternatives.length > 0 ? (
                <div role="list" aria-label={TOOL_DIALOG_COPY.alternatives} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {alternatives.map((name) => (
                    <span key={name} role="listitem" style={{ ...chipStyle, paddingRight: 2, height: phone ? 44 : 24 }}>
                      {name}
                      <GlyphButton glyph="x" label={TOOL_DIALOG_COPY.removeAlternative(name)} phone={phone} onClick={() => setAlternatives((now) => now.filter((other) => other !== name))} />
                    </span>
                  ))}
                </div>
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
                placeholder={TOOL_DIALOG_COPY.selectTool}
              />
            </div>
          </Field>
        </OptionalField>
      </OptionalSection>
    </ModalForm>
  );
}

export function AddToolDialog({ open, onOpenChange, onAdd, inBuild }: AddToolDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddToolInput) => {
    onAdd(input);
    close();
  };
  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={TOOL_DIALOG_COPY.title} subtitle={TOOL_DIALOG_COPY.subtitle} width={520} testId="add-tool-dialog">
      <Form inBuild={inBuild} onAdd={add} onCancel={close} phone={phone} />
    </ModalShell>
  );
}

export default AddToolDialog;
