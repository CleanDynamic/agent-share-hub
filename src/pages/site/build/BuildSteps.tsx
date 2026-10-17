/* UI-P90 — The build and What you need in the refined look, as `design/reference/refined/{dusk,noon}/build-list.html`
   draws them.

   UI-P99: THIS WAS THE REFINED FORK. The current view it forked is deleted and this took its name; what follows was written when both existed, so "the current look" below means the look that has been retired. `StepsList` and `NeedPanel` stay the current look; these take their props (imported, not
   copied), keep their state in the same hook (`useStepsList`), and say the same words in the same order with the same
   accessible names. `BuildView` draws them.

   THE BUILD. A toolbar (List / Map, the counts, the hint), then the session groups: each led by a head (the tool's
   real mark at 20 where the current look has a dot, the "New chat in …" heading 13/500, its meta 12 `--label` and a
   hairline filling the rest) and its step modules. A step is a module: the number in a 24 control tile (Geist Mono
   11), the title 14/500, Copy (secondary 26, no icon); the text 13.5/22 indented 36, four lines then "Read all of it";
   the paste-ins as a tile indented 36. The result is a module under its own head.

   WHAT YOU NEED. No module: the column on the surface. Sections are an eyebrow over a hairline and rows 48 high; a
   Tools and models row leads with its mark at 28; a file has Download (secondary 26). */

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
import { Eyebrow } from "@/components/brand/Eyebrow";
import { Glyph } from "@/components/brand/Glyph";
import { ModelMark } from "@/components/brand/ModelMark";
import { Segmented } from "@/components/brand/Segmented";
import { MediaFigure } from "@/components/build/MediaFigure";
import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import type { Step } from "@/lib/build/graph";
import type { NeedGroup, NeedRow, ReaderFile, ReaderResult, ReaderStep } from "@/lib/build/readerSteps";
import { markFor } from "@/lib/models/marks";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { controlPaint, CONTROL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { hasBeforeYouSend, BeforeYouSend } from "./BeforeYouSend";
import { modelLabel } from "@/lib/models/registry";
import { stepList } from "@/lib/build/readerSteps";
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
      if (child.step.text) parts.push(`${child.step.number} ${child.title}\n\n${child.step.text}`);
      visit(child.children.filter((grand) => !isInstructions(grand)));
    }
  };
  visit(entry.children);
  return parts.join("\n\n");
}

/** The words a copy puts on the clipboard for a step. */
export const copyTextOf = (entry: ReaderStep): string => (isContainer(entry) ? teamText(entry) : entry.step.text);

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

export const modelOf = (step: Step): string => (step.model ? modelLabel(step.model) || step.model : "");

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
  const [start, setStart] = useState<{ opened: string | null; selected: string | null } | null>(null);
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
  const seeMap = useCallback(
    (id: string) => {
      const inside = steps.find((entry) => entry.step.id === id)?.children.filter((child) => !child.step.id.endsWith(":instructions"));
      setStart({ opened: id, selected: inside?.[0]?.step.id ?? id });
      setLens("map");
    },
    [steps],
  );
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
  return { lens, setLens, ringed, open, setOpen, start, setStart, go, raw, names, seeMap: phone || !view.mapAvailable ? undefined : seeMap, toolOf, flat, map };
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

