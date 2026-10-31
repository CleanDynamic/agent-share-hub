/* UI-P93 — the composer's frame in the refined look, as `design/reference/refined/{dusk,noon}/composer-list.html`
   draws it: the title row, then Sources, Build and Details.

   UI-P99: THIS WAS THE REFINED FORK. The current view it forked is deleted and this took its name; what follows was written when both existed, so "the current look" below means the look that has been retired. `SandboxView` stays the current look; this takes its props (imported, not copied), keeps the
   same slots (`sources`, `list`, `map`, `selection`), the same Add menu (its wiring is `addEntries`, shared), the same
   Card (drawn by `SandboxCard`, UI-P94), the same order of parts and the same accessible names. The page and
   the dev page choose with `useLook()`, and hand this the refined forks of the panels.

   THE TITLE ROW, under a hairline: the draft's title 20/500 and its status line 12.5 `--text2`; List / Map; Card and Preview (secondary 30) and Publish (primary
   30), the view's one primary. THE COLUMNS, a wrapping row with gap 24: Sources on the surface with a hairline on its
   right (`flex: 1 1 216px`, max 232), Build (`flex: 999 1 480px`), Details as a module (`flex: 1 1 280px`, max 300).
   A phone keeps today's order: the title, the Build panel with Sources and Details behind two buttons, and the action
   bar.

   PT-05: THE POST SITS ABOVE THE BUILD, as X's composer sits above a timeline: the `post` slot (the thread written as
   one page) heads the Build column, above the first prompt, with a hairline under it. There are no tabs: the post and
   the build are one page. The Card's Cover is one line and a button that comes here, scrolling to the post and putting
   the caret in it.

   MAP (UI-P94, `refined/{dusk,noon}/composer-map.html`). Sources folds to its rail as today, drawn as a module 52
   wide (padding `8px 0`): ghost 40-wide buttons, 36 high, 44 with a count under the glyph (10.5/500, tabular),
   between `--hairline-module` dividers 28 wide. Build becomes a module (`flex: 999 1 560px`) holding its head, the
   Map's legend, the map well and its footer line. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { MoreHorizontal, X } from "lucide-react";
import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { ErrorState } from "@/components/brand/ErrorState";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { MenuButton } from "@/components/brand/MenuButton";
import { Segmented } from "@/components/brand/Segmented";
import { BottomSheet as BrandBottomSheet, SheetRow, closeNow } from "@/components/brand/BottomSheet";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { HEADER_HEIGHT } from "@/components/shell/chromeSize";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { TITLE_LINE, fullText } from "@/lib/theme/truncate";
import { useInteractive } from "@/lib/theme/interactive";
import { controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";

import { FindButton, FindField } from "./FindField";
import { SaveLine } from "./SaveLine";
import type { BuildFind } from "./useBuildFind";
import { isUntitled, UNTITLED, type PublishKey, type SaveState } from "./composeModel";
import { SandboxCard } from "./SandboxCard";
import type { CardField } from "./SandboxCard";
import { MAP_AND_PANEL, MAP_COLUMN } from "./mapRecipes";
import { BUILD_HEAD, TAB_ACTIONS, TAB_GROUP, TAB_ROW, tabStyle } from "./tabRowRecipes";
import { ClickToEdit, DetailsOverlay, useTouchPanel } from "./DetailsOverlay";
import { DetailsAside, useWindowSize } from "./DetailsAside";
import type { DetailsPlan } from "./DetailsPanel";
import { COMPOSER_PAD, HEAD_GAP, OVERLAY_WIDTH } from "./detailsRecipes";
import { ORIGIN, frameOf, innerWidthOf } from "./detailsLayout";
import { bareButton, menuItem, menuSurface, moduleStyle, text, tnum } from "./refinedStyles";
import type { PartLabels } from "@/lib/build/making";
import type { ComposePublished, ComposeStatus } from "./ComposeView";
import { type CardProps } from "./SandboxCard";
import { MenuContent, MenuSubContent } from "./ComposeMenu";
import { ACTION_BAR_BOTTOM } from "./composeChrome";
import { BuildTitleActions } from "./BuildTitleActions";
import { PublishChecklist } from "./PublishChecklist";
import { PublishConfirm } from "./PublishConfirm";
import { PUBLISHED_COPY, PublishedOptions } from "./PublishedMenu";
import { outlineOnce } from "./buildMotion";
import { confirmRows, publishedWords, type Checklist, type ChecklistItem, type ConfirmInput, type ConfirmRow } from "@/lib/build/publishChecklist";
import { REASONS } from "@/lib/build/componentMenus";
import { useReason } from "./removePieces";
import type { SaveFailure } from "@/hooks/useComposeBuild";
import { useLensMorph } from "./mapMorph";
import { ComposeArrival } from "./ComposeSkeleton";
import { PanelBoundary, type PanelName } from "./PanelBoundary";
import { EmptyBuild, type EmptyBuildProps } from "./EmptyBuild";
import { scrollBehavior } from "@/lib/theme/motion";

export type SandboxLens = "list" | "map";

/** CA-24 P3: a panel whose own query has failed (`failed`), and the refetch of that panel's queries alone. */
export interface PanelState {
  failed?: boolean;
  error?: unknown;
  onRetry?: () => void;
}

export interface SandboxMissingItem {
  /** CA-13 P18: "runtime-0" for a Decision or Runs when that stops Publish. */
  key: PublishKey | `runtime-${number}`;
  /** In plain words: "a cover picture or video". */
  label: string;
}

export interface SandboxCounts {
  sessions: number;
  prompts: number;
  files: number;
}

/** CA-25: what Publish asks first. */
export interface PublishPanel {
  checklist: Checklist;
  /** Runs when Publish is pressed, before anything opens: false stops it (offline). */
  prepare?: () => Promise<boolean>;
  /** What Confirm shows, read when it opens (the post's words are not state). */
  confirm: () => ConfirmInput;
  /** "Show" on the sessions with no app: choose them and scroll to the first. */
  onShowApps: (keys: readonly string[]) => void;
}

export interface SandboxViewProps extends CardProps {
  fit?: "board" | "content";
  status: ComposeStatus;
  onRetry: () => void;

