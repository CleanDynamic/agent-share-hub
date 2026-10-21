/* UI-P93 — the composer's frame in the refined look, as `design/reference/refined/{dusk,noon}/composer-list.html`
   draws it: the title row, then Sources, Build and Details.

   UI-P99: THIS WAS THE REFINED FORK. The current view it forked is deleted and this took its name; what follows was written when both existed, so "the current look" below means the look that has been retired. `SandboxView` stays the current look; this takes its props (imported, not copied), keeps the
   same slots (`sources`, `list`, `map`, `selection`), the same Add menu (its wiring is `addEntries`, shared), the same
   Card (drawn by `SandboxCard`, UI-P94), the same order of parts and the same accessible names. The page and
   the dev page choose with `useLook()`, and hand this the refined forks of the panels.

   THE TITLE ROW, under a hairline: the draft's title 20/500 and its status line 12.5 `--text2` with the missing part
   underlined; List / Map with "Map is now available" under it; Card and Preview (secondary 30) and Publish (primary
   30), the view's one primary. THE COLUMNS, a wrapping row with gap 24: Sources on the surface with a hairline on its
   right (`flex: 1 1 216px`, max 232), Build (`flex: 999 1 480px`), Details as a module (`flex: 1 1 280px`, max 300).
   A phone keeps today's order: the title, the Build panel with Sources and Details behind two buttons, and the action
   bar.

   PT-05: THE POST SITS ABOVE THE BUILD, as X's composer sits above a timeline: the `post` slot (the thread written as
   one page) heads the Build column, above the first prompt, with a hairline under it. There are no tabs: the post and
   the build are one page. The Card's Cover is one line and a button that comes here; "a cover picture or video" in
   Missing does too, scrolling to the post and putting the caret in it.

   MAP (UI-P94, `refined/{dusk,noon}/composer-map.html`). Sources folds to its rail as today, drawn as a module 52
   wide (padding `8px 0`): ghost 40-wide buttons, 36 high, 44 with a count under the glyph (10.5/500, tabular),
   between `--hairline-module` dividers 28 wide. Build becomes a module (`flex: 999 1 560px`) holding its head, the
   Map's legend, the map well and its footer line. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { X } from "lucide-react";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { ErrorState } from "@/components/brand/ErrorState";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { MenuButton } from "@/components/brand/MenuButton";
import { Segmented } from "@/components/brand/Segmented";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { BottomSheet as BrandBottomSheet, SheetRow, closeNow } from "@/components/brand/BottomSheet";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";

import { TextButton } from "./composeControls";
import { isUntitled, SAVE_WORDS, UNTITLED, type PublishKey, type SaveState } from "./composeModel";
import { SandboxCard } from "./SandboxCard";
import type { CardField } from "./SandboxCard";
import { bareButton, menuItem, menuSurface, moduleStyle, text, tnum } from "./refinedStyles";
import type { ComposePublished, ComposeStatus } from "./ComposeView";
import { type CardProps } from "./SandboxCard";
import { MenuContent, MenuSubContent } from "./ComposeMenu";
import { ACTION_BAR_BOTTOM } from "./composeChrome";

export type SandboxLens = "list" | "map";

export interface SandboxMissingItem {
  key: PublishKey;
  /** In plain words: "a cover picture or video". */
  label: string;
}

export interface SandboxCounts {
  sessions: number;
  prompts: number;
  files: number;
}

export interface SandboxViewProps extends CardProps {
  fit?: "board" | "content";
  status: ComposeStatus;
  onRetry: () => void;

  save: SaveState;
  onRetrySave: () => void;
  missing: readonly SandboxMissingItem[];
  slug: string | null;
  published: ComposePublished | null;
  publishing: boolean;
  onPublish: () => void;

  counts: SandboxCounts;
  lens: SandboxLens;
  onLens: (lens: SandboxLens) => void;
  /** CONCEPT §5: two sessions or an agent. Until then the switch is not drawn. */
  mapAvailable: boolean;
  /** "Map is now available", until the maker has switched once. */
  mapHint: boolean;
  onUseResultPicture?: () => void;

