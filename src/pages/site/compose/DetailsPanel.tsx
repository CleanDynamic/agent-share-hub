/* CA-18 P3 — the Details panel, read only.

   It shows the selected tile the way its modal does: the same sections, the same names, in the same order, taken from one list
   (`tileSections`). Nothing in it can be typed into; every change is made in the tile's own window, which Edit opens. What it
   keeps are the things that read or move without changing anything: Copy, Read all, and a link to another tile.

   THE LOOK (boards "Details: read only" and "Details: on a 1920 window"). A column on the surface, not a boxed module, split by
   spacing and thin lines: a head (the tool's mark, the title and the modal's header line, Edit at the right) and then each
   section that holds something: its label 14/500, its count under it, and its value (prose, rows, a list, chips, links). A
   section that holds nothing is not drawn; the last line names them once. The measures are in `detailsRecipes`.

   `DetailsHandlers` stays: the handlers are the ones the windows call (CA-18 P2), written here once and typed here. */

import { useAnnounce } from "./BuildAnnouncer";
import { Copy } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";

import { ColourDot } from "@/components/brand/ColourButton";
import { MemberLabel, useGroupOf } from "./groupLabels";
import { ColourReferences, useReferenceSection } from "./DetailsReferences";
import { Button } from "@/components/brand/Button";
import { ChangedText } from "@/components/build/ChangedText";
import { IconButton } from "@/components/brand/IconButton";
import { changesLine, type ChangeRange } from "@/lib/build/changes";
import { headOf, notSetLine, readSections, type BuildFacts, type ListItem, type ReadSection, type SectionValue } from "@/lib/build/tileSections";
import { t } from "@/lib/theme/tokens";
import { fullText } from "@/lib/theme/truncate";

import type { HelpersRead } from "@/lib/build/agentCode";
import type { RuntimePatch } from "@/lib/build/graph";
import type { RuntimeView } from "./runtimeView";
import type { DecisionDraft } from "@/lib/build/decisionDraft";
import type { DecisionInput } from "@/lib/build/graph";
import { LoadingRegion } from "@/components/brand/Skeleton";
import type { RunsWhen } from "@/lib/build/decision";
import type { GoesRow, InputOption, UseRow, ChecklistRow, MakesRow } from "./detailsModel";
import { LoadingBlocks } from "./LoadingBlocks";
import { DETAILS_WIDTHS as DETAILS_LINES, LINE_GAP } from "./loadingBlocks";
import { ToolMark } from "./refinedPieces";
import { text } from "./refinedStyles";
import {
  BADGE,
  CHIPS,
  COLUMN,
  EDIT_BUTTON,
  EMPTY,
  HEAD_BELOW,
  HEAD_LINE,
  HEAD_MARK,
  HEAD_ROW,
  HEAD_TEXT,
  HEAD_TITLE,
  LINK_ROW,
  LIST_DETAIL,
  LIST_KIND,
  LIST_NAME,
  LIST_ROW,
  LIST_VALUE,
  NOT_SET,
  PROSE,
  PROSE_CODE,
  PROSE_MUTED,
  ROW,
  ROW_LABEL,
  ROW_VALUE,
  SECTION_BREAK,
  SECTION_COUNT,
  SECTION_HEAD,
  SECTION_LABEL,
  TOOL_MARK_SIZE,
  VALUE,
} from "./detailsRecipes";
import type { ModelRun } from "@/lib/build/modelRun";
import type { RunHostChoice } from "./ModelRunFields";
import type { CheckCase, CheckFacts, CheckRun, AgentModel, Runs, Use, ToolConnection, ToolRunsAt, ManualWhere } from "@/lib/build/graph";
import type { AgentSetupValue } from "./AgentSetupFields";
import type { OtherSession } from "./SessionExtrasFields";
import type { SessionExtras } from "@/lib/build/sessionFacts";
import type { SessionGoal } from "@/lib/build/making";
import type { SetupLoaded } from "@/lib/build/setup";
import { Swap } from "./buildMotion";

export interface InputsView {
  /** CA-04 P2, a tile inside another: "Sent with prompt 2", which its eyebrow says in place of its number. */
  sentWithLine?: string;
  uses: readonly UseRow[];
  options: readonly InputOption[];
  goesInto: readonly GoesRow[];
}

