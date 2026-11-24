/* Synth 06: the notepad, a window for long text.

   Opened by a modal text box's Expand button, and (read only) by a titled box on a finished build. Surface: `--notepad`,
   radius 16, the notepad's edge and shadow (`elevation.notepad`). In the editor it opens 880 wide over the dimmed modal (the
   modal stays where it is; `data-notepad-dim` on it fades its own scrim in). Header: the field's name in Mint, a 28px close
   button, and under it the title as a 17/600 input (the same optional title as the modal field). Body: the text at 15/22,
   `pre-wrap`, 20px side padding, at least 300 tall in the editor and scrolling inside. Footer: the character count in mono,
   Cancel (ghost) and Done (main); Done writes back to the modal field.

   Read only (a finished build): sized to its text, `clamp(380px, 380 + chars × 0.25, 720px)` wide, as tall as its text up to
   70vh and then scrolling; the footer is the count and a "Copy" button.

   Focus is trapped (Radix's dialog), Escape closes, and focus returns to the Expand button or the title row that opened it. */

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useRef, useState, type RefObject } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { LAYER } from "@/pages/site/compose/layers";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { copyToClipboard } from "@/lib/deepLink";
import { ring } from "@/lib/theme/controls";
import { elevation } from "@/lib/theme/elevation";
import { useInteractive } from "@/lib/theme/interactive";
import { NOTEPAD_DIM_ATTRIBUTE, notepadIn, notepadOut } from "@/lib/theme/notepadMotion";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { ActionSheet } from "@/components/phone/ActionSheet";
import { useKeyboardInset } from "@/components/phone/useKeyboardInset";
import { TOUCH_MIN } from "@/lib/theme/density";

import { Button } from "./Button";
import { MobileIcon } from "./MobileIcon";

export const NOTEPAD_EDITOR_WIDTH = 880;
export const NOTEPAD_EDITOR_MIN_HEIGHT = 300;
export const NOTEPAD_COPY = "Copy";
export const NOTEPAD_COPIED = "Copied";

/** The read-only notepad's width: `clamp(380px, 380 + chars × 0.25, 720px)`. */
export const readOnlyWidth = (chars: number): number => Math.min(720, Math.max(380, 380 + chars * 0.25));

/** "512 characters". */
export const countLine = (chars: number): string => `${chars} ${chars === 1 ? "character" : "characters"}`;

export interface NotepadProps {
  open: boolean;
  /** Cancel, Escape and the close button. */
  onClose: () => void;
  /** The field's name, in Mint at the top ("Instructions"). */
  field: string;
  value: string;
  /** Done: writes the text back to the field. Absent, the notepad is read only. */
  onDone?: (text: string) => void;
  /** The optional title shared with the modal field. */
  title?: string;
  onTitleChange?: (title: string) => void;
  /** Where focus goes back to: the Expand button or the title row. */
  returnFocusTo?: RefObject<HTMLElement | null>;
}

function CloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...handlers}
      style={{
        width: 28,
        height: 28,
        padding: 0,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: 0,
        borderRadius: 14,
        background: state.hovered ? t.notepadCopy : "transparent",
        color: t.text2,
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      <Glyph name="x" size={16} />
    </button>
  );
}