  /**
   * Puts the cursor in the Build panel's add field: Add › Prompt, and the "a prompt" missing item. CA-10: it runs
   * inside the tap's own handler (so an iPhone raises the keyboard) and returns true once focus has moved, so the
   * menu does not take it back.
   */
  onAddPromptFocus?: () => boolean | void;

  /** CA-04 P1: Add › New session asks for its tool. Absent, the item stays disabled. */
  onNewSession?: () => void;
  /** Add › File: opens the page's file picker. Absent, the item stays disabled. */
  onAddFile?: () => void;
  /** Add › Session: the library's sessions that are in no build. Absent, the item stays disabled. */
  addableSessions?: readonly { id: string; label: string; line: string }[];
  onAddSession?: (id: string) => void;

  /** Add › Tool and Add › Result: make the row and select it in Details. Absent, the item stays disabled. */
  onAddTool?: () => void;
  onAddResult?: () => void;

  /** Add › Agent or team: opens the Add dialog. Absent, the item stays disabled. */
  onAddAgent?: () => void;
  /** Add › Manual step: opens the Add dialog. Absent, the item stays disabled. */
  onAddManual?: () => void;
  /** CA-02 P7: Add › Code opens the code dialog. Absent, the item stays disabled. */
  onAddCode?: () => void;
  /** CA-03 P5: Add › Check opens the check dialog. Absent, or with nothing yet to check, the item stays disabled. */
  onAddCheck?: () => void;
  /** CA-03 P5: the build has an agent, a team or code: something a check can test. */
  checkable?: boolean;
  /** CA-03 P8: one line that says what kind of build it is, for the status line. Absent until it has more than one step. */
  summary?: string;

  /** UI-P69: the agents and teams opened in the Map, outermost first. Empty: the build itself. */
  trail?: readonly { id: string; title: string }[];
  /** Go up to `depth` levels open: 0 is the build, 1 the first of the trail. */
  onTrail?: (depth: number) => void;

  /** PT-05: the post, drawn above the build. Absent, nothing is drawn there. */
  post?: ReactNode;
  /** A sentence for the status line while the thread's save is waiting: "Post 3 is over 1,000 characters". */
  threadNote?: string | null;

  /** The panels' insides (UI-P64 to UI-P66). Absent, each draws its empty state. */
  sources?: ReactNode;
  list?: ReactNode;
  map?: ReactNode;
  selection?: ReactNode;
}

export type AddKey = "newSession" | "prompt" | "session" | "agent" | "file" | "tool" | "manual" | "code" | "check" | "result";

/**
 * CONCEPT §5's seven, in order, with their one line each, and Code after Manual step (CA-02 P7). `ready` is false
 * until the prompt that writes that kind has run: the item is listed but
 * disabled. UI-P76 turns the switch on only once they are all true.
 */
export const ADD_ITEMS: readonly { key: AddKey; name: string; line: string; ready: boolean }[] = [
  /* CA-04 P1: first, because what is added next goes into it. */
  { key: "newSession", name: "New session", line: "One sitting with one tool", ready: true },
  { key: "prompt", name: "Prompt", line: "A message you sent", ready: true },
  { key: "session", name: "Session", line: "A chat from your sources", ready: true },
  { key: "agent", name: "Agent or team", line: "Prompts that run by themselves", ready: true },
  { key: "file", name: "File", line: "Something the AI read", ready: true },
  { key: "tool", name: "Tool", line: "An app or connector it used", ready: true },
  { key: "manual", name: "Manual step", line: "Work done outside AI", ready: true },
  { key: "code", name: "Code", line: "Lines of code you wrote or ran", ready: true },
  { key: "check", name: "Check", line: "How it tested its own work", ready: true },
  { key: "result", name: "Result", line: "The finished thing", ready: true },
];

/** CA-03 P5: the Add menu's own words. */
export const ADD_COPY = {
  /** Check, while the build has nothing a check could test. */
  checkFirst: "Add an agent or code first",
} as const;

export const LIST_HINT = "Click a prompt to see its details · double-click to read all of it";
/** CA-10 (CA-09 F12): a phone has no double-click and taps, not clicks. */
export const LIST_HINT_PHONE = "Tap a prompt to see its details";
export const listHint = (phone: boolean) => (phone ? LIST_HINT_PHONE : LIST_HINT);

export const DETAILS_EMPTY = "Select a prompt, session or file to see it here.";