export interface PromptView extends InputsView {
  kind: "prompt";
  id: string;
  number: string;
  title: string | null;
  defaultTitle: string;
  /** False for an agent's instructions: they are renamed through the agent. */
  editable: boolean;
  /** Its name by its place on the build: "Prompt 3 · Session 2". Absent for an agent's instructions. */
  place?: string;
  /** "Session 2 · Claude", or "Typed here · ChatGPT". */
  sessionLine: string;
  /** "Opus 5.5 · 4 Oct · prompt 2 of 5". */
  detailLine: string;
  /** A prompt written by hand: it names its own model. */
  typed: boolean;
  model: string | null;
  /** CA-02 P8: a typed prompt's tool, as saved (a name or as typed); absent for one from a session. */
  tool?: string | null;
  text: string;
  words: number;
  /** CA-05 P1: the words a reader changes, when the maker marked any. */
  changes?: readonly ChangeRange[];
  /** CA-05 P8: the model runs on the maker's own computer or has open weights: How it was run and Where are asked, with what is said so far. */
  modelRun?: { run: ModelRun | null; hosts?: RunHostChoice[] };
  /** The files it makes; empty for an agent's instructions. */
  makes: readonly MakesRow[];
}

/** Work done outside AI (UI-P70). It is never detected, and has no model and no text to copy. */
export interface ManualView extends InputsView {
  kind: "manual";
  /** CA-18: where it was done, when it says (an app, a terminal, a phone...). */
  where?: ManualWhere | null;
  id: string;
  number: string;
  title: string | null;
  defaultTitle: string;
  tool: string;
  text: string;
  /** Its picture, with the file's name when it could be read. */
  picture: { id: string; name: string } | null;
  makes: readonly MakesRow[];
}

export interface SessionView {
  kind: "session";
  key: string;
  number: number;
  tool: string;
  /** TF-13: present when the session's client names no tool, so its tool can be picked. `value` is the tool given, or null. */
  pickTool?: { value: string | null };
  model: string;
  date: string;
  inBuild: number;
  total: number | null;
  status: "loading" | "error" | "ready";
  checklist: readonly ChecklistRow[];
  /**
   * CA-04 P1: a session made here (or an old build's typed prompts, read as one): its Tool and Date can be changed.
   * `tool` is a tool id or a typed name, or null for "Typed here"; `date` is "2026-10-12", or "" when it has none yet.
   */
  editable?: { tool: string | null; date: string };
  /** CA-04 P4: what the AI was given before the first prompt. Absent or empty: no Setup section. */
  setup?: readonly SetupRow[];
  /** CA-04 P6: what it worked until, when the maker said. */
  goal?: SessionGoal | null;
  /** CA-05: what the session carries beyond its steps (cost, background, ...). Absent in older fixtures. */
  extras?: SessionExtras;
  /** CA-05 P5: the build's other sessions, for Ran at the same time as. Absent or empty: the menu is not shown. */
  others?: readonly OtherSession[];
}

/** CA-04 P4: one row of a session's setup. */
export interface SetupRow {
  id: string;
  /** "Instructions", "Skill", "MCP server", "Rule". */
  kind: string;
  name: string;
  /** A skill's description, word for word. */
  description: string | null;
  notShared: boolean;
  /** CA-05 P6: read at the start, or only when needed. Absent in older fixtures: read as at the start. */
  loaded?: SetupLoaded;
}

export interface FileView {
  kind: "file";
  id: string;
  number?: string;
  /** CA-04 P2, a file sent with a step: "Sent with prompt 2". */
  sentWithLine?: string;
  name: string;
  from: string;
  size: string | null;
  canDownload: boolean;
  usedBy: readonly GoesRow[];
}

export interface ToolView {
  kind: "tool";
  id: string;
  /** CA-18: its place on the build ("11"), for the title of its window. */
  number?: string;
  service: string;
  scopes: string;
  usedBy: readonly GoesRow[];
  /** CA-04 P5: how it was connected, and where an MCP server ran; null while unsaid. Absent in older fixtures. */
  connection?: ToolConnection | null;
  runsAt?: ToolRunsAt | null;
  /** CA-04 P5: the tools it was seen calling, with how many times; read, never typed. */
  toolsUsed?: readonly { name: string; count: number }[];
}

