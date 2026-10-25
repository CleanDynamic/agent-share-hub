/* CA-15b P1: one set of modal recipes. Every tile modal is built from these pieces and sets no colour, size or radius of
   its own (`lookRules.test.ts` holds the modal files to that).

   The pieces, as the boards draw them (Dusk; every paint is a token, so Noon follows):

   - Frame: `--window`, 1px `--window-border`, radius 12, `--window-shadow`, overflow hidden. 560 wide, or 640 for the
     prompt window, code and decision. At most the window's height less 80: the header and footer stay, the middle scrolls.
   - Header: padding 20 20 18; the title 15/500 on 20; the subtitle 13/18 `--text2`, 4 below; icon buttons at the top right,
     6 apart.
   - Icon button: 28 square, radius 7, the control recipe, a 14 glyph in `--text2`; hover `--control-on` and `--text`.
   - Row: a 148 label column and the control, gap 16, centred, padding 12 20, a 1px `--hairline-module` rule above.
     "Top-aligned" puts the label 7 down; "no rule" drops the rule (straight after a group heading).
   - Label 13/18 `--text2`; strong label `--text` 500; hint 12/16 `--label`, 2 under its label; count in the data face,
     11.5 `--label`.
   - Block: padding 14 20 16, a rule above. Its head: the strong label at the left, then the count and small buttons at the
     right, 12 apart, at least 28 tall, 10 above the content.
   - Field: 32 tall, padding 0 10, the well, radius 8, 13 `--text`, placeholder `--label`. Focus: the border and a 1px ring
     in `--focus-ring`. A text area is a field padded 9 10 on 20, as tall as its rows.
   - Picker field: a field drawn as a button, the value (or the placeholder in `--label`) at the left and a 14 chevron at
     the right. Never a white button with centred words.
   - Segmented: the track (`--seg-track`, `--seg-border`, radius 8, padding 2, gap 2); items share the width, 28 tall,
     12.5 `--text2`, one line; the chosen one is `--control-on` with a `--seg-on-border` edge. Items that do not fit wrap
     onto a second line of the same height.
   - Option grid: three columns, gap 6; each option 32 tall, left-aligned, one line with an ellipsis, 1px
     `--window-border`, radius 8, 12.5 `--text2`. Hover `--tile`. Chosen: the selected recipe and `--text`.
   - Button: 32 tall, padding 0 12, radius 8, the control recipe, 13/500. Small: 28, padding 0 10, 12.5. Primary: the
     `PRIMARY` recipe. A disabled primary is the control with its words in `--text-disabled`.
   - Text link: 12.5 `--text2`, underlined 3 below in `--label` at half strength; hover `--text`.
   - Tag: 22 tall, padding 0 7, the control recipe, radius 5, the data face 11 `--text2`.
   - Optional section and rows: drawn by `OptionalSection.tsx` from the styles here.
   - Footer: padding 14 20, a rule above, `--window-foot`; a note at 12.5 `--label`, buttons at the right, 8 apart.
   - Group heading: padding 16 20 4, a rule above, 14/500/20 `--text`.
   - Panel: `--surface`, 1px `--hairline-module`, radius 10; its question field rows (96 label column, gap 12, padding 10 0,
     a `--hairline` rule above), option rows (16, 120, the rest, 28; gap 8) and fact rows (space-between, padding 9 14,
     13px, the key `--text2`, the value in the data face 12.5 `--text`).
   - Drop zone: 148 tall, the well, a 1px dashed `--seg-on-border` edge, radius 10; the words 13 `--text2`, then a small
     button, 10 apart.
   - Code well: the code editor field's own well and gutter (CA-11).

   Phones (under 768), which the boards do not draw: the same pieces in the existing `BottomSheet`. A row's label sits above
   its control, 6 apart; the option grid has two columns; fields and buttons are 44 tall at 16px; the footer stays at the
   bottom of the sheet. */

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";

import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { CONTROL, PRIMARY, SELECTED, WELL, controlPaint } from "@/lib/theme/refinedControl";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

/* ── sizes ── */

export const MODAL_WIDTH = { standard: 560, wide: 640 } as const;

/** The side padding every row, block and optional row carries inside a modal. */
export const MODAL_PAD = 20;

/**
 * How far a row pads itself in from the window's edges. A modal's form provides 20 (its rows run edge to edge and pad
 * themselves); anywhere else (Details, a sheet) it is 0 and the rows sit in their container's own padding.
 */
export const ModalInset = createContext(0);
export const useModalInset = (): number => useContext(ModalInset);

/* ── type ── */