  save: SaveState;
  onRetrySave: () => void;
  /** CA-23: when the last write landed, for "saved 2 min ago". */
  lastSavedAt?: Date | null;
  /** CA-23: writes waiting for a connection, for "offline · 3 changes pending". */
  pendingWrites?: number;
  /** CA-23: the strips at the top of the Build column (Offline; Changed in another tab). Absent or empty: none is drawn. */
  strips?: ReactNode;
  /** SV-07 P5: room at the foot of the Build column while the notice shows (its height and 16), so it never covers the last row. */
  noticeRoom?: number;
  /** CA-10: a save that stopped: its reason and code, for "Not saved: {reason}. Code {code}." */
  saveProblem?: SaveFailure | null;
  /** CA-10: why the build did not load: logged once, its code shown under "This build didn't load." */
  loadError?: unknown;
  missing: readonly SandboxMissingItem[];
  slug: string | null;
  published: ComposePublished | null;
  publishing: boolean;
  /** Writes the build live. With `publish` set, it runs once the checklist is clear and the maker has said Publish. */
  onPublish: () => void;
  /** CA-25: the Publish checklist. Absent, Publish runs `onPublish` at once. */
  publish?: PublishPanel;
  /** CA-25 P3: `published_at`, for "Published 2 days ago". */
  publishedAt?: string | null;
  /** CA-25 P3: takes the build back to a draft. "refused" is the database saying no (Unpublish… is then left out), "failed" a try that can be made again. Absent: no Unpublish… item. */
  onUnpublish?: () => Promise<"done" | "refused" | "failed">;

  counts: SandboxCounts;
  lens: SandboxLens;
  onLens: (lens: SandboxLens) => void;
  /** CONCEPT §5: two sessions or an agent. Until then the switch is not drawn. */
  mapAvailable: boolean;
  onUseResultPicture?: () => void;

  /**
   * Puts the cursor in the Build panel's add field: Add › Prompt. CA-10: it runs
   * inside the tap's own handler (so an iPhone raises the keyboard) and returns true once focus has moved, so the
   * menu does not take it back.
   */
  onAddPromptFocus?: () => boolean | void;

  /** CA-14 P5: the sessions Add can put a tile in, for the "Add to which session?" question. */
  addTargets?: AddTargets;
  /** CA-14 P6: the View menu's two switches. Absent: no View menu. */
  viewOptions?: ViewMenuProps;
  /** CA-27 P1: Find in build. Absent: no button and no field. */
  find?: BuildFind;
  /** CA-24 P3: each panel's own failure and how to ask again; a panel that throws while drawing is caught by its own boundary whatever is passed. */
  panels?: Partial<Record<PanelName, PanelState>>;
  /** CA-24 P2: the build has no sessions and no tiles: "Add your first session" stands in the Build column in place of the list and its add rows. */
  emptyBuild?: EmptyBuildProps | null;
  /** CA-14 P6: the session list, a row under the header (a menu on a phone). Absent: nothing is drawn. */
  sessionList?: ReactNode;
  /** CA-20 P3: the selection bar, sticky at the bottom of the Build column. Absent: nothing is drawn. */
  selectionBar?: ReactNode;
  /** CA-17 P4: the map's panel, beside the map in the Map view where Details was. */
  mapPanel?: ReactNode;
  /** Add › File: opens the page's file picker. Absent, the item stays disabled. */
  onAddFile?: () => void;

  /** Add › Tool and Add › Result: make the row and select it in Details. Absent, the item stays disabled. */
  onAddTool?: () => void;
  onAddResult?: () => void;

  /** Add › Agent or team: opens the Add dialog. Absent, the item stays disabled. */
  onAddAgent?: () => void;
  /** CA-13 P2: Add › Decision opens the decision dialog. Absent, the item stays disabled. */
  onAddDecision?: () => void;
  /** CA-13 P1: the `decision` node type is live. False: Add › Decision is disabled and says so. */
  decisionAvailable?: boolean;
  /** CA-15 P9: Add › System prompt, Add › Dataset and Add › GitHub repository open their dialogs. Absent, or while the node type is not live, the item stays disabled and says so. */
  onAddSystemPrompt?: () => void;
  onAddDataset?: () => void;
  onAddRepo?: () => void;
  /** CA-15 P9: the `system_prompt`, `dataset` and `repo` node types are live (active in the registry). */
  systemPromptAvailable?: boolean;
  datasetAvailable?: boolean;
  repoAvailable?: boolean;
  /** SV-18: Add › From Library opens the window of saved items that fit. Absent, the item stays disabled. */
  onAddFromLibrary?: () => void;
  /** SV-18: the pointer or focus is on Add › From Library: fetch the window's code and its reads. */
  onWarmLibrary?: () => void;
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


  /** PT-05: the post, drawn above the build. Absent, nothing is drawn there. */
  post?: ReactNode;
  /** A sentence for the status line while the thread's save is waiting: "Post 3 is over 1,000 characters". */
  threadNote?: string | null;

  /** The panels' insides (UI-P64 to UI-P66). Absent, each draws its empty state. */
  sources?: ReactNode;
  list?: ReactNode;
  map?: ReactNode;
  selection?: ReactNode;
  /** CA-18 P4: Details drawn for a plan (its columns, or a measuring copy). Absent: `selection`, in one column. */
  renderDetails?: (plan?: DetailsPlan) => ReactNode;
  /** CA-18 P5: the selected tile's key, and the way to its window: the overlay and the sheet open the window from a click on their content. */
  selectedKey?: string | null;
  onEditSelected?: () => void;
}

export type AddKey = "prompt" | "agent" | "decision" | "system_prompt" | "file" | "dataset" | "tool" | "repo" | "manual" | "code" | "check" | "result" | "library";

/**
 * CONCEPT §5's seven, in order, with their one line each, and Code after Manual step (CA-02 P7). `ready` is false
 * until the prompt that writes that kind has run: the item is listed but
 * disabled. UI-P76 turns the switch on only once they are all true.
 */
export const ADD_ITEMS: readonly { key: AddKey; name: string; line: string; ready: boolean }[] = [
  /* CA-12 P4: sessions are not in this menu: a session is a group of tiles, added with "+ Add a session" under the last one.
     CA-15: the twelve, with the terms the modals use. System prompt, Dataset and GitHub repository are ready only once their
     node type is live (`addEntries`). */
  { key: "prompt", name: "Prompt", line: "Message sent to a model", ready: true },
  { key: "agent", name: "Agent", line: "Single agent or multi-agent team", ready: true },
  { key: "decision", name: "Decision", line: "Structured answer from a model", ready: true },
  { key: "system_prompt", name: "System prompt", line: "Instructions for several prompts", ready: false },
  { key: "file", name: "File", line: "File the model read", ready: true },
  { key: "dataset", name: "Dataset", line: "Data for training, evaluation or retrieval", ready: false },
  { key: "tool", name: "Tool", line: "External app the model used", ready: true },
  { key: "repo", name: "GitHub repository", line: "Repository used in this build", ready: false },
  { key: "manual", name: "Manual step", line: "Work done outside AI", ready: true },
  { key: "code", name: "Code", line: "Source code written or run", ready: true },
  { key: "check", name: "Check", line: "Test of part of the build", ready: true },
  { key: "result", name: "Result", line: "Output the build produced", ready: true },
  /* SV-18: saved steps and sessions, copied in with their source. Listed after the twelve; it opens its own window. */
  { key: "library", name: "From Library", line: "Steps and collections you saved", ready: true },
];

