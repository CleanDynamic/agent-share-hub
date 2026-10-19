/* UI-P93 — the Details panel in the refined look, as `design/reference/refined/{dusk,noon}/composer-list.html` draws
   it.

   UI-P99: THIS WAS THE REFINED FORK. The current view it forked is deleted and this took its name; what follows was written when both existed, so "the current look" below means the look that has been retired. `DetailsPanel` stays the current look; this takes its props (imported, not copied) and shows
   the same things for each kind of selection, in the same order, with the same fields, writes and accessible names.

   THE LOOK. An eyebrow ("Prompt 3"); the title 18/500 with the ghost `pencil` (Rename); for a prompt, its tool's real
   mark at 24 beside its two meta lines (12/18 `--text2`); the text in a well (13/21); Read all of it (secondary 26)
   and the word count; Uses and Goes into as hairline lists (a `larr` or `rarr` lead in `--label`, the title
   12.5/500, the meta 11.5 `--label`, a ghost 24 `x` to remove); Add an input as a 12.5/500 `--text2` text button with
   no icon. Fields are the well recipe; a chosen way of running is the selected recipe, never a colour. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { Pencil, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { hiddenModelName, pairCheck } from "@/lib/tools/modelRules";
import { toolName } from "@/lib/tools/registry";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { SELECTED } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { TextButton } from "./composeControls";
import {
  atOnce,
  firstRows,
  RUNS_CHOICES,
  type GoesRow,
  type InputOption,
  type UseRow,
  type ChecklistRow,
  type MakesRow,
} from "./detailsModel";
import { ToolMark } from "./refinedPieces";
import { ToolPicker } from "./ToolPicker";
import { bareButton, menuItem, menuSurface, text, tnum, wellField } from "./refinedStyles";
import { MADE_FILE_NAME_MAX, type AgentModel, type Runs, type Use } from "@/lib/build/graph";

import { AgentSetupFields, savedModels, setupReady, type AgentSetupValue } from "./AgentSetupFields";
import { ModelPicker } from "./ModelPicker";

export interface InputsView {
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
  /** The files it makes; empty for an agent's instructions. */
  makes: readonly MakesRow[];
}

/** Work done outside AI (UI-P70). It is never detected, and has no model and no text to copy. */
export interface ManualView extends InputsView {
  kind: "manual";
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
}

export interface FileView {
  kind: "file";
  id: string;
  name: string;
  from: string;
  size: string | null;
  canDownload: boolean;
  usedBy: readonly GoesRow[];
}

export interface ToolView {
  kind: "tool";
  id: string;
  service: string;
  scopes: string;
  usedBy: readonly GoesRow[];
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
}

export interface ResultView {
  kind: "result";
  id: string;
  summary: string;
  url: string;
  /** Pictures kept with the result. */
  pictures: readonly { id: string; name: string }[];
}

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

export type DetailsView = PromptView | ManualView | SessionView | FileView | ToolView | AgentView | ResultView | CodeView;

export interface DetailsHandlers {
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
  onManual?: (id: string, fields: { tool?: string; text?: string; media_id?: string | null }) => void;
  /** UI-P70: add or replace a manual step's picture. */
  onManualPicture?: (id: string, file: File) => void;
  /** UI-P69: write an agent's instructions. Absent, they are only shown. */
  onInstructions?: (id: string, text: string) => void;
  /** CA-02 P5: change what an agent ran in, its models or its tools. Absent: they are shown, not edited. */
  onAgentSetup?: (id: string, setup: { model: string; harness: string | null; models?: AgentModel[]; tools: string[] }) => void;
  onRemoveInside: (id: string) => void;
  onToggleSessionPrompt: (view: SessionView, row: ChecklistRow, on: boolean) => void;
  /** TF-13: give a session whose client names no tool its tool (null: none). Absent: the picker is not shown. */
  onSessionTool?: (sessionId: string, tool: string | null) => void;
  onDownload: (id: string) => void;
  onFields: (id: string, fields: Record<string, string | null>) => void;
  onAddPicture: (id: string, file: File) => void;
  onUseAsCover: (mediaId: string) => void;
  onSelect?: (id: string) => void;
}

export interface DetailsPanelProps extends DetailsHandlers {
  phone: boolean;
  view: DetailsView | null;
  /** The tools the build already uses, first in a manual step's tool picker. */
  inBuild?: readonly string[];
  /** TF-08: "Name a file it makes" in the List asks this step's Makes field to open; `at` changes each time. */
  focusMakes?: { id: string; at: number } | null;
}

export const MANUAL_DETAILS_COPY = { never: "Added by you · never detected" } as const;

export const DETAILS_COPY = {
  empty: "Select a prompt, session or file to see it here.",
} as const;

export const MAKES_COPY = {
  title: "Makes",
  add: "Name a file it makes",
  placeholder: "File name, such as brand-guide.md",
  taken: "This step already makes a file with that name.",
} as const;

/* ── small pieces ── */

const line = `1px solid ${t.hairlineModule}`;

const quiet = (extra: CSSProperties = {}): CSSProperties => text(11.5, 400, t.label, extra);

