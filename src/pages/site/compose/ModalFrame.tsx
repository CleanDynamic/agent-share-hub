/* CA-15 P1 — the one frame every tile modal shares.

   Three parts, in the window recipe (`windowStyle`, `dialogTitle`):

   - Header: the title (15/500), under it one grey line (13, `--text2`) saying what the tile is for, and a square 28 close
     button drawn with `CONTROL`.
   - Body: the required fields first. A short field is a row (`FieldRow`: its label in a 148px column, its control beside
     it, rows split by a 1px `--hairline`); a long field is full width with its label above (`Field`). On a phone a row
     stacks: label above control. Only the body scrolls.
   - Footer: on the left one status line (12.5, `--label`): "Required: <the first missing thing>" or "All required fields
     complete"; on the right Cancel and Add. Add stays disabled until the required fields are complete.

   `ModalShell` is the window (a Radix dialog on a computer, a `BottomSheet` below 768, as each dialog already was) and
   `ModalForm` is the form inside it: the body and the footer. Each dialog keeps its own state in its form, so a window
   opens clean every time. The optional fields are `OptionalSection`'s. */

import * as Dialog from "@radix-ui/react-dialog";
import { Children, useId, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { Glyph } from "@/components/brand/Glyph";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";

import { dialogTitle, text, windowStyle } from "./refinedStyles";

export const MODAL_COPY = {
  close: "Close",
  cancel: "Cancel",
  add: "Add",
  allComplete: "All required fields complete",
} as const;

/** The footer's status line: the first thing still missing, or that nothing is. */
export const requiredLine = (missing: string | null | undefined): string => (missing ? `Required: ${missing}` : MODAL_COPY.allComplete);

/** The first of the required fields that is not complete, in the order the body shows them; null when all are. */
export const firstMissing = (checks: readonly (readonly [boolean, string])[]): string | null => checks.find(([done]) => !done)?.[1] ?? null;

/* ── the window ── */

export interface ModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What the tile is for, one grey line. */
  subtitle: string;
  width?: number;
  testId: string;
  children: ReactNode;
}

function CloseButton({ onClick }: { onClick?: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={MODAL_COPY.close}
      onClick={onClick}
      {...handlers}
      style={{
        ...controlPaint(state),
        width: 28,
        height: 28,
        padding: 0,
        flexShrink: 0,
        boxSizing: "border-box",
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: t.text,
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      <Glyph name="x" size={14} />
    </button>
  );
}

/** The window. `children` is the form (`ModalForm`); it is mounted only while the window is open, so each opening starts clean. */
export function ModalShell({ open, onOpenChange, title, subtitle, width = 520, testId, children }: ModalShellProps) {
  const phone = useIsPhone();
  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
        <p data-testid="modal-subtitle" style={{ ...text(13, 400, t.text2), margin: 0 }}>
          {subtitle}
        </p>
        {open ? children : null}
      </BottomSheet>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          data-testid={testId}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...windowStyle(width), padding: 0, overflowY: "hidden", display: "flex", flexDirection: "column" }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "20px 20px 12px", flexShrink: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flexGrow: 1, minWidth: 0 }}>
              <Dialog.Title style={{ ...dialogTitle, margin: 0 }}>{title}</Dialog.Title>
              <Dialog.Description data-testid="modal-subtitle" style={{ ...text(13, 400, t.text2), margin: 0 }}>
                {subtitle}
              </Dialog.Description>
            </div>
            <CloseButton onClick={() => onOpenChange(false)} />
          </div>
          {open ? children : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ── the form: body and footer ── */

export interface ModalFormProps {
  phone: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  /** The first required field not yet complete; null when all are. */
  missing: string | null;
  /** Adds to what `missing` decides (a field that refuses, such as code over its limit). */
  blocked?: boolean;
  addLabel?: string;
  children: ReactNode;
  /** Said under the body, above the footer, as an alert (what the write refused with). */
  alert?: string | null;
}

export function ModalForm({ phone, onSubmit, onCancel, missing, blocked = false, addLabel = MODAL_COPY.add, alert, children }: ModalFormProps) {
  const ready = missing === null && !blocked;
  const body: CSSProperties = phone
    ? { display: "flex", flexDirection: "column", gap: 16 }
    : { display: "flex", flexDirection: "column", gap: 16, flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "4px 20px 16px" };
  const footer: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
    borderTop: `1px solid ${t.hairline}`,
    ...(phone
      ? { position: "sticky", bottom: 0, background: t.window, padding: "12px 0 0", marginTop: 12, flexWrap: "wrap" }
      : { padding: "12px 20px" }),
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onSubmit();
      }}
      /* The global field rule makes a field inherit its size on a computer, so the form sets the fields' 13 here. */
      style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "1 1 auto", fontSize: phone ? 16 : 13 }}
    >
      <div data-testid="modal-body" style={body}>
        {children}
        {alert ? (
          <span role="alert" style={text(12.5, 400, t.text)}>
            {alert}
          </span>
        ) : null}
      </div>
      <div data-testid="modal-footer" style={footer}>
        <span data-testid="modal-status" role="status" style={{ ...text(12.5, 400, t.label), flexGrow: 1, minWidth: 0, overflowWrap: "anywhere" }}>
          {requiredLine(missing)}
        </span>
        <Button variant="secondary" size={phone ? 44 : 30} onClick={onCancel}>
          {MODAL_COPY.cancel}
        </Button>
        <Button variant="primary" size={phone ? 44 : 30} type="submit" disabled={!ready}>
          {addLabel}
        </Button>
      </div>
    </form>
  );
}

