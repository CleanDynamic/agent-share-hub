/* UI-P67 — the full prompt window: one prompt, whole.

   For the maker (the title is a field) and, from UI-P73, for readers (the
   title is the heading and nothing can be changed). It is a Radix Dialog, so
   focus is trapped, Escape closes and the page behind is inert; opening puts
   focus on the text box, and closing returns it to whatever opened the window.

   PURE. Steps in, intentions out: the page owns which prompt is open
   (`openId`) and what a title write does (`onTitle`, `setStepTitle`). The
   window moves between prompts with ← and → through `onNavigate`, but never
   while a field has focus, so the arrows still move the cursor in the title.

   A title the maker did not type stays the default: an empty field saves as
   "" and the page puts the default back (DATA §1). Nothing here names a
   prompt for the maker.

   THE REFINED LOOK (UI-P94, `refined/{dusk,noon}/prompt-window.html`). Under
   `useLook() === "refined"` the same window, names, keys and handlers are
   drawn by `RefinedBody`: the window recipe 760 wide, radius 12, padding
   `20px 24px`, gap 16, over `--scrim`, no blur. An eyebrow heading and the
   boxed 28 close; the title field in a well 44 high (16/500, a `pencil` glyph
   in `--label`) and its hint 12 `--label`; the model as a `ModelTag` among
   the facts; the text in a well 320 high (padding 16, 14.5/25, its edge
   `--selected-edge` while focused, no fade); the words and Copy prompt
   (secondary 28); Uses as tile chips; a footer under `--hairline-module` with
   ghost ← previous and next →, the hint centred 12 `--label`, and Done
   (primary 30). Only the look branches: `bodyFacts` is shared. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { LiveRegion, useAnnouncer } from "@/components/brand/LiveRegion";
import { ModelTag } from "@/components/brand/ModelTag";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ChangedText } from "@/components/build/ChangedText";
import { CodeLines } from "@/components/code/CodeLines";
import { SHAPE_HOW_LABEL, shapeFragment, type OutputShape } from "@/lib/build/answerShape";
import { addRange, bracketed, changesLine, rangeAt, removeRange, type ChangeRange } from "@/lib/build/changes";
import { REPLY_MAX } from "@/lib/build/composePrompts";
import { groupKind, groupOfStep, promptNumbersOf, stepTitle, TITLE_MAX, type SessionGroup, type Step } from "@/lib/build/graph";
import { modelLabel } from "@/lib/models/registry";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { EYEBROW } from "@/pages/site/compose/refinedStyles";

import { FromPostNote } from "./PartWindow";

export type FullPromptMode = "maker" | "reader";

export interface FullPromptWindowProps {
  steps: readonly Step[];
  /** The step that is open; null or an id that is not a prompt keeps the window closed. */
  openId: string | null;
  mode: FullPromptMode;
  /** Maker mode: save a title; "" puts the default back. */
  onTitle?: (id: string, title: string) => void;
  onClose: () => void;
  /** Move to another prompt (← →). Absent, the arrows and the two buttons are left out. */
  onNavigate?: (id: string) => void;
  /** The build's sessions, for the "Session {n} · {tool}" chips. */
  groups?: readonly SessionGroup[];
  /** File and tool names, by node id, for the Uses chips. */
  names?: Readonly<Record<string, string>>;
  /** CA-05 P1, maker mode: save the words a reader changes in a prompt; an empty list takes them off. */
  onChanges?: (id: string, ranges: ChangeRange[]) => void;
  /** CA-12 P12, maker mode: save what came back for a prompt; an empty text takes it off. */
  onReply?: (id: string, reply: string) => void;
  /** Reader mode (UI-P74): the "Before you send it" panel for a step, under the text, in place of the plain lines. */
  renderBefore?: (step: Step) => ReactNode;
  /** CA-06 P3: opened from a link in the post; the footer offers Back to the post. */
  fromPost?: boolean;
  onBackToPost?: () => void;
  /** CA-06 P3: called as the window closes, instead of putting focus back where it was. */
  onCloseAutoFocus?: (event: Event) => void;
}

export const FULL_PROMPT_COPY = {
  hint: "Esc closes · ← → move between prompts",
  copied: "Copied",
  copy: "Copy prompt",
  done: "Done",
  before: "Before you send it",
  readerChanges: "A reader changes this",
  keepAsWritten: "Keep as written",
} as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

const isInstructions = (step: Pick<Step, "id">): boolean => step.id.endsWith(":instructions");

/** The prompts the window moves between: every step with a text of its own, in order. */
export function windowPrompts(steps: readonly Step[]): Step[] {
  return flatten(steps).filter((step) => step.kind === "prompt");
}

