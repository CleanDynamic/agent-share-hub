/* CodeFileBlock: one file, drawn like a file in a GitHub diff.

   The Add code dialog (editable) and the code window on the build page (read-only) share it, so a file looks the same
   wherever it is met.

   - Header: a chevron that collapses the block, the file name in the data face (an inline text field when editable),
     the line count as "+N" in `--evidence`, and a plain "Copy" that copies the whole file, always visible.
   - Body: a line-number gutter, then the code in the data face, highlighted. Every line is an added line, so the body is
     `--evidence-fill` with a solid `--evidence` rail down its left edge. Both are theme tokens, so Noon and Dusk each
     get their own green.
   - Thin border, `--r-control` radius, no shadow, no gradient, no blur.
   - Read-only: past 30 lines the first 30 show, with a "Show all N lines" row under them. Editable: no line limit; the block
     grows with the text up to 60% of the viewport (520px at most), then scrolls inside itself.

   EDITING is a transparent <textarea> laid exactly over the highlighted <pre>. Both set the same text in the same font,
   size, line height, padding and tab size, and the <pre> is what gives the stack its width and height (the textarea is
   `position: absolute; inset: 0`), so the text stays native: caret, selection, undo, IME and paste are the browser's.
   `index.css` paints every textarea with a fill, a border and an ink marked !important, and only a ref can outrank
   that, so `bareArea` writes three important declarations. A desktop textarea inherits its size (`font-size: inherit
   !important`), which is why the root sets the size and the phone's 16 (no iOS zoom) is passed in as `phone`.

   NOTHING HERE RUNS CODE. The highlighter is loaded lazily (`highlighter.tsx`). */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import type { CodeLanguage } from "@/lib/build/graph";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { loadHighlighter, renderTree, type Highlight } from "./highlighter";

/** Lines shown before "Show all N lines". */
export const CODE_BLOCK_PREVIEW_LINES = 30;
/** Rows an empty editor holds, so it reads as a place to paste. */
const EDITOR_MIN_ROWS = 6;
const INDENT_TEXT = "  ";
/** The editor grows with its text up to this, then scrolls inside the block (the gutter scrolls with it), so Add stays in reach. */
const EDITOR_MAX_HEIGHT = "min(60dvh, 520px)";

export const CODE_BLOCK_COPY = {
  collapse: "Collapse file",
  expand: "Expand file",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Couldn't copy",
  showAll: (n: number) => `Show all ${n} lines`,
  fileName: "File name",
  code: "Code",
} as const;

