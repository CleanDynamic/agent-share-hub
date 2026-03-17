import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "@/components/ContentCard";
import { ProjectCard } from "@/components/ProjectCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, Folder, LayoutGrid, Globe, Lock, Users, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { AddToCollectionModal } from "@/components/AddToCollectionModal";

function CardSkeleton() {
  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <Skeleton className="h-3 w-full rounded-md" />
      <div className="flex justify-between pt-3 border-t border-border">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-4 w-10 rounded-md" />
      </div>
    </div>
  );
}

export default function Saved() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"content" | "projects" | "collections">("content");

  const { data: savedItems, isLoading, error } = useQuery({
    queryKey: ["user_saves_content", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_saves")
        .select("content_id, content_items(*)")
        .eq("user_id", profile!.id)
        .not("content_id", "is", null)
        .order("saved_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: savedProjects, isLoading: projLoading } = useQuery({
    queryKey: ["user_saves_projects", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_saves")
        .select("project_id, projects(*, profiles(id, username, display_name), project_components(id, component_type, linked_content_id, inline_content_id))")
        .eq("user_id", profile!.id)
        .not("project_id", "is", null)
        .order("saved_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch content types for project components
  const projContentIds = (savedProjects ?? []).flatMap((s: any) => {
    const proj = s.projects as any;
    if (!proj) return [];
    return (proj.project_components ?? []).map((c: any) => c.linked_content_id || c.inline_content_id).filter(Boolean);
  });
  const { data: projContentTypes } = useQuery({
    queryKey: ["saved_proj_content_types", projContentIds.join(",")],
    queryFn: async () => {
      if (projContentIds.length === 0) return [];
      const { data } = await supabase.from("content_items").select("id, content_type").in("id", projContentIds);
      return data ?? [];
    },
    enabled: projContentIds.length > 0,
  });

  // Collections queries
  const { data: myCollections, isLoading: colLoading } = useQuery({
    queryKey: ["my_collections", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("id, title, description, item_count, is_public, follower_count, slug")
        .eq("owner_id", profile!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const { data: followedCollections } = useQuery({
    queryKey: ["followed_collections", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_follows")
        .select("collection_id, collections(id, title, description, item_count, is_public, follower_count, slug, profiles!collections_owner_id_fkey(display_name, username))")
        .eq("follower_id", profile!.id)
        .order("followed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  return (
    <div className="py-12 px-6">
      <SeoHead title="Saved — NeoScale AI" description="Your saved content on NeoScale AI." path="/saved" noIndex />
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground mb-4">Saved</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          <button
            onClick={() => setTab("content")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              tab === "content" ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            Saved content
          </button>
          <button
            onClick={() => setTab("projects")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              tab === "projects" ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            Saved projects
          </button>
          <button
            onClick={() => setTab("collections")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              tab === "collections" ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            Collections
          </button>
        </div>

        {tab === "content" && (
          <>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm text-muted-foreground mb-4">Something went wrong loading your saved content.</p>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Reload</Button>
              </div>
            ) : savedItems && savedItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedItems.map((save) => {
                  const item = save.content_items as any;
                  if (!item) return null;
                  return (
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
                      avg_rating={Number(item.avg_rating) || 0}
                      rating_count={item.rating_count ?? 0}
                      view_count={item.view_count ?? 0}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Bookmark className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-sm text-foreground font-medium mb-1">You haven't saved any content yet.</p>
                <p className="text-sm text-muted-foreground mb-4">Hit the bookmark icon on any content to save it here.</p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/browse">Browse content</Link>
                </Button>
              </div>
            )}
          </>
        )}

        {tab === "projects" && (
          <>
            {projLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => <Skeleton key={n} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : savedProjects && savedProjects.length > 0 ? (
              <div className="space-y-3">
                {savedProjects.map((save: any) => {
                  const proj = save.projects as any;
                  if (!proj) return null;
                  const compIds = (proj.project_components ?? []).map((c: any) => c.linked_content_id || c.inline_content_id).filter(Boolean);
                  const types = [...new Set(
                    compIds.map((cid: string) => projContentTypes?.find((ci: any) => ci.id === cid)?.content_type).filter(Boolean)
                  )] as string[];
                  const creatorProfile = proj.profiles as any;
                  return (
                    <ProjectCard
                      key={proj.id}
                      id={proj.id}
                      title={proj.title}
                      description={proj.description}
                      coverImageUrl={proj.cover_image_url}
                      creatorDisplayName={creatorProfile?.display_name || creatorProfile?.username || "Unknown"}
                      creatorUsername={creatorProfile?.username ?? ""}
                      componentTypes={types}
                      componentCount={(proj.project_components ?? []).length}
                      viewCount={proj.view_count}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Folder className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-sm text-foreground font-medium mb-1">You haven't saved any projects yet.</p>
                <p className="text-sm text-muted-foreground mb-4">Bookmark a project to save it here.</p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/browse">Browse projects</Link>
                </Button>
              </div>
            )}
          </>
        )}

        {tab === "collections" && (
          <>
            {colLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => <Skeleton key={n} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-6">
                {/* My collections */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-foreground">My collections</h2>
                  </div>
                  {(myCollections ?? []).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(myCollections ?? []).map((col) => (
                        <Link
                          key={col.id}
                          to={`/collections/${col.slug}`}
                          className="border border-border rounded-xl p-4 bg-card hover:border-primary/40 transition-colors block"
                        >
                          <div className="flex items-start justify-between mb-1">
                            <h3 className="text-sm font-semibold text-foreground truncate">{col.title}</h3>
                            {col.is_public ? (
                              <Badge variant="outline" className="text-[10px] ml-2 shrink-0"><Globe className="h-3 w-3 mr-0.5" />Public</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] ml-2 shrink-0"><Lock className="h-3 w-3 mr-0.5" />Private</Badge>
                            )}
                          </div>
                          {col.description && <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{col.description}</p>}
                          <div className="flex gap-3 text-[10px] text-muted-foreground">
                            <span>{col.item_count} items</span>
                            <span>{col.follower_count} followers</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <LayoutGrid className="h-10 w-10 text-muted-foreground mb-4" />
                      <p className="text-sm text-foreground font-medium mb-1">No collections yet</p>
                      <p className="text-sm text-muted-foreground mb-4">Use the grid icon on any content card to start a collection.</p>
                    </div>
                  )}
                </div>

                {/* Followed collections */}
                {(followedCollections ?? []).length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-foreground mb-3">Collections you follow</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(followedCollections ?? []).map((fc: any) => {
                        const col = fc.collections as any;
                        if (!col) return null;
                        const owner = col.profiles as any;
                        return (
                          <Link
                            key={col.id}
                            to={`/collections/${col.slug}`}
                            className="border border-border rounded-xl p-4 bg-card hover:border-primary/40 transition-colors block"
                          >
                            <h3 className="text-sm font-semibold text-foreground truncate mb-0.5">{col.title}</h3>
                            {owner && <p className="text-[10px] text-muted-foreground mb-1">by {owner.display_name || owner.username}</p>}
                            <div className="flex gap-3 text-[10px] text-muted-foreground">
                              <span>{col.item_count} items</span>
                              <span>{col.follower_count} followers</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
