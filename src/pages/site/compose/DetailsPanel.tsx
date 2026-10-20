/* UI-P93 — the Details panel in the refined look, as `design/reference/refined/{dusk,noon}/composer-list.html` draws
   it.

   UI-P99: THIS WAS THE REFINED FORK. The current view it forked is deleted and this took its name; what follows was written when both existed, so "the current look" below means the look that has been retired. `DetailsPanel` stays the current look; this takes its props (imported, not copied) and shows
   the same things for each kind of selection, in the same order, with the same fields, writes and accessible names.

   THE LOOK. An eyebrow ("Prompt 3"); the title 18/500 with the ghost `pencil` (Rename); for a prompt, its tool's real
   mark at 24 beside its two meta lines (12/18 `--text2`); the text in a well (13/21); Read all of it (secondary 26)
   and the word count; Uses and Goes into as hairline lists (a `larr` or `rarr` lead in `--label`, the title
   12.5/500, the meta 11.5 `--label`, a ghost 24 `x` to remove); Add an input as a 12.5/500 `--text2` text button with
   no icon. Fields are the well recipe; a chosen way of running is the selected recipe, never a colour.

   CA-03 P2: the eyebrow is the board's (Geist 10.5/500 `--label`, capitals, .06em: `EYEBROW`); every field label is
   the composer's (13/500, 6 above its control); a label and its value read label over value (12 `--text2` over 13
   `--text`, a hairline between pairs); How it runs is a list of choice rows; a session's prompts tick with the brand
   checkbox; fields you type in are 30 high. 16 between groups, 6 between a label and its control, 8 in a row. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { Pencil, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { Checkbox } from "@/components/brand/Checkbox";
import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { Segmented } from "@/components/brand/Segmented";
import { harnessTool, hiddenModelName, modelMenu, pairCheck } from "@/lib/tools/modelRules";
import { toolName } from "@/lib/tools/registry";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { ChoiceRows } from "./ChoiceRows";
import { CodeStepDialog } from "./CodeStepDialog";
import { FIELD_LABEL, TextButton } from "./composeControls";
import {
  atOnce,
  firstRows,
  isClockTime,
  RUNS_CHOICES,
  RUNS_COPY,
  SCHEDULE_PRESETS,
  scheduleDetail,
  scheduleParts,
  type RunsChoice,
  type GoesRow,
  type InputOption,
  type UseRow,
  type ChecklistRow,
  type MakesRow,
} from "./detailsModel";
import { OutsideWarning } from "./OutsideWarning";
import { CheckBlock, ToolMark } from "./refinedPieces";
import { ToolPicker } from "./ToolPicker";
import { bareButton, EYEBROW, menuItem, menuSurface, text, tnum, typedArea, typedField, wellField } from "./refinedStyles";
import { AT_MOST_MAX, AT_MOST_MIN, MADE_FILE_NAME_MAX, type CheckFacts, UNTIL_DETAIL_MAX, untilDetail, untilParts, type AgentModel, type Runs, type Use } from "@/lib/build/graph";

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
  /** CA-03 P7, an agent only: the tools it can use that read content it doesn't control. */
  outside?: readonly string[];
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

/** CA-03 P5: how the build checked its work. */
export interface CheckView extends InputsView {
  kind: "check";
  id: string;
  number: string;
  title: string | null;
  defaultTitle: string;
  check: CheckFacts;
}

export type DetailsView = PromptView | ManualView | SessionView | FileView | ToolView | AgentView | ResultView | CodeView | CheckView;

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
  onAgentSetup?: (id: string, setup: { model: string; harness: string | null; models?: AgentModel[]; tools: string[]; memory?: string }) => void;
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

/** A label and its value (CA-03): the label 12 `--text2` over the value 13 `--text`, a hairline under the pair. */
function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div data-testid="label-value" style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 0", borderBottom: line, minWidth: 0 }}>
      <span style={text(12, 400, t.text2)}>{label}</span>
      <span style={{ ...text(13, 400, t.text), overflowWrap: "anywhere" }}>{children}</span>
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
  const style: CSSProperties = multiline ? typedArea(phone, ring(state.focusVisible)) : typedField(phone, ring(state.focusVisible));
  const common = {
    "aria-label": label,
    value: draft,
    placeholder,
    maxLength: max,
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    onKeyDown,
    ...handlers,
  };
  return multiline ? <textarea rows={2} {...common} style={style} /> : <input type="text" {...common} style={style} />;
}

/** A field label over its control: the composer's `Field` look, the label wrapping the control it names. */
function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={FIELD_LABEL}>{label}</span>
      {children}
    </label>
  );
}

