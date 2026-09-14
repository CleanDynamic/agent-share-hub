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
import { categoryFill } from "@/lib/theme/category";
import { buttonStyle, chipType, GLASS_BLUR, uiTransition } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText, measure, tabular, type as typeRole } from "@/lib/theme/type";
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
        <p style={{ ...body, fontSize: 14, color: t.text2 }}>Creator not found.</p>
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

  // Bounty posts by this profile
  const { data: bountyItems } = useQuery({
    queryKey: ["profile_bounties", profile.id],
    queryFn: async () => {
      const { data } = await (supabase
        .from("content_items")
        .select("*, profiles!content_items_creator_id_fkey(id, username, display_name, avatar_url)")
        .eq("creator_id", profile.id)
        .eq("status", "approved") as any)
        .eq("bounty_enabled", true)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!profile.id && activeTab === "bounties",
  });

  // Solutions (bounty responses marked as solution)
  const { data: solutionResponses } = useQuery({
    queryKey: ["profile_solutions", profile.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bounty_responses" as any)
        .select("*, content_items!bounty_responses_bounty_content_id_fkey(id, title)")
        .eq("responder_id", profile.id)
        .eq("is_solution", true)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!profile.id && activeTab === "solutions",
  });

  const allTabs = useMemo(() => {
    const t = [...tabs];
    if (collections && collections.length > 0) {
      t.push({ key: "collections", label: "Collections" });
    }
    t.push({ key: "bounties", label: "Bounties" });
    if ((profile.bounties_solved ?? 0) > 0) {
      t.push({ key: "solutions", label: "Solutions" });
    }
    return t;
  }, [collections, profile.bounties_solved]);

  const seoDesc = `${(profile.bio || "").slice(0, 155)}${profile.bio ? " — " : ""}${contentItems?.length ?? 0} posts on buildgallery.ai.`;

  return (
    <div className="w-full">
      <SeoHead title={`${displayName} on buildgallery.ai`} description={seoDesc} path={`/creator/${profile.username}`} ogType="profile" />

      {/* BANNER */}
      <div className="relative w-full" style={{ height: 200 }}>
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
        ) : (
          /* `--recess`, not a two-stop ramp off the shadcn primary and not
             `--porthole` either. See the note on the same band in
             `ProfileHeader`: a 200px full-width slab is the largest object on
             the page, and in the media-well colour it is also the darkest. */
          <div className="w-full h-full" style={{ background: t.recess }} />
        )}
      </div>

      {/* AVATAR + ACTION */}
      <div className="px-4 flex justify-between items-start">
        <div className="relative -mt-10">
          <Avatar className="shrink-0" style={{ width: 72, height: 72, border: `3px solid ${t.bg}` }}>
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback style={{ ...typeRole.cardTitle, background: t.recess, color: t.text2 }}>{initials}</AvatarFallback>
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
          <h1 style={{ ...typeRole.cardTitle, color: t.text, margin: 0 }}>{displayName}</h1>
          {profile.is_creator && (
            <Badge style={{ ...chipType, fontSize: 10, background: t.recess, color: t.text2, borderColor: t.line, borderRadius: r.chip }}>
              <BadgeCheck className="h-3 w-3 mr-1" /> Creator
            </Badge>
          )}
          {/* The top step of the rarity ladder: a `--lit` FILL with the
              measured label on it. Amber is light here and never type. */}
          {profile.is_curator && (
            <Badge style={{ ...chipType, fontSize: 10, background: t.lit, color: t.onLit, borderColor: "transparent", borderRadius: r.chip }}>
              <ShieldCheck className="h-3 w-3 mr-1" /> Curator ✦
            </Badge>
          )}
        </div>
        <p style={{ ...dataText, fontSize: 14, color: t.text2, marginTop: 2 }}>@{profile.username}</p>
        {/* The bio, capped at the theme's 68-character measure. Weight 300 is
            below the 400 floor the type system sets for anything under 18px. */}
        {profile.bio && (
          <p style={{ ...body, ...measure, fontSize: 13, color: t.text, lineHeight: 1.5, marginTop: 8, textWrap: "pretty" }}>
            {profile.bio}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {profile.website_url && (
            <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1" style={{ ...body, fontSize: 12, color: t.action, textDecoration: "underline", textUnderlineOffset: "3px" }}>
              <ExternalLink className="h-3 w-3" /> {profile.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          )}
          {profile.twitter_handle && (
            <a href={`https://twitter.com/${profile.twitter_handle.replace("@", "")}`} target="_blank" rel="noopener noreferrer" style={{ ...body, fontSize: 12, color: t.action, textDecoration: "underline", textUnderlineOffset: "3px" }}>
              𝕏 @{profile.twitter_handle.replace("@", "")}
            </a>
          )}
        </div>
        {joinDate && (
          <div className="flex items-center gap-1 mt-2" style={{ ...dataText, fontSize: 12, color: t.text2 }}>
            <Calendar className="h-3 w-3" />
            <span>Joined {format(new Date(joinDate), "MMMM yyyy")}</span>
          </div>
        )}
        {/* The counts. Tabular figures throughout, so a row of five numbers
            does not shuffle as each query lands. */}
        <div className="flex items-center flex-wrap" style={{ gap: 16, marginTop: 12, ...dataText, ...tabular, fontSize: 13, color: t.text2 }}>
          <button onClick={() => setFollowingOpen(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', ...dataText, ...tabular, fontSize: 13, color: t.text2 }}>
            <span style={{ fontWeight: 500, color: t.text }}>{followingCount}</span> Following
          </button>
          <button onClick={() => setFollowersOpen(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', ...dataText, ...tabular, fontSize: 13, color: t.text2 }}>
            <span style={{ fontWeight: 500, color: t.text }}>{followerCount}</span> Followers
          </button>
          <span><span style={{ fontWeight: 500, color: t.text }}>{contentItems?.length ?? 0}</span> posts</span>
          <span><span style={{ fontWeight: 500, color: t.text }}>{totalDownloads.toLocaleString()}</span> downloads</span>
          <span><span style={{ fontWeight: 500, color: t.text }}>{totalViews.toLocaleString()}</span> views</span>
          {(profile.bounties_solved ?? 0) > 0 && (
            /* Solved bounties is somebody else accepting your work: the
               evidence token, not a private teal. */
            <span style={{ color: t.evidence }}>★ <span style={{ fontWeight: 500 }}>{profile.bounties_solved}</span> bounties solved</span>
          )}
        </div>
      </div>

      {/* TAB BAR */}
      {/* THE TAB BAR, ON BG-P07's TAB. It was a row of capsules with the
          current one filled and its label recoloured — which made one tab read
          as a button and the rest as text, and put a second accent on a page
          whose only accent should be Follow. Active is now a 2px `--action`
          underline plus a step up to full `--text`, exactly as on /profile and
          in the feed. The strip is short and sticky, which is the one case the
          theme lets a surface spend the single blur value on. */}
      <div className="flex items-center gap-1 mt-4 sticky top-0 z-10 overflow-x-auto" style={{ background: t.glass, backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR, paddingBottom: 12, borderBottom: `1px solid ${t.line}`, marginBottom: 20 }}>
        {allTabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              data-state={active ? "active" : "inactive"}
              aria-current={active ? "page" : undefined}
              style={{
                ...body,
                fontSize: 13,
                fontWeight: 500,
                padding: '6px 16px',
                borderRadius: 0,
                border: 'none',
                /* Both states carry the 2px, so becoming current shifts no
                   neighbour. */
                borderBottom: `2px solid ${active ? t.action : "transparent"}`,
                cursor: 'pointer',
                background: 'transparent',
                color: active ? t.text : t.text2,
                whiteSpace: 'nowrap',
                transition: uiTransition(),
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      <div className="min-h-[400px]">
        {activeTab === "posts" && (
          contentItems && contentItems.length > 0 ? (
            <CreatorPostsTab items={contentItems} />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="h-10 w-10 mb-4" style={{ color: t.text2 }} />
              <p style={{ ...body, fontSize: 14, color: t.text2 }}>{displayName} hasn't published anything yet.</p>
            </div>
          )
        )}
        {activeTab === "replies" && (
          replies && replies.length > 0 ? (
            <div>
              {replies.map((reply: any) => {
                const content = reply.content_items;
                return (
                  <div key={reply.id} className="px-4 py-3 cursor-pointer" style={{ borderBottom: `1px solid ${t.line}`, transition: uiTransition() }} onClick={() => content && navigate(`/content/${content.id}`)}>
                    {content && (
                      <p className="mb-1" style={{ ...dataText, fontSize: 12, color: t.text2 }}>
                        Replied to <Badge variant="outline" className="text-[10px] font-medium">{content.content_type}</Badge>{" "}
                        <span style={{ color: t.action }}>{content.title}</span>
                      </p>
                    )}
                    <p style={{ ...body, fontSize: 14, color: t.text }}>{reply.text}</p>
                    <div className="flex items-center gap-3 mt-1.5" style={{ ...dataText, ...tabular, fontSize: 12, color: t.text2 }}>
                      <span>{timeAgo(reply.created_at)}</span>
                      {reply.like_count > 0 && <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {reply.like_count}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MessageSquare className="h-10 w-10 mb-4" style={{ color: t.text2 }} />
              <p style={{ ...body, fontSize: 14, color: t.text2 }}>No replies yet.</p>
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
              <ImageIcon className="h-10 w-10 mb-4" style={{ color: t.text2 }} />
              <p style={{ ...body, fontSize: 14, color: t.text2 }}>No media posts yet.</p>
            </div>
          )
        )}
        {activeTab === "likes" && (
          likedItems && likedItems.length > 0 ? (
            <div>{likedItems.map((item: any) => <FeedItem key={item.id} item={item} context="profile" navState={{ from: "profile", name: displayName }} />)}</div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Heart className="h-10 w-10 mb-4" style={{ color: t.text2 }} />
              <p style={{ ...body, fontSize: 14, color: t.text2 }}>No liked posts yet.</p>
            </div>
          )
        )}
        {activeTab === "collections" && collections && (
          <div className="p-4 space-y-3">
            {collections.map((col: any) => (
              <button key={col.id} onClick={() => navigate(`/collections/${col.slug || col.id}`)} className="w-full text-left rounded-xl border border-border bg-card p-4 hover:brightness-110 transition-colors">
                <p style={{ ...body, fontSize: 14, fontWeight: 600, color: t.text }}>{col.title}</p>
                {col.description && <p className="mt-1 line-clamp-2" style={{ ...body, fontSize: 12, color: t.text2 }}>{col.description}</p>}
                <div className="flex items-center gap-3 mt-2" style={{ ...dataText, ...tabular, fontSize: 12, color: t.text2 }}>
                  <span>{col.item_count} items</span>
                  <span>{col.follower_count} followers</span>
                </div>
              </button>
            ))}
          </div>
        )}
        {activeTab === "bounties" && (
          bountyItems && bountyItems.length > 0 ? (
            <div>{bountyItems.map((item: any) => <FeedItem key={item.id} item={item} context="profile" navState={{ from: "profile", name: displayName }} />)}</div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p style={{ ...body, fontSize: 14, color: t.text2 }}>No bounties posted yet.</p>
            </div>
          )
        )}
        {activeTab === "solutions" && (
          solutionResponses && solutionResponses.length > 0 ? (
            <div className="p-4 space-y-3">
              {solutionResponses.map((resp: any) => {
                const bounty = resp.content_items as any;
                return (
                  <Link key={resp.id} to={`/content/${resp.bounty_content_id}?tab=responses`} className="block rounded-xl border border-green-500/30 bg-card p-4 hover:brightness-110 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        /* An accepted solution is the evidence claim: somebody
                           else ran it and said it worked. The measured pair,
                           at the chip radius — green is not in this palette. */
                        style={{
                          ...chipType,
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: r.chip,
                          backgroundColor: categoryFill("evidence").background,
                          color: t.text,
                        }}
                      >
                        ✓ Solution
                      </span>
                    </div>
                    <p style={{ ...body, fontSize: 14, fontWeight: 600, color: t.text }}>{bounty?.title || "Unknown bounty"}</p>
                    <p className="mt-1 line-clamp-2" style={{ ...body, fontSize: 12, color: t.text2 }}>{resp.how_it_fixes}</p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p style={{ ...body, fontSize: 14, color: t.text2 }}>No solved bounties yet.</p>
            </div>
          )
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
      <DialogContent
        className="sm:max-w-sm"
        data-visual-slot="modal-surface"
        /* The dialog surface, from the theme rather than a near-black hex and
           the legacy border name: on Exhibition a near-black sheet is a dark
           rectangle in a lit room. */
        style={{ background: t.glass, backdropFilter: GLASS_BLUR, WebkitBackdropFilter: GLASS_BLUR, border: `1px solid ${t.glassBorder}`, borderRadius: r.panel }}
      >
        <DialogHeader>
          <DialogTitle>{mode === "followers" ? "Followers" : "Following"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-1">
          {users && users.length > 0 ? users.map((u: any) => (
            <Link key={u.id} to={`/creator/${u.username}`} onClick={onClose} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/60 transition-colors">
              <Avatar className="h-9 w-9">
                {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                <AvatarFallback style={{ ...chipType, background: t.recess, color: t.text2 }}>{(u.display_name || u.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate" style={{ ...body, fontSize: 14, fontWeight: 600, color: t.text, margin: 0 }}>{u.display_name || u.username}</p>
                <p className="truncate" style={{ ...dataText, fontSize: 12, color: t.text2, margin: 0 }}>@{u.username}</p>
              </div>
              <FollowButton creatorId={u.id} />
            </Link>
          )) : (
            <p className="text-center py-8" style={{ ...body, fontSize: 14, color: t.text2 }}>{mode === "followers" ? "No followers yet." : "Not following anyone yet."}</p>
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

type PortfolioSort = "recent" | "rated" | "viewed";

function sortPortfolio(items: any[], sort: PortfolioSort): any[] {
  const copy = [...items];
  if (sort === "rated") return copy.sort((a, b) => (b.avg_rating - a.avg_rating) || (b.rating_count - a.rating_count));
  if (sort === "viewed") return copy.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0));
  return copy.sort((a, b) => new Date(b.approved_at || b.created_at).getTime() - new Date(a.approved_at || a.created_at).getTime());
}

function CreatorPostsTab({ items }: { items: any[] }) {
  const [sort, setSort] = useState<PortfolioSort>("recent");
  const sorted = useMemo(() => sortPortfolio(items, sort), [items, sort]);
  const opts: { value: PortfolioSort; label: string }[] = [
    { value: "recent", label: "Recent" },
    { value: "rated", label: "Highest Rated" },
    { value: "viewed", label: "Most Viewed" },
  ];
  return (
    <div className="py-4">
      <div className="flex justify-start gap-1 mb-3">
        {opts.map((o) => (
          <button
            key={o.value}
            onClick={() => setSort(o.value)}
            className="relative px-2.5 py-1"
            style={{
              ...body,
              fontSize: 12,
              fontWeight: 500,
              background: "transparent",
              border: "none",
              borderRadius: 0,
              cursor: "pointer",
              color: sort === o.value ? t.text : t.text2,
              transition: uiTransition(),
            }}
          >
            {o.label}
            {sort === o.value && (
              /* Absolutely positioned, so becoming current changes no
                 measurement and shifts no neighbour. */
              <span
                aria-hidden
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full"
                style={{ height: 2, background: t.action }}
              />
            )}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sorted.map((item: any) => <PortfolioCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}
