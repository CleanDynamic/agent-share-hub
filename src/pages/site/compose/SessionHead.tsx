/* CA-14 P2, P3, P4 — a session's head, and the rows that belong to a session.

   One line on a computer, left to right: a collapse arrow, the app's mark, "Session 1 · Claude", the maker's title, the
   tile count (only while the session is folded), the date, then at the right a drag handle and a ⋯ menu. On a phone the
   title and the date wrap under the app's mark; nothing is squeezed. The colour button is gone from the head: "Colour…" is
   in the ⋯ menu, and a session that has a colour still shows it, as CA-06 drew it.

   The head writes nothing. Its callbacks (`ops`) are the maker's; a reader's build page draws its own head. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { ColourButton } from "@/components/brand/ColourButton";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { SESSION_TITLE_MAX } from "@/lib/build/making";
import { ring } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";

import { MenuContent } from "./ComposeMenu";
import { TextButton } from "./composeControls";
import { DragHandle, useNestSession, useNestSessionDrag } from "./listNest";
import { ToolMark } from "./refinedPieces";
import { dialogTitle, menuItem, menuSurface, text, tnum, windowStyle } from "./refinedStyles";
import { NO_APP, type SourceSession } from "./sourcesModel";
import { ToolPicker } from "./ToolPicker";

export const SESSION_HEAD_COPY = {
  titlePlaceholder: "Add a title",
  noTiles: "No tiles yet",
  addToThis: "+ Add to this session",
  moveUp: "Move up",
  moveDown: "Move down",
  colour: "Colour…",
  mergeUp: "Merge with the session above",
  remove: "Remove session…",
  removeTitle: (n: number) => `Remove Session ${n}?`,
  removeBody: (tiles: number) => `Its ${tiles} ${tiles === 1 ? "tile is" : "tiles are"} removed too.`,
  removeBodyEmpty: "It has no tiles.",
  confirm: "Remove",
  cancel: "Cancel",
  count: (n: number) => `${n} ${n === 1 ? "tile" : "tiles"}`,
  typedPast: (n: number) => `${n}/${SESSION_TITLE_MAX}`,
} as const;

/** The title's count shows only while typing past this many characters. */
export const TITLE_COUNT_FROM = 60;

/** What the maker can do to a session. Absent: a head with no maker controls. */
export interface SessionOps {
  onTitle: (key: string, title: string) => void;
  onMove: (key: string, by: -1 | 1) => void;
  onRemove: (key: string) => void;
  /** Only with "Split and merge" on. Absent: no menu item. */
  onMergeUp?: (key: string) => void;
}

export interface SessionHeadProps {
  session: SourceSession;
  phone: boolean;
  /** How many tiles the session holds. */
  tiles: number;
  collapsed: boolean;
  /** The id of the element that holds the tiles, for `aria-controls`. */
  controls: string;
  onToggle: () => void;
  first: boolean;
  last: boolean;
  ops?: SessionOps;
  onOpenSetup?: (key: string) => void;
  onPickApp?: (key: string, tool: string | null) => void;
  /** Opens the colour picker for the session, anchored to the element. Absent: no colour. */
  onColour?: (anchor: HTMLElement) => void;
  inBuild?: readonly string[];
  /** Whether the session can be moved, titled and so on: not an old build's unsaved run of typed prompts. */
  editable: boolean;
}

/** "Session 1 · Claude": the head's name, and the group's accessible name. */
export const headName = (session: Pick<SourceSession, "number" | "tool">): string => `Session ${session.number} · ${session.tool}`;

/** A session's title as an inline field: saved on blur and on Enter, Esc puts it back. */
function TitleField({ session, phone, onSave }: { session: SourceSession; phone: boolean; onSave: (title: string) => void }) {
  const saved = session.title ?? "";
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  /* The global field rule paints a field's fill with !important, which only an !important inline value outranks: the title
     is a line of text until it is touched, so its fill is taken off here, and its border is transparent until hover or focus. */
  const [hover, setHover] = useState(false);
  const setField = (element: HTMLInputElement | null) => {
    field.current = element;
    element?.style.setProperty("background", "transparent", "important");
  };
  useEffect(() => {
    if (!editing) setDraft(saved);
  }, [saved, editing]);
  /** Esc asks for the old title back; the blur it causes then keeps nothing. */
  const cancelled = useRef(false);
  const finish = () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(saved);
      return;
    }
    const next = draft.trim().slice(0, SESSION_TITLE_MAX);
    setDraft(next);
    if (next !== saved) onSave(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      field.current?.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelled.current = true;
      field.current?.blur();
    }
  };
  const past = editing && draft.length > TITLE_COUNT_FROM;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, flex: phone ? "1 1 100%" : "1 1 120px" }}>
      <input
        ref={setField}
        type="text"
        data-testid="session-title"
        aria-label={`Title of Session ${session.number}`}
        placeholder={SESSION_HEAD_COPY.titlePlaceholder}
        value={draft}
        maxLength={SESSION_TITLE_MAX}
        autoComplete="off"
        onFocus={() => setEditing(true)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onBlur={finish}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          height: phone ? 36 : 28,
          boxSizing: "border-box",
          borderColor: hover || editing ? t.line : "transparent",
          borderRadius: 6,
          padding: "0 6px",
          margin: "0 -6px",
          ...text(15, 400, t.text),
          ...(phone ? { fontSize: 16 } : null),
        }}
      />
      {past ? (
        <span aria-live="polite" style={{ ...text(11, 400, t.label), ...tnum, flexShrink: 0 }}>
          {SESSION_HEAD_COPY.typedPast(draft.length)}
        </span>
      ) : null}
    </span>
  );
}

