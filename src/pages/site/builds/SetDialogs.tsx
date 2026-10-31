/* SV-24 P1: the two small windows of the Saved filter sets: name a set (Save current, Rename) and confirm a delete.

   PRESENTATIONAL. The page owns the writes; `onSubmit` rejects with nothing and the window says it could not. Real dialogs
   (Radix): focus is trapped, Escape closes, the field is labelled and 16px on a phone. A set is public when its maker says so
   with a checkbox; public sets are the Groups on OpenBuilds, and the line under the box says so. */

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { Checkbox } from "@/components/brand/Checkbox";
import { IconButton } from "@/components/brand/IconButton";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { WELL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, display } from "@/lib/theme/type";

export const SET_NAME_MAX = 80;

const content = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 41,
  width: "min(440px, calc(100vw - 28px))",
  boxSizing: "border-box",
  padding: "12px 16px 16px",
  borderRadius: r.panel,
  background: t.solid,
  border: `1px solid ${t.glassBorder}`,
  boxShadow: t.shadowSheet,
  color: t.text,
  fontFamily: FIGTREE,
} as const;

function Frame({
  open,
  onOpenChange,
  title,
  description,
  testId,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: t.sheetDim,
            zIndex: 40,
          }}
        />
        <Dialog.Content data-testid={testId} style={content}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <Dialog.Title style={{ ...display(22), margin: 0, color: t.text }}>
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close" size={38} />
            </Dialog.Close>
          </div>
          <Dialog.Description
            style={{
              margin: "8px 0 12px",
              fontSize: 13,
              lineHeight: 1.55,
              color: t.text2,
            }}
          >
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface SetNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  initialName?: string;
  /** Draw the Public box (Save current); Rename leaves it to the row's menu. */
  askPublic?: boolean;
  /** Rejects when it could not. */
  onSubmit: (name: string, isPublic: boolean) => Promise<void>;
}

export function SetNameDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initialName = "",
  askPublic = false,
  onSubmit,
}: SetNameDialogProps) {
  const phone = useIsPhone();
  const [name, setName] = useState(initialName);
  const [isPublic, setPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { state, handlers } = useInteractive<HTMLInputElement>();

  /* Each opening starts clean. */
  useEffect(() => {
    if (open) {
      setName(initialName);
      setPublic(false);
      setBusy(false);
      setFailed(false);
    }
  }, [open, initialName]);

  const ready = name.trim().length > 0 && !busy;
  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setFailed(false);
    try {
      await onSubmit(name, isPublic);
      onOpenChange(false);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Frame
      open={open}
      onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}
      title={title}
      description={description}
      testId="set-name-dialog"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label
          style={{
            display: "block",
            fontSize: 12.5,
            fontWeight: 500,
            marginBottom: 6,
          }}
          htmlFor="set-name"
        >
          Name
        </label>
        <input
          id="set-name"
          type="text"
          value={name}
          maxLength={SET_NAME_MAX}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
          {...handlers}
          style={{
            boxSizing: "border-box",
            width: "100%",
            height: phone ? 44 : 36,
            padding: "0 10px",
            borderRadius: r.control,
            color: t.text,
            fontFamily: FIGTREE,
            fontSize: phone ? 16 : 13,
            ...WELL,
            ...ring(state.focusVisible),
          }}
        />
        {askPublic ? (
          <label
            style={{
              display: "grid",
              gridTemplateColumns: "16px 1fr",
              columnGap: 10,
              alignItems: "start",
              marginTop: 16,
              cursor: "pointer",
              fontSize: 12.5,
            }}
          >
            <Checkbox
              checked={isPublic}
              onChange={(event) => setPublic(event.target.checked)}
            />
            <span>
              Public
              <span style={{ display: "block", color: t.label, fontSize: 12 }}>
                Anyone can open it, and it is listed as a group on OpenBuilds.
              </span>
            </span>
          </label>
        ) : null}
        {failed ? (
          <p
            role="alert"
            style={{ margin: "12px 0 0", fontSize: 13, color: t.text2 }}
          >
            Couldn't save that. Try again.
          </p>
        ) : null}
        <div
          style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}
        >
          <Button
            type="submit"
            variant="primary"
            size={44}
            fontSize={14}
            disabled={!ready}
          >
            {busy ? "Saving" : submitLabel}
          </Button>
        </div>
      </form>
    </Frame>
  );
}

export interface DeleteSetDialogProps {
  /** The set to delete; none: closed. */
  name: string | null;
  onCancel: () => void;
  onDelete: () => Promise<void>;
}

export function DeleteSetDialog({
  name,
  onCancel,
  onDelete,
}: DeleteSetDialogProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setBusy(false);
    setFailed(false);
  }, [name]);
  const remove = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onDelete();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Frame
      open={name !== null}
      onOpenChange={(next) => (next || busy ? undefined : onCancel())}
      title="Delete this filter set?"
      description={
        name
          ? `"${name}" is removed from your saved filter sets and from your Library. Anyone who followed it as a group no longer sees it.`
          : ""
      }
      testId="delete-set-dialog"
    >
      {failed ? (
        <p
          role="alert"
          style={{ margin: "0 0 12px", fontSize: 13, color: t.text2 }}
        >
          Couldn't delete it. Try again.
        </p>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button
          variant="secondary"
          size={44}
          fontSize={14}
          onClick={onCancel}
          disabled={busy}
        >
          Keep it
        </Button>
        <Button
          variant="primary"
          size={44}
          fontSize={14}
          onClick={() => void remove()}
          disabled={busy}
        >
          {busy ? "Deleting" : "Delete"}
        </Button>
      </div>
    </Frame>
  );
}
