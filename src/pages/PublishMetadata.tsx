import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import { useToast } from "@/hooks/use-toast";
import {
  PublishBlueprintForm,
  type PublishFormValues,
  type AutoDetectedMeta,
} from "@/components/publish/PublishBlueprintForm";

export default function PublishMetadata() {
  const { contentItemId } = useParams<{ contentItemId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, loading: authLoading, isLoggedIn } = useAuth();

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate("/login", { replace: true });
  }, [authLoading, isLoggedIn, navigate]);

  const { data, isLoading, error, isError } = useQuery({
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

  // Already published → redirect
  useEffect(() => {
    if (isLoading || !data) return;
    if (data.status === "approved") {
      navigate(`/content/${data.id}`, { replace: true });
    }
  }, [data, isLoading, navigate]);

  // Not found → /upload
  useEffect(() => {
    if (!isLoading && !isError && data === null) {
      navigate("/upload", { replace: true });
    }
  }, [data, isLoading, isError, navigate]);

  const forbidden = !!(data && profile && data.creator_id !== profile.id);

  // Loading
  if (isLoading || authLoading) {
    return (
      <div className="w-full min-h-full px-6 py-6">
        <SeoHead
          title="Publish blueprint"
          description="Finalise metadata before publishing."
          path={`/publish/${contentItemId ?? ""}`}
          noIndex
        />
        <div className="mx-auto w-full max-w-[720px] space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  // Error
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

  // Forbidden
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

  // Map content_item → form defaults
  const tagsArr: string[] = Array.isArray(data.tags)
    ? data.tags
    : Array.isArray(data.custom_tags)
    ? data.custom_tags
    : [];

  const defaultValues = {
    useCase: data.use_case || "",
    domain: data.domain || "",
    difficulty: data.difficulty || "",
    tags: tagsArr,
    prerequisites: data.prerequisites || "",
    outcome: data.outcome || "",
    visibility: data.visibility || "public",
    slug: data.slug || "",
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
  };

  return (
    <>
      <SeoHead
        title="Publish blueprint"
        description="Finalise metadata before publishing."
        path={`/publish/${contentItemId ?? ""}`}
        noIndex
      />
      <PublishBlueprintForm
        contentItemId={contentItemId}
        defaultValues={defaultValues}
        autoDetected={autoDetected}
        authorUsername={profile?.username || "you"}
        onBack={() => navigate(`/upload?draft=${contentItemId}`)}
        onPublish={(values: PublishFormValues) => {
          console.log("[PublishMetadata] onPublish stub", values);
          toast({ title: "Publish wiring coming in step 2.4" });
        }}
        onSaveDraft={() => {
          console.log("[PublishMetadata] onSaveDraft stub");
          toast({ title: "Save draft wiring coming in step 2.4" });
        }}
        onDiscard={() => {
          console.log("[PublishMetadata] onDiscard stub");
          toast({ title: "Discard wiring coming in step 2.4" });
        }}
      />
    </>
  );
}