/** The eyebrow, the title 18/500 and the ghost `pencil` that renames it in place (Enter saves, Esc cancels). */
function Head({ eyebrow, children }: { eyebrow: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <p data-testid="details-eyebrow" style={{ ...EYEBROW, margin: 0, whiteSpace: "nowrap" }}>
        {eyebrow}
      </p>
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
          style={typedField(phone, { fontSize: 16, fontWeight: 500 })}
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
            <Menu.Item key={option.key} onSelect={() => onAddUse(id, option.use)} style={{ ...menuItem(true, phone), flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 2, padding: "4px 12px" }}>
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
      style={typedField(phone, { flexGrow: 1, minWidth: 0, ...ring(state.focusVisible) })}
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
            style={typedField(phone)}
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
          <span style={FIELD_LABEL}>Model</span>
          <div>
            <ModelPicker tool={view.tool ?? null} value={view.model} onChange={(model) => h.onModel(view.id, model)} phone={phone} name="Model" openSignal={openModel} anyWithoutTool />
          </div>
          {!view.model && modelMenu(harnessTool(view.tool)).state !== "hidden" && modelMenu(harnessTool(view.tool)).state !== "none" ? (
            <span style={quiet()}>Model is empty because there is no session to read it from.</span>
          ) : null}
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
        <span style={FIELD_LABEL}>Tool</span>
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
  view: "View file",
  writtenWith: "Written with",
} as const;

function CodeDetails({ view, phone, focus, ...h }: { view: CodeView; phone: boolean; focus: DetailsPanelProps["focusMakes"] } & DetailsHandlers) {
  const [viewing, setViewing] = useState(false);
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
      {/* No code on the page: the file opens in the same window as the list's title does. */}
      <div>
        <Button variant="secondary" size={phone ? 44 : 28} fontSize={12} onClick={() => setViewing(true)} style={phone ? undefined : { height: 26 }}>
          {CODE_DETAILS_COPY.view}
        </Button>
      </div>
      <CodeStepDialog open={viewing} onOpenChange={setViewing} title={view.title ?? view.defaultTitle} filename={view.filename} language={view.language} source={view.source} />
      <UseList id={view.id} rows={view.uses} options={view.options} phone={phone} onAddUse={h.onAddUse} onAttach={h.onAttach} onRemoveUse={h.onRemoveUse} />
      <Makes id={view.id} rows={view.makes} phone={phone} focus={focus} h={h} />
      <RowList title="Goes into" rows={view.goesInto} phone={phone} onSelect={h.onSelect} />
    </>
  );
}

/* ── a check (CA-03 P5) ── */

function CheckDetails({ view, phone, ...h }: { view: CheckView; phone: boolean } & DetailsHandlers) {
  return (
    <>
      <Head eyebrow={`Check ${view.number}`}>
        <Title id={view.id} title={view.title} fallback={view.defaultTitle} editable label={`Title of check ${view.number}`} phone={phone} onRename={h.onRename} />
      </Head>
      <CheckBlock check={view.check} />
      <UseList id={view.id} rows={view.uses} options={view.options} phone={phone} onAddUse={h.onAddUse} onAttach={h.onAttach} onRemoveUse={h.onRemoveUse} />
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
          <div style={{ padding: "8px 0", borderBottom: line }}>
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
              <Checkbox checked={row.stepId !== null} onChange={(event) => onToggleSessionPrompt(view, row, event.target.checked)} />
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

/** A small label over a control that is not one input (CA-03): the field label's look, in a group. */
function GroupLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} style={FIELD_LABEL}>
      {children}
    </span>
  );
}

/**
 * CA-03 P3: How did it run? Choice rows, the first three always shown and the other two under "More ways it ran"
 * (shown straight away when one of them is chosen). A schedule offers three presets and a time, written into its
 * detail as text ("Weekdays 07:30"); typing in the field still works and wins. "Again until" takes an optional "At
 * most" count, written into the same detail ("until the review has no changes · at most 3 times"). Nothing new is
 * stored: `payload.runs` keeps its shape.
 */
