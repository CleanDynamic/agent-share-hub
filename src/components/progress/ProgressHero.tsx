import type { ReactNode } from "react";
import { Sparkles, type LucideIcon } from "lucide-react";
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
        background: "var(--glass)",
        border: "0.5px solid var(--line)",
        borderRadius: 14,
        padding: 20,
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
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
            fontFamily: "Figtree, sans-serif",
            fontSize: 18,
            fontWeight: 600,
            color: "var(--text)",
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
