/* CA-06 P3 — the window a link opens for any part that is not a prompt, and the session window.

   The same shell as the full prompt window (UI-P94's window recipe, 760 wide, radius 12, padding `20px 24px`, gap 16,
   over `--scrim`, no blur): an eyebrow heading and the boxed 28 close, the part's title, a body that fits it, and a
   footer under `--hairline-module` with Done. Code is in a mono well with Copy code; an agent has its instructions,
   models and tools; a team its agents as rows that each go to that agent; a check its three answers and runs; a file
   Download; a manual step its text. A session has its tool, model, date, its setup line and its tiles as rows that
   each go to that tile.

   Opened from a link, the footer also reads "Opened from the post · Back to the post".

   PURE. The page says which part is open (`open`, a link's `to`) and what going to another part does. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { CodeLines } from "@/components/code/CodeLines";
import { IconButton } from "@/components/brand/IconButton";
import { LiveRegion, useAnnouncer } from "@/components/brand/LiveRegion";
import { REF_COPY } from "@/components/post/RefLinks";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { groupKey, groupKind, stepRunsLabel, stepTitle, type SessionGroup, type Step } from "@/lib/build/graph";
import { FileTileBody, ManualTileBody, ToolTileBody, startsLine } from "@/components/build/tileBodies";
import { Certainty } from "@/components/build/Certainty";
import { LinkLines } from "@/components/build/LinkLines";
import { answerLine, answerWord, runsWhenLabel, decisionHeadline, isTypeSafe, questionLine, questionTypeLabel, sourceNote, sureOf } from "@/lib/build/decision";
import { callsOf, calledFromTiles, COPY_REQUEST_NOTE, decisionCopy } from "@/lib/build/decisionCopy";
import { REF_KIND } from "@/lib/build/postRefs";
import { parseRefTo, refTo } from "@/lib/build/thread";
import { modelLabel } from "@/lib/models/registry";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";
import { TextButton } from "@/pages/site/compose/composeControls";
import { EYEBROW, text, tnum } from "@/pages/site/compose/refinedStyles";

export const PART_WINDOW_COPY = {
  copyCode: "Copy code",
  copied: "Copied",
  download: "Download",
  done: "Done",
  instructions: "Instructions",
  models: "Models",
  tools: "Tools",
  agents: "Its agents",
  tested: "What it tested",
  passing: "What counts as passing",
  onFail: "When it failed",
  runs: "Runs",
  starts: "How it starts",
  cases: "Cases",
  tiles: "Its tiles",
  setup: (n: number) => `Setup · ${n} ${n === 1 ? "item" : "items"}`,
  nothing: "Nothing written yet",
  calledFrom: "Called from",
  reads: "What it reads",
  questions: "Questions",
  answer: "What it answered",
  copyRequest: "Copy as a request",
  copyTheCode: "Copy the code",
} as const;

export interface PartWindowProps {
  steps: readonly Step[];
  groups: readonly SessionGroup[];
  /** File and tool names by node id. */
  names?: Readonly<Record<string, string>>;
  /** The part that is open, as a link's `to`; null keeps the window closed. */
  open: string | null;
  /** Opened from a link in the post: the footer offers Back to the post. */
  fromPost?: boolean;
  onBackToPost?: () => void;
  onClose: () => void;
  /** A row in a team's or a session's window: go to that part. */
  onGo: (to: string) => void;
  /** A file's Download. Absent: no button. */
  onDownload?: (id: string) => void;
  /** How many items a session's setup holds, by its key. */
  setupCounts?: Readonly<Record<string, number>>;
  /** Called as the window closes, instead of putting focus back where it was. */
  onCloseAutoFocus?: (event: Event) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDay(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const at = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(at.getTime()) ? "" : `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/** Every part of the build, inside agents, teams and steps too, but never an agent's instructions. */
export function allParts(steps: readonly Step[]): Step[] {
  return steps.flatMap((step) => [step, ...allParts([...step.children.filter((child) => !child.id.endsWith(":instructions")), ...(step.sentWith ?? [])])]);
}

const WELL: CSSProperties = { background: t.well, border: `1px solid ${t.wellBorder}`, boxShadow: t.wellShadow, borderRadius: 6, boxSizing: "border-box" };

const factTag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 22,
  padding: "0 8px",
  boxSizing: "border-box",
  borderRadius: 4,
  background: t.tagFill,
  ...text(11.5, 500, t.onTag),
  lineHeight: 1,
  whiteSpace: "nowrap",
};

function Facts({ facts }: { facts: readonly string[] }) {
  if (facts.length === 0) return null;
  return (
    <div data-testid="part-facts" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {facts.map((fact) => (
        <span key={fact} style={factTag}>
          {fact}
        </span>
      ))}
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 style={{ ...text(12.5, 500, t.text2), margin: 0 }}>{label}</h3>
      {children}
    </section>
  );
}

function TextWell({ children, label }: { children: string; label: string }) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={label}
      data-testid="part-text"
      style={{
        ...WELL,
        maxHeight: 320,
        overflow: "auto",
        padding: 16,
        outline: "none",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        ...text(14, 400, t.text),
        lineHeight: "23px",
      }}
    >
      {children || PART_WINDOW_COPY.nothing}
    </div>
  );
}

/** A row that goes to a part: its number in the data face, its title, its kind. 48 high. */
function GoRow({ number, title, kind, onGo }: { number: string; title: string; kind: string; onGo: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      data-testid="part-row"
      onClick={onGo}
      {...handlers}
      style={{
        minHeight: 48,
        padding: "0 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: "none",
        borderBottom: `1px solid ${t.hairlineModule}`,
        background: state.pressed ? t.well : state.hovered ? t.tile : "transparent",
        textAlign: "left",
        cursor: "pointer",
        borderRadius: 0,
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ fontFamily: DM_MONO, fontSize: 10.5, color: t.label, ...tnum, minWidth: 24 }}>{number}</span>
      <span style={{ ...text(13.5, 500, t.text), flexGrow: 1, minWidth: 0, overflowWrap: "anywhere" }}>{title}</span>
      <span style={text(12, 400, t.label)}>{kind}</span>
    </button>
  );
}

async function copyText(words: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(words);
    return true;
  } catch {
    return false;
  }
}

/** What the window draws for a tile: its eyebrow, its title, and the body that fits its kind. */
function TileBody({ step, props, say }: { step: Step; props: PartWindowProps; say: (words: string) => void }) {
  const names = props.names ?? {};
  const kind = REF_KIND[step.kind] ?? "Prompt";
  switch (step.kind) {
    case "code":
      return (
        <>
          <Facts facts={[step.filename, step.language, step.entrypoint ? "start reading here" : null].filter((fact): fact is string => Boolean(fact))} />
          <LinkLines lines={callsOf(step.id, props.steps)} onOpen={(id) => props.onGo(refTo({ kind: "node", id }))} />
          <CodeLines text={step.text} testId="part-text" label="Code" empty={PART_WINDOW_COPY.nothing} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="secondary" size={28} fontSize={12} onClick={() => void copyText(step.text).then((done) => say(done ? PART_WINDOW_COPY.copied : "Couldn't copy. Select the code and copy it."))}>
              {PART_WINDOW_COPY.copyCode}
            </Button>
          </div>
        </>
      );
    case "agent": {
      const models = step.models?.length ? step.models.map((entry) => [modelLabel(entry.model) || entry.model, entry.role].filter(Boolean).join(" · ")) : step.model ? [modelLabel(step.model) || step.model] : [];
      const tools = (step.toolRefs ?? []).map((id) => names[id]).filter(Boolean);
      return (
        <>
          <Facts facts={[step.harness ? `Ran in ${step.harness}` : null].filter((fact): fact is string => Boolean(fact))} />
          <Section label={PART_WINDOW_COPY.instructions}>
            <TextWell label={PART_WINDOW_COPY.instructions}>{step.text}</TextWell>
          </Section>
          <Section label={PART_WINDOW_COPY.starts}>
            <p style={{ ...text(13.5, 400, t.text), margin: 0, lineHeight: "22px" }}>{startsLine(stepRunsLabel(step))}</p>
          </Section>
          {models.length ? (
            <Section label={PART_WINDOW_COPY.models}>
              <Facts facts={models} />
            </Section>
          ) : null}
          {tools.length ? (
            <Section label={PART_WINDOW_COPY.tools}>
              <Facts facts={tools} />
            </Section>
          ) : null}
        </>
      );
    }
    case "team":
      return (
        <Section label={PART_WINDOW_COPY.agents}>
          <div style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${t.hairlineModule}` }}>
            {step.children.map((agent) => (
              <GoRow key={agent.id} number={agent.number} title={stepTitle(agent)} kind="Agent" onGo={() => props.onGo(refTo({ kind: "node", id: agent.id }))} />
            ))}
          </div>
        </Section>
      );
    case "check": {
      const check = step.check;
      const runs = check?.runs?.length ? check.runs : check && check.total !== null && check.passed !== null ? [{ at: check.runAt ?? "", passed: check.passed, total: check.total }] : [];
      return (
        <>
          <Section label={PART_WINDOW_COPY.tested}>
            <p style={{ ...text(13.5, 400, t.text), margin: 0, lineHeight: "22px" }}>{check?.tested || PART_WINDOW_COPY.nothing}</p>
          </Section>
          <Section label={PART_WINDOW_COPY.passing}>
            <p style={{ ...text(13.5, 400, t.text), margin: 0, lineHeight: "22px" }}>{check?.passing || PART_WINDOW_COPY.nothing}</p>
          </Section>
          <Section label={PART_WINDOW_COPY.onFail}>
            <p style={{ ...text(13.5, 400, t.text), margin: 0, lineHeight: "22px" }}>{check?.onFail || PART_WINDOW_COPY.nothing}</p>
          </Section>
          {runs.length ? (
            <Section label={PART_WINDOW_COPY.runs}>
              <Facts facts={runs.map((run) => [shortDay(run.at), `${run.passed} of ${run.total} passed`].filter(Boolean).join(" · "))} />
            </Section>
          ) : null}
        </>
      );
    }
    case "decision":
      return <DecisionBody step={step} props={props} say={say} />;
    case "tool":
      // CA-12 P7: the app, how it was connected, what it did.
      return <ToolTileBody step={step} />;
    case "file":
      return (
        <>
          {/* CA-12 P8: its type, name and size, and a preview; a file sent with a step reads as before. */}
          {step.fileFacts && !step.inside ? <FileTileBody step={step} /> : <Facts facts={[step.filename, step.rows ? `${step.rows} cases` : null].filter((fact): fact is string => Boolean(fact))} />}
          {step.text && step.inside ? <TextWell label="About the file">{step.text}</TextWell> : null}
          {props.onDownload ? (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="secondary" size={28} fontSize={12} onClick={() => props.onDownload?.(step.id)}>
                {PART_WINDOW_COPY.download}
              </Button>
            </div>
          ) : null}
        </>
      );
    case "manual":
      // CA-12 P10: where it was done, then its steps, then its picture.
      return <ManualTileBody step={step} />;
    default:
      // A prompt sent with another step: its own words.
      return (
        <>
          <Facts facts={[step.tool, step.model ? modelLabel(step.model) || step.model : null].filter((fact): fact is string => Boolean(fact))} />
          <TextWell label={`${kind} text`}>{step.text}</TextWell>
        </>
      );
  }
}

