/* CA-02 P6, CA-12 P7 — Add › "Tool".

   A Radix dialog, 420 wide, on the Card's surface tokens (a `BottomSheet` below 768), built like the manual step's. It asks
   three things:
   - Tool: the app, from the apps and services list (GitHub, Stripe, Supabase ...), with the build's own first. A listed app
     is stored by its name, any other name as typed (at most 40). There is no default: Add waits until one is picked.
   - How was it connected?: an MCP server, built into the app, or my own code. Optional.
   - What did it do?: one line, optional ("read issues, open pull requests").
   The tool then stands in the session as a tile that shows exactly this. "Add" is the one primary. */

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useState } from "react";

import { Button } from "@/components/brand/Button";
import { Segmented } from "@/components/brand/Segmented";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { CONNECTION_LABEL, TOOL_SCOPES_MAX, type ToolConnection } from "@/lib/build/graph";
import { toolName } from "@/lib/tools/registry";

import { Field } from "./composeControls";
import { dialogTitle, text as type, tnum, typedField, windowStyle } from "./refinedStyles";
import { ToolPicker } from "./ToolPicker";
import { t } from "@/lib/theme/tokens";

export const TOOL_DIALOG_COPY = {
  title: "Add a tool",
  tool: "Tool",
  connected: "How was it connected?",
  did: "What did it do?",
  didPlaceholder: "Read issues, open pull requests",
  add: "Add",
  cancel: "Cancel",
} as const;

/** The three ways a tool was connected, in the words the tile uses. */
export const CONNECTION_CHOICES: readonly { value: ToolConnection; label: string }[] = [
  { value: "mcp", label: CONNECTION_LABEL.mcp },
  { value: "app", label: CONNECTION_LABEL.app },
  { value: "code", label: CONNECTION_LABEL.code },
];

export interface AddToolInput {
  /** The app's name, as the integration node's `service`: a listed app's name, or as typed. */
  service: string;
  connection: ToolConnection | null;
  /** What it did: one line, or empty. */
  scopes: string;
}

export interface AddToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: AddToolInput) => void;
  /** The tools the build already uses, first in the tool picker. */
  inBuild?: readonly string[];
}

function Form({ onAdd, onCancel, phone, inBuild = [] }: Pick<AddToolDialogProps, "onAdd" | "inBuild"> & { onCancel: () => void; phone: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [connection, setConnection] = useState<ToolConnection | null>(null);
  const [did, setDid] = useState("");
  const uid = useId();
  const service = picked ? (toolName(picked) ?? picked.trim()) : "";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (service) onAdd({ service, connection, scopes: did.trim() });
      }}
      style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: phone ? 16 : 13 }}
    >
      <Field id={`${uid}-tool`} label={TOOL_DIALOG_COPY.tool} group>
        <div>
          <ToolPicker label={TOOL_DIALOG_COPY.tool} value={picked} onChange={setPicked} inBuild={inBuild} phone={phone} step="tool" list="app" placeholder="Pick an app" />
        </div>
      </Field>

      <Field id={`${uid}-how`} label={TOOL_DIALOG_COPY.connected} hint="Optional" group>
        <div>
          <Segmented
            label={TOOL_DIALOG_COPY.connected}
            size={phone ? 50 : 32}
            fontSize={13}
            items={CONNECTION_CHOICES.map((choice) => ({ value: choice.value, label: choice.label }))}
            value={connection ?? ("" as ToolConnection)}
            onChange={(next) => setConnection((current) => (current === next ? null : next))}
          />
        </div>
      </Field>

      <Field id={`${uid}-did`} label={TOOL_DIALOG_COPY.did} hint="Optional">
        <input id={`${uid}-did`} type="text" value={did} maxLength={TOOL_SCOPES_MAX} placeholder={TOOL_DIALOG_COPY.didPlaceholder} onChange={(event) => setDid(event.target.value)} style={typedField(phone)} />
        <span style={{ ...type(11.5, 400, t.text2), ...tnum, alignSelf: "flex-end" }}>
          {did.length} / {TOOL_SCOPES_MAX}
        </span>
      </Field>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" size={phone ? 44 : 36} onClick={onCancel}>
          {TOOL_DIALOG_COPY.cancel}
        </Button>
        <Button variant="primary" size={phone ? 44 : 36} type="submit" disabled={!service}>
          {TOOL_DIALOG_COPY.add}
        </Button>
      </div>
    </form>
  );
}

export function AddToolDialog({ open, onOpenChange, onAdd, inBuild }: AddToolDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddToolInput) => {
    onAdd(input);
    close();
  };

  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={TOOL_DIALOG_COPY.title}>
        {open ? <Form inBuild={inBuild} onAdd={add} onCancel={close} phone /> : null}
      </BottomSheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          aria-describedby={undefined}
          data-testid="add-tool-dialog"
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...windowStyle(420) }}
        >
          <Dialog.Title style={dialogTitle}>{TOOL_DIALOG_COPY.title}</Dialog.Title>
          <Form inBuild={inBuild} onAdd={add} onCancel={close} phone={false} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddToolDialog;