/** CA-03 P5: the Add menu's own words. */
export const ADD_COPY = {
  /** Check, while the build has nothing a check could test. */
  checkFirst: "Add an agent or code first",
} as const;

/** CA-10: "Not saved: a value isn't allowed. Code 23514." (the code left out when there is none: a network failure). */
export function notSavedLine(problem: SaveFailure): string {
  return `Not saved: ${problem.reason}.${problem.code ? ` Code ${problem.code}.` : ""}`;
}

export const LIST_HINT = "Click a tile to see its details · double-click to read all";
/** CA-10 (CA-09 F12): a phone has no double-click and taps, not clicks. */
export const LIST_HINT_PHONE = "Tap a tile to see its details";
export const listHint = (phone: boolean) => (phone ? LIST_HINT_PHONE : LIST_HINT);

/** The columns start this far under the title row. */
const COLUMNS_TOP = 32;
export const DETAILS_EMPTY = "Select a prompt, session or file to see it here.";

/** "3 sessions · 12 prompts · 2 files", leaving out any zero. */
export function countsLine(counts: SandboxCounts): string {
  const parts: string[] = [];
  if (counts.sessions > 0) parts.push(`${counts.sessions} ${counts.sessions === 1 ? "session" : "sessions"}`);
  if (counts.prompts > 0) parts.push(`${counts.prompts} ${counts.prompts === 1 ? "prompt" : "prompts"}`);
  if (counts.files > 0) parts.push(`${counts.files} ${counts.files === 1 ? "file" : "files"}`);
  return parts.join(" · ");
}

export type AddMenuProps = Pick<SandboxViewProps, "onAddFile" | "onAddPromptFocus" | "onAddTool" | "onAddResult" | "onAddAgent" | "onAddDecision" | "decisionAvailable" | "onAddSystemPrompt" | "onAddDataset" | "onAddRepo" | "systemPromptAvailable" | "datasetAvailable" | "repoAvailable" | "onAddManual" | "onAddCode" | "onAddCheck" | "checkable" | "onAddFromLibrary" | "onWarmLibrary">;

/** One item of the Add menu, wired: what it calls, whether it is enabled. Shared with the refined fork (UI-P93). */
export interface AddEntry {
  key: AddKey;
  name: string;
  line: string;
  enabled: boolean;
  onSelect?: () => unknown;
  /** CA-10: the item moves focus elsewhere itself (Prompt): the menu must not hand it back to Add as it closes. */
  movesFocus?: boolean;
  /** SV-18: the pointer or focus is on the item. */
  onWarm?: () => void;
}

/** CA-13 P1: the line under Add › Decision while the database change is not live. */
export const DECISION_OFF_LINE = "Not available yet";

/** CA-15 P9: the line under Add › System prompt, Dataset or GitHub repository while its node type is not live. */
export const TILE_OFF_LINE = "Not available yet";

