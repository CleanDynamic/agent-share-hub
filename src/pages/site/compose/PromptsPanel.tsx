/* UI-P48 — Prompts: the prompts someone needs to get the same result, in order.

   PURE. Rows in, intentions out: `ComposePage` owns the writes.

   EACH ROW is the number in a `--cell` circle, the prompt in a field that grows
   from one line to six, where it came from ("Session 1 · Sonnet 5.5", "Written
   by you"), and three controls: up, down, remove. Up and down are there because
   the order is the point. On a fine pointer the controls show on hover or when
   the row holds focus; anywhere else they always show, at 44px on a phone.

   THE WHOLE PANEL TAKES A DROP. A prompt dragged from Your sessions carries
   `text/plain` ("{importId}:{ordinal}") and the marker type PROMPT_DRAG_TYPE.
   The panel answers only a drag that carries the marker, so text dragged inside
   a prompt's own field is left to the field. */

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { fade } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { TextButton } from "./composeControls";
import { bareField, useRing } from "./composeFields";

/** The type a dragged session prompt carries beside its text: what tells it from any other drag. */
export const PROMPT_DRAG_TYPE = "application/x-buildgallery-prompt";

/** How long after an arrow is pressed its row still takes the focus back once the move lands. */
const REFOCUS_MS = 5000;

/** The prompt field's line, in px: 15px at line-height 1.5. */
const LINE = 22.5;
const MAX_LINES = 6;

export interface ComposePromptRow {
  /** The node's id, or a key of the page's own for a prompt that is not saved yet. */
  key: string;
  text: string;
  /** "Session 1 · Sonnet 5.5", or "Written by you". */
  source: string;
  /** False until it is saved: a prompt that is only on this page cannot move yet. */
  saved: boolean;
}

/** Focus this prompt's field. `at` makes asking twice for the same one count. */
export interface PromptFocus {
  key: string;
  at: number;
}

export interface PromptsPanelProps {
  phone: boolean;
  /** A mouse or trackpad: rows reveal their controls on hover, and the panel takes drags. */
  fine: boolean;
  prompts: readonly ComposePromptRow[];
  focus: PromptFocus | null;
  onText: (key: string, text: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  onRemove: (key: string) => void;
  /** "write one": a new, empty prompt. */
  onWrite: () => void;
  /** A drop's `text/plain`. */
  onDrop: (data: string) => void;
}

const carriesPrompt = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes(PROMPT_DRAG_TYPE);

function PromptRow({
  row,
  n,
  canUp,
  canDown,
  phone,
  fine,
  focus,
  onText,
  onMove,
  onRemove,
}: {
  row: ComposePromptRow;
  n: number;
  canUp: boolean;
  canDown: boolean;
} & Pick<PromptsPanelProps, "phone" | "fine" | "focus" | "onText" | "onMove" | "onRemove">) {
  const field = useRef<HTMLTextAreaElement>(null);
  const item = useRef<HTMLLIElement>(null);
  const [hover, setHover] = useState(false);
  const [within, setWithin] = useState(false);
  const fieldRing = useRing<HTMLTextAreaElement>();

  /* A move re-orders the rows once it lands: the pressed arrow is moved, or
     disabled at either end, and focus would be lost. It goes back to this
     row's arrow in the same direction, or the other one when that is now off. */
  const refocus = useRef<{ direction: -1 | 1; at: number } | null>(null);
  const arrow = (direction: -1 | 1) => {
    refocus.current = { direction, at: Date.now() };
    onMove(row.key, direction);
  };
  useLayoutEffect(() => {
    const wanted = refocus.current;
    refocus.current = null;
    if (!wanted || Date.now() - wanted.at > REFOCUS_MS) return;
    const which = wanted.direction === -1 ? (canUp ? "up" : "down") : canDown ? "down" : "up";
    item.current?.querySelector<HTMLButtonElement>(`[data-arrow="${which}"]`)?.focus();
  }, [n, canUp, canDown]);

  useLayoutEffect(() => bareField(field.current), []);

  /* One line to six: the field is as tall as what it holds, then it scrolls. */
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    element.style.height = "auto";
    const max = LINE * MAX_LINES;
    element.style.height = `${Math.min(Math.max(element.scrollHeight, LINE), max)}px`;
    element.style.overflowY = element.scrollHeight > max ? "auto" : "hidden";
  }, [row.text]);

  useEffect(() => {
    if (focus && focus.key === row.key) field.current?.focus();
  }, [focus, row.key]);

  const shown = phone || !fine || hover || within;
  const size = phone ? 38 : 30;
  const target: CSSProperties | undefined = phone ? { width: 44, height: 44 } : undefined;

  const controls = (
    <div
      style={{
        display: "flex",
        flexDirection: phone ? "row" : "column",
        gap: phone ? 4 : 2,
        flexShrink: 0,
        opacity: shown ? 1 : 0,
        transition: fade(),
      }}
    >
      <IconButton icon={ArrowUp} size={size} style={target} label={`Move prompt ${n} up`} disabled={!canUp} data-arrow="up" onClick={() => arrow(-1)} />
      <IconButton icon={ArrowDown} size={size} style={target} label={`Move prompt ${n} down`} disabled={!canDown} data-arrow="down" onClick={() => arrow(1)} />
      <IconButton icon={X} size={size} style={target} label={`Remove prompt ${n}`} onClick={() => onRemove(row.key)} />
    </div>
  );

  const source = <span style={{ fontFamily: DM_MONO, fontSize: 11, color: t.text2, minWidth: 0, overflowWrap: "anywhere" }}>{row.source}</span>;

  return (
    <li
      ref={item}
      data-testid="compose-prompt"
      data-saved={row.saved ? "true" : "false"}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setWithin(false);
      }}
      style={{
        listStyle: "none",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 12,
        borderRadius: r.control,
        background: t.field,
        border: `1px solid ${t.hairline}`,
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 24,
          height: 24,
          borderRadius: r.full,
          background: t.cell,
          color: t.text,
          fontFamily: DM_MONO,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      {/* The field's size is set here: index.css makes every field's font-size `inherit !important` from 768px. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexGrow: 1, minWidth: 0, fontSize: phone ? 16 : 15 }}>
        <textarea
          ref={field}
          rows={1}
          value={row.text}
          aria-label={`Prompt ${n}`}
          onChange={(event) => onText(row.key, event.target.value)}
          {...fieldRing.handlers}
          style={{
            /* No border and no fill: bareField() sets both, past index.css's !important. */
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            margin: "1px 0 0",
            padding: 0,
            borderRadius: 4,
            color: t.text,
            fontFamily: FIGTREE,
            fontSize: phone ? 16 : 15,
            lineHeight: 1.5,
            resize: "none",
            outline: "none",
            overflowY: "hidden",
            ...fieldRing.style,
          }}
        />
        {source}
        {phone ? <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>{controls}</div> : null}
      </div>
      {phone ? null : controls}
    </li>
  );
}