/** The prompts either side of `id`: null at either end. */
export function neighbours(prompts: readonly Step[], id: string): { previous: Step | null; next: Step | null } {
  const at = prompts.findIndex((step) => step.id === id);
  if (at < 0) return { previous: null, next: null };
  return { previous: prompts[at - 1] ?? null, next: prompts[at + 1] ?? null };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** What both looks say about a step: its neighbours, its facts, what it uses and what it goes into. */
function bodyFacts(props: FullPromptWindowProps, step: Step, prompts: readonly Step[]) {
  const { steps, groups = [], names = {} } = props;
  const { previous, next } = neighbours(prompts, step.id);
  const place = prompts.findIndex((candidate) => candidate.id === step.id) + 1;
  const instructions = isInstructions(step);

  const group = groupOfStep(groups, step);
  // CA-04 P1: a session holds every kind of step; "prompt 2 of 3" counts its prompts.
  const sessionPrompts = group ? promptNumbersOf(group, steps) : [];
  const inSession = sessionPrompts.indexOf(step.number) + 1;
  const tool = group?.tool ?? step.tool;
  const model = step.model ? modelLabel(step.model) : group?.model ?? null;
  const dated = group ? groupKind(group) !== "legacy" : false;
  const when = dated && group ? shortDate(group.startedAt) : "";
  const facts = [
    group || tool ? [dated && group ? `Session ${group.number}` : null, tool].filter(Boolean).join(" · ") || null : null,
    model,
    when || null,
    group && inSession > 0 ? `prompt ${inSession} of ${sessionPrompts.length} in the session` : null,
  ].filter((fact): fact is string => Boolean(fact));

  const all = flatten(steps);
  const uses = step.uses.flatMap((use) => {
    if (use.kind === "output") {
      const from = all.find((candidate) => candidate.id === use.node_id);
      return from ? [{ key: `${use.kind}:${use.node_id}`, label: `Output of ${from.number} · ${stepTitle(from)}`, paste: `Paste in: what step ${from.number} gave you` }] : [];
    }
    const name = names[use.node_id];
    return name ? [{ key: `${use.kind}:${use.node_id}`, label: name, paste: use.kind === "file" ? `Attach ${name}` : null }] : [];
  });
  const goesInto = all.filter((candidate) => candidate.id !== step.id && candidate.uses.some((use) => use.kind === "output" && use.node_id === step.id));
  const before = uses.flatMap((use) => (use.paste ? [use.paste] : []));
  return { previous, next, place, instructions, tool, model, facts, uses, goesInto, before };
}

/* ── the refined look (UI-P94) ── */

const geist = (size: number, weight: 400 | 500, color: string): CSSProperties => ({ fontFamily: FIGTREE, fontSize: size, fontWeight: weight, lineHeight: "normal", color });

const WELL: CSSProperties = { background: t.well, border: `1px solid ${t.wellBorder}`, boxShadow: t.wellShadow, borderRadius: 6, boxSizing: "border-box" };

/** A tag (22 high, radius 4, `--tag-fill`, 11.5 `--on-tag`): a fact with no mark. */
const factTag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 22,
  padding: "0 8px",
  boxSizing: "border-box",
  borderRadius: 4,
  background: t.tagFill,
  ...geist(11.5, 500, t.onTag),
  lineHeight: 1,
  whiteSpace: "nowrap",
};

/** A reference: the tile's fill and edge, 22 high, radius 4, 11.5. */
const refChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 22,
  padding: "0 8px",
  boxSizing: "border-box",
  borderRadius: 4,
  background: t.tile,
  border: `1px solid ${t.tileBorder}`,
  ...geist(11.5, 400, t.text),
  whiteSpace: "nowrap",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/**
 * The global field rule paints every input with `--recess` and a border, marked important; the title's input sits in
 * a well of its own, so it is drawn bare the only way that outranks the rule: an important inline declaration.
 */
function bare(element: HTMLInputElement | null) {
  if (!element) return;
  element.style.setProperty("background", "transparent", "important");
  element.style.setProperty("border-width", "0", "important");
  element.style.setProperty("box-shadow", "none", "important");
}