const type = (px: number, weight: 400 | 500, color: string, line?: number): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: line ? `${line}px` : "normal",
  color,
});

export const TITLE: CSSProperties = { ...type(15, 500, t.text, 20), margin: 0 };
export const SUBTITLE: CSSProperties = { ...type(13, 400, t.text2, 18), margin: "4px 0 0" };
export const LABEL: CSSProperties = type(13, 400, t.text2, 18);
export const STRONG_LABEL: CSSProperties = type(13, 500, t.text, 18);
export const HINT: CSSProperties = type(12, 400, t.label, 16);
export const COUNT: CSSProperties = { fontFamily: DM_MONO, fontSize: 11.5, fontWeight: 400, lineHeight: "16px", color: t.label, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
export const GROUP_TITLE: CSSProperties = { ...type(14, 500, t.text, 20), margin: 0 };
export const NOTE: CSSProperties = type(12.5, 400, t.label, 18);
/** Plain words inside a modal's body (a file's name, a line the modal says). */
export const BODY_TEXT: CSSProperties = type(13, 400, t.text, 18);
export const DATA_FACE: CSSProperties = { fontFamily: DM_MONO };
export const ELLIPSIS: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };

const rule = (edge: string = t.hairlineModule): CSSProperties => ({ borderTop: `1px solid ${edge}` });

/* ── the frame ── */

export const frameStyle = (width: number): CSSProperties => ({
  width,
  maxWidth: "calc(100vw - 32px)",
  maxHeight: "calc(100dvh - 80px)",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  padding: 0,
  borderRadius: 12,
  background: t.window,
  border: `1px solid ${t.windowBorder}`,
  boxShadow: t.windowShadow,
  color: t.text,
  fontFamily: FIGTREE,
});

export const HEADER: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 12, padding: "20px 20px 18px", flexShrink: 0 };
export const HEADER_TEXT: CSSProperties = { display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 };
export const HEADER_ICONS: CSSProperties = { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 };

/** The middle: every row and block pads itself, so the body has none; it scrolls on a computer. */
export const bodyStyle = (phone: boolean): CSSProperties =>
  phone ? { display: "flex", flexDirection: "column", minWidth: 0 } : { display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, overflowY: "auto", minWidth: 0 };

export const footerStyle = (phone: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
  ...rule(),
  background: t.windowFoot,
  ...(phone
    ? { position: "sticky", bottom: 0, padding: "12px 0", marginTop: 12, flexWrap: "wrap", zIndex: 1 }
    : { padding: "14px 20px" }),
});

/** The footer's note, at the left: it takes the room the buttons leave. */
export const FOOT_NOTE: CSSProperties = { ...NOTE, flexGrow: 1, minWidth: 0, overflowWrap: "anywhere" };

/* ── icon button ── */

export interface IconSquareProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  glyph: GlyphName;
  label: string;
  phone?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** 28 square, radius 7, the control recipe, a 14 glyph in `--text2` (44 on a phone). */
