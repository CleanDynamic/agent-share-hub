/* CA-16b: the pieces only the Classification Card uses, drawn as its board draws them: a chosen value, a suggestion, and
   the typeahead's list. Built from the tokens; nothing here is a colour of its own.

   THREE EDGES COME FROM CA-15b (`--seg-on-border`, `--dash-edge`, `--window-foot`). Until its tokens are in the stylesheet
   each reads through `var(name, fallback)` to the nearest token that exists, so the Card looks right now and picks the
   real value up when CA-15b lands. */

import type { CSSProperties, ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { ellipsis, text } from "./refinedStyles";

/** The edge of a chosen value and of a selected segment. */
export const SEG_ON_BORDER = `var(--seg-on-border, ${t.controlBorder})`;
/** The dashed edge of a suggestion and an own entry. */
export const DASH_EDGE = `var(--dash-edge, ${t.line})`;
/** The footer strip under a window's body. */
export const WINDOW_FOOT = `var(--window-foot, ${t.tile})`;

/** A chosen value: 28 tall, padding 0 6 0 10, radius 7, `--control-on` with a 1px edge, 12.5, then an 18 square remove button. */
export function ChosenValue({
  label,
  own = false,
  phone,
  removeLabel,
  onRemove,
  menu,
  readOnly = false,
}: {
  label: string;
  /** The maker's own entry: transparent, with a dashed edge. */
  own?: boolean;
  phone: boolean;
  removeLabel: string;
  onRemove: () => void;
  /** Task's primary mark and its menu button, drawn between the label and the remove button. */
  menu?: ReactNode;
  /** Read from the build, not chosen: no remove button. */
  readOnly?: boolean;
}) {
  const remove = useInteractive<HTMLButtonElement>();
  const box: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    minHeight: phone ? 44 : 28,
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: readOnly ? "0 10px" : "0 6px 0 10px",
    borderRadius: 7,
    background: own ? "transparent" : t.controlOn,
    borderWidth: 1,
    borderStyle: own ? "dashed" : "solid",
    borderColor: own ? DASH_EDGE : SEG_ON_BORDER,
    ...text(12.5, 400, t.text),
  };
  return (
    <li style={box} data-custom={own ? "true" : undefined}>
      <span style={{ ...ellipsis, minWidth: 0 }}>{label}</span>
      {menu}
      {readOnly ? null : (
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        {...remove.handlers}
        style={{
          appearance: "none",
          width: phone ? 44 : 18,
          height: phone ? 44 : 18,
          margin: phone ? "0 -6px 0 0" : 0,
          padding: 0,
          flexShrink: 0,
          boxSizing: "border-box",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${remove.state.hovered ? SEG_ON_BORDER : "transparent"}`,
          borderRadius: 4,
          background: "transparent",
          cursor: "pointer",
          color: remove.state.hovered ? t.text : t.text2,
          ...ring(remove.state.focusVisible),
        }}
      >
        <Glyph name="x" size={10} />
      </button>
      )}
    </li>
  );
}

/** One row of suggestions: "Suggested" in the data face, then the dashed chips, 6 apart. */
export function SuggestedRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <li aria-hidden="true" style={{ fontFamily: DM_MONO, fontSize: 11.5, lineHeight: "normal", color: t.label, marginRight: 2 }}>
        Suggested
      </li>
      {children}
    </ul>
  );
}

/** A suggestion: 26 tall, padding 0 9, radius 7, transparent, a 1px dashed edge, 12 `--text2`, "+ Customer service". Hover: `--text` and the edge in `--label`. */
export function Suggestion({ label, name, title, phone, onAdd }: { label: string; name: string; title?: string; phone: boolean; onAdd: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const lit = state.hovered;
  return (
    <li>
      <button
        type="button"
        aria-label={name}
        title={title}
        onClick={onAdd}
        {...handlers}
        style={{
          appearance: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          minHeight: phone ? 44 : 26,
          padding: "0 9px",
          boxSizing: "border-box",
          borderRadius: 7,
          background: "transparent",
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: lit ? t.label : DASH_EDGE,
          cursor: "pointer",
          ...text(12, 400, lit ? t.text : t.text2),
          ...ring(state.focusVisible),
        }}
      >
        <span aria-hidden="true">+</span>
        {label}
      </button>
    </li>
  );
}

/** The typeahead's list: `--window`, 1px `--control-border`, radius 9, `0 8px 24px` shadow, padding 4, 4 under its field. */
export const typeaheadList: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "100%",
  marginTop: 4,
  zIndex: 30,
  listStyle: "none",
  margin: "4px 0 0",
  padding: 4,
  borderRadius: 9,
  background: t.window,
  border: `1px solid ${t.controlBorder}`,
  boxShadow: "0 8px 24px rgba(0,0,0,.5)",
  maxHeight: 360,
  overflowY: "auto",
  boxSizing: "border-box",
};

/** The matched letters at 600, with no background. */
export function Matched({ label, query }: { label: string; query: string }) {
  const at = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, at)}
      <span style={{ fontWeight: 600 }}>{label.slice(at, at + query.length)}</span>
      {label.slice(at + query.length)}
    </>
  );
}

/** A row of the list: padding 7 10, radius 6, the name at 13 on the left, the path in the data face 11 on the right; the active row is `--control-on`. */
export function typeaheadRow(active: boolean, phone: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: phone ? "column" : "row",
    alignItems: phone ? "flex-start" : "center",
    justifyContent: "space-between",
    gap: phone ? 2 : 12,
    padding: "7px 10px",
    minHeight: phone ? 44 : undefined,
    boxSizing: "border-box",
    borderRadius: 6,
    cursor: "pointer",
    background: active ? t.controlOn : "transparent",
    fontFamily: FIGTREE,
    fontSize: 13,
    lineHeight: "normal",
    color: t.text,
  };
}

/** The path at the right: the data face, 11 `--label`, cut with an ellipsis. */
export const typeaheadNote = (phone: boolean): CSSProperties => ({
  fontFamily: DM_MONO,
  fontSize: 11,
  lineHeight: "normal",
  color: t.label,
  ...ellipsis,
  minWidth: 0,
  flexShrink: 1,
  textAlign: phone ? "left" : "right",
});

/** The own-entry row: a `--hairline-module` rule above it, 4 above that and 9 inside, `--text2`. */
export function ownEntryRow(active: boolean, phone: boolean): CSSProperties {
  return { ...typeaheadRow(active, phone), color: t.text2, borderTop: `1px solid ${t.hairlineModule}`, borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 4, paddingTop: 9 };
}
