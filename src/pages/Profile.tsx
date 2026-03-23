import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SeoHead } from "@/components/SeoHead";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { FeedItem } from "@/components/FeedItem";
import { PortfolioCard } from "@/components/PortfolioCard";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  BadgeCheck, Download, FileText, Eye, Loader2, Camera, ExternalLink,
  Library, ShieldCheck, Calendar, Upload, Heart, Image as ImageIcon,
  MessageSquare, X,
} from "lucide-react";
import { FollowButton } from "@/components/FollowButton";
import { format } from "date-fns";

export default function Profile() {
  const { isLoggedIn, profile, loading, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !isLoggedIn) navigate("/login", { replace: true });
  }, [loading, isLoggedIn, navigate]);

  if (loading) return <ProfileSkeleton />;
  if (!profile) return null;

  return (
    <ProfileView
      profileData={profile as any}
      isOwnProfile
      currentUserId={user?.id}
      onProfileUpdated={refreshProfile}
    />
  );
}

/* ======= Shared Profile View ======= */

interface ProfileViewProps {
  profileData: any;
  isOwnProfile: boolean;
  currentUserId?: string;
  onProfileUpdated?: () => Promise<void>;
}

function ProfileView({ profileData, isOwnProfile, currentUserId, onProfileUpdated }: ProfileViewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);
  const [followerDelta, setFollowerDelta] = useState(0);
  const [activeTab, setActiveTab] = useState("posts");

  const profile = profileData;
  const initials = (profile.display_name || profile.username || "?").slice(0, 2).toUpperCase();
  const followerCount = (profile.follower_count ?? 0) + followerDelta;
  const followingCount = profile.following_count ?? 0;
  const joinDate = profile.joined_at || profile.created_at;

  // Tabs definition
  const tabs = useMemo(() => {
    const t = [
      { key: "posts", label: "Portfolio" },
      { key: "replies", label: "Replies" },
      { key: "media", label: "Media" },
      { key: "likes", label: "Likes" },
    ];
    if (isOwnProfile) t.push({ key: "library", label: "Library" });
    return t;
  }, [isOwnProfile]);

  // --- Posts tab ---
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

  // --- Replies tab ---
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

  // --- Media tab ---
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

  // --- Likes tab ---
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
      // Re-order by rating date
      const idOrder = new Map(ids.map((id, i) => [id, i]));
      return (data ?? []).sort((a: any, b: any) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
    },
    enabled: !!profile.id && activeTab === "likes",
  });

  // --- Library tab ---
  const { data: libraryItems } = useQuery({
    queryKey: ["profile_library", profile.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_library")
        .select("id, content_id, added_at, has_update, content_items(*, profiles!content_items_creator_id_fkey(id, username, display_name, avatar_url))")
        .eq("user_id", profile.id)
        .order("added_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile.id && isOwnProfile && activeTab === "library",
  });

  // --- Collections tab ---
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

  // Add collections tab if user has public collections
  const allTabs = useMemo(() => {
    const t = [...tabs];
    if (collections && collections.length > 0) {
      t.push({ key: "collections", label: "Collections" });
    }
    return t;
  }, [tabs, collections]);

  const displayName = profile.display_name || profile.username || "User";

  return (
    <div className="w-full">
      <SeoHead
        title={isOwnProfile ? "My Profile — NeoScale AI" : `${displayName} on NeoScale AI`}
        description={profile.bio || `${displayName}'s profile on NeoScale AI.`}
        path={isOwnProfile ? "/profile" : `/creator/${profile.username}`}
        noIndex={isOwnProfile}
      />

      {/* BANNER */}
      <div className="relative w-full" style={{ height: 200 }}>
        {profile.banner_url ? (
          <img
            src={profile.banner_url}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.4) 100%)",
            }}
          />
        )}
        {isOwnProfile && (
          <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors cursor-pointer group">
            <Camera className="h-8 w-8 text-white/0 group-hover:text-white/80 transition-colors" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleBannerUpload(e, profile.id, toast, onProfileUpdated)}
            />
          </label>
        )}
      </div>

      {/* AVATAR + ACTION BUTTON ROW */}
      <div className="px-4 flex justify-between items-start">
        {/* Avatar overlapping banner */}
        <div className="relative -mt-10">
          <Avatar className="h-20 w-20 border-4 border-background">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">{initials}</AvatarFallback>
          </Avatar>
          {isOwnProfile && (
            <label className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary flex items-center justify-center cursor-pointer border-2 border-background">
              <Camera className="h-3 w-3 text-primary-foreground" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarUpload(e, profile.id, toast, onProfileUpdated)}
              />
            </label>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex items-center gap-2">
          {isOwnProfile ? (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              Edit profile
            </Button>
          ) : (
            <>
              <FollowButton creatorId={profile.id} onCountChange={(d) => setFollowerDelta((prev) => prev + d)} />
              {currentUserId && currentUserId !== profile.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/messages?to=${profile.id}`)}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Message
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* PROFILE INFO */}
      <div className="px-4 mt-3">
        {/* Line 1: Name + badges */}
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

        {/* Line 2: @username */}
        <p className="text-sm text-muted-foreground">@{profile.username}</p>

        {/* Line 3: Bio */}
        {profile.bio && (
          <p className="text-sm text-foreground leading-relaxed mt-2">{profile.bio}</p>
        )}

        {/* Line 4: Website + Twitter */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {profile.website_url && (
            <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-secondary hover:underline">
              <ExternalLink className="h-3 w-3" /> {profile.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
          {profile.twitter_handle && (
            <a
              href={`https://twitter.com/${profile.twitter_handle.replace("@", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              𝕏 @{profile.twitter_handle.replace("@", "")}
            </a>
          )}
        </div>

        {/* Line 5: Joined date */}
        {joinDate && (
          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Joined {format(new Date(joinDate), "MMMM yyyy")}</span>
          </div>
        )}

        {/* Line 6: Following + Followers */}
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

        {/* Line 7: Stats */}
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
          <PostsTab items={contentItems ?? []} isOwnProfile={isOwnProfile} />
        )}
        {activeTab === "replies" && (
          <RepliesTab replies={replies ?? []} navigate={navigate} />
        )}
        {activeTab === "media" && (
          <MediaTab items={mediaItems ?? []} navigate={navigate} />
        )}
        {activeTab === "likes" && (
          <LikesTab items={likedItems ?? []} />
        )}
        {activeTab === "library" && isOwnProfile && (
          <LibraryTab items={libraryItems ?? []} />
        )}
        {activeTab === "collections" && (
          <CollectionsTab collections={collections ?? []} navigate={navigate} />
        )}
      </div>

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <EditProfileModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          profile={profile}
          onSaved={onProfileUpdated}
        />
      )}

      {/* Followers Modal */}
      <FollowListModal
        open={followersOpen}
        onClose={() => setFollowersOpen(false)}
        userId={profile.id}
        mode="followers"
      />

      {/* Following Modal */}
      <FollowListModal
        open={followingOpen}
        onClose={() => setFollowingOpen(false)}
        userId={profile.id}
        mode="following"
      />
    </div>
  );
}

