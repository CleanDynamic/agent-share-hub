import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ContentCard } from "@/components/ContentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark } from "lucide-react";

export default function Saved() {
  const { isLoggedIn, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isLoggedIn) navigate("/login", { replace: true });
  }, [loading, isLoggedIn, navigate]);

  const { data: savedItems, isLoading } = useQuery({
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

  if (loading) return null;

  return (
    <div className="py-12 px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">Your saved content</h1>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
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
            <p className="text-sm text-muted-foreground">
              Nothing saved yet. Hit the bookmark icon on any content to save it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
