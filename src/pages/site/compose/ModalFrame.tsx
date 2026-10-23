/* CA-15 P1: the one frame every tile modal shares.

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
   opens clean every time. The optional fields are `OptionalSection`'s.

   CA-15b: every piece is drawn from `modalRecipes.tsx` (the frame, header, icon button, rows, footer, buttons). The form
   provides `ModalInset` so its rows and blocks run edge to edge and pad themselves 20 in. */

import * as Dialog from "@radix-ui/react-dialog";
import { Children, useId, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { EYEBROW } from "./refinedStyles";
import {
  Alert,
  FOOT_NOTE,
  GroupHeading,
  HEADER,
  HEADER_ICONS,
  HEADER_TEXT,
  Hint as RecipeHint,
  IconSquare,
  MODAL_PAD,
  MODAL_WIDTH,
  ModalInset,
  RecipeButton,
  Row,
  SUBTITLE,
  TITLE,
  bodyStyle,
  footerStyle,
  frameStyle,
} from "./modalRecipes";

export const MODAL_COPY = {
  close: "Close",
  cancel: "Cancel",
  add: "Add",
  /** CA-18: a window that changes a tile that is there. */
  save: "Save",
  edit: "Edit",
  allComplete: "All required fields complete",
} as const;

/** The footer's status line: the first thing still missing, or that nothing is. */
export const requiredLine = (missing: string | null | undefined): string => (missing ? `Required: ${missing}` : MODAL_COPY.allComplete);

/** The first of the required fields that is not complete, in the order the body shows them; null when all are. */
export const firstMissing = (checks: readonly (readonly [boolean, string])[]): string | null => checks.find(([done]) => !done)?.[1] ?? null;

/* ── edit mode (CA-18 P2) ── */

/**
 * A dialog opened on a tile that is there: its title is the tile's own line ("Tool 11 · Gmail") under the eyebrow "Edit", its
 * primary button reads Save, and Cancel or Escape discards. `onSave` gets what the form holds; `after` draws what only the
 * tile's own window has (its inputs, what it makes, how it runs), given the same.
 */
export interface EditMode<Input> {
  title: string;
  onSave: (input: Input) => void;
  /** What only the tile's own window has, drawn above the form's first block (its title). */
  before?: (input: Input) => ReactNode;
  /** A piece the window draws in place of one of the form's own (a check's list of runs, for its panel of two counts). */
  slots?: Record<string, ReactNode>;
  after?: (input: Input) => ReactNode;
}

/* ── the window ── */

export interface ModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What the tile is for, one grey line. */
  subtitle: string;
  /** CA-18: a window that changes a tile that is there says "Edit" above its title. */
  eyebrow?: string;
  /** CA-15b: 560 for most tiles, 640 for the prompt window, code and decision. */
  width?: number;
  testId: string;
  children: ReactNode;
}

/** The window. `children` is the form (`ModalForm`); it is mounted only while the window is open, so each opening starts clean. */
export function ModalShell({ open, onOpenChange, title, subtitle, eyebrow, width = MODAL_WIDTH.standard, testId, children }: ModalShellProps) {
  const phone = useIsPhone();
  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
        {eyebrow ? (
          <p data-testid="modal-eyebrow" style={{ ...EYEBROW, margin: 0 }}>
            {eyebrow}
          </p>
        ) : null}
        <p data-testid="modal-subtitle" style={{ ...SUBTITLE, margin: 0 }}>
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
        <Dialog.Content data-testid={testId} style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...frameStyle(width) }}>
          <div data-testid="modal-header" style={HEADER}>
            <div style={HEADER_TEXT}>
              {eyebrow ? (
                <p data-testid="modal-eyebrow" style={{ ...EYEBROW, margin: "0 0 4px" }}>
                  {eyebrow}
                </p>
              ) : null}
              <Dialog.Title style={TITLE}>{title}</Dialog.Title>
              <Dialog.Description data-testid="modal-subtitle" style={SUBTITLE}>
                {subtitle}
              </Dialog.Description>
            </div>
            <div style={HEADER_ICONS}>
              <IconSquare glyph="x" label={MODAL_COPY.close} onClick={() => onOpenChange(false)} />
            </div>
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
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onSubmit();
      }}
      style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "1 1 auto", fontSize: phone ? 16 : 13 }}
    >
      <ModalInset.Provider value={phone ? 0 : MODAL_PAD}>
        <div data-testid="modal-body" style={bodyStyle(phone)}>
          {children}
          {alert ? (
            <div style={{ padding: phone ? "8px 0 0" : `0 ${MODAL_PAD}px 14px` }}>
              <Alert>{alert}</Alert>
            </div>
          ) : null}
        </div>
      </ModalInset.Provider>
      <div data-testid="modal-footer" style={footerStyle(phone)}>
        <span data-testid="modal-status" role="status" style={FOOT_NOTE}>
          {requiredLine(missing)}
        </span>
        <RecipeButton phone={phone} onClick={onCancel}>
          {MODAL_COPY.cancel}
        </RecipeButton>
        <RecipeButton variant="primary" phone={phone} type="submit" disabled={!ready}>
          {addLabel}
        </RecipeButton>
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

/* ── rows (CA-15b: the recipes' pieces, under the names CA-15 gave them) ── */

/** A heading inside a body: "Model", "Third-party repository". */
export const SectionHeading = GroupHeading;

export interface FieldRowProps {
  /** The control's id, so the label points at it. With `group`, the label names a `role="group"` instead. */
  id: string;
  label: string;
  group?: boolean;
  phone: boolean;
  hint?: string;
  top?: boolean;
  noRule?: boolean;
  children: ReactNode;
}

/** A short field: its label in a 148px column, its control beside it; stacked on a phone. */
export function FieldRow(props: FieldRowProps) {
  return <Row {...props} />;
}

/** Rows one after another; each draws its own rule. */
export function FieldRows({ children }: { children: ReactNode }) {
  return <>{Children.toArray(children)}</>;
}

/** A id for a row's control, stable for one form. */
export const useRowId = (name: string): string => `${useId()}-${name}`;

/** A one-line note under a control: 12 `--label`. */
export const Hint = RecipeHint;

export default ModalShell;