export function IconSquare({ glyph, label, phone = false, style, ...rest }: IconSquareProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled: rest.disabled });
  const side = phone ? 44 : 28;
  return (
    <button
      type="button"
      aria-label={label}
      data-hit=""
      {...rest}
      {...handlers}
      style={{
        ...controlPaint(state),
        width: side,
        height: side,
        padding: 0,
        flexShrink: 0,
        boxSizing: "border-box",
        borderRadius: 7,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: state.hovered ? t.text : t.text2,
        cursor: rest.disabled ? "default" : "pointer",
        ...(rest.disabled ? { filter: t.dimFilter } : null),
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      <Glyph name={glyph} size={14} />
    </button>
  );
}

/* ── rows and blocks ── */

export interface RowProps {
  label: string;
  /** The control's id, so the label points at it. With `group`, the id the group is named by. */
  id: string;
  group?: boolean;
  /** One grey line under the label ("Credited on the build page"). */
  hint?: string;
  /** The label sits 7 down, for a control taller than one line. */
  top?: boolean;
  /** No rule above: straight after a group heading. */
  noRule?: boolean;
  phone: boolean;
  testId?: string;
  children: ReactNode;
}

/** A short field: its label in a 148 column, its control beside it; stacked on a phone. */
export function Row({ label, id, group = false, hint, top = false, noRule = false, phone, testId = "field-row", children }: RowProps) {
  const inset = useModalInset();
  const labelBlock = (
    <span style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: top && !phone ? 7 : 0, minWidth: 0 }}>
      {group ? (
        <span id={id} style={LABEL}>
          {label}
        </span>
      ) : (
        <label htmlFor={id} style={LABEL}>
          {label}
        </label>
      )}
      {hint ? <span style={HINT}>{hint}</span> : null}
    </span>
  );
  return (
    <div
      role={group ? "group" : undefined}
      aria-labelledby={group ? id : undefined}
      data-testid={testId}
      style={{
        display: "grid",
        gridTemplateColumns: phone ? "minmax(0, 1fr)" : "148px minmax(0, 1fr)",
        columnGap: 16,
        rowGap: 6,
        alignItems: top || phone ? "start" : "center",
        padding: `12px ${inset}px`,
        minWidth: 0,
        ...(noRule ? null : rule()),
      }}
    >
      {labelBlock}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export interface BlockProps {
  /** Names the block for a screen reader when it is a group. */
  label?: string;
  noRule?: boolean;
  testId?: string;
  children: ReactNode;
}

/** A full-width block: padding 14 20 16, a rule above. */
export function Block({ label, noRule = false, testId, children }: BlockProps) {
  const inset = useModalInset();
  return (
    <div
      role={label ? "group" : undefined}
      aria-label={label}
      data-testid={testId}
      style={{ display: "flex", flexDirection: "column", gap: 10, padding: `14px ${inset}px 16px`, minWidth: 0, ...(noRule ? null : rule()) }}
    >
      {children}
    </div>
  );
}

export interface BlockHeadProps {
  /** The strong label at the left. */
  label: string;
  /** The control it names: the label is a `<label>` for it. */
  htmlFor?: string;
  /** An id for the label, so a group can be named by it. */
  id?: string;
  /** Draw the label as a group title (14/500), as the decision's "Questions". */
  heading?: boolean;
  /** At the right, in the data face. */
  count?: ReactNode;
  countTestId?: string;
  /** Small buttons at the right, after the count. */
  children?: ReactNode;
}

export function BlockHead({ label, htmlFor, id, heading = false, count, countTestId, children }: BlockHeadProps) {
  const style = heading ? GROUP_TITLE : STRONG_LABEL;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 28, minWidth: 0 }}>
      {htmlFor ? (
        <label id={id} htmlFor={htmlFor} style={{ ...style, flexGrow: 1, minWidth: 0 }}>
          {label}
        </label>
      ) : heading ? (
        <h3 id={id} style={{ ...style, flexGrow: 1, minWidth: 0 }}>
          {label}
        </h3>
      ) : (
        <span id={id} style={{ ...style, flexGrow: 1, minWidth: 0 }}>
          {label}
        </span>
      )}
      {count !== undefined && count !== null && count !== "" ? (
        <span data-testid={countTestId} style={COUNT}>
          {count}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** A hint line under a control or a block's content. */
export function Hint({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <span data-testid={testId} style={HINT}>
      {children}
    </span>
  );
}

/** A count on its own line, in the data face (the board's "No variables yet"). */
export function Count({ children, testId, style }: { children: ReactNode; testId?: string; style?: CSSProperties }) {
  return (
    <span data-testid={testId} style={{ ...COUNT, ...style }}>
      {children}
    </span>
  );
}

/** A group heading: padding 16 20 4, a rule above, 14/500. */
export function GroupHeading({ children, id }: { children: ReactNode; id?: string }) {
  const inset = useModalInset();
  return (
    <div style={{ padding: `16px ${inset}px 4px`, ...rule() }}>
      <h3 id={id} style={GROUP_TITLE}>
        {children}
      </h3>
    </div>
  );
}

/* ── fields ── */

export const fieldStyle = (phone: boolean, extra: CSSProperties = {}): CSSProperties => ({
  ...WELL,
  boxSizing: "border-box",
  width: "100%",
  height: phone ? 44 : 32,
  padding: "0 10px",
  borderRadius: 8,
  ...type(phone ? 16 : 13, 400, t.text),
  ...extra,
});

export const areaStyle = (phone: boolean, rows: number, extra: CSSProperties = {}): CSSProperties => ({
  ...WELL,
  boxSizing: "border-box",
  width: "100%",
  minHeight: rows * 20 + 20,
  padding: "9px 10px",
  borderRadius: 8,
  resize: "vertical",
  ...type(phone ? 16 : 13, 400, t.text, 20),
  ...extra,
});

/** Focus: the border and a 1px ring in `--focus-ring`, drawn while the field has focus. */
export const FIELD_FOCUS: CSSProperties = { borderColor: t.focusRing, outline: `1px solid ${t.focusRing}`, outlineOffset: 0 };

function useFocused<E extends HTMLElement>(onFocus?: (event: React.FocusEvent<E>) => void, onBlur?: (event: React.FocusEvent<E>) => void) {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    onFocus: (event: React.FocusEvent<E>) => {
      setFocused(true);
      onFocus?.(event);
    },
    onBlur: (event: React.FocusEvent<E>) => {
      setFocused(false);
      onBlur?.(event);
    },
  };
}

export interface FieldInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "style" | "width"> {
  phone: boolean;
  /** The data face (Geist Mono): keys, versions, paths, addresses. */
  mono?: boolean;
  /** A fixed width in px; absent, it fills its column. */
  width?: number;
  ref?: Ref<HTMLInputElement>;
}

/** A field: 32 tall, the well, radius 8 (44 and 16px on a phone). */
export function FieldInput({ phone, mono = false, width, onFocus, onBlur, type: kind = "text", ...rest }: FieldInputProps) {
  const focus = useFocused<HTMLInputElement>(onFocus, onBlur);
  return (
    <input
      type={kind}
      {...rest}
      data-focused={focus.focused || undefined}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={fieldStyle(phone, { ...(mono ? { ...DATA_FACE, fontVariantNumeric: "tabular-nums" } : null), ...(width ? { width, maxWidth: "100%" } : null), ...(focus.focused ? FIELD_FOCUS : { outline: "none" }) })}
    />
  );
}

export interface FieldAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "style"> {
  phone: boolean;
  rows: number;
  mono?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
}

/** A text area: a field padded 9 10 on 20, as tall as its rows, resizable up and down. */
export function FieldArea({ phone, rows, mono = false, onFocus, onBlur, ...rest }: FieldAreaProps) {
  const focus = useFocused<HTMLTextAreaElement>(onFocus, onBlur);
  return (
    <textarea
      rows={rows}
      {...rest}
      data-focused={focus.focused || undefined}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={areaStyle(phone, rows, { ...(mono ? { ...DATA_FACE, fontSize: phone ? 16 : 12.5 } : null), ...(focus.focused ? FIELD_FOCUS : { outline: "none" }) })}
    />
  );
}

/** A picker field: a field drawn as a button, the value or the placeholder at the left, a chevron at the right. */
export const pickerFieldStyle = (phone: boolean, state: { hovered?: boolean }, empty: boolean): CSSProperties => ({
  ...WELL,
  ...(state.hovered ? { borderColor: t.controlBorder } : null),
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  minWidth: 0,
  height: phone ? 44 : 32,
  padding: "0 10px",
  borderRadius: 8,
  textAlign: "left",
  cursor: "pointer",
  ...type(phone ? 16 : 13, 400, empty ? t.label : t.text),
});

/** The picker field's chevron: 14, `--label`, at the right. */
export function PickerChevron() {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0, marginLeft: "auto", color: t.label }}>
      <Glyph name="chevd" size={14} />
    </span>
  );
}