function RunsGroup({ view, phone, onRuns }: { view: AgentView; phone: boolean } & Pick<DetailsHandlers, "onRuns">) {
  const how = view.runs?.how ?? "once";
  const choice = RUNS_CHOICES.find((entry) => entry.how === how) ?? RUNS_CHOICES[0];
  const name = `runs-${view.id}`;
  const field = choice.field;
  const saved = view.runs?.detail ?? "";
  const [count, setCount] = useState(view.runs?.count ?? 2);
  const [detail, setDetail] = useState(saved);
  const [condition, setCondition] = useState(how === "until" ? untilParts(saved).condition : "");
  const [atMost, setAtMost] = useState(how === "until" && untilParts(saved).atMost !== null ? String(untilParts(saved).atMost) : "");
  const [time, setTime] = useState(how === "schedule" ? scheduleParts(saved).time : "");
  const [moreAsked, setMoreAsked] = useState(false);
  const showMore = moreAsked || choice.more;
  const preset = how === "schedule" ? scheduleParts(detail).preset : null;
  const ids = `${name}-field`;

  const pick = (next: RunsChoice) => {
    setDetail("");
    setCondition("");
    setAtMost("");
    setTime("");
    if (next.how === "once") onRuns(view.id, null);
    else if (next.how === "parallel") onRuns(view.id, { how: "parallel", count: view.runs?.count ?? count });
    else onRuns(view.id, { how: next.how, detail: "" });
  };

  /** Write a detail when it changed. */
  const write = (next: string) => {
    if (next.trim() !== saved.trim()) onRuns(view.id, { how, detail: next.trim() });
  };

  const atMostNumber = (): number | null => {
    const n = Number(atMost);
    return atMost.trim() && Number.isFinite(n) ? Math.min(AT_MOST_MAX, Math.max(AT_MOST_MIN, Math.round(n))) : null;
  };
  const writeUntil = () => {
    const n = atMostNumber();
    setAtMost(n === null ? "" : String(n));
    write(untilDetail(condition, n));
  };
  const room = UNTIL_DETAIL_MAX - (atMost.trim() ? ` · at most ${AT_MOST_MAX} times`.length : 0);

  const enterBlurs = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Enter") (event.target as HTMLInputElement).blur();
  };

  return (
    <Section title={RUNS_COPY.title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
        <ChoiceRows
          label={RUNS_COPY.title}
          name={name}
          phone={phone}
          value={how}
          onChange={(next) => pick(RUNS_CHOICES.find((entry) => entry.how === next) ?? RUNS_CHOICES[0])}
          rows={RUNS_CHOICES.filter((entry) => !entry.more || showMore).map((entry) => ({
            value: entry.how,
            label: entry.how === "once" && view.parent ? `${entry.label} · ${RUNS_COPY.inTeam}` : entry.label,
          }))}
        />
        {showMore ? null : (
          <span>
            <TextButton target={phone} style={text(12.5, 500, t.text2)} onClick={() => setMoreAsked(true)}>
              {RUNS_COPY.more}
            </TextButton>
          </span>
        )}

        {field?.kind === "count" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="text"
              inputMode="numeric"
              aria-label={field.label}
              value={Number.isFinite(count) ? String(count) : ""}
              onChange={(event) => setCount(Number(event.target.value.replace(/[^0-9]/g, "")))}
              onBlur={() => {
                const next = Math.min(field.max, Math.max(field.min, Math.round(Number.isFinite(count) ? count : field.min)));
                setCount(next);
                if (next !== view.runs?.count) onRuns(view.id, { how: "parallel", count: next });
              }}
              onKeyDown={enterBlurs}
              style={typedField(phone, { width: 72, ...tnum })}
            />
            <span style={{ ...quiet(), ...tnum }}>{atOnce(Math.min(field.max, Math.max(field.min, Number.isFinite(count) ? count : field.min)))}</span>
          </div>
        ) : null}

        {how === "schedule" && field?.kind === "text" ? (
          <div role="group" aria-labelledby={`${ids}-when`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <GroupLabel id={`${ids}-when`}>{field.label}</GroupLabel>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <Segmented
                label={RUNS_COPY.presets}
                semantics="radio"
                size={phone ? 50 : 28}
                value={preset ?? ""}
                items={SCHEDULE_PRESETS.map((entry) => ({ value: entry, label: entry }))}
                onChange={(next) => {
                  const chosen = SCHEDULE_PRESETS.find((entry) => entry === next) ?? null;
                  const written = scheduleDetail(chosen, time);
                  setDetail(written);
                  write(written);
                }}
              />
              <input
                type="text"
                aria-label={RUNS_COPY.time}
                placeholder={RUNS_COPY.timeHint}
                maxLength={5}
                value={time}
                onChange={(event) => setTime(event.target.value.replace(/[^0-9:]/g, ""))}
                onBlur={() => {
                  if (time.trim() && !isClockTime(time)) return;
                  const written = scheduleDetail(preset, time);
                  if (!written) return;
                  setDetail(written);
                  write(written);
                }}
                onKeyDown={enterBlurs}
                style={typedField(phone, { width: 72, ...tnum })}
              />
            </div>
            <input
              type="text"
              aria-label={field.label}
              maxLength={field.max}
              placeholder={field.placeholder}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              onBlur={() => {
                setTime(scheduleParts(detail).time);
                write(detail);
              }}
              onKeyDown={enterBlurs}
              style={typedField(phone)}
            />
            <span style={{ ...quiet(), ...tnum }}>
              {detail.length} / {field.max}
            </span>
          </div>
        ) : null}

        {how === "event" && field?.kind === "text" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <FieldBlock label={field.label}>
              <input
                type="text"
                aria-label={field.label}
                maxLength={field.max}
                placeholder={field.placeholder}
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                onBlur={() => write(detail)}
                onKeyDown={enterBlurs}
                style={typedField(phone)}
              />
            </FieldBlock>
            <span style={{ ...quiet(), ...tnum }}>
              {detail.length} / {field.max}
            </span>
          </div>
        ) : null}

        {how === "until" && field?.kind === "text" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <FieldBlock label={field.label}>
              <input
                type="text"
                aria-label={field.label}
                maxLength={room}
                placeholder={field.placeholder}
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
                onBlur={writeUntil}
                onKeyDown={enterBlurs}
                style={typedField(phone)}
              />
            </FieldBlock>
            <span style={{ ...quiet(), ...tnum, marginTop: -2 }}>
              {condition.length} / {room}
            </span>
            <div role="group" aria-labelledby={`${ids}-most`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <GroupLabel id={`${ids}-most`}>{RUNS_COPY.atMost}</GroupLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={RUNS_COPY.atMost}
                  maxLength={2}
                  value={atMost}
                  onChange={(event) => setAtMost(event.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={writeUntil}
                  onKeyDown={enterBlurs}
                  style={typedField(phone, { width: 56, ...tnum })}
                />
                <span style={text(12.5, 400, t.text2)}>{RUNS_COPY.times}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/** CA-02 P5: an agent's Runs in, Models and Tools, written as they change once every model is named. */
function AgentSetupBlock({ id, initial, phone, inBuild, onAgentSetup }: { id: string; initial: AgentSetupValue; phone: boolean; inBuild: readonly string[]; onAgentSetup: NonNullable<DetailsHandlers["onAgentSetup"]> }) {
  const [value, setValue] = useState(initial);
  const [openModel, setOpenModel] = useState(0);
  const change = (next: AgentSetupValue) => {
    setValue(next);
    // What it remembers goes only when it is there or was just cleared: an agent without one is written as before.
    if (setupReady(next)) onAgentSetup(id, { ...savedModels(next), harness: next.harness, tools: next.tools, ...(next.memory !== undefined ? { memory: next.memory } : null) });
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
      {setup.memory ? <KeyValue label="What it remembers">{setup.memory}</KeyValue> : null}
    </div>
  );
}

function AgentDetails({ view, phone, inBuild = [], ...h }: { view: AgentView; phone: boolean; inBuild?: readonly string[] } & DetailsHandlers) {
  const word = view.kind === "agent" ? "Agent" : "Team";
  /* CA-03 P4: a team's first agent is its lead. */
  const lead = view.kind === "agent" && view.parent !== null && view.number.endsWith(".1");
  return (
    <>
      <Head eyebrow={`${lead ? "Lead agent" : word} ${view.number}`}>
        <Title id={view.id} title={view.name} fallback={view.defaultName} editable={false} label={`${word} name`} phone={phone} onRename={h.onRename} />
      </Head>
      <OutsideWarning names={view.outside ?? []} />
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
      {view.kind === "check" ? <CheckDetails key={view.id} view={view} phone={phone} {...h} /> : null}
      {view.kind === "session" ? <SessionDetails key={view.key} view={view} phone={phone} inBuild={inBuild ?? []} onToggleSessionPrompt={h.onToggleSessionPrompt} onSessionTool={h.onSessionTool} /> : null}
      {view.kind === "file" ? <FileDetails key={view.id} view={view} phone={phone} onDownload={h.onDownload} onSelect={h.onSelect} /> : null}
      {view.kind === "tool" ? <ToolDetails key={view.id} view={view} phone={phone} onFields={h.onFields} onSelect={h.onSelect} /> : null}
      {view.kind === "agent" || view.kind === "team" ? <AgentDetails key={view.id} view={view} phone={phone} inBuild={inBuild} {...h} /> : null}
      {view.kind === "result" ? <ResultDetails key={view.id} view={view} phone={phone} onFields={h.onFields} onAddPicture={h.onAddPicture} onUseAsCover={h.onUseAsCover} /> : null}
    </div>
  );
}

export default DetailsPanel;
