import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Send, MessageSquare } from "lucide-react";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

/** Ensure participant_a < participant_b for the CHECK constraint */
function orderParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

interface ThreadRow {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  unread_count_a: number;
  unread_count_b: number;
  is_pinned_a: boolean;
  is_pinned_b: boolean;
  is_muted_a: boolean;
  is_muted_b: boolean;
  is_deleted_a: boolean;
  is_deleted_b: boolean;
  request_status: string;
}

interface Thread {
  id: string;
  other_id: string;
  other_display_name: string;
  other_username: string;
  other_avatar_url: string | null;
  last_message: string;
  last_sent_at: string;
  has_unread: boolean;
  is_pinned: boolean;
  is_muted: boolean;
}

const MessagesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const selectedThreadId = searchParams.get("thread");
  const recipientParam = searchParams.get("to");
  const enquiryRef = searchParams.get("enquiry_title");
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileShowThread, setMobileShowThread] = useState(!!selectedThreadId || !!recipientParam);

  // Fetch threads
  const { data: threads, isLoading: threadsLoading } = useQuery({
    queryKey: ["dm_threads", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dm_threads")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as ThreadRow[];
      const otherIds = rows.map((t) =>
        t.participant_a === user!.id ? t.participant_b : t.participant_a
      );

      let profileMap = new Map<string, any>();
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", otherIds);
        (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
      }

      const result: Thread[] = rows
        .filter((t) => {
          // Hide soft-deleted threads for this user
          const isA = t.participant_a === user!.id;
          return isA ? !t.is_deleted_a : !t.is_deleted_b;
        })
        .map((t) => {
          const isA = t.participant_a === user!.id;
          const otherId = isA ? t.participant_b : t.participant_a;
          const other = profileMap.get(otherId);
          return {
            id: t.id,
            other_id: otherId,
            other_display_name: other?.display_name || other?.username || "User",
            other_username: other?.username || "",
            other_avatar_url: other?.avatar_url || null,
            last_message: t.last_message_preview || "",
            last_sent_at: t.last_message_at,
            has_unread: (isA ? t.unread_count_a : t.unread_count_b) > 0,
            is_pinned: isA ? t.is_pinned_a : t.is_pinned_b,
            is_muted: isA ? t.is_muted_a : t.is_muted_b,
          };
        });

      // Pinned first, then by date
      return result.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.last_sent_at).getTime() - new Date(a.last_sent_at).getTime();
      });
    },
    enabled: !!user,
  });

  // When opening via ?to=recipientId, find or prepare thread
  const { data: recipientThread } = useQuery({
    queryKey: ["dm_thread_for_recipient", recipientParam, user?.id],
    queryFn: async () => {
      const [pA, pB] = orderParticipants(user!.id, recipientParam!);
      const { data } = await supabase
        .from("dm_threads")
        .select("id")
        .eq("participant_a", pA)
        .eq("participant_b", pB)
        .maybeSingle();
      return data?.id || null;
    },
    enabled: !!recipientParam && !!user,
  });

  const { data: recipientProfile } = useQuery({
    queryKey: ["msg_recipient_profile", recipientParam],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", recipientParam!)
        .maybeSingle();
      return data;
    },
    enabled: !!recipientParam,
  });

  const activeThreadId = selectedThreadId || recipientThread || null;

  // Fetch messages for selected thread
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["dm_messages", activeThreadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dm_messages")
        .select("*")
        .eq("thread_id", activeThreadId!)
        .eq("is_unsent", false)
        .order("sent_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!activeThreadId,
    refetchInterval: 5000,
  });

  // Mark as read when opening thread
  useEffect(() => {
    if (!activeThreadId || !user) return;
    // Reset unread count for this user on the thread
    const resetUnread = async () => {
      // First determine if user is participant_a or _b
      const { data: thread } = await supabase
        .from("dm_threads")
        .select("participant_a")
        .eq("id", activeThreadId)
        .maybeSingle();
      if (!thread) return;
      const isA = thread.participant_a === user.id;
      await supabase
        .from("dm_threads")
        .update(isA ? { unread_count_a: 0 } : { unread_count_b: 0 })
        .eq("id", activeThreadId);
      // Mark individual messages as read
      await supabase
        .from("dm_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("thread_id", activeThreadId)
        .neq("sender_id", user.id)
        .is("read_at", null);
      queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
    };
    resetUnread();
  }, [activeThreadId, user, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!activeThreadId) return;
    const channel = supabase
      .channel(`dm-${activeThreadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dm_messages", filter: `thread_id=eq.${activeThreadId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dm_messages", activeThreadId] });
          queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeThreadId, queryClient]);

  // Get other user info for thread header
  const getOtherProfile = useCallback(() => {
    if (recipientParam && recipientProfile) return recipientProfile;
    if (!activeThreadId || !threads) return null;
    const thread = threads.find((t) => t.id === activeThreadId);
    if (thread) return { id: thread.other_id, display_name: thread.other_display_name, username: thread.other_username, avatar_url: thread.other_avatar_url };
    return null;
  }, [activeThreadId, threads, recipientParam, recipientProfile]);

  const otherUser = getOtherProfile();

  const selectThread = (threadId: string) => {
    setSearchParams({ thread: threadId });
    setMobileShowThread(true);
  };

  const handleBack = () => {
    setSearchParams({});
    setMobileShowThread(false);
  };

  const handleSend = async () => {
    if (!newMsg.trim() || !user || sending) return;
    const recipientId = recipientParam || (otherUser as any)?.id;
    if (!recipientId) return;

    setSending(true);
    const msgText = newMsg.trim();
    const isFirstMessage = !messages || messages.length === 0;
    const enquiryTitle = isFirstMessage && enquiryRef ? enquiryRef : null;
    const finalText = enquiryTitle ? `Re: your enquiry about '${enquiryTitle}'\n\n${msgText}` : msgText;

    let threadId = activeThreadId;

    // Create thread if it doesn't exist
    if (!threadId) {
      const [pA, pB] = orderParticipants(user.id, recipientId);
      const { data: newThread, error: threadErr } = await supabase
        .from("dm_threads")
        .insert({ participant_a: pA, participant_b: pB })
        .select("id")
        .single();
      if (threadErr || !newThread) {
        // Thread might already exist (race condition)
        const { data: existing } = await supabase
          .from("dm_threads")
          .select("id")
          .eq("participant_a", pA)
          .eq("participant_b", pB)
          .single();
        threadId = existing?.id;
      } else {
        threadId = newThread.id;
      }
    }

    if (!threadId) { setSending(false); return; }

    const { error } = await supabase.from("dm_messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      message_type: "text",
      text_content: finalText,
    });

    if (!error) {
      setNewMsg("");
      if (recipientParam) {
        setSearchParams({ thread: threadId });
      }
      queryClient.invalidateQueries({ queryKey: ["dm_messages", threadId] });
      queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const initials = (name: string) => (name || "?").slice(0, 2).toUpperCase();

  /* ---- Thread List ---- */
  const ThreadList = () => (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-bold text-foreground">Messages</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {threadsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !threads || threads.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16 px-4">No messages yet.</p>
        ) : (
          threads.map((t) => (
            <button
              key={t.id}
              onClick={() => selectThread(t.id)}
              className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-accent/40 border-b border-border ${
                activeThreadId === t.id ? "bg-accent/30" : ""
              }`}
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-accent text-muted-foreground text-xs">
                  {initials(t.other_display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm truncate ${t.has_unread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                    {t.other_display_name}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(t.last_sent_at)}</span>
                  {t.has_unread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">{t.last_message}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  /* ---- Thread View ---- */
  const ThreadView = () => (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <button onClick={handleBack} className="lg:hidden p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {otherUser && (
          <>
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-accent text-muted-foreground text-xs">
                {initials((otherUser as any).display_name || (otherUser as any).username)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-foreground">{(otherUser as any).display_name || (otherUser as any).username}</p>
              {(otherUser as any).username && <p className="text-xs text-muted-foreground">@{(otherUser as any).username}</p>}
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messagesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !messages || messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {enquiryRef ? `Reply to the enquiry about "${enquiryRef}"` : "Start the conversation"}
          </p>
        ) : (
          messages.map((msg: any) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] px-4 py-2.5 text-sm leading-relaxed ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-[16px_16px_4px_16px]"
                      : "bg-card text-foreground rounded-[16px_16px_16px_4px] border border-border"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text_content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {timeAgo(msg.sent_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border flex items-center gap-2">
        <Input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value.slice(0, 1000))}
          onKeyDown={handleKeyDown}
          placeholder={otherUser ? `Message ${(otherUser as any).display_name || (otherUser as any).username}...` : "Type a message..."}
          className="flex-1 bg-card border-border text-sm"
          maxLength={1000}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!newMsg.trim() || sending}
          className="shrink-0 bg-primary hover:bg-primary/90"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  /* ---- Empty state ---- */
  const EmptyThread = () => (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <p className="text-sm text-muted-foreground">Select a conversation</p>
    </div>
  );

  const showThreadView = activeThreadId || recipientParam;

  return (
    <div className="h-[calc(100vh-56px)] lg:h-[calc(100vh-0px)] flex flex-col">
      <SeoHead title="Messages — NeoScale AI" description="Your messages" path="/messages" />

      {/* Desktop: two columns */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <div className="w-[300px] shrink-0 border-r border-border overflow-hidden">
          <ThreadList />
        </div>
        <div className="flex-1 overflow-hidden">
          {showThreadView ? <ThreadView /> : <EmptyThread />}
        </div>
      </div>

      {/* Mobile: either thread list or thread view */}
      <div className="lg:hidden flex-1 overflow-hidden">
        {mobileShowThread && showThreadView ? <ThreadView /> : <ThreadList />}
      </div>
    </div>
  );
};

export default MessagesPage;
