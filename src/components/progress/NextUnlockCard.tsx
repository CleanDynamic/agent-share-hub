import { Lock, Sparkles } from "lucide-react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";
import { tierFill } from "@/lib/theme/progress";

export interface NextUnlockCardProps {
  milestoneLabel?: string;
  isMysterious?: boolean;
}

/**
 * What comes next. Repainted onto the ladder by BG-P28b.
 *
 * THE MEDALLION WAS TWO HUES FOR TWO STATES — a `#7C3AED` violet wash for the
 * mysterious variant and a `#E8571A` orange one for the plain variant. Neither
 * is available: violet is `--cat-agents`, which means a part category, and
 * orange is `--action`, which means "the primary thing to do". A thing you have
 * not unlocked yet is not a thing to do.
 *
 * So the two states become two RUNGS rather than two colours, which is what the
 * ladder is for:
 *
 *   plain       a locked milestone you can read — the `rare` rung, a `--recess`
 *               ground with a `--text2` lock on it. Present, legible, not yours.
 *   mysterious  the tease — the `highest` rung, an amber fill with `--on-lit`
 *               on it. It is the one lit element in this card and usually the
 *               only one on the page below the hero, which is the point:
 *               von-Restorff says the memorable thing is the thing that differs,
 *               and "something new is waiting" is what should be memorable here.
 *
 * The 999px radius stays. `--r-full` is for circular things only, and a 36px
 * square at 999px is a circle, which is exactly what this is.
 */
export function NextUnlockCard({ milestoneLabel, isMysterious }: NextUnlockCardProps) {
  const medallion = tierFill(isMysterious ? "highest" : "rare");

  return (
    <div
      style={{
        background: t.glass2,
        border: `0.5px solid ${t.line}`,
        borderRadius: r.control,
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: r.full,
          background: medallion.background,
          color: medallion.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isMysterious ? <Sparkles size={18} /> : <Lock size={16} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: DM_MONO,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: t.text2,
          }}
        >
          Next unlock
        </div>
        <div
          style={{
            fontFamily: FIGTREE,
            fontSize: 14,
            color: t.text,
            marginTop: 2,
          }}
        >
          {isMysterious ? "Something new is waiting…" : milestoneLabel ?? "Keep going"}
        </div>
      </div>
    </div>
  );
}

export default NextUnlockCard;
