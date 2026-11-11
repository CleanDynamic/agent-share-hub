/* UI-P93 — Sources in the refined look, as `design/reference/refined/{dusk,noon}/composer-list.html` draws them.

   UI-P99: THIS WAS THE REFINED FORK. The current view it forked is deleted and this took its name; what follows was written when both existed, so "the current look" below means the look that has been retired. `SourcesPanel` stays the current look; this takes its props (imported, not copied) and lists
   the same groups in the same order with the same accessible names: Sessions in this build (each a toggle and the
   row itself), Files in this build, Not in a build (each with Add session), then the drop zone.

   THE LOOK. Title 13.5/500 with the in-build count; each group a 6px square (hollow for Not in a build), its label
   12/500 `--text2` and its count; rows separated by `--hairline`. A session row leads with the `chev` glyph and the
   tool's real mark at 20; a file row with the `file` glyph; a waiting session with its mark, its name in `--text2`
   and the boxed 26 plus. The drop zone is 56 high, 1px dashed `--line`, radius 6. A selected row is the selected
   recipe, never a colour. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { ColourDot } from "@/components/brand/ColourButton";
import { Glyph } from "@/components/brand/Glyph";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { IconButton } from "@/components/brand/IconButton";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { LoadingBlocks } from "./LoadingBlocks";
import { PanelFailed } from "./PanelBoundary";
import { LIBRARY_MORE_WIDTH } from "./loadingBlocks";
import { stepLabel } from "@/lib/build/graph";
import { PLUS_OUT_MS, WORDS_IN_MS } from "@/lib/build/buildMotion";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { fade, prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { TextButton } from "./composeControls";
import type { AddToPart } from "./AddSessionRow";
import { MenuContent, MenuSubContent } from "./ComposeMenu";
import { MENU_COPY } from "@/lib/build/componentMenus";
import { RemoveRow } from "./removePieces";
import { useLeaving } from "./buildMotion";
import { MotionBoundary, NO_SLIDE, useListMotion } from "./listMotion";
import { DragHandle, useSourceDrag } from "./listNest";
import { holdsFolder, readDrop } from "./dropFolders";
import { SLIDE_ATTR } from "./flip";
import { scrollToShow } from "./pageScroll";
import { ToolMark } from "./refinedPieces";
import { fullText, PREVIEW } from "@/lib/theme/truncate";
import { bareButton, ellipsis, menuItem, menuSurface, text, tnum, wellField } from "./refinedStyles";
import { libraryName, middleCut, REMINDER_ROWS, REPEAT_COPY, type SourceFile, type SourceLibraryItem, type SourceReminder, type SourceSession, type SourceUnfinishedItem } from "./sourcesModel";

/** F63: a library row's name wraps to two lines (PREVIEW) before it is cut, so it may run longer than a file's. */
const LIBRARY_NAME_MAX = 60;

/** CONCEPT §7: at most this many rows in any list, then one "Show {n} more". */
export const GROUP_ROWS = 6;

export const SOURCES_COPY = {
  /** UX-02 P8: two groups: what the build holds (its sessions, then its files), and what can be added. */
  inBuild: "In this build",
  available: "Available to add",
  filter: "Filter sessions",
  noMatch: "No session matches.",
  addFiles: "Add files",
  dropLine: "Or drop files anywhere on the build.",
  /** SV-05 P6: the text button beside a file a tool in the build reads. */
  addFile: "Add",
  stillArriving: "Still arriving",
  didntFinish: "Didn't finish",
  inThisDraft: "In this build",
  addThisTo: "Add this session to",
  lastPart: ", chosen last",
  showMoreSessions: "Show more sessions",
  noSessions: "No sessions yet.",
  noFiles: "No files yet.",
  connect: "Connect a tool",
} as const;

