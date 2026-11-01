/* UI-P90 — The build and What you need in the refined look, as `design/reference/refined/{dusk,noon}/build-list.html`
   draws them.

   UI-P99: THIS WAS THE REFINED FORK. The current view it forked is deleted and this took its name; what follows was written when both existed, so "the current look" below means the look that has been retired. `StepsList` and `NeedPanel` stay the current look; these take their props (imported, not
   copied), keep their state in the same hook (`useStepsList`), and say the same words in the same order with the same
   accessible names. `BuildView` draws them.

   THE BUILD. A toolbar (List / Map, the counts, the hint), then the session groups: each led by a head (the tool's
   real mark at 20 where the current look has a dot, the "New chat in …" heading 13/500, its meta 12 `--label` and a
   hairline filling the rest) and its step modules. A step is a module: the number in a 24 control tile (Geist Mono
   11), the title 14/500, Copy (secondary 26, no icon); the text 13.5/22 indented 36, four lines then "Read all";
   the paste-ins as a tile indented 36. The result is a module under its own head.

   WHAT YOU NEED. No module: the column on the surface. Sections are an eyebrow over a hairline and rows 48 high; a
   Tools and models row leads with its mark at 28; a file has Download (secondary 26). */

import { NO_HARNESS } from "@/lib/build/harnessWords";
import { MemberLabel } from "@/pages/site/compose/groupLabels";
import {
  Suspense,
  lazy,
  useState,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { Button } from "@/components/brand/Button";
import { CodeLines } from "@/components/code/CodeLines";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { SessionJump, jumpTo, useCurrentSession } from "@/components/build/SessionJump";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { ChevronRight } from "lucide-react";
import { ModelMark } from "@/components/brand/ModelMark";
import { Segmented } from "@/components/brand/Segmented";
import { MediaFigure } from "@/components/build/MediaFigure";
import { ChangedText } from "@/components/build/ChangedText";
import { FullPromptWindow, windowPrompts } from "@/components/build/FullPromptWindow";
import { PartWindow } from "@/components/build/PartWindow";
import { drawBranches } from "@/components/build/BranchRows";
import { LinkLines } from "@/components/build/LinkLines";
import { HelperChips, ShapeChip, TraceLink } from "@/components/build/RuntimeChips";
import { SaveMark, UsedInLine } from "@/components/build/ConnectionMarks";
import { CostStrip, TileCostLines } from "@/components/build/CostLines";
import { callsOf } from "@/lib/build/decisionCopy";
import { definesOf } from "@/lib/build/agentCode";
import { PromptName, CheckCasesBody, DatasetTileBody, FileTileBody, ManualTileBody, OpenOnGitHub, ReaderFacts, ReplyBlock, RepoTileBody, ResultTileBody, SystemPromptTileBody, TileFooter, ToolTileBody, DecisionTileBody, RetrievalTileBody, TypeLine } from "@/components/build/tileBodies";
import { footerFactsOf, resultTypeLine } from "@/lib/build/tileLines";
import { focusable } from "@/components/build/partNav";
import { flashOutline } from "@/components/post/RefLinks";
import { borderFor, outlineFor } from "@/lib/theme/partColour";
import { groupKey, groupKind, groupOfStep, promptPlace, shownGroups, type SessionGroup } from "@/lib/build/graph";
import { parseRefTo, refTo } from "@/lib/build/thread";
import type { Step } from "@/lib/build/graph";
import { shortDate } from "@/lib/build/readerSteps";
import type { NeedGroup, NeedRow, ReaderFile, ReaderResult, ReaderStep } from "@/lib/build/readerSteps";
import { markFor } from "@/lib/models/marks";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { controlPaint, CONTROL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { OutsideWarning } from "../compose/OutsideWarning";
import { listPartsOf } from "../compose/partsModel";
import { WorkstreamHead } from "../compose/WorkstreamHead";
import { WORKSTREAM_BODY, WORKSTREAM_GROUP } from "../compose/workstreamRecipes";
import { CheckBlock, DotLine } from "../compose/refinedPieces";
import { ComparisonBlock, EvalHarnessBlock } from "@/components/build/evalBlocks";
import { hasBeforeYouSend, BeforeYouSend } from "./BeforeYouSend";
import { modelLabel } from "@/lib/models/registry";
import { stepList } from "@/lib/build/readerSteps";
import { modelRunLine } from "@/lib/build/modelRun";
import { groupByLoaded } from "@/lib/build/setup";
import { bracketed, changesLine } from "@/lib/build/changes";
import { copyTogether } from "@/lib/build/copyTogether";
import { AgentRules, GateLine, JobLine, TeamHead, TeamLinesContext, WaitsLine } from "@/components/build/teamLines";
import { scrollBehavior } from "@/lib/theme/motion";
import type { BuildStepsView } from "./buildModel";

/** How long the step a chip or an address named stays ringed. */
export const RING_MS = 1200;

/** How long Copy says it worked. */
export const COPIED_MS = 1500;

/** At most this many rows in a What you need group, then "Show {n} more". */
export const NEED_ROWS = 6;

/** A text past this many words (or lines) is clamped to four lines, so it offers the whole of it. */
export const LONG_WORDS = 40;

export const mono = (size: 11 | 11.5 | 12): CSSProperties => ({ fontFamily: DM_MONO, fontSize: size, lineHeight: "normal", color: t.text2 });

export const stepDomId = (id: string) => `step-${id}`;

export const needDomId = (id: string) => `need-${id}`;

export const isInstructions = (entry: ReaderStep) => entry.step.id.endsWith(":instructions");

export const isContainer = (entry: ReaderStep) => entry.step.kind === "agent" || entry.step.kind === "team";

export const isLong = (step: Step) => step.words > LONG_WORDS || step.text.split("\n").length > 4;

/** The text "Copy the team" puts on the clipboard: each agent, numbered, with its instructions whole. */
export function teamText(entry: ReaderStep): string {
  const parts: string[] = [];
  const visit = (list: readonly ReaderStep[]) => {
    for (const child of list) {
      if (child.step.text) parts.push(`${child.step.number} ${child.title}\n\n${bracketed(child.step.text, child.step.changes)}`);
      visit(child.children.filter((grand) => !isInstructions(grand)));
    }
  };
  visit(entry.children);
  return parts.join("\n\n");
}

/** The words a copy puts on the clipboard for a step: CA-04 P2, a step and what is sent with it, together. */
export const copyTextOf = (entry: ReaderStep): string => (isContainer(entry) ? teamText(entry) : entry.step.sentWith?.length ? copyTogether(entry.step) : bracketed(entry.step.text, entry.step.changes));

export function useConfirmed(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const confirm = useCallback(() => {
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), COPIED_MS);
  }, []);
  return [on, confirm];
}

export const modelOf = (step: Step): string => (step.model ? modelRunLine(modelLabel(step.model) || step.model, step.modelRun) : "");

/** The names the full prompt window shows on its Uses chips. */
export function namesIn(steps: readonly ReaderStep[]): Record<string, string> {
  const names: Record<string, string> = {};
  const visit = (list: readonly ReaderStep[]) => {
    for (const entry of list) {
      for (const file of entry.attach) names[file.id] = file.name;
      for (const tool of entry.tools) names[tool.id] = tool.name;
      visit(entry.children);
    }
  };
  visit(steps);
  return names;
}

/** The sentence on the right of the head row. */
export function headNote(steps: readonly ReaderStep[]): string {
  const at = steps.findIndex(isContainer);
  if (at < 0) return "copy each step into the chat it names";
  const word = steps[at].step.kind === "team" ? "team" : "agent";
  const before = steps.slice(0, at).map((entry) => entry.step.number);
  return before.length > 0 ? `${stepList(before)} set it up · the ${word} then runs by itself` : `the ${word} runs by itself`;
}

export interface StepsListProps {
  view: BuildStepsView;
  phone: boolean;
  announce: (text: string) => void;
}

/**
 * What The build keeps between renders, shared by this view and its refined fork (UI-P90): the lens, the step that is
 * ringed, the step open in the full prompt window, where the Map starts, and the lookups the window reads.
 */