export function Notepad({ open, onClose, field, value, onDone, title = "", onTitleChange, returnFocusTo }: NotepadProps) {
  const readOnly = onDone === undefined;
  const phone = useIsPhone();
  const [draft, setDraft] = useState(value);
  const [copied, setCopied] = useState(false);
  const window_ = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  /* Each opening starts from the field's own text. */
  useEffect(() => {
    if (open) {
      setDraft(value);
      setCopied(false);
      closing.current = false;
    }
  }, [open, value]);

  /* The modal under it dims while it is open, and arrives from the button that opened it. */
  useEffect(() => {
    const node = window_.current;
    const opener = returnFocusTo?.current ?? null;
    const under = opener?.closest<HTMLElement>('[role="dialog"]') ?? null;
    if (!open || !node) return;
    under?.setAttribute(NOTEPAD_DIM_ATTRIBUTE, "on");
    if (opener) void notepadIn(node, opener);
    return () => under?.setAttribute(NOTEPAD_DIM_ATTRIBUTE, "off");
  }, [open, returnFocusTo]);

  const leave = async () => {
    if (closing.current) return;
    closing.current = true;
    if (window_.current) await notepadOut(window_.current, null);
    onClose();
  };

  const text = readOnly ? value : draft;
  const chars = Array.from(text).length;
  const width = readOnly ? readOnlyWidth(chars) : NOTEPAD_EDITOR_WIDTH;
  const fullScreen = phone && !readOnly;

  const body: React.CSSProperties = {
    margin: 0,
    padding: "0 20px",
    boxSizing: "border-box",
    width: "100%",
    border: 0,
    outline: "none",
    background: "transparent",
    color: t.text,
    fontFamily: FIGTREE,
    fontSize: 15,
    lineHeight: "22px",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  };

  if (fullScreen) {
    return (
      <PhoneNotepad
        open={open}
        field={field}
        value={value}
        draft={draft}
        setDraft={setDraft}
        title={title}
        onTitleChange={onTitleChange}
        returnFocusTo={returnFocusTo}
        onCancel={() => void leave()}
        onDone={() => {
          onDone?.(draft);
          void leave();
        }}
        windowRef={window_}
      />
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? undefined : void leave())}>
      <Dialog.Portal>
        <Dialog.Content
          ref={window_}
          data-testid="notepad"
          data-readonly={readOnly ? "" : undefined}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            /* Focus lands on the text, or on the read-only text's scroll box. */
            event.preventDefault();
            window_.current?.querySelector<HTMLElement>("[data-notepad-text]")?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusTo?.current?.focus();
          }}
          style={{
            position: "fixed",
            /* Synth 09: over the window its box is in, whichever layer that is. */
            zIndex: LAYER.notepad,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            /* Synth 09: in the editor, 880 wide from 1101 and `min(880px, 100vw - 64px)` below; on a phone, the whole screen,
               its header and footer pinned and the text scrolling between them. */
            ...(fullScreen
              ? { inset: 0, width: "100%", height: "100dvh", maxHeight: "none", borderRadius: 0 }
              : {
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width,
                  maxWidth: readOnly ? "calc(100vw - 32px)" : "calc(100vw - 64px)",
                  maxHeight: readOnly ? "70vh" : "calc(100dvh - 64px)",
                  borderRadius: 16,
                }),
            background: t.notepad,
            color: t.text,
            fontFamily: FIGTREE,
            ...elevation.notepad,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px 0 20px" }}>
            <Dialog.Title style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, lineHeight: "16px", color: t.brandAccent }}>{field}</Dialog.Title>
            <CloseButton label={`Close ${field}`} onClick={() => void leave()} />
          </div>
          {onTitleChange || title ? (
            <input
              data-notepad-field=""
              aria-label={`${field} title`}
              data-testid="notepad-title"
              value={title}
              readOnly={readOnly || !onTitleChange}
              onChange={(event) => onTitleChange?.(event.target.value)}
              style={{ ...body, flexShrink: 0, height: 32, margin: "4px 0 8px", fontSize: 17, fontWeight: 600, lineHeight: "24px" }}
            />
          ) : (
            <div style={{ height: 8 }} />
          )}
          {readOnly ? (
            <div
              data-notepad-text=""
              tabIndex={0}
              role="document"
              aria-label={field}
              style={{ ...body, flex: "1 1 auto", minHeight: 0, overflowY: "auto", paddingBottom: 12 }}
            >
              {value}
            </div>
          ) : (
            <textarea
              data-notepad-field=""
              data-notepad-text=""
              aria-label={field}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              style={{ ...body, flex: "1 1 auto", minHeight: NOTEPAD_EDITOR_MIN_HEIGHT, resize: "none", overflowY: "auto", paddingBottom: 12 }}
            />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px 16px 20px", flexShrink: 0 }}>
            <span data-testid="notepad-count" role="status" style={{ flexGrow: 1, fontFamily: DM_MONO, fontSize: 13, lineHeight: "16px", color: t.label, fontVariantNumeric: "tabular-nums" }}>
              {countLine(chars)}
            </span>
            {readOnly ? (
              <Button
                variant="secondary"
                size={32}
                style={{ background: t.notepadCopy }}
                onClick={async () => {
                  if (await copyToClipboard(value)) setCopied(true);
                }}
              >
                {copied ? NOTEPAD_COPIED : NOTEPAD_COPY}
              </Button>
            ) : (
              <>
                <Button variant="ghost" size={32} onClick={() => void leave()}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size={32}
                  onClick={() => {
                    onDone?.(draft);
                    void leave();
                  }}
                >
                  Done
                </Button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Prompt 24: the notepad's bar on a phone. */
export const PHONE_NOTEPAD_BAR = 52;
export const PHONE_NOTEPAD_COPY = { cancel: "Cancel", done: "Done", title: "Title · optional", discard: "Discard changes?", discardAction: "Discard", keep: "Keep editing" } as const;

interface PhoneNotepadProps {
  open: boolean;
  field: string;
  value: string;
  draft: string;
  setDraft: (text: string) => void;
  title: string;
  onTitleChange?: (title: string) => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onDone: () => void;
  windowRef: RefObject<HTMLDivElement | null>;
}

/**
 * Prompt 24: the notepad on a phone, full screen over everything in the Notepad tone, under the top inset. A 52 bar (Cancel as
 * the close icon at the left, the field's name 17/600 in the centre, Done at the right); "Title · optional" and its 44 field; the
 * text filling the rest (Panel fill, the Notepad edge, radius 12, margin 8 16, 16/22); a footer of the count and Copy that rides
 * above the keyboard. Done writes back and returns to the Expand button; Cancel with changes asks "Discard changes?" first.
 */
function PhoneNotepad({ open, field, value, draft, setDraft, title, onTitleChange, returnFocusTo, onCancel, onDone, windowRef }: PhoneNotepadProps) {
  const keyboard = useKeyboardInset();
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);
  const close = useInteractive<HTMLButtonElement>();
  const titleId = useId();
  const changed = draft !== value;
  const cancel = () => (changed ? setAsking(true) : onCancel());
  useEffect(() => {
    if (!open) setAsking(false);
  }, [open]);
  const chars = Array.from(draft).length;
  const edge = `inset 0 0 0 1px ${t.notepadEdge}`;
  return (
    <>
      <Dialog.Root open={open} onOpenChange={(next) => (next ? undefined : cancel())}>
        <Dialog.Portal>
          <Dialog.Content
            ref={windowRef}
            data-testid="notepad"
            data-phone=""
            data-motion="sheet"
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              windowRef.current?.querySelector<HTMLElement>("[data-notepad-text]")?.focus();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              returnFocusTo?.current?.focus();
            }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: keyboard,
              zIndex: LAYER.notepad,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              paddingTop: "env(safe-area-inset-top)",
              background: t.notepad,
              color: t.text,
              fontFamily: FIGTREE,
            }}
          >
            <div style={{ flexShrink: 0, height: PHONE_NOTEPAD_BAR, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", alignItems: "center", padding: "0 8px" }}>
              <button
                type="button"
                aria-label={PHONE_NOTEPAD_COPY.cancel}
                onClick={cancel}
                {...close.handlers}
                style={{ justifySelf: "start", width: TOUCH_MIN, height: TOUCH_MIN, padding: 0, border: 0, borderRadius: TOUCH_MIN / 2, background: "transparent", color: t.text, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...ring(close.state.focusVisible) }}
              >
                <MobileIcon name="close" size={24} />
              </button>
              <Dialog.Title style={{ margin: 0, fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{field}</Dialog.Title>
              <span style={{ justifySelf: "end", display: "inline-flex" }}>
                <Button variant="primary" size={32} onClick={onDone}>
                  {PHONE_NOTEPAD_COPY.done}
                </Button>
              </span>
            </div>
            {onTitleChange || title ? (
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 6, padding: "4px 16px 0" }}>
                <label htmlFor={titleId} style={{ fontSize: 13, lineHeight: "16px", color: t.text2 }}>
                  {PHONE_NOTEPAD_COPY.title}
                </label>
                <input
                  id={titleId}
                  aria-label={`${field} title`}
                  data-testid="notepad-title"
                  value={title}
                  readOnly={!onTitleChange}
                  onChange={(event) => onTitleChange?.(event.target.value)}
                  style={{ boxSizing: "border-box", height: TOUCH_MIN, padding: "0 12px", border: 0, borderRadius: 12, background: t.surface, boxShadow: edge, color: t.text, fontFamily: FIGTREE, fontSize: 16, outline: "none" }}
                />
              </div>
            ) : null}
            <textarea
              data-notepad-text=""
              aria-label={field}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              style={{ flex: "1 1 auto", minHeight: 0, margin: "8px 16px", padding: 12, boxSizing: "border-box", border: 0, borderRadius: 12, background: t.surface, boxShadow: edge, color: t.text, fontFamily: FIGTREE, fontSize: 16, lineHeight: "22px", resize: "none", outline: "none", overflowY: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            />
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: keyboard > 0 ? "4px 16px 8px" : "4px 16px calc(8px + env(safe-area-inset-bottom))" }}>
              <span data-testid="notepad-count" role="status" style={{ flexGrow: 1, fontFamily: DM_MONO, fontSize: 13, lineHeight: "16px", color: t.label, fontVariantNumeric: "tabular-nums" }}>
                {countLine(chars)}
              </span>
              <Button
                variant="ghost"
                size={32}
                onClick={async () => {
                  if (await copyToClipboard(draft)) setCopied(true);
                }}
              >
                {copied ? NOTEPAD_COPIED : NOTEPAD_COPY}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <ActionSheet
        open={asking}
        onOpenChange={setAsking}
        title={PHONE_NOTEPAD_COPY.discard}
        action={{
          label: PHONE_NOTEPAD_COPY.discardAction,
          danger: true,
          onSelect: () => {
            setAsking(false);
            onCancel();
          },
        }}
        cancelLabel={PHONE_NOTEPAD_COPY.keep}
      />
    </>
  );
}

export default Notepad;