/** An underlined text button: "Read all of it", "See the team in Map". */
function ReadAll({ onRead, label = "Read all of it" }: { onRead: () => void; label?: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      data-hit=""
      onClick={onRead}
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

/** The text at 13.5/22 indented 36: four lines, then "Read all of it" and the word count. */
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
        {step.text}
      </p>
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
            <span style={text(12.5, 400, t.text2)}>attach</span>
            <Chip>{file.name}</Chip>
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

/* ── the modules ── */

interface Ctx {
  view: StepsListProps["view"];
  phone: boolean;
  announce: (text: string) => void;
  ringed: string | null;
  go: (id: string) => void;
  read: (id: string) => void;
  seeMap?: (id: string) => void;
}

function Title({ entry, right }: { entry: ReaderStep; right: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <NumberTile>{entry.step.number}</NumberTile>
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
      {right}
    </div>
  );
}

function StepCard({ entry, ctx }: { entry: ReaderStep; ctx: Ctx }) {
  const { step } = entry;
  const { view, phone, announce } = ctx;
  const ringed = ctx.ringed === step.id;

  if (entry.manual) {
    /* Done by hand: nothing to copy. The tile's fill tells it from a prompt. */
    return (
      <article
        id={stepDomId(step.id)}
        data-testid="step-card"
        data-step={step.number}
        style={{ ...moduleStyle(ringed), background: t.tile, borderColor: ringed ? t.selectedEdge : t.tileBorder }}
      >
        <Title entry={entry} right={null} />
        <div style={{ ...text(12, 400, t.label), paddingLeft: INDENT }}>
          {markFor({ tool: step.tool }) !== null ? (
            <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 6, color: t.text }}>
              <ModelMark tool={step.tool} size={16} />
            </span>
          ) : null}
          {entry.manual.headline}
        </div>
        <p style={{ ...text(13.5, 400, t.text), margin: 0, paddingLeft: INDENT, lineHeight: "22px" }}>{entry.manual.line}</p>
        <SaveLines files={entry.makes} />
        {entry.manual.mediaId ? (
          <div style={{ paddingLeft: INDENT }}>
            <MediaFigure reference={entry.manual.mediaId} resolveMedia={view.resolveMedia} width={480} alt={entry.manual.line} />
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <article id={stepDomId(step.id)} data-testid="step-card" data-step={step.number} style={moduleStyle(ringed)}>
      <Title entry={entry} right={<CopyButton what={`step ${step.number}`} text={step.text} onCopy={view.onCopy} announce={announce} phone={phone} />} />
      <StepText step={step} alone={view.steps.length === 1} onRead={() => ctx.read(step.id)} />
      <SaveLines files={entry.makes} />
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
  const repeats = entry.runs && step.runs && step.runs.how !== "once";
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
          ...(ringed ? { borderColor: t.selectedEdge, boxShadow: t.selectedRing } : null),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
          <NumberTile wide>{step.number}</NumberTile>
          <h4 style={{ ...text(13.5, 500, entry.isDefaultTitle ? t.text2 : t.text), margin: 0 }}>{entry.title}</h4>
          {!instructions && step.model ? <span style={text(12, 400, t.label)}>{modelOf(step)}</span> : null}
          {repeats ? <Chip>{entry.runs}</Chip> : null}
          <span style={{ flexGrow: 1 }} />
          <CopyButton label="Copy" what={`${step.number} ${entry.title}`} text={step.text} onCopy={view.onCopy} announce={announce} phone={phone} />
        </div>
        <StepText step={step} indent={0} onRead={() => ctx.read(step.id)} />
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
            <Eyebrow>Goes into</Eyebrow>
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
  const line = [team ? `Team · ${agents} ${agents === 1 ? "agent" : "agents"}, in this order` : "Agent", entry.madeIn].filter(Boolean).join(" · ");
  return (
    <article id={stepDomId(step.id)} data-testid="step-card" data-step={step.number} style={moduleStyle(ctx.ringed === step.id)}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0 }}>
        <NumberTile>{step.number}</NumberTile>
        <h3 style={{ ...text(14, 500, entry.isDefaultTitle ? t.text2 : t.text), margin: 0, letterSpacing: "-0.005em" }}>{entry.title}</h3>
        {entry.runs ? <Chip>{entry.runs}</Chip> : null}
        <span style={{ flexGrow: 1 }} />
        <CopyButton label={team ? "Copy the team" : "Copy the agent"} what="" text={copyTextOf(entry)} onCopy={view.onCopy} announce={announce} phone={phone} />
      </div>
      <div style={{ ...text(12, 400, t.label), paddingLeft: INDENT }}>{line}</div>
      <SaveLines files={entry.makes} />
      <div style={{ marginLeft: INDENT, paddingLeft: 12, borderLeft: `1px solid ${t.hairlineModule}`, display: "flex", flexDirection: "column", gap: 8 }}>
        {entry.children.map((child) => (
          <InnerCard key={child.step.id} entry={child} ctx={ctx} />
        ))}
      </div>
      {ctx.seeMap ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: INDENT }}>
          <ReadAll label={`See the ${team ? "team" : "agent"} in Map`} onRead={() => ctx.seeMap?.(step.id)} />
          <span style={text(11.5, 400, t.label)}>shows who passes work to whom</span>
        </div>
      ) : null}
    </article>
  );
}