/** A list's head: its name 12.5/500 and its count, over a hairline. */
function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, paddingBottom: 8, borderBottom: line }}>
        <h3 style={{ ...text(12.5, 500, t.text), margin: 0 }}>{title}</h3>
        {typeof count === "number" ? <span style={{ ...quiet(), ...tnum }}>{count}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** A ghost 24 that removes one thing (44 on a phone). */
function RemoveButton({ label, phone, onClick }: { label: string; phone: boolean; onClick: () => void }) {
  const side = phone ? 44 : 24;
  return <IconButton icon={X} glyph="x" boxed={false} label={label} size={26} onClick={onClick} style={{ width: side, height: side, color: t.label }} />;
}

function Lead({ glyph }: { glyph: GlyphName }) {
  return (
    <span style={{ display: "inline-flex", color: t.label, flexShrink: 0 }}>
      <Glyph name={glyph} size={16} />
    </span>
  );
}

/** A row of a hairline list: at least 48 high (44 for a plain one), a hairline under it. */
const listRow = (minHeight = 48): CSSProperties => ({ display: "flex", alignItems: "center", gap: 12, minHeight, boxSizing: "border-box", padding: "6px 0", borderBottom: line, minWidth: 0 });

function ShowMore({ hidden, phone, onClick }: { hidden: number; phone: boolean; onClick: () => void }) {
  if (hidden <= 0) return null;
  return (
    <div style={{ paddingTop: 8 }}>
      <TextButton target={phone} onClick={onClick} style={text(12.5, 500, t.text2)}>
        Show {hidden} more
      </TextButton>
    </div>
  );
}

/** A row of key and value: a 90 label column, a hairline under it. */
function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "90px minmax(0, 1fr)", gap: 8, alignItems: "baseline", padding: "10px 0", borderBottom: line }}>
      <span style={quiet()}>{label}</span>
      <span style={{ ...text(12.5, 400, t.text), overflowWrap: "anywhere" }}>{children}</span>
    </div>
  );
}

/** A text field that hands its value over on blur or Enter and goes back on Esc. */
function CommitField({
  label,
  value,
  placeholder,
  max,
  phone,
  multiline = false,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  max?: number;
  phone: boolean;
  multiline?: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    if (draft.trim() !== value.trim()) onCommit(draft);
  };
  const { state, handlers } = useInteractive<HTMLInputElement & HTMLTextAreaElement>({ onBlur: commit });
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !multiline) {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") setDraft(value);
  };
  const style: CSSProperties = { ...wellField, padding: "7px 10px", minHeight: phone ? 44 : 32, fontSize: phone ? 16 : 13, ...ring(state.focusVisible) };
  const common = {
    "aria-label": label,
    value: draft,
    placeholder,
    maxLength: max,
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    onKeyDown,
    ...handlers,
  };
  return multiline ? <textarea rows={2} {...common} style={{ ...style, resize: "vertical", lineHeight: "21px" }} /> : <input type="text" {...common} style={style} />;
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={quiet()}>{label}</span>
      {children}
    </label>
  );
}

/** The eyebrow, the title 18/500 and the ghost `pencil` that renames it in place (Enter saves, Esc cancels). */
function Head({ eyebrow, children }: { eyebrow: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <Eyebrow as="p" style={{ margin: 0 }}>
        {eyebrow}
      </Eyebrow>
      {children}
    </div>
  );
}

const titleStyle = (quietTitle: boolean): CSSProperties => ({
  ...text(18, 500, quietTitle ? t.text2 : t.text),
  margin: 0,
  minWidth: 0,
  letterSpacing: "-0.015em",
  overflowWrap: "anywhere",
});

function Title({ id, title, fallback, editable, label, phone, onRename }: { id: string; title: string | null; fallback: string; editable: boolean; label: string; phone: boolean; onRename: (id: string, title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const finish = (save: boolean) => {
    setEditing(false);
    if (save && draft.trim() !== (title ?? "")) onRename(id, draft);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
      {editing ? (
        <input
          autoFocus
          aria-label={label}
          value={draft}
          maxLength={80}
          placeholder={fallback}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") finish(true);
            if (event.key === "Escape") finish(false);
          }}
          style={{ ...wellField, padding: "4px 8px", fontSize: phone ? 16 : 16, fontWeight: 500, minHeight: phone ? 44 : 32 }}
        />
      ) : (
        <h3 data-default-title={title ? undefined : "true"} style={titleStyle(!title)}>
          {title ?? fallback}
        </h3>
      )}
      {editable && !editing ? (
        <IconButton
          icon={Pencil}
          glyph="pencil"
          boxed={false}
          label="Rename"
          size={26}
          style={phone ? { width: 44, height: 44 } : undefined}
          onClick={() => {
            setDraft(title ?? "");
            setEditing(true);
          }}
        />
      ) : null}
    </div>
  );
}

/** "Read all of it", a secondary 26. */
function ReadAll({ phone, disabled, onClick }: { phone: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} disabled={disabled} onClick={onClick} style={phone ? undefined : { height: 26 }}>
      Read all of it
    </Button>
  );
}

/* ── inputs: Uses, Add an input, Goes into ── */

