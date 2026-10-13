/* UI-P73 — The build, and What you need: the steps a reader can repeat.

   PURE. Props in, markup out (`BuildStepsView` in buildModel.ts). Drawn by
   `BuildView` in place of the anatomy, the part viewer and the timeline when
   the page is given steps; boards B1-PageList, B3-PageTeam and B4-PageOne.

   Every step is a card with its number, title, text (four lines, then "Read
   all of it") and Copy. A session's first step is headed "New chat in {tool}";
   a paste-in is a chip that scrolls to the step it comes from and rings it for
   1.2s. Inside an agent or a team the word is "Uses", never "Paste in". The
   words are CONCEPT §8's and are not reworded here. */

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, Check, Copy, Download, Paperclip } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { Panel } from "@/components/brand/Panel";
import { Segmented } from "@/components/brand/Segmented";
import { MediaFigure } from "@/components/build/MediaFigure";
import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import type { Step } from "@/lib/build/graph";
import { modelLabel } from "@/lib/models/registry";
import { stepList, type NeedGroup, type NeedRow, type ReaderFile, type ReaderResult, type ReaderStep } from "@/lib/build/readerSteps";
import { scrollBehavior } from "@/lib/theme/motion";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { tokenAlpha, t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { BeforeYouSend, hasBeforeYouSend } from "./BeforeYouSend";
import type { BuildStepsView } from "./buildModel";

/** The Map is loaded when a reader first chooses it, and not before (UI-P74). */
const ReaderMap = lazy(() => import("./ReaderMap"));

/** How long the step a chip or an address named stays ringed. */
const RING_MS = 1200;
/** How long Copy says it worked. */
const COPIED_MS = 1500;
/** At most this many rows in a What you need group, then "Show {n} more". */
export const NEED_ROWS = 6;
/** A text past this many words (or lines) is clamped to four lines, so it offers the whole of it. */
const LONG_WORDS = 40;

const mono = (size: 11 | 11.5 | 12): CSSProperties => ({ fontFamily: DM_MONO, fontSize: size, lineHeight: "normal", color: t.text2 });

const stepDomId = (id: string) => `step-${id}`;
const needDomId = (id: string) => `need-${id}`;

const isInstructions = (entry: ReaderStep) => entry.step.id.endsWith(":instructions");
const isContainer = (entry: ReaderStep) => entry.step.kind === "agent" || entry.step.kind === "team";
const isLong = (step: Step) => step.words > LONG_WORDS || step.text.split("\n").length > 4;

/** The text "Copy the team" puts on the clipboard: each agent, numbered, with its instructions whole. */
function teamText(entry: ReaderStep): string {
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
const copyTextOf = (entry: ReaderStep): string => (isContainer(entry) ? teamText(entry) : entry.step.text);

/* ── small parts ── */

function useConfirmed(): [boolean, () => void] {
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

/** The step's number, in the grey square. */
function Badge({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        flexShrink: 0,
        minWidth: 24,
        height: 24,
        padding: wide ? "0 6px" : 0,
        boxSizing: "border-box",
        borderRadius: 8,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: t.cell,
        border: `1px solid ${t.hairline}`,
        fontFamily: DM_MONO,
        fontSize: 12,
        fontWeight: 500,
        color: t.text,
      }}
    >
      {children}
    </span>
  );
}

/** A small label chip: DM Mono 11.5 on the action tint, as the full prompt window draws its chips. */
const chipStyle = (phone: boolean): CSSProperties => ({
  minHeight: phone ? 44 : 26,
  padding: "0 8px",
  boxSizing: "border-box",
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: tokenAlpha("action", 0.12),
  color: t.text,
  border: 0,
  fontFamily: DM_MONO,
  fontSize: 11.5,
  whiteSpace: "nowrap",
});

function Chip({ children }: { children: ReactNode }) {
  return <span style={{ ...chipStyle(false), minHeight: 24, background: t.cell, border: `1px solid ${t.hairline}` }}>{children}</span>;
}

/** A link to a file's download, drawn as the extra-small "Download". */
function DownloadLink({ file, label = "Download" }: { file: ReaderFile; label?: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  if (!file.download) return null;
  return (
    <a
      href={file.download}
      download={file.name}
      aria-label={`${label} ${file.name}`}
      {...handlers}
      style={{ fontFamily: FIGTREE, fontSize: 12, fontWeight: 600, color: t.text, textDecoration: "none", ...ring(state.focusVisible) }}
    >
      {label}
    </a>
  );
}

/** A paste-in: a link that goes to the step it comes from. */
function PasteChip({ text, title, phone, onGo }: { text: string; title: string; phone: boolean; onGo: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" onClick={onGo} {...handlers} style={{ ...chipStyle(phone), cursor: "pointer", ...ring(state.focusVisible) }}>
      <ArrowLeft size={12} strokeWidth={1.8} aria-hidden="true" />
      <span style={{ fontFamily: FIGTREE, fontSize: 12 }}>{text}</span>
      <span style={{ color: t.text2 }}>{title}</span>
    </button>
  );
}

function CopyButton({ label = "Copy", what, text, onCopy, announce, phone }: { label?: string; what: string; text: string; onCopy: (text: string) => Promise<boolean>; announce: (text: string) => void; phone: boolean }) {
  const [copied, confirm] = useConfirmed();
  return (
    <Button
      variant="secondary"
      size={phone ? 44 : 30}
      fontSize={13}
      icon={copied ? Check : Copy}
      aria-label={`${label} ${what}`}
      onClick={async () => {
        if (await onCopy(text)) {
          confirm();
          announce("Copied");
        }
      }}
    >
      {label}
    </Button>
  );
}

/** The text at 15/1.55, four lines, then "Read all of it" and the word count (a short text shows its count only when it is the build's one step). */
function StepText({ step, onRead, size = 15, alone = false }: { step: Step; onRead: () => void; size?: 14 | 15; alone?: boolean }) {
  const long = isLong(step);
  if (!step.text) return null;
  return (
    <>
      <p
        data-testid="step-text"
        style={{
          margin: 0,
          fontFamily: FIGTREE,
          fontSize: size,
          lineHeight: 1.55,
          color: t.text,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          ...(long ? { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" as const, overflow: "hidden" } : null),
        }}
      >
        {step.text}
      </p>
      {long ? (
        <div style={{ display: "flex", gap: 9, alignItems: "baseline", marginTop: 4 }}>
          <ReadAll onRead={onRead} />
          <span style={mono(12)}>{step.words} words</span>
        </div>
      ) : alone ? (
        <div style={{ ...mono(12), marginTop: 4 }}>{step.words} words</div>
      ) : null}
    </>
  );
}

function ReadAll({ onRead, label = "Read all of it" }: { onRead: () => void; label?: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onRead}
      {...handlers}
      style={{ background: "none", border: 0, padding: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, color: t.text, cursor: "pointer", ...ring(state.focusVisible) }}
    >
      {label}
    </button>
  );
}

/** "Paste in" and its chips, then "attach {name}" with its Download. Outside an agent or a team only. */
function Inputs({ entry, phone, go }: { entry: ReaderStep; phone: boolean; go: (id: string) => void }) {
  if (entry.pasteIns.length === 0 && entry.attach.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 9 }}>
      <span style={mono(12)}>Paste in</span>
      {entry.pasteIns.map((paste) => (
        <PasteChip key={paste.stepId} text={paste.text} title={paste.title} phone={phone} onGo={() => go(paste.stepId)} />
      ))}
      {entry.attach.map((file) => (
        <span key={file.id} style={{ ...chipStyle(phone), cursor: "default" }}>
          <Paperclip size={12} strokeWidth={1.8} aria-hidden="true" />
          <span style={{ fontFamily: FIGTREE, fontSize: 12 }}>attach {file.name}</span>
          <DownloadLink file={file} />
        </span>
      ))}
    </div>
  );
}

/* ── the heads ── */

function Head({ children, detail, id }: { children: ReactNode; detail?: ReactNode; id?: string }) {
  return (
    <div id={id} style={{ display: "flex", alignItems: "baseline", gap: 9, margin: "18px 0 8px" }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: t.text, flexShrink: 0, alignSelf: "center" }} />
      <span style={{ fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text, whiteSpace: "nowrap" }}>{children}</span>
      {detail ? <span style={{ ...mono(12), whiteSpace: "nowrap" }}>{detail}</span> : null}
      <span aria-hidden="true" style={{ flexGrow: 1, height: 1, background: t.hairline, alignSelf: "center", minWidth: 12 }} />
    </div>
  );
}

