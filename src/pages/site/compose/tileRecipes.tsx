/* CA-15b P3: the tile pieces, at the sizes of the boards "Tiles: prompts, results and parts" and "Tiles: agents, decisions
   and sources". Every paint is a token. The List's tiles and the readers' tiles take their look from here. */

import type { CSSProperties, ButtonHTMLAttributes, ReactNode, Ref } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ModelMark } from "@/components/brand/ModelMark";
import { markFor } from "@/lib/models/marks";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { CONTROL, SELECTED, controlPaint } from "@/lib/theme/refinedControl";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { useCrossfade } from "./buildMotion";

const type = (px: number, weight: 400 | 500, color: string, line?: number): CSSProperties => ({ fontFamily: FIGTREE, fontSize: px, fontWeight: weight, lineHeight: line ? `${line}px` : "normal", color });
const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };
const clamp = (lines: number): CSSProperties => ({ display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" });

/** How far a tile's body and foot sit in: under the title, past the 22 badge and its 12 gap. */
export const TILE_INDENT = 34;

/* ── sessions ── */

/** "Session 1" 13/500. */
export const SESSION_NAME: CSSProperties = type(13, 500, t.text, 18);
/** The session's facts after its name, 8 apart: 12.5 `--label`. */
export const SESSION_META: CSSProperties = type(12.5, 400, t.label, 18);
/** The run: the session's tiles, gap 10, padded 14 from a 1px rule down the left. */
export const RUN: CSSProperties = { display: "flex", flexDirection: "column", gap: 10, minWidth: 0, paddingLeft: 14, borderLeft: `1px solid ${t.hairlineModule}`, marginTop: 10 };

/* ── the tile ── */

/** `--module`, 1px `--module-border`, radius 10, padding 14 16, a column with gap 8; the selected recipe over it when chosen. */
export const tileStyle = (selected = false): CSSProperties => ({
  background: t.module,
  border: `1px solid ${t.moduleBorder}`,
  borderRadius: 10,
  padding: "14px 16px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 0,
  ...(selected ? SELECTED : null),
});

export const TILE_HEAD: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 };
export const TILE_TEXT: CSSProperties = { display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 };
export const TILE_EYEBROW: CSSProperties = { ...type(11.5, 400, t.label, 16), ...ellipsis };
export const TILE_TITLE: CSSProperties = { ...type(14, 500, t.text, 20), margin: 0, ...ellipsis };

/** The number badge: 22 square, radius 5, the control recipe, the data face 11 `--text2`, 1 down. */
export function NumberBadge({ children }: { children: ReactNode }) {
  /* CA-22: when the number changes (a tile above went, or came) the old one fades out over the new. */
  const badge = useCrossfade<HTMLSpanElement>(typeof children === "string" || typeof children === "number" ? children : "");
  return (
    <span
      ref={badge}
      aria-hidden="true"
      data-testid="number-badge"
      style={{ ...CONTROL, boxSizing: "border-box", flexShrink: 0, minWidth: 22, height: 22, marginTop: 1, padding: "0 4px", borderRadius: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: DM_MONO, fontSize: 11, lineHeight: "normal", color: t.text2, fontVariantNumeric: "tabular-nums" }}
    >
      {children}
    </span>
  );
}

export interface TileOptionsProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  phone?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** The options button: 26 square, transparent, radius 6, the `more` glyph in `--label`; hover the control and `--text`. */
export function TileOptions({ label, phone = false, style, ...rest }: TileOptionsProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const side = phone ? 44 : 26;
  return (
    <button
      type="button"
      aria-label={label}
      {...rest}
      {...handlers}
      style={{
        boxSizing: "border-box",
        flexShrink: 0,
        width: side,
        height: side,
        padding: 0,
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        ...(state.hovered ? { ...controlPaint(state), color: t.text } : { background: "transparent", border: "1px solid transparent", color: t.label }),
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      <Glyph name="more" size={14} />
    </button>
  );
}

/** The body and the foot sit under the title. */
export const TILE_BODY: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, paddingLeft: TILE_INDENT, minWidth: 0 };
export const TILE_FOOT: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: 12, minHeight: 20, minWidth: 0 };
export const FOOT_FACTS: CSSProperties = { fontFamily: DM_MONO, fontSize: 11.5, lineHeight: "18px", color: t.label, fontVariantNumeric: "tabular-nums", flexGrow: 1, ...ellipsis };
export const FOOT_LINK: CSSProperties = { ...type(12, 500, t.text2), textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: tokenAlpha("label", 0.5) };

/* ── what a tile holds ── */

export const PROMPT_TEXT: CSSProperties = { ...type(13.5, 400, t.text, 21), margin: 0, overflowWrap: "anywhere", ...clamp(2) };
export const BODY_LINE: CSSProperties = { ...type(13, 400, t.text, 20), margin: 0, overflowWrap: "anywhere" };
export const QUIET_LINE: CSSProperties = { ...type(12.5, 400, t.text2, 18), margin: 0, overflowWrap: "anywhere" };

/** The response line: a 2px rule at its left, padded 12, 13/20 `--text2`, one line; "Response" in `--label`, 6 before. */
export const RESPONSE_LINE: CSSProperties = { ...type(13, 400, t.text2, 20), margin: 0, borderLeft: `2px solid ${t.hairlineModule}`, paddingLeft: 12, ...ellipsis };
/** "Response" and a space before the words: the space and 2.5 more make the board's 6. */
export const RESPONSE_WORD: CSSProperties = { color: t.label, marginRight: 2.5 };

/** The app's mark: 20 square (16 small), radius 5, the control recipe, the app's logo or its initials. */
export function AppMark({ name, small = false }: { name: string; small?: boolean }) {
  const side = small ? 16 : 20;
  return (
    <span
      aria-hidden="true"
      data-testid="app-mark"
      style={{ ...CONTROL, boxShadow: "none", boxSizing: "border-box", flexShrink: 0, width: side, height: side, borderRadius: 5, display: "inline-flex", alignItems: "center", justifyContent: "center", overflow: "hidden", fontFamily: DM_MONO, fontSize: 9.5, fontWeight: 500, color: t.text2 }}
    >
      {markFor({ tool: name }) ? <ModelMark tool={name} size={14} /> : name.trim().slice(0, 2).toUpperCase()}
    </span>
  );
}

/** A name with its app's mark before it, 8 apart: a tool's or a repository's title. */
export function MarkedName({ name, children }: { name: string; children: ReactNode }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <AppMark name={name} />
      <span style={ellipsis}>{children}</span>
    </span>
  );
}

