// A search field (UI-P84, refined look): the well recipe, 30 high, `0 6px 0 12px`, a `search` glyph, the input at
// Geist 12.5, and an optional key hint ("/") in a 1px `--control-border` box in Geist Mono 10.5. The input is 16px
// under 768px so a phone does not zoom on focus. `label` is the input's accessible name.

import type { InputHTMLAttributes } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { r } from "@/lib/theme/radius";
import { WELL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { Glyph } from "./Glyph";

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "aria-label"> {
  label: string;
  /** The key that focuses it, drawn at the end. */
  hint?: string;
  width?: number | string;
}

export function SearchField({ label, hint, width = 260, style, ...rest }: SearchFieldProps) {
  const phone = useIsPhone();
  return (
    <label
      data-ui="search-field"
      style={{
        boxSizing: "border-box",
        width,
        maxWidth: "100%",
        height: 30,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 6px 0 12px",
        borderRadius: r.control,
        ...WELL,
        color: t.label,
        ...style,
      }}
    >
      <Glyph name="search" size={16} />
      <input
        type="search"
        aria-label={label}
        {...rest}
        style={{
          flexGrow: 1,
          minWidth: 0,
          background: "transparent",
          border: 0,
          outline: "none",
          fontFamily: FIGTREE,
          fontSize: phone ? 16 : 12.5,
          fontWeight: 400,
          color: t.text,
        }}
      />
      {hint ? (
        <span
          aria-hidden="true"
          style={{
            fontFamily: DM_MONO,
            fontSize: 10.5,
            lineHeight: "16px",
            padding: "0 4px",
            borderRadius: 4,
            border: `1px solid ${t.controlBorder}`,
            color: t.label,
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export default SearchField;
