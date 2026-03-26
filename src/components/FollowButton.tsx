import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { insertNotification } from "@/lib/notifications";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, UserMinus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface FollowButtonProps {
  creatorId: string;
  onCountChange?: (delta: number) => void;
}

export function FollowButton({ creatorId, onCountChange }: FollowButtonProps) {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
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
    if (!user || isOwnProfile || acting) return;

    setActing(true);

    if (following) {
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
        toast({ title: "Could not update follow. Please try again.", variant: "destructive" });
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
    } else {
      setFollowing(true);
      onCountChange?.(1);
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: creatorId });
      if (error) {
        setFollowing(false);
        onCountChange?.(-1);
        toast({ title: "Could not update follow. Please try again.", variant: "destructive" });
      } else {
        const [{ count: followingCount }, { count: followerCount }] = await Promise.all([
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", creatorId),
        ]);
        await Promise.all([
          supabase.from("profiles").update({ following_count: followingCount ?? 0 } as any).eq("id", user.id),
          supabase.from("profiles").update({ follower_count: followerCount ?? 0 } as any).eq("id", creatorId),
        ]);
        // Notification
        const { data: myProfile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
        insertNotification({
          recipient_id: creatorId,
          actor_id: user.id,
          notification_type: "new_follower",
          metadata: { username: myProfile?.username || "" },
        });
      }
    }
    setActing(false);
  }, [following, isLoggedIn, user, creatorId, navigate, onCountChange, isOwnProfile, acting, toast]);

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
        data-visual-slot="btn-secondary"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-btn)',
          color: 'var(--text)',
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={handleClick}
        disabled={acting}
      >
        {acting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : hovering ? (
          <><UserMinus className="h-3.5 w-3.5 mr-1.5" /> Unfollow</>
        ) : (
          <><UserCheck className="h-3.5 w-3.5 mr-1.5" /> Following</>
        )}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      data-visual-slot="btn-secondary"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-btn)',
        color: 'var(--text)',
      }}
      onClick={handleClick}
      disabled={acting}
    >
      {acting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <><UserPlus className="h-3.5 w-3.5 mr-1.5" /> Follow</>
      )}
    </Button>
  );
}