export interface AgentView extends InputsView {
  kind: "agent" | "team";
  id: string;
  number: string;
  name: string | null;
  defaultName: string;
  model: string | null;
  runs: Runs | null;
  /** "Inside 2 prompts". */
  inside: string;
  insideRows: readonly { id: string; label: string }[];
  /** An agent's instructions (its system prompt); empty for a team. */
  instructions: string;
  /** "Team 3 · Copy team" for an agent inside a team; null otherwise. */
  parent: string | null;
  /** CA-02 P5, an agent only: what it ran in, its models with their roles and the tools it can use. */
  setup?: AgentSetupValue;
  /** CA-03 P7, an agent only: the tools it can use that read content it doesn't control. */
  outside?: readonly string[];
  /** CA-04 P6: its session worked until a goal: "Until a goal was reached" is chosen for it until it says otherwise. */
  sessionGoal?: boolean;
  /** CA-05 P8, an agent only: how its main model was run, when the maker said. */
  modelRun?: ModelRun | null;
  /** SV-27 P4: the build's Host tiles, offered under Where. */
  runHosts?: RunHostChoice[];
  /** CA-05 P9, an agent only: how it tidies its notes, and what it changes each round. */
  memoryTidy?: string;
  changesEachRound?: string;
}

export interface ResultView {
  kind: "result";
  id: string;
  number?: string;
  summary: string;
  url: string;
  /** Pictures kept with the result. */
  pictures: readonly { id: string; name: string }[];
  /** CA-05 P10: what it is, as What it is shows it. Absent in older fixtures: a link, or a picture when it holds one. */
  what?: ResultWhat;
  /** CA-05 P10: a trained model's facts. Present only when `what` is "trained-model". */
  trained?: { baseModel: string; method: string; trainedOn: { id: string; name: string; rows: number | null } | null };
}

/** CA-05 P10: A link, A picture, A file, A trained model. Only the last is stored (`payload.kind`). */
export type ResultWhat = "link" | "picture" | "file" | "trained-model";

/** CA-02 P7: lines of code. Shown in full, with Copy; never run. */
export interface CodeView extends InputsView {
  kind: "code";
  id: string;
  number: string;
  title: string | null;
  defaultTitle: string;
  language: string | null;
  filename: string | null;
  source: string;
  lines: number;
  /** "Written with": the tool's name, or as typed, and the model. */
  tool: string | null;
  model: string | null;
  makes: readonly MakesRow[];
}

/** CA-03 P5: how the build checked its work. */
export interface CheckView extends InputsView {
  kind: "check";
  id: string;
  number: string;
  title: string | null;
  defaultTitle: string;
  check: CheckFacts;
}

/** CA-13 P2: a decision, as the Details panel edits it: its whole form is a draft. */
export interface DecisionView {
  kind: "decision";
  sentWithLine?: string;
  id: string;
  number: string;
  title: string | null;
  defaultTitle: string;
  draft: DecisionDraft;
  /** The Code tiles in the build (rule 4). */
  codeTiles: readonly { id: string; label: string; source: string }[];
  /** The steps it can read the output of. */
  stepChoices: readonly { id: string; label: string }[];
}

/** CA-15 P9, P11: a system prompt as the Details panel shows it. Its facts are read from `payload`. */
export interface SystemPromptView extends InputsView {
  kind: "system_prompt";
  id: string;
  number: string;
  title: string | null;
  defaultTitle: string;
  payload: Record<string, unknown>;
  /** How many prompts it applies to now. */
  appliesTo: number;
  /** The build's prompts, for "Selected prompts". */
  prompts: readonly { id: string; label: string }[];
  /** The session the tile is in, for "This session"; null when it is in none. */
  session: string | null;
}

/** CA-15 P9, P11: a dataset as the Details panel shows it. */
export interface DatasetView extends InputsView {
  kind: "dataset";
  id: string;
  number: string;
  title: string | null;
  defaultTitle: string;
  payload: Record<string, unknown>;
}

/** CA-15 P9, P11: a GitHub repository as the Details panel shows it. */
export interface RepoView extends InputsView {
  kind: "repo";
  id: string;
  number: string;
  title: string | null;
  defaultTitle: string;
  payload: Record<string, unknown>;
}