/** The tile count and the date, in the head's quiet words. */
const quiet = (colour: string) => ({ ...text(13, 400, colour), ...tnum, whiteSpace: "nowrap" as const, flexShrink: 0 });

function RemoveDialog({ open, session, tiles, phone, onClose, onConfirm }: { open: boolean; session: SourceSession; tiles: number; phone: boolean; onClose: () => void; onConfirm: () => void }) {
  const body = (
    <>
      <p style={{ ...text(13, 400, t.text2), margin: "0 0 16px" }}>{tiles > 0 ? SESSION_HEAD_COPY.removeBody(tiles) : SESSION_HEAD_COPY.removeBodyEmpty}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" size={phone ? 44 : 36} onClick={onClose}>
          {SESSION_HEAD_COPY.cancel}
        </Button>
        <Button variant="primary" size={phone ? 44 : 36} onClick={onConfirm}>
          {SESSION_HEAD_COPY.confirm}
        </Button>
      </div>
    </>
  );
  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={(next) => !next && onClose()} title={SESSION_HEAD_COPY.removeTitle(session.number)}>
        {body}
      </BottomSheet>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content role="alertdialog" aria-describedby={undefined} data-testid="remove-session-dialog" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...windowStyle(380) }}>
          <Dialog.Title style={dialogTitle}>{SESSION_HEAD_COPY.removeTitle(session.number)}</Dialog.Title>
          {body}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SessionHead({ session, phone, tiles, collapsed, controls, onToggle, first, last, ops, onOpenSetup, onPickApp, onColour, inBuild = [], editable }: SessionHeadProps) {
  const drop = useNestSession(session.key);
  const drag = useNestSessionDrag(session.key);
  const head = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [removing, setRemoving] = useState(false);
  const maker = Boolean(ops) && editable;
  const handleShown = phone || hovered || focused || drag.held;
  const setRefs = (element: HTMLDivElement | null) => {
    head.current = element;
    drop.setRef(element);
    drag.setRef(element);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!maker || !event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    if (event.target instanceof HTMLInputElement && event.target.getAttribute("data-testid") !== "session-title") return;
    event.preventDefault();
    const by = event.key === "ArrowUp" ? -1 : 1;
    if ((by === -1 && first) || (by === 1 && last)) return;
    ops?.onMove(session.key, by);
  };

  const app = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, ...text(15, 500, t.text) }}>
      <span style={{ whiteSpace: "nowrap" }}>Session {session.number} ·</span>
      {session.tool === NO_APP && onPickApp && maker ? (
        <ToolPicker quiet label={`Pick an app for session ${session.number}`} placeholder={NO_APP} value={null} onChange={(tool) => onPickApp(session.key, tool)} inBuild={inBuild} allowNone={false} phone={phone} step="session" />
      ) : (
        <span style={{ whiteSpace: "nowrap", ...(session.tool === NO_APP ? { color: t.text2 } : null) }}>{session.tool}</span>
      )}
    </span>
  );

  /** The title, the count while folded, the date, Setup and the colour: after the name on a computer, on a line of their own under the app's mark on a phone. */
  const metaRow = (
    <>
      {maker ? (
          <TitleField session={session} phone={phone} onSave={(title) => ops?.onTitle(session.key, title)} />
        ) : session.title ? (
          <span data-testid="session-title-text" style={{ ...text(15, 400, t.text), minWidth: 0, flex: "1 1 120px", overflowWrap: "anywhere" }}>
            {session.title}
          </span>
        ) : (
          <span style={{ flex: "1 1 0", minWidth: 0 }} />
        )}
        {collapsed ? (
          <span data-testid="session-count" style={quiet(t.text2)}>
            {SESSION_HEAD_COPY.count(tiles)}
          </span>
        ) : null}
        {session.date ? <span style={quiet(t.label)}>{session.date}</span> : null}
        {session.setupCount && onOpenSetup ? (
          <TextButton target={phone} style={{ ...text(12, 500, t.text2), flexShrink: 0 }} aria-label={`Setup of session ${session.number}: ${session.setupCount}`} onClick={() => onOpenSetup(session.key)}>
            {`Setup ${session.setupCount}`}
          </TextButton>
        ) : null}
        {session.colour && onColour && editable ? (
          <ColourButton what={`Session ${session.number}`} colour={session.colour} size={phone ? 30 : 22} onPick={(anchor) => onColour(anchor)} />
        ) : null}
    </>
  );

  return (
    <>
      <div
        ref={setRefs}
        role="group"
        aria-label={headName(session)}
        data-testid="session-head"
        tabIndex={-1}
        data-takes={drop.takes ? "true" : undefined}
        data-collapsed={collapsed ? "true" : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
        onKeyDown={onKeyDown}
        style={{
          position: "relative",
          outline: "none",
          display: "flex",
          flexWrap: phone ? "wrap" : "nowrap",
          alignItems: "center",
          columnGap: 8,
          rowGap: 4,
          minHeight: 44,
          minWidth: 0,
          ...(drop.takes ? { background: t.selectedFill, boxShadow: `inset 0 0 0 1px ${t.text2}`, borderRadius: 6 } : null),
          ...(drag.held ? { filter: t.dimFilter } : null),
        }}
      >
        {drop.overForSession ? <span data-testid="session-drop-line" aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: -6, height: 2, background: t.text2 }} /> : null}
        <IconButton
          icon={ChevronRight}
          glyph={collapsed ? "chev" : "chevd"}
          boxed={false}
          size={30}
          data-hit=""
          label={`${collapsed ? "Expand" : "Collapse"} Session ${session.number}`}
          aria-expanded={!collapsed}
          aria-controls={controls}
          onClick={onToggle}
        />
        {session.tool === NO_APP ? (
          <span aria-hidden="true" style={{ display: "inline-flex", width: 20, height: 20, alignItems: "center", justifyContent: "center", color: t.label, flexShrink: 0 }}>
            <Glyph name="layers" size={16} />
          </span>
        ) : (
          <ToolMark tool={session.tool} size={20} />
        )}
        {app}
        {phone ? <div data-testid="session-head-meta" style={{ order: 3, flex: "1 1 100%", display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 4, minWidth: 0, paddingLeft: 40 }}>{metaRow}</div> : metaRow}
        {maker ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: "auto", order: phone ? 2 : undefined }}>
            <span style={{ visibility: handleShown ? "visible" : "hidden", display: "inline-flex" }}>
              <DragHandle label={`Move Session ${session.number}`} nest={drag} testId="session-drag-handle" />
            </span>
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton icon={MoreHorizontal} glyph="more" boxed={false} data-hit="" label={`Session ${session.number} options`} size={30} />
              </Menu.Trigger>
              <Menu.Portal>
                <MenuContent align="end" sideOffset={4} style={menuSurface()}>
                  <Row phone={phone} disabled={first} onSelect={() => ops?.onMove(session.key, -1)}>
                    {SESSION_HEAD_COPY.moveUp}
                  </Row>
                  <Row phone={phone} disabled={last} onSelect={() => ops?.onMove(session.key, 1)}>
                    {SESSION_HEAD_COPY.moveDown}
                  </Row>
                  {onColour ? (
                    <Row phone={phone} onSelect={() => head.current && onColour(head.current)}>
                      {SESSION_HEAD_COPY.colour}
                    </Row>
                  ) : null}
                  {ops?.onMergeUp && !first ? (
                    <Row phone={phone} onSelect={() => ops.onMergeUp?.(session.key)}>
                      {SESSION_HEAD_COPY.mergeUp}
                    </Row>
                  ) : null}
                  <Row phone={phone} onSelect={() => setRemoving(true)}>
                    {SESSION_HEAD_COPY.remove}
                  </Row>
                </MenuContent>
              </Menu.Portal>
            </Menu.Root>
          </span>
        ) : null}
      </div>
      <RemoveDialog
        open={removing}
        session={session}
        tiles={tiles}
        phone={phone}
        onClose={() => setRemoving(false)}
        onConfirm={() => {
          setRemoving(false);
          ops?.onRemove(session.key);
        }}
      />
    </>
  );
}

function Row({ children, disabled, onSelect, phone }: { children: ReactNode; disabled?: boolean; onSelect?: () => void; phone: boolean }) {
  return (
    <Menu.Item disabled={disabled} onSelect={onSelect} style={menuItem(!disabled, phone)}>
      {children}
    </Menu.Item>
  );
}
