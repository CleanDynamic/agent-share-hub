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
   (primary 30). Only the look branches: `bodyFacts` is shared.

   CA-15b: drawn from `modalRecipes` as the board "Prompt window" draws it, 640 wide: the header (the place, the title field
   and Rename; the grey line; Previous prompt, Next prompt and Close), a "Prompt" block ("48 words", Copy prompt, the text in
   a 5-row area), a "Response" block ("240 of 4,000 characters"), the Optional section (Model settings, Variables) and the
   footer ("Esc Close · ← → Previous or next prompt", Done). */

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { LiveRegion, useAnnouncer } from "@/components/brand/LiveRegion";
import { ModelTag } from "@/components/brand/ModelTag";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ChangedText } from "@/components/build/ChangedText";
import { CodeLines } from "@/components/code/CodeLines";
import { SHAPE_HOW_LABEL, shapeFragment, type OutputShape } from "@/lib/build/answerShape";
import { addRange, bracketed, changesLine, rangeAt, removeRange, type ChangeRange } from "@/lib/build/changes";
import { REPLY_MAX } from "@/lib/build/composePrompts";
import { groupKind, groupOfStep, promptNumbersOf, promptPlace, stepTitle, TITLE_MAX, type SessionGroup, type Step } from "@/lib/build/graph";
import { EFFORTS, EFFORT_LABEL, SETTINGS_INSTRUCTIONS_MAX, VARIABLE_DESCRIPTION_MAX, markVariable, variablesFor, type Effort, type PromptSettings } from "@/lib/build/tileExtras";
import { modelLabel } from "@/lib/models/registry";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { ModelPicker } from "@/pages/site/compose/ModelPicker";
import { OptionalField, OptionalSection, summaryOf } from "@/pages/site/compose/OptionalSection";
import { EYEBROW } from "@/pages/site/compose/refinedStyles";
import {
  Block,
  BlockHead,
  Count,
  FOOT_NOTE,
  FieldArea,
  FieldInput,
  HEADER,
  HEADER_ICONS,
  HEADER_TEXT,
  Hint,
  IconSquare,
  Inline,
  MODAL_PAD,
  MODAL_WIDTH,
  ModalInset,
  RecipeButton,
  Row,
  SUBTITLE,
  SegmentedField,
  areaStyle,
  bodyStyle,
  footerStyle,
  frameStyle,
} from "@/pages/site/compose/modalRecipes";

import type { PromptView } from "@/pages/site/compose/DetailsPanel";
import { PromptEdits, type PromptEditHandlers } from "@/pages/site/compose/editKit";

import { FromPostNote } from "./PartWindow";
import { PromptName } from "./tileBodies";

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
  /** CA-15 P2, maker mode: save a prompt's model settings and variables (`payload.settings`, `payload.variables`); null takes one off. */
  onExtras?: (id: string, patch: Record<string, unknown>) => void;
  /** CA-15 P2, maker mode: replace a prompt's text ("Mark selection as a variable"). */
  onText?: (id: string, text: string) => void;
  /** Reader mode (UI-P74): the "Before you send it" panel for a step, under the text, in place of the plain lines. */
  renderBefore?: (step: Step) => ReactNode;
  /** CA-06 P3: opened from a link in the post; the footer offers Back to the post. */
  fromPost?: boolean;
  onBackToPost?: () => void;
  /** CA-06 P3: called as the window closes, instead of putting focus back where it was. */
  onCloseAutoFocus?: (event: Event) => void;
  /** CA-18, maker mode: the prompt as Details reads it, and what changes it: Model, How it was run, Uses and Makes. Absent: those are not drawn. */
  details?: (id: string) => PromptView | null;
  handlers?: PromptEditHandlers;
}

