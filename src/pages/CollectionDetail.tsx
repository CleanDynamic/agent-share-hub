import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ContentCard } from "@/components/ContentCard";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Globe, Lock, Users, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { insertNotification } from "@/lib/notifications";

export default function CollectionDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { profile, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [followLoading, setFollowLoading] = useState(false);

  const { data: collection, isLoading } = useQuery({
    queryKey: ["collection_by_slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*, profiles!collections_owner_id_fkey(id, username, display_name, avatar_url)")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const owner = collection?.profiles as any;
  const isOwner = profile?.id === collection?.owner_id;

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["collection_items", collection?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_items")
        .select("id, position, note, content_id, content_items(*)")
        .eq("collection_id", collection!.id)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!collection?.id,
  });

  const { data: isFollowing } = useQuery({
    queryKey: ["collection_follow_status", collection?.id, profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collection_follows")
        .select("id")
        .eq("collection_id", collection!.id)
        .eq("follower_id", profile!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!collection?.id && !!profile?.id,
  });

  async function toggleFollow() {
    if (!collection || !profile) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase.from("collection_follows").delete().eq("collection_id", collection.id).eq("follower_id", profile.id);
      await supabase.from("collections").update({ follower_count: Math.max(0, collection.follower_count - 1) }).eq("id", collection.id);
    } else {
      await supabase.from("collection_follows").insert({ collection_id: collection.id, follower_id: profile.id });
      await supabase.from("collections").update({ follower_count: collection.follower_count + 1 }).eq("id", collection.id);
      insertNotification({
        recipient_id: collection.owner_id,
        actor_id: profile.id,
        notification_type: "collection_follow",
        collection_id: collection.id,
        metadata: { follower_username: profile.username, collection_title: collection.title },
      });
    }
    qc.invalidateQueries({ queryKey: ["collection_follow_status", collection.id] });
    qc.invalidateQueries({ queryKey: ["collection_by_slug", slug] });
    setFollowLoading(false);
  }

  async function moveItem(itemId: string, direction: "up" | "down") {
    if (!items) return;
    const idx = items.findIndex((i) => i.id === itemId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const a = items[idx], b = items[swapIdx];
    await Promise.all([
      supabase.from("collection_items").update({ position: b.position }).eq("id", a.id),
      supabase.from("collection_items").update({ position: a.position }).eq("id", b.id),
    ]);
    qc.invalidateQueries({ queryKey: ["collection_items", collection?.id] });
  }

  async function removeItem(itemId: string) {
    if (!collection) return;
    await supabase.from("collection_items").delete().eq("id", itemId);
    await supabase.from("collections").update({ item_count: Math.max(0, collection.item_count - 1) }).eq("id", collection.id);
    qc.invalidateQueries({ queryKey: ["collection_items", collection.id] });
    qc.invalidateQueries({ queryKey: ["collection_by_slug", slug] });
  }

  async function deleteCollection() {
    if (!collection) return;
    if (!window.confirm("Delete this collection?")) return;
    await supabase.from("collections").delete().eq("id", collection.id);
    toast({ title: "Collection deleted" });
    navigate("/saved");
  }

  if (isLoading) {
    return (
      <div className="py-12 px-6 mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="py-20 px-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">Collection not found.</p>
        <Button variant="outline" size="sm" asChild><Link to="/browse"><ArrowLeft className="mr-2 h-4 w-4" />Browse</Link></Button>
      </div>
    );
  }

  if (!collection.is_public && !isOwner) {
    return (
      <div className="py-20 px-6 text-center">
        <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-foreground font-medium">This collection is private.</p>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6">
      <SeoHead title={`${collection.title} — NeoScale AI`} description={collection.description || "A curated collection"} path={`/collections/${slug}`} />
      <div className="mx-auto max-w-5xl">
        <Link to="/saved" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
        </Link>

        {/* Header */}
        <div className="mb-8">
          {owner && (
            <Link to={`/creator/${owner.username}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 inline-block">
              Curated by {owner.display_name || owner.username}
            </Link>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{collection.title}</h1>
          {collection.description && <p className="text-sm text-muted-foreground mb-3">{collection.description}</p>}
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
            <span>{collection.item_count} items</span>
            <span>·</span>
            <span>{collection.follower_count} followers</span>
            {collection.is_public ? (
              <Badge variant="outline" className="text-[10px]"><Globe className="h-3 w-3 mr-1" />Public</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]"><Lock className="h-3 w-3 mr-1" />Private</Badge>
            )}
          </div>
          <div className="flex gap-2">
            {!isOwner && isLoggedIn && (
              <Button
                variant={isFollowing ? "default" : "outline"}
                size="sm"
                onClick={toggleFollow}
                disabled={followLoading}
                className={isFollowing ? "bg-secondary hover:bg-secondary/90" : "border-secondary text-secondary hover:bg-secondary/10"}
              >
                <Users className="mr-1.5 h-3.5 w-3.5" />
                {isFollowing ? "Following" : "Follow collection"}
              </Button>
            )}
            {isOwner && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={deleteCollection}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        </div>

        {/* Items grid */}
        {itemsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => <Skeleton key={n} className="h-48 rounded-xl" />)}
          </div>
        ) : (items ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">This collection is empty.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(items ?? []).map((ci, idx) => {
              const item = ci.content_items as any;
              if (!item) return null;
              return (
                <div key={ci.id} className="relative">
                  {isOwner && (
                    <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10 hidden sm:flex">
                      <button onClick={() => moveItem(ci.id, "up")} disabled={idx === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                      <button onClick={() => moveItem(ci.id, "down")} disabled={idx === (items?.length ?? 0) - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                      <button onClick={() => removeItem(ci.id)} className="p-0.5 text-destructive hover:text-destructive/80"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
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
                    avg_rating={Number(item.avg_rating) || 0}
                    rating_count={item.rating_count ?? 0}
                    view_count={item.view_count ?? 0}
                  />
                  {ci.note && (
                    <p className="text-xs text-muted-foreground italic mt-1 px-1">{ci.note}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
