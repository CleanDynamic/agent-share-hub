import { Sparkles } from "lucide-react";

export function EmptyProgressState() {
  return (
    <div
      style={{
        background: "rgba(68,68,84,0.40)",
        border: "0.5px dashed rgba(255,255,255,0.18)",
        borderRadius: 14,
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
          borderRadius: 999,
          background: "rgba(232,87,26,0.14)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#E8571A",
        }}
      >
        <Sparkles size={20} />
      </div>
      <div style={{ fontFamily: "Figtree, sans-serif", fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.92)" }}>
        Your story starts here
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", maxWidth: 360 }}>
        Save a blueprint, leave a thoughtful comment, or publish your first post — your engagement grid lights up as you go.
      </div>
    </div>
  );
}

export default EmptyProgressState;
