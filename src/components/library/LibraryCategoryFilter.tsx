import {
  Layers,
  FileText,
  Bot,
  Workflow,
  FlaskConical,
  BookOpen,
  Cpu,
  Wrench,
  Settings,
  Plug,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface CategoryConfig {
  label: string;
  dbType: string | null; // null = "All"
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    label: "All Items",
    dbType: null,
    icon: Layers,
    color: "#2EC4B6",
    bg: "rgba(46,196,182,0.12)",
    border: "rgba(46,196,182,0.3)",
  },
  {
    label: "Prompts",
    dbType: "Prompt File",
    icon: FileText,
    color: "#E8571A",
    bg: "rgba(232,87,26,0.12)",
    border: "rgba(232,87,26,0.3)",
  },
  {
    label: "Agents",
    dbType: "Agent Blueprint",
    icon: Bot,
    color: "#7C3AED",
    bg: "rgba(124,58,237,0.12)",
    border: "rgba(124,58,237,0.3)",
  },
  {
    label: "Workflows",
    dbType: "Workflow Template",
    icon: Workflow,
    color: "#3B82F6",
    bg: "rgba(37,99,235,0.12)",
    border: "rgba(37,99,235,0.3)",
  },
  {
    label: "Evaluations",
    dbType: "Evaluation Framework",
    icon: FlaskConical,
    color: "#EC4899",
    bg: "rgba(219,39,119,0.12)",
    border: "rgba(219,39,119,0.3)",
  },
  {
    label: "Blog",
    dbType: "Blog",
    icon: BookOpen,
    color: "#F472B6",
    bg: "rgba(244,114,182,0.12)",
    border: "rgba(244,114,182,0.3)",
  },
  {
    label: "Stacks",
    dbType: "Agent Stack",
    icon: Cpu,
    color: "#EF4444",
    bg: "rgba(220,38,38,0.12)",
    border: "rgba(220,38,38,0.3)",
  },
  {
    label: "Configs",
    dbType: "Model Config Guide",
    icon: Settings,
    color: "#22C55E",
    bg: "rgba(22,163,74,0.12)",
    border: "rgba(22,163,74,0.3)",
  },
  {
    label: "Integrations",
    dbType: "Integration Guide",
    icon: Plug,
    color: "#F59E0B",
    bg: "rgba(217,119,6,0.12)",
    border: "rgba(217,119,6,0.3)",
  },
];

interface LibraryCategoryFilterProps {
  activeCategory: string | null; // null = All
  onCategoryChange: (dbType: string | null) => void;
}

export function LibraryCategoryFilter({
  activeCategory,
  onCategoryChange,
}: LibraryCategoryFilterProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 mb-5"
      style={{ scrollbarWidth: "none" }}
    >
      {CATEGORIES.map((cat) => {
        const isActive =
          activeCategory === cat.dbType;
        const Icon = cat.icon;
        return (
          <button
            key={cat.label}
            onClick={() => onCategoryChange(cat.dbType)}
            className="flex items-center gap-1.5 shrink-0 transition-all"
            style={{
              background: isActive ? cat.bg : "rgba(255,255,255,0.025)",
              border: isActive
                ? `1px solid ${cat.border}`
                : "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? cat.color : "rgba(255,255,255,0.45)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