const cardStyle = (ringed: boolean): CSSProperties => ({
  borderRadius: 14,
  border: `1px solid ${ringed ? t.action : t.line}`,
  boxShadow: ringed ? `0 0 0 3px ${tokenAlpha("action", 0.25)}` : undefined,
  background: t.solid,
  padding: "14px 16px",
  marginBottom: 8,
  boxSizing: "border-box",
});

/* ── the cards ── */

interface Ctx {
  view: BuildStepsView;
  phone: boolean;
  announce: (text: string) => void;
  ringed: string | null;
  go: (id: string) => void;
  read: (id: string) => void;
  /** "See the team in Map": the Map with that team opened. Absent on a phone, which has no Map. */
  seeMap?: (id: string) => void;
}

function StepCard({ entry, ctx }: { entry: ReaderStep; ctx: Ctx }) {
  const { step } = entry;
  const { view, phone, announce } = ctx;
  const copy = <CopyButton what={`step ${step.number}`} text={step.text} onCopy={view.onCopy} announce={announce} phone={phone} />;

  if (entry.manual) {
    return (
      <article id={stepDomId(step.id)} data-testid="step-card" data-step={step.number} style={{ ...cardStyle(ctx.ringed === step.id), background: t.cell, border: `1px solid ${ctx.ringed === step.id ? t.action : t.text2}` }}>
        <Title entry={entry} right={null} />
        <div style={{ ...mono(12), marginTop: 6 }}>{entry.manual.headline}</div>
        <p style={{ margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 15, lineHeight: 1.55, color: t.text }}>{entry.manual.line}</p>
        {entry.manual.mediaId ? (
          <div style={{ marginTop: 9 }}>
            <MediaFigure reference={entry.manual.mediaId} resolveMedia={view.resolveMedia} width={480} alt={entry.manual.line} />
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <article id={stepDomId(step.id)} data-testid="step-card" data-step={step.number} style={cardStyle(ctx.ringed === step.id)}>
      <Title entry={entry} right={copy} />
      <div style={{ marginTop: 6 }}>
        <StepText step={step} alone={view.steps.length === 1} onRead={() => ctx.read(step.id)} />
      </div>
      <Inputs entry={entry} phone={phone} go={ctx.go} />
      {entry.chat?.kind === "same" ? <div style={{ ...mono(12), marginTop: 9 }}>{entry.chat.text}</div> : null}
    </article>
  );
}

function Title({ entry, right }: { entry: ReaderStep; right: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <Badge>{entry.step.number}</Badge>
      <h3
        style={{
          margin: 0,
          flexGrow: 1,
          minWidth: 0,
          fontFamily: FIGTREE,
          fontSize: 17,
          fontWeight: 600,
          lineHeight: "normal",
          color: entry.isDefaultTitle ? t.text2 : t.text,
        }}
      >
        {entry.title}
      </h3>
      {right}
    </div>
  );
}

/** One agent or one prompt inside a team or an agent: the smaller card, with its "Uses" and where it goes. */
function InnerCard({ entry, ctx }: { entry: ReaderStep; ctx: Ctx }) {
  const { step } = entry;
  const { view, phone, announce } = ctx;
  const instructions = isInstructions(entry);
  const repeats = entry.runs && step.runs && step.runs.how !== "once";
  const nested = entry.children.filter((child) => !isInstructions(child));
  return (
    <>
      <article
        id={stepDomId(step.id)}
        data-testid="inner-card"
        data-step={step.number}
        style={{
          borderRadius: 12,
          border: `1px solid ${ctx.ringed === step.id ? t.action : t.hairline}`,
          background: t.cell,
          padding: "12px 14px",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Badge wide>{step.number}</Badge>
          <h4 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: entry.isDefaultTitle ? t.text2 : t.text }}>{entry.title}</h4>
          {!instructions && step.model ? <span style={mono(12)}>{modelOf(step)}</span> : null}
          {repeats ? <Chip>{entry.runs}</Chip> : null}
          <span style={{ flexGrow: 1 }} />
          <CopyButton label="Copy" what={`${step.number} ${entry.title}`} text={step.text} onCopy={view.onCopy} announce={announce} phone={phone} />
        </div>
        <div style={{ marginTop: 8 }}>
          <StepText step={step} size={15} onRead={() => ctx.read(step.id)} />
        </div>
        {entry.uses.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 9 }}>
            <span style={mono(12)}>Uses</span>
            {entry.uses.map((use) => {
              const file = entry.attach.find((candidate) => candidate.name === use);
              const tool = entry.tools.find((candidate) => use === `${candidate.name} · tool`);
              return (
                <Chip key={use}>
                  {tool ? tool.name : use}
                  {tool ? <span style={mono(11)}>tool</span> : null}
                  {file ? <DownloadLink file={file} /> : null}
                </Chip>
              );
            })}
          </div>
        ) : null}
        {entry.goesInto.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 9 }}>
            <span style={mono(12)}>Goes into</span>
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

const modelOf = (step: Step): string => (step.model ? modelLabel(step.model) || step.model : "");

/** An agent or a team: its card, with its sub-steps inside it. */
function ContainerCard({ entry, ctx }: { entry: ReaderStep; ctx: Ctx }) {
  const { step } = entry;
  const { view, phone, announce } = ctx;
  const team = step.kind === "team";
  const agents = entry.children.filter((child) => child.step.kind === "agent").length;
  const line = [team ? `Team · ${agents} ${agents === 1 ? "agent" : "agents"}, in this order` : "Agent", entry.madeIn].filter(Boolean).join(" · ");
  return (
    <article id={stepDomId(step.id)} data-testid="step-card" data-step={step.number} style={cardStyle(ctx.ringed === step.id)}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Badge>{step.number}</Badge>
        <h3 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, color: entry.isDefaultTitle ? t.text2 : t.text }}>{entry.title}</h3>
        {entry.runs ? <Chip>{entry.runs}</Chip> : null}
        <span style={{ flexGrow: 1 }} />
        <CopyButton label={team ? "Copy the team" : "Copy the agent"} what="" text={copyTextOf(entry)} onCopy={view.onCopy} announce={announce} phone={phone} />
      </div>
      <div style={{ ...mono(12), margin: "6px 0 9px 34px" }}>{line}</div>
      <div style={{ marginLeft: 34, paddingLeft: 12, borderLeft: `2px solid ${t.hairline}` }}>
        {entry.children.map((child) => (
          <InnerCard key={child.step.id} entry={child} ctx={ctx} />
        ))}
      </div>
      {ctx.seeMap ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, margin: "6px 0 0 34px" }}>
          <ReadAll label={`See the ${team ? "team" : "agent"} in Map`} onRead={() => ctx.seeMap?.(step.id)} />
          <span style={mono(12)}>shows who passes work to whom</span>
        </div>
      ) : null}
    </article>
  );
}