export function addEntries({ onAddFile, onAddPromptFocus, onAddTool, onAddResult, onAddAgent, onAddDecision, decisionAvailable = true, onAddSystemPrompt, onAddDataset, onAddRepo, systemPromptAvailable = false, datasetAvailable = false, repoAvailable = false, onAddManual, onAddCode, onAddCheck, checkable = false, onAddFromLibrary, onWarmLibrary }: AddMenuProps): AddEntry[] {
  return ADD_ITEMS.map((item) => {
    if (item.key === "system_prompt" || item.key === "dataset" || item.key === "repo") {
      const live = item.key === "system_prompt" ? systemPromptAvailable : item.key === "dataset" ? datasetAvailable : repoAvailable;
      const handler = item.key === "system_prompt" ? onAddSystemPrompt : item.key === "dataset" ? onAddDataset : onAddRepo;
      return { ...item, ready: live, line: live ? item.line : TILE_OFF_LINE, enabled: live && Boolean(handler), onSelect: handler };
    }
    if (item.key === "decision") {
      return { ...item, line: decisionAvailable ? item.line : DECISION_OFF_LINE, enabled: item.ready && decisionAvailable && Boolean(onAddDecision), onSelect: onAddDecision };
    }
    if (item.key === "check") {
      // Listed always; offered once the build has an agent, a team or code to check.
      return { ...item, line: checkable ? item.line : ADD_COPY.checkFirst, enabled: item.ready && checkable && Boolean(onAddCheck), onSelect: onAddCheck };
    }
    const handlers: Partial<Record<AddKey, (() => unknown) | undefined>> = {
      file: onAddFile,
      prompt: onAddPromptFocus,
      tool: onAddTool,
      result: onAddResult,
      agent: onAddAgent,
      manual: onAddManual,
      code: onAddCode,
      library: onAddFromLibrary,
    };
    const handler = handlers[item.key];
    const wired = item.key in handlers;
    return { ...item, enabled: item.ready && (!wired || Boolean(handler)), onSelect: handler, movesFocus: item.key === "prompt", ...(item.key === "library" ? { onWarm: onWarmLibrary } : null) };
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

/** CA-14 P5: where a new tile goes. With two or more sessions, every Add item first asks "Add to which session?". */
export interface AddTargets {
  sessions?: readonly { key: string; label: string }[];
  /** The session last added to: chosen by default, so a tap or Enter goes straight on. */
  session?: string | null;
  /** Called, in the same tap, with the session chosen, just before the item runs. */
  onSession?: (key: string) => void;
}

export const ADD_ASK_COPY = { title: "Add to which session?", row: "Add tile" } as const;

/** The small list that asks "Add to which session?": one row per session, the default under the cursor. */
function SessionAsk({ sessions, current, onPick, phone }: { sessions: readonly { key: string; label: string }[]; current: string | null; onPick: (key: string) => void; phone: boolean }) {
  const chosen = sessions.some((entry) => entry.key === current) ? current : (sessions[sessions.length - 1]?.key ?? null);
  return (
    <div role="radiogroup" aria-label={ADD_ASK_COPY.title} data-testid="add-ask" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {sessions.map((entry) => (
        <button
          key={entry.key}
          type="button"
          role="radio"
          aria-checked={entry.key === chosen}
          autoFocus={entry.key === chosen}
          onClick={() => onPick(entry.key)}
          style={{ ...menuItem(true, phone), ...bareButton, width: "100%", textAlign: "left", boxSizing: "border-box", gap: 8, ...(entry.key === chosen ? { background: t.selectedFill } : null) }}
        >
          <span style={{ width: 14, display: "inline-flex", flexShrink: 0 }}>{entry.key === chosen ? <Glyph name="check" size={14} /> : null}</span>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{entry.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * CA-10 (CA-09 F1, F2). On a computer, a dropdown that fits the screen (`MenuContent`, `menuSurface`) and is not
 * modal: a modal menu traps focus while it closes, so a row that puts the caret in a field would have it taken
 * straight back. A row that moves focus (Prompt) says so, and the menu then leaves focus where the row put it instead
 * of returning it to Add. On a phone, the same rows in a bottom sheet, 44pt each, under "Add".
 *
 * CA-14 P5: the same menu is the "+ Add tile" row at the end of a session (`variant: "row"`, `fixedSession`),
 * which already knows its session. The Add button at the top asks which session first when there are two or more
 * (`targets`): a small list on a computer, and the first screen of the sheet on a phone.
 */
export function AddMenu({ phone, targets, variant = "button", fixedSession, ...props }: AddMenuProps & { phone: boolean; targets?: AddTargets; variant?: "button" | "row"; fixedSession?: string }) {
  const [open, setOpen] = useState(false);
  /** The item waiting for its session to be chosen (computer). */
  const [asking, setAsking] = useState<AddEntry | null>(null);
  /** The sheet's first screen asks for the session; the second lists the items (phone). */
  const [picked, setPicked] = useState(false);
  /** Set by a row that moved focus, read once as the menu closes. */
  const moved = useRef(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const rowTrigger = useInteractive<HTMLButtonElement>();
  const askBox = useRef<HTMLDivElement>(null);
  const ask = variant === "button" && (targets?.sessions?.length ?? 0) > 1;
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
  /** Run an item for a session: the session first, in the same tap. */
  const run = (item: AddEntry, key?: string) => {
    const session = key ?? fixedSession;
    if (session) targets?.onSession?.(session);
    return item.onSelect?.();
  };

  const trigger = (
    variant === "row" ? (
      <button
        ref={addButton}
        type="button"
        data-testid="add-to-session"
        data-hit=""
        aria-haspopup={phone ? "dialog" : "menu"}
        aria-expanded={open}
        {...rowTrigger.handlers}
        onClick={phone ? () => setOpen(true) : undefined}
        style={{
          ...bareButton,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 8,
          width: "100%",
          height: 36,
          boxSizing: "border-box",
          padding: "0 8px",
          borderRadius: 6,
          ...text(13, 500, t.text2),
          cursor: "pointer",
          ...(rowTrigger.state.hovered ? { background: t.controlOn } : null),
          ...ring(rowTrigger.state.focusVisible),
        }}
      >
        <span aria-hidden="true" style={{ display: "inline-flex" }}>
          <Glyph name="plus" size={16} />
        </span>
        {ADD_ASK_COPY.row}
      </button>
    ) : (
      <MenuButton ref={addButton} label="Add" value="" data-testid="sandbox-add" {...(phone ? { "aria-haspopup": "dialog" as const, "aria-expanded": open, style: { height: 44 }, onClick: () => setOpen(true) } : null)} />
    )
  );

  if (phone) {
    const choose = (item: Pick<AddEntry, "onSelect" | "movesFocus">) => {
      if (!item.movesFocus) {
        // One render: the sheet shuts as the row's dialog or tile appears.
        setOpen(false);
        item.onSelect?.();
        return;
      }
      // A row that moves focus shuts the sheet first, in this tap, so its focus trap is gone before the focus moves.
      moved.current = true;
      closeNow(setOpen);
      if (item.onSelect?.() !== true) moved.current = false;
    };
    const askFirst = ask && !picked;
    return (
      <>
        {trigger}
        <BrandBottomSheet
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setPicked(false);
          }}
          title={askFirst ? ADD_ASK_COPY.title : variant === "row" ? ADD_ASK_COPY.row : "Add"}
          onCloseAutoFocus={backToAdd}
          data-testid="add-sheet"
        >
          {askFirst && targets?.sessions ? (
            <SessionAsk
              sessions={targets.sessions}
              current={targets.session ?? null}
              phone
              onPick={(key) => {
                targets.onSession?.(key);
                setPicked(true);
              }}
            />
          ) : (
            entries.map((item) => <SheetRow key={item.key} name={item.name} line={item.line} disabled={!item.enabled} onSelect={() => choose(item)} />)
          )}
        </BrandBottomSheet>
      </>
    );
  }

  const menu = (
    <Menu.Root open={open} onOpenChange={setOpen} modal={false}>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <MenuContent align={variant === "row" ? "start" : "end"} sideOffset={6} style={menuSurface(280)} onCloseAutoFocus={asking ? (event) => event.preventDefault() : backToAdd}>
          {entries.map((item) => {
            return (
              <Menu.Item
                key={item.key}
                disabled={!item.enabled}
                onPointerEnter={item.onWarm}
                onFocus={item.onWarm}
                onSelect={() => {
                  if (ask) {
                    setAsking(item);
                    return;
                  }
                  const result = run(item);
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
  if (!ask) return menu;
  return (
    <Popover.Root open={asking !== null} onOpenChange={(next) => !next && setAsking(null)}>
      <Popover.Anchor asChild>
        <span style={{ display: "inline-flex" }}>{menu}</span>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={16}
          aria-label={ADD_ASK_COPY.title}
          onOpenAutoFocus={(event) => {
            // The session last added to is under the cursor, so Enter goes straight on.
            event.preventDefault();
            askBox.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
          }}
          onCloseAutoFocus={backToAdd}
          style={{ ...menuSurface(300), zIndex: 52, padding: 4 }}
        >
          <p style={{ ...text(12, 500, t.text2), margin: 0, padding: "6px 12px 4px" }}>{ADD_ASK_COPY.title}</p>
          <div ref={askBox}>
          {targets?.sessions ? (
            <SessionAsk
              sessions={targets.sessions}
              current={targets.session ?? null}
              phone={false}
              onPick={(key) => {
                const item = asking;
                setAsking(null);
                if (!item) return;
                const result = run(item, key);
                if (item.movesFocus && result === true) moved.current = true;
              }}
            />
          ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ── View (CA-14 P6) ── */

export interface ViewMenuProps {
  sessionList: boolean;
  /** CA-20 P1: how many sessions the build has. The session list is greyed, with its reason, until it has two. Absent: always available. */
  sessionCount?: number;
  onChange: (patch: { sessionList?: boolean }) => void;
  /** CA-17 P2: "Label parts", 1, 2, 3 or A, B, C for the whole build. Present only when the build has two or more parts. */
  labels?: { value: PartLabels; onChange: (value: PartLabels) => void };
  /** CA-19 P7: "Colours…", the window of every reference group and single colour in the build. The maker's only. */
  onColours?: () => void;
  /** CA-20 P7: Collapse all, or Expand all once everything is folded. Absent: not drawn. */
  fold?: { anyOpen: boolean; run: (closed: boolean) => void };
}

export const VIEW_COPY = { button: "View", sessionList: "Session list", labelParts: "Label parts", numbers: "1, 2, 3", letters: "A, B, C", colours: "Colours…", collapseAll: "Collapse all", expandAll: "Expand all" } as const;

/** CA-17 P2: the "Label parts" row of the View menu. */
function LabelPartsRow({ labels, phone }: { labels: NonNullable<ViewMenuProps["labels"]>; phone: boolean }) {
  return (
    <div data-testid="label-parts" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: phone ? "8px 12px" : "6px 12px 4px" }}>
      <span style={text(13, 400, t.text)}>{VIEW_COPY.labelParts}</span>
      <Segmented
        label={VIEW_COPY.labelParts}
        size={phone ? 50 : 28}
        fontSize={12}
        value={labels.value}
        onChange={labels.onChange}
        items={[
          { value: "numbers", label: VIEW_COPY.numbers },
          { value: "letters", label: VIEW_COPY.letters },
        ]}
      />
    </div>
  );
}

/** CA-20 P1: the session list, as a row of the sheet on a phone: greyed, and saying why, until the build has two sessions. */
function SessionListSheetRow({ view }: { view: ViewMenuProps }) {
  const reason = sessionListReason(view);
  const why = useReason(reason);
  return (
    <>
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={view.sessionList}
        aria-disabled={reason ? true : undefined}
        onClick={() => !reason && view.onChange({ sessionList: !view.sessionList })}
        {...why.props}
        style={{ ...bareButton, ...menuItem(!reason, true), width: "100%", gap: 8, textAlign: "left" }}
      >
        <span style={{ width: 16, display: "inline-flex" }}>{view.sessionList ? <Glyph name="check" size={16} /> : null}</span>
        {VIEW_COPY.sessionList}
      </button>
      {why.note}
    </>
  );
}

/** CA-20 P1: the session list, as an item of the menu on a computer. */
function SessionListMenuRow({ view }: { view: ViewMenuProps }) {
  const reason = sessionListReason(view);
  const why = useReason(reason);
  return (
    <>
      <Menu.CheckboxItem checked={view.sessionList} disabled={Boolean(reason)} onCheckedChange={(next) => view.onChange({ sessionList: next })} onSelect={(event) => event.preventDefault()} style={{ ...menuItem(!reason, false), gap: 8 }} {...why.props}>
        <span style={{ width: 16, display: "inline-flex" }}>
          <Menu.ItemIndicator>
            <Glyph name="check" size={16} />
          </Menu.ItemIndicator>
        </span>
        {VIEW_COPY.sessionList}
      </Menu.CheckboxItem>
      {why.note}
    </>
  );
}

/** The reason the session list cannot be switched yet, or none. */
const sessionListReason = (view: ViewMenuProps): string | undefined => (view.sessionCount !== undefined && view.sessionCount < 2 ? REASONS.sessionList : undefined);

/**
 * "View", beside Add: the session list (kept for the maker on this device), then the rows of the parts, the colours and the
 * folds. On a computer a menu that stays open while the switch is changed; on a phone the same rows in a bottom sheet.
 */
function ViewMenu({ phone, view }: { phone: boolean; view: ViewMenuProps }) {
  const [open, setOpen] = useState(false);
  if (phone) {
    return (
      <>
        <MenuButton label={VIEW_COPY.button} value="" data-testid="sandbox-view" aria-haspopup="dialog" aria-expanded={open} style={{ height: 44 }} onClick={() => setOpen(true)} />
        <BrandBottomSheet open={open} onOpenChange={setOpen} title={VIEW_COPY.button} data-testid="view-sheet">
          <SessionListSheetRow view={view} />
          {view.labels ? <LabelPartsRow labels={view.labels} phone /> : null}
          {view.fold ? (
            <button
              type="button"
              role="menuitem"
              data-testid="view-fold"
              onClick={() => {
                setOpen(false);
                view.fold?.run(view.fold.anyOpen);
              }}
              style={{ ...bareButton, ...menuItem(true, true), width: "100%", gap: 8, textAlign: "left", borderTop: `1px solid ${t.hairline}` }}
            >
              <span style={{ width: 16, display: "inline-flex" }} />
              {view.fold.anyOpen ? VIEW_COPY.collapseAll : VIEW_COPY.expandAll}
            </button>
          ) : null}
          {view.onColours ? (
            <button
              type="button"
              role="menuitem"
              data-testid="view-colours"
              onClick={() => {
                setOpen(false);
                view.onColours?.();
              }}
              style={{ ...bareButton, ...menuItem(true, true), width: "100%", gap: 8, textAlign: "left", borderTop: `1px solid ${t.hairline}` }}
            >
              <span style={{ width: 16, display: "inline-flex" }} />
              {VIEW_COPY.colours}
            </button>
          ) : null}
        </BrandBottomSheet>
      </>
    );
  }
  return (
    <Menu.Root open={open} onOpenChange={setOpen} modal={false}>
      <Menu.Trigger asChild>
        <MenuButton label={VIEW_COPY.button} value="" data-testid="sandbox-view" />
      </Menu.Trigger>
      <Menu.Portal>
        <MenuContent align="end" sideOffset={6} style={menuSurface(220)}>
          <SessionListMenuRow view={view} />
          {view.labels ? <LabelPartsRow labels={view.labels} phone={false} /> : null}
          {view.fold ? (
            <>
              <Menu.Separator style={{ height: 1, margin: "4px 0", background: t.hairline }} />
              <Menu.Item data-testid="view-fold" onSelect={() => view.fold?.run(view.fold.anyOpen)} style={{ ...menuItem(true, false), gap: 8 }}>
                <span style={{ width: 16, display: "inline-flex" }} />
                {view.fold.anyOpen ? VIEW_COPY.collapseAll : VIEW_COPY.expandAll}
              </Menu.Item>
            </>
          ) : null}
          {view.onColours ? (
            <>
              <Menu.Separator style={{ height: 1, margin: "4px 0", background: t.hairline }} />
              <Menu.Item data-testid="view-colours" onSelect={() => view.onColours?.()} style={{ ...menuItem(true, false), gap: 8 }}>
                <span style={{ width: 16, display: "inline-flex" }} />
                {VIEW_COPY.colours}
              </Menu.Item>
            </>
          ) : null}
        </MenuContent>
      </Menu.Portal>
    </Menu.Root>
  );
}

/* ── pieces ── */

/** A link drawn as a secondary button, for Preview: 30 high (48 on a phone), the control recipe. */
function LinkButton({ to, phone, height, children }: { to: string | null; phone: boolean; height?: number; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  // CA-20 P1: greyed, and says why.
  const why = useReason(to ? undefined : REASONS.preview);
  const common: CSSProperties = {
    height: height ?? (phone ? 48 : 28),
    padding: phone ? "0 16px" : "0 12px",
    borderRadius: 6,
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    whiteSpace: "nowrap",
    flexShrink: 0,
    ...controlPaint(state),
    ...text(phone ? 13 : 12.5, 500, t.text),
  };
  if (!to) {
    return (
      <span aria-disabled="true" role="link" {...why.props} style={{ ...common, filter: t.dimFilter, cursor: "not-allowed" }}>
        {children}
        {why.note}
      </span>
    );
  }
  return (
    <Link to={to} {...handlers} style={{ ...common, ...ring(state.focusVisible) }}>
      {children}
    </Link>
  );
}

/** CA-27 P4: where the title row has no room for Card, Preview and Publish beside the title, Preview waits in this menu (28 square, "Build actions"); Publish stays. */
export const BUILD_ACTIONS = { label: "Build actions", preview: "Preview" } as const;

function BuildActionsMenu({ previewTo }: { previewTo: string | null }) {
  const navigate = useNavigate();
  const why = useReason(previewTo ? undefined : REASONS.preview);
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <IconButton icon={MoreHorizontal} glyph="more" label={BUILD_ACTIONS.label} size={28} data-testid="build-actions" data-hit="" />
      </Menu.Trigger>
      <Menu.Portal>
        <MenuContent align="end" sideOffset={6} style={menuSurface(160)}>
          <Menu.Item disabled={!previewTo} onSelect={() => previewTo && navigate(previewTo)} data-testid="build-actions-preview" style={menuItem(Boolean(previewTo), false)} {...why.props}>
            {BUILD_ACTIONS.preview}
          </Menu.Item>
          {why.note}
        </MenuContent>
      </Menu.Portal>
    </Menu.Root>
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
          : { flex: "0 0 216px", width: 216, boxSizing: "border-box", paddingRight: 24, borderRight: `1px solid ${t.hairline}` }),
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
      <span style={label}>Your sessions</span>
      <div style={{ minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: `1px dashed ${t.line}`, ...text(12.5, 400, t.text2) }}>
        Drop sessions or files
      </div>
    </>
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

/** CA-24 P1: while the build's first queries load, building blocks stand where the columns will; the content then takes their place. */
export function SandboxView(props: SandboxViewProps) {
  const loading = props.status === "loading";
  return <ComposeArrival loading={loading}>{loading ? null : <SandboxBody {...props} />}</ComposeArrival>;
}

function SandboxBody(props: SandboxViewProps) {
  const phone = useIsPhone();
  const win = useWindowSize();
  const touchPanel = useTouchPanel(win.width);
  const { status, published, save } = props;

  const [cardOpen, setCardOpen] = useState(false);
  const [cardField, setCardField] = useState<CardField | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  /** Map: the Sources rail has been opened out over the map. */
  const [railOpen, setRailOpen] = useState(false);
  /** CA-25: the Publish checklist is open; `latest` is what an action sees after a window has closed or an await has passed. */
  const [checklistOpen, setChecklistOpen] = useState(false);
  /** CA-25 P2: Confirm is open, with the rows it was opened on. */
  const [confirming, setConfirming] = useState<ConfirmRow[] | null>(null);
  /** CA-25 P3: the database refused to unpublish: the menu stops offering it. */
  const [unpublishRefused, setUnpublishRefused] = useState(false);
  const latest = useRef(props);
  latest.current = props;
  const buildRef = useRef<HTMLElement>(null);
  const postRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  /* CA-22 P7: List and Map morph into one another (a computer only; the hook does nothing where motion is off). */
  const morph = useLensMorph({ lens: props.lens, onLens: props.onLens, getRoot: useCallback(() => tabsRef.current?.parentElement ?? null, []) });

  if (status === "error") {
    return (
      <div style={moduleStyle()}>
        <ErrorState line="This build didn't load." panel="The composer" onRetry={props.onRetry} error={props.loadError} log="[Compose] build read failed" showCode />
      </div>
    );
  }
  if (status === "notFound") return <NotFound />;

  const untitled = isUntitled(props.title);
  const frame = frameOf(innerWidthOf(win.width));
  // Map is for desktop; a phone is always the list.
  const lens: SandboxLens = phone ? "list" : props.lens;
  /* CA-18b P5: the composer is one box. The title area, the banner and the Map's row are padded in from `frameOf`'s edges. */
  const padLeft = frame.boxLeft - ORIGIN;
  const padRight = win.width - ORIGIN - (lens === "map" ? frame.mapRight : frame.boxRight);

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
      section.scrollIntoView?.({ block: "start", behavior: scrollBehavior() });
      const editable = section.querySelector<HTMLElement>('[contenteditable="true"]');
      (editable ?? section).focus({ preventScroll: true });
    }, 0);
  };


  /* CA-25 P1: Publish opens the checklist while anything is open, else it publishes. Each action closes the window, then takes the
     maker to the thing: the page's own focus moves wait a tick so the window's own focus return does not take them back. */
  const pressPublish = async () => {
    const panel = latest.current.publish;
    if (!panel) return latest.current.onPublish();
    if (panel.prepare && !(await panel.prepare())) return;
    const checklist = latest.current.publish?.checklist;
    if (checklist?.needed) setChecklistOpen(true);
    else openConfirm();
  };
  /** Publish with nothing left to say (or Publish in the checklist) asks once more, in Confirm. */
  const openConfirm = () => {
    const panel = latest.current.publish;
    if (panel) setConfirming(confirmRows(panel.confirm()));
    else latest.current.onPublish();
  };
  const goTo = (item: ChecklistItem) => {
    const id = item.stepId;
    const target = id ? document.querySelector<HTMLElement>(`[data-tile-id="${id}"], [data-node-id="${id}"]`) : postRef.current;
    if (!target) return;
    target.scrollIntoView?.({ block: "center", behavior: scrollBehavior() });
    outlineOnce(target);
  };
  const onChecklistAction = (item: ChecklistItem) => {
    const run = () => {
      switch (item.action?.id) {
        case "add_cover":
          return openPost();
        case "add_title":
          return openCard("title");
        case "add_description":
          return openCard("summary");
        case "add_prompt":
          return void latest.current.onAddPromptFocus?.();
        case "go_to":
          return goTo(item);
        case "show_apps":
          return latest.current.publish?.onShowApps(item.sessions ?? []);
        case "open_card":
          return openCard(null);
      }
    };
    window.setTimeout(run, 0);
  };
  const checklistWindow = props.publish ? (
    <PublishChecklist open={checklistOpen} checklist={props.publish.checklist} onClose={() => setChecklistOpen(false)} onAction={onChecklistAction} onPublish={openConfirm} />
  ) : null;
  const confirmWindow = props.publish ? (
    <PublishConfirm open={confirming !== null} title={props.title.trim()} rows={confirming ?? []} onCancel={() => setConfirming(null)} onPublish={() => props.onPublish()} />
  ) : null;

  const statusLine = (
    <p data-testid="sandbox-status" style={{ ...text(12.5, 400, t.text2), margin: 0, overflowWrap: "anywhere" }}>
      {published ? publishedWords(props.publishedAt) : "Draft"}
      <SaveLine
        save={save}
        lastSavedAt={props.lastSavedAt}
        pending={props.pendingWrites}
        detail={props.saveProblem ? notSavedLine(props.saveProblem) : undefined}
        onRetry={props.onRetrySave}
        retryUnderline
        retryStyle={underlined}
      />
      {props.threadNote ? ` · ${props.threadNote}` : null}
      {/* CA-03 P8: what kind of build it is, once it has more than one step. */}
      {props.summary ? <span data-testid="sandbox-summary">{` · ${props.summary}`}</span> : null}
    </p>
  );

  const heading = (
    <h1
      data-testid="sandbox-heading"
      {...fullText(untitled ? null : props.title.trim())}
      style={{ ...text(20, 500, untitled ? t.text2 : t.text), margin: 0, letterSpacing: "-0.015em", ...TITLE_LINE }}
    >
      {untitled ? UNTITLED : props.title.trim()}
    </h1>
  );

  /* CA-25 P3: a published build has View live and its options where Preview and Publish were. */
  const unpublish = async () => {
    const result = await props.onUnpublish?.();
    if (result === "refused") setUnpublishRefused(true);
  };
  const publishedOptions = published ? (
    <PublishedOptions slug={published.slug} title={props.title.trim()} onUnpublish={() => void unpublish()} canUnpublish={Boolean(props.onUnpublish) && !unpublishRefused} />
  ) : null;
  const publishLabel = published ? "Published" : props.publishing ? "Publishing…" : "Publish";
  const publishDisabled = Boolean(published) || props.publishing;
  /* The board draws Publish at full strength whatever is still outstanding. */
  const previewTo = props.slug ? `/b2/${props.slug}` : null;

  /* CA-17 P6: List and Map are the tabs of the row across the top; Map shows only when there is a map to make (two or more sessions). */
  const tabs = (
    <div role="group" aria-label="Build view" data-testid="sandbox-tabs" style={TAB_GROUP}>
      {(props.mapAvailable && !phone ? (["list", "map"] as const) : (["list"] as const)).map((value) => (
        <button key={value} type="button" aria-pressed={props.lens === value} data-testid={`sandbox-tab-${value}`} onClick={() => morph.switchTo(value)} style={tabStyle(props.lens === value)}>
          {value === "list" ? "List" : "Map"}
        </button>
      ))}
    </div>
  );

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

  /* CA-24 P3: every panel stands in its own boundary, so one that fails alone leaves the others as they are. */
  const guard = (panel: PanelName, node: ReactNode) => (
    <PanelBoundary panel={panel} failed={props.panels?.[panel]?.failed} error={props.panels?.[panel]?.error} onRetry={props.panels?.[panel]?.onRetry}>
      {node}
    </PanelBoundary>
  );
  const detailsBody = guard("Details", props.selection ?? <p style={quiet}>{DETAILS_EMPTY}</p>);
  const sourcesBody = guard("Sources", props.sources ?? <DefaultSources />);
  const postNode = props.post ? guard("Post", props.post) : null;
  const mapNode = guard("Map", props.map ?? null);

  const addMenu = (
    <AddMenu
      phone={phone}
      targets={props.addTargets}
      onAddFile={props.onAddFile}
      onAddPromptFocus={props.onAddPromptFocus}
      onAddTool={props.onAddTool}
      onAddResult={props.onAddResult}
      onAddAgent={props.onAddAgent}
      onAddDecision={props.onAddDecision}
      decisionAvailable={props.decisionAvailable}
      onAddSystemPrompt={props.onAddSystemPrompt}
      onAddDataset={props.onAddDataset}
      onAddRepo={props.onAddRepo}
      systemPromptAvailable={props.systemPromptAvailable}
      datasetAvailable={props.datasetAvailable}
      repoAvailable={props.repoAvailable}
      onAddManual={props.onAddManual}
      onAddCode={props.onAddCode}
      onAddCheck={props.onAddCheck}
      checkable={props.checkable}
      onAddFromLibrary={props.onAddFromLibrary}
      onWarmLibrary={props.onWarmLibrary}
    />
  );
  const buildPanel = (
    <section
      ref={buildRef}
      id="build"
      aria-label="Build"
      tabIndex={-1}
      style={{
        outline: "none",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        data-testid="sandbox-build-head-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          /* With Find open the row is one line: the field gives way (300 down to 200) and then the counts, so View and Add stay where they are. */
          flexWrap: props.find?.open && !phone ? "nowrap" : "wrap",
          minWidth: 0,
          /* CA-27 P1: with Find open the row stays under the header, so the count and the buttons are in view while the page moves from match to match. */
          ...(props.find?.open ? { position: "sticky", top: HEADER_HEIGHT, zIndex: 6, background: t.surface, padding: "6px 0", margin: "-6px 0" } : null),
        }}
      >
        <PanelTitle>Build</PanelTitle>
        <span data-testid="sandbox-counts" style={{ ...text(12, 400, t.text2), ...tnum, flexGrow: 1, minWidth: 0, userSelect: "none", ...(props.find?.open && !phone ? TITLE_LINE : null) }}>
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
            {props.viewOptions ? <ViewMenu phone view={props.viewOptions} /> : null}
            {addMenu}
          </span>
        ) : null}
        {phone || !props.find?.open ? null : <FindField find={props.find} />}
        {phone || !props.find ? null : <FindButton find={props.find} />}
        {phone ? null : props.viewOptions ? <ViewMenu phone={false} view={props.viewOptions} /> : null}
        {phone ? null : addMenu}
      </div>
      {lens === "list" ? props.sessionList : null}
      {guard("Build", props.emptyBuild ? <EmptyBuild {...props.emptyBuild} /> : (props.list ?? <p style={{ ...text(12, 400, t.label), margin: 0 }}>{listHint(phone)}</p>))}
    </section>
  );

  /* PT-05: the post heads the Build column, above the first prompt, under nothing but its own hairline. Not while an
     agent or team is open in the Map: the trail is about that one part. */
  const postSection =
    postNode ? (
      <section
        ref={postRef}
        aria-label="Post"
        data-testid="sandbox-post"
        tabIndex={-1}
        style={{ outline: "none", minWidth: 0, paddingBottom: 16, borderBottom: `1px solid ${t.hairline}` }}
      >
        {postNode}
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
        ...(phone ? { flex: "999 1 480px" } : { flex: `0 1 ${frame.build}px`, width: frame.build }),
        ...(props.noticeRoom ? { paddingBottom: props.noticeRoom } : null),
      }}
    >
      {props.strips && !phone && lens !== "map" ? (
        /* CA-23: 8 under the title row: the columns start 32 below it, so the strips pull up by the difference. */
        <div style={{ marginTop: -(COLUMNS_TOP - 8) }}>{props.strips}</div>
      ) : null}
      {phone ? (
        postSection
      ) : (
        /* CA-18 P4: the post heads the Build column, 18 under the head's hairline and 18 above it. The title and its
           status line sit in the title row at the top of the page, as they did before this change. */
        <div data-testid="sandbox-build-head" style={{ ...BUILD_HEAD, gap: 0, paddingBottom: HEAD_GAP, borderBottom: `1px solid ${t.hairline}` }}>
          {postNode ? (
            <section ref={postRef} aria-label="Post" data-testid="sandbox-post" tabIndex={-1} style={{ outline: "none", minWidth: 0 }}>
              {postNode}
            </section>
          ) : null}
        </div>
      )}
      {buildPanel}
      {props.selectionBar}
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
          <BuildTitleActions phone />
        </div>
        {banner}
        {props.strips}
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
            Classification
          </Button>
          {published ? (
            <>
              <LinkButton to={`/b2/${published.slug}`} phone>
                {PUBLISHED_COPY.viewLive}
              </LinkButton>
              {publishedOptions}
            </>
          ) : (
            <>
              <LinkButton to={previewTo} phone>
                Preview
              </LinkButton>
              <div style={{ flexGrow: 1 }}>
                <Button size={48} fontSize={15} fullWidth disabled={publishDisabled} onClick={() => void pressPublish()}>
                  {publishLabel}
                </Button>
              </div>
            </>
          )}
        </div>
        <BottomSheet open={sourcesOpen} onOpenChange={setSourcesOpen} title="Sources">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{sourcesBody}</div>
        </BottomSheet>
        <BottomSheet open={detailsOpen} onOpenChange={setDetailsOpen} title="Details">
          <ClickToEdit onEdit={props.onEditSelected ? () => { setDetailsOpen(false); props.onEditSelected?.(); } : undefined} phone>
            {detailsBody}
          </ClickToEdit>
        </BottomSheet>
        {card}
        {checklistWindow}
        {confirmWindow}
      </div>
    );
  }

  /* CA-27 P4: on a tablet the composer box is 612 to 636 wide: Card, Preview and Publish would take the row from the title, so Preview goes into a menu. */
  const compactRow = !published && frame.boxRight - frame.boxLeft < 760;

  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {/* The title row: the title and its status line at the left, then List and Map (CA-17 P6), then the actions. The tabs
          and the actions keep CA-17's measures from the rule; the row grows to hold the title. */}
      <div data-testid="sandbox-tabrow" ref={tabsRef} style={{ ...TAB_ROW, height: "auto", minHeight: 44, gap: 16, padding: `10px ${padRight}px 0 ${padLeft}px`, flexWrap: compactRow ? "nowrap" : frame.boxRight - frame.boxLeft < 760 ? "wrap" : "nowrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, minWidth: 0, marginBottom: 12 }}>
          {heading}
          {statusLine}
        </div>
        {tabs}
        <div style={{ ...TAB_ACTIONS, marginLeft: "auto" }}>
          <BuildTitleActions />
          <Button variant="secondary" size={28} fontSize={12} aria-label="Classification" onClick={() => openCard(null)}>
            Classification
          </Button>
          {published ? (
            <>
              <LinkButton to={`/b2/${published.slug}`} phone={false} height={28}>
                {PUBLISHED_COPY.viewLive}
              </LinkButton>
              {publishedOptions}
            </>
          ) : (
            <>
              {compactRow ? (
                <BuildActionsMenu previewTo={previewTo} />
              ) : (
                <LinkButton to={previewTo} phone={false} height={28}>
                  Preview
                </LinkButton>
              )}
              <Button size={28} fontSize={12} disabled={publishDisabled} onClick={() => void pressPublish()}>
                {publishLabel}
              </Button>
            </>
          )}
        </div>
      </div>
      {banner ? <div style={{ padding: `16px ${padRight}px 0 ${padLeft}px` }}>{banner}</div> : null}
      {props.strips && lens === "map" ? <div style={{ padding: `8px ${padRight}px 0 ${padLeft}px` }}>{props.strips}</div> : null}
      {lens === "map" ? (
        <div
          data-testid="sandbox-columns"
          style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 24, padding: `${COLUMNS_TOP}px ${padRight}px 0 ${padLeft}px`, minWidth: 0 }}
        >
          <SourcesFrame rail titled={!props.sources} counts={props.counts} open={railOpen} onOpen={() => setRailOpen(true)} onClose={() => setRailOpen(false)}>
            {sourcesBody}
          </SourcesFrame>
          {/* CA-17 P4: Details is not shown in the Map view: the map column fills, then 48, then the map's panel, 312 wide. */}
          <div data-testid="map-view" style={MAP_AND_PANEL}>
            <div style={MAP_COLUMN}>{mapNode}</div>
            {props.mapPanel ? guard("Map", props.mapPanel) : null}
          </div>
        </div>
      ) : (
        /* CA-18b P2: the List's three columns stand where `frameOf` puts them, not in a row that lets one push another. Build
           is in the flow, centred on the window; Sources and Details are placed beside it from the surface's edge. */
        <div
          data-testid="sandbox-columns"
          style={{ position: "relative", display: "block", padding: `${COLUMNS_TOP}px ${COMPOSER_PAD}px 0`, minWidth: 0 }}
        >
          <div data-testid="sandbox-sources-slot" style={{ position: "absolute", top: COLUMNS_TOP, left: frame.sourcesLeft - ORIGIN, width: frame.sources, display: "flex", alignItems: "flex-start" }}>
            <SourcesFrame rail={frame.rail} titled={!props.sources} counts={props.counts} open={railOpen && frame.rail} onOpen={() => setRailOpen(true)} onClose={() => setRailOpen(false)}>
              {sourcesBody}
            </SourcesFrame>
          </div>
          <div style={{ marginLeft: frame.buildLeft - ORIGIN - COMPOSER_PAD }}>{buildColumn}</div>
          {frame.beside ? null : (
            /* CA-27 P4: Details where it does not fit beside the build is a panel over the composer box's right edge. */
            <DetailsOverlay selectedKey={props.selectedKey} left={frame.boxRight - ORIGIN - OVERLAY_WIDTH} touch={touchPanel} onEdit={props.onEditSelected}>
              {detailsBody}
            </DetailsOverlay>
          )}
          {frame.beside ? (
            <div data-testid="sandbox-details-slot" style={{ position: "absolute", top: COLUMNS_TOP, bottom: 0, left: frame.detailsLeft - ORIGIN, width: frame.detailsWidth, display: "flex", alignItems: "stretch" }}>
              <DetailsAside inner={innerWidthOf(win.width)} windowHeight={win.height} render={(plan) => (props.renderDetails ? guard("Details", props.renderDetails(plan)) : detailsBody)} />
            </div>
          ) : null}
        </div>
      )}
      {card}
      {checklistWindow}
      {confirmWindow}
    </div>
  );
}

export default SandboxView;
