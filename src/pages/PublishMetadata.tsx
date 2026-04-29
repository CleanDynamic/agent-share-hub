import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PublishMetadataForm,
  getPostTypeTheme,
  type PublishFormValues,
  type AutoDetectedMeta,
  type PostType,
} from "@/components/publish/PublishMetadataForm";

const buildPayload = (
  values: PublishFormValues,
  postType: PostType,
): Record<string, any> => {
  const payload: Record<string, any> = {
    use_case: values.useCase || null,
    domain: values.domain || null,
    difficulty: values.difficulty || null,
    tags: values.tags,
    custom_tags: values.tags,
    visibility: values.visibility || "public",
    slug: values.slug ? values.slug.trim().toLowerCase() : null,
  };
  if (postType === "blog") {
    payload.blog_topic_category = values.topicCategory || null;
  } else {
    payload.prerequisites = values.prerequisites || null;
    payload.outcome = values.outcome || null;
  }
  if (postType === "bounty") {
    payload.bounty_reward_type = values.bountyRewardType || null;
    payload.bounty_reward_amount =
      values.bountyRewardType === "cash" || values.bountyRewardType === "token"
        ? values.bountyRewardAmount
        : null;
    payload.bounty_reward_currency =
      values.bountyRewardType === "cash" || values.bountyRewardType === "token"
        ? values.bountyRewardCurrency || null
        : null;
    payload.bounty_deadline = values.bountyDeadline
      ? values.bountyDeadline.toISOString()
      : null;
    payload.bounty_acceptance_criteria =
      values.bountyAcceptanceCriteria.trim() || null;
  }
  return payload;
};

