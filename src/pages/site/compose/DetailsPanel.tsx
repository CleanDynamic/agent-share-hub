/* UI-P66 — the Details panel: whatever is selected, and the one place to
   rename a step, edit its inputs and set how an agent runs.

   PURE. A view says what is selected and everything the panel shows of it;
   `SandboxPage` builds the view from the steps and runs the writes. Nothing
   here fetches, and nothing is written for the maker: a title that was not
   typed stays the default, shown quiet.

   Text fields (a name, a link) are held as typed and handed over when the
   maker leaves the field or presses Enter, so a write is one whole value. The
   panel is the content of the Details bottom sheet on a phone, where radio
   rows and remove buttons are 44 tall. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, ArrowRight, Download, Maximize2, Pencil, Plus, X } from "lucide-react";
import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";
import { MODEL_VERSIONS } from "@/lib/models/registry";
import type { Runs, Use } from "@/lib/build/graph";

import { TextButton } from "./composeControls";
import { fieldBase } from "./composeFields";
import {
  atOnce,
  DETAILS_ROWS,
  firstRows,
  RUNS_CHOICES,
  type ChecklistRow,
  type GoesRow,
  type InputOption,
  type UseRow,
} from "./detailsModel";

const selTint = tokenAlpha("action", 0.12);

/* ── what can be selected ── */

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
  text: string;
  words: number;
}

export interface SessionView {
  kind: "session";
  key: string;
  number: number;
  tool: string;
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
}

export interface ResultView {
  kind: "result";
  id: string;
  summary: string;
  url: string;
  /** Pictures kept with the result. */
  pictures: readonly { id: string; name: string }[];
}

export type DetailsView = PromptView | SessionView | FileView | ToolView | AgentView | ResultView;

export interface DetailsHandlers {
  onRename: (id: string, title: string) => void;
  onOpenPrompt?: (id: string) => void;
  onModel: (id: string, model: string | null) => void;
  onAddUse: (id: string, use: Use) => void;
  onRemoveUse: (id: string, use: Use) => void;
  onRuns: (id: string, runs: Runs | null) => void;
  /** UI-P69: write an agent's instructions. Absent, they are only shown. */
  onInstructions?: (id: string, text: string) => void;
  onRemoveInside: (id: string) => void;
  onToggleSessionPrompt: (view: SessionView, row: ChecklistRow, on: boolean) => void;
  onDownload: (id: string) => void;
  onFields: (id: string, fields: Record<string, string | null>) => void;
  onAddPicture: (id: string, file: File) => void;
  onUseAsCover: (mediaId: string) => void;
  onSelect?: (id: string) => void;
}

export interface DetailsPanelProps extends DetailsHandlers {
  phone: boolean;
  view: DetailsView | null;
}

/* ── small pieces ── */

const mono = (size: 11 | 11.5 | 12): CSSProperties => ({ fontFamily: DM_MONO, fontSize: size, color: t.text2 });

const eyebrow: CSSProperties = { ...mono(11), textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 };

const sectionLabel: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, color: t.text, margin: 0 };

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h3 style={sectionLabel}>
        {title}
        {typeof count === "number" ? <span style={{ ...mono(12), fontWeight: 400, marginLeft: 6 }}>{count}</span> : null}
      </h3>
      {children}
    </section>
  );
}

/** A 24 square (44 on a phone) button for one icon: Remove, Rename. */
function MiniButton({ icon: Icon, label, onClick, phone, size = 14 }: { icon: typeof X; label: string; onClick: () => void; phone: boolean; size?: number }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const box = phone ? 44 : 24;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...handlers}
      style={{ width: box, height: box, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: r.control, border: 0, background: "transparent", color: t.text2, cursor: "pointer", ...ring(state.focusVisible) }}
    >
      <Icon size={size} strokeWidth={1.6} aria-hidden="true" />
    </button>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span style={mono(12)}>{children}</span>;
}

