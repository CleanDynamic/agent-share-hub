/* UI-P65 — the Build panel's List: the whole build in step order.

   PURE. Steps in, intentions out. `SandboxPage` reads the steps (`buildSteps`)
   and runs the writes (the prompts hook beside it); this file draws.

   WHAT IT DRAWS, top to bottom: a hint; for each step a card, with a session
   divider before the first step of each run of steps from one session; the
   result; and the field that adds a prompt. Agents and teams draw nested
   (UI-P69): an agent's instructions then its prompts, with a ghost row to add
   one; a team's agents as inner cards, with a ghost row to add another.

   A CARD IS SELECTED BY CLICKING IT, and opened by double-click, Enter, "Show
   full prompt" or its menu's "Read all of it" (`onOpenPrompt`, which UI-P67
   implements; until it is given the three open nothing and the menu item is
   disabled). A phone has no double-click: a tap selects, and "Show full
   prompt" opens. The card is a focusable group rather than a button because it
   holds buttons of its own.

   THE TITLE of a step the maker has not named reads in `--text2` at weight
   500: it is the default, not their words. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowUp, Check, ChevronDown, MoreHorizontal, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { TOOL_CLIENTS } from "@/lib/build/making";
import type { Step } from "@/lib/build/graph";
import { runsLabel, stepTitle } from "@/lib/build/graph";
import { MODEL_VERSIONS } from "@/lib/models/registry";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { agentEyebrow, isClamped, madeIn, stepModel, suggestionKey, inputLabel, type ListResult, type ListSuggestion } from "./buildListModel";
import { TextButton } from "./composeControls";
import type { SourceSession } from "./sourcesModel";

export const LIST_COPY = {
  hint: "Click a prompt to see its details · double-click to read all of it",
  placeholder: "Paste or type a prompt…",
  showFull: "Show full prompt",
} as const;

const selTint = tokenAlpha("action", 0.12);

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
  /** Changes to put the cursor in the add field ("Add › Prompt"). */
  focusAdd: number;
  /** UI-P69: "Add a prompt to this agent". Resolves true once it is saved. */
  onAddAgentPrompt: (agentId: string, text: string) => Promise<boolean>;
  /** UI-P69: "Add an agent to this team". */
  onAddAgentTo: (teamId: string) => void;
}

/* ── small pieces ── */

const mono = (size: 11.5 | 12 | 11): CSSProperties => ({ fontFamily: DM_MONO, fontSize: size, color: t.text2 });

function Dot({ size = 7, ringOnly = false }: { size?: number; ringOnly?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: r.full, boxSizing: "border-box", flexShrink: 0, border: `1.5px solid ${t.text2}`, background: ringOnly ? "transparent" : t.text2 }}
    />
  );
}

function Badge({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <span
      style={{
        minWidth: wide ? 34 : 24,
        height: 24,
        padding: wide ? "0 4px" : 0,
        boxSizing: "border-box",
        borderRadius: 7,
        background: selTint,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...mono(12),
        // the badge is `--text`, not the quiet mono colour
        color: t.text,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function Chip({ children, dashed, onClick }: { children: ReactNode; dashed?: boolean; onClick?: () => void }) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick: (event: { stopPropagation: () => void }) => { event.stopPropagation(); onClick(); } } : null)}
      style={{
        cursor: onClick ? "pointer" : undefined,
        height: 24,
        padding: "0 8px 0 6px",
        boxSizing: "border-box",
        borderRadius: 8,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: dashed ? "transparent" : tokenAlpha("action", 0.08),
        border: dashed ? `1.5px dashed ${t.text2}` : "1.5px solid transparent",
        ...mono(11.5),
        color: t.text,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Tag>
  );
}

/** A Radix menu item, in the card menus' type. */
function MenuRow({ children, disabled, onSelect, phone }: { children: ReactNode; disabled?: boolean; onSelect?: () => void; phone: boolean }) {
  return (
    <Menu.Item
      disabled={disabled}
      onSelect={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        minHeight: phone ? 44 : 32,
        padding: "0 10px",
        borderRadius: r.control,
        fontFamily: FIGTREE,
        fontSize: 13.5,
        color: t.text,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        outline: "none",
      }}
    >
      {children}
    </Menu.Item>
  );
}

const menuSurface: CSSProperties = {
  zIndex: 50,
  minWidth: 180,
  padding: 6,
  borderRadius: r.panel,
  background: t.solid,
  border: `1px solid ${t.line}`,
  boxShadow: t.shadowFloat,
  color: t.text,
};

