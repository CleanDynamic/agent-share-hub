import { Sparkles } from "lucide-react";

export function EmptyProgressState() {
  return (
    <div
      style={{
        background: "var(--glass-2)",
        border: "0.5px dashed var(--line)",
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
          background: "color-mix(in srgb, var(--action) 14%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--action)",
        }}
      >
        <Sparkles size={20} />
      </div>
      <div style={{ fontFamily: "Figtree, sans-serif", fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
        Your story starts here
      </div>
      <div style={{ fontSize: 13, color: "var(--text2)", maxWidth: 360 }}>
        Save a blueprint, leave a thoughtful comment, or publish your first post — your engagement grid lights up as you go.
      </div>
    </div>
  );
}

export default EmptyProgressState;
