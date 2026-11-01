/* UI-P93 — the Build panel's List in the refined look, as `design/reference/refined/{dusk,noon}/composer-list.html`
   draws it.

   UI-P99: THIS WAS THE REFINED FORK. The current view it forked is deleted and this took its name; what follows was written when both existed, so "the current look" below means the look that has been retired. `BuildList` stays the current look; this takes its props (imported, not copied) and draws the
   same steps in the same order with the same accessible names, menus, keys and intentions: the hint, each step under
   its session's head, the result, then the field that adds a prompt.

   THE LOOK. A session's head is the tool's real mark at 20, the name 13/500, the meta 12 `--label` and a hairline
   filling the rest. A prompt is a module (padding 16, radius 8; the selection is the selected recipe): the number in
   a 24 control tile, the title 14/500 (`--text2` when it is the default), a ghost 26 `more`; the text 13.5/22 clamped
   to two lines and indented 36; then, indented 36, "Uses" with its 22-high reference chips, a suggestion as a dashed
   28-high chip with Accept (a 20-high control) and Dismiss (text), and on the right Show full prompt and the words.
   An agent is a module with "Agent ·" and its model's mark at 14, its run rule as a tag, and inside, on a
   `--hairline-module` edge, its instructions as a tile and "Add a prompt to this agent" dashed and text only. The
   add field is a module: a two-row well, the tool and model menu buttons and the boxed 28 `up`.

   CA-03 P3: how a step ran is one quiet line under it, led by a 7px `--label` dot ("On a schedule · Weekdays 07:30");
   "When I asked" is the normal case and shows nothing.

   CA-03 P4: a team's first agent is its lead. The team's eyebrow says what the lead ran in ("Team · led by an agent
   in Claude Code"); the lead's row is "Lead agent"; the others sit under "Handed work to", each "Agent · {name}".

   CA-03 P6: what an agent remembers is one quiet line under it, led by a 7px `--label` dot: "Remembers {memory}".

   CA-03 P7: an agent that can use a tool reading content it doesn't control has the warning module under it. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { ArrowUp, Link as JoinIcon, Unlink as SplitIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  type Ref,
  type RefObject,
  useLayoutEffect,
} from "react";

import { Button } from "@/components/brand/Button";
import { drawBranches } from "@/components/build/BranchRows";
import { LinkLines } from "@/components/build/LinkLines";
import { HelperChips, ShapeChip } from "@/components/build/RuntimeChips";
import { CostStrip, TileCostLines } from "@/components/build/CostLines";
import { callsOf } from "@/lib/build/decisionCopy";
import { definesOf } from "@/lib/build/agentCode";
import { PromptName, MANUAL_LEAN_LINES, DatasetTileBody, FileTileBody, ManualTileBody, OpenOnGitHub, ReplyBlock, RepoTileBody, ResultTileBody, SystemPromptTileBody, TILE_COPY, TileFooter, DecisionTileBody, RetrievalTileBody, ToolTileBody, triggerLine } from "@/components/build/tileBodies";
import { GlyphButton } from "./ModalFrame";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { SUMMARY_COPY } from "@/lib/build/summaryTurn";
import { ASKS_FOR_LABEL, originLine } from "@/lib/build/promptOrigin";
import { useAnnounce } from "./BuildAnnouncer";
import { PREVIEW } from "@/lib/theme/truncate";
import { SessionTiles, WINDOW_FROM, WindowedTile } from "./largeBuild";
import { FOUND_RING, FindHit, FindProvider, NO_FIND, type FindView } from "@/components/build/FindHit";
import { useItemRing, useRovingList } from "./buildFocus";
import { CodeLines } from "@/components/code/CodeLines";
import { CodePartLine } from "./CodePartLine";
import { bothRefs, usePartRef } from "@/components/build/partNav";
import { REF_COPY } from "@/components/post/RefLinks";
import { ColourButton } from "@/components/brand/ColourButton";
import { MemberLabel } from "./groupLabels";
import { REF_KIND } from "@/lib/build/postRefs";
import { borderFor, outlineFor } from "@/lib/theme/partColour";
import { refTo } from "@/lib/build/thread";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { MenuButton } from "@/components/brand/MenuButton";
import { Pill } from "@/components/brand/Pill";
import type { SessionGroup, Step } from "@/lib/build/graph";
import { footerFactsOf, resultTypeLine, typeLineOf } from "@/lib/build/tileLines";
import { checkHistoryLine, checkStatus, promptPlace, resultHolds, sentWithLabel, stepRunsLabel, stepTitle, TOOL_TYPE, withSentWith } from "@/lib/build/graph";
import { ChangedText } from "@/components/build/ChangedText";
import { copyTogether } from "@/lib/build/copyTogether";
import { codeInPrompt, SENT_WITH_COPY, type CodeSuggestion } from "@/lib/build/sentWithSuggest";
import { readsOutsideContent } from "@/lib/build/outsideContent";
import { markFor } from "@/lib/models/marks";
import { nextModelAfterToolChange } from "@/lib/tools/modelRules";
import { toolFor, toolName } from "@/lib/tools/registry";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { CONTROL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import {
  agentEyebrow,
  inputLabel,
  TEAM_COPY,
  teamEyebrow,
  madeIn,
  madeLine,
  stepModel,
  suggestionKey,
  type ListResult,
  isClamped,
  type ListSuggestion,
} from "./buildListModel";
import { TextButton } from "./composeControls";
import { CODE_COPY, firstLines, lineCount, looksLikeCode } from "./codeModel";
import { ManualThumb } from "./ManualThumb";
import { OutsideWarning } from "./OutsideWarning";
import { MODEL_CLEARED_MS, MODEL_PICKER_COPY, ModelPicker } from "./ModelPicker";
import { CHECK_COPY, DotLine, Quiet, ToolMark } from "./refinedPieces";
import { AgentRules, GateLine, JobLine, MentionText, TeamHead, TeamLinesContext, WaitsLine, mentionTeam } from "@/components/build/teamLines";
import { FOOT_LINK, LIST_BOX, MarkedName, listRow, NumberBadge, RESPONSE_WORD, RUN, SESSION_META, SmallCodeWell, TILE_EYEBROW, TILE_HEAD, TILE_INDENT, TILE_TEXT, TILE_TITLE, TileOptions, tileStyle as tileCard } from "./tileRecipes";

/** CA-15b: a tile's body and foot sit 34 in, under its title. */
const INDENT = TILE_INDENT;
import { AddPartRow, AddSessionRow, type AddSessionRowProps } from "./AddSessionRow";
import { WORKSTREAM_BODY, WORKSTREAM_FRAME, WORKSTREAM_GROUP } from "./workstreamRecipes";
import { FramePieces } from "./framePieces";
import { AskNextSessionRow } from "./AskNextSessionRow";
import { WORKSTREAM_HEAD_COPY, WorkstreamHead, type WorkstreamHeadView, type WorkstreamOps } from "./WorkstreamHead";
import { FLOATING_Z, ToolPicker } from "./ToolPicker";
import { DragHandle, NestList, TAKES, useNestTile, useTileNear } from "./listNest";
import { EmptyPlace, SkeletonLayer } from "./skeleton";
import { useBuildSorting, viewOf, type Commit } from "./useBuildSorting";
import { SLIDE_ATTR } from "./flip";
import { listRuns, type Run } from "./buildRuns";
import { useBuildDirector } from "./buildDirector";
import { foldShut, useFoldMotion } from "./foldMotion";
import { outlineOnce } from "./buildMotion";
import { FADE_AFTER_MS, FOLD } from "@/lib/build/buildMotion";
import { ListMotionContext, MotionBoundary, NO_SLIDE, useListMotion, type SlideOptions } from "./listMotion";
import { prefersReducedMotion } from "@/lib/theme/motion";
import { ArrivingBlock, useArrival, type Arriving } from "./arrival";
import { SESSION_HEAD_COPY, SessionHead, headName, type SessionOps } from "./SessionHead";
import { TOOL_PICKER_COPY, runsItself } from "./toolPickerModel";
import {
  bareButton,
  chipStyle,
  ellipsis,
  menuItem,
  menuSurface,
  moduleStyle,
  text,
  tileStyle,
  tnum,
  wellField,
} from "./refinedStyles";
import { NO_APP, REPEAT_COPY, repeatedTiles, type SourceSession } from "./sourcesModel";
import { MenuContent, MenuSubContent } from "./ComposeMenu";
import { MENU_COPY, REASONS, moveReason } from "@/lib/build/componentMenus";
import { canMove as canMoveIn, locate, moveBy, moveModelOf, type MoveModel, type MoveNames } from "@/lib/build/moveRules";
import { shortcutLabel, type ShortcutId } from "@/lib/build/shortcuts";
import { COUNT } from "./modalRecipes";
import { RemoveRow, useReason } from "./removePieces";
import { useBuildActionsContext } from "./useBuildActions";
import { useBuildSelectionContext } from "./useBuildSelection";

/** CA-10: how long the add field is ringed after Add › Prompt reaches it. */
export const ADD_FLASH_MS = 1200;

export const LIST_COPY = {
  hint: "Click a tile to see its details · double-click to read all",
  /** CA-10 (CA-09 F12): a phone has no double-click (the card's onDoubleClick is off there) and taps, not clicks. */
  hintPhone: "Tap a tile to see its details",
  placeholder: "Paste or type a prompt…",
  /** CA-15 P10: the one link in a prompt tile's footer. */
  openPrompt: "Open prompt",
  /** CA-03 P5: a check's eyebrow. */
  check: CHECK_COPY.eyebrow,
  /** CA-03 P6. */
  remembers: (memory: string) => `Remembers ${memory}`,
  /** CA-05 P9. */
  tidies: (how: string) => `Tidies its notes: ${how}`,
} as const;

export interface BuildListProps {
  phone: boolean;
  steps: readonly Step[];
  /** CA-13 P8: the build's sessions, for the totals and for which figures readers see. Absent: no totals strip. */
  costGroups?: readonly SessionGroup[];
  /** The divider that goes before a step, keyed by its number. */
  dividers: ReadonlyMap<string, SourceSession>;
  /** CA-12 P3: sessions that hold no tile yet (Session 1 of a new post), each drawn as its head, after the others. */
  emptySessions?: readonly SourceSession[];
  /** CA-12 P3: "Pick an app" on the head of a session made here that has none. The tool is an id or a typed name; null clears it. */
  onPickApp?: (sessionKey: string, tool: string | null) => void;
  /** File and tool names, by node id, for the input chips. */
  names: Readonly<Record<string, string>>;
  suggestions: readonly ListSuggestion[];
  /** Step ids that go into the result. */
  intoResult: ReadonlySet<string>;
  results: readonly ListResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** UI-P67's full prompt window. Absent: nothing opens and "Read all" is disabled. */
  onOpenPrompt?: (id: string) => void;
  /** CA-18: a double click on any other tile opens its own window, to change it. Absent: nothing opens. A phone has no double click. */
  onEditTile?: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onMove: (id: string, direction: -1 | 1) => Promise<unknown> | void;
  onRemove: (id: string) => void;
  onAccept: (suggestion: ListSuggestion) => void;
  onDismiss: (suggestion: ListSuggestion) => void;
  /** Resolves true once the prompt is saved, so the field can clear. */
  onAddPrompt: (input: { text: string; tool: string | null; model: string | null }) => Promise<boolean>;
  /** CA-02 P4: "Add as an agent" opens the agent dialog. Resolves true once the agent is saved, so the field can clear. */
  onAddAsAgent?: (input: AddAsAgentInput) => Promise<boolean>;
  /** CA-02 P7: "Keep it as code" opens the code dialog with the field's text. Resolves true once the code is saved, so the field can clear. */
  onKeepAsCode?: (text: string) => Promise<boolean>;
  /** The tools the build already uses, first in the tool picker. */
  inBuild?: readonly string[];
  /**
   * CA-10 (CA-09 F2): the add field itself, so Add › Prompt can focus it inside the tap that chose it (a counter read
   * by an effect focused it a render later, and the closing menu took it back).
   */
  addPromptRef?: Ref<HTMLTextAreaElement>;
  /** Changes each time the add field is reached from Add › Prompt: it is ringed for `ADD_FLASH_MS`. */
  addPromptFlash?: number;
  /**
   * CA-10: Add › Result is writing (on a new post, making the draft first): a tile stands in at the end of the list,
   * where the new one lands, saying so, at once. (A session is added from its own row, which says "Adding…".)
   */
  pendingAdd?: PendingAdd | null;
  /** CA-10: the tile just added, ringed once as the build page rings a `#node-` step. */
  ringedId?: string | null;
  /** UI-P69: "Add a prompt to this agent". Resolves true once it is saved. */
  onAddAgentPrompt: (agentId: string, text: string) => Promise<boolean>;
  /** UI-P69: "Add an agent to this team". */
  onAddAgentTo: (teamId: string) => void;
  /** SV-18: "Add from Library" inside an agent (its prompts) or a team (its agents). Absent: the row is not shown. */
  onAddFromLibrary?: (parentId: string) => void;
  /** TF-06: "Attach a file" opens the file picker for this prompt. Absent: the item is not shown. */
  onAttach?: (id: string) => void;
  /** TF-06: files dropped on a prompt's card. Only with a fine pointer; absent: a card takes no drop. */
  onDropOnStep?: (id: string, files: File[]) => void;
  fine?: boolean;
  /** TF-08: "Add file name" selects the prompt and opens the Makes field in Details. Absent: the item is not shown. */
  onNameMade?: (id: string) => void;
  /** TF-08: the names of the files each step makes, by step id. */
  madeNames?: Readonly<Record<string, readonly string[]>>;
  /** CA-12 P4: "+ Add a session", the full-width row under the last session. Absent: no row. */
  addSession?: Omit<AddSessionRowProps, "phone">;
  /** CA-14 P3: the sessions that are folded to their head, by key. Any session can be. */
  collapsed?: ReadonlySet<string>;
  /** CA-14 P3: folding or opening a session. Resolves once it is kept. */
  onToggleCollapsed?: (sessionKey: string, collapsed: boolean) => void;
  /** CA-27 P1: Find in build: the words and the match for the List to draw, the sessions and parts it holds open, and the maker taking one over. */
  find?: { view: FindView; forced: ReadonlySet<string>; release: (key: string) => void };
  /** CA-14 P2: what the maker can do to a session's head. Absent: heads show no maker controls. */
  sessionOps?: SessionOps;
  /** CA-14 P4: a session's head dropped on another's. */
  onDropSession?: (key: string, over: string) => Promise<unknown> | void;
  /** CA-17 P2: the build's parts (two or more). */
  parts?: ListParts;
  /** CA-17 P2: a session's head dropped on a part's head. */
  onDropOnWorkstream?: (sessionKey: string, workstreamKey: string) => Promise<unknown> | void;
  /** CA-17 P2: a part's head dropped on another's. */
  onDropWorkstream?: (workstreamKey: string, over: string) => Promise<unknown> | void;
  /** CA-17 P2: "Add a part", the row under "Add a session". Resolves once the part is made. Absent: no row. */
  onAddPart?: () => void;
  /** SV-07 P3: a part is being written: "Add a part" is disabled until it lands. */
  addingPart?: boolean;
  /** CA-14 P5: the "+ Add tile" row at the end of a session, drawn by the page (it holds the Add items). */
  addToSession?: (sessionKey: string) => ReactNode;
  /** CA-14 P5: the session whose prompt box is open. An empty draft has Session 1's open without it. */
  promptIn?: string | null;
  /** CA-14 P4: a polite line for a screen reader ("Session 3 moved to 2."). */
  said?: string;
  /** CA-14 P7: "Split session here" in a tile's menu. Absent: no item. */
  onSplitHere?: (stepId: string) => void;
  /** CA-21 P7: a session on its way (added from a chat, or started empty): its lane opens at the end of its part and its prompts fall into place. */
  arriving?: Arriving | null;
  /** CA-21 P7: its animation is over (or it closed again because nothing was added). */
  onArrived?: (key: string, status: Arriving["status"]) => void;
  /** CA-12 P5: the session just added is scrolled to and outlined once. `n` changes on every add. */
  ringedSession?: { key: string; n: number } | null;
  /**
   * CA-04 P2: put a tile inside a step, sent with it, at `index` among what it holds, or (null) make it its own step at
   * `index` among the top-level steps. Resolves true once written. Absent: no handles, no drops, no buttons.
   */
  onNest?: (id: string, parentId: string | null, index: number) => Promise<boolean>;
  /** SV-28 P7: an agent's or a team's setup prompt, copied or shown. */
  onSetupPrompt?: (id: string, how: "copy" | "show") => void;
  /** CA-04 P2: whether a tile can go inside a step (`nestRefusal` says no to none of it). */
  canNest?: (id: string, parentId: string) => boolean;
  /** CA-04 P2: a tile dropped on another session's head goes into that session. Resolves true once written. */
  onMoveToSession?: (id: string, sessionKey: string, options?: { order?: readonly string[]; sentence?: string; said?: string; notice?: boolean; failed?: string }) => Promise<boolean>;
  /** CA-04 P2: Accept and Ignore on code sent with an imported prompt. Absent: nothing is offered. */
  onKeepSentWith?: (suggestion: CodeSuggestion) => void;
  onIgnoreSentWith?: (stepId: string, key: string) => void;
  /** CA-04 P4: "Setup {n}" on a session's head selects the session and scrolls Details to its Setup. */
  onOpenSetup?: (sessionKey: string) => void;
  /** CA-06 P3: the parts the post links to, by `to`. Each shows "Mentioned in the post · Back to the post". */
  mentioned?: ReadonlySet<string>;
  onBackToPost?: (to: string) => void;
  /** CA-06 P3: a part a link brought in: a team opens the agent that holds it. `n` changes on every visit. */
  reveal?: { id: string; n: number } | null;
  /**
   * CA-06 P4: the colour button on a tile and a session's head (in a tile's menu on a phone) opens the colour picker.
   * `to` is the part, `what` names it for the picker ("Prompt 3 · Launch email"), `anchor` is the button. Absent: no button.
   */
  onColour?: (to: string, anchor: HTMLElement, what: string, colour: string | null) => void;
}

