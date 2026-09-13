import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUploadPicker } from "@/contexts/UploadPickerContext";
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
import { ShellHeader } from "@/components/shell/ShellHeader";
// Straight from the module, not the @/lib/build barrel: this page is eagerly
// imported by App, and the barrel would pull the whole build layer — intake,
// portable, gallery, layers — into the main chunk with it.
import { listDraftBuildsByCreator } from "@/lib/build/builds";
import { categoryFill } from "@/lib/theme/category";
import { buttonStyle, chipStyle, chipType, uiTransition } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText } from "@/lib/theme/type";

/* ── THE COMPLETENESS VOICE (BG-P25 task 5) ─────────────────────────────────
   A percentage over a part-full row is a mark out of a hundred whatever the
   words around it say, and a creator whose draft is finished at 60% is being
   told they are four-tenths short of something. BG-P23 took the percentage and
   the bar out of the compose panel for exactly that reason, and left a count of
   outstanding items in words: "Everything this record asks for is here", "One
   thing left to add", "3 things left to add". These two functions say the same
   thing about a draft row, in the same voice, in `--text2` like every other
   line on the row — an invitation, never a score, and never a badge.

   A BUILD DRAFT HAS NO SUCH COUNT TO REPORT. This list reads build HEADERS —
   no nodes, no tree — so `computeCompleteness` cannot run here and the only
   figure available is `builds.completeness`, which is the percentage. Turning
   a percentage into a fake count would be inventing the number, so the build
   line says the true thing it can say and points at the place that knows the
   rest. The column is still written and the gallery still gates on it; it is
   simply not something this page says out loud.
   ─────────────────────────────────────────────────────────────────────────── */

/** What a content draft still needs, in words. */
function contentDraftLine(filled: number, total: number): string {
  const left = Math.max(0, total - filled);
  if (left === 0) return "Everything this draft asks for is here.";
  return `${left === 1 ? "One thing" : `${left} things`} left to add`;
}

/** The same, for a build draft, which can only report finished or not. */
function buildDraftLine(completeness: number): string {
  if (completeness >= 100) return "Everything this record asks for is here.";
  return "Open it to see what the record still needs";
}

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

/* ── Two tools, one list ────────────────────────────────────────────────────
   Drafts live in two places now: content_items, written by the previous
   upload editor, and builds, written by the build workspace. A creator with
   work in both has to be able to see all of it, so both are fetched and
   merged into one list ordered by when each was last worked on. Every row
   says which tool it belongs to and opens in that tool.
   ────────────────────────────────────────────────────────────────────────── */

type DraftSource = "content" | "build";

/** What a row needs, whichever tool wrote it. */
interface DraftRow {
  source: DraftSource;
  id: string;
  /** Last-worked-on time — the sort key for the merged list. */
  savedAt: string;
  displayName: string | null;
  /** The original record, for the fields only one of the two shapes has. */
  item: any;
}

/* Which tool wrote a draft is a fact about the record, not a category of part,
   so neither of these borrows a category hue: the current workspace takes the
   recess fill and the previous one an outline. */
const TOOL_LABEL: Record<DraftSource, { label: string; filled: boolean }> = {
  build:   { label: "Build workspace", filled: true },
  content: { label: "Previous tool",   filled: false },
};

