import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

const initials = (name: string) => (name || "?").slice(0, 2).toUpperCase();

function orderParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

interface ShareToDMModalProps {
  open: boolean;
  onClose: () => void;
  contentId: string;
  contentTitle: string;
  /** When provided, share a reblog instead of a post. */
  kind?: "post" | "reblog";
  reblogId?: string;
  reblogSlug?: string;
  reblogMeta?: {
    rebloggerHandle?: string | null;
    rebloggerDisplayName?: string | null;
    originalTitle?: string | null;
    originalSlug?: string | null;
    text?: string | null;
  };
}

export function ShareToDMModal({
  open,
  onClose,
  contentId,
  contentTitle,
  kind = "post",
  reblogId,
  reblogSlug,
  reblogMeta,
}: ShareToDMModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch existing threads for quick picks
  const { data: threads } = useQuery({
    queryKey: ["dm_threads_for_share", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("dm_threads")
        .select("id, participant_a, participant_b")
        .or(`participant_a.eq.${user!.id},participant_b.eq.${user!.id}`)
        .order("last_message_at", { ascending: false })
        .limit(20);
      if (!data) return [];
      const otherIds = data.map((t: any) => t.participant_a === user!.id ? t.participant_b : t.participant_a);
      if (otherIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", otherIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return data.map((t: any) => {
        const otherId = t.participant_a === user!.id ? t.participant_b : t.participant_a;
        return { threadId: t.id, ...profileMap.get(otherId) };
      }).filter((t: any) => t.username);
    },
    enabled: !!user && open,
  });

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
      .neq("id", user?.id ?? "")
      .limit(10);
    setResults(data ?? []);
    setLoading(false);
  }, [user]);

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  };

  const sendToUser = async (recipientId: string, displayName: string) => {
    if (!user || sentTo.has(recipientId)) return;
    const [pA, pB] = orderParticipants(user.id, recipientId);

    // Find or create thread
    let threadId: string | null = null;
    const { data: existing } = await supabase
      .from("dm_threads")
      .select("id")
      .eq("participant_a", pA)
      .eq("participant_b", pB)
      .maybeSingle();

    if (existing) {
      threadId = existing.id;
    } else {
      const { data: newThread } = await supabase
        .from("dm_threads")
        .insert({ participant_a: pA, participant_b: pB, request_status: "accepted" })
        .select("id")
        .single();
      threadId = newThread?.id ?? null;
    }

    if (!threadId) return;

    await supabase.from("dm_messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      message_type: "post_share",
      shared_content_id: contentId,
    });

    setSentTo((prev) => new Set(prev).add(recipientId));
    queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
    toast.success(`Sent to ${displayName}`);
  };

  const displayList = query.length >= 2 ? results : (threads ?? []);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSentTo(new Set()); setQuery(""); } }}>
      <DialogContent
        className="max-w-md"
        data-visual-slot="modal-surface"
        style={{ background: '#0E0E16', border: '1px solid var(--border)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">Share post</DialogTitle>
        </DialogHeader>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search people..."
            className="pl-9 h-9 rounded-full bg-background border-border text-sm"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto mt-2 space-y-0.5">
          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {displayList.length === 0 && !loading && query.length >= 2 && (
            <p className="text-sm text-muted-foreground text-center py-6">No results</p>
          )}
          {displayList.map((p: any) => {
            const pid = p.id;
            const sent = sentTo.has(pid);
            const name = p.display_name || p.username || "User";
            return (
              <button
                key={pid}
                onClick={() => sendToUser(pid, name)}
                disabled={sent}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-accent/40 transition-colors text-left disabled:opacity-60"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                  <AvatarFallback className="bg-accent text-muted-foreground text-xs">
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                  {p.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
                </div>
                {sent ? (
                  <Check className="h-4 w-4 text-secondary shrink-0" />
                ) : (
                  <span className="text-xs text-primary font-medium shrink-0">Send</span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