/** CA-17 P2: one part of the build, as the List draws it. */
export interface ListPart {
  view: WorkstreamHeadView;
  /** "Part B · Support agent": the part in a menu or a message. */
  title: string;
  /** Its sessions' keys, in order. */
  sessions: readonly string[];
  /** The sessions it may start after, as the menu lists them. */
  startsAfterChoices: readonly { key: string; label: string }[];
}

/** CA-17 P2: the build's parts. Passed only with two or more; with one part the List is drawn as it always was. */
export interface ListParts {
  parts: readonly ListPart[];
  /** What the maker can do to a part. Absent: heads show no maker controls (a reader's build page). */
  ops?: WorkstreamOps;
  onToggle?: (key: string, collapsed: boolean) => void;
  /** The colour button and "Colour…" in a part's menu. */
  onColour?: (key: string, anchor: HTMLElement, what: string, colour: string | null) => void;
  /** "+ Add a session to this part" in an empty part. */
  onAddSession?: (key: string) => void;
  /** The sessions that share the stage of the session above them, by key. */
  withAbove?: ReadonlySet<string>;
}

/** Whether `ref`'s text is cut off by its line clamp; read after layout and on resize. Shared with the refined fork (UI-P93). */
export function useClamped<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null);
  const [clamped, setClamped] = useState(false);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const read = () => setClamped(isClamped(box));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text]);
  return { ref, clamped };
}

export const clamp3: CSSProperties = { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" };
export const clamp2: CSSProperties = PREVIEW;

/** CA-20 P3: the tile is chosen with others, and is drawn as selected is. */
const usePicked = (id: string): boolean => Boolean(useBuildSelectionContext()?.tiles.has(id));

/* ── small pieces ── */

function MenuRow({ children, disabled, onSelect, phone, reason, shortcut }: { children: ReactNode; disabled?: boolean; onSelect?: () => void; phone: boolean; reason?: string; shortcut?: ShortcutId }) {
  const why = useReason(disabled ? reason : undefined);
  return (
    <>
      <Menu.Item disabled={disabled} onSelect={onSelect} style={shortcut && !phone ? { ...menuItem(!disabled, phone), justifyContent: "space-between", gap: 12 } : menuItem(!disabled, phone)} {...why.props}>
        {shortcut && !phone ? (
          <>
            <span>{children}</span>
            <span aria-hidden="true" style={COUNT}>{shortcutLabel(shortcut)}</span>
          </>
        ) : (
          children
        )}
      </Menu.Item>
      {why.note}
    </>
  );
}

/** CA-20 P7: Duplicate, in every tile's menu after Move down. */
function DuplicateRow({ step, phone }: { step: Step; phone: boolean }) {
  const actions = useBuildActionsContext();
  if (!actions) return null;
  return (
    <MenuRow phone={phone} shortcut="duplicate" onSelect={() => actions.duplicate([step.id])}>
      Duplicate
    </MenuRow>
  );
}

/** CA-20 P7: "Convert to Agent" and the like, after Rename, for the tiles that can change kind. */
function ConvertRows({ step, phone }: { step: Step; phone: boolean }) {
  const actions = useBuildActionsContext();
  if (!actions) return null;
  return (
    <>
      {actions.convertTargets(step.id).map((target) => (
        <MenuRow key={target.to} phone={phone} disabled={Boolean(target.reason)} reason={target.reason} onSelect={() => actions.convert(step.id, target.to)}>
          {`Convert to ${target.label.toLowerCase()}…`}
        </MenuRow>
      ))}
    </>
  );
}

/** CA-20 P7: Ungroup, after Colour, only when the tile is in a group. */
function UngroupRow({ step, phone }: { step: Step; phone: boolean }) {
  const actions = useBuildActionsContext();
  if (!actions || !actions.grouped(step.id)) return null;
  return (
    <MenuRow phone={phone} shortcut="ungroup" onSelect={() => actions.ungroup([step.id])}>
      Ungroup
    </MenuRow>
  );
}

/* ── links from the post (CA-06 P3) ── */

interface ListRefs {
  mentioned: ReadonlySet<string>;
  onBack?: (to: string) => void;
  reveal: { id: string; n: number } | null;
  onColour?: BuildListProps["onColour"];
  /** CA-14 P5, P7: the sessions a tile can move to, the one each top-level tile is in, and the first tile of each. */
  sessions?: readonly { key: string; label: string }[];
  sessionOf?: ReadonlyMap<string, string>;
  /** The number of the session each top-level tile is in, for a prompt's name ("Prompt 3 · Session 2"). */
  sessionNumbers?: ReadonlyMap<string, number>;
  /** SV-07 P7: the prompt tiles of a repeated chat, to the number of the session they are also in. */
  alsoIn?: ReadonlyMap<string, number>;
  firstOf?: ReadonlySet<string>;
  onMoveToSession?: BuildListProps["onMoveToSession"];
  onSplitHere?: BuildListProps["onSplitHere"];
  /** CA-21 P1: whether a tile can move a place up or down: only the very first and last place in the build say no. */
  canMove?: (id: string, by: -1 | 1) => boolean;
  /** CA-21 P3: the tile (or session or part) held right now: its own element stays in the layout, hidden, as its place. */
  hidden?: string | null;
}

/** CA-21 P1: a tile's Move up and Move down are greyed by its place in the build, not by its number among prompts. */
function useCanMove(id: string, index: number, last: boolean): (by: -1 | 1) => boolean {
  const { canMove } = useContext(ListRefsContext);
  return (by) => (canMove ? canMove(id, by) : by === -1 ? index !== 0 : !last);
}

const ListRefsContext = createContext<ListRefs>({ mentioned: new Set(), reveal: null });

/** A tile's element, registered for the post's links as well as for moving tiles. */
function useCardRef(id: string, nestRef: (el: HTMLDivElement | null) => void) {
  const both = bothRefs<HTMLDivElement>(nestRef, usePartRef(refTo({ kind: "node", id })));
  /* CA-14: the colour picker anchors to the tile when "Colour…" is chosen in its menu, so the tile is findable by its id. */
  return useCallback(
    (element: HTMLDivElement | null) => {
      both(element);
      element?.setAttribute("data-node-id", id);
    },
    [both, id],
  );
}

const cardOf = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);

/** How a tile is named for its colour button: "Prompt 3", or by its title when it has no number ("Code order-form.tsx"). */
export const partName = (step: Pick<Step, "kind" | "number" | "title" | "defaultTitle">): string =>
  `${REF_KIND[step.kind] ?? "Prompt"} ${step.number || stepTitle(step)}`;

/** What the colour picker's head says it colours: "Prompt 7 · Launch email", or the name alone without a title. */
const pickerName = (step: Step): string => (step.title && step.number ? `${partName(step)} · ${step.title}` : partName(step));

/** CA-06 P4: a coloured tile's edge, through the one helper. */
const colourEdge = (colour: string | undefined): CSSProperties | null => (colour ? borderFor(colour) : null);

/** The colour button at the right of a tile's top row: on a desktop, or wherever the tile has no menu to put it in. */
function CardColour({ step, phone, inMenu = false }: { step: Step; phone: boolean; inMenu?: boolean }) {
  const { onColour } = useContext(ListRefsContext);
  const to = refTo({ kind: "node", id: step.id });
  /* CA-19 P5: a member of a named group says so, just before the tile's menu. */
  const label = <MemberLabel to={to} />;
  /* CA-14 P2: no colour, nothing drawn: "Colour…" in the tile's menu (or Details) is how one is given. */
  if (!onColour || !step.colour || (phone && inMenu)) return label;
  return (
    <>
      {label}
      <ColourButton what={partName(step)} colour={step.colour} size={phone ? 30 : 22} onPick={(anchor) => onColour(to, anchor, pickerName(step), step.colour ?? null)} />
    </>
  );
}

/** "Colour…" in a tile's menu. The picker opens as a sheet on a phone and beside the tile on a computer. */
function ColourMenuRow({ step, phone, anchor }: { step: Step; phone: boolean; anchor: () => HTMLElement | null }) {
  const { onColour } = useContext(ListRefsContext);
  if (!onColour) return null;
  return (
    <MenuRow
      phone={phone}
      onSelect={() => {
        const at = anchor();
        if (at) onColour(refTo({ kind: "node", id: step.id }), at, pickerName(step), step.colour ?? null);
      }}
    >
      Colour…
    </MenuRow>
  );
}

/**
 * CA-14 P5, P7: "Move to session…" (the other sessions, in a submenu, greyed with its reason while there is only one session)
 * and "Split session here" (any tile but the first of its session). Nothing for a tile that is not in a session of its own.
 */
function SessionTileRows({ step, phone }: { step: Step; phone: boolean }) {
  const refs = useContext(ListRefsContext);
  const mine = refs.sessionOf?.get(step.id);
  if (!mine) return null;
  const others = (refs.sessions ?? []).filter((session) => session.key !== mine);
  return (
    <>
      {refs.onMoveToSession && others.length === 0 ? <MenuRow phone={phone} disabled reason={REASONS.oneSession}>Move to session…</MenuRow> : null}
      {refs.onMoveToSession && others.length > 0 ? (
        <Menu.Sub>
          <Menu.SubTrigger style={menuItem(true, phone)}>Move to session…</Menu.SubTrigger>
          <Menu.Portal>
            <MenuSubContent sideOffset={4} style={menuSurface()} onClick={(event) => event.stopPropagation()}>
              {others.map((session) => (
                <MenuRow key={session.key} phone={phone} onSelect={() => void refs.onMoveToSession?.(step.id, session.key)}>
                  {session.label}
                </MenuRow>
              ))}
            </MenuSubContent>
          </Menu.Portal>
        </Menu.Sub>
      ) : null}
      {refs.onSplitHere && !refs.firstOf?.has(step.id) ? (
        <MenuRow phone={phone} onSelect={() => refs.onSplitHere?.(step.id)}>
          Split session here
        </MenuRow>
      ) : null}
    </>
  );
}

/** "Mentioned in the post · Back to the post", under a part the post links to. */
function MentionedLine({ to, phone }: { to: string; phone: boolean }) {
  const { mentioned, onBack } = useContext(ListRefsContext);
  if (!mentioned.has(to)) return null;
  return (
    <DotLine testId="mentioned-line">
      {REF_COPY.mentioned}
      {onBack ? (
        <>
          {" · "}
          <TextButton
            target={phone}
            underline
            style={text(12, 500, t.text2)}
            onClick={(event) => {
              event.stopPropagation();
              onBack(to);
            }}
          >
            {REF_COPY.backToPost}
          </TextButton>
        </>
      ) : null}
    </DotLine>
  );
}

/* ── tiles inside tiles (CA-04 P2) ── */

export const NEST_LIST_COPY = {
  sendWithAbove: "Send with the step above",
  ownStep: "Make it its own step",
  copyTogether: "Copy together",
  sentWith: (label: string) => `Sent with ${label}`,
  nowSentWith: (name: string, label: string) => `${name} is now sent with ${label}.`,
  nowOwnStep: (name: string) => `${name} is now its own step.`,
  nowIn: (name: string, session: string) => `${name} is now in ${session}.`,
  copied: (name: string) => `Copied ${name} together.`,
} as const;

/** What a card needs to take part in moving tiles. Null while the List does not move tiles. */
interface ListNest {
  move: (id: string, parentId: string | null, index: number) => void;
  canNest: (id: string, parentId: string) => boolean;
  /** The step above a top-level tile, or null for the first. */
  above: (id: string) => Step | null;
  /** The place after the top-level step that holds a tile, for "Make it its own step". */
  after: (id: string) => number;
  copy: (step: Step) => void;
}

const ListNestContext = createContext<ListNest | null>(null);

/**
 * CA-12 P6: "Send with the step above" is a control, so it is drawn as one (a text button with a small join glyph); on a
 * computer it shows while the tile is hovered or focused, and on a phone (no hover) always. CA-15 P10: with no fade.
 */
function useTileHover(phone: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useTileNear(ref, phone);
  return { ref, shown };
}