export type DetailsView = (PromptView | ManualView | SessionView | FileView | ToolView | AgentView | ResultView | CodeView | CheckView | DecisionView | SystemPromptView | DatasetView | RepoView) & {
  /** CA-13: the runtime side of the tile: when it runs. */
  runtime?: RuntimeView;
  /** CA-15 P11: what the tile's node stores, for the Optional rows. */
  payload?: Record<string, unknown>;
};

export interface DetailsHandlers {
  /** CA-15 P11: change the keys an Optional row owns (null takes a key off). Absent: the Optional rows are not shown. */
  onExtras?: (id: string, patch: Record<string, unknown>) => void;
  /** CA-13 P2: save a decision's settings. Absent: it is shown, not edited. */
  onDecision?: (id: string, input: DecisionInput) => void;
  /** CA-13 P3: set when a runtime tile runs (null: always). Absent: Runs when is not shown. */
  onRunsWhen?: (id: string, runsWhen: RunsWhen | null) => void;
  /** CA-13 P5 to P8: change a tile's helpers, "defined in", trace link, install line, answer shape or costs. Absent: they are not shown. */
  onRuntime?: (id: string, patch: RuntimePatch) => void;
  /** CA-13 P6: "Read the helpers from code": the helpers, and the model and tools, as found in a create_deep_agent(...) call. */
  onReadHelpers?: (id: string, read: HelpersRead) => void;
  onRename: (id: string, title: string) => void;
  onOpenPrompt?: (id: string) => void;
  onModel: (id: string, model: string | null) => void;
  onAddUse: (id: string, use: Use) => void;
  /** TF-06: "A file from your computer" opens the file picker for this step. Absent: the item is not shown. */
  onAttach?: (id: string) => void;
  onRemoveUse: (id: string, use: Use) => void;
  /** TF-08: name a file a step makes, and take one away (it also comes out of the steps that use it). Absent: no Makes list. */
  onAddMade?: (stepId: string, name: string) => void;
  onRemoveMade?: (fileId: string) => void;
  onRuns: (id: string, runs: Runs | null) => void;
  /** UI-P70: change a manual step's tool, its line or its picture (`media_id: null` takes it off). */
  onManual?: (id: string, fields: { tool?: string; text?: string; media_id?: string | null; where?: ManualWhere | null; lines?: readonly string[] }) => void;
  /** UI-P70: add or replace a manual step's picture. */
  onManualPicture?: (id: string, file: File) => void;
  /** UI-P69: write an agent's instructions. Absent, they are only shown. */
  onInstructions?: (id: string, text: string) => void;
  /** CA-02 P5: change what an agent ran in, its models or its tools. Absent: they are shown, not edited. */
  onAgentSetup?: (id: string, setup: { model: string; harness: string | null; models?: AgentModel[]; tools: string[]; memory?: string }) => void;
  onRemoveInside: (id: string) => void;
  onToggleSessionPrompt: (view: SessionView, row: ChecklistRow, on: boolean) => void;
  /** CA-28 P1: read a session's prompts again after they did not load. Absent: the Session window says so without Retry. */
  onRetrySessionPrompts?: (sessionKey: string) => void;
  /** TF-13: give a session whose client names no tool its tool (null: none). Absent: the picker is not shown. */
  onSessionTool?: (sessionId: string, tool: string | null) => void;
  /** CA-04 P1: change a session made here: its tool (null: "Typed here") or its day. Absent: they are shown, not edited. */
  onSessionMeta?: (key: string, change: { tool?: string | null; date?: string }) => void;
  /** CA-04 P6: what a session worked until (null takes it off). Absent: Worked until is shown, not edited. */
  onSessionGoal?: (key: string, goal: SessionGoal | null) => void;
  /** CA-05: change what a session carries beyond its steps: its extras are written whole (a key left out goes). Absent: they are shown, not edited. */
  onSessionExtras?: (key: string, extras: SessionExtras) => void;
  /** CA-05 P10: the file a trained model was trained on: sent with its result. Absent: the picker is not shown. */
  onTrainedOn?: (resultId: string, file: File) => void;
  /** CA-05 P9: how an agent tidies its notes and what it changes each round; an empty string takes a line off. Absent: the wells are not shown. */
  onAgentNotes?: (id: string, notes: { memoryTidy?: string; changesEachRound?: string }) => void;
  /** CA-05 P8: say how a model was run (null takes it off). Absent: How it was run and Where are not shown. */
  onModelRun?: (id: string, run: ModelRun | null) => void;
  /** CA-05 P7: the runs of a check, newest first. Absent: Runs is not shown. */
  onCheckRuns?: (id: string, runs: CheckRun[]) => void;
  /** CA-12 P12: a check's cases, saved when the field loses focus or a case is ticked or removed. */
  onCheckCases?: (id: string, cases: CheckCase[]) => void;
  /** CA-18: a check's test description, pass criteria, failure notes and last run date, written for what changed. Absent: they are shown and not changed. */
  onCheckText?: (id: string, patch: { tested?: string; passing?: string; onFail?: string; runAt?: string }) => void;
  /** CA-18: a piece of code's lines and language, written for what changed. */
  onCodeSource?: (id: string, patch: { source?: string; language?: string }) => void;
  /** CA-05 P5: the sessions this one ran at the same time as; the pairing is written both ways. Absent: the menu is not shown. */
  onSessionTogether?: (key: string, keys: string[]) => void;
  /** CA-04 P5: say how a tool was connected and where an MCP server ran. Absent: the choice rows are not shown. */
  onToolConnection?: (id: string, connection: ToolConnection | null, runsAt: ToolRunsAt | null) => void;
  /** CA-04 P4: "Add to setup" opens the file picker for this session's setup. Absent: the button is not shown. */
  onAddToSetup?: (sessionKey: string) => void;
  /** CA-04 P4: mark a setup item Not shared. Absent: the button is not shown. */
  onNotShared?: (id: string) => void;
  onDownload: (id: string) => void;
  onFields: (id: string, fields: Record<string, string | null>) => void;
  onAddPicture: (id: string, file: File) => void;
  onUseAsCover: (mediaId: string) => void;
  onSelect?: (id: string) => void;
}