function ResultCard({ result, ctx }: { result: ReaderResult; ctx: Ctx }) {
  const { view } = ctx;
  const name = result.url ? (
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
          <span style={text(11.5, 400, t.label)}>Result</span>
          {name}
        </div>
        {result.from ? <span style={{ ...text(12, 400, t.label), whiteSpace: "nowrap" }}>from step {result.from}</span> : null}
      </div>
      {result.mediaId ? <MediaFigure reference={result.mediaId} resolveMedia={view.resolveMedia} width={640} alt={result.title} /> : null}
    </article>
  );
}

/* ── The build ── */

/** A group on the page: a head and what follows it until the next head. */
interface Group {
  key: string;
  head: ReactNode;
  entries: ReaderStep[];
}

function groupsOf(steps: readonly ReaderStep[]): Group[] {
  const groups: Group[] = [];
  for (const entry of steps) {
    const chat = entry.chat?.kind === "new" ? entry.chat : null;
    if (chat) {
      groups.push({
        key: `chat:${entry.step.id}`,
        head: (
          <Head detail={chat.detail} tool={chat.tool} model={chat.model}>
            {chat.headline}
          </Head>
        ),
        entries: [],
      });
    }
    if (isContainer(entry)) {
      groups.push({
        key: `made:${entry.step.id}`,
        head: <Head detail={entry.runsByItself}>{entry.step.kind === "team" ? "The team these made" : "The agent these made"}</Head>,
        entries: [entry],
      });
      continue;
    }
    if (groups.length === 0) groups.push({ key: `steps:${entry.step.id}`, head: null, entries: [] });
    groups[groups.length - 1].entries.push(entry);
  }
  return groups;
}

const column = (gap: number): CSSProperties => ({ display: "flex", flexDirection: "column", gap, minWidth: 0 });

export function StepsList({ view, phone, announce }: StepsListProps) {
  const { steps, results } = view;
  const { lens, setLens, ringed, open, setOpen, start, setStart, go, raw, names, seeMap, toolOf, flat, map } = useStepsList(view, phone);
  const ctx: Ctx = { view, phone, announce, ringed, go, read: setOpen, seeMap };

  return (
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
            onChange={(next) => {
              if (next === "list") setStart(null);
              setLens(next);
            }}
            size={28}
            fontSize={12}
          />
        ) : null}
        <span style={text(12, 400, t.text2, tnum)}>{view.counts}</span>
        {phone ? null : (
          <>
            <span style={{ flexGrow: 1 }} />
            <span style={{ ...text(12, 400, t.label), textAlign: "right" }}>{map ? "click a box to read it · Esc clears" : headNote(steps)}</span>
          </>
        )}
      </div>
      {map ? (
        <Suspense fallback={<div role="status" style={{ ...text(12, 400, t.text2), padding: "24px 0" }}>Drawing the map…</div>}>
          <ReaderMap key={start?.opened ?? "map"} view={view} announce={announce} onRead={setOpen} start={start} />
        </Suspense>
      ) : (
        groupsOf(steps).map((group) => (
          <div key={group.key} style={column(8)}>
            {group.head}
            {group.entries.map((entry) =>
              isContainer(entry) ? <ContainerCard key={entry.step.id} entry={entry} ctx={ctx} /> : <StepCard key={entry.step.id} entry={entry} ctx={ctx} />,
            )}
          </div>
        ))
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
        onClose={() => setOpen(null)}
        onNavigate={setOpen}
      />
    </div>
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
          </div>
          {group.key === "files" && row.download ? <DownloadButton href={row.download} name={row.title} /> : null}
        </div>
      ))}
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
