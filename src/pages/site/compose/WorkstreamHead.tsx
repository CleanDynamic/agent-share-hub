/* CA-17 P2 — a part's head, at the top of its group in the List. Only drawn when the build has two or more parts.

   Left to right: the drag handle, the label and the name (14/500, in the part's colour through `nameColourFor`, else
   `--text`), the count in the data face, the colour button (only when the part has a colour), the ⋯ menu and the fold
   chevron. On a phone the menu carries the colour as well, as a session's head does.

   In code a part is a "workstream", because "part" already means a tile or a session here. The head writes nothing: its
   callbacks (`ops`) are the maker's, and a reader's head is drawn without them. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { bothRefs, usePartRef } from "@/components/build/partNav";
import { ColourButton } from "@/components/brand/ColourButton";
import { MemberLabel } from "./groupLabels";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { WORKSTREAM_NAME_MAX } from "@/lib/build/making";
import { refTo } from "@/lib/build/thread";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { MenuContent, MenuSubContent } from "./ComposeMenu";
import { DragHandle, useNestWorkstream, useNestWorkstreamDrag } from "./listNest";
import { GROUP_TITLE, LABEL, RecipeButton, frameStyle } from "./modalRecipes";
import { menuItem, menuSurface, text, tnum } from "./refinedStyles";
import { WORKSTREAM_STARTS } from "./workstreamRecipes";

export const WORKSTREAM_HEAD_COPY = {
  namePlaceholder: "Add a name",
  colour: "Colour…",
  startsAfter: "Starts after…",
  startsAfterNone: "None",
  moveUp: "Move up",
  moveDown: "Move down",
  remove: "Remove part…",
  removeTitle: (label: string) => `Remove ${label}?`,
  removeBody: (sessions: number, joins: string) => (sessions === 0 ? "It has no sessions." : `Its ${sessions} ${sessions === 1 ? "session joins" : "sessions join"} ${joins}.`),
  confirm: "Remove",
  cancel: "Cancel",
  count: (n: number) => `${n} ${n === 1 ? "session" : "sessions"}`,
  empty: "No sessions yet",
  addHere: "+ Add a session to this part",
  startsLine: (after: string) => `Starts after ${after}`,
  sameStage: (session: string) => `Same stage as ${session}`,
} as const;

/** What the maker can do to a part. Absent: a head with no maker controls. */
export interface WorkstreamOps {
  onName: (key: string, name: string) => void;
  onMove: (key: string, by: -1 | 1) => void;
  onRemove: (key: string) => void;
  onStartsAfter: (key: string, session: string | null) => void;
}

export interface WorkstreamHeadView {
  key: string;
  /** "Part B". */
  label: string;
  name?: string;
  colour?: string;
  /** The colour its name is drawn in: the part's colour kept readable, else `--text`. */
  nameColour: string;
  sessions: number;
  collapsed: boolean;
  /** "Part A · Session 2" when it starts after a session. */
  startsAfterLine?: string;
  /** The session it starts after, for the tick in the submenu. */
  startsAfter?: string;
}

export interface WorkstreamHeadProps {
  part: WorkstreamHeadView;
  phone: boolean;
  first: boolean;
  last: boolean;
  /** The id of the element that holds the part's sessions, for `aria-controls`. */
  controls: string;
  onToggle: () => void;
  ops?: WorkstreamOps;
  /** The sessions it may start after, as the menu lists them. */
  startsAfterChoices: readonly { key: string; label: string }[];
  /** Where its sessions go when it is removed: "Part A". */
  joins: string;
  /** Opens the colour picker for the part, anchored to the element. Absent: no colour. */
  onColour?: (anchor: HTMLElement) => void;
}

const quiet = { ...text(12, 400, t.label), fontFamily: DM_MONO, ...tnum, whiteSpace: "nowrap" as const, flexShrink: 0 };

/** The part's name as an inline field: saved on blur and on Enter, Esc puts it back. */
function NameField({ part, phone, onSave }: { part: WorkstreamHeadView; phone: boolean; onSave: (name: string) => void }) {
  const saved = part.name ?? "";
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);
  const field = useRef<HTMLInputElement | null>(null);
  const cancelled = useRef(false);
  const setField = (element: HTMLInputElement | null) => {
    field.current = element;
    element?.style.setProperty("background", "transparent", "important");
  };
  useEffect(() => {
    if (!editing) setDraft(saved);
  }, [saved, editing]);
  const finish = () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(saved);
      return;
    }
    const next = draft.trim().slice(0, WORKSTREAM_NAME_MAX);
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
  return (
    <input
      ref={setField}
      type="text"
      data-testid="workstream-name"
      aria-label={`Name of ${part.label}`}
      placeholder={WORKSTREAM_HEAD_COPY.namePlaceholder}
      value={draft}
      maxLength={WORKSTREAM_NAME_MAX}
      autoComplete="off"
      onFocus={() => setEditing(true)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onBlur={finish}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
      style={{
        flex: "1 1 120px",
        minWidth: 0,
        height: phone ? 36 : 28,
        boxSizing: "border-box",
        borderColor: hover || editing ? t.line : "transparent",
        borderRadius: 6,
        padding: "0 6px",
        margin: "0 -6px",
        ...text(14, 500, part.nameColour),
        ...(phone ? { fontSize: 16 } : null),
      }}
    />
  );
}