export default function DraftsPage() {
  const { isLoggedIn, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { openUploadTypePicker } = useUploadPicker();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isLoggedIn) navigate("/login", { replace: true });
  }, [loading, isLoggedIn, navigate]);

  const { data: contentDrafts, isLoading: contentLoading } = useQuery({
    queryKey: ["my_drafts", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, content_type, post_type, difficulty, ai_tools, draft_saved_at, draft_name, created_at")
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

  const { data: buildDrafts, isLoading: buildsLoading } = useQuery({
    queryKey: ["my_build_drafts", profile?.id],
    queryFn: () => listDraftBuildsByCreator(profile!.id),
    enabled: !!profile?.id,
  });

  const isLoading = contentLoading || buildsLoading;

  const drafts: DraftRow[] = useMemo(() => {
    const rows: DraftRow[] = [
      ...(contentDrafts ?? []).map((d) => ({
        source: "content" as const,
        id: d.id,
        savedAt: d.draft_saved_at || d.created_at,
        displayName: d.draft_name || d.title || null,
        item: d,
      })),
      ...(buildDrafts ?? []).map((b) => ({
        source: "build" as const,
        id: b.id,
        savedAt: b.updated_at || b.created_at,
        displayName: b.title || null,
        item: b,
      })),
    ];
    return rows.sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
  }, [contentDrafts, buildDrafts]);

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
    <div style={{ paddingBottom: 40 }}>
      <SeoHead title="Drafts — buildgallery.ai" description="Manage your draft posts." path="/drafts" noIndex />
      <ShellHeader
        onBack={() => navigate(-1)}
        primaryAction={{ label: "New draft", icon: Plus, onClick: () => openUploadTypePicker() }}
      />
      <div className="mx-auto max-w-3xl" style={{ paddingLeft: 24, paddingRight: 24 }}>


        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : drafts && drafts.length > 0 ? (
          <div className="space-y-3">
            {drafts.map((row: DraftRow) => {
              const draft = row.item;
              const isBuild = row.source === "build";
              const tool = TOOL_LABEL[row.source];
              const { filled, total } = completionCount(draft);
              const displayName = row.displayName;
              const savedAt = row.savedAt;

              return (
                <div
                  key={`${row.source}:${row.id}`}
                  /* A list row: transparent at rest behind a `--line`
                     hairline, `--recess` under the pointer at `--r-control`.
                     A row that is already a filled box cannot get louder on
                     hover, which is what made a list of these read as a stack
                     of cards. */
                  style={{
                    background: 'transparent',
                    border: `1px solid ${t.line}`,
                    borderRadius: r.control,
                    padding: '18px 20px',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    transition: uiTransition(),
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = t.recess)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Left */}
                  <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <p style={{ ...body, fontSize: 15, fontWeight: 600, color: displayName ? t.text : t.text2, fontStyle: displayName ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                      {displayName || "Untitled draft"}
                    </p>
                    <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
                      {/* Which tool this draft belongs to, and so which editor
                          the Continue button opens. */}
                      <span style={{ ...chipStyle(tool.filled ? "neutral" : "outline"), fontSize: 10, padding: '2px 8px' }}>
                        {tool.label}
                      </span>
                      {isBuild ? (
                        draft.shape && (
                          <span style={{ ...chipStyle("outline"), fontSize: 10, padding: '2px 8px' }}>
                            {draft.shape}
                          </span>
                        )
                      ) : (() => {
                        const pt = (draft.post_type as string | null) || 'blueprint';
                        /* Four private hexes become four of the nine part
                           categories, both halves of each measured pair. */
                        const ptMap: Record<string, { label: string; category: string }> = {
                          blueprint:  { label: 'Blueprint', category: 'configuration' },
                          blog:       { label: 'Blog',      category: 'narrative' },
                          discussion: { label: 'Blog',      category: 'narrative' },
                          bounty:     { label: 'Bounty',    category: 'breakage' },
                        };
                        const meta = ptMap[pt] ?? ptMap.blueprint;
                        const fill = categoryFill(meta.category);
                        return (
                          <span style={{ ...chipType, fontSize: 10, padding: '2px 8px', borderRadius: r.chip, backgroundColor: fill.background, color: fill.color }}>
                            {meta.label}
                          </span>
                        );
                      })()}
                      {!isBuild && draft.content_type && (
                        <span style={{ ...chipStyle("outline"), fontSize: 10, padding: '2px 8px' }}>
                          {displayContentType(draft.content_type)}
                        </span>
                      )}
                      {!isBuild && draft.difficulty && (
                        /* BG-P05: difficulty is not a part category and carries
                           no colour — one uncoloured mono label. */
                        <span style={{ ...chipStyle("outline"), fontSize: 10, padding: '2px 8px' }}>
                          {draft.difficulty}
                        </span>
                      )}
                    </div>
                    <p style={{ ...dataText, fontSize: 12, color: t.text2, margin: 0 }}>
                      Last saved {formatDistanceToNow(new Date(savedAt), { addSuffix: true })}
                    </p>
                    {/* ONE INK FOR BOTH OUTCOMES. The finished line used to go
                        green and the unfinished line grey, which made "not
                        finished yet" read as a fault. Both are `--text2`: a
                        draft in progress is a draft, not a failure. */}
                    <p style={{ ...body, fontSize: 12, color: t.text2, margin: 0 }}>
                      {isBuild
                        ? buildDraftLine(draft.completeness ?? 0)
                        : contentDraftLine(filled, total)}
                    </p>
                  </div>

                  {/* Right */}
                  <div className="flex items-center shrink-0" style={{ gap: 8 }}>
                    <button
                      onClick={() => {
                        if (isBuild) { navigate(`/compose/${draft.id}`); return; }
                        const pt = (draft.post_type as string | null) || 'blueprint';
                        if (pt === 'blog') navigate(`/upload/blog?draft=${draft.id}`);
                        else if (pt === 'bounty') navigate(`/upload/bounty?id=${draft.id}`);
                        else navigate(`/upload/blueprint?draft=${draft.id}`);
                      }}
                      /* The row's one primary: continuing is what a drafts
                         list is for. */
                      style={{ ...buttonStyle("default"), ...body, fontSize: 12, fontWeight: 500, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Pencil style={{ width: 13, height: 13 }} /> Continue editing
                    </button>
                    {/* Preview and delete stay on the old path only. A draft
                        build has no public page to preview, and deleting one
                        is the workspace's own job. */}
                    {!isBuild && (
                      <>
                        <button
                          onClick={() => navigate(`/content/${draft.id}`)}
                          style={{ ...buttonStyle("secondary"), ...body, fontSize: 12, fontWeight: 500, padding: '6px 14px', color: t.text2, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Eye style={{ width: 13, height: 13 }} /> Preview
                        </button>
                        <button
                          onClick={() => setDeleteTarget(draft.id)}
                          aria-label="Delete draft"
                          style={{ ...buttonStyle("secondary"), width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: t.catBreakage, color: t.catBreakage }}
                        >
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p style={{ ...body, fontSize: 14, fontWeight: 500, color: t.text, marginBottom: 6 }}>No drafts yet.</p>
            <p style={{ ...body, fontSize: 13, color: t.text2, marginBottom: 20, textWrap: "pretty" }}>
              Start a new post and save it as a draft to see it here.
            </p>
            <button
              onClick={() => openUploadTypePicker()}
              /* The one way out of an empty view earns the primary. */
              style={{ ...buttonStyle("default"), ...body, fontSize: 13, fontWeight: 500, padding: '8px 20px' }}
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