export const FULL_PROMPT_COPY = {
  hint: "Esc Close · ← → Previous or next prompt",
  copied: "Copied",
  copy: "Copy prompt",
  done: "Done",
  before: "Before you send it",
  readerChanges: "A reader changes this",
  keepAsWritten: "Keep as written",
  prompt: "Prompt",
  response: "Response",
  titlePlaceholder: "e.g. Welcome email",
  rename: "Rename prompt",
  modelSettings: "Model settings",
  modelSettingsLine: "Model, reasoning effort, custom instructions and project knowledge",
  model: "Model",
  effort: "Reasoning effort",
  instructions: "Custom instructions or project knowledge that applied",
  variables: "Variables",
  variablesLine: "Words a copier replaces, such as {company name}",
  variablesHow: "Select words in the prompt, then mark them as a variable.",
  noVariablesCount: "No variables yet",
  replyCount: (n: number) => `${n.toLocaleString("en-GB")} of ${REPLY_MAX.toLocaleString("en-GB")} characters`,
  markVariable: "Mark selection as a variable",
  noVariables: "No {variables} written in this prompt yet.",
} as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function longDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : `${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}`;
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
  // CA-15 P2: the model's own row is Model settings (`payload.settings.model`, else `payload.model`, else the session's).
  const model = step.settings?.model || step.model || group?.model || null;
  const dated = group ? groupKind(group) !== "legacy" : false;
  const when = dated && group ? longDate(group.startedAt) : "";
  /** CA-15 P2: one grey line, "Session 1 · Claude · 7 Oct 2026 · Prompt 1 of 3 in session". */
  const name = promptPlace(step.number, dated && group ? group.number : null);
  const line = [
    dated && group ? `Session ${group.number}` : null,
    tool,
    when || null,
    group && inSession > 0 ? `Prompt ${inSession} of ${sessionPrompts.length} in session` : `Prompt ${place} of ${prompts.length}`,
  ]
    .filter(Boolean)
    .join(" · ");

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
  return { previous, next, place, name, instructions, tool, model, line, uses, goesInto, before };
}

/* ── the refined look (UI-P94) ── */

const geist = (size: number, weight: 400 | 500, color: string): CSSProperties => ({ fontFamily: FIGTREE, fontSize: size, fontWeight: weight, lineHeight: "normal", color });


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

/** CA-15 P2, CA-15b: the editable title: the prompt's place, then a field and Rename; only the maker can change it. */
function RefinedTitleField({ step, place, onTitle, phone }: { step: Step; place: string; onTitle: (id: string, title: string) => void; phone: boolean }) {
  const [draft, setDraft] = useState(step.title ?? "");
  const field = useRef<HTMLInputElement | null>(null);
  const save = () => {
    if (draft.trim() !== (step.title ?? "")) onTitle(step.id, draft);
  };
  return (
    <Inline>
      <span data-testid="prompt-place" style={{ ...geist(15, 500, t.text2), flexShrink: 0, whiteSpace: "nowrap", lineHeight: "20px" }}>
        {place}
      </span>
      <span style={{ flex: "1 1 0", minWidth: 0 }}>
        <FieldInput
          phone={phone}
          ref={field}
          aria-label="Title"
          value={draft}
          maxLength={TITLE_MAX}
          placeholder={FULL_PROMPT_COPY.titlePlaceholder}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            // Esc closes the window and unmounts the field before it can blur, so it saves here too.
            if (event.key === "Escape") save();
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
        />
      </span>
      <IconSquare glyph="pencil" label={FULL_PROMPT_COPY.rename} phone={phone} onClick={() => field.current?.focus()} />
    </Inline>
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
        ...areaStyle(phone, 5),
        ...(focused ? { borderColor: t.focusRing } : null),
        height: phone ? "42dvh" : 120,
        overflowY: "auto",
        resize: "vertical",
        outline: "none",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      <ChangedText text={text} changes={changes} />
    </div>
  );
}

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