/** CA-06 P4: the selected part's colour: a dot before the eyebrow, and the colour button beside the title. */
export interface DetailsColour {
  /** "Prompt 3", "Session 2". */
  what: string;
  colour: string | null;
  onPick: (anchor: HTMLElement) => void;
  /** CA-19 P5: the selected component's ref, for its group's label. */
  to?: string;
}


export interface DetailsPanelProps extends DetailsHandlers {
  /** CA-06 P4: the selected part's colour: a dot before its line. Absent for a part that takes none. */
  colour?: DetailsColour | null;
  /** CA-04 P4: kept for the page; the Setup of a session is read in its own window now. */
  focusSetup?: { key: string; at: number } | null;
  phone: boolean;
  view: DetailsView | null;
  inBuild?: readonly string[];
  /** TF-08: kept for the page. */
  focusMakes?: { id: string; at: number } | null;
  /** CA-18: names the other tiles a section points at (their number, kind and session). Absent: they are named as the view names them. */
  build?: BuildFacts;
  /** CA-18: opens the window for what is shown. Absent: no Edit. */
  onEdit?: () => void;
  /** CA-18 P4: the columns Details is laid out in. Absent: one. */
  plan?: DetailsPlan;
}

/** CA-18 P4: Details laid out in columns: which section sits in which, how wide each is, and how tall a prose section may be before Read all. */
export interface DetailsPlan {
  /** Measuring copy: every piece alone in a block as wide as its container, each with no separator above, marked `data-measure`. */
  measure?: boolean;
  columnWidth: number;
  /** The keys of what sits in each column, in order: "head", section keys, "foot". */
  columns: readonly (readonly string[])[];
  /** A prose section taller than this is cut, with Read all, by section key. */
  cut?: Readonly<Record<string, number>>;
}

export const DETAILS_COPY = {
  empty: "Select a tile or session to see it here.",
  edit: "Edit",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Text not copied",
  readAll: "Read all",
} as const;

/* ── small pieces ── */

const kindOf = (item: ListItem): string | null => (item.kind ? `· ${item.kind}` : null);