/* ── a decision (CA-13 P2) ── */

/** Called from, what it reads, each question in full, the answer with its bars, where the figures came from, and Copy. */
function DecisionBody({ step, props, say }: { step: Step; props: PartWindowProps; say: (words: string) => void }) {
  const facts = step.decision;
  const parts = allParts(props.steps);
  if (!facts) return <p style={{ ...text(13, 400, t.label), margin: 0 }}>{PART_WINDOW_COPY.nothing}</p>;
  const copy = decisionCopy(step, parts);
  const tiles = calledFromTiles(step, parts);
  const read = facts.stateFrom ? parts.find((part) => part.id === facts.stateFrom) : undefined;
  const answered = facts.answer ?? null;
  const done = (words: string) => void copyText(words).then((ok) => say(ok ? PART_WINDOW_COPY.copied : "Couldn't copy. Select the text and copy it."));
  return (
    <>
      <Facts facts={[decisionHeadline(facts), facts.via === "adapter" ? "Through an adapter" : null].filter((fact): fact is string => Boolean(fact))} />
      {tiles.length ? (
        <Section label={PART_WINDOW_COPY.calledFrom}>
          <div style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${t.hairlineModule}` }}>
            {tiles.map((tile) => {
              const code = parts.find((part) => part.id === tile.id);
              return <GoRow key={tile.id} number={code?.number ?? ""} title={tile.name} kind="Code" onGo={() => props.onGo(refTo({ kind: "node", id: tile.id }))} />;
            })}
          </div>
        </Section>
      ) : null}
      {read || facts.stateSample ? (
        <Section label={PART_WINDOW_COPY.reads}>
          {read ? <GoRow number={read.number} title={stepTitle(read)} kind={REF_KIND[read.kind] ?? "Prompt"} onGo={() => props.onGo(refTo({ kind: "node", id: read.id }))} /> : null}
          {facts.stateSample ? <CodeLines text={facts.stateSample} testId="decision-state" label="The state" /> : null}
        </Section>
      ) : null}
      <Section label={PART_WINDOW_COPY.questions}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {facts.questions.map((q) => {
            const a = answered?.[q.id] ?? facts.expected?.[q.id];
            const sure = a ? sureOf(q, a) : undefined;
            return (
              <div key={q.id} data-testid="decision-question" style={{ ...WELL, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={text(13.5, 500, t.text)}>
                  {q.id} <span style={text(12, 400, t.label)}>{questionTypeLabel(q.type)}{q.type === "yesno" && isTypeSafe(facts.provider) ? " · Noul" : ""}</span>
                </span>
                {q.instructions ? <span style={{ ...text(13, 400, t.text2), overflowWrap: "anywhere" }}>{q.instructions}</span> : null}
                <span style={text(12.5, 400, t.label)}>{questionLine(q).slice(q.id.length + 2)}</span>
                {a ? (
                  sure !== undefined ? (
                    <Certainty answer={answerWord(q, a)} share={sure} probabilities={a.probabilities} source={answered?.[q.id] ? facts.source : "original"} />
                  ) : (
                    <span style={text(13, 400, t.text)}>{answerLine(q, a).slice(q.id.length + 3)}</span>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      </Section>
      {answered && sourceNote(facts.source) && !facts.questions.some((q) => answered[q.id] && sureOf(q, answered[q.id]) !== undefined) ? <span style={text(12, 400, t.label)}>{sourceNote(facts.source)}</span> : null}
      {copy ? (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          {copy.code ? (
            <Button variant="primary" size={28} fontSize={12} onClick={() => done(copy.code!.text)}>
              {PART_WINDOW_COPY.copyTheCode}
            </Button>
          ) : null}
          <Button variant="secondary" size={28} fontSize={12} onClick={() => done(copy.request.text)}>
            {PART_WINDOW_COPY.copyRequest}
          </Button>
        </div>
      ) : null}
      {copy && !copy.code ? <span style={text(12, 400, t.label)}>{COPY_REQUEST_NOTE}.</span> : null}
    </>
  );
}

function SessionBody({ group, props }: { group: SessionGroup; props: PartWindowProps }) {
  const key = groupKey(group);
  const tiles = props.steps.filter((step) => group.stepNumbers.includes(step.number));
  const setup = props.setupCounts?.[key];
  const facts = [group.tool, group.model, groupKind(group) === "legacy" ? null : shortDay(group.startedAt)].filter((fact): fact is string => Boolean(fact));
  return (
    <>
      <Facts facts={facts} />
      {setup ? <p style={{ ...text(12.5, 400, t.text2), margin: 0 }}>{PART_WINDOW_COPY.setup(setup)}</p> : null}
      <Section label={PART_WINDOW_COPY.tiles}>
        <div style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${t.hairlineModule}` }}>
          {tiles.map((step) => (
            <GoRow key={step.id} number={step.number} title={stepTitle(step)} kind={REF_KIND[step.kind] ?? "Prompt"} onGo={() => props.onGo(refTo({ kind: "node", id: step.id }))} />
          ))}
        </div>
      </Section>
    </>
  );
}