/** "3 sessions · 12 prompts · 2 files", leaving out any zero. */
export function countsLine(counts: SandboxCounts): string {
  const parts: string[] = [];
  if (counts.sessions > 0) parts.push(`${counts.sessions} ${counts.sessions === 1 ? "session" : "sessions"}`);
  if (counts.prompts > 0) parts.push(`${counts.prompts} ${counts.prompts === 1 ? "prompt" : "prompts"}`);
  if (counts.files > 0) parts.push(`${counts.files} ${counts.files === 1 ? "file" : "files"}`);
  return parts.join(" · ");
}

export type AddMenuProps = Pick<SandboxViewProps, "onNewSession" | "onAddFile" | "addableSessions" | "onAddSession" | "onAddPromptFocus" | "onAddTool" | "onAddResult" | "onAddAgent" | "onAddManual" | "onAddCode" | "onAddCheck" | "checkable">;

/** One item of the Add menu, wired: what it calls, whether it is enabled. Session carries its submenu's rows. Shared with the refined fork (UI-P93). */
export interface AddEntry {
  key: AddKey;
  name: string;
  line: string;
  enabled: boolean;
  onSelect?: () => unknown;
  /** Session only: the library's sessions that are in no build, at most six. */
  sessions?: readonly { id: string; label: string; line: string; onSelect: () => void }[];
  /** CA-10: the item moves focus elsewhere itself (Prompt): the menu must not hand it back to Add as it closes. */
  movesFocus?: boolean;
}

export function addEntries({ onNewSession, onAddFile, addableSessions, onAddSession, onAddPromptFocus, onAddTool, onAddResult, onAddAgent, onAddManual, onAddCode, onAddCheck, checkable = false }: AddMenuProps): AddEntry[] {
  return ADD_ITEMS.map((item) => {
    if (item.key === "check") {
      // Listed always; offered once the build has an agent, a team or code to check.
      return { ...item, line: checkable ? item.line : ADD_COPY.checkFirst, enabled: item.ready && checkable && Boolean(onAddCheck), onSelect: onAddCheck };
    }
    if (item.key === "session") {
      return {
        ...item,
        enabled: item.ready && Boolean(onAddSession),
        sessions: (addableSessions ?? []).slice(0, 6).map((session) => ({ ...session, onSelect: () => onAddSession?.(session.id) })),
      };
    }
    const handlers: Partial<Record<AddKey, (() => unknown) | undefined>> = {
      newSession: onNewSession,
      file: onAddFile,
      prompt: onAddPromptFocus,
      tool: onAddTool,
      result: onAddResult,
      agent: onAddAgent,
      manual: onAddManual,
      code: onAddCode,
    };
    const handler = handlers[item.key];
    const wired = item.key in handlers;
    return { ...item, enabled: item.ready && (!wired || Boolean(handler)), onSelect: handler, movesFocus: item.key === "prompt" };
  });
}

/* ── the Add menu ── */

function AddLabel({ name, line }: { name: string; line: string }) {
  return (
    <>
      <span style={text(13, 500, t.text)}>{name}</span>
      <span style={text(11.5, 400, t.label)}>{line}</span>
    </>
  );
}

const addItem = (enabled: boolean): CSSProperties => ({
  ...menuItem(enabled, false),
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  gap: 2,
  minHeight: 44,
  padding: "6px 12px",
});

/**
 * CA-10 (CA-09 F1, F2). On a computer, a dropdown that fits the screen (`MenuContent`, `menuSurface`) and is not
 * modal: a modal menu traps focus while it closes, so a row that puts the caret in a field would have it taken
 * straight back. A row that moves focus (Prompt) says so, and the menu then leaves focus where the row put it instead
 * of returning it to Add. On a phone, the same rows in a bottom sheet, 44pt each, under "Add".
 */
