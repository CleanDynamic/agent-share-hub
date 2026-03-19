import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, X, Check, Plus, Smile } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface BookmarkButtonProps {
  contentId: string;
  projectId?: string;
  className?: string;
}

const COMMON_EMOJIS = ["⚡", "🔥", "💡", "🎯", "📌", "🚀", "💎", "🧠", "📁", "🎨", "🔧", "✨", "📊", "🤖", "💻", "🎓", "📝", "🏷️", "⭐", "🌟"];

export function BookmarkButton({ contentId, projectId, className }: BookmarkButtonProps) {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderEmoji, setNewFolderEmoji] = useState("");
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Fetch library status
  useEffect(() => {
    if (!isLoggedIn || !user) { setLoaded(true); return; }
    const q = supabase
      .from("user_library")
      .select("id, folder_id")
      .eq("user_id", user.id);
    if (projectId) {
      (q as any).eq("project_id", projectId);
    } else {
      q.eq("content_id", contentId);
    }
    q.maybeSingle().then(({ data }) => {
      setSaved(!!data);
      setCurrentFolderId((data as any)?.folder_id ?? null);
      setLoaded(true);
    });
  }, [isLoggedIn, user, contentId, projectId]);

  // Fetch user's folders
  const { data: folders } = useQuery({
    queryKey: ["library_folders", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("library_folders")
        .select("*")
        .eq("user_id", user!.id)
        .order("position", { ascending: true });
      return (data as any[]) ?? [];
    },
    enabled: !!user?.id && pickerOpen,
  });

  // Close on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    function handler(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
        setCreatingFolder(false);
        setShowEmojiGrid(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isLoggedIn || !user) {
      toast({ title: "Sign in to save this" });
      setTimeout(() => navigate("/signup"), 1000);
      return;
    }

    // If user has folders, always open picker
    if (folders && folders.length > 0) {
      setPickerOpen(true);
      return;
    }

    // No folders — simple toggle
    if (saved) {
      setSaved(false);
      const q = supabase.from("user_library").delete().eq("user_id", user.id);
      if (projectId) { (q as any).eq("project_id", projectId); }
      else { q.eq("content_id", contentId); }
      const { error } = await q;
      if (error) setSaved(true);
      else toast({ title: "Removed from library" });
    } else {
      setSaved(true);
      const insertData: any = { user_id: user.id, content_id: contentId };
      if (projectId) { insertData.project_id = projectId; delete insertData.content_id; }
      const { error } = await supabase.from("user_library").insert(insertData);
      if (error) setSaved(false);
      else toast({ title: "Saved to library" });
    }
    qc.invalidateQueries({ queryKey: ["user_library"] });
  }, [saved, isLoggedIn, user, contentId, projectId, navigate, toast, folders, qc]);

  // If no folders loaded yet but clicked, open picker to load them
  const handleClickWithFolderCheck = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isLoggedIn || !user) {
      toast({ title: "Sign in to save this" });
      setTimeout(() => navigate("/signup"), 1000);
      return;
    }

    // Open picker — it will load folders via useQuery
    setPickerOpen(true);
  }, [isLoggedIn, user, navigate, toast]);

  const saveToFolder = useCallback(async (folderId: string | null) => {
    if (!user) return;
    if (saved && currentFolderId === folderId) {
      // Remove from library
      const q = supabase.from("user_library").delete().eq("user_id", user.id);
      if (projectId) { (q as any).eq("project_id", projectId); }
      else { q.eq("content_id", contentId); }
      await q;
      setSaved(false);
      setCurrentFolderId(null);
      toast({ title: "Removed from library" });
      // Update folder item counts
      if (folderId) {
        await supabase.rpc("increment_download_count" as any, {} as any).then(() => {});
        // Decrement folder count manually
        const folder = folders?.find((f: any) => f.id === folderId);
        if (folder) {
          await supabase.from("library_folders").update({ item_count: Math.max(0, (folder.item_count || 1) - 1) } as any).eq("id", folderId);
        }
      }
    } else if (saved) {
      // Move to different folder
      const q = supabase.from("user_library").update({ folder_id: folderId } as any).eq("user_id", user.id);
      if (projectId) { (q as any).eq("project_id", projectId); }
      else { q.eq("content_id", contentId); }
      await q;
      // Update folder counts
      if (currentFolderId) {
        const oldFolder = folders?.find((f: any) => f.id === currentFolderId);
        if (oldFolder) await supabase.from("library_folders").update({ item_count: Math.max(0, (oldFolder.item_count || 1) - 1) } as any).eq("id", currentFolderId);
      }
      if (folderId) {
        const newFolder = folders?.find((f: any) => f.id === folderId);
        if (newFolder) await supabase.from("library_folders").update({ item_count: (newFolder.item_count || 0) + 1 } as any).eq("id", folderId);
      }
      setCurrentFolderId(folderId);
      const folderName = folderId ? folders?.find((f: any) => f.id === folderId)?.name : "Library";
      toast({ title: `Moved to ${folderName}` });
    } else {
      // New save
      const insertData: any = { user_id: user.id, content_id: contentId, folder_id: folderId };
      if (projectId) { insertData.project_id = projectId; delete insertData.content_id; }
      await supabase.from("user_library").insert(insertData);
      setSaved(true);
      setCurrentFolderId(folderId);
      if (folderId) {
        const folder = folders?.find((f: any) => f.id === folderId);
        if (folder) await supabase.from("library_folders").update({ item_count: (folder.item_count || 0) + 1 } as any).eq("id", folderId);
      }
      const folderName = folderId ? folders?.find((f: any) => f.id === folderId)?.name : "Library";
      toast({ title: `Saved to ${folderName}` });
    }
    setPickerOpen(false);
    qc.invalidateQueries({ queryKey: ["library_folders"] });
    qc.invalidateQueries({ queryKey: ["user_library"] });
  }, [user, saved, currentFolderId, contentId, projectId, folders, toast, qc]);

  const createFolder = useCallback(async () => {
    if (!user || !newFolderName.trim()) return;
    const maxPos = folders?.reduce((m: number, f: any) => Math.max(m, f.position || 0), 0) ?? 0;
    const { data, error } = await supabase.from("library_folders").insert({
      user_id: user.id,
      name: newFolderName.trim().slice(0, 50),
      emoji: newFolderEmoji || null,
      position: maxPos + 1,
    } as any).select().single();
    if (!error && data) {
      qc.invalidateQueries({ queryKey: ["library_folders"] });
      setNewFolderName("");
      setNewFolderEmoji("");
      setCreatingFolder(false);
      setShowEmojiGrid(false);
    }
  }, [user, newFolderName, newFolderEmoji, folders, qc]);

  if (!loaded) return null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleClickWithFolderCheck}
        className={`p-1 rounded-md transition-colors hover:bg-accent ${className ?? ""}`}
        aria-label={saved ? "Saved" : "Save"}
      >
        <Bookmark
          className={`h-4 w-4 transition-colors ${
            saved ? "fill-primary text-primary" : "text-muted-foreground"
          }`}
        />
      </button>

      {/* Folder Picker Popover */}
      {pickerOpen && (
        <div
          ref={popRef}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 z-50 min-w-[220px] max-w-[280px] rounded-xl border border-border bg-card/95 backdrop-blur-md p-3 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-bold text-foreground">Save to Library</span>
            <button onClick={() => { setPickerOpen(false); setCreatingFolder(false); }} className="p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Root library */}
          <button
            onClick={() => saveToFolder(null)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground hover:bg-accent/60 transition-colors"
          >
            <span>📚</span>
            <span className="flex-1 text-left">Library</span>
            {saved && currentFolderId === null && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>

          {/* Folders */}
          {(folders ?? []).map((folder: any) => (
            <button
              key={folder.id}
              onClick={() => saveToFolder(folder.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground hover:bg-accent/60 transition-colors"
            >
              {folder.emoji && <span>{folder.emoji}</span>}
              <span className="flex-1 text-left truncate">{folder.name}</span>
              <span className="text-[11px] text-muted-foreground">{folder.item_count}</span>
              {saved && currentFolderId === folder.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}

          {/* Divider */}
          <div className="border-t border-border my-2" />

          {/* New folder */}
          {!creatingFolder ? (
            <button
              onClick={() => setCreatingFolder(true)}
              className="flex items-center gap-1.5 text-xs text-secondary hover:text-secondary/80 px-2 py-1"
            >
              <Plus className="h-3 w-3" /> New folder
            </button>
          ) : (
            <div className="space-y-2 px-1">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowEmojiGrid(!showEmojiGrid)}
                  className="h-8 w-8 rounded-md border border-border flex items-center justify-center text-sm hover:bg-accent"
                >
                  {newFolderEmoji || <Smile className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value.slice(0, 50))}
                  placeholder="Folder name..."
                  className="flex-1 h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") createFolder(); }}
                />
                <button
                  onClick={createFolder}
                  disabled={!newFolderName.trim()}
                  className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                >
                  Create
                </button>
              </div>
              {showEmojiGrid && (
                <div className="grid grid-cols-10 gap-1">
                  {COMMON_EMOJIS.map((em) => (
                    <button
                      key={em}
                      onClick={() => { setNewFolderEmoji(em); setShowEmojiGrid(false); }}
                      className="h-7 w-7 rounded hover:bg-accent flex items-center justify-center text-sm"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
