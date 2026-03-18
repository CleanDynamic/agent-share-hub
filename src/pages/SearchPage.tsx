import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { ContentCard } from "@/components/ContentCard";
import { ProjectCard } from "@/components/ProjectCard";
import { FollowButton } from "@/components/FollowButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, Hash } from "lucide-react";

const STORAGE_KEY = "neoscale_recent_searches";
const MAX_RECENT = 5;

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveRecent(q: string) {
  const prev = getRecent().filter((s) => s !== q);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [input, setInput] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const isTagSearch = q.startsWith("#");

  useEffect(() => { setInput(q); }, [q]);
  useEffect(() => { if (!q) inputRef.current?.focus(); }, [q]);
  useEffect(() => { setRecentSearches(getRecent()); }, []);

  const runSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    saveRecent(trimmed);
    setRecentSearches(getRecent());
    setParams({ q: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") runSearch(input);
  };

  // Posts — regular or tag search
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["search_posts", q],
    enabled: !!q,
    queryFn: async () => {
      if (isTagSearch) {
        // Tag search: join content_microtags
        const { data } = await supabase
          .from("content_microtags")
          .select("content_id, content_items!content_microtags_content_id_fkey(*, profiles!content_items_creator_id_fkey(username))")
          .eq("tag", q)
          .limit(30);
        const items = (data ?? [])
          .map((r: any) => r.content_items)
          .filter((i: any) => i && i.status === "approved")
          .sort((a: any, b: any) => (b.download_count + b.view_count) - (a.download_count + a.view_count));
        return items;
      }
      const { data } = await supabase
        .from("content_items")
        .select("*, profiles!content_items_creator_id_fkey(username)")
        .eq("status", "approved")
        .or(`title.ilike.%${q}%,description.ilike.%${q}%,content_type.ilike.%${q}%,what_to_expect.ilike.%${q}%,custom_use_case_description.ilike.%${q}%`)
        .order("download_count", { ascending: false })
        .limit(50);
      // Also include items matching ai_tools/use_cases arrays (client-side filter)
      const lowerQ = q.toLowerCase();
      const results = (data || []).filter((item: any) => {
        if (item.title?.toLowerCase().includes(lowerQ)) return true;
        if (item.description?.toLowerCase().includes(lowerQ)) return true;
        if (item.content_type?.toLowerCase().includes(lowerQ)) return true;
        if (item.what_to_expect?.toLowerCase().includes(lowerQ)) return true;
        if (item.custom_use_case_description?.toLowerCase().includes(lowerQ)) return true;
        if ((item.ai_tools ?? []).some((t: string) => t.toLowerCase().includes(lowerQ))) return true;
        if ((item.use_cases ?? []).some((u: string) => u.toLowerCase().includes(lowerQ))) return true;
        return false;
      }).slice(0, 30);
      return results;
    },
  });

  // Projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["search_projects", q],
    enabled: !!q,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*, profiles!projects_creator_id_fkey(username, display_name), project_components(id, component_type)")
        .eq("status", "approved")
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .order("view_count", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  // People
  const { data: people, isLoading: peopleLoading } = useQuery({
    queryKey: ["search_people", q],
    enabled: !!q,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, follower_count, is_creator, is_admin")
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%,bio.ilike.%${q}%`)
        .or("is_creator.eq.true,is_admin.eq.true")
        .limit(20);
      // Filter client-side to require both conditions (name match AND creator/admin)
      return (data || []).filter(
        (p) =>
          (p.is_creator || p.is_admin) &&
          (
            (p.display_name || "").toLowerCase().includes(q.toLowerCase()) ||
            (p.username || "").toLowerCase().includes(q.toLowerCase()) ||
            (p.bio || "").toLowerCase().includes(q.toLowerCase())
          )
      );
    },
  });

  const postCount = posts?.length ?? 0;
  const projectCount = projects?.length ?? 0;
  const peopleCount = people?.length ?? 0;
  const isLoading = postsLoading || projectsLoading || peopleLoading;

  const defaultTab = useMemo(() => {
    if (!q) return "posts";
    if (peopleCount >= postCount && peopleCount >= projectCount) return "people";
    if (projectCount >= postCount) return "projects";
    return "posts";
  }, [postCount, projectCount, peopleCount, q]);

  const clearRecent = () => {
    localStorage.removeItem(STORAGE_KEY);
    setRecentSearches([]);
  };

  return (
    <>
      <SeoHead title={q ? `"${q}" — Search | NeoScale AI` : "Search | NeoScale AI"} description="Search posts, projects, and creators on NeoScale AI" path="/search" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Search input */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search NeoScale AI"
            className="h-12 pl-11 pr-4 text-base bg-card border-border"
          />
        </div>

        {/* Empty state — recent searches */}
        {!q && (
          <div className="py-10">
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">Recent searches</p>
                  <button onClick={clearRecent} className="text-xs text-primary hover:underline">Clear</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((s) => (
                    <button
                      key={s}
                      onClick={() => runSearch(s)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-accent/60 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {recentSearches.length === 0 && (
              <p className="text-center text-muted-foreground">Start typing to search posts, projects, and creators.</p>
            )}
          </div>
        )}

        {/* Results */}
        {q && (
          <Tabs defaultValue={defaultTab} key={`${q}-${defaultTab}`}>
            <TabsList className="mb-6">
              <TabsTrigger value="posts">Posts {!isLoading && `(${postCount})`}</TabsTrigger>
              <TabsTrigger value="projects">Projects {!isLoading && `(${projectCount})`}</TabsTrigger>
              <TabsTrigger value="people">People {!isLoading && `(${peopleCount})`}</TabsTrigger>
            </TabsList>

            {/* Posts tab */}
            <TabsContent value="posts">
              {isTagSearch && postCount > 0 && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[#2EC4B6]/10 border border-[#2EC4B6]/30 text-[#2EC4B6] text-sm">
                  <Hash className="h-4 w-4 shrink-0" />
                  <span>Showing posts tagged <strong>{q}</strong></span>
                  <button onClick={() => setParams({})} className="ml-auto hover:text-foreground">×</button>
                </div>
              )}
              {postsLoading ? (
                <div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
              ) : postCount === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No posts found for "{q}".</p>
                  <Link to="/browse" className="text-primary hover:underline text-sm mt-2 inline-block">Try browsing by category</Link>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {posts!.map((item: any) => (
                    <ContentCard
                      key={item.id}
                      id={item.id}
                      content_type={item.content_type}
                      title={item.title}
                      description={item.description || ""}
                      difficulty={item.difficulty}
                      ai_tools={item.ai_tools || []}
                      download_count={item.download_count}
                      monetisation_type={item.monetisation_type}
                      price_gbp={item.price_gbp}
                      file_url={item.file_url}
                      creator_username={item.profiles?.username}
                      avg_rating={item.avg_rating}
                      rating_count={item.rating_count}
                      view_count={item.view_count}
                      is_fork={!!item.fork_of_content_id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Projects tab */}
            <TabsContent value="projects">
              {projectsLoading ? (
                <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
              ) : projectCount === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No projects found for "{q}".</div>
              ) : (
                <div className="space-y-4">
                  {projects!.map((p: any) => {
                    const types = [...new Set((p.project_components || []).map((c: any) => c.component_type))];
                    return (
                      <ProjectCard
                        key={p.id}
                        id={p.id}
                        title={p.title}
                        description={p.description}
                        coverImageUrl={p.cover_image_url}
                        creatorDisplayName={p.profiles?.display_name || p.profiles?.username || "Unknown"}
                        creatorUsername={p.profiles?.username || ""}
                        componentTypes={types as string[]}
                        componentCount={(p.project_components || []).length}
                        viewCount={p.view_count}
                      />
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* People tab */}
            <TabsContent value="people">
              {peopleLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
              ) : peopleCount === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No creators found for "{q}".</div>
              ) : (
                <div className="space-y-2">
                  {people!.map((p: any) => {
                    const initials = (p.display_name || p.username || "?").slice(0, 2).toUpperCase();
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/creator/${p.username}`)}
                      >
                        <Avatar className="h-12 w-12 shrink-0">
                          {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{p.display_name || p.username}</p>
                          {p.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
                          {p.bio && <p className="text-xs text-muted-foreground truncate mt-0.5">{p.bio}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{p.follower_count} followers</span>
                        <div onClick={(e) => e.stopPropagation()}>
                          <FollowButton creatorId={p.id} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}