export function useStepsList(view: BuildStepsView, phone: boolean) {
  const { steps } = view;
  const [lens, setLens] = useState<"list" | "map">("list");
  const [ringed, setRinged] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Scroll to a step and ring it for 1.2s. */
  const go = useCallback((id: string) => {
    const at = document.getElementById(stepDomId(id));
    if (!at) return;
    at.scrollIntoView?.({ behavior: scrollBehavior(), block: "center" });
    clearTimeout(timer.current);
    setRinged(id);
    timer.current = setTimeout(() => setRinged(null), RING_MS);
  }, []);

  /* `#node-{id}` in the address: the step's card, rung. A part that is not a step is What you need's row. */
  const focusKey = view.focus ? `${view.focus.id}:${view.focus.n}` : null;
  useEffect(() => {
    if (!view.focus) return;
    if (document.getElementById(stepDomId(view.focus.id))) go(view.focus.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const raw = useMemo(() => steps.map((entry) => entry.step), [steps]);
  const names = useMemo(() => namesIn(steps), [steps]);
  const toolOf = useMemo(() => {
    const tools = new Map<string, string | null>();
    let current: string | null = null;
    for (const entry of steps) {
      if (entry.chat?.kind === "new") current = entry.chat.tool;
      if (entry.chat) tools.set(entry.step.id, current);
    }
    return (id: string) => tools.get(id) ?? null;
  }, [steps]);
  const flat = useMemo(() => {
    const out = new Map<string, ReaderStep>();
    const visit = (list: readonly ReaderStep[]) => list.forEach((entry) => (out.set(entry.step.id, entry), visit(entry.children)));
    visit(steps);
    return out;
  }, [steps]);
  const map = lens === "map" && !phone && view.mapAvailable;
  return { lens, setLens, ringed, open, setOpen, go, raw, names, toolOf, flat, map };
}

/** The column to the right of The build: tools and models, files, how it runs, time and other parts. */
export interface NeedPanelProps {
  view: BuildStepsView;
  onOpenOther: (id: string) => void;
}

/** The Map is loaded when a reader first chooses it, and not before (UI-P74). UI-P91: its refined fork. */
const ReaderMap = lazy(() => import("./ReaderMap"));

/* ── type ── */

const text = (px: number, weight: 400 | 500, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: "normal",
  color,
  ...extra,
});

const tnum: CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** The indent that lines text up under a step's title: the 24 tile and its 12 gap. */
const INDENT = 36;

const bareButton: CSSProperties = {
  appearance: "none",
  background: "none",
  border: 0,
  margin: 0,
  padding: 0,
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  textAlign: "left",
};

/* ── recipes ── */

const moduleStyle = (ringed: boolean): CSSProperties => ({
  background: t.module,
  border: `1px solid ${t.moduleBorder}`,
  borderRadius: 8,
  boxShadow: t.moduleShadow,
  padding: 16,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  minWidth: 0,
  /* A step a chip or an address named is the selected recipe for 1.2s: an edge and a ring, never a colour. */
  ...(ringed ? { borderColor: t.selectedEdge, boxShadow: t.selectedRing } : null),
});

const tileStyle: CSSProperties = {
  background: t.tile,
  border: `1px solid ${t.tileBorder}`,
  borderRadius: 6,
  boxSizing: "border-box",
  minWidth: 0,
};

/** A reference: 22 high, the tile's fill, radius 4, 11.5. */
const chipStyle: CSSProperties = {
  ...tileStyle,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 22,
  padding: "0 8px",
  borderRadius: 4,
  ...text(11.5, 400, t.text),
  whiteSpace: "nowrap",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function Chip({ children }: { children: ReactNode }) {
  return <span style={chipStyle}>{children}</span>;
}

/** The step's number in a 24 control tile, Geist Mono 11. */
function NumberTile({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        ...CONTROL,
        flexShrink: 0,
        minWidth: 24,
        height: 24,
        padding: wide ? "0 6px" : 0,
        boxSizing: "border-box",
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: DM_MONO,
        fontSize: 11,
        lineHeight: "normal",
        color: t.text,
        ...tnum,
      }}
    >
      {children}
    </span>
  );
}

/** A secondary 26 that is a link: Download. */
function DownloadButton({ href, name, label = "Download" }: { href: string; name: string; label?: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <a
      href={href}
      download={name}
      data-hit=""
      aria-label={`${label} ${name}`}
      {...handlers}
      style={{
        ...controlPaint(state),
        height: 26,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 12px",
        borderRadius: 6,
        ...text(12.5, 500, t.text),
        whiteSpace: "nowrap",
        textDecoration: "none",
        flexShrink: 0,
        ...ring(state.focusVisible),
      }}
    >
      {label}
    </a>
  );
}

function CopyButton({ label = "Copy", what, text: words, onCopy, announce, phone }: { label?: string; what: string; text: string; onCopy: (text: string) => Promise<boolean>; announce: (text: string) => void; phone: boolean }) {
  const [, confirm] = useConfirmed();
  return (
    <Button
      variant="secondary"
      size={phone ? 44 : 28}
      fontSize={12}
      aria-label={`${label} ${what}`}
      style={phone ? undefined : { height: 26 }}
      onClick={async () => {
        if (await onCopy(words)) {
          confirm();
          announce("Copied");
        }
      }}
    >
      {label}
    </Button>
  );
}

/** An underlined text button: "Read all", "See the team in Map". */
function ReadAll({ onRead, label = "Read all", expanded }: { onRead: () => void; label?: string; expanded?: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      data-hit=""
      onClick={onRead}
      aria-expanded={expanded}
      {...handlers}
      style={{
        ...bareButton,
        height: 24,
        ...text(12.5, 500, t.text),
        textDecoration: "underline",
        textUnderlineOffset: 3,
        textDecorationColor: state.hovered ? t.text2 : t.line,
        ...ring(state.focusVisible),
      }}
    >
      {label}
    </button>
  );
}

/** The text at 13.5/22 indented 36: four lines, then "Read all" and the word count. */
function StepText({ step, onRead, alone = false, indent = INDENT }: { step: Step; onRead: () => void; alone?: boolean; indent?: number }) {
  const long = isLong(step);
  if (!step.text) return null;
  return (
    <>
      <p
        data-testid="step-text"
        style={{
          ...text(13.5, 400, t.text),
          margin: 0,
          paddingLeft: indent,
          lineHeight: "22px",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          ...(long ? { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" as const, overflow: "hidden" } : null),
        }}
      >
        <ChangedText text={step.text} changes={step.changes} />
      </p>
      {step.changes?.length ? (
        <p data-testid="changes-line" style={{ ...text(11.5, 400, t.label), margin: 0, paddingLeft: indent }}>
          {changesLine(step.changes.length)}
        </p>
      ) : null}
      {long ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: indent }}>
          <ReadAll onRead={onRead} />
          <span style={text(11.5, 400, t.label, tnum)}>{step.words} words</span>
        </div>
      ) : alone ? (
        <div style={{ ...text(11.5, 400, t.label, tnum), paddingLeft: indent }}>{step.words} words</div>
      ) : null}
    </>
  );
}

/* ── the paste-ins ── */

/** A paste-in: the what-line and the reference chip, one control that goes to the step it comes from. */
function PasteRow({ text: what, title, phone, onGo }: { text: string; title: string; phone: boolean; onGo: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onGo}
      {...handlers}
      style={{
        ...bareButton,
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: phone ? 44 : 32,
        minWidth: 0,
        ...ring(state.focusVisible),
      }}
    >
      <span style={text(12.5, 400, t.text2)}>{what}</span>
      <span style={{ ...chipStyle, background: state.hovered ? t.controlOn : t.tile }}>{title}</span>
    </button>
  );
}

/** "Paste in" and its rows, then "attach" with its Download. Outside an agent or a team only. */
function Inputs({ entry, phone, go }: { entry: ReaderStep; phone: boolean; go: (id: string) => void }) {
  if (entry.pasteIns.length === 0 && entry.attach.length === 0) return null;
  return (
    <div style={{ ...tileStyle, marginLeft: INDENT, padding: "8px 12px", display: "flex", flexDirection: "column" }}>
      <Eyebrow style={{ padding: "4px 0" }}>Paste in</Eyebrow>
      {entry.pasteIns.map((paste) => (
        <PasteRow key={paste.stepId} text={paste.text} title={paste.title} phone={phone} onGo={() => go(paste.stepId)} />
      ))}
      {entry.attach.map((file) =>
        file.madeIn ? (
          <MadeFileRow key={file.id} file={file} madeIn={file.madeIn} phone={phone} go={go} />
        ) : (
          <div key={file.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32, minWidth: 0 }}>
            {file.setup ? (
              <span style={{ ...text(12.5, 400, t.text), minWidth: 0, overflowWrap: "anywhere" }}>
                {file.setup.kind === "project" ? `Put ${file.name} in your project` : `Import ${file.name} into ${file.setup.tool}`}
              </span>
            ) : (
              <>
                <span style={text(12.5, 400, t.text2)}>attach</span>
                <Chip>{file.name}</Chip>
              </>
            )}
            <span style={{ flexGrow: 1 }} />
            <AttachDownload file={file} />
          </div>
        ),
      )}
    </div>
  );
}