/** CA-12 P12, CA-15 P2: "Response". The maker edits it (up to 4,000 characters); a reader sees it as read-only text. */
function ReplyField({ step, onReply, phone }: { step: Step; onReply?: (id: string, reply: string) => void; phone: boolean }) {
  const [draft, setDraft] = useState(step.reply ?? "");
  const save = () => {
    if (draft.trim() !== (step.reply ?? "")) onReply?.(step.id, draft);
  };
  if (!onReply) {
    if (!step.reply) return null;
    return (
      <Block testId="reply-read">
        <BlockHead label={FULL_PROMPT_COPY.response} />
        <p style={{ ...geist(13, 400, t.text2), margin: 0, lineHeight: "20px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{step.reply}</p>
      </Block>
    );
  }
  return (
    <Block>
      <BlockHead label={FULL_PROMPT_COPY.response} htmlFor={`reply-${step.id}`} count={FULL_PROMPT_COPY.replyCount(draft.length)} />
      <FieldArea phone={phone} id={`reply-${step.id}`} value={draft} maxLength={REPLY_MAX} rows={5} placeholder="Nothing added yet" onChange={(event) => setDraft(event.target.value)} onBlur={save} />
    </Block>
  );
}

/** One read-only line of a label and its value, for a reader's Optional rows. */
function ReadLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={geist(12, 400, t.text2)}>{label}</span>
      <span style={{ ...geist(13, 400, t.text), overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{children}</span>
    </div>
  );
}

/** CA-15 P2: the Optional section of a prompt: Model settings and Variables. A reader sees only the rows that hold something. */
function PromptOptional({ props, step, tool, model, phone, picked, onMarked }: { props: FullPromptWindowProps; step: Step; tool: string | null; model: string | null; phone: boolean; picked: ChangeRange | null; onMarked: () => void }) {
  const { mode, onExtras, onText } = props;
  const maker = mode === "maker" && Boolean(onExtras);
  const settings: PromptSettings = step.settings ?? { model: "", effort: "default", instructions: "" };
  const [instructions, setInstructions] = useState(settings.instructions);
  const [described, setDescribed] = useState<Record<string, string>>({});
  const variables = variablesFor(step.text, step.variables ?? []);
  const effortHeld = settings.effort !== "default";
  const modelHeld = Boolean(model);
  const settingsHeld = modelHeld || effortHeld || Boolean(settings.instructions);
  const shownModel = model ? modelLabel(model) : null;
  const settingsLine = summaryOf(shownModel, effortHeld ? `${EFFORT_LABEL[settings.effort]} effort` : null, settings.instructions);
  const variablesLine = summaryOf(variables.map((variable) => `{${variable.name}}`));
  const saveSettings = (patch: Partial<PromptSettings>) => onExtras?.(step.id, { settings: { ...settings, ...patch } });
  const saveVariables = (next: Record<string, string>) =>
    onExtras?.(step.id, { variables: variables.map((variable) => ({ name: variable.name, description: (next[variable.name] ?? variable.description).trim() })) });
  const canMark = Boolean(onText) && picked !== null && picked.end > picked.start && markVariable(step.text, picked.start, picked.end) !== null;

  if (!maker) {
    if (!settingsHeld && variables.length === 0) return null;
    return (
      <OptionalSection>
        {settingsHeld ? (
          <OptionalField name={FULL_PROMPT_COPY.modelSettings} description={FULL_PROMPT_COPY.modelSettingsLine} summary={settingsLine} phone={phone}>
            {shownModel ? (
              <ReadLine label={FULL_PROMPT_COPY.model}>
                <ModelTag tool={tool} model={model}>
                  {shownModel}
                </ModelTag>
              </ReadLine>
            ) : null}
            {effortHeld ? <ReadLine label={FULL_PROMPT_COPY.effort}>{EFFORT_LABEL[settings.effort]}</ReadLine> : null}
            {settings.instructions ? <ReadLine label={FULL_PROMPT_COPY.instructions}>{settings.instructions}</ReadLine> : null}
          </OptionalField>
        ) : null}
        {variables.length > 0 ? (
          <OptionalField name={FULL_PROMPT_COPY.variables} description={FULL_PROMPT_COPY.variablesLine} summary={variablesLine} phone={phone}>
            {variables.map((variable) => (
              <ReadLine key={variable.name} label={`{${variable.name}}`}>
                {variable.description || "No description"}
              </ReadLine>
            ))}
          </OptionalField>
        ) : null}
      </OptionalSection>
    );
  }

  return (
    <OptionalSection>
      <OptionalField name={FULL_PROMPT_COPY.modelSettings} description={FULL_PROMPT_COPY.modelSettingsLine} summary={settingsLine} phone={phone}>
        <ModelPicker tool={tool} value={model} onChange={(next) => saveSettings({ model: next ?? "" })} phone={phone} field />
        <SegmentedField<Effort> label={FULL_PROMPT_COPY.effort} phone={phone} items={EFFORTS.map((effort) => ({ value: effort, label: EFFORT_LABEL[effort] }))} value={settings.effort} onChange={(effort) => saveSettings({ effort })} />
        <FieldArea
          phone={phone}
          rows={2}
          aria-label={FULL_PROMPT_COPY.instructions}
          placeholder={FULL_PROMPT_COPY.instructions}
          maxLength={SETTINGS_INSTRUCTIONS_MAX}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          onBlur={() => {
            if (instructions.trim() !== settings.instructions) saveSettings({ instructions: instructions.trim() });
          }}
        />
      </OptionalField>
      <OptionalField name={FULL_PROMPT_COPY.variables} description={FULL_PROMPT_COPY.variablesLine} summary={variablesLine} phone={phone}>
        <Hint>{FULL_PROMPT_COPY.variablesHow}</Hint>
        {variables.length === 0 ? <Count>{FULL_PROMPT_COPY.noVariablesCount}</Count> : null}
        {variables.map((variable) => (
          <Row key={variable.name} id={`variable-${step.id}-${variable.name}`} label={`{${variable.name}}`} noRule phone={phone}>
            <FieldInput
              phone={phone}
              id={`variable-${step.id}-${variable.name}`}
              maxLength={VARIABLE_DESCRIPTION_MAX}
              value={described[variable.name] ?? variable.description}
              placeholder="e.g. The customer's first name"
              onChange={(event) => setDescribed((now) => ({ ...now, [variable.name]: event.target.value }))}
              onBlur={() => saveVariables(described)}
            />
          </Row>
        ))}
        <Inline>
          <RecipeButton
            small
            phone={phone}
            disabled={!canMark}
            // The selection stays while the button is pressed.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!picked) return;
              const marked = markVariable(step.text, picked.start, picked.end);
              if (marked === null) return;
              onText?.(step.id, marked);
              onMarked();
              window.getSelection()?.removeAllRanges();
            }}
          >
            {FULL_PROMPT_COPY.markVariable}
          </RecipeButton>
        </Inline>
      </OptionalField>
    </OptionalSection>
  );
}

