import type { CSSProperties } from "react";

export type ProgressTab = { id: string; label: string };

export interface ProgressTabBarProps {
  tabs: ProgressTab[];
  active: string;
  onChange: (id: string) => void;
}

const ORANGE = "#E8571A";

export function ProgressTabBar({ tabs, active, onChange }: ProgressTabBarProps) {
  const wrap: CSSProperties = {
    display: "flex",
    gap: 24,
    borderBottom: "0.5px solid rgba(255,255,255,0.10)",
    padding: "0 4px",
  };
  return (
    <div style={wrap}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              background: "transparent",
              border: 0,
              padding: "12px 0",
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
              borderBottom: `2px solid ${isActive ? ORANGE : "transparent"}`,
              cursor: "pointer",
              marginBottom: -0.5,
              textTransform: "capitalize",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default ProgressTabBar;