function Row({ children, disabled, onSelect, phone }: { children: ReactNode; disabled?: boolean; onSelect?: () => void; phone: boolean }) {
  return (
    <Menu.Item disabled={disabled} onSelect={onSelect} style={menuItem(!disabled, phone)}>
      {children}
    </Menu.Item>
  );
}

/** "Remove Part B?": a small window, Cancel and Remove at the right. A sheet on a phone. */
function RemoveDialog({ open, part, joins, phone, onClose, onConfirm }: { open: boolean; part: WorkstreamHeadView; joins: string; phone: boolean; onClose: () => void; onConfirm: () => void }) {
  const title = WORKSTREAM_HEAD_COPY.removeTitle(part.label);
  const body = (
    <>
      <p style={{ ...LABEL, margin: "4px 0 16px" }}>{WORKSTREAM_HEAD_COPY.removeBody(part.sessions, joins)}</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <RecipeButton phone={phone} onClick={onClose}>
          {WORKSTREAM_HEAD_COPY.cancel}
        </RecipeButton>
        <RecipeButton phone={phone} data-testid="remove-workstream-confirm" style={{ color: t.breakage }} onClick={onConfirm}>
          {WORKSTREAM_HEAD_COPY.confirm}
        </RecipeButton>
      </div>
    </>
  );
  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={(next) => !next && onClose()} title={title}>
        {body}
      </BottomSheet>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          role="alertdialog"
          aria-describedby={undefined}
          data-testid="remove-workstream-dialog"
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...frameStyle(380), padding: 20 }}
        >
          <Dialog.Title style={{ ...GROUP_TITLE }}>{title}</Dialog.Title>
          {body}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The part's menu: Colour…, Starts after…, Move up, Move down, then Remove part… */
function PartMenuRows({ props, colour, remove }: { props: WorkstreamHeadProps; colour?: () => void; remove: () => void }) {
  const { part, phone, first, last, ops, startsAfterChoices } = props;
  return (
    <>
      {colour ? (
        <Row phone={phone} onSelect={colour}>
          {WORKSTREAM_HEAD_COPY.colour}
        </Row>
      ) : null}
      {ops ? (
        <Menu.Sub>
          <Menu.SubTrigger style={menuItem(true, phone)}>{WORKSTREAM_HEAD_COPY.startsAfter}</Menu.SubTrigger>
          <Menu.Portal>
            <MenuSubContent sideOffset={4} style={menuSurface()} onClick={(event) => event.stopPropagation()}>
              {startsAfterChoices.map((choice) => (
                <Row key={choice.key} phone={phone} onSelect={() => ops.onStartsAfter(part.key, choice.key)}>
                  <span aria-hidden="true" style={{ width: 16, display: "inline-flex", marginRight: 8 }}>
                    {part.startsAfter === choice.key ? <Glyph name="check" size={16} /> : null}
                  </span>
                  {choice.label}
                </Row>
              ))}
              {startsAfterChoices.length > 0 ? <Menu.Separator style={{ height: 1, margin: "4px 0", background: t.hairline }} /> : null}
              <Row phone={phone} onSelect={() => ops.onStartsAfter(part.key, null)}>
                <span aria-hidden="true" style={{ width: 16, display: "inline-flex", marginRight: 8 }}>
                  {part.startsAfter ? null : <Glyph name="check" size={16} />}
                </span>
                {WORKSTREAM_HEAD_COPY.startsAfterNone}
              </Row>
            </MenuSubContent>
          </Menu.Portal>
        </Menu.Sub>
      ) : null}
      {ops ? (
        <>
          <Row phone={phone} disabled={first} onSelect={() => ops.onMove(part.key, -1)}>
            {WORKSTREAM_HEAD_COPY.moveUp}
          </Row>
          <Row phone={phone} disabled={last} onSelect={() => ops.onMove(part.key, 1)}>
            {WORKSTREAM_HEAD_COPY.moveDown}
          </Row>
          <Menu.Separator style={{ height: 1, margin: "4px 0", background: t.hairline }} />
          <Menu.Item onSelect={remove} data-tone="danger" style={{ ...menuItem(true, phone), color: t.breakage }}>
            {WORKSTREAM_HEAD_COPY.remove}
          </Menu.Item>
        </>
      ) : null}
    </>
  );
}

