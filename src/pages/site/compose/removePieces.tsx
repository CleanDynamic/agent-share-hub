/* CA-20 - the small pieces removing, selecting, undoing and the shortcuts need, built from tokens and `modalRecipes.tsx`.

   P1: the reason a greyed item gives. A menu item that cannot be used says why: as a tooltip, and in words a screen reader
   reads (`aria-describedby`). The words sit next to the item, hidden, so the item's own name and text stay "Move up" and the
   words are read as its description.

   P2: the small windows (a 420 window of the modal recipes: a title at 15/500, one grey line of 13 `--text2`, a footer of buttons,
   a sheet on a phone), the session window, and the one item that removes, at the end of every menu. The danger text colour is
   only on the words that remove.

   The notice after a step is CA-19's (`ReferenceNotice`): the page has one, whichever kind of step made it. */

import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useId, useLayoutEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { BAR_RISE } from "@/lib/build/buildMotion";
import { SELECTION_COPY } from "@/lib/build/buildSelection";
import { SESSION_WINDOW_COPY } from "@/lib/build/componentMenus";
import { ring } from "@/lib/theme/controls";
import { BASE } from "@/lib/theme/motion";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { fallOut, riseIn, useCrossfade } from "./buildMotion";
import { ACTION_BAR_BOTTOM } from "./composeChrome";
import { MenuContent } from "./ComposeMenu";
import { GROUP_TITLE, IconSquare, LABEL, RecipeButton, footerStyle, frameStyle } from "./modalRecipes";
import { DANGER, ELLIPSIS, GAP, PAD, words } from "./referencePieces";
import { menuItem, menuSurface } from "./refinedStyles";

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
  /** Their ids. */
  alsoIds?: string[];
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

/* ── P3: the selection bar ──
   With two or more things chosen, a bar sits at the bottom of the Build column, sticky, centred under it: `--window`, a 1px
   `--window-border`, radius 10, the window's shadow, 44 tall, padding 0 8 0 14, 4 apart. In it, in order: "3 selected" at 13/500, a
   1px `--hairline` divider 20 tall, then text buttons at 12.5/500 `--text`, each 30 tall and padded 0 10, `--tile` under the
   pointer: Move to… (a menu of sessions and parts), Duplicate, Group, Ungroup, Remove (danger text); at the right a 28 square
   "Clear selection". On a phone it sits above the action bar. */


/** The bar's measures, from the board. */
export const BAR_PAD = "0 8px 0 14px";
const BUTTON_PAD = "0 10px";

