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

function makeThreadId(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function getOtherId(threadId: string, myId: string): string {
  const [a, b] = threadId.split("-");
  return a === myId ? b : a;
}

interface Thread {
  thread_id: string;
  other_id: string;
  other_display_name: string;
  other_username: string;
  last_message: string;
  last_sent_at: string;
  has_unread: boolean;
}

const MessagesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const selectedThread = searchParams.get("thread");
  const recipientParam = searchParams.get("to"); // pre-fill new thread
  const enquiryRef = searchParams.get("enquiry_title");
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileShowThread, setMobileShowThread] = useState(!!selectedThread || !!recipientParam);

  // Fetch threads
  const { data: threads, isLoading: threadsLoading } = useQuery({
    queryKey: ["message_threads", user?.id],
    queryFn: async () => {
      // Get all messages involving this user
      const { data, error } = await supabase
        .from("messages" as any)
        .select("thread_id, sender_id, recipient_id, text, sent_at, is_read")
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order("sent_at", { ascending: false });
      if (error) throw error;

      // Group by thread_id, take latest message per thread
      const threadMap = new Map<string, any>();
      for (const msg of (data as any[])) {
        if (!threadMap.has(msg.thread_id)) {
          threadMap.set(msg.thread_id, msg);
        }
      }

      // Check unread per thread
      const unreadThreads = new Set<string>();
      for (const msg of (data as any[])) {
        if (msg.recipient_id === user!.id && !msg.is_read) {
          unreadThreads.add(msg.thread_id);
        }
      }

      // Get other user profiles
      const otherIds = [...new Set(
        [...threadMap.values()].map((m) => getOtherId(m.thread_id, user!.id))
      )];

      let profileMap = new Map<string, any>();
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", otherIds);
        (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
      }

      const result: Thread[] = [...threadMap.entries()].map(([tid, msg]) => {
        const otherId = getOtherId(tid, user!.id);
        const other = profileMap.get(otherId);
        return {
          thread_id: tid,
          other_id: otherId,
          other_display_name: other?.display_name || other?.username || "User",
          other_username: other?.username || "",
          last_message: msg.text,
          last_sent_at: msg.sent_at,
          has_unread: unreadThreads.has(tid),
        };
      });

      return result.sort((a, b) => new Date(b.last_sent_at).getTime() - new Date(a.last_sent_at).getTime());
    },
    enabled: !!user,
  });

  // If recipientParam, compute the thread_id
  const computedThreadId = recipientParam && user
    ? makeThreadId(user.id, recipientParam)
    : selectedThread;

  // Fetch recipient profile when starting new thread
  const { data: recipientProfile } = useQuery({
    queryKey: ["msg_recipient_profile", recipientParam],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("id", recipientParam!)
        .maybeSingle();
      return data;
    },
    enabled: !!recipientParam,
  });

  // Fetch messages for selected thread
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["thread_messages", computedThreadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages" as any)
        .select("*")
        .eq("thread_id", computedThreadId!)
        .order("sent_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!computedThreadId,
    refetchInterval: 5000,
  });

  // Mark as read when opening thread
  useEffect(() => {
    if (!computedThreadId || !user) return;
    supabase
      .from("messages" as any)
      .update({ is_read: true } as any)
      .eq("thread_id", computedThreadId)
      .eq("recipient_id", user.id)
      .eq("is_read", false)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["message_threads"] });
      });
  }, [computedThreadId, user, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get other user info for thread header
  const getOtherProfile = useCallback(() => {
    if (recipientParam && recipientProfile) return recipientProfile;
    if (!computedThreadId || !threads) return null;
    const thread = threads.find((t) => t.thread_id === computedThreadId);
    if (thread) return { id: thread.other_id, display_name: thread.other_display_name, username: thread.other_username };
    return null;
  }, [computedThreadId, threads, recipientParam, recipientProfile]);

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
    const threadId = makeThreadId(user.id, recipientId);
    const msgText = newMsg.trim();

    // Check if this is a reply to enquiry (first message in new thread)
    const isFirstMessage = !messages || messages.length === 0;
    const enquiryTitle = isFirstMessage && enquiryRef ? enquiryRef : null;

    const insertData: any = {
      thread_id: threadId,
      sender_id: user.id,
      recipient_id: recipientId,
      text: enquiryTitle ? `Re: your enquiry about '${enquiryTitle}'\n\n${msgText}` : msgText,
    };

    const { error } = await supabase.from("messages" as any).insert(insertData as any);

    if (!error) {
      setNewMsg("");
      // If we were on "to" param, switch to thread view
      if (recipientParam) {
        setSearchParams({ thread: threadId });
      }
      queryClient.invalidateQueries({ queryKey: ["thread_messages", threadId] });
      queryClient.invalidateQueries({ queryKey: ["message_threads"] });
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
              key={t.thread_id}
              onClick={() => selectThread(t.thread_id)}
              className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-accent/40 border-b border-border ${
                computedThreadId === t.thread_id ? "bg-accent/30" : ""
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
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
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

  const showThreadView = computedThreadId || recipientParam;

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
