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
import { ArrowUp, Link as JoinIcon, MoreHorizontal, Unlink as SplitIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  type Ref,
  useLayoutEffect,
} from "react";

import { Button } from "@/components/brand/Button";
import { drawBranches } from "@/components/build/BranchRows";
import { LinkLines } from "@/components/build/LinkLines";
import { HelperChips, ShapeChip } from "@/components/build/RuntimeChips";
import { CostStrip, TileCostLines } from "@/components/build/CostLines";
import { callsOf } from "@/lib/build/decisionCopy";
import { definesOf } from "@/lib/build/agentCode";
import { CheckCasesBody, DatasetTileBody, FileTileBody, ManualTileBody, OpenOnGitHub, ReplyBlock, RepoTileBody, ResultTileBody, SystemPromptTileBody, TILE_COPY, TileFooter, DecisionTileBody, ToolTileBody, startsLine } from "@/components/build/tileBodies";
import { CodeLines } from "@/components/code/CodeLines";
import { bothRefs, usePartRef } from "@/components/build/partNav";
import { REF_COPY } from "@/components/post/RefLinks";
import { ColourButton } from "@/components/brand/ColourButton";
import { REF_KIND } from "@/lib/build/postRefs";
import { borderFor, outlineFor } from "@/lib/theme/partColour";
import { refTo } from "@/lib/build/thread";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { MenuButton } from "@/components/brand/MenuButton";
import { Pill } from "@/components/brand/Pill";
import type { SessionGroup, Step } from "@/lib/build/graph";
import { footerFactsOf, typeLineOf } from "@/lib/build/tileLines";
import { checkStatus, resultHolds, sentWithLabel, stepRunsLabel, stepTitle, TOOL_TYPE, withSentWith } from "@/lib/build/graph";
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
import { CHECK_COPY, CheckExtraLines, DotLine, NumberTile, Quiet, ToolMark } from "./refinedPieces";
import { AddSessionRow, type AddSessionRowProps } from "./AddSessionRow";
import { FLOATING_Z, ToolPicker } from "./ToolPicker";
import { DragHandle, NestGap, NestList, TAKES, useNestTile, useSessionDragging, type NestTarget } from "./listNest";
import { SESSION_HEAD_COPY, SessionHead, headName, type SessionOps } from "./SessionHead";
import { titleRepeatsText } from "./buildListModel";
import { TOOL_PICKER_COPY, runsItself } from "./toolPickerModel";
import {
  INDENT,
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
import { NO_APP, type SourceSession } from "./sourcesModel";
import { MenuContent, MenuSubContent } from "./ComposeMenu";

/** CA-10: how long the add field is ringed after Add › Prompt reaches it. */
export const ADD_FLASH_MS = 1200;

export const LIST_COPY = {
  hint: "Click a tile to see its details · double-click to read all of it",
  /** CA-10 (CA-09 F12): a phone has no double-click (the card's onDoubleClick is off there) and taps, not clicks. */
  hintPhone: "Tap a tile to see its details",
  placeholder: "Paste or type a prompt…",
  showFull: "Show full prompt",
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
  /** UI-P67's full prompt window. Absent: nothing opens and "Read all of it" is disabled. */
  onOpenPrompt?: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
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
  /** TF-06: "Attach a file" opens the file picker for this prompt. Absent: the item is not shown. */
  onAttach?: (id: string) => void;
  /** TF-06: files dropped on a prompt's card. Only with a fine pointer; absent: a card takes no drop. */
  onDropOnStep?: (id: string, files: File[]) => void;
  fine?: boolean;
  /** TF-08: "Name a file it makes" selects the prompt and opens the Makes field in Details. Absent: the item is not shown. */
  onNameMade?: (id: string) => void;
  /** TF-08: the names of the files each step makes, by step id. */
  madeNames?: Readonly<Record<string, readonly string[]>>;
  /** CA-12 P4: "+ Add a session", the full-width row under the last session. Absent: no row. */
  addSession?: Omit<AddSessionRowProps, "phone">;
  /** CA-14 P3: the sessions that are folded to their head, by key. Any session can be. */
  collapsed?: ReadonlySet<string>;
  /** CA-14 P3: folding or opening a session. Resolves once it is kept. */
  onToggleCollapsed?: (sessionKey: string, collapsed: boolean) => void;
  /** CA-14 P2: what the maker can do to a session's head. Absent: heads show no maker controls. */
  sessionOps?: SessionOps;
  /** CA-14 P4: a session's head dropped on another's. */
  onDropSession?: (key: string, over: string) => void;
  /** CA-14 P5: the "+ Add to this session" row at the end of a session, drawn by the page (it holds the Add items). */
  addToSession?: (sessionKey: string) => ReactNode;
  /** CA-14 P5: the session whose prompt box is open. An empty draft has Session 1's open without it. */
  promptIn?: string | null;
  /** CA-14 P4: a polite line for a screen reader ("Session 3 moved to 2."). */
  said?: string;
  /** CA-14 P7: "Split session here" in a tile's menu. Absent: no item. */
  onSplitHere?: (stepId: string) => void;
  /** CA-12 P5: the session just added is scrolled to and outlined once. `n` changes on every add. */
  ringedSession?: { key: string; n: number } | null;
  /**
   * CA-04 P2: put a tile inside a step, sent with it, at `index` among what it holds, or (null) make it its own step at
   * `index` among the top-level steps. Resolves true once written. Absent: no handles, no drops, no buttons.
   */
  onNest?: (id: string, parentId: string | null, index: number) => Promise<boolean>;
  /** CA-04 P2: whether a tile can go inside a step (`nestRefusal` says no to none of it). */
  canNest?: (id: string, parentId: string) => boolean;
  /** CA-04 P2: a tile dropped on another session's head goes into that session. Resolves true once written. */
  onMoveToSession?: (id: string, sessionKey: string) => Promise<boolean>;
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
export const clamp2: CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

/* ── small pieces ── */

function MenuRow({ children, disabled, onSelect, phone }: { children: ReactNode; disabled?: boolean; onSelect?: () => void; phone: boolean }) {
  return (
    <Menu.Item disabled={disabled} onSelect={onSelect} style={menuItem(!disabled, phone)}>
      {children}
    </Menu.Item>
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
  firstOf?: ReadonlySet<string>;
  onMoveToSession?: BuildListProps["onMoveToSession"];
  onSplitHere?: BuildListProps["onSplitHere"];
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
  /* CA-14 P2: no colour, nothing drawn: "Colour…" in the tile's menu (or Details) is how one is given. */
  if (!onColour || !step.colour || (phone && inMenu)) return null;
  return <ColourButton what={partName(step)} colour={step.colour} size={phone ? 30 : 22} onPick={(anchor) => onColour(refTo({ kind: "node", id: step.id }), anchor, pickerName(step), step.colour ?? null)} />;
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
 * CA-14 P5, P7: "Move to session…" (the other sessions, in a submenu) and, with Split and merge on, "Split session here"
 * (any tile but the first of its session). Nothing for a tile that is not in a session of its own, or with one session.
 */
function SessionTileRows({ step, phone }: { step: Step; phone: boolean }) {
  const refs = useContext(ListRefsContext);
  const mine = refs.sessionOf?.get(step.id);
  if (!mine) return null;
  const others = (refs.sessions ?? []).filter((session) => session.key !== mine);
  return (
    <>
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
 * CA-12 P6: whether the tile around `ref` is hovered or holds focus. "Send with the step above" is a control, so it is drawn
 * as one (a text button with a small join glyph); on a computer it shows while the tile is hovered or focused, and on a phone
 * (no hover) always.
 */
function useTileHover(phone: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const tile = ref.current?.closest<HTMLElement>('[role="group"], [data-testid="sent-with-tile"]');
    if (!tile || phone) return;
    const on = () => setNear(true);
    const off = (event: Event) => {
      if (event.type === "focusout" && tile.contains((event as FocusEvent).relatedTarget as Node | null)) return;
      setNear(false);
    };
    tile.addEventListener("pointerenter", on);
    tile.addEventListener("pointerleave", off);
    tile.addEventListener("focusin", on);
    tile.addEventListener("focusout", off);
    return () => {
      tile.removeEventListener("pointerenter", on);
      tile.removeEventListener("pointerleave", off);
      tile.removeEventListener("focusin", on);
      tile.removeEventListener("focusout", off);
    };
  }, [phone]);
  return { ref, shown: phone || near };
}

/** "Send with the step above" on a top-level tile after the first; "Make it its own step" on a tile inside one. */
function NestButtons({ step, phone }: { step: Step; phone: boolean }) {
  const nest = useContext(ListNestContext);
  const { ref, shown } = useTileHover(phone);
  if (!nest) return null;
  const above = step.inside ? null : nest.above(step.id);
  if (!step.inside && (!above || !nest.canNest(step.id, above.id))) return null;
  const own = Boolean(step.inside);
  const Icon = own ? SplitIcon : JoinIcon;
  return (
    <span ref={ref} data-testid="nest-control" style={{ display: "inline-flex", opacity: shown ? 1 : 0, transition: "opacity 120ms" }}>
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

/** A tile's name in the List's lines: its file name, else "prompt 2", else its kind. */
const tileName = (step: Step) => sentWithLabel(step);

/** A tile inside another: its eyebrow says what it is sent with; it has no number. It can hold more tiles. */
function SentWithTile({ step, props }: { step: Step; props: BuildListProps }) {
  const nest = useNestTile(step.id);
  const cardRef = useCardRef(step.id, nest.setRef);
  const selected = props.selectedId === step.id;
  const named = step.kind === "code" ? (step.filename ?? step.language ?? null) : null;
  const kind = step.kind === "manual" ? "Manual step" : step.kind === "file" ? "File" : step.kind === "code" ? "Code" : step.kind === "check" ? "Check" : step.kind === "agent" ? "Agent" : step.kind === "team" ? "Team" : "Prompt";
  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={`${kind} sent with ${step.inside?.label ?? "a step"}: ${stepTitle(step)}`}
      data-testid="sent-with-tile"
      data-kind={step.kind}
      data-selected={selected ? "true" : undefined}
      tabIndex={0}
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
        cursor: "pointer",
        ...(selected ? { background: t.selectedFill, borderColor: t.selectedEdge, boxShadow: t.selectedRing } : null),
        ...colourEdge(step.colour),
        ...(nest.takes ? TAKES : null),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <DragHandle label={`Move ${tileName(step)}`} nest={nest} />
        <Quiet style={{ ...ellipsis, minWidth: 0, flexGrow: 1 }}>{NEST_LIST_COPY.sentWith(step.inside?.label ?? "the step above")}</Quiet>
        <CardColour step={step} phone={props.phone} />
      </div>
      <span style={{ ...text(13, 500, step.title ? t.text : t.text2), overflowWrap: "anywhere" }}>
        {[kind === "Prompt" ? null : kind, step.title ?? (kind === "Prompt" ? stepTitle(step) : named ?? (step.kind === "file" ? step.filename : null))].filter(Boolean).join(" · ")}
      </span>
      {step.kind === "code" ? (
        <CodeLines text={step.text} compact testId="code-lines" label={`${kind} text`} />
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

/** CA-04 P2: code sent with an imported prompt in the chat, offered dashed: Accept puts it inside, Ignore leaves it. */
function SentWithSuggestions({ step, props }: { step: Step; props: BuildListProps }) {
  if (!props.onKeepSentWith || !props.onIgnoreSentWith) return null;
  const offered = codeInPrompt(step);
  if (offered.length === 0) return null;
  return (
    <div style={{ paddingLeft: INDENT, display: "flex", flexDirection: "column", gap: 8 }}>
      {offered.map((suggestion) => (
        <div
          key={suggestion.key}
          data-testid="sent-with-suggestion"
          onClick={(event) => event.stopPropagation()}
          style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 12px", borderRadius: 6, border: `1px dashed ${t.line}` }}
        >
          <span style={text(12, 400, t.text2)}>{SENT_WITH_COPY.line}</span>
          <span style={{ ...text(12.5, 500, t.text), overflowWrap: "anywhere" }}>{["Code", suggestion.filename ?? (suggestion.language === "other" ? null : suggestion.language), `${lineCount(suggestion.source)} ${lineCount(suggestion.source) === 1 ? "line" : "lines"}`].filter(Boolean).join(" · ")}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button variant="secondary" size={props.phone ? 44 : 28} fontSize={12} onClick={() => props.onKeepSentWith?.(suggestion)}>
              {SENT_WITH_COPY.accept}
            </Button>
            <TextButton target={props.phone} style={text(12, 500, t.text2)} onClick={() => props.onIgnoreSentWith?.(suggestion.stepId, suggestion.key)}>
              {SENT_WITH_COPY.ignore}
            </TextButton>
          </span>
        </div>
      ))}
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
      {session.goal ? (
        <DotLine testId="goal-line" dot={session.goal.reached ? t.evidence : t.label}>
          {session.goal.line}
        </DotLine>
      ) : null}
      {session.runsWhen ? <DotLine testId="runs-when-line">{session.runsWhen}</DotLine> : null}
      {session.facts ? <DotLine testId="facts-line">{session.facts}</DotLine> : null}
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

function UsesRow({
  step,
  props,
  withGoes = true,
}: {
  step: Step;
  props: Pick<BuildListProps, "steps" | "names" | "suggestions" | "intoResult" | "onAccept" | "onDismiss" | "onSelect">;
  withGoes?: boolean;
}) {
  const chips = step.uses
    .map((use) => ({ use, text: inputLabel(use, props.steps, props.names) }))
    .filter((chip): chip is { use: typeof chip.use; text: string } => chip.text !== null);
  const mine = props.suggestions.filter((suggestion) => suggestion.stepId === step.id);
  const goes = withGoes && props.intoResult.has(step.id);
  if (chips.length === 0 && mine.length === 0 && !goes) return null;
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
      <Quiet>Goes into</Quiet>
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

/* ── a prompt's card ── */

function StepCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  const { phone, selectedId } = props;
  const selected = selectedId === step.id;
  const title = stepTitle(step);
  const isDefault = step.title === null;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [over, setOver] = useState(false);
  const { ref: textRef, clamped } = useClamped<HTMLParagraphElement>(step.text);
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
      aria-label={`Prompt ${step.number}: ${title}`}
      data-testid="step-card"
      data-selected={selected ? "true" : undefined}
      tabIndex={0}
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
      style={{ ...moduleStyle(selected || over), display: "flex", flexDirection: "column", gap: 8, outline: "none", cursor: "pointer", ...colourEdge(step.colour), ...(nest.takes ? TAKES : null) }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <DragHandle label={`Move ${tileName(step)}`} nest={nest} />
        <NumberTile>{step.number}</NumberTile>
        {renaming ? (
          <RenameField label={`Title of prompt ${step.number}`} draft={draft} placeholder={step.defaultTitle} phone={phone} onDraft={setDraft} onFinish={finish} />
        ) : isDefault && titleRepeatsText(step.text, title) ? (
          /* CA-14 P8: an automatic title that only repeats the start of the text under it is not drawn; its place is kept. */
          <span aria-hidden="true" data-testid="title-hidden" style={{ flexGrow: 1 }} />
        ) : (
          <StepTitle title={title} isDefault={isDefault} />
        )}
        <CardColour step={step} phone={phone} inMenu={editable} />
        {editable ? (
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton icon={MoreHorizontal} glyph="more" boxed={false} label={`Prompt ${step.number} options`} size={26} onClick={(event) => event.stopPropagation()} />
            </Menu.Trigger>
            <Menu.Portal>
              <MenuContent
                align="end"
                sideOffset={4}
                style={menuSurface()}
                onClick={(event) => event.stopPropagation()}
                onCloseAutoFocus={(event) => {
                  /* CA-10: "Name a file it makes" opens a field in Details; the closing menu must not take focus
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
                <MenuRow phone={phone} disabled={!open} onSelect={open}>Read all of it</MenuRow>
                <CopyTogetherRow step={step} phone={phone} />
                {props.onAttach ? <MenuRow phone={phone} onSelect={() => props.onAttach?.(step.id)}>Attach a file</MenuRow> : null}
                {props.onNameMade ? <MenuRow phone={phone} onSelect={() => (nameNext.current = true)}>Name a file it makes</MenuRow> : null}
                <MenuRow phone={phone} disabled={index === 0} onSelect={() => props.onMove(step.id, -1)}>Move up</MenuRow>
                <MenuRow phone={phone} disabled={last} onSelect={() => props.onMove(step.id, 1)}>Move down</MenuRow>
                <ColourMenuRow step={step} phone={phone} anchor={() => cardOf(step.id)} />
              <SessionTileRows step={step} phone={phone} />
              <MenuRow phone={phone} onSelect={() => props.onRemove(step.id)}>Remove</MenuRow>
              </MenuContent>
            </Menu.Portal>
          </Menu.Root>
        ) : null}
      </div>
      <p
        ref={textRef}
        style={{ ...text(13.5, 400, t.text), lineHeight: "22px", margin: 0, paddingLeft: INDENT, overflowWrap: "anywhere", ...clamp2 }}
      >
        <ChangedText text={step.text} changes={step.changes} />
      </p>
      {step.reply ? <ReplyBlock reply={step.reply} indent={INDENT} onRead={open} /> : null}
      {step.outputShape ? <ShapeChip shape={step.outputShape} indent={INDENT} /> : null}
      <TileCostLines step={step} audience="maker" groups={props.costGroups ?? []} indent={INDENT} />
      <MadeLine names={props.madeNames?.[step.id]} />
      <MentionedLine to={refTo({ kind: "node", id: step.id })} phone={props.phone} />
      <SentWithList step={step} props={props} />
      <SentWithSuggestions step={step} props={props} />
      <div style={footRow(INDENT)}>
        <UsesRow step={step} props={props} />
        <NestButtons step={step} phone={phone} />
        <span style={{ flexGrow: 1 }} />
        {clamped ? (
          <button
            type="button"
            data-hit=""
            onClick={(event) => {
              event.stopPropagation();
              open?.();
            }}
            style={{
              ...bareButton,
              padding: phone ? "12px 0" : 0,
              ...text(12, 500, t.text),
              textDecoration: "underline",
              textUnderlineOffset: 3,
              textDecorationColor: t.line,
            }}
          >
            {LIST_COPY.showFull}
          </button>
        ) : null}
        <Quiet style={tnum}>{wordsOf(step.words)}</Quiet>
      </div>
    </div>
  );
}

/* ── agents and teams (UI-P69) ── */

/** CA-03 P7: the outside tools an agent can use, its tools read from the List's names (an id to a service). */
const outsideOf = (agent: Step, names: BuildListProps["names"]): string[] =>
  readsOutsideContent(agent, (agent.toolRefs ?? []).flatMap((id) => (names[id] ? [{ id, type: TOOL_TYPE, payload: { service: names[id] } }] : [])));

function InnerCard({ step, eyebrow, runs, nested, made, outside = [], phone = false }: { step: Step; eyebrow?: string; runs?: string; nested?: boolean; made?: readonly string[]; outside?: readonly string[]; phone?: boolean }) {
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
      ) : (
        <p data-testid={step.id.endsWith(":instructions") ? "agent-instructions" : undefined} style={{ ...text(13, 400, t.text), lineHeight: "21px", margin: 0, overflowWrap: "anywhere", whiteSpace: step.id.endsWith(":instructions") ? "pre-wrap" : undefined, ...(step.id.endsWith(":instructions") ? clamp3 : clamp2) }}>{step.text}</p>
      )}
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
function ContainerEyebrow({ step, made, isTeam }: { step: Step; made: readonly string[]; isTeam: boolean }) {
  const model = isTeam ? null : stepModel(step);
  const lead = isTeam ? teamEyebrow(made, step.children[0]?.harness) : agentEyebrow(made, null, "Agent");
  return (
    <span data-testid="container-eyebrow" style={{ ...text(11.5, 400, t.label), display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
      {model ? (
        <>
          {`${lead} · `}
          <ToolMark model={step.model} size={14} />
          {model}
        </>
      ) : (
        lead
      )}
    </span>
  );
}

function ContainerCard({ step, props }: { step: Step; props: BuildListProps }) {
  const isTeam = step.kind === "team";
  const selected = props.selectedId === step.id;
  const made = madeIn(step, props.steps);
  const [adding, setAdding] = useState(false);
  /** One agent of a team shows its own prompts at a time. */
  const [openAgent, setOpenAgent] = useState<string | null>(null);
  /* CA-06 P3: a link to an agent's own prompt opens that agent first. */
  const { reveal } = useContext(ListRefsContext);
  useEffect(() => {
    if (!reveal || !isTeam) return;
    const holder = step.children.find((child) => child.children.some((grand) => grand.id === reveal.id));
    if (holder) setOpenAgent(holder.id);
  }, [reveal, isTeam, step.children]);
  const goes = props.intoResult.has(step.id);
  const nest = useNestTile(step.id);
  const cardRef = useCardRef(step.id, nest.setRef);
  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={`${isTeam ? "Team" : "Agent"} ${step.number}: ${stepTitle(step)}`}
      data-testid="step-card"
      tabIndex={0}
      onClick={() => props.onSelect(step.id)}
      style={{ ...moduleStyle(selected), display: "flex", flexDirection: "column", gap: 12, outline: "none", cursor: "pointer", ...colourEdge(step.colour), ...(nest.takes ? TAKES : null) }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
        <DragHandle label={`Move ${tileName(step)}`} nest={nest} />
        <NumberTile>{step.number}</NumberTile>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
          <ContainerEyebrow step={step} made={made} isTeam={isTeam} />
          <h3 style={{ ...text(14, 500, step.title ? t.text : t.text2), margin: 0, overflowWrap: "anywhere" }}>{stepTitle(step)}</h3>
          {isTeam ? (stepRunsLabel(step) ? <DotLine testId="runs-line">{stepRunsLabel(step)}</DotLine> : null) : <DotLine testId="runs-line">{startsLine(stepRunsLabel(step))}</DotLine>}
          {!isTeam && (step.toolRefs ?? []).length > 0 ? (
            <span data-testid="agent-tools" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              {(step.toolRefs ?? []).map((id) => props.names[id]).filter(Boolean).map((name) => (
                <span key={name} title={name} style={{ display: "inline-flex", alignItems: "center", gap: 4, ...text(11.5, 400, t.text2) }}>
                  <ToolMark tool={name} size={14} />
                  {name}
                </span>
              ))}
            </span>
          ) : null}
          {!isTeam && step.helpers?.length ? <HelperChips helpers={step.helpers} decisionName={(id) => props.steps.find((candidate) => candidate.id === id)?.title ?? props.steps.find((candidate) => candidate.id === id)?.defaultTitle} /> : null}
          {!isTeam && step.outputShape ? <ShapeChip shape={step.outputShape} /> : null}
          <TileCostLines step={step} audience="maker" groups={props.costGroups ?? []} />
          {!isTeam && step.memory ? <DotLine testId="memory-line">{LIST_COPY.remembers(step.memory)}</DotLine> : null}
          {!isTeam && step.memoryTidy ? <DotLine testId="memory-tidy-line">{LIST_COPY.tidies(step.memoryTidy)}</DotLine> : null}
        </div>
        <CardColour step={step} phone={props.phone} />
      </div>
      {isTeam ? null : <OutsideWarning names={outsideOf(step, props.names)} style={{ marginLeft: INDENT }} />}
      <div style={{ marginLeft: INDENT, paddingLeft: 16, borderLeft: `1px solid ${t.hairlineModule}`, display: "flex", flexDirection: "column", gap: 8 }}>
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
      </div>
      {step.uses.length > 0 || props.suggestions.some((s) => s.stepId === step.id) ? (
        <div style={footRow(INDENT)}>
          <UsesRow step={step} props={props} withGoes={false} />
        </div>
      ) : null}
      {goes ? (
        <div style={footRow(INDENT)}>
          <GoesInto />
        </div>
      ) : null}
      <MentionedLine to={refTo({ kind: "node", id: step.id })} phone={props.phone} />
      <NestFoot step={step} phone={props.phone} />
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
function PlainCard({ step, index, last, props, noun, eyebrow, body, foot }: { step: Step; index: number; last: boolean; props: BuildListProps; noun: string; eyebrow: ReactNode; body: ReactNode; foot?: ReactNode }) {
  const { phone } = props;
  const selected = props.selectedId === step.id;
  const isDefault = step.title === null;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const renameNext = useRef(false);
  const nest = useNestTile(step.id);
  const cardRef = useCardRef(step.id, nest.setRef);
  const finish = (save: boolean) => {
    setRenaming(false);
    if (save && draft.trim() !== (step.title ?? "")) props.onRename(step.id, draft);
  };
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
      onClick={() => props.onSelect(step.id)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          props.onSelect(step.id);
        }
      }}
      style={{ ...moduleStyle(selected), display: "flex", flexDirection: "column", gap: 8, outline: "none", cursor: "pointer", ...colourEdge(step.colour), ...(nest.takes ? TAKES : null), ...ring(props.ringedId === step.id) }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
        <DragHandle label={`Move ${tileName(step)}`} nest={nest} />
        <NumberTile>{step.number}</NumberTile>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
          <span data-testid={`${step.kind}-eyebrow`} style={text(11.5, 400, t.label)}>
            {eyebrow}
          </span>
          {renaming ? (
            <RenameField label={`Title of ${noun.toLowerCase()} ${step.number}`} draft={draft} placeholder={step.defaultTitle} phone={phone} onDraft={setDraft} onFinish={finish} />
          ) : (
            <h3 data-default-title={isDefault ? "true" : undefined} style={{ ...text(14, 500, isDefault ? t.text2 : t.text), margin: 0, overflowWrap: "anywhere" }}>
              {stepTitle(step)}
            </h3>
          )}
        </div>
        <CardColour step={step} phone={phone} inMenu />
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton icon={MoreHorizontal} glyph="more" boxed={false} label={`${noun} ${step.number} options`} size={26} onClick={(event) => event.stopPropagation()} />
          </Menu.Trigger>
          <Menu.Portal>
            <MenuContent
              align="end"
              sideOffset={4}
              style={menuSurface()}
              onClick={(event) => event.stopPropagation()}
              onCloseAutoFocus={(event) => {
                if (!renameNext.current) return;
                event.preventDefault();
                renameNext.current = false;
                setDraft(step.title ?? "");
                setRenaming(true);
              }}
            >
              <MenuRow phone={phone} onSelect={() => (renameNext.current = true)}>Rename</MenuRow>
              <CopyTogetherRow step={step} phone={phone} />
              <MenuRow phone={phone} disabled={index === 0} onSelect={() => props.onMove(step.id, -1)}>Move up</MenuRow>
              <MenuRow phone={phone} disabled={last} onSelect={() => props.onMove(step.id, 1)}>Move down</MenuRow>
              <ColourMenuRow step={step} phone={phone} anchor={() => cardOf(step.id)} />
              <SessionTileRows step={step} phone={phone} />
              <MenuRow phone={phone} onSelect={() => props.onRemove(step.id)}>Remove</MenuRow>
            </MenuContent>
          </Menu.Portal>
        </Menu.Root>
      </div>
      <div style={{ paddingLeft: INDENT, minWidth: 0 }}>{body}</div>
      <MadeLine names={props.madeNames?.[step.id]} />
      <MentionedLine to={refTo({ kind: "node", id: step.id })} phone={props.phone} />
      <SentWithList step={step} props={props} />
      <div style={footRow(INDENT)}>
        <UsesRow step={step} props={props} />
        <NestButtons step={step} phone={phone} />
        {foot}
      </div>
    </div>
  );
}

function ManualCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return (
    <PlainCard
      step={step}
      index={index}
      last={last}
      props={props}
      noun="Manual step"
      eyebrow="Manual step · added by maker"
      body={<ManualTileBody step={step} picture={false} />}
      foot={
        step.mediaId ? (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Quiet>1 screenshot</Quiet>
            <ManualThumb mediaId={step.mediaId} />
          </span>
        ) : null
      }
    />
  );
}

/** CA-12 P7: a tool as a tile: its app's mark and name, how it was connected, what it did. */
function ToolCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="Tool" eyebrow="Tool · added by maker" body={<ToolTileBody step={step} />} />;
}

/** CA-13 P2: a decision as a tile: its model, and one line per question. It runs in the app, so it says so. */
function DecisionCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="Decision" eyebrow="Decision · runs in the app" body={<DecisionTileBody step={step} />} foot={<TileCostLines step={step} audience="maker" groups={props.costGroups ?? []} indent={INDENT} />} />;
}

/** CA-15 P9: a system prompt as a tile: its text in two lines, its variables as chips, and what it applies to. */
function SystemPromptCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="System prompt" eyebrow={typeLineOf(step)} body={<SystemPromptTileBody step={step} />} foot={<TileFooter facts={footerFactsOf(step)} />} />;
}

/** CA-15 P9: a dataset as a tile: what it is, its columns, and its format, columns and records. */
function DatasetCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="Dataset" eyebrow={typeLineOf(step)} body={<DatasetTileBody step={step} />} foot={<TileFooter facts={footerFactsOf(step)} />} />;
}

/** CA-15 P9: a GitHub repository as a tile: `owner/name`, what it is for, how it was used, and a link to it. */
function RepoCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="GitHub repository" eyebrow={typeLineOf(step)} body={<RepoTileBody step={step} />} foot={<TileFooter facts={footerFactsOf(step)} link={step.repo ? <OpenOnGitHub url={step.repo.url} /> : null} />} />;
}

/** CA-12 P8: a file as a tile: its type, name and size, and a preview. */
function FileCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  return <PlainCard step={step} index={index} last={last} props={props} noun="File" eyebrow="File · added by maker" body={<FileTileBody step={step} />} />;
}

/** CA-02 P7: lines of code, as a module like a manual step's: "Code", its file name or language, its lines, and its first 6 in a mono well. */
function CodeCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  const { phone } = props;
  const selected = props.selectedId === step.id;
  const isDefault = step.title === null;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const renameNext = useRef(false);
  const nest = useNestTile(step.id);
  const cardRef = useCardRef(step.id, nest.setRef);
  const finish = (save: boolean) => {
    setRenaming(false);
    if (save && draft.trim() !== (step.title ?? "")) props.onRename(step.id, draft);
  };
  const lines = lineCount(step.text);
  const named = step.filename ?? step.language ?? null;
  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={`Code ${step.number}: ${stepTitle(step)}`}
      data-testid="step-card"
      data-kind="code"
      data-selected={selected ? "true" : undefined}
      tabIndex={0}
      onClick={() => props.onSelect(step.id)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          props.onSelect(step.id);
        }
      }}
      style={{ ...moduleStyle(selected), display: "flex", flexDirection: "column", gap: 8, outline: "none", cursor: "pointer", ...colourEdge(step.colour), ...(nest.takes ? TAKES : null) }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
        <DragHandle label={`Move ${tileName(step)}`} nest={nest} />
        <NumberTile>{step.number}</NumberTile>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
          <span data-testid="code-eyebrow" style={{ ...text(11.5, 400, t.label), overflowWrap: "anywhere" }}>
            {["Code", named, `${lines} ${lines === 1 ? "line" : "lines"}`].filter(Boolean).join(" · ")}
          </span>
          {renaming ? (
            <RenameField label={`Title of code ${step.number}`} draft={draft} placeholder={step.defaultTitle} phone={phone} onDraft={setDraft} onFinish={finish} />
          ) : (
            <h3 data-default-title={isDefault ? "true" : undefined} style={{ ...text(14, 500, isDefault ? t.text2 : t.text), margin: 0, overflowWrap: "anywhere" }}>
              {stepTitle(step)}
            </h3>
          )}
        </div>
        <CardColour step={step} phone={phone} inMenu />
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton icon={MoreHorizontal} glyph="more" boxed={false} label={`Code ${step.number} options`} size={26} onClick={(event) => event.stopPropagation()} />
          </Menu.Trigger>
          <Menu.Portal>
            <MenuContent
              align="end"
              sideOffset={4}
              style={menuSurface()}
              onClick={(event) => event.stopPropagation()}
              onCloseAutoFocus={(event) => {
                if (!renameNext.current) return;
                event.preventDefault();
                renameNext.current = false;
                setDraft(step.title ?? "");
                setRenaming(true);
              }}
            >
              <MenuRow phone={phone} onSelect={() => (renameNext.current = true)}>Rename</MenuRow>
              <CopyTogetherRow step={step} phone={phone} />
              <MenuRow phone={phone} disabled={index === 0} onSelect={() => props.onMove(step.id, -1)}>Move up</MenuRow>
              <MenuRow phone={phone} disabled={last} onSelect={() => props.onMove(step.id, 1)}>Move down</MenuRow>
              <ColourMenuRow step={step} phone={phone} anchor={() => cardOf(step.id)} />
              <SessionTileRows step={step} phone={phone} />
              <MenuRow phone={phone} onSelect={() => props.onRemove(step.id)}>Remove</MenuRow>
            </MenuContent>
          </Menu.Portal>
        </Menu.Root>
      </div>
      <CodeLines text={step.text} compact testId="code-lines" label={`Code ${step.number}`} style={{ marginLeft: INDENT }} />
      <LinkLines lines={[...callsOf(step.id, props.steps), ...definesOf(step.id, props.steps)]} onOpen={props.onSelect} indent={INDENT} />
      <TileCostLines step={step} audience="maker" groups={props.costGroups ?? []} indent={INDENT} />
      <MadeLine names={props.madeNames?.[step.id]} />
      <MentionedLine to={refTo({ kind: "node", id: step.id })} phone={props.phone} />
      <SentWithList step={step} props={props} />
      <div style={footRow(INDENT)}>
        <UsesRow step={step} props={props} />
        <NestButtons step={step} phone={phone} />
      </div>
    </div>
  );
}

/** CA-03 P5: how the build checked its work: what it tested as its text, and one status line with a 7px dot. */
function CheckCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  const { phone } = props;
  const selected = props.selectedId === step.id;
  const isDefault = step.title === null;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const renameNext = useRef(false);
  const nest = useNestTile(step.id);
  const cardRef = useCardRef(step.id, nest.setRef);
  const finish = (save: boolean) => {
    setRenaming(false);
    if (save && draft.trim() !== (step.title ?? "")) props.onRename(step.id, draft);
  };
  const status = step.check ? checkStatus(step.check) : null;
  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={`Check ${step.number}: ${stepTitle(step)}`}
      data-testid="step-card"
      data-kind="check"
      data-selected={selected ? "true" : undefined}
      tabIndex={0}
      onClick={() => props.onSelect(step.id)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          props.onSelect(step.id);
        }
      }}
      style={{ ...moduleStyle(selected), display: "flex", flexDirection: "column", gap: 8, outline: "none", cursor: "pointer", ...colourEdge(step.colour), ...(nest.takes ? TAKES : null) }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
        <DragHandle label={`Move ${tileName(step)}`} nest={nest} />
        <NumberTile>{step.number}</NumberTile>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
          <span data-testid="check-eyebrow" style={text(11.5, 400, t.label)}>
            {LIST_COPY.check}
          </span>
          {renaming ? (
            <RenameField label={`Title of check ${step.number}`} draft={draft} placeholder={step.defaultTitle} phone={phone} onDraft={setDraft} onFinish={finish} />
          ) : (
            <h3 data-default-title={isDefault ? "true" : undefined} style={{ ...text(14, 500, isDefault ? t.text2 : t.text), margin: 0, overflowWrap: "anywhere" }}>
              {stepTitle(step)}
            </h3>
          )}
        </div>
        <CardColour step={step} phone={phone} inMenu />
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton icon={MoreHorizontal} glyph="more" boxed={false} label={`Check ${step.number} options`} size={26} onClick={(event) => event.stopPropagation()} />
          </Menu.Trigger>
          <Menu.Portal>
            <MenuContent
              align="end"
              sideOffset={4}
              style={menuSurface()}
              onClick={(event) => event.stopPropagation()}
              onCloseAutoFocus={(event) => {
                if (!renameNext.current) return;
                event.preventDefault();
                renameNext.current = false;
                setDraft(step.title ?? "");
                setRenaming(true);
              }}
            >
              <MenuRow phone={phone} onSelect={() => (renameNext.current = true)}>Rename</MenuRow>
              <CopyTogetherRow step={step} phone={phone} />
              <MenuRow phone={phone} disabled={index === 0} onSelect={() => props.onMove(step.id, -1)}>Move up</MenuRow>
              <MenuRow phone={phone} disabled={last} onSelect={() => props.onMove(step.id, 1)}>Move down</MenuRow>
              <ColourMenuRow step={step} phone={phone} anchor={() => cardOf(step.id)} />
              <SessionTileRows step={step} phone={phone} />
              <MenuRow phone={phone} onSelect={() => props.onRemove(step.id)}>Remove</MenuRow>
            </MenuContent>
          </Menu.Portal>
        </Menu.Root>
      </div>
      <p style={{ ...text(13.5, 400, t.text), lineHeight: "22px", margin: 0, paddingLeft: INDENT, overflowWrap: "anywhere" }}>{step.text}</p>
      {status ? (
        <DotLine testId="check-status" dot={status.allPassed ? t.evidence : t.catBreakage} style={{ paddingLeft: INDENT }}>
          <span style={tnum}>{status.line}</span>
        </DotLine>
      ) : null}
      {step.check ? <CheckExtraLines check={step.check} style={{ paddingLeft: INDENT }} /> : null}
      <CheckCasesBody cases={step.check?.caseList} indent={INDENT} />
      <MentionedLine to={refTo({ kind: "node", id: step.id })} phone={props.phone} />
      <SentWithList step={step} props={props} />
      <div style={footRow(INDENT)}>
        <UsesRow step={step} props={props} />
        <NestButtons step={step} phone={phone} />
      </div>
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
    <div data-testid="add-pending" data-kind={kind} aria-busy="true" style={{ ...moduleStyle(false), display: "flex", alignItems: "center", gap: 12 }}>
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

function ResultCard({ result, selected, ringed = false, onSelect }: { result: ListResult; selected: boolean; ringed?: boolean; onSelect: (id: string) => void }) {
  return (
    <div
      data-testid="result-card"
      data-tile-id={result.id}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(result.id)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect(result.id);
        }
      }}
      style={{ ...moduleStyle(selected), display: "flex", alignItems: "flex-start", gap: 12, outline: "none", cursor: "pointer", ...ring(ringed) }}
    >
      <span
        aria-hidden="true"
        style={{ width: 24, height: 24, borderRadius: 6, background: t.evidenceFill, color: t.evidence, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
      >
        <Glyph name="check" size={14} />
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <Quiet>Result</Quiet>
        <span style={{ ...text(14, 500, t.text), overflowWrap: "anywhere" }}>{result.title}</span>
        <ResultTileBody facts={result.facts} />
        {resultHolds(result.facts) || result.from ? (
          <Quiet>
            {resultHolds(result.facts) ? result.holds : ""}
            {result.from ? `${resultHolds(result.facts) ? " · " : ""}from prompt ${result.from}` : ""}
          </Quiet>
        ) : null}
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
      <div aria-live="polite" data-testid="model-cleared">
        {cleared ? <Quiet>{cleared}</Quiet> : null}
      </div>
    </div>
  );
}

/* ── the list ── */

/** CA-14 P4: while a session is dragged every session is folded to its head, so a long one can be moved; they open again after the drop. */
function WhileDragging({ children }: { children: (dragging: boolean) => ReactNode }) {
  return <>{children(useSessionDragging())}</>;
}

/** The tiles of a session: 16 in from its head, with the 2px line down their left, 8 in from their edge. */
const bodyStyle: CSSProperties = { position: "relative", display: "flex", flexDirection: "column", gap: 8, minWidth: 0, marginLeft: 16 };

/** A run of steps on the page: a session's head and the prompts that follow it, or one step that stands alone. */
interface Run {
  key: string;
  head: SourceSession | null;
  steps: Step[];
}

/** A session's head and its tiles, registered for the post's links by the session's key. */
function SessionRun({ head, phone: _phone, first, lit = false, children }: { head: SourceSession | null; phone: boolean; first: boolean; lit?: boolean; children: ReactNode }) {
  const part = usePartRef(head && !head.key.startsWith("typed-legacy-") ? refTo({ kind: "session", id: head.key }) : null);
  // CA-06 P4: a coloured session has a thin line round its head and its tiles, and room inside it only then.
  const colour = head?.colour;
  return (
    <div
      ref={part}
      data-session-key={head?.key}
      data-lit={lit || undefined}
      data-session-colour={colour}
      style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, ...(head && !first ? { marginTop: 16 } : null), ...(colour ? { ...outlineFor(colour), padding: 12 } : null), ...(lit ? ring(true) : null) }}
    >
      {children}
    </div>
  );
}

/**
 * The runs on the page. A session's head starts its run and every step after it, of any kind, belongs to it until the next
 * head (CA-14: a session holds every kind of step, so an agent or a manual step in it is drawn inside it). Steps before any
 * head, and every step of a draft that has no heads, stand on their own, as they did.
 */
function runsOf(steps: readonly Step[], dividers: BuildListProps["dividers"]): Run[] {
  const runs: Run[] = [];
  for (const step of steps) {
    const head = dividers.get(step.number) ?? null;
    const last = runs[runs.length - 1];
    if (head || !last || !last.head) runs.push({ key: step.id, head, steps: [step] });
    else last.steps.push(step);
  }
  return runs;
}

/** CA-14 P1: sessions with no tile yet are drawn too, each in the place its number gives it: before the first session numbered after it. */
function withEmptySessions(runs: readonly Run[], empties: readonly SourceSession[]): Run[] {
  const out = [...runs];
  for (const head of [...empties].sort((a, b) => a.number - b.number)) {
    const at = out.findIndex((run) => run.head !== null && run.head.number > head.number);
    out.splice(at < 0 ? out.length : at, 0, { key: `empty:${head.key}`, head, steps: [] });
  }
  return out;
}

export function BuildList(props: BuildListProps) {
  const { steps } = props;
  const prompts = steps.filter((step) => step.kind === "prompt");
  /* CA-04 P2: tiles move once there is somewhere to move them: two steps, or a tile already inside one. */
  const nestOn = Boolean(props.onNest) && (steps.length > 1 || steps.some((step) => (step.sentWith?.length ?? 0) > 0));
  const [said, setSaid] = useState("");
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
        above: (id) => {
          const at = steps.findIndex((step) => step.id === id);
          return at > 0 ? steps[at - 1] : null;
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
  const onDrop = (id: string, target: NestTarget) => {
    if (target.kind === "tile") move(id, target.id, Number.MAX_SAFE_INTEGER);
    else if (target.kind === "gap") {
      const from = steps.findIndex((step) => step.id === id);
      move(id, null, from >= 0 && from < target.index ? target.index - 1 : target.index);
    } else {
      const session = [...props.dividers.values()].find((entry) => entry.key === target.key);
      void props.onMoveToSession?.(id, target.key).then((done) => {
        if (done) setSaid(NEST_LIST_COPY.nowIn(label(id), session ? `Session ${session.number}` : "that session"));
      });
    }
  };

  const card = (step: Step) =>
    step.kind === "prompt" ? (
      <StepCard key={step.id} step={step} index={prompts.indexOf(step)} last={prompts.indexOf(step) === prompts.length - 1} props={props} />
    ) : step.kind === "manual" ? (
      <ManualCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "tool" ? (
      <ToolCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "decision" ? (
      <DecisionCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
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
      <ContainerCard key={step.id} step={step} props={props} />
    );
  /* While tiles move, each top-level tile stands in a wrapper that holds the place to drop before it (and, for the
     last, after it). Otherwise the cards are drawn as they always were. */
  const placed = (step: Step) => {
    if (!nestOn) return card(step);
    const at = steps.indexOf(step);
    return (
      <div key={step.id} style={{ position: "relative", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <NestGap index={at} />
        {card(step)}
        {at === steps.length - 1 ? <NestGap index={steps.length} edge="bottom" /> : null}
      </div>
    );
  };
  const runs = withEmptySessions(runsOf(steps, props.dividers), props.emptySessions ?? []);
  const headOrder = runs.flatMap((run) => (run.head && !run.head.key.startsWith("typed-legacy-") ? [run.head.key] : []));
  const headed = runs.some((run) => run.head);
  const body = (
    /* The global field rule makes a field inherit its size on a desktop (`font-size: inherit !important`), so the
     fields' type is set here, where they inherit it. */
    <div data-testid="build-list" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0, fontSize: 13.5 }}>
      <p style={{ ...text(12, 400, t.label), margin: 0 }}>{props.phone ? LIST_COPY.hintPhone : LIST_COPY.hint}</p>
      {props.costGroups ? <CostStrip steps={steps} groups={props.costGroups} audience="maker" /> : null}
      <WhileDragging>
        {(dragging) =>
      runs.map((run, at) => {
        const key = run.head?.key ?? null;
        const closed = key !== null && Boolean(props.onToggleCollapsed) && (dragging || Boolean(props.collapsed?.has(key)));
        const tilesId = `session-tiles-${key ?? run.key}`;
        const headed = run.head !== null;
        const editable = headed && !run.head.key.startsWith("typed-legacy-");
        const isFirstHead = headed && headOrder.indexOf(run.head.key) === 0;
        const isLastHead = headed && headOrder.indexOf(run.head.key) === headOrder.length - 1;
        const emptyDraft = steps.length === 0 && at === 0;
        const promptHere = headed && (props.promptIn === key || emptyDraft);
        return (
          <SessionRun key={run.key} head={run.head} phone={props.phone} first={at === 0} lit={Boolean(key && props.ringedSession?.key === key)}>
            {run.head ? (
              <SessionHead
                session={run.head}
                phone={props.phone}
                tiles={run.steps.length}
                collapsed={closed}
                controls={tilesId}
                onToggle={() => props.onToggleCollapsed?.(run.head.key, !closed)}
                first={isFirstHead}
                last={isLastHead}
                ops={props.sessionOps}
                editable={editable}
                onOpenSetup={props.onOpenSetup}
                onPickApp={props.onPickApp}
                inBuild={props.inBuild}
                onColour={props.onColour ? (anchor) => props.onColour?.(refTo({ kind: "session", id: run.head.key }), anchor, `Session ${run.head.number}`, run.head.colour ?? null) : undefined}
              />
            ) : null}
            {run.head ? (
              <div id={tilesId} data-testid="session-tiles" hidden={closed} style={headed ? bodyStyle : undefined}>
                {closed ? null : (
                  <>
                    {headed ? <span aria-hidden="true" data-testid="session-line" style={{ position: "absolute", left: -8, top: 0, bottom: 0, width: 2, background: t.hairline }} /> : null}
                    <MentionedLine to={refTo({ kind: "session", id: run.head.key })} phone={props.phone} />
                    <SessionLines session={run.head} />
                    {drawBranches(run.steps, (step) => step, steps, placed)}
                    {run.steps.length === 0 && !promptHere ? <p style={{ ...text(13, 400, t.label), margin: 0 }}>{SESSION_HEAD_COPY.noTiles}</p> : null}
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
              </div>
            ) : (
              drawBranches(run.steps, (step) => step, steps, placed)
            )}
          </SessionRun>
        );
      })
        }
      </WhileDragging>
      {props.results.map((result) => (
        <ResultCard key={result.id} result={result} selected={props.selectedId === result.id} ringed={props.ringedId === result.id} onSelect={props.onSelect} />
      ))}
      {props.pendingAdd ? <PendingAddCard kind={props.pendingAdd} /> : null}
      {nestOn ? (
        <div aria-live="polite" data-testid="nest-said">
          {said ? <Quiet>{said}</Quiet> : null}
        </div>
      ) : null}
      <div aria-live="polite" data-testid="sessions-said" style={props.said ? undefined : { display: "none" }}>
        {props.said ? <Quiet>{props.said}</Quiet> : null}
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
      {props.addSession ? <AddSessionRow phone={props.phone} {...props.addSession} /> : null}
    </div>
  );
  const sessionOf = new Map<string, string>();
  const firstOf = new Set<string>();
  for (const run of runs) {
    if (!run.head || run.head.key.startsWith("typed-legacy-")) continue;
    run.steps.forEach((step, at) => {
      sessionOf.set(step.id, run.head?.key ?? "");
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
    firstOf,
    onMoveToSession: props.onMoveToSession,
    onSplitHere: props.onSplitHere,
  };
  const sessionLabel = (key: string) => {
    const head = runs.find((run) => run.head?.key === key)?.head;
    return head ? headName(head) : "that session";
  };
  /* Sessions move once there are two to put in order, even when no tile can move yet. */
  const sessionsMove = Boolean(props.onDropSession) && headOrder.length > 1;
  if (!nest && !sessionsMove) return <ListRefsContext.Provider value={refs}>{body}</ListRefsContext.Provider>;
  return (
    <ListRefsContext.Provider value={refs}>
      <ListNestContext.Provider value={nest}>
        <NestList phone={props.phone} canTake={nest?.canNest ?? (() => false)} label={label} onDrop={onDrop} onDropSession={props.onDropSession} sessionLabel={sessionLabel}>
          {body}
        </NestList>
      </ListNestContext.Provider>
    </ListRefsContext.Provider>
  );
}

const NO_MENTIONS: ReadonlySet<string> = new Set();

export default BuildList;
