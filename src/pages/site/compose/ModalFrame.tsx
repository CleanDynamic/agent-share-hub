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
import { Children, useContext, useId, useMemo, useRef, type CSSProperties, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { useWindowFocus } from "@/lib/focus/windowFocus";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { scrollBehavior } from "@/lib/theme/motion";
import { shakeOnce } from "@/lib/theme/shake";

import { EYEBROW } from "./refinedStyles";
import {
  Alert,
  BoxTitleCollectorContext,
  BoxTitleSinkContext,
  FOOT_NOTE,
  GroupHeading,
  HEADER,
  HEADER_ICONS,
  HEADER_TEXT,
  LAYER,
  WINDOW_TOP,
  scrimAt,
  windowPlacement,
  Hint as RecipeHint,
  IconSquare,
  MODAL_PAD,
  MODAL_WIDTH,
  MissingFields,
  ModalInset,
  RecipeButton,
  Row,
  SUBTITLE,
  TITLE,
  bodyStyle,
  footerStyle,
  missingSet,
} from "./modalRecipes";
import { size as sizes, space } from "@/lib/theme/space";
import { r } from "@/lib/theme/radius";

export const MODAL_COPY = {
  close: "Close",
  cancel: "Cancel",
  add: "Add",
  /** CA-18: a window that changes a tile that is there. */
  save: "Save",
  edit: "Edit",
  allComplete: "Required fields complete",
} as const;

/** F25: on a computer the window's top edge, and the same room left under it (`WINDOW_TOP`, shared by every window). */
export const MODAL_TOP = WINDOW_TOP;

/** The footer's status line: the labels of what is still missing, or that nothing is. */
export const requiredLine = (missing: string | null | undefined): string => (missing ? `Required: ${missing}` : MODAL_COPY.allComplete);

/** The required fields that are not complete, by their labels exactly, in the order the body shows them, as one list; null when all are. */
export const missingLabels = (checks: readonly (readonly [boolean, string])[]): string | null => {
  const missing = checks.filter(([done]) => !done).map(([, label]) => label);
  return missing.length > 0 ? missing.join(", ") : null;
};

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
  /** Prompt 24: on a phone a form is a full sheet; a short list (Recently removed) opens to its content. */
  phoneHeight?: "full" | "content" | "half";
  children: ReactNode;
}

/** The window. `children` is the form (`ModalForm`); it is mounted only while the window is open, so each opening starts clean. */
export function ModalShell({ open, onOpenChange, title, subtitle, eyebrow, width = MODAL_WIDTH.standard, testId, phoneHeight = "full", children }: ModalShellProps) {
  const phone = useIsPhone();
  const focus = useWindowFocus(open);
  if (phone) {
    return (
      /* Prompt 24: a full sheet (to 59 below the top); the title 17/22 600 and the one line under it 13 Text 2 sit in the
         sheet's header, by its 44 close button. The form below pins its own footer above the keyboard. */
      <BottomSheet open={open} onOpenChange={onOpenChange} title={title} line={subtitle} height={phoneHeight}>
        <div data-ui="modal-sheet" style={{ display: "flex", flexDirection: "column", minHeight: "100%", padding: `0 ${PHONE_MARGIN}px` }}>
          {eyebrow ? (
            <p data-testid="modal-eyebrow" style={{ ...EYEBROW, margin: "4px 0 0" }}>
              {eyebrow}
            </p>
          ) : null}
          <span data-testid="modal-subtitle" style={VISUALLY_HIDDEN}>
            {subtitle}
          </span>
          {open ? children : null}
        </div>
      </BottomSheet>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-motion="scrim" style={scrimAt(LAYER.window)} />
        {/* F25: the top edge is pinned at 48, so opening a row grows the window downward and nothing above it moves; the body scrolls inside. */}
        <Dialog.Content data-testid={testId} onOpenAutoFocus={focus.onOpenAutoFocus} onCloseAutoFocus={focus.onCloseAutoFocus} style={windowPlacement(width, LAYER.window)}>
          <div data-testid="modal-header" style={HEADER}>
            <div style={HEADER_TEXT}>
              {eyebrow ? (
                <p data-testid="modal-eyebrow" style={{ ...EYEBROW, margin: `0 0 ${space[1]}px` }}>
                  {eyebrow}
                </p>
              ) : null}
              <Dialog.Title style={TITLE}>{title}</Dialog.Title>
              <Dialog.Description data-testid="modal-subtitle" style={SUBTITLE}>
                {subtitle}
              </Dialog.Description>
            </div>
            <div style={HEADER_ICONS}>
              <IconSquare glyph="x" label={`${MODAL_COPY.close} ${title}`} onClick={() => onOpenChange(false)} />
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
  /** The labels of the required fields not yet complete, as one line; null when all are. */
  missing: string | null;
  /** Adds to what `missing` decides (a field that refuses, such as code over its limit). */
  blocked?: boolean;
  addLabel?: string;
  children: ReactNode;
  /** Said under the body, above the footer, as an alert (what the write refused with). */
  alert?: string | null;
  /** Synth 09: the footer's line in the window's own words ("Required: an application", "Goes after Prompt 3"), in place of
      the one `missing` makes. The fields still say "Required" under themselves from `missing`. */
  status?: string | null;
}

export function ModalForm({ phone, onSubmit, onCancel, missing, blocked = false, addLabel = MODAL_COPY.add, alert, status, children }: ModalFormProps) {
  const ready = missing === null && !blocked;
  /* Synth 09: every box's title, by its name, handed to whoever opened the window when it is saved. */
  const sink = useContext(BoxTitleSinkContext);
  const titles = useRef(new Map<string, string>());
  const form = useRef<HTMLFormElement>(null);
  const collector = useMemo(() => ({ set: (name: string, title: string) => void titles.current.set(name, title), submit: () => form.current?.requestSubmit() }), []);
  return (
    <BoxTitleCollectorContext.Provider value={collector}>
    <form
      ref={form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        if (sink.commit && titles.current.size > 0) sink.commit(Object.fromEntries(titles.current));
        onSubmit();
      }}
      style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "1 1 auto", fontSize: phone ? 16 : 15 }}
    >
      <ModalInset.Provider value={phone ? 0 : MODAL_PAD}>
        {/* UX-02 P11: each field the footer names as required says so under itself too. */}
        <MissingFields.Provider value={missingSet(missing)}>
        <div data-testid="modal-body" style={phone ? { ...bodyStyle(phone), flex: "1 0 auto" } : bodyStyle(phone)}>
          {children}
          {alert ? (
            <div style={{ padding: phone ? "8px 0 0" : `0 ${MODAL_PAD}px 14px` }}>
              <Alert>{alert}</Alert>
            </div>
          ) : null}
        </div>
        </MissingFields.Provider>
      </ModalInset.Provider>
      <div data-testid="modal-footer" style={phone ? PHONE_FOOTER : footerStyle(phone)}>
        <span data-testid="modal-status" role="status" style={FOOT_NOTE}>
          {status ?? requiredLine(missing)}
        </span>
        <RecipeButton variant="ghost" small phone={phone} onClick={onCancel}>
          {MODAL_COPY.cancel}
        </RecipeButton>
        {phone ? (
          /* Prompt 24: on a phone a missing field leaves the action looking disabled (45%) but it still answers: a tap takes the
             reader to the first missing field, focuses it and shakes it once. */
          <RecipeButton
            variant="primary"
            small
            phone
            type="submit"
            aria-disabled={!ready || undefined}
            data-ready={ready ? "" : undefined}
            onClick={(event) => {
              if (ready) return;
              event.preventDefault();
              if (form.current) goToMissing(form.current);
            }}
            style={ready ? undefined : { opacity: PHONE_NOT_READY_OPACITY, boxShadow: "none" }}
          >
            {addLabel}
          </RecipeButton>
        ) : (
          <RecipeButton variant="primary" small phone={phone} type="submit" disabled={!ready}>
            {addLabel}
          </RecipeButton>
        )}
      </div>
    </form>
    </BoxTitleCollectorContext.Provider>
  );
}