function AddInput({ id, options, phone, onAddUse, onAttach }: { id: string; options: readonly InputOption[]; phone: boolean } & Pick<DetailsHandlers, "onAddUse" | "onAttach">) {
  const [menuAll, setMenuAll] = useState(false);
  const menu = menuAll ? { visible: [...options], hidden: 0 } : firstRows(options);
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const disabled = options.length === 0 && !onAttach;
  return (
    <Menu.Root onOpenChange={(open) => !open && setMenuAll(false)}>
      <Menu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          {...handlers}
          style={{
            ...bareButton,
            height: phone ? 44 : 36,
            ...text(12.5, 500, state.hovered && !disabled ? t.text : t.text2),
            cursor: disabled ? "default" : "pointer",
            filter: disabled ? t.dimFilter : undefined,
            alignSelf: "flex-start",
            ...ring(state.focusVisible),
          }}
        >
          Add an input
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={6} style={{ ...menuSurface(260), maxHeight: 360, overflowY: "auto" }}>
          {onAttach ? (
            <Menu.Item onSelect={() => onAttach(id)} style={menuItem(true, phone)}>
              A file from your computer
            </Menu.Item>
          ) : null}
          {menu.visible.map((option) => (
            <Menu.Item key={option.key} onSelect={() => onAddUse(id, option.use)} style={{ ...menuItem(true, phone), flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 2, padding: "4px 10px" }}>
              <span style={text(12.5, 500, t.text)}>{option.label}</span>
              {option.sub ? <span style={quiet()}>{option.sub}</span> : null}
            </Menu.Item>
          ))}
          {menu.hidden > 0 ? (
            <Menu.Item
              onSelect={(event) => {
                event.preventDefault();
                setMenuAll(true);
              }}
              style={{ ...menuItem(true, phone), color: t.text2 }}
            >
              Show {menu.hidden} more
            </Menu.Item>
          ) : null}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function UseList({ id, rows, options, phone, onAddUse, onAttach, onRemoveUse }: { id: string; rows: readonly UseRow[]; options: readonly InputOption[]; phone: boolean } & Pick<DetailsHandlers, "onAddUse" | "onAttach" | "onRemoveUse">) {
  const [all, setAll] = useState(false);
  const shown = all ? { visible: [...rows], hidden: 0 } : firstRows(rows);
  return (
    <Section title="Uses" count={rows.length}>
      {shown.visible.map((row) => (
        <div key={`${row.use.kind}:${row.use.node_id}`} style={listRow()}>
          <Lead glyph="larr" />
          <span style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
            <span style={{ ...text(12.5, 500, t.text), overflowWrap: "anywhere" }}>{row.label}</span>
            {row.sub ? <span style={quiet()}>{row.sub}</span> : null}
          </span>
          <RemoveButton label={`Remove ${row.label}`} phone={phone} onClick={() => onRemoveUse(id, row.use)} />
        </div>
      ))}
      <ShowMore hidden={shown.hidden} phone={phone} onClick={() => setAll(true)} />
      <AddInput id={id} options={options} phone={phone} onAddUse={onAddUse} onAttach={onAttach} />
    </Section>
  );
}

function RowList({ title, rows, phone, glyph = "rarr", onSelect }: { title: string; rows: readonly GoesRow[]; phone: boolean; glyph?: GlyphName; onSelect?: (id: string) => void }) {
  const [all, setAll] = useState(false);
  if (rows.length === 0) return null;
  const shown = all ? { visible: [...rows], hidden: 0 } : firstRows(rows);
  return (
    <Section title={title} count={rows.length}>
      {shown.visible.map((row) => (
        <div key={row.id} style={{ ...listRow(44), borderBottom: "none" }}>
          <Lead glyph={glyph} />
          {onSelect && row.id !== "result" ? (
            <TextButton onClick={() => onSelect(row.id)} style={{ ...text(12.5, 500, t.text), textAlign: "left" }}>
              {row.label}
            </TextButton>
          ) : (
            <span style={text(12.5, 500, t.text)}>{row.label}</span>
          )}
        </div>
      ))}
      <ShowMore hidden={shown.hidden} phone={phone} onClick={() => setAll(true)} />
    </Section>
  );
}

/* ── Makes (TF-08): the files a step makes ── */

/** A made file's name, renamed in place: Enter or leaving saves, Esc goes back, and a blank name goes back too. */
function MadeName({ row, phone, onRename }: { row: MakesRow; phone: boolean; onRename: (id: string, name: string) => void }) {
  const [draft, setDraft] = useState(row.name);
  const commit = () => {
    const next = draft.trim();
    if (!next) setDraft(row.name);
    else if (next !== row.name) onRename(row.id, next);
  };
  const { state, handlers } = useInteractive<HTMLInputElement>({ onBlur: commit });
  return (
    <input
      type="text"
      aria-label={`Name of ${row.name}`}
      value={draft}
      maxLength={MADE_FILE_NAME_MAX}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") setDraft(row.name);
      }}
      {...handlers}
      style={{ ...wellField, flexGrow: 1, minWidth: 0, padding: "7px 10px", minHeight: phone ? 44 : 32, fontSize: phone ? 16 : 13, ...ring(state.focusVisible) }}
    />
  );
}

