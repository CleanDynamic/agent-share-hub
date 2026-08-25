import { useEffect, useState } from "react";
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
import { deleteBuild, listBuildsByCreator } from "@/lib/build";
import type { Build } from "@/lib/build/types";

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

/* ────────────────────────────────────────────────
   Two tools write drafts now, into two different tables. A creator with
   work in both places sees all of it in one list, newest first, each
   entry saying which tool it belongs to and opening in that tool.

   Both are normalised to this shape so the list has one sort key and one
   card; everything tool-specific hangs off `tool`.
──────────────────────────────────────────────── */
type DraftTool = "post" | "build";

interface DraftEntry {
  key: string;
  id: string;
  tool: DraftTool;
  name: string | null;
  updatedAt: string;
  editHref: string;
  previewHref: string | null;
  /** Chips under the title, left to right. */
  chips: { label: string; color: string }[];
  progress: { text: string; done: boolean };
}

const TOOL_LABEL: Record<DraftTool, { label: string; color: string }> = {
  post: { label: "Post editor", color: "#8B4513" },
  build: { label: "Build workspace", color: "#1F7A6D" },
};

const POST_TYPE_CHIP: Record<string, { label: string; color: string }> = {
  blueprint: { label: "Blueprint", color: "#E8571A" },
  blog: { label: "Blog", color: "#2EC4B6" },
  discussion: { label: "Blog", color: "#2EC4B6" },
  bounty: { label: "Bounty", color: "#F59E0B" },
};

/** Where the old editor picks up a draft, by the post type it was started as. */
function postEditHref(id: string, postType: string): string {
  if (postType === "blog") return `/upload/blog?draft=${id}`;
  if (postType === "bounty") return `/upload/bounty?id=${id}`;
  return `/upload/blueprint?draft=${id}`;
}

function postEntry(draft: any): DraftEntry {
  const postType = (draft.post_type as string | null) || "blueprint";
  const { filled, total } = completionCount(draft);
  const chips = [TOOL_LABEL.post, POST_TYPE_CHIP[postType] ?? POST_TYPE_CHIP.blueprint];
  if (draft.content_type) {
    chips.push({ label: displayContentType(draft.content_type), color: "#8B4513" });
  }
  if (draft.difficulty) chips.push({ label: draft.difficulty, color: "#FFFFFF" });

  return {
    key: `post:${draft.id}`,
    id: draft.id,
    tool: "post",
    name: draft.draft_name || draft.title || null,
    updatedAt: draft.draft_saved_at || draft.created_at,
    editHref: postEditHref(draft.id, postType),
    previewHref: `/content/${draft.id}`,
    chips,
    progress: {
      text: filled === total
        ? "Ready to preview ✓"
        : `${filled} of ${total} required fields complete`,
      done: filled === total,
    },
  };
}

function buildEntry(build: Build): DraftEntry {
  const completeness = build.completeness ?? 0;
  const chips = [TOOL_LABEL.build];
  if (build.shape) chips.push({ label: build.shape.replace(/_/g, " "), color: "#E8571A" });

  return {
    key: `build:${build.id}`,
    id: build.id,
    tool: "build",
    name: build.title || null,
    // A build record autosaves as you work, so updated_at is the honest
    // "last saved" and the right key to sort both lists against.
    updatedAt: build.updated_at || build.created_at,
    editHref: `/compose/${build.id}`,
    previewHref: build.slug ? `/b2/${build.slug}` : null,
    chips,
    progress: {
      text: completeness >= 100
        ? "Ready to publish ✓"
        : `${completeness}% of the record written down`,
      done: completeness >= 100,
    },
  };
}

