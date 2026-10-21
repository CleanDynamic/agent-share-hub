/* CA-11 — a code box with a line number gutter, used wherever code is typed.

   One well (the well recipe) holding two columns: the gutter (`CodeGutter`) and the textarea, with no border of its
   own, `white-space: pre`, no wrapping, scrolling sideways. Wrapping stays off because it would break one number per
   line. Both columns use the same font, size and line height (13/20, 16/24 on a phone, so iOS does not zoom).

   The gutter follows the textarea's vertical scroll straight from the scroll event (no state). Tab puts in 2 spaces,
   Shift+Tab takes up to 2 from the start of each selected line, Enter keeps the line's leading spaces. Edits go through
   `execCommand("insertText")` where the browser has it, so undo still works, and through `onChange` where it doesn't.

   The caret's line is the only state that follows typing, and it only re-renders when the line changes. The numbers
   are rebuilt only when the line count changes. */

import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { focusRing } from "@/lib/theme/focus";
import { WELL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { CodeGutter } from "./CodeGutter";
import { CODE_PAD_Y, codeFont, codeMetrics, lineAt, lineStarts, numberedLines } from "./lineModel";

/** How tall the box is, in lines: it grows with the code between these, then scrolls. */
export const EDITOR_ROWS = { computer: { min: 12, max: 24 }, phone: { min: 8, max: 14 } } as const;

const INDENT = "  ";

export interface CodeEditorFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  /** Defaults to "code-well". */
  testId?: string;
  ariaLabel?: string;
  maxLength?: number;
  /** Override the height range, in lines, for a short field. */
  rows?: { min: number; max: number };
  onBlur?: () => void;
}

export function CodeEditorField({ value, onChange, id, placeholder, testId = "code-well", ariaLabel, maxLength, rows, onBlur }: CodeEditorFieldProps) {
  const phone = useIsPhone();
  const metrics = codeMetrics(phone);
  const box = useRef<HTMLTextAreaElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const pending = useRef<{ start: number; end: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const [caret, setCaret] = useState(1);

  const count = numberedLines(value);
  const range = rows ?? (phone ? EDITOR_ROWS.phone : EDITOR_ROWS.computer);
  const shown = Math.min(range.max, Math.max(range.min, count));
  const height = shown * metrics.lineHeight + CODE_PAD_Y * 2;

  const follow = useCallback(() => {
    const el = box.current;
    if (el && inner.current) inner.current.style.transform = `translateY(${-el.scrollTop}px)`;
  }, []);

  const track = useCallback(() => {
    const el = box.current;
    if (el) setCaret(lineAt(el.value, el.selectionStart));
  }, []);

  /* After every value change (a paste, a replaced value) the gutter is put where the code is, and a selection a
     keystroke asked for is applied. */
  useLayoutEffect(() => {
    const el = box.current;
    if (el && pending.current) {
      el.setSelectionRange(pending.current.start, pending.current.end);
      pending.current = null;
    }
    follow();
    track();
  }, [value, follow, track]);

  /** Replace [from, to) with `text` and leave the selection at [start, end). */
  const replace = (from: number, to: number, text: string, start: number, end: number) => {
    const el = box.current;
    if (!el) return;
    el.setSelectionRange(from, to);
    let done = false;
    try {
      done = typeof document.execCommand === "function" && document.execCommand("insertText", false, text);
    } catch {
      done = false;
    }
    if (done) {
      el.setSelectionRange(start, end);
      return;
    }
    pending.current = { start, end };
    onChange(`${el.value.slice(0, from)}${text}${el.value.slice(to)}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey || event.nativeEvent.isComposing) return;
    const el = event.currentTarget;
    const { selectionStart: start, selectionEnd: end, value: text } = el;

    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      replace(start, end, INDENT, start + INDENT.length, start + INDENT.length);
      return;
    }

    if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      const starts = lineStarts(text);
      const first = lineAt(text, start) - 1;
      // A selection that ends at the start of a line does not take that line in.
      const last = Math.max(first, lineAt(text, end > start && starts.includes(end) ? end - 1 : end) - 1);
      let removedFirst = 0;
      let removedAll = 0;
      const pieces: string[] = [];
      for (let i = first; i <= last; i += 1) {
        const from = starts[i];
        const to = i + 1 < starts.length ? starts[i + 1] : text.length;
        const line = text.slice(from, to);
        const cut = Math.min(INDENT.length, /^ */.exec(line)?.[0].length ?? 0);
        if (i === first) removedFirst = cut;
        removedAll += cut;
        pieces.push(line.slice(cut));
      }
      if (removedAll === 0) return;
      const from = starts[first];
      const to = last + 1 < starts.length ? starts[last + 1] : text.length;
      replace(from, to, pieces.join(""), Math.max(from, start - removedFirst), Math.max(from, end - removedAll));
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const lineStart = lineStarts(text)[lineAt(text, start) - 1];
      const spaces = /^ */.exec(text.slice(lineStart, start))?.[0] ?? "";
      const inserted = `\n${spaces}`;
      replace(start, end, inserted, start + inserted.length, start + inserted.length);
    }
  };

  const gotoLine = (line: number) => {
    const el = box.current;
    if (!el) return;
    const at = lineStarts(el.value)[line - 1] ?? 0;
    el.focus();
    el.setSelectionRange(at, at);
    setCaret(line);
  };

  return (
    <div
      data-testid={`${testId}-box`}
      style={{
        ...WELL,
        borderRadius: 6,
        boxSizing: "border-box",
        display: "flex",
        width: "100%",
        height: height + 2,
        overflow: "hidden",
        ...codeFont(DM_MONO, metrics),
        color: t.text,
        ...(focused ? focusRing : null),
      }}
    >
      <CodeGutter ref={inner} count={count} metrics={metrics} font={DM_MONO} active={focused ? caret : null} fill={t.well} onPointerLine={gotoLine} />
      <textarea
        ref={box}
        id={id}
        data-testid={testId}
        aria-label={ariaLabel}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        wrap="off"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        inputMode="text"
        enterKeyHint="enter"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onScroll={follow}
        onSelect={track}
        onKeyUp={track}
        onClick={track}
        onFocus={() => {
          setFocused(true);
          track();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        /* index.css paints every textarea with a fill, a border and a focus ring; the well draws all three here. */
        className="!bg-transparent !border-0 !rounded-none focus-visible:!outline-none focus-visible:!shadow-none"
        style={{
          ...codeFont(DM_MONO, metrics),
          flex: "1 1 0",
          minWidth: 0,
          height: "100%",
          margin: 0,
          padding: `${CODE_PAD_Y}px 8px`,
          boxSizing: "border-box",
          whiteSpace: "pre",
          overflowX: "auto",
          overflowY: "auto",
          resize: "none",
          tabSize: 2,
          color: t.text,
        }}
      />
    </div>
  );
}
