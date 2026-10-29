/* CA-14 P2, P3, P4 — a session's head, and the rows that belong to a session.

   One line on a computer, left to right: a collapse arrow, the app's mark, "Session 1 · Claude", the maker's title, the
   tile count (only while the session is folded), the date, then at the right a drag handle and a ⋯ menu. On a phone the
   title and the date wrap under the app's mark; nothing is squeezed. The colour button is gone from the head: "Colour…" is
   in the ⋯ menu, and a session that has a colour still shows it, as CA-06 drew it.

   The head writes nothing. Its callbacks (`ops`) are the maker's; a reader's build page draws its own head. */

import { FindHit } from "@/components/build/FindHit";
import { useAnnounce } from "./BuildAnnouncer";
import { useItemRing } from "./buildFocus";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { ColourButton } from "@/components/brand/ColourButton";
import { refTo } from "@/lib/build/thread";
import { MemberLabel } from "./groupLabels";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { SESSION_TITLE_MAX } from "@/lib/build/making";
import { MENU_COPY, REASONS, moveReason } from "@/lib/build/componentMenus";
import { ring } from "@/lib/theme/controls";
import { NO_SHRINK, TITLE_LINE, fullText } from "@/lib/theme/truncate";
import { t } from "@/lib/theme/tokens";

import { MenuContent, MenuSubContent } from "./ComposeMenu";
import { TextButton } from "./composeControls";
import { DragHandle, useNestSession, useNestSessionDrag } from "./listNest";
import { ImportingTag } from "./ImportingPieces";
import { ToolMark } from "./refinedPieces";
import { menuItem, menuSurface, text, tnum } from "./refinedStyles";
import { SESSION_META, SESSION_NAME } from "./tileRecipes";
import { NO_APP, type SourceSession } from "./sourcesModel";
import { OPEN_REQUEST_COPY, OpenRequestDialog } from "./OpenRequestDialog";
import { ToolPicker } from "./ToolPicker";
import { RemoveRow, useReason } from "./removePieces";
import { useBuildSelectionContext } from "./useBuildSelection";
import { useCrossfade } from "./buildMotion";

export const SESSION_HEAD_COPY = {
  titlePlaceholder: "Add a title",
  noTiles: "No tiles yet",
  /** SV-05 P3: an import that wrote fewer tiles than its session has prompts. */
  imported: (have: number, of: number) => `${have} of ${of} prompts imported`,
  retry: "Retry",
  addToThis: "+ Add tile",
  moveUp: "Move up",
  moveDown: "Move down",
  edit: "Edit session…",
  colour: "Colour…",
  mergeUp: "Merge with the session above",
  moveToPart: "Move to part…",
  openAsRequest: "Open as a request…",
  withdrawRequest: "Take the request back",
  requested: "Open as a request",
  sameStage: "Same stage as the session above",
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
  /** "Merge with the session above", for any session but the first. Absent: no menu item. */
  onMergeUp?: (key: string) => void;
  /** CA-17 P2: put the session in another part (at its end). Absent: no menu item. */
  onMoveToPart?: (key: string, workstream: string) => void;
  /** CA-17 P2: share the stage of the session above, or stop. Absent: no menu item. */
  onWithAbove?: (key: string, on: boolean) => void;
  /** SV-05 P3: import a short session's missing prompts again. Absent: no Retry. */
  onRetryImport?: (key: string) => void;
  /** SV-21: open the session as a request with a problem, or (null) take the request back. Absent: no menu item. */
  onOpen?: (key: string, problem: string | null) => void;
}

/** CA-17 P2: what a session's head knows about the build's parts. Absent with one part. */
export interface SessionPartInfo {
  /** The other parts, as "Part B · Support agent". */
  moveTo: readonly { key: string; label: string }[];
  /** The first session of its part has no session above to share a stage with. */
  firstInPart: boolean;
  withAbove: boolean;
}

