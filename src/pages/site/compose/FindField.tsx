/* CA-27 P1: Find in build in the Build head row.

   The button (28 square, ghost, the search glyph) stands just left of View. The field opens between the counts and View: 300 wide,
   shrinking to 200, 34 tall, the well, radius 8, with the search glyph, the input, the count in the data face, Previous match,
   Next match and Close find. */

import { Search } from "lucide-react";
import type { CSSProperties } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { FIND_COPY } from "@/lib/build/findInBuild";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { bareButton, text } from "./refinedStyles";
import type { BuildFind } from "./useBuildFind";

/** Find in build: the ghost button before View. */
export function FindButton({ find }: { find: Pick<BuildFind, "show"> }) {
  return <IconButton icon={Search} glyph="search" boxed={false} label={FIND_COPY.button} size={28} data-testid="find-button" onClick={find.show} />;
}

const FIELD: CSSProperties = {
  flex: "0 1 300px",
  minWidth: 200,
  height: 34,
  /* The row it opens in is 28 high: the field stands 3 over its top and its foot (its margin box is 26), so nothing under the row moves. */
  margin: "-4px 0",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 10px",
  background: t.well,
  border: `1px solid ${t.hairlineModule}`,
  borderRadius: 8,
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
      style={{ ...bareButton, width: 20, height: 20, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 4, color: state.hovered ? t.text : color, ...ring(state.focusVisible), ...(rotate ? { transform: "rotate(180deg)" } : null) }}
    >
      {children}
    </button>
  );
}

export function FindField({ find }: { find: BuildFind }) {
  return (
    <div role="search" data-testid="find-field" style={FIELD}>
      <span style={{ display: "inline-flex", flexShrink: 0, color: t.label }}>
        <Glyph name="search" size={14} />
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
        style={{ flex: "1 1 0", minWidth: 0, background: "transparent", border: 0, padding: 0, ...text(13, 400, t.text) }}
      />
      {find.words ? (
        <span data-testid="find-count" style={{ flexShrink: 0, whiteSpace: "nowrap", fontFamily: DM_MONO, fontSize: 11, lineHeight: "normal", color: t.label, fontVariantNumeric: "tabular-nums" }}>
          {find.words}
        </span>
      ) : null}
      <Tiny label={FIND_COPY.previous} color={t.text2} rotate onClick={() => find.move(-1)}>
        <Glyph name="chevd" size={14} />
      </Tiny>
      <Tiny label={FIND_COPY.next} color={t.text2} onClick={() => find.move(1)}>
        <Glyph name="chevd" size={14} />
      </Tiny>
      <Tiny label={FIND_COPY.close} color={t.label} onClick={find.close}>
        <Glyph name="x" size={14} />
      </Tiny>
    </div>
  );
}
