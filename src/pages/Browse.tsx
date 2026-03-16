import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentCard } from "@/components/ContentCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useApprovedToolNames } from "@/hooks/useApprovedTools";

const ALL = "all";

const CONTENT_TYPES = [
  "Prompt File", "Prompt Tutorial", "Agent Blueprint", "Workflow Template",
  "Agent Stack", "Model Config Guide", "Integration Guide", "Evaluation Framework", "Failure Library",
];
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];

const USE_CASES = ["Social Media", "Research", "Business", "Productivity", "Content", "Learning", "Email", "Finance"];

async function fetchApprovedContent() {
  const { data, error } = await supabase
    .from("content_items")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

function CardSkeleton() {
  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <Skeleton className="h-3 w-full rounded-md" />
      <Skeleton className="h-3 w-5/6 rounded-md" />
      <div className="flex gap-1 pt-1">
        <Skeleton className="h-4 w-14 rounded-md" />
        <Skeleton className="h-4 w-14 rounded-md" />
      </div>
      <div className="flex justify-between pt-3 border-t border-border">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-4 w-10 rounded-md" />
      </div>
    </div>
  );
}

const Browse = () => {
  const { isLoggedIn, profile } = useAuth();
  const { data: AI_TOOLS = [] } = useApprovedTools();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [difficultyFilter, setDifficultyFilter] = useState(ALL);
  const [toolFilter, setToolFilter] = useState(ALL);
  const [useCaseFilter, setUseCaseFilter] = useState(ALL);
  const [matchInterests, setMatchInterests] = useState(false);

  // Fetch full profile with interests for personalisation
  const { data: fullProfile } = useQuery({
    queryKey: ["browse_profile", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_interests, user_ai_tools")
        .eq("id", profile!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id && isLoggedIn,
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["content_items_approved"],
    queryFn: fetchApprovedContent,
  });

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      const q = search.toLowerCase();
      if (q) {
        const inTitle = item.title.toLowerCase().includes(q);
        const inDesc = (item.description ?? "").toLowerCase().includes(q);
        const inType = item.content_type.toLowerCase().includes(q);
        const inUseCases = (item.use_cases ?? []).some((u) => u.toLowerCase().includes(q));
        if (!inTitle && !inDesc && !inType && !inUseCases) return false;
      }
      if (typeFilter !== ALL && item.content_type !== typeFilter) return false;
      if (difficultyFilter !== ALL && item.difficulty !== difficultyFilter) return false;
      if (toolFilter !== ALL && !(item.ai_tools ?? []).includes(toolFilter)) return false;
      if (useCaseFilter !== ALL && !(item.use_cases ?? []).includes(useCaseFilter)) return false;
      // Personalised filter
      if (matchInterests && fullProfile) {
        const interests = (fullProfile as any).user_interests ?? [];
        const tools = (fullProfile as any).user_ai_tools ?? [];
        const matchesInterest = (item.use_cases ?? []).some((u: string) => interests.includes(u));
        const matchesTool = (item.ai_tools ?? []).some((t: string) => tools.includes(t));
        if (!matchesInterest && !matchesTool) return false;
      }
      return true;
    });
  }, [items, search, typeFilter, difficultyFilter, toolFilter, useCaseFilter, matchInterests, fullProfile]);

  function clearFilters() {
    setSearch("");
    setTypeFilter(ALL);
    setDifficultyFilter(ALL);
    setToolFilter(ALL);
    setUseCaseFilter(ALL);
  }

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

        {/* Personalised toggle */}
        {isLoggedIn && fullProfile && (((fullProfile as any).user_interests ?? []).length > 0 || ((fullProfile as any).user_ai_tools ?? []).length > 0) && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMatchInterests(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !matchInterests ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              All content
            </button>
            <button
              onClick={() => setMatchInterests(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                matchInterests ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              Matches my interests
            </button>
          </div>
        )}

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
        {!isLoading && (
          <p className="text-xs text-muted-foreground mb-4">
            Showing {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Grid */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <ContentCard
                key={item.id}
                id={item.id}
                content_type={item.content_type}
                title={item.title}
                description={item.description ?? ""}
                difficulty={item.difficulty}
                ai_tools={item.ai_tools ?? []}
                download_count={item.download_count}
                monetisation_type={item.monetisation_type}
                price_gbp={item.price_gbp ?? undefined}
                file_url={item.file_url}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Nothing found for that combination. Try removing a filter or searching for something else.
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Browse;
