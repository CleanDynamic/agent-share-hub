import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "@/components/ContentCard";
import { ProjectCard } from "@/components/ProjectCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Library, Search, Plus, X, Folder, GripVertical, Smile, Pencil, Trash2, MoreHorizontal, Share2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PublishCollectionModal } from "@/components/PublishCollectionModal";

const COMMON_EMOJIS = ["⚡", "🔥", "💡", "🎯", "📌", "🚀", "💎", "🧠", "📁", "🎨", "🔧", "✨", "📊", "🤖", "💻", "🎓", "📝", "🏷️", "⭐", "🌟"];

export default function LibraryPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null); // null = "all"
  const [sort, setSort] = useState<"recent" | "rating">("recent");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [publishFolderId, setPublishFolderId] = useState<string | null>(null);
  const [folderMenuOpenId, setFolderMenuOpenId] = useState<string | null>(null);

  // Folders
  const { data: folders } = useQuery({
    queryKey: ["library_folders", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("library_folders")
        .select("*")
        .eq("user_id", profile!.id)
        .order("position", { ascending: true });
      return (data as any[]) ?? [];
    },
    enabled: !!profile?.id,
  });

  // Library items
  const { data: libraryItems, isLoading } = useQuery({
    queryKey: ["user_library", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_library")
        .select("id, content_id, project_id, folder_id, added_at, has_update, last_seen_version, content_items(*)")
        .eq("user_id", profile!.id)
        .order("added_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!profile?.id,
  });

  const filtered = useMemo(() => {
    if (!libraryItems) return [];
    let items = libraryItems;

    // Folder filter
    if (activeFolder === "root") {
      items = items.filter((lib: any) => !lib.folder_id);
    } else if (activeFolder) {
      items = items.filter((lib: any) => lib.folder_id === activeFolder);
    }
    // else activeFolder === null means "all"

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((lib: any) => {
        const item = lib.content_items;
        if (!item) return false;
        return item.title?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
      });
    }

    // Sort
    if (sort === "rating") {
      items = [...items].sort((a: any, b: any) => {
        const ra = Number(a.content_items?.avg_rating) || 0;
        const rb = Number(b.content_items?.avg_rating) || 0;
        return rb - ra;
      });
    }

    return items;
  }, [libraryItems, activeFolder, search, sort]);

  const updateCount = libraryItems?.filter((l: any) => l.has_update).length ?? 0;

  const activeFolderObj = folders?.find((f: any) => f.id === activeFolder);

  // Items for the folder being published (used by PublishCollectionModal)
  const publishFolderObj = folders?.find((f: any) => f.id === publishFolderId) ?? null;
  const publishFolderItems = useMemo(() => {
    if (!publishFolderId || !libraryItems) return [];
    return libraryItems.filter((l: any) => l.folder_id === publishFolderId);
  }, [publishFolderId, libraryItems]);
  const folderLabel = activeFolder === "root" ? "📚 Library" : activeFolder ? `${activeFolderObj?.emoji ?? ""} ${activeFolderObj?.name ?? "Folder"}`.trim() : "All items";

  // Create folder
  const createFolder = useCallback(async () => {
    if (!profile || !newName.trim()) return;
    const maxPos = folders?.reduce((m: number, f: any) => Math.max(m, f.position || 0), 0) ?? 0;
    await supabase.from("library_folders").insert({
      user_id: profile.id,
      name: newName.trim().slice(0, 50),
      emoji: newEmoji || null,
      position: maxPos + 1,
    } as any);
    qc.invalidateQueries({ queryKey: ["library_folders"] });
    setNewName("");
    setNewEmoji("");
    setShowCreate(false);
    setShowEmojiGrid(false);
    toast({ title: `Folder "${newName.trim()}" created` });
  }, [profile, newName, newEmoji, folders, qc, toast]);

  // Rename folder
  const renameFolder = useCallback(async (folderId: string) => {
    if (!editName.trim()) return;
    await supabase.from("library_folders").update({ name: editName.trim().slice(0, 50) } as any).eq("id", folderId);
    qc.invalidateQueries({ queryKey: ["library_folders"] });
    setEditingId(null);
    setEditName("");
  }, [editName, qc]);

  // Delete folder
  const deleteFolder = useCallback(async (folderId: string) => {
    // Move items to root first
    await supabase.from("user_library").update({ folder_id: null } as any).eq("folder_id", folderId);
    await supabase.from("library_folders").delete().eq("id", folderId);
    qc.invalidateQueries({ queryKey: ["library_folders"] });
    qc.invalidateQueries({ queryKey: ["user_library"] });
    if (activeFolder === folderId) setActiveFolder(null);
    setConfirmDeleteId(null);
    toast({ title: "Folder deleted. Items moved to library root." });
  }, [activeFolder, qc, toast]);

  return (
    <div className="py-12 px-4 sm:px-6">
      <SeoHead title="Your Library — NeoScale AI" description="Your personal content library on NeoScale AI." path="/library" noIndex />
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-foreground">Your Library</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: "linear-gradient(135deg, rgba(232,87,26,0.6), rgba(255,120,50,0.4))",
              cursor: "pointer",
            }}
          >
            <Plus className="h-4 w-4" style={{ color: "white" }} />
            <span style={{ color: "white", fontWeight: 600, fontSize: "14px", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>New folder</span>
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {libraryItems?.length ?? 0} item{(libraryItems?.length ?? 0) !== 1 ? "s" : ""}
          {updateCount > 0 && <span className="ml-2 text-primary font-medium">· {updateCount} updated</span>}
        </p>

        {/* Create folder inline */}
        {showCreate && (
          <div className="mb-4 p-3 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowEmojiGrid(!showEmojiGrid)} className="h-9 w-9 rounded-md border border-border flex items-center justify-center text-sm hover:bg-accent shrink-0">
                {newEmoji || <Smile className="h-4 w-4 text-muted-foreground" />}
              </button>
              <Input value={newName} onChange={(e) => setNewName(e.target.value.slice(0, 50))} placeholder="Folder name..." className="bg-background" autoFocus onKeyDown={(e) => { if (e.key === "Enter") createFolder(); }} />
              <Button size="sm" onClick={createFolder} disabled={!newName.trim()}>Create</Button>
              <button onClick={() => { setShowCreate(false); setShowEmojiGrid(false); }} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            {showEmojiGrid && (
              <div className="grid grid-cols-10 gap-1">
                {COMMON_EMOJIS.map((em) => (
                  <button key={em} onClick={() => { setNewEmoji(em); setShowEmojiGrid(false); }} className="h-8 w-8 rounded hover:bg-accent flex items-center justify-center text-sm">{em}</button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar (desktop) / pill row (mobile) */}
          <>
            {/* Desktop sidebar */}
            <div className="hidden lg:block w-[200px] shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Folders</p>
              </div>
                <button
                  onClick={() => setActiveFolder(null)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${!activeFolder ? "text-primary font-semibold border-l-2 border-primary bg-accent/40" : "text-muted-foreground hover:text-foreground hover:bg-accent/40"}`}
                >
                  📚 All items
                  <span className="ml-auto text-[11px] text-muted-foreground">{libraryItems?.length ?? 0}</span>
                </button>
                <button
                  onClick={() => setActiveFolder("root")}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${activeFolder === "root" ? "text-primary font-semibold border-l-2 border-primary bg-accent/40" : "text-muted-foreground hover:text-foreground hover:bg-accent/40"}`}
                >
                  Unsorted
                  <span className="ml-auto text-[11px] text-muted-foreground">{libraryItems?.filter((l: any) => !l.folder_id).length ?? 0}</span>
                </button>
                {(folders ?? []).map((folder: any) => (
                  <div key={folder.id} className="group relative">
                    {editingId === folder.id ? (
                      <div className="flex items-center gap-1 px-2 py-1">
                        <input value={editName} onChange={(e) => setEditName(e.target.value.slice(0, 50))} className="flex-1 h-7 rounded border border-border bg-background px-2 text-sm outline-none" autoFocus onKeyDown={(e) => { if (e.key === "Enter") renameFolder(folder.id); if (e.key === "Escape") setEditingId(null); }} />
                        <button onClick={() => renameFolder(folder.id)} className="text-xs text-primary">Save</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveFolder(folder.id)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${activeFolder === folder.id ? "text-primary font-semibold border-l-2 border-primary bg-accent/40" : "text-muted-foreground hover:text-foreground hover:bg-accent/40"}`}
                      >
                        {folder.emoji && <span>{folder.emoji}</span>}
                        <span className="truncate">{folder.name}</span>
                        {folder.published_collection_id && (
                          <span className="text-[9px] font-medium px-1 rounded" style={{ background: "rgba(46,196,182,0.2)", color: "#2EC4B6" }}>
                            Published
                          </span>
                        )}
                        <span className="ml-auto text-[11px] text-muted-foreground">{folder.item_count}</span>
                      </button>
                    )}
                    {editingId !== folder.id && (
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                        <button onClick={() => { setEditingId(folder.id); setEditName(folder.name); }} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => setConfirmDeleteId(folder.id)} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent"><Trash2 className="h-3 w-3" /></button>
                        <button
                          onClick={() => setFolderMenuOpenId(folderMenuOpenId === folder.id ? null : folder.id)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                          title="More options"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {/* Folder three-dot dropdown */}
                    {folderMenuOpenId === folder.id && (
                      <div
                        className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-card shadow-lg py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => { setEditingId(folder.id); setEditName(folder.name); setFolderMenuOpenId(null); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Rename folder
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(folder.id); setFolderMenuOpenId(null); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete folder
                        </button>
                        <div className="my-1 border-t border-border" />
                        <button
                          onClick={() => {
                            const itemsInFolder = libraryItems?.filter((l: any) => l.folder_id === folder.id) ?? [];
                            if (itemsInFolder.length < 2) {
                              toast({ title: "Add at least 2 items to this folder first" });
                              setFolderMenuOpenId(null);
                              return;
                            }
                            setPublishFolderId(folder.id);
                            setFolderMenuOpenId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
                        >
                          <Share2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#2EC4B6" }} />
                          <span style={{ color: "#2EC4B6" }}>
                            {folder.published_collection_id ? "Update Collection" : "Publish as Collection"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 text-xs text-secondary hover:text-secondary/80 px-3 py-2 mt-1">
                  <Plus className="h-3 w-3" /> New folder
                </button>
              </div>

              {/* Mobile pill row */}
              <div className="lg:hidden flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
                <button
                  onClick={() => setActiveFolder(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${!activeFolder ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveFolder("root")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${activeFolder === "root" ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}
                >
                  📚 Unsorted
                </button>
                {(folders ?? []).map((folder: any) => (
                  <button
                    key={folder.id}
                    onClick={() => setActiveFolder(folder.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${activeFolder === folder.id ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}
                  >
                    {folder.emoji ? `${folder.emoji} ` : ""}{folder.name}
                  </button>
                ))}
              </div>
            </>

          {/* Main content area */}
          <div className="flex-1 min-w-0">
            {/* Search + Sort */}
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your library..." className="pl-9 bg-card border-border" />
              </div>
              <div className="flex gap-1 shrink-0">
                {(["recent", "rating"] as const).map((s) => (
                  <button key={s} onClick={() => setSort(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sort === s ? "text-white border border-white" : "bg-accent text-muted-foreground hover:text-foreground"}`} style={sort === s ? { background: "#1E1E2A" } : undefined}>
                    {s === "recent" ? "Recent" : "Most ⭐"}
                  </button>
                ))}
              </div>
            </div>

            {/* Folder header */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{folderLabel} — {filtered.length} {filtered.length === 1 ? "item" : "items"}</p>
              {activeFolder && activeFolder !== "root" && activeFolderObj && filtered.length >= 2 && (
                <button
                  onClick={() => setPublishFolderId(activeFolder)}
                  className="text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
                  style={{
                    borderColor: "#2EC4B6",
                    color: "#2EC4B6",
                  }}
                >
                  {activeFolderObj.published_collection_id ? "Update Collection" : "Publish as Collection"}
                </button>
              )}
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="border border-border rounded-xl p-5 bg-card space-y-3">
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-full rounded-md" />
                  </div>
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                {filtered.map((lib: any) => {
                  const item = lib.content_items;
                  if (!item) return null;
                  return (
                    <div key={lib.id} className="relative">
                      {lib.has_update && <div className="absolute -top-1.5 -right-1.5 z-10 h-3 w-3 rounded-full bg-primary" />}
                      <ContentCard
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
                        libraryMode
                      />
                      {lib.has_update && <p className="text-[11px] text-primary mt-1 px-1">Updated since you saved this</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Library className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-sm text-foreground font-medium mb-1">{search ? "No matching items." : "Your library is empty."}</p>
                {!search && (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">Hit the bookmark icon on any content to save it here.</p>
                    <Button variant="outline" size="sm" asChild><Link to="/browse">Browse content</Link></Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dismiss folder menu on outside click */}
        {folderMenuOpenId && (
          <div className="fixed inset-0 z-10" onClick={() => setFolderMenuOpenId(null)} />
        )}

        {/* Publish / Sync collection modal */}
        {publishFolderId && publishFolderObj && (
          <PublishCollectionModal
            open={!!publishFolderId}
            onOpenChange={(o) => { if (!o) setPublishFolderId(null); }}
            folder={{
              id: publishFolderObj.id,
              name: publishFolderObj.name,
              emoji: publishFolderObj.emoji,
              published_collection_id: publishFolderObj.published_collection_id ?? null,
            }}
            items={publishFolderItems}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["library_folders", profile?.id] });
              setPublishFolderId(null);
            }}
          />
        )}

        {/* Delete confirmation */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)}>
            <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-foreground mb-2">Delete folder?</h3>
              <p className="text-sm text-muted-foreground mb-4">Items will move to your main library. They won't be deleted.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={() => deleteFolder(confirmDeleteId)}>Delete</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