/** Prompt 24: the phone's action while a required field is missing. */
export const PHONE_NOT_READY_OPACITY = 0.45;

/** The phone form's footer: on Surface, pinned to the bottom of the sheet (so above the keyboard, which the sheet rides),
    12 16 plus the bottom inset, run to the sheet's edges. */
const PHONE_FOOTER: CSSProperties = {
  position: "sticky",
  bottom: 0,
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  gap: space[2],
  flexShrink: 0,
  margin: `${space[3]}px -${PHONE_MARGIN}px 0`,
  padding: `12px ${PHONE_MARGIN}px calc(12px + env(safe-area-inset-bottom))`,
  background: t.surface,
};

const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex="0"]';

/** The first field the form names as missing (its "Required" line), or else the first empty text box: scrolled to, focused and
    shaken once. */
export function goToMissing(form: HTMLElement): HTMLElement | null {
  const body = form.querySelector<HTMLElement>('[data-testid="modal-body"]') ?? form;
  const line = body.querySelector<HTMLElement>('[data-testid="field-required"]');
  let box: HTMLElement | null = null;
  let control: HTMLElement | null = null;
  if (line) {
    for (let node = line.parentElement; node && node !== body; node = node.parentElement) {
      const found = node.querySelector<HTMLElement>(FOCUSABLE);
      if (found) {
        box = node;
        control = found;
        break;
      }
    }
  }
  if (!control) {
    control = Array.from(body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], input:not([type]), textarea')).find((field) => !field.disabled && field.value.trim() === "") ?? null;
    box = control?.parentElement ?? null;
  }
  if (!control) return null;
  control.scrollIntoView?.({ block: "center", behavior: scrollBehavior() });
  control.focus({ preventScroll: true });
  shakeOnce(box);
  return control;
}

/** A small quiet glyph button, such as a chip's remove: 20 square (44 on a phone), never boxed, no icon library. */
export function GlyphButton({ glyph, label, onClick, phone = false, size = 20 }: { glyph: "x" | "plus" | "pencil"; label: string; onClick: () => void; phone?: boolean; size?: number }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const side = phone ? 44 : size;
  return (
    <button
      type="button"
      aria-label={label}
      data-hit=""
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
        borderRadius: r.full,
        color: state.hovered ? t.text : t.label,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      <Glyph name={glyph} size={sizes.icon} />
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
