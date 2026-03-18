import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Eye, Pencil, Plus } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { displayContentType } from "@/lib/content-types";

function completionCount(item: any): { filled: number; total: number } {
  const total = 5;
  let filled = 0;
  if (item.title) filled++;
  if (item.content_type) filled++;
  if (item.difficulty) filled++;
  if (item.ai_tools && item.ai_tools.length > 0) filled++;
  if (item.block_count > 0) filled++;
  return { filled, total };
}

export default function DraftsPage() {
  const { isLoggedIn, profile, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isLoggedIn) navigate("/login", { replace: true });
  }, [loading, isLoggedIn, navigate]);

  const { data: drafts, isLoading } = useQuery({
    queryKey: ["my_drafts", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, content_type, difficulty, ai_tools, draft_saved_at, draft_name, created_at")
        .eq("creator_id", profile!.id)
        .eq("status", "draft")
        .order("draft_saved_at", { ascending: false });
      if (error) throw error;

      // Fetch block counts
      if (!data || data.length === 0) return [];
      const ids = data.map((d: any) => d.id);
      const { data: blocks } = await supabase
        .from("content_blocks")
        .select("content_id")
        .in("content_id", ids);
      const blockMap: Record<string, number> = {};
      (blocks ?? []).forEach((b: any) => {
        blockMap[b.content_id] = (blockMap[b.content_id] || 0) + 1;
      });
      return data.map((d: any) => ({ ...d, block_count: blockMap[d.id] || 0 }));
    },
    enabled: !!profile?.id,
  });

  async function handleDelete() {
    if (!deleteTarget) return;
    // Optimistic removal
    queryClient.setQueryData(["my_drafts", profile?.id], (old: any[]) =>
      (old ?? []).filter((d: any) => d.id !== deleteTarget)
    );
    // Delete blocks then item
    await supabase.from("content_blocks").delete().eq("content_id", deleteTarget);
    await supabase.from("content_items").delete().eq("id", deleteTarget);
    setDeleteTarget(null);
  }

  if (loading) return null;

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6">
      <SeoHead title="Drafts — NeoScale AI" description="Manage your draft posts." path="/drafts" noIndex />
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-foreground">Drafts</h1>
            {drafts && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Button size="sm" className="min-h-[44px]" onClick={() => navigate("/upload")}>
            <Plus className="h-4 w-4 mr-1.5" /> New draft
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : drafts && drafts.length > 0 ? (
          <div className="space-y-3">
            {drafts.map((draft: any) => {
              const { filled, total } = completionCount(draft);
              const allComplete = filled === total;
              const displayName = draft.draft_name || draft.title || null;
              const savedAt = draft.draft_saved_at || draft.created_at;

              return (
                <div
                  key={draft.id}
                  className="border border-border rounded-xl p-[14px_16px] bg-card flex items-start gap-4"
                >
                  {/* Left */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className={`text-[15px] font-bold truncate ${displayName ? "text-foreground" : "text-muted-foreground italic"}`}>
                      {displayName || "Untitled draft"}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {draft.content_type && (
                        <Badge variant="secondary" className="text-[10px]">
                          {displayContentType(draft.content_type)}
                        </Badge>
                      )}
                      {draft.difficulty && (
                        <Badge variant="outline" className="text-[10px]">
                          {draft.difficulty}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last saved {formatDistanceToNow(new Date(savedAt), { addSuffix: true })}
                    </p>
                    <p className={`text-xs ${allComplete ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {allComplete
                        ? "Ready to preview ✓"
                        : `${filled} of ${total} required fields complete`}
                    </p>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full text-xs border-secondary text-secondary hover:bg-secondary/10"
                      onClick={() => navigate(`/upload?draft=${draft.id}`)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Continue editing
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full text-xs"
                      onClick={() => navigate(`/content/${draft.id}`)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                    </Button>
                    <button
                      onClick={() => setDeleteTarget(draft.id)}
                      className="h-8 w-8 flex items-center justify-center rounded-full border border-border text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground mb-1">No drafts yet.</p>
            <p className="text-xs text-muted-foreground mb-4">
              Start a new post and save it as a draft to see it here.
            </p>
            <Button className="min-h-[44px]" onClick={() => navigate("/upload")}>
              Start writing
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