function RefinedTitleField({ step, onTitle, phone }: { step: Step; onTitle: (id: string, title: string) => void; phone: boolean }) {
  const [draft, setDraft] = useState(step.title ?? "");
  const [focused, setFocused] = useState(false);
  const save = () => {
    if (draft.trim() !== (step.title ?? "")) onTitle(step.id, draft);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ ...WELL, height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 8px 0 16px", ...(focused ? { borderColor: t.selectedEdge } : null) }}>
        <input
          ref={bare}
          type="text"
          aria-label="Title"
          value={draft}
          maxLength={TITLE_MAX}
          placeholder={step.defaultTitle}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            save();
          }}
          onKeyDown={(event) => {
            // Esc closes the window and unmounts the field before it can blur, so it saves here too.
            if (event.key === "Escape") save();
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
          style={{ flexGrow: 1, minWidth: 0, height: "100%", padding: 0, outline: "none", ...geist(phone ? 17 : 16, 500, t.text), letterSpacing: "-0.01em" }}
        />
        <span aria-hidden="true" style={{ width: 32, height: 32, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", color: t.label }}>
          <Glyph name="pencil" size={16} />
        </span>
      </div>
      <p style={{ ...geist(12, 400, t.label), margin: 0 }}>Title · starts as "{step.defaultTitle}" · only you can change it</p>
    </div>
  );
}

/** The offset of a point in the box's text, counted the way the text is stored. */
function offsetIn(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

/** What is selected in the box, trimmed of the spaces either side, or null when nothing is. */
function selectionIn(root: HTMLElement, text: string): ChangeRange | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !selection.focusNode) return null;
  if (!root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return null;
  const a = offsetIn(root, selection.anchorNode, selection.anchorOffset);
  const b = offsetIn(root, selection.focusNode, selection.focusOffset);
  let start = Math.min(a, b);
  let end = Math.max(a, b);
  if (start === end) return { start, end };
  while (start < end && /\s/.test(text[start] ?? "")) start += 1;
  while (end > start && /\s/.test(text[end - 1] ?? "")) end -= 1;
  return end > start ? { start, end } : null;
}

/** The text, whole, in a well: scrolls and keeps its line breaks; its edge is `--selected-edge` while it has focus. */
function RefinedTextBox({ text, changes, boxRef, phone, onPick }: { text: string; changes?: readonly ChangeRange[]; boxRef: React.RefObject<HTMLDivElement | null>; phone: boolean; onPick?: (selection: ChangeRange | null) => void }) {
  const [focused, setFocused] = useState(false);
  const pick = () => {
    if (boxRef.current && onPick) onPick(selectionIn(boxRef.current, text));
  };
  return (
    <div
      ref={boxRef}
      tabIndex={0}
      role="region"
      aria-label="Full prompt text"
      data-testid="full-prompt-text"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onMouseUp={pick}
      onKeyUp={pick}
      style={{
        ...WELL,
        ...(focused ? { borderColor: t.selectedEdge } : null),
        height: phone ? "42dvh" : 320,
        overflowY: "auto",
        padding: 16,
        outline: "none",
        ...geist(14.5, 400, t.text),
        lineHeight: "25px",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      <ChangedText text={text} changes={changes} />
    </div>
  );
}

/** CA-12 P12: "What came back". The maker edits it (up to 4,000 characters); a reader sees it as read-only text. */
/** CA-13 P7: how the answer was constrained, where, the schema and the sample; and Copy the setting. */
function ShapeRead({ shape }: { shape: OutputShape }) {
  const [said, setSaid] = useState("");
  const fragment = shapeFragment(shape);
  return (
    <section data-testid="shape-read" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h3 style={{ ...EYEBROW, margin: 0 }}>Answer shape</h3>
      <p style={{ ...geist(13, 400, t.text2), margin: 0 }}>{[SHAPE_HOW_LABEL[shape.how], shape.where].filter(Boolean).join(" · ")}</p>
      {shape.schema ? <CodeLines text={shape.schema} testId="shape-schema" label="Schema" /> : null}
      {shape.sample ? <CodeLines text={shape.sample} testId="shape-sample" label="Sample" /> : null}
      {fragment.text ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button variant="secondary" size={28} fontSize={12} onClick={() => void navigator.clipboard?.writeText(fragment.text).then(() => setSaid("Copied"), () => setSaid("Couldn't copy. Select the text and copy it."))}>
            Copy the setting
          </Button>
          <span aria-live="polite" style={geist(12, 400, t.label)}>{said}</span>
        </div>
      ) : null}
    </section>
  );
}

function ReplyField({ step, onReply, phone }: { step: Step; onReply?: (id: string, reply: string) => void; phone: boolean }) {
  const [draft, setDraft] = useState(step.reply ?? "");
  const [focused, setFocused] = useState(false);
  const save = () => {
    if (draft.trim() !== (step.reply ?? "")) onReply?.(step.id, draft);
  };
  if (!onReply) {
    if (!step.reply) return null;
    return (
      <section data-testid="reply-read" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={{ ...EYEBROW, margin: 0 }}>What came back</h3>
        <p style={{ ...geist(14, 400, t.text2), margin: 0, lineHeight: "22px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{step.reply}</p>
      </section>
    );
  }
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label htmlFor={`reply-${step.id}`} style={{ ...EYEBROW, margin: 0 }}>
        What came back
      </label>
      <textarea
        id={`reply-${step.id}`}
        aria-label="What came back"
        value={draft}
        maxLength={REPLY_MAX}
        rows={4}
        placeholder="Nothing added yet"
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          save();
        }}
        style={{ ...WELL, padding: "8px 16px", resize: "vertical", outline: "none", boxSizing: "border-box", width: "100%", ...geist(phone ? 16 : 14, 400, t.text), lineHeight: "22px", ...(focused ? { borderColor: t.selectedEdge } : null) }}
      />
      <span style={{ ...geist(11.5, 400, t.label), fontVariantNumeric: "tabular-nums" }}>{`${draft.length} / ${REPLY_MAX}`}</span>
    </section>
  );
}

function RefinedBody({ props, step, prompts, phone }: { props: FullPromptWindowProps; step: Step; prompts: readonly Step[]; phone: boolean }) {
  const { mode, onTitle, onClose, onNavigate, onChanges, onReply } = props;
  const [said, say] = useAnnouncer();
  /** CA-05 P1: what is selected in the text (or the caret), while the maker can mark words. */
  const [picked, setPicked] = useState<ChangeRange | null>(null);
  const existing = rangeAt(step.changes ?? [], picked ?? { start: -1, end: -1 });
  const markable = mode === "maker" && onChanges && !isInstructions(step) && picked !== null && (existing !== null || picked.end > picked.start);
  const textRef = useRef<HTMLDivElement>(null);
  const { previous, next, place, instructions, tool, model, facts, uses, goesInto, before } = bodyFacts(props, step, prompts);

  // Opening puts focus on the text box.
  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const copy = async () => {
    say((await copyText(bracketed(step.text, step.changes))) ? FULL_PROMPT_COPY.copied : "Couldn't copy. Select the text and copy it.");
  };

  const quiet = geist(11.5, 400, t.label);
  const navButton = { variant: "ghost" as const, size: phone ? (48 as const) : (28 as const), fontSize: 12 as const };
  const navLabel: CSSProperties = { maxWidth: phone ? 110 : 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: phone ? "100%" : undefined }}>
      <LiveRegion message={said} />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Dialog.Title style={{ ...EYEBROW, margin: 0, flexGrow: 1 }}>
          Prompt {step.number} of {prompts.length} · full prompt
        </Dialog.Title>
        <Dialog.Close asChild>
          <IconButton icon={X} glyph="x" label="Close" size={28} />
        </Dialog.Close>
      </div>
      {mode === "maker" && onTitle && !instructions ? (
        <RefinedTitleField key={step.id} step={step} onTitle={onTitle} phone={phone} />
      ) : (
        <h2 style={{ ...geist(18, 500, step.title ? t.text : t.text2), margin: 0, letterSpacing: "-0.015em", overflowWrap: "anywhere" }} data-default-title={step.title ? undefined : "true"}>
          {stepTitle(step)}
        </h2>
      )}
      {facts.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {facts.map((fact) =>
            fact === model ? (
              <ModelTag key={fact} tool={tool} model={model}>
                {fact}
              </ModelTag>
            ) : (
              <span key={fact} style={factTag}>
                {fact}
              </span>
            ),
          )}
        </div>
      ) : null}
      <RefinedTextBox key={step.id} text={step.text} changes={step.changes} boxRef={textRef} phone={phone} onPick={mode === "maker" && onChanges ? setPicked : undefined} />
      {!isInstructions(step) && step.kind === "prompt" ? <ReplyField key={`reply-${step.id}`} step={step} onReply={mode === "maker" ? onReply : undefined} phone={phone} /> : null}
      {!isInstructions(step) && step.kind === "prompt" && step.outputShape ? <ShapeRead shape={step.outputShape} /> : null}
      {step.changes?.length ? (
        <p data-testid="changes-line" style={{ ...quiet, margin: 0 }}>
          {changesLine(step.changes.length)}
        </p>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ ...quiet, flexGrow: 1, fontVariantNumeric: "tabular-nums" }}>{step.words} words</span>
        {markable ? (
          <Button
            variant="secondary"
            size={phone ? 48 : 28}
            fontSize={12}
            // The selection stays while the button is pressed.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!picked) return;
              const kept = existing ? removeRange(step.changes ?? [], picked) : addRange(step.changes ?? [], picked, step.text.length);
              onChanges?.(step.id, kept);
              setPicked(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            {existing ? FULL_PROMPT_COPY.keepAsWritten : FULL_PROMPT_COPY.readerChanges}
          </Button>
        ) : null}
        <Button variant="secondary" size={phone ? 48 : 28} fontSize={12} onClick={() => void copy()}>
          {FULL_PROMPT_COPY.copy}
        </Button>
      </div>
      {uses.length > 0 || goesInto.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {uses.length > 0 ? <span style={quiet}>Uses</span> : null}
          {uses.map((use) => (
            <span key={use.key} style={refChip}>
              {use.label}
            </span>
          ))}
          {goesInto.length > 0 ? <span style={{ ...quiet, marginLeft: uses.length > 0 ? 8 : 0 }}>Goes into</span> : null}
          {goesInto.map((to) => (
            <span key={to.id} style={refChip}>
              {to.number} · {stepTitle(to)}
            </span>
          ))}
        </div>
      ) : null}
      {mode === "reader" && props.renderBefore ? props.renderBefore(step) : null}
      {mode === "reader" && !props.renderBefore && before.length > 0 ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{ ...geist(13, 500, t.text), margin: 0 }}>{FULL_PROMPT_COPY.before}</h3>
          {before.map((line) => (
            <span key={line} style={geist(13, 400, t.text)}>
              {line}
            </span>
          ))}
        </section>
      ) : null}
      <div
        style={{
          paddingTop: 16,
          borderTop: `1px solid ${t.hairlineModule}`,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 4,
          ...(phone ? { position: "sticky", bottom: 0, background: t.window, paddingBottom: "calc(12px + env(safe-area-inset-bottom))", marginTop: "auto" } : null),
        }}
      >
        {props.fromPost && props.onBackToPost ? <FromPostNote onBack={props.onBackToPost} phone={phone} /> : null}
        {onNavigate && previous ? (
          <Button {...navButton} onClick={() => onNavigate(previous.id)} aria-label={`Previous prompt: ${stepTitle(previous)}`}>
            <span style={navLabel}>← {stepTitle(previous)}</span>
          </Button>
        ) : null}
        {onNavigate && next ? (
          <Button {...navButton} onClick={() => onNavigate(next.id)} aria-label={`Next prompt: ${stepTitle(next)}`}>
            <span style={navLabel}>{stepTitle(next)} →</span>
          </Button>
        ) : null}
        <span style={{ flexGrow: 1, textAlign: "center", ...geist(12, 400, t.label) }}>{phone ? null : FULL_PROMPT_COPY.hint}</span>
        <Button size={phone ? 48 : 32} fontSize={13} onClick={onClose} style={phone ? undefined : { height: 30 }}>
          {FULL_PROMPT_COPY.done}
        </Button>
      </div>
      <span hidden data-testid="full-prompt-place">{place}</span>
    </div>
  );
}

