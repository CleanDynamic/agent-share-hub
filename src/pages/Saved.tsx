import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "@/components/ContentCard";
import { ProjectCard } from "@/components/ProjectCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Bookmark, Folder, LayoutGrid, Globe, Lock, Eye, Plus, Search, FolderPlus, X, Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

function CardSkeleton() {
  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <Skeleton className="h-3 w-full rounded-md" />
    </div>
  );
}

function VisibilityBadge({ visibility, isPublic }: { visibility?: string; isPublic?: boolean }) {
  const vis = visibility ?? (isPublic ? "public" : "private");
  if (vis === "public") {
    return <Badge variant="outline" className="text-[10px] ml-2 shrink-0 bg-[hsl(174,60%,51%)]/15 text-[hsl(174,60%,51%)] border-[hsl(174,60%,51%)]/30"><Globe className="h-3 w-3 mr-0.5" />Public</Badge>;
  }
  if (vis === "unlisted") {
    return <Badge variant="outline" className="text-[10px] ml-2 shrink-0 bg-muted/50 text-muted-foreground border-border"><Eye className="h-3 w-3 mr-0.5" />Unlisted</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] ml-2 shrink-0 bg-amber-500/15 text-amber-400 border-amber-500/30"><Lock className="h-3 w-3 mr-0.5" />Private</Badge>;
}

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private", desc: "Only you", icon: Lock },
  { value: "unlisted", label: "Unlisted", desc: "Anyone with the link", icon: Eye },
  { value: "public", label: "Public", desc: "Visible on your profile", icon: Globe },
] as const;