/** A row of key and value, a 90px label column, a hairline above. */
function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "90px minmax(0, 1fr)", gap: 8, alignItems: "baseline", padding: "8px 0", borderTop: `1px solid ${t.hairline}` }}>
      <span style={mono(12)}>{label}</span>
      <span style={{ fontFamily: FIGTREE, fontSize: 13.5, color: t.text, overflowWrap: "anywhere" }}>{children}</span>
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
  const style: CSSProperties = { ...fieldBase, padding: "7px 10px", minHeight: phone ? 44 : 32, fontSize: phone ? 16 : 13.5, ...ring(state.focusVisible) };
  const common = {
    "aria-label": label,
    value: draft,
    placeholder,
    maxLength: max,
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    onKeyDown,
    ...handlers,
  };
  return multiline ? <textarea rows={2} {...common} style={{ ...style, resize: "vertical" }} /> : <input type="text" {...common} style={style} />;
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={mono(12)}>{label}</span>
      {children}
    </label>
  );
}

/** The title, in display type, with a Pencil that edits it in place (Enter saves, Esc cancels). */
function Title({ id, title, fallback, editable, label, phone, onRename }: { id: string; title: string | null; fallback: string; editable: boolean; label: string; phone: boolean; onRename: (id: string, title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const finish = (save: boolean) => {
    setEditing(false);
    if (save && draft.trim() !== (title ?? "")) onRename(id, draft);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
          style={{ ...fieldBase, padding: "6px 10px", fontSize: phone ? 16 : 18, fontWeight: 600, minHeight: phone ? 44 : 36 }}
        />
      ) : (
        <h3 data-default-title={title ? undefined : "true"} style={{ ...display(22), margin: 0, minWidth: 0, overflowWrap: "anywhere", color: title ? t.text : t.text2, fontWeight: title ? undefined : 500 }}>{title ?? fallback}</h3>
      )}
      {editable && !editing ? (
        <MiniButton
          icon={Pencil}
          label="Rename"
          phone={phone}
          onClick={() => {
            setDraft(title ?? "");
            setEditing(true);
          }}
        />
      ) : null}
    </div>
  );
}

/* ── inputs: Uses, Add an input, Goes into ── */