/** Whether `ref`'s text is cut off by its line clamp; read after layout and on resize. */
function useClamped<T extends HTMLElement>(text: string) {
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

const clamp2: CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

/* ── dividers ── */

function Divider({ session, first }: { session: SourceSession; first: boolean }) {
  return (
    <div role="separator" aria-label={`Session ${session.number} · ${session.tool}`} style={{ display: "flex", alignItems: "center", gap: 7, margin: `${first ? 4 : 16}px 0 8px` }}>
      <Dot />
      <span style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap" }}>
        Session {session.number} · {session.tool}
      </span>
      <span style={mono(12)}>{session.detail}</span>
      <span aria-hidden="true" style={{ flexGrow: 1, height: 1, background: t.hairline }} />
    </div>
  );
}

/* ── the uses row ── */

function UsesRow({
  step,
  props,
}: {
  step: Step;
  props: Pick<BuildListProps, "steps" | "names" | "suggestions" | "intoResult" | "onAccept" | "onDismiss" | "onSelect">;
}) {
  const chips = step.uses
    .map((use) => ({ use, text: inputLabel(use, props.steps, props.names) }))
    .filter((chip): chip is { use: typeof chip.use; text: string } => chip.text !== null);
  const mine = props.suggestions.filter((suggestion) => suggestion.stepId === step.id);
  const goes = props.intoResult.has(step.id);
  if (chips.length === 0 && mine.length === 0 && !goes) return null;
  return (
    <>
      {chips.length > 0 || mine.length > 0 ? <span style={mono(12)}>Uses</span> : null}
      {chips.map(({ use, text }) => (
        <Chip key={suggestionKey(use)} onClick={use.kind === "output" ? undefined : () => props.onSelect(use.node_id)}>
          <Dot ringOnly />
          {text}
        </Chip>
      ))}
      {mine.map((suggestion) => (
        <Chip key={suggestionKey(suggestion.use)} dashed>
          {suggestion.label} · {suggestion.reason}
          <TextButton onClick={() => props.onAccept(suggestion)} style={{ fontSize: 11.5, fontWeight: 600, color: t.text }}>
            Accept
          </TextButton>
          <TextButton onClick={() => props.onDismiss(suggestion)} style={{ fontSize: 11.5 }}>
            Dismiss
          </TextButton>
        </Chip>
      ))}
      {goes ? (
        <>
          <span style={mono(12)}>Goes into</span>
          <span style={{ height: 24, padding: "0 8px", borderRadius: 8, display: "inline-flex", alignItems: "center", background: t.evidenceFill, ...mono(11.5), color: t.onEvidenceFill }}>
            Result
          </span>
        </>
      ) : null}
    </>
  );
}

/* ── a prompt's card ── */

function StepCard({ step, index, last, props }: { step: Step; index: number; last: boolean; props: BuildListProps }) {
  const { phone, selectedId } = props;
  const selected = selectedId === step.id;
  const title = stepTitle(step);
  const isDefault = step.title === null;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const { ref: textRef, clamped } = useClamped<HTMLParagraphElement>(step.text);
  const open = props.onOpenPrompt ? () => props.onOpenPrompt?.(step.id) : undefined;
  const editable = step.kind === "prompt";

  /* Rename starts once the menu has closed: closing returns focus to the menu's
     button, which would blur a field opened any earlier and end the edit. */
  const renameNext = useRef(false);
  const startRename = () => {
    renameNext.current = true;
  };
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
      style={{
        borderRadius: 14,
        border: `1px solid ${selected ? "transparent" : t.line}`,
        boxShadow: selected ? `0 0 0 2px ${t.text}` : "none",
        background: t.solid,
        marginBottom: 8,
        outline: "none",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px 0 14px" }}>
        <Badge>{step.number}</Badge>
        {renaming ? (
          <input
            autoFocus
            aria-label={`Title of prompt ${step.number}`}
            value={draft}
            maxLength={80}
            placeholder={step.defaultTitle}
            onChange={(event) => setDraft(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") finish(true);
              if (event.key === "Escape") finish(false);
            }}
            onBlur={() => finish(true)}
            style={{ flexGrow: 1, minWidth: 0, height: 28, boxSizing: "border-box", padding: "0 8px", borderRadius: r.control, border: `1px solid ${t.line}`, background: t.field, color: t.text, fontFamily: FIGTREE, fontSize: phone ? 16 : 15, fontWeight: 600 }}
          />
        ) : (
          <h3
            data-default-title={isDefault ? "true" : undefined}
            style={{
              margin: 0,
              flexGrow: 1,
              minWidth: 0,
              fontFamily: FIGTREE,
              fontSize: 15,
              fontWeight: isDefault ? 500 : 600,
              color: isDefault ? t.text2 : t.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </h3>
        )}
        {editable ? (
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton icon={MoreHorizontal} label={`Prompt ${step.number} options`} size={30} onClick={(event) => event.stopPropagation()} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content
                align="end"
                sideOffset={4}
                style={menuSurface}
                onClick={(event) => event.stopPropagation()}
                onCloseAutoFocus={(event) => {
                  if (!renameNext.current) return;
                  event.preventDefault();
                  renameNext.current = false;
                  setDraft(step.title ?? "");
                  setRenaming(true);
                }}
              >
                <MenuRow phone={phone} onSelect={startRename}>Rename</MenuRow>
                <MenuRow phone={phone} disabled={!open} onSelect={open}>Read all of it</MenuRow>
                <MenuRow phone={phone} disabled={index === 0} onSelect={() => props.onMove(step.id, -1)}>Move up</MenuRow>
                <MenuRow phone={phone} disabled={last} onSelect={() => props.onMove(step.id, 1)}>Move down</MenuRow>
                <MenuRow phone={phone} onSelect={() => props.onRemove(step.id)}>Remove</MenuRow>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        ) : null}
      </div>
      <div style={{ padding: "6px 14px 0 48px" }}>
        <p ref={textRef} style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, lineHeight: 1.5, color: t.text, overflowWrap: "anywhere", ...clamp2 }}>
          {step.text}
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "8px 10px 10px 48px" }}>
        <UsesRow step={step} props={props} />
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10 }}>
          {clamped ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                open?.();
              }}
              style={{ border: "none", background: "transparent", padding: phone ? "12px 0" : 0, fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 600, color: t.text, textDecoration: "underline", cursor: "pointer" }}
            >
              {LIST_COPY.showFull}
            </button>
          ) : null}
          <span style={mono(12)}>{step.words} {step.words === 1 ? "word" : "words"}</span>
        </span>
      </div>
    </div>
  );
}

