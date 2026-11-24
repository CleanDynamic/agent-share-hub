/* CA-27 P1: Find in build. Synth 09: in the title row, closed as a pill with its key (`/`), open as the same pill-shaped field.

   The button (28 square, ghost, the search glyph) stands just left of View. The field opens between the counts and View: 300 wide,
   shrinking to 200, 34 tall, the well, radius 8, with the search glyph, the input, the count in the data face, Previous match,
   Next match and Close find. */

import type { CSSProperties } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { FIND_COPY } from "@/lib/build/findInBuild";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { hoverFill } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, textStep } from "@/lib/theme/type";

import { bareButton, text } from "./refinedStyles";
import type { BuildFind } from "./useBuildFind";
import { size, space } from "@/lib/theme/space";
import { iconButtonSide } from "./modalRecipes";
import { r } from "@/lib/theme/radius";

/** Synth 09: Find in build, in the title row: a pill drawn as a field (Panel fill, the field's edge, radius 20, 32 tall) with the
    search glyph, "Find" in Text 3 and its key, `/`, in mono at the right. Pressing it (or `/`) opens the field. */
export function FindButton({ find }: { find: Pick<BuildFind, "show"> }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={FIND_COPY.button}
      aria-keyshortcuts="/"
      data-testid="find-button"
      data-hit=""
      onClick={find.show}
      {...handlers}
      style={{
        ...bareButton,
        display: "inline-flex",
        alignItems: "center",
        gap: space[2],
        height: size.control,
        minWidth: 160,
        padding: `0 ${space[3]}px`,
        boxSizing: "border-box",
        borderRadius: r.field,
        background: state.hovered ? hoverFill(t.surface) : t.surface,
        boxShadow: `inset 0 0 0 1px ${t.fieldEdge}`,
        color: t.label,
        cursor: "pointer",
        flexShrink: 0,
        ...ring(state.focusVisible),
      }}
    >
      <Glyph name="search" size={size.icon} />
      <span aria-hidden="true" style={{ ...text(textStep.body, 400, t.label), flexGrow: 1, textAlign: "left" }}>
        {FIND_PILL_WORD}
      </span>
      <span aria-hidden="true" style={{ fontFamily: DM_MONO, fontSize: textStep.meta, color: t.label }}>
        /
      </span>
    </button>
  );
}

/** The word on the closed Find pill. */
export const FIND_PILL_WORD = "Find";

const FIELD: CSSProperties = {
  flex: "0 1 300px",
  minWidth: 200,
  height: size.control,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `0 ${space[3]}px`,
  background: t.surface,
  border: 0,
  boxShadow: `inset 0 0 0 1px ${t.fieldEdge}`,
  borderRadius: r.field,
};

/** A 20 square button inside the field. */
function Tiny({ label, color, rotate, children, onClick }: { label: string; color: string; rotate?: boolean; children: React.ReactNode; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={label}
      data-hit=""
      onClick={onClick}
      {...handlers}
      style={{ ...bareButton, width: size.controlSmall, height: size.controlSmall, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: r.control, color: state.hovered ? t.text : color, ...ring(state.focusVisible), ...(rotate ? { transform: "rotate(180deg)" } : null) }}
    >
      {children}
    </button>
  );
}

export function FindField({ find }: { find: BuildFind }) {
  return (
    <div role="search" data-testid="find-field" style={FIELD}>
      <span style={{ display: "inline-flex", flexShrink: 0, color: t.label }}>
        <Glyph name="search" size={size.icon} />
      </span>
      <input
        ref={find.inputRef}
        type="text"
        data-testid="find-input"
        aria-label={FIND_COPY.button}
        placeholder={FIND_COPY.placeholder}
        value={find.input}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => find.setInput(event.target.value)}
        onKeyDown={find.onFieldKey}
        style={{ flex: "1 1 0", minWidth: 0, background: "transparent", border: 0, padding: 0, ...text(textStep.body, 400, t.text) }}
      />
      {find.words ? (
        <span data-testid="find-count" style={{ flexShrink: 0, whiteSpace: "nowrap", fontFamily: DM_MONO, fontSize: textStep.meta, lineHeight: "normal", color: t.label, fontVariantNumeric: "tabular-nums" }}>
          {find.words}
        </span>
      ) : null}
      <Tiny label={FIND_COPY.previous} color={t.text2} rotate onClick={() => find.move(-1)}>
        <Glyph name="chevd" size={size.icon} />
      </Tiny>
      <Tiny label={FIND_COPY.next} color={t.text2} onClick={() => find.move(1)}>
        <Glyph name="chevd" size={size.icon} />
      </Tiny>
      <Tiny label={FIND_COPY.close} color={t.label} onClick={find.close}>
        <Glyph name="x" size={size.icon} />
      </Tiny>
    </div>
  );
}
