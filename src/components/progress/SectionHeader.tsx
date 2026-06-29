import type { ReactNode } from "react";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        marginTop: 8,
        marginBottom: 12,
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 16,
            fontWeight: 600,
            color: "rgba(255,255,255,0.92)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export default SectionHeader;