function ItemBody({ item }: { item: ListItem }) {
  return (
    <>
      {item.tool ? (
        <span style={{ width: TOOL_MARK_SIZE, display: "inline-flex", justifyContent: "center", flexShrink: 0 }}>
          <ToolMark tool={item.tool} size={20} />
        </span>
      ) : item.badge ? (
        <span data-testid="details-badge" style={BADGE}>
          {item.badge}
        </span>
      ) : null}
      <span style={LIST_NAME}>{item.name}</span>
      {kindOf(item) ? <span style={LIST_KIND}>{kindOf(item)}</span> : null}
      {item.detail ? <span style={LIST_DETAIL}>{item.detail}</span> : null}
      {item.value ? <span style={LIST_VALUE}>{item.value}</span> : null}
    </>
  );
}

/** A links row selects its tile; a row with no tile behind it is plain. */
function LinkItem({ item, onSelect }: { item: ListItem; onSelect?: (id: string) => void }) {
  const id = item.id;
  if (id && onSelect) {
    return (
      <button type="button" data-testid="details-link" onClick={() => onSelect(id)} style={{ ...LIST_ROW, ...LINK_ROW }}>
        <ItemBody item={item} />
      </button>
    );
  }
  return (
    <div style={LIST_ROW}>
      <ItemBody item={item} />
    </div>
  );
}

