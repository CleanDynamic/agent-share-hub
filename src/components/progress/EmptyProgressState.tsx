import { Sparkles } from "lucide-react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { tierFill } from "@/lib/theme/progress";

/**
 * What a brand-new creator sees on `/analytics` before they have done anything.
 * Repainted by BG-P28b, and the one surface in this prompt where the paint
 * carries an argument rather than a value.
 *
 * IT HAS TO READ AS AN INVITATION, NOT AS A LOCKED DOOR. Three decisions do
 * that work:
 *
 *   · THE DASHED EDGE STAYS, IN `--line` AND NOT IN BREAKAGE RED. The theme's
 *     dashed border means "deliberately unsolved, come and solve it" — which is
 *     the right sentence here. But the gap language pairs those dashes with
 *     `--cat-breakage`, and red on an empty progress page would say the account
 *     is broken rather than new. A hairline dash keeps the invitation and drops
 *     the alarm.
 *   · THE MEDALLION IS THE TOP RUNG — an amber fill with `--on-lit` on it, the
 *     same mark a finished achievement gets. On a page with no achievements it
 *     is the only lit thing, and putting the light on the empty state says the
 *     light is what is on offer. A greyed-out medallion would have said the
 *     opposite with the same layout.
 *   · THE COPY IS UNTOUCHED. It already invited rather than scolded, and this
 *     prompt is appearance only.
 *
 * The ground was `rgba(68,68,84,0.40)` — a dark-room stone that on Exhibition
 * put a grey slab in a lit gallery. It is `--glass-2`, the system's quiet inset
 * surface, in both rooms.
 */
export function EmptyProgressState() {
  const medallion = tierFill("highest");

  return (
    <div
      style={{
        background: t.glass2,
        border: `1.5px dashed ${t.line}`,
        borderRadius: r.card,
        padding: "32px 20px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: r.full,
          background: medallion.background,
          color: medallion.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sparkles size={20} />
      </div>
      <div
        style={{
          fontFamily: FIGTREE,
          fontSize: 16,
          fontWeight: 600,
          color: t.text,
        }}
      >
        Your story starts here
      </div>
      <div
        style={{
          fontFamily: FIGTREE,
          fontSize: 13,
          color: t.text2,
          maxWidth: 360,
          textWrap: "pretty",
        }}
      >
        Save a blueprint, leave a thoughtful comment, or publish your first post — your engagement grid lights up as you go.
      </div>
    </div>
  );
}

export default EmptyProgressState;
