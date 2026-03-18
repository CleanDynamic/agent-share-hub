import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SeoHead } from "@/components/SeoHead";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FeedItem } from "@/components/FeedItem";
import { PortfolioCard } from "@/components/PortfolioCard";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  BadgeCheck, Download, FileText, Eye, Camera, ExternalLink,
  ShieldCheck, Calendar, Heart, Image as ImageIcon, MessageSquare,
} from "lucide-react";
import { FollowButton } from "@/components/FollowButton";
import { format } from "date-fns";

function ProfileSkeleton() {
  return (
    <div className="w-full">
      <Skeleton className="w-full h-[200px]" />
      <div className="px-4 mt-4 space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
    </div>
  );
}

const CreatorProfile = () => {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["creator_profile", username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!username,
  });

  // Redirect to own profile if viewing self
  useEffect(() => {
    if (profile && user?.id === profile.id) {
      navigate("/profile", { replace: true });
    }
  }, [profile, user, navigate]);

  if (isLoading) return <ProfileSkeleton />;

  if (!profile || error) {
    return (
      <div className="py-20 px-6 flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">Creator not found.</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/browse">Back to Browse</Link>
        </Button>
      </div>
    );
  }

  if (user?.id === profile.id) return null;

  return <OtherProfileView profile={profile} currentUserId={user?.id} />;
};

export default CreatorProfile;

/* ======= Other User's Profile View ======= */

