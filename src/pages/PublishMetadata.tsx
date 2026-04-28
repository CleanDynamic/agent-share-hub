import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import { displayContentType, TYPE_COLORS } from "@/lib/content-types";

export default function PublishMetadata() {
  const { contentItemId } = useParams<{ contentItemId: string }>();
  const navigate = useNavigate();
  const { profile, loading: authLoading, isLoggedIn } = useAuth();

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate("/login", { replace: true });
  }, [authLoading, isLoggedIn, navigate]);

  const { data, isLoading, error, isError } = useQuery({
    queryKey: ["publish_metadata_item", contentItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, creator_id, content_type, post_type, status")
        .eq("id", contentItemId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!contentItemId && !!profile?.id,
    retry: false,
  });

  // Route guards
  useEffect(() => {
    if (isLoading || !data) return;
    if (data.status === "approved") {
      navigate(`/content/${data.id}`, { replace: true });
    }
  }, [data, isLoading, navigate]);

  // Not found → redirect to /upload
  useEffect(() => {
    if (!isLoading && !isError && data === null) {
      navigate("/upload", { replace: true });
    }
  }, [data, isLoading, isError, navigate]);

  // Forbidden state
  const forbidden = !!(data && profile && data.creator_id !== profile.id);

  const typeColor = data?.content_type ? TYPE_COLORS[data.content_type] : undefined;

  return (
    <div className="w-full min-h-full px-6 py-6">
      <SeoHead title="Publish blueprint" description="Finalise metadata before publishing." noIndex />

      {/* Header strip */}
      <div className="mx-auto w-full max-w-[720px] flex items-center justify-between gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => contentItemId && navigate(`/upload?draft=${contentItemId}`)}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to editor
        </Button>

        <h1 className="text-base font-semibold tracking-tight">Publish blueprint</h1>

        <div className="min-w-[80px] flex justify-end">
          {data?.content_type ? (
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider"
              style={typeColor ? { borderColor: typeColor, color: typeColor } : undefined}
            >
              {displayContentType(data.content_type)}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-[720px]">
        {isLoading || authLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
            <div className="font-medium text-destructive mb-1">Couldn't load this blueprint</div>
            <div className="text-muted-foreground mb-4">
              {(error as Error)?.message || "Something went wrong fetching the draft."}
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/drafts">Back to drafts</Link>
            </Button>
          </div>
        ) : forbidden ? (
          <div className="rounded-lg border border-border/40 bg-muted/20 p-10 text-center">
            <div className="text-base font-medium mb-2">Not yours to publish</div>
            <div className="text-sm text-muted-foreground mb-6">
              This blueprint belongs to another creator.
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/">Go home</Link>
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 p-12 text-center">
            <div className="text-sm text-muted-foreground">Form coming in 2.2</div>
          </div>
        )}
      </div>
    </div>
  );
}