/** Whether "Send with the step above" (or "Make it its own step") is offered on a tile. */
function useNestAvailable(step: Step): boolean {
  const nest = useContext(ListNestContext);
  if (!nest) return false;
  if (step.inside) return true;
  const above = nest.above(step.id);
  return Boolean(above && nest.canNest(step.id, above.id));
}

/** "Send with the step above" on a top-level tile after the first; "Make it its own step" on a tile inside one. */
function NestButtons({ step, phone }: { step: Step; phone: boolean }) {
  const nest = useContext(ListNestContext);
  const { ref, shown } = useTileHover(phone);
  const available = useNestAvailable(step);
  if (!nest || !available) return null;
  const above = step.inside ? null : nest.above(step.id);
  const own = Boolean(step.inside);
  const Icon = own ? SplitIcon : JoinIcon;
  return (
    <span ref={ref} data-testid="nest-control" style={{ display: "inline-flex", opacity: shown ? 1 : 0 }}>
      <TextButton
        target={phone}
        style={{ ...text(12, 500, t.text2), display: "inline-flex", alignItems: "center", gap: 4 }}
        onClick={(event) => {
          event.stopPropagation();
          if (own) nest.move(step.id, null, nest.after(step.id));
          else if (above) nest.move(step.id, above.id, Number.MAX_SAFE_INTEGER);
        }}
      >
        <Icon size={12} strokeWidth={1.6} aria-hidden="true" />
        {own ? NEST_LIST_COPY.ownStep : NEST_LIST_COPY.sendWithAbove}
      </TextButton>
    </span>
  );
}

/** "Copy together" in a top-level tile's menu. */
function CopyTogetherRow({ step, phone }: { step: Step; phone: boolean }) {
  const nest = useContext(ListNestContext);
  if (!nest) return null;
  return (
    <MenuRow phone={phone} onSelect={() => nest.copy(step)}>
      {NEST_LIST_COPY.copyTogether}
    </MenuRow>
  );
}

/** SV-28 P7: Copy setup prompt, off with its reason while the agent (or every agent of the team) has no instructions. */
function SetupPromptRows({ step, phone, on }: { step: Step; phone: boolean; on: (id: string, how: "copy" | "show") => void }) {
  const said = Boolean(step.text.trim() || step.teamInstructions || step.children.some((child) => child.kind === "agent" && child.text.trim())) || toolFor(step.harness ?? step.children[0]?.harness)?.facts?.hosting === "vendor";
  return (
    <>
      <MenuRow phone={phone} disabled={!said} reason={said ? undefined : "Add instructions first"} onSelect={() => on(step.id, "copy")}>
        Copy setup prompt
      </MenuRow>
      <MenuRow phone={phone} onSelect={() => on(step.id, "show")}>
        Show setup prompt
      </MenuRow>
    </>
  );
}

/** A tile's name in the List's lines: its file name, else "prompt 2", else its kind. */
const tileName = (step: Step) => sentWithLabel(step);

