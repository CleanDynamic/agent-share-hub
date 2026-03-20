import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Repeat2 } from "lucide-react";
import { TYPE_COLORS, displayContentType } from "@/lib/content-types";
import { timeAgo, difficultyColor } from "@/components/FeedItem";

interface ReblogModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  originalItem: {
    id: string;
    title: string;
    content_type: string;
    difficulty: string;
    cover_image_url?: string | null;
    created_at: string;
    creator_id: string;
  };
  originalCreator: {
    id: string;
    username: string;
    display_name: string | null;
  };
  /** Whether the current user has already reblogged this */
  alreadyReblogged?: boolean;
}

export function ReblogModal({
  open,
  onOpenChange,
  originalItem,
  originalCreator,
  alreadyReblogged = false,
}: ReblogModalProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const initials = (originalCreator.display_name || originalCreator.username || "?")
    .slice(0, 2)
    .toUpperCase();

  async function handleReblog(withComment: boolean) {
    if (!user || !profile) return;
    setSubmitting(true);

    try {
      const reblogComment = withComment && comment.trim() ? comment.trim() : null;

      // 1. Insert reblog content item
      const { data: newItem, error: insertErr } = await supabase
        .from("content_items")
        .insert({
          creator_id: user.id,
          is_reblog: true,
          reblog_of_content_id: originalItem.id,
          reblog_of_creator_id: originalItem.creator_id,
          reblog_comment: reblogComment,
          content_type: originalItem.content_type,
          title: originalItem.title,
          status: "approved",
          approved_at: new Date().toISOString(),
          is_free: true,
          monetisation_type: "free",
          difficulty: originalItem.difficulty,
          download_count: 0,
          view_count: 0,
          like_count: 0,
          avg_rating: 0,
          rating_count: 0,
          current_version: "1.0",
        } as any)
        .select("id")
        .single();

      if (insertErr || !newItem) throw insertErr || new Error("Failed to create reblog");

      // 2. Log interaction
      await supabase.from("user_interactions" as any).insert({
        user_id: user.id,
        content_id: originalItem.id,
        interaction_type: "reblogged",
        interaction_meta: {
          original_title: originalItem.title,
          original_creator: originalCreator.username,
        },
      } as any);

      // 3. Notify original creator
      if (originalItem.creator_id !== user.id) {
        await supabase.from("notifications" as any).insert({
          user_id: originalItem.creator_id,
          notification_type: "reblog",
          actor_id: user.id,
          content_id: originalItem.id,
          metadata: {
            reblogger_username: (profile as any).username,
            content_title: originalItem.title,
          },
        } as any);
      }

      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["content_detail", originalItem.id] });
      toast({ title: "Reblogged ✓" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Reblog failed", description: err.message || "Something went wrong.", variant: "destructive" });
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat2 className="h-4 w-4 text-[#2EC4B6]" />
            Reblog
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quoted post preview */}
          <div
            className="rounded-lg p-3 space-y-1.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-foreground">
                  {originalCreator.display_name || originalCreator.username}
                </span>
                <span className="text-[11px] text-muted-foreground ml-1.5">
                  @{originalCreator.username}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {timeAgo(originalItem.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <Badge variant="outline" className={`text-[9px] font-medium ${TYPE_COLORS[originalItem.content_type] ?? ""}`}>
                {displayContentType(originalItem.content_type)}
              </Badge>
              <Badge variant="outline" className={`text-[9px] font-medium ${difficultyColor(originalItem.difficulty)}`}>
                {originalItem.difficulty}
              </Badge>
            </div>
            <div className="flex items-start gap-2">
              <p className="text-sm font-bold text-foreground flex-1 line-clamp-2">{originalItem.title}</p>
              {originalItem.cover_image_url && (
                <img
                  src={originalItem.cover_image_url}
                  alt=""
                  className="h-[60px] w-[80px] rounded object-cover shrink-0"
                />
              )}
            </div>
          </div>

          {/* Comment textarea */}
          <div className="space-y-1">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 280))}
              placeholder="What do you think about this? (optional)"
              rows={3}
              className="bg-background border-border resize-none"
              disabled={alreadyReblogged}
            />
            <p className="text-[11px] text-muted-foreground text-right">{comment.length} / 280</p>
          </div>

          {/* Action buttons */}
          {alreadyReblogged ? (
            <Button disabled className="w-full" variant="secondary">
              Already reblogged ✓
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleReblog(false)}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Reblog without comment
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                onClick={() => handleReblog(true)}
                disabled={submitting || comment.trim().length === 0}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Post Reblog
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
