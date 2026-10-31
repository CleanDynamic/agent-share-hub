// "Save" beside "Comment on this part" (SV-25): the same quiet ghost button. The glyph changes at once, as Like and Save do.

import { Bookmark } from "lucide-react";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

export function SaveItemMarker({ saved, what, onPress }: { saved: boolean; what: "part" | "session" | "tile"; onPress: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const target = useIsPhone() ? 44 : 36;
  return (
    <button
      type="button"
      aria-label={saved ? `Unsave this ${what}` : `Save this ${what}`}
      aria-pressed={saved}
      data-testid="save-item-marker"
      onClick={onPress}
      {...handlers}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        minWidth: target,
        minHeight: target,
        padding: "0 4px",
        margin: 0,
        background: "transparent",
        border: "none",
        borderRadius: r.control,
        color: saved || state.hovered ? t.text : t.text2,
        cursor: "pointer",
        transition: feedback("color", "opacity"),
        ...ring(state.focusVisible),
      }}
    >
      <Bookmark size={16} strokeWidth={1.5} fill={saved ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}

export default SaveItemMarker;