function AttachDownload({ file }: { file: ReaderFile }) {
  return file.download ? <DownloadButton href={file.download} name={file.name} /> : null;
}

/** "attach brand-guide.md, made in step 2" and a way to that step, in place of Download. Wraps on a narrow screen. */
function MadeFileRow({ file, madeIn, phone, go }: { file: ReaderFile; madeIn: NonNullable<ReaderFile["madeIn"]>; phone: boolean; go: (id: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, minHeight: 32, minWidth: 0 }}>
      <span style={text(12.5, 400, t.text2)}>attach</span>
      <span style={{ display: "inline-flex", alignItems: "center", minWidth: 0 }}>
        <Chip>{file.name}</Chip>
        <span style={{ ...text(12.5, 400, t.text2), whiteSpace: "nowrap" }}>, made in {stepList([madeIn.number], false)}</span>
      </span>
      <span style={{ flexGrow: 1 }} />
      <GoToStep stepId={madeIn.stepId} number={madeIn.number} phone={phone} go={go} />
    </div>
  );
}

/** "Go to step 2": where Download would be, for a file a step makes. A real link to the step's `#node-` address that scrolls and rings the card. */
function GoToStep({ stepId, number, phone, go }: { stepId: string; number: string; phone: boolean; go: (id: string) => void }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <a
      href={`#node-${stepId}`}
      data-hit=""
      onClick={(event) => {
        event.preventDefault();
        go(stepId);
      }}
      {...handlers}
      style={{
        ...text(12.5, 500, t.text),
        display: "inline-flex",
        alignItems: "center",
        minHeight: phone ? 44 : 24,
        whiteSpace: "nowrap",
        flexShrink: 0,
        textDecoration: "underline",
        textUnderlineOffset: 3,
        textDecorationColor: state.hovered ? t.text2 : t.line,
        ...ring(state.focusVisible),
      }}
    >
      Go to {stepList([number], false)}
    </a>
  );
}

/** Under a step's text: what to keep its output as, once for each file it makes. */
function SaveLines({ files, indent = INDENT }: { files: readonly ReaderFile[]; indent?: number }) {
  return (
    <>
      {files.map((file) => (
        <p key={file.id} data-testid="save-line" style={{ ...text(12, 400, t.label), margin: 0, paddingLeft: indent, overflowWrap: "anywhere" }}>
          Save what this step gives you as {file.name}
        </p>
      ))}
    </>
  );
}

/* ── tiles sent with a step (CA-04 P2) ── */

/** A tile's kind as its row says it. */
const TILE_KIND: Record<string, string> = { prompt: "Prompt", code: "Code", file: "File", manual: "Manual step", check: "Check", agent: "Agent", team: "Team", tool: "Tool", decision: "Decision" };

/** What is sent with a step, indented 36 under its text as the paste-ins are, each able to hold more, indented again. */
function SentWith({ entries, ctx }: { entries: readonly ReaderStep[]; ctx: Ctx }) {
  if (entries.length === 0) return null;
  return (
    <div data-testid="sent-with" style={{ marginLeft: INDENT, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      {entries.map((entry) => (
        <SentWithTile key={entry.step.id} entry={entry} ctx={ctx} />
      ))}
    </div>
  );
}

function SentWithTile({ entry, ctx }: { entry: ReaderStep; ctx: Ctx }) {
  const { step } = entry;
  const file = entry.file ?? null;
  const name = step.kind === "file" || step.kind === "code" ? (step.filename ?? step.title ?? step.language ?? null) : step.title;
  return (
    <div id={stepDomId(step.id)} data-testid="sent-with-tile" data-kind={step.kind} style={{ ...tileStyle, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0, ...colourEdge(step.colour, false) }}>
      <span style={{ ...text(12, 400, t.label), padding: "4px 0" }}>{`Sent with ${step.inside?.label ?? "this step"}`}</span>
      {step.kind === "file" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32, minWidth: 0 }}>
          <span style={text(12.5, 400, t.text2)}>attach</span>
          <Chip>{file?.name ?? name ?? "a file"}</Chip>
          <span style={{ flexGrow: 1 }} />
          {file ? <AttachDownload file={file} /> : null}
        </div>
      ) : (
        <>
          <span style={{ ...text(12.5, 500, t.text), overflowWrap: "anywhere" }}>{[TILE_KIND[step.kind] ?? step.kind, name].filter(Boolean).join(" · ")}</span>
          {step.kind === "code" ? (
            <CodeLines text={step.text} compact testId="code-lines" label={`${name ?? "Code"} text`} />
          ) : step.text ? (
            <StepText step={step} indent={0} onRead={() => ctx.read(step.id)} />
          ) : null}
        </>
      )}
      <SentWith entries={entry.sentWith} ctx={ctx} />
    </div>
  );
}

/* ── the heads ── */

/** A group's head: the tool's mark (or a 6px square where there is none), the heading, its meta and a hairline. */
function Head({ children, detail, tool, model }: { children: ReactNode; detail?: ReactNode; tool?: string | null; model?: string | null }) {
  const marked = markFor({ tool, model }) !== null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, minWidth: 0 }}>
      {marked ? (
        <span style={{ display: "inline-flex", color: t.text }}>
          <ModelMark tool={tool} model={model} size={20} />
        </span>
      ) : (
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 1, background: t.label, flexShrink: 0 }} />
      )}
      <span style={{ ...text(13, 500, t.text), whiteSpace: "nowrap", flexShrink: 0 }}>{children}</span>
      {detail ? (
        <span style={{ ...text(12, 400, t.label), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{detail}</span>
      ) : null}
      <span aria-hidden="true" style={{ flexGrow: 1, height: 1, background: t.hairline, minWidth: 12 }} />
    </div>
  );
}

/* ── a session's setup (CA-04 P4) ── */

/** How far a session's setup sits in under its head. */
const SETUP_INDENT = 28;

/** A chat's head, with Setup at its end when the session has one: closed until asked, then its rows under the head. */
type SessionChat = Extract<NonNullable<ReaderStep["chat"]>, { kind: "new" }>;

/** CA-14 P3: a session's fold, for its head and the tiles under it. */
interface Fold {
  folded: boolean;
  toggle: () => void;
  /** The id of the element that holds the tiles. */
  controls: string;
  tiles: number;
  phone: boolean;
}

/**
 * CA-14 P2: a session's head as a reader sees it, the same line as the maker's without the maker's controls: a fold
 * arrow, the app's mark, "Session 1 · Claude", the title as plain text (nothing when there is none), the tile count only
 * while folded, and the date.
 */
