import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Loader2, ArrowLeft, Send, MessageSquare, Pencil, Search, X, Pin,
  BellOff, Eye, Trash2, Volume2, VolumeX,
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { ThreadView } from "@/components/dm/ThreadView";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

/* ═══════════════════ Helpers ═══════════════════ */

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

function orderParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

const initials = (name: string) => (name || "?").slice(0, 2).toUpperCase();

/* ═══════════════════ Types ═══════════════════ */

interface ThreadRow {
  id: string;
  participant_a: string;
  participant_b: string;
  created_at: string;
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
  unread_count: number;
  is_pinned: boolean;
  is_muted: boolean;
  is_online: boolean;
  last_sender_is_me: boolean;
  request_status: string;
  is_a: boolean; // whether current user is participant_a
}

/* ═══════════════════ Swipeable Thread Row ═══════════════════ */

function SwipeableThreadRow({
  thread,
  isActive,
  onClick,
  onPin,
  onMute,
  onDelete,
  isMobile,
}: {
  thread: Thread;
  isActive: boolean;
  onClick: () => void;
  onPin: () => void;
  onMute: () => void;
  onDelete: () => void;
  isMobile: boolean;
}) {
  const x = useMotionValue(0);
  const actionsOpacity = useTransform(x, [-144, -72, 0], [1, 1, 0]);
  const deleteOpacity = useTransform(x, [-250, -200, -144], [1, 0.5, 0]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -220) {
      onDelete();
    }
  };

  const row = (
    <div
      className={`relative flex items-center gap-3 w-full px-4 cursor-pointer transition-colors ${
        isActive ? "bg-primary/[0.08]" : "hover:bg-[rgba(255,255,255,0.03)]"
      }`}
      style={{ height: 72 }}
      onClick={onClick}
    >
      {/* Avatar with presence dot */}
      <div className="relative shrink-0">
        <Avatar className="h-12 w-12">
          {thread.other_avatar_url && <AvatarImage src={thread.other_avatar_url} />}
          <AvatarFallback className="bg-accent text-muted-foreground text-sm">
            {initials(thread.other_display_name)}
          </AvatarFallback>
        </Avatar>
        {thread.is_online && (
          <span
            className="absolute bottom-0 right-0 h-[10px] w-[10px] rounded-full border-2 border-background"
            style={{ backgroundColor: "#22C55E" }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground truncate">{thread.other_display_name}</span>
          <span className="text-[11px] text-muted-foreground shrink-0 ml-auto">{timeAgo(thread.last_sent_at)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {thread.is_muted && <VolumeX className="h-[10px] w-[10px] text-muted-foreground shrink-0" />}
          <p
            className={`text-[13px] truncate flex-1 ${
              thread.unread_count > 0 ? "font-bold text-foreground" : "text-muted-foreground"
            }`}
          >
            {thread.last_sender_is_me && <span className="text-muted-foreground font-normal">You: </span>}
            {thread.last_message || "Start a conversation"}
          </p>
          {thread.unread_count > 0 && (
            <span className="shrink-0 flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {thread.unread_count > 9 ? "9+" : thread.unread_count}
            </span>
          )}
        </div>
      </div>

      {/* Pin icon */}
      {thread.is_pinned && (
        <Pin className="absolute top-2 right-3 h-[10px] w-[10px] text-muted-foreground" />
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="relative overflow-hidden">
        {/* Swipe actions behind */}
        <motion.div
          className="absolute inset-y-0 right-0 flex"
          style={{ opacity: actionsOpacity }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); onMute(); }}
            className="flex items-center justify-center w-[72px] bg-muted-foreground/20 text-foreground"
          >
            {thread.is_muted ? <Volume2 className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            className="flex items-center justify-center w-[72px] bg-primary text-primary-foreground"
          >
            <Pin className="h-5 w-5" />
          </button>
        </motion.div>
        <motion.div
          className="absolute inset-y-0 right-0 flex"
          style={{ opacity: deleteOpacity }}
        >
          <button
            className="flex items-center justify-center w-full bg-destructive text-destructive-foreground px-4"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </motion.div>
        <motion.div
          drag="x"
          dragConstraints={{ left: -144, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          style={{ x }}
          className="relative bg-background"
        >
          {row}
        </motion.div>
      </div>
    );
  }

  return row;
}

/* ═══════════════════ New Message Compose ═══════════════════ */

function NewMessageCompose({
  open,
  onClose,
  userId,
  existingThreads,
  onSelectThread,
  onCreateThread,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  existingThreads: Thread[];
  onSelectThread: (threadId: string) => void;
  onCreateThread: (recipientId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) { setQuery(""); setResults([]); }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
      .neq("id", userId)
      .limit(10);
    setResults(data ?? []);
    setLoading(false);
  }, [userId]);

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  };

  const existingMap = useMemo(() => {
    const map = new Map<string, string>();
    existingThreads.forEach((t) => map.set(t.other_id, t.id));
    return map;
  }, [existingThreads]);

  const handleSelect = (profileId: string) => {
    const existingId = existingMap.get(profileId);
    if (existingId) {
      onSelectThread(existingId);
    } else {
      onCreateThread(profileId);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">New message</DialogTitle>
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
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No results for "{query}"</p>
          )}
          {results.map((p) => {
            const hasThread = existingMap.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-accent/40 transition-colors text-left"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                  <AvatarFallback className="bg-accent text-muted-foreground text-xs">
                    {initials(p.display_name || p.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.display_name || p.username}</p>
                  {p.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
                </div>
                {hasThread && (
                  <span className="text-xs text-primary font-medium">Message</span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════ Messages Page ═══════════════════ */

const MessagesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { count: totalUnread } = useUnreadMessages();
  const selectedThreadId = searchParams.get("thread");
  const recipientParam = searchParams.get("to");
  const enquiryRef = searchParams.get("enquiry_title");
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobileShowThread, setMobileShowThread] = useState(!!selectedThreadId || !!recipientParam);
  const [activeTab, setActiveTab] = useState<"primary" | "requests">("primary");
  const [threadSearch, setThreadSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const isMobileView = typeof window !== "undefined" && window.innerWidth < 1024;

  // Browser tab title with unread count
  useEffect(() => {
    const title = totalUnread > 0 ? `(${totalUnread > 9 ? "9+" : totalUnread}) Messages — NeoScale AI` : "Messages — NeoScale AI";
    document.title = title;
    return () => { document.title = "NeoScale AI"; };
  }, [totalUnread]);

  // Fetch all threads
  const { data: allThreads, isLoading: threadsLoading } = useQuery({
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

      // Fetch profiles
      let profileMap = new Map<string, any>();
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", [...new Set(otherIds)]);
        (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
      }

      // Fetch presence
      let presenceMap = new Map<string, boolean>();
      if (otherIds.length > 0) {
        const { data: presence } = await supabase
          .from("dm_presence")
          .select("user_id, is_online")
          .in("user_id", [...new Set(otherIds)]);
        (presence ?? []).forEach((p: any) => presenceMap.set(p.user_id, p.is_online));
      }

      return rows
        .filter((t) => {
          const isA = t.participant_a === user!.id;
          return isA ? !t.is_deleted_a : !t.is_deleted_b;
        })
        .map((t): Thread => {
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
            unread_count: isA ? t.unread_count_a : t.unread_count_b,
            is_pinned: isA ? t.is_pinned_a : t.is_pinned_b,
            is_muted: isA ? t.is_muted_a : t.is_muted_b,
            is_online: presenceMap.get(otherId) ?? false,
            last_sender_is_me: t.last_message_sender_id === user!.id,
            request_status: t.request_status,
            is_a: isA,
          };
        });
    },
    enabled: !!user,
  });

  // Filter threads by tab and search
  const threads = useMemo(() => {
    if (!allThreads) return [];
    let filtered = allThreads.filter((t) =>
      activeTab === "primary" ? t.request_status === "accepted" : t.request_status === "pending"
    );
    if (threadSearch.trim()) {
      const q = threadSearch.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.other_display_name.toLowerCase().includes(q) ||
          t.other_username.toLowerCase().includes(q)
      );
    }
    return filtered.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.last_sent_at).getTime() - new Date(a.last_sent_at).getTime();
    });
  }, [allThreads, activeTab, threadSearch]);

  const requestCount = useMemo(
    () => (allThreads ?? []).filter((t) => t.request_status === "pending").length,
    [allThreads]
  );

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

  // Mark as read
  useEffect(() => {
    if (!activeThreadId || !user) return;
    const resetUnread = async () => {
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

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime
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

  // Realtime for thread list updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dm-threads-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_threads" },
        () => queryClient.invalidateQueries({ queryKey: ["dm_threads"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const getOtherProfile = useCallback(() => {
    if (recipientParam && recipientProfile) return recipientProfile;
    if (!activeThreadId || !allThreads) return null;
    const thread = allThreads.find((t) => t.id === activeThreadId);
    if (thread) return { id: thread.other_id, display_name: thread.other_display_name, username: thread.other_username, avatar_url: thread.other_avatar_url };
    return null;
  }, [activeThreadId, allThreads, recipientParam, recipientProfile]);

  const otherUser = getOtherProfile();

  const selectThread = (threadId: string) => {
    setSearchParams({ thread: threadId });
    setMobileShowThread(true);
  };

  const handleBack = () => {
    setSearchParams({});
    setMobileShowThread(false);
  };

  // Thread actions
  const togglePin = async (thread: Thread) => {
    const field = thread.is_a ? "is_pinned_a" : "is_pinned_b";
    await supabase.from("dm_threads").update({ [field]: !thread.is_pinned }).eq("id", thread.id);
    queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
  };

  const toggleMute = async (thread: Thread) => {
    const field = thread.is_a ? "is_muted_a" : "is_muted_b";
    await supabase.from("dm_threads").update({ [field]: !thread.is_muted }).eq("id", thread.id);
    queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
  };

  const markUnread = async (thread: Thread) => {
    const field = thread.is_a ? "unread_count_a" : "unread_count_b";
    if (thread.unread_count === 0) {
      await supabase.from("dm_threads").update({ [field]: 1 }).eq("id", thread.id);
      queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
    }
  };

  const deleteThread = async (thread: Thread) => {
    const field = thread.is_a ? "is_deleted_a" : "is_deleted_b";
    await supabase.from("dm_threads").update({ [field]: true }).eq("id", thread.id);
    queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
    if (activeThreadId === thread.id) handleBack();
  };

  const acceptRequest = async (thread: Thread) => {
    await supabase.from("dm_threads").update({ request_status: "accepted" }).eq("id", thread.id);
    queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
  };

  const declineRequest = async (thread: Thread) => {
    const field = thread.is_a ? "is_deleted_a" : "is_deleted_b";
    await supabase.from("dm_threads").update({ [field]: true }).eq("id", thread.id);
    queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
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
    if (!threadId) {
      const [pA, pB] = orderParticipants(user.id, recipientId);
      const { data: newThread, error: threadErr } = await supabase
        .from("dm_threads")
        .insert({ participant_a: pA, participant_b: pB })
        .select("id")
        .single();
      if (threadErr || !newThread) {
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
      if (recipientParam) setSearchParams({ thread: threadId });
      queryClient.invalidateQueries({ queryKey: ["dm_messages", threadId] });
      queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
    }
    setSending(false);
  };

  const handleCreateThread = async (recipientId: string) => {
    if (!user) return;
    const [pA, pB] = orderParticipants(user.id, recipientId);

    // Check follow relationship for request_status
    const { data: followData } = await supabase
      .from("follows")
      .select("id")
      .or(`and(follower_id.eq.${user.id},following_id.eq.${recipientId}),and(follower_id.eq.${recipientId},following_id.eq.${user.id})`)
      .limit(1);

    const status = (followData && followData.length > 0) ? "accepted" : "pending";

    const { data: newThread } = await supabase
      .from("dm_threads")
      .insert({ participant_a: pA, participant_b: pB, request_status: status })
      .select("id")
      .single();

    if (newThread) {
      queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
      selectThread(newThread.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ═══════════ Pull to Refresh ═══════════ */
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const [pullDelta, setPullDelta] = useState(0);

  const handlePullTouchStart = (e: React.TouchEvent) => {
    pullStartY.current = e.touches[0].clientY;
  };
  const handlePullTouchMove = (e: React.TouchEvent) => {
    const el = e.currentTarget;
    if (el.scrollTop > 0) return;
    const delta = Math.max(0, Math.min(80, e.touches[0].clientY - pullStartY.current));
    setPullDelta(delta);
  };
  const handlePullTouchEnd = async () => {
    if (pullDelta >= 60 && !pullRefreshing) {
      setPullRefreshing(true);
      await queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
      setPullRefreshing(false);
    }
    setPullDelta(0);
  };

  /* ═══════════ Thread List ═══════════ */
  const ThreadList = () => (
    <div className="h-full flex flex-col" style={{ width: isMobileView ? "100%" : 360 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 shrink-0" style={{ height: 52 }}>
        <h2 className="text-lg font-bold text-foreground">Messages</h2>
        <button
          onClick={() => setComposeOpen(true)}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/40"
        >
          <Pencil className="h-5 w-5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={threadSearch}
            onChange={(e) => setThreadSearch(e.target.value)}
            placeholder="Search messages..."
            className="h-9 rounded-full bg-accent/50 border-border pl-9 pr-8 text-sm"
          />
          {threadSearch && (
            <button
              onClick={() => setThreadSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 gap-4 shrink-0 border-b border-border">
        <button
          onClick={() => setActiveTab("primary")}
          className={`pb-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "primary" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Primary
          {activeTab === "primary" && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`pb-2.5 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${
            activeTab === "requests" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Requests
          {requestCount > 0 && (
            <span className="flex items-center justify-center h-[16px] min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {requestCount}
            </span>
          )}
          {activeTab === "requests" && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
          )}
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        onTouchStart={isMobileView ? handlePullTouchStart : undefined}
        onTouchMove={isMobileView ? handlePullTouchMove : undefined}
        onTouchEnd={isMobileView ? handlePullTouchEnd : undefined}
      >
        {/* Pull to refresh indicator */}
        {pullDelta > 0 && (
          <div className="flex justify-center py-2" style={{ height: pullDelta }}>
            <Loader2 className={`h-4 w-4 text-muted-foreground ${pullDelta >= 60 ? "animate-spin" : ""}`} />
          </div>
        )}
        {activeTab === "requests" && threads.length > 0 && (
          <p className="text-xs text-muted-foreground px-4 py-3">
            These are message requests from people you don't follow.
          </p>
        )}

        {threadsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-4 py-16">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">Send a message to start a conversation.</p>
            <Button
              onClick={() => setComposeOpen(true)}
              className="mt-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm px-5 h-9"
            >
              New message
            </Button>
          </div>
        ) : (
          threads.map((t) =>
            activeTab === "requests" ? (
              /* Request row */
              <div key={t.id}>
                <SwipeableThreadRow
                  thread={t}
                  isActive={activeThreadId === t.id}
                  onClick={() => selectThread(t.id)}
                  onPin={() => togglePin(t)}
                  onMute={() => toggleMute(t)}
                  onDelete={() => declineRequest(t)}
                  isMobile={!!isMobileView}
                />
                <div className="flex gap-2 px-4 pb-3 -mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-full border-secondary text-secondary hover:bg-secondary/10"
                    onClick={(e) => { e.stopPropagation(); acceptRequest(t); }}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-full border-border text-muted-foreground hover:bg-accent/40"
                    onClick={(e) => { e.stopPropagation(); declineRequest(t); }}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ) : (
              /* Primary thread row with context menu (desktop) */
              isMobileView ? (
                <SwipeableThreadRow
                  key={t.id}
                  thread={t}
                  isActive={activeThreadId === t.id}
                  onClick={() => selectThread(t.id)}
                  onPin={() => togglePin(t)}
                  onMute={() => toggleMute(t)}
                  onDelete={() => deleteThread(t)}
                  isMobile
                />
              ) : (
                <ContextMenu key={t.id}>
                  <ContextMenuTrigger>
                    <SwipeableThreadRow
                      thread={t}
                      isActive={activeThreadId === t.id}
                      onClick={() => selectThread(t.id)}
                      onPin={() => togglePin(t)}
                      onMute={() => toggleMute(t)}
                      onDelete={() => deleteThread(t)}
                      isMobile={false}
                    />
                  </ContextMenuTrigger>
                  <ContextMenuContent className="bg-card/95 backdrop-blur-md border-border">
                    <ContextMenuItem onClick={() => togglePin(t)} className="text-sm gap-2">
                      <Pin className="h-4 w-4" /> {t.is_pinned ? "Unpin" : "Pin"}
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => toggleMute(t)} className="text-sm gap-2">
                      {t.is_muted ? <Volume2 className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                      {t.is_muted ? "Unmute notifications" : "Mute notifications"}
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => markUnread(t)} className="text-sm gap-2">
                      <Eye className="h-4 w-4" /> Mark as unread
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => deleteThread(t)} className="text-sm gap-2 text-destructive">
                      <Trash2 className="h-4 w-4" /> Delete conversation
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )
            )
          )
        )}
      </div>
    </div>
  );

  /* ═══════════ Thread View (uses extracted component) ═══════════ */
  const ThreadViewPanel = () => {
    if (!activeThreadId || !otherUser) return null;
    return (
      <ThreadView
        threadId={activeThreadId}
        otherUser={{
          id: (otherUser as any).id,
          display_name: (otherUser as any).display_name,
          username: (otherUser as any).username,
          avatar_url: (otherUser as any).avatar_url,
        }}
        onBack={handleBack}
        enquiryRef={enquiryRef}
      />
    );
  };

  const EmptyThread = () => (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <p className="text-sm text-muted-foreground">Select a conversation</p>
    </div>
  );

  const showThreadView = activeThreadId || recipientParam;

  return (
    <div className={`flex flex-col ${mobileShowThread && showThreadView && isMobileView ? 'h-screen' : 'h-[calc(100vh-56px)]'} lg:h-screen`}>
      <SeoHead title="Messages — NeoScale AI" description="Your messages" path="/messages" />

      {/* Desktop: two columns */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <div className="shrink-0 border-r border-border overflow-hidden">
          <ThreadList />
        </div>
        <div className="flex-1 overflow-hidden">
          {showThreadView ? <ThreadViewPanel /> : <EmptyThread />}
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden flex-1 overflow-hidden">
        {mobileShowThread && showThreadView ? <ThreadViewPanel /> : <ThreadList />}
      </div>

      {/* Compose overlay */}
      <NewMessageCompose
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        userId={user?.id ?? ""}
        existingThreads={allThreads ?? []}
        onSelectThread={selectThread}
        onCreateThread={handleCreateThread}
      />
    </div>
  );
};

export default MessagesPage;