export interface SessionHeadProps {
  session: SourceSession;
  /** SV-05 P1: how many figures the build's largest session number has: every head's number slot is that wide. */
  numberDigits?: number;
  phone: boolean;
  /** How many tiles the session holds. */
  tiles: number;
  collapsed: boolean;
  /** The id of the element that holds the tiles, for `aria-controls`. */
  controls: string;
  onToggle: () => void;
  first: boolean;
  last: boolean;
  /** CA-21 P1: whether Move up or Move down can move it (only the very first and last place in the build say no). Absent: by `first` and `last`. */
  canMove?: (by: -1 | 1) => boolean;
  ops?: SessionOps;
  onOpenSetup?: (key: string) => void;
  onPickApp?: (key: string, tool: string | null) => void;
  /** Opens the colour picker for the session, anchored to the element. Absent: no colour. */
  onColour?: (anchor: HTMLElement) => void;
  /** CA-18: opens the session's own window, to change it: a double click on the head, and "Edit session…" in its menu. Absent: neither. */
  onEdit?: () => void;
  inBuild?: readonly string[];
  /** Whether the session can be moved, titled and so on: not an old build's unsaved run of typed prompts. */
  editable: boolean;
  /** CA-17 P2: with two or more parts. */
  part?: SessionPartInfo;
  /** CA-24 P4: the session is being imported and it is taking long: an "Importing" tag after the app name. */
  importing?: boolean;
}

/** "Session 1 · Claude": the head's name, and the group's accessible name. */
/** SV-05 P1: the number's slot: as wide as `digits` figures, so "9" becoming "10" leaves the words beside it where they are. */
export const numberSlot = (digits: number) => ({ display: "inline-block", minWidth: `${Math.max(1, digits)}ch`, fontVariantNumeric: "tabular-nums" as const });

export const headName = (session: Pick<SourceSession, "number" | "tool">): string => `Session ${session.number} · ${session.tool}`;

/** A session's title as an inline field: saved on blur and on Enter, Esc puts it back. */
function TitleField({ session, phone, onSave }: { session: SourceSession; phone: boolean; onSave: (title: string) => void }) {
  const saved = session.title ?? "";
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const announce = useAnnounce();
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
  useEffect(() => {
    if (past) announce(SESSION_HEAD_COPY.typedPast(draft.length));
  }, [past, draft.length, announce]);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, flex: phone ? "1 1 100%" : "1 1 120px" }}>
      <input
        ref={setField}
        type="text"
        data-testid="session-title"
        aria-label={`Title of Session ${session.number}`}
        placeholder={SESSION_HEAD_COPY.titlePlaceholder}
        value={draft}
        title={draft || undefined}
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
          textOverflow: "ellipsis",
          userSelect: "text",
          ...text(15, 400, t.text),
          ...(phone ? { fontSize: 16 } : null),
        }}
      />
      {past ? (
        <span style={{ ...text(11, 400, t.label), ...tnum, flexShrink: 0 }}>
          {SESSION_HEAD_COPY.typedPast(draft.length)}
        </span>
      ) : null}
    </span>
  );
}

/** The tile count and the date, in the head's quiet words. */
/** CA-15b: the session line's facts, 12.5 `--label`. */
const quiet = (colour: string) => ({ ...SESSION_META, color: colour, ...tnum, whiteSpace: "nowrap" as const, flexShrink: 0 });

