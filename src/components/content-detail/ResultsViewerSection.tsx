import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getResultsForContentItem } from "@/lib/results";
import {
  ResultsCarouselViewer,
  type Slide,
} from "./ResultsCarouselViewer";

interface ResultsViewerSectionProps {
  contentItemId: string;
  postSlug: string;
}

export function ResultsViewerSection({
  contentItemId,
  postSlug,
}: ResultsViewerSectionProps) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [initialSlideId, setInitialSlideId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getResultsForContentItem(contentItemId);
        const filtered = rows.filter(
          (r) =>
            r.kind !== "written" || (r.text_content && r.text_content.trim().length > 0),
        );
        if (filtered.length === 0) {
          if (!cancelled) setSlides([]);
          return;
        }

        // Fetch comment counts per slide (anchor_type='result_slide').
        // The comments table may not yet have these columns — be tolerant.
        const ids = filtered.map((r) => r.id);
        let counts = new Map<string, number>();
        try {
          const { data: cm } = await (supabase as any)
            .from("content_comments")
            .select("anchor_id")
            .eq("anchor_type", "result_slide")
            .in("anchor_id", ids)
            .eq("is_deleted", false);
          if (Array.isArray(cm)) {
            for (const row of cm) {
              const k = (row as any).anchor_id as string;
              counts.set(k, (counts.get(k) ?? 0) + 1);
            }
          }
        } catch {
          // anchor_* columns don't exist yet — counts stay 0.
        }

        const next: Slide[] = filtered.map((r) => ({
          id: r.id,
          kind: r.kind,
          mediaUrl: r.media_url ?? undefined,
          text: r.text_content ?? undefined,
          caption: r.caption ?? "",
          commentCount: counts.get(r.id) ?? 0,
        }));
        if (!cancelled) setSlides(next);
      } catch (err) {
        console.warn("[ResultsViewerSection] load failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentItemId]);

  // Read deep-link hash like #result-slide-{id}
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const m = hash.match(/^#result-slide-([\w-]+)/);
    if (m) setInitialSlideId(m[1]);
  }, []);

  if (slides.length === 0) return null;

  const handleSaveAll = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast({ title: "Sign in to save", variant: "destructive" });
      return;
    }
    // Add to default Saved Items collection
    const { data: col } = await (supabase as any)
      .from("collections")
      .select("id")
      .eq("owner_id", uid)
      .eq("is_default", true)
      .maybeSingle();
    if (!col?.id) {
      toast({ title: "Could not find your library", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any)
      .from("collection_items")
      .insert({
        collection_id: col.id,
        content_id: contentItemId,
        added_by: uid,
      } as any);
    if (error && !error.message.includes("duplicate")) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved to Library" });
  };

  const handleSlideShare = async (slideId: string, _anchorEl: HTMLElement) => {
    const url = `${window.location.origin}/b/${postSlug}#result-slide-${slideId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Slide link copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleSlideComments = (slideId: string) => {
    navigate(`/b/${postSlug}/comments?anchor=result_slide:${slideId}`);
  };

  return (
    <ResultsCarouselViewer
      slides={slides}
      postSlug={postSlug}
      onSaveAll={handleSaveAll}
      onSlideShare={handleSlideShare}
      onSlideComments={handleSlideComments}
      initialSlideId={initialSlideId}
    />
  );
}