function ReaderSessionHead({ chat, fold }: { chat: SessionChat; fold: Fold }) {
  const marked = markFor({ tool: chat.tool, model: chat.model }) !== null;
  const name = `Session ${chat.session}`;
  return (
    <div role="group" tabIndex={-1} aria-label={`${name} · ${chat.tool ?? NO_HARNESS}`} data-testid="reader-session-head" style={{ outline: "none", display: "flex", flexWrap: fold.phone ? "wrap" : "nowrap", alignItems: "center", columnGap: 8, rowGap: 4, minHeight: 44, minWidth: 0 }}>
      <IconButton icon={ChevronRight} glyph={fold.folded ? "chev" : "chevd"} boxed={false} size={30} data-hit="" label={`${fold.folded ? "Expand" : "Collapse"} ${name}`} aria-expanded={!fold.folded} aria-controls={fold.controls} onClick={fold.toggle} />
      {marked ? (
        <span style={{ display: "inline-flex", color: t.text }}>
          <ModelMark tool={chat.tool} model={chat.model} size={20} />
        </span>
      ) : (
        <span aria-hidden="true" style={{ display: "inline-flex", width: 20, justifyContent: "center", color: t.label }}>
          <Glyph name="layers" size={16} />
        </span>
      )}
      <span style={{ ...text(15, 500, t.text), whiteSpace: "nowrap" }}>
        {name}
        {chat.tool ? ` · ${chat.tool}` : ""}
      </span>
      {chat.title ? (
        <span data-testid="session-title-text" style={{ ...text(15, 400, t.text), minWidth: 0, flex: "1 1 120px", overflowWrap: "anywhere" }}>
          {chat.title}
        </span>
      ) : (
        <span style={{ flex: "1 1 0", minWidth: 0 }} />
      )}
      {fold.folded ? (
        <span data-testid="session-count" style={{ ...text(13, 400, t.text2), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {fold.tiles} {fold.tiles === 1 ? "tile" : "tiles"}
        </span>
      ) : null}
      {chat.key ? <MemberLabel to={refTo({ kind: "session", id: chat.key })} /> : null}
      {chat.key ? <SaveMark kind="session" id={chat.key} /> : null}
      {chat.date ? <span style={{ ...text(13, 400, t.label), whiteSpace: "nowrap" }}>{chat.date}</span> : null}
    </div>
  );
}

function ChatHead({ chat, copy, fold }: { chat: SessionChat; copy?: { onCopy: (text: string) => Promise<boolean>; announce: (text: string) => void; phone: boolean }; fold?: Fold | null }) {
  const [open, setOpen] = useState(false);
  const setup = chat.setup;
  // CA-05 P6: under two quiet labels, only when both have rows.
  const grouped = groupByLoaded(setup.map((item) => ({ ...item, loaded: item.loaded ?? ("start" as const) })));
  const setupRow = (item: (typeof setup)[number]) => (
            <div key={item.id} data-testid="setup-row" data-not-shared={item.notShared ? "true" : undefined} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderBottom: `1px solid ${t.hairline}`, minWidth: 0, ...(item.notShared ? { borderBottom: `1px dashed ${t.line}` } : null) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
          <span style={text(12, 400, t.label)}>{item.notShared ? `${item.kindLabel} · not shared` : item.kindLabel}</span>
          <span style={{ ...text(12.5, 400, t.text), overflowWrap: "anywhere" }}>{item.rule ? `${item.rule.when}${item.rule.filter ? ` · ${item.rule.filter}` : ""}: ${item.name}` : item.name}</span>
          {item.description ? <span style={{ ...text(11.5, 400, t.label), overflowWrap: "anywhere" }}>{item.description}</span> : null}
        </div>
        {item.download ? <DownloadButton href={item.download} name={item.name} /> : null}
      </div>
      {item.files.map((file) => (
        <div key={file.id} style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, minWidth: 0 }}>
          <span style={{ ...text(12, 400, t.text2), flexGrow: 1, minWidth: 0, overflowWrap: "anywhere" }}>{file.name}</span>
          {file.download ? <DownloadButton href={file.download} name={file.name} /> : null}
        </div>
      ))}
    </div>
  );
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          {fold && chat.session !== null ? (
            <ReaderSessionHead chat={chat} fold={fold} />
          ) : (
            <Head detail={chat.detail} tool={chat.tool} model={chat.model}>
              {chat.headline}
            </Head>
          )}
        </div>
        {(setup.length > 0 || chat.startedWith) && !fold?.folded ? (
          <span style={{ paddingTop: 8, flexShrink: 0 }} data-testid="setup-toggle">
            <ReadAll label="Setup" onRead={() => setOpen((value) => !value)} expanded={open} />
          </span>
        ) : null}
      </div>
      {/* CA-04 P6: what the session worked until, and when it runs, one quiet line each under its head. */}
      {chat.goal && !fold?.folded ? (
        <DotLine testId="goal-line" dot={chat.goal.reached ? t.evidence : t.label}>
          {chat.goal.line}
        </DotLine>
      ) : null}
      {chat.runsWhen && !fold?.folded ? <DotLine testId="runs-when-line">{chat.runsWhen}</DotLine> : null}
      {chat.facts && !fold?.folded ? <DotLine testId="facts-line">{chat.facts}</DotLine> : null}
      {chat.together && !fold?.folded ? <DotLine testId="together-line">{chat.together}</DotLine> : null}
      {open && !fold?.folded ? (
        <div data-testid="session-setup" style={{ marginLeft: SETUP_INDENT, paddingLeft: 12, borderLeft: `1px solid ${t.hairline}`, display: "flex", flexDirection: "column" }}>
          {/* CA-05 P3: the command that opened the session, as written, and the settings it names in plain words. */}
          {chat.startedWith ? (
            <div data-testid="started-with" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderBottom: `1px solid ${t.hairline}`, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ ...text(12, 400, t.label), flexGrow: 1 }}>Started with</span>
                {copy ? <CopyButton what="the command" text={chat.startedWith.command} onCopy={copy.onCopy} announce={copy.announce} phone={copy.phone} /> : null}
              </div>
              <code style={{ ...text(12, 400, t.text), fontFamily: DM_MONO, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{chat.startedWith.command}</code>
              {chat.startedWith.settings.map((line) => (
                <span key={line} style={text(11.5, 400, t.label)}>
                  {line}
                </span>
              ))}
            </div>
          ) : null}
          {grouped
            ? grouped.map((group) => (
                <div key={group.loaded} role="group" aria-label={group.label} data-testid="setup-loaded" data-loaded={group.loaded} style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ ...text(11.5, 400, t.label), paddingTop: 8 }}>{group.label}</span>
                  {group.items.map(setupRow)}
                </div>
              ))
            : setup.map(setupRow)}
        </div>
      ) : null}
    </>
  );
}

/* ── the modules ── */

interface Ctx {
  view: StepsListProps["view"];
  phone: boolean;
  announce: (text: string) => void;
  ringed: string | null;
  go: (id: string) => void;
  read: (id: string) => void;
}

function Title({ entry, right, place }: { entry: ReaderStep; right: ReactNode; /** A prompt: its place on the build, before the maker's own title. */ place?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <NumberTile>{entry.step.number}</NumberTile>
      {place ? (
        <h3 data-default-title={entry.isDefaultTitle ? "true" : undefined} style={{ margin: 0, flexGrow: 1, minWidth: 0, letterSpacing: "-0.005em" }}>
          <PromptName place={place} title={entry.isDefaultTitle ? null : entry.title} />
        </h3>
      ) : (
        <h3
          style={{
            ...text(14, 500, entry.isDefaultTitle ? t.text2 : t.text),
            margin: 0,
            flexGrow: 1,
            minWidth: 0,
            letterSpacing: "-0.005em",
            overflowWrap: "anywhere",
          }}
        >
          {entry.title}
        </h3>
      )}
      {/* CA-19 P5: a member of a named group says so, as in the List. */}
      <MemberLabel to={refTo({ kind: "node", id: entry.step.id })} />
      {right}
    </div>
  );
}

/** The number of the session a prompt is in, when it is in a numbered one. */
const readerSession = (groups: StepsListProps["view"]["groups"], step: Step): number | null => {
  const group = groupOfStep(groups ?? [], step);
  return group && groupKind(group) !== "legacy" ? group.number : null;
};

