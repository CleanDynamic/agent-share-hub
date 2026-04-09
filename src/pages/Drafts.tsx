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
    <div style={{ paddingTop: 28, paddingBottom: 40, paddingLeft: 24, paddingRight: 24 }}>
      <SeoHead title="Drafts — NeoScale AI" description="Manage your draft posts." path="/drafts" noIndex />
      <div className="mx-auto max-w-3xl">
        <div className="flex justify-end mb-6">
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
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 14,
                    padding: '18px 20px',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    transition: 'border-color 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                >
                  {/* Left */}
                  <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: displayName ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.35)', fontStyle: displayName ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName || "Untitled draft"}
                    </p>
                    <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
                      {draft.content_type && (
                        <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 100, background: 'rgba(232,87,26,0.08)', color: '#E8571A', border: '1px solid rgba(232,87,26,0.2)' }}>
                          {displayContentType(draft.content_type)}
                        </span>
                      )}
                      {draft.difficulty && (
                        <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 100, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {draft.difficulty}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                      Last saved {formatDistanceToNow(new Date(savedAt), { addSuffix: true })}
                    </p>
                    <p style={{ fontSize: 12, color: allComplete ? '#34D399' : 'rgba(255,255,255,0.35)' }}>
                      {allComplete ? "Ready to preview ✓" : `${filled} of ${total} required fields complete`}
                    </p>
                  </div>

                  {/* Right */}
                  <div className="flex items-center shrink-0" style={{ gap: 8 }}>
                    <button
                      onClick={() => navigate(`/upload?draft=${draft.id}`)}
                      style={{ fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 100, border: '1px solid rgba(46,196,182,0.3)', color: '#2EC4B6', background: 'rgba(46,196,182,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Pencil style={{ width: 13, height: 13 }} /> Continue editing
                    </button>
                    <button
                      onClick={() => navigate(`/content/${draft.id}`)}
                      style={{ fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.60)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Eye style={{ width: 13, height: 13 }} /> Preview
                    </button>
                    <button
                      onClick={() => setDeleteTarget(draft.id)}
                      style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', background: 'transparent', cursor: 'pointer' }}
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>No drafts yet.</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', marginBottom: 20 }}>
              Start a new post and save it as a draft to see it here.
            </p>
            <button
              onClick={() => navigate("/upload")}
              style={{ fontSize: 13, fontWeight: 500, padding: '8px 20px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.70)', background: 'transparent', cursor: 'pointer' }}
            >
              Start writing
            </button>
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
