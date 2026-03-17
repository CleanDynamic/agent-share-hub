import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SeoHead } from "@/components/SeoHead";
import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, Clock, Users } from "lucide-react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentCard } from "@/components/ContentCard";
import { ProjectCard } from "@/components/ProjectCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useApprovedToolNames } from "@/hooks/useApprovedTools";
import { SubmitToolModal } from "@/components/SubmitToolModal";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

const ALL = "all";

const CONTENT_TYPES = [
  "Prompt File", "Prompt Tutorial", "Agent Blueprint", "Workflow Template",
  "Agent Stack", "Model Config Guide", "Integration Guide", "Evaluation Framework", "Failure Library",
];
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const USE_CASES = ["Social Media", "Research", "Business", "Productivity", "Content", "Learning", "Email", "Finance", "Hobby", "Other"];

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

function FilterDropdowns({
  typeFilter, setTypeFilter, difficultyFilter, setDifficultyFilter,
  toolFilter, setToolFilter, useCaseFilter, setUseCaseFilter, AI_TOOLS,
}: any) {
  return (
    <>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full bg-card border-border rounded-xl h-10">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value={ALL}>All Types</SelectItem>
            {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="w-full bg-card border-border rounded-xl h-10">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value={ALL}>All Levels</SelectItem>
            {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">AI Tool</label>
        <Select value={toolFilter} onValueChange={setToolFilter}>
          <SelectTrigger className="w-full bg-card border-border rounded-xl h-10">
            <SelectValue placeholder="AI Tool" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value={ALL}>All Tools</SelectItem>
            {AI_TOOLS.map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Use Case</label>
        <Select value={useCaseFilter} onValueChange={setUseCaseFilter}>
          <SelectTrigger className="w-full bg-card border-border rounded-xl h-10">
            <SelectValue placeholder="Use Case" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value={ALL}>All Use Cases</SelectItem>
            {USE_CASES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

const SLUG_TO_TYPE: Record<string, string> = {
  "prompt-file": "Prompt File",
  "prompt-tutorial": "Prompt Tutorial",
  "agent-blueprint": "Agent Blueprint",
  "workflow-template": "Workflow Template",
  "agent-stack": "Agent Stack",
  "model-config-guide": "Model Config Guide",
  "integration-guide": "Integration Guide",
  "evaluation-framework": "Evaluation Framework",
  "failure-library": "Failure Library",
};

const Browse = () => {
  const { isLoggedIn, profile } = useAuth();
  const { data: AI_TOOLS } = useApprovedToolNames();
  const [searchParams] = useSearchParams();
  const [browseTab, setBrowseTab] = useState<"content" | "projects" | "paths">(() => {
    const t = searchParams.get("tab");
    if (t === "projects") return "projects";
    if (t === "paths") return "paths";
    return "content";
  });
  const [search, setSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(() => {
    const slug = searchParams.get("type");
    return slug && SLUG_TO_TYPE[slug] ? SLUG_TO_TYPE[slug] : ALL;
  });
  const [difficultyFilter, setDifficultyFilter] = useState(ALL);
  const [toolFilter, setToolFilter] = useState(ALL);
  const [useCaseFilter, setUseCaseFilter] = useState(ALL);
  const [matchInterests, setMatchInterests] = useState(false);
  const [submitToolOpen, setSubmitToolOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // React to query param changes from right panel navigation
  useEffect(() => {
    const tab = searchParams.get("tab");
    const typeSlug = searchParams.get("type");
    if (tab === "projects") {
      setBrowseTab("projects");
    } else if (tab === "paths") {
      setBrowseTab("paths");
    } else if (typeSlug && SLUG_TO_TYPE[typeSlug]) {
      setBrowseTab("content");
      setTypeFilter(SLUG_TO_TYPE[typeSlug]);
    }
  }, [searchParams]);

  const activeFilterCount = [typeFilter, difficultyFilter, toolFilter, useCaseFilter].filter((f) => f !== ALL).length;

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

  const { data: items, isLoading, error } = useQuery({
    queryKey: ["content_items_approved"],
    queryFn: fetchApprovedContent,
  });

  // Projects query
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects_approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, profiles(id, username, display_name), project_components(id, component_type, linked_content_id, inline_content_id)")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: browseTab === "projects",
  });

  // Fetch content items for project component types
  const projectContentIds = (projects ?? []).flatMap((p: any) =>
    (p.project_components ?? []).map((c: any) => c.linked_content_id || c.inline_content_id).filter(Boolean)
  );
  const { data: projectContentItems } = useQuery({
    queryKey: ["project_content_types", projectContentIds.join(",")],
    queryFn: async () => {
      if (projectContentIds.length === 0) return [];
      const { data } = await supabase
        .from("content_items")
        .select("id, content_type")
        .in("id", projectContentIds);
      return data ?? [];
    },
    enabled: projectContentIds.length > 0,
  });

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    const q = projectSearch.toLowerCase();
    if (!q) return projects;
    return projects.filter((p: any) =>
      p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [projects, projectSearch]);

  const hasFilters = search || typeFilter !== ALL || difficultyFilter !== ALL || toolFilter !== ALL || useCaseFilter !== ALL;

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
    setMatchInterests(false);
  }

  const filterProps = {
    typeFilter, setTypeFilter, difficultyFilter, setDifficultyFilter,
    toolFilter, setToolFilter, useCaseFilter, setUseCaseFilter, AI_TOOLS,
  };

  return (
    <div className="py-10 px-4 sm:px-6">
      <SeoHead
        title="Browse AI Assistants — NeoScale AI"
        description="Find ready-made AI setups for any task. Filter by type, difficulty, and the AI tools you already use. Free to download."
        path="/browse"
      />
      <div className="mx-auto max-w-5xl">
        {/* Content / Projects / Paths tabs */}
        <div className="flex gap-1 mb-4">
          <button
            onClick={() => setBrowseTab("content")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              browseTab === "content"
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            Content
          </button>
          <button
            onClick={() => setBrowseTab("projects")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              browseTab === "projects"
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => setBrowseTab("paths")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              browseTab === "paths"
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            Learning Paths
          </button>
        </div>

        {browseTab === "projects" ? (
          <>
            {/* Project search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="pl-10 h-12 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-xl"
              />
            </div>

            {!projectsLoading && (
              <p className="text-xs text-muted-foreground mb-4">
                Showing {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""}
              </p>
            )}

            {projectsLoading && (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            )}

            {!projectsLoading && filteredProjects.length > 0 && (
              <div className="space-y-3">
                {filteredProjects.map((proj: any) => {
                  const creator = proj.profiles as { id: string; username: string; display_name: string | null } | null;
                  const compIds = (proj.project_components ?? []).map((c: any) => c.linked_content_id || c.inline_content_id).filter(Boolean);
                  const types = [...new Set(
                    compIds.map((cid: string) => projectContentItems?.find((ci: any) => ci.id === cid)?.content_type).filter(Boolean)
                  )] as string[];

                  return (
                    <ProjectCard
                      key={proj.id}
                      id={proj.id}
                      title={proj.title}
                      description={proj.description}
                      coverImageUrl={null}
                      creatorDisplayName={creator?.display_name || creator?.username || "Unknown"}
                      creatorUsername={creator?.username || ""}
                      componentTypes={types}
                      componentCount={(proj.project_components ?? []).length}
                      viewCount={proj.view_count}
                    />
                  );
                })}
              </div>
            )}

            {!projectsLoading && filteredProjects.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  {projectSearch ? "No projects match that search." : "No projects published yet."}
                </p>
                {projectSearch && (
                  <Button variant="outline" size="sm" onClick={() => setProjectSearch("")}>Clear search</Button>
                )}
              </div>
            )}
          </>
        ) : (
        <>
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                !matchInterests ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              All content
            </button>
            <button
              onClick={() => setMatchInterests(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                matchInterests ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              Matches my interests
            </button>
          </div>
        )}

        {/* Desktop filters */}
        <div className="hidden md:flex gap-3 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="min-w-[160px] bg-card border-border rounded-xl h-9 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value={ALL}>All Types</SelectItem>
              {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="min-w-[140px] bg-card border-border rounded-xl h-9 text-xs">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value={ALL}>All Levels</SelectItem>
              {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={toolFilter} onValueChange={setToolFilter}>
            <SelectTrigger className="min-w-[140px] bg-card border-border rounded-xl h-9 text-xs">
              <SelectValue placeholder="AI Tool" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value={ALL}>All Tools</SelectItem>
              {AI_TOOLS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={useCaseFilter} onValueChange={setUseCaseFilter}>
            <SelectTrigger className="min-w-[140px] bg-card border-border rounded-xl h-9 text-xs">
              <SelectValue placeholder="Use Case" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value={ALL}>All Use Cases</SelectItem>
              {USE_CASES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile filter button */}
        <div className="md:hidden mb-4">
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="min-h-[44px] border-secondary text-secondary">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-background border-border rounded-t-2xl max-h-[80vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-foreground">Filters</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-4">
                <FilterDropdowns {...filterProps} />
                {isLoggedIn && fullProfile && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMatchInterests(false)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium min-h-[44px] ${
                        !matchInterests ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"
                      }`}
                    >
                      All content
                    </button>
                    <button
                      onClick={() => setMatchInterests(true)}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium min-h-[44px] ${
                        matchInterests ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"
                      }`}
                    >
                      My interests
                    </button>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 min-h-[44px]" onClick={clearFilters}>Clear all</Button>
                  <Button className="flex-1 min-h-[44px]" onClick={() => setFilterSheetOpen(false)}>Apply</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Submit a tool link */}
        <div className="mb-4">
          <button
            onClick={() => setSubmitToolOpen(true)}
            className="text-xs text-primary hover:underline"
          >
            Don't see your AI tool? Submit it →
          </button>
        </div>

        {/* Results count */}
        {!isLoading && !error && (
          <p className="text-xs text-muted-foreground mb-4">
            Showing {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-sm text-muted-foreground text-center">Something went wrong loading content. Please try again.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Reload</Button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {/* Grid */}
        {!isLoading && !error && filtered.length > 0 && (
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
                avg_rating={Number((item as any).avg_rating) || 0}
                rating_count={(item as any).rating_count ?? 0}
                view_count={(item as any).view_count ?? 0}
              />
            ))}
          </div>
        )}

        {/* Empty states */}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            {matchInterests && hasFilters ? (
              <>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Nothing matches your interests yet. We'll add more content soon — or browse everything.
                </p>
                <Button variant="outline" size="sm" onClick={() => { setMatchInterests(false); clearFilters(); }}>
                  Show all content
                </Button>
              </>
            ) : hasFilters ? (
              <>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Nothing matches those filters. Try removing one or clearing them all.
                </p>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear all filters
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Nothing here yet — be the first to share something.
                </p>
                <Button size="sm" asChild>
                  <Link to="/upload">Upload your work</Link>
                </Button>
              </>
            )}
          </div>
        )}
        </>
        )}
      </div>

      <SubmitToolModal open={submitToolOpen} onOpenChange={setSubmitToolOpen} />
    </div>
  );
};

export default Browse;
