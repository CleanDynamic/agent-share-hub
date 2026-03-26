import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";

const TOPIC_CATEGORIES: { label: string; key: string; topics: string[] }[] = [
  { label: "All", key: "all", topics: [] },
  {
    label: "General", key: "general",
    topics: [
      "Social Media", "Business", "Productivity", "Content",
      "Learning", "Email", "Finance", "Hobby", "Research", "Other",
    ],
  },
  {
    label: "Technical", key: "technical",
    topics: [
      "Prompt Engineering", "API Integration", "Automation",
      "Data Analysis", "Web Scraping", "Code Review",
      "Testing & QA", "Security", "Database", "Infrastructure",
      "CI/CD & DevOps", "Git Workflows", "Machine Learning",
      "RAG & Embeddings", "Fine-tuning", "Agent Workflows",
      "Tool Calling", "System Prompts", "Context Windows",
      "Evaluation & Testing", "Local Models", "Deployment",
    ],
  },
  {
    label: "Business", key: "business",
    topics: [
      "Marketing", "Sales", "Customer Support", "SEO",
      "Analytics", "E-commerce", "Legal", "HR & Hiring",
      "Finance & Accounting", "Project Management",
      "Strategy", "Reporting", "Lead Generation",
      "Cold Outreach", "Product Management",
    ],
  },
  {
    label: "Creative", key: "creative",
    topics: [
      "Writing", "Copywriting", "Storytelling", "Scriptwriting",
      "Poetry", "Image Generation", "Video Creation",
      "Music & Audio", "Design", "Branding", "Photography",
      "Social Content", "Newsletter", "Blogging",
    ],
  },
  {
    label: "Learning", key: "learning",
    topics: [
      "Tutorials", "Study Guides", "Research Summaries",
      "Explainers", "Language Learning", "Interview Prep",
      "Career Development", "Onboarding", "Documentation",
      "Knowledge Base",
    ],
  },
];

const ALL_TOPICS = Array.from(
  new Set(TOPIC_CATEGORIES.filter((c) => c.key !== "all").flatMap((c) => c.topics))
);

interface TopicsPickerProps {
  value: string[];
  onChange: (topics: string[]) => void;
}

export function TopicsPicker({ value, onChange }: TopicsPickerProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filteredTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return ALL_TOPICS.filter((t) => t.toLowerCase().includes(q));
    if (activeTab === "all") return ALL_TOPICS;
    const cat = TOPIC_CATEGORIES.find((c) => c.key === activeTab);
    return cat ? cat.topics : ALL_TOPICS;
  }, [search, activeTab]);

  const toggle = (topic: string) => {
    onChange(value.includes(topic) ? value.filter((v) => v !== topic) : [...value, topic]);
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.trim()) setActiveTab("all");
  };

  // Orange accent color
  const accent = "var(--accent-orange, 234 88 12)";

  return (
    <div className="space-y-3">
      {/* Label */}
      <div>
        <p className="text-sm font-semibold text-foreground">
          Topics <span className="text-xs text-muted-foreground font-normal ml-1">(optional)</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Tag every subject area this applies to.</p>
      </div>

      {/* Selected pills */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => toggle(topic)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors border-orange-500/40 text-orange-400 bg-orange-500/10"
            >
              {topic}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search topics..."
          className="w-full h-10 pl-9 pr-3 text-sm rounded-xl border border-border bg-card/60 backdrop-blur-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ring-offset-background"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TOPIC_CATEGORIES.map((cat) => {
          const isActive = activeTab === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => { setActiveTab(cat.key); setSearch(""); }}
              className={`shrink-0 text-[11px] px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-orange-500 text-white border-orange-500"
                  : "bg-transparent text-muted-foreground border-border"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Topic grid */}
      <div className="grid grid-cols-2 gap-1.5 max-h-[260px] overflow-y-auto pr-1">
        {filteredTopics.map((topic) => {
          const selected = value.includes(topic);
          return (
            <button
              key={topic}
              type="button"
              onClick={() => toggle(topic)}
              className={`text-xs px-3 py-2 rounded-lg border text-left transition-all ${
                selected
                  ? "border-orange-500/50 text-orange-400 bg-orange-500/10 shadow-[0_0_8px_rgba(234,88,12,0.15)]"
                  : "border-border text-muted-foreground bg-card/50"
              }`}
            >
              {topic}
            </button>
          );
        })}
        {filteredTopics.length === 0 && (
          <p className="col-span-2 text-xs text-muted-foreground text-center py-6">No topics match "{search}"</p>
        )}
      </div>
    </div>
  );
}
