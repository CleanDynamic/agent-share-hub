import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sendMentionNotifications } from "@/lib/mentions";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { MentionInput } from "@/components/MentionInput";
import { MentionText } from "@/components/MentionText";
import { ThumbsUp, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  contentId: string;
  isEligible: boolean;
}

export function TipsTab({ contentId, isEligible }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: tips, isLoading } = useQuery({
    queryKey: ["content_tips", contentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_tips")
        .select("id, text, ai_tool_context, upvote_count, created_at, user_id, profiles!content_tips_user_id_fkey(username, display_name)")
        .eq("content_id", contentId)
        .eq("is_deleted", false)
        .order("upvote_count", { ascending: false });
      return data ?? [];
    },
    enabled: !!contentId,
  });

  async function handlePost() {
    if (!text.trim() || !user) return;
    setPosting(true);
    const { error } = await supabase.from("content_tips").insert({
      content_id: contentId,
      user_id: user.id,
      text: text.trim(),
    });
    if (!error) {
      // Send mention notifications
      await sendMentionNotifications({
        text: text.trim(),
        actorId: user.id,
        contentId,
        context: "tip",
      });
      queryClient.invalidateQueries({ queryKey: ["content_tips", contentId] });
      setText("");
      toast({ title: "Tip posted" });
    }
    setPosting(false);
  }

  async function handleUpvote(tipId: string) {
    if (!user) return;
    const { data: existing } = await supabase
      .from("tip_upvotes")
      .select("id")
      .eq("tip_id", tipId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      await supabase.from("tip_upvotes").delete().eq("id", existing.id);
    } else {
      await supabase.from("tip_upvotes").insert({ tip_id: tipId, user_id: user.id });
    }
    queryClient.invalidateQueries({ queryKey: ["content_tips", contentId] });
  }

  return (
    <div className="space-y-4">
      {isEligible && (
        <div className="space-y-2">
          <MentionInput
            placeholder="Share a tip or gotcha about this content..."
            value={text}
            onChange={setText}
            rows={2}
          />
          <Button size="sm" onClick={handlePost} disabled={!text.trim() || posting} className="text-xs">
            {posting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Post tip
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !tips || tips.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No tips yet. Be the first to share one.</p>
      ) : (
        <div className="space-y-3">
          {tips.map((tip: any) => (
            <div key={tip.id} className="border border-border rounded-lg p-3 bg-card">
              <MentionText text={tip.text} className="text-sm text-foreground mb-2" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {(tip.profiles as any)?.display_name || (tip.profiles as any)?.username || "User"} · {formatDistanceToNow(new Date(tip.created_at), { addSuffix: true })}
                </span>
                {user && (
                  <button onClick={() => handleUpvote(tip.id)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                    <ThumbsUp className="h-3 w-3" /> {tip.upvote_count}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
