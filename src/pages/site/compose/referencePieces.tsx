/* CA-19: the pieces only colour and references need, drawn from tokens. Windows, menus, fields, buttons and rows come
   from CA-15b's modalRecipes.tsx, which is not restyled; what is here is what the four boards ("References: the rules",
   "References: from the post", "References: the colour picker", "References: groups and the Colours window") draw that
   the recipes do not.

   - Ghost icon button: 28 square, radius 7, no fill until hovered (`--control-on`), a 14 glyph in `--text2`. Undo and
     Redo are a pair of them, greyed when there is nothing to do.
   - Notice: at the bottom of the window, 40 tall, `--window`, 1px `--window-border`, radius 10, padding 0 6 0 14, gap 14,
     13px; the sentence, then a small Undo. Six seconds, or until the next step.
   - Section label: the data face 11 in capitals, letter-spacing .04em, `--label`.
   - Inner panel: `--tile`, radius 8, padding 12 14, no border.
   - Swatches: a 12 square (radius 3), a 10 square, a 30 square (radius 7).
   - Group label: 20 tall, padding 0 7, radius 5, `--hairline`; a 7 dot and the name at 11.5, both in the group's colour
     through nameColourFor.
   - Danger words (Delete group, Clear all): `--breakage`, the existing danger text colour.

   The board measures that are not on the site's spacing scale (10, 14, 18) live here, as the recipe files keep theirs. */

import { useEffect, useRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";

import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { NOTICE_COPY, NOTICE_MS } from "@/lib/build/referenceHistory";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { nameColourFor, swatchFor } from "@/lib/theme/partColour";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { RecipeButton } from "./modalRecipes";

/* ── type ── */

export const words = (px: number, weight: 400 | 500 | 600, color: string, line?: number): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: line ? `${line}px` : "normal",
  color,
});

/** The data face at a size, in a colour. */
export const data = (px: number, color: string): CSSProperties => ({ fontFamily: DM_MONO, fontSize: px, fontWeight: 400, lineHeight: "normal", color, fontVariantNumeric: "tabular-nums" });

/** "REFERENCE GROUPS": the data face 11 in capitals, .04em apart, `--label`. */
export const SECTION_LABEL: CSSProperties = { fontFamily: DM_MONO, fontSize: 11, fontWeight: 400, lineHeight: "normal", color: t.label, textTransform: "uppercase", letterSpacing: "0.04em" };

/** The danger words: `--breakage`. */
export const DANGER = t.breakage;

export const ELLIPSIS: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };

/* ── measures the boards draw ── */

export const PAD = { panel: "12px 14px", section: "14px 18px", rows: "10px 18px", search: "0 18px 12px", list: "0 8px 10px", label: "12px 10px 6px", members: "0 10px 4px 32px", bar: "10px 14px", row: "0 10px", card: "16px 18px", notice: "0 6px 0 14px", head: "16px 18px 12px", foot: "12px 18px" } as const;
export const GAP = { notice: 14, picker: 16, column: 10, swatch: 8, panels: 8, row: 10 } as const;

/* ── the inner panel ── */

export function InnerPanel({ children, testId, style, bar }: { children: ReactNode; testId?: string; style?: CSSProperties; bar?: string }) {
  return (
    <div data-testid={testId} style={{ position: "relative", background: t.tile, borderRadius: 8, padding: PAD.panel, minWidth: 0, boxSizing: "border-box", overflow: "hidden", ...style }}>
      {/* A group's colour as a 3px bar down the left: a fill, never a coloured edge. */}
      {bar ? <span aria-hidden="true" data-group-bar="" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, ...swatchFor(bar) }} /> : null}
      {children}
    </div>
  );
}

/* ── swatches ── */

/** A square of a colour: 12 (radius 3), 10 (radius 2) or 30 (radius 7). Empty, it is a dashed square in `--label`. */
export function SquareSwatch({ colour, size = 12 }: { colour: string | null | undefined; size?: 10 | 12 | 30 }) {
  const radius = size === 30 ? 7 : size === 12 ? 3 : 2;
  return (
    <span
      aria-hidden="true"
      data-swatch-square={colour ?? "none"}
      style={{ width: size, height: size, borderRadius: radius, flexShrink: 0, boxSizing: "border-box", display: "inline-block", ...(colour ? swatchFor(colour) : { border: `1px dashed ${t.label}` }) }}
    />
  );
}

