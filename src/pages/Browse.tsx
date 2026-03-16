import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentCard } from "@/components/ContentCard";

const ALL = "all";

const CONTENT_TYPES = [
  "Prompt File", "Prompt Tutorial", "Agent Blueprint", "Workflow Template",
  "Agent Stack", "Model Config Guide", "Integration Guide", "Evaluation Framework", "Failure Library",
];

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];

const AI_TOOLS = ["Any Tool", "ChatGPT", "Claude", "Gemini", "Grok", "Zapier", "Make", "n8n"];

const USE_CASES = ["Social Media", "Research", "Business", "Productivity", "Content", "Learning", "Email", "Finance"];

const PLACEHOLDER_ITEMS = [
  { id: "1", content_type: "Prompt File", title: "Customer Reply Assistant", description: "Handles common customer questions with a friendly, professional tone.", difficulty: "Beginner", ai_tools: ["ChatGPT", "Claude"], download_count: 2340, monetisation_type: "free", use_cases: ["Business", "Email"] },
  { id: "2", content_type: "Workflow Template", title: "Blog Post Workflow", description: "Generates SEO-optimised blog posts from a single topic keyword.", difficulty: "Intermediate", ai_tools: ["ChatGPT", "Zapier"], download_count: 1820, monetisation_type: "paid", price_gbp: 4.99, use_cases: ["Content"] },
  { id: "3", content_type: "Prompt Tutorial", title: "How to Prompt for Research", description: "Step-by-step guide to getting better research results from any AI.", difficulty: "Beginner", ai_tools: ["Any Tool"], download_count: 3100, monetisation_type: "free", use_cases: ["Research", "Learning"] },
  { id: "4", content_type: "Agent Stack", title: "Lead Scoring System", description: "Connects your CRM, email, and AI to auto-score incoming leads.", difficulty: "Advanced", ai_tools: ["ChatGPT", "Make", "n8n"], download_count: 950, monetisation_type: "paid", price_gbp: 12.99, use_cases: ["Business"] },
  { id: "5", content_type: "Integration Guide", title: "Slack + AI Notification Bot", description: "Get AI-powered summaries of Slack channels delivered daily.", difficulty: "Beginner", ai_tools: ["ChatGPT", "Zapier"], download_count: 620, monetisation_type: "free", use_cases: ["Productivity"] },
  { id: "6", content_type: "Failure Library", title: "When ChatGPT Hallucinates", description: "Real examples of AI failures with documented fixes and workarounds.", difficulty: "Any", ai_tools: ["ChatGPT"], download_count: 4200, monetisation_type: "free", use_cases: ["Learning"] },
  { id: "7", content_type: "Agent Blueprint", title: "Social Media Scheduler", description: "A complete recipe for setting up an AI-powered posting schedule.", difficulty: "Beginner", ai_tools: ["Claude", "Zapier"], download_count: 1540, monetisation_type: "free", use_cases: ["Social Media", "Content"] },
  { id: "8", content_type: "Model Config Guide", title: "Which AI for Which Job", description: "A comparison of ChatGPT, Claude, and Gemini for different tasks.", difficulty: "Beginner", ai_tools: ["ChatGPT", "Claude", "Gemini"], download_count: 2890, monetisation_type: "free", use_cases: ["Learning"] },
  { id: "9", content_type: "Evaluation Framework", title: "Prompt Quality Scorecard", description: "Test whether your prompts are actually working with a scoring rubric.", difficulty: "Intermediate", ai_tools: ["Any Tool"], download_count: 780, monetisation_type: "paid", price_gbp: 2.99, use_cases: ["Productivity"] },
  { id: "10", content_type: "Prompt File", title: "Meeting Notes Summariser", description: "Paste your meeting transcript and get clean action items instantly.", difficulty: "Beginner", ai_tools: ["ChatGPT", "Gemini"], download_count: 3650, monetisation_type: "free", use_cases: ["Productivity", "Business"] },
  { id: "11", content_type: "Workflow Template", title: "Email Sequence Builder", description: "Creates a five-email onboarding sequence from a single product description.", difficulty: "Intermediate", ai_tools: ["ChatGPT", "Make"], download_count: 1120, monetisation_type: "paid", price_gbp: 6.99, use_cases: ["Email", "Business"] },
  { id: "12", content_type: "Integration Guide", title: "Notion + AI Research Hub", description: "Connect Notion to an AI that auto-summarises saved articles.", difficulty: "Beginner", ai_tools: ["Claude", "Zapier"], download_count: 1980, monetisation_type: "free", use_cases: ["Research", "Productivity"] },
];

const Browse = () => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [difficultyFilter, setDifficultyFilter] = useState(ALL);
  const [toolFilter, setToolFilter] = useState(ALL);
  const [useCaseFilter, setUseCaseFilter] = useState(ALL);

  const filtered = useMemo(() => {
    return PLACEHOLDER_ITEMS.filter((item) => {
      const q = search.toLowerCase();
      if (q && !item.title.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
      if (typeFilter !== ALL && item.content_type !== typeFilter) return false;
      if (difficultyFilter !== ALL && item.difficulty !== difficultyFilter) return false;
      if (toolFilter !== ALL && !item.ai_tools.includes(toolFilter)) return false;
      if (useCaseFilter !== ALL && !item.use_cases.includes(useCaseFilter)) return false;
      return true;
    });
  }, [search, typeFilter, difficultyFilter, toolFilter, useCaseFilter]);

  return (
    <div className="py-10 px-6">
      <div className="mx-auto max-w-5xl">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="What do you want your AI to do?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-xl"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-3 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="min-w-[160px] bg-card border-border rounded-xl h-9 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value={ALL}>All Types</SelectItem>
              {CONTENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="min-w-[140px] bg-card border-border rounded-xl h-9 text-xs">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value={ALL}>All Levels</SelectItem>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={toolFilter} onValueChange={setToolFilter}>
            <SelectTrigger className="min-w-[140px] bg-card border-border rounded-xl h-9 text-xs">
              <SelectValue placeholder="AI Tool" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value={ALL}>All Tools</SelectItem>
              {AI_TOOLS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={useCaseFilter} onValueChange={setUseCaseFilter}>
            <SelectTrigger className="min-w-[140px] bg-card border-border rounded-xl h-9 text-xs">
              <SelectValue placeholder="Use Case" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value={ALL}>All Use Cases</SelectItem>
              {USE_CASES.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <p className="text-xs text-muted-foreground mb-4">
          Showing {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </p>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <ContentCard key={item.id} {...item} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-muted-foreground">No results match your filters. Try adjusting your search.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Browse;
