import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Loader2, MessageCircle } from "lucide-react";

interface Comment {
  id: string;
  text: string;
  like_count: number;
  created_at: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
}

interface Props {
  contentId: string;
  contentTitle: string;
  blockId?: string | null;
  commentCount: number;
  isEligible: boolean;
  compact?: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function CommentsSection({
  contentId,
  contentTitle,
  blockId = null,
  commentCount,
  isEligible,
  compact = false,
}: Props) {
  const { isLoggedIn, user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [posting, setPosting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [totalCount, setTotalCount] = useState(commentCount);

  const fetchComments = useCallback(async (all = false) => {
    setLoading(true);
    let q = supabase
      .from("content_comments" as any)
      .select("id, text, like_count, created_at, user_id, profiles(display_name, username)")
      .eq("content_id", contentId)
      .eq("is_deleted", false)
      .order("like_count", { ascending: false })
      .order("created_at", { ascending: false });

    if (blockId) {
      q = q.eq("block_id", blockId);
    } else {
      q = q.is("block_id", null);
    }

    if (!all) q = q.limit(3);

    const { data } = await q;
    const mapped = ((data as any[]) ?? []).map((c: any) => ({
      id: c.id,
      text: c.text,
      like_count: c.like_count,
      created_at: c.created_at,
      user_id: c.user_id,
      display_name: c.profiles?.display_name ?? null,
      username: c.profiles?.username ?? null,
    }));
    setComments(mapped);
    setLoading(false);
  }, [contentId, blockId]);

  // Fetch user's likes
  const fetchLikes = useCallback(async () => {
    if (!user) return;
    const ids = comments.map((c) => c.id);
    if (ids.length === 0) return;
    const { data } = await supabase
      .from("comment_likes" as any)
      .select("comment_id")
      .eq("user_id", user.id)
      .in("comment_id", ids);
    setLikedIds(new Set(((data as any[]) ?? []).map((r: any) => r.comment_id)));
  }, [user, comments]);

  useEffect(() => { fetchComments(showAll); }, [fetchComments, showAll]);
  useEffect(() => { fetchLikes(); }, [fetchLikes]);

  async function handlePost() {
    if (!user || !newText.trim() || posting) return;
    setPosting(true);

    const { data, error } = await supabase.from("content_comments" as any).insert({
      content_id: contentId,
      block_id: blockId,
      user_id: user.id,
      text: newText.trim(),
    } as any).select("id").single();

    if (error) {
      toast({ title: "Failed to post comment", variant: "destructive" });
      setPosting(false);
      return;
    }

    const commentId = (data as any)?.id;

    // Log interaction
    await supabase.from("user_interactions" as any).insert({
      user_id: user.id,
      content_id: contentId,
      interaction_type: "commented",
      interaction_meta: { comment_id: commentId, content_title: contentTitle },
    } as any);

    // Optimistic add
    setComments((prev) => [
      {
        id: commentId,
        text: newText.trim(),
        like_count: 0,
        created_at: new Date().toISOString(),
        user_id: user.id,
        display_name: null,
        username: null,
      },
      ...prev,
    ]);
    setTotalCount((c) => c + 1);
    setNewText("");
    setPosting(false);
  }

  async function toggleLike(commentId: string) {
    if (!isLoggedIn || !user) {
      toast({ title: "Sign in to like comments" });
      return;
    }

    const isLiked = likedIds.has(commentId);

    // Optimistic
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(commentId); else next.add(commentId);
      return next;
    });
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, like_count: c.like_count + (isLiked ? -1 : 1) } : c
      )
    );

    if (isLiked) {
      await supabase
        .from("comment_likes" as any)
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);
      // Decrement like_count
      await supabase.from("content_comments" as any)
        .update({ like_count: Math.max(0, (comments.find((c) => c.id === commentId)?.like_count ?? 1) - 1) } as any)
        .eq("id", commentId);
    } else {
      await supabase.from("comment_likes" as any).insert({
        comment_id: commentId,
        user_id: user.id,
      } as any);
      // Increment like_count
      const current = comments.find((c) => c.id === commentId)?.like_count ?? 0;
      await supabase.from("content_comments" as any)
        .update({ like_count: current + 1 } as any)
        .eq("id", commentId);
      // Log interaction
      await supabase.from("user_interactions" as any).insert({
        user_id: user.id,
        content_id: contentId,
        interaction_type: "liked_comment",
        interaction_meta: { comment_id: commentId, content_title: contentTitle },
      } as any);
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!compact && (
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Comments ({totalCount})
        </h3>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-primary">
                  {getInitials(c.display_name || c.username)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {c.display_name || c.username || "User"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{c.text}</p>
                <button
                  onClick={() => toggleLike(c.id)}
                  className="flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Heart
                    className={`h-3 w-3 ${likedIds.has(c.id) ? "fill-red-500 text-red-500" : ""}`}
                  />
                  {c.like_count > 0 && <span>{c.like_count}</span>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showAll && totalCount > 3 && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-secondary hover:underline"
        >
          View all {totalCount} comments
        </button>
      )}

      {/* Comment input */}
      {!isLoggedIn ? (
        <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground">
          Sign in to leave a comment
        </Link>
      ) : !isEligible ? (
        <p className="text-xs text-muted-foreground">
          Download or view this content to leave a rating or comment.
        </p>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value.slice(0, 500))}
            placeholder="Add a comment..."
            rows={compact ? 2 : 3}
            maxLength={500}
            className="bg-background border-border rounded-xl text-sm resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{newText.length}/500</span>
            <Button
              size="sm"
              onClick={handlePost}
              disabled={!newText.trim() || posting}
            >
              {posting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Post
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