function OtherProfileView({ profile, currentUserId }: { profile: any; currentUserId?: string }) {
  const navigate = useNavigate();
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);
  const [followerDelta, setFollowerDelta] = useState(0);
  const [activeTab, setActiveTab] = useState("posts");

  const initials = (profile.display_name || profile.username || "?").slice(0, 2).toUpperCase();
  const followerCount = (profile.follower_count ?? 0) + followerDelta;
  const followingCount = profile.following_count ?? 0;
  const joinDate = profile.joined_at || profile.created_at;
  const displayName = profile.display_name || profile.username || "Creator";

  const tabs = [
    { key: "posts", label: "Portfolio" },
    { key: "replies", label: "Replies" },
    { key: "media", label: "Media" },
    { key: "likes", label: "Likes" },
  ];

  const { data: contentItems } = useQuery({
    queryKey: ["profile_content", profile.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("*, profiles!content_items_creator_id_fkey(id, username, display_name, avatar_url)")
        .eq("creator_id", profile.id)
        .eq("status", "approved")
        .order("approved_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile.id,
  });

  const totalDownloads = contentItems?.reduce((sum, i: any) => sum + (i.download_count ?? 0), 0) ?? 0;
  const totalViews = contentItems?.reduce((sum, i: any) => sum + (i.view_count ?? 0), 0) ?? 0;

  const { data: replies } = useQuery({
    queryKey: ["profile_replies", profile.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_comments")
        .select("*, content_items!content_comments_content_id_fkey(id, title, content_type)")
        .eq("user_id", profile.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!profile.id && activeTab === "replies",
  });

  const { data: mediaItems } = useQuery({
    queryKey: ["profile_media", profile.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id, title, cover_image_url")
        .eq("creator_id", profile.id)
        .eq("status", "approved")
        .not("cover_image_url", "is", null)
        .order("approved_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile.id && activeTab === "media",
  });

  const { data: likedItems } = useQuery({
    queryKey: ["profile_likes", profile.id],
    queryFn: async () => {
      const { data: ratings } = await supabase
        .from("content_ratings")
        .select("content_id, created_at")
        .eq("user_id", profile.id)
        .eq("rating", 5)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!ratings || ratings.length === 0) return [];
      const ids = ratings.map((r) => r.content_id);
      const { data } = await supabase
        .from("content_items")
        .select("*, profiles!content_items_creator_id_fkey(id, username, display_name, avatar_url)")
        .in("id", ids)
        .eq("status", "approved");
      const idOrder = new Map(ids.map((id, i) => [id, i]));
      return (data ?? []).sort((a: any, b: any) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
    },
    enabled: !!profile.id && activeTab === "likes",
  });

  const { data: collections } = useQuery({
    queryKey: ["profile_collections", profile.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collections")
        .select("id, title, slug, description, item_count, follower_count, visibility")
        .eq("owner_id", profile.id)
        .eq("visibility", "public")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile.id,
  });

  const allTabs = useMemo(() => {
    const t = [...tabs];
    if (collections && collections.length > 0) {
      t.push({ key: "collections", label: "Collections" });
    }
    return t;
  }, [collections]);

  const seoDesc = `${(profile.bio || "").slice(0, 155)}${profile.bio ? " — " : ""}${contentItems?.length ?? 0} posts on NeoScale AI.`;

  return (
    <div className="w-full">
      <SeoHead title={`${displayName} on NeoScale AI`} description={seoDesc} path={`/creator/${profile.username}`} ogType="profile" />

      {/* BANNER */}
      <div className="relative w-full" style={{ height: 200 }}>
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.4) 100%)" }} />
        )}
      </div>

      {/* AVATAR + ACTION */}
      <div className="px-4 flex justify-between items-start">
        <div className="relative -mt-10">
          <Avatar className="h-20 w-20 border-4 border-background">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
          </Avatar>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <FollowButton creatorId={profile.id} onCountChange={(d) => setFollowerDelta((prev) => prev + d)} />
          {currentUserId && currentUserId !== profile.id && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/messages?to=${profile.id}`)}>
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Message
            </Button>
          )}
        </div>
      </div>

      {/* INFO */}
      <div className="px-4 mt-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
          {profile.is_creator && (
            <Badge className="bg-secondary/15 text-secondary border-secondary/30 text-[10px]">
              <BadgeCheck className="h-3 w-3 mr-1" /> Creator
            </Badge>
          )}
          {profile.is_curator && (
            <Badge className="bg-secondary/15 text-secondary border-secondary/30 text-[10px]">
              <ShieldCheck className="h-3 w-3 mr-1" /> Curator ✦
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">@{profile.username}</p>
        {profile.bio && <p className="text-sm text-foreground leading-relaxed mt-2">{profile.bio}</p>}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {profile.website_url && (
            <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-secondary hover:underline">
              <ExternalLink className="h-3 w-3" /> {profile.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
          {profile.twitter_handle && (
            <a href={`https://twitter.com/${profile.twitter_handle.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
              𝕏 @{profile.twitter_handle.replace("@", "")}
            </a>
          )}
        </div>
        {joinDate && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Joined {format(new Date(joinDate), "MMMM yyyy")}</span>
          </div>
        )}
        <div className="flex items-center gap-4 mt-2">
          <button onClick={() => setFollowingOpen(true)} className="text-sm hover:underline">
            <span className="font-bold text-foreground">{followingCount}</span>{" "}
            <span className="text-muted-foreground">Following</span>
          </button>
          <button onClick={() => setFollowersOpen(true)} className="text-sm hover:underline">
            <span className="font-bold text-foreground">{followerCount}</span>{" "}
            <span className="text-muted-foreground">Followers</span>
          </button>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {contentItems?.length ?? 0} posts</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" /> {totalDownloads.toLocaleString()} downloads</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {totalViews.toLocaleString()} views</span>
        </div>
      </div>

      {/* TAB BAR */}
      <div className="mt-4 border-b border-border sticky top-0 z-10 bg-background">
        <div className="flex">
          {allTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 text-center py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="min-h-[400px]">
        {activeTab === "posts" && (
          contentItems && contentItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              {contentItems.map((item: any) => <PortfolioCard key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">{displayName} hasn't published anything yet.</p>
            </div>
          )
        )}
        {activeTab === "replies" && (
          replies && replies.length > 0 ? (
            <div>
              {replies.map((reply: any) => {
                const content = reply.content_items;
                return (
                  <div key={reply.id} className="px-4 py-3 border-b border-border cursor-pointer hover:bg-[hsl(0_0%_100%/0.03)] transition-colors" onClick={() => content && navigate(`/content/${content.id}`)}>
                    {content && (
                      <p className="text-xs text-muted-foreground mb-1">
                        Replied to <Badge variant="outline" className="text-[10px] font-medium">{content.content_type}</Badge>{" "}
                        <span className="text-secondary">{content.title}</span>
                      </p>
                    )}
                    <p className="text-sm text-foreground">{reply.text}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{timeAgo(reply.created_at)}</span>
                      {reply.like_count > 0 && <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {reply.like_count}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No replies yet.</p>
            </div>
          )
        )}
        {activeTab === "media" && (
          mediaItems && mediaItems.length > 0 ? (
            <div className="grid grid-cols-3 gap-0.5 p-0.5">
              {mediaItems.map((item: any) => (
                <button key={item.id} onClick={() => navigate(`/content/${item.id}`)} className="aspect-square overflow-hidden">
                  <img src={item.cover_image_url} alt={item.title} className="w-full h-full object-cover hover:opacity-80 transition-opacity" loading="lazy" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No media posts yet.</p>
            </div>
          )
        )}
        {activeTab === "likes" && (
          likedItems && likedItems.length > 0 ? (
            <div>{likedItems.map((item: any) => <FeedItem key={item.id} item={item} />)}</div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Heart className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No liked posts yet.</p>
            </div>
          )
        )}
        {activeTab === "collections" && collections && (
          <div className="p-4 space-y-3">
            {collections.map((col: any) => (
              <button key={col.id} onClick={() => navigate(`/collections/${col.slug || col.id}`)} className="w-full text-left rounded-xl border border-border bg-card p-4 hover:brightness-110 transition-colors">
                <p className="text-sm font-semibold text-foreground">{col.title}</p>
                {col.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{col.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{col.item_count} items</span>
                  <span>{col.follower_count} followers</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <FollowListModal open={followersOpen} onClose={() => setFollowersOpen(false)} userId={profile.id} mode="followers" />
      <FollowListModal open={followingOpen} onClose={() => setFollowingOpen(false)} userId={profile.id} mode="following" />
    </div>
  );
}

/* ======= Shared Modals & Helpers ======= */

function FollowListModal({ open, onClose, userId, mode }: { open: boolean; onClose: () => void; userId: string; mode: "followers" | "following" }) {
  const { data: users } = useQuery({
    queryKey: ["follow_list", userId, mode],
    queryFn: async () => {
      if (mode === "followers") {
        const { data } = await supabase.from("follows").select("follower_id, profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)").eq("following_id", userId).order("created_at", { ascending: false }).limit(100);
        return (data ?? []).map((r: any) => r.profiles).filter(Boolean);
      } else {
        const { data } = await supabase.from("follows").select("following_id, profiles!follows_following_id_fkey(id, username, display_name, avatar_url)").eq("follower_id", userId).order("created_at", { ascending: false }).limit(100);
        return (data ?? []).map((r: any) => r.profiles).filter(Boolean);
      }
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "followers" ? "Followers" : "Following"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-1">
          {users && users.length > 0 ? users.map((u: any) => (
            <Link key={u.id} to={`/creator/${u.username}`} onClick={onClose} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/60 transition-colors">
              <Avatar className="h-9 w-9">
                {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{(u.display_name || u.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{u.display_name || u.username}</p>
                <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
              </div>
              <FollowButton creatorId={u.id} />
            </Link>
          )) : (
            <p className="text-sm text-muted-foreground text-center py-8">{mode === "followers" ? "No followers yet." : "Not following anyone yet."}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}