/* ======= Tab Content Components ======= */

type PortfolioSort = "recent" | "rated" | "viewed";

function sortPortfolio(items: any[], sort: PortfolioSort): any[] {
  const copy = [...items];
  if (sort === "rated") return copy.sort((a, b) => (b.avg_rating - a.avg_rating) || (b.rating_count - a.rating_count));
  if (sort === "viewed") return copy.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0));
  return copy.sort((a, b) => new Date(b.approved_at || b.created_at).getTime() - new Date(a.approved_at || a.created_at).getTime());
}

function PostsTab({ items, isOwnProfile }: { items: any[]; isOwnProfile: boolean }) {
  const [sort, setSort] = useState<PortfolioSort>("recent");
  const sorted = useMemo(() => sortPortfolio(items, sort), [items, sort]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <FileText className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-sm text-foreground font-medium">No posts yet.</p>
        {isOwnProfile && (
          <Button asChild className="mt-4 bg-primary text-primary-foreground">
            <Link to="/upload"><Upload className="h-3.5 w-3.5 mr-1.5" /> Upload your first post</Link>
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="py-4">
      <PortfolioSortBar sort={sort} setSort={setSort} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sorted.map((item) => (
          <PortfolioCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function PortfolioSortBar({ sort, setSort }: { sort: PortfolioSort; setSort: (s: PortfolioSort) => void }) {
  const opts: { value: PortfolioSort; label: string }[] = [
    { value: "recent", label: "Recent" },
    { value: "rated", label: "Highest Rated" },
    { value: "viewed", label: "Most Viewed" },
  ];
  return (
    <div className="flex justify-start gap-1 mb-3">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => setSort(o.value)}
          className={`relative px-2.5 py-1 text-xs font-medium transition-colors ${
            sort === o.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
          {sort === o.value && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[2px] bg-primary rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}

function RepliesTab({ replies, navigate }: { replies: any[]; navigate: any }) {
  if (replies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">No replies yet.</p>
      </div>
    );
  }
  return (
    <div>
      {replies.map((reply: any) => {
        const content = reply.content_items;
        return (
          <div
            key={reply.id}
            className="px-4 py-3 border-b border-border cursor-pointer hover:bg-[hsl(0_0%_100%/0.03)] transition-colors"
            onClick={() => content && navigate(`/content/${content.id}`)}
          >
            {content && (
              <p className="text-xs text-muted-foreground mb-1">
                Replied to{" "}
                <Badge variant="outline" className="text-[10px] font-medium">
                  {content.content_type}
                </Badge>{" "}
                <span className="text-secondary">{content.title}</span>
              </p>
            )}
            <p className="text-sm text-foreground">{reply.text}</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span>{timeAgo(reply.created_at)}</span>
              {reply.like_count > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-3 w-3" /> {reply.like_count}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MediaTab({ items, navigate }: { items: any[]; navigate: any }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ImageIcon className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">No media posts yet.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-0.5 p-0.5">
      {items.map((item: any) => (
        <button
          key={item.id}
          onClick={() => navigate(`/content/${item.id}`)}
          className="aspect-square overflow-hidden"
        >
          <img
            src={item.cover_image_url}
            alt={item.title}
            className="w-full h-full object-cover hover:opacity-80 transition-opacity"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}

function LikesTab({ items }: { items: any[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Heart className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">No liked posts yet.</p>
      </div>
    );
  }
  return (
    <div>
      {items.map((item) => (
        <FeedItem key={item.id} item={item} />
      ))}
    </div>
  );
}

function LibraryTab({ items }: { items: any[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Library className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-sm text-foreground font-medium mb-1">Your library is empty.</p>
        <p className="text-sm text-muted-foreground mb-4">Add content using the shelf icon on any post.</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/browse">Browse content</Link>
        </Button>
      </div>
    );
  }
  return (
    <div>
      {items.map((lib: any) => {
        const item = lib.content_items;
        if (!item) return null;
        return (
          <div key={lib.id} className="relative">
            {lib.has_update && (
              <div className="absolute top-3 right-4 z-10 h-2.5 w-2.5 rounded-full bg-primary" />
            )}
            <FeedItem item={item} />
          </div>
        );
      })}
    </div>
  );
}

function CollectionsTab({ collections, navigate }: { collections: any[]; navigate: any }) {
  return (
    <div className="p-4 space-y-3">
      {collections.map((col: any) => (
        <button
          key={col.id}
          onClick={() => navigate(`/collections/${col.slug || col.id}`)}
          className="w-full text-left rounded-xl border border-border bg-card p-4 hover:brightness-110 transition-colors"
        >
          <p className="text-sm font-semibold text-foreground">{col.title}</p>
          {col.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{col.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{col.item_count} items</span>
            <span>{col.follower_count} followers</span>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ======= Edit Profile Modal ======= */

function EditProfileModal({
  open, onClose, profile, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  profile: any;
  onSaved?: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url || "");
  const [twitterHandle, setTwitterHandle] = useState(profile.twitter_handle || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setWebsiteUrl(profile.website_url || "");
      setTwitterHandle(profile.twitter_handle || "");
    }
  }, [open, profile]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        website_url: websiteUrl.trim() || null,
        twitter_handle: twitterHandle.trim() || null,
      } as any)
      .eq("id", profile.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      await onSaved?.();
      toast({ title: "Profile updated" });
      onClose();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>

        {/* Banner preview */}
        <div className="relative w-full h-24 rounded-lg overflow-hidden">
          {profile.banner_url ? (
            <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.4) 100%)" }} />
          )}
          <label className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors cursor-pointer">
            <Camera className="h-5 w-5 text-white/80" />
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleBannerUpload(e, profile.id, toast, onSaved)} />
          </label>
        </div>

        {/* Avatar preview */}
        <div className="flex items-center gap-3 -mt-2">
          <div className="relative">
            <Avatar className="h-14 w-14">
              {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                {(profile.display_name || profile.username || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center cursor-pointer">
              <Camera className="h-3 w-3 text-primary-foreground" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarUpload(e, profile.id, toast, onSaved)} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">Change avatar</p>
        </div>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, 50))} maxLength={50} />
            <p className="text-xs text-muted-foreground text-right">{displayName.length}/50</p>
          </div>
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 160))} rows={3} maxLength={160} />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/160</p>
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" />
          </div>
          <div className="space-y-1.5">
            <Label>Twitter / X</Label>
            <Input value={twitterHandle} onChange={(e) => setTwitterHandle(e.target.value)} placeholder="handle" />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handleSave} disabled={saving} className="ns-btn-primary flex-1 bg-primary text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
          <Button variant="outline" className="ns-btn-silver" onClick={onClose}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ======= Follow List Modal ======= */

function FollowListModal({
  open, onClose, userId, mode,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  mode: "followers" | "following";
}) {
  const { data: users } = useQuery({
    queryKey: ["follow_list", userId, mode],
    queryFn: async () => {
      if (mode === "followers") {
        const { data } = await supabase
          .from("follows")
          .select("follower_id, profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)")
          .eq("following_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);
        return (data ?? []).map((r: any) => r.profiles).filter(Boolean);
      } else {
        const { data } = await supabase
          .from("follows")
          .select("following_id, profiles!follows_following_id_fkey(id, username, display_name, avatar_url)")
          .eq("follower_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);
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
          {users && users.length > 0 ? (
            users.map((u: any) => {
              const ini = (u.display_name || u.username || "?").slice(0, 2).toUpperCase();
              return (
                <Link
                  key={u.id}
                  to={`/creator/${u.username}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/60 transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{ini}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{u.display_name || u.username}</p>
                    <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                  </div>
                  <FollowButton creatorId={u.id} />
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {mode === "followers" ? "No followers yet." : "Not following anyone yet."}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ======= Helpers ======= */

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

async function handleBannerUpload(
  e: React.ChangeEvent<HTMLInputElement>,
  userId: string,
  toast: any,
  onDone?: () => Promise<void>,
) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast({ title: "File too large", description: "Max 5MB.", variant: "destructive" });
    return;
  }
  const ext = file.name.split(".").pop();
  const path = `${userId}/banner.${ext}`;
  const { error } = await supabase.storage.from("profile-assets").upload(path, file, { upsert: true });
  if (error) {
    toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    return;
  }
  const { data: urlData } = supabase.storage.from("profile-assets").getPublicUrl(path);
  await supabase.from("profiles").update({ banner_url: urlData.publicUrl } as any).eq("id", userId);
  await onDone?.();
  toast({ title: "Banner updated" });
}

async function handleAvatarUpload(
  e: React.ChangeEvent<HTMLInputElement>,
  userId: string,
  toast: any,
  onDone?: () => Promise<void>,
) {
  const file = e.target.files?.[0];
  if (!file) return;
  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) {
    toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    return;
  }
  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  await supabase.from("profiles").update({ avatar_url: urlData.publicUrl } as any).eq("id", userId);
  await onDone?.();
  toast({ title: "Avatar updated" });
}

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
