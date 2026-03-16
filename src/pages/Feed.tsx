import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "@/components/ContentCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Rss } from "lucide-react";

export default function Feed() {
  const { isLoggedIn, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isLoggedIn) navigate("/login", { replace: true });
  }, [loading, isLoggedIn, navigate]);

  // Fetch who the user follows
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

  // Fetch content from followed creators
  const { data: feedItems, isLoading: feedLoading } = useQuery({
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

  if (loading) return null;

  const isEmpty = !feedLoading && (!feedItems || feedItems.length === 0);
  const notFollowing = followingIds && followingIds.length === 0;

  return (
    <div className="py-12 px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">Your feed</h1>

        {feedLoading && (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Rss className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              {notFollowing
                ? "Your feed is empty. Follow some creators to see their latest content here."
                : "No new content from creators you follow yet."}
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