function BarButton({ children, onClick, danger = false, disabled = false, testId, ...rest }: { children: ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean; testId?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children">) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      {...rest}
      {...handlers}
      style={{
        appearance: "none",
        border: 0,
        height: 30,
        padding: BUTTON_PAD,
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
        whiteSpace: "nowrap",
        background: state.hovered && !disabled ? t.tile : "transparent",
        cursor: disabled ? "default" : "pointer",
        ...words(12.5, 500, danger ? DANGER : t.text),
        ...(disabled ? { filter: t.dimFilter } : null),
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

export interface SelectionBarProps {
  /** CA-22: it is falling away; it keeps its last words and takes no clicks. */
  leaving?: boolean;
  phone: boolean;
  count: number;
  /** Where the chosen can go: sessions for tiles, parts for sessions. Empty: Move to… is greyed with its reason. */
  moveTo: { sessions: readonly { key: string; label: string }[]; parts: readonly { key: string; label: string }[] };
  /** What the selection holds, for what Move to… offers. */
  holds: { tiles: number; sessions: number };
  onMoveToSession: (key: string) => void;
  onMoveToPart: (key: string) => void;
  onDuplicate?: () => void;
  /** Group and Ungroup show only once the reference bridge is available; Ungroup only when something chosen is in a group. */
  onGroup?: () => void;
  onUngroup?: () => void;
  onRemove: () => void;
  onClear: () => void;
}

export function SelectionBar({ leaving = false, phone, count, moveTo, holds, onMoveToSession, onMoveToPart, onDuplicate, onGroup, onUngroup, onRemove, onClear }: SelectionBarProps) {
  const sessions = holds.tiles > 0 ? moveTo.sessions : [];
  const parts = holds.sessions > 0 ? moveTo.parts : [];
  const none = sessions.length + parts.length === 0;
  const reason = useReason(none ? SELECTION_COPY.noPlace : undefined);
  /* CA-22 P6: on the second pick it rises 16 and fades in over BASE; on Esc or Clear selection it falls 16 and fades out. */
  const bar = useRef<HTMLDivElement | null>(null);
  const countRef = useCrossfade<HTMLSpanElement>(count);
  useLayoutEffect(() => {
    if (!bar.current) return;
    if (leaving) fallOut(bar.current, { by: BAR_RISE, ms: BASE });
    else riseIn(bar.current, { by: BAR_RISE, ms: BASE });
  }, [leaving]);
  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label="Selection"
      data-testid="selection-bar"
      data-phone={phone ? "true" : undefined}
      style={{
        position: "sticky",
        bottom: phone ? `calc(${ACTION_BAR_BOTTOM}px + 72px + env(safe-area-inset-bottom))` : 24,
        zIndex: 6,
        alignSelf: "center",
        boxSizing: "border-box",
        height: 44,
        maxWidth: "calc(100vw - 32px)",
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: BAR_PAD,
        background: t.window,
        border: `1px solid ${t.windowBorder}`,
        borderRadius: 10,
        boxShadow: t.windowShadow,
        overflowX: "auto",
        ...(leaving ? { pointerEvents: "none" } : null),
      }}
    >
      <span ref={countRef} data-testid="selection-count" style={{ ...words(13, 500, t.text), whiteSpace: "nowrap", paddingRight: 8 }}>
        {SELECTION_COUNT(count)}
      </span>
      <span aria-hidden="true" style={{ width: 1, height: 20, background: t.hairline, marginRight: 4, flexShrink: 0 }} />
      <Menu.Root>
        <Menu.Trigger asChild>
          <BarButton testId="selection-move" disabled={none} {...reason.props}>
            {SELECTION_COPY.moveTo}
          </BarButton>
        </Menu.Trigger>
        {reason.note}
        <Menu.Portal>
          <MenuContent align="start" side="top" sideOffset={6} style={menuSurface()}>
            {sessions.length > 0 && parts.length > 0 ? <MoveHeading>{SELECTION_COPY.sessions}</MoveHeading> : null}
            {sessions.map((entry) => (
              <Menu.Item key={entry.key} onSelect={() => onMoveToSession(entry.key)} style={menuItem(true, phone)}>
                <span style={ELLIPSIS}>{entry.label}</span>
              </Menu.Item>
            ))}
            {sessions.length > 0 && parts.length > 0 ? <Menu.Separator style={{ height: 1, margin: "4px 0", background: t.hairline }} /> : null}
            {sessions.length > 0 && parts.length > 0 ? <MoveHeading>{SELECTION_COPY.parts}</MoveHeading> : null}
            {parts.map((entry) => (
              <Menu.Item key={entry.key} onSelect={() => onMoveToPart(entry.key)} style={menuItem(true, phone)}>
                <span style={ELLIPSIS}>{entry.label}</span>
              </Menu.Item>
            ))}
          </MenuContent>
        </Menu.Portal>
      </Menu.Root>
      {onDuplicate ? (
        <BarButton testId="selection-duplicate" onClick={onDuplicate}>
          {SELECTION_COPY.duplicate}
        </BarButton>
      ) : null}
      {onGroup ? (
        <BarButton testId="selection-group" onClick={onGroup}>
          {SELECTION_COPY.group}
        </BarButton>
      ) : null}
      {onUngroup ? (
        <BarButton testId="selection-ungroup" onClick={onUngroup}>
          {SELECTION_COPY.ungroup}
        </BarButton>
      ) : null}
      <BarButton testId="selection-remove" danger onClick={onRemove}>
        {SELECTION_COPY.remove}
      </BarButton>
      <span style={{ flexGrow: 1, minWidth: 4 }} />
      <IconSquare glyph="x" label={SELECTION_COPY.clear} phone={false} onClick={onClear} />
    </div>
  );
}

const SELECTION_COUNT = SELECTION_COPY.count;

function MoveHeading({ children }: { children: ReactNode }) {
  return <div style={{ ...words(11.5, 400, t.label), padding: "6px 12px 2px" }}>{children}</div>;
}