/** A square 28 control for the header: Previous and Next. */
function NavSquare({ glyph, label, onClick, phone }: { glyph: "larr" | "rarr"; label: string; onClick: () => void; phone: boolean }) {
  return <IconSquare glyph={glyph} label={label} phone={phone} onClick={onClick} />;
}

function RefinedBody({ props, step, prompts, phone }: { props: FullPromptWindowProps; step: Step; prompts: readonly Step[]; phone: boolean }) {
  const { mode, onTitle, onClose, onNavigate, onChanges, onReply, onText } = props;
  const [said, say] = useAnnouncer();
  /** CA-05 P1: what is selected in the text (or the caret), while the maker can mark words. */
  const [picked, setPicked] = useState<ChangeRange | null>(null);
  const existing = rangeAt(step.changes ?? [], picked ?? { start: -1, end: -1 });
  const markable = mode === "maker" && onChanges && !isInstructions(step) && picked !== null && (existing !== null || picked.end > picked.start);
  const textRef = useRef<HTMLDivElement>(null);
  const { previous, next, place, name, instructions, tool, model, line, uses, goesInto, before } = bodyFacts(props, step, prompts);

  // Opening puts focus on the text box.
  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const copy = async () => {
    say((await copyText(bracketed(step.text, step.changes))) ? FULL_PROMPT_COPY.copied : "Couldn't copy. Select the text and copy it.");
  };

  const quiet = geist(11.5, 400, t.label);
  const maker = mode === "maker" && Boolean(onTitle) && !instructions;
  const extras = (step.kind === "prompt" && !isInstructions(step) && step.outputShape) || step.changes?.length || ((uses.length > 0 || goesInto.length > 0) && !(maker && props.details));

  return (
    /* The global field rule makes a field inherit its size on a computer, so the window sets the fields' 13 here. */
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "1 1 auto", fontSize: phone ? 16 : 13, ...(phone ? { minHeight: "100%" } : null) }}>
      <LiveRegion message={said} />
      <div style={phone ? { ...HEADER, padding: "4px 0 16px" } : HEADER}>
        <div style={HEADER_TEXT}>
          {maker && onTitle ? (
            <>
              <Dialog.Title style={VISUALLY_HIDDEN}>
                Prompt {step.number} of {prompts.length}
              </Dialog.Title>
              <RefinedTitleField key={step.id} step={step} place={name} onTitle={onTitle} phone={phone} />
            </>
          ) : (
            <Dialog.Title style={{ margin: 0, letterSpacing: "-0.01em", overflowWrap: "anywhere" }} data-default-title={step.title ? undefined : "true"}>
              {instructions ? stepTitle(step) : <PromptName place={name} title={step.title} size={15} />}
            </Dialog.Title>
          )}
          <p data-testid="full-prompt-line" style={{ ...SUBTITLE, overflowWrap: "anywhere" }}>
            {line}
          </p>
        </div>
        <div style={HEADER_ICONS}>
          {onNavigate && previous ? <NavSquare glyph="larr" phone={phone} label={`Previous prompt: ${stepTitle(previous)}`} onClick={() => onNavigate(previous.id)} /> : null}
          {onNavigate && next ? <NavSquare glyph="rarr" phone={phone} label={`Next prompt: ${stepTitle(next)}`} onClick={() => onNavigate(next.id)} /> : null}
          <Dialog.Close asChild>
            <IconSquare glyph="x" label="Close" phone={phone} />
          </Dialog.Close>
        </div>
      </div>

      <ModalInset.Provider value={phone ? 0 : MODAL_PAD}>
        <div style={bodyStyle(phone)}>
          <Block noRule>
            <BlockHead label={FULL_PROMPT_COPY.prompt} id={`prompt-label-${step.id}`} count={`${step.words} words`}>
              {markable ? (
                <RecipeButton
                  small
                  phone={phone}
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
                </RecipeButton>
              ) : null}
              <RecipeButton small phone={phone} onClick={() => void copy()}>
                {FULL_PROMPT_COPY.copy}
              </RecipeButton>
            </BlockHead>
            <RefinedTextBox key={step.id} text={step.text} changes={step.changes} boxRef={textRef} phone={phone} onPick={mode === "maker" && (onChanges || onText) ? setPicked : undefined} />
          </Block>
          {!isInstructions(step) && step.kind === "prompt" ? <ReplyField key={`reply-${step.id}`} step={step} onReply={mode === "maker" ? onReply : undefined} phone={phone} /> : null}
          {maker && !isInstructions(step) && step.kind === "prompt" && props.details && props.handlers ? (
            (() => {
              const view = props.details?.(step.id);
              return view ? <PromptEdits key={`edits-${step.id}`} view={view} handlers={props.handlers as PromptEditHandlers} phone={phone} /> : null;
            })()
          ) : null}
          {extras ? (
            <Block>
              {!isInstructions(step) && step.kind === "prompt" && step.outputShape ? <ShapeRead shape={step.outputShape} /> : null}
              {step.changes?.length ? (
                <p data-testid="changes-line" style={{ ...quiet, margin: 0 }}>
                  {changesLine(step.changes.length)}
                </p>
              ) : null}
              {(uses.length > 0 || goesInto.length > 0) && !(maker && props.details) ? (
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
            </Block>
          ) : null}
          {mode === "reader" && props.renderBefore ? <Block>{props.renderBefore(step)}</Block> : null}
          {mode === "reader" && !props.renderBefore && before.length > 0 ? (
            <Block>
              <BlockHead label={FULL_PROMPT_COPY.before} heading />
              {before.map((line) => (
                <span key={line} style={geist(13, 400, t.text)}>
                  {line}
                </span>
              ))}
            </Block>
          ) : null}
          {!isInstructions(step) && step.kind === "prompt" ? <PromptOptional key={`optional-${step.id}`} props={props} step={step} tool={tool} model={model} phone={phone} picked={picked} onMarked={() => setPicked(null)} /> : null}
        </div>
      </ModalInset.Provider>
      <div style={{ ...footerStyle(phone), ...(phone ? { paddingBottom: "calc(12px + env(safe-area-inset-bottom))", marginTop: "auto" } : null) }}>
        {props.fromPost && props.onBackToPost ? <FromPostNote onBack={props.onBackToPost} phone={phone} /> : null}
        <span style={FOOT_NOTE}>{phone ? null : FULL_PROMPT_COPY.hint}</span>
        <RecipeButton variant="primary" phone={phone} onClick={onClose}>
          {FULL_PROMPT_COPY.done}
        </RecipeButton>
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
            ...(phone
              ? { inset: 0, boxSizing: "border-box", overflowY: "auto", padding: "16px 16px 0", background: t.window, color: t.text, fontFamily: FIGTREE }
              : /* CA-15b: the frame recipe, 640 wide, at most the window less 80, centred. */
                { top: "50%", left: "50%", transform: "translate(-50%, -50%)", ...frameStyle(MODAL_WIDTH.wide) }),
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