export interface PickerFieldButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "children"> {
  value: string | null;
  placeholder: string;
  phone: boolean;
  open?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** The picker field as a button that opens a menu: the value or the placeholder, then the chevron. */
export function PickerFieldButton({ value, placeholder, phone, open, style, ...rest }: PickerFieldButtonProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled: rest.disabled });
  return (
    <button type="button" aria-haspopup="menu" aria-expanded={open} {...rest} {...handlers} style={{ ...pickerFieldStyle(phone, state, !value), ...ring(state.focusVisible), ...style }}>
      <span style={ELLIPSIS}>{value || placeholder}</span>
      <PickerChevron />
    </button>
  );
}

/** A picker field with something beside it (a model and its "Primary" tag): the field takes the room, 8 apart. */
export const PICKER_ROW: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "center", gap: 8, minWidth: 0 };

/* ── segmented ── */

export interface SegmentedFieldItem<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface SegmentedFieldProps<V extends string> {
  label: string;
  items: readonly SegmentedFieldItem<V>[];
  /** Null: none chosen. */
  value: V | null;
  onChange: (value: V) => void;
  phone: boolean;
  /** A second press on the chosen item hands it back again, so the caller can take the choice off. */
  testId?: string;
}

/** One choice from a few: a radio group, the arrows move the choice. Items share the width and wrap when they must. */
export function SegmentedField<V extends string>({ label, items, value, onChange, phone, testId = "segmented" }: SegmentedFieldProps<V>) {
  const group = useRef<HTMLDivElement>(null);
  const stop = items.some((item) => item.value === value) ? value : items.find((item) => !item.disabled)?.value;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const from = Math.max(0, items.findIndex((item) => item.value === value));
    let to = (from + step + items.length) % items.length;
    for (let tries = 0; items[to].disabled && tries < items.length; tries++) to = (to + step + items.length) % items.length;
    onChange(items[to].value);
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[to]?.focus();
  };
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      data-ui="segmented"
      data-testid={testId}
      onKeyDown={onKeyDown}
      style={{ display: "flex", flexWrap: "wrap", gap: 2, padding: 2, boxSizing: "border-box", width: "100%", minWidth: 0, background: t.segTrack, border: `1px solid ${t.segBorder}`, borderRadius: 8 }}
    >
      {items.map((item) => (
        <Segment key={item.value} item={item} current={item.value === value} tabStop={item.value === stop} phone={phone} onPick={() => onChange(item.value)} />
      ))}
    </div>
  );
}