/** CA-26: the name a tile's grip goes by: "Prompt 2", "Agent 5", the file's own name, or for a tile sent with another, whose it is. */
const gripName = (step: Step) => {
  const label = sentWithLabel(step);
  if ((step.kind === "code" || step.kind === "file") && step.filename) return label;
  if (!step.number && step.inside) return `${REF_KIND[step.kind] ?? "Prompt"} sent with ${step.inside.label}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/** A tile inside another: its eyebrow says what it is sent with; it has no number. It can hold more tiles. */
function SentWithTile({ step, props }: { step: Step; props: BuildListProps }) {
  const focus = useItemRing(step.id);
  const nest = useNestTile(step.id);
  const hidden = useContext(ListRefsContext).hidden === step.id;
  const cardRef = useCardRef(step.id, nest.setRef);
  const picked = usePicked(step.id);
  const selected = props.selectedId === step.id || picked;
  const named = step.kind === "code" ? (step.filename ?? step.language ?? null) : null;
  const kind = step.kind === "manual" ? "Manual step" : step.kind === "file" ? "File" : step.kind === "code" ? "Code" : step.kind === "check" ? "Check" : step.kind === "agent" ? "Agent" : step.kind === "team" ? "Team" : "Prompt";
  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={`${kind} sent with ${step.inside?.label ?? "a step"}: ${stepTitle(step)}`}
      data-testid="sent-with-tile"
      data-kind={step.kind}
      data-skel-kind="nested"
      data-skel-id={step.id}
      data-skel-container={step.inside?.id ?? ""}
      {...{ [SLIDE_ATTR]: `nested:${step.id}` }}
      data-selected={selected ? "true" : undefined}
      tabIndex={0}
      {...focus.bind}
      onClick={(event) => {
        event.stopPropagation();
        props.onSelect(step.id);
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          event.stopPropagation();
          props.onSelect(step.id);
        }
      }}
      style={{
        ...tileStyle,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        outline: "none",
        ...focus.ring,
        cursor: "pointer",
        ...(selected ? { background: t.selectedFill, borderColor: t.selectedEdge, boxShadow: t.selectedRing } : null),
        ...colourEdge(step.colour),
        ...(nest.takes ? TAKES : null),
        ...(hidden ? { visibility: "hidden" } : null),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <DragHandle label={`Move ${gripName(step)}`} nest={nest} />
        <Quiet style={{ ...ellipsis, minWidth: 0, flexGrow: 1 }}>{NEST_LIST_COPY.sentWith(step.inside?.label ?? "the step above")}</Quiet>
        <CardColour step={step} phone={props.phone} />
      </div>
      <span style={{ ...text(13, 500, step.title ? t.text : t.text2), overflowWrap: "anywhere" }}>
        {[kind === "Prompt" ? null : kind, step.title ?? (kind === "Prompt" ? stepTitle(step) : named ?? (step.kind === "file" ? step.filename : null))].filter(Boolean).join(" · ")}
      </span>
      {step.kind === "code" ? (
        <>
          <CodePartLine step={step} />
          <CodeLines text={step.text} compact testId="code-lines" label={`${kind} text`} />
        </>
      ) : step.text ? (
        <p style={{ ...text(13, 400, t.text), lineHeight: "21px", margin: 0, overflowWrap: "anywhere", ...clamp2 }}>{step.text}</p>
      ) : null}
      <MentionedLine to={refTo({ kind: "node", id: step.id })} phone={props.phone} />
      <SentWithList step={step} props={props} indent={0} />
      <span>
        <NestButtons step={step} phone={props.phone} />
      </span>
    </div>
  );
}

/**
 * CA-04 P2: code sent with an imported prompt in the chat. CA-15 P10: one row, "<n> items sent with this prompt were found in
 * the chat", with a Review button. Review opens a small panel listing each item with Accept (puts it inside) and Ignore
 * (leaves it out). With nothing offered, no row.
 */
function SentWithSuggestions({ step, props }: { step: Step; props: BuildListProps }) {
  if (!props.onKeepSentWith || !props.onIgnoreSentWith) return null;
  const offered = codeInPrompt(step);
  if (offered.length === 0) return null;
  const { phone } = props;
  return (
    <div data-testid="sent-with-found" onClick={(event) => event.stopPropagation()} style={{ paddingLeft: INDENT, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <span style={text(12, 400, t.text2)}>{SENT_WITH_COPY.found(offered.length)}</span>
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button variant="secondary" size={phone ? 44 : 28} fontSize={12}>
            {SENT_WITH_COPY.review}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={16}
            onClick={(event) => event.stopPropagation()}
            data-testid="sent-with-review"
            style={{ ...menuSurface(360), maxHeight: "var(--radix-popover-content-available-height)", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <span style={text(12.5, 500, t.text)}>{SENT_WITH_COPY.keep}</span>
            {offered.map((suggestion) => (
              <div key={suggestion.key} data-testid="sent-with-suggestion" style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 12, borderTop: `1px solid ${t.line}` }}>
                <span style={{ ...text(12.5, 500, t.text), overflowWrap: "anywhere" }}>{["Code", suggestion.filename ?? (suggestion.language === "other" ? null : suggestion.language), `${lineCount(suggestion.source)} ${lineCount(suggestion.source) === 1 ? "line" : "lines"}`].filter(Boolean).join(" · ")}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={() => props.onKeepSentWith?.(suggestion)}>
                    {SENT_WITH_COPY.accept}
                  </Button>
                  <TextButton target={phone} style={text(12, 500, t.text2)} onClick={() => props.onIgnoreSentWith?.(suggestion.stepId, suggestion.key)}>
                    {SENT_WITH_COPY.ignore}
                  </TextButton>
                </span>
              </div>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

/** The tiles sent with a step, under its text, indented as its text is. */
function SentWithList({ step, props, indent = INDENT }: { step: Step; props: BuildListProps; indent?: number }) {
  if (!step.sentWith?.length) return null;
  return (
    <div data-testid="sent-with" style={{ paddingLeft: indent, display: "flex", flexDirection: "column", gap: 8 }}>
      {step.sentWith.map((tile) => (
        <SentWithTile key={tile.id} step={tile} props={props} />
      ))}
    </div>
  );
}

/** The row under a step's text, and the words at its right. */
const footRow = (indent: number): CSSProperties => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
  paddingLeft: indent,
  minHeight: 22,
});

const wordsOf = (n: number) => `${n} ${n === 1 ? "word" : "words"}`;

/* ── a session's head (SessionHead.tsx) and what sits under it ── */

/** CA-04 P6, CA-05: what the session worked until, when it runs, and how it went: one quiet line each, under an open session's head. */
function SessionLines({ session }: { session: SourceSession }) {
  return (
    <>
      {session.sameStageAs ? <DotLine testId="same-stage-line">{WORKSTREAM_HEAD_COPY.sameStage(session.sameStageAs)}</DotLine> : null}
      {session.goal ? (
        <DotLine testId="goal-line" dot={session.goal.reached ? t.evidence : t.label}>
          {session.goal.line}
        </DotLine>
      ) : null}
      {session.runsWhen ? <DotLine testId="runs-when-line">{session.runsWhen}</DotLine> : null}
      {session.facts ? <DotLine testId="facts-line">{session.facts}</DotLine> : null}
      {(session.lines ?? []).map((line) => (
        <DotLine key={line} testId="session-detail-line">
          {line}
        </DotLine>
      ))}
      {session.together ? <DotLine testId="together-line">{session.together}</DotLine> : null}
    </>
  );
}

/* ── the uses row ── */

function Suggestion({ label, onAccept, onDismiss }: { label: string; onAccept: () => void; onDismiss: () => void }) {
  const accept = useInteractive<HTMLButtonElement>();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 28,
        padding: "0 4px 0 8px",
        boxSizing: "border-box",
        borderRadius: 6,
        border: `1px dashed ${t.line}`,
        ...text(11.5, 400, t.text2),
        whiteSpace: "nowrap",
        maxWidth: "100%",
      }}
    >
      <span style={{ ...ellipsis, minWidth: 0 }}>{label}</span>
      <button
        type="button"
        {...accept.handlers}
        onClick={(event) => {
          event.stopPropagation();
          onAccept();
        }}
        style={{
          ...CONTROL,
          ...(accept.state.hovered ? { background: t.controlOn } : null),
          height: 20,
          padding: "0 8px",
          boxSizing: "border-box",
          borderRadius: 4,
          ...text(11.5, 500, t.text),
          cursor: "pointer",
          flexShrink: 0,
          ...ring(accept.state.focusVisible),
        }}
      >
        Accept
      </button>
      <TextButton
        onClick={(event) => {
          event.stopPropagation();
          onDismiss();
        }}
        style={{ ...text(11.5, 400, t.text2), height: 20, padding: "0 4px", flexShrink: 0 }}
      >
        Dismiss
      </TextButton>
    </span>
  );
}

/** What a step's "Uses" row holds: its input chips, the suggestions waiting on it, and whether it goes into the result. */
function usesParts(step: Step, props: Pick<BuildListProps, "steps" | "names" | "suggestions" | "intoResult">, withGoes: boolean) {
  const chips = step.uses
    .map((use) => ({ use, text: inputLabel(use, props.steps, props.names) }))
    .filter((chip): chip is { use: typeof chip.use; text: string } => chip.text !== null);
  const mine = props.suggestions.filter((suggestion) => suggestion.stepId === step.id);
  const goes = withGoes && props.intoResult.has(step.id);
  return { chips, mine, goes, any: chips.length > 0 || mine.length > 0 || goes };
}

function UsesRow({
  step,
  props,
  withGoes = true,
}: {
  step: Step;
  props: Pick<BuildListProps, "steps" | "names" | "suggestions" | "intoResult" | "onAccept" | "onDismiss" | "onSelect">;
  withGoes?: boolean;
}) {
  const { chips, mine, goes, any } = usesParts(step, props, withGoes);
  if (!any) return null;
  return (
    <>
      {chips.length > 0 || mine.length > 0 ? <Quiet>Uses</Quiet> : null}
      {chips.map(({ use, text: label }) =>
        use.kind === "output" ? (
          <span key={suggestionKey(use)} style={chipStyle}>
            {label}
          </span>
        ) : (
          <button
            key={suggestionKey(use)}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              props.onSelect(use.node_id);
            }}
            style={{ ...chipStyle, cursor: "pointer" }}
          >
            {label}
          </button>
        ),
      )}
      {mine.map((suggestion) => (
        <Suggestion
          key={suggestionKey(suggestion.use)}
          label={`${suggestion.label} · ${suggestion.reason}`}
          onAccept={() => props.onAccept(suggestion)}
          onDismiss={() => props.onDismiss(suggestion)}
        />
      ))}
      {goes ? <GoesInto /> : null}
    </>
  );
}

function GoesInto() {
  return (
    <>
      <Quiet>Used by</Quiet>
      <Pill tone="evidence">Result</Pill>
    </>
  );
}

/* ── a title, renamed in place ── */

function RenameField({ label, draft, placeholder, phone, onDraft, onFinish }: { label: string; draft: string; placeholder: string; phone: boolean; onDraft: (value: string) => void; onFinish: (save: boolean) => void }) {
  return (
    <input
      autoFocus
      aria-label={label}
      value={draft}
      maxLength={80}
      placeholder={placeholder}
      onChange={(event) => onDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") onFinish(true);
        if (event.key === "Escape") onFinish(false);
      }}
      onBlur={() => onFinish(true)}
      style={{ ...wellField, flexGrow: 1, minWidth: 0, height: 28, padding: "0 8px", fontSize: phone ? 16 : 14, fontWeight: 500 }}
    />
  );
}

function StepTitle({ title, isDefault }: { title: string; isDefault: boolean }) {
  return (
    <h3
      data-default-title={isDefault ? "true" : undefined}
      style={{ ...text(14, 500, isDefault ? t.text2 : t.text), margin: 0, flexGrow: 1, minWidth: 0, letterSpacing: "-0.005em", ...ellipsis }}
    >
      {title}
    </h3>
  );
}

/** "Makes brand-guide.md", quiet, under a step's text. */
function MadeLine({ names }: { names: readonly string[] | undefined }) {
  const line = madeLine(names ?? []);
  return line ? <Quiet style={{ paddingLeft: INDENT, overflowWrap: "anywhere" }}>{line}</Quiet> : null;
}

/* ── what every tile shares (CA-15 P10): its header, its menu and its footer ── */

/** A tile's rename: asked for from its menu, started once the menu has closed (closing returns focus to its button, which would end an edit opened sooner). */
function useRename(step: Step, props: BuildListProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const next = useRef(false);
  const finish = (save: boolean) => {
    setRenaming(false);
    if (save && draft.trim() !== (step.title ?? "")) props.onRename(step.id, draft);
  };
  return {
    renaming,
    draft,
    setDraft,
    finish,
    ask: () => {
      next.current = true;
    },
    onCloseAutoFocus: (event: Event) => {
      if (!next.current) return;
      event.preventDefault();
      next.current = false;
      setDraft(step.title ?? "");
      setRenaming(true);
    },
  };
}

/** The ⋯ menu at the right of a tile's header: rename, copy together, move, colour, session, then Remove tile. */
function TileMenu({ step, noun, index, last, props, rename }: { step: Step; noun: string; index: number; last: boolean; props: BuildListProps; rename: ReturnType<typeof useRename> }) {
  const { phone } = props;
  const can = useCanMove(step.id, index, last);
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <TileOptions label={`${noun} ${step.number} options`} phone={phone} onClick={(event) => event.stopPropagation()} />
      </Menu.Trigger>
      <Menu.Portal>
        <MenuContent align="end" sideOffset={4} style={menuSurface()} onClick={(event) => event.stopPropagation()} onCloseAutoFocus={rename.onCloseAutoFocus}>
          <MenuRow phone={phone} onSelect={rename.ask}>Rename</MenuRow>
          <ConvertRows step={step} phone={phone} />
          <CopyTogetherRow step={step} phone={phone} />
          {props.onSetupPrompt && (step.kind === "agent" || step.kind === "team") ? <SetupPromptRows step={step} phone={phone} on={props.onSetupPrompt} /> : null}
          <MenuRow phone={phone} disabled={!can(-1)} shortcut="moveUp" reason={moveReason("tile", -1, !can(-1))} onSelect={() => props.onMove(step.id, -1)}>Move up</MenuRow>
          <MenuRow phone={phone} disabled={!can(1)} shortcut="moveDown" reason={moveReason("tile", 1, !can(1))} onSelect={() => props.onMove(step.id, 1)}>Move down</MenuRow>
          <DuplicateRow step={step} phone={phone} />
          <ColourMenuRow step={step} phone={phone} anchor={() => cardOf(step.id)} />
          <UngroupRow step={step} phone={phone} />
          <SessionTileRows step={step} phone={phone} />
          <RemoveRow label={MENU_COPY.removeTile} phone={phone} shortcut={phone ? undefined : <span aria-hidden="true" style={COUNT}>{shortcutLabel("remove")}</span>} onSelect={() => props.onRemove(step.id)} />
        </MenuContent>
      </Menu.Portal>
    </Menu.Root>
  );
}

/**
 * A tile's header: the number in its square, a type line (11.5, `--label`) with the title under it (14 / 500, one line, an
 * ellipsis), the colour (only when one is set) and the ⋯ menu. The drag handle is drawn while the tile is hovered or has focus.
 */
function TileHeader({ step, nest, phone, typeLine, typeTestId, title, menu }: { step: Step; nest: ReturnType<typeof useNestTile>; phone: boolean; typeLine: ReactNode; typeTestId: string; title: ReactNode; menu: ReactNode }) {
  return (
    <div style={TILE_HEAD}>
      <DragHandle label={`Move ${gripName(step)}`} nest={nest} />
      <NumberBadge>{step.number}</NumberBadge>
      <div style={TILE_TEXT}>
        <span data-testid={typeTestId} style={TILE_EYEBROW}>
          {typeLine}
        </span>
        {title}
        {step.gate ? <GateLine gate={step.gate} /> : null}
        {step.waitsFor ? <WaitsLine waitsFor={step.waitsFor} /> : null}
      </div>
      <CardColour step={step} phone={phone} inMenu />
      {menu}
    </div>
  );
}

/** A tile's title: one line, an ellipsis, in `--text2` while it is the automatic one. */
function TileTitle({ step, rename, noun, phone }: { step: Step; rename: ReturnType<typeof useRename>; noun: string; phone: boolean }) {
  const isDefault = step.title === null;
  return rename.renaming ? (
    <RenameField label={`Title of ${noun.toLowerCase()} ${step.number}`} draft={rename.draft} placeholder={step.defaultTitle} phone={phone} onDraft={rename.setDraft} onFinish={rename.finish} />
  ) : (
    <h3 data-default-title={isDefault ? "true" : undefined} title={stepTitle(step)} style={{ ...TILE_TITLE, ...(isDefault ? { color: t.text2 } : null) }}>
      {step.kind === "tool" || step.kind === "repo" ? <MarkedName name={step.kind === "tool" ? (step.tool ?? stepTitle(step)) : "github"}><FindHit text={stepTitle(step)} /></MarkedName> : <FindHit text={stepTitle(step)} />}
    </h3>
  );
}

/** The one text link at the right of a tile's footer: "Open prompt", "Show agents". It never selects the tile. */
function FooterLink({ phone, onClick, expanded, children }: { phone: boolean; onClick: () => void; expanded?: boolean; children: ReactNode }) {
  return (
    <TextButton
      target={phone}
      aria-expanded={expanded}
      style={FOOT_LINK}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </TextButton>
  );
}

/** What stands above a tile's footer: its "Uses" chips. Not drawn when it has none. */
function ExtraRow({ step, props, withGoes = true }: { step: Step; props: BuildListProps; withGoes?: boolean }) {
  if (!usesParts(step, props, withGoes).any) return null;
  return (
    <div style={footRow(INDENT)}>
      <UsesRow step={step} props={props} withGoes={withGoes} />
    </div>
  );
}

/** A tile's number by its id, anywhere in the build. */
function numberIn(steps: readonly Step[], id: string): Step["number"] | undefined {
  for (const step of steps) {
    if (step.id === id) return step.number;
    const inner = numberIn(step.children, id);
    if (inner !== undefined) return inner;
  }
  return undefined;
}

/**
 * The foot of every tile: its "Uses" chips, then one mono line of at most three counted facts with at most one link. "Send
 * with the step above" shares that line, so a tile that can take it needs no row of its own.
 */
function TileFoot({ step, props, link, facts, withGoes = true }: { step: Step; props: BuildListProps; link?: ReactNode; facts?: readonly string[]; withGoes?: boolean }) {
  const nest = useNestAvailable(step);
  return (
    <>
      <ExtraRow step={step} props={props} withGoes={withGoes} />
      <TileFooter facts={facts ?? footerFactsOf(step, (id) => numberIn(props.steps, id))} link={link} extra={nest ? <NestButtons step={step} phone={props.phone} /> : null} indent={INDENT} />
    </>
  );
}

/* ── a prompt's card ── */

function StepCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  const focus = useItemRing(step.id);
  const { phone, selectedId } = props;
  const can = useCanMove(step.id, index, last);
  const picked = usePicked(step.id);
  const selected = selectedId === step.id || picked;
  const title = stepTitle(step);
  const isDefault = step.title === null;
  const { sessionNumbers, alsoIn: repeated } = useContext(ListRefsContext);
  const sessionNumber = sessionNumbers?.get(step.id);
  const alsoIn = repeated?.get(step.id);
  // SV-07 P7: a Summary tile is called what it is, never by a prompt's place.
  const place = step.summary ? SUMMARY_COPY.title : promptPlace(step.number, sessionNumber);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [over, setOver] = useState(false);
  const { ref: textRef } = useClamped<HTMLParagraphElement>(step.text);
  const open = props.onOpenPrompt ? () => props.onOpenPrompt?.(step.id) : undefined;
  const editable = step.kind === "prompt";

  /* Rename starts once the menu has closed: closing returns focus to the menu's button, which would blur a field
     opened any earlier and end the edit. */
  const renameNext = useRef(false);
  const nameNext = useRef(false);
  const finish = (save: boolean) => {
    setRenaming(false);
    if (save && draft.trim() !== (step.title ?? "")) props.onRename(step.id, draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter") {
      event.preventDefault();
      open?.();
    } else if (event.key === " ") {
      event.preventDefault();
      props.onSelect(step.id);
    }
  };

  const nest = useNestTile(step.id);
  const cardRef = useCardRef(step.id, nest.setRef);
  const takesDrops = Boolean(props.fine && props.onDropOnStep);
  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={step.summary ? `${SUMMARY_COPY.title}: ${step.title ?? "untitled"}` : `Prompt ${step.number}: ${step.title ?? "untitled"}`}
      data-testid="step-card"
      data-kind={step.summary ? "summary" : "prompt"}
      data-selected={selected ? "true" : undefined}
      tabIndex={0}
      {...focus.bind}
      onClick={() => props.onSelect(step.id)}
      onDoubleClick={phone ? undefined : open}
      onKeyDown={onKeyDown}
      onDragEnter={takesDrops ? (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        setOver(true);
      } : undefined}
      onDragOver={takesDrops ? (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setOver(true);
      } : undefined}
      onDragLeave={takesDrops ? (event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      } : undefined}
      onDrop={takesDrops ? (event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        setOver(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) props.onDropOnStep?.(step.id, files);
      } : undefined}
      style={{ ...tileCard(selected || over), outline: "none", ...focus.ring, cursor: "pointer", ...colourEdge(step.colour), ...(nest.takes ? TAKES : null) }}
    >
      <TileHeader
        step={step}
        nest={nest}
        phone={phone}
        typeLine={
          alsoIn ? (
            <>
              {typeLineOf(step)}
              {/* SV-07 P7: a tile of the same chat imported again, under its kind line. */}
              <span data-testid="also-in" style={{ display: "block" }}>
                {REPEAT_COPY.alsoIn(alsoIn)}
              </span>
            </>
          ) : (
            typeLineOf(step)
          )
        }
        typeTestId="prompt-eyebrow"
        title={
          renaming ? (
            <RenameField label={`Title of prompt ${step.number}`} draft={draft} placeholder={step.defaultTitle} phone={phone} onDraft={setDraft} onFinish={finish} />
          ) : (
            /* A prompt is called by its place on the build; the maker's own title sits next to it, and the pencil edits it here. */
            <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              <h3 data-default-title={isDefault ? "true" : undefined} title={[place, step.title].filter(Boolean).join(" ")} style={{ margin: 0, minWidth: 0, letterSpacing: "-0.005em" }}>
                <PromptName place={place} title={step.title} />
              </h3>
              <GlyphButton
                glyph="pencil"
                label={`Rename prompt ${step.number}`}
                phone={phone}
                onClick={() => {
                  setDraft(step.title ?? "");
                  setRenaming(true);
                }}
              />
            </div>
          )
        }
        menu={
          editable ? (
          <Menu.Root>
            <Menu.Trigger asChild>
              <TileOptions label={`Prompt ${step.number} options`} phone={phone} onClick={(event) => event.stopPropagation()} />
            </Menu.Trigger>
            <Menu.Portal>
              <MenuContent
                align="end"
                sideOffset={4}
                style={menuSurface()}
                onClick={(event) => event.stopPropagation()}
                onCloseAutoFocus={(event) => {
                  /* CA-10: "Add file name" opens a field in Details; the closing menu must not take focus
                     back to its trigger after the field has it, so the ask runs once the menu has let go. */
                  if (nameNext.current) {
                    event.preventDefault();
                    nameNext.current = false;
                    props.onNameMade?.(step.id);
                    return;
                  }
                  if (!renameNext.current) return;
                  event.preventDefault();
                  renameNext.current = false;
                  setDraft(step.title ?? "");
                  setRenaming(true);
                }}
              >
                <MenuRow phone={phone} onSelect={() => (renameNext.current = true)}>Rename</MenuRow>
                <ConvertRows step={step} phone={phone} />
                <MenuRow phone={phone} disabled={!open} reason={REASONS.readAll} onSelect={open}>Read all</MenuRow>
                <CopyTogetherRow step={step} phone={phone} />
                {props.onAttach ? <MenuRow phone={phone} onSelect={() => props.onAttach?.(step.id)}>Attach a file</MenuRow> : null}
                {props.onNameMade ? <MenuRow phone={phone} onSelect={() => (nameNext.current = true)}>Add file name</MenuRow> : null}
                <MenuRow phone={phone} disabled={!can(-1)} shortcut="moveUp" reason={moveReason("tile", -1, !can(-1))} onSelect={() => props.onMove(step.id, -1)}>Move up</MenuRow>
                <MenuRow phone={phone} disabled={!can(1)} shortcut="moveDown" reason={moveReason("tile", 1, !can(1))} onSelect={() => props.onMove(step.id, 1)}>Move down</MenuRow>
          <DuplicateRow step={step} phone={phone} />
                <ColourMenuRow step={step} phone={phone} anchor={() => cardOf(step.id)} />
          <UngroupRow step={step} phone={phone} />
              <SessionTileRows step={step} phone={phone} />
              <RemoveRow label={MENU_COPY.removeTile} phone={phone} shortcut={phone ? undefined : <span aria-hidden="true" style={COUNT}>{shortcutLabel("remove")}</span>} onSelect={() => props.onRemove(step.id)} />
              </MenuContent>
            </Menu.Portal>
          </Menu.Root>
        ) : null
        }
      />
      {step.origin || step.asksFor ? (
        <p data-testid="prompt-origin" style={{ ...text(12, 400, t.label), margin: 0, paddingLeft: INDENT }}>
          {[step.origin ? originLine(step.origin) : null, step.asksFor ? ASKS_FOR_LABEL[step.asksFor] : null].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <p
        ref={textRef}
        style={{ ...text(13.5, 400, t.text), lineHeight: "21px", margin: 0, paddingLeft: INDENT, overflowWrap: "anywhere", ...clamp2 }}
      >
        <ChangedText text={step.text} changes={step.changes} />
      </p>
      {step.reply ? <ReplyBlock reply={step.reply} indent={INDENT} lean /> : null}
      {step.outputShape ? <ShapeChip shape={step.outputShape} indent={INDENT} /> : null}
      <TileCostLines step={step} audience="maker" groups={props.costGroups ?? []} indent={INDENT} />
      <MadeLine names={props.madeNames?.[step.id]} />
      <MentionedLine to={refTo({ kind: "node", id: step.id })} phone={props.phone} />
      <SentWithList step={step} props={props} />
      <SentWithSuggestions step={step} props={props} />
      <TileFoot
        step={step}
        props={props}
        link={
          open ? (
            <FooterLink phone={phone} onClick={open}>
              {LIST_COPY.openPrompt}
            </FooterLink>
          ) : null
        }
      />
    </div>
  );
}

/* ── agents and teams (UI-P69) ── */

/** CA-03 P7: the outside tools an agent can use, its tools read from the List's names (an id to a service). */
const outsideOf = (agent: Step, names: BuildListProps["names"]): string[] =>
  readsOutsideContent(agent, (agent.toolRefs ?? []).flatMap((id) => (names[id] ? [{ id, type: TOOL_TYPE, payload: { service: names[id] } }] : [])));

function InnerCard({ step, eyebrow, runs, nested, made, outside = [], phone = false, team }: { step: Step; eyebrow?: string; runs?: string; nested?: boolean; made?: readonly string[]; outside?: readonly string[]; phone?: boolean; team?: readonly Step[] }) {
  // An agent's instructions are its own text, not a part of their own.
  const to = step.id.endsWith(":instructions") ? null : refTo({ kind: "node", id: step.id });
  const part = usePartRef(to);
  return (
    <div ref={part} data-testid={nested ? "inner-prompt" : "inner-card"} style={{ ...tileStyle, padding: 12, display: "flex", flexDirection: "column", gap: 6, ...colourEdge(to ? step.colour : undefined) }}>
      {eyebrow ? <Quiet>{eyebrow}</Quiet> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{ fontFamily: DM_MONO, fontSize: 10.5, color: t.label, ...tnum, flexShrink: 0 }}>{step.number}</span>
        <span style={{ ...text(13, 500, step.title ? t.text : t.text2), flexGrow: 1, minWidth: 0, ...ellipsis }}>{stepTitle(step)}</span>
        {to ? <CardColour step={step} phone={phone} /> : null}
      </div>
      {runs ? <DotLine testId="runs-line">{runs}</DotLine> : null}
      {step.kind === "agent" && step.memory ? <DotLine testId="memory-line">{LIST_COPY.remembers(step.memory)}</DotLine> : null}
      {step.kind === "agent" && step.memoryTidy ? <DotLine testId="memory-tidy-line">{LIST_COPY.tidies(step.memoryTidy)}</DotLine> : null}
      {step.id.endsWith(":instructions") && !step.text.trim() ? (
        <span data-testid="agent-instructions" style={text(12.5, 400, t.label)}>{TILE_COPY.noInstructions}</span>
      ) : team ? (
        <MentionText value={step.text} team={mentionTeam(team)} style={clamp3} />
      ) : (
        <p data-testid={step.id.endsWith(":instructions") ? "agent-instructions" : undefined} style={{ ...text(13, 400, t.text), lineHeight: "21px", margin: 0, overflowWrap: "anywhere", whiteSpace: step.id.endsWith(":instructions") ? "pre-wrap" : undefined, ...(step.id.endsWith(":instructions") ? clamp3 : clamp2) }}>{step.text}</p>
      )}
      {step.job ? <JobLine job={step.job} /> : null}
      <AgentRules agent={step} />
      {madeLine(made ?? []) ? <Quiet>{madeLine(made ?? [])}</Quiet> : null}
      <OutsideWarning names={outside} />
      {to ? <MentionedLine to={to} phone={phone} /> : null}
    </div>
  );
}

/** A dashed, text-only row that adds something inside an agent or a team. */
function GhostAdd({ label, phone, onClick }: { label: string; phone: boolean; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      {...handlers}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      style={{
        ...bareButton,
        minHeight: phone ? 44 : 32,
        padding: "0 12px",
        boxSizing: "border-box",
        borderRadius: 6,
        border: `1px dashed ${state.hovered ? t.text2 : t.line}`,
        ...text(12.5, 400, t.text2),
        ...ring(state.focusVisible),
      }}
    >
      {label}
    </button>
  );
}

/** The field "Add a prompt to this agent" opens: a well, Cancel and the boxed `up` (the agent's model applies). */
function AgentPromptField({ agent, props, onDone }: { agent: Step; props: BuildListProps; onDone: () => void }) {
  const [text_, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => field.current?.focus(), []);
  const submit = async () => {
    if (!text_.trim() || busy) return;
    setBusy(true);
    const saved = await props.onAddAgentPrompt(agent.id, text_);
    setBusy(false);
    if (saved) {
      setText("");
      onDone();
    }
  };
  return (
    <div data-testid="agent-prompt-field" onClick={(event) => event.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <textarea
        ref={field}
        aria-label={`Add a prompt to agent ${agent.number}`}
        rows={2}
        value={text_}
        placeholder={LIST_COPY.placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onDone();
          } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void submit();
          }
        }}
        style={{ ...wellField, resize: "none", padding: 12, fontSize: props.phone ? 16 : 13.5 }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        <TextButton onClick={onDone} target={props.phone} style={text(12.5, 500, t.text2)}>
          Cancel
        </TextButton>
        <IconButton icon={ArrowUp} glyph="up" label="Add prompt to this agent" size={28} disabled={!text_.trim() || busy} onClick={() => void submit()} />
      </div>
    </div>
  );
}

/** "Agent · ", the model's mark at 14 and its name: the eyebrow's words are the current look's. */
/** The ids of every step under this one, for "is this the tile a link points into". */
const holds = (step: Step, id: string): boolean => step.children.some((child) => child.id === id || holds(child, id));

/** An agent's instructions: the first line of its own text. Nothing when it has none. */
const instructionsLine = (agent: Step): string => (agent.children.find((child) => child.id.endsWith(":instructions"))?.text ?? "").split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";

/** The most tool marks an agent's tile shows. */
const AGENT_TILE_TOOLS = 3;

/** A team's agents as a compact list: the name at the left, the role and the model in mono at the right. */
function TeamAgents({ team }: { team: Step }) {
  return (
    <div style={{ paddingLeft: INDENT, minWidth: 0 }}>
      <ul data-testid="team-agents" style={LIST_BOX}>
        {team.children.map((agent, at) => {
          const right = [at === 0 ? "Lead" : null, agent.harness ? (toolName(agent.harness) ?? agent.harness) : null, stepModel(agent)].filter(Boolean).join(" · ");
          return (
            <li key={agent.id} data-testid="team-agent" style={listRow(at === 0)}>
              <span style={{ ...text(13, 400, agent.title ? t.text : t.text2), flexGrow: 1, minWidth: 0, ...ellipsis }}>{stepTitle(agent)}</span>
              <span style={{ fontFamily: DM_MONO, fontSize: 11.5, lineHeight: "18px", color: t.label, flexShrink: 0, maxWidth: "55%", ...ellipsis }}>{right}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ContainerCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  const focus = useItemRing(step.id);
  const isTeam = step.kind === "team";
  const noun = isTeam ? "Team" : "Agent";
  const picked = usePicked(step.id);
  const selected = props.selectedId === step.id || picked;
  const made = madeIn(step, props.steps);
  const [adding, setAdding] = useState(false);
  /** Its prompts, or a team's agents, start folded behind the footer link. */
  const [unfolded, setUnfolded] = useState(false);
  /** One agent of a team shows its own prompts at a time. */
  const [openAgent, setOpenAgent] = useState<string | null>(null);
  /* CA-06 P3: a link to an agent's own prompt opens that agent first. CA-15 P10: and unfolds the tile that holds it. */
  const { reveal } = useContext(ListRefsContext);
  useEffect(() => {
    if (!reveal) return;
    if (holds(step, reveal.id)) setUnfolded(true);
    if (!isTeam) return;
    const holder = step.children.find((child) => child.children.some((grand) => grand.id === reveal.id));
    if (holder) setOpenAgent(holder.id);
  }, [reveal, isTeam, step]);
  const rename = useRename(step, props);
  const nest = useNestTile(step.id);
  const cardRef = useCardRef(step.id, nest.setRef);
  const { phone } = props;
  const instructions = isTeam ? "" : instructionsLine(step);
  const toolNames = isTeam ? [] : (step.toolRefs ?? []).map((id) => props.names[id]).filter(Boolean).slice(0, AGENT_TILE_TOOLS);
  /* A team folds its agents; an agent folds its prompts. An agent's own instructions are no prompt of its own, so an agent with only them has nothing to fold. */
  const folds = isTeam ? step.children.length > 0 : step.children.some((child) => !child.id.endsWith(":instructions"));
  const shown = unfolded || !folds;
  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={`${noun} ${step.number}: ${stepTitle(step)}`}
      data-testid="step-card"
      data-kind={step.kind}
      tabIndex={0}
      {...focus.bind}
      onClick={() => props.onSelect(step.id)}
      onDoubleClick={props.phone ? undefined : () => props.onEditTile?.(step.id)}
      style={{ ...tileCard(selected), outline: "none", ...focus.ring, cursor: "pointer", ...colourEdge(step.colour), ...(nest.takes ? TAKES : null) }}
    >
      <TileHeader
        step={step}
        nest={nest}
        phone={phone}
        typeLine={typeLineOf(step)}
        typeTestId="container-eyebrow"
        title={<TileTitle step={step} rename={rename} noun={noun} phone={phone} />}
        menu={<TileMenu step={step} noun={noun} index={index} last={last} props={props} rename={rename} />}
      />
      {isTeam ? (
        <>
          <TeamAgents team={step} />
          <TeamHead team={step} style={{ paddingLeft: INDENT }} />
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: INDENT, minWidth: 0 }}>
          {instructions ? (
            <span data-testid="agent-instructions-line" style={{ ...text(13, 400, t.text), ...ellipsis }}>
              {instructions}
            </span>
          ) : null}
          <AgentRules agent={step} />
          <DotLine testId="runs-line">{triggerLine(step)}</DotLine>
          {toolNames.length > 0 ? (
            <span data-testid="agent-tools" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              {toolNames.map((name) => (
                <span key={name} title={name} style={{ display: "inline-flex", alignItems: "center", gap: 4, ...text(11.5, 400, t.text2) }}>
                  <ToolMark tool={name} size={14} />
                  {name}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      )}
      {isTeam && stepRunsLabel(step) ? <DotLine testId="runs-line" style={{ paddingLeft: INDENT }}>{stepRunsLabel(step)}</DotLine> : null}
      {step.outputShape ? <ShapeChip shape={step.outputShape} indent={INDENT} /> : null}
      <TileCostLines step={step} audience="maker" groups={props.costGroups ?? []} indent={INDENT} />
      {isTeam ? null : <OutsideWarning names={outsideOf(step, props.names)} style={{ marginLeft: INDENT }} />}
      {shown ? (
      <div data-testid="container-inside" style={{ marginLeft: INDENT, paddingLeft: 16, borderLeft: `1px solid ${t.hairlineModule}`, display: "flex", flexDirection: "column", gap: 8 }}>
        {step.children.map((child, index) => {
          const own = isTeam ? child.children.filter((grand) => !grand.id.endsWith(":instructions")) : [];
          const open = isTeam && openAgent === child.id;
          return (
            <div key={child.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {isTeam && index === 1 ? (
                <span data-testid="handed-work-to" style={{ ...text(11.5, 500, t.label), paddingTop: 4 }}>
                  {TEAM_COPY.handedTo}
                </span>
              ) : null}
              <InnerCard
                step={child}
                eyebrow={isTeam ? (index === 0 ? TEAM_COPY.lead : TEAM_COPY.agent(stepTitle(child))) : undefined}
                runs={isTeam ? stepRunsLabel(child) : undefined}
                outside={isTeam ? outsideOf(child, props.names) : []}
                made={props.madeNames?.[child.id]}
                phone={props.phone}
                team={isTeam ? step.children : undefined}
              />
              {own.length > 0 ? (
                <div style={{ paddingLeft: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span>
                    <TextButton
                      target={props.phone}
                      aria-expanded={open}
                      style={text(12.5, 500, t.text2)}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenAgent(open ? null : child.id);
                      }}
                    >
                      {open ? `Hide its ${own.length === 1 ? "prompt" : `${own.length} prompts`}` : `Show its ${own.length === 1 ? "prompt" : `${own.length} prompts`}`}
                    </TextButton>
                  </span>
                  {open ? own.map((grand) => <InnerCard key={grand.id} step={grand} nested made={props.madeNames?.[grand.id]} phone={props.phone} />) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {isTeam ? (
          <GhostAdd label="Add an agent to this team" phone={props.phone} onClick={() => props.onAddAgentTo(step.id)} />
        ) : adding ? (
          <AgentPromptField agent={step} props={props} onDone={() => setAdding(false)} />
        ) : (
          <GhostAdd label="Add a prompt to this agent" phone={props.phone} onClick={() => setAdding(true)} />
        )}
        {props.onAddFromLibrary && !adding ? <GhostAdd label={isTeam ? "Add an agent from Library" : "Add a prompt from Library"} phone={props.phone} onClick={() => props.onAddFromLibrary?.(step.id)} /> : null}
      </div>
      ) : null}
      <MentionedLine to={refTo({ kind: "node", id: step.id })} phone={props.phone} />
      <TileFoot
        step={step}
        props={props}
        link={
          folds ? (
            <FooterLink phone={phone} expanded={unfolded} onClick={() => setUnfolded((open) => !open)}>
              {unfolded ? (isTeam ? "Hide agents" : "Hide prompts") : isTeam ? "Show agents" : "Show prompts"}
            </FooterLink>
          ) : null
        }
      />
    </div>
  );
}

/** The keyboard's way to move a tile, on its own row, when there is one. */
function NestFoot({ step, phone }: { step: Step; phone: boolean }) {
  const nest = useContext(ListNestContext);
  if (!nest) return null;
  const above = nest.above(step.id);
  if (!above || !nest.canNest(step.id, above.id)) return null;
  return (
    <div style={footRow(INDENT)}>
      <NestButtons step={step} phone={phone} />
    </div>
  );
}

/** Work done outside AI (UI-P70): a module like a prompt's, its eyebrow saying so; no new colour. */
/**
 * CA-12: a tile that is a module with a head (grip, number, eyebrow and title, colour, options) and a body of its own: a
 * manual step, a tool, a file. The body is the shared one (`tileBodies`), so the maker sees what readers see.
 */
function PlainCard({ step, index, last, props, noun, body, after, link, typeLine }: { step: Step; index: number; last: boolean; props: BuildListProps; noun: string; body: (indent: number) => ReactNode; after?: ReactNode; link?: ReactNode; typeLine?: ReactNode }) {
  const focus = useItemRing(step.id);
  const { phone } = props;
  const picked = usePicked(step.id);
  const selected = props.selectedId === step.id || picked;
  const rename = useRename(step, props);
  const nest = useNestTile(step.id);
  const cardRef = useCardRef(step.id, nest.setRef);
  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={`${noun} ${step.number}: ${stepTitle(step)}`}
      data-testid="step-card"
      data-kind={step.kind}
      data-tile-id={step.id}
      data-selected={selected ? "true" : undefined}
      tabIndex={0}
      {...focus.bind}
      onClick={() => props.onSelect(step.id)}
      onDoubleClick={props.phone ? undefined : () => props.onEditTile?.(step.id)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          props.onSelect(step.id);
        }
      }}
      style={{ ...tileCard(selected), outline: "none", ...focus.ring, cursor: "pointer", ...colourEdge(step.colour), ...(nest.takes ? TAKES : null) }}
    >
      <TileHeader
        step={step}
        nest={nest}
        phone={phone}
        typeLine={typeLine ?? typeLineOf(step)}
        typeTestId={`${step.kind}-eyebrow`}
        title={<TileTitle step={step} rename={rename} noun={noun} phone={phone} />}
        menu={<TileMenu step={step} noun={noun} index={index} last={last} props={props} rename={rename} />}
      />
      {body(INDENT)}
      {after}
      <MadeLine names={props.madeNames?.[step.id]} />
      <MentionedLine to={refTo({ kind: "node", id: step.id })} phone={props.phone} />
      <SentWithList step={step} props={props} />
      <TileFoot step={step} props={props} link={link} />
    </div>
  );
}

function ManualCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  const [all, setAll] = useState(false);
  const steps = step.lines?.length ?? 0;
  return (
    <PlainCard
      step={step}
      index={index}
      last={last}
      props={props}
      noun="Manual step"
      body={(indent) => <ManualTileBody step={step} picture={false} lean all={all} indent={indent} />}
      link={
        steps > MANUAL_LEAN_LINES || step.mediaId ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {steps > MANUAL_LEAN_LINES ? (
              <FooterLink phone={props.phone} expanded={all} onClick={() => setAll((open) => !open)}>
                {all ? "Show fewer steps" : "Show all steps"}
              </FooterLink>
            ) : null}
            {step.mediaId ? <ManualThumb mediaId={step.mediaId} /> : null}
          </span>
        ) : null
      }
    />
  );
}

/** CA-12 P7: a tool as a tile: its app's mark and name, and what it did. How it was connected is in its type line. */
function ToolCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="Tool" body={(indent) => <ToolTileBody step={step} lean indent={indent} />} />;
}

/** CA-13 P2: a decision as a tile: one line per question, the first two. It runs in the app, which its tile in Details says. */
function DecisionCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="Decision" body={(indent) => <DecisionTileBody step={step} lean indent={indent} />} after={<TileCostLines step={step} audience="maker" groups={props.costGroups ?? []} indent={INDENT} />} />;
}

/** SV-29 P2: a Retrieval tile: what it indexes, how many it returns and how well; the index and query are on the build page and in Details. */
function RetrievalCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="Retrieval" body={(indent) => <RetrievalTileBody step={step} lean indent={indent} />} after={<TileCostLines step={step} audience="maker" groups={props.costGroups ?? []} indent={INDENT} />} />;
}

/** CA-15 P9: a system prompt as a tile: its text in two lines, with its variables as chips; what it applies to is in its type line. */
function SystemPromptCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="System prompt" body={(indent) => <SystemPromptTileBody step={step} indent={indent} />} />;
}

/** CA-15 P9: a dataset as a tile: what it is and its columns; its use is in its type line. */
function DatasetCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="Dataset" body={(indent) => <DatasetTileBody step={step} indent={indent} />} />;
}

/** CA-15 P9: a GitHub repository as a tile: what it is for and how it was used, with a link to it. */
function RepoCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="GitHub repository" body={(indent) => <RepoTileBody step={step} indent={indent} />} link={step.repo ? <OpenOnGitHub url={step.repo.url} /> : null} />;
}

/** CA-12 P8: a file as a tile: its mark and name, and a short preview; its type and size are in its type line. */
function FileCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="File" body={(indent) => <FileTileBody step={step} lean indent={indent} />} />;
}

/** CA-02 P7: lines of code, as a module like a manual step's: its type line (language and length), then its first 3 lines in a mono well. */
function CodeCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  const focus = useItemRing(step.id);
  const { phone } = props;
  const picked = usePicked(step.id);
  const selected = props.selectedId === step.id || picked;
  const rename = useRename(step, props);
  const [all, setAll] = useState(false);
  const nest = useNestTile(step.id);
  const cardRef = useCardRef(step.id, nest.setRef);
  const lines = lineCount(step.text);
  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={`Code ${step.number}: ${stepTitle(step)}`}
      data-testid="step-card"
      data-kind="code"
      data-selected={selected ? "true" : undefined}
      tabIndex={0}
      {...focus.bind}
      onClick={() => props.onSelect(step.id)}
      onDoubleClick={props.phone ? undefined : () => props.onEditTile?.(step.id)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          props.onSelect(step.id);
        }
      }}
      style={{ ...tileCard(selected), outline: "none", ...focus.ring, cursor: "pointer", ...colourEdge(step.colour), ...(nest.takes ? TAKES : null) }}
    >
      <TileHeader
        step={step}
        nest={nest}
        phone={phone}
        typeLine={typeLineOf(step)}
        typeTestId="code-eyebrow"
        title={<TileTitle step={step} rename={rename} noun="Code" phone={phone} />}
        menu={<TileMenu step={step} noun="Code" index={index} last={last} props={props} rename={rename} />}
      />
      <div style={{ paddingLeft: INDENT, minWidth: 0 }}>
        <CodePartLine step={step} style={{ paddingLeft: INDENT }} />
        <SmallCodeWell text={step.text} lines={all ? Number.POSITIVE_INFINITY : CODE_TILE_LINES} label={`Code ${step.number}`} />
      </div>
      <LinkLines lines={[...callsOf(step.id, props.steps), ...definesOf(step.id, props.steps)]} onOpen={props.onSelect} indent={INDENT} />
      <TileCostLines step={step} audience="maker" groups={props.costGroups ?? []} indent={INDENT} />
      <MadeLine names={props.madeNames?.[step.id]} />
      <MentionedLine to={refTo({ kind: "node", id: step.id })} phone={props.phone} />
      <SentWithList step={step} props={props} />
      <TileFoot
        step={step}
        props={props}
        link={
          lines > CODE_TILE_LINES ? (
            <FooterLink phone={phone} expanded={all} onClick={() => setAll((open) => !open)}>
              {all ? "Show fewer lines" : `Show all ${lines.toLocaleString("en-GB")} lines`}
            </FooterLink>
          ) : null
        }
      />
    </div>
  );
}

/** How many lines of code a tile shows before "Show all <n> lines". */
export const CODE_TILE_LINES = 3;

/** CA-03 P5: how the build checked its work: its pass criteria, and one status line with a 7px dot. */
function CheckCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  const focus = useItemRing(step.id);
  const { phone } = props;
  const picked = usePicked(step.id);
  const selected = props.selectedId === step.id || picked;
  const rename = useRename(step, props);
  const nest = useNestTile(step.id);
  const cardRef = useCardRef(step.id, nest.setRef);
  const status = step.check ? checkStatus(step.check) : null;
  const criteria = step.check?.passing.trim() ?? "";
  const history = step.check ? checkHistoryLine(step.check.runs) : null;
  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={`Check ${step.number}: ${stepTitle(step)}`}
      data-testid="step-card"
      data-kind="check"
      data-selected={selected ? "true" : undefined}
      tabIndex={0}
      {...focus.bind}
      onClick={() => props.onSelect(step.id)}
      onDoubleClick={props.phone ? undefined : () => props.onEditTile?.(step.id)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          props.onSelect(step.id);
        }
      }}
      style={{ ...tileCard(selected), outline: "none", ...focus.ring, cursor: "pointer", ...colourEdge(step.colour), ...(nest.takes ? TAKES : null) }}
    >
      <TileHeader
        step={step}
        nest={nest}
        phone={phone}
        typeLine={typeLineOf(step)}
        typeTestId="check-eyebrow"
        title={<TileTitle step={step} rename={rename} noun="Check" phone={phone} />}
        menu={<TileMenu step={step} noun="Check" index={index} last={last} props={props} rename={rename} />}
      />
      {criteria ? (
        <p data-testid="check-criteria" style={{ ...text(13, 400, t.text), lineHeight: "20px", margin: 0, paddingLeft: INDENT, overflowWrap: "anywhere", ...clamp2 }}>
          <span style={{ ...text(12.5, 400, t.text2) }}>Pass criteria: </span>
          {criteria}
        </p>
      ) : null}
      {status ? (
        <DotLine testId="check-status" dot={status.allPassed ? t.evidence : t.catBreakage} style={{ paddingLeft: INDENT, ...text(13, 400, t.text), lineHeight: "20px" }}>
          <span style={tnum}>{status.line}</span>
        </DotLine>
      ) : null}
      {history ? (
        <DotLine testId="check-history" style={{ paddingLeft: INDENT }}>
          <span style={tnum}>{history}</span>
        </DotLine>
      ) : null}
      <MentionedLine to={refTo({ kind: "node", id: step.id })} phone={props.phone} />
      <SentWithList step={step} props={props} />
      <TileFoot step={step} props={props} />
    </div>
  );
}

/** CA-10: what stands in for a Result while Add writes it. */
export type PendingAdd = "result";
export const PENDING_ADD_COPY: Record<PendingAdd, { eyebrow: string; adding: string }> = {
  result: { eyebrow: "Result", adding: "Adding a result…" },
};

function PendingAddCard({ kind }: { kind: PendingAdd }) {
  return (
    <div data-testid="add-pending" data-kind={kind} aria-busy="true" style={{ ...tileCard(false), flexDirection: "row", alignItems: "center", gap: 12 }}>
      <span
        aria-hidden="true"
        style={{ width: 24, height: 24, borderRadius: 6, background: t.evidenceFill, color: t.evidence, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
      >
        <Glyph name="check" size={14} />
      </span>
      <div role="status" style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <Quiet>{PENDING_ADD_COPY[kind].eyebrow}</Quiet>
        <span style={text(14, 500, t.text2)}>{PENDING_ADD_COPY[kind].adding}</span>
      </div>
    </div>
  );
}

function ResultCard({ result, selected, ringed = false, onSelect, onEdit }: { result: ListResult; selected: boolean; ringed?: boolean; onSelect: (id: string) => void; onEdit?: (id: string) => void }) {
  const focus = useItemRing(result.id);
  return (
    <div
      data-testid="result-card"
      data-tile-id={result.id}
      role="button"
      tabIndex={0}
      {...focus.bind}
      aria-pressed={selected}
      onClick={() => onSelect(result.id)}
      onDoubleClick={onEdit ? () => onEdit(result.id) : undefined}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect(result.id);
        }
      }}
      style={{ ...tileCard(selected), flexDirection: "row", alignItems: "flex-start", gap: 12, outline: "none", ...focus.ring, cursor: "pointer", ...ring(ringed) }}
    >
      <span
        aria-hidden="true"
        style={{ width: 24, height: 24, borderRadius: 6, background: t.evidenceFill, color: t.evidence, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
      >
        <Glyph name="check" size={14} />
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flexGrow: 1 }}>
        <span data-testid="result-eyebrow" style={{ ...text(11.5, 400, t.label), ...ellipsis }}>
          {resultTypeLine(result.facts)}
        </span>
        <span title={result.title} style={{ ...text(14, 500, t.text), ...ellipsis }}>
          {result.title}
        </span>
        <ResultTileBody facts={result.facts} />
        <TileFooter facts={[resultHolds(result.facts) ? result.holds : null, result.from ? `from prompt ${result.from}` : null]} />
      </div>
    </div>
  );
}

/* ── the add field ── */

export const ADD_PROMPT_COPY = {
  /** CA-02 P4: the tool changed and does not offer the model that was chosen. */
  cleared: MODEL_PICKER_COPY.cleared,
  /** CA-02 P4: a tool that runs prompts by itself, named on a prompt. */
  runsItself: TOOL_PICKER_COPY.runsItself,
  addAsAgent: "Add as an agent",
} as const;

/** How long the "Model cleared" line stays. */
export const CLEARED_NOTE_MS = MODEL_CLEARED_MS;

/** What "Add as an agent" hands the agent dialog: the tool as the harness, the field's text as the instructions. */
export interface AddAsAgentInput {
  harness: string;
  instructions: string;
}

function AddPrompt({
  phone,
  onAddPrompt,
  onAddAsAgent,
  onKeepAsCode,
  addPromptRef,
  addPromptFlash = 0,
  inBuild = [],
  sessionTool = null,
  sessionKey = null,
}: Pick<BuildListProps, "phone" | "onAddPrompt" | "onAddAsAgent" | "onKeepAsCode" | "addPromptRef" | "addPromptFlash" | "inBuild"> & {
  /** The tool its session is typed in: the prompt starts with it, and the maker can still change it. */
  sessionTool?: string | null;
  /** The session the prompt box sits in; it is named by where it stands, so no "Adding to" picker is drawn. */
  sessionKey?: string | null;
}) {
  const [value, setValue] = useState("");
  /** CA-02 P7: true once text was pasted in, until the field is emptied. Only pasted text is offered as code. */
  const [pasted, setPasted] = useState(false);
  const [tool, setTool] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cleared, setCleared] = useState<string | null>(null);
  const announce = useAnnounce();
  useEffect(() => {
    if (cleared) announce(cleared);
  }, [cleared, announce]);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const setField = useCallback(
    (element: HTMLTextAreaElement | null) => {
      field.current = element;
      if (typeof addPromptRef === "function") addPromptRef(element);
      else if (addPromptRef) (addPromptRef as MutableRefObject<HTMLTextAreaElement | null>).current = element;
    },
    [addPromptRef],
  );

  /* CA-10: reached from Add › Prompt, the block is ringed for a moment so the eye finds it. The focus itself was
     given in the tap; this only draws. */
  const [lit, setLit] = useState(false);
  useEffect(() => {
    if (addPromptFlash === 0) return;
    setLit(true);
    const timer = window.setTimeout(() => setLit(false), ADD_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [addPromptFlash]);

  /* CA-04 P1, CA-14 P5: the session the box stands in gives it its tool; the maker can still change it. */
  useEffect(() => {
    if (sessionKey === null) return;
    setTool(sessionTool ? (toolFor(sessionTool)?.id ?? sessionTool) : null);
    setModel(null);
  }, [sessionKey, sessionTool]);

  useEffect(() => {
    if (!cleared) return;
    const timer = window.setTimeout(() => setCleared(null), CLEARED_NOTE_MS);
    return () => window.clearTimeout(timer);
  }, [cleared]);

  const toolLabel = tool ? (toolName(tool) ?? tool.trim()) : null;
  const known = toolFor(tool);
  /* A tool that runs prompts by itself saves no prompt: the field offers to add it as an agent instead. */
  const redirect = known !== null && runsItself(known);

  const changeTool = (next: string | null) => {
    setTool(next);
    const after = nextModelAfterToolChange(next, model);
    if (after.cleared && model) setCleared(ADD_PROMPT_COPY.cleared(toolName(next) ?? (next ?? "").trim(), model));
    else setCleared(null);
    setModel(after.model);
  };

  const submit = async () => {
    if (!value.trim() || busy || redirect) return;
    setBusy(true);
    const saved = await onAddPrompt({ text: value, tool, model });
    setBusy(false);
    if (saved) {
      setValue("");
      setPasted(false);
    }
  };

  /* Never converted by itself: the maker chooses to keep it as code, and the field keeps its text until it is saved. */
  const offerCode = pasted && Boolean(onKeepAsCode) && looksLikeCode(value);
  const asCode = async () => {
    if (!onKeepAsCode) return;
    if (await onKeepAsCode(value)) {
      setValue("");
      setPasted(false);
    }
  };

  const asAgent = async () => {
    if (!known || !onAddAsAgent) return;
    // The field keeps its text until the agent is saved.
    const saved = await onAddAsAgent({ harness: known.id, instructions: value });
    if (saved) {
      setValue("");
      setTool(null);
      setModel(null);
    }
  };

  return (
    <div data-testid="add-prompt" data-lit={lit || undefined} style={{ ...moduleStyle(false, 12), display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5, ...ring(lit) }}>
      <textarea
        ref={setField}
        aria-label="Add a prompt"
        rows={2}
        value={value}
        placeholder={LIST_COPY.placeholder}
        onChange={(event) => {
          setValue(event.target.value);
          if (!event.target.value) setPasted(false);
        }}
        onPaste={() => setPasted(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void submit();
          }
        }}
        style={{ ...wellField, resize: "none", padding: 12, fontSize: phone ? 16 : 13.5 }}
      />
      {offerCode ? (
        <div data-testid="keep-as-code" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Quiet>{CODE_COPY.looksLikeCode}</Quiet>
          <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={() => void asCode()}>
            {CODE_COPY.keepAsCode}
          </Button>
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <ToolPicker label={`Prompt tool · ${toolLabel ?? "pick a tool"}`} value={tool} onChange={changeTool} inBuild={inBuild} allowNone phone={phone} step="prompt" />
        {/* CA-03: this row has no field label, so the model menu keeps the word "model" while empty. */}
        {redirect ? null : <ModelPicker tool={tool} value={model} onChange={setModel} phone={phone} placeholder={MODEL_PICKER_COPY.model} />}
        <span style={{ flexGrow: 1 }} />
        <IconButton icon={ArrowUp} glyph="up" label="Add prompt" size={28} disabled={!value.trim() || busy || redirect} onClick={() => void submit()} style={phone ? { width: 44, height: 44 } : undefined} />
      </div>
      {redirect && known ? (
        <div data-testid="add-as-agent" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Quiet>{ADD_PROMPT_COPY.runsItself(known.name)}</Quiet>
          <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} disabled={!onAddAsAgent} onClick={() => void asAgent()}>
            {ADD_PROMPT_COPY.addAsAgent}
          </Button>
        </div>
      ) : null}
      <div data-testid="model-cleared">
        {cleared ? <Quiet>{cleared}</Quiet> : null}
      </div>
    </div>
  );
}

/* ── the list ── */

/** The tiles of a session: 16 in from its head, with the 2px line down their left, 8 in from their edge. */

/** A tile's name in the List's lines, from the tiles by id. */
const labelOf = (tiles: ReadonlyMap<string, Step>, id: string): string => {
  const tile = tiles.get(id);
  return tile ? tileName(tile) : "that tile";
};

/** A session's head and its tiles, registered for the post's links by the session's key. */
/** The gaps a folding run cancels: a session's, between its head and its tiles, and a part's, between its head and its sessions. */
const SESSION_GAP = 4;
const PART_GAP = 8;

function SessionRun({ head, phone: _phone, first, lit = false, found = false, part: partKey = "", hidden = false, children }: { head: SourceSession | null; phone: boolean; first: boolean; lit?: boolean; found?: boolean; part?: string; hidden?: boolean; children: ReactNode }) {
  const part = usePartRef(head && !head.key.startsWith("typed-legacy-") ? refTo({ kind: "session", id: head.key }) : null);
  // CA-06 P4: a coloured session has a thin line round its head and its tiles, and room inside it only then.
  const colour = head?.colour;
  return (
    <div
      ref={part}
      data-session-key={head?.key}
      {...(head ? { "data-skel-kind": "session", "data-skel-id": head.key, "data-skel-container": partKey, [SLIDE_ATTR]: `session:${head.key}` } : null)}
      data-lit={lit || undefined}
      data-session-colour={colour}
      style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, ...(head && !first ? { marginTop: 16 } : null), ...(colour ? { ...outlineFor(colour), padding: 12 } : null), ...(lit ? ring(true) : null), ...(found ? FOUND_RING : null), ...(hidden ? { visibility: "hidden" } : null) }}
    >
      {children}
    </div>
  );
}

/** CA-27 P1: what a find holds open is drawn open, and a fold the maker makes is theirs, not the find's. */
function withFindOpen(props: BuildListProps): BuildListProps {
  const find = props.find;
  if (!find) return props;
  const { forced, release } = find;
  const keep = <A extends unknown[]>(run: ((key: string, closed: boolean, ...rest: A) => void) | undefined) => (run ? (key: string, closed: boolean, ...rest: A) => (release(key), run(key, closed, ...rest)) : undefined);
  const parts = props.parts && forced.size > 0 ? { ...props.parts, parts: props.parts.parts.map((part) => (forced.has(part.view.key) && part.view.collapsed ? { ...part, view: { ...part.view, collapsed: false } } : part)), onToggle: keep(props.parts.onToggle) } : props.parts ? { ...props.parts, onToggle: keep(props.parts.onToggle) } : props.parts;
  const collapsed = props.collapsed && forced.size > 0 ? new Set([...props.collapsed].filter((key) => !forced.has(key))) : props.collapsed;
  return { ...props, collapsed, parts, onToggleCollapsed: keep(props.onToggleCollapsed) };
}

export function BuildList(raw: BuildListProps) {
  const incoming = withFindOpen(raw);
  /* CA-22 P2, P3: what leaves is held on screen while it lifts out, then the new view is drawn and the rest slides; what arrives drops in. */
  const rootHolder = useRef<RefObject<HTMLDivElement | null> | null>(null);
  const busyHolder = useRef(false);
  /* SV-06 P1: the List's one animator. It is the only thing that animates the build list; the hooks below say what is coming. */
  const [listRoot] = useState<RefObject<HTMLElement | null>>(() => ({ get current() { return rootHolder.current?.current ?? null; } }) as RefObject<HTMLElement | null>);
  const motion = useListMotion(listRoot);
  /** A tile moved from its menu: outlined once where it lands, when the slide that takes it there has ended. */
  const ringAfterSlide = useRef<string | null>(null);
  const director = useBuildDirector(incoming, motion, useCallback(() => rootHolder.current?.current ?? null, []), useCallback(() => busyHolder.current, []));
  const base = director.view;
  /* CA-22 P5: a session or part being folded keeps its tiles drawn while they rise away behind the head. */
  const partsFolded = useMemo(() => new Set((base.parts?.parts ?? []).filter((part) => part.view.collapsed).map((part) => part.view.key)), [base.parts]);
  const folding = useFoldMotion({ sessions: base.collapsed, parts: partsFolded, getRoot: useCallback(() => rootHolder.current?.current ?? null, []) });
  const [said, setSaid] = useState("");
  const announce = useAnnounce();
  useEffect(() => {
    if (said) announce(said);
  }, [said, announce]);
  /* CA-21 P3: while something is held, or its write is on its way, the page is drawn from the live order. */
  const baseModel = useMemo(
    () => moveModelOf({ steps: base.steps, heads: base.dividers, empties: base.emptySessions, parts: base.parts?.parts.map((part) => ({ key: part.view.key, sessions: part.sessions })) }),
    [base.steps, base.dividers, base.emptySessions, base.parts],
  );
  const stepsById = new Map(base.steps.flatMap(withSentWith).map((step) => [step.id, step]));
  const headByKey = new Map([...base.dividers.values(), ...(base.emptySessions ?? [])].map((head) => [head.key, head]));
  const names: MoveNames = {
    tile: (id) => {
      const step = stepsById.get(id);
      if (!step) return "that tile";
      const word = tileName(step);
      return step.number && !step.filename ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    },
    session: (key) => (headByKey.get(key) ? `Session ${(headByKey.get(key) as SourceSession).number}` : "that session"),
    part: (key) => base.parts?.parts.find((part) => part.view.key === key)?.view.label ?? "that part",
  };
  const sorting = useBuildSorting({
    model: baseModel,
    phone: base.phone,
    names,
    canTake: (id, parentId) => base.canNest?.(id, parentId) ?? false,
    collapsed: base.collapsed,
    onOpen: (key) => base.onToggleCollapsed?.(key, false),
    commit: (commit: Commit) => {
      const write = commit.write;
      if (write.kind === "tile" && write.session) return base.onMoveToSession?.(commit.held.id, write.session, { order: write.atEnd, sentence: commit.sentence, notice: true, failed: "Tile not moved" });
      if (write.kind === "nested" && write.parent !== undefined && write.index !== undefined) return base.onNest?.(write.id, write.parent, write.index);
      if (write.kind === "session") {
        if (write.toPart) return write.before ? base.onDropSession?.(write.id, write.before) : base.onDropOnWorkstream?.(write.id, write.toPart);
        // Within its part it takes the place of the session that stood where it lands.
        const now = locate(commit.end, write.id);
        const over = now?.kind === "session" ? commit.start.parts.find((part) => part.key === now.part)?.sessions[now.index] : undefined;
        return over ? base.onDropSession?.(write.id, over) : undefined;
      }
      if (write.kind === "part" && write.over) return base.onDropWorkstream?.(write.id, write.over);
      return undefined;
    },
    send: async (id, parentId) => (await base.onNest?.(id, parentId, Number.MAX_SAFE_INTEGER)) ?? false,
    sentLine: (id, parentId) => NEST_LIST_COPY.nowSentWith(labelOf(stepsById, id), labelOf(stepsById, parentId)),
    say: setSaid,
    restOf: motion.restOf,
  });
  /* CA-21 P6: Move up and Move down in the menus show the move at once, sliding; when the write does not land, they slide back. */
  const slid = (id: string, by: -1 | 1, run: (id: string, by: -1 | 1) => unknown) => {
    const result = moveBy(baseModel, id, by);
    const written = run(id, by);
    if (result) {
      sorting.show(result.model, "", Promise.resolve(written) as Promise<unknown>);
      // CA-22 P4: it slides (CA-21), and is outlined once where it lands: when that commit's slide has ended (below).
      if (!prefersReducedMotion()) ringAfterSlide.current = id;
    }
    return written as Promise<unknown> | void;
  };
  useLayoutEffect(() => {
    const id = ringAfterSlide.current;
    if (!id) return;
    ringAfterSlide.current = null;
    void motion.plan().slides.finished.then(() => {
      const moved = rootHolder.current?.current?.querySelector<HTMLElement>(`[data-skel-id="${id}"]`);
      if (moved) outlineOnce(moved);
    });
  });
  const shown = viewOf(base, sorting.live);
  const props: BuildListProps = {
    ...shown,
    onMove: (id, by) => slid(id, by, base.onMove),
    sessionOps: shown.sessionOps ? { ...shown.sessionOps, onMove: (key, by) => void slid(key, by, base.sessionOps?.onMove ?? (() => undefined)) } : undefined,
    parts: shown.parts ? { ...shown.parts, ops: shown.parts.ops ? { ...shown.parts.ops, onMove: (key, by) => void slid(key, by, base.parts?.ops?.onMove ?? (() => undefined)) } : undefined } : undefined,
  };
  rootHolder.current = sorting.rootRef;
  busyHolder.current = sorting.live !== null || sorting.skeleton !== null;
  const { steps } = props;
  const prompts = steps.filter((step) => step.kind === "prompt");
  /* CA-04 P2: tiles move once there is somewhere to move them: two steps, or a tile already inside one. */
  const nestOn = Boolean(props.onNest) && (steps.length > 1 || steps.some((step) => (step.sentWith?.length ?? 0) > 0));
  /** CA-17 P2: "+ Add a session to this part" in an empty part opens the Add a session picker with that part chosen. */
  const [addFor, setAddFor] = useState<{ part: string; n: number } | null>(null);
  const tiles = new Map(steps.flatMap(withSentWith).map((step) => [step.id, step]));
  const label = (id: string) => {
    const tile = tiles.get(id);
    return tile ? tileName(tile) : "that tile";
  };
  const topOf = (id: string): Step | undefined => steps.find((step) => withSentWith(step).some((tile) => tile.id === id));

  const move = (id: string, parentId: string | null, index: number) => {
    void props.onNest?.(id, parentId, index).then((done) => {
      if (done) setSaid(parentId ? NEST_LIST_COPY.nowSentWith(label(id), label(parentId)) : NEST_LIST_COPY.nowOwnStep(label(id)));
    });
  };
  const nest: ListNest | null = nestOn
    ? {
        move,
        canNest: (id, parentId) => props.canNest?.(id, parentId) ?? false,
        // The step above is read from the build as it stands (not the live order of a drag), so no tile gains or loses its "Send with" line, and so its size, while something is held.
        above: (id) => {
          const at = base.steps.findIndex((step) => step.id === id);
          return at > 0 ? base.steps[at - 1] : null;
        },
        after: (id) => {
          const top = topOf(id);
          return top ? steps.indexOf(top) + 1 : steps.length;
        },
        copy: (step) => {
          const words = copyTogether(step);
          const done = () => setSaid(NEST_LIST_COPY.copied(tileName(step)));
          try {
            void navigator.clipboard?.writeText(words).then(done, () => undefined);
          } catch {
            /* No clipboard: nothing to say. */
          }
        },
      }
    : null;
  const card = (step: Step) =>
    step.kind === "prompt" ? (
      <StepCard key={step.id} step={step} index={prompts.indexOf(step)} last={prompts.indexOf(step) === prompts.length - 1} props={props} />
    ) : step.kind === "manual" ? (
      <ManualCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "tool" ? (
      <ToolCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "decision" ? (
      <DecisionCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "retrieval" ? (
      <RetrievalCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "system_prompt" ? (
      <SystemPromptCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "dataset" ? (
      <DatasetCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "repo" ? (
      <RepoCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "file" ? (
      <FileCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "code" ? (
      <CodeCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "check" ? (
      <CheckCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : (
      <ContainerCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    );
  /* CA-27 P3: a build of WINDOW_FROM tiles or more draws only the tiles near the view; the ones the page needs stay drawn. */
  const windowed = nestOn && steps.length >= WINDOW_FROM;
  const forcedTop = new Set<string>();
  if (windowed) {
    for (const id of [props.selectedId, props.ringedId, props.find?.view.current, sorting.hidden, props.reveal?.id]) {
      const top = id ? topOf(id) : undefined;
      if (top) forcedTop.add(top.id);
    }
  }
  /* Each top-level tile stands in a wrapper the page can find (to measure, to slide and to hide while it is held). */
  const placed = (step: Step) => {
    if (!nestOn) return card(step);
    const box = {
      "data-skel-kind": "tile",
      "data-skel-id": step.id,
      "data-skel-container": containerOfTile.get(step.id) ?? "",
      [SLIDE_ATTR]: `tile:${step.id}`,
      style: { position: "relative", display: "flex", flexDirection: "column", minWidth: 0, ...(sorting.hidden === step.id ? { visibility: "hidden" } : null) } as CSSProperties,
    };
    if (windowed) return <WindowedTile key={step.id} id={step.id} kind={step.kind} index={steps.indexOf(step)} forced={forcedTop.has(step.id)} box={box} render={() => card(step)} />;
    return (
      <div key={step.id} {...box}>
        {card(step)}
      </div>
    );
  };
  const runs = listRuns(steps, props.dividers, props.emptySessions ?? []);
  const arrival = useArrival({ arriving: base.arriving, landed: Boolean(base.arriving && runs.some((run) => run.head?.key === base.arriving?.key)), rootRef: sorting.rootRef, motion, onArrived: base.onArrived });
  const containerOfTile = new Map(runs.flatMap((run) => (run.head ? run.steps.map((step) => [step.id, run.head?.key ?? ""] as const) : [])));
  const numberDigits = String(runs.reduce((most, run) => Math.max(most, run.head?.number ?? 0), 0)).length;
  const headOrder = runs.flatMap((run) => (run.head && !run.head.key.startsWith("typed-legacy-") ? [run.head.key] : []));
  const headed = runs.some((run) => run.head);
  /* CA-17 P2: with two or more parts the sessions stand in part groups; with one, nothing about parts is drawn. */
  const parts = props.parts && props.parts.parts.length >= 2 ? props.parts : null;
  const partOfSession = new Map<string, ListPart>();
  if (parts) for (const part of parts.parts) for (const key of part.sessions) partOfSession.set(key, part);
  const numberByKey = new Map(runs.flatMap((run) => (run.head ? [[run.head.key, run.head.number] as const] : [])));
  /* CA-21 P1: where everything stands, for Move up and Move down. */
  const moveModel: MoveModel = moveModelOf({ steps, heads: props.dividers, empties: props.emptySessions, parts: parts?.parts.map((part) => ({ key: part.view.key, sessions: part.sessions })) });
  /* CA-21 P7: the part a session on its way joins: the one it was added to, else the last. */
  const arrivingPart = parts ? (parts.parts.find((part) => part.view.key === base.arriving?.part)?.view.key ?? parts.parts[parts.parts.length - 1].view.key) : null;
  const drawRun = (run: Run, at: number, inPart: ListPart | null = null) => {
        const key = run.head?.key ?? null;
        const closed = key !== null && Boolean(props.onToggleCollapsed) && Boolean(props.collapsed?.has(key));
        /** What is drawn: a fold in progress still shows the tiles. */
        const shut = closed && !(key !== null && folding.sessions.has(key));
        const tilesId = `session-tiles-${key ?? run.key}`;
        const headed = run.head !== null;
        const editable = headed && !run.head.key.startsWith("typed-legacy-");
        const here = inPart ? inPart.sessions.indexOf(key ?? "") : -1;
        const isFirstHead = inPart ? here === 0 : headed && headOrder.indexOf(run.head.key) === 0;
        const isLastHead = inPart ? here === inPart.sessions.length - 1 : headed && headOrder.indexOf(run.head.key) === headOrder.length - 1;
        const emptyDraft = steps.length === 0 && at === 0;
        const promptHere = headed && (props.promptIn === key || emptyDraft);
        const sameStageAs = parts && inPart && key && here > 0 && parts.withAbove?.has(key) ? `Session ${numberByKey.get(inPart.sessions[here - 1]) ?? ""}`.trim() : undefined;
        return (
          <SessionRun key={run.key} head={run.head} phone={props.phone} first={at === 0 || inPart !== null} lit={Boolean(key && props.ringedSession?.key === key)} found={Boolean(key && props.find?.view.current === key)} part={inPart?.view.key} hidden={Boolean(key && sorting.hidden === key)}>
            {run.head ? (
              <SessionHead
                session={run.head}
                numberDigits={numberDigits}
                phone={props.phone}
                tiles={run.steps.length}
                collapsed={closed}
                controls={tilesId}
                onToggle={() => props.onToggleCollapsed?.(run.head.key, !closed)}
                first={isFirstHead}
                last={isLastHead}
                canMove={editable ? (by) => canMoveIn(moveModel, run.head.key, by) : undefined}
                ops={props.sessionOps}
                editable={editable}
                part={parts && inPart ? { moveTo: parts.parts.filter((other) => other !== inPart).map((other) => ({ key: other.view.key, label: other.title })), firstInPart: here === 0, withAbove: Boolean(key && parts.withAbove?.has(key)) } : undefined}
                onOpenSetup={props.onOpenSetup}
                onPickApp={props.onPickApp}
                inBuild={props.inBuild}
                onEdit={props.onEditTile ? () => props.onEditTile?.(run.head.key) : undefined}
                onColour={props.onColour ? (anchor) => props.onColour?.(refTo({ kind: "session", id: run.head.key }), anchor, `Session ${run.head.number}`, run.head.colour ?? null) : undefined}
              />
            ) : null}
            {run.head ? (
              <SessionTiles id={tilesId} sessionKey={run.head.key} hidden={shut} skip={steps.length >= WINDOW_FROM} style={headed ? (closed && !shut ? { ...RUN, ...foldShut(SESSION_GAP) } : RUN) : undefined}>
                {shut ? null : (
                  <>
                    <MentionedLine to={refTo({ kind: "session", id: run.head.key })} phone={props.phone} />
                    <SessionLines session={sameStageAs ? { ...run.head, sameStageAs } : run.head} />
                    {drawBranches(run.steps, (step) => step, steps, placed)}
                    {/* SV-07 P6: an empty session looks one way, "No tiles yet" and "+ Add tile"; the dashed place shows only while a tile is dragged. */}
                    {run.steps.length === 0 && !promptHere ? sorting.held && sorting.held.type !== "session" && sorting.held.type !== "part" ? <EmptyPlace words="Drop a tile here" /> : <p style={{ ...text(13, 400, t.label), margin: 0 }}>{SESSION_HEAD_COPY.noTiles}</p> : null}
                    {promptHere ? (
                      <AddPrompt
                        phone={props.phone}
                        onAddPrompt={props.onAddPrompt}
                        onAddAsAgent={props.onAddAsAgent}
                        onKeepAsCode={props.onKeepAsCode}
                        addPromptRef={props.addPromptRef}
                        addPromptFlash={props.addPromptFlash}
                        inBuild={props.inBuild}
                        sessionTool={run.head.tool === NO_APP ? null : run.head.tool}
                        sessionKey={run.head.key}
                      />
                    ) : null}
                    {editable && props.addToSession ? props.addToSession(run.head.key) : null}
                  </>
                )}
              </SessionTiles>
            ) : (
              drawBranches(run.steps, (step) => step, steps, placed)
            )}
          </SessionRun>
        );
  };
  const drawPart = (part: ListPart, at: number) => {
    const view = part.view;
    const mine = runs.filter((run) => run.head && (partOfSession.get(run.head.key) ?? parts?.parts[0]) === part);
    const bodyId = `workstream-body-${view.key}`;
    const neighbour = parts?.parts[at - 1] ?? parts?.parts[at + 1];
    const count = parts?.parts.length ?? 0;
    return (
      <div key={view.key} data-testid="workstream-group" data-workstream-group={view.key} data-skel-kind="part" data-skel-id={view.key} data-skel-container="" {...{ [SLIDE_ATTR]: `part:${view.key}` }} style={{ ...WORKSTREAM_GROUP, ...(sorting.hidden === view.key ? { visibility: "hidden" } : null), ...(props.find?.view.current === view.key ? FOUND_RING : null) }}>
        <FramePieces radius={WORKSTREAM_FRAME.radius} colour={WORKSTREAM_FRAME.colour} />
        <WorkstreamHead
          part={view}
          phone={props.phone}
          first={at === 0}
          last={at === count - 1}
          controls={bodyId}
          onToggle={() => parts?.onToggle?.(view.key, !view.collapsed)}
          ops={parts?.ops}
          startsAfterChoices={part.startsAfterChoices}
          joins={neighbour?.view.label ?? ""}
          onColour={parts?.onColour ? (anchor) => parts.onColour?.(view.key, anchor, part.title, view.colour ?? null) : undefined}
        />
        <MentionedLine to={refTo({ kind: "workstream", id: view.key })} phone={props.phone} />
        <div id={bodyId} data-testid="workstream-body" hidden={view.collapsed && !folding.parts.has(view.key)} style={view.collapsed && folding.parts.has(view.key) ? { ...WORKSTREAM_BODY, ...foldShut(PART_GAP) } : WORKSTREAM_BODY}>
          {view.collapsed && !folding.parts.has(view.key) ? null : mine.length > 0 || (arrival.block && arrivingPart === view.key) ? (
            <>
              {mine.map((run) => drawRun(run, runs.indexOf(run), part))}
              {arrival.block && base.arriving && arrivingPart === view.key ? <ArrivingBlock arriving={base.arriving} rootRef={sorting.rootRef} first={mine.length === 0} /> : null}
              {parts?.ops?.onOpen ? <AskNextSessionRow label={view.label} partKey={view.key} open={view.open} phone={props.phone} onOpen={parts.ops.onOpen} /> : null}
            </>
          ) : (
            <div data-testid="workstream-empty" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, padding: "4px 8px" }}>
              {sorting.held?.type === "session" ? <EmptyPlace words="Drop a session here" /> : <p style={{ ...text(13, 400, t.label), margin: 0 }}>{WORKSTREAM_HEAD_COPY.empty}</p>}
              {parts?.ops ? (
                <TextButton
                  target={props.phone}
                  style={text(13, 500, t.text2)}
                  onClick={() => {
                    setAddFor((current) => ({ part: view.key, n: (current?.n ?? 0) + 1 }));
                    parts.onAddSession?.(view.key);
                  }}
                >
                  {WORKSTREAM_HEAD_COPY.addHere}
                </TextButton>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  };
  useRovingList(sorting.rootRef, props.onSelect);
  const list = (
    /* The global field rule makes a field inherit its size on a desktop (`font-size: inherit !important`), so the
     fields' type is set here, where they inherit it. */
    <div ref={sorting.rootRef} data-testid="build-list" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0, fontSize: 13.5, ...(sorting.skeleton || arrival.skeleton || director.skeleton ? { position: "relative", isolation: "isolate" } : null) }}>
      {sorting.skeleton ? <SkeletonLayer skeleton={sorting.skeleton} shown={sorting.skeletonShown} /> : arrival.skeleton ? <SkeletonLayer skeleton={arrival.skeleton} shown={arrival.shown} fadeIn={arrival.fadeIn} opening={arrival.opening} fadeAfter={arrival.fadeAfter} onGone={arrival.gone} /> : director.skeleton ? <SkeletonLayer skeleton={director.skeleton} shown={director.shown} fadeAfter={FADE_AFTER_MS} onGone={director.gone} /> : null}
      <p style={{ ...text(12, 400, t.label), margin: 0 }}>{props.phone ? LIST_COPY.hintPhone : LIST_COPY.hint}</p>
      {props.costGroups ? <CostStrip steps={steps} groups={props.costGroups} audience="maker" /> : null}
      {parts ? (
        <>
          {runs.filter((run) => !run.head).map((run) => drawRun(run, runs.indexOf(run)))}
          {parts.parts.map((part, at) => drawPart(part, at))}
        </>
      ) : (
        <>
          {runs.map((run, at) => drawRun(run, at))}
          {arrival.block && base.arriving ? <ArrivingBlock arriving={base.arriving} rootRef={sorting.rootRef} first={runs.length === 0} /> : null}
        </>
      )}
      {props.results.map((result) => (
        <ResultCard key={result.id} result={result} selected={props.selectedId === result.id} ringed={props.ringedId === result.id} onSelect={props.onSelect} onEdit={props.phone ? undefined : props.onEditTile} />
      ))}
      {props.pendingAdd ? <PendingAddCard kind={props.pendingAdd} /> : null}
      {/* SV-07 P5: what the List says is heard through the page's one announcer, and the notice is the one thing seen. These
          two keep the last sentence as a record only: never drawn, and hidden from screen readers so nothing is said twice. */}
      {nestOn || said ? (
        <div data-testid="nest-said" aria-hidden="true" style={VISUALLY_HIDDEN}>
          {said}
        </div>
      ) : null}
      <div data-testid="sessions-said" aria-hidden="true" style={VISUALLY_HIDDEN}>
        {props.said}
      </div>
      {/* CA-14 P5: with session heads the prompt box stands in its session; an old draft with none keeps it at the foot, as it was. */}
      {headed ? null : (
        <AddPrompt
          phone={props.phone}
          onAddPrompt={props.onAddPrompt}
          onAddAsAgent={props.onAddAsAgent}
          onKeepAsCode={props.onKeepAsCode}
          addPromptRef={props.addPromptRef}
          addPromptFlash={props.addPromptFlash}
          inBuild={props.inBuild}
        />
      )}
      {props.addSession ? <AddSessionRow phone={props.phone} {...props.addSession} openFor={addFor} /> : null}
      {props.onAddPart ? <AddPartRow phone={props.phone} adding={(props.addSession?.adding ?? false) || Boolean(props.addingPart)} onAdd={props.onAddPart} /> : null}
    </div>
  );
  /* SV-06 P1: what this commit's slides take, when a hook times them: a put back, a fold, a lane opening. */
  const slide: SlideOptions = sorting.settleMs !== null ? { ms: sorting.settleMs } : folding.moving ? { ms: FOLD } : arrival.slideMs !== null ? { ms: arrival.slideMs } : NO_SLIDE;
  const body = (
    <FindProvider value={props.find?.view ?? NO_FIND}>
      <ListMotionContext.Provider value={motion}>
        <MotionBoundary motion={motion} slide={slide}>
          {list}
        </MotionBoundary>
      </ListMotionContext.Provider>
    </FindProvider>
  );
  const sessionOf = new Map<string, string>();
  const sessionNumbers = new Map<string, number>();
  const firstOf = new Set<string>();
  for (const run of runs) {
    if (!run.head || run.head.key.startsWith("typed-legacy-")) continue;
    run.steps.forEach((step, at) => {
      sessionOf.set(step.id, run.head?.key ?? "");
      sessionNumbers.set(step.id, run.head?.number ?? 0);
      if (at === 0) firstOf.add(step.id);
    });
  }
  const refs: ListRefs = {
    mentioned: props.mentioned ?? NO_MENTIONS,
    onBack: props.onBackToPost,
    reveal: props.reveal ?? null,
    onColour: props.onColour,
    sessions: runs.flatMap((run) => (run.head && !run.head.key.startsWith("typed-legacy-") ? [{ key: run.head.key, label: [headName(run.head), run.head.title].filter(Boolean).join(" · ") }] : [])),
    sessionOf,
    sessionNumbers,
    alsoIn: repeatedTiles(runs),
    firstOf,
    onMoveToSession: props.onMoveToSession,
    onSplitHere: props.onSplitHere,
    canMove: (id, by) => canMoveIn(moveModel, id, by),
    hidden: sorting.hidden,
  };
  const sessionLabel = (key: string) => {
    const head = runs.find((run) => run.head?.key === key)?.head;
    return head ? headName(head) : "that session";
  };
  /* Sessions move once there are two to put in order, even when no tile can move yet. */
  const sessionsMove = (Boolean(props.onDropSession) && headOrder.length > 1) || Boolean(parts?.ops);
  // SV-28: a team's, an agent's, a job's and an Approval step's lines open steps and name tools through this.
  const lines = <TeamLinesContext.Provider value={{ open: props.onSelect, names: props.names, phone: props.phone, steps: props.steps.flatMap((step) => [step, ...step.children]) }}>{body}</TeamLinesContext.Provider>;
  if (!nest && !sessionsMove) return <ListRefsContext.Provider value={refs}>{lines}</ListRefsContext.Provider>;
  return (
    <ListRefsContext.Provider value={refs}>
      <ListNestContext.Provider value={nest}>
        <NestList phone={props.phone} sorting={sorting}>
          {lines}
        </NestList>
      </ListNestContext.Provider>
    </ListRefsContext.Provider>
  );
}

const NO_MENTIONS: ReadonlySet<string> = new Set();

export default BuildList;
