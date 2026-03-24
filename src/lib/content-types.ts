/**
 * Shared content type utilities.
 * DB stores "Prompt File" — UI displays "Prompt(s)".
 * All TYPE_COLORS keyed by DB value.
 */

/** Map DB content_type to display label */
export function displayContentType(dbType: string): string {
  if (dbType === "Prompt File") return "Prompt(s)";
  if (dbType === "Agent Blueprint") return "Agent(s)";
  if (dbType === "AI Agent Install Guide") return "Install Guide";
  if (dbType === "AI Tools (LLMs)") return "AI Tools Tutorials";
  return dbType;
}

/** Ordered content types for dropdowns, grids, etc. */
export const ORDERED_CONTENT_TYPES = [
  "Prompt File",
  "Agent Blueprint",
  "AI Agent Install Guide",
  "Model Config Guide",
  "Integration Guide",
  "Workflow Template",
  "Evaluation Framework",
  "Agent Stack",
  "Failure Library",
  "Blog",
  "AI Tools (LLMs)",
];

/** Predefined topics for tagging content */
export const TOPICS = [
  "Git Workflows",
  "Prompt Engineering",
  "CI/CD & DevOps",
  "API Integration",
  "Data Analysis",
  "Web Scraping",
  "Content Creation",
  "Code Review",
  "Testing & QA",
  "Security",
  "Database",
  "Infrastructure",
];

/** Badge colour map — keyed by DB value */
export const TYPE_COLORS: Record<string, string> = {
  "Prompt File": "bg-[#E8571A]/20 text-[#E8571A] border-[#E8571A]/25",
  "Agent Blueprint": "bg-[#7C3AED]/20 text-[#7C3AED] border-[#7C3AED]/25",
  "Workflow Template": "bg-[#2563EB]/20 text-[#3B82F6] border-[#2563EB]/25",
  "Agent Stack": "bg-[#DC2626]/20 text-[#EF4444] border-[#DC2626]/25",
  "Model Config Guide": "bg-[#16A34A]/20 text-[#22C55E] border-[#16A34A]/25",
  "Integration Guide": "bg-[#D97706]/20 text-[#F59E0B] border-[#D97706]/25",
  "Evaluation Framework": "bg-[#DB2777]/20 text-[#EC4899] border-[#DB2777]/25",
  "Failure Library": "bg-[#374151]/20 text-[#9CA3AF] border-[#374151]/25",
  "Blog": "bg-[#F472B6]/15 text-[#F472B6] border-[#F472B6]/25",
  "AI Tools (LLMs)": "bg-[#8B5CF6]/15 text-[#A78BFA] border-[#8B5CF6]/30",
  "AI Agent Install Guide": "bg-[#06B6D4]/15 text-[#06B6D4] border-[#06B6D4]/30",
  "Open Question": "bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/25",
  "Challenge": "bg-[#E8571A]/15 text-[#E8571A] border-[#E8571A]/25",
};

/** Difficulty levels including "Any" for special types */
export const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];

/** Content types that auto-set difficulty to "Any" */
export const ANY_DIFFICULTY_TYPES = ["Failure Library", "AI Tools (LLMs)", "Blog"];

/** Slug-to-DB-type mapping for Browse/Category routes */
export const SLUG_TO_TYPE: Record<string, string> = {
  "prompt-file": "Prompt File",
  "agent-blueprint": "Agent Blueprint",
  "workflow-template": "Workflow Template",
  "agent-stack": "Agent Stack",
  "model-config-guide": "Model Config Guide",
  "integration-guide": "Integration Guide",
  "evaluation-framework": "Evaluation Framework",
  "failure-library": "Failure Library",
  "blog": "Blog",
  "ai-tools-llms": "AI Tools (LLMs)",
  "install-guide": "AI Agent Install Guide",
  "open-question": "Open Question",
  "challenge": "Challenge",
};

/** Bounty sub-types */
export const BOUNTY_CONTENT_TYPES = [
  "Failure Library",
  "Open Question",
  "Challenge",
] as const;

/** Content types shown in Blueprint upload dropdown (excludes Blog and Bounty sub-types) */
export const BLUEPRINT_CONTENT_TYPES = [
  "Prompt File",
  "Agent Blueprint",
  "AI Agent Install Guide",
  "Model Config Guide",
  "Integration Guide",
  "Workflow Template",
  "Evaluation Framework",
  "Agent Stack",
  "AI Tools (LLMs)",
];
