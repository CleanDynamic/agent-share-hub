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
    color: "var(--evidence)",
    bg: "color-mix(in srgb, var(--evidence) 12%, transparent)",
    border: "color-mix(in srgb, var(--evidence) 30%, transparent)",
  },
  {
    label: "Prompts",
    dbType: "Prompt File",
    icon: FileText,
    color: "var(--action)",
    bg: "color-mix(in srgb, var(--action) 12%, transparent)",
    border: "color-mix(in srgb, var(--action) 30%, transparent)",
  },
  {
    label: "Agents",
    dbType: "Agent Blueprint",
    icon: Bot,
    color: "var(--cat-agents)",
    bg: "color-mix(in srgb, var(--cat-agents) 12%, transparent)",
    border: "color-mix(in srgb, var(--cat-agents) 30%, transparent)",
  },
  {
    label: "Workflows",
    dbType: "Workflow Template",
    icon: Workflow,
    color: "var(--cat-data)",
    bg: "color-mix(in srgb, var(--cat-data) 12%, transparent)",
    border: "color-mix(in srgb, var(--cat-data) 30%, transparent)",
  },
  {
    label: "Evaluations",
    dbType: "Evaluation Framework",
    icon: FlaskConical,
    color: "var(--cat-media)",
    bg: "color-mix(in srgb, var(--cat-media) 12%, transparent)",
    border: "color-mix(in srgb, var(--cat-media) 30%, transparent)",
  },
  {
    label: "Blog",
    dbType: "Blog",
    icon: BookOpen,
    color: "var(--cat-media)",
    bg: "color-mix(in srgb, var(--cat-media) 12%, transparent)",
    border: "color-mix(in srgb, var(--cat-media) 30%, transparent)",
  },
  {
    label: "Stacks",
    dbType: "Agent Stack",
    icon: Cpu,
    color: "var(--cat-breakage)",
    bg: "color-mix(in srgb, var(--cat-breakage) 12%, transparent)",
    border: "color-mix(in srgb, var(--cat-breakage) 30%, transparent)",
  },
  {
    label: "Configs",
    dbType: "Model Config Guide",
    icon: Settings,
    color: "var(--cat-configuration)",
    bg: "color-mix(in srgb, var(--cat-configuration) 12%, transparent)",
    border: "color-mix(in srgb, var(--cat-configuration) 30%, transparent)",
  },
  {
    label: "Integrations",
    dbType: "Integration Guide",
    icon: Plug,
    color: "var(--lit)",
    bg: "color-mix(in srgb, var(--lit) 12%, transparent)",
    border: "color-mix(in srgb, var(--lit) 30%, transparent)",
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
              background: isActive ? cat.bg : "var(--glass-2)",
              border: isActive
                ? `1px solid ${cat.border}`
                : "1px solid var(--line)",
              borderRadius: 10,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? cat.color : "var(--text2)",
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