/** "Opened from the post · Back to the post", at the left of a window's footer. */
export function FromPostNote({ onBack, phone }: { onBack: () => void; phone: boolean }) {
  return (
    <span data-testid="from-post" style={{ ...text(12, 400, t.label), display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {REF_COPY.fromPost}
      {" · "}
      <TextButton target={phone} underline style={text(12, 500, t.text2)} onClick={onBack}>
        {REF_COPY.backToPost}
      </TextButton>
    </span>
  );
}

export function PartWindow(props: PartWindowProps) {
  const phone = useIsPhone();
  const [said, say] = useAnnouncer();
  const target = parseRefTo(props.open);
  const step = target?.kind === "node" ? allParts(props.steps).find((candidate) => candidate.id === target.id) : undefined;
  const group = target?.kind === "session" ? props.groups.find((candidate) => groupKey(candidate) === target.id) : undefined;
  const shown = Boolean(step || group);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (shown) heading.current?.focus();
  }, [shown, props.open]);

  const eyebrow = step
    ? [`${REF_KIND[step.kind] ?? "Prompt"}${step.number ? ` ${step.number}` : ""}`, step.inside ? `sent with ${step.inside.label}` : null].filter(Boolean).join(" · ")
    : group
      ? `Session ${group.number}`
      : "";
  const title = step ? stepTitle(step) : group ? `Session ${group.number}${group.tool ? ` · ${group.tool}` : ""}` : "";

  return (
    <Dialog.Root open={shown} onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 60 }} />
        <Dialog.Content
          data-testid="part-window"
          data-part={props.open ?? undefined}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={props.onCloseAutoFocus}
          style={{
            position: "fixed",
            zIndex: 61,
            boxSizing: "border-box",
            overflowY: "auto",
            background: t.window,
            color: t.text,
            fontFamily: FIGTREE,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            ...(phone
              ? { inset: 0, padding: "16px 16px 0" }
              : {
                  top: 96,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 760,
                  maxWidth: "calc(100vw - 32px)",
                  maxHeight: "calc(100dvh - 120px)",
                  padding: "20px 24px",
                  border: `1px solid ${t.windowBorder}`,
                  borderRadius: 12,
                  boxShadow: t.windowShadow,
                }),
          }}
        >
          <LiveRegion message={said} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Dialog.Title style={{ ...EYEBROW, margin: 0, flexGrow: 1 }}>{eyebrow}</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} glyph="x" label="Close" size={28} />
            </Dialog.Close>
          </div>
          <h2 ref={heading} tabIndex={-1} style={{ ...text(18, 500, t.text), margin: 0, letterSpacing: "-0.015em", overflowWrap: "anywhere", outline: "none" }}>
            {title}
          </h2>
          {step?.runsWhen ? (
            <Facts facts={[runsWhenLabel(step.runsWhen, props.steps.find((candidate) => candidate.id === step.runsWhen?.decision)?.decision?.questions.find((q) => q.id === step.runsWhen?.question))]} />
          ) : null}
          {step ? <TileBody step={step} props={props} say={say} /> : null}
          {group ? <SessionBody group={group} props={props} /> : null}
          <div
            style={{
              paddingTop: 16,
              borderTop: `1px solid ${t.hairlineModule}`,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              ...(phone ? { position: "sticky", bottom: 0, background: t.window, paddingBottom: "calc(12px + env(safe-area-inset-bottom))", marginTop: "auto" } : null),
            }}
          >
            {props.fromPost && props.onBackToPost ? <FromPostNote onBack={props.onBackToPost} phone={phone} /> : null}
            <span style={{ flexGrow: 1 }} />
            <Button size={phone ? 48 : 32} fontSize={13} onClick={props.onClose} style={phone ? undefined : { height: 30 }}>
              {PART_WINDOW_COPY.done}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default PartWindow;
