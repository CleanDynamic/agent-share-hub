/* CA-25 P1: the Publish checklist.

   A 480 window of the modal recipes. The title (15/500), under it a line of what is open (12.5 `--text2`), then Required and
   Recommended, each a label (12 `--label`) over its rows. A row is 48 tall at least, a 16 circle (filled with a check when it is
   done, a 1.5 ring when it is not), the words, the detail under them, and at the right the action as a text link. Rows are split by
   a 1px `--hairline`. The footer is on `--window-foot`: the note on the left, Close, then Publish (greyed while a required item is
   open). Every action closes the window first, so the page can take focus. */

import { useWindowFocus } from "@/lib/focus/windowFocus";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type CSSProperties, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { CHECKLIST_COPY, type Checklist, type ChecklistItem } from "@/lib/build/publishChecklist";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { FOOT_NOTE, RecipeButton, TITLE, footerStyle, frameStyle } from "./modalRecipes";
import { text } from "./refinedStyles";

/** The window the three Publish windows share: a title, a body, a footer. A phone gets the bottom sheet. */
export function PublishFrame({
  open,
  onClose,
  title,
  width,
  testId,
  body,
  footer,
  closeFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width: number;
  testId: string;
  body: ReactNode;
  footer: ReactNode;
  /** Called as the window closes: true keeps focus where it is, so an action's target can take it. */
  closeFocus?: () => boolean;
}) {
  const phone = useIsPhone();
  const focus = useWindowFocus(open, (event) => {
    if (closeFocus?.()) event.preventDefault();
  });
  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={(next) => !next && onClose()} title={title}>
        <div data-testid={testId} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {body}
          <div style={footerStyle(true)}>{footer}</div>
        </div>
      </BottomSheet>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 70 }} />
        <Dialog.Content
          data-testid={testId}
          aria-describedby={undefined}
          onOpenAutoFocus={focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 71, ...frameStyle(width) }}
        >
          <div style={{ padding: 20, flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
            <Dialog.Title style={TITLE}>{title}</Dialog.Title>
            {body}
          </div>
          <div style={footerStyle(false)}>{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const LINE: CSSProperties = { ...text(12.5, 400, t.text2), margin: "4px 0 0" };
const SECTION_LABEL: CSSProperties = { ...text(12, 400, t.label), margin: "14px 0 4px" };
const ROW: CSSProperties = { display: "flex", alignItems: "center", gap: 10, minHeight: 48, boxSizing: "border-box", padding: "8px 0" };

function Circle({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-testid={done ? "checklist-done" : "checklist-open"}
      style={{
        width: 16,
        height: 16,
        flexShrink: 0,
        boxSizing: "border-box",
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...(done ? { background: t.text, color: t.well } : { border: `1.5px solid ${t.textDisabled}` }),
      }}
    >
      {done ? <Glyph name="check" size={10} /> : null}
    </span>
  );
}

function ActionLink({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...handlers}
      style={{
        appearance: "none",
        background: "none",
        border: 0,
        padding: 0,
        flexShrink: 0,
        ...text(12.5, 500, state.hovered ? t.text : t.text2),
        textDecoration: "underline",
        textUnderlineOffset: 3,
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

function ChecklistRow({ item, first, onAction }: { item: ChecklistItem; first: boolean; onAction: (item: ChecklistItem) => void }) {
  return (
    <li data-testid={`checklist-${item.key}`} data-done={item.done ? "true" : "false"} style={{ ...ROW, ...(first ? null : { borderTop: `1px solid ${t.hairline}` }) }}>
      <Circle done={item.done} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
        <span style={{ ...(item.done ? text(13, 400, t.text2) : text(13, 500, t.text)), overflowWrap: "anywhere" }}>{item.words}</span>
        {item.detail ? <span style={{ ...text(12, 400, t.label), overflowWrap: "anywhere", ...(item.done ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : null) }}>{item.detail}</span> : null}
      </div>
      {item.action ? (
        <ActionLink label={`${item.action.label}: ${item.words}`} onClick={() => onAction(item)}>
          {item.action.label}
        </ActionLink>
      ) : null}
    </li>
  );
}

function Section({ label, items, onAction }: { label: string; items: readonly ChecklistItem[]; onAction: (item: ChecklistItem) => void }) {
  return (
    <section aria-label={label} data-testid={`checklist-section-${label.toLowerCase()}`}>
      <h3 style={{ ...SECTION_LABEL, fontWeight: 400 }}>{label}</h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item, at) => (
          <ChecklistRow key={item.key} item={item} first={at === 0} onAction={onAction} />
        ))}
      </ul>
    </section>
  );
}

export interface PublishChecklistProps {
  open: boolean;
  checklist: Checklist;
  onClose: () => void;
  /** An action was chosen. The window has already closed. */
  onAction: (item: ChecklistItem) => void;
  /** Publish in the footer: the page opens Confirm. The window has already closed. */
  onPublish: () => void;
}

export function PublishChecklist({ open, checklist, onClose, onAction, onPublish }: PublishChecklistProps) {
  const phone = useIsPhone();
  const acted = useRef(false);
  const choose = (item: ChecklistItem) => {
    acted.current = true;
    onClose();
    onAction(item);
  };
  /* Required is listed while something in it is open, with what is done beside it; otherwise only what is recommended is shown. */
  const showRequired = checklist.openRequired > 0;
  return (
    <PublishFrame
      open={open}
      onClose={onClose}
      title={CHECKLIST_COPY.title}
      width={480}
      testId="publish-checklist"
      closeFocus={() => {
        const kept = acted.current;
        acted.current = false;
        return kept;
      }}
      body={
        <>
          <p data-testid="checklist-line" style={LINE}>
            {checklist.line}
          </p>
          {showRequired ? <Section label={CHECKLIST_COPY.required} items={checklist.required} onAction={choose} /> : null}
          {checklist.recommended.length > 0 ? <Section label={CHECKLIST_COPY.recommended} items={checklist.recommended} onAction={choose} /> : null}
        </>
      }
      footer={
        <>
          {checklist.note ? (
            <span data-testid="checklist-note" style={{ ...FOOT_NOTE, ...text(12, 400, t.label) }}>
              {checklist.note}
            </span>
          ) : (
            <span style={{ flexGrow: 1 }} />
          )}
          <RecipeButton small={!phone} phone={phone} data-testid="checklist-close" onClick={onClose}>
            {CHECKLIST_COPY.close}
          </RecipeButton>
          <RecipeButton
            small={!phone}
            phone={phone}
            variant="primary"
            data-testid="checklist-publish"
            disabled={!checklist.canPublish}
            onClick={() => {
              onClose();
              onPublish();
            }}
          >
            {CHECKLIST_COPY.publish}
          </RecipeButton>
        </>
      }
    />
  );
}