function MakesList({
  stepId,
  rows,
  phone,
  focus,
  onAdd,
  onRename,
  onRemove,
}: {
  stepId: string;
  rows: readonly MakesRow[];
  phone: boolean;
  focus: DetailsPanelProps["focusMakes"];
  onAdd: (stepId: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [taken, setTaken] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const button = useInteractive<HTMLButtonElement>();
  const shown = all ? { visible: [...rows], hidden: 0 } : firstRows(rows);

  /* The List's menu item opens the field, or puts the cursor back in it when it is open already. */
  const asked = focus && focus.id === stepId ? focus.at : 0;
  useEffect(() => {
    if (!asked) return;
    setAdding(true);
    field.current?.focus();
  }, [asked]);

  const close = () => {
    setAdding(false);
    setDraft("");
    setTaken(false);
  };
  const submit = () => {
    const name = draft.trim();
    if (!name) return;
    if (rows.some((row) => row.name.trim().toLowerCase() === name.toLowerCase())) {
      setTaken(true);
      return;
    }
    onAdd(stepId, name);
    close();
  };

  return (
    <Section title={MAKES_COPY.title} count={rows.length}>
      {shown.visible.map((row) => (
        <div key={row.id} style={listRow()}>
          <MadeName key={row.name} row={row} phone={phone} onRename={onRename} />
          <RemoveButton label={`Remove ${row.name}`} phone={phone} onClick={() => onRemove(row.id)} />
        </div>
      ))}
      <ShowMore hidden={shown.hidden} phone={phone} onClick={() => setAll(true)} />
      {adding ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 }}>
          <input
            ref={field}
            autoFocus
            type="text"
            aria-label={MAKES_COPY.add}
            placeholder={MAKES_COPY.placeholder}
            value={draft}
            maxLength={MADE_FILE_NAME_MAX}
            onChange={(event) => {
              setDraft(event.target.value);
              setTaken(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
              if (event.key === "Escape") {
                event.stopPropagation();
                close();
              }
            }}
            onBlur={() => {
              if (!draft.trim()) close();
            }}
            style={{ ...wellField, padding: "7px 10px", minHeight: phone ? 44 : 32, fontSize: phone ? 16 : 13 }}
          />
          {taken ? <span style={quiet()}>{MAKES_COPY.taken}</span> : null}
        </div>
      ) : (
        <button
          type="button"
          {...button.handlers}
          onClick={() => setAdding(true)}
          style={{
            ...bareButton,
            height: phone ? 44 : 36,
            ...text(12.5, 500, button.state.hovered ? t.text : t.text2),
            cursor: "pointer",
            alignSelf: "flex-start",
            ...ring(button.state.focusVisible),
          }}
        >
          {MAKES_COPY.add}
        </button>
      )}
    </Section>
  );
}

/* ── a saved pair that breaks the rules (CA-02 P8) ── */

export const PAIR_COPY = {
  notOffered: (tool: string, model: string) => `${tool} doesn't offer ${model}.`,
  runsNoModel: (tool: string) => `${tool} doesn't run a model.`,
  hidesModel: (tool: string) => `${tool} doesn't show which model it used.`,
  change: "Change the model",
  remove: "Remove the model",
} as const;

/**
 * One quiet line and one text button, for a tool and model saved together that the tool's rules do not allow. Only
 * the maker sees Details, so only the maker sees it; nothing changes until they press the button. An unknown tool
 * or model says nothing.
 */
function PairNote({ tool, model, phone, onChange, onRemove }: { tool: string | null | undefined; model: string | null | undefined; phone: boolean; onChange: () => void; onRemove: () => void }) {
  const check = pairCheck(tool, model);
  if (check !== "not-offered" && check !== "tool-runs-no-model" && check !== "tool-hides-model") return null;
  const name = toolName(tool) ?? (tool ?? "").trim();
  const line = check === "not-offered" ? PAIR_COPY.notOffered(name, (model ?? "").trim()) : check === "tool-runs-no-model" ? PAIR_COPY.runsNoModel(name) : PAIR_COPY.hidesModel(name);
  return (
    <div data-testid="pair-note" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <span style={text(12, 400, t.text2)}>{line}</span>
      <TextButton target={phone} underline style={text(12, 500, t.text)} onClick={check === "not-offered" ? onChange : onRemove}>
        {check === "not-offered" ? PAIR_COPY.change : PAIR_COPY.remove}
      </TextButton>
    </div>
  );
}

/* ── a prompt ── */

/** The tool, from the session line: "Session 2 · Claude Code" and "Typed here · ChatGPT" both end in it. */
const toolOf = (sessionLine: string): string => sessionLine.split(" · ").pop() ?? "";

/** The Makes list of a step; only where the panel can write it. */
function Makes({ id, rows, phone, focus, h }: { id: string; rows: readonly MakesRow[]; phone: boolean; focus: DetailsPanelProps["focusMakes"]; h: DetailsHandlers }) {
  if (!h.onAddMade) return null;
  return <MakesList stepId={id} rows={rows} phone={phone} focus={focus} onAdd={h.onAddMade} onRename={(fileId, name) => h.onFields(fileId, { title: name })} onRemove={(fileId) => h.onRemoveMade?.(fileId)} />;
}

