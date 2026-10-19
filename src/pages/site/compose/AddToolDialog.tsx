/* CA-02 P6 — Add › "Tool".

   A Radix dialog, 420 wide, on the Card's surface tokens (a `BottomSheet` below 768), built like the manual step's:
   the tool picker for a tool (`step: "tool"`), with the build's own tools first. A listed tool is stored by its name,
   any other name as typed (at most 40). There is no default: Add waits until one is picked. "Add" is the one primary.

   It replaces the "Untitled tool" row Add › Tool used to make: the tool is named before it is made. */

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type CSSProperties } from "react";

import { Button } from "@/components/brand/Button";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { toolName } from "@/lib/tools/registry";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { ToolPicker } from "./ToolPicker";

export const TOOL_DIALOG_COPY = {
  title: "Add a tool",
  tool: "Tool",
  add: "Add",
  cancel: "Cancel",
} as const;

export interface AddToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tool's name, as the integration node's `service`: a listed tool's name, or as typed. */
  onAdd: (service: string) => void;
  /** The tools the build already uses, first in the tool picker. */
  inBuild?: readonly string[];
}

function Form({ onAdd, onCancel, phone, inBuild = [] }: Pick<AddToolDialogProps, "onAdd" | "inBuild"> & { onCancel: () => void; phone: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const service = picked ? (toolName(picked) ?? picked.trim()) : "";
  const label: CSSProperties = { fontFamily: DM_MONO, fontSize: 11.5, color: t.text2, textTransform: "uppercase", letterSpacing: "0.06em" };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (service) onAdd(service);
      }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={label}>{TOOL_DIALOG_COPY.tool}</span>
        <div>
          <ToolPicker label={TOOL_DIALOG_COPY.tool} value={picked} onChange={setPicked} inBuild={inBuild} phone={phone} step="tool" />
        </div>
      </div>
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
  const add = (service: string) => {
    onAdd(service);
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
          <Dialog.Title style={{ margin: "0 0 14px", fontFamily: FIGTREE, fontSize: 16, fontWeight: 600, color: t.text }}>{TOOL_DIALOG_COPY.title}</Dialog.Title>
          <Form inBuild={inBuild} onAdd={add} onCancel={close} phone={false} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddToolDialog;
