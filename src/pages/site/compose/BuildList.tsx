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
import { ArrowUp, MoreHorizontal } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useLayoutEffect,
} from "react";

import { Button } from "@/components/brand/Button";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { Pill } from "@/components/brand/Pill";
import type { Step } from "@/lib/build/graph";
import { checkStatus, runsLabel, stepTitle, TOOL_TYPE } from "@/lib/build/graph";
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
import { CODE_COPY, looksLikeCode } from "./codeModel";
import { CodeStepDialog } from "./CodeStepDialog";
import { ManualThumb } from "./ManualThumb";
import { OutsideWarning } from "./OutsideWarning";
import { MODEL_CLEARED_MS, MODEL_PICKER_COPY, ModelPicker } from "./ModelPicker";
import { CHECK_COPY, DotLine, NumberTile, Quiet, ToolMark } from "./refinedPieces";
import { ToolPicker } from "./ToolPicker";
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
import type { SourceSession } from "./sourcesModel";

export const LIST_COPY = {
  hint: "Click a prompt to see its details · double-click to read all of it",
  placeholder: "Paste or type a prompt…",
  showFull: "Show full prompt",
  /** CA-03 P5: a check's eyebrow. */
  check: CHECK_COPY.eyebrow,
  /** CA-03 P6. */
  remembers: (memory: string) => `Remembers ${memory}`,
} as const;