function UseList({ id, rows, options, phone, onAddUse, onRemoveUse }: { id: string; rows: readonly UseRow[]; options: readonly InputOption[] } & Pick<DetailsPanelProps, "phone"> & Pick<DetailsHandlers, "onAddUse" | "onRemoveUse">) {
  const [all, setAll] = useState(false);
  const [menuAll, setMenuAll] = useState(false);
  const shown = all ? { visible: [...rows], hidden: 0 } : firstRows(rows);
  const menu = menuAll ? { visible: [...options], hidden: 0 } : firstRows(options);
  return (
    <Section title="Uses" count={rows.length}>
      <div>
        {shown.visible.map((row) => (
          <div key={`${row.use.kind}:${row.use.node_id}`} style={{ display: "grid", gridTemplateColumns: `18px 1fr ${phone ? 44 : 24}px`, gap: 8, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${t.hairline}` }}>
            <ArrowLeft size={14} strokeWidth={1.6} color="var(--text2)" aria-hidden="true" />
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ fontFamily: FIGTREE, fontSize: 13.5, fontWeight: 600, color: t.text, overflowWrap: "anywhere" }}>{row.label}</span>
              {row.sub ? <span style={mono(12)}>{row.sub}</span> : null}
            </span>
            <MiniButton icon={X} label={`Remove ${row.label}`} phone={phone} onClick={() => onRemoveUse(id, row.use)} />
          </div>
        ))}
        {shown.hidden > 0 ? (
          <div style={{ paddingTop: 4 }}>
            <TextButton target={phone} onClick={() => setAll(true)}>
              Show {shown.hidden} more
            </TextButton>
          </div>
        ) : null}
      </div>
      <Menu.Root onOpenChange={(open) => !open && setMenuAll(false)}>
        <Menu.Trigger asChild>
          <Button variant="ghost" size={phone ? 44 : 30} fontSize={12} icon={Plus} disabled={options.length === 0}>
            Add an input
          </Button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align="start"
            sideOffset={6}
            style={{ zIndex: 50, width: 260, maxWidth: "calc(100vw - 32px)", maxHeight: 360, overflowY: "auto", padding: 6, borderRadius: r.panel, background: t.solid, border: `1px solid ${t.line}`, color: t.text }}
          >
            {menu.visible.map((option) => (
              <Menu.Item
                key={option.key}
                onSelect={() => onAddUse(id, option.use)}
                style={{ display: "flex", flexDirection: "column", minHeight: phone ? 44 : 34, justifyContent: "center", padding: "4px 10px", borderRadius: r.control, outline: "none", cursor: "pointer" }}
              >
                <span style={{ fontFamily: FIGTREE, fontSize: 13.5, fontWeight: 600 }}>{option.label}</span>
                {option.sub ? <span style={mono(12)}>{option.sub}</span> : null}
              </Menu.Item>
            ))}
            {menu.hidden > 0 ? (
              <Menu.Item
                onSelect={(event) => {
                  event.preventDefault();
                  setMenuAll(true);
                }}
                style={{ minHeight: phone ? 44 : 34, display: "flex", alignItems: "center", padding: "4px 10px", fontFamily: FIGTREE, fontSize: 13, color: t.text2, outline: "none", cursor: "pointer" }}
              >
                Show {menu.hidden} more
              </Menu.Item>
            ) : null}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </Section>
  );
}

function RowList({ title, rows, phone, icon: Icon = ArrowRight, onSelect }: { title: string; rows: readonly GoesRow[]; phone: boolean; icon?: typeof ArrowRight; onSelect?: (id: string) => void }) {
  const [all, setAll] = useState(false);
  if (rows.length === 0) return null;
  const shown = all ? { visible: [...rows], hidden: 0 } : firstRows(rows);
  return (
    <Section title={title} count={rows.length}>
      <div>
        {shown.visible.map((row) => (
          <div key={row.id} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 8, alignItems: "center", minHeight: phone ? 44 : undefined, padding: "8px 0", borderTop: `1px solid ${t.hairline}` }}>
            <Icon size={14} strokeWidth={1.6} color="var(--text2)" aria-hidden="true" />
            {onSelect && row.id !== "result" ? (
              <TextButton onClick={() => onSelect(row.id)} style={{ textAlign: "left", fontSize: 13.5, color: t.text }}>
                {row.label}
              </TextButton>
            ) : (
              <span style={{ fontFamily: FIGTREE, fontSize: 13.5, color: t.text }}>{row.label}</span>
            )}
          </div>
        ))}
        {shown.hidden > 0 ? (
          <div style={{ paddingTop: 4 }}>
            <TextButton target={phone} onClick={() => setAll(true)}>
              Show {shown.hidden} more
            </TextButton>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/* ── a prompt ── */

function PromptDetails({ view, phone, ...h }: { view: PromptView; phone: boolean } & DetailsHandlers) {
  const open = h.onOpenPrompt ? () => h.onOpenPrompt?.(view.id) : undefined;
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={eyebrow}>Prompt {view.number}</p>
        <Title id={view.id} title={view.title} fallback={view.defaultTitle} editable={view.editable} label={`Title of prompt ${view.number}`} phone={phone} onRename={h.onRename} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Mono>{view.sessionLine}</Mono>
          {view.detailLine ? <Mono>{view.detailLine}</Mono> : null}
        </div>
      </div>
      {view.typed ? (
        <FieldBlock label="Model">
          <select
            aria-label="Model"
            value={view.model ?? ""}
            onChange={(event) => h.onModel(view.id, event.target.value || null)}
            style={{ ...fieldBase, padding: "6px 8px", minHeight: phone ? 44 : 32, fontSize: phone ? 16 : 13.5 }}
          >
            <option value="">No model</option>
            {MODEL_VERSIONS.map((version) => (
              <option key={version.id} value={version.name}>
                {version.name}
              </option>
            ))}
          </select>
          {!view.model ? <span style={{ ...mono(12) }}>Model is empty because there is no session to read it from.</span> : null}
        </FieldBlock>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: t.cell, border: `1px solid ${t.hairline}` }}>
          <p
            style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13.5, lineHeight: 1.5, color: t.text, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {view.text}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Button variant="secondary" size={phone ? 44 : 30} fontSize={12} icon={Maximize2} disabled={!open} onClick={() => open?.()}>
            Read all of it
          </Button>
          <Mono>{view.words} words</Mono>
        </div>
      </div>
      <UseList id={view.id} rows={view.uses} options={view.options} phone={phone} onAddUse={h.onAddUse} onRemoveUse={h.onRemoveUse} />
      <RowList title="Goes into" rows={view.goesInto} phone={phone} onSelect={h.onSelect} />
    </>
  );
}

/* ── a session ── */

function SessionDetails({ view, phone, onToggleSessionPrompt }: { view: SessionView; phone: boolean } & Pick<DetailsHandlers, "onToggleSessionPrompt">) {
  const [all, setAll] = useState(false);
  const shown = all ? { visible: [...view.checklist], hidden: 0 } : firstRows(view.checklist);
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={eyebrow}>Session</p>
        <h3 style={{ ...display(22), margin: 0, color: t.text }}>Session {view.number}</h3>
      </div>
      <div>
        <KeyValue label="Tool">{view.tool}</KeyValue>
        <KeyValue label="Model">{view.model || "Not named"}</KeyValue>
        <KeyValue label="Date">{view.date || "Typed here"}</KeyValue>
      </div>
      <Section title="Prompts in the build">
        <Mono>{view.total === null ? `${view.inBuild}` : `${view.inBuild} of ${view.total}`}</Mono>
        {view.status === "loading" ? <p style={{ ...mono(12), margin: 0 }}>Loading this session's prompts…</p> : null}
        {view.status === "error" ? <p style={{ ...mono(12), margin: 0 }}>This session's prompts did not load.</p> : null}
        <div role="group" aria-label="Prompts in this session">
          {shown.visible.map((row) => (
            <label key={row.ordinal} style={{ display: "grid", gridTemplateColumns: "20px minmax(0, 1fr)", gap: 8, alignItems: "center", minHeight: phone ? 44 : 30, padding: "4px 0", borderTop: `1px solid ${t.hairline}`, cursor: "pointer" }}>
              <input type="checkbox" checked={row.stepId !== null} onChange={(event) => onToggleSessionPrompt(view, row, event.target.checked)} style={{ margin: 0, width: 16, height: 16 }} />
              <span style={{ fontFamily: FIGTREE, fontSize: 13.5, color: t.text, overflowWrap: "anywhere" }}>{row.label}</span>
            </label>
          ))}
        </div>
        {shown.hidden > 0 ? (
          <div style={{ paddingTop: 4 }}>
            <TextButton target={phone} onClick={() => setAll(true)}>
              Show {shown.hidden} more
            </TextButton>
          </div>
        ) : null}
      </Section>
    </>
  );
}

/* ── a file, a tool ── */

function FileDetails({ view, phone, onDownload, onSelect }: { view: FileView; phone: boolean } & Pick<DetailsHandlers, "onDownload" | "onSelect">) {
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={eyebrow}>File</p>
        <h3 style={{ ...display(22), margin: 0, color: t.text, overflowWrap: "anywhere" }}>{view.name}</h3>
      </div>
      <div>
        <KeyValue label="From">{view.from}</KeyValue>
        {view.size ? <KeyValue label="Size">{view.size}</KeyValue> : null}
      </div>
      {view.canDownload ? (
        <div>
          <Button variant="secondary" size={phone ? 44 : 30} fontSize={12} icon={Download} onClick={() => onDownload(view.id)}>
            Download
          </Button>
        </div>
      ) : null}
      <RowList title="Used by" rows={view.usedBy} phone={phone} icon={ArrowRight} onSelect={onSelect} />
    </>
  );
}

function ToolDetails({ view, phone, onFields, onSelect }: { view: ToolView; phone: boolean } & Pick<DetailsHandlers, "onFields" | "onSelect">) {
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={eyebrow}>Tool</p>
      </div>
      <FieldBlock label="Service">
        <CommitField key={`${view.id}:service`} label="Service" value={view.service} phone={phone} max={80} onCommit={(value) => onFields(view.id, { service: value })} />
      </FieldBlock>
      <FieldBlock label="What it was used for">
        <CommitField key={`${view.id}:scopes`} label="What it was used for" value={view.scopes} placeholder="read, label, draft" phone={phone} max={140} onCommit={(value) => onFields(view.id, { scopes: value })} />
      </FieldBlock>
      <RowList title="Used by" rows={view.usedBy} phone={phone} icon={ArrowRight} onSelect={onSelect} />
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
      <div role="radiogroup" aria-label="How it runs" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {RUNS_CHOICES.map((entry) => {
          const chosen = entry.how === how;
          const label = entry.how === "once" && view.parent ? `${entry.label} · each time work is sent to it` : entry.label;
          return (
            <label
              key={entry.how}
              style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 30, padding: "0 8px", borderRadius: r.control, background: chosen ? selTint : "transparent", cursor: "pointer", fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, color: t.text }}
            >
              <input type="radio" name={name} checked={chosen} onChange={() => pick(entry)} style={{ margin: 0 }} />
              {label}
            </label>
          );
        })}
      </div>
      {field?.kind === "count" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            style={{ ...fieldBase, width: 72, padding: "6px 8px", minHeight: phone ? 44 : 32, fontSize: phone ? 16 : 13.5 }}
          />
          <Mono>{atOnce(Math.min(field.max, Math.max(field.min, Number.isFinite(count) ? count : field.min)))}</Mono>
        </div>
      ) : null}
      {field?.kind === "text" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
            style={{ ...fieldBase, padding: "7px 10px", minHeight: phone ? 44 : 32, fontSize: phone ? 16 : 13.5 }}
          />
          <Mono>
            {detail.length} / {field.max}
          </Mono>
        </div>
      ) : null}
    </Section>
  );
}

function AgentDetails({ view, phone, ...h }: { view: AgentView; phone: boolean } & DetailsHandlers) {
  const word = view.kind === "agent" ? "Agent" : "Team";
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={eyebrow}>
          {word} {view.number}
        </p>
        <Title id={view.id} title={view.name} fallback={view.defaultName} editable={false} label={`${word} name`} phone={phone} onRename={h.onRename} />
      </div>
      <FieldBlock label="Name">
        <CommitField key={`${view.id}:name`} label="Name" value={view.name ?? ""} placeholder={view.defaultName} max={80} phone={phone} onCommit={(value) => h.onRename(view.id, value)} />
      </FieldBlock>
      {view.model || view.parent ? (
        <div>
          {view.parent ? <KeyValue label="In">{view.parent}</KeyValue> : null}
          {view.model ? <KeyValue label="Model">{view.model}</KeyValue> : null}
        </div>
      ) : null}
      {view.kind === "agent" ? (
        <FieldBlock label="Instructions">
          {h.onInstructions ? (
            <CommitField key={`${view.id}:instructions`} label="Instructions" value={view.instructions} placeholder="What this agent is told" multiline phone={phone} onCommit={(value) => h.onInstructions?.(view.id, value)} />
          ) : (
            <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13.5, color: t.text, overflowWrap: "anywhere" }}>{view.instructions}</p>
          )}
        </FieldBlock>
      ) : null}
      <RunsGroup view={view} phone={phone} onRuns={h.onRuns} />
      <Section title={`Inside ${view.inside}`}>
        <div>
          {view.insideRows.map((row) => (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: `1fr ${phone ? 44 : 24}px`, gap: 8, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${t.hairline}` }}>
              <span style={{ fontFamily: FIGTREE, fontSize: 13.5, color: t.text, overflowWrap: "anywhere" }}>{row.label}</span>
              <MiniButton icon={X} label={`Remove ${row.label}`} phone={phone} onClick={() => h.onRemoveInside(row.id)} />
            </div>
          ))}
        </div>
      </Section>
      <UseList id={view.id} rows={view.uses} options={view.options} phone={phone} onAddUse={h.onAddUse} onRemoveUse={h.onRemoveUse} />
      <RowList title="Goes into" rows={view.goesInto} phone={phone} onSelect={h.onSelect} />
    </>
  );
}