export function PromptsPanel({ phone, fine, prompts, focus, onText, onMove, onRemove, onWrite, onDrop }: PromptsPanelProps) {
  const [over, setOver] = useState(false);
  const drag = fine && !phone;

  const dropHandlers = drag
    ? {
        onDragEnter: (event: DragEvent) => {
          if (!carriesPrompt(event)) return;
          event.preventDefault();
          setOver(true);
        },
        onDragOver: (event: DragEvent) => {
          if (!carriesPrompt(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setOver(true);
        },
        onDragLeave: (event: DragEvent) => {
          // Moving onto a child of the panel is not leaving it.
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setOver(false);
        },
        onDrop: (event: DragEvent) => {
          if (!carriesPrompt(event)) return;
          event.preventDefault();
          setOver(false);
          const data = event.dataTransfer.getData("text/plain");
          if (data) onDrop(data);
        },
      }
    : null;

  const lead = over ? "Drop to add it, or" : drag ? "Drag a prompt here from your sessions, or" : "Add one from your sessions, or";

  return (
    <div data-testid="compose-prompts" data-over={over ? "true" : undefined} {...dropHandlers}>
      <Panel
        surface="flat"
        padding={phone ? "16px" : "24px"}
        style={over ? { border: `1px solid ${t.evidence}`, background: t.rowHighlight } : undefined}
      >
        <PanelHead
          title={
            <>
              Prompts
              <span style={{ marginLeft: 8, fontFamily: DM_MONO, fontSize: 12, fontWeight: 400, color: t.text2 }}>{prompts.length}</span>
            </>
          }
          subtitle="The prompts someone needs to get the same result, in order."
          headingLevel={2}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          {prompts.length > 0 ? (
            <ol style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {prompts.map((row, index) => (
                <PromptRow
                  key={row.key}
                  row={row}
                  n={index + 1}
                  canUp={row.saved && index > 0 && prompts[index - 1].saved}
                  canDown={row.saved && index < prompts.length - 1 && prompts[index + 1].saved}
                  phone={phone}
                  fine={fine}
                  focus={focus}
                  onText={onText}
                  onMove={onMove}
                  onRemove={onRemove}
                />
              ))}
            </ol>
          ) : null}
          <div
            data-testid="compose-prompt-drop"
            style={{
              minHeight: 52,
              borderRadius: r.control,
              border: `1.5px dashed ${t.line}`,
              boxSizing: "border-box",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: "8px 12px",
              textAlign: "center",
              fontFamily: FIGTREE,
              fontSize: 14,
              color: t.text2,
            }}
          >
            <span>{lead}</span>
            <TextButton underline target={phone} onClick={onWrite}>
              write one
            </TextButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}