function StepCard({ entry, ctx }: { entry: ReaderStep; ctx: Ctx }) {
  const { step } = entry;
  const { view, phone, announce } = ctx;
  const ringed = ctx.ringed === step.id;

  if (step.kind === "check" && step.check) {
    /* CA-03 P5: how the build checked its work. Its answers and one status line; never the lamp, a reproduction
       count or the word for one. */
    return (
      <article id={stepDomId(step.id)} data-testid="step-card" data-step={step.number} data-kind="check" style={{ ...moduleStyle(ringed), ...colourEdge(step.colour, ringed) }}>
        <Title entry={entry} right={<SaveMark kind="step" id={step.id} />} />
        <TypeLine step={step} indent={INDENT} />
        <CheckBlock check={step.check} style={{ paddingLeft: INDENT }} />
        <ComparisonBlock check={step.check} indent={INDENT} />
        <EvalHarnessBlock check={step.check} indent={INDENT} />
        <CheckCasesBody cases={step.check.caseList} indent={INDENT} />
        <ReaderFacts facts={entry.facts ?? []} indent={INDENT} />
        <TileFooter facts={footerFactsOf(step)} indent={INDENT} />
        <SentWith entries={entry.sentWith} ctx={ctx} />
      </article>
    );
  }

  if (step.kind === "decision" && step.decision) {
    /* CA-13 P2: a decision the product asks a model for: its model, and one line per question. Drawn as the composer draws it. */
    return (
      <article
        id={stepDomId(step.id)}
        data-testid="step-card"
        data-step={step.number}
        data-kind="decision"
        style={{ ...moduleStyle(ringed), background: t.tile, borderColor: ringed ? t.selectedEdge : t.tileBorder, ...colourEdge(step.colour, ringed) }}
      >
        <Title entry={entry} right={null} />
        <TypeLine step={step} indent={INDENT} />
        <DecisionTileBody step={step} indent={INDENT} />
        <TileCostLines step={step} audience="reader" groups={view.groups ?? []} indent={INDENT} />
        <UsedInLine id={step.id} indent={INDENT} />
        <TileFooter facts={footerFactsOf(step)} indent={INDENT} />
        <SentWith entries={entry.sentWith} ctx={ctx} />
      </article>
    );
  }

  if (step.kind === "retrieval" && step.retrieval) {
    /* SV-29 P2: a similarity search that finds candidates: what it indexes, how many it returns and its recall. */
    return (
      <article id={stepDomId(step.id)} data-testid="step-card" data-step={step.number} data-kind="retrieval" style={{ ...moduleStyle(ringed), background: t.tile, borderColor: ringed ? t.selectedEdge : t.tileBorder, ...colourEdge(step.colour, ringed) }}>
        <Title entry={entry} right={null} />
        <TypeLine step={step} indent={INDENT} />
        <RetrievalTileBody step={step} indent={INDENT} />
        <TileCostLines step={step} audience="reader" groups={view.groups ?? []} indent={INDENT} />
        <UsedInLine id={step.id} indent={INDENT} />
        <SentWith entries={entry.sentWith} ctx={ctx} />
      </article>
    );
  }

  if (step.kind === "tool" || (step.kind === "file" && !step.inside)) {
    /* CA-12 P7, P8: a tool or a file the maker put in the session: what it is, drawn as the composer draws it. */
    const file = entry.file ?? null;
    return (
      <article
        id={stepDomId(step.id)}
        data-testid="step-card"
        data-step={step.number}
        data-kind={step.kind}
        style={{ ...moduleStyle(ringed), background: t.tile, borderColor: ringed ? t.selectedEdge : t.tileBorder, ...colourEdge(step.colour, ringed) }}
      >
        <Title entry={entry} right={null} />
        <TypeLine step={step} indent={INDENT} />
        {step.kind === "tool" ? <ToolTileBody step={step} indent={INDENT} /> : <FileTileBody step={step} indent={INDENT} />}
        <ReaderFacts facts={entry.facts ?? []} indent={INDENT} />
        {step.kind === "file" && file?.download ? (
          <div style={{ paddingLeft: INDENT }}>
            <AttachDownload file={file} />
          </div>
        ) : null}
        <TileFooter facts={footerFactsOf(step)} indent={INDENT} />
        <SentWith entries={entry.sentWith} ctx={ctx} />
      </article>
    );
  }

  if (step.kind === "system_prompt" || step.kind === "dataset" || step.kind === "repo") {
    /* CA-15 P9, P12: what the build was made from: a system prompt, a dataset or a GitHub repository, drawn as the composer draws them. */
    return (
      <article
        id={stepDomId(step.id)}
        data-testid="step-card"
        data-step={step.number}
        data-kind={step.kind}
        style={{ ...moduleStyle(ringed), background: t.tile, borderColor: ringed ? t.selectedEdge : t.tileBorder, ...colourEdge(step.colour, ringed) }}
      >
        <Title entry={entry} right={<>{step.kind === "system_prompt" ? <CopyButton what={`step ${step.number}`} text={step.text} onCopy={view.onCopy} announce={announce} phone={phone} /> : null}<SaveMark kind="step" id={step.id} /></>} />
        <TypeLine step={step} indent={INDENT} />
        {step.kind === "system_prompt" ? <SystemPromptTileBody step={step} indent={INDENT} full /> : step.kind === "dataset" ? <DatasetTileBody step={step} indent={INDENT} /> : <RepoTileBody step={step} indent={INDENT} />}
        <ReaderFacts facts={entry.facts ?? []} indent={INDENT} />
        <TileFooter facts={footerFactsOf(step)} indent={INDENT} link={step.kind === "repo" && step.repo ? <OpenOnGitHub url={step.repo.url} /> : null} />
        <SentWith entries={entry.sentWith} ctx={ctx} />
      </article>
    );
  }

  if (entry.manual) {
    /* Done by hand: nothing to copy. The tile's fill tells it from a prompt. */
    return (
      <article
        id={stepDomId(step.id)}
        data-testid="step-card"
        data-step={step.number}
        style={{ ...moduleStyle(ringed), background: t.tile, borderColor: ringed ? t.selectedEdge : t.tileBorder, ...colourEdge(step.colour, ringed) }}
      >
        <Title entry={entry} right={null} />
        <TypeLine step={step} indent={INDENT} />
        {step.gate ? <GateLine gate={step.gate} style={{ paddingLeft: INDENT }} /> : null}
        {step.waitsFor ? <WaitsLine waitsFor={step.waitsFor} style={{ paddingLeft: INDENT }} /> : null}
        <ManualTileBody step={step} indent={INDENT} picture={false} lean all />
        <SaveLines files={entry.makes} />
        <TileFooter facts={footerFactsOf(step)} indent={INDENT} />
        <SentWith entries={entry.sentWith} ctx={ctx} />
        {entry.manual.mediaId ? (
          <div style={{ paddingLeft: INDENT }}>
            <MediaFigure reference={entry.manual.mediaId} resolveMedia={view.resolveMedia} width={480} alt={entry.manual.line} />
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <article id={stepDomId(step.id)} data-testid="step-card" data-step={step.number} style={{ ...moduleStyle(ringed), ...colourEdge(step.colour, ringed) }}>
      <Title entry={entry} place={step.kind === "prompt" ? promptPlace(step.number, readerSession(view.groups, step)) : undefined} right={<><CopyButton what={`step ${step.number}`} text={copyTextOf(entry)} onCopy={view.onCopy} announce={announce} phone={phone} /><SaveMark kind="step" id={step.id} /></>} />
      <TypeLine step={step} indent={INDENT} />
      {step.waitsFor ? <WaitsLine waitsFor={step.waitsFor} style={{ paddingLeft: INDENT }} /> : null}
      {step.kind === "code" ? <CodeLines text={step.text} maxLines={8} testId="code-lines" label={`Code ${step.number}`} style={{ marginLeft: INDENT }} /> : <StepText step={step} alone={view.steps.length === 1} onRead={() => ctx.read(step.id)} />}
      {step.reply ? <ReplyBlock reply={step.reply} indent={INDENT} onRead={() => ctx.read(step.id)} /> : null}
      {step.outputShape ? <ShapeChip shape={step.outputShape} indent={INDENT} /> : null}
      <TileCostLines step={step} audience="reader" groups={view.groups ?? []} indent={INDENT} />
      <UsedInLine id={step.id} indent={INDENT} />
      {step.kind === "code" ? <LinkLines lines={[...callsOf(step.id, view.steps.map((candidate) => candidate.step)), ...definesOf(step.id, view.steps.map((candidate) => candidate.step))]} onOpen={ctx.go} indent={INDENT} /> : null}
      <SaveLines files={entry.makes} />
      <ReaderFacts facts={entry.facts ?? []} indent={INDENT} />
      {/* A prompt's words are said under its text already. */}
      <TileFooter facts={footerFactsOf(step).filter((fact) => step.kind !== "prompt" || !/ words?$/.test(fact))} indent={INDENT} />
      <SentWith entries={entry.sentWith} ctx={ctx} />
      <Inputs entry={entry} phone={phone} go={ctx.go} />
      {entry.chat?.kind === "same" ? <p style={{ ...text(12, 400, t.label), margin: 0, paddingLeft: INDENT }}>{entry.chat.text}</p> : null}
    </article>
  );
}

/** One agent or one prompt inside a team or an agent: a tile, with its "Uses" and where it goes. */
function InnerCard({ entry, ctx }: { entry: ReaderStep; ctx: Ctx }) {
  const { step } = entry;
  const { view, phone, announce } = ctx;
  const instructions = isInstructions(entry);
  const repeats = Boolean(entry.runs && step.runs && step.runs.how !== "once");
  const nested = entry.children.filter((child) => !isInstructions(child));
  const ringed = ctx.ringed === step.id;
  return (
    <>
      <article
        id={stepDomId(step.id)}
        data-testid="inner-card"
        data-step={step.number}
        style={{
          ...tileStyle,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          ...colourEdge(instructions ? undefined : step.colour, ringed),
          ...(ringed ? { borderColor: t.selectedEdge, boxShadow: t.selectedRing } : null),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
          <NumberTile wide>{step.number}</NumberTile>
          <h4 style={{ ...text(13.5, 500, entry.isDefaultTitle ? t.text2 : t.text), margin: 0 }}>{entry.title}</h4>
          {!instructions && step.model ? <span style={text(12, 400, t.label)}>{modelOf(step)}</span> : null}
          <span style={{ flexGrow: 1 }} />
          <CopyButton label="Copy" what={`${step.number} ${entry.title}`} text={bracketed(step.text, step.changes)} onCopy={view.onCopy} announce={announce} phone={phone} />
        </div>
        {/* CA-03 P3: how it ran, one quiet line under it; "When I asked" shows nothing. */}
        {repeats ? <DotLine testId="runs-line">{entry.runs}</DotLine> : null}
        {/* CA-03 P7: an agent that reads content it doesn't control says so. */}
        <OutsideWarning names={entry.outside} />
        <StepText step={step} indent={0} onRead={() => ctx.read(step.id)} />
        {step.job ? <JobLine job={step.job} /> : null}
        {step.kind === "agent" ? <AgentRules agent={step} /> : null}
        <SaveLines files={entry.makes} indent={0} />
        {entry.uses.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <Eyebrow>Uses</Eyebrow>
            {entry.uses.map((use) => {
              const file = entry.attach.find((candidate) => candidate.name === use);
              const tool = entry.tools.find((candidate) => use === `${candidate.name} · tool`);
              return (
                <span key={use} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Chip>
                    {tool ? tool.name : use}
                    {tool ? <span style={text(11, 400, t.label)}>tool</span> : null}
                  </Chip>
                  {file?.download ? <DownloadButton href={file.download} name={file.name} /> : null}
                </span>
              );
            })}
          </div>
        ) : null}
        {entry.goesInto.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <Eyebrow>Used by</Eyebrow>
            {entry.goesInto.map((target) => (
              <Chip key={target}>{target}</Chip>
            ))}
          </div>
        ) : null}
      </article>
      {nested.map((child) => (
        <InnerCard key={child.step.id} entry={child} ctx={ctx} />
      ))}
    </>
  );
}

/** An agent or a team: its module, with its sub-steps inside it. */
function ContainerCard({ entry, ctx }: { entry: ReaderStep; ctx: Ctx }) {
  const { step } = entry;
  const { view, phone, announce } = ctx;
  const team = step.kind === "team";
  const agents = entry.children.filter((child) => child.step.kind === "agent").length;
  const line = [team ? `${agents} ${agents === 1 ? "agent" : "agents"}, in this order` : null, entry.madeIn].filter(Boolean).join(" · ");
  return (
    <article id={stepDomId(step.id)} data-testid="step-card" data-step={step.number} style={{ ...moduleStyle(ctx.ringed === step.id), ...colourEdge(step.colour, ctx.ringed === step.id) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0 }}>
        <NumberTile>{step.number}</NumberTile>
        <h3 style={{ ...text(14, 500, entry.isDefaultTitle ? t.text2 : t.text), margin: 0, letterSpacing: "-0.005em" }}>{entry.title}</h3>
        <span style={{ flexGrow: 1 }} />
        <CopyButton label={team ? "Copy the team" : "Copy the agent"} what="" text={copyTextOf(entry)} onCopy={view.onCopy} announce={announce} phone={phone} />
        {view.setupPrompt ? (
          <Button
            variant="secondary"
            size={phone ? 44 : 28}
            fontSize={12}
            style={phone ? undefined : { height: 26 }}
            disabled={!(step.text.trim() || step.teamInstructions || step.children.some((child) => child.kind === "agent" && child.text.trim()))}
            title={step.text.trim() || step.teamInstructions || step.children.some((child) => child.kind === "agent" && child.text.trim()) ? undefined : "Add instructions first"}
            onClick={async () => {
              const words = await view.setupPrompt?.(step.id);
              if (words && (await view.onCopy(words))) announce("Setup prompt copied");
            }}
          >
            Copy setup prompt
          </Button>
        ) : null}
        <SaveMark kind="step" id={step.id} />
      </div>
      <TypeLine step={step} indent={INDENT} />
      {step.waitsFor ? <WaitsLine waitsFor={step.waitsFor} style={{ paddingLeft: INDENT }} /> : null}
      {line ? <div style={{ ...text(12, 400, t.label), paddingLeft: INDENT }}>{line}</div> : null}
      {team ? <TeamHead team={step} style={{ paddingLeft: INDENT }} /> : <AgentRules agent={step} style={{ paddingLeft: INDENT }} />}
      {entry.runs ? <DotLine testId="runs-line" style={{ paddingLeft: INDENT }}>{entry.runs}</DotLine> : null}
      {step.helpers?.length ? <HelperChips helpers={step.helpers} indent={INDENT} decisionName={(id) => ctx.view.steps.map((candidate) => candidate.step).find((candidate) => candidate.id === id)?.title ?? undefined} /> : null}
      {step.outputShape ? <ShapeChip shape={step.outputShape} indent={INDENT} /> : null}
      <TileCostLines step={step} audience="reader" groups={ctx.view.groups ?? []} indent={INDENT} />
      <UsedInLine id={step.id} indent={INDENT} />
      {step.traceUrl ? <span style={{ paddingLeft: INDENT }}><TraceLink url={step.traceUrl} /></span> : null}
      <OutsideWarning names={entry.outside} style={{ marginLeft: INDENT }} />
      <SaveLines files={entry.makes} />
      <ReaderFacts facts={entry.facts ?? []} indent={INDENT} />
      <TileFooter facts={footerFactsOf(step)} indent={INDENT} />
      <div style={{ marginLeft: INDENT, paddingLeft: 12, borderLeft: `1px solid ${t.hairlineModule}`, display: "flex", flexDirection: "column", gap: 8 }}>
        {entry.children.map((child) => (
          <InnerCard key={child.step.id} entry={child} ctx={ctx} />
        ))}
      </div>
    </article>
  );
}

function ResultCard({ result, ctx }: { result: ReaderResult; ctx: Ctx }) {
  const { view } = ctx;
  const name = result.url && !result.facts.link ? (
    <a href={result.url} target="_blank" rel="noopener noreferrer" data-hit="" style={{ ...text(14, 500, t.text), textDecoration: "none", overflowWrap: "anywhere" }}>
      {result.title}
    </a>
  ) : (
    <span style={{ ...text(14, 500, t.text), overflowWrap: "anywhere" }}>{result.title}</span>
  );
  return (
    <article data-testid="result-card" style={moduleStyle(false)}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: t.evidenceFill,
            color: t.evidence,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Glyph name="check" size={14} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
          <span data-testid="result-eyebrow" style={text(11.5, 400, t.label)}>{resultTypeLine(result.facts)}</span>
          {name}
          {/* CA-12 P9: the thing itself, as the maker's tile draws it. */}
          {result.trained ? null : <ResultTileBody facts={result.facts} />}
          {/* CA-05 P10: a trained model, said in one line, with the file it learned from. */}
          {result.trained ? (
            <span data-testid="trained-model-line" style={{ ...text(12.5, 400, t.text2), overflowWrap: "anywhere" }}>
              {result.trained.line}
            </span>
          ) : null}
          {result.trained?.method ? <span style={{ ...text(12, 400, t.label), overflowWrap: "anywhere" }}>{result.trained.method}</span> : null}
        </div>
        {result.trained?.file?.download ? <DownloadButton href={result.trained.file.download} name={result.trained.file.name} /> : null}
        {result.from ? <span style={{ ...text(12, 400, t.label), whiteSpace: "nowrap" }}>from step {result.from}</span> : null}
      </div>
      {result.mediaId && result.facts.mediaIds.length === 0 && !result.facts.file ? <MediaFigure reference={result.mediaId} resolveMedia={view.resolveMedia} width={640} alt={result.title} /> : null}
    </article>
  );
}

/* ── The build ── */

/** A group on the page: a head and what follows it until the next head. */
interface Group {
  key: string;
  /** CA-14 P3: a session's head is drawn with its fold; any other head is drawn as it is. */
  head: ReactNode | ((fold: Fold | null) => ReactNode);
  entries: ReaderStep[];
  /** CA-14 P2: set for a group that is a session's own (its head carries the session's number). */
  chat?: SessionChat;
  /** CA-06 P4: the session the group is in (its first step's id), and the maker's colour for it. */
  session?: string;
  colour?: string;
}

/** CA-06 P4: a coloured tile's edge, through the one helper; the ring wins while a link or an address names it. */
const colourEdge = (colour: string | undefined, ringed: boolean): CSSProperties | null => (colour && !ringed ? borderFor(colour) : null);

function groupsOf(steps: readonly ReaderStep[], copy?: { onCopy: (text: string) => Promise<boolean>; announce: (text: string) => void; phone: boolean }): Group[] {
  const groups: Group[] = [];
  let session: { key: string; colour?: string } | null = null;
  for (const entry of steps) {
    const chat = entry.chat?.kind === "new" ? entry.chat : null;
    if (chat) session = { key: entry.step.id, colour: chat.colour };
    const inSession = session ? { session: session.key, ...(session.colour ? { colour: session.colour } : null) } : null;
    if (chat) {
      groups.push({
        ...inSession,
        key: `chat:${entry.step.id}`,
        // CA-04 P4: Setup at the head's end, when the session has one.
        head: (fold: Fold | null) =>
          chat.setup?.length || chat.goal || chat.runsWhen || chat.facts || chat.together || chat.startedWith || (fold && chat.session !== null) ? (
            <ChatHead chat={chat} copy={copy} fold={fold} />
          ) : (
            <Head detail={chat.detail} tool={chat.tool} model={chat.model}>
              {chat.headline}
            </Head>
          ),
        ...(chat.session !== null ? { chat } : null),
        entries: [],
      });
    }
    if (isContainer(entry)) {
      groups.push({
        ...inSession,
        key: `made:${entry.step.id}`,
        head: <Head detail={entry.runsByItself}>{entry.step.kind === "team" ? "The team these made" : "The agent these made"}</Head>,
        entries: [entry],
      });
      continue;
    }
    if (groups.length === 0) groups.push({ ...inSession, key: `steps:${entry.step.id}`, head: null, entries: [] });
    groups[groups.length - 1].entries.push(entry);
  }
  return groups;
}

/**
 * CA-14 P1: a session of the maker's with no tile yet is drawn too, as its head and "No tiles yet", so the numbers a reader
 * sees run 1, 2, 3 with none missing. Each goes before the first session numbered after it.
 */
function withEmptySessions(groups: Group[], all: readonly SessionGroup[] | undefined): Group[] {
  const out = [...groups];
  for (const group of shownGroups(all ?? []).filter((entry) => entry.stepNumbers.length === 0 && groupKind(entry) === "typed")) {
    const key = groupKey(group);
    if (out.some((entry) => entry.chat?.key === key)) continue;
    const chat: SessionChat = {
      kind: "new",
      tool: group.tool,
      model: group.model,
      session: group.number,
      date: shortDate(group.startedAt),
      startedAt: group.startedAt,
      typed: false,
      headline: group.tool ? `New chat in ${group.tool}` : "New chat",
      detail: "",
      setup: [],
      key,
      ...(group.title ? { title: group.title } : null),
      ...(group.colour ? { colour: group.colour } : null),
      collapsed: false,
      tiles: 0,
    };
    const at = out.findIndex((entry) => entry.chat && entry.chat.session !== null && entry.chat.session > group.number);
    out.splice(at < 0 ? out.length : at, 0, { key: `empty:${key}`, head: (fold: Fold | null) => (fold ? <ReaderSessionHead chat={chat} fold={fold} /> : null), entries: [], chat, session: key, ...(group.colour ? { colour: group.colour } : null) });
  }
  return out;
}

const column = (gap: number): CSSProperties => ({ display: "flex", flexDirection: "column", gap, minWidth: 0 });

/** CA-06 P4: the groups of one session, side by side, so a coloured session can be drawn inside one line. */
function sessionRuns(groups: readonly Group[]): { key: string; colour?: string; groups: Group[] }[] {
  const runs: { key: string; colour?: string; groups: Group[] }[] = [];
  for (const group of groups) {
    const last = runs[runs.length - 1];
    if (last && group.session && last.groups[0].session === group.session) last.groups.push(group);
    else runs.push({ key: `run:${group.key}`, colour: group.colour, groups: [group] });
  }
  return runs;
}

export function StepsList({ view, phone, announce }: StepsListProps) {
  const { steps, results } = view;
  const { lens, setLens, ringed, open, setOpen, go, raw, names, toolOf, flat, map } = useStepsList(view, phone);
  const ctx: Ctx = { view, phone, announce, ringed, go, read: setOpen };

  /* CA-14 P3: the sessions the maker left folded start folded; a reader can fold or open any of them, for this visit only. */
  const runs = sessionRuns(withEmptySessions(groupsOf(steps, { onCopy: view.onCopy, announce, phone }), view.groups));
  const firstRun = runs[0];
  const [foldedKeys, setFolded] = useState<ReadonlySet<string>>(() => new Set(runs.flatMap((run) => run.groups.flatMap((group) => (group.chat?.collapsed ? [group.chat.key] : [])))));
  /* CA-17 P6: with two or more parts each part has its head, as in the composer, without its controls. */
  const theme = useResolvedTheme();
  const partsModel = useMemo(() => listPartsOf(view.making, view.groups ?? [], theme), [view.making, view.groups, theme]);
  const [foldedParts, setFoldedParts] = useState<ReadonlySet<string>>(() => new Set((partsModel?.list ?? []).filter((part) => part.view.collapsed).map((part) => part.view.key)));
  const partOfRun = (run: { groups: Group[] }): string | undefined => {
    const key = run.groups[0]?.chat?.key ?? run.groups[0]?.session ?? undefined;
    return key ? partsModel?.partOf.get(key) : undefined;
  };
  /* CA-14 P6: a build with three sessions or more has the session list for its readers; it costs them nothing, so it is always on. */
  const jumpItems = runs.flatMap((run) =>
    run.groups.flatMap((group) =>
      group.chat && group.chat.session !== null
        ? [{ key: group.chat.key, number: group.chat.session, label: group.chat.title ?? group.chat.tool ?? NO_HARNESS, ...(partsModel ? { group: partsModel.titles.get(partOfRun(run) ?? partsModel.list[0].view.key) } : null) }]
        : [],
    ),
  );
  const headOf = (key: string) => document.querySelector<HTMLElement>(`[data-reader-session="${key}"] [data-testid="reader-session-head"]`);
  const inView = useCurrentSession(jumpItems.map((item) => item.key), headOf);
  const toggleFold = (key: string) =>
    setFolded((before) => {
      const next = new Set(before);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /* CA-06 P3: a link in the post opens its part's window once the part is in view: a prompt the full prompt
     window, anything else the part window. */
  const [part, setPart] = useState<string | null>(null);
  const [fromPost, setFromPost] = useState(false);
  const shown = useRef<string | null>(null);
  const backing = useRef(false);
  /* A tile a link, an address or a window names is never left inside a folded session. */
  const targetId = open ?? ringed ?? (part ? (parseRefTo(part)?.kind === "node" ? (parseRefTo(part)?.id ?? null) : null) : null);
  useEffect(() => {
    if (!targetId) return;
    const holds = (entry: ReaderStep): boolean => entry.step.id === targetId || entry.children.some(holds);
    const home = runs.flatMap((run) => run.groups).find((group) => group.chat && group.entries.some(holds));
    const key = home?.chat?.key;
    if (key) setFolded((before) => (before.has(key) ? new Set([...before].filter((entry) => entry !== key)) : before));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);
  /** Back to the post was pressed: the post takes focus as the window lets it go. */
  const backTo = view.onBackToPost;
  const openKey = view.focus?.open ? `${view.focus.open}:${view.focus.n}` : null;
  useEffect(() => {
    const asked = view.focus;
    if (!asked?.open) return;
    const target = parseRefTo(asked.open);
    if (!target) return;
    shown.current = asked.id;
    setFromPost(Boolean(asked.fromPost));
    if (target.kind === "node" && windowPrompts(raw).some((step) => step.id === target.id)) setOpen(target.id);
    else setPart(asked.open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey]);
  const back = () => {
    backing.current = true;
    setOpen(null);
    setPart(null);
    setFromPost(false);
  };
  /** A window a link opened, closed some other way: focus on the part, outlined again. */
  const onCloseAutoFocus = (event: Event) => {
    const id = shown.current;
    shown.current = null;
    if (backing.current) {
      event.preventDefault();
      backing.current = false;
      backTo?.();
      return;
    }
    if (!id) return;
    event.preventDefault();
    const el = document.getElementById(stepDomId(id));
    if (!el) return;
    focusable(el).focus({ preventScroll: true });
    flashOutline(el);
  };
  /** A row in a team's or a session's window: that part, in view and open. */
  const goPart = (to: string) => {
    const target = parseRefTo(to);
    if (!target) return;
    const group = target.kind === "session" ? view.groups?.find((candidate) => groupKey(candidate) === target.id) : undefined;
    const id = group ? steps.find((entry) => group.stepNumbers.includes(entry.step.number))?.step.id : target.id;
    if (!id) return;
    setPart(null);
    go(id);
    shown.current = id;
    if (target.kind === "node" && windowPrompts(raw).some((step) => step.id === id)) setOpen(id);
    else setPart(to);
  };

  /** One session's run: its head and tiles, inside its colour's line when it has one. */
  const drawRun = (run: (typeof runs)[number], inPart = false) => {
          const drawn = run.groups.map((group, at) => {
            const tiles = drawBranches(group.entries, (entry) => entry.step, steps.map((entry) => entry.step), (entry) =>
              isContainer(entry) ? <ContainerCard key={entry.step.id} entry={entry} ctx={ctx} /> : <StepCard key={entry.step.id} entry={entry} ctx={ctx} />,
            );
            const chat = group.chat;
            if (!chat || typeof group.head !== "function") {
              return (
                <div key={group.key} style={column(8)}>
                  {typeof group.head === "function" ? group.head(null) : group.head}
                  {tiles}
                </div>
              );
            }
            /* CA-14 P2, P3: a session is a container: its head, then its tiles 16 in with a 2px line down their left. */
            const folded = foldedKeys.has(chat.key);
            const controls = `reader-session-tiles-${chat.key}`;
            const fold: Fold = { folded, toggle: () => toggleFold(chat.key), controls, tiles: chat.tiles, phone };
            return (
              <div key={group.key} data-reader-session={chat.key} style={{ ...column(4), ...(at > 0 || (run !== firstRun && !inPart) ? { marginTop: 16 } : null) }}>
                {group.head(fold)}
                <div id={controls} hidden={folded} style={{ position: "relative", ...column(8), marginLeft: 16 }}>
                  {folded ? null : (
                    <>
                      <span aria-hidden="true" data-testid="session-line" style={{ position: "absolute", left: -8, top: 0, bottom: 0, width: 2, background: t.hairline }} />
                      {group.entries.length === 0 ? <p style={{ ...text(13, 400, t.label), margin: 0 }}>No tiles yet</p> : tiles}
                    </>
                  )}
                </div>
              </div>
            );
          });
          // CA-06 P4: a coloured session's head and tiles sit inside its line; any other is drawn as it always was.
          return run.colour ? (
            <div key={run.key} data-session-colour={run.colour} style={{ ...column(16), ...outlineFor(run.colour), padding: 12 }}>
              {drawn}
            </div>
          ) : (
            drawn
          );
  };

  return (
    <TeamLinesContext.Provider value={{ open: go, names, phone, steps: steps.flatMap((entry) => [entry.step, ...entry.step.children]) }}>
    <div data-testid="build-steps" style={column(16)}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        {view.mapAvailable && !phone ? (
          <Segmented<"list" | "map">
            label="How to look at the build"
            items={[
              { value: "list", label: "List" },
              { value: "map", label: "Map" },
            ]}
            value={lens}
            onChange={setLens}
            size={28}
            fontSize={12}
          />
        ) : null}
        <span style={text(12, 400, t.text2, tnum)}>{view.counts}</span>
        {phone ? null : (
          <>
            <span style={{ flexGrow: 1 }} />
            <span style={{ ...text(12, 400, t.label), textAlign: "right" }}>{map ? "click a session to see what joins it · Esc clears" : headNote(steps)}</span>
          </>
        )}
      </div>
      <CostStrip steps={steps.map((entry) => entry.step)} groups={view.groups ?? []} audience="reader" />
      {!map && jumpItems.length >= 3 ? <SessionJump items={jumpItems} current={inView} phone={phone} onJump={(key) => jumpTo(headOf(key))} /> : null}
      {map ? (
        <Suspense fallback={<div role="status" style={{ ...text(12, 400, t.text2), padding: "24px 0" }}>Drawing the map…</div>}>
          <ReaderMap view={view} announce={announce} onRead={setOpen} />
        </Suspense>
      ) : (
        partsModel ? (
          <>
            {runs.filter((run) => !partOfRun(run)).map((run) => drawRun(run))}
            {partsModel.list.map((part, at) => {
              const key = part.view.key;
              const closed = foldedParts.has(key);
              const mine = runs.filter((run) => (partOfRun(run) ?? partsModel.list[0].view.key) === key);
              const neighbour = partsModel.list[at - 1] ?? partsModel.list[at + 1];
              return (
                <div key={key} id={stepDomId(key)} data-testid="workstream-group" data-workstream-group={key} style={{ ...WORKSTREAM_GROUP, ...(ringed === key ? ring(true) : null) }}>
                  <WorkstreamHead
                    part={{ ...part.view, collapsed: closed }}
                    phone={phone}
                    first={at === 0}
                    last={at === partsModel.list.length - 1}
                    controls={`reader-workstream-${key}`}
                    onToggle={() =>
                      setFoldedParts((before) => {
                        const next = new Set(before);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                    startsAfterChoices={[]}
                    joins={neighbour?.view.label ?? ""}
                  />
                  <div id={`reader-workstream-${key}`} data-testid="workstream-body" hidden={closed} style={WORKSTREAM_BODY}>
                    {closed ? null : mine.length > 0 ? mine.map((run) => drawRun(run, true)) : <p style={{ ...text(13, 400, t.label), margin: 0, padding: "4px 8px" }}>No sessions yet</p>}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          runs.map((run) => drawRun(run))
        )
      )}
      {map || results.length === 0 ? null : (
        <div style={column(8)}>
          <Head>Result</Head>
          {results.map((result) => (
            <ResultCard key={result.id} result={result} ctx={ctx} />
          ))}
        </div>
      )}
      <FullPromptWindow
        steps={raw}
        openId={open}
        mode="reader"
        names={names}
        renderBefore={(step) => {
          const entry = flat.get(step.id);
          return entry && hasBeforeYouSend(entry) ? <BeforeYouSend entry={entry} toolOf={toolOf} onSelect={setOpen} /> : null;
        }}
        onClose={() => {
          setOpen(null);
          setFromPost(false);
        }}
        onNavigate={setOpen}
        fromPost={fromPost}
        onBackToPost={back}
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <PartWindow
        steps={raw}
        groups={view.groups ?? []}
        names={names}
        open={part}
        fromPost={fromPost}
        onBackToPost={back}
        onClose={() => {
          setPart(null);
          setFromPost(false);
        }}
        onGo={goPart}
        onCloseAutoFocus={onCloseAutoFocus}
      />
    </div>
    </TeamLinesContext.Provider>
  );
}

/* ── What you need ── */

function NeedGroupBlock({ group, onOpen }: { group: NeedGroup; onOpen: (row: NeedRow) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? group.rows : group.rows.slice(0, NEED_ROWS);
  const more = group.rows.length - shown.length;
  return (
    <section aria-label={group.label} style={{ display: "flex", flexDirection: "column" }}>
      <Eyebrow as="div" style={{ paddingBottom: 8, borderBottom: `1px solid ${t.hairline}` }}>
        {group.label}
      </Eyebrow>
      {shown.map((row, index) => (
        <div
          key={`${row.title}:${index}`}
          id={row.id ? needDomId(row.id) : undefined}
          data-testid="need-row"
          style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48, padding: "6px 0", boxSizing: "border-box", borderBottom: `1px solid ${t.hairline}` }}
        >
          {group.key === "tools" && markFor({ tool: row.title, model: row.title }) !== null ? (
            <span style={{ display: "inline-flex", color: t.text }}>
              <ModelMark tool={row.title} model={row.title} size={28} />
            </span>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
            {row.id ? (
              <button type="button" onClick={() => onOpen(row)} style={{ ...bareButton, ...text(13, 500, t.text) }}>
                {row.title}
              </button>
            ) : (
              <span style={{ ...text(13, 500, t.text), overflowWrap: "anywhere" }}>{row.title}</span>
            )}
            {row.detail ? <span style={text(11.5, 400, t.label)}>{row.detail}</span> : null}
            {row.extra ? <span data-testid="need-extra" style={text(11.5, 400, t.label)}>{row.extra}</span> : null}
          </div>
          {group.key === "files" && row.download ? <DownloadButton href={row.download} name={row.title} /> : null}
        </div>
      ))}
      {group.note ? (
        <div data-testid="need-note" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 0", borderBottom: `1px solid ${t.hairline}` }}>
          <span style={text(12.5, 500, t.text)}>{group.note.title}</span>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: t.catBreakage, flexShrink: 0, marginTop: 6 }} />
            <span style={{ ...text(12.5, 400, t.text), lineHeight: "18px" }}>{group.note.line}</span>
          </div>
        </div>
      ) : null}
      {more > 0 ? (
        <button type="button" onClick={() => setAll(true)} style={{ ...bareButton, ...text(12.5, 500, t.text), padding: "8px 0 0", textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: t.line }}>
          Show {more} more
        </button>
      ) : null}
    </section>
  );
}

/** The column to the right of The build: tools and models, files, how it runs, time and other parts. */
export function NeedPanel({ view, onOpenOther }: NeedPanelProps) {
  const total = view.steps.length;
  const single = total === 1 && !view.steps.some(isContainer);
  return (
    <div data-testid="build-need" style={column(16)}>
      <div style={column(4)}>
        <h2 style={{ ...text(13.5, 500, t.text), margin: 0 }}>What you need</h2>
        <p style={{ ...text(12, 400, t.text2), margin: 0 }}>to repeat this build</p>
      </div>
      {view.need.map((group) => (
        <NeedGroupBlock key={group.key} group={group} onOpen={(row) => row.id && onOpenOther(row.id)} />
      ))}
      <p style={{ ...text(12, 400, t.text2), margin: 0, lineHeight: "18px" }}>
        {single
          ? "One prompt, so there is no map. Map appears once a build has two sessions or an agent."
          : `Copy for AI copies all ${total} ${total === 1 ? "step" : "steps"} in order, with each new chat and paste-in written out.`}
      </p>
    </div>
  );
}
