// A quiet tag that names a model, lab or tool with its logo (UI-P83): 22 high, the mark at 14, a 6px gap, padding
// `0 8px 0 6px`, `--tag-fill` with `--on-tag` at 11.5. With no logo for the name the tag is the name alone, with the
// same right padding on both sides.

import type { CSSProperties } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { ModelMark } from "./ModelMark";
import { markFor } from "@/lib/models/marks";

export interface ModelTagProps {
  /** The name shown. */
  children: string;
  tool?: string | null;
  model?: string | null;
  lab?: string | null;
}

export function ModelTag({ children, tool, model, lab }: ModelTagProps) {
  const marked = markFor({ tool, model, lab }) !== null;
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 22,
    boxSizing: "border-box",
    padding: marked ? "0 8px 0 6px" : "0 8px",
    borderRadius: 4,
    background: t.tagFill,
    color: t.onTag,
    fontFamily: FIGTREE,
    fontSize: 11.5,
    fontWeight: 500,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
  return (
    <span style={style}>
      <ModelMark tool={tool} model={model} lab={lab} size={14} />
      {children}
    </span>
  );
}

export default ModelTag;