/* ── a result ── */

function ResultDetails({ view, phone, onFields, onAddPicture, onUseAsCover }: { view: ResultView; phone: boolean } & Pick<DetailsHandlers, "onFields" | "onAddPicture" | "onUseAsCover">) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={eyebrow}>Result</p>
      </div>
      <FieldBlock label="Summary">
        <CommitField key={`${view.id}:summary`} label="Summary" value={view.summary} phone={phone} multiline max={200} onCommit={(value) => onFields(view.id, { summary: value })} />
      </FieldBlock>
      <FieldBlock label="Link">
        <CommitField key={`${view.id}:url`} label="Link" value={view.url} placeholder="https://" phone={phone} max={300} onCommit={(value) => onFields(view.id, { url: value })} />
      </FieldBlock>
      <Section title="Pictures" count={view.pictures.length}>
        <div>
          {view.pictures.map((picture) => (
            <div key={picture.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: phone ? 44 : 30, padding: "4px 0", borderTop: `1px solid ${t.hairline}` }}>
              <span style={{ fontFamily: FIGTREE, fontSize: 13.5, color: t.text, overflowWrap: "anywhere" }}>{picture.name}</span>
              <Button variant="secondary" size={phone ? 44 : 30} fontSize={12} onClick={() => onUseAsCover(picture.id)}>
                Use as cover
              </Button>
            </div>
          ))}
        </div>
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
        <div>
          <Button variant="ghost" size={phone ? 44 : 30} fontSize={12} icon={Plus} onClick={() => picker.current?.click()}>
            Add a picture
          </Button>
        </div>
      </Section>
    </>
  );
}

