import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import LevelRing from "./xp-kit/level-ring";
import XpBar from "./xp-kit/xp-bar";
import CreatorMarkChip from "./xp-kit/creator-mark-chip";

export interface ProgressHeroMark {
  id: string;
  name: string;
  track?: "Architect" | "Curator" | "Mentor" | "Explorer";
}

export interface ProgressHeroProps {
  name: string;
  avatarUrl?: string;
  initials: string;
  level: number;
  xpInLevel: number;
  xpForNext: number;
  marks: ProgressHeroMark[];
  rightSlot?: ReactNode;
}

/**
 * The top of `/analytics`: who you are, what level, how far to the next one.
 * Repainted by BG-P28b.
 *
 * THE CARD WAS A DARK SLAB IN A LIT ROOM — `rgba(52,52,66,0.55)` behind
 * `rgba(255,255,255,0.95)` type, struck for a `#25252F` page. On Exhibition
 * that is a grey block with white text on it, which is the single worst thing
 * on the page in the light room. It is `--glass` with a `--glass-border` now,
 * which is what the theme gives a reading surface in either room.
 *
 * THE BLUR WAS 28px. The system has exactly one blur value — 16px, saturate
 * 1.15 — and no smaller one to save cost; 28px was a second.
 */
export function ProgressHero({
  name,
  avatarUrl,
  initials,
  level,
  xpInLevel,
  xpForNext,
  marks,
  rightSlot,
}: ProgressHeroProps) {
  const pct = xpForNext > 0 ? (xpInLevel / xpForNext) * 100 : 0;
  return (
    <div
      style={{
        background: t.glass,
        border: `0.5px solid ${t.glassBorder}`,
        borderRadius: r.card,
        padding: 20,
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
        backdropFilter: "blur(16px) saturate(1.15)",
        WebkitBackdropFilter: "blur(16px) saturate(1.15)",
      }}
    >
      <LevelRing
        size={80}
        avatarUrl={avatarUrl}
        initials={initials}
        level={level}
        progressPct={pct}
      />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            fontFamily: FIGTREE,
            fontSize: 18,
            fontWeight: 600,
            color: t.text,
          }}
        >
          {name}
        </div>
        {marks.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {marks.slice(0, 3).map((m) => (
              <CreatorMarkChip key={m.id} mark={{ name: m.name, icon: Sparkles }} />
            ))}
          </div>

        )}
        <XpBar level={level} xpInLevel={xpInLevel} xpForNext={xpForNext} />
      </div>
      {rightSlot && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {rightSlot}
        </div>
      )}
    </div>
  );
}

export default ProgressHero;