function ResultCard({ result, ctx }: { result: ReaderResult; ctx: Ctx }) {
  const { view } = ctx;
  const name = result.url ? (
    <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ color: t.text, textDecorationColor: t.hairline }}>
      {result.title}
    </a>
  ) : (
    result.title
  );
  return (
    <article data-testid="result-card" style={cardStyle(false)}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden="true"
          style={{ width: 24, height: 24, borderRadius: 8, background: t.evidenceFill, color: t.evidence, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <Check size={14} strokeWidth={2} />
        </span>
        <span style={mono(12)}>Result</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 9, alignItems: "baseline", marginTop: 6, flexWrap: "wrap" }}>
        <span style={{ fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, color: t.text, overflowWrap: "anywhere" }}>{name}</span>
        {result.from ? <span style={mono(12)}>from step {result.from}</span> : null}
      </div>
      {result.mediaId ? (
        <div style={{ marginTop: 9 }}>
          <MediaFigure reference={result.mediaId} resolveMedia={view.resolveMedia} width={640} alt={result.title} />
        </div>
      ) : null}
    </article>
  );
}

/* ── The build ── */

/** The names the full prompt window shows on its Uses chips. */
function namesIn(steps: readonly ReaderStep[]): Record<string, string> {
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
function headNote(steps: readonly ReaderStep[]): string {
  const at = steps.findIndex(isContainer);
  if (at < 0) return "copy each step into the chat it names";
  const word = steps[at].step.kind === "team" ? "team" : "agent";
  const before = steps.slice(0, at).map((entry) => entry.step.number);
  return before.length > 0 ? `${stepList(before)} set it up · the ${word} then runs by itself` : `the ${word} runs by itself`;
}

export function StepsList({ view, phone, announce }: { view: BuildStepsView; phone: boolean; announce: (text: string) => void }) {
  const { steps, results } = view;
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
  const ctx: Ctx = { view, phone, announce, ringed, go, read: setOpen, seeMap: phone || !view.mapAvailable ? undefined : seeMap };

  const rows = steps.map((entry) => {
    const chat = entry.chat?.kind === "new" ? entry.chat : null;
    return (
      <div key={entry.step.id}>
        {chat ? <Head detail={chat.detail}>{chat.headline}</Head> : null}
        {isContainer(entry) ? (
          <>
            <Head detail={entry.runsByItself}>{entry.step.kind === "team" ? "The team these made" : "The agent these made"}</Head>
            <ContainerCard entry={entry} ctx={ctx} />
          </>
        ) : (
          <StepCard entry={entry} ctx={ctx} />
        )}
      </div>
    );
  });

  return (
    <div data-testid="build-steps">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "12px 0 0" }}>
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
            size={30}
            fontSize={12}
          />
        ) : null}
        <span style={mono(12)}>{view.counts}</span>
        {phone ? null : (
          <span style={{ ...mono(11.5), marginLeft: "auto", textAlign: "right" }}>{map ? "click a box to read it · Esc clears" : headNote(steps)}</span>
        )}
      </div>
      {map ? (
        <Suspense fallback={<div role="status" style={{ ...mono(12), padding: "24px 0" }}>Drawing the map…</div>}>
          <ReaderMap key={start?.opened ?? "map"} view={view} announce={announce} onRead={setOpen} start={start} />
        </Suspense>
      ) : null}
      {map ? null : rows}
      {map || results.length === 0 ? null : (
        <>
          <Head>Result</Head>
          {results.map((result) => (
            <ResultCard key={result.id} result={result} ctx={ctx} />
          ))}
        </>
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
    <section aria-label={group.label} style={{ marginTop: 14 }}>
      <div style={{ ...mono(11), textTransform: "uppercase", letterSpacing: "0.08em" }}>{group.label}</div>
      <div style={{ marginTop: 6 }}>
        {shown.map((row, index) => (
          <div
            key={`${row.title}:${index}`}
            id={row.id ? needDomId(row.id) : undefined}
            data-testid="need-row"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 9, padding: "9px 0", borderTop: `1px solid ${t.hairline}` }}
          >
            <div style={{ minWidth: 0 }}>
              {row.id ? (
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  style={{ background: "none", border: 0, padding: 0, fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text, cursor: "pointer", textAlign: "left" }}
                >
                  {row.title}
                </button>
              ) : (
                <div style={{ fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text, overflowWrap: "anywhere" }}>{row.title}</div>
              )}
              {row.detail ? <div style={{ ...mono(12), marginTop: 2 }}>{row.detail}</div> : null}
            </div>
            {group.key === "files" && row.download ? <FileDownload row={row} /> : null}
          </div>
        ))}
      </div>
      {more > 0 ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          style={{ background: "none", border: 0, padding: "6px 0 0", fontFamily: FIGTREE, fontSize: 12, color: t.action, cursor: "pointer" }}
        >
          Show {more} more
        </button>
      ) : null}
    </section>
  );
}

