// A model, lab or tool as a control (UI-P83): 32 high, the mark at 20, an 8px gap, padding `0 12px 0 8px`. It is a
// button, so it has a name, a hover (`--control-on`, never opacity) and a pressed state; pressed is the selected
// recipe (`--selected-fill`, a 1px `--selected-edge` and `--selected-ring`), never a colour.

import { markFor } from "@/lib/models/marks";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { ModelMark } from "./ModelMark";

export interface ModelChipProps {
  children: string;
  tool?: string | null;
  model?: string | null;
  lab?: string | null;
  pressed?: boolean;
  onClick?: () => void;
}

export function ModelChip({ children, tool, model, lab, pressed = false, onClick }: ModelChipProps) {
  const marked = markFor({ tool, model, lab }) !== null;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 32,
        boxSizing: "border-box",
        padding: marked ? "0 12px 0 8px" : "0 12px",
        borderRadius: 6,
        border: `1px solid ${pressed ? t.selectedEdge : t.controlBorder}`,
        background: pressed ? t.selectedFill : t.control,
        boxShadow: pressed ? t.selectedRing : t.controlShadow,
        color: t.text,
        fontFamily: FIGTREE,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        cursor: "pointer",
      }}
    >
      <ModelMark tool={tool} model={model} lab={lab} size={20} />
      {children}
    </button>
  );
}

export default ModelChip;