/* ── the group label (P5) ── */

/** A group's name on its members: a 7 dot and the name at 11.5, in the group's colour kept readable. Nothing for an unnamed group. */
export function GroupLabel({ name, colour, prefix, testId = "group-label", onClick }: { name?: string; colour: string; prefix?: string; testId?: string; onClick?: () => void }) {
  const theme = useResolvedTheme();
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  if (!name) return null;
  const ink = nameColourFor(colour, theme);
  const body = (
    <>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, ...swatchFor(ink) }} />
      <span style={{ ...words(11.5, 500, ink), ...ELLIPSIS }}>{prefix ? `${prefix} ${name}` : name}</span>
    </>
  );
  const look: CSSProperties = { boxSizing: "border-box", display: "inline-flex", alignItems: "center", gap: 6, height: 20, padding: "0 7px", borderRadius: 5, background: t.hairline, maxWidth: "100%", minWidth: 0, flexShrink: 1 };
  if (!onClick) {
    return (
      <span data-testid={testId} data-group-label={name} style={look}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      data-testid={testId}
      data-group-label={name}
      aria-label={`Reference group ${name}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      {...handlers}
      style={{ ...look, border: 0, cursor: "pointer", ...(state.hovered ? { background: t.controlOn } : null), ...ring(state.focusVisible) }}
    >
      {body}
    </button>
  );
}

/* ── ghost icon buttons, Undo and Redo ── */

export interface GhostIconProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  glyph: GlyphName;
  label: string;
  phone?: boolean;
  size?: 26 | 28;
  pressed?: boolean;
}

/** 28 square (26 where a board says), radius 7, no fill until hovered, a 14 glyph in `--text2`. */
export function GhostIcon({ glyph, label, phone = false, size = 28, pressed = false, disabled, style, ...rest }: GhostIconProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  const side = phone ? 44 : size;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      {...rest}
      {...handlers}
      style={{
        width: side,
        height: side,
        padding: 0,
        flexShrink: 0,
        boxSizing: "border-box",
        borderRadius: 7,
        border: `1px solid ${pressed ? t.segOnBorder : "transparent"}`,
        background: pressed || (state.hovered && !disabled) ? t.controlOn : "transparent",
        color: disabled ? t.textDisabled : state.hovered || pressed ? t.text : t.text2,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      <Glyph name={glyph} size={14} />
    </button>
  );
}

/** Undo and Redo, at the left of a footer: greyed when there is nothing to do. */
export function UndoRedo({ canUndo, canRedo, onUndo, onRedo, phone = false }: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; phone?: boolean }) {
  return (
    <span role="group" aria-label="History" data-testid="undo-redo" style={{ display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
      <GhostIcon glyph="undo" label={NOTICE_COPY.undo} phone={phone} disabled={!canUndo} onClick={onUndo} data-testid="history-undo" />
      <GhostIcon glyph="redo" label={NOTICE_COPY.redo} phone={phone} disabled={!canRedo} onClick={onRedo} data-testid="history-redo" />
    </span>
  );
}

/* ── the notice ── */

/** The sentence after a step, with Undo: six seconds, or until the next step. */
export function ReferenceNotice({ notice, onUndo, onDone, phone = false }: { notice: { sentence: string; n: number } | null; onUndo: () => void; onDone: () => void; phone?: boolean }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => done.current(), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return (
    <div
      role="status"
      data-testid="reference-notice"
      style={{
        position: "fixed",
        left: "50%",
        bottom: phone ? 16 : 24,
        transform: "translateX(-50%)",
        zIndex: 80,
        boxSizing: "border-box",
        height: 40,
        maxWidth: "calc(100vw - 32px)",
        display: "flex",
        alignItems: "center",
        gap: GAP.notice,
        padding: PAD.notice,
        background: t.window,
        border: `1px solid ${t.windowBorder}`,
        borderRadius: 10,
        boxShadow: t.windowShadow,
        ...words(13, 400, t.text),
      }}
    >
      <span style={ELLIPSIS}>{notice.sentence}</span>
      <RecipeButton small onClick={onUndo} data-testid="notice-undo">
        {NOTICE_COPY.undo}
      </RecipeButton>
    </div>
  );
}
