import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "@/components/ContentCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SeoHead } from "@/components/SeoHead";
import { Rss } from "lucide-react";
import { Link } from "react-router-dom";

function FeedSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-32 rounded-md" />
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
        </div>
      ))}
    </div>
  );
}

export default function Feed() {
  const { user } = useAuth();

  const { data: followingIds } = useQuery({
    queryKey: ["my_following_ids", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      if (error) throw error;
      return data.map((r) => r.following_id);
    },
    enabled: !!user?.id,
  });

  const { data: feedItems, isLoading: feedLoading, error } = useQuery({
    queryKey: ["feed_content", followingIds],
    queryFn: async () => {
      if (!followingIds || followingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("content_items")
        .select("*, profiles!content_items_creator_id_fkey(display_name, username)")
        .in("creator_id", followingIds)
        .eq("status", "approved")
        .order("approved_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!followingIds,
  });

  const isEmpty = !feedLoading && (!feedItems || feedItems.length === 0);
  const notFollowing = followingIds && followingIds.length === 0;

  return (
    <div className="py-12 px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">Your feed</h1>

        {feedLoading && <FeedSkeleton />}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground mb-4">Something went wrong loading your feed.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Reload</Button>
          </div>
        )}

        {!error && isEmpty && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Rss className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm text-foreground font-medium mb-1">
              {notFollowing ? "Your feed is empty." : "No new content from creators you follow yet."}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {notFollowing
                ? "Follow creators to see their latest content here."
                : "Check back soon."}
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/browse">Discover creators</Link>
            </Button>
          </div>
        )}

        {feedItems && feedItems.length > 0 && (
          <div className="space-y-6">
            {feedItems.map((item) => {
              const creatorProfile = item.profiles as any;
              const creatorName = creatorProfile?.display_name || creatorProfile?.username || "A creator";
              return (
                <div key={item.id}>
                  <p className="text-xs text-muted-foreground mb-2">
                    <Link
                      to={`/creator/${creatorProfile?.username}`}
                      className="text-secondary hover:underline"
                    >
                      {creatorName}
                    </Link>{" "}
                    published this
                  </p>
                  <ContentCard
                    id={item.id}
                    content_type={item.content_type}
                    title={item.title}
                    description={item.description ?? ""}
                    difficulty={item.difficulty}
                    ai_tools={item.ai_tools ?? []}
                    download_count={item.download_count}
                    monetisation_type={item.monetisation_type}
                    price_gbp={item.price_gbp ?? undefined}
                    file_url={item.file_url}
                    creator_username={creatorProfile?.username}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