/* ── agents and teams (UI-P69) ── */

function InnerCard({ step, eyebrow, runs, nested }: { step: Step; eyebrow?: string; runs?: string; nested?: boolean }) {
  return (
    <div data-testid={nested ? "inner-prompt" : "inner-card"} style={{ display: "flex", gap: 10, padding: 10, borderRadius: 12, background: t.cell, border: `1px solid ${t.hairline}` }}>
      <Badge wide>{step.number}</Badge>
      <div style={{ minWidth: 0, flexGrow: 1 }}>
        {eyebrow ? <div style={mono(12)}>{eyebrow}</div> : null}
        <div style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: step.title ? 600 : 500, color: step.title ? t.text : t.text2 }}>{stepTitle(step)}</div>
        <p style={{ margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 13.5, lineHeight: 1.5, color: t.text, ...clamp2 }}>{step.text}</p>
      </div>
      {runs ? <Chip>{runs}</Chip> : null}
    </div>
  );
}

/** A quiet "+ …" row that opens a small field, for "Add a prompt to this agent". */
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
      style={{ minHeight: phone ? 44 : 30, padding: "0 10px", display: "flex", alignItems: "center", gap: 6, borderRadius: 12, border: `1.5px dashed ${t.line}`, background: "transparent", color: t.text2, fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left", ...ring(state.focusVisible) }}
    >
      <Plus size={14} aria-hidden="true" />
      {label}
    </button>
  );
}

/** The field "Add a prompt to this agent" opens: the List's add field without the tool and model chips (the agent's model applies). */
function AgentPromptField({ agent, props, onDone }: { agent: Step; props: BuildListProps; onDone: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => field.current?.focus(), []);
  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const saved = await props.onAddAgentPrompt(agent.id, text);
    setBusy(false);
    if (saved) {
      setText("");
      onDone();
    }
  };
  return (
    <div data-testid="agent-prompt-field" onClick={(event) => event.stopPropagation()} style={{ borderRadius: 12, border: `1px solid ${t.line}`, background: t.field, padding: "10px 10px 8px 12px" }}>
      <textarea
        ref={field}
        aria-label={`Add a prompt to agent ${agent.number}`}
        rows={2}
        value={text}
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
        style={{ width: "100%", boxSizing: "border-box", resize: "none", border: "none", background: "transparent", outline: "none", color: t.text, fontFamily: FIGTREE, fontSize: props.phone ? 16 : 14, lineHeight: 1.5, padding: 0 }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
        <TextButton onClick={onDone} target={props.phone}>
          Cancel
        </TextButton>
        <IconButton icon={ArrowUp} label="Add prompt to this agent" size={props.phone ? 38 : 30} disabled={!text.trim() || busy} onClick={() => void submit()} />
      </div>
    </div>
  );
}