/* ── the panel ── */

export const DETAILS_COPY = {
  empty: "Select a prompt, session or file to see it here.",
} as const;

export function DetailsPanel({ view, phone, ...h }: DetailsPanelProps) {
  if (!view) return <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13.5, color: t.text2 }}>{DETAILS_COPY.empty}</p>;
  return (
    <div data-testid="details-panel" data-kind={view.kind} style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      {view.kind === "prompt" ? <PromptDetails key={view.id} view={view} phone={phone} {...h} /> : null}
      {view.kind === "session" ? <SessionDetails key={view.key} view={view} phone={phone} onToggleSessionPrompt={h.onToggleSessionPrompt} /> : null}
      {view.kind === "file" ? <FileDetails key={view.id} view={view} phone={phone} onDownload={h.onDownload} onSelect={h.onSelect} /> : null}
      {view.kind === "tool" ? <ToolDetails key={view.id} view={view} phone={phone} onFields={h.onFields} onSelect={h.onSelect} /> : null}
      {view.kind === "agent" || view.kind === "team" ? <AgentDetails key={view.id} view={view} phone={phone} {...h} /> : null}
      {view.kind === "result" ? <ResultDetails key={view.id} view={view} phone={phone} onFields={h.onFields} onAddPicture={h.onAddPicture} onUseAsCover={h.onUseAsCover} /> : null}
    </div>
  );
}

export { DETAILS_ROWS };
export default DetailsPanel;
