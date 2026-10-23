/* CA-20 — the small pieces removing, selecting, undoing and the shortcuts need, built from tokens and `modalRecipes.tsx`.

   P1: the reason a greyed item gives. A menu item that cannot be used says why: as a tooltip, and in words a screen reader
   reads (`aria-describedby`). The words sit next to the item, hidden, so the item's own name and text stay "Move up" and the
   words are read as its description.

   P2: the small windows (a 420 window of the modal recipes: a title at 15/500, one grey line of 13 `--text2`, a footer of buttons,
   a sheet on a phone), the session window, and the one item that removes, at the end of every menu. The danger text colour is
   only on the words that remove.

   The notice after a step is CA-19's (`ReferenceNotice`): the page has one, whichever kind of step made it. */

import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useId, type ReactNode } from "react";

import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { SESSION_WINDOW_COPY } from "@/lib/build/componentMenus";
import { t } from "@/lib/theme/tokens";

import { GROUP_TITLE, LABEL, RecipeButton, footerStyle, frameStyle } from "./modalRecipes";
import { DANGER, GAP, PAD } from "./referencePieces";
import { menuItem } from "./refinedStyles";

/* ── P1: the reason a greyed item gives ── */

/** The props and the hidden words that give a greyed control its reason. Nothing is drawn when there is none. */
export function useReason(reason: string | undefined): { props: { title?: string; "aria-describedby"?: string }; note: ReactNode } {
  const id = useId();
  if (!reason) return { props: {}, note: null };
  return {
    props: { title: reason, "aria-describedby": id },
    note: (
      <span id={id} data-testid="reason" aria-hidden="true" style={VISUALLY_HIDDEN}>
        {reason}
      </span>
    ),
  };
}

/* ── P2: the small windows ── */

export interface SmallWindowProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The grey line under the title. */
  body?: ReactNode;
  /** The buttons, at the right of the footer, in order. */
  buttons: ReactNode;
  testId: string;
  /** Wider than the usual 420. */
  width?: number;
  /** What sits between the title and the footer. */
  children?: ReactNode;
}

/** The 420 window every removal, clearing and conversion asks in. Escape and a click outside cancel. */
export function SmallWindow({ open, onClose, title, body, buttons, testId, width = 420, children }: SmallWindowProps) {
  const phone = useIsPhone();
  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={(next) => !next && onClose()} title={title}>
        <div data-testid={testId} style={{ display: "flex", flexDirection: "column", gap: GAP.column }}>
          {body ? <p style={{ ...LABEL, margin: 0 }}>{body}</p> : null}
          {children}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>{buttons}</div>
        </div>
      </BottomSheet>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 70 }} />
        <Dialog.Content role="alertdialog" aria-describedby={undefined} data-testid={testId} style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 71, ...frameStyle(width) }}>
          <div style={{ padding: PAD.card, display: "flex", flexDirection: "column", gap: GAP.column }}>
            <Dialog.Title style={GROUP_TITLE}>{title}</Dialog.Title>
            {body ? <p style={{ ...LABEL, margin: 0 }}>{body}</p> : null}
            {children}
          </div>
          <div style={footerStyle(false)}>
            <span style={{ flexGrow: 1 }} />
            {buttons}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A footer button whose words remove: the danger text colour on the secondary button. */
export function DangerButton({ children, onClick, testId, phone = false }: { children: ReactNode; onClick: () => void; testId?: string; phone?: boolean }) {
  return (
    <RecipeButton small={!phone} phone={phone} data-testid={testId} data-tone="danger" style={{ color: DANGER }} onClick={onClick}>
      {children}
    </RecipeButton>
  );
}

/** What the session window asks about: the sessions that would go and the tiles in them. */
export interface SessionRemoval {
  /** Their keys, in the order they are drawn. */
  keys: string[];
  /** The number each is drawn with ("Session 2"). */
  numbers: number[];
  /** Top-level tiles in all of them. */
  tiles: number;
  /** Tiles going together with the sessions, that are not in them ("Remove 2 sessions and 1 tile?"). */
  alsoTiles?: number;
  /** Whether "Keep the tiles" can move them anywhere: false when no other session is left. */
  canKeep: boolean;
}

/** "Remove Session 2?": Cancel, Keep the tiles (they move to the session above, or below for the first), Remove all. */
export function SessionRemoveWindow({ removal, onClose, onChoose }: { removal: SessionRemoval | null; onClose: () => void; onChoose: (mode: "keep" | "all") => void }) {
  const phone = useIsPhone();
  const keepReason = useReason(removal && !removal.canKeep ? SESSION_WINDOW_COPY.keepNone : undefined);
  if (!removal) return null;
  const many = removal.keys.length > 1 || (removal.alsoTiles ?? 0) > 0;
  const title = many ? SESSION_WINDOW_COPY.titleMany(removal.keys.length, removal.alsoTiles ?? 0) : SESSION_WINDOW_COPY.title(removal.numbers[0]);
  const body = many ? SESSION_WINDOW_COPY.bodyMany(removal.tiles) : SESSION_WINDOW_COPY.body(removal.tiles);
  return (
    <SmallWindow
      open
      onClose={onClose}
      title={title}
      body={body}
      testId="remove-session-window"
      buttons={
        <>
          <RecipeButton small={!phone} phone={phone} onClick={onClose}>
            {SESSION_WINDOW_COPY.cancel}
          </RecipeButton>
          <RecipeButton small={!phone} phone={phone} disabled={!removal.canKeep} data-testid="remove-session-keep" onClick={() => onChoose("keep")} {...keepReason.props}>
            {SESSION_WINDOW_COPY.keep}
          </RecipeButton>
          {keepReason.note}
          <DangerButton phone={phone} testId="remove-session-all" onClick={() => onChoose("all")}>
            {SESSION_WINDOW_COPY.all}
          </DangerButton>
        </>
      }
    />
  );
}

/* ── P2: the item that removes ── */

/**
 * The one Remove item at the end of every menu: a rule above it, then the words in the danger text colour. `shortcut` is the
 * keys at the right, drawn by the menu (P8).
 */
export function RemoveRow({ label, phone, onSelect, shortcut, testId }: { label: string; phone: boolean; onSelect: () => void; shortcut?: ReactNode; testId?: string }) {
  return (
    <>
      <Menu.Separator style={{ height: 1, margin: "4px 0", background: t.hairline }} />
      <Menu.Item data-tone="danger" data-testid={testId} onSelect={onSelect} style={{ ...menuItem(true, phone), color: DANGER, justifyContent: "space-between", gap: 12 }}>
        <span>{label}</span>
        {shortcut}
      </Menu.Item>
    </>
  );
}
