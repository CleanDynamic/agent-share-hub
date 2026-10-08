// "Comment on this part": a small ghost button at the trailing end of an
// anatomy row (RC-P17).
//
// It scrolls to the comments section, attaches this part to the comment box and
// focuses it. Beside the icon, the part's comment count when there is one —
// read from the counts the comments section asked for, so the markers
// themselves never ask. The same quiet treatment as the engagement row:
// tertiary, lucide at stroke 1.5, DM Mono 12 tabular for the count, a 36×36
// press target (44×44 on a phone: UI-P59, the density table and the touch floor), colour-only hover on a fine pointer, the theme's focus ring
// ⟦better-ui › One SVG, recolored per state⟧ ⟦responsive-design ›
// Input Method Adaptation⟧.

import { MessageCircle } from "lucide-react";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, tabular } from "@/lib/theme/type";

export function PartCommentMarker({ count, onPress }: { count: number; onPress: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const target = useIsPhone() ? 44 : 36;
  return (
    <button
      type="button"
      aria-label="Comment on this part"
      data-testid="part-comment-marker"
      onClick={onPress}
      {...handlers}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        flexShrink: 0,
        minWidth: target,
        minHeight: target,
        padding: "0 4px",
        margin: 0,
        background: "transparent",
        border: "none",
        borderRadius: r.control,
        color: state.hovered ? t.text : t.text2,
        cursor: "pointer",
        transition: feedback("color", "opacity"),
        ...ring(state.focusVisible),
      }}
    >
      <MessageCircle size={16} strokeWidth={1.5} aria-hidden />
      {count > 0 ? (
        <span style={{ fontFamily: DM_MONO, fontSize: 12, fontWeight: 400, lineHeight: 1.3, ...tabular }}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

export default PartCommentMarker;