function ContainerCard({ step, props }: { step: Step; props: BuildListProps }) {
  const isTeam = step.kind === "team";
  const model = stepModel(step);
  const selected = props.selectedId === step.id;
  const made = madeIn(step, props.steps);
  const [adding, setAdding] = useState(false);
  /** One agent of a team shows its own prompts at a time. */
  const [openAgent, setOpenAgent] = useState<string | null>(null);
  return (
    <div
      role="group"
      aria-label={`${isTeam ? "Team" : "Agent"} ${step.number}: ${stepTitle(step)}`}
      data-testid="step-card"
      tabIndex={0}
      onClick={() => props.onSelect(step.id)}
      style={{ borderRadius: 14, border: `1px solid ${selected ? "transparent" : t.line}`, boxShadow: selected ? `0 0 0 2px ${t.text}` : "none", background: t.solid, marginBottom: 8, padding: "10px 14px 10px 14px", outline: "none", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Badge>{step.number}</Badge>
        <div style={{ minWidth: 0, flexGrow: 1 }}>
          <div data-testid="container-eyebrow" style={mono(12)}>{isTeam ? agentEyebrow(made, null, "Team") : agentEyebrow(made, model)}</div>
          <h3 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, fontWeight: step.title ? 600 : 500, color: step.title ? t.text : t.text2 }}>{stepTitle(step)}</h3>
        </div>
        <Chip>{runsLabel(step.runs)}</Chip>
      </div>
      <div style={{ margin: "8px 0 0 12px", paddingLeft: 12, borderLeft: `2px solid ${t.line}`, display: "flex", flexDirection: "column", gap: 6 }}>
        {step.children.map((child) => {
          const own = isTeam ? child.children.filter((grand) => !grand.id.endsWith(":instructions")) : [];
          const open = isTeam && openAgent === child.id;
          return (
            <div key={child.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <InnerCard
                step={child}
                eyebrow={isTeam ? `Agent · ${stepTitle(child)}${stepModel(child) ? ` · ${stepModel(child)}` : ""}` : undefined}
                runs={isTeam ? runsLabel(child.runs) : undefined}
              />
              {own.length > 0 ? (
                <div style={{ paddingLeft: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span>
                    <TextButton
                      target={props.phone}
                      aria-expanded={open}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenAgent(open ? null : child.id);
                      }}
                    >
                      {open ? `Hide its ${own.length === 1 ? "prompt" : `${own.length} prompts`}` : `Show its ${own.length === 1 ? "prompt" : `${own.length} prompts`}`}
                    </TextButton>
                  </span>
                  {open ? own.map((grand) => <InnerCard key={grand.id} step={grand} nested />) : null}
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
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, paddingTop: 8 }}>
        <UsesRow step={step} props={props} />
      </div>
    </div>
  );
}

function ManualCard({ step, props }: { step: Step; props: BuildListProps }) {
  return (
    <div
      role="group"
      aria-label={`Manual step ${step.number}: ${stepTitle(step)}`}
      data-testid="step-card"
      tabIndex={0}
      onClick={() => props.onSelect(step.id)}
      style={{ borderRadius: 14, border: `1px solid ${props.selectedId === step.id ? "transparent" : t.line}`, boxShadow: props.selectedId === step.id ? `0 0 0 2px ${t.text}` : "none", background: t.solid, marginBottom: 8, padding: "10px 14px", outline: "none", cursor: "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Badge>{step.number}</Badge>
        <div style={{ minWidth: 0 }}>
          <div style={mono(12)}>Manual step{step.tool ? ` · ${step.tool}` : ""}</div>
          <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, lineHeight: 1.5, color: t.text }}>{step.text}</p>
        </div>
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
      style={{ cursor: "pointer", outline: selected ? `2px solid ${t.text}` : undefined, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, border: `1px solid ${t.line}`, background: t.solid, marginBottom: 8 }}>
      <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 7, background: t.evidenceFill, color: t.onEvidenceFill, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Check size={14} strokeWidth={2} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={mono(12)}>Result</div>
        <div style={{ fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text, overflowWrap: "anywhere" }}>{result.title}</div>
        <div style={mono(12)}>
          {result.holds}
          {result.from ? ` · from prompt ${result.from}` : ""}
        </div>
      </div>
    </div>
  );
}

/* ── the add field ── */

function PickMenu({
  label,
  value,
  options,
  onChange,
  none,
  phone,
}: {
  label: string;
  value: string | null;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | null) => void;
  none: string;
  phone: boolean;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button
          type="button"
          {...handlers}
          style={{ height: phone ? 44 : 26, padding: "0 8px", display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 8, border: `1px solid ${t.line}`, background: "transparent", color: t.text2, ...mono(11.5), cursor: "pointer", ...ring(state.focusVisible) }}
        >
          {label}
          <ChevronDown size={12} aria-hidden="true" />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={4} style={menuSurface}>
          <Menu.RadioGroup value={value ?? ""} onValueChange={(next) => onChange(next || null)}>
            {[{ value: "", label: none }, ...options].map((option) => (
              <Menu.RadioItem
                key={option.value || "none"}
                value={option.value}
                style={{ display: "flex", alignItems: "center", gap: 6, minHeight: phone ? 44 : 32, padding: "0 10px", borderRadius: r.control, fontFamily: FIGTREE, fontSize: 13.5, color: t.text, outline: "none", cursor: "pointer" }}
              >
                <span style={{ width: 14 }}>
                  <Menu.ItemIndicator>
                    <Check size={13} aria-hidden="true" />
                  </Menu.ItemIndicator>
                </span>
                {option.label}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function AddPrompt({ phone, onAddPrompt, focusAdd }: Pick<BuildListProps, "phone" | "onAddPrompt" | "focusAdd">) {
  const [text, setText] = useState("");
  const [tool, setTool] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusAdd > 0) field.current?.focus();
  }, [focusAdd]);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const saved = await onAddPrompt({ text, tool, model });
    setBusy(false);
    if (saved) setText("");
  };

  const toolLabel = TOOL_CLIENTS.find((entry) => entry.client === tool)?.label;
  return (
    <div data-testid="add-prompt" style={{ borderRadius: 14, border: `1px solid ${t.line}`, background: t.field, padding: "12px 12px 10px 14px" }}>
      <textarea
        ref={field}
        aria-label="Add a prompt"
        rows={2}
        value={text}
        placeholder={LIST_COPY.placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void submit();
          }
        }}
        style={{ width: "100%", boxSizing: "border-box", resize: "none", border: "none", background: "transparent", outline: "none", color: t.text, fontFamily: FIGTREE, fontSize: phone ? 16 : 14, lineHeight: 1.5, padding: 0 }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
        <PickMenu
          label={`Typed here · ${toolLabel ?? "pick a tool"}`}
          value={tool}
          options={TOOL_CLIENTS.map((entry) => ({ value: entry.client, label: entry.label }))}
          onChange={setTool}
          none="No tool"
          phone={phone}
        />
        <PickMenu
          label={model ? `model ${model}` : "model"}
          value={model}
          options={MODEL_VERSIONS.map((version) => ({ value: version.name, label: version.name }))}
          onChange={setModel}
          none="No model"
          phone={phone}
        />
        <span style={{ marginLeft: "auto" }}>
          <IconButton icon={ArrowUp} label="Add prompt" size={phone ? 38 : 30} disabled={!text.trim() || busy} onClick={() => void submit()} />
        </span>
      </div>
    </div>
  );
}

/* ── the list ── */

export function BuildList(props: BuildListProps) {
  const { steps } = props;
  const prompts = steps.filter((step) => step.kind === "prompt");
  let seen = false;
  return (
    <div data-testid="build-list">
      <p style={{ ...mono(11.5), margin: "0 0 4px" }}>{LIST_COPY.hint}</p>
      {steps.map((step) => {
        const divider = props.dividers.get(step.number);
        const first = !seen;
        seen = true;
        const card =
          step.kind === "prompt" ? (
            <StepCard step={step} index={prompts.indexOf(step)} last={prompts.indexOf(step) === prompts.length - 1} props={props} />
          ) : step.kind === "manual" ? (
            <ManualCard step={step} props={props} />
          ) : (
            <ContainerCard step={step} props={props} />
          );
        return (
          <div key={step.id}>
            {divider ? <Divider session={divider} first={first} /> : null}
            {card}
          </div>
        );
      })}
      {props.results.map((result) => (
        <ResultCard key={result.id} result={result} selected={props.selectedId === result.id} onSelect={props.onSelect} />
      ))}
      <AddPrompt phone={props.phone} onAddPrompt={props.onAddPrompt} focusAdd={props.focusAdd} />
    </div>
  );
}

export default BuildList;