function AddMenu({ phone, ...props }: AddMenuProps & { phone: boolean }) {
  const [open, setOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  /** Set by a row that moved focus, read once as the menu closes. */
  const moved = useRef(false);
  const addButton = useRef<HTMLButtonElement>(null);
  /* As the menu or sheet closes: focus stays where a row put it, or goes back to Add WITHOUT SCROLLING, so a row that
     scrolled the page to what it added (Result, Session) is not undone. A tap does not focus a button on an iPhone,
     so Add is named, not "whatever had focus before". */
  const backToAdd = (event: Event) => {
    event.preventDefault();
    if (moved.current) {
      moved.current = false;
      return;
    }
    addButton.current?.focus({ preventScroll: true });
  };
  const entries = addEntries(props);

  if (phone) {
    const choose = (item: Pick<AddEntry, "onSelect" | "movesFocus">) => {
      if (item.movesFocus) moved.current = true;
      // Shut first, in this tap, so the sheet's focus trap is gone before the row moves focus.
      closeNow(setOpen);
      const result = item.onSelect?.();
      if (item.movesFocus && result !== true) moved.current = false;
    };
    return (
      <>
        <MenuButton
          ref={addButton}
          label="Add"
          value=""
          data-testid="sandbox-add"
          aria-haspopup="dialog"
          aria-expanded={open}
          style={{ height: 44 }}
          onClick={() => {
            setSessionsOpen(false);
            setOpen(true);
          }}
        />
        <BrandBottomSheet open={open} onOpenChange={setOpen} title="Add" onCloseAutoFocus={backToAdd} data-testid="add-sheet">
          {entries.map((item) =>
            item.sessions ? (
              <div key={item.key} style={{ display: "flex", flexDirection: "column" }}>
                <SheetRow name={item.name} line={item.line} disabled={!item.enabled} expanded={sessionsOpen} onSelect={() => setSessionsOpen((value) => !value)} />
                {sessionsOpen ? (
                  item.sessions.length === 0 ? (
                    <SheetRow inset disabled name="No sessions waiting" line="Every session is already in a build" />
                  ) : (
                    item.sessions.map((session) => <SheetRow key={session.id} inset name={session.label} line={session.line} onSelect={() => choose({ onSelect: session.onSelect })} />)
                  )
                ) : null}
              </div>
            ) : (
              <SheetRow key={item.key} name={item.name} line={item.line} disabled={!item.enabled} onSelect={() => choose(item)} />
            ),
          )}
        </BrandBottomSheet>
      </>
    );
  }

  return (
    <Menu.Root open={open} onOpenChange={setOpen} modal={false}>
      <Menu.Trigger asChild>
        <MenuButton ref={addButton} label="Add" value="" data-testid="sandbox-add" />
      </Menu.Trigger>
      <Menu.Portal>
        <MenuContent align="end" sideOffset={6} style={menuSurface(280)} onCloseAutoFocus={backToAdd}>
          {entries.map((item) => {
            if (item.sessions) {
              return (
                <Menu.Sub key={item.key}>
                  <Menu.SubTrigger disabled={!item.enabled} style={addItem(item.enabled)}>
                    <AddLabel name={item.name} line={item.line} />
                  </Menu.SubTrigger>
                  <Menu.Portal>
                    <MenuSubContent sideOffset={6} style={menuSurface(280)}>
                      {item.sessions.length === 0 ? (
                        <Menu.Item disabled style={addItem(false)}>
                          <AddLabel name="No sessions waiting" line="Every session is already in a build" />
                        </Menu.Item>
                      ) : (
                        item.sessions.map((session) => (
                          <Menu.Item key={session.id} onSelect={session.onSelect} style={addItem(true)}>
                            <AddLabel name={session.label} line={session.line} />
                          </Menu.Item>
                        ))
                      )}
                    </MenuSubContent>
                  </Menu.Portal>
                </Menu.Sub>
              );
            }
            return (
              <Menu.Item
                key={item.key}
                disabled={!item.enabled}
                onSelect={() => {
                  const result = item.onSelect?.();
                  if (item.movesFocus && result === true) moved.current = true;
                }}
                style={addItem(item.enabled)}
              >
                <AddLabel name={item.name} line={item.line} />
              </Menu.Item>
            );
          })}
        </MenuContent>
      </Menu.Portal>
    </Menu.Root>
  );
}

/* ── pieces ── */

/** A link drawn as a secondary button, for Preview: 30 high (48 on a phone), the control recipe. */
function LinkButton({ to, phone, children }: { to: string | null; phone: boolean; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const common: CSSProperties = {
    height: phone ? 48 : 30,
    padding: "0 16px",
    borderRadius: 6,
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    whiteSpace: "nowrap",
    flexShrink: 0,
    ...controlPaint(state),
    ...text(13, 500, t.text),
  };
  if (!to) {
    return (
      <span aria-disabled="true" style={{ ...common, filter: t.dimFilter, cursor: "not-allowed" }}>
        {children}
      </span>
    );
  }
  return (
    <Link to={to} {...handlers} style={{ ...common, ...ring(state.focusVisible) }}>
      {children}
    </Link>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ ...text(13.5, 500, t.text), margin: 0 }}>{children}</h2>;
}

const quiet: CSSProperties = { ...text(13, 400, t.text2), margin: 0 };

/** One 40-wide ghost button of the Sources rail (UI-P94): the glyph in `--text2`, 36 high, or 44 with its count under it. */
function RailButton({ glyph, label, count, onClick }: { glyph: "panel" | "layers" | "file" | "plus"; label: string; count?: number; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const counted = typeof count === "number";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      {...handlers}
      style={{
        ...bareButton,
        width: 40,
        height: counted ? 44 : 36,
        padding: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        borderRadius: 6,
        color: state.hovered ? t.text : t.text2,
        ...(state.hovered ? { background: t.controlOn } : null),
        ...ring(state.focusVisible),
      }}
    >
      <Glyph name={glyph} size={16} />
      {counted ? <span style={{ ...text(10.5, 500, "inherit"), ...tnum }}>{count}</span> : null}
    </button>
  );
}

/** Sources: the column on the surface; in Map, a 56 rail that opens the full column over the map's left side. */
function SourcesFrame({
  rail,
  titled,
  counts,
  open,
  onOpen,
  onClose,
  children,
}: {
  rail: boolean;
  titled: boolean;
  counts: SandboxViewProps["counts"];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const column = (overlay: boolean) => (
    <section
      aria-label="Sources"
      style={{
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        ...(overlay
          ? { ...moduleStyle(), background: t.window, borderColor: t.windowBorder, boxShadow: t.windowShadow }
          : { flex: "1 1 216px", maxWidth: 232, boxSizing: "border-box", paddingRight: 24, borderRight: `1px solid ${t.hairline}` }),
      }}
    >
      {titled || overlay ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {titled ? <PanelTitle>Sources</PanelTitle> : <span />}
          {overlay ? <IconButton icon={X} glyph="x" boxed={false} label="Close sources" size={26} onClick={onClose} /> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
  if (!rail) return column(false);
  const hairline: CSSProperties = { width: 28, height: 1, background: t.hairlineModule, margin: "4px 0" };
  return (
    <>
      <div
        data-testid="sources-rail"
        role="toolbar"
        aria-label="Sources"
        aria-orientation="vertical"
        style={{ ...moduleStyle(false, "8px 0"), flex: "0 0 52px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
      >
        <RailButton glyph="panel" label="Show sources" onClick={onOpen} />
        <span aria-hidden="true" style={hairline} />
        <RailButton glyph="layers" label="Sessions" count={counts.sessions} onClick={onOpen} />
        <RailButton glyph="file" label="Files" count={counts.files} onClick={onOpen} />
        <span aria-hidden="true" style={hairline} />
        <RailButton glyph="plus" label="Add a source" onClick={onOpen} />
      </div>
      {open ? (
        <div
          data-testid="sources-overlay"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onClose();
            }
          }}
          style={{ position: "absolute", left: 0, top: 0, width: 260, zIndex: 20 }}
        >
          {column(true)}
        </div>
      ) : null}
    </>
  );
}

function DefaultSources() {
  const label = text(12, 500, t.text2);
  return (
    <>
      <span style={label}>Sessions in this build</span>
      <span style={label}>Files in this build</span>
      <span style={label}>Not in a build</span>
      <div style={{ minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: `1px dashed ${t.line}`, ...text(12.5, 400, t.text2) }}>
        Drop sessions or files
      </div>
    </>
  );
}

function Skeletons({ phone }: { phone: boolean }) {
  return (
    <LoadingRegion what="the composer" announce>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 20, borderBottom: `1px solid ${t.hairline}` }}>
          <Skeleton width={phone ? "70%" : 280} height={22} radius={4} />
          <Skeleton width={phone ? "50%" : 220} height={13} radius={4} />
        </div>
        <div style={{ ...moduleStyle(), display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton width={120} height={14} />
          <Skeleton height={phone ? 180 : 320} radius={6} />
        </div>
      </div>
    </LoadingRegion>
  );
}

function NotFound() {
  return (
    <div style={{ ...moduleStyle(false, 24), maxWidth: 520, display: "flex", flexDirection: "column", gap: 8 }}>
      <h1 style={{ ...text(20, 500, t.text), margin: 0, letterSpacing: "-0.015em" }}>No build at this address</h1>
      <p style={{ ...text(13, 400, t.text2), margin: 0 }}>
        Nothing here, or nothing you can open. It may have been deleted, or it may be another creator's build.
      </p>
      <Link to="/compose/new" style={{ ...text(12.5, 500, t.text), textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: t.line, alignSelf: "flex-start" }}>
        Start a new build
      </Link>
    </div>
  );
}

const underlined: CSSProperties = { ...text(12.5, 400, t.text), textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: t.line };

/* ── the view ── */

export function SandboxView(props: SandboxViewProps) {
  const phone = useIsPhone();
  const { status, published, missing, save } = props;

  const [cardOpen, setCardOpen] = useState(false);
  const [cardField, setCardField] = useState<CardField | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  /** Map: the Sources rail has been opened out over the map. */
  const [railOpen, setRailOpen] = useState(false);
  const buildRef = useRef<HTMLElement>(null);
  const postRef = useRef<HTMLElement>(null);

  if (status === "loading") return <Skeletons phone={phone} />;
  if (status === "error") {
    return (
      <div style={moduleStyle()}>
        <ErrorState line="This build didn't load." panel="The composer" onRetry={props.onRetry} />
      </div>
    );
  }
  if (status === "notFound") return <NotFound />;

  const untitled = isUntitled(props.title);
  const needs = missing.length > 0 && !published;
  // Map is for desktop; a phone is always the list.
  const lens: SandboxLens = phone ? "list" : props.lens;

  const openCard = (field: CardField | null) => {
    setCardField(field);
    setCardOpen(true);
  };

  /* The Card's Cover is the first picture of the post now: both ways in lead to the post, with the caret in it. */
  const openPost = () => {
    setCardOpen(false);
    window.setTimeout(() => {
      const section = postRef.current;
      if (!section) return;
      section.scrollIntoView?.({ block: "start", behavior: "smooth" });
      const editable = section.querySelector<HTMLElement>('[contenteditable="true"]');
      (editable ?? section).focus({ preventScroll: true });
    }, 0);
  };

  const onMissing = (key: PublishKey) => {
    if (key === "evidence") return openPost();
    if (key === "title") return openCard("title");
    if (key === "outcome") return openCard("summary");
    // CA-10: the field is focused in this tap; the Build panel takes focus only when there is no field to give it to.
    if (props.onAddPromptFocus?.() === true) return;
    buildRef.current?.focus();
  };

  const statusLine = (
    <p data-testid="sandbox-status" style={{ ...text(12.5, 400, t.text2), margin: 0, overflowWrap: "anywhere" }}>
      {published ? "Published" : "Draft"}
      {save !== "idle" ? (
        <>
          {" · "}
          {SAVE_WORDS[save]}
          {save === "error" ? (
            <>
              {" "}
              <TextButton underline onClick={props.onRetrySave} style={underlined}>
                Try again
              </TextButton>
            </>
          ) : null}
        </>
      ) : null}
      {props.threadNote ? ` · ${props.threadNote}` : null}
      {/* CA-03 P8: what kind of build it is, once it has more than one step. */}
      {props.summary ? <span data-testid="sandbox-summary">{` · ${props.summary}`}</span> : null}
      {needs ? (
        <>
          {" · Missing: "}
          {missing.map((item, index) => (
            <span key={item.key}>
              {index > 0 ? ", " : null}
              <TextButton underline onClick={() => onMissing(item.key)} target={phone} style={underlined}>
                {item.label}
              </TextButton>
            </span>
          ))}
        </>
      ) : null}
    </p>
  );

  const heading = (
    <h1
      data-testid="sandbox-heading"
      style={{ ...text(20, 500, untitled ? t.text2 : t.text), margin: 0, letterSpacing: "-0.015em", overflowWrap: "anywhere" }}
    >
      {untitled ? UNTITLED : props.title.trim()}
    </h1>
  );

  const publishLabel = published ? "Published" : props.publishing ? "Publishing…" : "Publish";
  const publishDisabled = Boolean(published) || props.publishing;
  /* The board draws Publish at full strength beside the missing part: the status line says what is missing. */
  const previewTo = props.slug ? `/b2/${props.slug}` : null;

  const lensSwitch =
    props.mapAvailable && !phone ? (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <Segmented
          label="Build view"
          size={28}
          fontSize={12}
          value={props.lens}
          onChange={props.onLens}
          items={[
            { value: "list", label: "List" },
            { value: "map", label: "Map" },
          ]}
        />
        {props.mapHint ? <span style={text(11.5, 400, t.label)}>Map is now available</span> : null}
      </div>
    ) : null;

  const banner = published ? (
    <div
      role="status"
      data-testid="sandbox-published"
      style={{ padding: "8px 12px", borderRadius: 6, background: t.evidenceFill, ...text(12.5, 400, t.text), display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 4 }}
    >
      <span>Published. {published.inGallery ? "It is in the Gallery now." : `It will show in the Gallery once you ${published.shortfall}.`}</span>
      <Link to={`/b2/${published.slug}`} style={{ ...text(12.5, 500, t.text), textDecoration: "underline", textUnderlineOffset: 3 }}>
        See it
      </Link>
    </div>
  ) : null;

  const trail = lens === "map" ? (props.trail ?? []) : [];
  const detailsBody = props.selection ?? <p style={quiet}>{DETAILS_EMPTY}</p>;
  const sourcesBody = props.sources ?? <DefaultSources />;

  const addMenu = (
    <AddMenu
      phone={phone}
      onNewSession={props.onNewSession}
      onAddFile={props.onAddFile}
      addableSessions={props.addableSessions}
      onAddSession={props.onAddSession}
      onAddPromptFocus={props.onAddPromptFocus}
      onAddTool={props.onAddTool}
      onAddResult={props.onAddResult}
      onAddAgent={props.onAddAgent}
      onAddManual={props.onAddManual}
      onAddCode={props.onAddCode}
      onAddCheck={props.onAddCheck}
      checkable={props.checkable}
    />
  );
  const trailLink: CSSProperties = { ...bareButton, ...underlined, fontSize: 13.5, fontWeight: 500, color: t.text2 };
  const buildPanel = (
    <section
      ref={buildRef}
      aria-label="Build"
      tabIndex={-1}
      style={{
        outline: "none",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        /* UI-P94: in Map, Build is a module beside the rail. */
        ...(lens === "map" && !phone ? moduleStyle() : null),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
        {trail.length > 0 ? (
          <h2 data-testid="sandbox-trail" style={{ ...text(13.5, 500, t.text), margin: 0, display: "inline-flex", flexWrap: "wrap", alignItems: "baseline", gap: 6 }}>
            <button type="button" onClick={() => props.onTrail?.(0)} style={trailLink}>
              Build
            </button>
            {trail.map((entry, at) => (
              <span key={entry.id} style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                <span aria-hidden="true" style={{ color: t.label }}>
                  ›
                </span>
                {at < trail.length - 1 ? (
                  <button type="button" onClick={() => props.onTrail?.(at + 1)} style={trailLink}>
                    {entry.title}
                  </button>
                ) : (
                  <span aria-current="page">{entry.title}</span>
                )}
              </span>
            ))}
          </h2>
        ) : (
          <PanelTitle>Build</PanelTitle>
        )}
        <span data-testid="sandbox-counts" style={{ ...text(12, 400, t.text2), ...tnum, flexGrow: 1, minWidth: 0 }}>
          {countsLine(props.counts)}
        </span>
        {phone ? (
          /* A phone puts Sources, Details and Add on a line of their own under the title, at touch size. */
          <span style={{ flexBasis: "100%", display: "flex", gap: 8 }}>
            <Button variant="secondary" size={44} fontSize={13} onClick={() => setSourcesOpen(true)}>
              Sources
            </Button>
            <Button variant="secondary" size={44} fontSize={13} onClick={() => setDetailsOpen(true)}>
              Details
            </Button>
            <span style={{ flexGrow: 1 }} />
            {addMenu}
          </span>
        ) : null}
        {trail.length > 0 ? (
          <Button variant="secondary" size={28} fontSize={12} onClick={() => props.onTrail?.(trail.length - 1)}>
            Back to build
          </Button>
        ) : null}
        {phone ? null : addMenu}
      </div>
      {lens === "map" ? (props.map ?? null) : (props.list ?? <p style={{ ...text(12, 400, t.label), margin: 0 }}>{listHint(phone)}</p>)}
    </section>
  );

  /* PT-05: the post heads the Build column, above the first prompt, under nothing but its own hairline. Not while an
     agent or team is open in the Map: the trail is about that one part. */
  const postSection =
    props.post && trail.length === 0 ? (
      <section
        ref={postRef}
        aria-label="Post"
        data-testid="sandbox-post"
        tabIndex={-1}
        style={{ outline: "none", minWidth: 0, paddingBottom: 16, borderBottom: `1px solid ${t.hairline}` }}
      >
        {props.post}
      </section>
    ) : null;
  /* The column the post and the build share. */
  const buildColumn = (
    <div
      style={{
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        flex: lens === "map" && !phone ? "999 1 560px" : "999 1 480px",
      }}
    >
      {postSection}
      {buildPanel}
    </div>
  );

  const card = <SandboxCard {...props} phone={phone} open={cardOpen} onOpenChange={setCardOpen} field={cardField} onEditPost={openPost} />;

  if (phone) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingBottom: 16, borderBottom: `1px solid ${t.hairline}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, minWidth: 0 }}>
            {heading}
            {statusLine}
          </div>
        </div>
        {banner}
        {buildColumn}
        <div
          role="group"
          aria-label="Actions"
          style={{
            position: "sticky",
            bottom: `calc(${ACTION_BAR_BOTTOM}px + env(safe-area-inset-bottom))`,
            zIndex: 5,
            display: "flex",
            gap: 8,
            padding: 8,
            borderRadius: 12,
            background: t.window,
            border: `1px solid ${t.windowBorder}`,
            boxShadow: t.windowShadow,
            boxSizing: "border-box",
          }}
        >
          <Button variant="ghost" size={48} fontSize={14} onClick={() => openCard(null)}>
            Card
          </Button>
          <LinkButton to={previewTo} phone>
            Preview
          </LinkButton>
          <div style={{ flexGrow: 1 }}>
            <Button size={48} fontSize={15} fullWidth disabled={publishDisabled} onClick={props.onPublish}>
              {publishLabel}
            </Button>
          </div>
        </div>
        <BottomSheet open={sourcesOpen} onOpenChange={setSourcesOpen} title="Sources">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{sourcesBody}</div>
        </BottomSheet>
        <BottomSheet open={detailsOpen} onOpenChange={setDetailsOpen} title="Details">
          {detailsBody}
        </BottomSheet>
        {card}
      </div>
    );
  }

  const rail = lens === "map";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16, paddingBottom: 20, borderBottom: `1px solid ${t.hairline}` }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, minWidth: 0 }}>
          {heading}
          {statusLine}
        </div>
        {lensSwitch}
        <div style={{ display: "flex", gap: 8, alignSelf: "flex-start", paddingTop: 2 }}>
          <Button variant="secondary" size={32} fontSize={13} onClick={() => openCard(null)} style={{ height: 30 }}>
            Card
          </Button>
          <LinkButton to={previewTo} phone={false}>
            Preview
          </LinkButton>
          <Button size={32} fontSize={13} disabled={publishDisabled} onClick={props.onPublish} style={{ height: 30 }}>
            {publishLabel}
          </Button>
        </div>
      </div>
      {banner}
      <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <SourcesFrame rail={rail} titled={!props.sources} counts={props.counts} open={railOpen && rail} onOpen={() => setRailOpen(true)} onClose={() => setRailOpen(false)}>
          {sourcesBody}
        </SourcesFrame>
        {buildColumn}
        <section aria-label="Details" style={{ ...moduleStyle(), flex: "1 1 280px", maxWidth: 300, display: "flex", flexDirection: "column", gap: 16 }}>
          <PanelTitle>Details</PanelTitle>
          {detailsBody}
        </section>
      </div>
      {card}
    </div>
  );
}

export default SandboxView;