/** A small quiet glyph button, such as a chip's remove: 20 square (44 on a phone), never boxed, no icon library. */
export function GlyphButton({ glyph, label, onClick, phone = false, size = 20 }: { glyph: "x" | "plus" | "pencil"; label: string; onClick: () => void; phone?: boolean; size?: number }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const side = phone ? 44 : size;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...handlers}
      style={{
        width: side,
        height: side,
        padding: 0,
        flexShrink: 0,
        boxSizing: "border-box",
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: 6,
        color: state.hovered ? t.text : t.label,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      <Glyph name={glyph} size={12} />
    </button>
  );
}

/* ── rows ── */

/** A heading inside a body: "Model", "Third-party repository". */
export function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 style={{ ...text(13, 500, t.text), margin: 0 }}>{children}</h3>;
}

export interface FieldRowProps {
  /** The control's id, so the label points at it. With `group`, the label names a `role="group"` instead. */
  id: string;
  label: string;
  group?: boolean;
  phone: boolean;
  children: ReactNode;
}

/** A short field: its label in a 148px column, its control beside it; stacked on a phone. */
export function FieldRow({ id, label, group = false, phone, children }: FieldRowProps) {
  return (
    <div
      role={group ? "group" : undefined}
      aria-labelledby={group ? id : undefined}
      data-testid="field-row"
      style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "148px minmax(0, 1fr)", columnGap: 12, rowGap: 6, alignItems: "start", padding: "10px 0", minWidth: 0 }}
    >
      {group ? (
        <span id={id} style={{ ...text(13, 400, t.text2), paddingTop: phone ? 0 : 6 }}>
          {label}
        </span>
      ) : (
        <label htmlFor={id} style={{ ...text(13, 400, t.text2), paddingTop: phone ? 0 : 6 }}>
          {label}
        </label>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** Rows split by a 1px `--hairline`: the first has no line above it. */
export function FieldRows({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {rows.map((row, index) => (
        <div key={index} style={index === 0 ? undefined : { borderTop: `1px solid ${t.hairline}` }}>
          {row}
        </div>
      ))}
    </div>
  );
}

/** A id for a row's control, stable for one form. */
export const useRowId = (name: string): string => `${useId()}-${name}`;

/** A one-line note under a control: 12 `--label`. */
export function Hint({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <span data-testid={testId} style={text(12, 400, t.label)}>
      {children}
    </span>
  );
}

export default ModalShell;