export function WorkstreamHead(props: WorkstreamHeadProps) {
  const { part, phone, first, last, controls, onToggle, ops, onColour } = props;
  const drop = useNestWorkstream(part.key);
  const drag = useNestWorkstreamDrag(part.key);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [removing, setRemoving] = useState(false);
  const head = useRef<HTMLDivElement | null>(null);
  const registered = usePartRef(refTo({ kind: "workstream", id: part.key }));
  const maker = Boolean(ops);
  const handleShown = phone || hovered || focused || drag.held;
  const setRefs = bothRefs<HTMLDivElement>((element) => {
    head.current = element;
    drop.setRef(element);
    drag.setRef(element);
  }, registered);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!maker || !event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    if (event.target instanceof HTMLInputElement && event.target.getAttribute("data-testid") !== "workstream-name") return;
    event.preventDefault();
    const by = event.key === "ArrowUp" ? -1 : 1;
    if ((by === -1 && first) || (by === 1 && last)) return;
    ops?.onMove(part.key, by);
  };
  const openColour = () => head.current && onColour?.(head.current);

  return (
    <>
      <div
        ref={setRefs}
        role="group"
        aria-label={part.label}
        data-testid="workstream-head"
        data-workstream-key={part.key}
        tabIndex={-1}
        data-takes={drop.takes ? "true" : undefined}
        data-collapsed={part.collapsed ? "true" : undefined}
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
        {drop.overForPart ? <span data-testid="workstream-drop-line" aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: -6, height: 2, background: t.text2 }} /> : null}
        {maker ? (
          <span style={{ visibility: handleShown ? "visible" : "hidden", display: "inline-flex" }}>
            <DragHandle label={`Move ${part.label}`} nest={drag} testId="workstream-drag-handle" />
          </span>
        ) : null}
        <span data-testid="workstream-label" style={{ ...text(14, 500, part.nameColour), whiteSpace: "nowrap" }}>
          {part.label}
          {part.name || maker ? " ·" : ""}
        </span>
        {maker ? (
          <NameField part={part} phone={phone} onSave={(name) => ops?.onName(part.key, name)} />
        ) : part.name ? (
          <span data-testid="workstream-name-text" style={{ ...text(14, 500, part.nameColour), minWidth: 0, flex: "1 1 120px", overflowWrap: "anywhere" }}>
            {part.name}
          </span>
        ) : (
          <span style={{ flex: "1 1 0", minWidth: 0 }} />
        )}
        <span data-testid="workstream-count" style={quiet}>
          {WORKSTREAM_HEAD_COPY.count(part.sessions)}
        </span>
        {/* CA-19 P5: a part in a named group says so, just before its menu. */}
        <MemberLabel to={refTo({ kind: "workstream", id: part.key })} />
        {part.colour && onColour && maker && !phone ? <ColourButton what={part.label} colour={part.colour} size={22} onPick={() => openColour()} /> : null}
        {maker ? (
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton icon={MoreHorizontal} glyph="more" boxed={false} data-hit="" label={`${part.label} options`} size={30} />
            </Menu.Trigger>
            <Menu.Portal>
              <MenuContent align="end" sideOffset={4} style={menuSurface()}>
                <PartMenuRows props={props} colour={onColour ? openColour : undefined} remove={() => setRemoving(true)} />
              </MenuContent>
            </Menu.Portal>
          </Menu.Root>
        ) : null}
        <IconButton
          icon={ChevronRight}
          glyph={part.collapsed ? "chev" : "chevd"}
          boxed={false}
          size={30}
          data-hit=""
          label={`${part.collapsed ? "Expand" : "Collapse"} ${part.label}`}
          aria-expanded={!part.collapsed}
          aria-controls={controls}
          onClick={onToggle}
        />
      </div>
      {part.startsAfterLine ? (
        <p data-testid="workstream-starts" style={{ ...text(12.5, 400, t.label), ...(maker ? WORKSTREAM_STARTS : { margin: 0 }) }}>
          {WORKSTREAM_HEAD_COPY.startsLine(part.startsAfterLine)}
        </p>
      ) : null}
      <RemoveDialog
        open={removing}
        part={part}
        joins={props.joins}
        phone={phone}
        onClose={() => setRemoving(false)}
        onConfirm={() => {
          setRemoving(false);
          ops?.onRemove(part.key);
        }}
      />
    </>
  );
}

export default WorkstreamHead;