export interface SourcesPanelProps {
  phone: boolean;
  fine: boolean;
  status: "loading" | "error" | "ready";
  onRetry: () => void;
  /** The library read's real error, for the log. */
  error?: unknown;
  sessions: readonly SourceSession[];
  files: readonly SourceFile[];
  library: readonly SourceLibraryItem[];
  /** CA-12: the library has another page, and whether it is being read. */
  libraryHasMore?: boolean;
  libraryLoadingMore?: boolean;
  onLibraryMore?: () => void;
  /** CA-12: imports still arriving, and ones that did not finish; each group is drawn only when it has something. */
  arriving?: readonly SourceUnfinishedItem[];
  didntFinish?: readonly SourceUnfinishedItem[];
  /** Setup files a coding tool in the build reads and the build does not have yet. */
  reminders?: readonly SourceReminder[];
  /** The selected session's key, or the selected step's id. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddSession: (id: string, part?: string) => void;
  /** SV-07 P3: the part a session was last added to, marked in "Add this session to". */
  lastPart?: string;
  /** CA-17 P3: the build's parts when it has two or more. "Add session" then asks which part first. */
  parts?: readonly AddToPart[];
  /** Files dropped on the zone; CA-04 P4: with where each sat when a folder was dropped. */
  onDropFiles: (files: File[], paths?: string[]) => void;
  /** Opens the page's file picker. */
  onPick: () => void;
  /** Where "Connect a tool" goes. */
  connectHref: string;
  /** CA-20 P2: "Remove file" in a file's menu. Absent: files have no menu. */
  onRemoveFile?: (id: string) => void;
  /** UX-02 P2: "Add to session" in a file's menu: the file as a File step tile at the end of that session. */
  onAddFileToSession?: (fileId: string, sessionKey: string) => void;
}

/* ── pieces ── */

/** UX-02 P3 Stage B: the List's own grip at a row's start, drawn while the row is hovered or holds focus, at once. The only drag start. */
function SourceGrip({ drag, label, phone, still = false }: { drag: ReturnType<typeof useSourceDrag>; label: string; phone: boolean; /** F52: a row that cannot move keeps the grip's room, so every row starts at one edge. */ still?: boolean }) {
  if (!drag.on) return null;
  if (still) return <span aria-hidden="true" data-testid="source-grip-room" style={{ width: GRIP_ROOM, flexShrink: 0 }} />;
  return <DragHandle label={label} nest={drag} testId="source-drag-handle" phone={phone} />;
}

/** F52: the grip's width (DragHandle's 18). */
const GRIP_ROOM = 18;

/** F51: every row's one trailing slot, the same width and place: "+", the tick, or a file's "…" menu. */
function TrailSlot({ phone, children }: { phone: boolean; children?: ReactNode }) {
  return (
    <span data-testid="source-trail" style={{ width: phone ? 44 : 30, minHeight: phone ? 44 : 26, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center" }}>
      {children}
    </span>
  );
}

/** F51: a row already in the build: a tick, named "In this build". */
function InBuildTick() {
  return (
    <span role="img" aria-label={SOURCES_COPY.inBuild} title={SOURCES_COPY.inBuild} data-testid="source-in-build" style={{ display: "inline-flex", color: t.label }}>
      <Glyph name="check" size={16} />
    </span>
  );
}

const rowLine: CSSProperties = { borderTop: `1px solid ${t.hairline}` };

/** A selected row: the selected recipe's fill and edge, drawn inside the row so the hairlines do not move. */
const selectedRow = (selected: boolean): CSSProperties =>
  selected ? { background: t.selectedFill, boxShadow: `inset 0 0 0 1px ${t.selectedEdge}`, borderRadius: 6 } : {};

function GroupHead({ name, count, hollow }: { name: string; count: number; hollow?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8 }}>
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          boxSizing: "border-box",
          borderRadius: 1,
          background: hollow ? "transparent" : t.text2,
          border: hollow ? `1px solid ${t.text2}` : "none",
          flexShrink: 0,
        }}
      />
      <h3 style={{ ...text(12, 500, t.text2), margin: 0, flexGrow: 1, minWidth: 0 }}>{name}</h3>
      <span style={{ ...text(11.5, 400, t.label), ...tnum }}>{count}</span>
    </div>
  );
}

/** The first six rows of a group, then one button that shows the rest. */
function Capped<T>({ rows, render, phone }: { rows: readonly T[]; render: (row: T) => ReactNode; phone: boolean }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, GROUP_ROWS);
  const hidden = rows.length - shown.length;
  return (
    <>
      {shown.map(render)}
      {hidden > 0 ? (
        <div style={{ ...rowLine, paddingTop: 8 }}>
          <TextButton onClick={() => setAll(true)} target={phone} style={text(12.5, 500, t.text2)}>
            Show {hidden} more
          </TextButton>
        </div>
      ) : null}
    </>
  );
}

