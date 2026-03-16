import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, UserMinus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FollowButtonProps {
  creatorId: string;
  onCountChange?: (delta: number) => void;
}

export function FollowButton({ creatorId, onCountChange }: FollowButtonProps) {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hovering, setHovering] = useState(false);

  const isOwnProfile = user?.id === creatorId;

  useEffect(() => {
    if (!isLoggedIn || !user || isOwnProfile) {
      setLoading(false);
      return;
    }
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", creatorId)
      .maybeSingle()
      .then(({ data }) => {
        setFollowing(!!data);
        setLoading(false);
      });
  }, [isLoggedIn, user, creatorId, isOwnProfile]);

  const handleClick = useCallback(async () => {
    if (!isLoggedIn) {
      navigate("/signup");
      return;
    }
    if (!user || isOwnProfile) return;

    if (following) {
      // Optimistic unfollow
      setFollowing(false);
      onCountChange?.(-1);
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", creatorId);
      if (error) {
        setFollowing(true);
        onCountChange?.(1);
      } else {
        // Update counts
        await Promise.all([
          supabase.from("profiles").update({
            following_count: Math.max(0, 0), // We'll use RPC-style but simple decrement
          } as any).eq("id", user.id),
          supabase.from("profiles").update({
            follower_count: Math.max(0, 0),
          } as any).eq("id", creatorId),
        ]);
        // Recalculate actual counts
        const [{ count: followingCount }, { count: followerCount }] = await Promise.all([
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", creatorId),
        ]);
        await Promise.all([
          supabase.from("profiles").update({ following_count: followingCount ?? 0 } as any).eq("id", user.id),
          supabase.from("profiles").update({ follower_count: followerCount ?? 0 } as any).eq("id", creatorId),
        ]);
      }
    } else {
      // Optimistic follow
      setFollowing(true);
      onCountChange?.(1);
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: creatorId });
      if (error) {
        setFollowing(false);
        onCountChange?.(-1);
      } else {
        const [{ count: followingCount }, { count: followerCount }] = await Promise.all([
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", creatorId),
        ]);
        await Promise.all([
          supabase.from("profiles").update({ following_count: followingCount ?? 0 } as any).eq("id", user.id),
          supabase.from("profiles").update({ follower_count: followerCount ?? 0 } as any).eq("id", creatorId),
        ]);
      }
    }
  }, [following, isLoggedIn, user, creatorId, navigate, onCountChange, isOwnProfile]);

  if (isOwnProfile) return null;

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className="border-secondary text-secondary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </Button>
    );
  }

  if (following) {
    return (
      <Button
        size="sm"
        className="bg-secondary text-secondary-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={handleClick}
      >
        {hovering ? (
          <><UserMinus className="h-3.5 w-3.5 mr-1.5" /> Unfollow</>
        ) : (
          <><UserCheck className="h-3.5 w-3.5 mr-1.5" /> Following</>
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-secondary text-secondary hover:bg-secondary/10"
      onClick={handleClick}
    >
      <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Follow
    </Button>
  );
}
