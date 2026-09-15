import { Lock, Sparkles } from "lucide-react";

export interface NextUnlockCardProps {
  milestoneLabel?: string;
  isMysterious?: boolean;
}

export function NextUnlockCard({ milestoneLabel, isMysterious }: NextUnlockCardProps) {
  return (
    <div
      style={{
        background: "var(--glass-2)",
        border: "0.5px solid var(--line)",
        borderRadius: 12,
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
          borderRadius: 999,
          background: isMysterious ? "color-mix(in srgb, var(--cat-agents) 18%, transparent)" : "color-mix(in srgb, var(--action) 16%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: isMysterious ? "var(--cat-agents)" : "var(--action)",
        }}
      >
        {isMysterious ? <Sparkles size={18} /> : <Lock size={16} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text2)" }}>
          Next unlock
        </div>
        <div style={{ fontSize: 14, color: "var(--text)", fontFamily: "Figtree, sans-serif", marginTop: 2 }}>
          {isMysterious ? "Something new is waiting…" : milestoneLabel ?? "Keep going"}
        </div>
      </div>
    </div>
  );
}

export default NextUnlockCard;