function Segment<V extends string>({ item, current, tabStop, phone, onPick }: { item: SegmentedFieldItem<V>; current: boolean; tabStop: boolean; phone: boolean; onPick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled: item.disabled });
  return (
    <button
      type="button"
      role="radio"
      aria-checked={current}
      tabIndex={tabStop ? 0 : -1}
      disabled={item.disabled || undefined}
      onClick={item.disabled ? undefined : onPick}
      {...handlers}
      style={{
        flex: "1 1 0",
        boxSizing: "border-box",
        height: phone ? 40 : 28,
        padding: "0 10px",
        borderRadius: 6,
        border: "1px solid transparent",
        background: "transparent",
        whiteSpace: "nowrap",
        ...type(12.5, 400, state.hovered ? t.text : t.text2),
        cursor: item.disabled ? "default" : "pointer",
        ...(current ? { background: t.controlOn, borderColor: t.segOnBorder, color: t.text, boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)" } : null),
        ...(item.disabled ? { filter: t.dimFilter } : null),
        ...ring(state.focusVisible),
      }}
    >
      {item.label}
    </button>
  );
}

/* ── option grid ── */

export interface OptionGridItem<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface OptionGridProps<V extends string> {
  /** The group's accessible name. */
  label: string;
  items: readonly OptionGridItem<V>[];
  /** The chosen options: one, or several with `multiple`. */
  chosen: readonly V[];
  /** The option pressed: the caller decides what that does to the choice. */
  onPick: (value: V) => void;
  phone: boolean;
  multiple?: boolean;
  columns?: number;
  /** A row around it already names the group: draw no group of its own. */
  bare?: boolean;
}

/** Three equal columns of left-aligned, one-line options (two on a phone). */
export function OptionGrid<V extends string>({ label, items, chosen, onPick, phone, multiple = false, columns = 3, bare = false }: OptionGridProps<V>) {
  const cols = phone ? Math.min(columns, 2) : columns;
  return (
    <div
      role={bare ? undefined : "group"}
      aria-label={bare ? undefined : label}
      data-testid="choice-grid"
      data-multiple={multiple || undefined}
      style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 6, minWidth: 0 }}
    >
      {items.map((item) => (
        <OptionButton key={item.value} label={item.label} chosen={chosen.includes(item.value)} disabled={item.disabled} phone={phone} onPick={() => onPick(item.value)} />
      ))}
    </div>
  );
}