export function SessionHead({ session, phone, tiles, collapsed, controls, onToggle, first, last, canMove, ops, onOpenSetup, onPickApp, onColour, onEdit, inBuild = [], editable, part, importing = false, numberDigits = 1 }: SessionHeadProps) {
  /* CA-22 P4: the folded head's count crossfades when a tile joins or leaves. */
  const countRef = useCrossfade<HTMLSpanElement>(tiles);
  /* SV-05 P1: a number that changes where it stands crossfades, old over new; its slot is as wide as the build's widest number. */
  const numberRef = useCrossfade<HTMLSpanElement>(session.number, undefined, true);
  const drop = useNestSession(session.key);
  const drag = useNestSessionDrag(session.key);
  const head = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  /* SV-21: the dialog that asks what the request is for. */
  const [asking, setAsking] = useState(false);
  const itemRing = useItemRing();
  const maker = Boolean(ops) && editable;
  /* CA-20 P3: chosen with others (Cmd, Ctrl or Shift click on the head), it is drawn as selected is. */
  const selection = useBuildSelectionContext();
  const picked = Boolean(selection?.isPicked("session", session.key)) && editable;
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
    if (canMove ? !canMove(by) : (by === -1 && first) || (by === 1 && last)) return;
    ops?.onMove(session.key, by);
  };

  const app = (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, ...NO_SHRINK, ...SESSION_META }}>
      <span style={{ whiteSpace: "nowrap", ...SESSION_NAME }}>
        Session{" "}
        <span ref={numberRef} data-testid="session-number" style={numberSlot(numberDigits)}>
          {session.number}
        </span>{" "}
        ·
      </span>
      {session.tool === NO_APP && onPickApp && maker ? (
        <ToolPicker quiet label={`Pick an app for session ${session.number}`} placeholder={NO_APP} value={null} onChange={(tool) => onPickApp(session.key, tool)} inBuild={inBuild} allowNone={false} phone={phone} step="session" />
      ) : (
        <span style={{ whiteSpace: "nowrap", ...(session.tool === NO_APP ? { color: t.text2 } : null) }}><FindHit text={session.tool} /></span>
      )}
    </span>
  );

  /** The title, the count while folded, the date, Setup and the colour: after the name on a computer, on a line of their own under the app's mark on a phone. */
  const metaRow = (
    <>
      {maker ? (
          <TitleField session={session} phone={phone} onSave={(title) => ops?.onTitle(session.key, title)} />
        ) : session.title ? (
          <span data-testid="session-title-text" {...fullText(session.title)} style={{ ...text(13, 400, t.text), ...TITLE_LINE, flex: "1 1 120px" }}>
            <FindHit text={session.title} />
          </span>
        ) : (
          <span style={{ flex: "1 1 0", minWidth: 0 }} />
        )}
        {collapsed ? (
          <span ref={countRef} data-testid="session-count" style={quiet(t.text2)}>
            {SESSION_HEAD_COPY.count(tiles)}
          </span>
        ) : null}
        {session.date ? <span style={quiet(t.label)}>{session.date}</span> : null}
        {session.open ? (
          <span data-testid="session-open-request" {...fullText(session.open)} style={{ ...quiet(t.lit), ...TITLE_LINE, maxWidth: 240 }}>
            {SESSION_HEAD_COPY.requested}
          </span>
        ) : null}
        {session.imported ? <span data-testid="session-imported" style={quiet(t.text2)}>{SESSION_HEAD_COPY.imported(session.imported.have, session.imported.of)}</span> : null}
        {session.imported && maker && ops?.onRetryImport ? (
          <TextButton target={phone} style={{ ...text(12, 500, t.text2), flexShrink: 0 }} aria-label={`Retry importing Session ${session.number}`} onClick={() => ops.onRetryImport?.(session.key)}>
            {SESSION_HEAD_COPY.retry}
          </TextButton>
        ) : null}
        {session.setupCount && onOpenSetup ? (
          <TextButton target={phone} style={{ ...text(12, 500, t.text2), flexShrink: 0 }} aria-label={`Setup of session ${session.number}: ${session.setupCount}`} onClick={() => onOpenSetup(session.key)}>
            {`Setup ${session.setupCount}`}
          </TextButton>
        ) : null}
        {/* CA-19 P5: a member of a named group says so, just before the session's menu. */}
        <MemberLabel to={refTo({ kind: "session", id: session.key })} />
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
        data-selected={picked ? "true" : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={(event) => {
          setFocused(true);
          itemRing.bind.onFocus(event);
        }}
        onBlur={(event) => {
          itemRing.bind.onBlur(event);
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
        onKeyDown={onKeyDown}
        onMouseDownCapture={(event) => {
          // Cmd, Ctrl or Shift on the head chooses it: the title field must not take the focus.
          if ((event.metaKey || event.ctrlKey || event.shiftKey) && editable) event.preventDefault();
        }}
        onClick={(event) => {
          if (!editable || !selection) return;
          const plain = !(event.metaKey || event.ctrlKey || event.shiftKey);
          // A button, a link or a field keeps its own click unless a key is held.
          if (plain && (event.target as HTMLElement).closest("button, input, a, [role=menuitem]")) return;
          selection.clickHead(session.key, event);
        }}
        onDoubleClick={
          onEdit && maker && !phone
            ? (event) => {
                // A double click on a field, a button or a menu is that control's own.
                if ((event.target as HTMLElement).closest("input, button, a, [role=menuitem]")) return;
                onEdit();
              }
            : undefined
        }
        style={{
          position: "relative",
          outline: "none",
          ...itemRing.ring,
          // SV-07 P6: a head is a label and its controls: clicking or dragging across it selects nothing (its title field still can).
          userSelect: "none",
          display: "flex",
          flexWrap: phone ? "wrap" : "nowrap",
          alignItems: "center",
          columnGap: 8,
          rowGap: 4,
          minHeight: 44,
          minWidth: 0,
          ...(drop.takes ? { background: t.selectedFill, boxShadow: `inset 0 0 0 1px ${t.text2}`, borderRadius: 6 } : null),
          ...(picked ? { background: t.selectedFill, boxShadow: `inset 0 0 0 1px ${t.selectedEdge}`, borderRadius: 6 } : null),
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
        {importing ? <ImportingTag /> : null}
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
                  <Row phone={phone} disabled={canMove ? !canMove(-1) : first} reason={moveReason("session", -1, canMove ? !canMove(-1) : first)} onSelect={() => ops?.onMove(session.key, -1)}>
                    {SESSION_HEAD_COPY.moveUp}
                  </Row>
                  <Row phone={phone} disabled={canMove ? !canMove(1) : last} reason={moveReason("session", 1, canMove ? !canMove(1) : last)} onSelect={() => ops?.onMove(session.key, 1)}>
                    {SESSION_HEAD_COPY.moveDown}
                  </Row>
                  {part && ops?.onMoveToPart && part.moveTo.length === 0 ? (
                    <Row phone={phone} disabled reason={REASONS.onePart}>
                      {SESSION_HEAD_COPY.moveToPart}
                    </Row>
                  ) : null}
                  {part && ops?.onMoveToPart && part.moveTo.length > 0 ? (
                    <Menu.Sub>
                      <Menu.SubTrigger style={menuItem(true, phone)}>{SESSION_HEAD_COPY.moveToPart}</Menu.SubTrigger>
                      <Menu.Portal>
                        <MenuSubContent sideOffset={4} style={menuSurface()} onClick={(event) => event.stopPropagation()}>
                          {part.moveTo.map((to) => (
                            <Row key={to.key} phone={phone} onSelect={() => ops.onMoveToPart?.(session.key, to.key)}>
                              {to.label}
                            </Row>
                          ))}
                        </MenuSubContent>
                      </Menu.Portal>
                    </Menu.Sub>
                  ) : null}
                  {part && ops?.onWithAbove ? (
                    <SameStageRow part={part} phone={phone} onChange={(next) => ops.onWithAbove?.(session.key, next)} />
                  ) : null}
                  {onEdit ? (
                    <Row phone={phone} onSelect={onEdit}>
                      {SESSION_HEAD_COPY.edit}
                    </Row>
                  ) : null}
                  {ops?.onOpen ? (
                    session.open ? (
                      <Row phone={phone} onSelect={() => ops.onOpen?.(session.key, null)}>
                        {SESSION_HEAD_COPY.withdrawRequest}
                      </Row>
                    ) : (
                      <Row phone={phone} onSelect={() => setAsking(true)}>
                        {SESSION_HEAD_COPY.openAsRequest}
                      </Row>
                    )
                  ) : null}
                  {selection ? (
                    <Row phone={phone} disabled={tiles === 0} reason={REASONS.noTiles} onSelect={() => selection.selectSession(session.key)}>
                      {MENU_COPY.selectAllInSession}
                    </Row>
                  ) : null}
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
                  <RemoveRow label={MENU_COPY.removeSession} phone={phone} onSelect={() => ops?.onRemove(session.key)} />
                </MenuContent>
              </Menu.Portal>
            </Menu.Root>
          </span>
        ) : null}
      </div>
      {maker && ops?.onOpen ? (
        <OpenRequestDialog
          open={asking}
          title={OPEN_REQUEST_COPY.openSession(session.number)}
          onClose={() => setAsking(false)}
          onSubmit={(problem) => {
            setAsking(false);
            ops.onOpen?.(session.key, problem);
          }}
        />
      ) : null}
    </>
  );
}

function Row({ children, disabled, onSelect, phone, reason }: { children: ReactNode; disabled?: boolean; onSelect?: () => void; phone: boolean; reason?: string }) {
  const why = useReason(disabled ? reason : undefined);
  return (
    <>
      <Menu.Item disabled={disabled} onSelect={onSelect} style={menuItem(!disabled, phone)} {...why.props}>
        {children}
      </Menu.Item>
      {why.note}
    </>
  );
}

/** "Same stage as the session above": greyed on the first session of a part, with its reason. */
function SameStageRow({ part, phone, onChange }: { part: SessionPartInfo; phone: boolean; onChange: (on: boolean) => void }) {
  const why = useReason(part.firstInPart ? REASONS.noSessionAbove : undefined);
  return (
    <>
      <Menu.CheckboxItem checked={part.withAbove && !part.firstInPart} disabled={part.firstInPart} onCheckedChange={onChange} style={{ ...menuItem(!part.firstInPart, phone), gap: 8 }} {...why.props}>
        <span style={{ width: 16, display: "inline-flex" }}>
          <Menu.ItemIndicator>
            <Glyph name="check" size={16} />
          </Menu.ItemIndicator>
        </span>
        {SESSION_HEAD_COPY.sameStage}
      </Menu.CheckboxItem>
      {why.note}
    </>
  );
}
