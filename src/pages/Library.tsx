import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Smile, X, Plus } from "lucide-react";
import { PublishCollectionModal } from "@/components/PublishCollectionModal";
import { LibraryHeader } from "@/components/library/LibraryHeader";
import { LibraryControls } from "@/components/library/LibraryControls";
import { LibraryCategoryFilter } from "@/components/library/LibraryCategoryFilter";
import { LibraryGrid } from "@/components/library/LibraryGrid";
import { LibrarySidebar } from "@/components/library/LibrarySidebar";

const COMMON_EMOJIS = ["⚡", "🔥", "💡", "🎯", "📌", "🚀", "💎", "🧠", "📁", "🎨", "🔧", "✨", "📊", "🤖", "💻", "🎓", "📝", "🏷️", "⭐", "🌟"];

export default function LibraryPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [sort, setSort] = useState<"recent" | "rating">("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
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

    // Category filter
    if (categoryFilter) {
      items = items.filter((lib: any) => lib.content_items?.content_type === categoryFilter);
    }

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
  }, [libraryItems, activeFolder, categoryFilter, search, sort]);

  const updateCount = libraryItems?.filter((l: any) => l.has_update).length ?? 0;

  const activeFolderObj = folders?.find((f: any) => f.id === activeFolder);
  const publishFolderObj = folders?.find((f: any) => f.id === publishFolderId) ?? null;
  const publishFolderItems = useMemo(() => {
    if (!publishFolderId || !libraryItems) return [];
    return libraryItems.filter((l: any) => l.folder_id === publishFolderId);
  }, [publishFolderId, libraryItems]);

  const folderLabel = activeFolder === "root"
    ? "Unsorted"
    : activeFolder
      ? `${activeFolderObj?.emoji ?? ""} ${activeFolderObj?.name ?? "Folder"}`.trim()
      : "All items";

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
    await supabase.from("user_library").update({ folder_id: null } as any).eq("folder_id", folderId);
    await supabase.from("library_folders").delete().eq("id", folderId);
    qc.invalidateQueries({ queryKey: ["library_folders"] });
    qc.invalidateQueries({ queryKey: ["user_library"] });
    if (activeFolder === folderId) setActiveFolder(null);
    setConfirmDeleteId(null);
    toast({ title: "Folder deleted. Items moved to library root." });
  }, [activeFolder, qc, toast]);

  return (
    <div style={{ paddingTop: 28, paddingBottom: 40, paddingLeft: 24, paddingRight: 24 }}>
      <SeoHead title="Your Library — NeoScale AI" description="Your personal content library on NeoScale AI." path="/library" noIndex />
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <LibraryHeader
          itemCount={libraryItems?.length ?? 0}
          updateCount={updateCount}
        />

        {/* Controls */}
        <LibraryControls
          search={search}
          onSearchChange={setSearch}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortBy={sort}
          onSortChange={setSort}
          onNewFolder={() => setShowCreate(true)}
        />

        {/* Category filter chips */}
        <LibraryCategoryFilter
          activeCategory={categoryFilter}
          onCategoryChange={setCategoryFilter}
        />

        {/* Create folder inline */}
        {showCreate && (
          <div
            className="mb-5 space-y-2"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowEmojiGrid(!showEmojiGrid)}
                className="h-9 w-9 rounded-md flex items-center justify-center text-sm shrink-0 transition-colors"
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {newEmoji || <Smile className="h-4 w-4" />}
              </button>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value.slice(0, 50))}
                placeholder="Folder name..."
                className="bg-background"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") createFolder(); }}
              />
              <Button size="sm" onClick={createFolder} disabled={!newName.trim()}>
                Create
              </Button>
              <button
                onClick={() => { setShowCreate(false); setShowEmojiGrid(false); }}
                className="p-1 transition-colors"
                style={{ color: "rgba(255,255,255,0.28)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {showEmojiGrid && (
              <div className="grid grid-cols-10 gap-1">
                {COMMON_EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => { setNewEmoji(em); setShowEmojiGrid(false); }}
                    className="h-8 w-8 rounded flex items-center justify-center text-sm transition-colors"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <LibrarySidebar
            folders={folders ?? []}
            activeFolder={activeFolder}
            onFolderSelect={setActiveFolder}
            totalItemCount={libraryItems?.length ?? 0}
            unsortedCount={libraryItems?.filter((l: any) => !l.folder_id).length ?? 0}
            libraryItems={libraryItems ?? []}
            editingId={editingId}
            editName={editName}
            onEditStart={(id, name) => { setEditingId(id); setEditName(name); }}
            onEditNameChange={setEditName}
            onEditSave={renameFolder}
            onEditCancel={() => setEditingId(null)}
            onDeleteRequest={setConfirmDeleteId}
            folderMenuOpenId={folderMenuOpenId}
            onMenuToggle={setFolderMenuOpenId}
            onPublishRequest={setPublishFolderId}
            onNewFolder={() => setShowCreate(true)}
            onToast={(msg) => toast({ title: msg })}
          />

          {/* Main content area */}
          <div className="flex-1 min-w-0">
            {/* Folder header */}
            <div className="flex items-center justify-between mb-4">
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 300,
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {folderLabel} — {filtered.length} {filtered.length === 1 ? "item" : "items"}
              </p>
              {activeFolder && activeFolder !== "root" && activeFolderObj && filtered.length >= 2 && (
                <button
                  onClick={() => setPublishFolderId(activeFolder)}
                  className="transition-all"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(46,196,182,0.3)",
                    color: "#2EC4B6",
                    background: "rgba(46,196,182,0.08)",
                  }}
                >
                  {activeFolderObj.published_collection_id ? "Update Collection" : "Publish as Collection"}
                </button>
              )}
            </div>

            {/* Grid */}
            <LibraryGrid
              items={filtered}
              isLoading={isLoading}
              isSearching={!!search.trim() || !!categoryFilter}
              viewMode={viewMode}
            />
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
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
              background: "rgba(8,8,12,0.80)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            onClick={() => setConfirmDeleteId(null)}
          >
            <div
              className="max-w-sm mx-4"
              style={{
                background: "rgba(16,16,24,0.95)",
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: 24,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.90)",
                  marginBottom: 8,
                }}
              >
                Delete folder?
              </h3>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 300,
                  color: "rgba(255,255,255,0.45)",
                  marginBottom: 20,
                }}
              >
                Items will move to your main library. They won't be deleted.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="transition-colors"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.45)",
                    background: "transparent",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteFolder(confirmDeleteId)}
                  className="transition-colors"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: "#EF4444",
                    background: "rgba(239,68,68,0.1)",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