export interface BuildListProps {
  phone: boolean;
  steps: readonly Step[];
  /** The divider that goes before a step, keyed by its number. */
  dividers: ReadonlyMap<string, SourceSession>;
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
  /** Changes to put the cursor in the add field ("Add › Prompt"). */
  focusAdd: number;
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

export const clamp2: CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

/* ── small pieces ── */

function MenuRow({ children, disabled, onSelect, phone }: { children: ReactNode; disabled?: boolean; onSelect?: () => void; phone: boolean }) {
  return (
    <Menu.Item disabled={disabled} onSelect={onSelect} style={menuItem(!disabled, phone)}>
      {children}
    </Menu.Item>
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

/* ── a session's head ── */

function SessionHead({ session }: { session: SourceSession }) {
  return (
    <div
      role="separator"
      aria-label={`Session ${session.number} · ${session.tool}`}
      style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, minWidth: 0 }}
    >
      <ToolMark tool={session.tool} size={20} />
      <span style={{ ...text(13, 500, t.text), whiteSpace: "nowrap", flexShrink: 0 }}>
        Session {session.number} · {session.tool}
      </span>
      <span style={{ ...text(12, 400, t.label), ...ellipsis, minWidth: 0 }}>{session.detail}</span>
      <span aria-hidden="true" style={{ flexGrow: 1, height: 1, background: t.hairline, minWidth: 12 }} />
    </div>
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

  const takesDrops = Boolean(props.fine && props.onDropOnStep);
  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

  return (
    <div
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
      style={{ ...moduleStyle(selected || over), display: "flex", flexDirection: "column", gap: 8, outline: "none", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <NumberTile>{step.number}</NumberTile>
        {renaming ? (
          <RenameField label={`Title of prompt ${step.number}`} draft={draft} placeholder={step.defaultTitle} phone={phone} onDraft={setDraft} onFinish={finish} />
        ) : (
          <StepTitle title={title} isDefault={isDefault} />
        )}
        {editable ? (
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton icon={MoreHorizontal} glyph="more" boxed={false} label={`Prompt ${step.number} options`} size={26} onClick={(event) => event.stopPropagation()} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content
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
                <MenuRow phone={phone} disabled={!open} onSelect={open}>Read all of it</MenuRow>
                {props.onAttach ? <MenuRow phone={phone} onSelect={() => props.onAttach?.(step.id)}>Attach a file</MenuRow> : null}
                {props.onNameMade ? <MenuRow phone={phone} onSelect={() => props.onNameMade?.(step.id)}>Name a file it makes</MenuRow> : null}
                <MenuRow phone={phone} disabled={index === 0} onSelect={() => props.onMove(step.id, -1)}>Move up</MenuRow>
                <MenuRow phone={phone} disabled={last} onSelect={() => props.onMove(step.id, 1)}>Move down</MenuRow>
                <MenuRow phone={phone} onSelect={() => props.onRemove(step.id)}>Remove</MenuRow>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        ) : null}
      </div>
      <p
        ref={textRef}
        style={{ ...text(13.5, 400, t.text), lineHeight: "22px", margin: 0, paddingLeft: INDENT, overflowWrap: "anywhere", ...clamp2 }}
      >
        {step.text}
      </p>
      <MadeLine names={props.madeNames?.[step.id]} />
      <div style={footRow(INDENT)}>
        <UsesRow step={step} props={props} />
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

function InnerCard({ step, eyebrow, runs, nested, made, outside = [] }: { step: Step; eyebrow?: string; runs?: string; nested?: boolean; made?: readonly string[]; outside?: readonly string[] }) {
  return (
    <div data-testid={nested ? "inner-prompt" : "inner-card"} style={{ ...tileStyle, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
      {eyebrow ? <Quiet>{eyebrow}</Quiet> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{ fontFamily: DM_MONO, fontSize: 10.5, color: t.label, ...tnum, flexShrink: 0 }}>{step.number}</span>
        <span style={{ ...text(13, 500, step.title ? t.text : t.text2), flexGrow: 1, minWidth: 0, ...ellipsis }}>{stepTitle(step)}</span>
      </div>
      {runs ? <DotLine testId="runs-line">{runs}</DotLine> : null}
      {step.kind === "agent" && step.memory ? <DotLine testId="memory-line">{LIST_COPY.remembers(step.memory)}</DotLine> : null}
      <p style={{ ...text(13, 400, t.text), lineHeight: "21px", margin: 0, overflowWrap: "anywhere", ...clamp2 }}>{step.text}</p>
      {madeLine(made ?? []) ? <Quiet>{madeLine(made ?? [])}</Quiet> : null}
      <OutsideWarning names={outside} />
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
  const goes = props.intoResult.has(step.id);
  return (
    <div
      role="group"
      aria-label={`${isTeam ? "Team" : "Agent"} ${step.number}: ${stepTitle(step)}`}
      data-testid="step-card"
      tabIndex={0}
      onClick={() => props.onSelect(step.id)}
      style={{ ...moduleStyle(selected), display: "flex", flexDirection: "column", gap: 12, outline: "none", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
        <NumberTile>{step.number}</NumberTile>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
          <ContainerEyebrow step={step} made={made} isTeam={isTeam} />
          <h3 style={{ ...text(14, 500, step.title ? t.text : t.text2), margin: 0, overflowWrap: "anywhere" }}>{stepTitle(step)}</h3>
          {runsLabel(step.runs) ? <DotLine testId="runs-line">{runsLabel(step.runs)}</DotLine> : null}
          {!isTeam && step.memory ? <DotLine testId="memory-line">{LIST_COPY.remembers(step.memory)}</DotLine> : null}
        </div>
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
                runs={isTeam ? runsLabel(child.runs) : undefined}
                outside={isTeam ? outsideOf(child, props.names) : []}
                made={props.madeNames?.[child.id]}
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
                  {open ? own.map((grand) => <InnerCard key={grand.id} step={grand} nested made={props.madeNames?.[grand.id]} />) : null}
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
    </div>
  );
}

/** Work done outside AI (UI-P70): a module like a prompt's, its eyebrow saying so; no new colour. */
function ManualCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  const { phone } = props;
  const selected = props.selectedId === step.id;
  const isDefault = step.title === null;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const renameNext = useRef(false);
  const finish = (save: boolean) => {
    setRenaming(false);
    if (save && draft.trim() !== (step.title ?? "")) props.onRename(step.id, draft);
  };
  return (
    <div
      role="group"
      aria-label={`Manual step ${step.number}: ${stepTitle(step)}`}
      data-testid="step-card"
      data-kind="manual"
      data-selected={selected ? "true" : undefined}
      tabIndex={0}
      onClick={() => props.onSelect(step.id)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          props.onSelect(step.id);
        }
      }}
      style={{ ...moduleStyle(selected), display: "flex", flexDirection: "column", gap: 8, outline: "none", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
        <NumberTile>{step.number}</NumberTile>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
          <span data-testid="manual-eyebrow" style={text(11.5, 400, t.label)}>
            Manual step
            {step.tool ? (
              <>
                {" · "}
                {markFor({ tool: step.tool }) !== null ? (
                  <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 6 }}>
                    <ToolMark tool={step.tool} size={14} />
                  </span>
                ) : null}
                {step.tool}
              </>
            ) : null}
            {" · added by maker"}
          </span>
          {renaming ? (
            <RenameField label={`Title of manual step ${step.number}`} draft={draft} placeholder={step.defaultTitle} phone={phone} onDraft={setDraft} onFinish={finish} />
          ) : (
            <h3 data-default-title={isDefault ? "true" : undefined} style={{ ...text(14, 500, isDefault ? t.text2 : t.text), margin: 0, overflowWrap: "anywhere" }}>
              {stepTitle(step)}
            </h3>
          )}
        </div>
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton icon={MoreHorizontal} glyph="more" boxed={false} label={`Manual step ${step.number} options`} size={26} onClick={(event) => event.stopPropagation()} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
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
              <MenuRow phone={phone} disabled={index === 0} onSelect={() => props.onMove(step.id, -1)}>Move up</MenuRow>
              <MenuRow phone={phone} disabled={last} onSelect={() => props.onMove(step.id, 1)}>Move down</MenuRow>
              <MenuRow phone={phone} onSelect={() => props.onRemove(step.id)}>Remove</MenuRow>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
      <p style={{ ...text(13.5, 400, t.text), lineHeight: "22px", margin: 0, paddingLeft: INDENT, overflowWrap: "anywhere" }}>{step.text}</p>
      <MadeLine names={props.madeNames?.[step.id]} />
      <div style={footRow(INDENT)}>
        <UsesRow step={step} props={props} />
        {step.mediaId ? (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Quiet>1 screenshot</Quiet>
            <ManualThumb mediaId={step.mediaId} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** CA-02 P7: lines of code, as a module like a manual step's: its title on one line with its file name after it in small mono type. No code is on the page: the title opens the whole file in a window. */
function CodeCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  const { phone } = props;
  const selected = props.selectedId === step.id;
  const isDefault = step.title === null;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const renameNext = useRef(false);
  const finish = (save: boolean) => {
    setRenaming(false);
    if (save && draft.trim() !== (step.title ?? "")) props.onRename(step.id, draft);
  };
  const [viewing, setViewing] = useState(false);
  return (
    <div
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
      style={{ ...moduleStyle(selected), display: "flex", flexDirection: "column", gap: 8, outline: "none", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
        <NumberTile>{step.number}</NumberTile>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
          {renaming ? (
            <RenameField label={`Title of code ${step.number}`} draft={draft} placeholder={step.defaultTitle} phone={phone} onDraft={setDraft} onFinish={finish} />
          ) : (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
              <h3 data-default-title={isDefault ? "true" : undefined} style={{ margin: 0, minWidth: 0, flexShrink: 1, ...text(14, 500, isDefault ? t.text2 : t.text) }}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={(event) => {
                    event.stopPropagation();
                    setViewing(true);
                  }}
                  style={{ ...bareButton, ...text(14, 500, isDefault ? t.text2 : t.text), display: "block", maxWidth: "100%", ...ellipsis }}
                >
                  {stepTitle(step)}
                </button>
              </h3>
              {step.filename ? (
                <span data-testid="code-filename" style={{ fontFamily: DM_MONO, fontSize: 11.5, lineHeight: 1.4, color: t.text2, flexShrink: 0, maxWidth: "45%", ...ellipsis }}>
                  {step.filename}
                </span>
              ) : null}
            </div>
          )}
        </div>
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton icon={MoreHorizontal} glyph="more" boxed={false} label={`Code ${step.number} options`} size={26} onClick={(event) => event.stopPropagation()} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
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
              <MenuRow phone={phone} disabled={index === 0} onSelect={() => props.onMove(step.id, -1)}>Move up</MenuRow>
              <MenuRow phone={phone} disabled={last} onSelect={() => props.onMove(step.id, 1)}>Move down</MenuRow>
              <MenuRow phone={phone} onSelect={() => props.onRemove(step.id)}>Remove</MenuRow>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
      <MadeLine names={props.madeNames?.[step.id]} />
      <div style={footRow(INDENT)}>
        <UsesRow step={step} props={props} />
      </div>
      {/* The window is in a portal, but React events still climb to the card, which would select the step. */}
      <div style={{ display: "contents" }} onClick={(event) => event.stopPropagation()}>
        <CodeStepDialog open={viewing} onOpenChange={setViewing} title={stepTitle(step)} filename={step.filename ?? null} language={step.language ?? null} source={step.text} />
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
  const finish = (save: boolean) => {
    setRenaming(false);
    if (save && draft.trim() !== (step.title ?? "")) props.onRename(step.id, draft);
  };
  const status = step.check ? checkStatus(step.check) : null;
  return (
    <div
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
      style={{ ...moduleStyle(selected), display: "flex", flexDirection: "column", gap: 8, outline: "none", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
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
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton icon={MoreHorizontal} glyph="more" boxed={false} label={`Check ${step.number} options`} size={26} onClick={(event) => event.stopPropagation()} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
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
              <MenuRow phone={phone} disabled={index === 0} onSelect={() => props.onMove(step.id, -1)}>Move up</MenuRow>
              <MenuRow phone={phone} disabled={last} onSelect={() => props.onMove(step.id, 1)}>Move down</MenuRow>
              <MenuRow phone={phone} onSelect={() => props.onRemove(step.id)}>Remove</MenuRow>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
      <p style={{ ...text(13.5, 400, t.text), lineHeight: "22px", margin: 0, paddingLeft: INDENT, overflowWrap: "anywhere" }}>{step.text}</p>
      {status ? (
        <DotLine testId="check-status" dot={status.allPassed ? t.evidence : t.catBreakage} style={{ paddingLeft: INDENT }}>
          <span style={tnum}>{status.line}</span>
        </DotLine>
      ) : null}
      <div style={footRow(INDENT)}>
        <UsesRow step={step} props={props} />
      </div>
    </div>
  );
}

function ResultCard({ result, selected, onSelect }: { result: ListResult; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <div
      data-testid="result-card"
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
      style={{ ...moduleStyle(selected), display: "flex", alignItems: "center", gap: 12, outline: "none", cursor: "pointer" }}
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
        <Quiet>
          {result.holds}
          {result.from ? ` · from prompt ${result.from}` : ""}
        </Quiet>
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

function AddPrompt({ phone, onAddPrompt, onAddAsAgent, onKeepAsCode, focusAdd, inBuild = [] }: Pick<BuildListProps, "phone" | "onAddPrompt" | "onAddAsAgent" | "onKeepAsCode" | "focusAdd" | "inBuild">) {
  const [value, setValue] = useState("");
  /** CA-02 P7: true once text was pasted in, until the field is emptied. Only pasted text is offered as code. */
  const [pasted, setPasted] = useState(false);
  const [tool, setTool] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cleared, setCleared] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusAdd > 0) field.current?.focus();
  }, [focusAdd]);

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
    <div data-testid="add-prompt" style={{ ...moduleStyle(false, 12), display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5 }}>
      <textarea
        ref={field}
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
        <Quiet>Typed here ·</Quiet>
        <ToolPicker label={`Typed here · ${toolLabel ?? "pick a tool"}`} value={tool} onChange={changeTool} inBuild={inBuild} allowNone phone={phone} step="prompt" />
        {/* CA-03: Typed here has no field label, so its menu keeps the word "model" while empty. */}
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

/** A run of steps on the page: a session's head and the prompts that follow it, or one step that stands alone. */
interface Run {
  key: string;
  head: SourceSession | null;
  steps: Step[];
}

function runsOf(steps: readonly Step[], dividers: BuildListProps["dividers"]): Run[] {
  const runs: Run[] = [];
  for (const step of steps) {
    const head = dividers.get(step.number) ?? null;
    const last = runs[runs.length - 1];
    /* Agents, teams and manual steps stand on their own unless a session's head names them. */
    if (head || !last || !last.head || step.kind !== "prompt") runs.push({ key: step.id, head, steps: [step] });
    else last.steps.push(step);
  }
  return runs;
}

export function BuildList(props: BuildListProps) {
  const { steps } = props;
  const prompts = steps.filter((step) => step.kind === "prompt");
  const card = (step: Step) =>
    step.kind === "prompt" ? (
      <StepCard key={step.id} step={step} index={prompts.indexOf(step)} last={prompts.indexOf(step) === prompts.length - 1} props={props} />
    ) : step.kind === "manual" ? (
      <ManualCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "code" ? (
      <CodeCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : step.kind === "check" ? (
      <CheckCard key={step.id} step={step} index={steps.indexOf(step)} last={steps.indexOf(step) === steps.length - 1} props={props} />
    ) : (
      <ContainerCard key={step.id} step={step} props={props} />
    );
  return (
    /* The global field rule makes a field inherit its size on a desktop (`font-size: inherit !important`), so the
     fields' type is set here, where they inherit it. */
    <div data-testid="build-list" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, fontSize: 13.5 }}>
      <p style={{ ...text(12, 400, t.label), margin: 0 }}>{LIST_COPY.hint}</p>
      {runsOf(steps, props.dividers).map((run) => (
        <div key={run.key} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          {run.head ? <SessionHead session={run.head} /> : null}
          {run.steps.map(card)}
        </div>
      ))}
      {props.results.map((result) => (
        <ResultCard key={result.id} result={result} selected={props.selectedId === result.id} onSelect={props.onSelect} />
      ))}
      <AddPrompt phone={props.phone} onAddPrompt={props.onAddPrompt} onAddAsAgent={props.onAddAsAgent} onKeepAsCode={props.onKeepAsCode} focusAdd={props.focusAdd} inBuild={props.inBuild} />
    </div>
  );
}

export default BuildList;