export default function Saved() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"content" | "projects" | "folders">("content");
  const [search, setSearch] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderTitle, setFolderTitle] = useState("");
  const [folderDesc, setFolderDesc] = useState("");
  const [folderVis, setFolderVis] = useState<"private" | "unlisted" | "public">("private");
  const [creating, setCreating] = useState(false);

  // Saved content
  const { data: savedItems, isLoading } = useQuery({
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

  // Saved projects
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

  // Folders (collections)
  const { data: myFolders, isLoading: foldersLoading } = useQuery({
    queryKey: ["my_collections", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("id, title, description, item_count, is_public, visibility, follower_count, slug")
        .eq("owner_id", profile!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const { data: followedFolders } = useQuery({
    queryKey: ["followed_collections", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_follows")
        .select("collection_id, collections(id, title, description, item_count, is_public, visibility, follower_count, slug, profiles!collections_owner_id_fkey(display_name, username))")
        .eq("follower_id", profile!.id)
        .order("followed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  // Search filtering
  const filteredContent = useMemo(() => {
    if (!savedItems) return [];
    if (!search.trim()) return savedItems;
    const q = search.toLowerCase();
    return savedItems.filter((s) => {
      const item = s.content_items as any;
      if (!item) return false;
      return item.title?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
    });
  }, [savedItems, search]);

  const filteredProjects = useMemo(() => {
    if (!savedProjects) return [];
    if (!search.trim()) return savedProjects;
    const q = search.toLowerCase();
    return savedProjects.filter((s: any) => {
      const proj = s.projects as any;
      if (!proj) return false;
      return proj.title?.toLowerCase().includes(q) || proj.description?.toLowerCase().includes(q);
    });
  }, [savedProjects, search]);

  const filteredFolders = useMemo(() => {
    if (!myFolders) return [];
    if (!search.trim()) return myFolders;
    const q = search.toLowerCase();
    return myFolders.filter((f) => f.title.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q));
  }, [myFolders, search]);

  const filteredFollowed = useMemo(() => {
    if (!followedFolders) return [];
    if (!search.trim()) return followedFolders;
    const q = search.toLowerCase();
    return followedFolders.filter((fc: any) => {
      const col = fc.collections as any;
      return col?.title?.toLowerCase().includes(q);
    });
  }, [followedFolders, search]);

  // Create folder
  async function handleCreateFolder() {
    if (!profile || !folderTitle.trim()) return;
    setCreating(true);
    const slug = `${folderTitle.trim()}-${profile.username ?? profile.id.slice(0, 8)}`
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
    const { error } = await supabase.from("collections").insert({
      owner_id: profile.id,
      title: folderTitle.trim(),
      description: folderDesc.trim() || null,
      is_public: folderVis === "public",
      visibility: folderVis,
      slug,
      item_count: 0,
    } as any);
    if (error) {
      toast({ title: "Failed to create folder", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Folder "${folderTitle.trim()}" created` });
      qc.invalidateQueries({ queryKey: ["my_collections"] });
      setFolderTitle("");
      setFolderDesc("");
      setFolderVis("private");
      setShowCreateFolder(false);
      setTab("folders");
    }
    setCreating(false);
  }

  return (
    <div className="py-12 px-6">
      <SeoHead title="Saved — NeoScale AI" description="Your saved content on NeoScale AI." path="/saved" noIndex />
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-foreground">Saved</h1>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowCreateFolder(true)}
          >
            <FolderPlus className="h-4 w-4" /> New folder
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved items..."
            className="pl-9 bg-card border-border"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          {(["content", "projects", "folders"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                tab === t ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "content" ? "Blueprints" : t === "projects" ? "Projects" : "Folders"}
              {t === "folders" && (myFolders?.length ?? 0) > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({myFolders!.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Content tab */}
        {tab === "content" && (
          <>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : filteredContent.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContent.map((save) => {
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
                <p className="text-sm text-foreground font-medium mb-1">
                  {search ? "No matching saved content." : "You haven't saved any content yet."}
                </p>
                {!search && (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">Hit the bookmark icon on any content to save it here.</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/browse">Browse content</Link>
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Projects tab */}
        {tab === "projects" && (
          <>
            {projLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => <Skeleton key={n} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : filteredProjects.length > 0 ? (
              <div className="space-y-3">
                {filteredProjects.map((save: any) => {
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
                <p className="text-sm text-foreground font-medium mb-1">
                  {search ? "No matching saved projects." : "You haven't saved any projects yet."}
                </p>
                {!search && (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">Bookmark a project to save it here.</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/browse">Browse projects</Link>
                    </Button>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Folders tab */}
        {tab === "folders" && (
          <>
            {foldersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => <Skeleton key={n} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-6">
                {/* My folders */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-foreground">My folders</h2>
                    <button
                      onClick={() => setShowCreateFolder(true)}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" /> New
                    </button>
                  </div>
                  {filteredFolders.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredFolders.map((col) => (
                        <Link
                          key={col.id}
                          to={`/collections/${col.slug}`}
                          className="border border-border rounded-xl p-4 bg-card hover:border-primary/40 transition-colors block"
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                              <h3 className="text-sm font-semibold text-foreground truncate">{col.title}</h3>
                            </div>
                            <VisibilityBadge visibility={(col as any).visibility} isPublic={col.is_public} />
                          </div>
                          {col.description && <p className="text-xs text-muted-foreground line-clamp-1 mb-2 pl-6">{col.description}</p>}
                          <div className="flex gap-3 text-[10px] text-muted-foreground pl-6">
                            <span>{col.item_count} items</span>
                            <span>{col.follower_count} followers</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Folder className="h-10 w-10 text-muted-foreground mb-4" />
                      <p className="text-sm text-foreground font-medium mb-1">
                        {search ? "No matching folders." : "No folders yet"}
                      </p>
                      {!search && (
                        <p className="text-sm text-muted-foreground mb-4">
                          Create a folder to organise your saved content.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Followed folders */}
                {filteredFollowed.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-foreground mb-3">Folders you follow</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredFollowed.map((fc: any) => {
                        const col = fc.collections as any;
                        if (!col) return null;
                        const owner = col.profiles as any;
                        return (
                          <Link
                            key={col.id}
                            to={`/collections/${col.slug}`}
                            className="border border-border rounded-xl p-4 bg-card hover:border-primary/40 transition-colors block"
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                              <h3 className="text-sm font-semibold text-foreground truncate">{col.title}</h3>
                            </div>
                            {owner && <p className="text-[10px] text-muted-foreground mb-1 pl-6">by {owner.display_name || owner.username}</p>}
                            <div className="flex gap-3 text-[10px] text-muted-foreground pl-6">
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

      {/* Create folder modal */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-base">Create a new folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <Input
              value={folderTitle}
              onChange={(e) => setFolderTitle(e.target.value.slice(0, 80))}
              placeholder="Folder name"
              className="h-9 text-sm"
            />
            <Input
              value={folderDesc}
              onChange={(e) => setFolderDesc(e.target.value.slice(0, 200))}
              placeholder="Description (optional)"
              className="h-9 text-sm"
            />
            <div className="space-y-1.5">
              {VISIBILITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = folderVis === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFolderVis(opt.value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={!folderTitle.trim() || creating}
              onClick={handleCreateFolder}
            >
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Create folder
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