export default function PublishMetadata() {
  const { contentItemId } = useParams<{ contentItemId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, loading: authLoading, isLoggedIn } = useAuth();
  const [isPublishing, setIsPublishing] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  // Latest form values, kept in a ref so handlers always read fresh state
  // without re-binding the form's onChange.
  const latestValuesRef = useRef<PublishFormValues | null>(null);

  // Fingerprint of the last value successfully written to the server.
  const lastSavedRef = useRef<string>("");

  // When true, beforeunload/confirm prompts are suppressed (publish path).
  const suppressUnloadRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate("/login", { replace: true });
  }, [authLoading, isLoggedIn, navigate]);

  const { data, isLoading, error, isError, refetch } = useQuery({
    queryKey: ["publish_metadata_item", contentItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*")
        .eq("id", contentItemId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!contentItemId && !!profile?.id,
    retry: false,
  });

  const isUpdateMode = data?.status === "approved";
  const forbidden = !!(data && profile && data.creator_id !== profile.id);
  const postType: PostType = ((data?.post_type as PostType) ?? "blueprint");
  const postTypeRef = useRef<PostType>(postType);
  useEffect(() => { postTypeRef.current = postType; }, [postType]);
  const theme = getPostTypeTheme(postType);

  // Not found → /upload
  useEffect(() => {
    if (!isLoading && !isError && data === null) {
      navigate("/upload", { replace: true });
    }
  }, [data, isLoading, isError, navigate]);

  /* ── Save helpers ── */

  const writeNow = useCallback(
    async (values: PublishFormValues): Promise<boolean> => {
      if (!contentItemId) return false;
      const payload = buildPayload(values, postTypeRef.current);
      const fingerprint = JSON.stringify(payload);
      if (fingerprint === lastSavedRef.current) return true;
      const { error } = await supabase
        .from("content_items")
        .update(payload as any)
        .eq("id", contentItemId);
      if (error) {
        console.warn("[PublishMetadata] save failed", error);
        return false;
      }
      lastSavedRef.current = fingerprint;
      return true;
    },
    [contentItemId],
  );

  /* ── Debounced autosave on every form change ── */
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFormChange = useCallback(
    (values: PublishFormValues) => {
      latestValuesRef.current = values;
      if (!contentItemId || forbidden) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        writeNow(values);
      }, 1000);
    },
    [contentItemId, forbidden, writeNow],
  );

  useEffect(() => () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
  }, []);

  /* ── Initialise lastSavedRef from server data so dirty detection works ── */
  useEffect(() => {
    if (!data) return;
    const serverValues: PublishFormValues = {
      useCase: data.use_case || "",
      domain: data.domain || "",
      difficulty: data.difficulty || "",
      tags: Array.isArray(data.tags) && data.tags.length > 0
        ? data.tags
        : Array.isArray(data.custom_tags) ? data.custom_tags : [],
      prerequisites: data.prerequisites || "",
      outcome: data.outcome || "",
      visibility: data.visibility || "public",
      slug: data.slug || "",
      topicCategory: data.blog_topic_category || "",
    };
    lastSavedRef.current = JSON.stringify(buildPayload(serverValues, (data.post_type as PostType) ?? "blueprint"));
  }, [data]);

  /* ── beforeunload protection ── */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (suppressUnloadRef.current) return;
      const v = latestValuesRef.current;
      if (!v) return;
      const fingerprint = JSON.stringify(buildPayload(v, postTypeRef.current));
      if (fingerprint !== lastSavedRef.current) {
        e.preventDefault();
        // Modern browsers ignore custom strings but require returnValue.
        e.returnValue = "You have unsaved changes — are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  /* ── Flush + navigate helper used by Back / Save-as-draft ── */
  const flushAndGo = useCallback(
    async (destination: string, successToast?: { title: string; description?: string }) => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      const v = latestValuesRef.current;
      if (v && contentItemId && !forbidden) {
        const ok = await writeNow(v);
        if (!ok) {
          toast({
            title: "Could not save changes",
            description: "Try again in a moment.",
            variant: "destructive",
          });
          return;
        }
      }
      if (successToast) toast(successToast);
      suppressUnloadRef.current = true;
      navigate(destination);
    },
    [contentItemId, forbidden, navigate, toast, writeNow],
  );

  /* ── Publish ── */
  const handlePublish = useCallback(
    async (values: PublishFormValues) => {
      if (!contentItemId) return;
      setIsPublishing(true);
      try {
        const slug = values.slug.trim().toLowerCase();
        const pt = postTypeRef.current;
        const updatePayload: Record<string, any> = {
          ...buildPayload(values, pt),
          slug,
          status: "approved",
        };
        if (!isUpdateMode) {
          updatePayload.published_at = new Date().toISOString();
          updatePayload.approved_at = new Date().toISOString();
        }

        const { error: updateErr } = await supabase
          .from("content_items")
          .update(updatePayload as any)
          .eq("id", contentItemId);
        if (updateErr) throw updateErr;

        lastSavedRef.current = JSON.stringify(buildPayload(values, pt));
        suppressUnloadRef.current = true;
        const t = getPostTypeTheme(pt);
        toast({
          title: isUpdateMode ? t.updatedToast : t.publishedToast,
        });
        navigate(`/content/${contentItemId}`);
      } catch (err: any) {
        console.error("[PublishMetadata] publish failed", err);
        toast({
          title: isUpdateMode ? "Could not update" : "Could not publish",
          description: err?.message ?? "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsPublishing(false);
      }
    },
    [contentItemId, isUpdateMode, navigate, toast],
  );

  /* ── Discard ── */
  const handleConfirmDiscard = useCallback(async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setDiscardOpen(false);
    // Re-pull authoritative server values, then bump resetSignal so the
    // form re-initialises from defaultValues.
    await refetch();
    setResetSignal((n) => n + 1);
    toast({ title: "Changes discarded." });
  }, [refetch, toast]);

  // Document title
  useEffect(() => {
    if (!data) return;
    const title = (data.title || "Untitled").trim();
    document.title = `Publish: ${title} · NeoScale`;
    return () => { document.title = "NeoScale"; };
  }, [data]);

  // Loading — skeleton mirrors the form layout
  if (isLoading || authLoading) {
    return (
      <div className="w-full min-h-full">
        <SeoHead
          title="Publish blueprint"
          description="Finalise metadata before publishing."
          path={`/publish/${contentItemId ?? ""}`}
          noIndex
        />
        {/* Header skeleton */}
        <div className="h-[60px] flex items-center justify-between px-4 sm:px-6"
          style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-40 hidden sm:block" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="h-1 w-full" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />
        <div className="mx-auto w-full max-w-[720px] px-4 sm:px-6 py-8 flex flex-col gap-8">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="rounded-xl p-5" style={{ backgroundColor: "rgba(22,22,30,0.40)" }}>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-11 w-full mb-4" />
              <Skeleton className="h-3 w-16 mb-2" />
              <div className="flex gap-2 flex-wrap">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full min-h-full px-6 py-6">
        <SeoHead
          title="Publish blueprint"
          description="Finalise metadata before publishing."
          path={`/publish/${contentItemId ?? ""}`}
          noIndex
        />
        <div className="mx-auto w-full max-w-[720px] rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
          <div className="font-medium text-destructive mb-1">
            Couldn't load this blueprint
          </div>
          <div className="text-muted-foreground mb-4">
            {(error as Error)?.message || "Something went wrong fetching the draft."}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/drafts">Back to drafts</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="w-full min-h-full px-6 py-6">
        <SeoHead
          title="Publish blueprint"
          description="Finalise metadata before publishing."
          path={`/publish/${contentItemId ?? ""}`}
          noIndex
        />
        <div className="mx-auto w-full max-w-[720px] rounded-lg border border-border/40 bg-muted/20 p-10 text-center">
          <div className="text-base font-medium mb-2">Not yours to publish</div>
          <div className="text-sm text-muted-foreground mb-6">
            This blueprint belongs to another creator.
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Map content_item → form defaults (re-derived after refetch on discard).
  const tagsArr: string[] = Array.isArray(data.tags) && data.tags.length > 0
    ? data.tags
    : Array.isArray(data.custom_tags)
    ? data.custom_tags
    : [];

  const defaultValues: PublishFormValues = {
    useCase: data.use_case || "",
    domain: data.domain || "",
    difficulty: data.difficulty || "",
    tags: tagsArr,
    prerequisites: data.prerequisites || "",
    outcome: data.outcome || "",
    visibility: data.visibility || "public",
    slug: data.slug || "",
    topicCategory: data.blog_topic_category || "",
  };

  const autoDetected: AutoDetectedMeta = {
    word_count: data.word_count ?? null,
    estimated_reading_minutes: data.estimated_reading_minutes ?? null,
    stage_count: data.stage_count ?? null,
    block_count: data.block_count ?? null,
    connection_count: data.connection_count ?? null,
    block_types_used: data.block_types_used ?? null,
    models_referenced: data.models_referenced ?? null,
    tools_referenced: data.tools_referenced ?? null,
    blog_referenced_post_ids: data.blog_referenced_post_ids ?? null,
  };

  const headerTitle = isUpdateMode
    ? `Update ${postType}`
    : theme.pageTitle;

  return (
    <>
      <SeoHead
        title={headerTitle}
        description="Finalise metadata before publishing."
        path={`/publish/${contentItemId ?? ""}`}
        noIndex
      />
      <PublishMetadataForm
        contentItemId={contentItemId}
        postType={postType}
        defaultValues={defaultValues}
        autoDetected={autoDetected}
        authorUsername={profile?.username || "you"}
        onBack={() => flushAndGo(`/upload?draft=${contentItemId}`)}
        onPublish={handlePublish}
        onChange={handleFormChange}
        isPublishing={isPublishing}
        publishLabel={isUpdateMode ? "Update" : "Publish"}
        resetSignal={resetSignal}
        onSaveDraft={() =>
          flushAndGo("/drafts", { title: "Saved as draft" })
        }
        onDiscard={() => setDiscardOpen(true)}
      />

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard all unsaved metadata changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your blueprint content is safe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