function FileDownload({ row }: { row: NeedRow }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <a
      href={row.download ?? undefined}
      download={row.title}
      aria-label={`Download ${row.title}`}
      {...handlers}
      style={{
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: 8,
        border: `1px solid ${t.line}`,
        background: t.glass2,
        color: t.text,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...ring(state.focusVisible),
      }}
    >
      <Download size={14} strokeWidth={1.8} aria-hidden="true" />
    </a>
  );
}

/** The column to the right of The build: tools and models, files, how it runs, time and other parts. */
export function NeedPanel({ view, onOpenOther }: { view: BuildStepsView; onOpenOther: (id: string) => void }) {
  const total = view.steps.length;
  const single = total === 1 && !view.steps.some(isContainer);
  return (
    <Panel padding="16px 16px">
      <div data-testid="build-need">
        <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, lineHeight: "normal", color: t.text }}>What you need</h2>
        <div style={{ ...mono(12), marginTop: 3 }}>to repeat this build</div>
        {view.need.map((group) => (
          <NeedGroupBlock key={group.key} group={group} onOpen={(row) => row.id && onOpenOther(row.id)} />
        ))}
        <p style={{ ...mono(12), margin: "16px 0 0", paddingTop: 12, borderTop: `1px solid ${t.hairline}`, lineHeight: 1.5 }}>
          {single
            ? "One prompt, so there is no map. Map appears once a build has two sessions or an agent."
            : `Copy for AI copies all ${total} ${total === 1 ? "step" : "steps"} in order, with each new chat and paste-in written out.`}
        </p>
      </div>
    </Panel>
  );
}