function OptionButton({ label, chosen, disabled, phone, onPick }: { label: string; chosen: boolean; disabled?: boolean; phone: boolean; onPick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  return (
    <button
      type="button"
      aria-pressed={chosen}
      title={label}
      disabled={disabled}
      onClick={onPick}
      {...handlers}
      style={{
        boxSizing: "border-box",
        display: "block",
        width: "100%",
        minWidth: 0,
        height: phone ? 44 : 32,
        padding: "0 10px",
        textAlign: "left",
        borderRadius: 8,
        background: "transparent",
        border: `1px solid ${t.windowBorder}`,
        ...type(12.5, 400, t.text2),
        ...ELLIPSIS,
        cursor: disabled ? "default" : "pointer",
        ...(state.hovered && !chosen ? { background: t.tile, color: t.text } : null),
        ...(chosen ? { ...SELECTED, color: t.text } : null),
        ...(disabled ? { filter: t.dimFilter } : null),
        ...ring(state.focusVisible),
      }}
    >
      {label}
    </button>
  );
}

/* ── buttons ── */

export interface RecipeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "secondary" | "primary";
  small?: boolean;
  phone?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** 32 tall, radius 8, the control recipe (small: 28); primary is `PRIMARY`; a disabled primary is the control, faint. */
export function RecipeButton({ variant = "secondary", small = false, phone = false, disabled, type: kind = "button", style, children, ...rest }: RecipeButtonProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  const primary = variant === "primary";
  const paint: CSSProperties = primary
    ? disabled
      ? { ...CONTROL, color: t.textDisabled, boxShadow: "none" }
      : { ...PRIMARY, ...(state.hovered ? { filter: "brightness(1.08)" } : null) }
    : { ...controlPaint(state), color: t.text, ...(disabled ? { filter: t.dimFilter } : null) };
  return (
    <button
      type={kind}
      disabled={disabled}
      data-variant={variant}
      {...rest}
      {...handlers}
      style={{
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        height: phone ? 44 : small ? 28 : 32,
        padding: small ? "0 10px" : "0 12px",
        borderRadius: 8,
        whiteSpace: "nowrap",
        ...type(small ? 12.5 : 13, 500, t.text),
        ...paint,
        cursor: disabled ? "default" : "pointer",
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** The small button's paint, for a trigger another component draws (a picker opened by "Select applications"). */
export const smallButtonStyle = (phone: boolean, state: { hovered?: boolean; pressed?: boolean }): CSSProperties => ({
  ...controlPaint(state),
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "flex-start",
  gap: 6,
  maxWidth: "100%",
  height: phone ? 44 : 28,
  padding: "0 10px",
  borderRadius: 8,
  whiteSpace: "nowrap",
  cursor: "pointer",
  ...type(12.5, 500, t.text),
});

/** A text link: 12.5 `--text2`, underlined 3 below in `--label` at half strength. */
export function TextLink({ children, onClick, phone = false, disabled, ...aria }: { children: ReactNode; onClick: () => void; phone?: boolean; disabled?: boolean; "aria-label"?: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...aria}
      {...handlers}
      style={{
        appearance: "none",
        background: "none",
        border: 0,
        padding: phone ? "12px 0" : 0,
        alignSelf: "flex-start",
        ...type(12.5, 400, state.hovered ? t.text : t.text2),
        textDecoration: "underline",
        textUnderlineOffset: 3,
        textDecorationColor: tokenAlpha("label", 0.5),
        cursor: disabled ? "default" : "pointer",
        ...(disabled ? { filter: t.dimFilter } : null),
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

/** A tag: 22 tall, the control recipe, radius 5, the data face 11 `--text2`. */
export function Tag({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <span
      data-testid={testId}
      style={{ ...CONTROL, boxSizing: "border-box", display: "inline-flex", alignItems: "center", flexShrink: 0, height: 22, padding: "0 7px", borderRadius: 5, fontFamily: DM_MONO, fontSize: 11, lineHeight: "normal", color: t.text2, whiteSpace: "nowrap" }}
    >
      {children}
    </span>
  );
}

/** A chosen name with its remove button: the tag recipe in `--text`, the remove glyph after it. */
export function RemovableTag({ children, removeLabel, onRemove, phone }: { children: ReactNode; removeLabel: string; onRemove: () => void; phone: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <span role="listitem" style={{ ...CONTROL, boxSizing: "border-box", display: "inline-flex", alignItems: "center", gap: 2, height: phone ? 44 : 24, padding: "0 2px 0 8px", borderRadius: 5, ...type(12.5, 400, t.text), whiteSpace: "nowrap", maxWidth: "100%" }}>
      <span style={ELLIPSIS}>{children}</span>
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        {...handlers}
        style={{ appearance: "none", background: "none", border: 0, padding: 0, width: phone ? 40 : 20, height: phone ? 40 : 20, display: "inline-flex", alignItems: "center", justifyContent: "center", color: state.hovered ? t.text : t.label, cursor: "pointer", borderRadius: 4, ...ring(state.focusVisible) }}
      >
        <Glyph name="x" size={12} />
      </button>
    </span>
  );
}

/** A list of chosen names, wrapping, 6 apart. */
export function TagList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="list" aria-label={label} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {children}
    </div>
  );
}

/** One line of plain words beside a file it names: its name and a Remove text link. */
export function FileLine({ name, removeLabel, onRemove, phone }: { name: string; removeLabel: string; onRemove: () => void; phone: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <span style={{ ...BODY_TEXT, ...ELLIPSIS, flexShrink: 1 }}>{name}</span>
      <TextLink onClick={onRemove} phone={phone} aria-label={removeLabel}>
        Remove
      </TextLink>
    </div>
  );
}

/** A line the modal says about what it refused, in plain words. */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <span role="alert" style={type(12.5, 400, t.text, 18)}>
      {children}
    </span>
  );
}

/** A line the modal says back after an action (what an import read): 12 `--label`, or `--text` when it is a problem. */
export function StatusLine({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <span role="status" style={{ ...HINT, ...(strong ? { color: t.text } : null) }}>
      {children}
    </span>
  );
}

/* ── the optional section (drawn by OptionalSection.tsx) ── */

export const OPTIONAL = {
  section: { display: "flex", flexDirection: "column", minWidth: 0, paddingBottom: 4, ...rule() } as CSSProperties,
  /** CA-16b's `bleed`: the section reaches the window's edges from a body padded `bleed`. */
  sectionAt: (bleed: number): CSSProperties => ({ display: "flex", flexDirection: "column", minWidth: 0, paddingBottom: 4, ...rule(), ...(bleed ? { margin: `0 -${bleed}px` } : null) }),
  header: (inset: number): CSSProperties => ({ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: `14px ${inset}px 6px` }),
  heading: { ...STRONG_LABEL, margin: 0 } as CSSProperties,
  count: COUNT,
  row: { ...rule(t.hairline), minWidth: 0 } as CSSProperties,
  summary: (inset: number, hovered: boolean, phone: boolean): CSSProperties => ({
    appearance: "none",
    border: 0,
    margin: 0,
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    minHeight: phone ? 44 : undefined,
    padding: `10px ${inset}px`,
    background: hovered ? t.tile : "transparent",
  }),
  /** Focus: a 2px outline inset by 2, so the row's own edges never cut it. */
  focus: (visible: boolean): CSSProperties => (visible ? { outline: `2px solid ${t.focusRing}`, outlineOffset: -2 } : { outline: "none" }),
  title: type(13, 400, t.text, 18),
  titleLine: { display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 } as CSSProperties,
  hint: { ...type(12.5, 400, t.label, 17), marginTop: 1 } as CSSProperties,
  /** CA-16b's card: a filled row's line in `--text`. */
  filledLine: { color: t.text } as CSSProperties,
  value: { ...COUNT, maxWidth: "45%", overflow: "hidden", textOverflow: "ellipsis" } as CSSProperties,
  chevron: (open: boolean): CSSProperties => ({ display: "inline-flex", flexShrink: 0, color: t.label, transform: open ? "rotate(180deg)" : "none" }),
  body: (inset: number): CSSProperties => ({ display: "flex", flexDirection: "column", gap: 8, padding: `2px ${inset}px 14px`, minWidth: 0 }),
} as const;

/* ── panels ── */

export const PANEL: CSSProperties = { background: t.surface, border: `1px solid ${t.hairlineModule}`, borderRadius: 10, minWidth: 0 };

/** A panel: `--surface`, a hairline edge, radius 10. */
export function Panel({ children, label, testId, padding = 0 }: { children: ReactNode; label?: string; testId?: string; padding?: number | string }) {
  return (
    <div role={label ? "group" : undefined} aria-label={label} data-testid={testId} style={{ ...PANEL, padding, display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  );
}

/** A field that takes the room left in a line. */
export const GROW: CSSProperties = { flex: "1 1 0", minWidth: 0 };

/** A panel's head: the grip, its title at 13/500, and a button at the right. */
export const PANEL_HEAD: CSSProperties = { display: "grid", gridTemplateColumns: "16px minmax(0, 1fr) auto", alignItems: "center", gap: 8, minHeight: 28, paddingBottom: 6 };
export const PANEL_TITLE: CSSProperties = type(13, 500, t.text, 18);
/** A list inside a panel or a row: a column, 8 apart. */
export const PANEL_LIST: CSSProperties = { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 };

/** A question field row inside a panel: a 96 label column, gap 12, padding 10 0, a hairline above. */
export function QuestionRow({ label, id, group = false, top = false, first = false, phone, children }: { label: string; id: string; group?: boolean; top?: boolean; first?: boolean; phone: boolean; children?: ReactNode }) {
  return (
    <div
      role={group ? "group" : undefined}
      aria-labelledby={group ? id : undefined}
      style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "96px minmax(0, 1fr)", columnGap: 12, rowGap: 6, alignItems: top || phone ? "start" : "center", padding: "10px 0", minWidth: 0, ...(first ? null : rule(t.hairline)) }}
    >
      {group ? (
        <span id={id} style={{ ...LABEL, paddingTop: top && !phone ? 7 : 0 }}>
          {label}
        </span>
      ) : (
        <label htmlFor={id} style={{ ...LABEL, paddingTop: top && !phone ? 7 : 0 }}>
          {label}
        </label>
      )}
      {children !== undefined ? <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>{children}</div> : <span />}
    </div>
  );
}

/** An option row: a 16 grip, a 120 key, the description, a 28 remove; gap 8. */
export const optionRowStyle = (phone: boolean): CSSProperties => ({ display: "grid", gridTemplateColumns: phone ? "44px minmax(0, 1fr) minmax(0, 1fr) 44px" : "16px 120px minmax(0, 1fr) 28px", gap: 8, alignItems: "center", minWidth: 0 });

/** The grip that drags an option, 16 wide. */
export const GRIP: CSSProperties = { appearance: "none", background: "none", border: 0, padding: 0, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", color: t.label, cursor: "grab" };

/** The list fact rows sit in. */
export function FactList({ children }: { children: ReactNode }) {
  return <dl style={{ margin: 0, display: "flex", flexDirection: "column", minWidth: 0 }}>{children}</dl>;
}

/** A fact row: space-between, padding 9 14, a hairline between rows; the key `--text2`, the value in the data face. */
export function FactRow({ label, children, first = false, testId }: { label: string; children: ReactNode; first?: boolean; testId?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, padding: "9px 14px", minWidth: 0, ...(first ? null : rule(t.hairline)) }}>
      <dt style={type(13, 400, t.text2, 18)}>{label}</dt>
      <dd data-testid={testId} style={{ margin: 0, fontFamily: DM_MONO, fontSize: 12.5, lineHeight: "18px", color: t.text, textAlign: "right", overflowWrap: "anywhere", minWidth: 0 }}>
        {children}
      </dd>
    </div>
  );
}

/* ── the drop zone ── */

export interface DropZoneProps {
  words: string;
  button: string;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: FileList | null) => void;
  phone: boolean;
  testId?: string;
  inputLabel: string;
}

/** 148 tall, the well, a dashed edge; the words and a small button that opens the file chooser. Files dropped on it count too. */
export function DropZone({ words, button, accept, multiple = false, onFiles, phone, testId, inputLabel }: DropZoneProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFiles(event.dataTransfer.files);
      }}
      style={{ ...WELL, border: `1px dashed ${t.segOnBorder}`, borderRadius: 10, boxSizing: "border-box", height: 148, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 12 }}
    >
      <span style={type(13, 400, t.text2, 18)}>{words}</span>
      <RecipeButton small phone={phone} onClick={() => input.current?.click()}>
        {button}
      </RecipeButton>
      <input
        ref={input}
        data-testid={testId}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        aria-label={inputLabel}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

/** A small button that opens a hidden file chooser ("Upload a file", "Upload files"). */
export function FileButton({ children, accept, multiple = false, onFiles, phone, testId, inputLabel, disabled }: { children: ReactNode; accept?: string; multiple?: boolean; onFiles: (files: FileList | null) => void; phone: boolean; testId?: string; inputLabel: string; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <RecipeButton small phone={phone} disabled={disabled} onClick={() => input.current?.click()}>
        {children}
      </RecipeButton>
      <input
        ref={input}
        data-testid={testId}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        aria-label={inputLabel}
        disabled={disabled}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </>
  );
}

/** A panel's content: a column, 12 apart. */
export function PanelBody({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>{children}</div>;
}

/** Two things at either end of one line. */
export function Spread({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", minWidth: 0 }}>{children}</div>;
}

/** Plain label words beside a control ("passed out of"): 13 `--text2`. */
export function LabelText({ children }: { children: ReactNode }) {
  return <span style={LABEL}>{children}</span>;
}

/** A line of small controls side by side, wrapping, 8 apart. */
export function Inline({ children, gap = 8, align = "center" }: { children: ReactNode; gap?: number; align?: CSSProperties["alignItems"] }) {
  return <div style={{ display: "flex", alignItems: align, gap, flexWrap: "wrap", minWidth: 0 }}>{children}</div>;
}

/** The pass-rate bar: 6 tall, radius 3, the track in the strong hairline, the filled part in the evidence colour. */
export function RateBar({ rate }: { rate: number }) {
  return (
    <div aria-hidden="true" data-testid="check-bar" style={{ height: 6, borderRadius: 3, background: t.barBase, overflow: "hidden" }}>
      <div data-testid="check-bar-fill" style={{ height: "100%", width: `${Math.round(rate * 100)}%`, background: t.evidence }} />
    </div>
  );
}

/** A fixed width for a narrow field, so a modal passes a number rather than a style. */
export const NARROW = { count: 56, date: 128, value: 160, version: 200 } as const;
