import { Lock, Sparkles } from "lucide-react";

export interface NextUnlockCardProps {
  milestoneLabel?: string;
  isMysterious?: boolean;
}

export function NextUnlockCard({ milestoneLabel, isMysterious }: NextUnlockCardProps) {
  return (
    <div
      style={{
        background: "rgba(68,68,84,0.55)",
        border: "0.5px solid rgba(255,255,255,0.12)",
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
          background: isMysterious ? "rgba(124,58,237,0.18)" : "rgba(232,87,26,0.16)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: isMysterious ? "#A78BFA" : "#E8571A",
        }}
      >
        {isMysterious ? <Sparkles size={18} /> : <Lock size={16} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
          Next unlock
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.92)", fontFamily: "Figtree, sans-serif", marginTop: 2 }}>
          {isMysterious ? "Something new is waiting…" : milestoneLabel ?? "Keep going"}
        </div>
      </div>
    </div>
  );
}

export default NextUnlockCard;