function SelectButton({
  selected,
  onClick,
  minHeight,
  children,
  style,
}: {
  selected: boolean;
  onClick: () => void;
  minHeight: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      {...handlers}
      style={{
        ...bareButton,
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexGrow: 1,
        minWidth: 0,
        minHeight,
        boxSizing: "border-box",
        padding: "0 6px",
        borderRadius: 6,
        ...(state.hovered && !selected ? { background: t.controlOn } : null),
        ...selectedRow(selected),
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SessionRow({
  session,
  phone,
  selectedId,
  onSelect,
}: {
  session: SourceSession;
  phone: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasPrompts = session.prompts.length > 0;
  const toggle = useInteractive<HTMLButtonElement>();
  const drag = useSourceDrag("session", session.key);
  return (
    <div ref={drag.setRef} data-source-drag={drag.on ? drag.dragId : undefined} style={{ ...rowLine, padding: "6px 0" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <SourceGrip drag={drag} label={`Move Session ${session.number}`} phone={phone} />
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Close" : "Open"} session ${session.number}`}
          disabled={!hasPrompts}
          onClick={() => setOpen((value) => !value)}
          {...toggle.handlers}
          style={{
            ...bareButton,
            width: phone ? 44 : 20,
            height: phone ? 44 : 32,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: t.label,
            borderRadius: 4,
            cursor: hasPrompts ? "pointer" : "default",
            filter: hasPrompts ? undefined : t.dimFilter,
            flexShrink: 0,
            ...ring(toggle.state.focusVisible),
          }}
        >
          <span style={{ display: "inline-flex", transform: open ? "rotate(90deg)" : undefined }}>
            <Glyph name="chev" size={16} />
          </span>
        </button>
        <SelectButton selected={selectedId === session.key} onClick={() => onSelect(session.key)} minHeight={phone ? 44 : 40} style={{ alignItems: "flex-start", padding: "6px" }}>
          <ToolMark tool={session.tool} size={20} />
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span {...fullText(`Session ${session.number} · ${session.tool}`)} style={{ ...text(13, 500, t.text), ...PREVIEW }}>
              {/* CA-06 P4: a coloured session's 7px dot before its name. */}
              {session.colour ? <ColourDot colour={session.colour} size={7} style={{ marginRight: 6, verticalAlign: "middle" }} /> : null}
              Session {session.number} · {session.tool}
            </span>
            <span {...fullText(session.detail)} style={{ ...text(11.5, 400, t.label), ...ellipsis }}>{session.detail}</span>
          </span>
        </SelectButton>
        <TrailSlot phone={phone}>
          <InBuildTick />
        </TrailSlot>
      </div>
      {open ? (
        <div style={{ marginLeft: 22, display: "flex", flexDirection: "column", gap: 2, paddingTop: 4 }}>
          {session.prompts.map((prompt) => (
            <SelectButton key={prompt.id} selected={selectedId === prompt.id} onClick={() => onSelect(prompt.id)} minHeight={phone ? 44 : 30}>
              <span style={{ fontFamily: DM_MONO, fontSize: 10.5, color: t.label, ...tnum, flexShrink: 0 }}>{stepLabel(prompt.number)}</span>
              {/* F53: the number, then the prompt's first six words, cut at the end. */}
              <span {...fullText(prompt.words ?? prompt.title)} style={{ ...text(12.5, 400, t.text), ...ellipsis }}>{prompt.words ?? prompt.title}</span>
            </SelectButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FileRow({ file, phone, sessions, selected = false, onOpen, onAddToSession, onRemove, leaving = false }: { file: SourceFile; phone: boolean; selected?: boolean; sessions: readonly SourceSession[]; onOpen?: (id: string) => void; onAddToSession?: (id: string, sessionKey: string) => void; onRemove?: (id: string) => void; leaving?: boolean }) {
  const drag = useSourceDrag("file", file.id);
  const select = (id: string) => {
    onOpen?.(id);
    window.requestAnimationFrame(() => {
      const tile = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
      if (tile) scrollToShow(tile, { align: "nearest" });
    });
  };
  return (
    <div ref={drag.setRef} data-source-drag={drag.on ? drag.dragId : undefined} data-file-id={file.id} {...{ [SLIDE_ATTR]: `file:${file.id}` }} aria-hidden={leaving || undefined} style={{ ...(leaving ? { pointerEvents: "none" } : null), ...rowLine, display: "flex", alignItems: "flex-start", gap: 8, minHeight: phone ? 44 : undefined, padding: "12px 0", boxSizing: "border-box" }}>
      <SourceGrip drag={drag} label={`Move ${file.name}`} phone={phone} />
      {/* F7: the row is one button: a click selects the file and scrolls to its tile. A drag starts only from the grip at its start. */}
      <SelectButton selected={selected} onClick={() => select(file.id)} minHeight={phone ? 44 : 30} style={{ alignItems: "flex-start", textAlign: "left" }}>
        <span style={{ display: "inline-flex", color: t.label, flexShrink: 0 }}>
          <Glyph name="file" size={16} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flexGrow: 1 }}>
          {/* F63: a long name is cut in the middle, so its ending shows; all of it is in the title. */}
          <span title={file.name} style={{ ...text(13, 500, t.text), ...ellipsis }}>{middleCut(file.name)}</span>
          <span {...fullText(file.note)} style={{ ...text(11.5, 400, t.label), ...ellipsis }}>{file.note}</span>
        </span>
      </SelectButton>
      {/* CA-20 P2: a file's menu ends with Remove file, like every other component's. UX-02 P2: Open file and Add to session come first. */}
      <TrailSlot phone={phone}>
      {onRemove ? (
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton icon={MoreHorizontal} glyph="more" boxed={false} data-hit="" label={`${file.name} options`} size={30} />
          </Menu.Trigger>
          <Menu.Portal>
            <MenuContent align="end" sideOffset={4} style={menuSurface()}>
              {onOpen ? (
                <Menu.Item onSelect={() => onOpen(file.id)} style={menuItem(true, phone)}>
                  {MENU_COPY.openFile}
                </Menu.Item>
              ) : null}
              {onAddToSession && sessions.length > 0 ? (
                <Menu.Sub>
                  <Menu.SubTrigger style={{ ...menuItem(true, phone), justifyContent: "space-between", gap: 12 }}>
                    <span>{MENU_COPY.addToSession}</span>
                    <span aria-hidden="true" style={{ display: "inline-flex", color: t.label }}>
                      <Glyph name="chev" size={16} />
                    </span>
                  </Menu.SubTrigger>
                  <Menu.Portal>
                    <MenuSubContent sideOffset={4} style={menuSurface()}>
                      {/* Built as "Add this session to" builds its rows: one per session of the build, in order. */}
                      {sessions.map((session) => (
                        <Menu.Item key={session.key} onSelect={() => onAddToSession(file.id, session.key)} style={{ ...menuItem(true, phone), gap: 8 }}>
                          <span style={{ flexGrow: 1, minWidth: 0 }}>{`Session ${session.number} · ${session.tool}`}</span>
                        </Menu.Item>
                      ))}
                    </MenuSubContent>
                  </Menu.Portal>
                </Menu.Sub>
              ) : null}
              <RemoveRow label={MENU_COPY.removeFile} phone={phone} onSelect={() => onRemove(file.id)} />
            </MenuContent>
          </Menu.Portal>
        </Menu.Root>
      ) : null}
      </TrailSlot>
    </div>
  );
}

/**
 * "Claude Code reads CLAUDE.md · Add": quiet, with a text button that opens the file picker. SV-05 P6: the words wrap onto a
 * second line, between words, before a file name is cut; the button never wraps and never shrinks.
 */
function ReminderRow({ reminder, phone, onPick }: { reminder: SourceReminder; phone: boolean; onPick: () => void }) {
  return (
    <div style={{ ...rowLine, display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : undefined, padding: "8px 0", boxSizing: "border-box" }}>
      <span data-testid="reminder-line" style={{ ...text(12.5, 400, t.text2), flex: "1 1 auto", minWidth: 0, whiteSpace: "normal", overflowWrap: "normal", wordBreak: "normal" }}>
        {reminder.line}
      </span>
      <TextButton onClick={onPick} target={phone} aria-label={`Add ${reminder.file}`} style={{ ...text(12.5, 500, t.text), whiteSpace: "nowrap", flexShrink: 0 }}>
        {SOURCES_COPY.addFile}
      </TextButton>
    </div>
  );
}

/** CA-17 P3: "Add session" with two or more parts: a small menu, "Add this session to", one row for each part. */
function AddToMenu({ item, parts, phone, onAdd, lastPart }: { item: SourceLibraryItem; parts: readonly AddToPart[]; phone: boolean; onAdd: (id: string, part: string) => void; lastPart?: string }) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <IconButton icon={Plus} glyph="plus" label="Add session" size={26} disabled={item.adding} />
      </Menu.Trigger>
      <Menu.Portal>
        <MenuContent align="end" sideOffset={4} style={menuSurface()}>
          <Menu.Label style={{ ...text(11.5, 500, t.label), padding: "6px 12px 4px" }}>{SOURCES_COPY.addThisTo}</Menu.Label>
          {parts.map((part) => (
            <Menu.Item key={part.key} onSelect={() => onAdd(item.id, part.key)} data-last={part.key === lastPart || undefined} style={{ ...menuItem(true, phone), gap: 8 }}>
              <ColourDot colour={part.colour} />
              <span style={{ flexGrow: 1, minWidth: 0 }}>{part.title}</span>
              {/* SV-07 P3: the part a session was last added to, marked as the View menu marks its choices. */}
              {part.key === lastPart ? (
                <span style={{ display: "inline-flex" }}>
                  <span aria-hidden="true" style={{ display: "inline-flex" }}>
                    <Glyph name="check" size={16} />
                  </span>
                  <span style={VISUALLY_HIDDEN}>{SOURCES_COPY.lastPart}</span>
                </span>
              ) : null}
            </Menu.Item>
          ))}
        </MenuContent>
      </Menu.Portal>
    </Menu.Root>
  );
}

function LibraryRow({ item, phone, onAdd, parts, lastPart }: { item: SourceLibraryItem; phone: boolean; onAdd: (id: string, part?: string) => void; parts?: readonly AddToPart[]; lastPart?: string }) {
  const drag = useSourceDrag("session", item.id);
  const movable = drag.on && !item.inThisDraft && !item.adding;
  return (
    <div ref={drag.setRef} data-source-drag={movable ? drag.dragId : undefined} style={{ ...rowLine, display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : undefined, padding: "8px 0", boxSizing: "border-box" }}>
      <SourceGrip drag={drag} label={`Move ${libraryName(item)}`} phone={phone} still={!movable} />
      {/* SV-05 P3: the app's mark when the app is known; none when it is not. */}
      {item.appKnown ? <ToolMark tool={item.app} size={20} /> : <span aria-hidden="true" style={{ width: 20, flexShrink: 0 }} />}
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flexGrow: 1 }}>
        {/* UX-02 P8: a long name wraps to two lines before it is cut. */}
        <span title={libraryName(item)} style={{ ...text(13, 400, t.text2), ...PREVIEW }}>{middleCut(libraryName(item), LIBRARY_NAME_MAX)}</span>
        <span {...fullText(item.line)} style={{ ...text(11.5, 400, t.label), ...ellipsis }}>{item.line}</span>
        {item.alsoIn ? <span {...fullText(item.alsoIn)} style={{ ...text(11.5, 400, t.label), ...ellipsis }}>{item.alsoIn}</span> : null}
        {item.sameAs ? <span data-testid="same-prompts" style={{ ...text(11.5, 400, t.label), ...ellipsis }}>{REPEAT_COPY.sameAs(item.sameAs)}</span> : null}
      </span>
      <TrailSlot phone={phone}>
        {item.inThisDraft ? (
          <InBuildTick />
        ) : item.adding ? (
          <PlusToWords />
        ) : parts && parts.length >= 2 ? (
          <AddToMenu item={item} parts={parts} phone={phone} onAdd={onAdd} lastPart={lastPart} />
        ) : (
          <IconButton icon={Plus} glyph="plus" label="Add session" size={26} disabled={item.adding} onClick={() => onAdd(item.id)} />
        )}
      </TrailSlot>
    </div>
  );
}

/** CA-21 P7: the moment a session is pressed, its + is gone and "In this draft" stands there: the + fades out over 120 ms, the words fade in over 160. */
function PlusToWords() {
  const [on, setOn] = useState(prefersReducedMotion());
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOn(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <span data-testid="plus-to-words" style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "flex-end", flexShrink: 0 }}>
      <span aria-hidden="true" data-testid="plus-leaving" style={{ position: "absolute", right: 0, opacity: on ? 0 : 1, transition: fade(PLUS_OUT_MS), pointerEvents: "none" }}>
        <IconButton icon={Plus} glyph="plus" label="Add session" size={26} disabled />
      </span>
      {/* F51: the + gives way to the tick a row in the build shows. */}
      <span style={{ display: "inline-flex", opacity: on ? 1 : 0, transition: fade(WORDS_IN_MS) }}>
        <InBuildTick />
      </span>
    </span>
  );
}

/** CA-12: an import that is not a session yet; nothing to press. */
function UnfinishedRow({ item, phone }: { item: SourceUnfinishedItem; phone: boolean }) {
  return (
    <div style={{ ...rowLine, display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : undefined, padding: "8px 0", boxSizing: "border-box" }}>
      <ToolMark tool={item.label} size={20} />
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flexGrow: 1 }}>
        <span style={{ ...text(13, 400, t.text2), ...ellipsis }}>{item.label}</span>
        <span style={{ ...text(11.5, 400, t.label), overflowWrap: "anywhere" }}>{item.line}</span>
      </span>
    </div>
  );
}

/** UX-02 P8: the panel's foot: Add files opens the picker; on a computer, one line says a file can be dropped on the build too. */
function AddFiles({ fine, phone, onPick }: Pick<SourcesPanelProps, "fine" | "phone" | "onPick">) {
  return (
    <div data-testid="sources-add-files" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
      <TextButton onClick={onPick} target={phone} style={text(12.5, 500, t.text)}>
        {SOURCES_COPY.addFiles}
      </TextButton>
      {fine ? <p style={{ ...text(11.5, 400, t.label), margin: 0 }}>{SOURCES_COPY.dropLine}</p> : null}
    </div>
  );
}

/** UX-02 P8: Available to add, with a field that filters it once it holds more than a group's rows. */
function AvailableGroup({ props, phone }: { props: SourcesPanelProps; phone: boolean }) {
  const [query, setQuery] = useState("");
  const { library } = props;
  const wanted = query.trim().toLowerCase();
  const shown = wanted ? library.filter((item) => `${libraryName(item)} ${item.line}`.toLowerCase().includes(wanted)) : library;
  return (
    <section aria-label={SOURCES_COPY.available} {...{ [SLIDE_ATTR]: `sources:${SOURCES_COPY.available}` }} style={group}>
      <GroupHead name={SOURCES_COPY.available} count={library.length} hollow />
      {library.length > GROUP_ROWS ? (
        <input
          type="search"
          aria-label={SOURCES_COPY.filter}
          placeholder={SOURCES_COPY.filter}
          value={query}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          style={{ ...wellField, height: phone ? 44 : 32, padding: "0 10px", marginBottom: 8, ...text(phone ? 16 : 13, 400, t.text) }}
        />
      ) : null}
      {shown.length === 0 ? <p style={{ ...text(12.5, 400, t.label), margin: 0, padding: "8px 0" }}>{SOURCES_COPY.noMatch}</p> : null}
      <Capped key={wanted} rows={shown} phone={phone} render={(item) => <LibraryRow key={item.id} item={item} phone={phone} onAdd={props.onAddSession} parts={props.parts} lastPart={props.lastPart} />} />
      {props.libraryHasMore ? (
        <div style={{ ...rowLine, paddingTop: 8 }}>
          {props.libraryLoadingMore ? (
            <LoadingRegion what="more sessions" data-testid="library-more-loading">
              <LoadingBlocks kind="line" width={LIBRARY_MORE_WIDTH} />
            </LoadingRegion>
          ) : (
            <TextButton onClick={() => props.onLibraryMore?.()} target={phone} style={text(12.5, 500, t.text2)}>
              {SOURCES_COPY.showMoreSessions}
            </TextButton>
          )}
        </div>
      ) : null}
    </section>
  );
}

/* ── the panel ── */

const group: CSSProperties = { display: "flex", flexDirection: "column", minWidth: 0 };

/** UX-02 P8: the whole panel takes a drop of files (the dashed box is gone): files of the build, as before. */
function dropTarget(onDropFiles: SourcesPanelProps["onDropFiles"]) {
  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  return {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      // CA-04 P4: a folder is walked, so a skill's files keep their places.
      if (holdsFolder(event.dataTransfer)) {
        void readDrop(event.dataTransfer).then(({ files, paths }) => {
          if (files.length > 0) onDropFiles(files, paths);
        });
        return;
      }
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onDropFiles(files);
    },
  };
}

export function SourcesPanel(props: SourcesPanelProps) {
  const { phone, fine, status, sessions, library } = props;
  /* CA-22 P2: a removed file's row lifts out in place; then the rows below slide up (SV-06: through the animator, measured only
     in the commit that lets the row go). */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const motion = useListMotion(rootRef);
  const { items: files, leaving, releasing } = useLeaving(props.files, (file) => file.id, {
    find: (key) => rootRef.current?.querySelector<HTMLElement>(`[data-file-id="${key}"]`) ?? null,
    lifts: (keys) => motion.channel.peek(keys) !== null,
  });
  const reminders = (props.reminders ?? []).slice(0, REMINDER_ROWS);
  const inBuild = sessions.length + files.length;
  const empty = sessions.length === 0 && files.length === 0;

  if (status === "loading") {
    return (
      <LoadingRegion what="your sources" announce>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton width={120} height={13} />
          <Skeleton height={40} radius={6} />
          <Skeleton height={40} radius={6} />
        </div>
      </LoadingRegion>
    );
  }
  if (status === "error") return <PanelFailed panel="Sources" onRetry={props.onRetry} error={props.error} />;

  return (
    <MotionBoundary motion={motion} slide={NO_SLIDE} when={releasing}>
      <div ref={rootRef} data-testid="sources-panel" {...(fine ? dropTarget(props.onDropFiles) : null)} style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: phone ? "flex-end" : "flex-start", gap: 2, marginBottom: -8 }}>
          {/* On a phone the bottom sheet's own title is "Sources". */}
          {phone ? null : <h2 style={{ ...text(14, 500, t.text), margin: 0 }}>Sources</h2>}
          <span style={{ ...text(12, 400, t.label), ...tnum }}>{inBuild} in build</span>
        </div>

        {empty ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ ...text(13, 400, t.text), margin: 0 }}>{SOURCES_COPY.noSessions}</p>
            <Link to={props.connectHref} style={{ ...text(12.5, 500, t.text), textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: t.line }}>
              {SOURCES_COPY.connect}
            </Link>
            <p style={{ ...text(13, 400, t.text), margin: "6px 0 0" }}>{SOURCES_COPY.noFiles}</p>
          </div>
        ) : null}

        {sessions.length > 0 || files.length > 0 || reminders.length > 0 ? (
          <section aria-label={SOURCES_COPY.inBuild} {...{ [SLIDE_ATTR]: `sources:${SOURCES_COPY.inBuild}` }} style={group}>
            <GroupHead name={SOURCES_COPY.inBuild} count={inBuild} />
            <Capped
              rows={sessions}
              phone={phone}
              render={(session) => <SessionRow key={session.key} session={session} phone={phone} selectedId={props.selectedId} onSelect={props.onSelect} />}
            />
            <Capped rows={files} phone={phone} render={(file) => <FileRow key={file.id} file={file} phone={phone} sessions={sessions} selected={props.selectedId === file.id} onOpen={props.onSelect} onAddToSession={props.onAddFileToSession} onRemove={props.onRemoveFile} leaving={leaving.has(file.id)} />} />
            {reminders.map((reminder) => (
              <ReminderRow key={reminder.toolId} reminder={reminder} phone={phone} onPick={props.onPick} />
            ))}
          </section>
        ) : null}

        {library.length > 0 ? <AvailableGroup props={props} phone={phone} /> : null}

        {(props.arriving ?? []).length > 0 ? (
          <section aria-label={SOURCES_COPY.stillArriving} {...{ [SLIDE_ATTR]: `sources:${SOURCES_COPY.stillArriving}` }} style={group}>
            <GroupHead name={SOURCES_COPY.stillArriving} count={(props.arriving ?? []).length} hollow />
            <Capped rows={props.arriving ?? []} phone={phone} render={(item) => <UnfinishedRow key={item.id} item={item} phone={phone} />} />
          </section>
        ) : null}

        {(props.didntFinish ?? []).length > 0 ? (
          <section aria-label={SOURCES_COPY.didntFinish} {...{ [SLIDE_ATTR]: `sources:${SOURCES_COPY.didntFinish}` }} style={group}>
            <GroupHead name={SOURCES_COPY.didntFinish} count={(props.didntFinish ?? []).length} hollow />
            <Capped rows={props.didntFinish ?? []} phone={phone} render={(item) => <UnfinishedRow key={item.id} item={item} phone={phone} />} />
          </section>
        ) : null}

        <AddFiles fine={fine} phone={phone} onPick={props.onPick} />
      </div>
    </MotionBoundary>
  );
}

export default SourcesPanel;
