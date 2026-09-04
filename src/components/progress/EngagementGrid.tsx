import { Bookmark, MessageCircle, Upload, Repeat, Heart, Users, Eye, Calendar } from "lucide-react";

export interface EngagementGridProps {
  counters: Record<string, number>;
}

const ITEMS: { key: string; label: string; icon: any }[] = [
  { key: "saves", label: "Saves", icon: Bookmark },
  { key: "comments", label: "Comments", icon: MessageCircle },
  { key: "publishes", label: "Publishes", icon: Upload },
  { key: "reblogs", label: "Reblogs", icon: Repeat },
  { key: "likes", label: "Likes", icon: Heart },
  { key: "follows", label: "Follows", icon: Users },
  { key: "views", label: "Views", icon: Eye },
  { key: "returns", label: "Day-returns", icon: Calendar },
];

export function EngagementGrid({ counters }: EngagementGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 10,
      }}
    >
      {ITEMS.map(({ key, label, icon: Icon }) => {
        const v = counters?.[key] ?? 0;
        return (
          <div
            key={key}
            style={{
              background: "rgba(68,68,84,0.55)",
              border: "0.5px solid rgba(255,255,255,0.10)",
              borderRadius: 10,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <Icon size={14} color="rgba(255,255,255,0.45)" />
            <div style={{ fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.92)", fontFamily: "Figtree, sans-serif" }}>
              {v.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default EngagementGrid;
