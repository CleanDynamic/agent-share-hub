import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "@/components/ContentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Bookmark } from "lucide-react";
import { Link } from "react-router-dom";

function CardSkeleton() {
  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
      <Skeleton className="h-4 w-3/4 rounded-md" />
      <Skeleton className="h-3 w-full rounded-md" />
      <div className="flex justify-between pt-3 border-t border-border">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-4 w-10 rounded-md" />
      </div>
    </div>
  );
}

export default function Saved() {
  const { profile } = useAuth();

  const { data: savedItems, isLoading, error } = useQuery({
    queryKey: ["user_saves", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_saves")
        .select("content_id, content_items(*)")
        .eq("user_id", profile!.id)
        .order("saved_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  return (
    <div className="py-12 px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">Your saved content</h1>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground mb-4">Something went wrong loading your saved content.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Reload</Button>
          </div>
        ) : savedItems && savedItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedItems.map((save) => {
              const item = save.content_items as any;
              if (!item) return null;
              return (
                <ContentCard
                  key={item.id}
                  id={item.id}
                  content_type={item.content_type}
                  title={item.title}
                  description={item.description ?? ""}
                  difficulty={item.difficulty}
                  ai_tools={item.ai_tools ?? []}
                  download_count={item.download_count}
                  monetisation_type={item.monetisation_type}
                  price_gbp={item.price_gbp ?? undefined}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bookmark className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm text-foreground font-medium mb-1">You haven't saved anything yet.</p>
            <p className="text-sm text-muted-foreground mb-4">
              Hit the bookmark icon on any content to save it here.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/browse">Browse content</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