function PromptDetails({ view, phone, focus, ...h }: { view: PromptView; phone: boolean; focus: DetailsPanelProps["focusMakes"] } & DetailsHandlers) {
  const open = h.onOpenPrompt ? () => h.onOpenPrompt?.(view.id) : undefined;
  /** CA-02 P8: "Change the model" opens the model menu. */
  const [openModel, setOpenModel] = useState(0);
  return (
    <>
      <Head eyebrow={`Prompt ${view.number}`}>
        <Title id={view.id} title={view.title} fallback={view.defaultTitle} editable={view.editable} label={`Title of prompt ${view.number}`} phone={phone} onRename={h.onRename} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <ToolMark tool={toolOf(view.sessionLine)} model={view.model} size={24} />
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ ...text(12, 400, t.text2), lineHeight: "18px" }}>{view.sessionLine}</span>
            {view.detailLine ? <span style={{ ...text(12, 400, t.text2), lineHeight: "18px" }}>{view.detailLine}</span> : null}
          </span>
        </div>
      </Head>
      {view.typed ? (
        /* CA-02 P8: the menu follows the prompt's tool, as Typed here's does. A group, not a label: a label would name
           the menu's button and the note's button after itself. */
        <div role="group" aria-label="Model" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={quiet()}>Model</span>
          <div>
            <ModelPicker tool={view.tool ?? null} value={view.model} onChange={(model) => h.onModel(view.id, model)} phone={phone} name="Model" openSignal={openModel} anyWithoutTool />
          </div>
          {!view.model ? <span style={quiet()}>Model is empty because there is no session to read it from.</span> : null}
          <PairNote tool={view.tool} model={view.model} phone={phone} onChange={() => setOpenModel((n) => n + 1)} onRemove={() => h.onModel(view.id, null)} />
        </div>
      ) : null}
      <div style={{ ...wellField, padding: 12 }}>
        <p style={{ ...text(13, 400, t.text), lineHeight: "21px", margin: 0, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {view.text}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ReadAll phone={phone} disabled={!open} onClick={() => open?.()} />
        <span style={{ flexGrow: 1 }} />
        <span style={{ ...quiet(), ...tnum }}>{view.words} words</span>
      </div>
      <UseList id={view.id} rows={view.uses} options={view.options} phone={phone} onAddUse={h.onAddUse} onAttach={h.onAttach} onRemoveUse={h.onRemoveUse} />
      {view.editable ? <Makes id={view.id} rows={view.makes} phone={phone} focus={focus} h={h} /> : null}
      <RowList title="Goes into" rows={view.goesInto} phone={phone} onSelect={h.onSelect} />
    </>
  );
}

/* ── a manual step (UI-P70) ── */

function ManualDetails({ view, phone, inBuild = [], focus, ...h }: { view: ManualView; phone: boolean; inBuild?: readonly string[]; focus: DetailsPanelProps["focusMakes"] } & DetailsHandlers) {
  const picker = useRef<HTMLInputElement>(null);
  const commit = (fields: { tool?: string; text?: string }) => {
    // Both are required: a blank value goes back to what was there.
    if (Object.values(fields).some((value) => !value?.trim())) return;
    h.onManual?.(view.id, fields);
  };
  return (
    <>
      <Head eyebrow={`Manual step ${view.number}`}>
        <Title id={view.id} title={view.title} fallback={view.defaultTitle} editable label={`Title of manual step ${view.number}`} phone={phone} onRename={h.onRename} />
        <span style={text(12, 400, t.text2)}>{MANUAL_DETAILS_COPY.never}</span>
      </Head>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
        <span style={quiet()}>Tool</span>
        <ToolPicker key={`${view.id}:tool`} label="Tool" value={view.tool} inBuild={inBuild} phone={phone} step="manual" onChange={(value) => commit({ tool: value ?? "" })} />
      </div>
      <FieldBlock label="What was done">
        <CommitField key={`${view.id}:text`} label="What was done" value={view.text} max={140} multiline phone={phone} onCommit={(value) => commit({ text: value })} />
      </FieldBlock>
      <Section title="Picture" count={view.picture ? 1 : 0}>
        {view.picture ? (
          <div style={listRow(44)}>
            <span style={{ ...text(12.5, 500, t.text), flexGrow: 1, minWidth: 0, overflowWrap: "anywhere" }}>{view.picture.name}</span>
            <RemoveButton label="Remove the picture" phone={phone} onClick={() => h.onManual?.(view.id, { media_id: null })} />
          </div>
        ) : null}
        <input
          ref={picker}
          type="file"
          accept="image/*"
          hidden
          data-testid="details-manual-picture"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) h.onManualPicture?.(view.id, file);
          }}
        />
        <div style={{ paddingTop: 8 }}>
          <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={() => picker.current?.click()}>
            {view.picture ? "Replace the picture" : "Add a picture"}
          </Button>
        </div>
      </Section>
      <UseList id={view.id} rows={view.uses} options={view.options} phone={phone} onAddUse={h.onAddUse} onAttach={h.onAttach} onRemoveUse={h.onRemoveUse} />
      <Makes id={view.id} rows={view.makes} phone={phone} focus={focus} h={h} />
      <RowList title="Goes into" rows={view.goesInto} phone={phone} onSelect={h.onSelect} />
    </>
  );
}

/* ── code (CA-02 P7) ── */

export const CODE_DETAILS_COPY = {
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Couldn't copy that. Select the code and copy it by hand.",
  writtenWith: "Written with",
} as const;