function Prose({ value, changes, clamp, onReadAll }: { value: Extract<SectionValue, { type: "prose" }>; changes?: readonly ChangeRange[]; clamp?: number; onReadAll?: () => void }) {
  const style = value.code ? PROSE_CODE : value.muted ? PROSE_MUTED : PROSE;
  return (
    <>
      <p data-testid="details-prose" style={clamp ? { ...style, maxHeight: clamp, overflow: "hidden" } : style}>
        {value.changes ? <ChangedText text={value.text} changes={changes ?? value.changes} /> : value.text}
      </p>
      {value.changes?.length ? (
        <p data-testid="changes-line" style={text(11.5, 400, t.label, { margin: 0 })}>
          {changesLine(value.changes.length)}
        </p>
      ) : null}
      {clamp && onReadAll ? (
        <div style={VALUE}>
          <Button variant="secondary" size={28} fontSize={12} onClick={onReadAll} style={EDIT_BUTTON}>
            {DETAILS_COPY.readAll}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function ValueView({ value, onSelect, clamp, onReadAll }: { value: SectionValue; onSelect?: (id: string) => void; clamp?: number; onReadAll?: () => void }) {
  switch (value.type) {
    case "prose":
      return <Prose value={value} clamp={clamp} onReadAll={onReadAll} />;
    case "rows":
      return (
        <div role="list">
          {value.rows.map((row) => (
            <div key={row.label} role="listitem" data-testid="details-row" style={ROW}>
              <span style={ROW_LABEL}>{row.label}</span>
              <span style={ROW_VALUE}>{row.value}</span>
            </div>
          ))}
        </div>
      );
    case "list":
      return (
        <div role="list">
          {value.items.map((item, at) => (
            <div key={`${item.id ?? ""}${at}`} role="listitem" style={LIST_ROW}>
              <ItemBody item={item} />
            </div>
          ))}
        </div>
      );
    case "links":
      return (
        <div role="list">
          {value.items.map((item, at) => (
            <div key={`${item.id ?? ""}${at}`} role="listitem">
              <LinkItem item={item} onSelect={onSelect} />
            </div>
          ))}
        </div>
      );
    case "chips":
      return (
        <div role="list" style={CHIPS}>
          {value.chips.map((chip, at) => (
            <span key={`${chip}${at}`} role="listitem" style={BADGE}>
              {chip}
            </span>
          ))}
        </div>
      );
  }
}

/** Copy: a 26 square control that puts a prose section's text on the clipboard, and says so. */
function CopyButton({ text: words }: { text: string }) {
  const [said, setSaid] = useState("");
  const announce = useAnnounce();
  useEffect(() => {
    if (said) announce(said);
  }, [said, announce]);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <>
      <IconButton
        icon={Copy}
        label={DETAILS_COPY.copy}
        size={26}
        onClick={() => {
          void (async () => {
            try {
              await navigator.clipboard.writeText(words);
              setSaid(DETAILS_COPY.copied);
            } catch {
              setSaid(DETAILS_COPY.copyFailed);
            }
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setSaid(""), 2000);
          })();
        }}
      />
    </>
  );
}

/** One section: its label, its count under it, a reading button at the right, then its value. Not first in its column: 22, a rule, 22. */
export function DetailsSection({ section, first, view, onSelect, clamp, onReadAll }: { section: ReadSection; first: boolean; view: DetailsView; onSelect?: (id: string) => void; clamp?: number; onReadAll?: () => void }) {
  const value = section.value;
  const copyable = value.type === "prose" && value.copy ? value.text : null;
  void view;
  return (
    <section data-testid="details-section" data-section={section.key} data-prose={value.type === "prose" ? "true" : undefined} aria-label={section.label} style={{ position: "relative", minWidth: 0, ...(first ? null : SECTION_BREAK) }}>
      <div style={SECTION_HEAD}>
        <div style={{ minWidth: 0 }}>
          <h4 style={SECTION_LABEL}>{section.label}</h4>
          {value.count ? <p data-testid="details-count" style={SECTION_COUNT}>{value.count}</p> : null}
        </div>
        {copyable ? <CopyButton text={copyable} /> : null}
      </div>
      <div style={VALUE}>
        <ValueView value={value} onSelect={onSelect} clamp={clamp} onReadAll={onReadAll} />
      </div>
    </section>
  );
}

/** "In Login flow" under the header line, 6 below, for a member of a named group; nothing otherwise. */
function MemberGroupLine({ to }: { to: string }) {
  const group = useGroupOf(to);
  if (!group?.name) return null;
  return (
    <span data-testid="details-group" style={{ display: "flex", marginTop: 6, minWidth: 0 }}>
      <MemberLabel to={to} inside testId="details-group-label" />
    </span>
  );
}

/** The head: the tool's mark, the title and the modal's header line (a colour dot before it when set), Edit at the right. */
export function DetailsHead({ view, colour, onEdit }: { view: DetailsView; colour?: DetailsColour | null; onEdit?: () => void }) {
  const head = headOf(view);
  const editable = view.kind !== "file";
  return (
    <header data-testid="details-head" style={{ ...HEAD_ROW, marginBottom: HEAD_BELOW }}>
      {head.tool || view.kind === "prompt" || view.kind === "session" ? (
        <span style={HEAD_MARK}>
          <ToolMark tool={head.tool} model={head.model} size={24} />
        </span>
      ) : null}
      <div style={HEAD_TEXT}>
        <h3 data-default-title={head.untitled ? "true" : undefined} {...fullText(head.title)} style={head.untitled ? { ...HEAD_TITLE, color: t.text2 } : HEAD_TITLE}>
          {head.title}
        </h3>
        <p data-testid="details-line" style={HEAD_LINE}>
          {colour?.colour ? <ColourDot colour={colour.colour} size={8} /> : null}
          <span>{head.line}</span>
        </p>
        {/* CA-19 P5: a member of a named group: "In Login flow", under the header line. */}
        {colour?.to ? <MemberGroupLine to={colour.to} /> : null}
      </div>
      {onEdit && editable ? (
        <Button variant="secondary" size={28} fontSize={12} onClick={onEdit} style={EDIT_BUTTON}>
          {DETAILS_COPY.edit}
        </Button>
      ) : null}
    </header>
  );
}

/** Contains its children's margins, so a measured piece is as tall as it draws. */
const FLOW: CSSProperties = { display: "flow-root" };

const nameOnly: BuildFacts = { ref: () => null };

/** The sections a tile holds and what it leaves empty: what the panel and the layout both read. */
export function detailsOf(view: DetailsView, build: BuildFacts = nameOnly) {
  const { sections, notSet } = readSections(view, build);
  return { head: headOf(view), sections, notSet, foot: notSetLine(notSet) };
}

/* ── the panel ── */

function Body({ view, plan, colour, build, onSelect, onEdit, onOpenPrompt }: { view: DetailsView; plan?: DetailsPlan; colour?: DetailsColour | null; build?: BuildFacts; onSelect?: (id: string) => void; onEdit?: () => void; onOpenPrompt?: (id: string) => void }) {
  const { sections, foot } = detailsOf(view, build);
  const id = view.kind === "session" ? view.key : view.id;
  const readAll = view.kind === "prompt" && onOpenPrompt ? () => onOpenPrompt(id) : undefined;
  const one = (section: ReadSection, first: boolean) => (
    <DetailsSection key={section.key} section={section} first={first} view={view} onSelect={onSelect} clamp={plan?.cut?.[section.key]} onReadAll={readAll} />
  );
  /* CA-18b P3: colour and references close Details, after its own sections and the Not set line. */
  const refs = useReferenceSection(colour?.to);
  const references = (first: boolean) => (refs ? <ColourReferences key="references" section={refs.section} value={refs.value} first={first} clamp={plan?.cut?.references} /> : null);
  if (!plan) {
    return (
      <div style={COLUMN}>
        <DetailsHead view={view} colour={colour} onEdit={onEdit} />
        {sections.map((section, at) => one(section, at === 0))}
        {foot ? <p data-testid="details-not-set" style={NOT_SET}>{foot}</p> : null}
        {references(sections.length === 0 && !foot)}
      </div>
    );
  }
  if (plan.measure) {
    return (
      <div data-testid="details-measure" style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
        <div data-measure="head" style={FLOW}><DetailsHead view={view} colour={colour} onEdit={onEdit} /></div>
        {sections.map((section) => (
          <div key={section.key} data-measure={section.key} style={FLOW}>{one(section, true)}</div>
        ))}
        {foot ? <div data-measure="foot" style={FLOW}><p data-testid="details-not-set" style={NOT_SET}>{foot}</p></div> : null}
        {refs ? <div data-measure="references" data-trailing="true" style={FLOW}>{references(true)}</div> : null}
      </div>
    );
  }
  const byKey = new Map<string, ReactNode>([["head", <DetailsHead key="head" view={view} colour={colour} onEdit={onEdit} />], ["foot", foot ? <p key="foot" data-testid="details-not-set" style={NOT_SET}>{foot}</p> : null]]);
  return (
    <div data-testid="details-columns" style={{ display: "flex", alignItems: "flex-start", gap: 48 }}>
      {plan.columns.map((keys, at) => (
        <div key={at} data-testid="details-column" style={{ ...COLUMN, width: plan.columnWidth, flexShrink: 0 }}>
          {keys.map((key, index) => {
            const section = sections.find((entry) => entry.key === key);
            const earlier = keys.slice(0, index).some((before) => before !== "head");
            if (section) return one(section, !earlier);
            if (key === "references") return references(!earlier);
            return byKey.get(key) ?? null;
          })}
        </div>
      ))}
    </div>
  );
}

/** The selected tile, read: its sections, in the modal's order. Nothing in it can be typed into. */
/** CA-22 P6: when the selection changes, the content fades out over FAST and the new content fades in over FAST. Nothing slides. */
function DetailsFade({ view, children }: { view: DetailsView | null; children: ReactElement }) {
  const subject = view as ({ id?: string; key?: string } & { kind: string }) | null;
  return <Swap id={subject ? `${subject.kind}:${subject.id ?? subject.key ?? ""}` : "none"}>{children}</Swap>;
}

/** CA-24 P1: Details while a selection loads: 6 lines, 22 apart. */
export function DetailsLoading() {
  return (
    <LoadingRegion what="details" data-testid="details-loading" style={{ display: "flex", flexDirection: "column", gap: LINE_GAP }}>
      {DETAILS_LINES.map((width, at) => (
        <LoadingBlocks key={at} kind="line" width={width} />
      ))}
    </LoadingRegion>
  );
}

export function DetailsPanel({ view, colour = null, build, onEdit, plan, onSelect, onOpenPrompt }: DetailsPanelProps) {
  if (!view) return <DetailsFade view={null}><p style={{ ...EMPTY, userSelect: "none" }}>{DETAILS_COPY.empty}</p></DetailsFade>;
  /* CA-24 P1: a selection that is still loading is six lines of building blocks, scaled to Details' width. */
  if (view.kind === "session" && view.status === "loading") return <DetailsLoading />;
  return (
    <DetailsFade view={view}>
      <div data-testid="details-panel" data-kind={view.kind} style={{ ...COLUMN, fontSize: 13 }}>
        <Body view={view} plan={plan} colour={colour} build={build} onSelect={onSelect} onEdit={onEdit} onOpenPrompt={onOpenPrompt} />
      </div>
    </DetailsFade>
  );
}

export default DetailsPanel;
