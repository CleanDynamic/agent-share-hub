import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Download, Lock, Eye, User, Calendar } from "lucide-react";
import { DIFFICULTY_LABEL_CLASS, TYPE_COLORS, displayContentType } from "@/lib/content-types";
import { flushRecompute } from "@/lib/metadata/scheduleRecompute";

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// BG-P05. Difficulty is not a part category and carries no colour: one
// uncoloured mono label, defined once in @/lib/content-types.
function difficultyColor(_level?: string) {
  return DIFFICULTY_LABEL_CLASS;
}

export default function PostPreviewPage() {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoggedIn, profile, loading: authLoading } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate("/login", { replace: true });
  }, [authLoading, isLoggedIn, navigate]);

  const { data: draft, isLoading } = useQuery({
    queryKey: ["preview_draft", draftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*")
        .eq("id", draftId!)
        .eq("status", "draft")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!draftId && !!profile?.id,
  });

  const { data: blocks } = useQuery({
    queryKey: ["preview_blocks", draftId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_blocks")
        .select("*")
        .eq("content_id", draftId!)
        .order("position", { ascending: true });
      return data ?? [];
    },
    enabled: !!draftId,
  });

  const { data: related } = useQuery({
    queryKey: ["preview_related", draft?.content_type],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id, title, content_type, description, download_count")
        .eq("content_type", draft!.content_type)
        .eq("status", "approved")
        .order("download_count", { ascending: false })
        .limit(4);
      return data ?? [];
    },
    enabled: !!draft?.content_type,
  });

  // Redirect if not the creator
  useEffect(() => {
    if (draft && profile && draft.creator_id !== profile.id) {
      navigate("/", { replace: true });
    }
  }, [draft, profile, navigate]);

  function validate(): string[] {
    if (!draft) return ["Draft not loaded"];
    const errs: string[] = [];
    if (!draft.title || draft.title === "Untitled draft") errs.push("Title is required");
    if (!draft.content_type) errs.push("Content type is required");
    if (!draft.ai_tools || draft.ai_tools.length === 0) errs.push("At least 1 AI tool is required");
    if (!blocks || blocks.length === 0) errs.push("At least 1 content block is required");
    if (draft.monetisation_type === "paid" && (!draft.price_gbp || Number(draft.price_gbp) <= 0)) {
      errs.push("Price must be set for paid content");
    }
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (errs.length > 0) {
      setValidationErrors(errs);
      setConfirmOpen(false);
      return;
    }
    setSubmitting(true);
    // Ensure metadata is fresh the moment the post goes public.
    await flushRecompute(draftId!);
    await supabase.from("content_items").update({
      status: "approved",
      approved_at: new Date().toISOString(),
      draft_saved_at: null,
    } as any).eq("id", draftId!);
    setSubmitting(false);
    toast({ title: "Your post is live! ✓" });
    navigate("/my-uploads");
  }

  if (authLoading || isLoading) {
    return (
      <div className="py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="py-20 px-6 flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">Draft not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/drafts")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Drafts
        </Button>
      </div>
    );
  }

  const wteBlocks = (draft as any).what_to_expect_blocks as any[] | null;

  return (
    <div className="py-0 px-0">
      <SeoHead title="Preview — NeoScale AI" description="Preview your draft post." path={`/upload/preview/${draftId}`} noIndex />

      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 h-[52px] flex items-center justify-between px-4 sm:px-6 border-b border-border bg-card">
        <button
          onClick={() => navigate(`/upload?draft=${draftId}`)}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Back to editing
        </button>
        <div className="hidden sm:flex flex-col items-center">
          <span className="text-xs text-muted-foreground">Preview</span>
          <span className="text-[13px] font-bold text-foreground truncate max-w-[200px]">
            {(draft as any).draft_name || draft.title || "Untitled draft"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            onClick={() => navigate("/drafts")}
          >
            Save to Drafts
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-full text-xs"
            disabled={submitting}
            onClick={() => {
              const errs = validate();
              if (errs.length > 0) {
                setValidationErrors(errs);
              } else {
                setValidationErrors([]);
                setConfirmOpen(true);
              }
            }}
          >
            {submitting ? "Submitting…" : "Publish Post →"}
          </Button>
        </div>
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="mx-auto max-w-4xl mt-4 px-4 sm:px-6">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive mb-2">Before you publish, please complete:</p>
            <ul className="space-y-1">
              {validationErrors.map((err) => (
                <li key={err} className="text-xs text-destructive">• {err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Live preview content */}
      <div className="mx-auto max-w-4xl py-6 sm:py-10 px-4 sm:px-6">
        {/* Cover image */}
        {(draft as any).cover_image_url && (
          <div className="relative mb-6 rounded-xl overflow-hidden">
            <img src={(draft as any).cover_image_url} alt="Cover" className="w-full object-cover" style={{ maxHeight: 300 }} />
          </div>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2 mb-3 relative group">
          <Badge className={`text-[10px] ${TYPE_COLORS[draft.content_type] || "bg-muted text-muted-foreground border-border"}`}>
            {displayContentType(draft.content_type)}
          </Badge>
          {draft.difficulty && (
            <Badge className={`text-[10px] ${difficultyColor(draft.difficulty)}`}>
              {draft.difficulty}
            </Badge>
          )}
          <EditHint section="badges" draftId={draftId!} />
        </div>

        {/* Title */}
        <div className="relative group mb-2">
          <h1 className="text-2xl font-bold text-foreground">{draft.title || "Untitled"}</h1>
          <EditHint section="title" draftId={draftId!} />
        </div>

        {/* Description */}
        {(draft as any).description && (
          <p className="text-sm text-muted-foreground mb-4">{(draft as any).description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-6">
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> 0 views</span>
          <span className="flex items-center gap-1"><Download className="h-3 w-3" /> 0 downloads</span>
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Just now</span>
        </div>

        {/* What to Expect */}
        {wteBlocks && wteBlocks.length > 0 && (
          <div className="relative group mb-6">
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">What to Expect</h3>
              <div className="space-y-2">
                {wteBlocks.map((wb: any, i: number) => (
                  <div key={i} className="text-sm text-muted-foreground">
                    {wb.text_content}
                  </div>
                ))}
              </div>
            </div>
            <EditHint section="wte" draftId={draftId!} />
          </div>
        )}

        {/* Action box */}
        <div className="relative group rounded-xl border border-border bg-card p-4 mb-6">
          {draft.monetisation_type === "free" || draft.monetisation_type === "donation" ? (
            <Button className="ns-btn-primary w-full rounded-full opacity-70 cursor-default" size="lg">
              <Download className="h-4 w-4 mr-2" /> Download Free
            </Button>
          ) : (
            <Button className="ns-btn-primary w-full rounded-full opacity-70 cursor-default" size="lg">
              <Lock className="h-4 w-4 mr-2" /> Unlock — £{Number((draft as any).price_gbp ?? 0).toFixed(2)}
            </Button>
          )}
          <p className="text-xs text-muted-foreground text-center mt-2">Action buttons are live once published.</p>
          <EditHint section="action" draftId={draftId!} />
        </div>

        {/* Created By */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {profile?.display_name || profile?.username || "You"}
            </p>
            <p className="text-xs text-muted-foreground">@{profile?.username}</p>
          </div>
        </div>

        {/* Works With */}
        {draft.ai_tools && draft.ai_tools.length > 0 && (
          <div className="relative group mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Works with</h3>
            <div className="flex flex-wrap gap-1.5">
              {draft.ai_tools.map((tool: string) => (
                <Badge key={tool} variant="outline" className="text-[10px]">{tool}</Badge>
              ))}
            </div>
            <EditHint section="tools" draftId={draftId!} />
          </div>
        )}

        {/* Blueprint blocks */}
        <div className="mt-6 space-y-4 relative group">
          <h3 className="text-sm font-semibold text-foreground">Blueprint</h3>
          {blocks && blocks.length > 0 ? (
            <div className="space-y-3">
              {blocks.map((block: any) => (
                <div key={block.id} className="relative rounded-xl border border-border bg-card p-4">
                  <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20 z-10">
                    Preview — visible after unlock when live
                  </span>
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {block.text_content || (block.file_name && <span className="text-muted-foreground italic">File: {block.file_name}</span>) || <span className="text-muted-foreground italic">Empty block</span>}
                  </div>
                  {block.use_instructions && (
                    <p className="text-xs text-muted-foreground mt-2 italic">💡 {block.use_instructions}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No content blocks yet.</p>
          )}
          <EditHint section="blocks" draftId={draftId!} />
        </div>

        {/* Related Content */}
        {related && related.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-foreground mb-3">Related Blueprints</h3>
            <div className="grid grid-cols-2 gap-3">
              {related.map((r: any) => (
                <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{r.download_count} downloads</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Submit confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish '{draft.title}'?</AlertDialogTitle>
            <AlertDialogDescription>
              Your post will go live immediately and be visible in the feed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>Publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Small edit hint icon that links back to the upload form */
function EditHint({ section, draftId }: { section: string; draftId: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/upload?draft=${draftId}`)}
      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-accent"
      title={`Edit ${section}`}
    >
      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}