function CodeDetails({ view, phone, focus, ...h }: { view: CodeView; phone: boolean; focus: DetailsPanelProps["focusMakes"] } & DetailsHandlers) {
  const [said, setSaid] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(view.source);
      setSaid(CODE_DETAILS_COPY.copied);
    } catch {
      setSaid(CODE_DETAILS_COPY.copyFailed);
    }
  };
  const written = [view.tool, view.model].filter(Boolean).join(" · ");
  return (
    <>
      <Head eyebrow={`Code ${view.number}`}>
        <Title id={view.id} title={view.title} fallback={view.defaultTitle} editable label={`Title of code ${view.number}`} phone={phone} onRename={h.onRename} />
        <span style={text(12, 400, t.text2)}>{[view.filename, view.language, `${view.lines} ${view.lines === 1 ? "line" : "lines"}`].filter(Boolean).join(" · ")}</span>
      </Head>
      {written ? (
        <div>
          <KeyValue label={CODE_DETAILS_COPY.writtenWith}>{written}</KeyValue>
        </div>
      ) : null}
      <pre
        data-testid="details-code"
        style={{ ...wellField, margin: 0, padding: 12, fontFamily: DM_MONO, fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre", overflowX: "auto", maxHeight: 480, overflowY: "auto" }}
      >
        {view.source}
      </pre>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={() => void copy()} style={phone ? undefined : { height: 26 }}>
          {CODE_DETAILS_COPY.copy}
        </Button>
        <span aria-live="polite" style={quiet()}>
          {said}
        </span>
      </div>
      <UseList id={view.id} rows={view.uses} options={view.options} phone={phone} onAddUse={h.onAddUse} onAttach={h.onAttach} onRemoveUse={h.onRemoveUse} />
      <Makes id={view.id} rows={view.makes} phone={phone} focus={focus} h={h} />
      <RowList title="Goes into" rows={view.goesInto} phone={phone} onSelect={h.onSelect} />
    </>
  );
}

/* ── a session ── */

function SessionDetails({ view, phone, inBuild, onToggleSessionPrompt, onSessionTool }: { view: SessionView; phone: boolean; inBuild: readonly string[] } & Pick<DetailsHandlers, "onToggleSessionPrompt" | "onSessionTool">) {
  const [all, setAll] = useState(false);
  const shown = all ? { visible: [...view.checklist], hidden: 0 } : firstRows(view.checklist);
  return (
    <>
      <Head eyebrow="Session">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ToolMark tool={view.tool} model={view.model} size={24} />
          <h3 style={titleStyle(false)}>Session {view.number}</h3>
        </div>
      </Head>
      <div>
        <KeyValue label="Tool">{view.tool}</KeyValue>
        {view.pickTool && onSessionTool ? (
          <div style={{ padding: "10px 0", borderBottom: line }}>
            <ToolPicker key={`${view.key}:tool`} label="Pick its tool" value={view.pickTool.value} inBuild={inBuild} allowNone phone={phone} step="session" onChange={(value) => onSessionTool(view.key, value)} />
          </div>
        ) : null}
        <KeyValue label="Model">{view.model || "Not named"}</KeyValue>
        <KeyValue label="Date">{view.date || "Typed here"}</KeyValue>
      </div>
      <Section title="Prompts in the build">
        <span style={{ ...quiet(), ...tnum, paddingTop: 8 }}>{view.total === null ? `${view.inBuild}` : `${view.inBuild} of ${view.total}`}</span>
        {view.status === "loading" ? <p style={{ ...quiet(), margin: "8px 0 0" }}>Loading this session's prompts…</p> : null}
        {view.status === "error" ? <p style={{ ...quiet(), margin: "8px 0 0" }}>This session's prompts did not load.</p> : null}
        <div role="group" aria-label="Prompts in this session">
          {shown.visible.map((row) => (
            <label key={row.ordinal} style={{ ...listRow(phone ? 44 : 40), cursor: "pointer" }}>
              <input type="checkbox" checked={row.stepId !== null} onChange={(event) => onToggleSessionPrompt(view, row, event.target.checked)} style={{ margin: 0, width: 16, height: 16, flexShrink: 0 }} />
              <span style={{ ...text(12.5, 400, t.text), overflowWrap: "anywhere" }}>{row.label}</span>
            </label>
          ))}
        </div>
        <ShowMore hidden={shown.hidden} phone={phone} onClick={() => setAll(true)} />
      </Section>
    </>
  );
}

/* ── a file, a tool ── */

function FileDetails({ view, phone, onDownload, onSelect }: { view: FileView; phone: boolean } & Pick<DetailsHandlers, "onDownload" | "onSelect">) {
  return (
    <>
      <Head eyebrow="File">
        <h3 style={titleStyle(false)}>{view.name}</h3>
      </Head>
      <div>
        <KeyValue label="From">{view.from}</KeyValue>
        {view.size ? <KeyValue label="Size">{view.size}</KeyValue> : null}
      </div>
      {view.canDownload ? (
        <div>
          <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={() => onDownload(view.id)} style={phone ? undefined : { height: 26 }}>
            Download
          </Button>
        </div>
      ) : null}
      <RowList title="Used by" rows={view.usedBy} phone={phone} onSelect={onSelect} />
    </>
  );
}

function ToolDetails({ view, phone, onFields, onSelect }: { view: ToolView; phone: boolean } & Pick<DetailsHandlers, "onFields" | "onSelect">) {
  return (
    <>
      <Head eyebrow="Tool" />
      <FieldBlock label="Service">
        <CommitField key={`${view.id}:service`} label="Service" value={view.service} phone={phone} max={80} onCommit={(value) => onFields(view.id, { service: value })} />
      </FieldBlock>
      <FieldBlock label="What it was used for">
        <CommitField key={`${view.id}:scopes`} label="What it was used for" value={view.scopes} placeholder="read, label, draft" phone={phone} max={140} onCommit={(value) => onFields(view.id, { scopes: value })} />
      </FieldBlock>
      <RowList title="Used by" rows={view.usedBy} phone={phone} onSelect={onSelect} />
    </>
  );
}

/* ── an agent or a team ── */

function RunsGroup({ view, phone, onRuns }: { view: AgentView; phone: boolean } & Pick<DetailsHandlers, "onRuns">) {
  const how = view.runs?.how ?? "once";
  const choice = RUNS_CHOICES.find((entry) => entry.how === how) ?? RUNS_CHOICES[0];
  const name = `runs-${view.id}`;
  const field = choice.field;
  const [count, setCount] = useState(view.runs?.count ?? 2);
  const [detail, setDetail] = useState(view.runs?.detail ?? "");

  const pick = (next: (typeof RUNS_CHOICES)[number]) => {
    if (next.how === "once") onRuns(view.id, null);
    else if (next.how === "parallel") onRuns(view.id, { how: "parallel", count: view.runs?.count ?? count });
    else onRuns(view.id, { how: next.how, detail: how === next.how ? detail : "" });
  };

  return (
    <Section title="How it runs">
      <div role="radiogroup" aria-label="How it runs" style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 8 }}>
        {RUNS_CHOICES.map((entry) => {
          const chosen = entry.how === how;
          const label = entry.how === "once" && view.parent ? `${entry.label} · each time work is sent to it` : entry.label;
          return (
            <label
              key={entry.how}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: phone ? 44 : 32,
                padding: "0 8px",
                boxSizing: "border-box",
                borderRadius: 6,
                border: "1px solid transparent",
                ...(chosen ? SELECTED : null),
                cursor: "pointer",
                ...text(12.5, chosen ? 500 : 400, chosen ? t.text : t.text2),
              }}
            >
              <input type="radio" name={name} checked={chosen} onChange={() => pick(entry)} style={{ margin: 0 }} />
              {label}
            </label>
          );
        })}
      </div>
      {field?.kind === "count" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8 }}>
          <input
            type="number"
            aria-label={field.label}
            min={field.min}
            max={field.max}
            step={1}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            onBlur={() => {
              const next = Math.min(field.max, Math.max(field.min, Math.round(Number.isFinite(count) ? count : field.min)));
              setCount(next);
              if (next !== view.runs?.count) onRuns(view.id, { how: "parallel", count: next });
            }}
            style={{ ...wellField, width: 72, padding: "6px 8px", minHeight: phone ? 44 : 32, fontSize: phone ? 16 : 13 }}
          />
          <span style={quiet()}>{atOnce(Math.min(field.max, Math.max(field.min, Number.isFinite(count) ? count : field.min)))}</span>
        </div>
      ) : null}
      {field?.kind === "text" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 }}>
          <input
            type="text"
            aria-label={field.label}
            maxLength={field.max}
            placeholder={field.placeholder}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            onBlur={() => {
              if (detail.trim() !== (view.runs?.detail ?? "")) onRuns(view.id, { how, detail: detail.trim() });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") (event.target as HTMLInputElement).blur();
            }}
            style={{ ...wellField, padding: "7px 10px", minHeight: phone ? 44 : 32, fontSize: phone ? 16 : 13 }}
          />
          <span style={{ ...quiet(), ...tnum }}>
            {detail.length} / {field.max}
          </span>
        </div>
      ) : null}
    </Section>
  );
}