/** A picture's frame: 56 square, radius 6, `--tile`, 1px `--window-border`. */
export const PICTURE: CSSProperties = { width: 56, height: 56, flexShrink: 0, boxSizing: "border-box", borderRadius: 6, background: t.tile, border: `1px solid ${t.windowBorder}`, overflow: "hidden", display: "inline-flex", alignItems: "center", justifyContent: "center", color: t.label };
export const PICTURES: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" };
export const MORE_COUNT: CSSProperties = { ...type(12.5, 400, t.text2), fontVariantNumeric: "tabular-nums" };

/** A link card: a row, gap 10, padding 8 10, radius 8, a hairline edge, `--surface`. */
export const LINK_CARD: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: `1px solid ${t.hairlineModule}`, background: t.surface, textDecoration: "none", boxSizing: "border-box", minWidth: 0 };
export const LINK_ADDRESS: CSSProperties = { fontFamily: DM_MONO, fontSize: 12, lineHeight: "18px", color: t.text, ...ellipsis };

/** A found line: space-between, padding 8 10, radius 8, `--surface`, a hairline edge; its words 12.5 `--text2`. */
export const FOUND_LINE: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 10px", borderRadius: 8, background: t.surface, border: `1px solid ${t.hairlineModule}`, minWidth: 0, ...type(12.5, 400, t.text2, 18) };

/** The small code well: a 28 gutter, the data face 12/18, padded 8 0. */
export function SmallCodeWell({ text, lines = 3, testId = "code-lines", label }: { text: string; lines?: number; testId?: string; label?: string }) {
  const shown = text.replace(/(\r?\n)+$/, "").split(/\r?\n/).slice(0, lines);
  return (
    <div
      role="region"
      aria-label={label}
      data-testid="code-well-small"
      style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", background: t.well, border: `1px solid ${t.wellBorder}`, borderRadius: 8, boxShadow: t.wellShadow, padding: "8px 0", fontFamily: DM_MONO, fontSize: 12, lineHeight: "18px", minWidth: 0, overflow: "hidden" }}
    >
      <span aria-hidden="true" data-testid="code-gutter-numbers" style={{ whiteSpace: "pre", textAlign: "right", paddingRight: 8, color: t.label, borderRight: `1px solid ${t.hairline}`, fontVariantNumeric: "tabular-nums" }}>
        {shown.map((_, at) => at + 1).join("\n")}
      </span>
      <pre data-testid={testId} style={{ margin: 0, paddingLeft: 10, color: t.text, overflowX: "auto", fontFamily: DM_MONO, fontSize: 12, lineHeight: "18px" }}>
        {shown.join("\n")}
      </pre>
    </div>
  );
}

/** Steps: a numbered list padded 18, 13.5/21. */
export const STEPS: CSSProperties = { margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", ...type(13.5, 400, t.text, 21) };

/** A list: `--surface`, a hairline edge, radius 8; rows padded 7 10, space-between, a hairline between them. */
export const LIST_BOX: CSSProperties = { listStyle: "none", margin: 0, padding: 0, background: t.surface, border: `1px solid ${t.hairlineModule}`, borderRadius: 8, minWidth: 0 };
export const listRow = (first: boolean): CSSProperties => ({ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "7px 10px", minWidth: 0, ...(first ? null : { borderTop: `1px solid ${t.hairline}` }) });

/** A variable in a line of text: the data face 12, padded 0 4, radius 4, the control recipe, `--text`. */
export const VARIABLE: CSSProperties = { ...CONTROL, boxShadow: "none", fontFamily: DM_MONO, fontSize: 12, lineHeight: "18px", padding: "0 4px", borderRadius: 4, display: "inline-block", color: t.text, whiteSpace: "nowrap" };

/** A data-face line in a tile's body (a decision's answer, a dataset's columns). */
export const DATA_LINE: CSSProperties = { fontFamily: DM_MONO, fontSize: 12, lineHeight: "18px", color: t.text, fontVariantNumeric: "tabular-nums", ...ellipsis };