export default function DraftsPage() {
  const { isLoggedIn, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { openUploadTypePicker } = useUploadPicker();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ tool: DraftTool; id: string } | null>(null);

  useEffect(() => {
    if (!loading && !isLoggedIn) navigate("/login", { replace: true });
  }, [loading, isLoggedIn, navigate]);

  const { data: drafts, isLoading } = useQuery({
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

  // builds.creator_id is the auth user id, and profiles.id is a PK on
  // auth.users(id) — the same value, so one id serves both queries.
  const { data: buildDrafts, isLoading: buildsLoading } = useQuery({
    queryKey: ["my_build_drafts", profile?.id],
    queryFn: () => listBuildsByCreator(profile!.id, { status: "draft" }),
    enabled: !!profile?.id,
  });

  const entries: DraftEntry[] = [
    ...((drafts ?? []) as any[]).map(postEntry),
    ...((buildDrafts ?? []) as Build[]).map(buildEntry),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const isLoadingAny = isLoading || buildsLoading;

  async function handleDelete() {
    if (!deleteTarget) return;
    const { tool, id } = deleteTarget;

    if (tool === "build") {
      // Optimistic removal
      queryClient.setQueryData(["my_build_drafts", profile?.id], (old: Build[] | undefined) =>
        (old ?? []).filter((b) => b.id !== id)
      );
      // Nodes, events and media rows go with it — the FKs cascade.
      await deleteBuild(id);
      setDeleteTarget(null);
      return;
    }

    // Optimistic removal
    queryClient.setQueryData(["my_drafts", profile?.id], (old: any[]) =>
      (old ?? []).filter((d: any) => d.id !== id)
    );
    // Delete blocks then item
    await supabase.from("content_blocks").delete().eq("content_id", id);
    await supabase.from("content_items").delete().eq("id", id);
    setDeleteTarget(null);
  }

  if (loading) return null;

  return (
    <div style={{ paddingBottom: 40 }}>
      <SeoHead title="Drafts — NeoScale AI" description="Manage your draft posts." path="/drafts" noIndex />
      <ShellHeader
        onBack={() => navigate(-1)}
        primaryAction={{ label: "New draft", icon: Plus, onClick: () => openUploadTypePicker() }}
      />
      <div className="mx-auto max-w-3xl" style={{ paddingLeft: 24, paddingRight: 24 }}>


        {/* List — both tools, newest first */}
        {isLoadingAny ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : entries.length > 0 ? (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.key}
                data-testid={`draft-${entry.key}`}
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: 14,
                  padding: '18px 20px',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  transition: 'border-color 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)')}
              >
                {/* Left */}
                <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: entry.name ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.35)', fontStyle: entry.name ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.name || (entry.tool === 'build' ? "Untitled build" : "Untitled draft")}
                  </p>
                  <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
                    {entry.chips.map((chip, i) => (
                      <span
                        key={`${entry.key}:chip:${i}`}
                        style={{
                          fontSize: 10,
                          fontWeight: i === 0 ? 600 : 500,
                          padding: '2px 8px',
                          borderRadius: 100,
                          background: `${chip.color}14`,
                          color: chip.color === '#FFFFFF' ? 'rgba(255,255,255,0.45)' : chip.color,
                          border: `1px solid ${chip.color}40`,
                          textTransform: 'capitalize',
                        }}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                    Last saved {formatDistanceToNow(new Date(entry.updatedAt), { addSuffix: true })}
                  </p>
                  <p style={{ fontSize: 12, color: entry.progress.done ? '#34D399' : 'rgba(255,255,255,0.35)' }}>
                    {entry.progress.text}
                  </p>
                </div>

                {/* Right */}
                <div className="flex items-center shrink-0" style={{ gap: 8 }}>
                  <button
                    onClick={() => navigate(entry.editHref)}
                    style={{ fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 100, border: '1px solid rgba(31,122,109,0.3)', color: '#1F7A6D', background: 'rgba(31,122,109,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Pencil style={{ width: 13, height: 13 }} /> Continue editing
                  </button>
                  {entry.previewHref && (
                    <button
                      onClick={() => navigate(entry.previewHref!)}
                      style={{ fontSize: 12, fontWeight: 500, padding: '6px 14px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.60)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Eye style={{ width: 13, height: 13 }} /> Preview
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget({ tool: entry.tool, id: entry.id })}
                    style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', background: 'transparent', cursor: 'pointer' }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>No drafts yet.</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', marginBottom: 20 }}>
              Anything you start and save — in the build workspace or the post
              editor — shows up here.
            </p>
            <button
              onClick={() => openUploadTypePicker()}
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
            <AlertDialogTitle>
              {deleteTarget?.tool === "build" ? "Delete this build draft?" : "Delete this draft?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.tool === "build"
                ? "Its nodes, events and media go with it. This cannot be undone."
                : "This cannot be undone."}
            </AlertDialogDescription>
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