/** CA-02 P5: an agent's Runs in, Models and Tools, written as they change once every model is named. */
function AgentSetupBlock({ id, initial, phone, inBuild, onAgentSetup }: { id: string; initial: AgentSetupValue; phone: boolean; inBuild: readonly string[]; onAgentSetup: NonNullable<DetailsHandlers["onAgentSetup"]> }) {
  const [value, setValue] = useState(initial);
  const [openModel, setOpenModel] = useState(0);
  const change = (next: AgentSetupValue) => {
    setValue(next);
    if (setupReady(next)) onAgentSetup(id, { ...savedModels(next), harness: next.harness, tools: next.tools });
  };
  const main = value.models[0]?.model ?? null;
  return (
    <>
      <PairNote
        tool={value.harness}
        model={main}
        phone={phone}
        onChange={() => setOpenModel((n) => n + 1)}
        // An agent always names a model: the harness's own name stands in for one it does not show or run.
        onRemove={() => {
          const own = hiddenModelName(value.harness) ?? toolName(value.harness) ?? value.harness;
          if (own) change({ ...value, models: [{ model: own, role: "main" }, ...value.models.slice(1)] });
        }}
      />
      <AgentSetupFields value={value} phone={phone} inBuild={inBuild} onChange={change} openMainModel={openModel} />
    </>
  );
}

/** An agent's setup as read-only lines, where the panel cannot write it. */
function AgentSetupLines({ setup }: { setup: AgentSetupValue }) {
  return (
    <div>
      <KeyValue label="Runs in">{setup.harness ?? "My own code (API)"}</KeyValue>
      {setup.models.map((row, index) => (
        <KeyValue key={index} label={index === 0 ? "Model" : `Model ${index + 1}`}>{`${row.model ?? ""} · ${row.role}`}</KeyValue>
      ))}
      {setup.tools.length ? <KeyValue label="Tools it can use">{setup.tools.join(" · ")}</KeyValue> : null}
    </div>
  );
}