export function FullPromptWindow(props: FullPromptWindowProps) {
  const phone = useIsPhone();
  const prompts = windowPrompts(props.steps);
  const step = props.openId ? prompts.find((candidate) => candidate.id === props.openId) : undefined;
  const { onNavigate } = props;

  /** ← and → move between prompts, but not while a field has focus: there they move the cursor. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!step || !onNavigate || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    if ((event.target as HTMLElement).matches("input, textarea, select, [contenteditable]")) return;
    const { previous, next } = neighbours(prompts, step.id);
    const to = event.key === "ArrowLeft" ? previous : next;
    if (!to) return;
    event.preventDefault();
    onNavigate(to.id);
  };

  return (
    <Dialog.Root open={Boolean(step)} onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 60 }} />
        <Dialog.Content
          data-testid="full-prompt-window"
          aria-describedby={undefined}
          // Focus goes to the text box (Body does it), not the first control.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={props.onCloseAutoFocus}
          onKeyDown={onKeyDown}
          data-look={"refined"}
          style={{
            position: "fixed",
            zIndex: 61,
            boxSizing: "border-box",
            overflowY: "auto",
            background: t.window,
            color: t.text,
            fontFamily: FIGTREE,
            ...(phone
            ? { inset: 0, padding: "16px 16px 0" }
            : {
                /* The window recipe: 760 wide, radius 12, padding `20px 24px`, no blur. */
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
          {step ? (
            <RefinedBody key={step.id} props={props} step={step} prompts={prompts} phone={phone} />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default FullPromptWindow;