/** Lines in a text: one more than its line breaks, none for empty text, a last empty line not counted. */
export function countLines(source: string): number {
  if (!source) return 0;
  return source.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

export interface CodeFileBlockProps {
  filename: string;
  source: string;
  language: CodeLanguage;
  /** With `onSourceChange` the block is an editor; without, it is read-only. */
  onSourceChange?: (source: string) => void;
  onFilenameChange?: (filename: string) => void;
  filenamePlaceholder?: string;
  filenameMax?: number;
  /** The accessible names of the two fields (editable). */
  filenameLabel?: string;
  codeLabel?: string;
  codePlaceholder?: string;
  /** A phone: 44px targets, and the editor's text at 16 so the browser does not zoom. */
  phone?: boolean;
  /** Lines before "Show all". Read-only only. */
  previewLines?: number;
  "data-testid"?: string;
}

/** Make a textarea draw nothing but its caret and selection. See the header. */
function bareArea(element: HTMLTextAreaElement | null): void {
  if (!element) return;
  element.style.setProperty("background", "transparent", "important");
  element.style.setProperty("border-width", "0", "important");
  element.style.setProperty("color", "transparent", "important");
}

/** The highlighted tree for a text, once the highlighter has loaded; null until then (plain text). */
function useHighlighted(source: string, language: CodeLanguage) {
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  useEffect(() => {
    if (language === "other") return;
    let live = true;
    void loadHighlighter().then((loaded) => {
      if (live) setHighlight(() => loaded);
    });
    return () => {
      live = false;
    };
  }, [language]);
  return useMemo(() => {
    const tree = highlight ? highlight(source, language) : null;
    return tree ? renderTree(tree) : null;
  }, [highlight, source, language]);
}

export function CodeFileBlock({
  filename,
  source,
  language,
  onSourceChange,
  onFilenameChange,
  filenamePlaceholder,
  filenameMax,
  filenameLabel = CODE_BLOCK_COPY.fileName,
  codeLabel = CODE_BLOCK_COPY.code,
  codePlaceholder,
  phone = false,
  previewLines = CODE_BLOCK_PREVIEW_LINES,
  "data-testid": testId,
}: CodeFileBlockProps) {
  const editable = Boolean(onSourceChange);
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [said, setSaid] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copyButton = useInteractive<HTMLButtonElement>();
  const chevronButton = useInteractive<HTMLButtonElement>();
  const showButton = useInteractive<HTMLButtonElement>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const size = editable && phone ? 16 : 12.5;
  const lineHeight = editable && phone ? 24 : 20;
  const padY = 8;

  /* A CR from an uploaded file would draw as a stray mark; the file keeps its own breaks for Copy. */
  const text = source.replace(/\r\n?/g, "\n");
  const total = countLines(text);
  const lines = text.split("\n");
  const clipped = !editable && !showAll && total > previewLines;
  const shown = editable ? text : clipped ? lines.slice(0, previewLines).join("\n") : total === 0 ? "" : text.replace(/\n$/, "");
  const rows = editable ? Math.max(lines.length, EDITOR_MIN_ROWS) : clipped ? previewLines : Math.max(total, 1);
  const gutterWidth = `${String(rows).length}ch`;

  const tree = useHighlighted(shown, language);

  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(source);
      setSaid(CODE_BLOCK_COPY.copied);
    } catch {
      setSaid(CODE_BLOCK_COPY.copyFailed);
    }
    timer.current = setTimeout(() => setSaid(""), 1800);
  };

  const onTab = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab" || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    const box = event.currentTarget;
    const { selectionStart: start, selectionEnd: end, value } = box;
    onSourceChange?.(`${value.slice(0, start)}${INDENT_TEXT}${value.slice(end)}`);
    requestAnimationFrame(() => box.setSelectionRange(start + INDENT_TEXT.length, start + INDENT_TEXT.length));
  };

  const target = phone ? 44 : 28;
  const headerButton: CSSProperties = {
    appearance: "none",
    border: 0,
    margin: 0,
    padding: 0,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    height: target,
    borderRadius: 4,
    fontFamily: FIGTREE,
    color: t.text2,
  };
  const monoCell: CSSProperties = { fontFamily: DM_MONO, fontSize: size, lineHeight: `${lineHeight}px`, tabSize: 2 };

  return (
    <div
      data-testid={testId}
      data-open={open ? "true" : "false"}
      style={{
        border: `1px solid ${t.moduleBorder}`,
        borderRadius: r.control,
        background: t.module,
        overflow: "hidden",
        minWidth: 0,
        fontSize: size,
        color: t.text,
      }}
    >
      <div
        data-testid="code-block-header"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          minHeight: phone ? 48 : 36,
          padding: "0 4px 0 4px",
          background: t.tile,
          borderBottom: open ? `1px solid ${t.tileBorder}` : 0,
        }}
      >
        <button
          type="button"
          aria-label={open ? CODE_BLOCK_COPY.collapse : CODE_BLOCK_COPY.expand}
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
          {...chevronButton.handlers}
          style={{ ...headerButton, width: target, background: chevronButton.state.hovered ? t.controlOn : "transparent" }}
        >
          <Glyph name={open ? "chevd" : "chev"} size={16} />
        </button>
        {onFilenameChange ? (
          <input
            type="text"
            aria-label={filenameLabel}
            value={filename}
            maxLength={filenameMax}
            placeholder={filenamePlaceholder}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => onFilenameChange(event.target.value)}
            style={{ ...monoCell, flex: "1 1 120px", minWidth: 0, height: phone ? 44 : 26, padding: "0 8px", boxSizing: "border-box", lineHeight: "normal" }}
          />
        ) : (
          <span data-testid="code-block-name" style={{ ...monoCell, flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {filename}
          </span>
        )}
        <span data-testid="code-block-count" style={{ ...monoCell, flexShrink: 0, color: t.evidence, fontVariantNumeric: "tabular-nums", padding: "0 4px" }}>
          {`+${total}`}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          {...copyButton.handlers}
          style={{ ...headerButton, padding: "0 8px", fontSize: 12.5, fontWeight: 500, color: t.text, background: copyButton.state.hovered ? t.controlOn : "transparent" }}
        >
          {said === CODE_BLOCK_COPY.copied ? CODE_BLOCK_COPY.copied : CODE_BLOCK_COPY.copy}
        </button>
        <span role="status" style={VISUALLY_HIDDEN}>
          {said}
        </span>
      </div>

      {open ? (
        <>
          <div
            data-testid="code-block-body"
            style={{ display: "flex", background: t.evidenceFill, borderLeft: `3px solid ${t.evidence}`, minWidth: 0, ...(editable ? { maxHeight: EDITOR_MAX_HEIGHT, overflowY: "auto" } : null) }}
          >
            <pre
              aria-hidden="true"
              data-testid="code-block-gutter"
              style={{ ...monoCell, margin: 0, padding: `${padY}px 8px ${padY}px 10px`, minWidth: gutterWidth, textAlign: "right", color: t.text2, userSelect: "none", flexShrink: 0, alignSelf: "flex-start", fontVariantNumeric: "tabular-nums" }}
            >
              {Array.from({ length: rows }, (_, index) => index + 1).join("\n")}
            </pre>
            <div
              {...(editable ? null : { role: "region", "aria-label": filename || codeLabel, tabIndex: 0 })}
              style={{ flexGrow: 1, minWidth: 0, overflowX: "auto", alignSelf: "flex-start" }}
            >
              <div style={{ position: "relative", minWidth: "100%", width: "max-content", minHeight: editable ? EDITOR_MIN_ROWS * lineHeight + padY * 2 : undefined }}>
                <pre
                  aria-hidden={editable ? "true" : undefined}
                  data-testid="code-block-code"
                  style={{ ...monoCell, margin: 0, padding: `${padY}px 12px`, whiteSpace: "pre", color: t.text, background: "transparent" }}
                >
                  {editable && !text ? (
                    <span style={{ color: t.text2 }}>{codePlaceholder}</span>
                  ) : (
                    <>
                      {tree ?? shown}
                      {editable ? "\n" : null}
                    </>
                  )}
                </pre>
                {editable ? (
                  <textarea
                    ref={bareArea}
                    aria-label={codeLabel}
                    data-testid="code-well"
                    wrap="off"
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    value={source}
                    onChange={(event) => onSourceChange?.(event.target.value)}
                    onKeyDown={onTab}
                    style={{
                      ...monoCell,
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      margin: 0,
                      padding: `${padY}px 12px`,
                      boxSizing: "border-box",
                      resize: "none",
                      overflow: "hidden",
                      whiteSpace: "pre",
                      borderRadius: 0,
                      caretColor: t.text,
                      outlineOffset: -2,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
          {clipped ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              {...showButton.handlers}
              style={{
                ...headerButton,
                width: "100%",
                height: phone ? 44 : 32,
                borderRadius: 0,
                borderTop: `1px solid ${t.tileBorder}`,
                background: showButton.state.hovered ? t.controlOn : t.tile,
                color: t.text,
                fontSize: 12.5,
                fontWeight: 500,
              }}
            >
              {CODE_BLOCK_COPY.showAll(total)}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default CodeFileBlock;