function AgentDetails({ view, phone, inBuild = [], ...h }: { view: AgentView; phone: boolean; inBuild?: readonly string[] } & DetailsHandlers) {
  const word = view.kind === "agent" ? "Agent" : "Team";
  return (
    <>
      <Head eyebrow={`${word} ${view.number}`}>
        <Title id={view.id} title={view.name} fallback={view.defaultName} editable={false} label={`${word} name`} phone={phone} onRename={h.onRename} />
      </Head>
      <FieldBlock label="Name">
        <CommitField key={`${view.id}:name`} label="Name" value={view.name ?? ""} placeholder={view.defaultName} max={80} phone={phone} onCommit={(value) => h.onRename(view.id, value)} />
      </FieldBlock>
      {(view.model && !view.setup) || view.parent ? (
        <div>
          {view.parent ? <KeyValue label="In">{view.parent}</KeyValue> : null}
          {view.model && !view.setup ? <KeyValue label="Model">{view.model}</KeyValue> : null}
        </div>
      ) : null}
      {view.setup ? (
        h.onAgentSetup ? (
          <AgentSetupBlock key={view.id} id={view.id} initial={view.setup} phone={phone} inBuild={inBuild} onAgentSetup={h.onAgentSetup} />
        ) : (
          <AgentSetupLines setup={view.setup} />
        )
      ) : null}
      {view.kind === "agent" ? (
        <FieldBlock label="Instructions">
          {h.onInstructions ? (
            <CommitField key={`${view.id}:instructions`} label="Instructions" value={view.instructions} placeholder="What this agent is told" multiline phone={phone} onCommit={(value) => h.onInstructions?.(view.id, value)} />
          ) : (
            <p style={{ ...wellField, padding: 12, margin: 0, lineHeight: "21px", fontSize: 13, overflowWrap: "anywhere" }}>{view.instructions}</p>
          )}
        </FieldBlock>
      ) : null}
      <RunsGroup view={view} phone={phone} onRuns={h.onRuns} />
      <Section title={`Inside ${view.inside}`}>
        {view.insideRows.map((row) => (
          <div key={row.id} style={listRow(44)}>
            <span style={{ ...text(12.5, 500, t.text), flexGrow: 1, minWidth: 0, overflowWrap: "anywhere" }}>{row.label}</span>
            <RemoveButton label={`Remove ${row.label}`} phone={phone} onClick={() => h.onRemoveInside(row.id)} />
          </div>
        ))}
      </Section>
      <UseList id={view.id} rows={view.uses} options={view.options} phone={phone} onAddUse={h.onAddUse} onAttach={h.onAttach} onRemoveUse={h.onRemoveUse} />
      <RowList title="Goes into" rows={view.goesInto} phone={phone} onSelect={h.onSelect} />
    </>
  );
}

/* ── a result ── */

function ResultDetails({ view, phone, onFields, onAddPicture, onUseAsCover }: { view: ResultView; phone: boolean } & Pick<DetailsHandlers, "onFields" | "onAddPicture" | "onUseAsCover">) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <>
      <Head eyebrow="Result" />
      <FieldBlock label="Summary">
        <CommitField key={`${view.id}:summary`} label="Summary" value={view.summary} phone={phone} multiline max={200} onCommit={(value) => onFields(view.id, { summary: value })} />
      </FieldBlock>
      <FieldBlock label="Link">
        <CommitField key={`${view.id}:url`} label="Link" value={view.url} placeholder="https://" phone={phone} max={300} onCommit={(value) => onFields(view.id, { url: value })} />
      </FieldBlock>
      <Section title="Pictures" count={view.pictures.length}>
        {view.pictures.map((picture) => (
          <div key={picture.id} style={listRow(44)}>
            <span style={{ ...text(12.5, 500, t.text), flexGrow: 1, minWidth: 0, overflowWrap: "anywhere" }}>{picture.name}</span>
            <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={() => onUseAsCover(picture.id)} style={phone ? undefined : { height: 26 }}>
              Use as cover
            </Button>
          </div>
        ))}
        <input
          ref={picker}
          type="file"
          accept="image/*"
          hidden
          data-testid="details-picture"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onAddPicture(view.id, file);
          }}
        />
        <div style={{ paddingTop: 8 }}>
          <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={() => picker.current?.click()}>
            Add a picture
          </Button>
        </div>
      </Section>
    </>
  );
}

/* ── the panel ── */

/* The global field rule makes a field inherit its size on a desktop, so the panel sets the fields' 13 here. */
export function DetailsPanel({ view, phone, inBuild, focusMakes = null, ...h }: DetailsPanelProps) {
  if (!view) return <p style={{ ...text(13, 400, t.text2), margin: 0 }}>{DETAILS_COPY.empty}</p>;
  return (
    <div data-testid="details-panel" data-kind={view.kind} style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0, fontSize: 13 }}>
      {view.kind === "prompt" ? <PromptDetails key={view.id} view={view} phone={phone} focus={focusMakes} {...h} /> : null}
      {view.kind === "manual" ? <ManualDetails key={view.id} view={view} phone={phone} inBuild={inBuild} focus={focusMakes} {...h} /> : null}
      {view.kind === "code" ? <CodeDetails key={view.id} view={view} phone={phone} focus={focusMakes} {...h} /> : null}
      {view.kind === "session" ? <SessionDetails key={view.key} view={view} phone={phone} inBuild={inBuild ?? []} onToggleSessionPrompt={h.onToggleSessionPrompt} onSessionTool={h.onSessionTool} /> : null}
      {view.kind === "file" ? <FileDetails key={view.id} view={view} phone={phone} onDownload={h.onDownload} onSelect={h.onSelect} /> : null}
      {view.kind === "tool" ? <ToolDetails key={view.id} view={view} phone={phone} onFields={h.onFields} onSelect={h.onSelect} /> : null}
      {view.kind === "agent" || view.kind === "team" ? <AgentDetails key={view.id} view={view} phone={phone} inBuild={inBuild} {...h} /> : null}
      {view.kind === "result" ? <ResultDetails key={view.id} view={view} phone={phone} onFields={h.onFields} onAddPicture={h.onAddPicture} onUseAsCover={h.onUseAsCover} /> : null}
    </div>
  );
}

export default DetailsPanel;
